import { Bytes, dataSource, log } from '@graphprotocol/graph-ts'
import { parseFeedbackJSON } from './utils/feedback-parser'

/**
 * Parse feedback file (supports both IPFS and Arweave)
 * Protocol determined by which template called this handler
 */
export function parseFeedbackFile(content: Bytes): void {
  let context = dataSource.context()
  let cid = dataSource.stringParam()  // IPFS CID or Arweave txId
  let txHash = context.getString('txHash')
  let feedbackId = context.getString('feedbackId')
  let timestamp = context.getBigInt('timestamp')
  let tag1OnChain = context.getString('tag1OnChain')
  let tag2OnChain = context.getString('tag2OnChain')
  let fileId = `${txHash}:${cid}`

  log.info("Processing feedback file: {}", [fileId])

  // Use shared parser (works for both IPFS and Arweave)
  let feedbackFile = parseFeedbackJSON(content, fileId, feedbackId, cid, timestamp, tag1OnChain, tag2OnChain)

  if (feedbackFile !== null) {
    feedbackFile.save()
    log.info("Successfully saved feedback file: {}", [fileId])
  } else {
    log.error("Failed to parse feedback file: {}", [fileId])
  }

  // Cannot update chain entities from file handlers due to isolation rules
}
