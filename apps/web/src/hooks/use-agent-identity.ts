import { useReadContract } from "wagmi";
import {
  commerceHubConfig,
  identityRegistryConfig,
  reputationRegistryConfig,
} from "@/lib/contracts";

/**
 * Get the ERC-8004 agent ID for a shop address.
 */
export function useShopAgentId(shopAddress: `0x${string}` | undefined) {
  return useReadContract({
    ...commerceHubConfig,
    functionName: "getShopAgentId",
    args: shopAddress ? [shopAddress] : undefined,
    query: { enabled: !!shopAddress },
  });
}

/**
 * Get the token URI (agent profile) for an agent ID.
 */
export function useAgentURI(agentId: bigint | undefined) {
  return useReadContract({
    ...identityRegistryConfig,
    functionName: "tokenURI",
    args: agentId ? [agentId] : undefined,
    query: { enabled: !!agentId && agentId > 0n },
  });
}

/**
 * Get the reputation summary for an agent (across all clients, no tag filter).
 */
export function useAgentReputation(agentId: bigint | undefined) {
  return useReadContract({
    ...reputationRegistryConfig,
    functionName: "getSummary",
    args: agentId ? [agentId, [], "", ""] : undefined,
    query: { enabled: !!agentId && agentId > 0n },
  });
}
