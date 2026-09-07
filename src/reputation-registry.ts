import { BigInt, Bytes, ethereum, log, BigDecimal, DataSourceContext } from "@graphprotocol/graph-ts"
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
  FeedbackPoint
} from "../generated/schema"
import { getOrCreateProtocol } from "./utils/protocol"
import { makeTimeseriesPointId } from "./utils/timeseries"

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

  // Ensure protocol exists and emit timeseries feedback point
  let protocol = getOrCreateProtocol(BigInt.fromI32(chainId), event.block.timestamp)
  if (protocol != null) {
    let pid = makeTimeseriesPointId(event.block.number, event.logIndex)
    let p = new FeedbackPoint(pid)
    p.protocol = protocol.id
    p.agent = agentEntityId
    p.timestamp = event.block.timestamp.toI64()
    p.value = feedbackValue
    p.valueDelta = feedbackValue
    p.isRevocation = false
    p.createdCount = BigInt.fromI32(1)
    p.revokedCount = BigInt.fromI32(0)
    p.valueForSum = feedbackValue
    p.save()
  }
  
  // Trigger IPFS file data source if URI is IPFS
  if (event.params.feedbackURI.length > 0 && isIpfsUri(event.params.feedbackURI)) {
    let ipfsHash = extractIpfsHash(event.params.feedbackURI)
    logIpfsExtraction("feedback", event.params.feedbackURI, ipfsHash)
    if (ipfsHash.length > 0) {
      let txHash = event.transaction.hash.toHexString()
      let fileId = `${txHash}:${event.logIndex.toString()}:${ipfsHash}`
      
      let context = new DataSourceContext()
      context.setString('feedbackId', feedbackId)
      context.setString('cid', ipfsHash)
      context.setString('txHash', txHash)
      context.setString('fileId', fileId)
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
  
  // Update agent counters for quick lookups (analytics are handled by aggregations)
  updateAgentCountersOnFeedback(agent, event.block.timestamp, true)
  
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

    // Ensure protocol exists and emit revocation point (valueDelta is negative)
    let protocol = getOrCreateProtocol(BigInt.fromI32(chainId), event.block.timestamp)
    if (protocol != null) {
      let neg = BigDecimal.fromString("-1").times(feedback.value)
      let pid = makeTimeseriesPointId(event.block.number, event.logIndex)
      let p = new FeedbackPoint(pid)
      p.protocol = protocol.id
      p.agent = agentEntityId
      p.timestamp = event.block.timestamp.toI64()
      p.value = feedback.value
      p.valueDelta = neg
      p.isRevocation = true
      p.createdCount = BigInt.fromI32(0)
      p.revokedCount = BigInt.fromI32(1)
      p.valueForSum = BigDecimal.fromString("0")
      p.save()
    }

    // Update agent counters to reflect revocation
    let agent = Agent.load(agentEntityId)
    if (agent != null) {
      updateAgentCountersOnFeedback(agent, event.block.timestamp, false)
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
  // Deprecated: analytics moved to timeseries + aggregations.
}

function updateAgentCountersOnFeedback(agent: Agent, timestamp: BigInt, isCreate: boolean): void {
  if (isCreate) {
    agent.totalFeedback = agent.totalFeedback.plus(BigInt.fromI32(1))
    agent.lastActivity = timestamp
  } else {
    if (agent.totalFeedback.gt(BigInt.fromI32(0))) {
      agent.totalFeedback = agent.totalFeedback.minus(BigInt.fromI32(1))
    }
  }

  agent.updatedAt = timestamp
  agent.save()
}

// Tag statistics removed for scalability



// Reputation score calculation removed


// Protocol rollups moved to timeseries + aggregations.
