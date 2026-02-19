import { Address, BigInt, Bytes, ByteArray, ethereum, log, BigDecimal, DataSourceContext } from "@graphprotocol/graph-ts"
import { getChainId } from "./utils/chain"
import { isIpfsUri, extractIpfsHash, determineUriType, logIpfsExtraction } from "./utils/ipfs"
import { isJsonBase64DataUri, extractBase64PayloadFromDataUri } from "./utils/data-uri"
import { base64DecodeToBytes } from "./utils/base64"
import { populateRegistrationFromJsonBytes } from "./utils/registration-parser"
import {
  Registered,
  MetadataSet,
  URIUpdated,
  Transfer,
  Approval,
  ApprovalForAll
} from "../generated/IdentityRegistry/IdentityRegistry"
import { RegistrationFile } from "../generated/templates"
import {
  Agent,
  AgentMetadata,
  AgentRegistrationFile,
  Protocol,
  GlobalStats
} from "../generated/schema"
import { getContractAddresses, getChainName, isSupportedChain } from "./contract-addresses"
import { BIGINT_ZERO, BIGINT_ONE, ZERO_ADDRESS } from "./constants"

// =============================================================================
// EVENT HANDLERS
// =============================================================================

export function handleAgentRegistered(event: Registered): void {
  let agentId = event.params.agentId
  let chainId = getChainId()
  let agentEntityId = Bytes.fromUTF8(`${chainId.toString()}:${agentId.toString()}`)
  
  // Create or update agent
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    agent = new Agent(agentEntityId)
    agent.chainId = BigInt.fromI32(chainId)
    agent.agentId = agentId
    agent.createdAt = event.block.timestamp
    agent.operators = []
    agent.totalFeedback = BIGINT_ZERO
    agent.lastActivity = event.block.timestamp
    agent.registrationFile = null
  }
  
  agent.owner = event.params.owner
  agent.agentURI = event.params.agentURI
  agent.agentURIType = determineUriType(event.params.agentURI)
  
  agent.updatedAt = event.block.timestamp
  
  agent.save()
  
  updateProtocolStats(BigInt.fromI32(chainId), agent, event.block.timestamp)
  
  // Update global stats - agent registration
  let globalStats = GlobalStats.load("global")
  if (globalStats == null) {
    globalStats = new GlobalStats("global")
    globalStats.totalAgents = BIGINT_ZERO
    globalStats.totalFeedback = BIGINT_ZERO
    globalStats.totalValidations = BIGINT_ZERO
    globalStats.totalProtocols = BIGINT_ZERO
    globalStats.agents = []
    globalStats.tags = []
  }
  
  globalStats.totalAgents = globalStats.totalAgents.plus(BIGINT_ONE)
  
  let currentGlobalAgents = globalStats.agents
  currentGlobalAgents.push(agent.id)
  globalStats.agents = currentGlobalAgents
  
  globalStats.updatedAt = event.block.timestamp
  globalStats.save()
  
  // Registration file indexing: IPFS or base64 data URI
  if (event.params.agentURI.length > 0 && isIpfsUri(event.params.agentURI)) {
    let ipfsHash = extractIpfsHash(event.params.agentURI)
    logIpfsExtraction("agent registration", event.params.agentURI, ipfsHash)
    if (ipfsHash.length > 0) {
      let txHash = event.transaction.hash.toHexString()
      let fileId = Bytes.fromUTF8(`${txHash}:${ipfsHash}`)
      
      let context = new DataSourceContext()
      context.setString('agentId', agentEntityId.toString())
      context.setString('cid', ipfsHash)
      context.setString('txHash', txHash)
      context.setBigInt('timestamp', event.block.timestamp)
      RegistrationFile.createWithContext(ipfsHash, context)
      
      // Set the connection to the composite ID
      agent.registrationFile = fileId
      agent.save()
      log.info("Set registrationFile connection for agent {} to ID: {}", [agentEntityId.toString(), fileId.toString()])
    }
  } else if (event.params.agentURI.length > 0 && isJsonBase64DataUri(event.params.agentURI)) {
    let txHash = event.transaction.hash.toHexString()
    let fileId = Bytes.fromUTF8(`${txHash}:datauri:${event.logIndex.toString()}`)
    let b64 = extractBase64PayloadFromDataUri(event.params.agentURI)
    let decoded = base64DecodeToBytes(b64)

    let registration = new AgentRegistrationFile(fileId)
    registration.txHash = event.transaction.hash
    registration.cid = `datauri:${txHash}:${event.logIndex.toString()}`
    registration.agentId = agentEntityId.toString()
    registration.createdAt = event.block.timestamp
    registration.supportedTrusts = []
    registration.mcpTools = []
    registration.mcpPrompts = []
    registration.mcpResources = []
    registration.a2aSkills = []
    registration.oasfSkills = []
    registration.oasfDomains = []

    populateRegistrationFromJsonBytes(registration, decoded)
    registration.save()

    agent.registrationFile = fileId
    agent.save()
  }
  
  log.info("Agent registered: {} on chain {}", [agentId.toString(), chainId.toString()])
}

