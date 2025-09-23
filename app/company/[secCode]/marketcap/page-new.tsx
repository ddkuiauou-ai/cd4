import { notFound } from "next/navigation";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Balancer } from "react-wrap-balancer";
import { Building2, BarChart3, ArrowLeftRight, TrendingUp, FileText } from "lucide-react";
import { getSecurityByCode, getCompanySecurities } from "@/lib/data/security";
import { getCompanyAggregatedMarketcap } from "@/lib/data/company";
import ChartCompanyMarketcap from "@/components/chart-company-marketcap";
import ChartMarketcap from "@/components/chart-marketcap";
import CardCompanyMarketcap from "@/components/card-company-marketcap";
import CardMarketcap from "@/components/card-marketcap";
import ListMarketcap from "@/components/list-marketcap";
import RankHeader from "@/components/header-rank";
import { MarketcapSummaryExpandable } from "@/components/marketcap-summary-expandable";
import { CompanyMarketcapPager } from "@/components/pager-company-marketcap";
import { formatNumber, formatDate } from "@/lib/utils";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";
import { InteractiveSecuritiesSection } from "@/components/simple-interactive-securities";
import CompanyLogo from "@/components/CompanyLogo";
import { InteractiveChartSection } from "@/components/interactive-chart-section";

/**
 * Props for Company Marketcap Page
 */
interface CompanyMarketcapPageProps {
    params: Promise<{ secCode: string }>;
}

