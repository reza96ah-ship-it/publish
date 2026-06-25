import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryProvider } from "@/lib/query-provider";
import { MotionProvider } from "@/lib/motion";

const vazir = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "نشرینو",
    template: "%s | نشرینو",
  },
  description: "سامانه مدیریت انتشار و عملیات شبکه‌های اجتماعی — برنامه‌ریزی، تولید، انتشار و تحلیل محتوا",
  keywords: ["نشرینو", "مدیریت شبکه اجتماعی", "انتشار", "تقویم محتوا", "اینستاگرام", "روبیکا", "تلگرام"],
  authors: [{ name: "Nashrino" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazir.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh w-full overflow-hidden bg-canvas text-ink-primary font-sans" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <MotionProvider>
              {children}
            </MotionProvider>
          </QueryProvider>
          <Sonner position="top-center" dir="rtl" />
        </ThemeProvider>
        <div id="portal-root" />
      </body>
    </html>
  );
}
