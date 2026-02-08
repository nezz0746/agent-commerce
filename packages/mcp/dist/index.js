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
  },
  {
    type: "function",
    name: "deliverDigital",
    inputs: [
      { name: "orderId", type: "uint256" },
      { name: "payload", type: "bytes" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getDelivery",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "leaveFeedback",
    inputs: [
      { name: "orderId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "feedbackURI", type: "string" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "event",
    name: "DigitalDelivery",
    inputs: [
      { name: "orderId", type: "uint256", indexed: true },
      { name: "payload", type: "bytes", indexed: false }
    ]
  },
  {
    type: "event",
    name: "FeedbackLeft",
    inputs: [
      { name: "orderId", type: "uint256", indexed: true },
      { name: "customer", type: "address", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "value", type: "int128", indexed: false }
    ]
  },
  // Escrow
  {
    type: "function",
    name: "claimRefund",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "setEscrowTimeout",
    inputs: [{ name: "_timeout", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "escrowTimeout",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "orders",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "customer", type: "address" },
      { name: "totalAmount", type: "uint256" },
      { name: "protocolFeeAmount", type: "uint256" },
      { name: "escrowAmount", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint256" },
      { name: "shippingHash", type: "bytes32" }
    ],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "RefundClaimed",
    inputs: [
      { name: "orderId", type: "uint256", indexed: true },
      { name: "customer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "EscrowTimeoutUpdated",
    inputs: [
      { name: "newTimeout", type: "uint256", indexed: false }
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
    "leave_feedback",
    "Leave feedback for a fulfilled order via ERC-8004 Reputation Registry",
    {
      shopAddress: z2.string().describe("Shop contract address"),
      orderId: z2.string().describe("Order ID to leave feedback for"),
      value: z2.number().int().describe("Feedback value (e.g. 1-5)"),
      valueDecimals: z2.number().int().default(0).describe("Decimal places for value"),
      tag1: z2.string().default("quality").describe("Feedback category (quality, delivery, accuracy)"),
      feedbackURI: z2.string().default("").describe("URI to detailed feedback")
    },
    async ({ shopAddress, orderId, value, valueDecimals, tag1, feedbackURI }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const hash = await walletClient.writeContract({
        address: shopAddress,
        abi: shopAbi,
        functionName: "leaveFeedback",
        args: [BigInt(orderId), BigInt(value), valueDecimals, tag1, feedbackURI],
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

// src/tools/erc8004.ts
import { z as z4 } from "zod";
import { decodeEventLog as decodeEventLog3, keccak256, toBytes } from "viem";

// src/abis/IdentityRegistry.ts
var identityRegistryAbi = [
  {
    type: "function",
    name: "register",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "setAgentURI",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getMetadata",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" }
    ],
    outputs: [{ name: "", type: "bytes" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getAgentWallet",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "agentURI", type: "string", indexed: false }
    ]
  }
];

// src/abis/ReputationRegistry.ts
var reputationRegistryAbi = [
  {
    type: "function",
    name: "giveFeedback",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getSummary",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddresses", type: "address[]" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" }
    ],
    outputs: [
      { name: "count", type: "uint256" },
      { name: "summaryValue", type: "int256" },
      { name: "summaryValueDecimals", type: "uint8" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getClients",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "NewFeedback",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "clientAddress", type: "address", indexed: true },
      { name: "feedbackIndex", type: "uint64", indexed: false },
      { name: "value", type: "int128", indexed: false },
      { name: "valueDecimals", type: "uint8", indexed: false },
      { name: "tag1", type: "string", indexed: false },
      { name: "tag2", type: "string", indexed: false }
    ]
  }
];

// src/abis/ValidationRegistry.ts
var validationRegistryAbi = [
  {
    type: "function",
    name: "validationRequest",
    inputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "requestURI", type: "string" },
      { name: "requestHash", type: "bytes32" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getValidationStatus",
    inputs: [{ name: "requestHash", type: "bytes32" }],
    outputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "response", type: "uint8" },
      { name: "responseHash", type: "bytes32" },
      { name: "tag", type: "string" },
      { name: "lastUpdate", type: "uint256" }
    ],
    stateMutability: "view"
  },
  {
    type: "event",
    name: "ValidationRequested",
    inputs: [
      { name: "requestHash", type: "bytes32", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "validatorAddress", type: "address", indexed: true },
      { name: "requestURI", type: "string", indexed: false }
    ]
  }
];

// src/tools/erc8004.ts
function getRegistryAddresses() {
  return {
    identityRegistry: process.env.COMMERCE_IDENTITY_REGISTRY || "0x0000000000000000000000000000000000000000",
    reputationRegistry: process.env.COMMERCE_REPUTATION_REGISTRY || "0x0000000000000000000000000000000000000000",
    validationRegistry: process.env.COMMERCE_VALIDATION_REGISTRY || "0x0000000000000000000000000000000000000000"
  };
}
function registerERC8004Tools(server2) {
  server2.tool(
    "register_agent",
    "Register as an agent in the ERC-8004 Identity Registry",
    {
      agentURI: z4.string().describe("Agent URI (e.g. IPFS link to registration file)")
    },
    async ({ agentURI }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const { identityRegistry } = getRegistryAddresses();
      const hash = await walletClient.writeContract({
        address: identityRegistry,
        abi: identityRegistryAbi,
        functionName: "register",
        args: [agentURI],
        account,
        chain: walletClient.chain
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      let agentId;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog3({ abi: identityRegistryAbi, data: log.data, topics: log.topics });
          if (event.eventName === "Registered") {
            agentId = event.args.agentId.toString();
          }
        } catch {
        }
      }
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, txHash: hash, agentId, blockNumber: receipt.blockNumber.toString() }, null, 2) }]
      };
    }
  );
  server2.tool(
    "get_agent",
    "Get agent details by agentId from the Identity Registry",
    {
      agentId: z4.string().describe("Agent ID")
    },
    async ({ agentId }) => {
      const publicClient = getPublicClient();
      const { identityRegistry } = getRegistryAddresses();
      const [owner, tokenURI, wallet] = await Promise.all([
        publicClient.readContract({ address: identityRegistry, abi: identityRegistryAbi, functionName: "ownerOf", args: [BigInt(agentId)] }),
        publicClient.readContract({ address: identityRegistry, abi: identityRegistryAbi, functionName: "tokenURI", args: [BigInt(agentId)] }),
        publicClient.readContract({ address: identityRegistry, abi: identityRegistryAbi, functionName: "getAgentWallet", args: [BigInt(agentId)] })
      ]);
      return {
        content: [{ type: "text", text: JSON.stringify({ agentId, owner, tokenURI, wallet }, null, 2) }]
      };
    }
  );
  server2.tool(
    "give_feedback",
    "Leave feedback for an agent via the ERC-8004 Reputation Registry",
    {
      agentId: z4.string().describe("Agent ID to leave feedback for"),
      value: z4.number().int().describe("Feedback value (e.g. 1-5)"),
      valueDecimals: z4.number().int().default(0).describe("Decimal places for value"),
      tag1: z4.string().default("").describe("Primary tag (e.g. quality, delivery)"),
      tag2: z4.string().default("").describe("Secondary tag"),
      feedbackURI: z4.string().default("").describe("URI to detailed feedback")
    },
    async ({ agentId, value, valueDecimals, tag1, tag2, feedbackURI }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const { reputationRegistry } = getRegistryAddresses();
      const hash = await walletClient.writeContract({
        address: reputationRegistry,
        abi: reputationRegistryAbi,
        functionName: "giveFeedback",
        args: [BigInt(agentId), BigInt(value), valueDecimals, tag1, tag2, "", feedbackURI, "0x0000000000000000000000000000000000000000000000000000000000000000"],
        account,
        chain: walletClient.chain
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, txHash: hash, blockNumber: receipt.blockNumber.toString() }, null, 2) }]
      };
    }
  );
  server2.tool(
    "get_reputation",
    "Get reputation summary for an agent",
    {
      agentId: z4.string().describe("Agent ID"),
      tag1: z4.string().default("").describe("Filter by primary tag"),
      tag2: z4.string().default("").describe("Filter by secondary tag")
    },
    async ({ agentId, tag1, tag2 }) => {
      const publicClient = getPublicClient();
      const { reputationRegistry } = getRegistryAddresses();
      const [count, summaryValue, summaryValueDecimals] = await publicClient.readContract({
        address: reputationRegistry,
        abi: reputationRegistryAbi,
        functionName: "getSummary",
        args: [BigInt(agentId), [], tag1, tag2]
      });
      const clients = await publicClient.readContract({
        address: reputationRegistry,
        abi: reputationRegistryAbi,
        functionName: "getClients",
        args: [BigInt(agentId)]
      });
      return {
        content: [{ type: "text", text: JSON.stringify({
          agentId,
          feedbackCount: count.toString(),
          summaryValue: summaryValue.toString(),
          summaryValueDecimals,
          uniqueClients: clients.length
        }, null, 2) }]
      };
    }
  );
  server2.tool(
    "request_validation",
    "Request validation of an agent's work",
    {
      validatorAddress: z4.string().describe("Validator's address"),
      agentId: z4.string().describe("Agent ID to validate"),
      requestURI: z4.string().describe("URI to validation request details")
    },
    async ({ validatorAddress, agentId, requestURI }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const { validationRegistry } = getRegistryAddresses();
      const requestHash = keccak256(toBytes(requestURI + Date.now().toString()));
      const hash = await walletClient.writeContract({
        address: validationRegistry,
        abi: validationRegistryAbi,
        functionName: "validationRequest",
        args: [validatorAddress, BigInt(agentId), requestURI, requestHash],
        account,
        chain: walletClient.chain
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, txHash: hash, requestHash, blockNumber: receipt.blockNumber.toString() }, null, 2) }]
      };
    }
  );
  server2.tool(
    "deliver_digital",
    "Deliver digital goods for an order",
    {
      shopAddress: z4.string().describe("Shop contract address"),
      orderId: z4.string().describe("Order ID"),
      payload: z4.string().describe("Digital delivery payload (hex-encoded or plain text)")
    },
    async ({ shopAddress, orderId, payload }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const payloadBytes = toBytes(payload);
      const hash = await walletClient.writeContract({
        address: shopAddress,
        abi: shopAbi,
        functionName: "deliverDigital",
        args: [BigInt(orderId), payloadBytes],
        account,
        chain: walletClient.chain
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, txHash: hash, orderId, blockNumber: receipt.blockNumber.toString() }, null, 2) }]
      };
    }
  );
}

