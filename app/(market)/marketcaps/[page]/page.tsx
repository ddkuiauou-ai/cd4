import { RankingPageView } from "@/components/ranking-page-view";
import { createRankingRows } from "@/lib/ranking-view";
import { getCompanyMarketcapsPage, countCompanyMarketcaps } from "@/lib/data/company";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLatestDateFromMarketData } from "@/lib/utils";
import { siteConfig } from "@/config/site";

export async function generateStaticParams() {
    const count = await countCompanyMarketcaps();
    const totalPages = computeTotalPagesMixed(count);
    return Array.from({ length: totalPages }, (_, i) => ({ page: (i + 1).toString() }));
}

type Props = {
    params: Promise<{ page: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { page: pageParam } = await params;
    const pageNumber = parseInt(pageParam, 10) || 1;
    const { items: companies } = await getCompanyMarketcapsPage(pageNumber);
    const topCompanyNames = companies.slice(0, 5).map(c => c.korName || c.name).filter((name): name is string => name !== null && name !== undefined);
    const latestDate = getLatestDateFromMarketData(companies);

    const title = `기업 시가총액 순위 ${pageNumber}페이지`;
    const description = `${latestDate} 기준 KOSPI, KOSDAQ, KONEX 상장 기업의 시가총액 순위 ${pageNumber}페이지입니다. ${topCompanyNames.join(', ')} 등 주요 기업의 순위를 확인하세요. (보통주+우선주 합산)`;

    return {
        title,
        description,
        keywords: ['기업 순위', '시가총액', '랭킹', '코스피', '코스닥', 'KOSPI', 'KOSDAQ', '주식 정보', '천하제일 단타 대회', ...topCompanyNames],
        alternates: {
            canonical: `${siteConfig.url}/marketcaps/${pageNumber}`,
        },
        openGraph: {
            title,
            description,
            url: `${siteConfig.url}/marketcaps/${pageNumber}`,
            siteName: siteConfig.name,
            images: [
                {
                    url: siteConfig.ogImage,
                    width: 1200,
                    height: 630,
                    alt: title,
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

async function MarketcapsPage({ params }: Props) {
  const { page: pageParam } = await params;
  if (!/^\d+$/.test(pageParam)) redirect("/marketcaps");
  const pageNumber = Number(pageParam);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1) redirect("/marketcaps");
  if (pageNumber === 1) {
    return <><meta httpEquiv="refresh" content="0;url=/marketcaps" /><link rel="canonical" href="/marketcaps" /></>;
  }

  const { items, totalCount, totalPages } = await getCompanyMarketcapsPage(pageNumber);
  if (pageNumber > totalPages || items.length === 0) {
    redirect(totalPages > 1 ? `/marketcaps/${totalPages}` : "/marketcaps");
  }

  return (
    <RankingPageView
      rows={createRankingRows(items, "marketcap", "company")}
      metric="marketcap"
      scope="company"
      latestDate={getLatestDateFromMarketData(items)}
      totalCount={totalCount}
      currentPage={pageNumber}
      totalPages={totalPages}
      basePath="/marketcaps"
    />
  );
}

export default MarketcapsPage;
