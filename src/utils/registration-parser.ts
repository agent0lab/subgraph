import { Bytes, json, log, JSONValue, JSONValueKind, BigInt } from "@graphprotocol/graph-ts"
import { AgentRegistrationFile } from "../../generated/schema"

function jsonEscape(s: string): string {
  // Minimal JSON string escape (quotes and backslashes)
  let out = ""
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i)
    if (c == 34) { // "
      out = out.concat("\\\"")
    } else if (c == 92) { // \
      out = out.concat("\\\\")
    } else if (c == 10) { // \n
      out = out.concat("\\n")
    } else if (c == 13) { // \r
      out = out.concat("\\r")
    } else if (c == 9) { // \t
      out = out.concat("\\t")
    } else {
      out = out.concat(s.charAt(i))
    }
  }
  return out
}

function serializeEndpointsRaw(endpointsArray: Array<JSONValue>): string {
  let out = "["
  for (let i = 0; i < endpointsArray.length; i++) {
    let v = endpointsArray[i]
    if (v.kind != JSONValueKind.OBJECT) continue
    let o = v.toObject()
    if (o == null) continue

    let parts: string[] = []

    let nameV = o.get("name")
    if (nameV && !nameV.isNull() && nameV.kind == JSONValueKind.STRING) {
      parts.push("\"name\":\"" + jsonEscape(nameV.toString()) + "\"")
    }

    let endpointV = o.get("endpoint")
    if (endpointV && !endpointV.isNull() && endpointV.kind == JSONValueKind.STRING) {
      parts.push("\"endpoint\":\"" + jsonEscape(endpointV.toString()) + "\"")
    }

    let versionV = o.get("version")
    if (versionV && !versionV.isNull() && versionV.kind == JSONValueKind.STRING) {
      parts.push("\"version\":\"" + jsonEscape(versionV.toString()) + "\"")
    }

    // Optional arrays (capabilities/skills/domains)
    let capabilitiesV = o.get("capabilities")
    if (capabilitiesV && !capabilitiesV.isNull() && capabilitiesV.kind == JSONValueKind.ARRAY) {
      let arr = capabilitiesV.toArray()
      let capStr = "\"capabilities\":["
      for (let j = 0; j < arr.length; j++) {
        if (arr[j].kind == JSONValueKind.STRING) {
          if (j > 0) capStr = capStr.concat(",")
          capStr = capStr.concat("\"" + jsonEscape(arr[j].toString()) + "\"")
        }
      }
      capStr = capStr.concat("]")
      parts.push(capStr)
    }

    let skillsV = o.get("skills")
    if (skillsV && !skillsV.isNull() && skillsV.kind == JSONValueKind.ARRAY) {
      let arr = skillsV.toArray()
      let sStr = "\"skills\":["
      for (let j = 0; j < arr.length; j++) {
        if (arr[j].kind == JSONValueKind.STRING) {
          if (j > 0) sStr = sStr.concat(",")
          sStr = sStr.concat("\"" + jsonEscape(arr[j].toString()) + "\"")
        }
      }
      sStr = sStr.concat("]")
      parts.push(sStr)
    }

    let domainsV = o.get("domains")
    if (domainsV && !domainsV.isNull() && domainsV.kind == JSONValueKind.ARRAY) {
      let arr = domainsV.toArray()
      let dStr = "\"domains\":["
      for (let j = 0; j < arr.length; j++) {
        if (arr[j].kind == JSONValueKind.STRING) {
          if (j > 0) dStr = dStr.concat(",")
          dStr = dStr.concat("\"" + jsonEscape(arr[j].toString()) + "\"")
        }
      }
      dStr = dStr.concat("]")
      parts.push(dStr)
    }

    if (out.length > 1) out = out.concat(",")
    out = out.concat("{")
    for (let p = 0; p < parts.length; p++) {
      if (p > 0) out = out.concat(",")
      out = out.concat(parts[p])
    }
    out = out.concat("}")
  }
  out = out.concat("]")
  return out
}

