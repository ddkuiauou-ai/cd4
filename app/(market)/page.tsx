import { RankingPageView } from "@/components/ranking-page-view";
import { createRankingRows } from "@/lib/ranking-view";
import { getCompanyMarketcapsPage } from "@/lib/data/company";
import { getLatestDateFromMarketData } from "@/lib/utils";
import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
    const { items: companies } = await getCompanyMarketcapsPage(1);
    const topCompanyNames = companies.slice(0, 5).map(c => c.korName || c.name).join(', ');
    const latestDate = getLatestDateFromMarketData(companies);

    const title = `시가총액 순위`;
    const description = `${latestDate} 기준 국내 기업 시가총액 순위. ${topCompanyNames} 등 ${companies.length}개 기업의 가치 순위를 확인하세요. PER, PBR, EPS, BPS, 배당수익률 등 주요 투자지표 제공. 한국 주식 시장 전문 분석 플랫폼.`;

    return {
        title,
        description,
        keywords: [
            '시가총액 순위',
            '기업 가치',
            '주식 랭킹',
            '시장 점유율',
            '투자 분석',
            '재무 지표',
            'PER',
            'PBR',
            'EPS',
            'BPS',
            '배당수익률',
            '한국 주식',
            '주식 투자',
            '기업 분석',
            '기준일 데이터',
            '주식 순위',
            '시가총액 랭킹',
            '삼성전자',
            'SK하이닉스',
            'LG에너지솔루션',
            '현대자동차',
            'POSCO',
            '셀트리온',
            '천하제일 단타대회',
            '천단',
            latestDate,
        ],
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
                    alt: `${latestDate} 시가총액 순위 - ${topCompanyNames} 등 ${companies.length}개 기업 분석`,
                    type: 'image/png',
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
            site: '@chundan_xyz',
            creator: '@chundan_xyz',
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
                'max-image-preview': 'large',
                'max-snippet': -1,
                'max-video-preview': -1,
            },
        },
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
