"use client";

import React from "react";
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
} from "@/lib/utils";

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
    return Object.values(lastDecDates); // Convert Record<string, string> to string[]
}

interface FormatFunctionMap {
    [key: string]: (num: number) => string; // Index signature
}

const formatFunctionMap: FormatFunctionMap = {
    formatNumber,
    formatNumberRaw,
    formatNumberTooltip,
    formatNumberRatio,
    formatNumberPercent,
};

const BpsChart: React.FC<Props> = ({ data, format, formatTooltip }) => {
    const lastDatesOfDec = React.useMemo(
        () => getLatestDecemberDates(data),
        [data]
    );

    const values = React.useMemo(
        () => data.filter((item) => lastDatesOfDec.includes(item.date)),
        [data, lastDatesOfDec]
    );

    // reorder by date in values
    values.sort((a, b) => (a.date < b.date ? -1 : 1));

    const colors = [
        "#e60049",
        "#dc0ab4",
        "#ffa300",
        "#0bb4ff",
        "#e6d800",
        "#b3d4ff",
        "#50e991",
        "#9b19f5",
        "#00bfa0",
    ];

    return (
        <div className="mt-5 min-h-[200px] w-full">
            <ResponsiveContainer width="100%" aspect={2}>
                <BarChart
                    data={values}
                    margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                >
                    <defs>
                        {colors.map((color, index) => (
                            <linearGradient
                                key={`color${index}`}
                                id={`color${index}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop offset="5%" stopColor={color} stopOpacity={0.9} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>
                    <Bar
                        type="monotone"
                        dataKey="value"
                        stroke={colors[2]}
                        fill={`url(#color2)`}
                    />
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(date) => date.split("-")[0]}
                        interval={5}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatFunctionMap[format]}
                        tickMargin={0}
                        className="text-xs sm:text-base"
                    />
                    <Tooltip
                        content={<CustomTooltip formatTooltip={formatTooltip} />}
                        position={{ y: -54 }}
                        isAnimationActive={false}
                    />
                    <CartesianGrid opacity={0.8} vertical={false} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
        payload: {
            date: string;
            value: number;
            [key: string]: string | number | boolean | null | undefined;
        };
    }>;
    formatTooltip: string;
}

const CustomTooltip = ({ active, payload, formatTooltip }: CustomTooltipProps) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
        <div className="flex flex-col items-center justify-end">
            <div className="text-gray-500">{data.date}</div>
            {Object.entries(data).map(
                ([key, value]) =>
                    key !== "date" && (
                        <div key={key} className="font-sm text-muted-foreground">
                            {key === "value" ? "주당순자산가치" : key}:{" "}
                            {formatFunctionMap[formatTooltip](value as number)}
                        </div>
                    )
            )}
        </div>
    );
};

export default BpsChart;
