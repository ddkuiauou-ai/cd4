"use client";

import { Area, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, ReferenceArea, ReferenceDot, Line, ComposedChart } from "recharts";
import { useTheme } from "next-themes";
import { useMemo } from "react";

interface ChartPEREnhancedProps {
    data: { date: string; value: number }[];
    className?: string;
}

// 데이터 전처리 함수
function processChartData(data: { date: string; value: number }[]) {
    if (!data || data.length === 0) return [];

    // 🔥 중복 날짜 데이터 제거 및 정렬
    const dateMap = new Map<string, { date: string; value: number }>();

    data.forEach(item => {
        const existingItem = dateMap.get(item.date);
        if (!existingItem || item.value > existingItem.value) {
            dateMap.set(item.date, item);
        }
    });

    const processedData = Array.from(dateMap.values())
        .filter(item => item.value !== null && !isNaN(item.value))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return processedData;
}

// 통계 계산 함수
function calculateStatistics(data: { date: string; value: number }[]) {
    if (!data || data.length === 0) return null;

    const values = data.map(d => d.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const max = Math.max(...values);
    const min = Math.min(...values);
    const current = values[values.length - 1];

    const maxIndex = values.indexOf(max);
    const minIndex = values.indexOf(min);

    return {
        mean,
        stdDev,
        max,
        min,
        current,
        maxDate: data[maxIndex].date,
        minDate: data[minIndex].date,
        currentDate: data[data.length - 1].date
    };
}

// 이동평균 계산 함수 (12개월)
function calculateMovingAverage(data: { date: string; value: number }[], windowSize: number = 12) {
    if (!data || data.length < windowSize) return [];

    const movingAvg = [];
    for (let i = windowSize - 1; i < data.length; i++) {
        const window = data.slice(i - windowSize + 1, i + 1);
        const avg = window.reduce((sum, item) => sum + item.value, 0) / windowSize;
        movingAvg.push({
            date: data[i].date,
            movingAvg: avg
        });
    }
    return movingAvg;
}

// 툴팁 컴포넌트
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
    if (active && payload && payload.length && label) {
        const value = payload[0].value;
        const formattedDate = new Date(label).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return (
            <div className="rounded-lg border bg-background p-3 shadow-md">
                <p className="text-sm font-medium text-foreground">{formattedDate}</p>
                <p className="text-sm text-muted-foreground">
                    PER: <span className="font-semibold text-primary">{value.toFixed(2)}배</span>
                </p>
            </div>
        );
    }
    return null;
}

