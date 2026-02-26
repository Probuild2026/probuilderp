import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Bill uploads (PDF/images) can exceed the default 1MB.
    // Next's config typing can lag the runtime option, so keep this under `experimental`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serverActions: { bodySizeLimit: "10mb" } as any,
  },
};

export default nextConfig;
