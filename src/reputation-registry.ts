import { BigInt, Bytes, ethereum, log, BigDecimal, DataSourceContext } from "@graphprotocol/graph-ts"
import { getChainId } from "./utils/chain"
import { isIpfsUri, extractIpfsHash, determineUriType, logIpfsExtraction, bytes32ToString } from "./utils/ipfs"
import { isArweaveUri, extractArweaveTxId, logArweaveExtraction } from "./utils/arweave"
import {
  NewFeedback,
  FeedbackRevoked,
  ResponseAppended
} from "../generated/ReputationRegistry/ReputationRegistry"
import {
  FeedbackFile as FeedbackFileTemplate,
  ArweaveFeedbackFile as ArweaveFeedbackFileTemplate
} from "../generated/templates"
import {
  Agent,
  Feedback,
  FeedbackResponse,
  FeedbackFile,
  AgentStats,
  GlobalStats,
  Protocol
} from "../generated/schema"
import { getContractAddresses, getChainName, isSupportedChain } from "./contract-addresses"

// =============================================================================
// EVENT HANDLERS
// =============================================================================

export function handleNewFeedback(event: NewFeedback): void {
  let agentId = event.params.agentId
  let clientAddress = event.params.clientAddress
  let chainId = getChainId()
  let agentEntityId = `${chainId.toString()}:${agentId.toString()}`
  
  // Load agent
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    log.warning("Feedback for unknown agent: {}", [agentEntityId])
    return
  }
  
  // Create feedback entity
  let feedbackId = `${agentEntityId}:${clientAddress.toHexString()}:${agent.totalFeedback.plus(BigInt.fromI32(1)).toString()}`
  let feedback = new Feedback(feedbackId)
  feedback.agent = agentEntityId
  feedback.clientAddress = clientAddress
  feedback.score = event.params.score
  feedback.tag1 = bytes32ToString(event.params.tag1)
  feedback.tag2 = bytes32ToString(event.params.tag2)
  feedback.feedbackUri = event.params.feedbackUri
  feedback.feedbackURIType = "unknown" // Will be updated by parseFeedbackFile
  feedback.feedbackHash = event.params.feedbackHash
  feedback.isRevoked = false
  feedback.createdAt = event.block.timestamp
  feedback.revokedAt = null
  
  // Parse off-chain data from URI if available
  if (event.params.feedbackUri.length > 0) {
    // The feedback file parsing will be handled by the IPFS file data source
    // when the file is loaded from IPFS
    // Determine URI type using centralized utility
    feedback.feedbackURIType = determineUriType(event.params.feedbackUri)
  }
  
  feedback.save()

  // Handle file data source creation (mutually exclusive: IPFS or Arweave)
  if (event.params.feedbackUri.length > 0 && isIpfsUri(event.params.feedbackUri)) {
    let ipfsHash = extractIpfsHash(event.params.feedbackUri)
    logIpfsExtraction("feedback", event.params.feedbackUri, ipfsHash)
    if (ipfsHash.length > 0) {
      let txHash = event.transaction.hash.toHexString()
      let fileId = `${txHash}:${ipfsHash}`

      let context = new DataSourceContext()
      context.setString('feedbackId', feedbackId)
      context.setString('cid', ipfsHash)
      context.setString('txHash', txHash)
      context.setBigInt('timestamp', event.block.timestamp)
      context.setString('tag1OnChain', feedback.tag1 ? feedback.tag1! : "")
      context.setString('tag2OnChain', feedback.tag2 ? feedback.tag2! : "")
      FeedbackFileTemplate.createWithContext(ipfsHash, context)

      // Set the connection to the composite ID
      feedback.feedbackFile = fileId
      feedback.save()
      log.info("Set feedbackFile connection for feedback {} to ID: {}", [feedbackId, fileId])
    }
  }
  // Arweave handling (mutually exclusive with IPFS)
  else if (event.params.feedbackUri.length > 0 && isArweaveUri(event.params.feedbackUri)) {
    let arweaveTxId = extractArweaveTxId(event.params.feedbackUri)
    logArweaveExtraction("feedback", event.params.feedbackUri, arweaveTxId)

    if (arweaveTxId.length > 0) {
      let txHash = event.transaction.hash.toHexString()
      let fileId = `${txHash}:${arweaveTxId}`

      let context = new DataSourceContext()
      context.setString('feedbackId', feedbackId)
      context.setString('cid', arweaveTxId)  // Storage-agnostic: use 'cid' for both IPFS and Arweave
      context.setString('txHash', txHash)
      context.setBigInt('timestamp', event.block.timestamp)
      context.setString('tag1OnChain', feedback.tag1 ? feedback.tag1! : "")
      context.setString('tag2OnChain', feedback.tag2 ? feedback.tag2! : "")
      ArweaveFeedbackFileTemplate.createWithContext(arweaveTxId, context)

      feedback.feedbackFile = fileId
      feedback.save()
      log.info("Set feedbackFile connection for feedback {} to Arweave ID: {}", [feedbackId, fileId])
    }
  }

  // Update agent statistics
  updateAgentStats(agent, event.params.score, event.block.timestamp)
  
  // Tag statistics removed for scalability
  
  // Update protocol stats
  updateProtocolStats(BigInt.fromI32(chainId), agent, event.block.timestamp, event.params.tag1, event.params.tag2)
  
  // Update global stats - feedback
  let globalStats = GlobalStats.load("global")
  if (globalStats == null) {
    globalStats = new GlobalStats("global")
    globalStats.totalAgents = BigInt.fromI32(0)
    globalStats.totalFeedback = BigInt.fromI32(0)
    globalStats.totalValidations = BigInt.fromI32(0)
    globalStats.totalProtocols = BigInt.fromI32(0)
    globalStats.agents = []
    globalStats.tags = []
    globalStats.updatedAt = BigInt.fromI32(0)
  }
  
  globalStats.totalFeedback = globalStats.totalFeedback.plus(BigInt.fromI32(1))
  
  // Add tags to global tags array
  let currentGlobalTags = globalStats.tags
  
  // Process tag1
  if (event.params.tag1.toHexString() != "0x0000000000000000000000000000000000000000000000000000000000000000") {
    let tag1String = event.params.tag1.toHexString()
    if (!currentGlobalTags.includes(tag1String)) {
      currentGlobalTags.push(tag1String)
    }
  }
  
  // Process tag2
  if (event.params.tag2.toHexString() != "0x0000000000000000000000000000000000000000000000000000000000000000") {
    let tag2String = event.params.tag2.toHexString()
    if (!currentGlobalTags.includes(tag2String)) {
      currentGlobalTags.push(tag2String)
    }
  }
  
  globalStats.tags = currentGlobalTags
  globalStats.updatedAt = event.block.timestamp
  globalStats.save()
  
  log.info("New feedback for agent {}: score {} from {}", [
    agentEntityId,
    event.params.score.toString(),
    clientAddress.toHexString()
  ])
}

