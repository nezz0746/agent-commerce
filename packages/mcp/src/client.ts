import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getConfig } from "./types.js";

const opSepolia: Chain = {
  id: 11155420,
  name: "OP Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia.optimism.io"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://optimism-sepolia.blockscout.com" },
  },
  testnet: true,
};

let _publicClient: PublicClient | null = null;
let _walletClient: WalletClient | null = null;

export function getPublicClient(): PublicClient {
  if (!_publicClient) {
    const { rpcUrl } = getConfig();
    _publicClient = createPublicClient({
      chain: opSepolia,
      transport: http(rpcUrl),
    });
  }
  return _publicClient;
}

export function getWalletClient(): WalletClient {
  if (!_walletClient) {
    const { rpcUrl, privateKey } = getConfig();
    if (!privateKey) {
      throw new Error(
        "COMMERCE_PRIVATE_KEY env var is required for write operations"
      );
    }
    const account = privateKeyToAccount(privateKey);
    _walletClient = createWalletClient({
      chain: opSepolia,
      transport: http(rpcUrl),
      account,
    });
  }
  return _walletClient;
}

export function getAccount() {
  const { privateKey } = getConfig();
  if (!privateKey) {
    throw new Error("COMMERCE_PRIVATE_KEY env var is required for write operations");
  }
  return privateKeyToAccount(privateKey);
}