// src/tools/escrow.ts
import { z as z5 } from "zod";
import { formatEther as formatEther3 } from "viem";
var ORDER_STATUS_LABELS = {
  0: "Created",
  1: "Paid",
  2: "Fulfilled",
  3: "Completed",
  4: "Cancelled",
  5: "Refunded"
};
function registerEscrowTools(server2) {
  server2.tool(
    "claim_refund",
    "Claim a refund for an order after the escrow timeout has expired. Only the customer who placed the order can claim.",
    {
      shopAddress: z5.string().describe("Shop contract address"),
      orderId: z5.string().describe("Order ID to claim refund for")
    },
    async ({ shopAddress, orderId }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const hash = await walletClient.writeContract({
        address: shopAddress,
        abi: shopAbi,
        functionName: "claimRefund",
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
    "set_escrow_timeout",
    "Set the escrow timeout duration for the shop. Only the shop owner can call this. Minimum is 1 day (86400 seconds).",
    {
      shopAddress: z5.string().describe("Shop contract address"),
      timeoutSeconds: z5.number().int().positive().describe("Escrow timeout in seconds (minimum 86400 = 1 day)")
    },
    async ({ shopAddress, timeoutSeconds }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();
      const hash = await walletClient.writeContract({
        address: shopAddress,
        abi: shopAbi,
        functionName: "setEscrowTimeout",
        args: [BigInt(timeoutSeconds)],
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
              timeoutSeconds,
              blockNumber: receipt.blockNumber.toString()
            }, null, 2)
          }
        ]
      };
    }
  );
  server2.tool(
    "get_escrow_status",
    "Get escrow information for an order, including amount held, order status, timestamps, and whether a refund is currently claimable.",
    {
      shopAddress: z5.string().describe("Shop contract address"),
      orderId: z5.string().describe("Order ID to check")
    },
    async ({ shopAddress, orderId }) => {
      const publicClient = getPublicClient();
      const addr = shopAddress;
      const [order, timeout] = await Promise.all([
        publicClient.readContract({
          address: addr,
          abi: shopAbi,
          functionName: "orders",
          args: [BigInt(orderId)]
        }),
        publicClient.readContract({
          address: addr,
          abi: shopAbi,
          functionName: "escrowTimeout"
        })
      ]);
      const [customer, totalAmount, protocolFeeAmount, escrowAmount, status, createdAt, shippingHash] = order;
      const escrowTimeoutSeconds = timeout;
      const now = BigInt(Math.floor(Date.now() / 1e3));
      const expiresAt = createdAt + escrowTimeoutSeconds;
      const isRefundClaimable = status === 1 && now >= expiresAt && escrowAmount > 0n;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              orderId,
              customer,
              totalAmount: formatEther3(totalAmount) + " ETH",
              escrowAmount: formatEther3(escrowAmount) + " ETH",
              protocolFeeAmount: formatEther3(protocolFeeAmount) + " ETH",
              status: ORDER_STATUS_LABELS[status] ?? `Unknown(${status})`,
              statusCode: status,
              createdAt: createdAt.toString(),
              escrowTimeoutSeconds: escrowTimeoutSeconds.toString(),
              expiresAt: expiresAt.toString(),
              isRefundClaimable
            }, null, 2)
          }
        ]
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
registerERC8004Tools(server);
registerEscrowTools(server);
var transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map