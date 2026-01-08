import { Bytes, log } from "@graphprotocol/graph-ts"

// =============================================================================
// CENTRALIZED IPFS UTILITIES
// =============================================================================

/**
 * Convert a bytes32 value to a human-readable string
 * Removes null bytes and trailing whitespace
 */
export function bytes32ToString(bytes: Bytes): string {
  let hex = bytes.toHexString()
  
  // If all zeros, return empty string
  if (hex == "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return ""
  }
  
  // Convert hex to UTF-8 string, removing null bytes
  let result = ""
  for (let i = 2; i < hex.length; i += 2) {
    let charCode = i32(parseInt(hex.substr(i, 2), 16))
    if (charCode > 0) {
      result = result.concat(String.fromCharCode(charCode))
    }
  }
  
  // Remove trailing null characters and whitespace
  result = result.trim()
  
  // If result is empty after trimming, return empty string
  if (result.length == 0) {
    return ""
  }
  
  return result
}

/**
 * Check if a string is a bare IPFS CID (without ipfs:// prefix)
 */
export function isIpfsCid(uri: string): boolean {
  if (uri.length == 0) return false
  
  // Check for CIDv0 (Qm...)
  if (uri.startsWith("Qm") && uri.length == 46) {
    return true
  }
  
  // Check for CIDv1 (baf...)
  // CIDv1 has variable length but typically 50+ characters
  // We'll be more lenient for shorter CIDs that start with baf
  if (uri.startsWith("baf") && uri.length >= 8) {
    return true
  }
  
  return false
}

/**
 * Check if a URL is an IPFS gateway URL
 */
export function isIpfsGatewayUrl(uri: string): boolean {
  // Check for common IPFS gateway patterns using string matching
  // (AssemblyScript doesn't support regex)
  
  // Check for .ipfs.w3s.link pattern
  if (uri.endsWith(".ipfs.w3s.link")) {
    return true
  }
  
  // Check for .ipfs.dweb.link pattern
  if (uri.endsWith(".ipfs.dweb.link")) {
    return true
  }
  
  // Check for .ipfs.gateway.pinata.cloud pattern
  if (uri.endsWith(".ipfs.gateway.pinata.cloud")) {
    return true
  }
  
  // Check for .ipfs.ipfs.io pattern
  if (uri.endsWith(".ipfs.ipfs.io")) {
    return true
  }
  
  // Check for .ipfs.cloudflare-ipfs.com pattern
  if (uri.endsWith(".ipfs.cloudflare-ipfs.com")) {
    return true
  }
  
  // Check for gateway.pinata.cloud/ipfs/ pattern
  if (uri.startsWith("https://gateway.pinata.cloud/ipfs/")) {
    return true
  }
  
  // Check for ipfs.io/ipfs/ pattern
  if (uri.startsWith("https://ipfs.io/ipfs/")) {
    return true
  }
  
  // Check for cloudflare-ipfs.com/ipfs/ pattern
  if (uri.startsWith("https://cloudflare-ipfs.com/ipfs/")) {
    return true
  }
  
  // Check for bafy*.ipfs.w3s.link pattern (CIDv1)
  if (uri.startsWith("https://bafy") && uri.endsWith(".ipfs.w3s.link")) {
    return true
  }
  
  // Check for Qm*.ipfs.w3s.link pattern (CIDv0)
  if (uri.startsWith("https://Qm") && uri.endsWith(".ipfs.w3s.link")) {
    return true
  }
  
  return false
}

/**
 * Check if a URI is any type of IPFS URI (ipfs://, bare CID, or gateway URL)
 */
export function isIpfsUri(uri: string): boolean {
  return uri.startsWith("ipfs://") || isIpfsCid(uri) || isIpfsGatewayUrl(uri)
}

/**
 * Extract IPFS hash from various URI formats
 */
export function extractIpfsHash(uri: string): string {
  // ipfs://QmHash or ipfs://bafyHash
  if (uri.startsWith("ipfs://")) {
    return uri.substring(7) // Remove "ipfs://"
  }
  
  // Bare CID
  if (isIpfsCid(uri)) {
    return uri
  }
  
  // Gateway URLs: https://QmHash.ipfs.w3s.link or https://bafyHash.ipfs.w3s.link
  if (uri.startsWith("https://") && uri.includes(".ipfs.")) {
    let parts = uri.substring(8).split(".") // Remove "https://" and split
    if (parts.length > 0 && isIpfsCid(parts[0])) {
      return parts[0]
    }
  }
  
  // Gateway URLs: https://gateway.pinata.cloud/ipfs/QmHash
  if (uri.includes("/ipfs/")) {
    let ipfsIndex = uri.indexOf("/ipfs/")
    let hash = uri.substring(ipfsIndex + 6) // Skip "/ipfs/"
    // Remove any trailing path
    let slashIndex = hash.indexOf("/")
    if (slashIndex > 0) {
      hash = hash.substring(0, slashIndex)
    }
    if (isIpfsCid(hash)) {
      return hash
    }
  }
  
  return ""
}

/**
 * Determine the URI type for an agent or feedback URI
 */
export function determineUriType(uri: string): string {
  if (uri.startsWith("data:")) {
    return "data"
  }
  if (uri.startsWith("ipfs://")) {
    return "ipfs"
  } else if (isIpfsGatewayUrl(uri)) {
    return "ipfs"  // Gateway URLs are still IPFS
  } else if (isIpfsCid(uri)) {
    return "ipfs"
  } else if (uri.startsWith("https://")) {
    return "https"
  } else if (uri.startsWith("http://")) {
    return "http"
  } else {
    return "unknown"
  }
}

/**
 * Log IPFS hash extraction for debugging
 */
export function logIpfsExtraction(context: string, uri: string, hash: string): void {
  if (hash.length > 0) {
    log.info("IPFS hash extracted for {}: {} -> {}", [context, uri, hash])
  } else {
    log.warning("Failed to extract IPFS hash for {}: {}", [context, uri])
  }
}
