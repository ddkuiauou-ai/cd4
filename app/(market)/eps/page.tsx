import { RankingPageView } from "@/components/ranking-page-view";
import { createRankingRows } from "@/lib/ranking-view";
import { countSecurityRanks, getSecurityRanksPage } from "@/lib/data/security";
import type { Metadata } from "next";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
    const { items, latestDate } = await getSecurityRanksPage("eps", 1, 'desc');
    const topSecurityNames = items.slice(0, 5).map(s => s.korName || s.name).join(', ');
    const highEpsCompanies = items.slice(0, 3).map(s => `${s.korName || s.name}(${s.value?.toLocaleString() || 'N/A'}원)`).join(', ');

    const title = `주당순이익(EPS) 높은 순위 - 고EPS 수익성 우량주 분석`;
    const description = `${latestDate} 기준 EPS 높은 순위 TOP. ${highEpsCompanies} 등 수익성이 높은 우량주 분석. EPS = 당기순이익 ÷ 발행주식수로 계산되는 지표. ${topSecurityNames} 등 ${items.length}개 종목 EPS 순위 제공. 천하제일 단타대회에서 EPS 분석.`;

    return {
        title,
        description,
        keywords: [
            'EPS',
            '주당순이익',
            '고EPS주',
            '수익성',
            '이익률',
            'PER',
            '주가수익비율',
            '주식 투자',
            'EPS 순위',
            'EPS 높은 종목',
            'EPS 분석',
            '투자 지표',
            '수익성 분석',
            '주식 순위',
            '천하제일 단타대회',
            'EPS 랭킹',
            ...(latestDate ? [latestDate] : []),
            ...items.slice(0, 10).map(s => s.korName || s.name),
        ],
        openGraph: {
            title,
            description,
            url: `${siteConfig.url}/eps`,
            siteName: siteConfig.name,
            images: [
                {
                    url: siteConfig.ogImage,
                    width: 1200,
                    height: 630,
                    alt: `${latestDate} EPS 높은 순위 - ${highEpsCompanies} 등 수익성 높은 주식 분석`,
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
            canonical: `${siteConfig.url}/eps`,
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
async function EpsRankPage() {
  const page = 1;
  const [total, { items, latestDate }] = await Promise.all([
    countSecurityRanks("eps"),
    getSecurityRanksPage("eps", page, "desc"),
  ]);

  return (
    <RankingPageView
      rows={createRankingRows(items, "eps", "security")}
      metric="eps"
      scope="security"
      latestDate={latestDate}
      totalCount={total}
      currentPage={page}
      totalPages={computeTotalPagesMixed(total)}
      basePath="/eps"
    />
  );
}

export default EpsRankPage;
