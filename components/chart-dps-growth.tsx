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
    value: number;
    growthRate?: number | null;
}

const ChartDPSGrowth: React.FC<Props> = ({ data }) => {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Filter data to show only December data (annual data)
    const annualData = useMemo(() => {
        const lastDecDates: Record<string, DPSGrowthItem> = {};
        data.forEach((item) => {
            const [year, month] = item.date.split("-");
            if (month === "12" || item.date.includes("-12")) {
                if (!lastDecDates[year] || item.date > lastDecDates[year].date) {
                    lastDecDates[year] = item;
                }
            }
        });
        return Object.values(lastDecDates).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [data]);

    // 🎨 차트 색상 팔레트 (DPS와 성장률 구분)
    const colors = useMemo(() => ({
        dps: "#2563eb", // Blue for DPS
        growth: "#dc2626", // Red for growth rate
        dpsLine: "#2563eb",
        growthLine: "#dc2626",
    }), []);

    if (!isClient || !data || data.length === 0) {
        return (
            <div className="w-full h-[200px] sm:h-[220px] md:h-[250px] lg:h-[280px] xl:h-[300px] flex items-center justify-center">
                <div className="text-sm text-gray-500">
                    {!isClient ? "차트 로딩 중..." : "차트 데이터가 없습니다"}
                </div>
            </div>
        );
    }

    return (
        <div className="mt-5 w-full h-[200px] sm:h-[220px] md:h-[250px] lg:h-[280px] xl:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={annualData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(date) => date.split("-")[0]}
                        className="text-xs"
                    />
                    <YAxis
                        yAxisId="dps"
                        orientation="left"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${formatNumber(value)}원`}
                        className="text-xs"
                        label={{ value: 'DPS (원)', angle: -90, position: 'insideLeft' }}
                    />
                    <YAxis
                        yAxisId="growth"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${value}%`}
                        className="text-xs"
                        label={{ value: '성장률 (%)', angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />

                    {/* DPS 라인 */}
                    <Line
                        yAxisId="dps"
                        type="monotone"
                        dataKey="value"
                        stroke={colors.dpsLine}
                        strokeWidth={3}
                        dot={{ fill: colors.dpsLine, strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: colors.dpsLine, strokeWidth: 2, fill: '#fff' }}
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
                        activeDot={{ r: 5, stroke: colors.growthLine, strokeWidth: 2, fill: '#fff' }}
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
        value: number;
        name: string;
        payload: DPSGrowthItem;
    }>;
    label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload || !payload.length) return null;

    const year = label?.split("-")[0];

    return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                {year}년
            </div>
            {payload.map((entry, index) => {
                if (entry.dataKey === 'value') {
                    return (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-gray-600 dark:text-gray-400">DPS:</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                                {formatNumberTooltip(entry.value)}원
                            </span>
                        </div>
                    );
                } else if (entry.dataKey === 'growthRate' && entry.value !== null && entry.value !== undefined) {
                    const isPositive = entry.value >= 0;
                    return (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                                className="w-3 h-3 rounded-full border-2 border-dashed"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-gray-600 dark:text-gray-400">성장률:</span>
                            <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
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
