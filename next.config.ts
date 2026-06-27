import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true, // P0-3: will be set to false after fixing 25 type errors
  },
  reactStrictMode: false, // P0-3: will be set to true after fixing type errors
  // Security headers — environment-aware.
  // Development: relaxed (frame-ancestors *, unsafe-eval) so the Z.ai preview
  //   iframe can render the app.
  // Production: strict (frame-ancestors 'self', no unsafe-eval, HSTS).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Production: SAMEORIGIN. Dev: ALLOWALL (Z.ai preview iframe).
          { key: "X-Frame-Options", value: isProd ? "SAMEORIGIN" : "ALLOWALL" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // HSTS — production only (dev uses http, HSTS would break local access)
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Dev: needs 'unsafe-eval' for Next.js dev tools. Prod: removed.
              isProd
                ? "script-src 'self' 'unsafe-inline'"
                : "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://api.gapgpt.app https://api.telegram.org https://tapi.bale.ai https://botapi.rubika.ir https://graph.facebook.com https://api.linkedin.com wss:",
              "media-src 'self' data:",
              // Production: 'self' only. Dev: * (Z.ai preview panel).
              isProd ? "frame-ancestors 'self'" : "frame-ancestors *",
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
};

export default nextConfig;
