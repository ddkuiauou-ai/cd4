import { RankingPageView } from "@/components/ranking-page-view";
import { createRankingRows } from "@/lib/ranking-view";
import { getSecurityRanksPage, countSecurityRanks } from "@/lib/data/security";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { siteConfig } from "@/config/site";

export async function generateStaticParams() {
    const total = await countSecurityRanks("per");
    const totalPages = computeTotalPagesMixed(total);

    return Array.from({ length: totalPages - 1 }, (_, i) => ({
        page: (i + 2).toString(),
    }));
}

interface PerRankPageProps {
    params: Promise<{
        page: string;
    }>;
}

export async function generateMetadata({ params }: PerRankPageProps): Promise<Metadata> {
    const temp = await params
    const page = parseInt(temp.page, 10) || 1;
    const { items, latestDate } = await getSecurityRanksPage("per", page, 'asc');
    const topSecurityNames = items.slice(0, 5).map(s => s.korName || s.name);

    const title = `KOSPI·KOSDAQ 종목 주가수익비율(PER) 순위 ${page}페이지`;
    const description = `${latestDate} 기준 KOSPI, KOSDAQ, KONEX 전체 종목의 주가수익비율(PER) 순위 ${page}페이지입니다. ${topSecurityNames.join(', ')} 등 주요 종목의 현재가, 등락률, 거래소 정보를 확인하고 투자 기회를 포착하세요.`;

    return {
        title,
        description,
        keywords: ['종목 순위', '주가수익비율(PER) 랭킹', '코스피', '코스닥', '코넥스', '주식 투자', '가치 투자', '천하제일 단타대회', ...topSecurityNames],
        alternates: {
            canonical: `${siteConfig.url}/per/${page}`,
        },
        openGraph: {
            title,
            description,
            url: `${siteConfig.url}/per/${page}`,
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
async function PerRankPage({ params }: PerRankPageProps) {
  const { page: pageParam } = await params;
  if (!/^\d+$/.test(pageParam)) notFound();
  const page = Number(pageParam);
  if (!Number.isSafeInteger(page) || page < 1) notFound();
  const [total, { items, latestDate }] = await Promise.all([
    countSecurityRanks("per"),
    getSecurityRanksPage("per", page, "asc"),
  ]);

  if (items.length === 0 || page > computeTotalPagesMixed(total)) notFound();

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
