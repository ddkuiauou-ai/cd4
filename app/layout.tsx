import "./globals.css";
import type { Metadata, Viewport } from "next";
import { siteConfig } from "@/config/site";
import { ThemeProvider } from "@/components/providers";
import localFont from "next/font/local";
import { DocumentNavigationFeedback } from "@/components/document-navigation-feedback";
import { usesStaticDocuments } from "@/components/site-document-link";

// import { SpeedInsights } from "@vercel/speed-insights/next";
const recordsFont = localFont({ src: "./fonts/ChosunGs.ttf", weight: "400", display: "swap", preload: false, variable: "--font-records" });

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  metadataBase: new URL(siteConfig.url),
  description: siteConfig.description,
  keywords: [
    // 브랜드 키워드
    "천하제일 단타대회",
    "천단",
    "한국 주식",
    "주식 투자",
    "주식 분석",

    // 시가총액 관련
    "시가총액",
    "시가총액 순위",
    "기업 가치",
    "시장 점유율",

    // 재무 지표
    "PER",
    "주가수익비율",
    "PBR",
    "주가순자산비율",
    "EPS",
    "주당순이익",
    "BPS",
    "주당순자산가치",
    "배당수익률",
    "주당배당금",

    // 주요 기업
    "삼성전자",
    "SK하이닉스",
    "LG에너지솔루션",
    "현대자동차",
    "POSCO",
    "셀트리온",
    "삼성바이오로직스",

    // 산업 키워드
    "반도체",
    "전기차",
    "배터리",
    "바이오",
    "금융",
    "화학",
    "철강",

    // 투자 용어
    "주식 순위",
    "기업 분석",
    "재무제표",
    "투자 정보",
    "주식 추천",
  ],
  authors: [
    {
      name: siteConfig.name,
      url: siteConfig.url,
    },
  ],
  creator: siteConfig.name,
  publisher: siteConfig.name,

  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },

  alternates: {
    canonical: siteConfig.url,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteConfig.url,
    title: siteConfig.name,
    siteName: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - 한국 주식 시장 전문 투자 정보 서비스`,
        type: "image/png",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: "@chundan_xyz",
    site: "@chundan_xyz",
  },

  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: `${siteConfig.url}/site.webmanifest`,

  category: "finance",
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
      <html lang="ko" className={recordsFont.variable} suppressHydrationWarning>
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
            {usesStaticDocuments && <DocumentNavigationFeedback />}

          </ThemeProvider>
        </body>
      </html>
    </>
  );
}
