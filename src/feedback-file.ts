import { Bytes, dataSource, json, log, BigInt, JSONValue, JSONValueKind, TypedMap } from '@graphprotocol/graph-ts'
import { FeedbackFile, Feedback } from '../generated/schema'

function readOptionalString(obj: TypedMap<string, JSONValue>, key: string): string | null {
  let v = obj.get(key)
  if (v && !v.isNull() && v.kind == JSONValueKind.STRING) {
    return v.toString()
  }
  return null
}

function readOptionalStringArray(obj: TypedMap<string, JSONValue>, key: string): string[] | null {
  let v = obj.get(key)
  if (!v || v.isNull() || v.kind != JSONValueKind.ARRAY) return null
  let arr = v.toArray()
  let out: string[] = []
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].kind == JSONValueKind.STRING) out.push(arr[i].toString())
  }
  return out
}

export function parseFeedbackFile(content: Bytes): void {
  let context = dataSource.context()
  let feedbackId = context.getString('feedbackId')
  let cid = dataSource.stringParam()
  let fileId = context.getString('fileId')
  let tag1OnChain = context.getString('tag1OnChain')
  let tag2OnChain = context.getString('tag2OnChain')
  
  log.info("Parsing feedback file for feedback: {}, CID: {}, fileId: {}", [feedbackId, cid, fileId])
  
  // Create feedback file with composite ID
  let feedbackFile = new FeedbackFile(fileId)
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
  let agentRegistry = obj.get('agentRegistry')
  if (agentRegistry && !agentRegistry.isNull() && agentRegistry.kind == JSONValueKind.STRING) {
    feedbackFile.agentRegistry = agentRegistry.toString()
  }

  let agentId = obj.get('agentId')
  if (agentId && !agentId.isNull() && agentId.kind == JSONValueKind.NUMBER) {
    feedbackFile.agentId = agentId.toBigInt()
  }

  let clientAddress = obj.get('clientAddress')
  if (clientAddress && !clientAddress.isNull() && clientAddress.kind == JSONValueKind.STRING) {
    feedbackFile.clientAddress = clientAddress.toString()
  }

  let createdAtIso = obj.get('createdAt')
  if (createdAtIso && !createdAtIso.isNull() && createdAtIso.kind == JSONValueKind.STRING) {
    feedbackFile.createdAtIso = createdAtIso.toString()
  }

  let valueRaw = obj.get('value')
  if (valueRaw && !valueRaw.isNull() && valueRaw.kind == JSONValueKind.NUMBER) {
    feedbackFile.valueRaw = valueRaw.toBigInt()
  }

  let valueDecimals = obj.get('valueDecimals')
  if (valueDecimals && !valueDecimals.isNull() && valueDecimals.kind == JSONValueKind.NUMBER) {
    feedbackFile.valueDecimals = valueDecimals.toBigInt().toI32()
  }
  
  let text = obj.get('text')
  if (text && !text.isNull() && text.kind == JSONValueKind.STRING) {
    feedbackFile.text = text.toString()
  }

  // ERC-8004 nested objects (spec only)
  let mcp = obj.get('mcp')
  if (mcp && !mcp.isNull() && mcp.kind == JSONValueKind.OBJECT) {
    let m = mcp.toObject()
    if (m != null) {
      let tool = readOptionalString(m, 'tool')
      if (tool != null) feedbackFile.mcpTool = tool
      let prompt = readOptionalString(m, 'prompt')
      if (prompt != null) feedbackFile.mcpPrompt = prompt
      let resource = readOptionalString(m, 'resource')
      if (resource != null) feedbackFile.mcpResource = resource
    }
  }

  let a2a = obj.get('a2a')
  if (a2a && !a2a.isNull() && a2a.kind == JSONValueKind.OBJECT) {
    let a = a2a.toObject()
    if (a != null) {
      let skills = readOptionalStringArray(a, 'skills')
      if (skills != null) feedbackFile.a2aSkills = skills

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
      let skills = readOptionalStringArray(o, 'skills')
      if (skills != null) feedbackFile.oasfSkills = skills

      let domains = readOptionalStringArray(o, 'domains')
      if (domains != null) feedbackFile.oasfDomains = domains
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
