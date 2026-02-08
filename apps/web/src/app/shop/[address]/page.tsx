"use client";

import { useParams } from "next/navigation";
import { useReadContract } from "wagmi";
import { shopAbi } from "@/lib/contracts";
import Link from "next/link";
import { formatPrice, shortenAddress } from "@/lib/utils";

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

  if (!data) return null;
  const [name, price, stock, , , active] = data as [
    string,
    bigint,
    bigint,
    bigint,
    string,
    boolean
  ];
  if (!active) return null;

  return (
    <Link
      href={`/shop/${shopAddress}/product/${productId}`}
      className="block rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 transition"
    >
      <div className="aspect-square rounded-lg bg-zinc-800 mb-3 flex items-center justify-center text-3xl">
        🛍️
      </div>
      <h4 className="font-medium text-white">{name}</h4>
      <p className="text-sm text-zinc-400 mt-1">{formatPrice(price)}</p>
      <p className="text-xs text-zinc-500 mt-1">{Number(stock)} in stock</p>
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
    <span className="inline-block rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
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
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-3">{collection.name}</h3>
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
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{(name as string) || "Shop"}</h1>
        <p className="text-sm text-zinc-500 mt-1">{shortenAddress(address)}</p>
      </div>

      {/* Categories */}
      {categoryCount > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
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
      {collectionCount > 0 &&
        Array.from({ length: collectionCount }, (_, i) => (
          <CollectionSection
            key={i + 1}
            shopAddress={address}
            collectionId={i + 1}
          />
        ))}

      {/* All Products */}
      <h2 className="text-xl font-semibold mb-4">All Products</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: productCount }, (_, i) => (
          <ProductCard
            key={i + 1}
            shopAddress={address}
            productId={i + 1}
          />
        ))}
      </div>
    </div>
  );
}
