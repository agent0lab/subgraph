import { dataSource, log } from "@graphprotocol/graph-ts"

/**
 * Get the chain ID for the current data source network
 * @returns Chain ID as i32, or 0 for unknown networks
 */
export function getChainId(): i32 {
  let network = dataSource.network()

  // ERC-8004 Supported Testnets
  if (network == "sepolia") {
    return 11155111  // Ethereum Sepolia
  } else if (network == "base-sepolia") {
    return 84532  // Base Sepolia
  } else if (network == "linea-sepolia") {
    return 59141  // Linea Sepolia
  } else if (network == "polygon-amoy") {
    return 80002  // Polygon Amoy
  } else if (network == "hedera-testnet") {
    return 296  // Hedera Testnet
  } else if (network == "hyperevm-testnet") {
    return 998  // HyperEVM Testnet
  } else if (network == "skale-base-sepolia-testnet") {
    return 1351057110  // SKALE Base Sepolia Testnet
  }
  // Mainnets (for future use)
  else if (network == "mainnet") {
    return 1
  } else if (network == "base") {
    return 8453
  } else if (network == "linea") {
    return 59144
  } else if (network == "polygon") {
    return 137
  } else if (network == "arbitrum-one") {
    return 42161
  } else if (network == "optimism") {
    return 10
  } else if (network == "bsc") {
    return 56
  } else if (network == "avalanche") {
    return 43114
  } else {
    log.warning("Unknown network: {}, using chain ID 0", [network])
    return 0
  }
}
