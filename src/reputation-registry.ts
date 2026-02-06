import { BigInt, Bytes, ethereum, log, BigDecimal, DataSourceContext } from "@graphprotocol/graph-ts"
import { BIGINT_ZERO, BIGINT_ONE } from "./constants"
import { getChainId } from "./utils/chain"
import { isIpfsUri, extractIpfsHash, determineUriType, logIpfsExtraction } from "./utils/ipfs"
import {
  NewFeedback,
  FeedbackRevoked,
  ResponseAppended
} from "../generated/ReputationRegistry/ReputationRegistry"
import { FeedbackFile as FeedbackFileTemplate } from "../generated/templates"
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

function pow10BigDecimal(decimals: i32): BigDecimal {
  let result = BigDecimal.fromString("1")
  let ten = BigDecimal.fromString("10")
  for (let i = 0; i < decimals; i++) {
    result = result.times(ten)
  }
  return result
}

function computeFeedbackValue(rawValue: BigInt, valueDecimals: i32): BigDecimal {
  // Store the computed value as BigDecimal: rawValue / 10^valueDecimals
  // rawValue may be negative (int256).
  let v = BigDecimal.fromString(rawValue.toString())
  if (valueDecimals <= 0) return v
  return v.div(pow10BigDecimal(valueDecimals))
}

