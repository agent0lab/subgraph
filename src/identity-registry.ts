import { Address, BigInt, Bytes, ethereum, log, BigDecimal, DataSourceContext } from "@graphprotocol/graph-ts"
import { getChainId } from "./utils/chain"
import { isIpfsUri, extractIpfsHash, determineUriType, logIpfsExtraction } from "./utils/ipfs"
import { isArweaveUri, extractArweaveTxId, logArweaveExtraction } from "./utils/arweave"
import {
  Registered,
  MetadataSet,
  UriUpdated,
  Transfer,
  Approval,
  ApprovalForAll
} from "../generated/IdentityRegistry/IdentityRegistry"
import { RegistrationFile, ArweaveRegistrationFile } from "../generated/templates"
import {
  Agent,
  AgentMetadata,
  AgentRegistrationFile,
  Protocol,
  GlobalStats
} from "../generated/schema"
import { getContractAddresses, getChainName, isSupportedChain } from "./contract-addresses"

// =============================================================================
// EVENT HANDLERS
// =============================================================================

export function handleAgentRegistered(event: Registered): void {
  let agentId = event.params.agentId
  let chainId = getChainId()
  let agentEntityId = `${chainId.toString()}:${agentId.toString()}`
  
  // Create or update agent
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    agent = new Agent(agentEntityId)
    agent.chainId = BigInt.fromI32(chainId)
    agent.agentId = agentId
    agent.createdAt = event.block.timestamp
    agent.operators = []
    agent.totalFeedback = BigInt.fromI32(0)
    agent.lastActivity = event.block.timestamp
    agent.registrationFile = null
  }
  
  agent.owner = event.params.owner
  agent.agentURI = event.params.tokenURI
  
  agent.agentURIType = determineUriType(event.params.tokenURI)
  
  agent.updatedAt = event.block.timestamp
  
  agent.save()
  
  updateProtocolStats(BigInt.fromI32(chainId), agent, event.block.timestamp)
  updateProtocolStats(BigInt.fromI32(chainId), agent, event.block.timestamp)
  
  // Update global stats - agent registration
  let globalStats = GlobalStats.load("global")
  if (globalStats == null) {
    globalStats = new GlobalStats("global")
    globalStats.totalAgents = BigInt.fromI32(0)
    globalStats.totalFeedback = BigInt.fromI32(0)
    globalStats.totalValidations = BigInt.fromI32(0)
    globalStats.totalProtocols = BigInt.fromI32(0)
    globalStats.agents = []
    globalStats.tags = []
  }
  
  globalStats.totalAgents = globalStats.totalAgents.plus(BigInt.fromI32(1))
  
  let currentGlobalAgents = globalStats.agents
  currentGlobalAgents.push(agent.id)
  globalStats.agents = currentGlobalAgents
  
  globalStats.updatedAt = event.block.timestamp
  globalStats.save()
  
  if (event.params.tokenURI.length > 0 && isIpfsUri(event.params.tokenURI)) {
    let ipfsHash = extractIpfsHash(event.params.tokenURI)
    logIpfsExtraction("agent registration", event.params.tokenURI, ipfsHash)
    if (ipfsHash.length > 0) {
      let txHash = event.transaction.hash.toHexString()
      let fileId = `${txHash}:${ipfsHash}`

      let context = new DataSourceContext()
      context.setString('agentId', agentEntityId)
      context.setString('cid', ipfsHash)
      context.setString('txHash', txHash)
      context.setBigInt('timestamp', event.block.timestamp)
      RegistrationFile.createWithContext(ipfsHash, context)

      // Set the connection to the composite ID
      agent.registrationFile = fileId
      agent.save()
      log.info("Set registrationFile connection for agent {} to ID: {}", [agentEntityId, fileId])
    }
  }

  // Arweave handling
  if (event.params.tokenURI.length > 0 && isArweaveUri(event.params.tokenURI)) {
    let arweaveTxId = extractArweaveTxId(event.params.tokenURI)
    logArweaveExtraction("agent registration", event.params.tokenURI, arweaveTxId)

    if (arweaveTxId.length > 0) {
      let txHash = event.transaction.hash.toHexString()
      let fileId = `${txHash}:${arweaveTxId}`

      let context = new DataSourceContext()
      context.setString('agentId', agentEntityId)
      context.setString('cid', arweaveTxId)  // Storage-agnostic: use 'cid' for both IPFS and Arweave
      context.setString('txHash', txHash)
      context.setBigInt('timestamp', event.block.timestamp)
      ArweaveRegistrationFile.createWithContext(arweaveTxId, context)

      agent.registrationFile = fileId
      agent.save()
      log.info("Set registrationFile connection for agent {} to Arweave ID: {}", [agentEntityId, fileId])
    }
  }

  log.info("Agent registered: {} on chain {}", [agentId.toString(), chainId.toString()])
}

