"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
} from "wagmi";
import { shopAbi, commerceHubConfig } from "@/lib/contracts";
import { formatPrice, shortenAddress } from "@/lib/utils";
import { optimismSepolia } from "wagmi/chains";
import { keccak256, toBytes } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Truck } from "lucide-react";
import { useShops, useShop } from "@/hooks/useSubgraph";
import type { SubgraphShop } from "@/lib/subgraph";

const STATUS_LABELS = ["Created", "Paid", "Fulfilled", "Completed", "Cancelled", "Refunded"];

// ─── Create Shop ───

function CreateShop() {
  const [name, setName] = useState("");
  const [uri, setUri] = useState("");
  const { writeContract, isPending } = useWriteContract();
  const queryClient = useQueryClient();

  return (
    <Card>
      <CardContent className="space-y-4 pt-5">
        <p className="text-sm font-medium">Create New Shop</p>
        <div className="space-y-2">
          <Label htmlFor="shop-name">Shop name</Label>
          <Input
            id="shop-name"
            placeholder="My Onchain Store"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shop-uri">Metadata URI (optional)</Label>
          <Input
            id="shop-uri"
            placeholder="ipfs://..."
            value={uri}
            onChange={(e) => setUri(e.target.value)}
          />
        </div>
        <Button
          onClick={() =>
            writeContract({
              ...commerceHubConfig,
              functionName: "createShop",
              args: [name, uri],
              chainId: optimismSepolia.id,
            }, {
              onSuccess: () => {
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ["subgraph"] }), 5000);
              },
            })
          }
          disabled={!name || isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Shop"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Shop Admin Panel ───

function ShopAdmin({ address }: { address: string }) {
  const { data: shop } = useShop(address);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4">
          <p className="font-medium">{shop?.name ?? "Loading..."}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {shortenAddress(address)}
          </p>
          {shop && (
            <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
              <span>{shop.products?.length ?? 0} products</span>
              <span>{shop.orders?.length ?? 0} orders</span>
              <span>{shop.reviews?.length ?? 0} reviews</span>
            </div>
          )}
        </div>
        <Tabs defaultValue="products">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="discounts">Discounts</TabsTrigger>
            <TabsTrigger value="employees">Team</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-4">
            <ProductsTab shop={shop} shopAddress={address} />
          </TabsContent>
          <TabsContent value="orders" className="mt-4">
            <OrdersTab shop={shop} shopAddress={address} />
          </TabsContent>
          <TabsContent value="categories" className="mt-4">
            <CategoriesTab shop={shop} shopAddress={address} />
          </TabsContent>
          <TabsContent value="discounts" className="mt-4">
            <DiscountsTab shop={shop} shopAddress={address} />
          </TabsContent>
          <TabsContent value="employees" className="mt-4">
            <EmployeesTab shopAddress={address} />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <SettingsTab shop={shop} shopAddress={address} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── Products Tab ───

function ProductsTab({ shop, shopAddress }: { shop: SubgraphShop | null | undefined; shopAddress: string }) {
  const products = shop?.products ?? [];
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{products.length} products</p>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" />
          New Product
        </Button>
      </div>
      {showForm && <CreateProductForm shopAddress={shopAddress} onDone={() => setShowForm(false)} />}
      <div className="space-y-2">
        {products.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between border-b py-2.5 last:border-0 ${!p.active ? "opacity-40" : ""}`}
          >
            <div>
              <span className="text-sm font-medium">{p.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">#{p.productId}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="tabular-nums">{formatPrice(BigInt(p.price))}</span>
              <span className="tabular-nums">{Number(p.stock)} stock</span>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No products yet. Create your first product above.
          </p>
        )}
      </div>
    </div>
  );
}

function CreateProductForm({ shopAddress, onDone }: { shopAddress: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState("1");
  const { writeContract, isPending } = useWriteContract();
  const queryClient = useQueryClient();

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="space-y-2">
          <Label>Product name</Label>
          <Input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Price (ETH)</Label>
            <Input placeholder="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Stock</Label>
            <Input placeholder="100" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Category ID</Label>
            <Input placeholder="1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              writeContract({
                address: shopAddress as `0x${string}`,
                abi: shopAbi,
                functionName: "createProduct",
                args: [name, BigInt(Math.floor(parseFloat(price) * 1e18)), BigInt(stock), BigInt(categoryId), ""],
                chainId: optimismSepolia.id,
              }, {
                onSuccess: () => {
                  setTimeout(() => queryClient.invalidateQueries({ queryKey: ["subgraph"] }), 5000);
                },
              });
              onDone();
            }}
            disabled={!name || !price || !stock || isPending}
            size="sm"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create Product
          </Button>
          <Button variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Orders Tab ───

function OrdersTab({ shop, shopAddress }: { shop: SubgraphShop | null | undefined; shopAddress: string }) {
  const orders = shop?.orders ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{orders.length} orders</p>
      <div className="space-y-2">
        {orders.map((order) => (
          <AdminOrderRow key={order.id} order={order} shopAddress={shopAddress} />
        ))}
        {orders.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No orders yet.
          </p>
        )}
      </div>
    </div>
  );
}

const STATUS_INDEX: Record<string, number> = {
  Created: 0, Paid: 1, Fulfilled: 2, Completed: 3, Cancelled: 4, Refunded: 5,
};

function AdminOrderRow({ order, shopAddress }: { order: SubgraphShop["orders"][number]; shopAddress: string }) {
  const { writeContract, isPending } = useWriteContract();
  const queryClient = useQueryClient();
  const statusNum = STATUS_INDEX[order.status] ?? 0;

  return (
    <div className="flex items-center justify-between border-b py-2.5 last:border-0">
      <div>
        <span className="text-sm font-medium">#{order.orderId}</span>
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          {shortenAddress(order.customer.address)}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          {new Date(Number(order.createdAt) * 1000).toLocaleDateString()}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums text-muted-foreground">{formatPrice(BigInt(order.totalAmount))}</span>
        <span className="text-xs text-muted-foreground">{STATUS_LABELS[statusNum]}</span>
        {statusNum === 1 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => writeContract({
              address: shopAddress as `0x${string}`,
              abi: shopAbi,
              functionName: "fulfillOrder",
              args: [BigInt(order.orderId)],
              chainId: optimismSepolia.id,
            }, {
              onSuccess: () => {
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ["subgraph"] }), 5000);
              },
            })}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
            Fulfill
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Categories Tab ───

function CategoriesTab({ shop, shopAddress }: { shop: SubgraphShop | null | undefined; shopAddress: string }) {
  const categories = shop?.categories ?? [];
  const [name, setName] = useState("");
  const { writeContract, isPending } = useWriteContract();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{categories.length} categories</p>
      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className={`flex items-center gap-2 border-b py-2.5 last:border-0 ${!cat.active ? "opacity-40" : ""}`}>
            <span className="text-sm">{cat.name}</span>
            <span className="text-xs text-muted-foreground">#{cat.categoryId}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          onClick={() => {
            writeContract({
              address: shopAddress as `0x${string}`,
              abi: shopAbi,
              functionName: "createCategory",
              args: [name, ""],
              chainId: optimismSepolia.id,
            }, {
              onSuccess: () => {
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ["subgraph"] }), 5000);
              },
            });
            setName("");
          }}
          disabled={!name || isPending}
          size="sm"
          className="shrink-0"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </Button>
      </div>
    </div>
  );
}

// ─── Discounts Tab ───

function DiscountsTab({ shop, shopAddress }: { shop: SubgraphShop | null | undefined; shopAddress: string }) {
  const discounts = shop?.discounts ?? [];
  const [code, setCode] = useState("");
  const [bps, setBps] = useState("1000");
  const [maxUses, setMaxUses] = useState("100");
  const { writeContract, isPending } = useWriteContract();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{discounts.length} discounts</p>
      <div className="space-y-2">
        {discounts.map((d) => (
          <div key={d.id} className={`flex items-center justify-between border-b py-2.5 last:border-0 ${!d.active ? "opacity-40" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="text-sm">#{d.discountId}</span>
              <span className="text-xs text-muted-foreground">{Number(d.basisPoints) / 100}% off</span>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Number(d.usedCount)}/{Number(d.maxUses)} used
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Code</Label>
            <Input placeholder="WELCOME10" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Basis points</Label>
            <Input placeholder="1000 = 10%" value={bps} onChange={(e) => setBps(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Max uses</Label>
            <Input placeholder="100" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
          </div>
        </div>
        <Button
          onClick={() => {
            const codeHash = keccak256(toBytes(code));
            const expires = BigInt(Math.floor(Date.now() / 1000) + 365 * 86400);
            writeContract({
              address: shopAddress as `0x${string}`,
              abi: shopAbi,
              functionName: "createDiscount",
              args: [codeHash, BigInt(bps), BigInt(maxUses), expires],
              chainId: optimismSepolia.id,
            }, {
              onSuccess: () => {
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ["subgraph"] }), 5000);
              },
            });
            setCode("");
          }}
          disabled={!code || isPending}
          size="sm"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Create
        </Button>
      </div>
    </div>
  );
}

// ─── Employees Tab ───

function EmployeesTab({ shopAddress }: { shopAddress: string }) {
  const [addr, setAddr] = useState("");
  const { writeContract, isPending } = useWriteContract();
  const queryClient = useQueryClient();
  const MANAGER_ROLE = keccak256(toBytes("MANAGER_ROLE"));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Add team members</p>
      <div className="flex gap-2">
        <Input
          placeholder="Employee address (0x...)"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          className="font-mono"
        />
        <Button
          onClick={() => {
            writeContract({
              address: shopAddress as `0x${string}`,
              abi: shopAbi,
              functionName: "addEmployee",
              args: [addr as `0x${string}`, MANAGER_ROLE],
              chainId: optimismSepolia.id,
            }, {
              onSuccess: () => {
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ["subgraph"] }), 5000);
              },
            });
            setAddr("");
          }}
          disabled={!addr || isPending}
          size="sm"
          className="shrink-0"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </Button>
      </div>
    </div>
  );
}

