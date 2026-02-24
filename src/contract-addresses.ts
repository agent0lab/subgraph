import { BigInt, Bytes } from "@graphprotocol/graph-ts"

// =============================================================================
// CONTRACT ADDRESS CONFIGURATION
// =============================================================================

export class ContractAddresses {
  identityRegistry: Bytes
  reputationRegistry: Bytes
  validationRegistry: Bytes

  constructor(
    identityRegistry: Bytes,
    reputationRegistry: Bytes,
    validationRegistry: Bytes
  ) {
    this.identityRegistry = identityRegistry
    this.reputationRegistry = reputationRegistry
    this.validationRegistry = validationRegistry
  }
}

// =============================================================================
// ADDRESS RESOLUTION
// =============================================================================

export function getContractAddresses(chainId: BigInt): ContractAddresses {
  // Ethereum Mainnet (1)
  if (chainId.equals(BigInt.fromI32(1))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"),
      Bytes.fromHexString("0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"),
      // Validation registry not configured / indexing paused
      Bytes.fromHexString("0x0000000000000000000000000000000000000000")
    )
  }
  // Polygon Mainnet (137)
  else if (chainId.equals(BigInt.fromI32(137))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"),
      Bytes.fromHexString("0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"),
      // Validation registry not configured / indexing paused
      Bytes.fromHexString("0x0000000000000000000000000000000000000000")
    )
  }
  // Ethereum Sepolia (11155111)
  else if (chainId.equals(BigInt.fromI32(11155111))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004a6090Cd10A7288092483047B097295Fb8847"),
      Bytes.fromHexString("0x8004B8FD1A363aa02fDC07635C0c5F94f6Af5B7E"),
      Bytes.fromHexString("0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5")
    )
  }
  // Base Sepolia (84532)
  else if (chainId.equals(BigInt.fromI32(84532))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004AA63c570c570eBF15376c0dB199918BFe9Fb"),
      Bytes.fromHexString("0x8004bd8daB57f14Ed299135749a5CB5c42d341BF"),
      Bytes.fromHexString("0x8004C269D0A5647E51E121FeB226200ECE932d55")
    )
  }
  // Linea Sepolia (59141)
  else if (chainId.equals(BigInt.fromI32(59141))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004aa7C931bCE1233973a0C6A667f73F66282e7"),
      Bytes.fromHexString("0x8004bd8483b99310df121c46ED8858616b2Bba02"),
      Bytes.fromHexString("0x8004c44d1EFdd699B2A26e781eF7F77c56A9a4EB")
    )
  }
  // Polygon Amoy (80002)
  else if (chainId.equals(BigInt.fromI32(80002))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004ad19E14B9e0654f73353e8a0B600D46C2898"),
      Bytes.fromHexString("0x8004B12F4C2B42d00c46479e859C92e39044C930"),
      Bytes.fromHexString("0x8004C11C213ff7BaD36489bcBDF947ba5eee289B")
    )
  }
  // Hedera Testnet (296)
  else if (chainId.equals(BigInt.fromI32(296))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x4c74ebd72921d537159ed2053f46c12a7d8e5923"),
      Bytes.fromHexString("0xc565edcba77e3abeade40bfd6cf6bf583b3293e0"),
      Bytes.fromHexString("0x18df085d85c586e9241e0cd121ca422f571c2da6")
    )
  }
  // HyperEVM Testnet (998)
  else if (chainId.equals(BigInt.fromI32(998))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004A9560C0edce880cbD24Ba19646470851C986"),
      Bytes.fromHexString("0x8004b490779A65D3290a31fD96471122050dF671"),
      Bytes.fromHexString("0x8004C86198fdB8d8169c0405D510EC86cc7B0551")
    )
  }
  // SKALE Base Sepolia Testnet (1351057110)
  else if (chainId.equals(BigInt.fromString("1351057110"))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x4fa7900596c9830664406d3796952c59ec4133d9"),
      Bytes.fromHexString("0x9b9d23a47697691ef1016906d1f8ddfc009e6a69"),
      Bytes.fromHexString("0x34ae1196b1609e01ebc90b75c802b2ea87203f13")
    )
  }
  // TRON Mainnet (728126428)
  else if (chainId.equals(BigInt.fromI32(728126428))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x3af43112221546eb8303e6c311f7ae54d5496822"),
      Bytes.fromHexString("0x3dca61245f959c8ba373ef065199c396c0a377cf"),
      Bytes.fromHexString("0x70355dc91f835d0de5245335fad6c7cf6bc704c0")
    )
  }
  // TRON Nile Testnet (3448148188)
  else if (chainId.equals(BigInt.fromString("3448148188"))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x23a8224adb66985c131893e6c014218cd05a663c"),
      Bytes.fromHexString("0x10b65bcaa3f8cb60f9b04de64ba319812ac30d1f"),
      Bytes.fromHexString("0x4521efa04ca1ca4131e4aa34789fa5a85f76146a")
    )
  }
  // TRON Shasta Testnet (241131)
  else if (chainId.equals(BigInt.fromI32(241131))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x4e4743b9b53365277d6d2cd0043383ec8604e59f"),
      Bytes.fromHexString("0xc3119c26a73ba9a5122397663a3a8662e6a8ae22"),
      Bytes.fromHexString("0x9bd8aa09595285ceeda45e7cf2115064ffb0edd2")
    )
  }

  // Unsupported chain - return zero addresses
  return new ContractAddresses(
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000"),
    Bytes.fromHexString("0x0000000000000000000000000000000000000000")
  )
}

