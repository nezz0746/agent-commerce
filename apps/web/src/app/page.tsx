"use client";

import Link from "next/link";
import { useShops } from "@/hooks/useSubgraph";
import { shortenAddress } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ShieldCheck, Star } from "lucide-react";
import type { SubgraphShop, SubgraphReview } from "@/lib/subgraph";

function getReviewStats(shop: any) {
  // Use feedbacks from ReputationRegistry (mapped by agentId)
  const feedbacks = shop._feedbacks as { value: string; tag1: string; clientAddress: string }[] | undefined;
  if (!feedbacks || feedbacks.length === 0) return null;
  const starredFeedbacks = feedbacks.filter((fb) => fb.tag1 === "starred");
  if (starredFeedbacks.length === 0) return null;
  const avg = starredFeedbacks.reduce((s, fb) => s + Number(fb.value), 0) / starredFeedbacks.length;
  // value is 0-100, convert to 0-5
  return { avg: Math.round((avg / 20) * 10) / 10, count: starredFeedbacks.length, feedbacks: starredFeedbacks };
}

function ShopCard({ shop }: { shop: SubgraphShop }) {
  const productCount = shop.products?.length ?? 0;
  const stats = getReviewStats(shop);
  const hasAgent = shop.agentId && shop.agentId !== "0";

  return (
    <Link href={`/shop/${shop.address}`} className="group block">
      <Card className="transition-colors hover:border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium group-hover:text-primary transition-colors">
                {shop.name || "Unnamed Shop"}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {shortenAddress(shop.address)}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {productCount} {productCount === 1 ? "product" : "products"}
            </p>
            {stats && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {stats.avg}/5 · {stats.count} review{stats.count !== 1 ? "s" : ""}
              </span>
            )}
            {hasAgent && (
              <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
                <ShieldCheck className="h-3 w-3" />
                ERC-8004
              </Badge>
            )}
          </div>
          {stats && stats.feedbacks && stats.feedbacks.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t pt-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Recent Reviews</p>
              {stats.feedbacks.slice(0, 3).map((fb: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`h-2.5 w-2.5 ${
                          i < Math.round(Number(fb.value) / 20)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground/20"
                        }`}
                      />
                    ))}
                  </span>
                  <span className="font-mono">{shortenAddress(fb.clientAddress)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function ShopCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { data: shops, isLoading } = useShops();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Marketplace</h1>
        <p className="text-sm text-muted-foreground">
          Discover onchain shops
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <ShopCardSkeleton key={i} />
          ))}
        </div>
      ) : !shops || shops.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No shops yet. Deploy contracts and seed data to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </div>
  );
}