export function handleMetadataSet(event: MetadataSet): void {
  let agentId = event.params.agentId
  let chainId = getChainId()
  let agentEntityId = `${chainId.toString()}:${agentId.toString()}`
  
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    log.warning("Metadata set for unknown agent: {}", [agentEntityId])
    return
  }
  
  let metadataId = `${agentId.toString()}:${event.params.key}`
  let metadata = new AgentMetadata(metadataId)
  metadata.agent = agentEntityId
  metadata.key = event.params.key
  metadata.value = event.params.value
  metadata.updatedAt = event.block.timestamp
  metadata.save()
  
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  log.info("Metadata set for agent {}: {} = {}", [
    agentEntityId,
    event.params.key,
    event.params.value.toHexString()
  ])
}

export function handleUriUpdated(event: UriUpdated): void {
  let agentId = event.params.agentId
  let chainId = getChainId()
  let agentEntityId = `${chainId.toString()}:${agentId.toString()}`
  
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    log.warning("URI updated for unknown agent: {}", [agentEntityId])
    return
  }
  
  agent.agentURI = event.params.newUri
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  if (isIpfsUri(event.params.newUri)) {
    agent.agentURIType = "ipfs"
    agent.save()
    let ipfsHash = extractIpfsHash(event.params.newUri)
    logIpfsExtraction("agent URI update", event.params.newUri, ipfsHash)
    if (ipfsHash.length > 0) {
      let txHash = event.transaction.hash.toHexString()
      let fileId = `${txHash}:${ipfsHash}`

      let context = new DataSourceContext()
      context.setString('agentId', agentEntityId)
      context.setString('cid', ipfsHash)
      context.setString('txHash', txHash)
      context.setBigInt('timestamp', event.block.timestamp)
      RegistrationFile.createWithContext(ipfsHash, context)

      // Set the connection to the composite ID
      agent.registrationFile = fileId
      agent.save()
      log.info("Set registrationFile connection for agent {} to ID: {}", [agentEntityId, fileId])
    }
    // updateProtocolActiveCounts removed - active/inactive stats removed
  }

  // Arweave handling
  if (isArweaveUri(event.params.newUri)) {
    agent.agentURIType = "arweave"
    agent.save()
    let arweaveTxId = extractArweaveTxId(event.params.newUri)
    logArweaveExtraction("agent URI update", event.params.newUri, arweaveTxId)

    if (arweaveTxId.length > 0) {
      let txHash = event.transaction.hash.toHexString()
      let fileId = `${txHash}:${arweaveTxId}`

      let context = new DataSourceContext()
      context.setString('agentId', agentEntityId)
      context.setString('cid', arweaveTxId)  // Storage-agnostic: use 'cid' for both IPFS and Arweave
      context.setString('txHash', txHash)
      context.setBigInt('timestamp', event.block.timestamp)
      ArweaveRegistrationFile.createWithContext(arweaveTxId, context)

      agent.registrationFile = fileId
      agent.save()
      log.info("Set registrationFile connection for agent {} to Arweave ID: {}", [agentEntityId, fileId])
    }
  }

  log.info("Agent URI updated for agent {}: {}", [agentEntityId, event.params.newUri])
}

export function handleTransfer(event: Transfer): void {
  let zeroAddress = Address.fromString("0x0000000000000000000000000000000000000000")
  if (event.params.from.equals(zeroAddress)) {
    return
  }
  
  let tokenId = event.params.tokenId
  let chainId = getChainId()
  let agentEntityId = `${chainId.toString()}:${tokenId.toString()}`
  
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    log.warning("Transfer for unknown agent: {}, from: {}, to: {}", [
      agentEntityId,
      event.params.from.toHexString(),
      event.params.to.toHexString()
    ])
    return
  }
  
  agent.owner = event.params.to
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  log.info("Agent {} transferred from {} to {}", [
    agentEntityId,
    event.params.from.toHexString(),
    event.params.to.toHexString()
  ])
}

