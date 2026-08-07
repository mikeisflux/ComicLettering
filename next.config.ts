import type { NextConfig } from "next";

/* Stamped once per build and baked into BOTH the server runtime and the
   client bundle. /api/version serves the server's copy, so a window whose
   baked stamp differs is running an older deploy — that's what Help →
   Check for Updates compares. The date prefix is only for display. */
const build = `${new Date().toISOString().slice(0, 10)}.${Date.now().toString(36)}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_LMC_BUILD: build },
};

export default nextConfig;
