import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { decodeEventLog, formatEther, keccak256, toBytes } from "viem";
import { identityRegistryAbi } from "../abis/IdentityRegistry.js";
import { reputationRegistryAbi } from "../abis/ReputationRegistry.js";
import { validationRegistryAbi } from "../abis/ValidationRegistry.js";
import { shopAbi } from "../abis/Shop.js";
import { getPublicClient, getWalletClient, getAccount } from "../client.js";
import { getConfig } from "../types.js";

function getRegistryAddresses() {
  return {
    identityRegistry: (process.env.COMMERCE_IDENTITY_REGISTRY || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    reputationRegistry: (process.env.COMMERCE_REPUTATION_REGISTRY || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    validationRegistry: (process.env.COMMERCE_VALIDATION_REGISTRY || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  };
}

export function registerERC8004Tools(server: McpServer) {
  server.tool(
    "register_agent",
    "Register as an agent in the ERC-8004 Identity Registry",
    {
      agentURI: z.string().describe("Agent URI (e.g. IPFS link to registration file)"),
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
        chain: walletClient.chain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let agentId: string | undefined;
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({ abi: identityRegistryAbi, data: log.data, topics: log.topics });
          if (event.eventName === "Registered") {
            agentId = (event.args as { agentId: bigint }).agentId.toString();
          }
        } catch {}
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, txHash: hash, agentId, blockNumber: receipt.blockNumber.toString() }, null, 2) }],
      };
    }
  );

  server.tool(
    "get_agent",
    "Get agent details by agentId from the Identity Registry",
    {
      agentId: z.string().describe("Agent ID"),
    },
    async ({ agentId }) => {
      const publicClient = getPublicClient();
      const { identityRegistry } = getRegistryAddresses();

      const [owner, tokenURI, wallet] = await Promise.all([
        publicClient.readContract({ address: identityRegistry, abi: identityRegistryAbi, functionName: "ownerOf", args: [BigInt(agentId)] }),
        publicClient.readContract({ address: identityRegistry, abi: identityRegistryAbi, functionName: "tokenURI", args: [BigInt(agentId)] }),
        publicClient.readContract({ address: identityRegistry, abi: identityRegistryAbi, functionName: "getAgentWallet", args: [BigInt(agentId)] }),
      ]);

      return {
        content: [{ type: "text", text: JSON.stringify({ agentId, owner, tokenURI, wallet }, null, 2) }],
      };
    }
  );

  server.tool(
    "give_feedback",
    "Leave feedback for an agent via the ERC-8004 Reputation Registry",
    {
      agentId: z.string().describe("Agent ID to leave feedback for"),
      value: z.number().int().describe("Feedback value (e.g. 1-5)"),
      valueDecimals: z.number().int().default(0).describe("Decimal places for value"),
      tag1: z.string().default("").describe("Primary tag (e.g. quality, delivery)"),
      tag2: z.string().default("").describe("Secondary tag"),
      feedbackURI: z.string().default("").describe("URI to detailed feedback"),
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
        args: [BigInt(agentId), BigInt(value), valueDecimals, tag1, tag2, "", feedbackURI, "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`],
        account,
        chain: walletClient.chain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, txHash: hash, blockNumber: receipt.blockNumber.toString() }, null, 2) }],
      };
    }
  );

  server.tool(
    "get_reputation",
    "Get reputation summary for an agent",
    {
      agentId: z.string().describe("Agent ID"),
      tag1: z.string().default("").describe("Filter by primary tag"),
      tag2: z.string().default("").describe("Filter by secondary tag"),
    },
    async ({ agentId, tag1, tag2 }) => {
      const publicClient = getPublicClient();
      const { reputationRegistry } = getRegistryAddresses();

      const [count, summaryValue, summaryValueDecimals] = await publicClient.readContract({
        address: reputationRegistry,
        abi: reputationRegistryAbi,
        functionName: "getSummary",
        args: [BigInt(agentId), [], tag1, tag2],
      }) as [bigint, bigint, number];

      const clients = await publicClient.readContract({
        address: reputationRegistry,
        abi: reputationRegistryAbi,
        functionName: "getClients",
        args: [BigInt(agentId)],
      });

      return {
        content: [{ type: "text", text: JSON.stringify({
          agentId,
          feedbackCount: count.toString(),
          summaryValue: summaryValue.toString(),
          summaryValueDecimals,
          uniqueClients: (clients as string[]).length,
        }, null, 2) }],
      };
    }
  );

  server.tool(
    "request_validation",
    "Request validation of an agent's work",
    {
      validatorAddress: z.string().describe("Validator's address"),
      agentId: z.string().describe("Agent ID to validate"),
      requestURI: z.string().describe("URI to validation request details"),
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
        args: [validatorAddress as `0x${string}`, BigInt(agentId), requestURI, requestHash],
        account,
        chain: walletClient.chain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, txHash: hash, requestHash, blockNumber: receipt.blockNumber.toString() }, null, 2) }],
      };
    }
  );

  server.tool(
    "deliver_digital",
    "Deliver digital goods for an order",
    {
      shopAddress: z.string().describe("Shop contract address"),
      orderId: z.string().describe("Order ID"),
      payload: z.string().describe("Digital delivery payload (hex-encoded or plain text)"),
    },
    async ({ shopAddress, orderId, payload }) => {
      const walletClient = getWalletClient();
      const publicClient = getPublicClient();
      const account = getAccount();

      const payloadBytes = toBytes(payload);

      const hash = await walletClient.writeContract({
        address: shopAddress as `0x${string}`,
        abi: shopAbi,
        functionName: "deliverDigital",
        args: [BigInt(orderId), payloadBytes],
        account,
        chain: walletClient.chain,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, txHash: hash, orderId, blockNumber: receipt.blockNumber.toString() }, null, 2) }],
      };
    }
  );
}
