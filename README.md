# Agent0 SDK Subgraph

A multi-chain subgraph for indexing [ERC-8004](https://eips.ethereum.org/EIP-8004) Trustless Agents protocol data, providing GraphQL APIs for agent discovery, reputation tracking, and validation across 7 networks.

## 🌐 Supported Networks

| Network | Chain ID | Status | Endpoint |
|---------|----------|--------|----------|
| **Ethereum Sepolia** | 11155111 | ✅ Deployed | [Endpoint](https://gateway.thegraph.com/api/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT) |
| **Base Sepolia** | 84532 | ✅ Deployed | [Endpoint](https://gateway.thegraph.com/api/subgraphs/id/GjQEDgEKqoh5Yc8MUgxoQoRATEJdEiH7HbocfR1aFiHa) |
| **Polygon Amoy** | 80002 | ✅ Deployed | [Endpoint](https://gateway.thegraph.com/api/subgraphs/id/2A1JB18r1mF2VNP4QBH4mmxd74kbHoM6xLXC8ABAKf7j) |
| **Linea Sepolia** | 59141 | ✅ Ready | - |
| **Hedera Testnet** | 296 | ✅ Ready | - |
| **HyperEVM Testnet** | 998 | ✅ Ready | - |
| **SKALE Base Sepolia** | 1351057110 | ✅ Ready | - |

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- The Graph CLI: `npm install -g @graphprotocol/graph-cli`

### Installation

```bash
# Install dependencies
npm install

# Validate network configurations
npm run validate

# Generate manifests for all networks
npm run generate

# Build all network deployments
npm run build:all
```

## 🛠️ Multi-Chain Development

This subgraph uses a **template-based multi-chain architecture** inspired by Messari's subgraph infrastructure, enabling a single codebase to deploy across 7 networks with minimal duplication.

### Architecture Overview

```
📁 Project Structure
├── config/
│   ├── networks/                 # Network-specific configurations
│   │   ├── eth-sepolia.json      # Contract addresses, start blocks
│   │   ├── base-sepolia.json
│   │   └── ... (7 networks)
│   └── subgraph.template.yaml    # Mustache template for manifests
├── deployments/
│   ├── deployment.json           # Master deployment tracking
│   └── generated/                # Generated subgraph.yaml files
│       ├── erc-8004-eth-sepolia/
│       ├── erc-8004-base-sepolia/
│       └── ... (7 deployments)
├── src/                          # Shared handler code (95%+ reuse)
└── scripts/                      # Build automation
```

### Key Commands

#### Development Workflow

```bash
# Validate all network configurations
npm run validate

# Generate manifests from template
npm run generate

# Build all deployments (runs codegen + build for each network)
npm run build:all

# Build single deployment
DEPLOYMENT=erc-8004-base-sepolia npm run build:single
```

#### Adding a New Network

1. Create network config: `config/networks/new-network.json`
```json
{
  "network": "new-network",
  "chainId": "123456",
  "displayName": "New Network",
  "identityRegistry": {
    "address": "0x...",
    "startBlock": 1
  },
  "reputationRegistry": {
    "address": "0x...",
    "startBlock": 1
  },
  "validationRegistry": {
    "address": "0x...",
    "startBlock": 1
  },
  "graphNode": {
    "network": "new-network"
  }
}
```

2. Add to `deployments/deployment.json`
```json
{
  "erc-8004": {
    "deployments": {
      "erc-8004-new-network": {
        "network": "new-network",
        "status": "prod",
        "configFile": "config/networks/new-network.json",
        "versions": {
          "schema": "1.0.0",
          "subgraph": "1.0.0"
        }
      }
    }
  }
}
```

3. Add chain ID mapping in `src/utils/chain.ts`
```typescript
if (network == "new-network") {
  return 123456  // New Network chain ID
}
```

4. Add contract addresses in `src/contract-addresses.ts`
```typescript
if (chainId.equals(BigInt.fromI32(123456))) {
  return new ContractAddresses(
    Bytes.fromHexString("0x..."),  // Identity
    Bytes.fromHexString("0x..."),  // Reputation
    Bytes.fromHexString("0x...")   // Validation
  )
}
```

5. Generate and build: `npm run build:all`

**Time to add new network:** < 5 minutes

### Deployment

```bash
# Deploy to The Graph Studio (requires auth token)
# Set your deployment key first:
# graph auth --studio <DEPLOY_KEY>

# Deploy specific network
DEPLOYMENT=erc-8004-eth-sepolia npm run deploy

# Or deploy locally for testing
npm run create-local && npm run deploy-local
```

## 📊 Overview

This subgraph indexes data from three core smart contracts implementing the ERC-8004 standard:

| Contract | Purpose | Events Indexed |
|----------|---------|----------------|
| **IdentityRegistry** | Agent registration and metadata management | `Registered`, `MetadataSet`, `UriUpdated`, `Transfer` |
| **ReputationRegistry** | Feedback and reputation tracking | `NewFeedback`, `FeedbackRevoked`, `ResponseAppended` |
| **ValidationRegistry** | Agent validation and attestation | `ValidationRequest`, `ValidationResponse` |

### Key Features

- 🔍 **Comprehensive Agent Data** - On-chain registration with rich off-chain metadata
- 📊 **Real-time Reputation** - Live feedback scoring and response tracking
- ✅ **Validation Tracking** - Complete validation lifecycle with status management
- 📁 **IPFS & Arweave Integration** - Native JSON parsing via File Data Sources
- 🔄 **Rich Relationships** - Connected data through derived fields and references
- 🌐 **Multi-Chain Support** - Single codebase deploying to 7 networks

## 🏗️ Architecture

The subgraph uses a **hybrid on-chain/off-chain architecture**:

### On-Chain Entities (Mutable)

**Core blockchain data stored directly from contract events:**

#### Agent Entity
```graphql
type Agent @entity(immutable: false) {
  id: ID!                    # "chainId:agentId"
  chainId: BigInt!           # Blockchain identifier
  agentId: BigInt!          # Agent ID on the chain
  agentURI: String          # Registration file URI
  agentURIType: String      # "ipfs", "arweave", "https", "http", "unknown"
  owner: Bytes!             # Agent owner address
  operators: [Bytes!]!      # Authorized operators
  createdAt: BigInt!
  updatedAt: BigInt!
  totalFeedback: BigInt!    # Computed feedback count
  lastActivity: BigInt!     # Last activity timestamp
  registrationFile: AgentRegistrationFile  # Link to off-chain data
  feedback: [Feedback!]!
  validations: [Validation!]!
  metadata: [AgentMetadata!]!
}
```

#### Feedback Entity
```graphql
type Feedback @entity(immutable: false) {
  id: ID!                    # "chainId:agentId:clientAddress:index"
  agent: Agent!
  clientAddress: Bytes!      # Feedback author
  score: Int!                # 0-100 score
  tag1: String              # Primary category tag
  tag2: String              # Secondary category tag
  feedbackUri: String        # URI for rich content (IPFS, Arweave, HTTPS, etc.)
  feedbackURIType: String
  feedbackHash: Bytes!
  isRevoked: Boolean!
  createdAt: BigInt!
  revokedAt: BigInt
  feedbackFile: FeedbackFile  # Link to off-chain data
  responses: [FeedbackResponse!]!
}
```

#### Validation Entity
```graphql
type Validation @entity(immutable: false) {
  id: ID!                    # requestHash
  agent: Agent!
  validatorAddress: Bytes!
  requestUri: String
  requestHash: Bytes!
  response: Int              # 0-100 score (0 = pending)
  responseUri: String
  responseHash: Bytes
  tag: String                # Human-readable validation tag
  status: ValidationStatus!  # PENDING, COMPLETED, EXPIRED
  createdAt: BigInt!
  updatedAt: BigInt!
}

enum ValidationStatus {
  PENDING
  COMPLETED
  EXPIRED
}
```

### Off-Chain Entities (Immutable from IPFS/Arweave)

**Rich metadata fetched from IPFS and Arweave URIs:**

#### AgentRegistrationFile
```graphql
type AgentRegistrationFile @entity(immutable: true) {
  id: ID!                    # Format: "transactionHash:cid"
  cid: String!               # IPFS CID or Arweave transaction ID
  agentId: String!          # "chainId:agentId"
  name: String              # Agent display name
  description: String        # Agent description
  image: String             # Profile image URL
  active: Boolean           # Is agent active
  x402support: Boolean      # Supports ERC-6551 payments
  supportedTrusts: [String!]!  # Trust models: "reputation", "cryptoeconomic", "tee-attestation"
  mcpEndpoint: String       # Model Context Protocol endpoint
  mcpVersion: String
  mcpTools: [String!]!      # Available MCP tools
  mcpPrompts: [String!]!    # Available MCP prompts
  mcpResources: [String!]!   # Available MCP resources
  a2aEndpoint: String       # Agent-to-Agent endpoint
  a2aVersion: String
  a2aSkills: [String!]!     # Available A2A skills
  ens: String               # ENS name
  did: String               # Decentralized identifier
  agentWallet: Bytes        # Agent wallet address
  agentWalletChainId: BigInt # Wallet chain ID
  createdAt: BigInt!
}
```

#### FeedbackFile
```graphql
type FeedbackFile @entity(immutable: true) {
  id: ID!                    # Format: "transactionHash:cid"
  cid: String!               # IPFS CID or Arweave transaction ID
  feedbackId: String!       # "chainId:agentId:clientAddress:index"
  text: String              # Detailed feedback text
  capability: String        # Capability being rated
  name: String             # Client name
  skill: String            # Skill being evaluated
  task: String             # Task context
  context: String          # Additional context
  proofOfPaymentFromAddress: String
  proofOfPaymentToAddress: String
  proofOfPaymentChainId: String
  proofOfPaymentTxHash: String
  tag1: String             # Fallback if on-chain tags empty
  tag2: String
  createdAt: BigInt!
}
```

### Analytics & Aggregation Entities

#### AgentStats
```graphql
type AgentStats @entity(immutable: false) {
  id: ID!                    # "chainId:agentId"
  agent: Agent!
  totalFeedback: BigInt!
  averageScore: BigDecimal!
  scoreDistribution: [Int!]! # [0-20, 21-40, 41-60, 61-80, 81-100]
  totalValidations: BigInt!
  completedValidations: BigInt!
  averageValidationScore: BigDecimal!
  lastActivity: BigInt!
  updatedAt: BigInt!
}
```

#### Protocol
```graphql
type Protocol @entity(immutable: false) {
  id: ID!                    # "chainId"
  chainId: BigInt!
  name: String!              # Chain name (e.g., "Ethereum", "Base")
  identityRegistry: Bytes!
  reputationRegistry: Bytes!
  validationRegistry: Bytes!
  totalAgents: BigInt!
  totalFeedback: BigInt!
  totalValidations: BigInt!
  agents: [Agent!]!
  tags: [String!]!
  updatedAt: BigInt!
}
```

#### GlobalStats
```graphql
type GlobalStats @entity(immutable: false) {
  id: ID!                    # "global"
  totalAgents: BigInt!
  totalFeedback: BigInt!
  totalValidations: BigInt!
  totalProtocols: BigInt!
  agents: [Agent!]!
  tags: [String!]!
  updatedAt: BigInt!
}
```

## 🔍 Query Examples

### Get Complete Agent Profile

```graphql
query GetCompleteAgentDetails($agentId: ID!) {
  agent(id: $agentId) {
    id
    chainId
    agentId
    owner
    agentURI
    createdAt
    updatedAt
    totalFeedback
    lastActivity
    
    registrationFile {
      name
      description
      image
      active
      x402support
      supportedTrusts
      mcpEndpoint
      mcpVersion
      mcpTools
      a2aEndpoint
      a2aVersion
      a2aSkills
      ens
      did
      agentWallet
      agentWalletChainId
    }
    
    feedback(where: { isRevoked: false }, first: 10) {
      score
      tag1
      tag2
      clientAddress
      createdAt
      feedbackFile {
        text
        capability
        skill
        task
        context
      }
      responses {
        responder
        createdAt
      }
    }
    
    validations(orderBy: createdAt, orderDirection: desc) {
      validatorAddress
      response
      status
      tag
      createdAt
    }
  }
}
```

### Find MCP-Compatible Agents

```graphql
query GetAllMCPAgents {
  agentRegistrationFiles(
    where: { mcpEndpoint_not: null, active: true }
    first: 100
  ) {
    id
    agentId
    name
    description
    mcpEndpoint
    mcpVersion
    mcpTools
    supportedTrusts
  }
}
```

### Search for High-Rated Feedback

```graphql
query GetHighRatedFeedback($minScore: Int!) {
  feedbacks(
    where: { isRevoked: false, score_gte: $minScore }
    first: 100
    orderBy: score
    orderDirection: desc
  ) {
    id
    score
    tag1
    tag2
    agent {
      id
      registrationFile {
        name
        description
      }
    }
    feedbackFile {
      text
      capability
      skill
    }
    responses {
      responder
      createdAt
    }
  }
}
```

### Find Agents by Trust Model

```graphql
query FindAgentsByTrustModel($trustModel: String!) {
  agentRegistrationFiles(
    where: { supportedTrusts_contains: [$trustModel], active: true }
    first: 50
  ) {
    agentId
    name
    description
    supportedTrusts
  }
}
```

### Get Global Statistics

```graphql
query GetProtocolStats {
  globalStats(id: "global") {
    totalAgents
    totalFeedback
    totalValidations
    totalProtocols
    tags
    updatedAt
  }
}
```

### Find Agents by Storage Protocol

```graphql
query GetArweaveAgents {
  agents(
    where: { agentURIType: "arweave" }
    first: 100
  ) {
    id
    agentURI
    agentURIType
    registrationFile {
      cid  # Arweave transaction ID
      name
      description
      mcpEndpoint
      a2aEndpoint
    }
  }
}
```

### Mixed Storage Query (IPFS + Arweave)

```graphql
query GetAllAgentsWithMetadata {
  agents(
    where: { agentURIType_in: ["ipfs", "arweave"] }
    first: 100
  ) {
    id
    agentURI
    agentURIType
    registrationFile {
      cid
      name
      description
      active
    }
  }
}
```

## 📁 File Data Sources (IPFS & Arweave)

The subgraph uses **File Data Sources** to parse off-chain content from multiple storage protocols:

### RegistrationFile Data Source

- **Handler**: `src/registration-file.ts` (unified handler for both IPFS and Arweave)
- **Trigger**: When `agentURI` is an IPFS or Arweave URI
- **Output**: `AgentRegistrationFile` entity
- **Data Parsed**: Metadata, capabilities, endpoints, identity information
- **Templates**:
  - `RegistrationFile` (kind: `file/ipfs`)
  - `ArweaveRegistrationFile` (kind: `file/arweave`)

### FeedbackFile Data Source

- **Handler**: `src/feedback-file.ts` (unified handler for both IPFS and Arweave)
- **Trigger**: When `feedbackUri` is an IPFS or Arweave URI
- **Output**: `FeedbackFile` entity
- **Data Parsed**: Detailed feedback text, proof of payment, context
- **Templates**:
  - `FeedbackFile` (kind: `file/ipfs`)
  - `ArweaveFeedbackFile` (kind: `file/arweave`)

### Supported URI Formats

The subgraph processes **IPFS and Arweave** URIs using file data sources:

- **IPFS**: `ipfs://QmHash...` or bare `QmHash...`
- **Arweave**: `ar://transactionId...`

HTTPS and HTTP URIs are detected and classified in the `agentURIType` field but are not currently processed by file data sources.

**Note:** The Graph Node automatically handles protocol-specific fetching. Both IPFS and Arweave templates call the same unified handler functions, which use shared JSON parsing utilities to ensure consistent data extraction regardless of storage protocol.

## 🔄 Data Flow

1. **On-chain Events** → Contract events trigger indexing
2. **URI Detection** → Subgraph detects IPFS and Arweave URIs and creates appropriate file data sources
3. **File Fetching** → The Graph Node fetches content via protocol-specific methods (IPFS gateways or Arweave gateways)
4. **Unified Parsing** → File Data Sources parse JSON using shared utility functions
5. **Entity Creation** → Immutable file entities created with protocol-agnostic schema
6. **Relationship Links** → On-chain entities link to file entities via derived fields
7. **Statistics Update** → Aggregate statistics computed and updated

## ⚙️ Configuration

### Contract Addresses

Addresses are managed in `src/contract-addresses.ts` for dynamic per-chain resolution.


## 🚀 Development

### Local Development

**Important:** Local development requires Docker. The old `graph node` CLI command is no longer supported. Use Docker Compose as described below.

**Prerequisites:**
- Docker and Docker Compose installed ([Get Docker](https://docs.docker.com/get-started/get-docker))

**Setup Steps:**

1. Start local Graph node, IPFS, and PostgreSQL using Docker Compose:
```bash
docker compose up -d
```

2. Wait for services to be ready (this may take a minute):
```bash
# Check service status
docker compose ps
```

3. Create local subgraph:
```bash
npm run create-local
```

4. Deploy locally:
```bash
npm run deploy-local
```

5. Query local endpoint:

```bash
# Simple query (just IDs)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ agents(first: 5) { id } }"}' \
  http://localhost:8000/subgraphs/name/agent0-sdk/agent0-sdk

# Complete query with agent name (note: name is in registrationFile, not directly on Agent)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ agents(first: 5) { id registrationFile { name description } } }"}' \
  http://localhost:8000/subgraphs/name/agent0-sdk/agent0-sdk
```

### Testing Queries

See `examples/queries.graphql` for comprehensive query examples:

- Complete agent profiles with relationships
- MCP/A2A protocol filtering
- Feedback analysis and search
- Global statistics and analytics
- Trust model filtering

## 📚 Additional Resources

- [ERC-8004 Specification](https://eips.ethereum.org/EIP-8004)
- [The Graph Documentation](https://thegraph.com/docs)

## 📄 License

Agent0 SDK is MIT-licensed public good brought to you by Marco De Rossi in collaboration with Consensys, 🦊 MetaMask and Agent0, Inc. We are looking for co-maintainers. Please reach out if you want to help.

Thanks also to Edge & Node (The Graph), Protocol Labs and Pinata for their support.
