import { Bytes, dataSource, json, log, BigInt, JSONValueKind, TypedMap, JSONValue } from '@graphprotocol/graph-ts'
import { FeedbackFile, Feedback } from '../generated/schema'

function parseStringArray(obj: TypedMap<string, JSONValue>, key: string): string[] | null {
  let value = obj.get(key)
  if (value && !value.isNull() && value.kind == JSONValueKind.ARRAY) {
    let arr = value.toArray()
    let out: string[] = []
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].kind == JSONValueKind.STRING) out.push(arr[i].toString())
    }
    return out
  }
  return null
}

function getValue(obj: TypedMap<string, JSONValue>, key: string, kind: JSONValueKind): JSONValue | null {
  let value = obj.get(key)
  if (value && !value.isNull() && value.kind == kind) {
    return value
  }
  return null
}

export function parseFeedbackFile(content: Bytes): void {
  let context = dataSource.context()
  let feedbackId = context.getString('feedbackId')
  let cid = dataSource.stringParam()
  let txHash = context.getString('txHash')
  let tag1OnChain = context.getString('tag1OnChain')
  let tag2OnChain = context.getString('tag2OnChain')
  
  // Create composite ID: transactionHash:cid
  let fileId = Bytes.fromUTF8(`${txHash}:${cid}`)
  
  log.info("Parsing feedback file for feedback: {}, CID: {}, fileId: {}", [feedbackId, cid, fileId.toString()])
  
  // Create feedback file with composite ID
  let feedbackFile = new FeedbackFile(fileId)
  feedbackFile.txHash = Bytes.fromUTF8(txHash)
  feedbackFile.cid = cid
  feedbackFile.feedbackId = feedbackId
  feedbackFile.createdAt = context.getBigInt('timestamp')
  feedbackFile.a2aSkills = []
  feedbackFile.oasfSkills = []
  feedbackFile.oasfDomains = []
  
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

  // ERC-8004 envelope fields (spec)
  let agentRegistry = getValue(obj, 'agentRegistry', JSONValueKind.STRING)
  if (agentRegistry != null) feedbackFile.agentRegistry = agentRegistry.toString()

  let agentId = getValue(obj, 'agentId', JSONValueKind.NUMBER)
  if (agentId != null) feedbackFile.agentId = agentId.toBigInt()

  let clientAddress = getValue(obj, 'clientAddress', JSONValueKind.STRING)
  if (clientAddress != null) feedbackFile.clientAddress = clientAddress.toString()

  let createdAtIso = getValue(obj, 'createdAt', JSONValueKind.STRING)
  if (createdAtIso != null) feedbackFile.createdAtIso = createdAtIso.toString()

  let valueRaw = getValue(obj, 'value', JSONValueKind.NUMBER)
  if (valueRaw != null) feedbackFile.valueRaw = valueRaw.toBigInt()

  let valueDecimals = getValue(obj, 'valueDecimals', JSONValueKind.NUMBER)
  if (valueDecimals != null) feedbackFile.valueDecimals = valueDecimals.toBigInt().toI32()
  
  let text = getValue(obj, 'text', JSONValueKind.STRING)
  if (text != null) feedbackFile.text = text.toString()

  // ERC-8004 nested objects (spec only)
  let mcp = obj.get('mcp')
  if (mcp && !mcp.isNull() && mcp.kind == JSONValueKind.OBJECT) {
    let m = mcp.toObject()
    if (m != null) {
      let tool = m.get('tool')
      if (tool && !tool.isNull() && tool.kind == JSONValueKind.STRING) feedbackFile.mcpTool = tool.toString()
      let prompt = m.get('prompt')
      if (prompt && !prompt.isNull() && prompt.kind == JSONValueKind.STRING) feedbackFile.mcpPrompt = prompt.toString()
      let resource = m.get('resource')
      if (resource && !resource.isNull() && resource.kind == JSONValueKind.STRING) feedbackFile.mcpResource = resource.toString()
    }
  }

  let a2a = obj.get('a2a')
  if (a2a && !a2a.isNull() && a2a.kind == JSONValueKind.OBJECT) {
    let a = a2a.toObject()
    if (a != null) {
      let a2aSkills = parseStringArray(a, 'skills')
      if (a2aSkills != null) feedbackFile.a2aSkills = a2aSkills

      let contextId = a.get('contextId')
      if (contextId && !contextId.isNull() && contextId.kind == JSONValueKind.STRING) {
        feedbackFile.a2aContextId = contextId.toString()
      }

      let taskId = a.get('taskId')
      if (taskId && !taskId.isNull() && taskId.kind == JSONValueKind.STRING) {
        feedbackFile.a2aTaskId = taskId.toString()
      }
    }
  }

  let oasf = obj.get('oasf')
  if (oasf && !oasf.isNull() && oasf.kind == JSONValueKind.OBJECT) {
    let o = oasf.toObject()
    if (o != null) {
      let oasfSkills = parseStringArray(o, 'skills')
      if (oasfSkills != null) feedbackFile.oasfSkills = oasfSkills

      let oasfDomains = parseStringArray(o, 'domains')
      if (oasfDomains != null) feedbackFile.oasfDomains = oasfDomains
    }
  }

  // Proof of payment (spec key only)
  let proofOfPayment = obj.get('proofOfPayment')
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
