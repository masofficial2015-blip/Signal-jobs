import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output mode: "standalone" bundles everything needed to run in one directory.
  // This is the recommended mode for Railway, Docker, and other container deployments.
  output: "standalone",

  // Silence the "turbopack.root" warning about package-lock.json in parent dirs.
  turbopack: {
    root: __dirname,
  },

  // Never expose server-only environment variables to the browser bundle.
  // Keys NOT starting with NEXT_PUBLIC_ are already excluded by Next.js, but
  // this makes the intent explicit and blocks accidental NEXT_PUBLIC_ exposure.
  experimental: {},

  // Disable the X-Powered-By header to reduce fingerprinting surface.
  poweredByHeader: false,

  // Recommended: compress responses (gzip). Railway terminates TLS at the edge.
  compress: true,
};

export default nextConfig;
