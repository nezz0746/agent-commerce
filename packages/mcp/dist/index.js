#!/usr/bin/env node

// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// src/tools/read.ts
import { z } from "zod";

// src/types.ts
var DEFAULTS = {
  RPC_URL: "https://sepolia.optimism.io",
  HUB_ADDRESS: "0x479bcD43394867983d7dAE0b7280c251dFa0b935",
  SUBGRAPH_URL: "https://api.studio.thegraph.com/query/958/onchain-commerce/v0.0.1",
  CHAIN_ID: 11155420
};
function getConfig() {
  return {
    rpcUrl: process.env.COMMERCE_RPC_URL || DEFAULTS.RPC_URL,
    privateKey: process.env.COMMERCE_PRIVATE_KEY,
    hubAddress: process.env.COMMERCE_HUB_ADDRESS || DEFAULTS.HUB_ADDRESS,
    subgraphUrl: process.env.COMMERCE_SUBGRAPH_URL || DEFAULTS.SUBGRAPH_URL
  };
}

// src/subgraph.ts
async function query(q, variables) {
  const { subgraphUrl } = getConfig();
  const res = await fetch(subgraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join(", "));
  return json.data;
}
async function listShops() {
  return query(`{
    shops(first: 100) {
      id address owner name metadataURI createdAt
      products { id }
      orders { id }
    }
  }`);
}
async function getShop(address) {
  const id = address.toLowerCase();
  return query(
    `query($id: ID!) {
      shop(id: $id) {
        id address owner name metadataURI createdAt paymentSplitAddress
        products(first: 100) {
          id productId name price stock category { id name } metadataURI active
          variants { id variantId name price stock active }
        }
        categories(first: 100) { id categoryId name metadataURI active }
        collections(first: 100) { id collectionId name productIds metadataURI active }
        orders(first: 100, orderBy: createdAt, orderDirection: desc) {
          id orderId customer { address } totalAmount status createdAt
          items { product { productId name } variant { variantId name } quantity }
        }
        reviews(first: 100) { id reviewId rating metadataURI createdAt customer { address } order { orderId } }
        discounts(first: 100) { id discountId code basisPoints maxUses usedCount expiresAt active }
      }
    }`,
    { id }
  );
}
async function getProduct(shopAddress, productId) {
  const id = `${shopAddress.toLowerCase()}-${productId}`;
  return query(
    `query($id: ID!) {
      product(id: $id) {
        id productId name price stock category { id name } metadataURI active createdAt
        shop { address name }
        variants { id variantId name price stock active }
      }
    }`,
    { id }
  );
}
async function getOrders(customerAddress) {
  const id = customerAddress.toLowerCase();
  return query(
    `query($id: ID!) {
      customer(id: $id) {
        address
        orders(first: 100, orderBy: createdAt, orderDirection: desc) {
          id orderId shop { address name } totalAmount status createdAt
          items { product { productId name } variant { variantId name } quantity }
        }
        reviews { id reviewId rating shop { address name } order { orderId } }
      }
    }`,
    { id }
  );
}
async function searchProducts(searchName) {
  return query(
    `query($name: String!) {
      products(first: 50, where: { name_contains_nocase: $name, active: true }) {
        id productId name price stock metadataURI active
        shop { address name }
        category { name }
        variants { variantId name price stock active }
      }
    }`,
    { name: searchName }
  );
}
async function getProductPrices(shopAddress, items) {
  const productIds = [...new Set(items.map((i) => `${shopAddress.toLowerCase()}-${i.productId}`))];
  const data = await query(
    `query($ids: [ID!]!) {
      products(where: { id_in: $ids }) {
        id productId price
        variants { variantId price }
      }
    }`,
    { ids: productIds }
  );
  return data.products;
}

