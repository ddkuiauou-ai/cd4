'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-object-type */
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { formatNumber, formatDateKorean } from "@/lib/utils";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    TooltipProps,
} from "recharts";
import { cn } from "@/lib/utils";

interface StockChartProps {
    title: string;
    description?: string;
    data: Array<{
        date: string;
        price: number;
        volume?: number;
        [key: string]: string | number | boolean | null | undefined;
    }>;
    height?: string | number;
    className?: string;
    showVolume?: boolean;
}

/**
 * StockChart component displays stock price data with optional volume bars
 * Built with recharts, following CD3 design guidelines
 */
function StockChart({
    title,
    description,
    data,
    height = 350,
    className,
    showVolume = true,
}: StockChartProps) {
    const sortedData = [...data].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // CD3 primary color for price chart
    const priceColor = "oklch(63.89% 0.220 259.03)"; // Trust Blue
    const volumeColor = "oklch(32.75% 0.041 257.69)"; // Dark mode muted

    return (
        <Card className={cn("w-full", className)}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={height}>
                    <AreaChart
                        data={sortedData}
                        margin={{ top: 10, right: 10, bottom: 15, left: 10 }}
                    >
                        <defs>
                            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={priceColor} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={priceColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: '12px' }}
                            tickFormatter={(date) => {
                                const d = new Date(date);
                                return `${d.getMonth() + 1}/${d.getDate()}`;
                            }}
                            minTickGap={20}
                        />
                        <YAxis
                            domain={['auto', 'auto']}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: '12px' }}
                            tickFormatter={(value) => formatNumber(value, '', 0)}
                            orientation="right"
                        />
                        <CartesianGrid opacity={0.2} vertical={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke={priceColor}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            fill="url(#priceGradient)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

interface CustomTooltipProps extends TooltipProps<any, any> { }

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const date = new Date(data.date);
    const formattedDate = formatDateKorean(date, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    return (
        <div className="rounded-md border bg-popover p-3 shadow-md">
            <p className="text-sm font-medium text-muted-foreground mb-1">
                {formattedDate}
            </p>
            <p className="font-medium text-base">
                <span>가격: </span>
                <span className="text-primary">{formatNumber(data.price, '원')}</span>
            </p>
            {data.volume !== undefined && (
                <p className="text-sm text-muted-foreground">
                    <span>거래량: </span>
                    <span>{formatNumber(data.volume)}</span>
                </p>
            )}
        </div>
    );
};

export default StockChart;
