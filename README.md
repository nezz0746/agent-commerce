# Onchain Commerce

A fully onchain multi-tenant e-commerce protocol on Optimism.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  CommerceHub                     │
│  (Protocol singleton — deploys shops via clones) │
│                                                   │
│  • protocolFee (basis points)                     │
│  • protocolFeeRecipient                           │
│  • Shop registry                                  │
│  • createShop() → ERC-1167 minimal proxy          │
└───────────┬─────────────┬─────────────┬──────────┘
            │             │             │
     ┌──────▼──┐   ┌──────▼──┐   ┌──────▼──┐
     │  Shop A  │   │  Shop B  │   │  Shop C  │
     │ (clone)  │   │ (clone)  │   │ (clone)  │
     └──────────┘   └──────────┘   └──────────┘

Each Shop manages:
  • Products (with variants)
  • Categories & Collections
  • Orders (create → pay → fulfill → complete)
  • Discounts / Coupons
  • Reviews (verified purchase)
  • Employee roles (Owner / Manager / Employee)
  • Payment splits (0xSplits integration)
```

## Entity Relationships

```
Shop 1──* Product 1──* Variant
Shop 1──* Category 1──* Product
Shop 1──* Collection *──* Product
Shop 1──* Order 1──* OrderItem ──1 Product/Variant
Shop 1──* Employee
Shop 1──* Discount
Order 1──? Review
Customer 1──* Order
Customer 1──* Review
```

## Contracts

| Contract | Description |
|----------|-------------|
| `CommerceHub.sol` | Protocol singleton, shop factory (ERC-1167 clones) |
| `Shop.sol` | Per-shop contract with products, orders, reviews, discounts, roles |
| `ICommerceHub.sol` | Interface for hub fee queries |

## Order Lifecycle

```
Customer pays ETH → Order created (Paid)
  → Protocol fee sent to protocolFeeRecipient
  → Shop revenue sent to paymentSplitAddress (or owner)
  → Shop fulfills → Fulfilled
  → Customer can review (verified purchase)

Cancellation: Customer cancels before fulfillment → refunded (minus protocol fee)
Refund: Shop initiates refund → refunded (minus protocol fee)
```

## Roles (per Shop)

- **OWNER_ROLE**: Full control, assigns roles, sets payment split
- **MANAGER_ROLE**: Manage products/categories/collections, fulfill orders, manage discounts
- **EMPLOYEE_ROLE**: Fulfill orders, update shipping

## Development

```bash
cd apps/contracts

# Build
forge build

# Test
forge test -vv

# Deploy (set env vars first)
forge script script/Deploy.s.sol --rpc-url $OPTIMISM_RPC_URL --broadcast
```

### Environment Variables

```
PRIVATE_KEY=
OPTIMISM_RPC_URL=
PROTOCOL_FEE_RECIPIENT=
PROTOCOL_FEE_BPS=250
ETHERSCAN_API_KEY=
```

## Subgraph

The `packages/subgraph` directory contains a Graph Protocol subgraph for indexing all protocol events on Optimism.

```bash
cd packages/subgraph
npm install
npm run codegen
npm run build
```

## Tech Stack

- Solidity ^0.8.24
- Foundry
- OpenZeppelin (Clones, AccessControl, Pausable)
- The Graph (subgraph indexing)
- Target: Optimism (chain ID 10)
