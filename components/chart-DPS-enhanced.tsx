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

interface Props {
    data: Item[];
    format: string;
    formatTooltip: string;
}

interface Item {
    date: string;
    value: number;
}

function getLatestDecemberDates(data: Item[]): string[] {
    const lastDecDates: Record<string, string> = {};
    data.forEach(({ date }) => {
        const [year, month] = date.split("-");
        if (month === "12") {
            if (!lastDecDates[year] || date > lastDecDates[year]) {
                lastDecDates[year] = date;
            }
        }
    });
    return Object.values(lastDecDates);
}

interface FormatFunctionMap {
    [key: string]: (value: number, index?: number) => string;
}

export default function ChartDPSEnhanced({ data, format, formatTooltip }: Props) {
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

        const lastDatesOfDec = getLatestDecemberDates(data);
        return data
            .filter((item) => lastDatesOfDec.includes(item.date))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map((item) => ({
                ...item,
                displayDate: new Date(item.date).getFullYear().toString(),
                value: Number(item.value) || 0,
            }));
    }, [data]);

    if (!processedData || processedData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>주당배당금 DPS 연도별 추이</CardTitle>
                    <CardDescription>
                        Dividend Per Share - 기업의 연간 주당배당금 변화를 나타냅니다.
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

    const formatFunctionMap: FormatFunctionMap = formatFunctionMapForChart;

    const formatFunction = formatFunctionMap[format] || formatNumber;
    const tooltipFormatter = formatFunctionMap[formatTooltip] || formatNumberTooltip;

    // 📱 반응형 차트 높이 및 여백 설정
    const chartHeight = windowWidth < 640 ? 320 : 400;
    const chartMargin = windowWidth < 640
        ? { top: 20, right: 20, left: 20, bottom: 20 }
        : { top: 20, right: 30, left: 40, bottom: 20 };

    // 🎨 DPS 차트 색상 (주당배당금 - 안정적인 파란색 계열)
    const barColor = "#2563eb"; // 신뢰할 수 있는 파란색
    const barHoverColor = "#1d4ed8"; // 더 진한 파란색

    return (
        <Card>
            <CardHeader>
                <CardTitle>주당배당금 DPS 연도별 추이</CardTitle>
                <CardDescription>
                    Dividend Per Share - 기업의 연간 주당배당금 변화를 나타냅니다. 높을수록 배당금이 큽니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart
                        data={processedData}
                        margin={chartMargin}
                        barCategoryGap="20%"
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e5e5e5"
                            opacity={0.7}
                        />
                        <XAxis
                            dataKey="displayDate"
                            axisLine={false}
                            tickLine={false}
                            tick={{
                                fill: "#6b7280",
                                fontSize: windowWidth < 640 ? 11 : 12,
                                fontWeight: 500,
                            }}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{
                                fill: "#6b7280",
                                fontSize: windowWidth < 640 ? 10 : 11,
                                fontWeight: 500,
                            }}
                            tickFormatter={(value) => formatFunction(value)}
                            width={windowWidth < 640 ? 60 : 80}
                        />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="rounded-lg border bg-background p-3 shadow-md">
                                            <p className="font-medium text-foreground mb-1">
                                                {label}년
                                            </p>
                                            <p className="text-sm">
                                                <span className="font-medium text-primary">
                                                    주당배당금: {tooltipFormatter(payload[0].value as number)}원
                                                </span>
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar
                            dataKey="value"
                            fill={barColor}
                            radius={[2, 2, 0, 0]}
                            onMouseEnter={(_, index) => {
                                // 호버 효과는 CSS로 처리
                            }}
                            style={{
                                filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))",
                                transition: "all 0.2s ease-in-out",
                            }}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
