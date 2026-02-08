import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatEther } from "viem";
import { shopAbi } from "../abis/Shop.js";
import { getPublicClient, getWalletClient, getAccount } from "../client.js";

const ORDER_STATUS_LABELS: Record<number, string> = {
  0: "Created",
  1: "Paid",
  2: "Fulfilled",
  3: "Completed",
  4: "Cancelled",
  5: "Refunded",
};

export function registerEscrowTools(server: McpServer) {
  server.tool(
    "claim_refund",
    "Claim a refund for an order after the escrow timeout has expired. Only the customer who placed the order can claim.",
    {
      shopAddress: z.string().describe("Shop contract address"),
      orderId: z.string().describe("Order ID to claim refund for"),
    },
    async ({ shopAddress, orderId }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();

      const hash = await walletClient.writeContract({
        address: shopAddress as `0x${string}`,
        abi: shopAbi,
        functionName: "claimRefund",
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
    "set_escrow_timeout",
    "Set the escrow timeout duration for the shop. Only the shop owner can call this. Minimum is 1 day (86400 seconds).",
    {
      shopAddress: z.string().describe("Shop contract address"),
      timeoutSeconds: z.number().int().positive().describe("Escrow timeout in seconds (minimum 86400 = 1 day)"),
    },
    async ({ shopAddress, timeoutSeconds }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();

      const hash = await walletClient.writeContract({
        address: shopAddress as `0x${string}`,
        abi: shopAbi,
        functionName: "setEscrowTimeout",
        args: [BigInt(timeoutSeconds)],
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
              timeoutSeconds,
              blockNumber: receipt.blockNumber.toString(),
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    "get_escrow_status",
    "Get escrow information for an order, including amount held, order status, timestamps, and whether a refund is currently claimable.",
    {
      shopAddress: z.string().describe("Shop contract address"),
      orderId: z.string().describe("Order ID to check"),
    },
    async ({ shopAddress, orderId }) => {
      const publicClient = getPublicClient();
      const addr = shopAddress as `0x${string}`;

      const [order, timeout] = await Promise.all([
        publicClient.readContract({
          address: addr,
          abi: shopAbi,
          functionName: "orders",
          args: [BigInt(orderId)],
        }),
        publicClient.readContract({
          address: addr,
          abi: shopAbi,
          functionName: "escrowTimeout",
        }),
      ]);

      const [customer, totalAmount, protocolFeeAmount, escrowAmount, status, createdAt, shippingHash] = order as [
        string, bigint, bigint, bigint, number, bigint, string
      ];

      const escrowTimeoutSeconds = timeout as bigint;
      const now = BigInt(Math.floor(Date.now() / 1000));
      const expiresAt = createdAt + escrowTimeoutSeconds;
      const isRefundClaimable = status === 1 && now >= expiresAt && escrowAmount > 0n;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              orderId,
              customer,
              totalAmount: formatEther(totalAmount) + " ETH",
              escrowAmount: formatEther(escrowAmount) + " ETH",
              protocolFeeAmount: formatEther(protocolFeeAmount) + " ETH",
              status: ORDER_STATUS_LABELS[status] ?? `Unknown(${status})`,
              statusCode: status,
              createdAt: createdAt.toString(),
              escrowTimeoutSeconds: escrowTimeoutSeconds.toString(),
              expiresAt: expiresAt.toString(),
              isRefundClaimable,
            }, null, 2),
          },
        ],
      };
    }
  );
}
