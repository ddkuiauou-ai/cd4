import "./globals.css";
import type { Metadata, Viewport } from "next";
import { siteConfig } from "@/config/site";
import { ThemeProvider } from "@/components/providers";
import { TailwindIndicator } from "@/components/tailwind-indicator";
import { structuredData, organizationData } from "@/lib/structured-data";

// import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import GoogleAdsense from "../components/GoogleAdsense";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  metadataBase: new URL(siteConfig.url),
  description: siteConfig.description,
  keywords: [
    "시가총액",
    "삼성전자",
    "순위",
    "배당",
    "수익률",
    "SK하이닉스",
    "에코프로비엠",
    "에코프로",
    "반도체",
    "테마주",
    "전기차",
    "밧데리",
    "투자",
  ],
  authors: [
    {
      name: "천하제일단타대회",
      // url: "https://www.chunhajeil.xyz",
    },
  ],
  creator: "천하제일단타대회",

  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteConfig.url,
    title: siteConfig.name,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 1203,
        alt: siteConfig.name,
      },
    ],
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: `${siteConfig.url}/site.webmanifest`,
  // manifest: `http://localhost:3000/site.webmanifest`,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <html lang="ko" suppressHydrationWarning>
        <head>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(structuredData),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(organizationData),
            }}
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&display=swap"
            rel="stylesheet"
          />
          <link
            rel="alternate"
            href="https://www.chunhajeil.xyz"
            hrefLang="ko"
          />
        </head>

        <body className="min-h-screen bg-background antialiased">
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div vaul-drawer-wrapper="">
              <div className="relative flex min-h-screen flex-col bg-background">
                {children}
              </div>
            </div>
            {/* <TailwindIndicator /> */}
            <TailwindIndicator />
          </ThemeProvider>
        </body>
      </html>
    </>
  );
}
