export const DEFAULTS = {
  RPC_URL: "https://sepolia.optimism.io",
  HUB_ADDRESS: "0x479bcD43394867983d7dAE0b7280c251dFa0b935" as `0x${string}`,
  SUBGRAPH_URL:
    "https://api.studio.thegraph.com/query/958/onchain-commerce/v0.0.1",
  CHAIN_ID: 11155420,
} as const;

export function getConfig() {
  return {
    rpcUrl: process.env.COMMERCE_RPC_URL || DEFAULTS.RPC_URL,
    privateKey: process.env.COMMERCE_PRIVATE_KEY as `0x${string}` | undefined,
    hubAddress: (process.env.COMMERCE_HUB_ADDRESS ||
      DEFAULTS.HUB_ADDRESS) as `0x${string}`,
    subgraphUrl:
      process.env.COMMERCE_SUBGRAPH_URL || DEFAULTS.SUBGRAPH_URL,
  };
}
