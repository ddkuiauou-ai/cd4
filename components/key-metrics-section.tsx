"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { formatNumberWithSeparateUnit, formatChangeRate } from "@/lib/utils";
import { Marquee } from "@/registry/magicui/marquee";

interface KeyMetricsSectionProps {
    companyMarketcapData: any;
    companySecs: any[];
    security: any;
    periodAnalysis: any;
    marketCapRanking: {
        currentRank: number;
        priorRank: number | null;
        rankChange: number;
        value: number | null;
    } | null;
    activeMetric: {
        id: string;
        label: string;
        description?: string;
    };
    backgroundStyle?: CSSProperties;
    currentTickerOverride?: string;
    selectedSecurityTypeOverride?: string;
}

const DEFAULT_BACKGROUND: CSSProperties = {
    backgroundColor: "rgba(249, 115, 22, 0.02)",
    backgroundImage:
        "linear-gradient(180deg, rgba(249,115,22,0.09) 0px, rgba(249,115,22,0.05) 120px, rgba(249,115,22,0.025) 280px, rgba(249,115,22,0) 520px)",
};

const EDGE_TO_EDGE_SECTION_CLASS =
    "relative -mx-4 space-y-4 border-y px-4 py-4 shadow-sm sm:mx-0 sm:space-y-8 sm:overflow-hidden sm:rounded-3xl sm:border sm:px-6 sm:py-8";

const MARQUEE_CARD_STYLE: CSSProperties = {
    width: "min(calc((100vw - 16px) / 5.5), 140px)",
    height: "min(calc((100vw - 16px) / 5.5), 140px)",
    minWidth: "96px",
    minHeight: "96px",
    maxWidth: "140px",
    maxHeight: "140px",
};