// ─── Settings Tab ───

function SettingsTab({ shop, shopAddress }: { shop: SubgraphShop | null | undefined; shopAddress: string }) {
  const [newUri, setNewUri] = useState("");
  const [newSplit, setNewSplit] = useState("");
  const { writeContract, isPending } = useWriteContract();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <Label>Metadata URI</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {shop?.metadataURI || "Not set"}
          </p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="New metadata URI" value={newUri} onChange={(e) => setNewUri(e.target.value)} />
          <Button
            onClick={() => writeContract({
              address: shopAddress as `0x${string}`,
              abi: shopAbi,
              functionName: "setMetadataURI",
              args: [newUri],
              chainId: optimismSepolia.id,
            }, {
              onSuccess: () => {
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ["subgraph"] }), 5000);
              },
            })}
            disabled={!newUri || isPending}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            Update
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div>
          <Label>Payment Split Address</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {!shop?.paymentSplitAddress
              ? "Loading..."
              : shop.paymentSplitAddress === "0x0000000000000000000000000000000000000000"
              ? "Not set (defaults to owner)"
              : shortenAddress(shop.paymentSplitAddress)}
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Split contract address"
            value={newSplit}
            onChange={(e) => setNewSplit(e.target.value)}
            className="font-mono"
          />
          <Button
            onClick={() => writeContract({
              address: shopAddress as `0x${string}`,
              abi: shopAbi,
              functionName: "setPaymentSplit",
              args: [newSplit as `0x${string}`],
              chainId: optimismSepolia.id,
            }, {
              onSuccess: () => {
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ["subgraph"] }), 5000);
              },
            })}
            disabled={!newSplit || isPending}
            variant="outline"
            size="sm"
            className="shrink-0"
          >
            Update
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ───

export default function AdminPage() {
  const { isConnected } = useAccount();
  const { data: shops } = useShops();

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Connect your wallet to manage shops.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CreateShop />

      <div className="space-y-4">
        <p className="text-sm font-medium">Your Shops</p>
        {shops && shops.length > 0 ? (
          <div className="space-y-6">
            {shops.map((shop) => (
              <ShopAdmin key={shop.id} address={shop.address} />
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No shops found. Create one above.
          </p>
        )}
      </div>
    </div>
  );
}
