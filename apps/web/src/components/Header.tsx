"use client";

import Link from "next/link";
import { ConnectKitButton } from "connectkit";
import { useEffect, useState } from "react";
import { getCart } from "@/lib/cart";

export function Header() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const update = () => setCartCount(getCart().length);
    update();
    window.addEventListener("cart-updated", update);
    return () => window.removeEventListener("cart-updated", update);
  }, []);

  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-white">
          ⚡ Onchain Commerce
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/cart"
            className="text-sm text-zinc-400 hover:text-white transition"
          >
            Cart{cartCount > 0 && ` (${cartCount})`}
          </Link>
          <Link
            href="/orders"
            className="text-sm text-zinc-400 hover:text-white transition"
          >
            Orders
          </Link>
          <Link
            href="/admin"
            className="text-sm text-zinc-400 hover:text-white transition"
          >
            Admin
          </Link>
          <ConnectKitButton />
        </nav>
      </div>
    </header>
  );
}
