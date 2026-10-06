import { RankingPageView } from "@/components/ranking-page-view";
import { createRankingRows } from "@/lib/ranking-view";
import { countSecurityRanks, getSecurityRanksPage } from "@/lib/data/security";
import type { Metadata } from "next";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
    const { items, latestDate } = await getSecurityRanksPage("marketcap", 1, 'asc');
    const topSecurityNames = items.slice(0, 3).map((s: any) => s.korName || s.name).join(', ');

    const title = `종목별 시가총액 순위`;
    const description = `${siteConfig.name}에서 제공하는 종목별 시가총액 순위. ${latestDate} 기준, ${topSecurityNames} 등 국내 상장 종목의 순위를 확인하세요.`;

    return {
        title,
        description,
        keywords: ['주식', '시가총액', '순위', '종목', '랭킹', '투자', 'PER', 'PBR', '천하제일 단타 대회'],
        alternates: {
            canonical: `${siteConfig.url}/marketcap/`,
        },
        openGraph: {
            title,
            description,
            url: `${siteConfig.url}/marketcap/`,
            siteName: siteConfig.name,
            images: [
                {
                    url: siteConfig.ogImage,
                    width: 1200,
                    height: 630,
                    alt: `${siteConfig.name} - 종목별 시가총액 순위`,
                },
            ],
            locale: 'ko_KR',
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [siteConfig.ogImage],
        },
        metadataBase: new URL(siteConfig.url),
    };
}
async function MarketcapRankPage() {
  const page = 1;
  const [total, { items, latestDate }] = await Promise.all([
    countSecurityRanks("marketcap"),
    getSecurityRanksPage("marketcap", page, "asc"),
  ]);

  return (
    <RankingPageView
      rows={createRankingRows(items, "marketcap", "security")}
      metric="marketcap"
      scope="security"
      latestDate={latestDate}
      totalCount={total}
      currentPage={page}
      totalPages={computeTotalPagesMixed(total)}
      basePath="/marketcap"
    />
  );
}

export default MarketcapRankPage;