export function handleNewFeedback(event: NewFeedback): void {
  let agentId = event.params.agentId
  let clientAddress = event.params.clientAddress
  let feedbackIndex = event.params.feedbackIndex
  let chainId = getChainId()
  let agentEntityId = `${chainId.toString()}:${agentId.toString()}`
  
  // Load agent
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    log.warning("Feedback for unknown agent: {}", [agentEntityId])
    return
  }
  
  // Create feedback entity
  let feedbackId = `${agentEntityId}:${clientAddress.toHexString()}:${feedbackIndex.toString()}`
  let feedback = new Feedback(feedbackId)
  feedback.agent = agentEntityId
  feedback.clientAddress = clientAddress
  feedback.feedbackIndex = feedbackIndex
  let feedbackValue = computeFeedbackValue(event.params.value, event.params.valueDecimals as i32)
  feedback.value = feedbackValue
  // Jan 2026 ABI change: tag1 is now a non-indexed string, so it's available as human-readable data.
  feedback.tag1 = event.params.tag1
  feedback.tag2 = event.params.tag2
  feedback.endpoint = event.params.endpoint
  feedback.feedbackURI = event.params.feedbackURI
  feedback.feedbackURIType = "unknown" // Will be updated by parseFeedbackFile
  feedback.feedbackHash = event.params.feedbackHash
  feedback.isRevoked = false
  feedback.createdAt = event.block.timestamp
  feedback.revokedAt = null
  
  // Parse off-chain data from URI if available
  if (event.params.feedbackURI.length > 0) {
    // The feedback file parsing will be handled by the IPFS file data source
    // when the file is loaded from IPFS
    // Determine URI type using centralized utility
    feedback.feedbackURIType = determineUriType(event.params.feedbackURI)
  }
  
  feedback.save()
  
  // Trigger IPFS file data source if URI is IPFS
  if (event.params.feedbackURI.length > 0 && isIpfsUri(event.params.feedbackURI)) {
    let ipfsHash = extractIpfsHash(event.params.feedbackURI)
    logIpfsExtraction("feedback", event.params.feedbackURI, ipfsHash)
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
  
  // Update agent statistics
  updateAgentStats(agent, feedbackValue, event.block.timestamp)
  
  // Tag statistics removed for scalability
  
  // Update protocol stats
  updateProtocolStats(BigInt.fromI32(chainId), agent, event.block.timestamp, feedback.tag1 ? feedback.tag1! : "", event.params.tag2)
  
  // Update global stats - feedback
  let globalStats = GlobalStats.load("global")
  if (globalStats == null) {
    globalStats = new GlobalStats("global")
    globalStats.totalAgents = BIGINT_ZERO
    globalStats.totalFeedback = BIGINT_ZERO
    globalStats.totalValidations = BIGINT_ZERO
    globalStats.totalProtocols = BIGINT_ZERO
    globalStats.agents = []
    globalStats.tags = []
    globalStats.updatedAt = BIGINT_ZERO
  }
  
  globalStats.totalFeedback = globalStats.totalFeedback.plus(BIGINT_ONE)
  
  // Add tags to global tags array
  let currentGlobalTags = globalStats.tags
  
  // Process tag1
  if (feedback.tag1 && feedback.tag1!.length > 0 && !currentGlobalTags.includes(feedback.tag1!)) {
    currentGlobalTags.push(feedback.tag1!)
  }
  // Process tag2
  if (event.params.tag2.length > 0 && !currentGlobalTags.includes(event.params.tag2)) {
    currentGlobalTags.push(event.params.tag2)
  }
  
  globalStats.tags = currentGlobalTags
  globalStats.updatedAt = event.block.timestamp
  globalStats.save()
  
  log.info("New feedback for agent {}: value {} from {}", [
    agentEntityId,
    feedbackValue.toString(),
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
      updateAgentStatsAfterRevocation(agent, feedback.value, event.block.timestamp)
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
  let responseId = `${feedbackId}:${event.transaction.hash.toHexString()}:${event.logIndex.toString()}`
  let response = new FeedbackResponse(responseId)
  response.feedback = feedbackId
  response.responder = responder
  response.responseUri = event.params.responseURI
  response.responseHash = event.params.responseHash
  response.createdAt = event.block.timestamp
  response.save()
  
  log.info("Response appended to feedback {}: {}", [feedbackId, responseId])
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function updateAgentStats(agent: Agent, value: BigDecimal, timestamp: BigInt): void {
  // Update total feedback count
  agent.totalFeedback = agent.totalFeedback.plus(BIGINT_ONE)
  
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
    stats.totalFeedback = BIGINT_ZERO
    stats.averageFeedbackValue = BigDecimal.fromString("0")
    stats.totalValidations = BIGINT_ZERO
    stats.completedValidations = BIGINT_ZERO
    stats.averageValidationScore = BigDecimal.fromString("0")
    stats.lastActivity = timestamp
  }
  
  // Update feedback stats
  stats.totalFeedback = stats.totalFeedback.plus(BIGINT_ONE)
  
  // Update average feedback value
  let n = stats.totalFeedback
  let nMinus1 = n.minus(BIGINT_ONE)
  let total = stats.averageFeedbackValue.times(BigDecimal.fromString(nMinus1.toString()))
  let newTotal = total.plus(value)
  stats.averageFeedbackValue = newTotal.div(BigDecimal.fromString(n.toString()))
  
  stats.lastActivity = timestamp
  stats.updatedAt = timestamp
  stats.save()
}

function updateAgentStatsAfterRevocation(agent: Agent, revokedValue: BigDecimal, timestamp: BigInt): void {
  // Update total feedback count
  if (agent.totalFeedback.gt(BIGINT_ZERO)) {
    agent.totalFeedback = agent.totalFeedback.minus(BIGINT_ONE)
  }
  
  // Note: Agent does not track averages - only AgentStats does
  
  agent.updatedAt = timestamp
  agent.save()
  
  // Update agent stats
  let stats = AgentStats.load(agent.id)
  if (stats != null) {
    let nOld = stats.totalFeedback
    if (nOld.gt(BIGINT_ZERO)) {
      let totalOld = stats.averageFeedbackValue.times(BigDecimal.fromString(nOld.toString()))
      let nNew = nOld.minus(BIGINT_ONE)
      stats.totalFeedback = nNew

      if (nNew.equals(BIGINT_ZERO)) {
        stats.averageFeedbackValue = BigDecimal.fromString("0")
      } else {
        let totalNew = totalOld.minus(revokedValue)
        stats.averageFeedbackValue = totalNew.div(BigDecimal.fromString(nNew.toString()))
      }
    }
    stats.updatedAt = timestamp
    stats.save()
  }
}

// Tag statistics removed for scalability



// Reputation score calculation removed


function updateProtocolStats(chainId: BigInt, agent: Agent, timestamp: BigInt, tag1: string, tag2: string): void {
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
    protocol.totalAgents = BIGINT_ZERO
    protocol.totalFeedback = BIGINT_ZERO
    protocol.totalValidations = BIGINT_ZERO
    protocol.agents = []
    protocol.tags = []
    protocol.updatedAt = BIGINT_ZERO
  }
  
  protocol.totalFeedback = protocol.totalFeedback.plus(BIGINT_ONE)
  
  // Add tags to protocol tags array
  let currentTags = protocol.tags
  
  // Process tag1 if not empty
  if (tag1.length > 0 && !currentTags.includes(tag1)) {
    currentTags.push(tag1)
  }
  // Process tag2 if not empty
  if (tag2.length > 0 && !currentTags.includes(tag2)) {
    currentTags.push(tag2)
  }
  
  protocol.tags = currentTags
  protocol.updatedAt = timestamp
  protocol.save()
}
