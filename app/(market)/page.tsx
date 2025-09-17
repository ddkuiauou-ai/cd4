
import { getCompanyMarketcapsPage } from "@/lib/data/company";
import { getLatestDateFromMarketData, getUpdatedDateFromMarketData } from "@/lib/utils";
import { Pager } from "@/components/pager";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ServerTable } from "@/components/server-table";
import { HOME_PAGE_LIMITS } from "@/config/constants";
import { TooltipProvider } from "@/components/ui/tooltip";
import MarketcapCompactList from "@/components/marketcap-compact-list";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
    const { items: companies } = await getCompanyMarketcapsPage(1);
    const topCompanyNames = companies.slice(0, 3).map(c => c.korName || c.name).join(', ');
    const latestDate = getLatestDateFromMarketData(companies);

    const title = `실시간 기업 시가총액 순위 - ${siteConfig.name}`;
    const description = `${siteConfig.name}에서 제공하는 실시간 국내 기업 시가총액 순위. ${latestDate} 기준, ${topCompanyNames} 등 국내 상장 기업의 순위를 확인하세요. 보통주, 우선주 등을 모두 포함한 기업 가치 순위 정보를 제공합니다.`;

    return {
        title,
        description,
        keywords: ['주식', '시가총액', '순위', '랭킹', '투자', '기업가치', 'PER', 'PBR', '천하제일 단타대회', '삼성전자', 'SK하이닉스', 'LG에너지솔루션'],
        openGraph: {
            title,
            description,
            url: siteConfig.url,
            siteName: siteConfig.name,
            images: [
                {
                    url: siteConfig.ogImage,
                    width: 1200,
                    height: 630,
                    alt: `${siteConfig.name} - 시가총액 순위`,
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

async function HomePage() {
    const { items: data, totalCount } = await getCompanyMarketcapsPage(1);

    // Use utility functions for date processing
    const latestDate = getLatestDateFromMarketData(data);
    const updatedDate = getUpdatedDateFromMarketData(data);

    // Early return for empty data
    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
                <p className="text-lg text-muted-foreground">데이터를 불러오는 중이거나 표시할 데이터가 없습니다.</p>
                <p className="text-sm text-muted-foreground mt-2">잠시 후 다시 시도해 주세요.</p>
            </div>
        );
    }

    const csvData = data.map(s => {
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

    const mobileData = data.slice(0, HOME_PAGE_LIMITS.MOBILE_COMPANIES);
    const desktopData = data.slice(0, HOME_PAGE_LIMITS.DESKTOP_COMPANIES);
    const mobileCsvData = csvData.slice(0, HOME_PAGE_LIMITS.MOBILE_COMPANIES);
    const desktopCsvData = csvData.slice(0, HOME_PAGE_LIMITS.DESKTOP_COMPANIES);

    return (
        <TooltipProvider>
            {/* Mobile/Tablet: compact list replacing large cards */}
            <div className="block lg:hidden space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-foreground">시가총액 기업 랭킹</h2>
                    <div className="text-xs text-muted-foreground">기준일 {latestDate}</div>
                </div>
                <MarketcapCompactList items={mobileData} />
                <div className="flex justify-end pt-2">
                    <CsvDownloadButton data={mobileCsvData} filename={`marketcap-top${HOME_PAGE_LIMITS.MOBILE_COMPANIES}-${latestDate}.csv`} />
                </div>
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden lg:block">
                <ServerTable
                    data={desktopData}
                    latestDate={latestDate}
                    updatedDate={updatedDate}
                    headerActions={<CsvDownloadButton data={desktopCsvData} filename={`marketcap-top${HOME_PAGE_LIMITS.DESKTOP_COMPANIES}-${latestDate}.csv`} />}
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
                            <h3 className="font-bold text-xl mb-3 text-foreground">더 많은 기업 보기</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                전체 <span className="font-semibold text-primary">{totalCount.toLocaleString()}개</span> 기업 중 상위 랭킹을 확인하세요
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
                            <Pager basePath="/marketcaps" currentPage={1} />
                        </Suspense>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="text-center max-w-3xl mx-auto">
                    <div className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-xl p-6 border border-border/50">
                        <div className="flex items-center justify-center space-x-2 mb-3">
                            <span className="text-lg">💡</span>
                            <h4 className="font-bold text-base text-foreground">데이터 안내</h4>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            데이터는 매일 업데이트되며, 시가총액은 <span className="font-semibold text-primary">발행주식수 × 주가</span>로 계산됩니다.
                            더 자세한 분석과 과거 데이터는 개별 기업 페이지에서 확인하실 수 있습니다.
                        </p>
                    </div>
                </div>                </div>
        </TooltipProvider>
    );
}

export default HomePage;
