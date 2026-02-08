"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { commerceHubConfig, shopAbi } from "@/lib/contracts";
import { formatPrice, shortenAddress } from "@/lib/utils";
import { optimismSepolia } from "wagmi/chains";
import { keccak256, toBytes, encodePacked } from "viem";

const STATUS_LABELS = ["Created", "Paid", "Fulfilled", "Completed", "Cancelled", "Refunded"];

// ─── Create Shop ───

function CreateShop() {
  const [name, setName] = useState("");
  const [uri, setUri] = useState("");
  const { writeContract, data: tx, isPending } = useWriteContract();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Create New Shop</h3>
      <div className="space-y-3">
        <input
          placeholder="Shop name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
        />
        <input
          placeholder="Metadata URI (optional)"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
        />
        <button
          onClick={() =>
            writeContract({
              ...commerceHubConfig,
              functionName: "createShop",
              args: [name, uri],
              chainId: optimismSepolia.id,
            })
          }
          disabled={!name || isPending}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create Shop"}
        </button>
      </div>
    </div>
  );
}

// ─── Shop Admin Panel ───

function ShopAdmin({ address }: { address: `0x${string}` }) {
  const { data: name } = useReadContract({ address, abi: shopAbi, functionName: "name" });
  const [tab, setTab] = useState<"products" | "orders" | "categories" | "discounts" | "employees" | "settings">("products");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 mb-6">
      <h3 className="text-xl font-semibold mb-1">{name as string}</h3>
      <p className="text-xs text-zinc-500 mb-4">{address}</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(["products", "orders", "categories", "discounts", "employees", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === t ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsTab shopAddress={address} />}
      {tab === "orders" && <OrdersTab shopAddress={address} />}
      {tab === "categories" && <CategoriesTab shopAddress={address} />}
      {tab === "discounts" && <DiscountsTab shopAddress={address} />}
      {tab === "employees" && <EmployeesTab shopAddress={address} />}
      {tab === "settings" && <SettingsTab shopAddress={address} />}
    </div>
  );
}

// ─── Products Tab ───

function ProductsTab({ shopAddress }: { shopAddress: `0x${string}` }) {
  const { data: nextId } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "nextProductId" });
  const count = nextId ? Number(nextId) - 1 : 0;
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium">Products ({count})</h4>
        <button onClick={() => setShowForm(!showForm)} className="text-sm text-blue-400 hover:text-blue-300">
          + New Product
        </button>
      </div>
      {showForm && <CreateProductForm shopAddress={shopAddress} onDone={() => setShowForm(false)} />}
      <div className="space-y-2">
        {Array.from({ length: count }, (_, i) => (
          <ProductRow key={i + 1} shopAddress={shopAddress} productId={i + 1} />
        ))}
      </div>
    </div>
  );
}

function ProductRow({ shopAddress, productId }: { shopAddress: `0x${string}`; productId: number }) {
  const { data } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "products", args: [BigInt(productId)] });
  if (!data) return null;
  const [name, price, stock, , , active] = data as [string, bigint, bigint, bigint, string, boolean];

  return (
    <div className={`flex items-center justify-between rounded-lg border border-zinc-800 p-3 text-sm ${!active ? "opacity-40" : ""}`}>
      <div>
        <span className="font-medium">{name}</span>
        <span className="text-zinc-500 ml-2">#{productId}</span>
      </div>
      <div className="flex gap-4 text-zinc-400">
        <span>{formatPrice(price)}</span>
        <span>{Number(stock)} stock</span>
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
    <div className="mb-4 space-y-2 rounded-lg border border-zinc-700 p-4">
      <input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm" />
      <div className="flex gap-2">
        <input placeholder="Price (ETH)" value={price} onChange={(e) => setPrice(e.target.value)} className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm" />
        <input placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value)} className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm" />
        <input placeholder="Cat ID" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-20 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm" />
      </div>
      <button
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
        className="rounded bg-blue-600 px-4 py-1.5 text-sm hover:bg-blue-500 disabled:opacity-50"
      >
        Create
      </button>
    </div>
  );
}

