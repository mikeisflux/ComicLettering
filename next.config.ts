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
  /* the deploy script builds into a side directory and swaps it in, so the
     live workers keep a complete .next until the reload (see deploy.sh) */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    const security = [
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "geolocation=(), microphone=(), payment=(self \"https://www.paypal.com\")" },
    ];
    return [
      { source: "/(.*)", headers: security },
      /* the ~40MB segmentation model + ONNX runtime never change without a
         file rename — let browsers keep them */
      { source: "/models/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, immutable" }] },
      { source: "/ort/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, immutable" }] },
      { source: "/.well-known/apple-app-site-association", headers: [{ key: "Content-Type", value: "application/json" }] },
    ];
  },
};

export default nextConfig;