export function handleMetadataSet(event: MetadataSet): void {
  let agentId = event.params.agentId
  let chainId = getChainId()
  let agentEntityId = Bytes.fromUTF8(`${chainId.toString()}:${agentId.toString()}`)
  
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    log.warning("Metadata set for unknown agent: {}", [agentEntityId.toString()])
    return
  }
  // Special-case agentWallet: decode metadataValue bytes into a 20-byte address and store on Agent
  if (event.params.metadataKey == "agentWallet") {
    let v = event.params.metadataValue
    // Empty bytes means cleared/unset
    if (v.length == 0) {
      agent.agentWallet = null
      agent.updatedAt = event.block.timestamp
      agent.save()
    // Accept 20-byte raw address, or 32-byte ABI-encoded address (take last 20 bytes).
    // Accept 20-byte raw address, or 32-byte ABI-encoded address (take last 20 bytes).
    } else if (v.length == 20) {
      agent.agentWallet = v
      agent.updatedAt = event.block.timestamp
      agent.save()
    } else if (v.length == 32) {
      let addr = v.subarray(12, 32) // last 20 bytes
      agent.agentWallet = Bytes.fromUint8Array(addr)
      agent.updatedAt = event.block.timestamp
      agent.save()
    } else {
      log.warning("agentWallet metadataValue has unexpected length {} for agent {}", [
        v.length.toString(),
        agentEntityId.toString()
      ])
    }
  }
  
  let metadataId = Bytes.fromUTF8(`${chainId.toString()}:${agentId.toString()}:${event.params.metadataKey}`)
  let metadata = new AgentMetadata(metadataId)
  metadata.protocol = Bytes.fromI32(chainId)
  metadata.agent = agentEntityId
  metadata.key = event.params.metadataKey
  metadata.value = event.params.metadataValue
  metadata.updatedAt = event.block.timestamp
  metadata.save()
  
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  log.info("Metadata set for agent {}: {} = {}", [
    agentEntityId.toString(),
    event.params.metadataKey,
    event.params.metadataValue.toHexString()
  ])
}

