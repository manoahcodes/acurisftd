import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,

  // Hosts allowed to load dev scripts (your tunnel).
  allowedDevOrigins: ["jqm5236t-3000.inc1.devtunnels.ms"],

  experimental: {
    // Remember the security upgrade policy so future upgrades can suggest safe releases.
    agentUpgrade: "security",
    serverActions: {
      // Logo uploads are validated at 3 MB, and the Portal pages form can carry nine 1.5 MB photos
      // (banner, about, sign-in, register, five slides). The default 1 MB body limit would reject them first.
      bodySizeLimit: "16mb",
      // Hosts allowed to call Server Actions (host only, no scheme).
      allowedOrigins: ["jqm5236t-3000.inc1.devtunnels.ms"],
    },
  },

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