// ─── Orders Tab ───

function OrdersTab({ shopAddress }: { shopAddress: `0x${string}` }) {
  const { data: nextId } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "nextOrderId" });
  const count = nextId ? Number(nextId) - 1 : 0;

  return (
    <div>
      <h4 className="font-medium mb-4">Orders ({count})</h4>
      <div className="space-y-2">
        {Array.from({ length: count }, (_, i) => (
          <OrderRow key={i + 1} shopAddress={shopAddress} orderId={count - i} />
        ))}
      </div>
    </div>
  );
}

function OrderRow({ shopAddress, orderId }: { shopAddress: `0x${string}`; orderId: number }) {
  const { data } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "orders", args: [BigInt(orderId)] });
  const { writeContract } = useWriteContract();

  if (!data) return null;
  const [customer, totalAmount, , status, createdAt] = data as [string, bigint, bigint, number, bigint, string];

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-3 text-sm">
      <div>
        <span className="font-medium">#{orderId}</span>
        <span className="text-zinc-500 ml-2">{shortenAddress(customer)}</span>
        <span className="text-zinc-600 ml-2">{new Date(Number(createdAt) * 1000).toLocaleDateString()}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-zinc-400">{formatPrice(totalAmount)}</span>
        <span className="text-xs">{STATUS_LABELS[status]}</span>
        {status === 1 && (
          <button
            onClick={() => writeContract({ address: shopAddress, abi: shopAbi, functionName: "fulfillOrder", args: [BigInt(orderId)], chainId: optimismSepolia.id })}
            className="rounded bg-green-600 px-2 py-1 text-xs hover:bg-green-500"
          >
            Fulfill
          </button>
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
    <div>
      <h4 className="font-medium mb-4">Categories ({count})</h4>
      <div className="space-y-2 mb-4">
        {Array.from({ length: count }, (_, i) => (
          <CategoryRow key={i + 1} shopAddress={shopAddress} categoryId={i + 1} />
        ))}
      </div>
      <div className="flex gap-2">
        <input placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm" />
        <button
          onClick={() => { writeContract({ address: shopAddress, abi: shopAbi, functionName: "createCategory", args: [name, ""], chainId: optimismSepolia.id }); setName(""); }}
          disabled={!name || isPending}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm hover:bg-blue-500 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function CategoryRow({ shopAddress, categoryId }: { shopAddress: `0x${string}`; categoryId: number }) {
  const { data } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "categories", args: [BigInt(categoryId)] });
  if (!data) return null;
  const [name, , active] = data as [string, string, boolean];
  return (
    <div className={`rounded-lg border border-zinc-800 p-3 text-sm ${!active ? "opacity-40" : ""}`}>
      {name} <span className="text-zinc-600">#{categoryId}</span>
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
    <div>
      <h4 className="font-medium mb-4">Discounts ({count})</h4>
      <div className="space-y-2 mb-4">
        {Array.from({ length: count }, (_, i) => (
          <DiscountRow key={i + 1} shopAddress={shopAddress} discountId={i + 1} />
        ))}
      </div>
      <div className="space-y-2 rounded-lg border border-zinc-700 p-4">
        <div className="flex gap-2">
          <input placeholder="Code (e.g. WELCOME10)" value={code} onChange={(e) => setCode(e.target.value)} className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm" />
          <input placeholder="BPS (1000=10%)" value={bps} onChange={(e) => setBps(e.target.value)} className="w-32 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm" />
          <input placeholder="Max uses" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className="w-24 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm" />
        </div>
        <button
          onClick={() => {
            const codeHash = keccak256(toBytes(code));
            const expires = BigInt(Math.floor(Date.now() / 1000) + 365 * 86400);
            writeContract({ address: shopAddress, abi: shopAbi, functionName: "createDiscount", args: [codeHash, BigInt(bps), BigInt(maxUses), expires], chainId: optimismSepolia.id });
            setCode("");
          }}
          disabled={!code || isPending}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm hover:bg-blue-500 disabled:opacity-50"
        >
          Create Discount
        </button>
      </div>
    </div>
  );
}

