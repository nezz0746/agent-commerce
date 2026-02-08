import CommerceHubABI from "./commercehub-abi.json";
import ShopABI from "./shop-abi.json";

export const COMMERCE_HUB_ADDRESS =
  (process.env.NEXT_PUBLIC_COMMERCE_HUB_ADDRESS as `0x${string}`) ??
  "0x479bcD43394867983d7dAE0b7280c251dFa0b935";

export const commerceHubConfig = {
  address: COMMERCE_HUB_ADDRESS,
  abi: CommerceHubABI,
} as const;

export const shopAbi = ShopABI;

export { CommerceHubABI, ShopABI };
