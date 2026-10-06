"use client";
import type { MetricPeriodAnalysis } from '@/types/nav';
import type { DetailSecurity, DetailSecurityRow, DetailCompanyData } from './detail-types';

import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { formatNumberWithSeparateUnit, formatChangeRate } from "@/lib/utils";
import { getSecurityMarketcapSnapshot } from '@/lib/detail-marketcap-snapshot';
import { getSecurityMarketcapHistory, describeMarketcapHistory, DETAIL_HISTORY_PERIOD_NOTE } from '@/lib/detail-marketcap-history';
import { getSnapshotHistoryComparison } from '@/lib/detail-change-basis';
import Rate from './rate';

interface KeyMetricsSectionProps {
    companyMarketcapData: DetailCompanyData;
    companySecs: DetailSecurityRow[];
    security: DetailSecurity;
    periodAnalysis: Pick<MetricPeriodAnalysis, 'minMax'> | null;
    marketCapRanking: {
        currentRank: number | null;
        priorRank: number | null;
        rankChange: number;
        value: number | null;
    } | null;
    activeMetric: {
        id: string;
        label: string;
        description?: string;
    };
    rankDate?: string | null;
    backgroundStyle?: CSSProperties;
    currentTickerOverride?: string;
    selectedSecurityTypeOverride?: string;
}

const DEFAULT_BACKGROUND: CSSProperties = {};

const EDGE_TO_EDGE_SECTION_CLASS = "detail-section space-y-5 border-t border-border py-6 sm:py-8";

const MARQUEE_CARD_CLASS = "min-w-0 space-y-2 border-b border-border py-4";

