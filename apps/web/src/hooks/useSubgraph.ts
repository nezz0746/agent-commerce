"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchShops,
  fetchShop,
  fetchProducts,
  fetchOrders,
  fetchShopOrders,
  fetchFeedbacks,
  fetchAgent,
  fetchReviews,
} from "@/lib/subgraph";

export function useShops() {
  return useQuery({
    queryKey: ["subgraph", "shops"],
    queryFn: fetchShops,
    staleTime: 30_000,
  });
}

export function useShop(address: string | undefined) {
  return useQuery({
    queryKey: ["subgraph", "shop", address],
    queryFn: () => fetchShop(address!),
    enabled: !!address,
    staleTime: 30_000,
  });
}

export function useProducts(shopAddress: string | undefined) {
  return useQuery({
    queryKey: ["subgraph", "products", shopAddress],
    queryFn: () => fetchProducts(shopAddress!),
    enabled: !!shopAddress,
    staleTime: 30_000,
  });
}

export function useOrders(customerAddress?: string) {
  return useQuery({
    queryKey: ["subgraph", "orders", customerAddress ?? "all"],
    queryFn: () => fetchOrders(customerAddress),
    staleTime: 15_000,
  });
}

export function useShopOrders(shopAddress: string | undefined) {
  return useQuery({
    queryKey: ["subgraph", "shopOrders", shopAddress],
    queryFn: () => fetchShopOrders(shopAddress!),
    enabled: !!shopAddress,
    staleTime: 15_000,
  });
}

export function useFeedbacks(agentId: string | undefined) {
  return useQuery({
    queryKey: ["subgraph", "feedbacks", agentId],
    queryFn: () => fetchFeedbacks(agentId!),
    enabled: !!agentId,
    staleTime: 30_000,
  });
}

export function useAgent(agentId: string | undefined) {
  return useQuery({
    queryKey: ["subgraph", "agent", agentId],
    queryFn: () => fetchAgent(agentId!),
    enabled: !!agentId,
    staleTime: 60_000,
  });
}

export function useReviews(shopAddress: string | undefined) {
  return useQuery({
    queryKey: ["subgraph", "reviews", shopAddress],
    queryFn: () => fetchReviews(shopAddress!),
    enabled: !!shopAddress,
    staleTime: 30_000,
  });
}
