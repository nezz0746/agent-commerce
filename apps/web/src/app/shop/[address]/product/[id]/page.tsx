"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useReadContract } from "wagmi";
import { shopAbi } from "@/lib/contracts";
import { formatPrice } from "@/lib/utils";
import { addToCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Minus, Package, Plus, ShoppingBag, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useProductMetadata } from "@/hooks/use-product-metadata";
import Image from "next/image";

function VariantSelector({
  shopAddress,
  productId,
  variantCount,
  selected,
  onSelect,
}: {
  shopAddress: `0x${string}`;
  productId: number;
  variantCount: number;
  selected: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: variantCount }, (_, i) => (
        <VariantButton
          key={i + 1}
          shopAddress={shopAddress}
          productId={productId}
          variantId={i + 1}
          isSelected={selected === i + 1}
          onSelect={() => onSelect(i + 1)}
        />
      ))}
    </div>
  );
}

function VariantButton({
  shopAddress,
  productId,
  variantId,
  isSelected,
  onSelect,
}: {
  shopAddress: `0x${string}`;
  productId: number;
  variantId: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { data } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "variants",
    args: [BigInt(productId), BigInt(variantId)],
  });

  if (!data) return null;
  const [name, , , active] = data as [string, bigint, bigint, boolean];
  if (!active) return null;

  return (
    <Button
      variant={isSelected ? "default" : "outline"}
      size="sm"
      onClick={onSelect}
      className={isSelected ? "" : "text-muted-foreground"}
    >
      {isSelected && <Check className="h-3 w-3" />}
      {name}
    </Button>
  );
}

export default function ProductPage() {
  const params = useParams();
  const shopAddress = params.address as `0x${string}`;
  const productId = Number(params.id);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const { data: product } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "products",
    args: [BigInt(productId)],
  });

  const { data: shopName } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "name",
  });

  const { data: nextVariantId } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "nextVariantId",
    args: [BigInt(productId)],
  });

  const { data: variantData } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "variants",
    args: [BigInt(productId), BigInt(selectedVariant)],
    query: { enabled: selectedVariant > 0 },
  });

  const parsed = product as [string, bigint, bigint, bigint, string, boolean] | undefined;
  const metadata = useProductMetadata(parsed?.[4] || undefined);

  if (!parsed) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </div>
      </div>
    );
  }

  const [name, price, stock, , , active] = parsed;

  if (!active) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Product not available</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href={`/shop/${shopAddress}`}>Back to shop</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const variantCount = nextVariantId ? Number(nextVariantId) - 1 : 0;

  let displayPrice = price;
  let displayStock = stock;
  if (selectedVariant > 0 && variantData) {
    const [, vPrice, vStock] = variantData as [string, bigint, bigint, boolean];
    displayPrice = vPrice;
    displayStock = vStock;
  }

  const handleAdd = () => {
    let variantName: string | undefined;
    if (selectedVariant > 0 && variantData) {
      variantName = (variantData as [string, bigint, bigint, boolean])[0];
    }
    addToCart({
      shopAddress,
      shopName: (shopName as string) ?? "Shop",
      productId: BigInt(productId),
      variantId: BigInt(selectedVariant),
      name,
      variantName,
      price: displayPrice,
      quantity,
    });
    toast.success("Added to cart", {
      description: `${quantity}x ${name}${variantName ? ` (${variantName})` : ""}`,
    });
  };

  const stockNum = Number(displayStock);
  const stockBadge =
    stockNum === 0
      ? { label: "Out of stock", variant: "destructive" as const }
      : stockNum <= 5
      ? { label: `Only ${stockNum} left`, variant: "secondary" as const }
      : { label: "In stock", variant: "secondary" as const };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Product Image */}
        <Card className="overflow-hidden">
          <div className="relative flex aspect-square items-center justify-center bg-muted">
            {metadata?.image ? (
              <Image
                src={metadata.image}
                alt={name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <ShoppingBag className="h-20 w-20 text-muted-foreground/30" />
            )}
          </div>
        </Card>

        {/* Product Details */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            <p className="text-2xl font-semibold text-primary">
              {formatPrice(displayPrice)}
            </p>
            <Badge variant={stockBadge.variant}>{stockBadge.label}</Badge>
          </div>

          {metadata?.description && (
            <p className="text-sm text-muted-foreground">{metadata.description}</p>
          )}

          <Separator />

          {/* Variants */}
          {variantCount > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Variant</p>
              <VariantSelector
                shopAddress={shopAddress}
                productId={productId}
                variantCount={variantCount}
                selected={selectedVariant}
                onSelect={setSelectedVariant}
              />
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Quantity</p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-medium">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.min(stockNum, quantity + 1))}
                disabled={quantity >= stockNum}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Add to Cart */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleAdd}
            disabled={
              stockNum === 0 || (variantCount > 0 && selectedVariant === 0)
            }
          >
            <ShoppingCart className="h-4 w-4" />
            {stockNum === 0
              ? "Out of Stock"
              : variantCount > 0 && selectedVariant === 0
              ? "Select a variant"
              : "Add to Cart"}
          </Button>
        </div>
      </div>
    </div>
  );
}