export function KeyMetricsSection({
    companyMarketcapData,
    companySecs,
    security,
    periodAnalysis,
    marketCapRanking,
    activeMetric,
    backgroundStyle,
    rankDate,
    currentTickerOverride,
    selectedSecurityTypeOverride,
}: KeyMetricsSectionProps) {
    const pathname = usePathname();

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
        if (!resolvedTicker || !resolvedCurrentSecurity) return "시가총액 구성";

        const securityType = resolvedCurrentSecurity.type || "";
        const isCommonStock = securityType.includes("보통주");
        const isPreferredStock = securityType.includes("우선주");
        const onSecurityRoute = pathname.includes("/security/");

        if (isPreferredStock) {
            return "우선주";
        }

        if (onSecurityRoute) {
            return isCommonStock ? "보통주" : securityType || "시가총액 구성";
        }

        return "시가총액 구성";
    }, [selectedSecurityTypeOverride, companyMarketcapData, companySecs, resolvedTicker, resolvedCurrentSecurity, pathname]);

    const currentMarketcap = selectedSecurityType === '시가총액 구성'
        ? companyMarketcapData?.totalMarketcap != null
            ? { value: companyMarketcapData.totalMarketcap, date: companyMarketcapData.totalMarketcapDate }
            : { value: security.company?.marketcap ?? null, date: security.company?.marketcapDate ?? null }
        : getSecurityMarketcapSnapshot(resolvedCurrentSecurity ?? security, companyMarketcapData);
    const marketcapDateLabel = currentMarketcap.date && !Number.isNaN(new Date(currentMarketcap.date).getTime())
        ? new Date(currentMarketcap.date).toISOString().slice(0, 10) : null;
    const currentMarketcapLabel = selectedSecurityType === '시가총액 구성'
        ? '현재 시총'
        : `${'fromHistory' in currentMarketcap && currentMarketcap.fromHistory ? '이력 마지막' : '현재'} ${selectedSecurityType} 시총`;
    const selectedHistory = getSecurityMarketcapHistory(companyMarketcapData, (resolvedCurrentSecurity ?? security).securityId);
    const statisticsHistory = selectedSecurityType === '시가총액 구성'
        ? companyMarketcapData?.aggregatedHistory.map(item => ({ date: item.date, value: item.totalMarketcap })) ?? []
        : selectedHistory;
    const currentMarketcapComparison = getSnapshotHistoryComparison(currentMarketcap, statisticsHistory);

    // 날짜 기반 데이터 필터링 헬퍼
    const getDataByPeriod = (months: number) => {
        if (!companyMarketcapData?.aggregatedHistory) return [];

        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);

        return companyMarketcapData.aggregatedHistory.filter((item) => {
            const itemDate = new Date(item.date);
            return itemDate >= cutoffDate;
        });
    };

    const getSelectedDataByPeriod = (months: number) => {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);
        return selectedHistory.filter(item => new Date(item.date) >= cutoffDate);
    };

    // 선택된 타입에 따른 데이터 필터링 (개선된 버전)
    const getMetricValue = (type: 'current' | 'avg12m' | 'avg3y' | 'avg5y' | 'avg10y' | 'avgAll' | 'min' | 'max') => {
        if (type === 'current') return currentMarketcap.value;
        if (selectedSecurityType === "시가총액 구성") {
            if (!companyMarketcapData?.aggregatedHistory) return null;
            // 시가총액 구성: 전체 시가총액 기준
            switch (type) {
                case 'avg12m': {
                    const data = getDataByPeriod(12);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'avg3y': {
                    const data = getDataByPeriod(36);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'avg5y': {
                    const data = getDataByPeriod(60);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'avg10y': {
                    const data = getDataByPeriod(120);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'avgAll': {
                    if (!companyMarketcapData?.aggregatedHistory) return null;
                    const allValues = companyMarketcapData.aggregatedHistory.map((item) => item.totalMarketcap);
                    return allValues.length > 0 ? allValues.reduce((sum: number, val: number) => sum + val, 0) / allValues.length : null;
                }
                case 'min': return periodAnalysis?.minMax.min;
                case 'max': return periodAnalysis?.minMax.max;
            }
        } else {
            // Actual security records keep zero distinct from an absent observation.
            const securityValues = selectedHistory.map(item => item.value);

            if (securityValues.length === 0) return null;

            switch (type) {
                case 'avg12m':
                case 'avg3y':
                case 'avg5y':
                case 'avg10y': {
                    const months = { avg12m: 12, avg3y: 36, avg5y: 60, avg10y: 120 }[type];
                    const values = getSelectedDataByPeriod(months).map(item => item.value);
                    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
                }
                case 'avgAll': return securityValues.reduce((sum, value) => sum + value, 0) / securityValues.length;
                case 'min': return Math.min(...securityValues);
                case 'max': return Math.max(...securityValues);
            }
        }
        return null;
    };

    // 보통주 비중 계산 함수
    const getCommonStockRatio = (type: 'min' | 'max') => {
        if (!companyMarketcapData?.aggregatedHistory) return 0;

        const ratios: number[] = [];
        companyMarketcapData.aggregatedHistory.forEach((historyItem) => {
            if (historyItem.securitiesBreakdown) {
                const commonStockSecurities = companyMarketcapData.securities.filter((sec) => sec.type === '보통주');
                const commonStockValue = commonStockSecurities.reduce((sum: number, sec) => {
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
        if (current == null || comparison == null || !Number.isFinite(current) || !Number.isFinite(comparison) || comparison === 0 || current === comparison) {
            return { value: "—", color: "text-muted-foreground" };
        }
        const rate = ((current - comparison) / comparison) * 100;
        const formatted = formatChangeRate(rate);

        return { value: formatted.value, color: rate > 0 ? 'market-up' : rate < 0 ? 'market-down' : 'text-muted-foreground' };
    };

    // 이전 기간 평균과의 변화율 계산
    const getPreviousPeriodAverage = (type: 'avg12m' | 'avg3y' | 'avg5y' | 'avg10y') => {
        let currentMonths: number, previousMonths: number;
        switch (type) {
            case 'avg12m': currentMonths = 12; previousMonths = 24; break;
            case 'avg3y': currentMonths = 36; previousMonths = 72; break;
            case 'avg5y': currentMonths = 60; previousMonths = 120; break;
            case 'avg10y': currentMonths = 120; previousMonths = 240; break;
        }

        const currentPeriodData = getDataByPeriod(currentMonths);
        const previousPeriodData = getDataByPeriod(previousMonths).filter((item) => {
            const itemDate = new Date(item.date);
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - currentMonths);
            return itemDate < cutoffDate;
        });

        if (selectedSecurityType === "시가총액 구성") {
            if (currentPeriodData.length === 0 || previousPeriodData.length === 0) return null;
            const currentAvg = currentPeriodData.reduce((sum: number, item) => sum + item.totalMarketcap, 0) / currentPeriodData.length;
            const previousAvg = previousPeriodData.reduce((sum: number, item) => sum + item.totalMarketcap, 0) / previousPeriodData.length;
            return { current: currentAvg, previous: previousAvg };
        } else {
            const currentValues = getSelectedDataByPeriod(currentMonths).map(item => item.value);
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - currentMonths);
            const previousValues = getSelectedDataByPeriod(previousMonths)
                .filter(item => new Date(item.date) < cutoffDate).map(item => item.value);

            if (currentValues.length === 0 || previousValues.length === 0) return null;

            const currentAvg = currentValues.reduce((sum: number, val: number) => sum + val, 0) / currentValues.length;
            const previousAvg = previousValues.reduce((sum: number, val: number) => sum + val, 0) / previousValues.length;
            return { current: currentAvg, previous: previousAvg };
        }
    };

    // 이력 마지막 보통주 비중 계산
    const getCurrentCommonStockRatio = () => {
        if (!companyMarketcapData?.aggregatedHistory || companyMarketcapData.aggregatedHistory.length === 0) return 0;

        const latestData = [...companyMarketcapData.aggregatedHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (latestData.securitiesBreakdown) {
            const commonStockSecurities = companyMarketcapData.securities.filter((sec) => sec.type === '보통주');
            const commonStockValue = commonStockSecurities.reduce((sum: number, sec) => {
                return sum + (latestData.securitiesBreakdown[sec.securityId] || 0);
            }, 0);
            return (commonStockValue / latestData.totalMarketcap) * 100;
        }
        return 0;
    };

    const currentPriceRecord = selectedSecurityType === "시가총액 구성"
        ? security.prices?.[0]
        : resolvedCurrentSecurity?.prices?.[0] ?? security.prices?.[0];
    const currentPrice = currentPriceRecord?.close;
    const hasCurrentPrice = currentPrice != null && Number.isFinite(currentPrice);
    const currentPriceRate = hasCurrentPrice && currentPriceRecord?.rate != null && Number.isFinite(currentPriceRecord.rate)
        ? currentPriceRecord.rate : null;
    const priceDate = hasCurrentPrice ? currentPriceRecord?.date : null;
    const priceDateLabel = priceDate && !Number.isNaN(new Date(priceDate).getTime()) ? new Date(priceDate).toISOString().slice(0, 10) : null;

    if (!periodAnalysis && selectedSecurityType === '시가총액 구성') return null;

    return (
        <section
            id="indicators"
            className={`${EDGE_TO_EDGE_SECTION_CLASS} border-border border-border bg-background`}
            style={backgroundStyle ?? DEFAULT_BACKGROUND}
        >

            {rankDate && <p className="text-xs text-muted-foreground">순위 기준 {rankDate}</p>}
            {marketcapDateLabel && <p className="text-xs text-muted-foreground">시가총액 기준 {marketcapDateLabel}</p>}
            {hasCurrentPrice && <p className="text-xs text-muted-foreground">{priceDateLabel ? `주가 기준 ${priceDateLabel}` : '주가 기준일 미등록'}</p>}
            <p className="text-xs text-muted-foreground">{describeMarketcapHistory(statisticsHistory)} {DETAIL_HISTORY_PERIOD_NOTE}</p>
            <p className="text-xs text-muted-foreground">시총 변화는 표시 기준일보다 앞선 이력과, 기간 평균 변화는 직전 같은 길이의 기간과 비교합니다.</p>
            <header className="flex flex-wrap items-center gap-4">
                <div className="hidden bg-background bg-background">
                    <TrendingUp className="h-6 w-6 text-foreground text-foreground" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">핵심 지표</h2>
                    <p className="text-sm text-muted-foreground text-foreground md:text-base">
                        {selectedSecurityType === "시가총액 구성"
                            ? `${activeMetric.label} 주요 지표와 변화율 현황`
                            : `${selectedSecurityType} · ${activeMetric.label} 지표 변화`
                        }
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {/* 시총 랭킹 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        {(() => {
                            if (selectedSecurityType === "시가총액 구성") {
                                // 시가총액 구성 모드: 회사 랭킹 사용
                                const companyRank = security.company?.marketcapRank;
                                if (companyRank) {
                                    return (
                                        <>
                                            <span className="text-lg sm:text-xl">{companyRank}</span>
                                            <span className="text-xs ml-1">위</span>
                                        </>
                                    );
                                }
                            } else {
                                // 개별 종목 모드: 종목 랭킹 사용
                                if (marketCapRanking?.currentRank != null) {
                                    return (
                                        <>
                                            <span className="text-lg sm:text-xl">{marketCapRanking.currentRank}</span>
                                            <span className="text-xs ml-1">위</span>
                                        </>
                                    );
                                }
                            }
                            return <span className="text-lg sm:text-xl">—</span>;
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
                                        <span className="text-muted-foreground">
                                            {rankChange === 0 ? "—" :
                                                rankChange < 0 ? `↑ +${Math.abs(rankChange)}` :
                                                    `↓ -${rankChange}`}
                                        </span>
                                    );
                                }
                            } else {
                                // 개별 종목 모드: 종목 랭킹 변화 사용
                                if (marketCapRanking && marketCapRanking.priorRank) {
                                    return (
                                        <span className="text-muted-foreground">
                                            {marketCapRanking.rankChange === 0 ? "—" :
                                                marketCapRanking.rankChange < 0 ? `▲${Math.abs(marketCapRanking.rankChange)}` :
                                                    `▼${marketCapRanking.rankChange}`}
                                        </span>
                                    );
                                }
                            }
                            return <span className="text-muted-foreground text-muted-foreground">—</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">
                        {selectedSecurityType === "시가총액 구성" ? "시총 랭킹" : `${selectedSecurityType} 랭킹`}
                    </div>
                </div>

                {/* 현재 시가총액 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        {(() => {
                            const value = getMetricValue('current');
                            if (value == null) return <span className="text-lg">—</span>;
                            const formatted = formatNumberWithSeparateUnit(value ?? 0);
                            return (
                                <>
                                    <span className="text-lg sm:text-xl">{formatted.number}</span>
                                    <span className="text-xs ml-1">{formatted.unit}원</span>
                                </>
                            );
                        })()}
                    </div>
                    {/* 표시된 스냅샷과 같은 날짜·값의 이력만 비교 */}
                    <div className="text-xs leading-tight mb-1">
                        {(() => {
                            const change = currentMarketcapComparison;
                            if (!change) return <span className="text-muted-foreground text-muted-foreground">—</span>;
                            const rate = change.previous > 0 && change.current === change.previous
                                ? { value: formatChangeRate(0).value, color: 'text-muted-foreground' }
                                : getChangeRate(change.current, change.previous);
                            return <>
                                <span className={rate.color}>{rate.value}</span>
                                <span className="mt-1 block text-muted-foreground">{change.previousDate} 이력 대비</span>
                            </>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">
                        {currentMarketcapLabel}
                    </div>
                </div>

                {/* 현재 주가 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{hasCurrentPrice ? currentPrice.toLocaleString('ko-KR') : "—"}</span>
                        {hasCurrentPrice && <span className="text-xs ml-1">원</span>}
                    </div>
                    {/* 전일 대비 주가 변화율 */}
                    <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1 text-xs leading-tight mb-1">
                        <span className="text-muted-foreground">전일 대비</span>
                        {currentPriceRate != null ? <Rate rate={currentPriceRate} size="sm" showIcon={false} />
                            : <span className="text-muted-foreground">—</span>}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">현재 주가</div>
                </div>

                {/* 12개월 평균 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        {(() => {
                            const value = getMetricValue('avg12m');
                            if (value == null) return <span className="text-lg sm:text-xl">—</span>;
                            const formatted = formatNumberWithSeparateUnit(value);
                            return (
                                <>
                                    <span className="text-lg sm:text-xl">{formatted.number}</span>
                                    <span className="text-xs ml-1">{formatted.unit}원</span>
                                </>
                            );
                        })()}
                    </div>
                    {/* 이전 12개월 대비 변화율 */}
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getPreviousPeriodAverage('avg12m');
                            if (!change) return <span className="text-muted-foreground text-muted-foreground">—</span>;
                            const rate = getChangeRate(change.current, change.previous);
                            return <span className={rate.color}>{rate.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">12개월 평균</div>
                </div>

                {/* 3년 평균 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        {(() => {
                            const value = getMetricValue('avg3y');
                            if (value == null) return <span className="text-lg sm:text-xl">—</span>;
                            const formatted = formatNumberWithSeparateUnit(value);
                            return (
                                <>
                                    <span className="text-lg sm:text-xl">{formatted.number}</span>
                                    <span className="text-xs ml-1">{formatted.unit}원</span>
                                </>
                            );
                        })()}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getPreviousPeriodAverage('avg3y');
                            if (!change) return <span className="text-muted-foreground text-muted-foreground">—</span>;
                            const rate = getChangeRate(change.current, change.previous);
                            return <span className={rate.color}>{rate.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">3년 평균</div>
                </div>

                {/* 5년 평균 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        {(() => {
                            const value = getMetricValue('avg5y');
                            if (value == null) return <span className="text-lg sm:text-xl">—</span>;
                            const formatted = formatNumberWithSeparateUnit(value);
                            return (
                                <>
                                    <span className="text-lg sm:text-xl">{formatted.number}</span>
                                    <span className="text-xs ml-1">{formatted.unit}원</span>
                                </>
                            );
                        })()}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getPreviousPeriodAverage('avg5y');
                            if (!change) return <span className="text-muted-foreground text-muted-foreground">—</span>;
                            const rate = getChangeRate(change.current, change.previous);
                            return <span className={rate.color}>{rate.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">5년 평균</div>
                </div>

                {/* 10년 평균 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        {(() => {
                            const value = getMetricValue('avg10y');
                            if (value == null) return <span className="text-lg sm:text-xl">—</span>;
                            const formatted = formatNumberWithSeparateUnit(value);
                            return (
                                <>
                                    <span className="text-lg sm:text-xl">{formatted.number}</span>
                                    <span className="text-xs ml-1">{formatted.unit}원</span>
                                </>
                            );
                        })()}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getPreviousPeriodAverage('avg10y');
                            if (!change) return <span className="text-muted-foreground text-muted-foreground">—</span>;
                            const rate = getChangeRate(change.current, change.previous);
                            return <span className={rate.color}>{rate.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">10년 평균</div>
                </div>

                {/* 전체 평균 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        {(() => {
                            const value = getMetricValue('avgAll');
                            if (value == null) return <span className="text-lg sm:text-xl">—</span>;
                            const formatted = formatNumberWithSeparateUnit(value);
                            return (
                                <>
                                    <span className="text-lg sm:text-xl">{formatted.number}</span>
                                    <span className="text-xs ml-1">{formatted.unit}원</span>
                                </>
                            );
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">전체 평균</div>
                </div>

                {/* 최저 시총 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        {(() => {
                            const value = getMetricValue('min');
                            if (value == null) return <span className="text-lg">—</span>;
                            const formatted = formatNumberWithSeparateUnit(value ?? 0);
                            return (
                                <>
                                    <span className="text-lg sm:text-xl">{formatted.number}</span>
                                    <span className="text-xs ml-1">{formatted.unit}원</span>
                                </>
                            );
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">이력 최저 시총</div>
                </div>

                {/* 최고 시총 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        {(() => {
                            const value = getMetricValue('max');
                            if (value == null) return <span className="text-lg">—</span>;
                            const formatted = formatNumberWithSeparateUnit(value ?? 0);
                            return (
                                <>
                                    <span className="text-lg sm:text-xl">{formatted.number}</span>
                                    <span className="text-xs ml-1">{formatted.unit}원</span>
                                </>
                            );
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">이력 최고 시총</div>
                </div>

                {/* 최고 보통주 비중 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">
                            {(() => {
                                const ratio = getCommonStockRatio('max');
                                return ratio > 0 ? `${ratio.toFixed(1)}` : "—";
                            })()}
                        </span>
                        <span className="text-xs ml-1">%</span>
                    </div>
                    {/* 현재 비중과의 차이 */}
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const currentRatio = getCurrentCommonStockRatio();
                            const maxRatio = getCommonStockRatio('max');
                            if (maxRatio === 0 || currentRatio === 0) return <span className="text-muted-foreground text-muted-foreground">—</span>;
                            const diff = maxRatio - currentRatio;
                            const color = diff > 0 ? "market-up" : diff < 0 ? "market-down" : "text-muted-foreground text-muted-foreground";
                            return <span className={color}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%p</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">최고 보통주 비중</div>
                </div>

                {/* 최저 보통주 비중 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">
                            {(() => {
                                const ratio = getCommonStockRatio('min');
                                return ratio < 100 ? `${ratio.toFixed(1)}` : "—";
                            })()}
                        </span>
                        <span className="text-xs ml-1">%</span>
                    </div>
                    {/* 현재 비중과의 차이 */}
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const currentRatio = getCurrentCommonStockRatio();
                            const minRatio = getCommonStockRatio('min');
                            if (minRatio >= 100 || currentRatio === 0) return <span className="text-muted-foreground text-muted-foreground">—</span>;
                            const diff = minRatio - currentRatio;
                            const color = diff > 0 ? "market-up" : diff < 0 ? "market-down" : "text-muted-foreground text-muted-foreground";
                            return <span className={color}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%p</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">최저 보통주 비중</div>
                </div>
            </div>
        </section>
    );
}
