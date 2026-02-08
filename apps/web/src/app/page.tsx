"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { commerceHubConfig, shopAbi } from "@/lib/contracts";
import { shortenAddress } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";
import { AgentBadge } from "@/components/AgentBadge";

function ShopCard({ address }: { address: `0x${string}` }) {
  const { data: name } = useReadContract({
    address,
    abi: shopAbi,
    functionName: "name",
  });

  const { data: productCount } = useReadContract({
    address,
    abi: shopAbi,
    functionName: "nextProductId",
  });

  const count = productCount ? Number(productCount) - 1 : 0;

  return (
    <Link href={`/shop/${address}`} className="group block">
      <Card className="transition-colors hover:border-primary/30">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium group-hover:text-primary transition-colors">
                {(name as string) || "Loading..."}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {shortenAddress(address)}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {count} {count === 1 ? "product" : "products"}
            </p>
            <AgentBadge shopAddress={address} />
          </div>
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
  const { data: shops, isLoading } = useReadContract({
    ...commerceHubConfig,
    functionName: "getShops",
  });

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
      ) : !shops || (shops as `0x${string}`[]).length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No shops yet. Deploy contracts and seed data to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(shops as `0x${string}`[]).map((addr) => (
            <ShopCard key={addr} address={addr} />
          ))}
        </div>
      )}
    </div>
  );
}
