"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { formatNumberWithSeparateUnit } from "@/lib/utils";

interface KeyMetricsSidebarProps {
    companyMarketcapData: any;
    companySecs: any[];
    security: any;
    marketCapRanking: {
        currentRank: number;
        priorRank: number | null;
        rankChange: number;
        value: number | null;
    } | null;
    currentTickerOverride?: string;
    selectedSecurityTypeOverride?: string;
}

export function KeyMetricsSidebar({
    companyMarketcapData,
    companySecs,
    security,
    marketCapRanking,
    currentTickerOverride,
    selectedSecurityTypeOverride,
}: KeyMetricsSidebarProps) {
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
        <div className="rounded-xl border bg-background p-4">
            <h3 className="text-sm font-semibold mb-3">핵심 지표</h3>
            <div className="space-y-3">
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
        </div>
    );
}
