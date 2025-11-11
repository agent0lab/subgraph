import { Bytes, dataSource, log } from '@graphprotocol/graph-ts'
import { parseRegistrationJSON } from './utils/registration-parser'

/**
 * Parse registration file (supports both IPFS and Arweave)
 * Protocol determined by which template called this handler
 */
export function parseRegistrationFile(content: Bytes): void {
  let context = dataSource.context()
  let cid = dataSource.stringParam()  // IPFS CID or Arweave txId
  let txHash = context.getString('txHash')
  let agentId = context.getString('agentId')
  let timestamp = context.getBigInt('timestamp')
  let fileId = `${txHash}:${cid}`

  log.info("Processing registration file: {}", [fileId])

  // Use shared parser (works for both IPFS and Arweave)
  let metadata = parseRegistrationJSON(content, fileId, agentId, cid, timestamp)

  if (metadata !== null) {
    metadata.save()
    log.info("Successfully saved registration file: {}", [fileId])
  } else {
    log.error("Failed to parse registration file: {}", [fileId])
  }

  // Note: We cannot update chain entities (Agent) from file data source handlers due to isolation rules.
  // The registrationFile connection is set from the chain handler in identity-registry.ts
}
