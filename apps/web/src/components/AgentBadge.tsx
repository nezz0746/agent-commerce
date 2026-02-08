"use client";

import { useShopAgentId, useAgentReputation } from "@/hooks/use-agent-identity";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Star } from "lucide-react";

/**
 * Compact agent badge for shop cards (marketplace list).
 * Shows a verified indicator + feedback count.
 */
export function AgentBadge({ shopAddress }: { shopAddress: `0x${string}` }) {
  const { data: agentId } = useShopAgentId(shopAddress);
  const id = agentId as bigint | undefined;

  if (!id || id === 0n) return null;

  return (
    <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
      <ShieldCheck className="h-3 w-3" />
      ERC-8004
    </Badge>
  );
}

/**
 * Detailed agent info panel for shop page.
 */
export function AgentInfoPanel({ shopAddress }: { shopAddress: `0x${string}` }) {
  const { data: agentId } = useShopAgentId(shopAddress);
  const id = agentId as bigint | undefined;

  const { data: reputation } = useAgentReputation(id);
  const rep = reputation as [bigint, bigint, number] | undefined;

  if (!id || id === 0n) return null;

  const feedbackCount = rep ? Number(rep[0]) : 0;
  const summaryValue = rep ? Number(rep[1]) : 0;
  const decimals = rep ? rep[2] : 0;
  const score = decimals > 0 ? summaryValue / Math.pow(10, decimals) : summaryValue;

  const scanUrl = `https://www.8004scan.io/agents/optimism-sepolia/${id.toString()}`;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <a
        href={scanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
      >
        <ShieldCheck className="h-4 w-4 text-green-500" />
        <span>Agent #{id.toString()}</span>
      </a>
      {feedbackCount > 0 && (
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-yellow-500" />
          {score > 0 ? `+${score}` : score} · {feedbackCount} review{feedbackCount !== 1 ? "s" : ""}
        </span>
      )}
      {feedbackCount === 0 && (
        <span className="text-xs">No reviews yet</span>
      )}
    </div>
  );
}
