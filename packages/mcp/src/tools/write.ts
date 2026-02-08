import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseEther, formatEther, decodeEventLog } from "viem";
import { shopAbi } from "../abis/Shop.js";
import { getPublicClient, getWalletClient, getAccount } from "../client.js";
import { getProductPrices } from "../subgraph.js";

export function registerWriteTools(server: McpServer) {
  server.tool(
    "create_order",
    "Purchase items from a shop. Calculates total price from product/variant prices and sends ETH.",
    {
      shopAddress: z.string().describe("Shop contract address"),
      items: z
        .array(
          z.object({
            productId: z.string().describe("Product ID"),
            variantId: z.string().describe("Variant ID (use '0' for no variant)"),
            quantity: z.number().int().positive().describe("Quantity to purchase"),
          })
        )
        .describe("Array of items to purchase"),
    },
    async ({ shopAddress, items }) => {
      const publicClient = getPublicClient();
      const walletClient = getWalletClient();
      const account = getAccount();

      // Fetch prices from subgraph
      const products = await getProductPrices(shopAddress, items);

      // Calculate total
      let total = 0n;
      for (const item of items) {
        const product = products.find((p) => p.productId === item.productId);
        if (!product) throw new Error(`Product ${item.productId} not found`);

        let price: bigint;
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
        quantity: BigInt(i.quantity),
      }));

      const hash = await walletClient.writeContract({
        address: shopAddress as `0x${string}`,
        abi: shopAbi,
        functionName: "createOrder",
        args: [orderItems],
        value: total,
        account,
        chain: walletClient.chain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Extract order ID from event
      let orderId: string | undefined;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: shopAbi,
            data: log.data,
            topics: log.topics,
          });
          if (event.eventName === "OrderCreated") {
            orderId = (event.args as { orderId: bigint }).orderId.toString();
          }
        } catch {
          // not our event
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
              blockNumber: receipt.blockNumber.toString(),
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "cancel_order",
    "Cancel an order (if not yet fulfilled)",
    {
      shopAddress: z.string().describe("Shop contract address"),
      orderId: z.string().describe("Order ID to cancel"),
    },
    async ({ shopAddress, orderId }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();

      const hash = await walletClient.writeContract({
        address: shopAddress as `0x${string}`,
        abi: shopAbi,
        functionName: "cancelOrder",
        args: [BigInt(orderId)],
        account,
        chain: walletClient.chain,
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
              blockNumber: receipt.blockNumber.toString(),
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "leave_feedback",
    "Leave feedback for a fulfilled order via ERC-8004 Reputation Registry",
    {
      shopAddress: z.string().describe("Shop contract address"),
      orderId: z.string().describe("Order ID to leave feedback for"),
      value: z.number().int().describe("Feedback value (e.g. 1-5)"),
      valueDecimals: z.number().int().default(0).describe("Decimal places for value"),
      tag1: z.string().default("quality").describe("Feedback category (quality, delivery, accuracy)"),
      feedbackURI: z.string().default("").describe("URI to detailed feedback"),
    },
    async ({ shopAddress, orderId, value, valueDecimals, tag1, feedbackURI }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();

      const hash = await walletClient.writeContract({
        address: shopAddress as `0x${string}`,
        abi: shopAbi,
        functionName: "leaveFeedback",
        args: [BigInt(orderId), BigInt(value), valueDecimals, tag1, feedbackURI],
        account,
        chain: walletClient.chain,
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
              blockNumber: receipt.blockNumber.toString(),
            }, null, 2),
          },
        ],
      };
    }
  );
}
