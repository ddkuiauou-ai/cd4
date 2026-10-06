import { RankingPageView } from "@/components/ranking-page-view";
import { createRankingRows } from "@/lib/ranking-view";
import { countSecurityRanks, getSecurityRanksPage } from "@/lib/data/security";
import type { Metadata } from "next";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
    const { items, latestDate } = await getSecurityRanksPage("bps", 1, 'desc');
    const topSecurityNames = items.slice(0, 5).map(s => s.korName || s.name).join(', ');
    const highBpsCompanies = items.slice(0, 3).map(s => `${s.korName || s.name}(${s.value?.toLocaleString() || 'N/A'}원)`).join(', ');

    const title = `주당순자산가치(BPS) 높은 순위 - 고BPS 우량주 분석`;
    const description = `${latestDate} 기준 BPS 높은 순위 TOP. ${highBpsCompanies} 등 자산가치가 높은 우량주 분석. BPS = 순자산 ÷ 발행주식수로 계산되는 지표. ${topSecurityNames} 등 ${items.length}개 종목 BPS 순위 제공. 천하제일 단타대회에서 BPS 분석.`;

    return {
        title,
        description,
        keywords: [
            'BPS',
            '주당순자산가치',
            '주당순자산',
            '고BPS주',
            '우량주',
            '자산가치',
            '주식 투자',
            'BPS 순위',
            'BPS 높은 종목',
            'BPS 분석',
            '투자 지표',
            '재무건전성',
            '주식 순위',
            '천하제일 단타대회',
            'BPS 랭킹',
            ...(latestDate ? [latestDate] : []),
            ...items.slice(0, 10).map(s => s.korName || s.name),
        ],
        openGraph: {
            title,
            description,
            url: `${siteConfig.url}/bps`,
            siteName: siteConfig.name,
            images: [
                {
                    url: siteConfig.ogImage,
                    width: 1200,
                    height: 630,
                    alt: `${latestDate} BPS 높은 순위 - ${highBpsCompanies} 등 자산가치 높은 주식 분석`,
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
            canonical: `${siteConfig.url}/bps`,
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
async function BpsRankPage() {
  const page = 1;
  const [total, { items, latestDate }] = await Promise.all([
    countSecurityRanks("bps"),
    getSecurityRanksPage("bps", page, "desc"),
  ]);

  return (
    <RankingPageView
      rows={createRankingRows(items, "bps", "security")}
      metric="bps"
      scope="security"
      latestDate={latestDate}
      totalCount={total}
      currentPage={page}
      totalPages={computeTotalPagesMixed(total)}
      basePath="/bps"
    />
  );
}

export default BpsRankPage;