function DiscountRow({ shopAddress, discountId }: { shopAddress: `0x${string}`; discountId: number }) {
  const { data } = useReadContract({ address: shopAddress, abi: shopAbi, functionName: "discounts", args: [BigInt(discountId)] });
  if (!data) return null;
  const [, basisPoints, maxUses, usedCount, , active] = data as [string, bigint, bigint, bigint, bigint, boolean];
  return (
    <div className={`rounded-lg border border-zinc-800 p-3 text-sm flex justify-between ${!active ? "opacity-40" : ""}`}>
      <span>Discount #{discountId} — {Number(basisPoints) / 100}% off</span>
      <span className="text-zinc-500">{Number(usedCount)}/{Number(maxUses)} used</span>
    </div>
  );
}

// ─── Employees Tab ───

function EmployeesTab({ shopAddress }: { shopAddress: `0x${string}` }) {
  const [addr, setAddr] = useState("");
  const { writeContract, isPending } = useWriteContract();
  const MANAGER_ROLE = keccak256(toBytes("MANAGER_ROLE"));

  return (
    <div>
      <h4 className="font-medium mb-4">Employees</h4>
      <div className="flex gap-2">
        <input placeholder="Employee address (0x...)" value={addr} onChange={(e) => setAddr(e.target.value)} className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm" />
        <button
          onClick={() => {
            writeContract({ address: shopAddress, abi: shopAbi, functionName: "addEmployee", args: [addr as `0x${string}`, MANAGER_ROLE], chainId: optimismSepolia.id });
            setAddr("");
          }}
          disabled={!addr || isPending}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm hover:bg-blue-500 disabled:opacity-50"
        >
          Add Manager
        </button>
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
    <div className="space-y-4">
      <div>
        <label className="text-sm text-zinc-400 mb-1 block">Metadata URI</label>
        <p className="text-xs text-zinc-600 mb-2">{(metadataURI as string) || "Not set"}</p>
        <div className="flex gap-2">
          <input placeholder="New metadata URI" value={newUri} onChange={(e) => setNewUri(e.target.value)} className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm" />
          <button
            onClick={() => writeContract({ address: shopAddress, abi: shopAbi, functionName: "setMetadataURI", args: [newUri], chainId: optimismSepolia.id })}
            disabled={!newUri || isPending}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm hover:bg-blue-500 disabled:opacity-50"
          >
            Update
          </button>
        </div>
      </div>
      <div>
        <label className="text-sm text-zinc-400 mb-1 block">Payment Split Address</label>
        <p className="text-xs text-zinc-600 mb-2">{(splitAddr as string) === "0x0000000000000000000000000000000000000000" ? "Not set (defaults to owner)" : shortenAddress(splitAddr as string)}</p>
        <div className="flex gap-2">
          <input placeholder="Split contract address" value={newSplit} onChange={(e) => setNewSplit(e.target.value)} className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm" />
          <button
            onClick={() => writeContract({ address: shopAddress, abi: shopAbi, functionName: "setPaymentSplit", args: [newSplit as `0x${string}`], chainId: optimismSepolia.id })}
            disabled={!newSplit || isPending}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm hover:bg-blue-500 disabled:opacity-50"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ───

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { data: shops } = useReadContract({ ...commerceHubConfig, functionName: "getShops" });

  if (!isConnected) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <p className="text-zinc-500">Connect your wallet to manage shops.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <CreateShop />
      <h2 className="text-xl font-semibold mb-4">Your Shops</h2>
      {shops && (shops as `0x${string}`[]).length > 0 ? (
        (shops as `0x${string}`[]).map((addr) => (
          <ShopAdmin key={addr} address={addr} />
        ))
      ) : (
        <p className="text-zinc-500">No shops found. Create one above!</p>
      )}
    </div>
  );
}
