"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import {
    formatNumber,
    formatNumberTooltip,
} from "../lib/utils";

interface Props {
    data: DPSGrowthItem[];
}

interface DPSGrowthItem {
    date: string;
    value: number | null;
    growthRate?: number | null;
}

const ChartDPSGrowth: React.FC<Props> = ({ data }) => {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        return data.filter((item, index) => {
            if (index === 0) return true;
            return item.growthRate !== null && item.growthRate !== 0;
        });
    }, [data]);

    const colors = useMemo(() => ({
        dps: "var(--chart-2)",
        growth: "var(--brand-ink)",
        dpsLine: "var(--chart-2)",
        growthLine: "var(--brand-ink)",
    }), []);

    if (!isClient || !data || data.length === 0) {
        return (
            <div className="w-full h-[200px] sm:h-[220px] md:h-[250px] lg:h-[280px] xl:h-[300px] flex items-center justify-center">
                <div className="text-sm text-muted-foreground">
                    {!isClient ? "차트 로딩 중..." : "차트 데이터가 없습니다"}
                </div>
            </div>
        );
    }

    return (
        <div className="mt-5 w-full h-[200px] sm:h-[220px] md:h-[250px] lg:h-[280px] xl:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid yAxisId="dps" stroke="var(--border)" vertical={false} />
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(date) => date.split("-")[0]}
                        className="text-xs"
                        tick={{ fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                        yAxisId="dps"
                        orientation="left"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${formatNumber(value)}원`}
                        className="text-xs"
                        tick={{ fill: "var(--muted-foreground)" }}
                        label={{ value: 'DPS (원)', angle: -90, position: 'insideLeft', fill: 'var(--muted-foreground)' }}
                    />
                    <YAxis
                        yAxisId="growth"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${value}%`}
                        className="text-xs"
                        tick={{ fill: "var(--muted-foreground)" }}
                        label={{ value: '성장률 (%)', angle: 90, position: 'insideRight', fill: 'var(--muted-foreground)' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend itemSorter={(entry) => entry.dataKey === "value" ? 0 : 1} />

                    {/* DPS 라인 */}
                    <Line
                        yAxisId="dps"
                        type="monotone"
                        dataKey="value"
                        stroke={colors.dpsLine}
                        strokeWidth={3}
                        dot={{ fill: colors.dpsLine, strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: colors.dpsLine, strokeWidth: 2, fill: 'var(--background)' }}
                        name="주당배당금 (DPS)"
                        connectNulls={false}
                    />

                    {/* 성장률 라인 */}
                    <Line
                        yAxisId="growth"
                        type="monotone"
                        dataKey="growthRate"
                        stroke={colors.growthLine}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ fill: colors.growthLine, strokeWidth: 2, r: 3 }}
                        activeDot={{ r: 5, stroke: colors.growthLine, strokeWidth: 2, fill: 'var(--background)' }}
                        name="전년 대비 성장률 (%)"
                        connectNulls={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
        dataKey: string;
        value: number | null;
        name: string;
        payload: DPSGrowthItem;
    }>;
    label?: string | number;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload || !payload.length) return null;

    const year = String(label ?? "").split("-")[0];

    return (
        <div className="bg-popover p-3 border border-border rounded-lg shadow-lg">
            <div className="text-sm font-medium text-foreground mb-2">
                {year}년
            </div>
            {payload.map((entry, index) => {
                if (entry.dataKey === 'value') {
                    return (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                                className="w-3 h-3 rounded-full bg-chart-2"
                            />
                            <span className="text-muted-foreground">DPS:</span>
                            <span className="font-medium text-foreground">
                                {entry.value === null ? "배당금 없음" : `${formatNumberTooltip(entry.value)}원`}
                            </span>
                        </div>
                    );
                } else if (entry.dataKey === 'growthRate' && entry.value !== null && entry.value !== undefined) {
                    const isPositive = entry.value >= 0;
                    return (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                                className="w-3 h-3 rounded-full border-2 border-dashed border-brand-ink bg-background"
                            />
                            <span className="text-muted-foreground">성장률:</span>
                            <span className={`font-medium ${isPositive ? 'text-market-up' : 'text-market-down'}`}>
                                {isPositive ? '+' : ''}{entry.value.toFixed(1)}%
                            </span>
                        </div>
                    );
                }
                return null;
            })}
        </div>
    );
};

export default ChartDPSGrowth;
