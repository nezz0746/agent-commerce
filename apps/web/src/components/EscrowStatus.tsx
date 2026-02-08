"use client";

import { useReadContract } from "wagmi";
import { shopAbi } from "@/lib/contracts";
import { formatEther } from "viem";
import { Lock, Unlock, Clock, RotateCcw } from "lucide-react";

// OrderStatus enum: 0=Created, 1=Paid, 2=Fulfilled, 3=Completed, 4=Cancelled, 5=Refunded
const ESCROW_INFO: Record<
  number,
  { icon: typeof Lock; label: string; className: string } | null
> = {
  0: null,
  1: { icon: Lock, label: "Funds held in escrow", className: "text-yellow-600" },
  2: { icon: Unlock, label: "Escrow released", className: "text-green-600" },
  3: { icon: Unlock, label: "Escrow released", className: "text-green-600" },
  4: { icon: RotateCcw, label: "Order cancelled", className: "text-muted-foreground" },
  5: { icon: RotateCcw, label: "Refund claimed", className: "text-blue-600" },
};

export function EscrowStatus({
  shopAddress,
  orderId,
  status,
  escrowAmount,
  createdAt,
}: {
  shopAddress: `0x${string}`;
  orderId: number;
  status: number;
  escrowAmount: bigint;
  createdAt: bigint;
}) {
  const { data: escrowTimeout } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "escrowTimeout",
  });

  if (escrowAmount === 0n) return null;

  const info = ESCROW_INFO[status];
  if (!info) return null;

  const Icon = info.icon;
  const timeout = escrowTimeout ? Number(escrowTimeout) : 0;
  const expiresAt = Number(createdAt) + timeout;
  const now = Math.floor(Date.now() / 1000);
  const remaining = expiresAt - now;
  const daysRemaining = Math.max(0, Math.ceil(remaining / 86400));

  return (
    <div className="space-y-1">
      <div className={`inline-flex items-center gap-1.5 text-xs ${info.className}`}>
        <Icon className="h-3 w-3" />
        <span>{info.label}</span>
        <span className="text-muted-foreground">
          ({formatEther(escrowAmount)} ETH)
        </span>
      </div>
      {status === 1 && timeout > 0 && remaining > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          Auto-refund available in {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
