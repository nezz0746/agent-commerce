"use client";

import { useAccount } from "wagmi";
import { useOrders } from "@/hooks/useSubgraph";
import { formatPrice, shortenAddress } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EscrowStatus } from "@/components/EscrowStatus";
import { ReviewButton } from "@/components/ReviewButton";
import type { SubgraphOrder } from "@/lib/subgraph";

const STATUS_LABELS: Record<string, string> = {
  Created: "Created",
  Paid: "Paid",
  Fulfilled: "Fulfilled",
  Completed: "Completed",
  Cancelled: "Cancelled",
  Refunded: "Refunded",
};

const STATUS_INDEX: Record<string, number> = {
  Created: 0,
  Paid: 1,
  Fulfilled: 2,
  Completed: 3,
  Cancelled: 4,
  Refunded: 5,
};

function OrderRow({ order }: { order: SubgraphOrder }) {
  const statusNum = STATUS_INDEX[order.status] ?? 0;

  return (
    <div className="border-b py-3 last:border-0 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">#{order.orderId}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(Number(order.createdAt) * 1000).toLocaleDateString()}
          </p>
          {order.items && order.items.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {order.items.map((item, i) => (
                <span key={item.id}>
                  {i > 0 && ", "}
                  {item.product.name}
                  {item.variant ? ` (${item.variant.name})` : ""}
                  {" × "}
                  {item.quantity}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatPrice(BigInt(order.totalAmount))}
          </span>
          <span className="text-xs text-muted-foreground">
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
      </div>
      <EscrowStatus
        shopAddress={order.shop.address as `0x${string}`}
        orderId={Number(order.orderId)}
        status={statusNum}
        escrowAmount={BigInt(order.totalAmount)}
        createdAt={BigInt(order.createdAt)}
      />
      <ReviewButton
        shopAddress={order.shop.address as `0x${string}`}
        orderId={Number(order.orderId)}
        orderStatus={statusNum}
      />
    </div>
  );
}

function OrdersByShop({ orders }: { orders: SubgraphOrder[] }) {
  const byShop = orders.reduce(
    (acc, order) => {
      const key = order.shop.address;
      if (!acc[key]) acc[key] = { name: order.shop.name, orders: [] };
      acc[key].orders.push(order);
      return acc;
    },
    {} as Record<string, { name: string; orders: SubgraphOrder[] }>
  );

  return (
    <>
      {Object.entries(byShop).map(([addr, { name, orders: shopOrders }]) => (
        <Card key={addr}>
          <CardContent className="pt-5">
            <p className="mb-3 text-sm font-medium">
              {name}{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {shortenAddress(addr)}
              </span>
            </p>
            {shopOrders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </CardContent>
        </Card>
      ))}
    </>
  );
}

export default function OrdersPage() {
  const { isConnected, address } = useAccount();
  const { data: orders, isLoading } = useOrders(address);

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Connect your wallet to view order history.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {Array.from({ length: 2 }, (_, i) => (
          <Card key={i}>
            <CardContent className="pt-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {orders && orders.length > 0 ? (
        <OrdersByShop orders={orders} />
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No orders yet.
        </p>
      )}
    </div>
  );
}
