import { Bytes, dataSource, json, log, BigInt, JSONValueKind } from '@graphprotocol/graph-ts'
import { FeedbackFile, Feedback } from '../generated/schema'

export function parseFeedbackFile(content: Bytes): void {
  let context = dataSource.context()
  let feedbackId = context.getString('feedbackId')
  let cid = dataSource.stringParam()
  let txHash = context.getString('txHash')
  let tag1OnChain = context.getString('tag1OnChain')
  let tag2OnChain = context.getString('tag2OnChain')
  
  // Create composite ID: transactionHash:cid
  let fileId = `${txHash}:${cid}`
  
  log.info("Parsing feedback file for feedback: {}, CID: {}, fileId: {}", [feedbackId, cid, fileId])
  
  // Create feedback file with composite ID
  let feedbackFile = new FeedbackFile(fileId)
  feedbackFile.cid = cid
  feedbackFile.feedbackId = feedbackId
  feedbackFile.createdAt = context.getBigInt('timestamp')
  
  let result = json.try_fromBytes(content)
  if (result.isError) {
    log.error("Failed to parse JSON for feedback file CID: {}", [cid])
    feedbackFile.save()
    return
  }
  
  let value = result.value
  
  if (value.kind != JSONValueKind.OBJECT) {
    log.error("JSON value is not an object for feedback file CID: {}, kind: {}", [cid, value.kind.toString()])
    feedbackFile.save()
    return
  }
  
  let obj = value.toObject()
  if (obj == null) {
    log.error("Failed to convert JSON to object for feedback file CID: {}", [cid])
    feedbackFile.save()
    return
  }
  
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
  
  feedbackFile.save()
  
  // Cannot update chain entities from file handlers due to isolation rules
}
