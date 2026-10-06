import { RankingPageView } from "@/components/ranking-page-view";
import { createRankingRows } from "@/lib/ranking-view";
import { countSecurityRanks, getSecurityRanksPage } from "@/lib/data/security";
import type { Metadata } from "next";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
    const { items, latestDate } = await getSecurityRanksPage("dps", 1, 'desc');
    const topSecurityNames = items.slice(0, 5).map(s => s.korName || s.name).join(', ');
    const highDpsCompanies = items.slice(0, 3).map(s => `${s.korName || s.name}(${s.value?.toLocaleString() || 'N/A'}원)`).join(', ');

    const title = `주당배당금(DPS) 높은 순위 - 고DPS 배당주 분석`;
    const description = `${latestDate} 기준 주당배당금 높은 순위 TOP. ${highDpsCompanies} 등 배당금이 높은 주식 분석. DPS = 총배당금 ÷ 발행주식수로 계산되는 지표. ${topSecurityNames} 등 ${items.length}개 종목 주당배당금 순위 제공. 천하제일 단타대회에서 배당금 분석.`;

    return {
        title,
        description,
        keywords: [
            '주당배당금',
            'DPS',
            '고DPS주',
            '배당금',
            '배당주',
            '배당 투자',
            '인컴 투자',
            '주식 투자',
            '주당배당금 순위',
            '배당금 높은 종목',
            'DPS 분석',
            '투자 지표',
            '배당금 분석',
            '주식 순위',
            '천하제일 단타대회',
            'DPS 랭킹',
            ...(latestDate ? [latestDate] : []),
            ...items.slice(0, 10).map(s => s.korName || s.name),
        ],
        openGraph: {
            title,
            description,
            url: `${siteConfig.url}/dps`,
            siteName: siteConfig.name,
            images: [
                {
                    url: siteConfig.ogImage,
                    width: 1200,
                    height: 630,
                    alt: `${latestDate} 주당배당금 높은 순위 - ${highDpsCompanies} 등 배당금 높은 주식 분석`,
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
            canonical: `${siteConfig.url}/dps`,
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
async function DpsRankPage() {
  const page = 1;
  const [total, { items, latestDate }] = await Promise.all([
    countSecurityRanks("dps"),
    getSecurityRanksPage("dps", page, "desc"),
  ]);

  return (
    <RankingPageView
      rows={createRankingRows(items, "dps", "security")}
      metric="dps"
      scope="security"
      latestDate={latestDate}
      totalCount={total}
      currentPage={page}
      totalPages={computeTotalPagesMixed(total)}
      basePath="/dps"
    />
  );
}

export default DpsRankPage;
