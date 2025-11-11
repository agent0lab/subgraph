import { Bytes, json, log, BigInt, JSONValueKind } from '@graphprotocol/graph-ts'
import { AgentRegistrationFile } from '../../generated/schema'

/**
 * Parse registration file JSON content into AgentRegistrationFile entity
 * Shared by both IPFS and Arweave file handlers
 */
export function parseRegistrationJSON(
  content: Bytes,
  fileId: string,
  agentId: string,
  cid: string,
  timestamp: BigInt
): AgentRegistrationFile | null {

  log.info("Parsing registration file: fileId={}, agentId={}, cid={}", [fileId, agentId, cid])

  // Create entity
  let metadata = new AgentRegistrationFile(fileId)
  metadata.cid = cid  // Works for both IPFS CID and Arweave txId
  metadata.agentId = agentId
  metadata.createdAt = timestamp
  metadata.supportedTrusts = []
  metadata.mcpTools = []
  metadata.mcpPrompts = []
  metadata.mcpResources = []
  metadata.a2aSkills = []

  // Parse JSON content
  let result = json.try_fromBytes(content)
  if (result.isError) {
    log.error("Failed to parse JSON for fileId: {}", [fileId])
    return null
  }

  let value = result.value

  if (value.kind != JSONValueKind.OBJECT) {
    log.error("JSON value is not an object for fileId: {}, kind: {}", [fileId, value.kind.toString()])
    return null
  }

  let obj = value.toObject()
  if (obj == null) {
    log.error("Failed to convert JSON to object for fileId: {}", [fileId])
    return null
  }

  // Extract basic metadata fields
  let name = obj.get('name')
  if (name && !name.isNull() && name.kind == JSONValueKind.STRING) {
    metadata.name = name.toString()
  }

  let description = obj.get('description')
  if (description && !description.isNull() && description.kind == JSONValueKind.STRING) {
    metadata.description = description.toString()
  }

  let image = obj.get('image')
  if (image && !image.isNull() && image.kind == JSONValueKind.STRING) {
    metadata.image = image.toString()
  }

  let active = obj.get('active')
  if (active && !active.isNull()) {
    metadata.active = active.toBool()
  }

  let x402support = obj.get('x402support')
  if (x402support && !x402support.isNull()) {
    metadata.x402support = x402support.toBool()
  }

  // Extract supportedTrusts array
  let supportedTrusts = obj.get('supportedTrusts')
  if (!supportedTrusts || supportedTrusts.isNull()) {
    supportedTrusts = obj.get('supportedTrust')
  }
  if (supportedTrusts && !supportedTrusts.isNull() && supportedTrusts.kind == JSONValueKind.ARRAY) {
    let trustsArray = supportedTrusts.toArray()
    let trusts: string[] = []
    for (let i = 0; i < trustsArray.length; i++) {
      let trust = trustsArray[i]
      if (trust.kind == JSONValueKind.STRING) {
        trusts.push(trust.toString())
      }
    }
    metadata.supportedTrusts = trusts
  }

  // Parse endpoints array
  let endpoints = obj.get('endpoints')
  if (endpoints && !endpoints.isNull() && endpoints.kind == JSONValueKind.ARRAY) {
    let endpointsArray = endpoints.toArray()

    for (let i = 0; i < endpointsArray.length; i++) {
      let endpointValue = endpointsArray[i]
      if (endpointValue.kind != JSONValueKind.OBJECT) {
        continue
      }
      let endpoint = endpointValue.toObject()
      if (endpoint == null) {
        continue
      }

      let endpointName = endpoint.get('name')
      if (endpointName && !endpointName.isNull() && endpointName.kind == JSONValueKind.STRING) {
        let nameStr = endpointName.toString()

        if (nameStr == 'MCP') {
          let mcpEndpoint = endpoint.get('endpoint')
          if (mcpEndpoint && !mcpEndpoint.isNull() && mcpEndpoint.kind == JSONValueKind.STRING) {
            metadata.mcpEndpoint = mcpEndpoint.toString()
          }

          let mcpVersion = endpoint.get('version')
          if (mcpVersion && !mcpVersion.isNull() && mcpVersion.kind == JSONValueKind.STRING) {
            metadata.mcpVersion = mcpVersion.toString()
          }

          let mcpTools = endpoint.get('mcpTools')
          if (mcpTools && !mcpTools.isNull() && mcpTools.kind == JSONValueKind.ARRAY) {
            let toolsArray = mcpTools.toArray()
            let tools: string[] = []
            for (let j = 0; j < toolsArray.length; j++) {
              let tool = toolsArray[j]
              if (tool.kind == JSONValueKind.STRING) {
                tools.push(tool.toString())
              }
            }
            metadata.mcpTools = tools
          }

          let mcpPrompts = endpoint.get('mcpPrompts')
          if (mcpPrompts && !mcpPrompts.isNull() && mcpPrompts.kind == JSONValueKind.ARRAY) {
            let promptsArray = mcpPrompts.toArray()
            let prompts: string[] = []
            for (let j = 0; j < promptsArray.length; j++) {
              let prompt = promptsArray[j]
              if (prompt.kind == JSONValueKind.STRING) {
                prompts.push(prompt.toString())
              }
            }
            metadata.mcpPrompts = prompts
          }

          let mcpResources = endpoint.get('mcpResources')
          if (mcpResources && !mcpResources.isNull() && mcpResources.kind == JSONValueKind.ARRAY) {
            let resourcesArray = mcpResources.toArray()
            let resources: string[] = []
            for (let j = 0; j < resourcesArray.length; j++) {
              let resource = resourcesArray[j]
              if (resource.kind == JSONValueKind.STRING) {
                resources.push(resource.toString())
              }
            }
            metadata.mcpResources = resources
          }
        } else if (nameStr == 'A2A') {
          let a2aEndpoint = endpoint.get('endpoint')
          if (a2aEndpoint && !a2aEndpoint.isNull() && a2aEndpoint.kind == JSONValueKind.STRING) {
            metadata.a2aEndpoint = a2aEndpoint.toString()
          }

          let a2aVersion = endpoint.get('version')
          if (a2aVersion && !a2aVersion.isNull() && a2aVersion.kind == JSONValueKind.STRING) {
            metadata.a2aVersion = a2aVersion.toString()
          }

          let a2aSkills = endpoint.get('a2aSkills')
          if (a2aSkills && !a2aSkills.isNull() && a2aSkills.kind == JSONValueKind.ARRAY) {
            let skillsArray = a2aSkills.toArray()
            let skills: string[] = []
            for (let j = 0; j < skillsArray.length; j++) {
              let skill = skillsArray[j]
              if (skill.kind == JSONValueKind.STRING) {
                skills.push(skill.toString())
              }
            }
            metadata.a2aSkills = skills
          }
        } else if (nameStr == 'agentWallet') {
          let agentWallet = endpoint.get('endpoint')
          if (agentWallet && !agentWallet.isNull() && agentWallet.kind == JSONValueKind.STRING) {
            let walletStr = agentWallet.toString()

            if (walletStr.startsWith("eip155:")) {
              let parts = walletStr.split(":")
              let hasAddress = parts.length > 2
              if (hasAddress) {
                let addressPart = parts[2]
                if (addressPart.startsWith("0x") && addressPart.length == 42) {
                  metadata.agentWallet = Bytes.fromHexString(addressPart)
                  let chainIdPart = parts[1]
                  if (chainIdPart.length > 0) {
                    metadata.agentWalletChainId = BigInt.fromString(chainIdPart)
                  }
                }
              }
            } else if (walletStr.startsWith("0x") && walletStr.length == 42) {
              metadata.agentWallet = Bytes.fromHexString(walletStr)
            }
          }
        } else if (nameStr == 'ENS') {
          let ensEndpoint = endpoint.get('endpoint')
          if (ensEndpoint && !ensEndpoint.isNull() && ensEndpoint.kind == JSONValueKind.STRING) {
            metadata.ens = ensEndpoint.toString()
          }
        } else if (nameStr == 'DID') {
          let didEndpoint = endpoint.get('endpoint')
          if (didEndpoint && !didEndpoint.isNull() && didEndpoint.kind == JSONValueKind.STRING) {
            metadata.did = didEndpoint.toString()
          }
        }
      }
    }
  }

  return metadata
}
