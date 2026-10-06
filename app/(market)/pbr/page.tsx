import { RankingPageView } from "@/components/ranking-page-view";
import { createRankingRows } from "@/lib/ranking-view";
import { countSecurityRanks, getSecurityRanksPage } from "@/lib/data/security";
import type { Metadata } from "next";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
    const { items, latestDate } = await getSecurityRanksPage("pbr", 1, 'asc');
    const topSecurityNames = items.slice(0, 5).map(s => s.korName || s.name).join(', ');
    const lowPbrCompanies = items.slice(0, 3).map(s => `${s.korName || s.name}(${s.value?.toFixed(2) || 'N/A'})`).join(', ');

    const title = `주가순자산비율(PBR) 낮은 순위 - 저PBR 저평가 주식 분석`;
    const description = `${latestDate} 기준 PBR 낮은 순위 TOP. ${lowPbrCompanies} 등 청산가치보다 저평가된 가치주 분석. PBR = 주가 ÷ BPS로 계산되는 투자 지표. ${topSecurityNames} 등 ${items.length}개 종목 PBR 순위 제공. 천하제일 단타대회에서 PBR 분석.`;

    return {
        title,
        description,
        keywords: [
            'PBR',
            '주가순자산비율',
            '저PBR주',
            '저평가주',
            '청산가치',
            'BPS',
            '주당순자산가치',
            '가치 투자',
            '주식 투자',
            'PBR 순위',
            'PBR 낮은 종목',
            'PBR 분석',
            '투자 지표',
            '밸류에이션',
            '주식 순위',
            '천하제일 단타대회',
            'PBR 랭킹',
            ...(latestDate ? [latestDate] : []),
            ...items.slice(0, 10).map(s => s.korName || s.name),
        ],
        openGraph: {
            title,
            description,
            url: `${siteConfig.url}/pbr`,
            siteName: siteConfig.name,
            images: [
                {
                    url: siteConfig.ogImage,
                    width: 1200,
                    height: 630,
                    alt: `${latestDate} PBR 낮은 순위 - ${lowPbrCompanies} 등 청산가치 이하 주식 분석`,
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
            canonical: `${siteConfig.url}/pbr`,
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
async function PbrRankPage() {
  const page = 1;
  const [total, { items, latestDate }] = await Promise.all([
    countSecurityRanks("pbr"),
    getSecurityRanksPage("pbr", page, "asc"),
  ]);

  return (
    <RankingPageView
      rows={createRankingRows(items, "pbr", "security")}
      metric="pbr"
      scope="security"
      latestDate={latestDate}
      totalCount={total}
      currentPage={page}
      totalPages={computeTotalPagesMixed(total)}
      basePath="/pbr"
    />
  );
}

export default PbrRankPage;
