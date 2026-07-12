import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the container image — the runtime stage
  // copies .next/standalone instead of node_modules.
  output: "standalone",
  // resvg ships a native .node binary the bundler can't inline — load it (and
  // satori alongside) from node_modules at runtime instead.
  serverExternalPackages: ["@resvg/resvg-js", "satori", "sharp"],
};

export default nextConfig;
