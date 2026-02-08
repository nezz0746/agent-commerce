"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { commerceHubConfig, shopAbi } from "@/lib/contracts";
import { shortenAddress } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Package, Store, Zap } from "lucide-react";

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
      <Card className="transition-colors hover:border-primary/50 hover:bg-card/80">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <CardTitle className="mt-3 text-lg">
            {(name as string) || "Loading..."}
          </CardTitle>
          <p className="font-mono text-xs text-muted-foreground">
            {shortenAddress(address)}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {count} {count === 1 ? "product" : "products"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ShopCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="mt-3 h-5 w-32" />
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-20" />
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
      <div className="space-y-2">
        <Badge variant="secondary" className="gap-1">
          <Zap className="h-3 w-3" />
          Powered by Optimism
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-muted-foreground">
          Discover onchain shops with trustless commerce
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <ShopCardSkeleton key={i} />
          ))}
        </div>
      ) : !shops || (shops as `0x${string}`[]).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Store className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">No shops yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Deploy contracts and seed data to get started.
            </p>
          </CardContent>
        </Card>
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
