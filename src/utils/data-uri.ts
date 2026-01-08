export const DATA_JSON_BASE64_PREFIX = "data:application/json;base64,"

export function isJsonBase64DataUri(uri: string): boolean {
  return uri.startsWith(DATA_JSON_BASE64_PREFIX)
}

export function extractBase64PayloadFromDataUri(uri: string): string {
  if (!isJsonBase64DataUri(uri)) return ""
  return uri.substring(DATA_JSON_BASE64_PREFIX.length)
}


