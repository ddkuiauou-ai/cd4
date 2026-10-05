import { countSecurityRanks, getSecurityRanksPage } from "@/lib/data/security";
import { Pager } from "@/components/pager";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ServerTable } from "@/components/server-table";
import { TooltipProvider } from "@/components/ui/tooltip";
import DpsCompactList from "@/components/dps-compact-list";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { siteConfig } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
    const { items, latestDate } = await getSecurityRanksPage("dps", 1, 'desc');
    const topSecurityNames = items.slice(0, 5).map(s => s.korName || s.name).join(', ');
    const highDpsCompanies = items.slice(0, 3).map(s => `${s.korName || s.name}(${s.value?.toLocaleString() || 'N/A'}원)`).join(', ');

    const title = `주당배당금(DPS) 높은 순위 - 고DPS 배당주 분석`;
    const description = `${latestDate} 기준 주당배당금 높은 순위 TOP. ${highDpsCompanies} 등 배당금이 높은 주식 분석. DPS = 총배당금 ÷ 발행주식수로 계산되는 지표. ${topSecurityNames} 등 ${items.length}개 종목 주당배당금 순위 제공. 천하제일 단타대회에서 실시간 배당금 분석.`;

    return {
        title,
        description,
        keywords: [
            '주당배당금',
            'DPS',
            '고DPS주',
            '배당금',
            '배당주',
            '배당 투자',
            '인컴 투자',
            '주식 투자',
            '주당배당금 순위',
            '배당금 높은 종목',
            'DPS 분석',
            '투자 지표',
            '배당금 분석',
            '주식 순위',
            '천하제일 단타대회',
            'DPS 랭킹',
            ...(latestDate ? [latestDate] : []),
            ...items.slice(0, 10).map(s => s.korName || s.name),
        ],
        openGraph: {
            title,
            description,
            url: `${siteConfig.url}/dps`,
            siteName: siteConfig.name,
            images: [
                {
                    url: siteConfig.ogImage,
                    width: 1200,
                    height: 630,
                    alt: `${latestDate} 주당배당금 높은 순위 - ${highDpsCompanies} 등 배당금 높은 주식 분석`,
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
            canonical: `${siteConfig.url}/dps`,
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

// Helper function to transform security data into the shape expected by UI components
const transformDataForUI = (securityData: any[]) => {
    return securityData.map(security => ({
        securityId: security.securityId, // Ensure securityId is passed for unique keys
        companyId: security.companyId,
        name: security.korName || security.name,
        korName: security.korName,
        logo: security.company?.logo,
        dpsRank: security.currentRank,
        dpsPriorRank: security.priorRank,
        dps: security.value,
        // Nest security data to match the expected structure of ServerTable and DpsCompactList
        securities: [
            {
                exchange: security.exchange,
                ticker: security.ticker,
                prices: security.prices,
            },
        ],
    }));
};

async function DpsRankPage() {
    const page = 1;
    const [total, { items, latestDate }] = await Promise.all([
        countSecurityRanks("dps"),
        getSecurityRanksPage("dps", page, 'desc')
    ]);

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
                <p className="text-lg text-muted-foreground">데이터를 불러오는 중이거나 표시할 데이터가 없습니다.</p>
                <p className="text-sm text-muted-foreground mt-2">잠시 후 다시 시도해 주세요.</p>
            </div>
        );
    }

    const csvData = items.map(s => {
        const latestPrice = s.prices?.length > 0 ? s.prices[s.prices.length - 1] : null;
        return {
            '순위': s.currentRank,
            '종목명': s.korName || s.name,
            '티커': `'${s.ticker}`,
            '거래소': s.exchange,
            '주당 배당금': s.value,
            '시가': latestPrice?.open,
            '고가': latestPrice?.high,
            '저가': latestPrice?.low,
            '종가': latestPrice?.close,
            '등락률': latestPrice?.rate,
        };
    });

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
                    <h2 className="text-base font-semibold text-foreground">주당 배당금(DPS) 종목 순위</h2>
                    <div className="text-xs text-muted-foreground">기준일 {latestDate}</div>
                </div>
                <DpsCompactList items={transformedData} metric="dps" />
                <div className="flex justify-end pt-2">
                    <CsvDownloadButton data={csvData} filename={`dps-securities-page-${page}-${latestDate}.csv`} />
                </div>
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden lg:block">
                <ServerTable
                    data={transformedData}
                    latestDate={latestDate || ''}
                    updatedDate={updatedDate}
                    title="주당 배당금(DPS) 종목 랭킹"
                    subTitle="코스피 · 코스닥 · 코넥스 상장주"
                    infoColumnHeader="종목 정보"
                    headerActions={<CsvDownloadButton data={csvData} filename={`dps-securities-page-${page}-${latestDate}.csv`} />}
                    metric="dps"
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
                            <Pager basePath="/dps" currentPage={page} totalPages={totalPages} />
                        </Suspense>
                    </div>
                </div>
                {/* Additional Info */}
                <div className="text-center max-w-3xl mx-auto">
                    <div className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-xl p-6 border border-border/50">
                        <div className="flex items-center justify-center space-x-2 mb-3">
                            <span className="text-lg">💡</span>
                            <h4 className="font-bold text-base text-foreground">주당 배당금(DPS) 지표 안내</h4>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            주당 배당금(DPS)은 <span className="font-semibold text-primary">총 배당금 / 발행 주식 수</span>로 계산됩니다. DPS는 기업이 한 해 동안 주주에게 지급한 주당 현금 배당액을 나타내며, 데이터는 매일 업데이트됩니다. DPS가 높을수록 주주에게 돌아가는 이익이 많음을 의미합니다.
                        </p>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}

export default DpsRankPage;