export function KeyMetricsSection({
    companyMarketcapData,
    companySecs,
    security,
    periodAnalysis,
    marketCapRanking,
    activeMetric,
    backgroundStyle,
    currentTickerOverride,
    selectedSecurityTypeOverride,
}: KeyMetricsSectionProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const pathTicker = useMemo(() => {
        const pathParts = pathname.split('/');
        const secCodePart = pathParts.find(part => part.includes('.'));
        if (!secCodePart) return null;
        const tickerFromPath = secCodePart.split('.')[1];
        return tickerFromPath ?? null;
    }, [pathname]);

    const resolvedTicker = currentTickerOverride ?? pathTicker ?? undefined;

    const resolvedCurrentSecurity = useMemo(() => {
        if (!resolvedTicker) return undefined;
        return companySecs.find(sec => sec.ticker === resolvedTicker);
    }, [companySecs, resolvedTicker]);

    // 현재 선택된 종목 타입 실시간 감지
    const selectedSecurityType = useMemo(() => {
        if (selectedSecurityTypeOverride) return selectedSecurityTypeOverride;
        if (!companyMarketcapData || !companySecs.length) return "시가총액 구성";
        if (!resolvedTicker) return "시가총액 구성";

        if (!resolvedCurrentSecurity) return "시가총액 구성";

        // 보통주인지 확인
        const isCommonStock = resolvedCurrentSecurity.type?.includes("보통주");

        if (isCommonStock) {
            // 보통주의 경우: focus=stock 여부로 결정
            const focusStock = searchParams.get('focus') === 'stock';
            return focusStock ? "보통주" : "시가총액 구성";
        } else {
            // 우선주 등: 항상 개별 종목 어노테이션
            if (resolvedCurrentSecurity.type?.includes("우선주")) return "우선주";
            return "시가총액 구성";
        }
    }, [selectedSecurityTypeOverride, companyMarketcapData, companySecs, resolvedTicker, resolvedCurrentSecurity, searchParams]);

    // 날짜 기반 데이터 필터링 헬퍼
    const getDataByPeriod = (months: number) => {
        if (!companyMarketcapData?.aggregatedHistory) return [];

        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);

        return companyMarketcapData.aggregatedHistory.filter((item: any) => {
            const itemDate = new Date(item.date);
            return itemDate >= cutoffDate;
        });
    };

    // 선택된 타입에 따른 데이터 필터링 (개선된 버전)
    const getMetricValue = (type: 'current' | 'avg12m' | 'avg3y' | 'avg5y' | 'avg10y' | 'avgAll' | 'min' | 'max') => {
        if (!companyMarketcapData?.aggregatedHistory) return null;

        if (selectedSecurityType === "시가총액 구성") {
            // 시가총액 구성: 전체 시가총액 기준
            switch (type) {
                case 'current': return periodAnalysis?.periods[0]?.value || 0;
                case 'avg12m': {
                    const data = getDataByPeriod(12);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'avg3y': {
                    const data = getDataByPeriod(36);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'avg5y': {
                    const data = getDataByPeriod(60);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'avg10y': {
                    const data = getDataByPeriod(120);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'avgAll': {
                    if (!companyMarketcapData?.aggregatedHistory) return null;
                    const allValues = companyMarketcapData.aggregatedHistory.map((item: any) => item.totalMarketcap);
                    return allValues.length > 0 ? allValues.reduce((sum: number, val: number) => sum + val, 0) / allValues.length : null;
                }
                case 'min': return periodAnalysis?.minMax.min;
                case 'max': return periodAnalysis?.minMax.max;
            }
        } else {
            // 개별 종목: 해당 종목의 시가총액만
            if (!resolvedCurrentSecurity) return null;

            const history = companyMarketcapData.aggregatedHistory;
            const securityValues = history
                .map((item: any) => item.securitiesBreakdown?.[resolvedCurrentSecurity.securityId] || 0)
                .filter((value: number) => value > 0);

            if (securityValues.length === 0) return null;

            switch (type) {
                case 'current':
                    return securityValues[securityValues.length - 1];
                case 'avg12m': {
                    const data = getDataByPeriod(12);
                    const values = data
                        .map((item: any) => item.securitiesBreakdown?.[resolvedCurrentSecurity.securityId] || 0)
                        .filter((v: number) => v > 0);
                    return values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : null;
                }
                case 'avg3y': {
                    const data = getDataByPeriod(36);
                    const values = data
                        .map((item: any) => item.securitiesBreakdown?.[resolvedCurrentSecurity.securityId] || 0)
                        .filter((v: number) => v > 0);
                    return values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : null;
                }
                case 'avg5y': {
                    const data = getDataByPeriod(60);
                    const values = data
                        .map((item: any) => item.securitiesBreakdown?.[resolvedCurrentSecurity.securityId] || 0)
                        .filter((v: number) => v > 0);
                    return values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : null;
                }
                case 'avg10y': {
                    const data = getDataByPeriod(120);
                    const values = data
                        .map((item: any) => item.securitiesBreakdown?.[resolvedCurrentSecurity.securityId] || 0)
                        .filter((v: number) => v > 0);
                    return values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : null;
                }
                case 'avgAll': {
                    const values = companyMarketcapData.aggregatedHistory
                        .map((item: any) => item.securitiesBreakdown?.[resolvedCurrentSecurity.securityId] || 0)
                        .filter((value: number) => value > 0);
                    return values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : null;
                }
                case 'min': {
                    const values = companyMarketcapData.aggregatedHistory
                        .map((item: any) => item.securitiesBreakdown?.[resolvedCurrentSecurity.securityId] || 0)
                        .filter((value: number) => value > 0);
                    return values.length > 0 ? Math.min(...values) : null;
                }
                case 'max': {
                    const values = companyMarketcapData.aggregatedHistory
                        .map((item: any) => item.securitiesBreakdown?.[resolvedCurrentSecurity.securityId] || 0)
                        .filter((value: number) => value > 0);
                    return values.length > 0 ? Math.max(...values) : null;
                }
            }
        }
        return null;
    };

    // 보통주 비중 계산 함수
    const getCommonStockRatio = (type: 'min' | 'max') => {
        if (!companyMarketcapData?.aggregatedHistory) return 0;

        let ratios: number[] = [];
        companyMarketcapData.aggregatedHistory.forEach((historyItem: any) => {
            if (historyItem.securitiesBreakdown) {
                const commonStockSecurities = companyMarketcapData.securities.filter((sec: any) => sec.type === '보통주');
                const commonStockValue = commonStockSecurities.reduce((sum: number, sec: any) => {
                    return sum + (historyItem.securitiesBreakdown[sec.securityId] || 0);
                }, 0);
                const ratio = (commonStockValue / historyItem.totalMarketcap) * 100;
                if (ratio > 0) {
                    ratios.push(ratio);
                }
            }
        });

        if (ratios.length === 0) return 0;
        return type === 'max' ? Math.max(...ratios) : Math.min(...ratios);
    };

    // 변화율 계산 함수
    const getChangeRate = (current: number | null, comparison: number | null) => {
        if (!current || !comparison || current === comparison) {
            return { value: "—", color: "text-gray-500 dark:text-gray-400" };
        }
        const rate = ((current - comparison) / comparison) * 100;
        const formatted = formatChangeRate(rate);

        // 다크모드 색상 추가
        let darkModeColor = formatted.color;
        if (formatted.color.includes('red')) {
            darkModeColor = formatted.color + ' dark:text-red-400';
        } else if (formatted.color.includes('blue')) {
            darkModeColor = formatted.color + ' dark:text-blue-400';
        } else {
            darkModeColor = formatted.color + ' dark:text-gray-400';
        }

        return { value: formatted.value, color: darkModeColor };
    };

    // 이전 기간 평균과의 변화율 계산
    const getPreviousPeriodAverage = (type: 'avg12m' | 'avg3y' | 'avg5y' | 'avg10y') => {
        if (!companyMarketcapData?.aggregatedHistory) return null;

        let currentMonths: number, previousMonths: number;
        switch (type) {
            case 'avg12m': currentMonths = 12; previousMonths = 24; break;
            case 'avg3y': currentMonths = 36; previousMonths = 72; break;
            case 'avg5y': currentMonths = 60; previousMonths = 120; break;
            case 'avg10y': currentMonths = 120; previousMonths = 240; break;
        }

        const currentPeriodData = getDataByPeriod(currentMonths);
        const previousPeriodData = getDataByPeriod(previousMonths).filter((item: any) => {
            const itemDate = new Date(item.date);
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - currentMonths);
            return itemDate < cutoffDate;
        });

        if (selectedSecurityType === "시가총액 구성") {
            if (currentPeriodData.length === 0 || previousPeriodData.length === 0) return null;
            const currentAvg = currentPeriodData.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / currentPeriodData.length;
            const previousAvg = previousPeriodData.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / previousPeriodData.length;
            return { current: currentAvg, previous: previousAvg };
        } else {
            const pathParts = pathname.split('/');
            const secCodePart = pathParts.find(part => part.includes('.'));
            const currentTicker = secCodePart?.split('.')[1];
            const currentSecurity = companySecs.find(sec => sec.ticker === currentTicker);

            if (!currentSecurity) return null;

            const currentValues = currentPeriodData.map((item: any) => item.securitiesBreakdown?.[currentSecurity.securityId] || 0).filter((v: number) => v > 0);
            const previousValues = previousPeriodData.map((item: any) => item.securitiesBreakdown?.[currentSecurity.securityId] || 0).filter((v: number) => v > 0);

            if (currentValues.length === 0 || previousValues.length === 0) return null;

            const currentAvg = currentValues.reduce((sum: number, val: number) => sum + val, 0) / currentValues.length;
            const previousAvg = previousValues.reduce((sum: number, val: number) => sum + val, 0) / previousValues.length;
            return { current: currentAvg, previous: previousAvg };
        }
    };

    // 전일 대비 변화율 계산
    const getYesterdayChange = () => {
        if (!companyMarketcapData?.aggregatedHistory || companyMarketcapData.aggregatedHistory.length < 2) return null;

        const sortedData = [...companyMarketcapData.aggregatedHistory].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const today = sortedData[0];
        const yesterday = sortedData[1];

        if (selectedSecurityType === "시가총액 구성") {
            return { current: today.totalMarketcap, previous: yesterday.totalMarketcap };
        } else {
            const pathParts = pathname.split('/');
            const secCodePart = pathParts.find(part => part.includes('.'));
            const currentTicker = secCodePart?.split('.')[1];
            const currentSecurity = companySecs.find(sec => sec.ticker === currentTicker);

            if (!currentSecurity) return null;

            const todayValue = today.securitiesBreakdown?.[currentSecurity.securityId] || 0;
            const yesterdayValue = yesterday.securitiesBreakdown?.[currentSecurity.securityId] || 0;

            return { current: todayValue, previous: yesterdayValue };
        }
    };

    // 전일 대비 주가 변화율 계산
    const getYesterdayPriceChange = () => {
        if (selectedSecurityType === "시가총액 구성") {
            // 시가총액 구성인 경우 대표 종목의 주가 변화율
            if (!security.prices || security.prices.length < 2) return null;
            const today = security.prices[0];
            const yesterday = security.prices[1];
            return { current: today.close, previous: yesterday.close };
        } else {
            // 개별 종목의 경우 해당 종목의 주가 변화율
            if (!resolvedCurrentSecurity?.prices || resolvedCurrentSecurity.prices.length < 2) return null;
            const today = resolvedCurrentSecurity.prices[0];
            const yesterday = resolvedCurrentSecurity.prices[1];
            return { current: today.close, previous: yesterday.close };
        }
    };

    // 현재 보통주 비중 계산
    const getCurrentCommonStockRatio = () => {
        if (!companyMarketcapData?.aggregatedHistory || companyMarketcapData.aggregatedHistory.length === 0) return 0;

        const latestData = [...companyMarketcapData.aggregatedHistory].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (latestData.securitiesBreakdown) {
            const commonStockSecurities = companyMarketcapData.securities.filter((sec: any) => sec.type === '보통주');
            const commonStockValue = commonStockSecurities.reduce((sum: number, sec: any) => {
                return sum + (latestData.securitiesBreakdown[sec.securityId] || 0);
            }, 0);
            return (commonStockValue / latestData.totalMarketcap) * 100;
        }
        return 0;
    };

    const getCurrentPrice = () => {
        if (selectedSecurityType === "시가총액 구성") {
            return security.prices?.[0]?.close ? `${security.prices[0].close.toLocaleString()}` : "—";
        } else {
            // 개별 종목의 경우 해당 종목 주가 표시
            if (resolvedCurrentSecurity?.prices?.[0]?.close) {
                return resolvedCurrentSecurity.prices[0].close.toLocaleString();
            }
            return security.prices?.[0]?.close ? `${security.prices[0].close.toLocaleString()}` : "—";
        }
    };

    if (!periodAnalysis) return null;

    return (
        <section
            id="indicators"
            className={`${EDGE_TO_EDGE_SECTION_CLASS} border-orange-200/70 dark:border-orange-900/40 dark:bg-orange-950/20`}
            style={backgroundStyle ?? DEFAULT_BACKGROUND}
        >
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-orange-700/80">
                <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] uppercase tracking-widest text-orange-700 shadow-sm">
                    탭 연동
                </span>
                <span className="text-sm font-semibold text-orange-800/90">
                    {activeMetric.label} 기준 핵심 지표
                </span>
                {activeMetric.description && (
                    <span className="text-[11px] font-medium text-orange-700/70">
                        {activeMetric.description}
                    </span>
                )}
            </div>
            <header className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-900/40">
                    <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">핵심 지표</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 md:text-base">
                        {selectedSecurityType === "시가총액 구성"
                            ? `${activeMetric.label} 주요 지표와 변화율 현황`
                            : `${selectedSecurityType} · ${activeMetric.label} 지표 변화`
                        }
                    </p>
                </div>
            </header>

            <Marquee
                pauseOnHover
                className="[--duration:36s]"
                contentClassName="flex gap-1 pb-2"
                contentStyle={{ minWidth: "fit-content" }}
            >
                    {/* 시총 랭킹 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={MARQUEE_CARD_STYLE}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                if (selectedSecurityType === "시가총액 구성") {
                                    // 시가총액 구성 모드: 회사 랭킹 사용
                                    const companyRank = security.company?.marketcapRank;
                                    if (companyRank) {
                                        return (
                                            <>
                                                <span className="text-xl sm:text-2xl md:text-3xl">{companyRank}</span>
                                                <span className="text-sm sm:text-base ml-1">위</span>
                                            </>
                                        );
                                    }
                                } else {
                                    // 개별 종목 모드: 종목 랭킹 사용
                                    if (marketCapRanking) {
                                        return (
                                            <>
                                                <span className="text-xl sm:text-2xl md:text-3xl">{marketCapRanking.currentRank}</span>
                                                <span className="text-sm sm:text-base ml-1">위</span>
                                            </>
                                        );
                                    }
                                }
                                return <span className="text-xl sm:text-2xl md:text-3xl">—</span>;
                            })()}
                        </div>
                        {/* 랭킹 변화 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                if (selectedSecurityType === "시가총액 구성") {
                                    // 시가총액 구성 모드: 회사 랭킹 변화 사용
                                    const currentRank = security.company?.marketcapRank;
                                    const priorRank = security.company?.marketcapPriorRank;
                                    if (currentRank && priorRank) {
                                        const rankChange = currentRank - priorRank;
                                        return (
                                            <span className={rankChange < 0 ? "text-red-600 dark:text-red-400" : rankChange > 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}>
                                                {rankChange === 0 ? "—" :
                                                    rankChange < 0 ? `▲${Math.abs(rankChange)}` :
                                                        `▼${rankChange}`}
                                            </span>
                                        );
                                    }
                                } else {
                                    // 개별 종목 모드: 종목 랭킹 변화 사용
                                    if (marketCapRanking && marketCapRanking.priorRank) {
                                        return (
                                            <span className={marketCapRanking.rankChange < 0 ? "text-red-600 dark:text-red-400" : marketCapRanking.rankChange > 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}>
                                                {marketCapRanking.rankChange === 0 ? "—" :
                                                    marketCapRanking.rankChange < 0 ? `▲${Math.abs(marketCapRanking.rankChange)}` :
                                                        `▼${marketCapRanking.rankChange}`}
                                            </span>
                                        );
                                    }
                                }
                                return <span className="text-gray-500 dark:text-gray-400">—</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                            {selectedSecurityType === "시가총액 구성" ? "시총 랭킹" : `${selectedSecurityType} 랭킹`}
                        </div>
                    </div>

                    {/* 현재 시가총액 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={MARQUEE_CARD_STYLE}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('current');
                                const formatted = formatNumberWithSeparateUnit(value || 0);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        {/* 전일 대비 변화율 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getYesterdayChange();
                                if (!change) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const rate = getChangeRate(change.current, change.previous);
                                return <span className={rate.color}>{rate.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                            {selectedSecurityType === "시가총액 구성" ? "현재 시총" : `현재 ${selectedSecurityType} 시총`}
                        </div>
                    </div>

                    {/* 현재 주가 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={MARQUEE_CARD_STYLE}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{getCurrentPrice()}</span>
                            <span className="text-sm sm:text-base ml-1">원</span>
                        </div>
                        {/* 전일 대비 주가 변화율 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getYesterdayPriceChange();
                                if (!change) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const rate = getChangeRate(change.current, change.previous);
                                return <span className={rate.color}>{rate.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">현재 주가</div>
                    </div>

                    {/* 12개월 평균 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={MARQUEE_CARD_STYLE}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('avg12m');
                                if (!value) return <span className="text-xl sm:text-2xl md:text-3xl">—</span>;
                                const formatted = formatNumberWithSeparateUnit(value);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        {/* 이전 12개월 대비 변화율 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPreviousPeriodAverage('avg12m');
                                if (!change) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const rate = getChangeRate(change.current, change.previous);
                                return <span className={rate.color}>{rate.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">12개월 평균</div>
                    </div>

                    {/* 3년 평균 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={MARQUEE_CARD_STYLE}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('avg3y');
                                if (!value) return <span className="text-xl sm:text-2xl md:text-3xl">—</span>;
                                const formatted = formatNumberWithSeparateUnit(value);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPreviousPeriodAverage('avg3y');
                                if (!change) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const rate = getChangeRate(change.current, change.previous);
                                return <span className={rate.color}>{rate.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">3년 평균</div>
                    </div>

                    {/* 5년 평균 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={MARQUEE_CARD_STYLE}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('avg5y');
                                if (!value) return <span className="text-xl sm:text-2xl md:text-3xl">—</span>;
                                const formatted = formatNumberWithSeparateUnit(value);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPreviousPeriodAverage('avg5y');
                                if (!change) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const rate = getChangeRate(change.current, change.previous);
                                return <span className={rate.color}>{rate.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">5년 평균</div>
                    </div>

                    {/* 10년 평균 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={MARQUEE_CARD_STYLE}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('avg10y');
                                if (!value) return <span className="text-xl sm:text-2xl md:text-3xl">—</span>;
                                const formatted = formatNumberWithSeparateUnit(value);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPreviousPeriodAverage('avg10y');
                                if (!change) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const rate = getChangeRate(change.current, change.previous);
                                return <span className={rate.color}>{rate.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">10년 평균</div>
                    </div>

                    {/* 전체 평균 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={MARQUEE_CARD_STYLE}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('avgAll');
                                if (!value) return <span className="text-xl sm:text-2xl md:text-3xl">—</span>;
                                const formatted = formatNumberWithSeparateUnit(value);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">전체 평균</div>
                    </div>

                    {/* 최저 시총 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={MARQUEE_CARD_STYLE}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('min');
                                const formatted = formatNumberWithSeparateUnit(value || 0);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최저 시총</div>
                    </div>

                    {/* 최고 시총 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={MARQUEE_CARD_STYLE}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('max');
                                const formatted = formatNumberWithSeparateUnit(value || 0);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최고 시총</div>
                    </div>

                    {/* 최고 보통주 비중 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={MARQUEE_CARD_STYLE}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">
                                {(() => {
                                    const ratio = getCommonStockRatio('max');
                                    return ratio > 0 ? `${ratio.toFixed(1)}` : "—";
                                })()}
                            </span>
                            <span className="text-sm sm:text-base ml-1">%</span>
                        </div>
                        {/* 현재 비중과의 차이 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const currentRatio = getCurrentCommonStockRatio();
                                const maxRatio = getCommonStockRatio('max');
                                if (maxRatio === 0 || currentRatio === 0) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const diff = maxRatio - currentRatio;
                                const color = diff > 0 ? "text-red-600 dark:text-red-400" : diff < 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400";
                                return <span className={color}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%p</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최고 보통주 비중</div>
                    </div>

                    {/* 최저 보통주 비중 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={MARQUEE_CARD_STYLE}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">
                                {(() => {
                                    const ratio = getCommonStockRatio('min');
                                    return ratio < 100 ? `${ratio.toFixed(1)}` : "—";
                                })()}
                            </span>
                            <span className="text-sm sm:text-base ml-1">%</span>
                        </div>
                        {/* 현재 비중과의 차이 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const currentRatio = getCurrentCommonStockRatio();
                                const minRatio = getCommonStockRatio('min');
                                if (minRatio >= 100 || currentRatio === 0) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const diff = minRatio - currentRatio;
                                const color = diff > 0 ? "text-red-600 dark:text-red-400" : diff < 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400";
                                return <span className={color}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%p</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최저 보통주 비중</div>
                    </div>
            </Marquee>
        </section>
    );
}
