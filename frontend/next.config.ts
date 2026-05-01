import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: builds to /out folder, served by FastAPI
  // This makes it fully portable for Docker and cloud deployment
  output: "export",
  // Disable image optimization (not supported in static export without a server)
  images: {
    unoptimized: true,
  },
  // Trailing slash for compatibility when served from a sub-path
  trailingSlash: true,
};

export default nextConfig;
