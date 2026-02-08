"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { commerceHubConfig, shopAbi } from "@/lib/contracts";
import { formatPrice, shortenAddress } from "@/lib/utils";
import { optimismSepolia } from "wagmi/chains";
import { keccak256, toBytes } from "viem";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Truck } from "lucide-react";

const STATUS_LABELS = ["Created", "Paid", "Fulfilled", "Completed", "Cancelled", "Refunded"];

// ─── Create Shop ───

function CreateShop() {
  const [name, setName] = useState("");
  const [uri, setUri] = useState("");
  const { writeContract, isPending } = useWriteContract();

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

function ShopAdmin({ address }: { address: `0x${string}` }) {
  const { data: name } = useReadContract({ address, abi: shopAbi, functionName: "name" });

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4">
          <p className="font-medium">{name as string}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {shortenAddress(address)}
          </p>
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
            <ProductsTab shopAddress={address} />
          </TabsContent>
          <TabsContent value="orders" className="mt-4">
            <OrdersTab shopAddress={address} />
          </TabsContent>
          <TabsContent value="categories" className="mt-4">
            <CategoriesTab shopAddress={address} />
          </TabsContent>
          <TabsContent value="discounts" className="mt-4">
            <DiscountsTab shopAddress={address} />
          </TabsContent>
          <TabsContent value="employees" className="mt-4">
            <EmployeesTab shopAddress={address} />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <SettingsTab shopAddress={address} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── Products Tab ───

function ProductsTab({ shopAddress }: { shopAddress: `0x${string}` }) {
  const { data: nextId } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "nextProductId" });
  const count = nextId ? Number(nextId) - 1 : 0;
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{count} products</p>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" />
          New Product
        </Button>
      </div>
      {showForm && <CreateProductForm shopAddress={shopAddress} onDone={() => setShowForm(false)} />}
      <div className="space-y-2">
        {Array.from({ length: count }, (_, i) => (
          <ProductRow key={i + 1} shopAddress={shopAddress} productId={i + 1} />
        ))}
        {count === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No products yet. Create your first product above.
          </p>
        )}
      </div>
    </div>
  );
}

function ProductRow({ shopAddress, productId }: { shopAddress: `0x${string}`; productId: number }) {
  const { data } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "products", args: [BigInt(productId)] });
  if (!data) return null;
  const [name, price, stock, , , active] = data as [string, bigint, bigint, bigint, string, boolean];

  return (
    <div className={`flex items-center justify-between border-b py-2.5 last:border-0 ${!active ? "opacity-40" : ""}`}>
      <div>
        <span className="text-sm font-medium">{name}</span>
        <span className="ml-2 text-xs text-muted-foreground">#{productId}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="tabular-nums">{formatPrice(price)}</span>
        <span className="tabular-nums">{Number(stock)} stock</span>
      </div>
    </div>
  );
}

function CreateProductForm({ shopAddress, onDone }: { shopAddress: `0x${string}`; onDone: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState("1");
  const { writeContract, isPending } = useWriteContract();

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
                address: shopAddress,
                abi: shopAbi,
                functionName: "createProduct",
                args: [name, BigInt(Math.floor(parseFloat(price) * 1e18)), BigInt(stock), BigInt(categoryId), ""],
                chainId: optimismSepolia.id,
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

function OrdersTab({ shopAddress }: { shopAddress: `0x${string}` }) {
  const { data: nextId } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "nextOrderId" });
  const count = nextId ? Number(nextId) - 1 : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{count} orders</p>
      <div className="space-y-2">
        {Array.from({ length: count }, (_, i) => (
          <AdminOrderRow key={i + 1} shopAddress={shopAddress} orderId={count - i} />
        ))}
        {count === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No orders yet.
          </p>
        )}
      </div>
    </div>
  );
}