export function handleApproval(event: Approval): void {
  let tokenId = event.params.tokenId
  let chainId = getChainId()
  let agentEntityId = `${chainId.toString()}:${tokenId.toString()}`
  
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    log.warning("Approval for unknown agent: {}", [agentEntityId])
    return
  }
  
  let operators = agent.operators
  let approved = event.params.approved
  
  if (approved.toHexString() != "0x0000000000000000000000000000000000000000") {
    let found = false
    for (let i = 0; i < operators.length; i++) {
      if (operators[i].toHexString() == approved.toHexString()) {
        found = true
        break
      }
    }
    if (!found) {
      operators.push(approved)
    }
  } else {
    let newOperators: Bytes[] = []
    for (let i = 0; i < operators.length; i++) {
      if (operators[i].toHexString() != approved.toHexString()) {
        newOperators.push(operators[i])
      }
    }
    operators = newOperators
  }
  
  agent.operators = operators
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  log.info("Approval updated for agent {}: approved = {}", [
    agentEntityId,
    approved.toHexString()
  ])
}

export function handleApprovalForAll(event: ApprovalForAll): void {
  let chainId = getChainId()
  let owner = event.params.owner
  let operator = event.params.operator
  let approved = event.params.approved
  
  log.info("ApprovalForAll event: owner = {}, operator = {}, approved = {}", [
    owner.toHexString(),
    operator.toHexString(),
    approved.toString()
  ])
}

function updateProtocolStats(chainId: BigInt, agent: Agent, timestamp: BigInt): void {
  if (!isSupportedChain(chainId)) {
    log.warning("Unsupported chain: {}", [chainId.toString()])
    return
  }

  let protocolId = chainId.toString()
  let protocol = Protocol.load(protocolId)
  
  let isNewProtocol = false
  if (protocol == null) {
    protocol = new Protocol(protocolId)
    protocol.chainId = chainId
    protocol.name = getChainName(chainId)
    
    let addresses = getContractAddresses(chainId)
    protocol.identityRegistry = addresses.identityRegistry
    protocol.reputationRegistry = addresses.reputationRegistry
    protocol.validationRegistry = addresses.validationRegistry
    
    protocol.totalAgents = BigInt.fromI32(0)
    protocol.totalFeedback = BigInt.fromI32(0)
    protocol.totalValidations = BigInt.fromI32(0)
    protocol.agents = []
    protocol.tags = []
    isNewProtocol = true
  }
  
  protocol.totalAgents = protocol.totalAgents.plus(BigInt.fromI32(1))
  
  let currentAgents = protocol.agents
  currentAgents.push(agent.id)
  protocol.agents = currentAgents
  
  // Trust models now come from registrationFile, not directly from Agent
  // Skip trust model update here since we can't access file entities from chain handlers
  
  protocol.updatedAt = timestamp
  protocol.save()
  
  if (isNewProtocol) {
    let globalStats = GlobalStats.load("global")
    if (globalStats == null) {
      globalStats = new GlobalStats("global")
      globalStats.totalAgents = BigInt.fromI32(0)
      globalStats.totalFeedback = BigInt.fromI32(0)
      globalStats.totalValidations = BigInt.fromI32(0)
      globalStats.totalProtocols = BigInt.fromI32(0)
      globalStats.agents = []
      globalStats.tags = []
    }
    globalStats.totalProtocols = globalStats.totalProtocols.plus(BigInt.fromI32(1))
    globalStats.updatedAt = timestamp
    globalStats.save()
  }
}


function updateProtocolActiveCounts(chainId: BigInt, agent: Agent, timestamp: BigInt): void {
  if (!isSupportedChain(chainId)) {
    return
  }

  let protocolId = chainId.toString()
  let protocol = Protocol.load(protocolId)
  if (protocol == null) {
    return
  }
  
  // Removed activeAgents/inactiveAgents updates - calculate via query instead
  // Removed trustModels updates - can't access file entities from chain handlers
  
  protocol.updatedAt = timestamp
  protocol.save()
  
  // Removed globalStats updates for activeAgents/inactiveAgents - calculate via query instead
}

