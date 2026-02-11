import { BigInt, Bytes } from "@graphprotocol/graph-ts";

// =============================================================================
// COMMON CONSTANTS
// =============================================================================

export const BIGINT_ZERO = BigInt.fromI32(0);
export const BIGINT_ONE = BigInt.fromI32(1);
export const BIGINT_HUNDRED = BigInt.fromI32(100);

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const ZERO_ADDRESS_BYTES = Bytes.fromHexString(ZERO_ADDRESS);
export const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const ZERO_BYTES32_BYTES = Bytes.fromHexString(ZERO_BYTES32);

// =============================================================================
// NETWORK CONSTANTS
// =============================================================================

/**
 * Network identifiers matching The Graph's network names
 * These should match the "network" field in subgraph.yaml
 */
export namespace Network {
  export const ETH_MAINNET = "mainnet";
  export const BASE_MAINNET = "base";
  export const BSC_MAINNET = "bsc";
  export const MONAD_MAINNET = "monad";
  export const POLYGON_MAINNET = "matic";

  export const ETH_SEPOLIA = "sepolia";
  export const BASE_SEPOLIA = "base-sepolia";
  export const BSC_TESTNET = "chapel";
  export const HEDERA_TESTNET = "hedera-testnet";
  export const HYPEREVM_TESTNET = "hyperevm-testnet";
  export const LINEA_SEPOLIA = "linea-sepolia";
  export const MONAD_TESTNET = "monad-testnet";
  export const POLYGON_AMOY = "polygon-amoy";
  export const SKALE_SEPOLIA = "skale-base-sepolia-testnet";
}

/**
 * Maps The Graph network names to chain IDs
 * Used for creating unique entity IDs and chain-specific logic
 */
export function getChainIdFromNetwork(network: string): BigInt {
  if (network == Network.ETH_MAINNET) return BigInt.fromI32(1);
  if (network == Network.BASE_MAINNET) return BigInt.fromI32(8453);
  if (network == Network.BSC_MAINNET) return BigInt.fromI32(56);
  if (network == Network.MONAD_MAINNET) return BigInt.fromI32(143);
  if (network == Network.POLYGON_MAINNET) return BigInt.fromI32(137);

  if (network == Network.ETH_SEPOLIA) return BigInt.fromI32(11155111);
  if (network == Network.BASE_SEPOLIA) return BigInt.fromI32(84532);
  if (network == Network.BSC_TESTNET) return BigInt.fromI32(97);
  if (network == Network.HEDERA_TESTNET) return BigInt.fromI32(296);
  if (network == Network.HYPEREVM_TESTNET) return BigInt.fromI32(998);
  if (network == Network.LINEA_SEPOLIA) return BigInt.fromI32(59141);
  if (network == Network.MONAD_TESTNET) return BigInt.fromI32(10143);
  if (network == Network.POLYGON_AMOY) return BigInt.fromI32(80002);
  if (network == Network.SKALE_SEPOLIA) return BigInt.fromString("1351057110");

  // Unknown network - return 0
  return BIGINT_ZERO;
}

/**
 * Gets a human-readable display name for a network
 */
export function getNetworkDisplayName(network: string): string {
  if (network == Network.ETH_MAINNET) return "Ethereum Mainnet";
  if (network == Network.BASE_MAINNET) return "Base Mainnet";
  if (network == Network.BSC_MAINNET) return "BSC Mainnet";
  if (network == Network.MONAD_MAINNET) return "Monad Mainnet";
  if (network == Network.POLYGON_MAINNET) return "Polygon Mainnet";

  if (network == Network.ETH_SEPOLIA) return "Ethereum Sepolia";
  if (network == Network.BASE_SEPOLIA) return "Base Sepolia";
  if (network == Network.BSC_TESTNET) return "BSC Testnet";
  if (network == Network.HEDERA_TESTNET) return "Hedera Testnet";
  if (network == Network.HYPEREVM_TESTNET) return "HyperEVM Testnet";
  if (network == Network.LINEA_SEPOLIA) return "Linea Sepolia";
  if (network == Network.MONAD_TESTNET) return "Monad Testnet";
  if (network == Network.POLYGON_AMOY) return "Polygon Amoy";
  if (network == Network.SKALE_SEPOLIA) return "SKALE Base Sepolia Testnet";

  return `Unknown Network (${network})`;
}

// =============================================================================
// PROTOCOL CONSTANTS
// =============================================================================

export const PROTOCOL_NAME = "ERC-8004";
export const PROTOCOL_SLUG = "erc-8004";
