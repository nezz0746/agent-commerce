"use client";

import { useEffect, useState } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { getCart, removeFromCart, clearCart, type CartItem } from "@/lib/cart";
import { shopAbi } from "@/lib/contracts";
import { formatPrice } from "@/lib/utils";
import { optimismSepolia } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const { isConnected } = useAccount();
  const { writeContract, data: txHash, isPending } = useWriteContract();

  useEffect(() => {
    const update = () => setItems(getCart());
    update();
    window.addEventListener("cart-updated", update);
    return () => window.removeEventListener("cart-updated", update);
  }, []);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess) {
      clearCart();
      toast.success("Order placed!", {
        description: "Your onchain order has been confirmed.",
      });
    }
  }, [isSuccess]);

  const byShop = items.reduce((acc, item) => {
    const key = item.shopAddress;
    if (!acc[key]) acc[key] = { name: item.shopName, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {} as Record<string, { name: string; items: CartItem[] }>);

  const total = items.reduce(
    (sum, i) => sum + i.price * BigInt(i.quantity),
    0n
  );

  const handleCheckout = (shopAddress: `0x${string}`, shopItems: CartItem[]) => {
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

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {isSuccess
            ? "Order placed! Your onchain order has been confirmed."
            : "Your cart is empty."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {Object.entries(byShop).map(([addr, { name, items: shopItems }]) => {
        const shopTotal = shopItems.reduce(
          (s, i) => s + i.price * BigInt(i.quantity),
          0n
        );

        return (
          <Card key={addr}>
            <CardContent className="space-y-3 pt-5">
              <p className="text-sm font-medium">{name}</p>
              {shopItems.map((item) => (
                <div
                  key={`${item.productId}-${item.variantId}`}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{item.name}</p>
                    {item.variantName && (
                      <p className="text-xs text-muted-foreground">
                        {item.variantName}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} &times; {formatPrice(item.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium tabular-nums">
                      {formatPrice(item.price * BigInt(item.quantity))}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        removeFromCart(
                          item.shopAddress,
                          item.productId,
                          item.variantId
                        )
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
            {isConnected && (
              <CardFooter className="flex-col items-stretch gap-3 border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatPrice(shopTotal)}</span>
                </div>
                <Button
                  onClick={() =>
                    handleCheckout(addr as `0x${string}`, shopItems)
                  }
                  disabled={isPending || isConfirming}
                  className="w-full"
                >
                  {isPending ? (
                    "Confirm in wallet..."
                  ) : isConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    `Pay ${formatPrice(shopTotal)}`
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>
        );
      })}

      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-sm font-medium">Total</span>
        <span className="font-medium">{formatPrice(total)}</span>
      </div>

      {!isConnected && (
        <p className="text-sm text-muted-foreground">
          Connect your wallet to checkout.
        </p>
      )}
    </div>
  );
}
