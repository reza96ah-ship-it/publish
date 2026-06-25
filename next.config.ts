import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the Z.ai preview panel (and any *.space-z.ai preview host) to use
  // Next.js dev-only HMR / fast-refresh websocket without cross-origin warnings.
  allowedDevOrigins: [
    "https://*.space-z.ai",
    "http://*.space-z.ai",
    "https://preview-chat-*.space-z.ai",
  ],
};

export default nextConfig;