export function handleUriUpdated(event: URIUpdated): void {
  let agentId = event.params.agentId
  let chainId = getChainId()
  let agentEntityId = Bytes.fromUTF8(`${chainId.toString()}:${agentId.toString()}`)
  
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    log.warning("URI updated for unknown agent: {}", [agentEntityId.toString()])
    return
  }
  
  agent.agentURI = event.params.newURI
  agent.updatedAt = event.block.timestamp
  agent.agentURIType = determineUriType(event.params.newURI)
  agent.save()
  
  if (isIpfsUri(event.params.newURI)) {
    let ipfsHash = extractIpfsHash(event.params.newURI)
    logIpfsExtraction("agent URI update", event.params.newURI, ipfsHash)
    if (ipfsHash.length > 0) {
      let txHash = event.transaction.hash.toHexString()
      let fileId = Bytes.fromUTF8(`${txHash}:${ipfsHash}`)
      
      let context = new DataSourceContext()
      context.setString('agentId', agentEntityId.toString())
      context.setString('cid', ipfsHash)
      context.setString('txHash', txHash)
      context.setBigInt('timestamp', event.block.timestamp)
      RegistrationFile.createWithContext(ipfsHash, context)
      
      // Set the connection to the composite ID
      agent.registrationFile = fileId
      agent.save()
      log.info("Set registrationFile connection for agent {} to ID: {}", [agentEntityId.toString(), fileId.toString()])
    }
    // updateProtocolActiveCounts removed - active/inactive stats removed
  } else if (event.params.newURI.length > 0 && isJsonBase64DataUri(event.params.newURI)) {
    let txHash = event.transaction.hash.toHexString()
    let fileId = Bytes.fromUTF8(`${txHash}:datauri:${event.logIndex.toString()}`)

    let b64 = extractBase64PayloadFromDataUri(event.params.newURI)
    let decoded = base64DecodeToBytes(b64)

    let registration = new AgentRegistrationFile(fileId)
    registration.txHash = event.transaction.hash
    registration.cid = `datauri:${txHash}:${event.logIndex.toString()}`
    registration.agentId = agentEntityId.toString()
    registration.createdAt = event.block.timestamp
    registration.supportedTrusts = []
    registration.mcpTools = []
    registration.mcpPrompts = []
    registration.mcpResources = []
    registration.a2aSkills = []
    registration.oasfSkills = []
    registration.oasfDomains = []

    populateRegistrationFromJsonBytes(registration, decoded)
    registration.save()

    agent.registrationFile = fileId
    agent.save()
  }
  
  log.info("Agent URI updated for agent {}: {}", [agentEntityId.toString(), event.params.newURI])
}

export function handleTransfer(event: Transfer): void {
  let zeroAddress = Address.fromString(ZERO_ADDRESS)
  if (event.params.from.equals(zeroAddress)) {
    return
  }
  
  let tokenId = event.params.tokenId
  let chainId = getChainId()
  let agentEntityId = Bytes.fromUTF8(`${chainId.toString()}:${tokenId.toString()}`)
  
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    log.warning("Transfer for unknown agent: {}, from: {}, to: {}", [
      agentEntityId.toString(),
      event.params.from.toHexString(),
      event.params.to.toHexString()
    ])
    return
  }
  
  agent.owner = event.params.to
  agent.updatedAt = event.block.timestamp
  agent.save()
  
  log.info("Agent {} transferred from {} to {}", [
    agentEntityId.toString(),
    event.params.from.toHexString(),
    event.params.to.toHexString()
  ])
}

export function handleApproval(event: Approval): void {
  let tokenId = event.params.tokenId
  let chainId = getChainId()
  let agentEntityId = Bytes.fromUTF8(`${chainId.toString()}:${tokenId.toString()}`)
  
  let agent = Agent.load(agentEntityId)
  if (agent == null) {
    log.warning("Approval for unknown agent: {}", [agentEntityId.toString()])
    return
  }
  
  let operators = agent.operators
  let approved = event.params.approved
  
  if (approved.toHexString() != ZERO_ADDRESS) {
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
    agentEntityId.toString(),
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

  let protocolId = Bytes.fromByteArray(ByteArray.fromBigInt(chainId))
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
    
    protocol.totalAgents = BIGINT_ZERO
    protocol.totalFeedback = BIGINT_ZERO
    protocol.totalValidations = BIGINT_ZERO
    protocol.agents = []
    protocol.tags = []
    isNewProtocol = true
  }
  
  protocol.totalAgents = protocol.totalAgents.plus(BIGINT_ONE)
  
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
      globalStats.totalAgents = BIGINT_ZERO
      globalStats.totalFeedback = BIGINT_ZERO
      globalStats.totalValidations = BIGINT_ZERO
      globalStats.totalProtocols = BIGINT_ZERO
      globalStats.agents = []
      globalStats.tags = []
    }
    globalStats.totalProtocols = globalStats.totalProtocols.plus(BIGINT_ONE)
    globalStats.updatedAt = timestamp
    globalStats.save()
  }
}


function updateProtocolActiveCounts(chainId: BigInt, agent: Agent, timestamp: BigInt): void {
  if (!isSupportedChain(chainId)) {
    return
  }

  let protocolId = Bytes.fromByteArray(ByteArray.fromBigInt(chainId))
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

