import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { decodeEventLog, parseEther, stringToHex, padHex } from "viem";
import { shopAbi } from "../abis/Shop.js";
import { commerceHubAbi } from "../abis/CommerceHub.js";
import { getPublicClient, getWalletClient, getAccount } from "../client.js";
import { getConfig } from "../types.js";

export function registerAdminTools(server: McpServer) {
  server.tool(
    "create_shop",
    "Create a new shop via the CommerceHub",
    {
      name: z.string().describe("Shop name"),
      metadataURI: z.string().describe("Metadata URI for the shop"),
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
        chain: walletClient.chain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let shopAddress: string | undefined;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: commerceHubAbi,
            data: log.data,
            topics: log.topics,
          });
          if (event.eventName === "ShopCreated") {
            shopAddress = (event.args as { shop: string }).shop;
          }
        } catch {
          // not our event
        }
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, txHash: hash, shopAddress, blockNumber: receipt.blockNumber.toString() }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "create_product",
    "Add a product to a shop",
    {
      shopAddress: z.string().describe("Shop contract address"),
      name: z.string().describe("Product name"),
      priceEth: z.string().describe("Price in ETH (e.g. '0.01')"),
      stock: z.number().int().nonnegative().describe("Initial stock"),
      categoryId: z.string().default("0").describe("Category ID (0 for uncategorized)"),
      metadataURI: z.string().default("").describe("Metadata URI"),
    },
    async ({ shopAddress, name, priceEth, stock, categoryId, metadataURI }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();

      const hash = await walletClient.writeContract({
        address: shopAddress as `0x${string}`,
        abi: shopAbi,
        functionName: "createProduct",
        args: [name, parseEther(priceEth), BigInt(stock), BigInt(categoryId), metadataURI],
        account,
        chain: walletClient.chain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let productId: string | undefined;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({ abi: shopAbi, data: log.data, topics: log.topics });
          if (event.eventName === "ProductCreated") {
            productId = (event.args as { productId: bigint }).productId.toString();
          }
        } catch {}
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, txHash: hash, productId, blockNumber: receipt.blockNumber.toString() }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "create_category",
    "Add a category to a shop",
    {
      shopAddress: z.string().describe("Shop contract address"),
      name: z.string().describe("Category name"),
      metadataURI: z.string().default("").describe("Metadata URI"),
    },
    async ({ shopAddress, name, metadataURI }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();

      const hash = await walletClient.writeContract({
        address: shopAddress as `0x${string}`,
        abi: shopAbi,
        functionName: "createCategory",
        args: [name, metadataURI],
        account,
        chain: walletClient.chain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let categoryId: string | undefined;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({ abi: shopAbi, data: log.data, topics: log.topics });
          if (event.eventName === "CategoryCreated") {
            categoryId = (event.args as { categoryId: bigint }).categoryId.toString();
          }
        } catch {}
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, txHash: hash, categoryId, blockNumber: receipt.blockNumber.toString() }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "fulfill_order",
    "Mark an order as fulfilled (shop owner/manager only)",
    {
      shopAddress: z.string().describe("Shop contract address"),
      orderId: z.string().describe("Order ID to fulfill"),
    },
    async ({ shopAddress, orderId }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();

      const hash = await walletClient.writeContract({
        address: shopAddress as `0x${string}`,
        abi: shopAbi,
        functionName: "fulfillOrder",
        args: [BigInt(orderId)],
        account,
        chain: walletClient.chain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, txHash: hash, orderId, blockNumber: receipt.blockNumber.toString() }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "create_discount",
    "Create a discount code for a shop",
    {
      shopAddress: z.string().describe("Shop contract address"),
      code: z.string().describe("Discount code string"),
      basisPoints: z.number().int().min(1).max(10000).describe("Discount in basis points (100 = 1%)"),
      maxUses: z.number().int().positive().describe("Maximum number of uses"),
      expiresAt: z.number().int().describe("Expiry timestamp (unix seconds, 0 for no expiry)"),
    },
    async ({ shopAddress, code, basisPoints, maxUses, expiresAt }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();

      // Convert code string to bytes32
      const codeHex = stringToHex(code, { size: 32 });

      const hash = await walletClient.writeContract({
        address: shopAddress as `0x${string}`,
        abi: shopAbi,
        functionName: "createDiscount",
        args: [codeHex, BigInt(basisPoints), BigInt(maxUses), BigInt(expiresAt)],
        account,
        chain: walletClient.chain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let discountId: string | undefined;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({ abi: shopAbi, data: log.data, topics: log.topics });
          if (event.eventName === "DiscountCreated") {
            discountId = (event.args as { discountId: bigint }).discountId.toString();
          }
        } catch {}
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, txHash: hash, discountId, code, blockNumber: receipt.blockNumber.toString() }, null, 2),
        }],
      };
    }
  );
}
