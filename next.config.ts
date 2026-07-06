import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the container image — the runtime stage
  // copies .next/standalone instead of node_modules.
  output: "standalone",
};

export default nextConfig;
