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

export default function ChartBPSEnhanced({ data, format, formatTooltip }: Props) {
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
            .map((item, index) => ({
                ...item,
                displayDate: new Date(item.date).getFullYear().toString(),
                value: Number(item.value) || 0,
                uniqueKey: `${item.date}-${index}`, // 고유 키 추가
            }));
    }, [data]);

    if (!processedData || processedData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>주당순자산가치 BPS 연도별 추이</CardTitle>
                    <CardDescription>
                        Book Value Per Share - 기업의 연간 주당순자산가치 변화를 나타냅니다.
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

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>주당순자산가치 BPS 연도별 추이</CardTitle>
                <CardDescription>
                    Book Value Per Share - 기업의 연간 주당순자산가치 변화를 나타냅니다.
                    높은 값일수록 기업의 자산 가치가 높음을 의미합니다.
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
                                    "주당순자산가치",
                                ]}
                                labelFormatter={(label) => `${label}년`}
                            />
                            <Bar
                                dataKey="value"
                                fill="#3B82F6"
                                radius={[2, 2, 0, 0]}
                                maxBarSize={60}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
