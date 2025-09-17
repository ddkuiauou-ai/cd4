"use client";

import {
    formatNumber,
    formatNumberRaw,
    formatNumberTooltip,
    formatNumberRatio,
    formatNumberPercent,
} from "@/lib/utils";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

type Props = {
    data: {
        date: string;
        totalValue?: number;
    }[];
    format: string;
    formatTooltip: string;
};

function PerChart({ data, format, formatTooltip }: Props) {
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

    if (!data || data.length === 0) return null;

    const keys = Object.keys(data[0]);
    // reoder by date in inputValues
    data.sort((a, b) => (a.date < b.date ? -1 : 1));

    return (
        <div className="mt-5 min-h-[200px] w-full">
            <ResponsiveContainer width="100%" aspect={2}>
                <AreaChart
                    data={data}
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
                    {keys.map(
                        (key, index) =>
                            key !== "date" && (
                                <Area
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    stroke={colors[index % colors.length]}
                                    fill={`url(#color${index % colors.length})`}
                                />
                            )
                    )}
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(date) => date.split("-")[0]}
                        interval={50}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) =>
                            format === "formatNumber" ? formatNumber(value) : formatNumberRaw(value)
                        }
                        tickMargin={0}
                        className="text-xs sm:text-base"
                    />
                    <Tooltip
                        content={<CustomTooltip formatTooltip={formatTooltip} />}
                        position={{ y: -54 }}
                        isAnimationActive={false}
                    />
                    <CartesianGrid opacity={0.8} vertical={false} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

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

function CustomTooltip({ active, payload, formatTooltip }: CustomTooltipProps) {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    return (
        <div className="flex flex-col items-center justify-end">
            <div className="text-gray-500">{data.date}</div>
            {Object.entries(data).map(
                ([key, value]) =>
                    key !== "date" && (
                        <div key={key} className="font-sm text-muted-foreground">
                            {key === "value" ? "주가수익비율" : key}:
                            {formatTooltipFunction(value as number, formatTooltip)}
                        </div>
                    )
            )}
        </div>
    );
}

function formatTooltipFunction(value: number, formatType: string) {
    switch (formatType) {
        case "formatNumberTooltip":
            return formatNumberTooltip(value);
        case "formatNumberRatio":
            return formatNumberRatio(value);
        case "formatNumberPercent":
            return formatNumberPercent(value);
        default:
            return formatNumberRaw(value);
    }
}

export default PerChart;
