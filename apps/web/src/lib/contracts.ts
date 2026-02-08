import CommerceHubABI from "./commercehub-abi.json";
import ShopABI from "./shop-abi.json";
import IdentityRegistryABI from "./identity-registry-abi.json";
import ReputationRegistryABI from "./reputation-registry-abi.json";

export const COMMERCE_HUB_ADDRESS =
  (process.env.NEXT_PUBLIC_COMMERCE_HUB_ADDRESS as `0x${string}`) ??
  "0xb16e5DF039FD6Ed176fbcCF53fEcC890219EC718";

export const IDENTITY_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS as `0x${string}`) ??
  "0x4F553f6cbD383E1e67F593F54727DAF8940b4263";

export const REPUTATION_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS as `0x${string}`) ??
  "0x2b0041A16bEa71dDAaD5Da40Cc98A2926Cd00c25";

export const commerceHubConfig = {
  address: COMMERCE_HUB_ADDRESS,
  abi: CommerceHubABI,
} as const;

export const identityRegistryConfig = {
  address: IDENTITY_REGISTRY_ADDRESS,
  abi: IdentityRegistryABI,
} as const;

export const reputationRegistryConfig = {
  address: REPUTATION_REGISTRY_ADDRESS,
  abi: ReputationRegistryABI,
} as const;

export const shopAbi = ShopABI;

export { CommerceHubABI, ShopABI, IdentityRegistryABI, ReputationRegistryABI };
