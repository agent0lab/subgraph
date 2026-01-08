import { Bytes } from "@graphprotocol/graph-ts"

// Minimal base64 decoder for AssemblyScript (Graph mappings)
// Supports standard base64 alphabet with '=' padding.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

function decodeCharCode(c: i32): i32 {
  // 'A'-'Z'
  if (c >= 65 && c <= 90) return c - 65
  // 'a'-'z'
  if (c >= 97 && c <= 122) return c - 97 + 26
  // '0'-'9'
  if (c >= 48 && c <= 57) return c - 48 + 52
  if (c == 43) return 62 // '+'
  if (c == 47) return 63 // '/'
  return -1
}

export function base64DecodeToBytes(b64: string): Bytes {
  // Remove whitespace
  let clean = ""
  for (let i = 0; i < b64.length; i++) {
    let c = b64.charCodeAt(i)
    if (c == 9 || c == 10 || c == 13 || c == 32) continue
    clean = clean.concat(b64.charAt(i))
  }

  // Handle padding
  let padding = 0
  if (clean.length >= 2 && clean.charAt(clean.length - 1) == "=") padding++
  if (clean.length >= 2 && clean.charAt(clean.length - 2) == "=") padding++

  let blocks = clean.length / 4
  let outLen = blocks * 3 - padding
  if (outLen < 0) outLen = 0

  let out = new Uint8Array(outLen as i32)
  let outIndex = 0

  for (let i = 0; i < clean.length; i += 4) {
    let c0 = clean.charCodeAt(i)
    let c1 = clean.charCodeAt(i + 1)
    let c2 = clean.charCodeAt(i + 2)
    let c3 = clean.charCodeAt(i + 3)

    let b0 = decodeCharCode(c0)
    let b1 = decodeCharCode(c1)
    let b2 = c2 == 61 ? -1 : decodeCharCode(c2) // '='
    let b3 = c3 == 61 ? -1 : decodeCharCode(c3)

    if (b0 < 0 || b1 < 0) break

    let triple = (b0 << 18) | (b1 << 12) | ((b2 < 0 ? 0 : b2) << 6) | (b3 < 0 ? 0 : b3)

    if (outIndex < out.length) out[outIndex++] = ((triple >> 16) & 0xff) as u8
    if (b2 >= 0 && outIndex < out.length) out[outIndex++] = ((triple >> 8) & 0xff) as u8
    if (b3 >= 0 && outIndex < out.length) out[outIndex++] = (triple & 0xff) as u8
  }

  return Bytes.fromUint8Array(out)
}


