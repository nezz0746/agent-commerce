"use client";

import { useParams } from "next/navigation";
import { useReadContract } from "wagmi";
import { shopAbi } from "@/lib/contracts";
import { formatPrice } from "@/lib/utils";
import { addToCart } from "@/lib/cart";
import { useState } from "react";

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
    <button
      onClick={onSelect}
      className={`rounded-lg border px-4 py-2 text-sm transition ${
        isSelected
          ? "border-blue-500 bg-blue-500/10 text-blue-400"
          : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
      }`}
    >
      {name}
    </button>
  );
}

export default function ProductPage() {
  const params = useParams();
  const shopAddress = params.address as `0x${string}`;
  const productId = Number(params.id);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [added, setAdded] = useState(false);

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

  if (!product) return <p className="text-zinc-500">Loading...</p>;

  const [name, price, stock, , , active] = product as [
    string,
    bigint,
    bigint,
    bigint,
    string,
    boolean
  ];

  if (!active) return <p className="text-zinc-500">Product not available</p>;

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
      quantity: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-2xl">
      <div className="aspect-square max-w-md rounded-xl bg-zinc-900 border border-zinc-800 mb-6 flex items-center justify-center text-6xl">
        🛍️
      </div>

      <h1 className="text-2xl font-bold">{name}</h1>
      <p className="text-xl text-zinc-300 mt-2">{formatPrice(displayPrice)}</p>
      <p className="text-sm text-zinc-500 mt-1">
        {Number(displayStock)} in stock
      </p>

      {variantCount > 0 && (
        <div className="mt-4">
          <p className="text-sm text-zinc-400 mb-2">Variants</p>
          <VariantSelector
            shopAddress={shopAddress}
            productId={productId}
            variantCount={variantCount}
            selected={selectedVariant}
            onSelect={setSelectedVariant}
          />
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={variantCount > 0 && selectedVariant === 0}
        className="mt-6 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {added
          ? "✓ Added to Cart"
          : variantCount > 0 && selectedVariant === 0
          ? "Select a variant"
          : "Add to Cart"}
      </button>
    </div>
  );
}
