import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Room photos are resized in the browser, but still need more than the 1 MB default.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // The page used to be called Vault; old links still land in the right place.
  async redirects() {
    return [
      { source: "/vault", destination: "/my-stuff", permanent: true },
      { source: "/vault/:id", destination: "/my-stuff/:id", permanent: true },
    ];
  },
};

export default nextConfig;
