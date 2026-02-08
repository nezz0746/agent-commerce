import { formatEther } from "viem";

export function formatPrice(wei: bigint): string {
  return `${formatEther(wei)} ETH`;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
