import { RankingPageView } from "@/components/ranking-page-view";
import { createRankingRows } from "@/lib/ranking-view";
import { countSecurityRanks, getSecurityRanksPage } from "@/lib/data/security";
import type { Metadata } from "next";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
    const { items, latestDate } = await getSecurityRanksPage("div", 1, 'desc');
    const topSecurityNames = items.slice(0, 5).map(s => s.korName || s.name).join(', ');
    const highDivCompanies = items.slice(0, 3).map(s => `${s.korName || s.name}(${s.value?.toFixed(2) || 'N/A'}%)`).join(', ');

    const title = `배당수익률 높은 순위 - 고배당주 투자 분석`;
    const description = `${latestDate} 기준 배당수익률 높은 순위 TOP. ${highDivCompanies} 등 고배당주 분석. 배당수익률 = 주당배당금 ÷ 주가 × 100으로 계산되는 지표. ${topSecurityNames} 등 ${items.length}개 종목 배당수익률 순위 제공. 천하제일 단타대회에서 배당주 분석.`;

    return {
        title,
        description,
        keywords: [
            '배당수익률',
            '고배당주',
            '배당주',
            '주당배당금',
            'DPS',
            '배당 투자',
            '인컴 투자',
            '주식 투자',
            '배당수익률 순위',
            '배당 높은 종목',
            '배당 분석',
            '투자 지표',
            '배당주 분석',
            '주식 순위',
            '천하제일 단타대회',
            '배당 랭킹',
            ...(latestDate ? [latestDate] : []),
            ...items.slice(0, 10).map(s => s.korName || s.name),
        ],
        openGraph: {
            title,
            description,
            url: `${siteConfig.url}/div`,
            siteName: siteConfig.name,
            images: [
                {
                    url: siteConfig.ogImage,
                    width: 1200,
                    height: 630,
                    alt: `${latestDate} 배당수익률 높은 순위 - ${highDivCompanies} 등 고배당주 분석`,
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
            canonical: `${siteConfig.url}/div`,
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
async function DivRankPage() {
  const page = 1;
  const [total, { items, latestDate }] = await Promise.all([
    countSecurityRanks("div"),
    getSecurityRanksPage("div", page, "desc"),
  ]);

  return (
    <RankingPageView
      rows={createRankingRows(items, "div", "security")}
      metric="div"
      scope="security"
      latestDate={latestDate}
      totalCount={total}
      currentPage={page}
      totalPages={computeTotalPagesMixed(total)}
      basePath="/div"
    />
  );
}

export default DivRankPage;