// src/tools/read.ts
function registerReadTools(server2) {
  server2.tool(
    "list_shops",
    "List all shops on the Onchain Commerce protocol",
    {},
    async () => {
      const data = await listShops();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server2.tool(
    "get_shop",
    "Get detailed shop info including products, categories, collections, orders, and reviews",
    { shopAddress: z.string().describe("Shop contract address") },
    async ({ shopAddress }) => {
      const data = await getShop(shopAddress);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server2.tool(
    "get_product",
    "Get product details with variants",
    {
      shopAddress: z.string().describe("Shop contract address"),
      productId: z.string().describe("Product ID")
    },
    async ({ shopAddress, productId }) => {
      const data = await getProduct(shopAddress, productId);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server2.tool(
    "get_orders",
    "Get all orders for a customer address",
    { customerAddress: z.string().describe("Customer wallet address") },
    async ({ customerAddress }) => {
      const data = await getOrders(customerAddress);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server2.tool(
    "search_products",
    "Search products by name across all shops",
    { query: z.string().describe("Search query for product name") },
    async ({ query: query2 }) => {
      const data = await searchProducts(query2);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}

// src/tools/write.ts
import { z as z2 } from "zod";
import { formatEther, decodeEventLog } from "viem";

// src/abis/Shop.ts
var shopAbi = [
  {
    type: "function",
    name: "createOrder",
    inputs: [
      {
        name: "items",
        type: "tuple[]",
        components: [
          { name: "productId", type: "uint256" },
          { name: "variantId", type: "uint256" },
          { name: "quantity", type: "uint256" }
        ]
      }
    ],
    outputs: [{ name: "orderId", type: "uint256" }],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "cancelOrder",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "fulfillOrder",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "leaveReview",
    inputs: [
      { name: "orderId", type: "uint256" },
      { name: "rating", type: "uint8" },
      { name: "_metadataURI", type: "string" }
    ],
    outputs: [{ name: "reviewId", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "createProduct",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_price", type: "uint256" },
      { name: "_stock", type: "uint256" },
      { name: "_categoryId", type: "uint256" },
      { name: "_metadataURI", type: "string" }
    ],
    outputs: [{ name: "productId", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "createCategory",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_metadataURI", type: "string" }
    ],
    outputs: [{ name: "categoryId", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "createDiscount",
    inputs: [
      { name: "code", type: "bytes32" },
      { name: "basisPoints", type: "uint256" },
      { name: "maxUses", type: "uint256" },
      { name: "expiresAt", type: "uint256" }
    ],
    outputs: [{ name: "discountId", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "products",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "price", type: "uint256" },
      { name: "stock", type: "uint256" },
      { name: "categoryId", type: "uint256" },
      { name: "metadataURI", type: "string" },
      { name: "active", type: "bool" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "variants",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "uint256" }
    ],
    outputs: [
      { name: "name", type: "string" },
      { name: "price", type: "uint256" },
      { name: "stock", type: "uint256" },
      { name: "active", type: "bool" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "OrderCreated",
    inputs: [
      { name: "orderId", type: "uint256", indexed: true },
      { name: "customer", type: "address", indexed: true },
      { name: "totalAmount", type: "uint256", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "OrderCancelled",
    inputs: [{ name: "orderId", type: "uint256", indexed: true }],
    anonymous: false
  },
  {
    type: "event",
    name: "OrderFulfilled",
    inputs: [{ name: "orderId", type: "uint256", indexed: true }],
    anonymous: false
  },
  {
    type: "event",
    name: "ReviewCreated",
    inputs: [
      { name: "reviewId", type: "uint256", indexed: true },
      { name: "orderId", type: "uint256", indexed: true },
      { name: "customer", type: "address", indexed: true },
      { name: "rating", type: "uint8", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "ProductCreated",
    inputs: [
      { name: "productId", type: "uint256", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "price", type: "uint256", indexed: false },
      { name: "stock", type: "uint256", indexed: false },
      { name: "categoryId", type: "uint256", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "CategoryCreated",
    inputs: [
      { name: "categoryId", type: "uint256", indexed: true },
      { name: "name", type: "string", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "DiscountCreated",
    inputs: [
      { name: "discountId", type: "uint256", indexed: true },
      { name: "code", type: "bytes32", indexed: false },
      { name: "basisPoints", type: "uint256", indexed: false },
      { name: "maxUses", type: "uint256", indexed: false },
      { name: "expiresAt", type: "uint256", indexed: false }
    ],
    anonymous: false
  }
];

// src/client.ts
import {
  createPublicClient,
  createWalletClient,
  http
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
var opSepolia = {
  id: 11155420,
  name: "OP Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia.optimism.io"] }
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://optimism-sepolia.blockscout.com" }
  },
  testnet: true
};
var _publicClient = null;
var _walletClient = null;
function getPublicClient() {
  if (!_publicClient) {
    const { rpcUrl } = getConfig();
    _publicClient = createPublicClient({
      chain: opSepolia,
      transport: http(rpcUrl)
    });
  }
  return _publicClient;
}
function getWalletClient() {
  if (!_walletClient) {
    const { rpcUrl, privateKey } = getConfig();
    if (!privateKey) {
      throw new Error(
        "COMMERCE_PRIVATE_KEY env var is required for write operations"
      );
    }
    const account = privateKeyToAccount(privateKey);
    _walletClient = createWalletClient({
      chain: opSepolia,
      transport: http(rpcUrl),
      account
    });
  }
  return _walletClient;
}
function getAccount() {
  const { privateKey } = getConfig();
  if (!privateKey) {
    throw new Error("COMMERCE_PRIVATE_KEY env var is required for write operations");
  }
  return privateKeyToAccount(privateKey);
}

// src/tools/write.ts
function registerWriteTools(server2) {
  server2.tool(
    "create_order",
    "Purchase items from a shop. Calculates total price from product/variant prices and sends ETH.",
    {
      shopAddress: z2.string().describe("Shop contract address"),
      items: z2.array(
        z2.object({
          productId: z2.string().describe("Product ID"),
          variantId: z2.string().describe("Variant ID (use '0' for no variant)"),
          quantity: z2.number().int().positive().describe("Quantity to purchase")
        })
      ).describe("Array of items to purchase")
    },
    async ({ shopAddress, items }) => {
      const publicClient = getPublicClient();
      const walletClient = getWalletClient();
      const account = getAccount();
      const products = await getProductPrices(shopAddress, items);
      let total = 0n;
      for (const item of items) {
        const product = products.find((p) => p.productId === item.productId);
        if (!product) throw new Error(`Product ${item.productId} not found`);
        let price;
        if (item.variantId !== "0") {
          const variant = product.variants.find(
            (v) => v.variantId === item.variantId
          );
          if (!variant) throw new Error(`Variant ${item.variantId} not found for product ${item.productId}`);
          price = BigInt(variant.price);
        } else {
          price = BigInt(product.price);
        }
        total += price * BigInt(item.quantity);
      }
      const orderItems = items.map((i) => ({
        productId: BigInt(i.productId),
        variantId: BigInt(i.variantId),
        quantity: BigInt(i.quantity)
      }));
      const hash = await walletClient.writeContract({
        address: shopAddress,
        abi: shopAbi,
        functionName: "createOrder",
        args: [orderItems],
        value: total,
        account,
        chain: walletClient.chain
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let orderId;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: shopAbi,
            data: log.data,
            topics: log.topics
          });
          if (event.eventName === "OrderCreated") {
            orderId = event.args.orderId.toString();
          }
        } catch {
        }
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              txHash: hash,
              orderId,
              totalPaid: formatEther(total) + " ETH",
              blockNumber: receipt.blockNumber.toString()
            }, null, 2)
          }
        ]
      };
    }
  );
  server2.tool(
    "cancel_order",
    "Cancel an order (if not yet fulfilled)",
    {
      shopAddress: z2.string().describe("Shop contract address"),
      orderId: z2.string().describe("Order ID to cancel")
    },
    async ({ shopAddress, orderId }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const hash = await walletClient.writeContract({
        address: shopAddress,
        abi: shopAbi,
        functionName: "cancelOrder",
        args: [BigInt(orderId)],
        account,
        chain: walletClient.chain
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              txHash: hash,
              orderId,
              blockNumber: receipt.blockNumber.toString()
            }, null, 2)
          }
        ]
      };
    }
  );
  server2.tool(
    "leave_review",
    "Leave a review for a fulfilled order (rating 1-5)",
    {
      shopAddress: z2.string().describe("Shop contract address"),
      orderId: z2.string().describe("Order ID to review"),
      rating: z2.number().int().min(1).max(5).describe("Rating from 1 to 5"),
      text: z2.string().describe("Review text (stored as metadataURI)")
    },
    async ({ shopAddress, orderId, rating, text }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const hash = await walletClient.writeContract({
        address: shopAddress,
        abi: shopAbi,
        functionName: "leaveReview",
        args: [BigInt(orderId), rating, text],
        account,
        chain: walletClient.chain
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let reviewId;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: shopAbi,
            data: log.data,
            topics: log.topics
          });
          if (event.eventName === "ReviewCreated") {
            reviewId = event.args.reviewId.toString();
          }
        } catch {
        }
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              txHash: hash,
              reviewId,
              blockNumber: receipt.blockNumber.toString()
            }, null, 2)
          }
        ]
      };
    }
  );
}

// src/tools/admin.ts
import { z as z3 } from "zod";
import { decodeEventLog as decodeEventLog2, parseEther as parseEther2, stringToHex } from "viem";

// src/abis/CommerceHub.ts
var commerceHubAbi = [
  {
    type: "function",
    name: "createShop",
    inputs: [
      { name: "name", type: "string" },
      { name: "metadataURI", type: "string" }
    ],
    outputs: [{ name: "shop", type: "address" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getShops",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "isShop",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "shopCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "protocolFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "ShopCreated",
    inputs: [
      { name: "shop", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false }
    ],
    anonymous: false
  }
];

// src/tools/admin.ts
function registerAdminTools(server2) {
  server2.tool(
    "create_shop",
    "Create a new shop via the CommerceHub",
    {
      name: z3.string().describe("Shop name"),
      metadataURI: z3.string().describe("Metadata URI for the shop")
    },
    async ({ name, metadataURI }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const { hubAddress } = getConfig();
      const hash = await walletClient.writeContract({
        address: hubAddress,
        abi: commerceHubAbi,
        functionName: "createShop",
        args: [name, metadataURI],
        account,
        chain: walletClient.chain
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let shopAddress;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog2({
            abi: commerceHubAbi,
            data: log.data,
            topics: log.topics
          });
          if (event.eventName === "ShopCreated") {
            shopAddress = event.args.shop;
          }
        } catch {
        }
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, txHash: hash, shopAddress, blockNumber: receipt.blockNumber.toString() }, null, 2)
        }]
      };
    }
  );
  server2.tool(
    "create_product",
    "Add a product to a shop",
    {
      shopAddress: z3.string().describe("Shop contract address"),
      name: z3.string().describe("Product name"),
      priceEth: z3.string().describe("Price in ETH (e.g. '0.01')"),
      stock: z3.number().int().nonnegative().describe("Initial stock"),
      categoryId: z3.string().default("0").describe("Category ID (0 for uncategorized)"),
      metadataURI: z3.string().default("").describe("Metadata URI")
    },
    async ({ shopAddress, name, priceEth, stock, categoryId, metadataURI }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const hash = await walletClient.writeContract({
        address: shopAddress,
        abi: shopAbi,
        functionName: "createProduct",
        args: [name, parseEther2(priceEth), BigInt(stock), BigInt(categoryId), metadataURI],
        account,
        chain: walletClient.chain
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let productId;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog2({ abi: shopAbi, data: log.data, topics: log.topics });
          if (event.eventName === "ProductCreated") {
            productId = event.args.productId.toString();
          }
        } catch {
        }
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, txHash: hash, productId, blockNumber: receipt.blockNumber.toString() }, null, 2)
        }]
      };
    }
  );
  server2.tool(
    "create_category",
    "Add a category to a shop",
    {
      shopAddress: z3.string().describe("Shop contract address"),
      name: z3.string().describe("Category name"),
      metadataURI: z3.string().default("").describe("Metadata URI")
    },
    async ({ shopAddress, name, metadataURI }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const hash = await walletClient.writeContract({
        address: shopAddress,
        abi: shopAbi,
        functionName: "createCategory",
        args: [name, metadataURI],
        account,
        chain: walletClient.chain
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let categoryId;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog2({ abi: shopAbi, data: log.data, topics: log.topics });
          if (event.eventName === "CategoryCreated") {
            categoryId = event.args.categoryId.toString();
          }
        } catch {
        }
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, txHash: hash, categoryId, blockNumber: receipt.blockNumber.toString() }, null, 2)
        }]
      };
    }
  );
  server2.tool(
    "fulfill_order",
    "Mark an order as fulfilled (shop owner/manager only)",
    {
      shopAddress: z3.string().describe("Shop contract address"),
      orderId: z3.string().describe("Order ID to fulfill")
    },
    async ({ shopAddress, orderId }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const hash = await walletClient.writeContract({
        address: shopAddress,
        abi: shopAbi,
        functionName: "fulfillOrder",
        args: [BigInt(orderId)],
        account,
        chain: walletClient.chain
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, txHash: hash, orderId, blockNumber: receipt.blockNumber.toString() }, null, 2)
        }]
      };
    }
  );
  server2.tool(
    "create_discount",
    "Create a discount code for a shop",
    {
      shopAddress: z3.string().describe("Shop contract address"),
      code: z3.string().describe("Discount code string"),
      basisPoints: z3.number().int().min(1).max(1e4).describe("Discount in basis points (100 = 1%)"),
      maxUses: z3.number().int().positive().describe("Maximum number of uses"),
      expiresAt: z3.number().int().describe("Expiry timestamp (unix seconds, 0 for no expiry)")
    },
    async ({ shopAddress, code, basisPoints, maxUses, expiresAt }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const codeHex = stringToHex(code, { size: 32 });
      const hash = await walletClient.writeContract({
        address: shopAddress,
        abi: shopAbi,
        functionName: "createDiscount",
        args: [codeHex, BigInt(basisPoints), BigInt(maxUses), BigInt(expiresAt)],
        account,
        chain: walletClient.chain
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let discountId;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog2({ abi: shopAbi, data: log.data, topics: log.topics });
          if (event.eventName === "DiscountCreated") {
            discountId = event.args.discountId.toString();
          }
        } catch {
        }
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, txHash: hash, discountId, code, blockNumber: receipt.blockNumber.toString() }, null, 2)
        }]
      };
    }
  );
}

// src/index.ts
var server = new McpServer({
  name: "onchain-commerce",
  version: "0.1.0"
});
registerReadTools(server);
registerWriteTools(server);
registerAdminTools(server);
var transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map