// =============================================================================
// CHAIN NAME RESOLUTION
// =============================================================================

export function getChainName(chainId: BigInt): string {
  if (chainId.equals(BigInt.fromI32(1))) return "Ethereum Mainnet"
  if (chainId.equals(BigInt.fromI32(137))) return "Polygon Mainnet"
  if (chainId.equals(BigInt.fromI32(11155111))) return "Ethereum Sepolia"
  if (chainId.equals(BigInt.fromI32(84532))) return "Base Sepolia"
  if (chainId.equals(BigInt.fromI32(59141))) return "Linea Sepolia"
  if (chainId.equals(BigInt.fromI32(80002))) return "Polygon Amoy"
  if (chainId.equals(BigInt.fromI32(296))) return "Hedera Testnet"
  if (chainId.equals(BigInt.fromI32(998))) return "HyperEVM Testnet"
  if (chainId.equals(BigInt.fromString("1351057110"))) return "SKALE Base Sepolia Testnet"
  if (chainId.equals(BigInt.fromI32(728126428))) return "TRON Mainnet"
  if (chainId.equals(BigInt.fromString("3448148188"))) return "TRON Nile Testnet"
  if (chainId.equals(BigInt.fromI32(241131))) return "TRON Shasta Testnet"
  return `Unsupported Chain ${chainId.toString()}`
}

// =============================================================================
// VALIDATION
// =============================================================================

export function validateContractAddresses(addresses: ContractAddresses): boolean {
  // Check if addresses are not zero addresses
  let zeroAddress = Bytes.fromHexString("0x0000000000000000000000000000000000000000")

  // Validation registry is currently optional because validation indexing is paused in the manifest.
  // We still store it in `Protocol`, but do not require it to consider a chain supported.
  return !addresses.identityRegistry.equals(zeroAddress) &&
    !addresses.reputationRegistry.equals(zeroAddress)
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function isSupportedChain(chainId: BigInt): boolean {
  let addresses = getContractAddresses(chainId)
  return validateContractAddresses(addresses)
}

export function getSupportedChains(): BigInt[] {
  return [
    BigInt.fromI32(1),             // Ethereum Mainnet
    BigInt.fromI32(137),           // Polygon Mainnet
    BigInt.fromI32(11155111),      // Ethereum Sepolia
    BigInt.fromI32(84532),         // Base Sepolia
    BigInt.fromI32(59141),         // Linea Sepolia
    BigInt.fromI32(80002),         // Polygon Amoy
    BigInt.fromI32(296),           // Hedera Testnet
    BigInt.fromI32(998),           // HyperEVM Testnet
    BigInt.fromString("1351057110"), // SKALE Base Sepolia Testnet
    BigInt.fromI32(728126428),     // TRON Mainnet
    BigInt.fromString("3448148188"), // TRON Nile Testnet
    BigInt.fromI32(241131)         // TRON Shasta Testnet
  ]
}
