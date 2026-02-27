import { BigInt, Bytes, ByteArray, log, BigDecimal } from "@graphprotocol/graph-ts"
import { BIGINT_ZERO, BIGINT_ONE, ZERO_BYTES32_BYTES } from "./constants"
import { getChainId } from "./utils/chain"
import {
  ValidationRequest,
  ValidationResponse
} from "../generated/ValidationRegistry/ValidationRegistry"
import {
  Agent,
  Validation,
  AgentStats,
  ProtocolStats,
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
  let agentEntityId = Bytes.fromUTF8(`${chainId.toString()}:${agentId.toString()}`)
  
  // Load agent
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    log.warning("Validation request for unknown agent: {}", [agentEntityId.toString()])
    return
  }
  
  // Create validation entity
  let validation = new Validation(requestHash)
  validation.agent = agentEntityId
  validation.validatorAddress = validatorAddress
  validation.requestUri = event.params.requestURI
  validation.requestHash = requestHash
  validation.response = 0 // Pending
  validation.responseUri = ""
  validation.responseHash = ZERO_BYTES32_BYTES
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
  updateAgentValidationStats(agent, true, false, 0, event.block.timestamp)
  
  // Update protocol stats
  updateProtocolStats(BigInt.fromI32(chainId), agent, event.block.timestamp)

  log.info("Validation request for agent {}: {}", [agentEntityId.toString(), requestHash.toHexString()])
}

export function handleValidationResponse(event: ValidationResponse): void {
  let agentId = event.params.agentId
  let requestHash = event.params.requestHash
  let response = event.params.response
  let chainId = getChainId()
  let agentEntityId = Bytes.fromUTF8(`${chainId.toString()}:${agentId.toString()}`)
  
  // Load validation
  let validation = Validation.load(requestHash)
  if (validation == null) {
    log.warning("Response for unknown validation: {}", [requestHash.toHexString()])
    return
  }
  
  // Load agent
  let agentForResponse = Agent.load(agentEntityId)
  if (agentForResponse == null) {
    log.warning("Validation response for unknown agent: {}", [agentEntityId.toString()])
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
  if (agent == null) {
    log.warning("Validation response for unknown agent: {}", [agentEntityId.toString()])
    return
  }
  agent.lastActivity = event.block.timestamp
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  // Update agent stats
  updateAgentValidationStats(agent, false, true, response, event.block.timestamp)
  
  // Do NOT increment protocol/global totals here; totals are counted on ValidationRequest.
  // We only touch updatedAt for observability.
  let protocolId = Bytes.fromByteArray(ByteArray.fromBigInt(chainId))
  let protocol = Protocol.load(protocolId)
  if (protocol != null) {
    protocol.updatedAt = event.block.timestamp
    protocol.save()
  }
  let protocolStats = ProtocolStats.load(protocolId)
  if (protocolStats != null) {
    protocolStats.updatedAt = event.block.timestamp
    protocolStats.save()
  }
  
  log.info("Validation response for agent {}: score {}", [agentEntityId.toString(), response.toString()])
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function updateAgentValidationStats(agent: Agent, isRequest: boolean, isResponse: boolean, score: i32, timestamp: BigInt): void {
  let stats = AgentStats.load(agent.id)
  
  if (stats == null) {
    stats = new AgentStats(agent.id)
    stats.agent = agent.id
    stats.totalFeedback = BIGINT_ZERO
    stats.averageFeedbackValue = BigDecimal.fromString("0")
    stats.totalValidations = BIGINT_ZERO
    stats.completedValidations = BIGINT_ZERO
    stats.averageValidationScore = BigDecimal.fromString("0")
    stats.lastActivity = timestamp
  }
  
  if (isRequest) {
    stats.totalValidations = stats.totalValidations.plus(BIGINT_ONE)
  }
  
  if (isResponse) {
    stats.completedValidations = stats.completedValidations.plus(BIGINT_ONE)
    
    // Update average validation score
    if (stats.completedValidations.gt(BIGINT_ZERO)) {
      let totalScore = stats.averageValidationScore.times(BigDecimal.fromString(stats.completedValidations.minus(BIGINT_ONE).toString()))
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

  let protocolId = Bytes.fromByteArray(ByteArray.fromBigInt(chainId))
  let protocol = Protocol.load(protocolId)
  
  if (protocol == null) {
    protocol = new Protocol(protocolId)
    protocol.chainId = chainId
    protocol.name = getChainName(chainId)
    
    let addresses = getContractAddresses(chainId)
    protocol.identityRegistry = addresses.identityRegistry
    protocol.reputationRegistry = addresses.reputationRegistry
    protocol.validationRegistry = addresses.validationRegistry
    
    protocol.tags = []
  }

  protocol.updatedAt = timestamp
  protocol.save()

  // Update protocol stats - agent registration
  let protocolStats = ProtocolStats.load(protocolId)
  if (protocolStats == null) {
    protocolStats = new ProtocolStats(protocolId)
    protocolStats.protocol = protocol.id
    protocolStats.totalAgents = BIGINT_ZERO
    protocolStats.totalFeedback = BIGINT_ZERO
    protocolStats.totalValidations = BIGINT_ZERO
  }
  
  protocolStats.totalValidations = protocolStats.totalValidations.plus(BIGINT_ONE)
  protocolStats.updatedAt = timestamp
  protocolStats.save()
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
    validation.id.toString(),
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
      log.info("Validation {} expired after timeout", [validation.id.toString()])
    } else {
      validation.status = "PENDING"
    }
  }
  
  validation.updatedAt = currentTimestamp
  validation.save()
}
