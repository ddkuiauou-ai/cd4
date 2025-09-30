"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState, useEffect, memo } from "react";
import { useCollapsedState } from "@/hooks/use-collapsed-state";
import { formatNumberWithSeparateUnit } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface KeyMetricsSidebarProps {
    companyMarketcapData: any;
    companySecs: any[];
    security: any;
    marketCapRanking: {
        currentRank: number | null;
        priorRank: number | null;
        rankChange: number;
        value: number | null;
    } | null;
    currentTickerOverride?: string;
    selectedSecurityTypeOverride?: string;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebar({
    companyMarketcapData,
    companySecs,
    security,
    marketCapRanking,
    currentTickerOverride,
    selectedSecurityTypeOverride,
    onCollapsedChange,
}: KeyMetricsSidebarProps) {
    const pathname = usePathname();
    const [isCollapsed, handleToggle] = useCollapsedState('key-metrics-collapsed', false);

    // 상태 변경 시 부모 컴포넌트에 알림
    useEffect(() => {
        onCollapsedChange?.(isCollapsed);
    }, [isCollapsed, onCollapsedChange]);

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

    // 선택된 타입에 따른 데이터 필터링
    const getMetricValue = (type: 'current' | 'avg5y' | 'min' | 'max') => {
        if (!companyMarketcapData?.aggregatedHistory) return null;

        if (selectedSecurityType === "시가총액 구성") {
            // 시가총액 구성: 전체 시가총액 기준
            switch (type) {
                case 'current':
                    const latestData = [...companyMarketcapData.aggregatedHistory].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    return latestData?.totalMarketcap || 0;
                case 'avg5y': {
                    const data = getDataByPeriod(60);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'min':
                    return Math.min(...companyMarketcapData.aggregatedHistory.map((item: any) => item.totalMarketcap));
                case 'max':
                    return Math.max(...companyMarketcapData.aggregatedHistory.map((item: any) => item.totalMarketcap));
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
                case 'avg5y': {
                    const data = getDataByPeriod(60);
                    const values = data
                        .map((item: any) => item.securitiesBreakdown?.[resolvedCurrentSecurity.securityId] || 0)
                        .filter((v: number) => v > 0);
                    return values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : null;
                }
                case 'min':
                    return Math.min(...securityValues);
                case 'max':
                    return Math.max(...securityValues);
            }
        }
        return null;
    };

    const getCurrentPrice = () => {
        if (selectedSecurityType === "시가총액 구성") {
            return security.prices?.[0]?.close ? security.prices[0].close.toLocaleString() : "—";
        } else {
            // 개별 종목의 경우 해당 종목 주가 표시
            if (resolvedCurrentSecurity?.prices?.[0]?.close) {
                return resolvedCurrentSecurity.prices[0].close.toLocaleString();
            }
            return security.prices?.[0]?.close ? security.prices[0].close.toLocaleString() : "—";
        }
    };

    const getRanking = () => {
        if (selectedSecurityType === "시가총액 구성") {
            return security.company?.marketcapRank || "—";
        } else {
            return marketCapRanking?.currentRank || "—";
        }
    };

    return (
        <div className={`${isCollapsed ? 'bg-background p-2 mb-0' : 'rounded-xl border bg-background p-4 mb-6'}`}>
            <button
                onClick={handleToggle}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
                className={`flex items-center gap-2 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors w-full justify-between ${isCollapsed ? 'py-2' : 'py-2 mb-3'
                    }`}
                aria-expanded={!isCollapsed}
                aria-controls="key-metrics-content"
                aria-label={`핵심 지표 ${isCollapsed ? '펼치기' : '접기'}`}
            >
                <span>핵심 지표</span>
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>

            {!isCollapsed && (
                <div id="key-metrics-content" className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                            {selectedSecurityType === "시가총액 구성" ? "시총 랭킹" : `${selectedSecurityType} 랭킹`}
                        </span>
                        <span className="font-medium">{getRanking()}위</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                            {selectedSecurityType === "시가총액 구성" ? "현재 시총" : `현재 ${selectedSecurityType} 시총`}
                        </span>
                        <span className="font-medium">
                            {(() => {
                                const value = getMetricValue('current');
                                const formatted = formatNumberWithSeparateUnit(value || 0);
                                return `${formatted.number}${formatted.unit}원`;
                            })()}
                        </span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">현재 주가</span>
                        <span className="font-medium">{getCurrentPrice()}원</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">5년 평균</span>
                        <span className="font-medium">
                            {(() => {
                                const value = getMetricValue('avg5y');
                                if (!value) return "—";
                                const formatted = formatNumberWithSeparateUnit(value);
                                return `${formatted.number}${formatted.unit}원`;
                            })()}
                        </span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">최저 시총</span>
                        <span className="font-medium">
                            {(() => {
                                const value = getMetricValue('min');
                                const formatted = formatNumberWithSeparateUnit(value || 0);
                                return `${formatted.number}${formatted.unit}원`;
                            })()}
                        </span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">최고 시총</span>
                        <span className="font-medium">
                            {(() => {
                                const value = getMetricValue('max');
                                const formatted = formatNumberWithSeparateUnit(value || 0);
                                return `${formatted.number}${formatted.unit}원`;
                            })()}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default memo(KeyMetricsSidebar);
