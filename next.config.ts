import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Security headers
  // NOTE: frame-ancestors and X-Frame-Options are relaxed to allow the Z.ai
  // preview panel (which embeds this app in a cross-origin iframe) to render.
  // In production, tighten these to frame-ancestors 'self' and remove ALLOWALL.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Allow the Z.ai preview iframe to embed this app
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://api.gapgpt.app https://api.telegram.org https://tapi.bale.ai https://botapi.rubika.ir https://graph.facebook.com https://api.linkedin.com wss:",
              "media-src 'self' data:",
              // Allow framing from any origin (Z.ai preview panel)
              "frame-ancestors *",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Allow the Z.ai preview panel to use Next.js dev HMR websocket.
  allowedDevOrigins: [
    "https://*.space-z.ai",
    "http://*.space-z.ai",
    "https://preview-chat-*.space-z.ai",
  ],
  serverExternalPackages: ["z-ai-web-dev-sdk", "@google/generative-ai"],

  // Note: The recompile/reload loop was fixed by moving ALL log files to
  // /tmp (outside the project root). The dev script writes to
  // /tmp/nashrino-dev.log and mini-services write to /tmp/nashrino-logs/.
  // Next.js 16's file watcher only watches the project directory, so
  // external logs can't trigger recompiles.
};

export default nextConfig;
