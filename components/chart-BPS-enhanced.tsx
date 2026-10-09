"use client";

import React, { useMemo } from "react";
import { useViewportWidth } from '@/hooks/use-viewport-width';
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
    formatNumberTooltip,
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
    period?: '1Y' | '5Y' | '10Y' | '20Y';
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

export default function ChartBPSEnhanced({ data, format, formatTooltip, period = '1Y' }: Props) {
    const windowWidth = useViewportWidth();

    const processedData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const lastDatesOfDec = getLatestDecemberDates(data);
        let filteredData = data
            .filter((item) => lastDatesOfDec.includes(item.date))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Apply period filtering
        const periodYears = period === '1Y' ? 1 : period === '5Y' ? 5 : period === '10Y' ? 10 : 20;
        const currentYear = Number(filteredData.at(-1)?.date.slice(0,4));
        const startYear = currentYear - periodYears + 1;

        filteredData = filteredData.filter((item) => {
            const itemYear = new Date(item.date).getFullYear();
            return itemYear >= startYear;
        });

        return filteredData.map((item, index) => ({
            ...item,
            displayDate: new Date(item.date).getFullYear().toString(),
            value: Number(item.value) || 0,
            uniqueKey: `${item.date}-${index}`, // 고유 키 추가
        }));
    }, [data, period]);

    if (!processedData || processedData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>주당순자산가치 BPS 연말 관측값 추이</CardTitle>
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

    const formatFunction = formatFunctionMapForChart[format as keyof typeof formatFunctionMapForChart] || formatNumber;
    const tooltipFormatter = formatFunctionMapForChart[formatTooltip as keyof typeof formatFunctionMapForChart] || formatNumberTooltip;

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>주당순자산가치 BPS 연말 관측값 추이</CardTitle>
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
                            <CartesianGrid stroke="var(--border)" vertical={false} />
                            <XAxis
                                dataKey="displayDate"
                                axisLine={false}
                                tickLine={false}
                                className="text-xs fill-muted-foreground"
                                tick={{ fill: "var(--muted-foreground)", fontSize: windowWidth < 640 ? 11 : 12 }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                className="text-xs fill-muted-foreground"
                                tick={{ fill: "var(--muted-foreground)", fontSize: windowWidth < 640 ? 10 : 11 }}
                                tickFormatter={(value) => formatFunction(value)}
                                width={windowWidth < 640 ? 60 : 80}
                            />
                            <Tooltip
                                labelClassName="text-foreground font-medium"
                                itemStyle={{ color: "var(--foreground)" }}
                                cursor={{ fill: "var(--muted)" }}
                                contentStyle={{
                                    backgroundColor: "var(--popover)",
                                    color: "var(--popover-foreground)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "8px",
                                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                }}
                                formatter={(value) => [
                                    tooltipFormatter(Number(Array.isArray(value) ? value[0] : value)),
                                    "주당순자산가치",
                                ]}
                                labelFormatter={(label) => `${label}년`}
                            />
                            <Bar
                                dataKey="value"
                                fill="var(--chart-2)"
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
