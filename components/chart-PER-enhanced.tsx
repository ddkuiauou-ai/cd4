"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "next-themes";

interface ChartPEREnhancedProps {
    data: { date: string; value: number }[];
    className?: string;
}

// 데이터 전처리 함수
function processChartData(data: { date: string; value: number }[]) {
    if (!data || data.length === 0) return [];

    // 🔥 중복 날짜 데이터 제거 및 정렬
    const dateMap = new Map<string, { date: string; value: number }>();

    data.forEach(item => {
        const existingItem = dateMap.get(item.date);
        if (!existingItem || item.value > existingItem.value) {
            dateMap.set(item.date, item);
        }
    });

    const processedData = Array.from(dateMap.values())
        .filter(item => item.value !== null && !isNaN(item.value))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log('Chart data processed:', processedData.length);
    return processedData;
}

// 툴팁 컴포넌트
function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        const value = payload[0].value;
        const formattedDate = new Date(label).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return (
            <div className="rounded-lg border bg-background p-3 shadow-md">
                <p className="text-sm font-medium text-foreground">{formattedDate}</p>
                <p className="text-sm text-muted-foreground">
                    PER: <span className="font-semibold text-primary">{value.toFixed(2)}배</span>
                </p>
            </div>
        );
    }
    return null;
}

export default function ChartPEREnhanced({ data, className }: ChartPEREnhancedProps) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    const processedData = processChartData(data);

    if (!processedData || processedData.length === 0) {
        return (
            <div className="h-[400px] flex items-center justify-center border border-dashed border-muted-foreground/25 rounded-lg">
                <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        PER 차트 데이터 없음
                    </p>
                    <p className="text-xs text-muted-foreground">
                        표시할 데이터가 없습니다
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            <ResponsiveContainer width="100%" height={400}>
                <AreaChart
                    data={processedData}
                    margin={{
                        top: 10,
                        right: 30,
                        left: 0,
                        bottom: 0,
                    }}
                >
                    <defs>
                        <linearGradient id="perGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop
                                offset="5%"
                                stopColor="#3b82f6"
                                stopOpacity={isDark ? 0.3 : 0.8}
                            />
                            <stop
                                offset="95%"
                                stopColor="#3b82f6"
                                stopOpacity={isDark ? 0.1 : 0.1}
                            />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => {
                            const date = new Date(value);
                            return date.getFullYear().toString();
                        }}
                        className="text-xs fill-muted-foreground"
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${value.toFixed(1)}배`}
                        className="text-xs fill-muted-foreground"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#perGradient)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
