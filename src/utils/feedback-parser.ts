import { Bytes, json, log, BigInt, JSONValueKind } from '@graphprotocol/graph-ts'
import { FeedbackFile } from '../../generated/schema'

/**
 * Parse feedback file JSON content into FeedbackFile entity
 * Shared by both IPFS and Arweave feedback file handlers
 */
export function parseFeedbackJSON(
  content: Bytes,
  fileId: string,
  feedbackId: string,
  cid: string,
  timestamp: BigInt,
  tag1OnChain: string,
  tag2OnChain: string
): FeedbackFile | null {

  log.info("Parsing feedback file: fileId={}, feedbackId={}, cid={}", [fileId, feedbackId, cid])

  // Create entity
  let feedbackFile = new FeedbackFile(fileId)
  feedbackFile.cid = cid
  feedbackFile.feedbackId = feedbackId
  feedbackFile.createdAt = timestamp

  // Parse JSON content
  let result = json.try_fromBytes(content)
  if (result.isError) {
    log.error("Failed to parse JSON for feedback file fileId: {}", [fileId])
    return null
  }

  let value = result.value

  if (value.kind != JSONValueKind.OBJECT) {
    log.error("JSON value is not an object for feedback file fileId: {}, kind: {}", [fileId, value.kind.toString()])
    return null
  }

  let obj = value.toObject()
  if (obj == null) {
    log.error("Failed to convert JSON to object for feedback file fileId: {}", [fileId])
    return null
  }

  // Extract feedback fields
  let text = obj.get('text')
  if (text && !text.isNull() && text.kind == JSONValueKind.STRING) {
    feedbackFile.text = text.toString()
  }

  let capability = obj.get('capability')
  if (capability && !capability.isNull() && capability.kind == JSONValueKind.STRING) {
    feedbackFile.capability = capability.toString()
  }

  let name = obj.get('name')
  if (name && !name.isNull() && name.kind == JSONValueKind.STRING) {
    feedbackFile.name = name.toString()
  }

  let skill = obj.get('skill')
  if (skill && !skill.isNull() && skill.kind == JSONValueKind.STRING) {
    feedbackFile.skill = skill.toString()
  }

  let task = obj.get('task')
  if (task && !task.isNull() && task.kind == JSONValueKind.STRING) {
    feedbackFile.task = task.toString()
  }

  let contextStr = obj.get('context')
  if (contextStr && !contextStr.isNull() && contextStr.kind == JSONValueKind.STRING) {
    feedbackFile.context = contextStr.toString()
  }

  // Try new format first (proofOfPayment), fallback to old format (proof_of_payment) for backward compatibility
  let proofOfPayment = obj.get('proofOfPayment')
  if (proofOfPayment == null || proofOfPayment.isNull()) {
    proofOfPayment = obj.get('proof_of_payment')  // Backward compatibility
  }
  if (proofOfPayment && !proofOfPayment.isNull() && proofOfPayment.kind == JSONValueKind.OBJECT) {
    let proofObj = proofOfPayment.toObject()
    if (proofObj != null) {
      let fromAddress = proofObj.get('fromAddress')
      if (fromAddress && !fromAddress.isNull() && fromAddress.kind == JSONValueKind.STRING) {
        feedbackFile.proofOfPaymentFromAddress = fromAddress.toString()
      }

      let toAddress = proofObj.get('toAddress')
      if (toAddress && !toAddress.isNull() && toAddress.kind == JSONValueKind.STRING) {
        feedbackFile.proofOfPaymentToAddress = toAddress.toString()
      }

      let chainId = proofObj.get('chainId')
      if (chainId && !chainId.isNull()) {
        // chainId can be string or number, handle both
        if (chainId.kind == JSONValueKind.STRING) {
          feedbackFile.proofOfPaymentChainId = chainId.toString()
        } else if (chainId.kind == JSONValueKind.NUMBER) {
          feedbackFile.proofOfPaymentChainId = chainId.toBigInt().toString()
        }
      }

      let txHashField = proofObj.get('txHash')
      if (txHashField && !txHashField.isNull() && txHashField.kind == JSONValueKind.STRING) {
        feedbackFile.proofOfPaymentTxHash = txHashField.toString()
      }
    }
  }

  // Extract tags from file if not provided on-chain
  if (tag1OnChain.length == 0) {
    let tag1 = obj.get('tag1')
    if (tag1 && !tag1.isNull() && tag1.kind == JSONValueKind.STRING) {
      feedbackFile.tag1 = tag1.toString()
    }
  }

  if (tag2OnChain.length == 0) {
    let tag2 = obj.get('tag2')
    if (tag2 && !tag2.isNull() && tag2.kind == JSONValueKind.STRING) {
      feedbackFile.tag2 = tag2.toString()
    }
  }

  return feedbackFile
}
