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
  let zero = Bytes.fromHexString("0x0000000000000000000000000000000000000000")

  // Ethereum Mainnet (1)
  if (chainId.equals(BigInt.fromI32(1))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"),
      Bytes.fromHexString("0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"),
      // Validation registry not configured / indexing paused
      zero
    )
  }
  // Base Mainnet (8453)
  else if (chainId.equals(BigInt.fromI32(8453))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"),
      Bytes.fromHexString("0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"),
      zero
    )
  }
  // BSC Mainnet (56)
  else if (chainId.equals(BigInt.fromI32(56))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"),
      Bytes.fromHexString("0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"),
      zero
    )
  }
  // Monad Mainnet (143)
  else if (chainId.equals(BigInt.fromI32(143))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"),
      Bytes.fromHexString("0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"),
      zero
    )
  }
  // Polygon Mainnet (137)
  else if (chainId.equals(BigInt.fromI32(137))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"),
      Bytes.fromHexString("0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"),
      // Validation registry not configured / indexing paused
      zero
    )
  }
  // Base Mainnet (8453)
  else if (chainId.equals(BigInt.fromI32(8453))) {
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
      Bytes.fromHexString("0x8004A818BFB912233c491871b3d84c89A494BD9e"),
      Bytes.fromHexString("0x8004B663056A597Dffe9eCcC1965A193B7388713"),
      zero
    )
  }
  // BSC Testnet (97)
  else if (chainId.equals(BigInt.fromI32(97))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004A818BFB912233c491871b3d84c89A494BD9e"),
      Bytes.fromHexString("0x8004B663056A597Dffe9eCcC1965A193B7388713"),
      zero
    )
  }
  // Monad Testnet (10143)
  else if (chainId.equals(BigInt.fromI32(10143))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004A818BFB912233c491871b3d84c89A494BD9e"),
      Bytes.fromHexString("0x8004B663056A597Dffe9eCcC1965A193B7388713"),
      zero
    )
  }
  // Base Sepolia (84532)
  else if (chainId.equals(BigInt.fromI32(84532))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004A818BFB912233c491871b3d84c89A494BD9e"),
      Bytes.fromHexString("0x8004B663056A597Dffe9eCcC1965A193B7388713"),
      zero
    )
  }
  // Linea Sepolia (59141)
  else if (chainId.equals(BigInt.fromI32(59141))) {
    return new ContractAddresses(
      zero,
      zero,
      zero
    )
  }
  // Polygon Amoy (80002)
  else if (chainId.equals(BigInt.fromI32(80002))) {
    return new ContractAddresses(
      zero,
      zero,
      zero
    )
  }
  // Hedera Testnet (296)
  else if (chainId.equals(BigInt.fromI32(296))) {
    return new ContractAddresses(
      zero,
      zero,
      zero
    )
  }
  // HyperEVM Testnet (998)
  else if (chainId.equals(BigInt.fromI32(998))) {
    return new ContractAddresses(
      zero,
      zero,
      zero
    )
  }
  // SKALE Base Sepolia Testnet (1351057110)
  else if (chainId.equals(BigInt.fromString("1351057110"))) {
    return new ContractAddresses(
      zero,
      zero,
      zero
    )
  }

  // Unsupported chain - return zero addresses
  return new ContractAddresses(
    zero,
    zero,
    zero
  )
}

// =============================================================================
// CHAIN NAME RESOLUTION
// =============================================================================

export function getChainName(chainId: BigInt): string {
  if (chainId.equals(BigInt.fromI32(1))) return "Ethereum Mainnet"
  if (chainId.equals(BigInt.fromI32(8453))) return "Base Mainnet"
  if (chainId.equals(BigInt.fromI32(56))) return "BSC Mainnet"
  if (chainId.equals(BigInt.fromI32(143))) return "Monad"
  if (chainId.equals(BigInt.fromI32(137))) return "Polygon Mainnet"
  if (chainId.equals(BigInt.fromI32(8453))) return "Base Mainnet"
  if (chainId.equals(BigInt.fromI32(11155111))) return "Ethereum Sepolia"
  if (chainId.equals(BigInt.fromI32(97))) return "BSC Testnet"
  if (chainId.equals(BigInt.fromI32(10143))) return "Monad Testnet"
  if (chainId.equals(BigInt.fromI32(84532))) return "Base Sepolia"
  if (chainId.equals(BigInt.fromI32(59141))) return "Linea Sepolia"
  if (chainId.equals(BigInt.fromI32(80002))) return "Polygon Amoy"
  if (chainId.equals(BigInt.fromI32(296))) return "Hedera Testnet"
  if (chainId.equals(BigInt.fromI32(998))) return "HyperEVM Testnet"
  if (chainId.equals(BigInt.fromString("1351057110"))) return "SKALE Base Sepolia Testnet"
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
    BigInt.fromI32(8453),          // Base Mainnet
    BigInt.fromI32(56),            // BSC Mainnet
    BigInt.fromI32(143),           // Monad
    BigInt.fromI32(137),           // Polygon Mainnet
    BigInt.fromI32(8453),          // Base Mainnet
    BigInt.fromI32(11155111),      // Ethereum Sepolia
    BigInt.fromI32(97),            // BSC Testnet
    BigInt.fromI32(10143),         // Monad Testnet
    BigInt.fromI32(84532),         // Base Sepolia
    BigInt.fromI32(59141),         // Linea Sepolia (currently not deployed; returns zero addresses)
    BigInt.fromI32(80002),         // Polygon Amoy (currently not deployed; returns zero addresses)
    BigInt.fromI32(296),           // Hedera Testnet (currently not deployed; returns zero addresses)
    BigInt.fromI32(998),           // HyperEVM Testnet (currently not deployed; returns zero addresses)
    BigInt.fromString("1351057110") // SKALE Base Sepolia Testnet (currently not deployed; returns zero addresses)
  ]
}
