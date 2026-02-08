import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ks-workshop.vercel.app",
      },
    ],
  },
};

export default nextConfig;