function AdminOrderRow({ shopAddress, orderId }: { shopAddress: `0x${string}`; orderId: number }) {
  const { data } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "orders", args: [BigInt(orderId)] });
  const { writeContract, isPending } = useWriteContract();

  if (!data) return null;
  const [customer, totalAmount, , status, createdAt] = data as [string, bigint, bigint, number, bigint, string];

  return (
    <div className="flex items-center justify-between border-b py-2.5 last:border-0">
      <div>
        <span className="text-sm font-medium">#{orderId}</span>
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          {shortenAddress(customer)}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          {new Date(Number(createdAt) * 1000).toLocaleDateString()}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums text-muted-foreground">{formatPrice(totalAmount)}</span>
        <span className="text-xs text-muted-foreground">{STATUS_LABELS[status]}</span>
        {status === 1 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => writeContract({ address: shopAddress, abi: shopAbi, functionName: "fulfillOrder", args: [BigInt(orderId)], chainId: optimismSepolia.id })}
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

function CategoriesTab({ shopAddress }: { shopAddress: `0x${string}` }) {
  const { data: nextId } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "nextCategoryId" });
  const count = nextId ? Number(nextId) - 1 : 0;
  const [name, setName] = useState("");
  const { writeContract, isPending } = useWriteContract();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{count} categories</p>
      <div className="space-y-2">
        {Array.from({ length: count }, (_, i) => (
          <CategoryRow key={i + 1} shopAddress={shopAddress} categoryId={i + 1} />
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          onClick={() => {
            writeContract({ address: shopAddress, abi: shopAbi, functionName: "createCategory", args: [name, ""], chainId: optimismSepolia.id });
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

function CategoryRow({ shopAddress, categoryId }: { shopAddress: `0x${string}`; categoryId: number }) {
  const { data } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "categories", args: [BigInt(categoryId)] });
  if (!data) return null;
  const [name, , active] = data as [string, string, boolean];
  return (
    <div className={`flex items-center gap-2 border-b py-2.5 last:border-0 ${!active ? "opacity-40" : ""}`}>
      <span className="text-sm">{name}</span>
      <span className="text-xs text-muted-foreground">#{categoryId}</span>
    </div>
  );
}

// ─── Discounts Tab ───

function DiscountsTab({ shopAddress }: { shopAddress: `0x${string}` }) {
  const { data: nextId } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "nextDiscountId" });
  const count = nextId ? Number(nextId) - 1 : 0;
  const [code, setCode] = useState("");
  const [bps, setBps] = useState("1000");
  const [maxUses, setMaxUses] = useState("100");
  const { writeContract, isPending } = useWriteContract();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{count} discounts</p>
      <div className="space-y-2">
        {Array.from({ length: count }, (_, i) => (
          <DiscountRow key={i + 1} shopAddress={shopAddress} discountId={i + 1} />
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
            writeContract({ address: shopAddress, abi: shopAbi, functionName: "createDiscount", args: [codeHash, BigInt(bps), BigInt(maxUses), expires], chainId: optimismSepolia.id });
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

function DiscountRow({ shopAddress, discountId }: { shopAddress: `0x${string}`; discountId: number }) {
  const { data } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "discounts", args: [BigInt(discountId)] });
  if (!data) return null;
  const [, basisPoints, maxUses, usedCount, , active] = data as [string, bigint, bigint, bigint, bigint, boolean];
  return (
    <div className={`flex items-center justify-between border-b py-2.5 last:border-0 ${!active ? "opacity-40" : ""}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm">#{discountId}</span>
        <span className="text-xs text-muted-foreground">{Number(basisPoints) / 100}% off</span>
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {Number(usedCount)}/{Number(maxUses)} used
      </span>
    </div>
  );
}

// ─── Employees Tab ───

function EmployeesTab({ shopAddress }: { shopAddress: `0x${string}` }) {
  const [addr, setAddr] = useState("");
  const { writeContract, isPending } = useWriteContract();
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
            writeContract({ address: shopAddress, abi: shopAbi, functionName: "addEmployee", args: [addr as `0x${string}`, MANAGER_ROLE], chainId: optimismSepolia.id });
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

function SettingsTab({ shopAddress }: { shopAddress: `0x${string}` }) {
  const { data: metadataURI } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "metadataURI" });
  const { data: splitAddr } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "paymentSplitAddress" });
  const [newUri, setNewUri] = useState("");
  const [newSplit, setNewSplit] = useState("");
  const { writeContract, isPending } = useWriteContract();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <Label>Metadata URI</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {(metadataURI as string) || "Not set"}
          </p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="New metadata URI" value={newUri} onChange={(e) => setNewUri(e.target.value)} />
          <Button
            onClick={() => writeContract({ address: shopAddress, abi: shopAbi, functionName: "setMetadataURI", args: [newUri], chainId: optimismSepolia.id })}
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
            {!splitAddr
              ? "Loading..."
              : (splitAddr as string) === "0x0000000000000000000000000000000000000000"
              ? "Not set (defaults to owner)"
              : shortenAddress(splitAddr as string)}
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
            onClick={() => writeContract({ address: shopAddress, abi: shopAbi, functionName: "setPaymentSplit", args: [newSplit as `0x${string}`], chainId: optimismSepolia.id })}
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
  const { data: shops } = useReadContract({ ...commerceHubConfig, functionName: "getShops" });

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
        {shops && (shops as `0x${string}`[]).length > 0 ? (
          <div className="space-y-6">
            {(shops as `0x${string}`[]).map((addr) => (
              <ShopAdmin key={addr} address={addr} />
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
