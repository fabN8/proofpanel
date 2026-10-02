import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages use Node features (WASM files, native crypto) and must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "@solana/web3.js", "@solana/spl-token"],
};

export default nextConfig;
