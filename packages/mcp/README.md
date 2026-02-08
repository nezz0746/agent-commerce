# @onchain-commerce/mcp

MCP ([Model Context Protocol](https://modelcontextprotocol.io)) server that lets AI agents interact with the Onchain Commerce protocol. Browse shops, purchase products, manage inventory — all through natural language.

## Available Tools

### Read (Subgraph queries)

| Tool | Description |
|------|-------------|
| `list_shops` | List all shops on the protocol |
| `get_shop` | Get detailed shop info including products, categories, collections, orders, and reviews |
| `get_product` | Get product details with variants |
| `get_orders` | Get all orders for a customer address |
| `search_products` | Search products by name across all shops |

### Write (Onchain transactions)

| Tool | Description |
|------|-------------|
| `create_order` | Purchase items from a shop — calculates total price from product/variant prices and sends ETH |
| `cancel_order` | Cancel a pending order |
| `leave_review` | Leave a review on a fulfilled order (rating + text) |

### Admin (Shop management)

| Tool | Description |
|------|-------------|
| `create_shop` | Create a new shop via CommerceHub |
| `create_product` | Add a product to a shop with name, price, stock, and category |
| `create_category` | Create a product category in a shop |
| `fulfill_order` | Mark an order as fulfilled (owner/manager only) |
| `create_discount` | Create a discount code with basis points, max uses, and expiry |

## Configuration

Set the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `COMMERCE_RPC_URL` | OP Sepolia RPC endpoint | `https://sepolia.optimism.io` |
| `COMMERCE_PRIVATE_KEY` | Wallet private key for write operations | `0xabc...` |
| `COMMERCE_HUB_ADDRESS` | CommerceHub contract address | `0x479bcD43394867983d7dAE0b7280c251dFa0b935` |
| `COMMERCE_SUBGRAPH_URL` | Subgraph GraphQL endpoint | `https://api.studio.thegraph.com/query/958/onchain-commerce/v0.0.1` |

## Usage with Claude / MCP Clients

Add to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "onchain-commerce": {
      "command": "node",
      "args": ["/path/to/onchain-commerce/packages/mcp/dist/index.js"],
      "env": {
        "COMMERCE_RPC_URL": "https://sepolia.optimism.io",
        "COMMERCE_PRIVATE_KEY": "0x...",
        "COMMERCE_HUB_ADDRESS": "0x479bcD43394867983d7dAE0b7280c251dFa0b935",
        "COMMERCE_SUBGRAPH_URL": "https://api.studio.thegraph.com/query/958/onchain-commerce/v0.0.1"
      }
    }
  }
}
```

## Build & Run

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run (production)
pnpm start

# Run (development with hot reload)
pnpm dev
```

## Example Interactions

### Browse shops

```
User: "What shops are available?"
→ Tool call: list_shops()
→ Returns: List of all shops with names, addresses, and product counts
```

### Purchase a product

```
User: "Buy 2 units of product #1 from Astro Merch"
→ Tool call: create_order({
    shopAddress: "0x91674D02F80445079f1C5C576964F76ABf583379",
    items: [{ productId: "1", variantId: "0", quantity: 2 }]
  })
→ Returns: { success: true, txHash: "0x...", orderId: "5", totalPaid: "0.02 ETH" }
```

### Leave a review

```
User: "Leave a 5-star review on order #5 at Astro Merch"
→ Tool call: leave_review({
    shopAddress: "0x91674D02F80445079f1C5C576964F76ABf583379",
    orderId: "5",
    rating: 5,
    text: "Great products, fast fulfillment!"
  })
→ Returns: { success: true, txHash: "0x...", reviewId: "3" }
```

### Create a discount

```
User: "Create a 15% discount code SAVE15 for Onchain Coffee, max 100 uses"
→ Tool call: create_discount({
    shopAddress: "0x939BCe9559157Dfe60439F0dC62c942D84f7e209",
    code: "SAVE15",
    basisPoints: 1500,
    maxUses: 100,
    expiresAt: 0
  })
→ Returns: { success: true, txHash: "0x...", discountId: "1", code: "SAVE15" }
```

## License

MIT