export function populateRegistrationFromJsonBytes(metadata: AgentRegistrationFile, content: Bytes): void {
  // Defaults for list fields introduced by schema
  if (metadata.supportedTrusts == null) metadata.supportedTrusts = []
  if (metadata.mcpTools == null) metadata.mcpTools = []
  if (metadata.mcpPrompts == null) metadata.mcpPrompts = []
  if (metadata.mcpResources == null) metadata.mcpResources = []
  if (metadata.a2aSkills == null) metadata.a2aSkills = []
  if (metadata.oasfSkills == null) metadata.oasfSkills = []
  if (metadata.oasfDomains == null) metadata.oasfDomains = []

  let result = json.try_fromBytes(content)
  if (result.isError) {
    log.error("Failed to parse JSON registration content for AgentRegistrationFile {}", [metadata.id])
    return
  }

  let value = result.value
  if (value.kind != JSONValueKind.OBJECT) {
    log.error("Registration JSON is not an object for AgentRegistrationFile {}", [metadata.id])
    return
  }

  let obj = value.toObject()
  if (obj == null) return

  let name = obj.get("name")
  if (name && !name.isNull() && name.kind == JSONValueKind.STRING) metadata.name = name.toString()

  let description = obj.get("description")
  if (description && !description.isNull() && description.kind == JSONValueKind.STRING) metadata.description = description.toString()

  let image = obj.get("image")
  if (image && !image.isNull() && image.kind == JSONValueKind.STRING) metadata.image = image.toString()

  let active = obj.get("active")
  if (active && !active.isNull()) metadata.active = active.toBool()

  // ERC-8004 uses x402Support (camelCase). Keep fallback to x402support.
  let x402Support = obj.get("x402Support")
  if (x402Support == null || x402Support.isNull()) x402Support = obj.get("x402support")
  if (x402Support && !x402Support.isNull()) metadata.x402support = x402Support.toBool()

  let supportedTrusts = obj.get("supportedTrusts")
  if (supportedTrusts == null || supportedTrusts.isNull()) supportedTrusts = obj.get("supportedTrust")
  if (supportedTrusts && !supportedTrusts.isNull() && supportedTrusts.kind == JSONValueKind.ARRAY) {
    let trustsArray = supportedTrusts.toArray()
    let trusts: string[] = []
    for (let i = 0; i < trustsArray.length; i++) {
      if (trustsArray[i].kind == JSONValueKind.STRING) trusts.push(trustsArray[i].toString())
    }
    metadata.supportedTrusts = trusts
  }

  // Endpoints
  let endpoints = obj.get("endpoints")
  if (endpoints && !endpoints.isNull() && endpoints.kind == JSONValueKind.ARRAY) {
    let endpointsArray = endpoints.toArray()
    metadata.endpointsRawJson = serializeEndpointsRaw(endpointsArray)

    for (let i = 0; i < endpointsArray.length; i++) {
      let endpointValue = endpointsArray[i]
      if (endpointValue.kind != JSONValueKind.OBJECT) continue
      let endpointObj = endpointValue.toObject()
      if (endpointObj == null) continue

      let endpointName = endpointObj.get("name")
      if (!endpointName || endpointName.isNull() || endpointName.kind != JSONValueKind.STRING) continue
      let nameStr = endpointName.toString()
      let nameLower = nameStr.toLowerCase()

      let endpointV = endpointObj.get("endpoint")
      let endpointStr = endpointV && !endpointV.isNull() && endpointV.kind == JSONValueKind.STRING ? endpointV.toString() : ""

      let versionV = endpointObj.get("version")
      let versionStr = versionV && !versionV.isNull() && versionV.kind == JSONValueKind.STRING ? versionV.toString() : ""

      if (nameLower == "mcp") {
        if (endpointStr.length > 0) metadata.mcpEndpoint = endpointStr
        if (versionStr.length > 0) metadata.mcpVersion = versionStr
      } else if (nameLower == "a2a") {
        if (endpointStr.length > 0) metadata.a2aEndpoint = endpointStr
        if (versionStr.length > 0) metadata.a2aVersion = versionStr
      } else if (nameLower == "web") {
        if (endpointStr.length > 0) metadata.webEndpoint = endpointStr
      } else if (nameLower == "oasf") {
        if (endpointStr.length > 0) metadata.oasfEndpoint = endpointStr
        if (versionStr.length > 0) metadata.oasfVersion = versionStr

        let skillsV = endpointObj.get("skills")
        if (skillsV && !skillsV.isNull() && skillsV.kind == JSONValueKind.ARRAY) {
          let arr = skillsV.toArray()
          let skills: string[] = []
          for (let j = 0; j < arr.length; j++) if (arr[j].kind == JSONValueKind.STRING) skills.push(arr[j].toString())
          metadata.oasfSkills = skills
        }

        let domainsV = endpointObj.get("domains")
        if (domainsV && !domainsV.isNull() && domainsV.kind == JSONValueKind.ARRAY) {
          let arr = domainsV.toArray()
          let domains: string[] = []
          for (let j = 0; j < arr.length; j++) if (arr[j].kind == JSONValueKind.STRING) domains.push(arr[j].toString())
          metadata.oasfDomains = domains
        }
      } else if (nameLower == "email") {
        if (endpointStr.length > 0) metadata.emailEndpoint = endpointStr
      } else if (nameLower == "ens") {
        if (endpointStr.length > 0) metadata.ens = endpointStr
      } else if (nameLower == "did") {
        if (endpointStr.length > 0) metadata.did = endpointStr
      }
    }
  }
}


