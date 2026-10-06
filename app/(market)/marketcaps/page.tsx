import { RankingPageView } from "@/components/ranking-page-view";
import { createRankingRows } from "@/lib/ranking-view";
import { getCompanyMarketcapsPage } from "@/lib/data/company";
import { getLatestDateFromMarketData } from "@/lib/utils";
import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
    const { items: companies } = await getCompanyMarketcapsPage(1);
    const topCompanyNames = companies.slice(0, 3).map(c => c.korName || c.name).join(', ');
    const latestDate = getLatestDateFromMarketData(companies);

    const title = `기업 시가총액 순위`;
    const description = `${siteConfig.name}에서 제공하는 국내 기업 시가총액 순위. ${latestDate} 기준, ${topCompanyNames} 등 국내 상장 기업의 순위를 확인하세요. 보통주, 우선주 등을 모두 포함한 기업 가치 순위 정보를 제공합니다.`;

    return {
        title,
        description,
        keywords: ['주식', '시가총액', '순위', '랭킹', '투자', '기업가치', 'PER', 'PBR', '천하제일 단타대회', '삼성전자', 'SK하이닉스', 'LG에너지솔루션'],
        alternates: {
            canonical: siteConfig.url,
        },
        openGraph: {
            title,
            description,
            url: siteConfig.url,
            siteName: siteConfig.name,
            images: [
                {
                    url: siteConfig.ogImage,
                    width: 1200,
                    height: 630,
                    alt: `${siteConfig.name} - 시가총액 순위`,
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

async function HomePage() {
  const { items, totalCount, totalPages } = await getCompanyMarketcapsPage(1);
  return (
    <RankingPageView
      rows={createRankingRows(items, "marketcap", "company")}
      metric="marketcap"
      scope="company"
      latestDate={getLatestDateFromMarketData(items)}
      totalCount={totalCount}
      currentPage={1}
      totalPages={totalPages}
      basePath="/marketcaps"
    />
  );
}

export default HomePage;
