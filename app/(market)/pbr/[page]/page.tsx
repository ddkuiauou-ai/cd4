import { getSecurityRanksPage, countSecurityRanks } from "@/lib/data/security";
import { Pager } from "@/components/pager";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ServerTable } from "@/components/server-table";
import { TooltipProvider } from "@/components/ui/tooltip";
import PbrCompactList from "@/components/pbr-compact-list";
import { notFound } from "next/navigation";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { siteConfig } from "@/config/site";

export async function generateStaticParams() {
    const total = await countSecurityRanks("pbr");
    const totalPages = computeTotalPagesMixed(total);

    // Generate paths for page 2 onwards
    const paths = Array.from({ length: totalPages - 1 }, (_, i) => ({
        page: (i + 2).toString(),
    }));

    return paths;
}

interface PbrRankPageProps {
    params: {
        page: string;
    };
}

export async function generateMetadata({ params }: PbrRankPageProps): Promise<Metadata> {
    const temp = await params
    const page = parseInt(temp.page, 10) || 1;
    const { items, latestDate } = await getSecurityRanksPage("pbr", page, 'asc');
    const topSecurityNames = items.slice(0, 5).map(s => s.korName || s.name);

    const title = `KOSPI·KOSDAQ 종목 주가순자산비율(PBR) 순위 ${page}페이지 | ${siteConfig.name}`;
    const description = `${latestDate} 기준 KOSPI, KOSDAQ, KONEX 전체 종목의 주가순자산비율(PBR) 순위 ${page}페이지입니다. ${topSecurityNames.join(', ')} 등 주요 종목의 현재가, 등락률, 거래소 정보를 확인하고 투자 기회를 포착하세요.`;

    return {
        title,
        description,
        keywords: ['종목 순위', '주가순자산비율(PBR) 랭킹', '코스피', '코스닥', '코넥스', '주식 투자', '가치 투자', '천하제일 단타대회', ...topSecurityNames],
        alternates: {
            canonical: `${siteConfig.url}/pbr/${page}`,
        },
        openGraph: {
            title,
            description,
            url: `${siteConfig.url}/pbr/${page}`,
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

// Helper function to transform security data into the shape expected by UI components
const transformDataForUI = (securityData: any[]) => {
    return securityData.map(security => ({
        securityId: security.securityId, // Ensure securityId is passed for unique keys
        companyId: security.companyId,
        name: security.korName || security.name,
        korName: security.korName,
        logo: security.company?.logo,
        pbrRank: security.currentRank,
        pbrPriorRank: security.priorRank,
        pbr: security.pbr,
        // Nest security data to match the expected structure of ServerTable and PbrCompactList
        securities: [
            {
                exchange: security.exchange,
                ticker: security.ticker,
                prices: security.prices,
            },
        ],
    }));
};

async function PbrRankPage({ params }: PbrRankPageProps) {
    const page = parseInt(params.page, 10);
    if (isNaN(page) || page < 1) {
        notFound();
    }

    const [total, { items, latestDate }] = await Promise.all([
        countSecurityRanks("pbr"),
        getSecurityRanksPage("pbr", page, 'asc')
    ]);

    if (items.length === 0) {
        notFound();
    }

    const csvData = items.map(s => {
        const latestPrice = s.prices?.length > 0 ? s.prices[s.prices.length - 1] : null;
        return {
            '순위': s.currentRank,
            '종목명': s.korName || s.name,
            '티커': `'${s.ticker}`,
            '거래소': s.exchange,
            'PBR': s.pbr,
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
                    <h2 className="text-base font-semibold text-foreground">주가순자산비율(PBR) 종목 순위</h2>
                    <div className="text-xs text-muted-foreground">기준일 {latestDate}</div>
                </div>
                <PbrCompactList items={transformedData} />
                <div className="flex justify-end pt-2">
                    <CsvDownloadButton data={csvData} filename={`pbr-securities-page-${page}-${latestDate}.csv`} />
                </div>
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden lg:block">
                <ServerTable
                    data={transformedData}
                    latestDate={latestDate || ''}
                    updatedDate={updatedDate}
                    title="주가순자산비율(PBR) 종목 랭킹"
                    subTitle="코스피 · 코스닥 · 코넥스 상장주"
                    infoColumnHeader="종목 정보"
                    headerActions={<CsvDownloadButton data={csvData} filename={`pbr-securities-page-${page}-${latestDate}.csv`} />}
                    metric="pbr"
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
                            <Pager basePath="/pbr" currentPage={page} totalPages={totalPages} />
                        </Suspense>
                    </div>
                </div>
                {/* Additional Info */}
                <div className="text-center max-w-3xl mx-auto">
                    <div className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-xl p-6 border border-border/50">
                        <div className="flex items-center justify-center space-x-2 mb-3">
                            <span className="text-lg">💡</span>
                            <h4 className="font-bold text-base text-foreground">주가순자산비율(PBR) 지표 안내</h4>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            주가순자산비율(PBR)은 <span className="font-semibold text-primary">주가 / 주당 순자산(BPS)</span>으로 계산됩니다. PBR은 주가가 주당 순자산의 몇 배인지를 나타내는 지표로, 데이터는 매일 업데이트됩니다. 일반적으로 PBR이 낮을수록 기업이 저평가되었다고 판단합니다.
                        </p>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}

export default PbrRankPage;