import { BigInt, Bytes, ethereum, log, BigDecimal } from "@graphprotocol/graph-ts"
import { getChainId } from "./utils/chain"
import {
  ValidationRequest,
  ValidationResponse
} from "../generated/ValidationRegistry/ValidationRegistry"
import {
  Agent,
  Validation,
  AgentStats,
  GlobalStats,
  Protocol
} from "../generated/schema"
import { getContractAddresses, getChainName, isSupportedChain } from "./contract-addresses"


// =============================================================================
// EVENT HANDLERS
// =============================================================================

export function handleValidationRequest(event: ValidationRequest): void {
  let agentId = event.params.agentId
  let validatorAddress = event.params.validatorAddress
  let requestHash = event.params.requestHash
  let chainId = getChainId()
  let agentEntityId = `${chainId.toString()}:${agentId.toString()}`
  
  // Load agent
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    log.warning("Validation request for unknown agent: {}", [agentEntityId])
    return
  }
  
  // Create validation entity
  let validation = new Validation(requestHash.toHexString())
  validation.agent = agentEntityId
  validation.validatorAddress = validatorAddress
  validation.requestUri = event.params.requestURI
  validation.requestHash = requestHash
  validation.response = 0 // Pending
  validation.responseUri = ""
  validation.responseHash = Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000")
  validation.tag = ""
  validation.status = "PENDING"
  validation.createdAt = event.block.timestamp
  validation.updatedAt = event.block.timestamp
  validation.save()
  
  // Schedule timeout check (1 hour timeout)
  scheduleValidationTimeoutCheck(validation, event.block.timestamp)
  
  // Update agent activity
  agent.lastActivity = event.block.timestamp
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  // Update agent stats
  updateAgentValidationStats(agentEntityId, true, false, 0, event.block.timestamp)
  
  // Update protocol stats
  updateProtocolStats(BigInt.fromI32(chainId), agent, event.block.timestamp)
  
  // Update global stats - validation
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
  
  globalStats.totalValidations = globalStats.totalValidations.plus(BigInt.fromI32(1))
  globalStats.updatedAt = event.block.timestamp
  globalStats.save()
  
  log.info("Validation request for agent {}: {}", [agentEntityId, requestHash.toHexString()])
}

export function handleValidationResponse(event: ValidationResponse): void {
  let agentId = event.params.agentId
  let requestHash = event.params.requestHash
  let response = event.params.response
  let chainId = getChainId()
  let agentEntityId = `${chainId.toString()}:${agentId.toString()}`
  
  // Load validation
  let validation = Validation.load(requestHash.toHexString())
  if (validation == null) {
    log.warning("Response for unknown validation: {}", [requestHash.toHexString()])
    return
  }
  
  // Load agent
  let agentForResponse = Agent.load(agentEntityId)
  if (agentForResponse == null) {
    log.warning("Validation response for unknown agent: {}", [agentEntityId])
    return
  }
  
  // Update validation
  validation.response = response
  validation.responseUri = event.params.responseURI
  validation.responseHash = event.params.responseHash
  validation.tag = event.params.tag
  validation.status = "COMPLETED"
  validation.updatedAt = event.block.timestamp
  validation.save()
  
  // Update agent activity
  let agent = Agent.load(agentEntityId)
  if (agent != null) {
    agent.lastActivity = event.block.timestamp
    agent.updatedAt = event.block.timestamp
    agent.save()
  }
  
  // Update agent stats
  updateAgentValidationStats(agentEntityId, false, true, response, event.block.timestamp)
  
  // Do NOT increment protocol/global totals here; totals are counted on ValidationRequest.
  // We only touch updatedAt for observability.
  let protocol = Protocol.load(BigInt.fromI32(chainId).toString())
  if (protocol != null) {
    protocol.updatedAt = event.block.timestamp
    protocol.save()
  }
  let globalStats = GlobalStats.load("global")
  if (globalStats != null) {
    globalStats.updatedAt = event.block.timestamp
    globalStats.save()
  }
  
  log.info("Validation response for agent {}: score {}", [agentEntityId, response.toString()])
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function updateAgentValidationStats(agentId: string, isRequest: boolean, isResponse: boolean, score: i32, timestamp: BigInt): void {
  let stats = AgentStats.load(agentId)
  
  if (stats == null) {
    stats = new AgentStats(agentId)
    stats.agent = agentId
    stats.totalFeedback = BigInt.fromI32(0)
    stats.averageFeedbackValue = BigDecimal.fromString("0")
    stats.totalValidations = BigInt.fromI32(0)
    stats.completedValidations = BigInt.fromI32(0)
    stats.averageValidationScore = BigDecimal.fromString("0")
    stats.lastActivity = timestamp
  }
  
  if (isRequest) {
    stats.totalValidations = stats.totalValidations.plus(BigInt.fromI32(1))
  }
  
  if (isResponse) {
    stats.completedValidations = stats.completedValidations.plus(BigInt.fromI32(1))
    
    // Update average validation score
    if (stats.completedValidations.gt(BigInt.fromI32(0))) {
      let totalScore = stats.averageValidationScore.times(BigDecimal.fromString(stats.completedValidations.minus(BigInt.fromI32(1)).toString()))
      let newTotalScore = totalScore.plus(BigDecimal.fromString(score.toString()))
      stats.averageValidationScore = newTotalScore.div(BigDecimal.fromString(stats.completedValidations.toString()))
    }
    
    // Reputation score calculation removed
  }
  
  stats.lastActivity = timestamp
  stats.updatedAt = timestamp
  stats.save()
}

// Reputation score calculation removed

function updateProtocolStats(chainId: BigInt, agent: Agent, timestamp: BigInt): void {
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
  
  protocol.totalValidations = protocol.totalValidations.plus(BigInt.fromI32(1))
  protocol.updatedAt = timestamp
  protocol.save()
}

function updateGlobalStats(timestamp: BigInt): void {
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
  
  globalStats.totalValidations = globalStats.totalValidations.plus(BigInt.fromI32(1))
  globalStats.updatedAt = timestamp
  globalStats.save()
}


// =============================================================================
// VALIDATION TIMEOUT MANAGEMENT
// =============================================================================

/**
 * Schedule validation timeout check (1 hour timeout)
 * This would typically be handled by a background job or cron
 */
function scheduleValidationTimeoutCheck(validation: Validation, createdAt: BigInt): void {
  // In a real implementation, this would schedule a background job
  // For now, we'll just log the timeout period
  let timeoutPeriod = BigInt.fromI32(60 * 60) // 1 hour
  let timeoutAt = createdAt.plus(timeoutPeriod)
  
  log.info("Validation {} scheduled for timeout check at: {}", [
    validation.id,
    timeoutAt.toString()
  ])
}

export function checkValidationTimeouts(): void {
  // The Graph doesn't support Date.now() - timeout checking requires external services
  log.warning("checkValidationTimeouts() called but cannot get current time in The Graph context. Use external service with block timestamp queries.", [])
}

export function updateValidationStatus(validation: Validation, currentTimestamp: BigInt): void {
  // Check if validation has received a response
  if (validation.response > 0) {
    validation.status = "COMPLETED"
  } else {
    // Check if validation has expired (1 hour timeout)
    let timeoutPeriod = BigInt.fromI32(60 * 60) // 1 hour
    let timeoutAt = validation.createdAt.plus(timeoutPeriod)
    
    if (currentTimestamp > timeoutAt) {
      validation.status = "EXPIRED"
      log.info("Validation {} expired after timeout", [validation.id])
    } else {
      validation.status = "PENDING"
    }
  }
  
  validation.updatedAt = currentTimestamp
  validation.save()
}
