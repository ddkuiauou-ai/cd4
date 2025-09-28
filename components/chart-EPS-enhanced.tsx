"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import {
    formatNumber,
    formatNumberRaw,
    formatNumberTooltip,
    formatNumberRatio,
    formatNumberPercent,
    formatFunctionMapForChart,
} from "../lib/utils";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { EPSData, PeriodType, aggregateEPSDataByPeriod } from "@/lib/eps-utils";

interface ChartEPSEnhancedProps {
    data: EPSData[];
    format?: string;
    formatTooltip?: string;
    period?: PeriodType;
}

// Helper function to get period description
function getPeriodDescription(period: PeriodType): string {
    switch (period) {
        case '1D':
            return 'EPS 일별 추이';
        case '1W':
            return 'EPS 주별 추이';
        case '1M':
            return 'EPS 월별 추이';
        case '1Y':
            return 'EPS 연별 추이';
        default:
            return 'EPS 추이';
    }
}

interface FormatFunctionMap {
    [key: string]: (value: number, index?: number) => string;
}

export default function ChartEPSEnhanced({ data, format = "formatNumber", formatTooltip = "formatNumberTooltip", period = '1M' }: ChartEPSEnhancedProps) {
    const [windowWidth, setWindowWidth] = useState(0);

    useEffect(() => {
        function handleResize() {
            setWindowWidth(window.innerWidth);
        }

        if (typeof window !== 'undefined') {
            setWindowWidth(window.innerWidth);
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, []);

    const processedData = useMemo(() => {
        if (!data || data.length === 0) return [];

        // 기간별 데이터 집계
        const aggregatedData = aggregateEPSDataByPeriod(data, period);

        return aggregatedData.map((item) => ({
            ...item,
            displayDate: period === '1Y'
                ? new Date(item.time).getFullYear().toString()
                : new Date(item.time).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'short',
                    ...(period === '1D' && { day: 'numeric' })
                }),
            value: Number(item.value) || 0,
        }));
    }, [data, period]);

    if (!processedData || processedData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>{getPeriodDescription(period)}</CardTitle>
                    <CardDescription>
                        Earnings Per Share - 기업의 주당순이익 변화를 나타냅니다.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                        데이터가 없습니다.
                    </div>
                </CardContent>
            </Card>
        );
    }

    const formatFunction = (formatFunctionMapForChart as any)[format] || formatNumber;
    const tooltipFormatter = (formatFunctionMapForChart as any)[formatTooltip] || formatNumberTooltip;

    // 차트 색상 결정 (EPS는 높을수록 좋음)
    const getBarColor = (value: number) => {
        if (value > 0) return "#10B981"; // 플러스는 녹색 (이익)
        if (value < 0) return "#EF4444"; // 마이너스는 빨간색 (손실)
        return "#6B7280"; // 0은 회색
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>{getPeriodDescription(period)}</CardTitle>
                <CardDescription>
                    Earnings Per Share - 기업의 주당순이익 변화를 나타냅니다.
                    높은 값일수록 주주에게 더 많은 이익을 제공합니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={processedData}
                            margin={{
                                top: 20,
                                right: windowWidth < 640 ? 20 : 30,
                                left: windowWidth < 640 ? 20 : 20,
                                bottom: 20,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis
                                dataKey="displayDate"
                                axisLine={false}
                                tickLine={false}
                                className="text-xs fill-muted-foreground"
                                tick={{ fontSize: windowWidth < 640 ? 11 : 12 }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                className="text-xs fill-muted-foreground"
                                tick={{ fontSize: windowWidth < 640 ? 10 : 11 }}
                                tickFormatter={(value) => formatFunction(value)}
                                width={windowWidth < 640 ? 60 : 80}
                            />
                            <Tooltip
                                labelClassName="text-foreground font-medium"
                                contentStyle={{
                                    backgroundColor: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                }}
                                formatter={(value: any) => [
                                    tooltipFormatter(Number(value)),
                                    "주당순이익",
                                ]}
                                labelFormatter={(label) => `${label}년`}
                            />
                            <Bar
                                dataKey="value"
                                fill="#10B981"
                                radius={[2, 2, 0, 0]}
                                maxBarSize={60}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {processedData.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-sm bg-green-500"></div>
                            <span>흑자 (이익)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-sm bg-red-500"></div>
                            <span>적자 (손실)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-sm bg-gray-500"></div>
                            <span>손익분기점</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// EPS Chart with Period Switcher Component
interface EPSChartWithPeriodSwitcherProps {
    initialData: EPSData[];
}

export function EPSChartWithPeriodSwitcher({ initialData }: EPSChartWithPeriodSwitcherProps) {
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('1M');

    const periods: { key: PeriodType; label: string; description: string }[] = [
        { key: '1M', label: '월간', description: '월별 데이터' },
        { key: '1Y', label: '년간', description: '년별 평균' },
    ];

    return (
        <div className="space-y-4">
            {/* Period Switcher */}
            <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <span>기간 선택:</span>
                </div>
                <div className="flex gap-1">
                    {periods.map((period) => (
                        <button
                            key={period.key}
                            onClick={() => setSelectedPeriod(period.key)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedPeriod === period.key
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground border border-border'
                                }`}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart with selected period */}
            <div className="bg-background rounded-xl border p-2 sm:p-4 shadow-sm">
                <ChartEPSEnhanced
                    data={initialData}
                    period={selectedPeriod}
                />
            </div>
        </div>
    );
}
