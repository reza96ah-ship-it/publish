import type { Metadata, Viewport } from 'next'
import { Vazirmatn } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { ThemeProvider } from 'next-themes'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { QueryProvider } from '@/lib/query-provider'
import { MotionProvider } from '@/lib/motion'
import { NextAuthSessionProvider } from '@/components/providers/session-provider'
import { WebVitals } from '@/components/providers/web-vitals'
import { LiveRegionProvider } from '@/lib/aria-live'
import { ServiceWorkerRegistrar } from '@/components/shell/service-worker-registrar'
import { InstallPrompt } from '@/components/shell/install-prompt'
import { OfflineIndicator } from '@/components/shell/offline-indicator'
import { RtlProvider } from '@/components/providers/direction-provider'

const vazir = Vazirmatn({
  subsets: ['arabic', 'latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'نشرینو',
    template: '%s | نشرینو',
  },
  description:
    'سامانه مدیریت انتشار و عملیات شبکه‌های اجتماعی — برنامه‌ریزی، تولید، انتشار و تحلیل محتوا',
  keywords: [
    'نشرینو',
    'مدیریت شبکه اجتماعی',
    'انتشار',
    'تقویم محتوا',
    'اینستاگرام',
    'روبیکا',
    'تلگرام',
  ],
  authors: [{ name: 'Nashrino' }],
  // Explicit icon link — without it browsers request /favicon.ico, which
  // doesn't exist (we only ship the SVG logo) and 404s on every page load.
  icons: {
    icon: [{ url: '/logo.svg', type: 'image/svg+xml' }],
  },
  // Issue #220: PWA manifest link — points the browser at /manifest.json so
  // the install prompt + standalone display mode work.
  manifest: '/manifest.json',
  applicationName: 'نشرینو',
  appleWebApp: {
    capable: true,
    title: 'نشرینو',
    statusBarStyle: 'default',
  },
}

// Issue #220: PWA theme color (matches manifest.json + brand primary).
export const viewport: Viewport = {
  themeColor: 'var(--n-accent)',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Reading headers() opts the entire app out of static rendering so that
  // Next.js can inject the per-request CSP nonce (set by middleware via
  // x-nonce) into its own <script> tags on every response.
  await headers()

  return (
    <html lang="fa" dir="rtl" className={`${vazir.variable} antialiased`} suppressHydrationWarning>
      <body
        className="min-h-dvh w-full overflow-hidden bg-canvas text-ink-primary font-sans"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <RtlProvider>
              <MotionProvider>
                <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
              </MotionProvider>
            </RtlProvider>
          </QueryProvider>
          <Sonner position="top-center" dir="rtl" />
          {/* aria-live announce regions — mounted once at the root so every
              page (including /auth/signin, which has no AppShell) can announce */}
          <LiveRegionProvider />
          {/* Issue #127: collect Core Web Vitals (LCP/INP/CLS) → /api/vitals → Prometheus */}
          <WebVitals />
          {/* Issue #220: PWA — SW registration + install prompt + offline badge */}
          <ServiceWorkerRegistrar />
          <InstallPrompt />
          <div aria-hidden="true" className="fixed bottom-4 start-4 z-40 pointer-events-none">
            <div className="pointer-events-auto">
              <OfflineIndicator />
            </div>
          </div>
        </ThemeProvider>
        <div id="portal-root" />
      </body>
    </html>
  )
}
