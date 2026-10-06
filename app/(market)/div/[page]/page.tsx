import { RankingPageView } from "@/components/ranking-page-view";
import { createRankingRows } from "@/lib/ranking-view";
import { getSecurityRanksPage, countSecurityRanks } from "@/lib/data/security";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { siteConfig } from "@/config/site";

export async function generateStaticParams(): Promise<Array<{ page: string }>> {
    const total = await countSecurityRanks("div");
    const totalPages = computeTotalPagesMixed(total);

    return Array.from({ length: totalPages - 1 }, (_, i) => ({
        page: (i + 2).toString(),
    }));
}

interface DivRankPageProps {
    params: Promise<{
        page: string;
    }>;
}

export async function generateMetadata({ params }: DivRankPageProps): Promise<Metadata> {
    const temp = await params
    const page = parseInt(temp.page, 10) || 1;
    const { items, latestDate } = await getSecurityRanksPage("div", page, 'desc');
    const topSecurityNames = items.slice(0, 5).map(s => s.korName || s.name);

    const title = `KOSPI·KOSDAQ 종목 배당수익률 순위 ${page}페이지`;
    const description = `${latestDate} 기준 KOSPI, KOSDAQ, KONEX 전체 종목의 배당수익률 순위 ${page}페이지입니다. ${topSecurityNames.join(', ')} 등 주요 종목의 현재가, 등락률, 거래소 정보를 확인하고 투자 기회를 포착하세요.`;

    return {
        title,
        description,
        keywords: ['종목 순위', '배당수익률 랭킹', '코스피', '코스닥', '코넥스', '주식 투자', '가치 투자', '천하제일 단타대회', ...topSecurityNames],
        alternates: {
            canonical: `${siteConfig.url}/div/${page}`,
        },
        openGraph: {
            title,
            description,
            url: `${siteConfig.url}/div/${page}`,
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
async function DivRankPage({ params }: DivRankPageProps) {
  const { page: pageParam } = await params;
  if (!/^\d+$/.test(pageParam)) notFound();
  const page = Number(pageParam);
  if (!Number.isSafeInteger(page) || page < 1) notFound();
  const [total, { items, latestDate }] = await Promise.all([
    countSecurityRanks("div"),
    getSecurityRanksPage("div", page, "desc"),
  ]);

  if (items.length === 0 || page > computeTotalPagesMixed(total)) notFound();

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
