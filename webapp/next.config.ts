import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '1mb'
    },
  },
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
