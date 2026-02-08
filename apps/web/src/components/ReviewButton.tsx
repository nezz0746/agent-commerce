"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { shopAbi, reputationRegistryConfig } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="p-0.5 transition-colors"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          <Star
            className={`h-7 w-7 ${
              star <= (hover || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function ReviewButton({
  shopAddress,
  orderId,
  orderStatus,
}: {
  shopAddress: `0x${string}`;
  orderId: number;
  orderStatus: number;
}) {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const { address } = useAccount();
  const queryClient = useQueryClient();

  // Check if already reviewed by reading feedback from reputation registry
  const { data: agentId } = useReadContract({
    address: shopAddress,
    abi: shopAbi,
    functionName: "agentId",
  });

  const { data: feedbackData } = useReadContract({
    ...reputationRegistryConfig,
    functionName: "readAllFeedback",
    args: agentId && address ? [agentId as bigint, address] : undefined,
    query: { enabled: !!agentId && !!address },
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess) {
      toast.success("Review submitted!");
      setOpen(false);
      setStars(0);
      // Invalidate all queries to refetch review data
      queryClient.invalidateQueries();
    }
  }, [isSuccess, queryClient]);

  // Only show for Fulfilled (2) or Completed (3) orders
  if (orderStatus !== 2 && orderStatus !== 3) return null;

  // Check if already reviewed - feedbackData returns arrays, check if any exist
  const hasReviewed = feedbackData
    ? (feedbackData as [bigint[], number[], string[], string[], boolean[]])[0].length > 0
    : false;

  if (hasReviewed) {
    const reviewValue = Number((feedbackData as [bigint[], number[], string[], string[], boolean[]])[0][0]);
    const reviewStars = Math.round(reviewValue / 20);
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${
              i < reviewStars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
            }`}
          />
        ))}
        <span className="ml-1">Reviewed</span>
      </div>
    );
  }

  const handleSubmit = () => {
    if (stars === 0) return;
    const value = stars * 20; // 1★=20, 2★=40, ..., 5★=100
    writeContract({
      address: shopAddress,
      abi: shopAbi,
      functionName: "leaveFeedback",
      args: [BigInt(orderId), BigInt(value), 0, "starred", ""],
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs h-7">
          <Star className="h-3 w-3 mr-1" />
          Leave Review
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Review Order #{orderId}</DialogTitle>
          <DialogDescription>How was your experience?</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <StarRating value={stars} onChange={setStars} />
          {stars > 0 && (
            <p className="text-sm text-muted-foreground">
              {["", "Poor", "Fair", "Good", "Great", "Excellent"][stars]}
            </p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={stars === 0 || isPending || isConfirming}
            className="w-full"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isPending ? "Confirm in wallet…" : "Confirming…"}
              </>
            ) : (
              "Submit Review"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
