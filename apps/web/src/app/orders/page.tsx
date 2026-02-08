"use client";

import { useAccount, useReadContract } from "wagmi";
import { commerceHubConfig, shopAbi } from "@/lib/contracts";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_LABELS = ["Created", "Paid", "Fulfilled", "Completed", "Cancelled", "Refunded"];

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
    <div className="flex items-center justify-between border-b py-3 last:border-0">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">#{orderId}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(Number(createdAt) * 1000).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm tabular-nums text-muted-foreground">
          {formatPrice(totalAmount)}
        </span>
        <span className="text-xs text-muted-foreground">
          {STATUS_LABELS[status]}
        </span>
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
    <Card>
      <CardContent className="pt-5">
        <p className="mb-3 text-sm font-medium">{name as string}</p>
        {Array.from({ length: orderCount }, (_, i) => (
          <OrderRow key={i + 1} shopAddress={shopAddress} orderId={i + 1} />
        ))}
      </CardContent>
    </Card>
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
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Connect your wallet to view order history.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {shops && (shops as `0x${string}`[]).length > 0 ? (
        (shops as `0x${string}`[]).map((addr) => (
          <ShopOrders key={addr} shopAddress={addr} />
        ))
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No orders yet.
        </p>
      )}
    </div>
  );
}