export default async function CompanyMarketcapPage({ params }: CompanyMarketcapPageProps) {
    const { secCode } = await params;

    const security = await getSecurityByCode(secCode);

    if (!security) {
        notFound();
    }
    const displayName = security.korName || security.name;

    // Extract market from secCode (e.g., "KOSPI.005930" -> "KOSPI")
    const market = secCode.includes('.') ? secCode.split('.')[0] : 'KOSPI';

    // Extract ticker from secCode (e.g., "KOSPI.005930" -> "005930")
    const currentTicker = secCode.includes('.') ? secCode.split('.')[1] : secCode;

    // Get company-related securities if this security has a company
    const companySecs = security.companyId
        ? await getCompanySecurities(security.companyId)
        : [];

    // Get aggregated company marketcap data
    const companyMarketcapData = security.companyId
        ? await getCompanyAggregatedMarketcap(security.companyId)
        : null;

    // 🔥 기간별 시가총액 분석 계산 함수
    function calculatePeriodAnalysis() {
        if (!companyMarketcapData || !companyMarketcapData.aggregatedHistory || companyMarketcapData.aggregatedHistory.length === 0) {
            return null;
        }

        const history = companyMarketcapData.aggregatedHistory;
        const securities = companyMarketcapData.securities;

        // 기간별 데이터 필터링 함수
        const getDataForPeriod = (months: number) => {
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - months);
            return history.filter(item => {
                const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
                return itemDate >= cutoffDate;
            });
        };

        // 최신 데이터
        const latestData = history[history.length - 1];

        // 기간별 평균 계산
        const periods = [
            { label: '최근 시총', months: 0, desc: '현재 기준' },
            { label: '12개월 평균', months: 12, desc: '직전 1년' },
            { label: '3년 평균', months: 36, desc: '최근 3년' },
            { label: '5년 평균', months: 60, desc: '최근 5년' },
            { label: '10년 평균', months: 120, desc: '최근 10년' },
            { label: '30년 평균', months: 360, desc: '최근 30년' }
        ];

        const analysis = periods.map(period => {
            if (period.months === 0) {
                return {
                    label: period.label,
                    value: latestData?.totalMarketcap || 0,
                    desc: period.desc
                };
            }

            const periodData = getDataForPeriod(period.months);
            if (periodData.length === 0) return null;

            const average = periodData.reduce((sum, item) => sum + item.totalMarketcap, 0) / periodData.length;
            return {
                label: period.label,
                value: average,
                desc: period.desc
            };
        }).filter((item): item is NonNullable<typeof item> => item !== null);

        // 최저/최고 계산
        const allValues = history.map(item => item.totalMarketcap);
        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);

        // 종목별 구성 분석 (최신 데이터 기준)
        const latestBreakdown = latestData?.securitiesBreakdown || {};
        const totalMarketcap = latestData?.totalMarketcap || 1;

        const securityAnalysis = securities.map(sec => {
            const secValue = latestBreakdown[sec.securityId] || 0;
            const percentage = (secValue / totalMarketcap) * 100;
            return {
                name: sec.korName || sec.name || '알 수 없음',
                type: sec.type || '',
                value: secValue,
                percentage
            };
        }).sort((a, b) => b.percentage - a.percentage);

        return {
            periods: analysis,
            minMax: { min: minValue, max: maxValue },
            securityBreakdown: securityAnalysis,
            currentSecurity: displayName,
            market
        };
    }

    const periodAnalysis = calculatePeriodAnalysis();

    return (
        <main className="relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px] space-y-8">
            <div className="mx-auto w-full min-w-0 space-y-12">
                {/* 브레드크럼 네비게이션 */}
                <div className="space-y-0">
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Link href="/" className="hover:text-foreground transition-colors">
                            홈
                        </Link>
                        <ChevronRightIcon className="h-4 w-4" />
                        <Link href="/company" className="hover:text-foreground transition-colors">
                            기업
                        </Link>
                        <ChevronRightIcon className="h-4 w-4" />
                        <Link href={`/company/${secCode}`} className="hover:text-foreground transition-colors">
                            {displayName}
                        </Link>
                        <ChevronRightIcon className="h-4 w-4" />
                        <span className="font-medium text-foreground">시가총액</span>
                    </div>
                </div>

                {/* 페이지 제목 섹션 */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4 mb-4">
                            <CompanyLogo
                                companyName={displayName}
                                logoUrl={security.company?.logo}
                                size={64}
                                className="flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
                                    <Balancer>
                                        {displayName} 시가총액
                                    </Balancer>
                                </h1>
                            </div>
                        </div>
                        <p className="text-lg md:text-xl text-muted-foreground mt-2">
                            기업 전체 가치와 종목별 시가총액 구성을 분석합니다
                        </p>
                    </div>

                    {/* 시가총액 설명 알림 */}
                    <div data-slot="alert" role="alert" className="relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current bg-card text-card-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info h-4 w-4" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 16v-4"></path>
                            <path d="M12 8h.01"></path>
                        </svg>
                        <div data-slot="alert-description" className="text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed">
                            기업 시가총액은 회사가 발행한 모든 종목(보통주, 우선주 등)의 시가총액을 합산한 값입니다.
                            각 종목의 구성비율과 변동 추이를 확인할 수 있습니다.
                        </div>
                    </div>
                </div>

                {companyMarketcapData && companyMarketcapData.aggregatedHistory && companyMarketcapData.securities ? (
                    <div className="space-y-16">
                        {/* 기업 개요 섹션 */}
                        <div id="company-overview" className="relative border-t-2 border-blue-100 pt-8 pb-8 bg-blue-50/30 rounded-xl -mx-4 px-4">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">기업 개요</h2>
                                    <p className="text-base text-gray-600 mt-1">기업 시가총액 순위와 기본 정보</p>
                                </div>
                            </div>
                            <RankHeader
                                rank={1}
                                marketcap={companyMarketcapData.totalMarketcap}
                                price={security.prices?.[0]?.close || 0}
                                exchange={security.exchange || ""}
                                isCompanyLevel={true}
                            />
                        </div>

                        {/* 차트 분석 섹션 */}
                        <div id="chart-analysis" className="space-y-8 relative border-t-2 border-green-100 pt-8 pb-8 bg-green-50/20 rounded-xl -mx-4 px-4">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100">
                                    <BarChart3 className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">차트 분석</h2>
                                    <p className="text-base text-gray-600 mt-1">시가총액 추이와 종목별 구성 현황</p>
                                </div>
                            </div>

                            <div className="grid gap-8 lg:grid-cols-2">
                                <div className="space-y-4">
                                    <div className="bg-background rounded-xl border p-2 sm:p-4 shadow-sm">
                                        <InteractiveChartSection
                                            companyMarketcapData={companyMarketcapData}
                                            companySecs={companySecs}
                                            type="summary"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <CardCompanyMarketcap data={companyMarketcapData} market={market} />
                                </div>
                            </div>
                        </div>

                        {/* 종목 비교 섹션 */}
                        <div id="securities-summary" className="space-y-8 relative border-t-2 border-purple-100 pt-8 pb-8 bg-purple-50/20 rounded-xl -mx-4 px-4">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100">
                                    <ArrowLeftRight className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">종목 비교</h2>
                                    <p className="text-base text-gray-600 mt-1">동일 기업 내 각 종목 간 비교 분석</p>
                                </div>
                            </div>

                            <InteractiveSecuritiesSection
                                companyMarketcapData={companyMarketcapData}
                                companySecs={companySecs}
                                market={market}
                                currentTicker={currentTicker}
                                highlightActiveTicker={false}
                            />
                        </div>

                        <CompanyFinancialTabs secCode={secCode} />

                        {/* 시가총액 핵심 지표 섹션 */}
                        <div id="indicators" className="mb-8">
                            <h3 className="sr-only">시가총액 핵심 지표</h3>
                            {periodAnalysis && (
                                <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
                                    {/* 시총 랭킹 */}
                                    <div className="rounded-lg border bg-card p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                                        <div className="text-2xl font-bold text-primary mb-1">
                                            1위
                                        </div>
                                        <div className="text-sm text-muted-foreground">시총 랭킹</div>
                                    </div>

                                    {/* 현재 시가총액 */}
                                    <div className="rounded-lg border bg-card p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                                        <div className="text-2xl font-bold text-primary mb-1">
                                            {formatNumber(periodAnalysis.periods[0]?.value || 0)}원
                                        </div>
                                        <div className="text-sm text-muted-foreground">현재 시총</div>
                                    </div>

                                    {/* 현재 주가 */}
                                    <div className="rounded-lg border bg-card p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                                        <div className="text-2xl font-bold text-primary mb-1">
                                            {security.prices?.[0]?.close ? `${security.prices[0].close.toLocaleString()}원` : "—"}
                                        </div>
                                        <div className="text-sm text-muted-foreground">현재 주가</div>
                                    </div>

                                    {/* 12개월 평균 */}
                                    <div className="rounded-lg border bg-card p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                                        <div className="text-2xl font-bold text-primary mb-1">
                                            {periodAnalysis.periods.find(p => p.label === '12개월 평균')?.value
                                                ? formatNumber(periodAnalysis.periods.find(p => p.label === '12개월 평균')!.value) + '원'
                                                : "—"}
                                        </div>
                                        <div className="text-sm text-muted-foreground">12개월 평균</div>
                                    </div>

                                    {/* 5년 평균 */}
                                    <div className="rounded-lg border bg-card p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                                        <div className="text-2xl font-bold text-primary mb-1">
                                            {periodAnalysis.periods.find(p => p.label === '5년 평균')?.value
                                                ? formatNumber(periodAnalysis.periods.find(p => p.label === '5년 평균')!.value) + '원'
                                                : "—"}
                                        </div>
                                        <div className="text-sm text-muted-foreground">5년 평균</div>
                                    </div>

                                    {/* 최저 시총 */}
                                    <div className="rounded-lg border bg-card p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                                        <div className="text-2xl font-bold text-primary mb-1">
                                            {formatNumber(periodAnalysis.minMax.min)}원
                                        </div>
                                        <div className="text-sm text-muted-foreground">최저 시총</div>
                                    </div>

                                    {/* 최고 시총 */}
                                    <div className="rounded-lg border bg-card p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                                        <div className="text-2xl font-bold text-primary mb-1">
                                            {formatNumber(periodAnalysis.minMax.max)}원
                                        </div>
                                        <div className="text-sm text-muted-foreground">최고 시총</div>
                                    </div>

                                    {/* 1년 변화율 */}
                                    <div className="rounded-lg border bg-card p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
                                        <div className="text-2xl font-bold text-primary mb-1">
                                            {(() => {
                                                const current = periodAnalysis.periods[0]?.value || 0;
                                                const yearAgo = periodAnalysis.periods.find(p => p.label === '12개월 평균')?.value || 0;
                                                if (current && yearAgo) {
                                                    const change = ((current - yearAgo) / yearAgo) * 100;
                                                    return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
                                                }
                                                return "—";
                                            })()}
                                        </div>
                                        <div className="text-sm text-muted-foreground">1년 변화율</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 연도별 데이터 섹션 */}
                        <div id="annual-data" className="border-t-2 border-red-100 pt-8 pb-8 bg-red-50/20 rounded-xl -mx-4 px-4">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100">
                                    <FileText className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">연도별 데이터</h2>
                                    <p className="text-base text-gray-600 mt-1">시가총액 차트와 연말 기준 상세 데이터</p>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <div>
                                    {companyMarketcapData && companyMarketcapData.aggregatedHistory && companyMarketcapData.securities ? (
                                        <div className="bg-background rounded-xl border p-2 sm:p-4 shadow-sm">
                                            <InteractiveChartSection
                                                companyMarketcapData={companyMarketcapData}
                                                companySecs={companySecs}
                                                type="detailed"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium text-gray-900">시가총액 차트 데이터 없음</p>
                                                <p className="text-xs text-gray-500">연간 시가총액 데이터를 불러올 수 없습니다</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <p className="sr-only">연말 기준 시가총액 추이를 통해 기업의 성장 패턴을 분석합니다</p>

                                    <div>
                                        {companyMarketcapData && companyMarketcapData.aggregatedHistory ? (
                                            <ListMarketcap
                                                data={companyMarketcapData.aggregatedHistory.map(item => ({
                                                    date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date),
                                                    value: item.totalMarketcap,
                                                }))}
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                                                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-sm font-medium text-gray-900">연도별 시가총액 데이터 없음</p>
                                                    <p className="text-xs text-gray-500">시계열 데이터를 불러올 수 없습니다</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-8">
                            <CompanyMarketcapPager
                                rank={security.company?.marketcapRank || 1}
                                currentMarket={market}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* 🚨 데이터 없음 상태 UI 개선 */}
                        <div className="flex flex-col items-center justify-center p-12 space-y-6 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            {/* 아이콘 */}
                            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>

                            {/* 메시지 */}
                            <div className="space-y-3 max-w-md">
                                <h3 className="text-xl font-semibold text-gray-900">기업 시가총액 데이터 없음</h3>
                                <p className="text-gray-600 leading-relaxed">
                                    <strong>{displayName}</strong>의 통합 시가총액 데이터를 불러올 수 없습니다.<br />
                                    개별 종목의 시가총액 정보를 대신 확인하실 수 있습니다.
                                </p>
                            </div>

                            {/* 대안 액션 */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                <Link
                                    href={`/company/${secCode}`}
                                    className="inline-flex items-center justify-center rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                                >
                                    기업 홈으로 돌아가기
                                </Link>
                                <Link
                                    href={`/security/${secCode}/marketcap`}
                                    className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                                >
                                    개별 종목 시가총액 보기
                                </Link>
                            </div>
                        </div>

                        {companySecs.length > 0 ? (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-bold tracking-tight">
                                    관련 종목 ({companySecs.length}개)
                                </h2>
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {companySecs.map((sec) => (
                                        <CardMarketcap
                                            key={sec.securityId}
                                            security={sec as any}
                                            market={market}
                                            isCompanyPage={true}
                                            currentMetric="marketcap"
                                        />
                                    ))}
                                </div>

                                <div className="text-center pt-6">
                                    <Link
                                        href={`/security/${secCode}/marketcap`}
                                        className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                                    >
                                        {displayName} 종목 시가총액 상세보기
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-16">
                                <div className="space-y-4">
                                    <h3 className="text-xl font-semibold">종목 정보를 찾을 수 없습니다</h3>
                                    <p className="text-muted-foreground">
                                        해당 종목의 시가총액 데이터가 없거나 접근할 수 없습니다.
                                    </p>
                                    <div className="flex gap-3 justify-center">
                                        <Link
                                            href="/company/marketcaps"
                                            className="inline-flex items-center justify-center rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/90 transition-colors"
                                        >
                                            기업 시가총액 랭킹
                                        </Link>
                                        <Link
                                            href="/marketcap"
                                            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                                        >
                                            종목 시가총액 랭킹
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 사이드바 네비게이션 (데스크톱) */}
            <div className="hidden xl:block">
                <div className="sticky top-20 space-y-6">
                    {/* 페이지 네비게이션 */}
                    <div className="rounded-xl border bg-background p-4">
                        <h3 className="text-sm font-semibold mb-3">페이지 내비게이션</h3>
                        <nav className="space-y-2">
                            <a
                                href="#company-overview"
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                            >
                                <Building2 className="h-3 w-3" />
                                기업 개요
                            </a>
                            <a
                                href="#chart-analysis"
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                            >
                                <BarChart3 className="h-3 w-3" />
                                차트 분석
                            </a>
                            <a
                                href="#securities-summary"
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                            >
                                <ArrowLeftRight className="h-3 w-3" />
                                종목 비교
                            </a>
                            <a
                                href="#indicators"
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                            >
                                <TrendingUp className="h-3 w-3" />
                                핵심 지표
                            </a>
                            <a
                                href="#annual-data"
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                            >
                                <FileText className="h-3 w-3" />
                                연도별 데이터
                            </a>
                        </nav>
                    </div>

                    {/* 빠른 정보 카드 */}
                    {companyMarketcapData && (
                        <div className="rounded-xl border bg-background p-4">
                            <h3 className="text-sm font-semibold mb-3">빠른 정보</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">총 시가총액</span>
                                    <span className="font-medium">{formatNumber(companyMarketcapData.totalMarketcap)}원</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">종목 수</span>
                                    <span className="font-medium">{companyMarketcapData.securities.length}개</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">기준일</span>
                                    <span className="font-medium">{formatDate(new Date(companyMarketcapData.totalMarketcapDate))}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 종목별 시가총액 */}
                    {companySecs && companySecs.length > 0 && (
                        <InteractiveSecuritiesSection
                            companyMarketcapData={companyMarketcapData}
                            companySecs={companySecs}
                            currentTicker={currentTicker}
                            market={market}
                            layout="sidebar"
                            maxItems={4}
                            showSummaryCard={true}
                            compactMode={false}
                            baseUrl="company"
                            currentMetric="marketcap"
                            highlightActiveTicker={false}
                        />
                    )}
                </div>
            </div>
        </main>
    );
}
