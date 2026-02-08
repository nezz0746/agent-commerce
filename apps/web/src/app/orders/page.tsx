"use client";

import { useAccount, useReadContract } from "wagmi";
import { commerceHubConfig, shopAbi } from "@/lib/contracts";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  CheckCircle2,
  CircleDot,
  Clock,
  Package,
  RefreshCcw,
  Store,
  Wallet,
  XCircle,
} from "lucide-react";

const STATUS_CONFIG = [
  { label: "Created", icon: CircleDot, variant: "secondary" as const },
  { label: "Paid", icon: Clock, variant: "default" as const },
  { label: "Fulfilled", icon: Package, variant: "default" as const },
  { label: "Completed", icon: CheckCircle2, variant: "secondary" as const },
  { label: "Cancelled", icon: XCircle, variant: "destructive" as const },
  { label: "Refunded", icon: RefreshCcw, variant: "outline" as const },
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

  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-1">
        <p className="font-medium">Order #{orderId}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {new Date(Number(createdAt) * 1000).toLocaleDateString()}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium tabular-nums">
          {formatPrice(totalAmount)}
        </span>
        <Badge variant={config.variant} className="gap-1">
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </Badge>
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
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">{name as string}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
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
      <div className="mx-auto max-w-2xl">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">Connect your wallet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your wallet to view your order history.
            </p>
          </CardContent>
        </Card>
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
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">No orders yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your order history will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
