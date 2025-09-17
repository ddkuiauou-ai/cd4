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

export default function ChartEPSEnhanced({ data, format, formatTooltip }: Props) {
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
                    <CardTitle>주당순이익 EPS 연도별 추이</CardTitle>
                    <CardDescription>
                        Earnings Per Share - 기업의 연간 주당순이익 변화를 나타냅니다.
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
                <CardTitle>주당순이익 EPS 연도별 추이</CardTitle>
                <CardDescription>
                    Earnings Per Share - 기업의 연간 주당순이익 변화를 나타냅니다.
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
