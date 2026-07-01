import type { NextConfig } from 'next'
import withBundleAnalyzer from '@next/bundle-analyzer'

const isProd = process.env.NODE_ENV === 'production'

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: false, // P0-3: type errors now fixed (0 in src/)
  },
  reactStrictMode: true,
  // Security headers — environment-aware.
  // CSP is now set per-request in src/middleware.ts with a nonce (Issue #119).
  // Other security headers stay here (they don't need per-request variation).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: isProd ? 'SAMEORIGIN' : 'ALLOWALL' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Issue #151: Permissions-Policy — restrict browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // Issue #151: cache control for sensitive pages
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          ...(isProd
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]
            : []),
        ],
      },
    ]
  },

  allowedDevOrigins: [
    'https://*.space-z.ai',
    'http://*.space-z.ai',
    'https://preview-chat-*.space-z.ai',
  ],
  serverExternalPackages: [
    'z-ai-web-dev-sdk',
    '@google/generative-ai',
    'bullmq',
    '@bull-board/api',
    '@bull-board/express',
  ],
}

export default withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })(nextConfig)
