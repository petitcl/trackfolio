import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '1mb'
    },
  },
};

export default nextConfig;
