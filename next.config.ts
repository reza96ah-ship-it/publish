import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the Z.ai preview panel to use Next.js dev HMR websocket.
  allowedDevOrigins: [
    "https://*.space-z.ai",
    "http://*.space-z.ai",
    "https://preview-chat-*.space-z.ai",
  ],
  // Note: The recompile/reload loop was fixed by moving ALL log files to
  // /tmp (outside the project root). The dev script writes to
  // /tmp/nashrino-dev.log and mini-services write to /tmp/nashrino-logs/.
  // Next.js 16's file watcher only watches the project directory, so
  // external logs can't trigger recompiles.
};

export default nextConfig;
