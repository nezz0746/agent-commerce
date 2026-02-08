"use client";

import { useParams } from "next/navigation";
import { useReadContract } from "wagmi";
import { shopAbi } from "@/lib/contracts";
import Link from "next/link";
import { formatPrice, shortenAddress } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ShoppingBag } from "lucide-react";
import { useProductMetadata } from "@/hooks/use-product-metadata";
import { AgentInfoPanel } from "@/components/AgentBadge";
import Image from "next/image";

function ProductCard({
  shopAddress,
  productId,
}: {
  shopAddress: `0x${string}`;
  productId: number;
}) {
  const { data } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "products",
    args: [BigInt(productId)],
  });

  const parsed = data as [string, bigint, bigint, bigint, string, boolean] | undefined;
  const metadata = useProductMetadata(parsed?.[4] || undefined);

  if (!parsed) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  const [name, price, stock, , , active] = parsed;
  if (!active) return null;

  const stockLabel =
    Number(stock) === 0
      ? "Out of stock"
      : Number(stock) <= 5
      ? `Only ${Number(stock)} left`
      : `${Number(stock)} in stock`;

  return (
    <Link
      href={`/shop/${shopAddress}/product/${productId}`}
      className="group block"
    >
      <Card className="overflow-hidden transition-colors hover:border-primary/30">
        <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
          {metadata?.image ? (
            <Image
              src={metadata.image}
              alt={name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
          )}
          {Number(stock) === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <span className="text-xs font-medium text-muted-foreground">Sold out</span>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <p className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">
            {name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatPrice(price)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{stockLabel}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function CategoryBadge({
  shopAddress,
  categoryId,
}: {
  shopAddress: `0x${string}`;
  categoryId: number;
}) {
  const { data } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "categories",
    args: [BigInt(categoryId)],
  });

  if (!data) return null;
  const [name, , active] = data as [string, string, boolean];
  if (!active) return null;

  return (
    <span className="border px-2 py-0.5 text-xs text-muted-foreground">
      {name}
    </span>
  );
}

function CollectionSection({
  shopAddress,
  collectionId,
}: {
  shopAddress: `0x${string}`;
  collectionId: number;
}) {
  const { data } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "getCollection",
    args: [BigInt(collectionId)],
  });

  if (!data) return null;
  const collection = data as {
    name: string;
    productIds: bigint[];
    metadataURI: string;
    active: boolean;
  };
  if (!collection.active) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-medium">{collection.name}</h3>
        <span className="text-xs text-muted-foreground">
          {collection.productIds.length} items
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {collection.productIds.map((pid) => (
          <ProductCard
            key={pid.toString()}
            shopAddress={shopAddress}
            productId={Number(pid)}
          />
        ))}
      </div>
    </div>
  );
}

export default function ShopPage() {
  const params = useParams();
  const address = params.address as `0x${string}`;

  const { data: name } = useReadContract({
    address,
    abi: shopAbi,
    functionName: "name",
  });

  const { data: nextProductId } = useReadContract({
    address,
    abi: shopAbi,
    functionName: "nextProductId",
  });

  const { data: nextCategoryId } = useReadContract({
    address,
    abi: shopAbi,
    functionName: "nextCategoryId",
  });

  const { data: nextCollectionId } = useReadContract({
    address,
    abi: shopAbi,
    functionName: "nextCollectionId",
  });

  const productCount = nextProductId ? Number(nextProductId) - 1 : 0;
  const categoryCount = nextCategoryId ? Number(nextCategoryId) - 1 : 0;
  const collectionCount = nextCollectionId ? Number(nextCollectionId) - 1 : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {(name as string) || "Shop"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {shortenAddress(address)} &middot; {productCount} products
        </p>
        <AgentInfoPanel shopAddress={address} />
      </div>

      {/* Categories */}
      {categoryCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: categoryCount }, (_, i) => (
            <CategoryBadge
              key={i + 1}
              shopAddress={address}
              categoryId={i + 1}
            />
          ))}
        </div>
      )}

      {/* Collections */}
      {collectionCount > 0 && (
        <div className="space-y-8">
          {Array.from({ length: collectionCount }, (_, i) => (
            <CollectionSection
              key={i + 1}
              shopAddress={address}
              collectionId={i + 1}
            />
          ))}
          <Separator />
        </div>
      )}

      {/* All Products */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium">All Products</h2>
        {productCount === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No products available yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: productCount }, (_, i) => (
              <ProductCard
                key={i + 1}
                shopAddress={address}
                productId={i + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
