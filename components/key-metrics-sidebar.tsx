"use client";

import { usePathname } from "next/navigation";
import { useMemo, memo } from "react";
import { formatNumberWithSeparateUnit } from "@/lib/utils";
import { DetailMetricFacts } from "./detail-metric-facts";

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
        if (type === 'current') {
            return selectedSecurityType === '시가총액 구성'
                ? companyMarketcapData?.totalMarketcap ?? security.company?.marketcap ?? null
                : resolvedCurrentSecurity?.marketcap ?? security.marketcap ?? null;
        }
        if (!companyMarketcapData?.aggregatedHistory?.length) return null;

        if (selectedSecurityType === "시가총액 구성") {
            // 시가총액 구성: 전체 시가총액 기준
            switch (type) {
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

    const format = (value: number | null) => {
        if (value == null || !Number.isFinite(value)) return '—';
        const result = formatNumberWithSeparateUnit(value);
        return `${result.number}${result.unit}원`;
    };
    const rank = selectedSecurityType === '시가총액 구성' ? security.company?.marketcapRank : marketCapRanking?.currentRank;
    const price = (resolvedCurrentSecurity ?? security).prices?.[0]?.close;
    const date = companyMarketcapData?.totalMarketcapDate;
    const dateLabel = date && !Number.isNaN(new Date(date).getTime()) ? new Date(date).toISOString().slice(0, 10) : null;
    return <DetailMetricFacts onCollapsedChange={onCollapsedChange} rows={[
        [selectedSecurityType === '시가총액 구성' ? '기업 시가총액 순위' : `${resolvedCurrentSecurity?.type || '종목'} 순위`, rank != null ? `${rank}위` : '—'],
        [selectedSecurityType === '시가총액 구성' ? '기업 전체 시가총액' : '종목 시가총액', format(getMetricValue('current'))],
        ['현재 주가', price != null ? `${price.toLocaleString('ko-KR')}원` : '—'],
        ['5년 평균', format(getMetricValue('avg5y'))],
        ['이력 최저 시가총액', format(getMetricValue('min'))],
        ['이력 최고 시가총액', format(getMetricValue('max'))],
    ]} note={`${dateLabel ? `시가총액 기준 ${dateLabel}. ` : ''}평균·최저·최고는 이력 데이터 기준입니다.`} />;
}

export default memo(KeyMetricsSidebar);
