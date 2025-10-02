import { Suspense } from "react";
import { getCompanyMarketcapsPage, countCompanyMarketcaps } from "@/lib/data/company";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { Pager } from "@/components/pager";
import type { Metadata } from "next";
import { ServerTable } from "@/components/server-table";
import { TooltipProvider } from "@/components/ui/tooltip";
import MarketcapCompactList from "@/components/marketcap-compact-list";
import { redirect } from "next/navigation";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { getLatestDateFromMarketData, getUpdatedDateFromMarketData } from "@/lib/utils";
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

    const title = `기업 시가총액 순위 ${pageNumber}페이지 | ${siteConfig.name}`;
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
    const temp = await params
    const pageNumber = parseInt(temp.page, 10) || 1;

    if (temp.page === "1") {
        return (
            <>
                <meta httpEquiv="refresh" content="0;url=/marketcaps" />
                <link rel="canonical" href="/marketcaps" />
            </>
        );
    }

    if (isNaN(pageNumber) || pageNumber < 1) {
        redirect("/marketcaps");
    }

    const { items: companies, totalPages } = await getCompanyMarketcapsPage(pageNumber);

    if ((!companies || companies.length === 0) && pageNumber > 1) {
        redirect(`/marketcaps/${totalPages}`);
    }

    const latestDate = getLatestDateFromMarketData(companies);
    const updatedDate = getUpdatedDateFromMarketData(companies);

    const csvData = companies.map(s => {
        const latestPrice = s.securities?.[0]?.prices?.length > 0 ? s.securities[0].prices[s.securities[0].prices.length - 1] : null;
        return {
            '순위': s.marketcapRank,
            '종목명': s.korName || s.name,
            '티커': `'${s.securities?.[0]?.ticker}`,
            '거래소': s.securities?.[0]?.exchange,
            '시가총액': s.marketcap,
            '시가': latestPrice?.open,
            '고가': latestPrice?.high,
            '저가': latestPrice?.low,
            '종가': latestPrice?.close,
            '등락률': latestPrice?.rate,
        };
    });

    // Early return for empty data
    if (companies.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
                <p className="text-lg text-muted-foreground">시가총액 데이터를 불러오는 중이거나 표시할 데이터가 없습니다.</p>
                <p className="text-sm text-muted-foreground mt-2">잠시 후 다시 시도해 주세요.</p>
            </div>
        );
    }

    return (
        <TooltipProvider>
            {/* Mobile/Tablet: compact list replacing large cards */}
            <div className="block md:hidden space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-foreground">시가총액 랭킹</h2>
                    <div className="text-xs text-muted-foreground">기준일 {latestDate}</div>
                </div>
                <MarketcapCompactList items={companies as any[]} metric="marketcap" />
                <div className="flex justify-end pt-2">
                    <CsvDownloadButton data={csvData} filename={`marketcaps-page-${pageNumber}-${latestDate}.csv`} />
                </div>
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden lg:block">
                <ServerTable
                    data={companies}
                    latestDate={latestDate}
                    updatedDate={updatedDate}
                    title="시가총액 기업 랭킹"
                    subTitle="코스피 · 코스닥 · 코넥스 상장 기업"
                    headerActions={<CsvDownloadButton data={csvData} filename={`marketcaps-page-${pageNumber}-${latestDate}.csv`} />}
                />
            </div>

            {/* Pagination & CTA Section */}
            <div className="mt-16 space-y-8">
                {/* Pagination */}
                <div className="flex justify-center">
                    <div className="bg-gradient-to-br from-card to-card/80 border border-border/60 rounded-2xl p-8 shadow-lg backdrop-blur-sm max-w-md w-full">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">📊</span>
                            </div>
                            <h3 className="font-bold text-xl mb-3 text-foreground">더 많은 종목 보기</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                시가총액 순위 <span className="font-semibold text-primary">{pageNumber}페이지</span>를 확인하고 있습니다
                            </p>
                        </div>
                        <Suspense fallback={
                            <div className="flex justify-center">
                                <div className="bg-card border rounded-xl p-4 shadow-sm">
                                    <div className="flex items-center space-x-3">
                                        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                                        <div className="space-y-2">
                                            <div className="animate-pulse bg-muted h-4 w-24 rounded"></div>
                                            <div className="animate-pulse bg-muted h-3 w-32 rounded"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        }>
                            <Pager
                                currentPage={pageNumber}
                                basePath="/marketcaps"
                                totalPages={totalPages}
                            />
                        </Suspense>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="text-center max-w-3xl mx-auto">
                    <div className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-xl p-6 border border-border/50">
                        <div className="flex items-center justify-center space-x-2 mb-3">
                            <span className="text-lg">💡</span>
                            <h4 className="font-bold text-base text-foreground">시가총액 지표 안내</h4>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            시가총액은 <span className="font-semibold text-primary">주가 × 발행주식수</span>로 계산됩니다.
                            기업의 전체 가치를 나타내며, 투자 규모와 위험도를 판단하는 중요한 지표입니다.
                        </p>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}

export default function Page(props: Props) {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
                </div>
            }
        >
            <MarketcapsPage {...props} />
        </Suspense>
    );
}
