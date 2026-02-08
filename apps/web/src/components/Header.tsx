"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { CartDrawer } from "@/components/CartDrawer";
import { ShoppingCart } from "lucide-react";
import { getCart } from "@/lib/cart";

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Marketplace";
  if (pathname === "/orders") return "My Orders";
  if (pathname === "/admin") return "Admin Dashboard";
  if (pathname.match(/^\/shop\/[^/]+\/product\/\d+$/)) return "Product Details";
  if (pathname.match(/^\/shop\/[^/]+$/)) return "Shop";
  return "Onchain Commerce";
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const update = () => setCartCount(getCart().length);
    update();
    window.addEventListener("cart-updated", update);
    return () => window.removeEventListener("cart-updated", update);
  }, []);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-sm font-medium">{title}</h1>
        </div>
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="relative flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ShoppingCart className="h-[18px] w-[18px]" />
          {cartCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {cartCount}
            </span>
          )}
        </button>
      </header>
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
