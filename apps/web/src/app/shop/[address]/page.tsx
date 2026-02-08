"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { formatPrice, shortenAddress } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ShoppingBag, Star } from "lucide-react";
import { useProductMetadata } from "@/hooks/use-product-metadata";
import { AgentInfoPanel } from "@/components/AgentBadge";
import { useShop } from "@/hooks/useSubgraph";
import type { SubgraphProduct, SubgraphReview } from "@/lib/subgraph";
import Image from "next/image";

function ProductCard({
  product,
  shopAddress,
}: {
  product: SubgraphProduct;
  shopAddress: string;
}) {
  const metadata = useProductMetadata(product.metadataURI || undefined);
  if (!product.active) return null;

  const stock = Number(product.stock);
  const stockLabel =
    stock === 0
      ? "Out of stock"
      : stock <= 5
      ? `Only ${stock} left`
      : `${stock} in stock`;

  return (
    <Link
      href={`/shop/${shopAddress}/product/${product.productId}`}
      className="group block"
    >
      <Card className="overflow-hidden transition-colors hover:border-primary/30">
        <div className="relative aspect-square bg-muted flex items-center justify-center overflow-hidden">
          {metadata?.image ? (
            <Image
              src={metadata.image}
              alt={product.name}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
          ) : (
            <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
          )}
          {stock === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <span className="text-xs font-medium text-muted-foreground">Sold out</span>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <p className="text-sm font-medium leading-tight group-hover:text-primary transition-colors">
            {product.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatPrice(BigInt(product.price))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{stockLabel}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function ReviewsList({ reviews }: { reviews: SubgraphReview[] }) {
  if (!reviews || reviews.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Reviews ({reviews.length})</h2>
      <div className="space-y-3">
        {reviews.map((review) => {
          const stars = Math.round(review.rating / 20);
          return (
            <Card key={review.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < stars
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {shortenAddress(review.customer.address)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(Number(review.createdAt) * 1000).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Order #{review.order.orderId}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function RatingSummary({ reviews }: { reviews: SubgraphReview[] }) {
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

export default function ShopPage() {
  const params = useParams();
  const address = params.address as string;
  const { data: shop, isLoading } = useShop(address);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="mt-3 h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="mx-auto max-w-5xl py-16 text-center">
        <p className="text-sm text-muted-foreground">Shop not found.</p>
      </div>
    );
  }

  const activeProducts = shop.products?.filter((p) => p.active) ?? [];
  const activeCategories = shop.categories?.filter((c) => c.active) ?? [];
  const activeCollections = shop.collections?.filter((c) => c.active) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {shop.name || "Shop"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {shortenAddress(shop.address)} &middot; {activeProducts.length} products
        </p>
        <RatingSummary reviews={shop.reviews} />
        <AgentInfoPanel shopAddress={shop.address as `0x${string}`} />
      </div>

      {/* Categories */}
      {activeCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeCategories.map((cat) => (
            <span key={cat.id} className="border px-2 py-0.5 text-xs text-muted-foreground">
              {cat.name}
            </span>
          ))}
        </div>
      )}

      {/* Collections */}
      {activeCollections.length > 0 && (
        <div className="space-y-8">
          {activeCollections.map((col) => {
            const colProducts = activeProducts.filter((p) =>
              col.productIds.includes(p.productId)
            );
            if (colProducts.length === 0) return null;
            return (
              <div key={col.id} className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-medium">{col.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {colProducts.length} items
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {colProducts.map((p) => (
                    <ProductCard key={p.id} product={p} shopAddress={shop.address} />
                  ))}
                </div>
              </div>
            );
          })}
          <Separator />
        </div>
      )}

      {/* All Products */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium">All Products</h2>
        {activeProducts.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No products available yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {activeProducts.map((p) => (
              <ProductCard key={p.id} product={p} shopAddress={shop.address} />
            ))}
          </div>
        )}
      </div>

      {/* Reviews */}
      <ReviewsList reviews={shop.reviews} />
    </div>
  );
}
