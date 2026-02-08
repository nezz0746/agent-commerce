"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Marketplace";
  if (pathname === "/cart") return "Shopping Cart";
  if (pathname === "/orders") return "My Orders";
  if (pathname === "/admin") return "Admin Dashboard";
  if (pathname.match(/^\/shop\/[^/]+\/product\/\d+$/)) return "Product Details";
  if (pathname.match(/^\/shop\/[^/]+$/)) return "Shop";
  return "Onchain Commerce";
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="text-sm font-medium">{title}</h1>
    </header>
  );
}