export default function ChartPEREnhanced({ data, className }: ChartPEREnhancedProps) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    const processedData = useMemo(() => processChartData(data), [data]);
    const stats = useMemo(() => calculateStatistics(processedData), [processedData]);
    const movingAvgData = useMemo(() => calculateMovingAverage(processedData, 12), [processedData]);

    // Combine data with moving average
    const chartData = useMemo(() => processedData.map((item, index) => {
        const maItem = movingAvgData.find(ma => ma.date === item.date);
        return {
            ...item,
            index, // Add index for ReferenceDot
            movingAvg: maItem ? maItem.movingAvg : null
        };
    }), [processedData, movingAvgData]);

    // Find indices for annotations
    const maxIndex = useMemo(() => processedData.findIndex(item => item.date === stats?.maxDate), [processedData, stats?.maxDate]);
    const minIndex = useMemo(() => processedData.findIndex(item => item.date === stats?.minDate), [processedData, stats?.minDate]);
    const currentIndex = useMemo(() => processedData.length - 1, [processedData.length]);

    if (!processedData || processedData.length === 0) {
        return (
            <div className="h-[400px] flex items-center justify-center border border-dashed border-muted-foreground/25 rounded-lg">
                <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        PER 차트 데이터 없음
                    </p>
                    <p className="text-xs text-muted-foreground">
                        표시할 데이터가 없습니다
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            <ResponsiveContainer width="100%" height={400}>
                <ComposedChart
                    data={chartData}
                    margin={{
                        top: 20,
                        right: 30,
                        left: 0,
                        bottom: 0,
                    }}
                >
                    <defs>
                        <linearGradient id="perGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop
                                offset="5%"
                                stopColor="#3b82f6"
                                stopOpacity={isDark ? 0.3 : 0.8}
                            />
                            <stop
                                offset="95%"
                                stopColor="#3b82f6"
                                stopOpacity={isDark ? 0.1 : 0.1}
                            />
                        </linearGradient>
                        <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop
                                offset="5%"
                                stopColor="#10b981"
                                stopOpacity={0.1}
                            />
                            <stop
                                offset="95%"
                                stopColor="#10b981"
                                stopOpacity={0.05}
                            />
                        </linearGradient>
                    </defs>

                    {/* Valuation Band - ±1 SD */}
                    {stats && (
                        <>
                            <ReferenceArea
                                y1={Math.max(0, stats.mean - stats.stdDev)}
                                y2={stats.mean + stats.stdDev}
                                fill="#10b981"
                                fillOpacity={0.1}
                            />
                            {/* Mean line */}
                            <ReferenceLine
                                y={stats.mean}
                                stroke="#ef4444"
                                strokeDasharray="5 5"
                                strokeWidth={2}
                            />
                            {/* ±2 SD lines */}
                            <ReferenceLine
                                y={stats.mean + 2 * stats.stdDev}
                                stroke="#f59e0b"
                                strokeDasharray="3 3"
                                strokeWidth={1}
                            />
                            <ReferenceLine
                                y={stats.mean - 2 * stats.stdDev}
                                stroke="#f59e0b"
                                strokeDasharray="3 3"
                                strokeWidth={1}
                            />
                        </>
                    )}

                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => {
                            const date = new Date(value);
                            return date.getFullYear().toString();
                        }}
                        className="text-xs fill-muted-foreground"
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${value.toFixed(1)}배`}
                        className="text-xs fill-muted-foreground"
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {/* PER Area */}
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#perGradient)"
                    />

                    {/* Moving Average Line */}
                    <Line
                        type="monotone"
                        dataKey="movingAvg"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        strokeDasharray="2 2"
                        dot={false}
                        connectNulls={false}
                    />

                    {/* Annotations */}
                    {stats && maxIndex >= 0 && minIndex >= 0 && (
                        <>
                            {/* Peak Annotation */}
                            <ReferenceDot
                                x={maxIndex}
                                y={stats.max}
                                r={6}
                                fill="#dc2626"
                                stroke="#ffffff"
                                strokeWidth={2}
                            />
                            {/* Trough Annotation */}
                            <ReferenceDot
                                x={minIndex}
                                y={stats.min}
                                r={6}
                                fill="#059669"
                                stroke="#ffffff"
                                strokeWidth={2}
                            />
                            {/* Current Value Annotation */}
                            <ReferenceDot
                                x={currentIndex}
                                y={stats.current}
                                r={8}
                                fill="#3b82f6"
                                stroke="#ffffff"
                                strokeWidth={3}
                            />
                        </>
                    )}
                </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>PER</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-purple-500 border-dashed border-t-2"></div>
                    <span>12개월 이동평균</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-200 rounded opacity-50"></div>
                    <span>정상 범위 (±1표준편차)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-red-500 border-dashed border-t-2"></div>
                    <span>평균 PER</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-amber-500 border-dashed border-t-2"></div>
                    <span>±2표준편차</span>
                </div>
            </div>

            {/* Annotations Legend */}
            {stats && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                        <span>역대 최고: {stats.max.toFixed(1)}배</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                        <span>역대 최저: {stats.min.toFixed(1)}배</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
                        <span>현재 PER: {stats.current.toFixed(1)}배</span>
                    </div>
                </div>
            )}
        </div>
    );
}