export function handleFeedbackRevoked(event: FeedbackRevoked): void {
  let agentId = event.params.agentId
  let clientAddress = event.params.clientAddress
  let feedbackIndex = event.params.feedbackIndex
  let chainId = getChainId()
  let agentEntityId = `${chainId.toString()}:${agentId.toString()}`
  
  // Find and revoke feedback
  let feedbackId = `${agentEntityId}:${clientAddress.toHexString()}:${feedbackIndex.toString()}`
  let feedback = Feedback.load(feedbackId)
  
  if (feedback != null) {
    feedback.isRevoked = true
    feedback.revokedAt = event.block.timestamp
    feedback.save()
    
    // Update agent stats to reflect revocation
    let agent = Agent.load(agentEntityId)
    if (agent != null) {
      updateAgentStatsAfterRevocation(agent, feedback.score, event.block.timestamp)
    }
    
    log.info("Feedback revoked for agent {}: {}", [agentEntityId, feedbackId])
  } else {
    log.warning("Attempted to revoke unknown feedback: {}", [feedbackId])
  }
}

export function handleResponseAppended(event: ResponseAppended): void {
  let agentId = event.params.agentId
  let clientAddress = event.params.clientAddress
  let feedbackIndex = event.params.feedbackIndex
  let responder = event.params.responder
  let chainId = getChainId()
  let agentEntityId = `${chainId.toString()}:${agentId.toString()}`
  
  // Find feedback
  let feedbackId = `${agentEntityId}:${clientAddress.toHexString()}:${feedbackIndex.toString()}`
  let feedback = Feedback.load(feedbackId)
  
  if (feedback == null) {
    log.warning("Response for unknown feedback: {}", [feedbackId])
    return
  }
  
  // Create response entity
  let responseId = `${feedbackId}:${event.block.timestamp.toString()}`
  let response = new FeedbackResponse(responseId)
  response.feedback = feedbackId
  response.responder = responder
  response.responseUri = event.params.responseUri
  response.responseHash = event.params.responseHash
  response.createdAt = event.block.timestamp
  response.save()
  
  log.info("Response appended to feedback {}: {}", [feedbackId, responseId])
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function updateAgentStats(agent: Agent, score: i32, timestamp: BigInt): void {
  // Update total feedback count
  agent.totalFeedback = agent.totalFeedback.plus(BigInt.fromI32(1))
  
  // Update last activity
  agent.lastActivity = timestamp
  agent.updatedAt = timestamp
  agent.save()
  
  // Update or create agent stats
  let statsId = agent.id
  let stats = AgentStats.load(statsId)
  
  if (stats == null) {
    stats = new AgentStats(statsId)
    stats.agent = agent.id
    stats.totalFeedback = BigInt.fromI32(0)
    stats.averageScore = BigDecimal.fromString("0")
    stats.scoreDistribution = [0, 0, 0, 0, 0] // [0-20, 21-40, 41-60, 61-80, 81-100]
    stats.totalValidations = BigInt.fromI32(0)
    stats.completedValidations = BigInt.fromI32(0)
    stats.averageValidationScore = BigDecimal.fromString("0")
    stats.lastActivity = timestamp
  }
  
  // Update feedback stats
  stats.totalFeedback = stats.totalFeedback.plus(BigInt.fromI32(1))
  
  // Update score distribution
  let distribution = stats.scoreDistribution
  if (score <= 20) {
    distribution[0] = distribution[0] + 1
  } else if (score <= 40) {
    distribution[1] = distribution[1] + 1
  } else if (score <= 60) {
    distribution[2] = distribution[2] + 1
  } else if (score <= 80) {
    distribution[3] = distribution[3] + 1
  } else {
    distribution[4] = distribution[4] + 1
  }
  stats.scoreDistribution = distribution
  
  // Update average score
  let totalScore = stats.averageScore.times(BigDecimal.fromString(stats.totalFeedback.minus(BigInt.fromI32(1)).toString()))
  let newTotalScore = totalScore.plus(BigDecimal.fromString(score.toString()))
  stats.averageScore = newTotalScore.div(BigDecimal.fromString(stats.totalFeedback.toString()))
  
  stats.lastActivity = timestamp
  stats.updatedAt = timestamp
  stats.save()
}

function updateAgentStatsAfterRevocation(agent: Agent, score: i32, timestamp: BigInt): void {
  // Update total feedback count
  agent.totalFeedback = agent.totalFeedback.minus(BigInt.fromI32(1))
  
  // Note: Agent no longer tracks averageScore - only AgentStats does
  
  agent.updatedAt = timestamp
  agent.save()
  
  // Update agent stats
  let stats = AgentStats.load(agent.id)
  if (stats != null) {
    stats.totalFeedback = stats.totalFeedback.minus(BigInt.fromI32(1))
    stats.updatedAt = timestamp
    stats.save()
  }
}

// Tag statistics removed for scalability



// Reputation score calculation removed


function updateProtocolStats(chainId: BigInt, agent: Agent, timestamp: BigInt, tag1: Bytes, tag2: Bytes): void {
  // Check if chain is supported
  if (!isSupportedChain(chainId)) {
    log.warning("Unsupported chain: {}", [chainId.toString()])
    return
  }

  let protocolId = chainId.toString()
  let protocol = Protocol.load(protocolId)
  
  if (protocol == null) {
    protocol = new Protocol(protocolId)
    protocol.chainId = chainId
    protocol.name = getChainName(chainId)
    
    // Get contract addresses dynamically based on chain
    let addresses = getContractAddresses(chainId)
    protocol.identityRegistry = addresses.identityRegistry
    protocol.reputationRegistry = addresses.reputationRegistry
    protocol.validationRegistry = addresses.validationRegistry
    
    // Initialize all fields
    protocol.totalAgents = BigInt.fromI32(0)
    protocol.totalFeedback = BigInt.fromI32(0)
    protocol.totalValidations = BigInt.fromI32(0)
    protocol.agents = []
    protocol.tags = []
    protocol.updatedAt = BigInt.fromI32(0)
  }
  
  protocol.totalFeedback = protocol.totalFeedback.plus(BigInt.fromI32(1))
  
  // Add tags to protocol tags array
  let currentTags = protocol.tags
  
  // Process tag1 if not empty
  if (tag1.toHexString() != "0x0000000000000000000000000000000000000000000000000000000000000000") {
    let tag1String = tag1.toHexString()
    if (!currentTags.includes(tag1String)) {
      currentTags.push(tag1String)
    }
  }
  
  // Process tag2 if not empty
  if (tag2.toHexString() != "0x0000000000000000000000000000000000000000000000000000000000000000") {
    let tag2String = tag2.toHexString()
    if (!currentTags.includes(tag2String)) {
      currentTags.push(tag2String)
    }
  }
  
  protocol.tags = currentTags
  protocol.updatedAt = timestamp
  protocol.save()
}
