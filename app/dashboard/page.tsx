import { SiteFooter } from "@/components/site-footer";
import { getCompanyMarketcapsPage } from "@/lib/data/company";
import { formatNumber } from "@/lib/utils";
import Rate from "@/components/rate";
import { Badge } from "@/components/ui/badge";
import Exchange from "@/components/exchange";
import Link from "next/link";
import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import CompanyLogo from "@/components/CompanyLogo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MarketTrends from "@/components/MarketTrends";

export const metadata: Metadata = {
    title: "대시보드 - CD3 주식 시장 분석",
    description: "주식 시장의 주요 지표와 랭킹을 한눈에 확인할 수 있는 대시보드입니다.",
    alternates: { canonical: `${siteConfig.url}/dashboard/` },
    openGraph: {
        url: `${siteConfig.url}/dashboard/`,
        title: "대시보드 - CD3 주식 시장 분석",
        description: "시가총액, PER, PBR 등 주요 지표 랭킹을 제공합니다.",
        images: ['/opengraph-image.png']
    }
};

type DashboardCompany = Awaited<ReturnType<typeof getCompanyMarketcapsPage>>["items"][number];

function getLatestPrice(company: DashboardCompany) {
    return company.securities?.[0]?.prices?.at(-1);
}

async function DashboardPage() {
    const { items: data, totalCount } = await getCompanyMarketcapsPage(1);

    const latestDate = data[0]?.marketcapDate
        ? new Date(data[0].marketcapDate).toISOString().split("T")[0]
        : "미확인";
    const priceDate = data[0] ? getLatestPrice(data[0])?.date : undefined;
    const latestPriceDate = priceDate
        ? new Date(priceDate).toISOString().split("T")[0]
        : "미확인";

    // 시가총액 상위 10개 기업
    const topMarketCaps = data.slice(0, 10);

    // 상승률 상위 기업들 (데이터가 있는 경우)
    const topGainers = data
        .filter(company => getLatestPrice(company))
        .map(company => {
            const latestPrice = getLatestPrice(company);
            return {
                ...company,
                rate: latestPrice?.rate ?? 0
            };
        })
        .filter(item => item.rate > 0)
        .sort((a, b) => (b.rate || 0) - (a.rate || 0))
        .slice(0, 5);

    // 하락률 상위 기업들
    const topLosers = data
        .filter(company => getLatestPrice(company))
        .map(company => {
            const latestPrice = getLatestPrice(company);
            return {
                ...company,
                rate: latestPrice?.rate ?? 0
            };
        })
        .filter(item => item.rate < 0)
        .sort((a, b) => (a.rate || 0) - (b.rate || 0))
        .slice(0, 5);


    // Trending stocks data
    const trendingStocks = {
        gainers: topGainers.slice(0, 5).map(item => ({
            name: item.name || "",
            korName: item.name || "",
            securityId: item.securities?.[0]?.securityId || "",
            price: getLatestPrice(item)?.close ?? 0,
            change: item.rate || 0,
            changePercent: item.rate || 0
        })),
        losers: topLosers.slice(0, 5).map(item => ({
            name: item.name || "",
            korName: item.name || "",
            securityId: item.securities?.[0]?.securityId || "",
            price: getLatestPrice(item)?.close ?? 0,
            change: item.rate || 0,
            changePercent: item.rate || 0
        })),
        volume: data.filter(company => getLatestPrice(company)).slice(0, 5).map(item => ({
            name: item.name || "",
            korName: item.name || "",
            securityId: item.securities?.[0]?.securityId || "",
            price: getLatestPrice(item)?.close ?? 0,
            change: getLatestPrice(item)?.rate ?? 0,
            changePercent: getLatestPrice(item)?.rate ?? 0
        }))
    };

    if (data.length === 0) {
        return (
            <>
                <main className="flex-1">
                    <div className="container px-4 sm:px-8 relative">
                        <h1 className="text-3xl font-bold tracking-tight mb-8">대시보드</h1>
                        <Card className="mb-8">
                            <CardHeader>
                                <CardTitle>표시할 기업 데이터가 없습니다</CardTitle>
                                <CardDescription>
                                    시가총액 순위를 조회할 수 있는 기업 데이터가 아직 없습니다.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href="/" className="text-primary hover:underline">랭킹으로 이동 →</Link>
                            </CardContent>
                        </Card>
                    </div>
                </main>
                <SiteFooter />
            </>
        );
    }

    return (
        <>

            <main className="flex-1">
                <div className="container px-4 sm:px-8 relative">
                    {/* <MarketNav className="mt-5" /> */}

                    {/* Dashboard Header */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
                                <p className="text-muted-foreground mt-2">
                                    주식 시장의 주요 지표와 랭킹을 한눈에 확인하세요
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    시가총액 기준일: {latestDate}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    가격 기준일: {latestPriceDate}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">총 상장기업</CardTitle>
                                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalCount.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground">상장 기업 수</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">시가총액 1위</CardTitle>
                                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {topMarketCaps[0]?.name || "—"}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {topMarketCaps[0]?.marketcap ? formatNumber(topMarketCaps[0].marketcap) : "—"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">상승률 1위</CardTitle>
                                <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {topGainers[0]?.name || "—"}
                                </div>
                                <p className="text-xs text-green-600">
                                    {topGainers[0]?.rate ? `+${topGainers[0].rate.toFixed(2)}%` : "—"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">하락률 1위</CardTitle>
                                <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                </svg>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {topLosers[0]?.name || "—"}
                                </div>
                                <p className="text-xs text-red-600">
                                    {topLosers[0]?.rate ? `${topLosers[0].rate.toFixed(2)}%` : "—"}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Market Trends Section */}
                    <div className="mb-8">
                        <MarketTrends
                            gainers={trendingStocks.gainers}
                            losers={trendingStocks.losers}
                            volume={trendingStocks.volume}
                            date={latestPriceDate}
                        />
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8 mb-8">
                        {/* 시가총액 TOP 10 */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>시가총액 TOP 10</span>
                                    <Link href="/marketcaps" className="text-sm text-primary hover:underline">
                                        전체보기 →
                                    </Link>
                                </CardTitle>
                                <CardDescription>
                                    시가총액 기준 상위 10개 기업
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {topMarketCaps.slice(0, 5).map((company, index) => {
                                        if (!company.securities || company.securities.length === 0) return null;
                                        const security = company.securities[0];
                                        const { close, rate } = getLatestPrice(company) || {};

                                        return (
                                            <div key={company.companyId} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                                                <div className="flex items-center space-x-3">
                                                    <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                                                        {index + 1}
                                                    </Badge>
                                                    <Link href={`/company/${security.exchange}.${security.ticker}`}>
                                                        <CompanyLogo
                                                            companyName={company.name}
                                                            logoUrl={company.logo}
                                                            size={32}
                                                        />
                                                    </Link>
                                                    <div>
                                                        <Link href={`/company/${security.exchange}.${security.ticker}`} className="font-medium hover:text-primary">
                                                            {company.name}
                                                        </Link>
                                                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                                            <Exchange exchange={security.exchange as string} />
                                                            <span>{close != null ? `${close.toLocaleString()}원` : "—"}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-medium text-sm">
                                                        {company.marketcap != null ? formatNumber(company.marketcap) : "—"}
                                                    </div>
                                                    {rate != null ? <Rate rate={rate} /> : <span>—</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 등락률 랭킹 */}
                        <Card>
                            <CardHeader>
                                <CardTitle>등락률 랭킹</CardTitle>
                                <CardDescription>
                                    상승률과 하락률 상위 기업들
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {/* 상승률 TOP 3 */}
                                    <div>
                                        <h4 className="text-sm font-medium text-green-600 mb-3 flex items-center">
                                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                            </svg>
                                            상승률 TOP 3
                                        </h4>
                                        <div className="space-y-2">
                                            {topGainers.slice(0, 3).map((item, index) => (
                                                <div key={item.companyId} className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-950/20">
                                                    <div className="flex items-center space-x-2">
                                                        <Badge variant="secondary" className="w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs">
                                                            {index + 1}
                                                        </Badge>
                                                        <span className="text-sm font-medium">{item.name}</span>
                                                    </div>
                                                    <span className="text-sm text-green-600 font-medium">
                                                        +{item.rate.toFixed(2)}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 하락률 TOP 3 */}
                                    <div>
                                        <h4 className="text-sm font-medium text-red-600 mb-3 flex items-center">
                                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                            </svg>
                                            하락률 TOP 3
                                        </h4>
                                        <div className="space-y-2">
                                            {topLosers.slice(0, 3).map((item, index) => (
                                                <div key={item.companyId} className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-950/20">
                                                    <div className="flex items-center space-x-2">
                                                        <Badge variant="secondary" className="w-6 h-6 rounded-full flex items-center justify-center p-0 text-xs">
                                                            {index + 1}
                                                        </Badge>
                                                        <span className="text-sm font-medium">{item.name}</span>
                                                    </div>
                                                    <span className="text-sm text-red-600 font-medium">
                                                        {item.rate.toFixed(2)}%
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>                        </Card>
                    </div>

                    {/* Market News Section */}
                    <div className="mb-8">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>시장 뉴스 및 분석</span>
                                    <Link href="/news" className="text-sm text-primary hover:underline">
                                        전체보기 →
                                    </Link>
                                </CardTitle>
                                <CardDescription>
                                    최신 시장 동향과 주요 기업 뉴스
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="border-l-4 border-blue-500 pl-4 py-2">
                                        <h4 className="font-medium text-sm mb-1">코스피, 외국인 매수세에 상승 마감</h4>
                                        <p className="text-xs text-muted-foreground mb-2">오늘 코스피는 외국인 투자자들의 매수세에 힘입어 0.8% 상승하며 2,500선을 회복했습니다.</p>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>2024.01.15 16:30</span>
                                            <Badge variant="outline" className="text-xs">시장동향</Badge>
                                        </div>
                                    </div>

                                    <div className="border-l-4 border-green-500 pl-4 py-2">
                                        <h4 className="font-medium text-sm mb-1">삼성전자, AI 반도체 투자 확대 발표</h4>
                                        <p className="text-xs text-muted-foreground mb-2">삼성전자가 AI 반도체 분야에 10조원 규모의 투자를 발표하며 기술주 랠리를 주도했습니다.</p>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>2024.01.15 14:20</span>
                                            <Badge variant="outline" className="text-xs">기업뉴스</Badge>
                                        </div>
                                    </div>

                                    <div className="border-l-4 border-orange-500 pl-4 py-2">
                                        <h4 className="font-medium text-sm mb-1">연준 금리 동결 기조 유지 전망</h4>
                                        <p className="text-xs text-muted-foreground mb-2">미국 연준이 금리 동결 기조를 유지할 것으로 전망되며 글로벌 증시에 긍정적 영향을 미치고 있습니다.</p>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>2024.01.15 11:45</span>
                                            <Badge variant="outline" className="text-xs">국제뉴스</Badge>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Watchlist Section */}
                    <div className="mb-8">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>관심 종목</span>
                                    <Link href="/watchlist" className="text-sm text-primary hover:underline">
                                        관리 →
                                    </Link>
                                </CardTitle>
                                <CardDescription>
                                    즐겨찾기한 종목들의 실시간 시세를 확인하세요
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-8 text-muted-foreground">
                                    <div className="text-4xl mb-2">⭐</div>
                                    <p className="mb-2">관심 종목이 없습니다</p>
                                    <p className="text-sm">종목을 즐겨찾기에 추가하면 여기에 표시됩니다</p>
                                    <Link href="/screener" className="text-primary hover:underline text-sm mt-2 inline-block">
                                        종목 검색하기 →
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Quick Actions Section */}
                    <div className="mb-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>빠른 실행</CardTitle>
                                <CardDescription>
                                    자주 사용하는 기능에 빠르게 접근하세요
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 lg:gap-4">
                                    <Link href="/screener" className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-center">
                                        <div className="text-2xl mb-2">🔍</div>
                                        <div className="font-medium text-sm">종목 검색</div>
                                        <div className="text-xs text-muted-foreground">조건에 맞는 종목 찾기</div>
                                    </Link>

                                    <Link href="/compare" className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-center">
                                        <div className="text-2xl mb-2">⚖️</div>
                                        <div className="font-medium text-sm">종목 비교</div>
                                        <div className="text-xs text-muted-foreground">여러 종목 동시 분석</div>
                                    </Link>

                                    <Link href="/portfolio" className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-center">
                                        <div className="text-2xl mb-2">📊</div>
                                        <div className="font-medium text-sm">포트폴리오</div>
                                        <div className="text-xs text-muted-foreground">보유 종목 관리</div>
                                    </Link>

                                    <Link href="/alerts" className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-center">
                                        <div className="text-2xl mb-2">🔔</div>
                                        <div className="font-medium text-sm">알림 설정</div>
                                        <div className="text-xs text-muted-foreground">가격 알림 받기</div>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* 주요 지표 링크 섹션 */}
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>주요 지표별 랭킹</CardTitle>
                            <CardDescription>
                                다양한 투자 지표별 기업 랭킹을 확인하세요
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 lg:gap-4">
                                <Link href="/marketcaps" className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-primary mb-2">시총</div>
                                        <div className="text-sm text-muted-foreground">시가총액</div>
                                    </div>
                                </Link>
                                <Link href="/per" className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-primary mb-2">PER</div>
                                        <div className="text-sm text-muted-foreground">주가수익비율</div>
                                    </div>
                                </Link>
                                <Link href="/pbr" className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-primary mb-2">PBR</div>
                                        <div className="text-sm text-muted-foreground">주가순자산비율</div>
                                    </div>
                                </Link>
                                <Link href="/eps" className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-primary mb-2">EPS</div>
                                        <div className="text-sm text-muted-foreground">주당순이익</div>
                                    </div>
                                </Link>
                                <Link href="/bps" className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-primary mb-2">BPS</div>
                                        <div className="text-sm text-muted-foreground">주당순자산</div>
                                    </div>
                                </Link>
                                <Link href="/div" className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-primary mb-2">배당</div>
                                        <div className="text-sm text-muted-foreground">배당수익률</div>
                                    </div>
                                </Link>
                                <Link href="/dps" className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-primary mb-2">DPS</div>
                                        <div className="text-sm text-muted-foreground">주당배당금</div>
                                    </div>
                                </Link>
                                <Link href="/screener" className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-primary mb-2">스크리너</div>
                                        <div className="text-sm text-muted-foreground">종목검색</div>
                                    </div>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
            <SiteFooter />
        </>
    );
}

export default DashboardPage;
