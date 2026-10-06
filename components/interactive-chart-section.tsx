"use client";

import type { CompanyMarketcapAggregated } from '@/lib/data/company';
import type { DetailCompanyData, DetailSecurityRow } from './detail-types';
import { useMemo } from "react";
import ChartCompanyMarketcap from "./chart-company-marketcap";
import ChartMarketcap from "./chart-marketcap";
import { DetailCompanyHistoryObservation } from "./detail-company-history-observation";
import { createMarketcapChartData, createMarketcapSeries } from "@/lib/chart-selection";

interface InteractiveChartSectionProps {
    companyMarketcapData: DetailCompanyData;
    companySecs: DetailSecurityRow[];
    type: "summary" | "detailed"; // 요약 차트 vs 상세 차트
    selectedTicker?: string; // 선택된 티커 (클라이언트 사이드 업데이트용)
    onTickerChange?: (ticker: string) => void; // 티커 변경 콜백
    selectedType?: string; // 🎯 차트 어노테이션을 위한 선택 타입
    selectedSecurityId?: string;
}

// 📅 최근 3개월 일간 데이터 추출 함수
const getRecentDailyData = (data: CompanyMarketcapAggregated['aggregatedHistory'], months: number) => {
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    // 원본 배열 변경 없이 정렬
    const sortedData = [...data].sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateA.getTime() - dateB.getTime();
    });

    const latestEntry = sortedData.at(-1);
    if (!latestEntry) {
        return [];
    }

    const latestDate = latestEntry.date instanceof Date
        ? new Date(latestEntry.date)
        : new Date(latestEntry.date);

    if (Number.isNaN(latestDate.getTime())) {
        return sortedData;
    }

    const startDate = new Date(latestDate);
    startDate.setHours(0, 0, 0, 0);
    startDate.setMonth(startDate.getMonth() - months);

    const filtered = sortedData.filter((item) => {
        const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
        if (!(itemDate instanceof Date) || Number.isNaN(itemDate.getTime())) {
            return false;
        }
        return itemDate >= startDate && itemDate <= latestDate;
    });

    if (filtered.length === 0) {
        // 데이터가 부족한 경우 최근 90개 일간 데이터로 대체
        return sortedData.slice(-90);
    }

    return filtered;
};

// 📊 차트 데이터 처리 함수 메모이제이션 최적화
const processChartData = (rawData: CompanyMarketcapAggregated['aggregatedHistory'], type: "summary" | "detailed") => {
    if (!rawData?.length) return [];

    const filteredHistory = rawData;

    if (type === "summary") {
        return getRecentDailyData(rawData, 3);
    }

    return filteredHistory;
};

