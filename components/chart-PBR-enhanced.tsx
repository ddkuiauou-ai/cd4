"use client";

import { useEffect, useMemo, useState } from "react";
import {
    formatNumberRaw,
    formatNumberTooltip,
    formatNumberRatio,
    formatNumberPercent,
    formatNumberForChart,
    formatNumberRawForChart,
    formatNumberCompactForChart,
} from "../lib/utils";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine,
} from "recharts";

type Props = {
    data: {
        date: string;
        value: number;
    }[];
    format: string;
    formatTooltip: string;
};

export default function ChartPBREnhanced({ data, format, formatTooltip }: Props) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        // 🔥 중복 날짜 데이터 제거 (같은 연도의 경우 최신 값 유지)
        const dateMap = new Map<string, { date: string; value: number }>();

        data
            .filter(item =>
                item.value !== null &&
                item.value !== undefined &&
                !isNaN(item.value) &&
                item.value > 0 &&
                item.value < 1000
            )
            .forEach(item => {
                const year = new Date(item.date).getFullYear().toString();
                const existingItem = dateMap.get(year);
                if (!existingItem || new Date(item.date) > new Date(existingItem.date)) {
                    dateMap.set(year, item);
                }
            });

        return Array.from(dateMap.values())
            .map((item, index) => ({
                date: item.date,
                year: new Date(item.date).getFullYear().toString(),
                totalValue: item.value,
                uniqueKey: `pbr-chart-${item.date}-${index}`, // 고유 키 생성
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [data]);

    const stats = useMemo(() => {
        if (!chartData || chartData.length === 0) {
            return { latest: 0, average: 0, min: 0, max: 0 };
        }

        const values = chartData.map(item => item.totalValue).filter(val => val > 0);

        if (values.length === 0) {
            return { latest: 0, average: 0, min: 0, max: 0 };
        }

        return {
            latest: values[values.length - 1],
            average: values.reduce((sum, val) => sum + val, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values)
        };
    }, [chartData]);

    const formatValue = (value: number | string) => {
        if (typeof value === 'string') return value;
        if (format === "formatRaw") return formatNumberRaw(value);
        if (format === "formatRatio") return formatNumberRatio(value);
        if (format === "formatPercent") return formatNumberPercent(value);
        return formatNumberRaw(value);
    };

    const formatTooltipValue = (value: number | string) => {
        if (typeof value === 'string') return value;
        if (formatTooltip === "formatNumberRatio") return formatNumberRatio(value);
        if (formatTooltip === "formatNumberTooltip") return formatNumberTooltip(value);
        return formatNumberRaw(value);
    };

    if (!mounted) {
        return (
            <div className="w-full h-[400px] bg-muted/20 animate-pulse rounded-lg border" />
        );
    }

    if (!chartData || chartData.length === 0) {
        return (
            <div className="w-full p-8 text-center bg-muted/20 rounded-lg border">
                <p className="text-muted-foreground">차트 데이터가 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            {/* 핵심 지표 요약 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-lg">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">최신</p>
                    <p className="text-lg font-bold">{formatValue(stats.latest)}배</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">평균</p>
                    <p className="text-lg font-bold">{formatValue(stats.average)}배</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">최소</p>
                    <p className="text-lg font-bold">{formatValue(stats.min)}배</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">최대</p>
                    <p className="text-lg font-bold">{formatValue(stats.max)}배</p>
                </div>
            </div>

            {/* 차트 */}
            <div className="w-full h-[400px] border rounded-lg p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{
                            top: 20,
                            right: 30,
                            left: 20,
                            bottom: 20,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" opacity={0.3} />
                        <XAxis
                            dataKey="year"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                            tickFormatter={(value) => formatNumberForChart(value)}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--background))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "6px",
                                fontSize: "12px",
                            }}
                            formatter={(value: any) => [
                                `PBR ${formatTooltipValue(value)}배`,
                                "주가순자산비율"
                            ]}
                            labelFormatter={(label) => `${label}년`}
                        />
                        <Line
                            type="monotone"
                            dataKey="totalValue"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{
                                fill: "hsl(var(--primary))",
                                strokeWidth: 2,
                                r: 4,
                            }}
                            activeDot={{
                                r: 6,
                                strokeWidth: 2,
                                fill: "hsl(var(--primary))",
                            }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
