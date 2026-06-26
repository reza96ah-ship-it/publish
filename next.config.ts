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
  // CRITICAL: Prevent the infinite recompile/reload loop.
  // The dev script pipes output to `tee dev.log` inside the project root.
  // Without this ignore, the file watcher sees dev.log change → recompile →
  // writes more logs → recompile → infinite loop (40-60 GET/sec).
  watchOptions: {
    ignored: ["**/dev.log", "**/*.log", "**/.next/**", "**/node_modules/**"],
  },
};

export default nextConfig;
