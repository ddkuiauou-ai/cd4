"use client";

import { useMemo, useState, useTransition } from "react";
import { Calendar, BarChart3, Database, TrendingUp } from "lucide-react";
import ChartPER from "./chart-PER";
import ListPER from "./list-PER";
import ChartLoadingSkeleton from "./chart-loading-skeleton";

interface InteractiveChartPERSectionProps {
    result: Array<{ date: string; value: number }>;
    security: any;
    perRank?: number;
    latestPER?: number | null;
}

// 📅 기간별 필터링 함수
const getFilteredData = (data: Array<{ date: string; value: number }>, periodYears: number | null) => {
    if (!data?.length || periodYears === null) return data;

    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - periodYears);

    return data.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= cutoffDate;
    });
};

// 📊 기간 옵션
const PERIOD_OPTIONS = [
    { label: "전체", value: null, icon: Database },
    { label: "20년", value: 20, icon: Calendar },
    { label: "10년", value: 10, icon: Calendar },
    { label: "5년", value: 5, icon: Calendar },
    { label: "3년", value: 3, icon: Calendar },
    { label: "1년", value: 1, icon: Calendar },
];

export function InteractiveChartPERSection({
    result,
    security,
    perRank,
    latestPER
}: InteractiveChartPERSectionProps) {
    const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
    const [activeView, setActiveView] = useState<"chart" | "list">("chart");
    const [isPending, startTransition] = useTransition();
    const [isAnimating, setIsAnimating] = useState(false);

    // 🚨 데이터 유효성 검사
    const hasValidData = useMemo(() => {
        return result?.length > 0;
    }, [result]);

    // 필터링된 데이터
    const filteredData = useMemo(() => {
        return getFilteredData(result, selectedPeriod);
    }, [result, selectedPeriod]);

    // 차트용 데이터 변환
    const chartData = useMemo(() => {
        return filteredData.map(item => ({
            date: item.date,
            totalValue: item.value
        }));
    }, [filteredData]);

    // 통계 계산
    const stats = useMemo(() => {
        if (!filteredData?.length) return null;

        const values = filteredData.map(item => item.value).filter(val => val != null);
        const average = values.reduce((sum, val) => sum + val, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);

        return { average, min, max, count: values.length };
    }, [filteredData]);

    const handlePeriodChange = (period: number | null) => {
        if (selectedPeriod === period) return;

        setIsAnimating(true);
        startTransition(() => {
            setSelectedPeriod(period);
            setTimeout(() => setIsAnimating(false), 300);
        });
    };

    const handleViewChange = (view: "chart" | "list") => {
        if (activeView === view) return;

        setIsAnimating(true);
        startTransition(() => {
            setActiveView(view);
            setTimeout(() => setIsAnimating(false), 300);
        });
    };

    if (!hasValidData) {
        return (
            <div className="space-y-8">
                {/* 빈 상태 UI */}
                <div className="flex flex-col items-center justify-center p-12 space-y-6 text-center bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="w-20 h-20 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <BarChart3 className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                    </div>
                    <div className="space-y-3 max-w-md">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">PER 데이터 없음</h3>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            <strong>{security.korName || security.name}</strong>의 주가수익비율(PER) 데이터를 불러올 수 없습니다.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* 통계 요약 카드 */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">평균 PER</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {stats.average.toFixed(2)}배
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">최저 PER</div>
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {stats.min.toFixed(2)}배
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">최고 PER</div>
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">
                            {stats.max.toFixed(2)}배
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">데이터 포인트</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {stats.count}개
                        </div>
                    </div>
                </div>
            )}

            {/* 컨트롤 패널 */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                {/* 기간 필터 */}
                <div className="flex flex-wrap gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 py-2">
                        <Calendar className="h-4 w-4" />
                        기간:
                    </span>
                    {PERIOD_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const isActive = selectedPeriod === option.value;

                        return (
                            <button
                                key={option.label}
                                onClick={() => handlePeriodChange(option.value)}
                                disabled={isPending}
                                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
                  ${isActive
                                        ? "bg-purple-600 text-white shadow-sm"
                                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    }
                  ${isPending ? "opacity-50 cursor-not-allowed" : ""}
                `}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {option.label}
                            </button>
                        );
                    })}
                </div>

                {/* 뷰 전환 */}
                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <button
                        onClick={() => handleViewChange("chart")}
                        disabled={isPending}
                        className={`
              inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
              ${activeView === "chart"
                                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                            }
              ${isPending ? "opacity-50 cursor-not-allowed" : ""}
            `}
                    >
                        <BarChart3 className="h-4 w-4" />
                        차트
                    </button>
                    <button
                        onClick={() => handleViewChange("list")}
                        disabled={isPending}
                        className={`
              inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
              ${activeView === "list"
                                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                            }
              ${isPending ? "opacity-50 cursor-not-allowed" : ""}
            `}
                    >
                        <Database className="h-4 w-4" />
                        데이터
                    </button>
                </div>
            </div>

            {/* 차트/리스트 컨텐츠 */}
            <div className={`transition-opacity duration-300 ${isAnimating ? "opacity-50" : "opacity-100"}`}>
                {isPending ? (
                    <ChartLoadingSkeleton />
                ) : activeView === "chart" ? (
                    <div className="space-y-4">
                        <ChartPER
                            data={chartData}
                            format="formatNumber"
                            formatTooltip="formatNumberRatio"
                        />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <ListPER data={filteredData} />
                    </div>
                )}
            </div>

            {/* 데이터 요약 정보 */}
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {selectedPeriod ? (
                    <>최근 {selectedPeriod}년 데이터 ({filteredData.length}개 포인트)</>
                ) : (
                    <>전체 데이터 ({filteredData.length}개 포인트)</>
                )}
                {latestPER && (
                    <> • 현재 PER: <span className="font-medium text-purple-600 dark:text-purple-400">{latestPER.toFixed(2)}배</span></>
                )}
                {perRank && (
                    <> • 랭킹: <span className="font-medium text-purple-600 dark:text-purple-400">{perRank}위</span></>
                )}
            </div>
        </div>
    );
}
