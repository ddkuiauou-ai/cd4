"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import ChartCompanyMarketcap from "./chart-company-marketcap";
import ChartMarketcap from "./chart-marketcap";
import ChartLoadingSkeleton from "./chart-loading-skeleton";
import ChartA11yDescription from "./chart-a11y-description";

interface InteractiveChartSectionProps {
    companyMarketcapData: any;
    companySecs: any[];
    type: "summary" | "detailed"; // 요약 차트 vs 상세 차트
    selectedTicker?: string; // 선택된 티커 (클라이언트 사이드 업데이트용)
    onTickerChange?: (ticker: string) => void; // 티커 변경 콜백
    selectedType?: string; // 🎯 차트 어노테이션을 위한 선택 타입
}

// 📅 주별 데이터 추출 함수 (개선된 버전) - 메모이제이션 최적화
const getWeeklyData = (data: any[]) => {
    if (!data.length) return [];

    // 날짜별로 정렬 (오래된 것부터)
    const sortedData = data.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateA.getTime() - dateB.getTime();
    });

    const weeklyData: any[] = [];
    let lastWeekStart = '';

    sortedData.forEach((item) => {
        const itemDate = item.date instanceof Date ? item.date : new Date(item.date);

        // 월요일 기준으로 주차 계산
        const currentDay = itemDate.getDay(); // 0=일요일, 1=월요일, ...
        const daysToMonday = currentDay === 0 ? -6 : 1 - currentDay; // 해당 주의 월요일까지 차이
        const mondayOfWeek = new Date(itemDate);
        mondayOfWeek.setDate(itemDate.getDate() + daysToMonday);

        const weekStart = mondayOfWeek.toISOString().split('T')[0]; // YYYY-MM-DD 형식

        // 새로운 주의 첫 번째 데이터만 추가 (주당 1개)
        if (weekStart !== lastWeekStart) {
            weeklyData.push(item);
            lastWeekStart = weekStart;
        }
    });

    // 최근 6개월 내에서 최대 26주 정도의 데이터 (주당 1개)
    return weeklyData.slice(-26);
};

// 📊 차트 데이터 처리 함수 메모이제이션 최적화
const processChartData = (rawData: any[], type: "summary" | "detailed") => {
    if (!rawData?.length) return [];

    let filteredHistory = rawData;

    if (type === "summary") {
        // 1. 최근 6개월 데이터만 가져오기
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        filteredHistory = rawData.filter(item => {
            const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
            return itemDate >= sixMonthsAgo;
        });

        // 2. 주별 데이터로 샘플링
        return getWeeklyData(filteredHistory);
    }

    return filteredHistory;
};

export function InteractiveChartSection({
    companyMarketcapData,
    companySecs,
    type,
    selectedTicker,
    onTickerChange,
    selectedType = "시가총액 구성" // 🎯 URL에서 받은 어노테이션 타입
}: InteractiveChartSectionProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [isAnimating, setIsAnimating] = useState(false);

    // 🚨 데이터 유효성 검사
    const hasValidData = useMemo(() => {
        return companyMarketcapData?.aggregatedHistory?.length > 0;
    }, [companyMarketcapData]);

    // 🎯 어노테이션 타입 (prop으로 받은 값 사용)
    const selectedSecurityType = selectedType;

    // 차트 데이터 준비 - 메모이제이션으로 성능 최적화
    const chartData = useMemo(() => {
        if (!companyMarketcapData?.aggregatedHistory?.length) return [];

        // 처리된 데이터를 재사용
        const processedData = processChartData(companyMarketcapData.aggregatedHistory, type);

        return processedData.map((item: any) => {
            const chartData: { [key: string]: string | number | boolean | null | undefined; date: string; value: number; } = {
                date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date),
                value: item.totalMarketcap || 0,
            };
            chartData['총합계'] = item.totalMarketcap || 0;

            // 보안상 null 체크 추가
            if (companyMarketcapData.securities && Array.isArray(companyMarketcapData.securities)) {
                companyMarketcapData.securities.forEach((sec: any) => {
                    const securityName = sec.korName || sec.name || '알 수 없음';
                    const securityType = sec.type || '';
                    const breakdownValue = item.securitiesBreakdown?.[sec.securityId] || 0;
                    let displayName;
                    if (securityType && securityType.includes('보통주')) {
                        displayName = `${securityName} 보통주`;
                    } else if (securityType && securityType.includes('우선주')) {
                        displayName = `${securityName} 우선주`;
                    } else if (securityType) {
                        displayName = `${securityName} (${securityType})`;
                    } else {
                        displayName = securityName;
                    }
                    chartData[displayName] = breakdownValue;
                });
            }

            return chartData;
        });
    }, [companyMarketcapData?.aggregatedHistory, companyMarketcapData?.securities, type]);

    // 🚨 데이터가 없는 경우 Empty State UI
    if (!hasValidData) {
        return (
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <div className="space-y-2">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">차트 데이터 없음</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
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
            <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/50 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <div className="space-y-2">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">데이터 처리 중</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                        차트 데이터를 준비하고 있습니다. 잠시 후 다시 시도해주세요.
                    </p>
                </div>
            </div>
        );
    }

    // 로딩 상태 표시
    if (isPending || isAnimating) {
        return <ChartLoadingSkeleton />;
    }

    if (type === "summary") {
        return (
            <div className="transition-all duration-300 ease-in-out w-full flex-1">
                <ChartA11yDescription
                    data={chartData}
                    selectedType={selectedSecurityType}
                    type="summary"
                />
                <ChartCompanyMarketcap
                    data={chartData}
                    format="formatNumber"
                    formatTooltip="formatNumberTooltip"
                    selectedType={selectedSecurityType}
                />
            </div>
        );
    }

    return (
        <div className="transition-all duration-300 ease-in-out w-full flex-1">
            <ChartA11yDescription
                data={chartData}
                selectedType={selectedSecurityType}
                type="detailed"
            />
            <ChartMarketcap
                data={chartData}
                format="formatNumber"
                formatTooltip="formatNumberTooltip"
                selectedType={selectedSecurityType}
            />
        </div>
    );
}
