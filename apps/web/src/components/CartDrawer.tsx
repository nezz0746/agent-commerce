"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  type CartItem,
} from "@/lib/cart";
import { shopAbi } from "@/lib/contracts";
import { formatPrice } from "@/lib/utils";
import { optimismSepolia } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export function CartDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const { isConnected } = useAccount();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const queryClient = useQueryClient();

  useEffect(() => {
    const update = () => setItems(getCart());
    update();
    window.addEventListener("cart-updated", update);
    return () => window.removeEventListener("cart-updated", update);
  }, []);

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      clearCart();
      toast.success("Order placed!", {
        description: "Your onchain order has been confirmed.",
      });
      // Delayed invalidation for subgraph indexing lag
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["subgraph"] }), 5000);
    }
  }, [isSuccess, queryClient]);

  const byShop = items.reduce(
    (acc, item) => {
      const key = item.shopAddress;
      if (!acc[key]) acc[key] = { name: item.shopName, items: [] };
      acc[key].items.push(item);
      return acc;
    },
    {} as Record<string, { name: string; items: CartItem[] }>
  );

  const total = items.reduce(
    (sum, i) => sum + i.price * BigInt(i.quantity),
    0n
  );

  const handleCheckout = (
    shopAddress: `0x${string}`,
    shopItems: CartItem[]
  ) => {
    const orderItems = shopItems.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      quantity: BigInt(i.quantity),
    }));

    const shopTotal = shopItems.reduce(
      (sum, i) => sum + i.price * BigInt(i.quantity),
      0n
    );

    writeContract({
      address: shopAddress,
      abi: shopAbi,
      functionName: "createOrder",
      args: [orderItems],
      value: shopTotal,
      chainId: optimismSepolia.id,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0 sm:max-w-md">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4" />
            Cart
            {items.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Your shopping cart
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {isSuccess
                ? "Order placed! Check your orders."
                : "Your cart is empty"}
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                {Object.entries(byShop).map(
                  ([addr, { name, items: shopItems }]) => (
                    <div key={addr} className="space-y-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {name}
                      </p>
                      <div className="space-y-3">
                        {shopItems.map((item) => (
                          <div
                            key={`${item.productId}-${item.variantId}`}
                            className="flex gap-3"
                          >
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center border bg-muted">
                              <ShoppingBag className="h-5 w-5 text-muted-foreground/30" />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                              <div>
                                <p className="truncate text-sm font-medium leading-tight">
                                  {item.name}
                                </p>
                                {item.variantName && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.variantName}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    className="flex h-6 w-6 items-center justify-center border text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() =>
                                      updateQuantity(
                                        item.shopAddress,
                                        item.productId,
                                        item.variantId,
                                        item.quantity - 1
                                      )
                                    }
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="w-6 text-center text-xs tabular-nums">
                                    {item.quantity}
                                  </span>
                                  <button
                                    className="flex h-6 w-6 items-center justify-center border text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() =>
                                      updateQuantity(
                                        item.shopAddress,
                                        item.productId,
                                        item.variantId,
                                        item.quantity + 1
                                      )
                                    }
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm tabular-nums">
                                    {formatPrice(
                                      item.price * BigInt(item.quantity)
                                    )}
                                  </span>
                                  <button
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                    onClick={() =>
                                      removeFromCart(
                                        item.shopAddress,
                                        item.productId,
                                        item.variantId
                                      )
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {isConnected && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() =>
                            handleCheckout(
                              addr as `0x${string}`,
                              shopItems
                            )
                          }
                          disabled={isPending || isConfirming}
                        >
                          {isPending
                            ? "Confirm in wallet..."
                            : isConfirming
                              ? "Confirming..."
                              : `Checkout ${formatPrice(
                                  shopItems.reduce(
                                    (s, i) =>
                                      s + i.price * BigInt(i.quantity),
                                    0n
                                  )
                                )}`}
                        </Button>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="border-t px-6 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-sm font-medium">
                  {formatPrice(total)}
                </span>
              </div>
              {!isConnected && (
                <p className="text-xs text-muted-foreground">
                  Connect your wallet to checkout.
                </p>
              )}
              {isConnected && Object.keys(byShop).length === 1 && (
                <Button
                  className="w-full"
                  onClick={() => {
                    const [addr, { items: shopItems }] =
                      Object.entries(byShop)[0];
                    handleCheckout(addr as `0x${string}`, shopItems);
                  }}
                  disabled={isPending || isConfirming}
                >
                  {isPending ? (
                    "Confirm in wallet..."
                  ) : isConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    `Pay ${formatPrice(total)}`
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
