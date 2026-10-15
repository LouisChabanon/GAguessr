import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Mode-less URLs (and links from before modes existed) open the power plants game.
  redirects: async () => [{ source: "/play", destination: "/play/fr-nuclear-plants", permanent: false }],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
