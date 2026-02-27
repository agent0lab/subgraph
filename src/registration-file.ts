import { Bytes, dataSource, log } from '@graphprotocol/graph-ts'
import { AgentRegistrationFile } from '../generated/schema'
import { populateRegistrationFromJsonBytes } from './utils/registration-parser'

export function parseRegistrationFile(content: Bytes): void {
  let context = dataSource.context()
  let agentId = context.getString('agentId')
  let cid = dataSource.stringParam()
  let txHash = context.getString('txHash')
  
  // Create composite ID: transactionHash:cid
  let fileId = Bytes.fromUTF8(`${txHash}:${cid}`)
  
  log.info("Parsing registration file for agent: {}, CID: {}, fileId: {}", [agentId, cid, fileId.toString()])
  
  // Create registration file with composite ID
  let metadata = new AgentRegistrationFile(fileId)
  metadata.txHash = Bytes.fromUTF8(txHash)
  metadata.cid = cid
  metadata.agent = Bytes.fromUTF8(agentId)
  metadata.createdAt = context.getBigInt('timestamp')
  metadata.supportedTrusts = []
  metadata.mcpTools = []
  metadata.mcpPrompts = []
  metadata.mcpResources = []
  metadata.a2aSkills = []
  metadata.oasfSkills = []
  metadata.oasfDomains = []
  metadata.hasOASF = false
  // New centralized parser (handles x402Support, new endpoints, endpointsRawJson)
  populateRegistrationFromJsonBytes(metadata, content)

  // Derived field for exact filtering: OASF skills OR domains present.
  metadata.hasOASF = (metadata.oasfSkills.length > 0) || (metadata.oasfDomains.length > 0)
  
  metadata.save()
  
  log.info("Successfully parsed registration file for fileId: {}, CID: {}, name: {}, description: {}", [
    fileId.toString(),
    cid,
    metadata.name ? metadata.name! : "null",
    metadata.description ? metadata.description! : "null"
  ])
  
  // Note: We cannot update chain entities (Agent) from file data source handlers due to isolation rules.
  // The registrationFile connection is set from the chain handler in identity-registry.ts
}
