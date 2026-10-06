import { RankingPageView } from "@/components/ranking-page-view";
import { createRankingRows } from "@/lib/ranking-view";
import { countSecurityRanks, getSecurityRanksPage } from "@/lib/data/security";
import type { Metadata } from "next";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
    const { items, latestDate } = await getSecurityRanksPage("per", 1, 'asc');
    const topSecurityNames = items.slice(0, 5).map(s => s.korName || s.name).join(', ');
    const lowPerCompanies = items.slice(0, 3).map(s => `${s.korName || s.name}(${s.value?.toFixed(1) || 'N/A'})`).join(', ');

    const title = `주가수익비율(PER) 낮은 순위 - 저PER 주식 종목 분석`;
    const description = `${latestDate} 기준 PER 낮은 순위 TOP. ${lowPerCompanies} 등 저평가 우량주 분석. PER = 주가 ÷ EPS로 계산되는 투자 지표. ${topSecurityNames} 등 ${items.length}개 종목 PER 순위 제공. 천하제일 단타대회에서 PER 분석.`;

    return {
        title,
        description,
        keywords: [
            'PER',
            '주가수익비율',
            '저PER주',
            '저평가주',
            '주식 투자',
            'PER 순위',
            'PER 낮은 종목',
            'PER 분석',
            '주당순이익',
            'EPS',
            '투자 지표',
            '밸류에이션',
            '가치 투자',
            '주식 순위',
            '천하제일 단타대회',
            'PER 랭킹',
            ...(latestDate ? [latestDate] : []),
            ...items.slice(0, 10).map(s => s.korName || s.name),
        ],
        openGraph: {
            title,
            description,
            url: `${siteConfig.url}/per`,
            siteName: siteConfig.name,
            images: [
                {
                    url: siteConfig.ogImage,
                    width: 1200,
                    height: 630,
                    alt: `${latestDate} PER 낮은 순위 - ${lowPerCompanies} 등 저평가 주식 분석`,
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
            canonical: `${siteConfig.url}/per`,
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
async function PerRankPage() {
  const page = 1;
  const [total, { items, latestDate }] = await Promise.all([
    countSecurityRanks("per"),
    getSecurityRanksPage("per", page, "asc"),
  ]);

  return (
    <RankingPageView
      rows={createRankingRows(items, "per", "security")}
      metric="per"
      scope="security"
      latestDate={latestDate}
      totalCount={total}
      currentPage={page}
      totalPages={computeTotalPagesMixed(total)}
      basePath="/per"
    />
  );
}

export default PerRankPage;
