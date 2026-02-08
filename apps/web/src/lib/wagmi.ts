import { http, createConfig } from "wagmi";
import { optimismSepolia } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";

export const config = createConfig(
  getDefaultConfig({
    chains: [optimismSepolia],
    transports: {
      [optimismSepolia.id]: http("https://sepolia.optimism.io"),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "",
    appName: "Onchain Commerce",
    appDescription: "Fully onchain multi-tenant e-commerce",
  })
);

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
