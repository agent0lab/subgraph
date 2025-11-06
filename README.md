# Agent0 SDK Subgraph

A subgraph for indexing [ERC-8004](https://eips.ethereum.org/EIP-8004) Trustless Agents protocol data, providing GraphQL APIs for agent discovery, reputation tracking, and validation.

**Current Deployment:**
- **Network**: Ethereum Sepolia (Chain ID: 11155111)
- **Endpoint**: `https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT`

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- The Graph CLI: `npm install -g @graphprotocol/graph-cli`

### Installation

```bash
# Install dependencies
npm install

# Generate types from schema
npm run codegen

# Build the subgraph
npm run build
```

### Deploy

```bash
# Deploy to The Graph Network
npm run deploy

# Or deploy locally for testing
# See below for graph node & ipfs setup
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

**Note:** Currently deployed for Ethereum Sepolia only. Additional networks coming soon.

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
  feedbackUri: String        # IPFS/Arweave/HTTPS URI for rich content
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

**Rich metadata fetched from IPFS/Arweave/HTTPS URIs:**

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

- **Handler**: `src/registration-file.ts` (unified handler for all protocols)
- **Trigger**: When `agentURI` points to IPFS/Arweave/HTTPS content
- **Output**: `AgentRegistrationFile` entity
- **Data Parsed**: Metadata, capabilities, endpoints, identity information
- **Templates**:
  - `IPFSRegistrationFile` (kind: `file/ipfs`)
  - `ArweaveRegistrationFile` (kind: `file/arweave`)

### FeedbackFile Data Source

- **Handler**: `src/feedback-file.ts` (unified handler for all protocols)
- **Trigger**: When `feedbackUri` points to IPFS/Arweave/HTTPS content
- **Output**: `FeedbackFile` entity
- **Data Parsed**: Detailed feedback text, proof of payment, context
- **Templates**:
  - `IPFSFeedbackFile` (kind: `file/ipfs`)
  - `ArweaveFeedbackFile` (kind: `file/arweave`)

### Supported URI Formats

- **IPFS**: `ipfs://QmHash...` or bare `QmHash...`
- **Arweave**: `ar://transactionId...`
- **HTTPS**: `https://example.com/file.json`
- **HTTP**: `http://example.com/file.json`

**Note:** The Graph Node automatically handles protocol-specific fetching. Both IPFS and Arweave templates call the same unified handler functions, which use shared JSON parsing utilities to ensure consistent data extraction regardless of storage protocol.

## 🔄 Data Flow

1. **On-chain Events** → Contract events trigger indexing
2. **URI Detection** → Subgraph detects IPFS/Arweave/HTTPS URIs and creates appropriate file data sources
3. **File Fetching** → The Graph Node fetches content via protocol-specific methods (IPFS gateways, Arweave gateways, or HTTPS)
4. **Unified Parsing** → File Data Sources parse JSON using shared utility functions
5. **Entity Creation** → Immutable file entities created with protocol-agnostic schema
6. **Relationship Links** → On-chain entities link to file entities via derived fields
7. **Statistics Update** → Aggregate statistics computed and updated

## ⚙️ Configuration

### Contract Addresses

Addresses are managed in `src/contract-addresses.ts` for dynamic per-chain resolution.

### Supported Chains

**Currently Deployed:**
- **Ethereum Sepolia**: Chain ID 11155111
  - Endpoint: `https://gateway.thegraph.com/api/00a452ad3cd1900273ea62c1bf283f93/subgraphs/id/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT`

**Code Support (Not Yet Deployed):**
- **Base Sepolia**: Chain ID 84532
- **Linea Sepolia**: Chain ID 59141

To deploy for additional chains:
1. Ensure addresses are configured in `src/contract-addresses.ts`
2. Verify data sources exist in `subgraph.yaml`
3. Deploy to The Graph Network with appropriate network name

## 🚀 Development

### Local Development

Ensure that you have Docker installed and running on your machine: https://docs.docker.com/get-started/get-docker. This will come with the `docker compose` set of commands needed below.

```bash
# Start local Graph node using `compose.yml`
docker compose up -d

# Create local subgraph
npm run create-local

# Deploy locally
npm run deploy-local

# Query local endpoint
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ agents(first: 5) { id } }"}' \
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
