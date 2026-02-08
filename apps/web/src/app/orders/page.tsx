"use client";

import { useAccount, useReadContract } from "wagmi";
import { shopAbi, commerceHubConfig } from "@/lib/contracts";
import { formatPrice, shortenAddress } from "@/lib/utils";
import { useState } from "react";

const STATUS_LABELS = [
  "Created",
  "Paid",
  "Fulfilled",
  "Completed",
  "Cancelled",
  "Refunded",
];

const STATUS_COLORS = [
  "text-zinc-400",
  "text-yellow-400",
  "text-blue-400",
  "text-green-400",
  "text-red-400",
  "text-orange-400",
];

function OrderRow({
  shopAddress,
  orderId,
}: {
  shopAddress: `0x${string}`;
  orderId: number;
}) {
  const { data } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "orders",
    args: [BigInt(orderId)],
  });

  const { address } = useAccount();

  if (!data) return null;
  const [customer, totalAmount, , status, createdAt] = data as [
    string,
    bigint,
    bigint,
    number,
    bigint,
    string
  ];

  if (customer.toLowerCase() !== address?.toLowerCase()) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div>
        <p className="font-medium">Order #{orderId}</p>
        <p className="text-sm text-zinc-500">
          {new Date(Number(createdAt) * 1000).toLocaleDateString()}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium">{formatPrice(totalAmount)}</p>
        <p className={`text-xs ${STATUS_COLORS[status]}`}>
          {STATUS_LABELS[status]}
        </p>
      </div>
    </div>
  );
}

function ShopOrders({ shopAddress }: { shopAddress: `0x${string}` }) {
  const { data: name } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "name",
  });

  const { data: nextOrderId } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "nextOrderId",
  });

  const orderCount = nextOrderId ? Number(nextOrderId) - 1 : 0;
  if (orderCount === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-3">{name as string}</h3>
      <div className="space-y-2">
        {Array.from({ length: orderCount }, (_, i) => (
          <OrderRow key={i + 1} shopAddress={shopAddress} orderId={i + 1} />
        ))}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { isConnected } = useAccount();

  const { data: shops } = useReadContract({
    ...commerceHubConfig,
    functionName: "getShops",
  });

  if (!isConnected) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Orders</h1>
        <p className="text-zinc-500">Connect your wallet to view orders.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>
      {shops && (shops as `0x${string}`[]).length > 0 ? (
        (shops as `0x${string}`[]).map((addr) => (
          <ShopOrders key={addr} shopAddress={addr} />
        ))
      ) : (
        <p className="text-zinc-500">No shops found.</p>
      )}
    </div>
  );
}
