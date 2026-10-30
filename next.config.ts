import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Room photos are resized in the browser, but still need more than the 1 MB default.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
