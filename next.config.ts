import type { NextConfig } from "next";
import { execSync } from "child_process";

/* Stamped once per build and baked into BOTH the server runtime and the
   client bundle. /api/version serves the server's copy, so a window whose
   baked stamp differs is running an older deploy — that's what Help →
   Check for Updates compares. The date prefix is only for display. */
/* The stamp must be IDENTICAL in every bundle. `next build` evaluates this
   file in several processes (main + compiler workers), so a per-process
   Date.now() gave the client and /api/version different values and Check
   for Updates reported a new version forever. The deploy script exports
   NEXT_PUBLIC_LMC_BUILD; failing that the git commit is stable across
   processes. */
const build = process.env.NEXT_PUBLIC_LMC_BUILD || (() => {
  try {
    const sha = execSync("git rev-parse --short=10 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return `${new Date().toISOString().slice(0, 10)}.${sha}`;
  } catch { return "dev"; }
})();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_LMC_BUILD: build },
};

export default nextConfig;