export function InteractiveChartSection({
    companyMarketcapData,
    type,
    selectedSecurityId,
    selectedType = "시가총액 구성" // 🎯 URL에서 받은 어노테이션 타입
}: InteractiveChartSectionProps) {
    // 🚨 데이터 유효성 검사
    const hasValidData = useMemo(() => {
        return (companyMarketcapData?.aggregatedHistory?.length ?? 0) > 0;
    }, [companyMarketcapData]);

    // 🎯 어노테이션 타입 (prop으로 받은 값 사용)
    const selectedSecurityType = selectedType;
    const processedHistory = useMemo(() => processChartData(companyMarketcapData?.aggregatedHistory ?? [], type), [companyMarketcapData, type]);
    const series = useMemo(() => createMarketcapSeries(companyMarketcapData?.securities ?? []), [companyMarketcapData]);
    const historyDates = [...new Set(processedHistory.map(item => new Date(item.date).toISOString().slice(0, 10)))].sort();
    const historyRange = historyDates.length === 1 ? historyDates[0] : `${historyDates[0]} ~ ${historyDates.at(-1)}`;

    // 차트 데이터 준비 - 메모이제이션으로 성능 최적화
    const chartData = useMemo(() => {
        if (!companyMarketcapData?.aggregatedHistory?.length) return [];

        return createMarketcapChartData(processedHistory, series);
    }, [companyMarketcapData, processedHistory, series]);
    const selectedSeries = series.find(item => item.securityId === selectedSecurityId);
    const descriptionKey = selectedSecurityId ? selectedSeries?.key : "총합계";
    const describeValue = (value: unknown) => typeof value === "number" && Number.isFinite(value)
        ? `${value.toLocaleString("ko-KR")}원` : "미등록";
    const chartDescription = <p className="sr-only" aria-live="polite">
        {selectedSecurityId ? selectedSeries?.label || "선택 종목" : "기업 합산"} 시가총액 이력.
        이력 범위 {historyRange}. 처음 기록 {describeValue(descriptionKey ? chartData[0]?.[descriptionKey] : null)},
        마지막 기록 {describeValue(descriptionKey ? chartData.at(-1)?.[descriptionKey] : null)}.
        총 {historyDates.length}개 날짜의 기록입니다.
    </p>;

    // 🚨 데이터가 없는 경우 Empty State UI
    if (!hasValidData) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-background bg-background rounded-lg border-2 border-dashed border-border border-border">
                <div className="w-16 h-16 bg-background bg-background rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-muted-foreground text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <div className="space-y-2">
                    <h3 className="font-medium text-muted-foreground text-muted-foreground">차트 데이터 없음</h3>
                    <p className="text-sm text-muted-foreground text-muted-foreground max-w-md">
                        {type === "summary"
                            ? "최근 시가총액 데이터를 찾을 수 없습니다."
                            : "연간 시가총액 데이터를 찾을 수 없습니다."
                        }
                    </p>
                </div>
            </div>
        );
    }

    // 🚨 차트 데이터가 빈 경우
    if (chartData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-background bg-background rounded-lg border border-border border-border">
                <div className="w-16 h-16 bg-background bg-background rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-muted-foreground text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <div className="space-y-2">
                    <h3 className="font-medium text-muted-foreground text-muted-foreground">데이터 처리 중</h3>
                    <p className="text-sm text-muted-foreground text-muted-foreground max-w-md">
                        차트 데이터를 준비하고 있습니다. 잠시 후 다시 시도해주세요.
                    </p>
                </div>
            </div>
        );
    }

    if (historyDates.length < 2 && companyMarketcapData) {
        return <DetailCompanyHistoryObservation data={companyMarketcapData} observation={processedHistory.at(-1)!} count={historyDates.length} selectedSecurityId={selectedSecurityId} />;
    }

    if (type === "summary") {
        return (
            <div className="w-full flex-1 space-y-3">
                <p className="text-xs text-muted-foreground tabular-nums">이력 범위 {historyRange} · 기록 {historyDates.length}개 · 마지막 이력일 기준 3개월 범위</p>
                <p className="text-xs text-muted-foreground">날짜별로 등록된 종목 값의 합계이며, 미등록 종목 값은 포함되지 않습니다.</p>
                {chartDescription}
                <ChartCompanyMarketcap
                    data={chartData}
                    format="formatNumber"
                    formatTooltip="formatNumberTooltip"
                    selectedType={selectedSecurityType}
                    selectedSecurityId={selectedSecurityId}
                    series={series}
                />
            </div>
        );
    }

    return (
        <div className="w-full flex-1 space-y-3">
            <p className="text-xs text-muted-foreground tabular-nums">전체 이력 범위 {historyRange} · 기록 {historyDates.length}개</p>
            <p className="text-xs text-muted-foreground">날짜별로 등록된 종목 값의 합계이며, 미등록 종목 값은 포함되지 않습니다.</p>
            {chartDescription}
            <ChartMarketcap
                data={chartData}
                format="formatNumber"
                formatTooltip="formatNumberTooltip"
                selectedType={selectedSecurityType}
                selectedSecurityId={selectedSecurityId}
                series={series}
            />
        </div>
    );
}
