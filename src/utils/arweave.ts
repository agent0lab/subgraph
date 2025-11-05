import { log } from "@graphprotocol/graph-ts"

/**
 * Check if a URI is an Arweave URI
 */
export function isArweaveUri(uri: string): boolean {
  return uri.startsWith("ar://")
}

/**
 * Extract Arweave transaction ID from ar:// URI
 */
export function extractArweaveTxId(uri: string): string {
  if (uri.startsWith("ar://")) {
    return uri.substring(5) // Remove "ar://"
  }
  return ""
}

/**
 * Log Arweave transaction ID extraction
 */
export function logArweaveExtraction(context: string, uri: string, txId: string): void {
  if (txId.length > 0) {
    log.info("Arweave txId extracted for {}: {} -> {}", [context, uri, txId])
  } else {
    log.warning("Failed to extract Arweave txId for {}: {}", [context, uri])
  }
}
