import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // When offline, show a friendly page instead of a generic network error.
  navigateFallback: "/offline",
  navigateFallbackAllowlist: [/^(?!\/api\/).*/],
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  runtimeCaching: require("next-pwa/cache"),
});

const nextConfig: NextConfig = {
  experimental: {
    // Bill uploads (PDF/images) can exceed the default 1MB.
    // Next's config typing can lag the runtime option, so keep this under `experimental`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serverActions: { bodySizeLimit: "10mb" } as any,
  },
};

export default withPWA(nextConfig);
