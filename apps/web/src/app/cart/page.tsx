"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { encodeFunctionData, parseAbi } from "viem";
import { getCart, removeFromCart, clearCart, type CartItem } from "@/lib/cart";
import { shopAbi } from "@/lib/contracts";
import { formatPrice } from "@/lib/utils";
import { optimismSepolia } from "wagmi/chains";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const { address, isConnected } = useAccount();
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
    }
  }, [isSuccess]);

  // Group items by shop
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

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Cart</h1>

      {items.length === 0 ? (
        <p className="text-zinc-500">
          {isSuccess ? "Order placed! 🎉" : "Your cart is empty."}
        </p>
      ) : (
        <>
          {Object.entries(byShop).map(([addr, { name, items: shopItems }]) => (
            <div key={addr} className="mb-8">
              <h3 className="text-lg font-semibold mb-3">{name}</h3>
              <div className="space-y-3">
                {shopItems.map((item) => (
                  <div
                    key={`${item.productId}-${item.variantId}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                  >
                    <div>
                      <p className="font-medium text-white">{item.name}</p>
                      {item.variantName && (
                        <p className="text-sm text-zinc-500">
                          {item.variantName}
                        </p>
                      )}
                      <p className="text-sm text-zinc-400">
                        {item.quantity} × {formatPrice(item.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium">
                        {formatPrice(item.price * BigInt(item.quantity))}
                      </p>
                      <button
                        onClick={() =>
                          removeFromCart(
                            item.shopAddress,
                            item.productId,
                            item.variantId
                          )
                        }
                        className="text-zinc-500 hover:text-red-400 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {isConnected && (
                <button
                  onClick={() =>
                    handleCheckout(addr as `0x${string}`, shopItems)
                  }
                  disabled={isPending || isConfirming}
                  className="mt-4 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-500 transition disabled:opacity-50"
                >
                  {isPending
                    ? "Confirm in wallet..."
                    : isConfirming
                    ? "Confirming..."
                    : `Pay ${formatPrice(
                        shopItems.reduce(
                          (s, i) => s + i.price * BigInt(i.quantity),
                          0n
                        )
                      )}`}
                </button>
              )}
            </div>
          ))}

          <div className="border-t border-zinc-800 pt-4 mt-4">
            <p className="text-lg font-semibold">
              Total: {formatPrice(total)}
            </p>
          </div>

          {!isConnected && (
            <p className="mt-4 text-sm text-zinc-500">
              Connect your wallet to checkout
            </p>
          )}
        </>
      )}
    </div>
  );
}
