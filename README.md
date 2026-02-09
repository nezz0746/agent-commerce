![Agent Commerce](banner.png)

# Agent Commerce

Fully onchain multi-tenant e-commerce protocol on Optimism. Create shops, list products, process orders, collect reviews — all onchain with protocol fees and [0xSplits](https://splits.org) integration.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         CommerceHub                              │
│                      (Factory Contract)                          │
│               Creates shop clones via ERC-1167                   │
└──────┬──────────┬──────────┬─────────────────────────────────────┘
       │          │          │
 ┌─────▼──┐ ┌────▼───┐ ┌───▼────┐
 │  Shop  │ │  Shop  │ │  Shop  │   ← Minimal proxy clones
 └───┬────┘ └───┬────┘ └───┬────┘
     │          │          │
┌────┴────────┐ │    ┌─────┴──────┐
│ Products    │ │    │ Products   │
│ Orders      │ │    │ Orders     │
│ Reviews     │ │    │ Reviews    │
│ Discounts   │ │    │ Discounts  │
│ Categories  │ │    │ Categories │
└─────────────┘ │    └────────────┘
                ...

┌────────────────────┐   ┌─────────────────────┐
│ IdentityRegistry   │   │ ReputationRegistry  │
│ (ERC-8004)         │   │ (ERC-8004)          │
│ Agent NFTs & gating│   │ Feedback & ratings  │
└────────────────────┘   └─────────────────────┘
```

Each shop is an ERC-1167 minimal proxy clone deployed by `CommerceHub`. Shops manage their own products, orders, reviews, and discount codes independently while protocol fees flow back to the hub.

## Deployed Contracts (OP Sepolia)

| Contract | Address |
|----------|---------|
| **CommerceHub** | `0xb16e5DF039FD6Ed176fbcCF53fEcC890219EC718` |
| **IdentityRegistry** | `0x4F553f6cbD383E1e67F593F54727DAF8940b4263` |
| **ReputationRegistry** | `0x2b0041A16bEa71dDAaD5Da40Cc98A2926Cd00c25` |
| **ValidationRegistry** | `0x5B8D06Fa661e9CC4DEb5aE8e4C91C6cF1509C353` |
| **Shop Implementation** | `0x3186c203dFDEf953D9518Ebe91c544a42A3b9d21` |
| Astro Merch (shop) | `0x99A5f9Ea2424dcB8be7406F2151be0a417ffe15B` |
| Onchain Coffee (shop) | `0x410F81215E80EcCcB25F2B58702A98d5A87F5a0a` |
| K's Workshop (shop) | `0xdbf3dab155373113701630efae54ba5ff4068b82` |

**Subgraph:** [`https://api.studio.thegraph.com/query/958/onchain-commerce/v0.0.3`](https://api.studio.thegraph.com/query/958/onchain-commerce/v0.0.3)

**Frontend:** [`https://web-calm7uqky-adland.vercel.app`](https://web-calm7uqky-adland.vercel.app)

## ERC-8004 Identity Gating

Shop creation is gated behind [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) identity verification. Only addresses that hold an AgentIdentity NFT (`balanceOf > 0`) in the IdentityRegistry can call `createShop()`.

- **Base Mainnet Registry:** `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- The registry address is configurable via `setIdentityRegistry()` (onlyOwner) for multi-chain deployments
- Each shop also gets registered as an agent in the registry, with the NFT transferred to the shop owner

## Escrow

All orders use an escrow mechanism — funds are held by the shop contract until the order is fulfilled. If the seller doesn't fulfill within a configurable timeout (default: **7 days**), the customer can call `claimRefund()` to reclaim their funds automatically. Shop owners can adjust the escrow timeout via `setEscrowTimeout()`.

## Reputation (ERC-8004)

After an order is fulfilled, customers can call `leaveFeedback()` which writes to the **ReputationRegistry** (ERC-8004). Feedback is tagged with `starred` for star ratings, where the score (0–100) maps to a 1–5 star scale. This builds an onchain reputation for shops that any protocol or frontend can read.

## Key Features

- **Identity-gated shop creation** — Only registered ERC-8004 agents can create shops
- **Multi-tenant shops** — Registered agents can create a shop via CommerceHub
- **ERC-1167 clones** — Gas-efficient shop deployment using minimal proxies
- **Role-based access** — Owner, manager, and employee roles per shop
- **Product variants** — Products support multiple variants with independent pricing/stock
- **Collections & categories** — Organize products into categories and collections
- **Order lifecycle** — Create → Fulfill → Complete (or Cancel) with on-chain state tracking
- **Verified reviews** — Only customers with fulfilled orders can leave reviews
- **Discount codes** — Percentage-based discounts with usage limits and expiry
- **Payment splits** — 0xSplits integration for revenue sharing
- **Protocol fees** — Configurable fee collected on every order
- **Escrow** — Funds held until fulfillment, auto-refundable after timeout
- **Onchain reputation** — `leaveFeedback()` writes star ratings to ERC-8004 ReputationRegistry

## Monorepo Structure

```
onchain-commerce/
├── apps/
│   ├── contracts/       # Foundry smart contracts (Solidity)
│   └── web/             # Next.js 16 frontend (react-query + wagmi)
├── packages/
│   ├── subgraph/        # The Graph subgraph (indexing)
│   └── mcp/             # MCP server for AI agent interaction
```

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js ≥ 18
- pnpm

### Deploy Contracts

```bash
cd apps/contracts
cp .env.example .env   # Set RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY
forge build
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast --verify
```

### Seed Data

```bash
forge script script/Seed.s.sol --rpc-url $RPC_URL --broadcast
```

### Run Frontend

```bash
cd apps/web
cp .env.example .env.local   # Set NEXT_PUBLIC_* vars
pnpm install
pnpm dev
```

### Run Subgraph

```bash
cd packages/subgraph
pnpm install
pnpm codegen
pnpm build
pnpm deploy
```

### Run MCP Server

```bash
cd packages/mcp
pnpm install
pnpm build
pnpm start
```

See [`packages/mcp/README.md`](packages/mcp/README.md) for AI agent integration details.

## License

MIT
