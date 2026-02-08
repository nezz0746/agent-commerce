"use client";

import { useReadContract } from "wagmi";
import { commerceHubConfig, shopAbi } from "@/lib/contracts";
import Link from "next/link";
import { shortenAddress } from "@/lib/utils";

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
    <Link
      href={`/shop/${address}`}
      className="block rounded-xl border border-zinc-800 bg-zinc-900 p-6 hover:border-zinc-600 transition"
    >
      <h3 className="text-xl font-semibold text-white">
        {(name as string) || "Loading..."}
      </h3>
      <p className="mt-1 text-sm text-zinc-500">{shortenAddress(address)}</p>
      <p className="mt-2 text-sm text-zinc-400">{count} products</p>
    </Link>
  );
}

export default function Home() {
  const { data: shops, isLoading } = useReadContract({
    ...commerceHubConfig,
    functionName: "getShops",
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Marketplace</h1>
        <p className="mt-2 text-zinc-400">
          Browse onchain shops powered by Optimism
        </p>
      </div>

      {isLoading ? (
        <p className="text-zinc-500">Loading shops...</p>
      ) : !shops || (shops as `0x${string}`[]).length === 0 ? (
        <p className="text-zinc-500">No shops yet. Deploy contracts and seed data to get started.</p>
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
