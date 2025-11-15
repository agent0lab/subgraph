# Complete Multi-Chain Subgraph Deployment Guide

Step-by-step guide for deploying ERC-8004 subgraphs to any blockchain network, from contract deployment to live subgraph.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Deploy (Existing Networks)](#quick-deploy-existing-networks)
3. [Add New Network (Complete Guide)](#add-new-network-complete-guide)
4. [Troubleshooting](#troubleshooting)
5. [Network Reference](#network-reference)

---

## Prerequisites

### Required Tools

```bash
# 1. Node.js 16+ and npm
node --version  # Should be 16+
npm --version

# 2. The Graph CLI (latest version)
npm install -g @graphprotocol/graph-cli@latest
graph --version  # Should be 0.98.1+

# 3. Clone the repository
git clone <your-repo-url>
cd subgraph-other-chains
npm install
```

### The Graph Studio Account

1. Go to https://thegraph.com/studio/
2. Connect your wallet
3. Get your **Deploy Key** (you'll need this for authentication)

---

## Quick Deploy (Existing Networks)

If the network is already configured in `config/networks/`, follow these steps:

### Step 1: Authenticate (One-time)

```bash
graph auth <YOUR_DEPLOY_KEY>
```

### Step 2: Create Subgraph in Studio

1. Go to https://thegraph.com/studio/
2. Click **"Create a Subgraph"**
3. Select the network (e.g., "Base Sepolia", "Ethereum Sepolia")
4. Name it: `erc-8004-testing-<network-name>`
5. Copy the **subgraph slug** from the deployment instructions

### Step 3: Deploy

```bash
# Example: Base Sepolia
STUDIO_SLUG=erc-8004-testing-base-sepolia \
DEPLOYMENT=erc-8004-base-sepolia \
npm run deploy:studio
```

**Or use direct command:**

```bash
graph deploy <STUDIO_SLUG> \
  deployments/generated/<DEPLOYMENT>/subgraph.yaml \
  --node https://api.studio.thegraph.com/deploy/
```

### Step 4: Monitor Deployment

1. Go to your subgraph in Studio: `https://thegraph.com/studio/subgraph/<STUDIO_SLUG>/`
2. Wait for indexing to complete (check "Indexing Status")
3. Test queries in the Playground tab

---

## Add New Network (Complete Guide)

Follow this guide to add support for a **brand new blockchain network**.

### Phase 1: Contract Deployment

#### Option A: Contracts Already Deployed

If ERC-8004 contracts are already deployed on the target network:

1. Get the contract addresses:
   - **IdentityRegistry** address
   - **ReputationRegistry** address
   - **ValidationRegistry** address

2. Find the deployment block numbers:
   - Go to the block explorer for that network
   - Look up each contract address
   - Note the "Contract Creation" block number
   - Use the **earliest block** of the three contracts

#### Option B: Deploy Contracts Yourself

If you need to deploy contracts:

1. Follow the ERC-8004 contract deployment guide
2. Deploy all three contracts:
   - IdentityRegistry
   - ReputationRegistry
   - ValidationRegistry
3. Note the deployment block and contract addresses

---

### Phase 2: Configure Network

#### Step 1: Create Network Configuration File

Create `config/networks/<network-name>.json`:

```bash
# Example: optimism-sepolia
vi config/networks/optimism-sepolia.json
```

**Template:**

```json
{
  "network": "optimism-sepolia",
  "chainId": "11155420",
  "displayName": "Optimism Sepolia",
  "identityRegistry": {
    "address": "0xYourIdentityRegistryAddress",
    "startBlock": 12345678
  },
  "reputationRegistry": {
    "address": "0xYourReputationRegistryAddress",
    "startBlock": 12345678
  },
  "validationRegistry": {
    "address": "0xYourValidationRegistryAddress",
    "startBlock": 12345678
  },
  "graphNode": {
    "network": "optimism-sepolia"
  }
}
```

**Important Notes:**

- **`network`**: Internal identifier (kebab-case, e.g., `optimism-sepolia`)
- **`chainId`**: EVM chain ID as string
- **`displayName`**: Human-readable name
- **`address`**: Must be **lowercase** (no checksummed addresses)
- **`startBlock`**: Use the earliest deployment block (saves indexing time)
- **`graphNode.network`**: The Graph node network identifier (usually matches `network`)

#### Step 2: Add to Deployment Tracking

Edit `deployments/deployment.json` and add your network:

```json
{
  "erc-8004": {
    "protocol": "erc-8004",
    "schema": "erc-8004",
    "description": "ERC-8004 Trustless Agents - Agent Discovery and Trust Protocol",
    "deployments": {
      // ... existing deployments ...

      "erc-8004-optimism-sepolia": {
        "network": "optimism-sepolia",
        "displayName": "Optimism Sepolia",
        "chainId": "11155420",
        "status": "prod",
        "configFile": "config/networks/optimism-sepolia.json",
        "versions": {
          "schema": "1.0.0",
          "subgraph": "1.0.0"
        }
      }
    }
  }
}
```

#### Step 3: Update Chain ID Mapping

Edit `src/utils/chain.ts` and add your network:

```typescript
export function getChainId(): i32 {
  let network = dataSource.network()

  // ERC-8004 Supported Testnets
  if (network == "sepolia") {
    return 11155111  // Ethereum Sepolia
  } else if (network == "base-testnet" || network == "base-sepolia") {
    return 84532  // Base Sepolia
  }
  // ... existing networks ...

  // 👇 ADD YOUR NETWORK HERE
  else if (network == "optimism-sepolia") {
    return 11155420  // Optimism Sepolia
  }

  // ... rest of the code ...
}
```

#### Step 4: Add Contract Addresses

Edit `src/contract-addresses.ts` and add your network:

```typescript
export function getContractAddresses(chainId: BigInt): ContractAddresses {
  // Ethereum Sepolia (11155111)
  if (chainId.equals(BigInt.fromI32(11155111))) {
    return new ContractAddresses(
      Bytes.fromHexString("0x8004a6090Cd10A7288092483047B097295Fb8847"),
      Bytes.fromHexString("0x8004B8FD1A363aa02fDC07635C0c5F94f6Af5B7E"),
      Bytes.fromHexString("0x8004CB39f29c09145F24Ad9dDe2A108C1A2cdfC5")
    )
  }
  // ... existing networks ...

  // 👇 ADD YOUR NETWORK HERE
  // Optimism Sepolia (11155420)
  else if (chainId.equals(BigInt.fromI32(11155420))) {
    return new ContractAddresses(
      Bytes.fromHexString("0xYourIdentityRegistryAddress"),
      Bytes.fromHexString("0xYourReputationRegistryAddress"),
      Bytes.fromHexString("0xYourValidationRegistryAddress")
    )
  }

  // ... rest of the code ...
}
```

Also update `getChainName()`:

```typescript
export function getChainName(chainId: BigInt): string {
  if (chainId.equals(BigInt.fromI32(11155111))) return "Ethereum Sepolia"
  // ... existing networks ...

  // 👇 ADD YOUR NETWORK HERE
  if (chainId.equals(BigInt.fromI32(11155420))) return "Optimism Sepolia"

  return `Unsupported Chain ${chainId.toString()}`
}
```

And update `getSupportedChains()`:

```typescript
export function getSupportedChains(): BigInt[] {
  return [
    BigInt.fromI32(11155111),      // Ethereum Sepolia
    // ... existing networks ...

    // 👇 ADD YOUR NETWORK HERE
    BigInt.fromI32(11155420)       // Optimism Sepolia
  ]
}
```

---

### Phase 3: Validate & Build

#### Step 1: Validate Configuration

```bash
npm run validate
```

**Expected output:**
```
✅ optimism-sepolia (Optimism Sepolia)
✅ Found 8 deployment entries
✅ All validations passed!
```

#### Step 2: Generate Manifests

```bash
npm run generate
```

**Expected output:**
```
✅ Successfully generated: 8/8 manifests
```

**Verify the generated manifest:**

```bash
cat deployments/generated/erc-8004-optimism-sepolia/subgraph.yaml | grep -E "network:|address:" | head -6
```

Should show:
```yaml
network: optimism-sepolia
  address: "0xYourIdentityRegistryAddress"
network: optimism-sepolia
  address: "0xYourReputationRegistryAddress"
network: optimism-sepolia
  address: "0xYourValidationRegistryAddress"
```

#### Step 3: Build

```bash
# Build single deployment
DEPLOYMENT=erc-8004-optimism-sepolia npm run build:single

# Or build all deployments
npm run build:all
```

**Expected output:**
```
✔ Compile subgraph
Build completed: build/subgraph.yaml
```

---

### Phase 4: Deploy to The Graph Studio

#### Step 1: Create Subgraph in Studio

1. Go to https://thegraph.com/studio/
2. Click **"Create a Subgraph"**
3. Select your network from the dropdown
   - Look for the exact network name (e.g., "Optimism Sepolia")
   - Make sure it's the testnet, not mainnet
4. Name your subgraph: `erc-8004-testing-optimism-sepolia`
5. Copy the **subgraph slug** from the deployment instructions page

#### Step 2: Authenticate (If not already done)

```bash
graph auth <YOUR_DEPLOY_KEY>
```

Get your deploy key from: https://thegraph.com/studio/

#### Step 3: Deploy

**Using helper script:**

```bash
STUDIO_SLUG=erc-8004-testing-optimism-sepolia \
DEPLOYMENT=erc-8004-optimism-sepolia \
npm run deploy:studio
```

**Or using direct command:**

```bash
graph deploy erc-8004-testing-optimism-sepolia \
  deployments/generated/erc-8004-optimism-sepolia/subgraph.yaml \
  --node https://api.studio.thegraph.com/deploy/
```

When prompted for version label:
```
Which version label to use? (e.g. "v0.0.1"): v1.0.0
```

#### Step 4: Monitor Indexing

1. Go to your subgraph: `https://thegraph.com/studio/subgraph/<STUDIO_SLUG>/`
2. Check the **"Indexing Status"** tab
3. Wait for status to show **"Synced"**
4. Monitor for any errors in the logs

**Indexing Timeline:**
- Small start block (~1M blocks from current): 5-30 minutes
- Large start block (~50M blocks from current): 30+ minutes

#### Step 5: Test Queries

Once synced, go to the **Playground** tab and test:

```graphql
# Test query: Get protocol info
{
  protocols(first: 1) {
    id
    chainId
    name
    totalAgents
    totalFeedback
    totalValidations
  }
}

# Test query: Get agents
{
  agents(first: 5) {
    id
    agentId
    owner
    createdAt
  }
}
```

---

## Troubleshooting

### Error: "Specified network is not supported"

**Problem:** The Graph node doesn't recognize the network identifier.

**Solution:**
1. Check The Graph's supported networks: https://thegraph.com/docs/en/developing/supported-networks/
2. Use the **exact network identifier** from The Graph documentation
3. Common identifiers:
   - Base Sepolia: `base-sepolia` or `base-testnet`
   - Optimism Sepolia: `optimism-sepolia`
   - Arbitrum Sepolia: `arbitrum-sepolia`

### Error: "Failed to deploy: Subgraph not found"

**Problem:** Studio subgraph doesn't exist or slug is wrong.

**Solution:**
1. Verify the subgraph exists in Studio
2. Check the studio slug matches exactly (case-sensitive)
3. Make sure you're authenticated with the correct deploy key

### Error: "Contract address not found"

**Problem:** Start block is after contract deployment or address is wrong.

**Solution:**
1. Verify contract addresses on block explorer
2. Check start block is at or before contract deployment
3. Ensure addresses are lowercase (no checksummed addresses)

### Warning: "Slow indexing"

**Problem:** Start block is too far in the past.

**Solution:**
1. Find the actual contract deployment block
2. Update `startBlock` in `config/networks/<network>.json`
3. Regenerate and redeploy: `npm run generate && npm run deploy:studio`

### Error: "Authentication failed"

**Problem:** Deploy key is invalid or not set.

**Solution:**
```bash
# Re-authenticate
graph auth <YOUR_DEPLOY_KEY>
```

Get your deploy key from The Graph Studio settings.

### Build Error: "Cannot find module"

**Problem:** Dependencies not installed or generated types missing.

**Solution:**
```bash
# Clean and rebuild
rm -rf build generated node_modules
npm install
npm run generate
npm run build:all
```

---

## Network Reference

### Currently Supported Networks

| Network | Chain ID | Status | Start Block | Config File |
|---------|----------|--------|-------------|-------------|
| Ethereum Sepolia | 11155111 | ✅ Deployed | 9,493,000 | `eth-sepolia.json` |
| Base Sepolia | 84532 | ✅ Deployed | 32,481,444 | `base-sepolia.json` |
| Linea Sepolia | 59141 | ✅ Ready | 19,589,847 | `linea-sepolia.json` |
| Polygon Amoy | 80002 | ✅ Ready | 28,346,843 | `polygon-amoy.json` |
| Hedera Testnet | 296 | ✅ Ready | 26,487,774 | `hedera-testnet.json` |
| HyperEVM Testnet | 998 | ✅ Ready | 1 | `hyperevm-testnet.json` |
| SKALE Base Sepolia | 1351057110 | ✅ Ready | 1 | `skale-sepolia.json` |

### The Graph Supported Networks

For complete list of supported networks, see:
https://thegraph.com/docs/en/developing/supported-networks/

**Common Testnets:**
- Ethereum: `sepolia`, `goerli` (deprecated)
- Base: `base-sepolia`, `base-testnet`
- Optimism: `optimism-sepolia`
- Arbitrum: `arbitrum-sepolia`
- Polygon: `mumbai`, `polygon-amoy`
- Avalanche: `fuji`
- Celo: `celo-alfajores`

---

## Quick Reference Commands

```bash
# Validate network configs
npm run validate

# Generate manifests for all networks
npm run generate

# Build all deployments
npm run build:all

# Build single deployment
DEPLOYMENT=erc-8004-<network> npm run build:single

# Deploy to Studio
STUDIO_SLUG=<your-slug> \
DEPLOYMENT=erc-8004-<network> \
npm run deploy:studio

# Direct deploy command
graph deploy <STUDIO_SLUG> \
  deployments/generated/<DEPLOYMENT>/subgraph.yaml \
  --node https://api.studio.thegraph.com/deploy/
```

---

## Deployment Checklist

Use this checklist when adding a new network:

- [ ] Contracts deployed to target network
- [ ] Contract addresses obtained (lowercase)
- [ ] Deployment block numbers found
- [ ] Created `config/networks/<network>.json`
- [ ] Updated `deployments/deployment.json`
- [ ] Updated `src/utils/chain.ts` (chain ID mapping)
- [ ] Updated `src/contract-addresses.ts` (addresses + chain name)
- [ ] Ran `npm run validate` (passed)
- [ ] Ran `npm run generate` (manifest created)
- [ ] Ran build test (successful)
- [ ] Created subgraph in Studio (correct network)
- [ ] Deployed to Studio (successful)
- [ ] Verified indexing started
- [ ] Tested queries in Playground

---

## Getting Help

- **The Graph Documentation**: https://thegraph.com/docs/
- **Discord**: https://discord.gg/graphprotocol
- **Subgraph Studio**: https://thegraph.com/studio/

---

## Advanced Topics

### Updating Existing Deployment

To update an already deployed subgraph:

```bash
# Make your changes to handlers or schema
# Increment version in deployments/deployment.json

# Regenerate and deploy
npm run generate
STUDIO_SLUG=<your-slug> \
DEPLOYMENT=<deployment> \
npm run deploy:studio
```

When prompted, use a new version: `v1.0.1`, `v1.1.0`, etc.

### Multi-Network Batch Deployment

Deploy to multiple networks at once:

```bash
# Create a deployment script
for network in base-sepolia eth-sepolia linea-sepolia; do
  STUDIO_SLUG=erc-8004-testing-$network \
  DEPLOYMENT=erc-8004-$network \
  npm run deploy:studio
done
```

---

**Last Updated:** November 2025
**Graph CLI Version:** 0.98.1+
**Subgraph Schema Version:** 1.0.0
