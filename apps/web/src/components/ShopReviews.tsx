"use client";

import { useReviews } from "@/hooks/useSubgraph";
import { Star } from "lucide-react";

export function ShopRatingSummary({ shopAddress }: { shopAddress: `0x${string}` }) {
  const { data: reviews } = useReviews(shopAddress);

  if (!reviews || reviews.length === 0) return null;

  const avgScore = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
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
        {avgScore.toFixed(0)}/100 · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
