import { getSecurityRanksPage, countSecurityRanks } from "@/lib/data/security";
import { Pager } from "@/components/pager";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ServerTable } from "@/components/server-table";
import { TooltipProvider } from "@/components/ui/tooltip";
import MarketcapCompactList from "@/components/marketcap-compact-list";
import { notFound } from "next/navigation";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";

export async function generateStaticParams() {
    const total = await countSecurityRanks("marketcap");
    const totalPages = computeTotalPagesMixed(total);
    
    // Generate paths for page 2 onwards
    const paths = Array.from({ length: totalPages - 1 }, (_, i) => ({
        page: (i + 2).toString(),
    }));

    return paths;
}

interface MarketcapRankPageProps {
    params: {
        page: string;
    };
}

export async function generateMetadata({ params }: MarketcapRankPageProps): Promise<Metadata> {
    const awaitedParams = await params;
    const page = parseInt(awaitedParams.page, 10) || 1;
    return {
        title: `종목별 시가총액 순위 - ${page}페이지 - CD3`,
        description: `대한민국 주식 시장의 종목별 시가총액 순위. ${page}페이지. KOSPI, KOSDAQ, KONEX 상장주 대상.`,
    };
}

// Helper function to transform security data into the shape expected by UI components
const transformDataForUI = (securityData: any[]) => {
    return securityData.map(security => ({
        securityId: security.securityId, // Ensure securityId is passed for unique keys
        companyId: security.companyId,
        name: security.korName || security.name,
        korName: security.korName,
        logo: security.company?.logo,
        marketcapRank: security.currentRank,
        marketcapPriorRank: security.priorRank,
        marketcap: security.marketcap,
        // Nest security data to match the expected structure of ServerTable and MarketcapCompactList
        securities: [
            {
                exchange: security.exchange,
                ticker: security.ticker,
                prices: security.prices,
            },
        ],
    }));
};

async function MarketcapRankPage({ params }: MarketcapRankPageProps) {
    const awaitedParams = await params;
    const page = parseInt(awaitedParams.page, 10);
    if (isNaN(page) || page < 1) {
        notFound();
    }

    const [total, { items, latestDate }] = await Promise.all([
        countSecurityRanks("marketcap"),
        getSecurityRanksPage("marketcap", page, 'asc')
    ]);

    if (items.length === 0) {
        notFound();
    }

    const csvData = items.map(s => ({
        '순위': s.currentRank,
        '종목명': s.korName || s.name,
        '티커': s.ticker,
        '거래소': s.exchange,
        '시가총액(억)': Math.round(s.marketcap / 100000000),
        '현재가': s.prices && s.prices.length > 0 ? s.prices[s.prices.length - 1]?.close : null,
        '등락률': s.prices && s.prices.length > 0 ? s.prices[s.prices.length - 1]?.rate : null,
    }));

    const transformedData = transformDataForUI(items);
    const totalPages = computeTotalPagesMixed(total);

    const updatedDate = latestDate
        ? (() => {
            const date = new Date(latestDate);
            date.setHours(date.getHours() + 9); // KST 변환
            return date.toISOString().replace(/:\d{2}\.\d{3}Z$/, "");
        })()
        : new Date().toISOString().replace(/:\d{2}\.\d{3}Z$/, "");

    return (
        <TooltipProvider>
            {/* Mobile/Tablet: compact list */}
            <div className="block lg:hidden space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-foreground">시가총액 종목 순위</h2>
                    <div className="text-xs text-muted-foreground">기준일 {latestDate}</div>
                </div>
                <MarketcapCompactList items={transformedData} />
                <div className="flex justify-end pt-2">
                    <CsvDownloadButton data={csvData} filename={`marketcap-securities-page-${page}-${latestDate}.csv`} />
                </div>
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden lg:block">
                <ServerTable
                    data={transformedData}
                    latestDate={latestDate || ''}
                    updatedDate={updatedDate}
                    title="시가총액 종목 랭킹"
                    subTitle="코스피 · 코스닥 · 코넥스 상장주"
                    infoColumnHeader="종목 정보"
                    headerActions={<CsvDownloadButton data={csvData} filename={`marketcap-securities-page-${page}-${latestDate}.csv`} />}
                />
            </div>

            {/* Pagination & CTA Section */}
            <div className="mt-16 space-y-8">
                <div className="flex justify-center">
                    <div className="bg-gradient-to-br from-card to-card/80 border border-border/60 rounded-2xl p-8 shadow-lg backdrop-blur-sm max-w-md w-full">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-2xl">📊</span>
                            </div>
                            <h3 className="font-bold text-xl mb-3 text-foreground">더 많은 종목 보기</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                전체 <span className="font-semibold text-primary">{total.toLocaleString()}개</span> 종목 순위를 확인하세요
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
                            <Pager basePath="/marketcap" currentPage={page} totalPages={totalPages} />
                        </Suspense>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}

export default MarketcapRankPage;