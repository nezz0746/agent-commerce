# Onchain Commerce Protocol

Fully onchain multi-tenant e-commerce protocol on Optimism. Create shops, list products, process orders, collect reviews — all onchain with protocol fees and [0xSplits](https://splits.org) integration.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CommerceHub                       │
│                (Factory Contract)                    │
│         Creates shop clones via ERC-1167            │
└──────────┬──────────┬──────────┬────────────────────┘
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
```

Each shop is an ERC-1167 minimal proxy clone deployed by `CommerceHub`. Shops manage their own products, orders, reviews, and discount codes independently while protocol fees flow back to the hub.

## Deployed Contracts (OP Sepolia)

| Contract | Address |
|----------|---------|
| **CommerceHub** | `0x479bcD43394867983d7dAE0b7280c251dFa0b935` |
| Astro Merch (shop) | `0x91674D02F80445079f1C5C576964F76ABf583379` |
| Onchain Coffee (shop) | `0x939BCe9559157Dfe60439F0dC62c942D84f7e209` |
| K's Workshop (shop) | `0x6591f0c9f7eb32c2014a8a90fe43f3ffda11df5a` |

**Subgraph:** [`https://api.studio.thegraph.com/query/958/onchain-commerce/v0.0.1`](https://api.studio.thegraph.com/query/958/onchain-commerce/v0.0.1)

**Frontend:** [`https://web-calm7uqky-adland.vercel.app`](https://web-calm7uqky-adland.vercel.app)

## Key Features

- **Multi-tenant shops** — Anyone can create a shop via CommerceHub
- **ERC-1167 clones** — Gas-efficient shop deployment using minimal proxies
- **Role-based access** — Owner, manager, and employee roles per shop
- **Product variants** — Products support multiple variants with independent pricing/stock
- **Collections & categories** — Organize products into categories and collections
- **Order lifecycle** — Create → Fulfill → Complete (or Cancel) with on-chain state tracking
- **Verified reviews** — Only customers with fulfilled orders can leave reviews
- **Discount codes** — Percentage-based discounts with usage limits and expiry
- **Payment splits** — 0xSplits integration for revenue sharing
- **Protocol fees** — Configurable fee collected on every order

## Monorepo Structure

```
onchain-commerce/
├── apps/
│   ├── contracts/       # Foundry smart contracts (Solidity)
│   └── web/             # Next.js 16 frontend
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
