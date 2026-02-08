"use client";

import { useReadContract } from "wagmi";
import { shopAbi, reputationRegistryConfig } from "@/lib/contracts";
import { Star } from "lucide-react";

export function ShopRatingSummary({ shopAddress }: { shopAddress: `0x${string}` }) {
  const { data: agentId } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "agentId",
  });

  const { data: summary } = useReadContract({
    ...reputationRegistryConfig,
    functionName: "getSummary",
    args: agentId ? [agentId as bigint, [], "starred", ""] : undefined,
    query: { enabled: !!agentId },
  });

  if (!summary) return null;
  const [count, summaryValue] = summary as [bigint, bigint, number];
  if (Number(count) === 0) return null;

  const avgScore = Number(summaryValue) / Number(count);
  const avgStars = Math.round(avgScore / 20);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < avgStars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
            }`}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        {avgScore.toFixed(0)}/100 · {Number(count)} review{Number(count) !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
