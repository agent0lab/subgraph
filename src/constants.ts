import { BigInt } from "@graphprotocol/graph-ts";

// =============================================================================
// NETWORK CONSTANTS
// =============================================================================

/**
 * Network identifiers matching The Graph's network names
 * These should match the "network" field in subgraph.yaml
 */
export namespace Network {
  export const ETH_SEPOLIA = "sepolia";
  export const BASE_SEPOLIA = "base-sepolia";
  export const LINEA_SEPOLIA = "linea-sepolia";
  export const POLYGON_AMOY = "polygon-amoy";
  export const HEDERA_TESTNET = "hedera-testnet";
  export const HYPEREVM_TESTNET = "hyperevm-testnet";
  export const SKALE_SEPOLIA = "skale-base-sepolia-testnet";
}

/**
 * Maps The Graph network names to chain IDs
 * Used for creating unique entity IDs and chain-specific logic
 */
export function getChainIdFromNetwork(network: string): BigInt {
  if (network == Network.ETH_SEPOLIA) return BigInt.fromI32(11155111);
  if (network == Network.BASE_SEPOLIA) return BigInt.fromI32(84532);
  if (network == Network.LINEA_SEPOLIA) return BigInt.fromI32(59141);
  if (network == Network.POLYGON_AMOY) return BigInt.fromI32(80002);
  if (network == Network.HEDERA_TESTNET) return BigInt.fromI32(296);
  if (network == Network.HYPEREVM_TESTNET) return BigInt.fromI32(998);
  if (network == Network.SKALE_SEPOLIA) return BigInt.fromString("1351057110");

  // Unknown network - return 0
  return BigInt.fromI32(0);
}

/**
 * Gets a human-readable display name for a network
 */
export function getNetworkDisplayName(network: string): string {
  if (network == Network.ETH_SEPOLIA) return "Ethereum Sepolia";
  if (network == Network.BASE_SEPOLIA) return "Base Sepolia";
  if (network == Network.LINEA_SEPOLIA) return "Linea Sepolia";
  if (network == Network.POLYGON_AMOY) return "Polygon Amoy";
  if (network == Network.HEDERA_TESTNET) return "Hedera Testnet";
  if (network == Network.HYPEREVM_TESTNET) return "HyperEVM Testnet";
  if (network == Network.SKALE_SEPOLIA) return "SKALE Base Sepolia Testnet";

  return `Unknown Network (${network})`;
}

// =============================================================================
// COMMON CONSTANTS
// =============================================================================

export const BIGINT_ZERO = BigInt.fromI32(0);
export const BIGINT_ONE = BigInt.fromI32(1);
export const BIGINT_HUNDRED = BigInt.fromI32(100);

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// =============================================================================
// PROTOCOL CONSTANTS
// =============================================================================

export const PROTOCOL_NAME = "ERC-8004";
export const PROTOCOL_SLUG = "erc-8004";
