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

// 🔥 CD3 규칙: 단일 interface 정의
interface MarketcapChartProps {
    data: Array<{
        date: string;
        value: number;
        [key: string]: string | number | boolean | null | undefined;
    }>;
    format?: "formatNumber" | "formatNumberRaw";
    formatTooltip?: "formatNumberTooltip" | "formatNumberRatio" | "formatNumberPercent";
}

// 🔥 CD3 규칙: 단일 export default 함수
export default function MarketcapChart({
    data,
    format = "formatNumber",
    formatTooltip = "formatNumberTooltip",
}: MarketcapChartProps) {
    // 🔥 CD3 규칙: 방어적 프로그래밍 - 빈 데이터 처리
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                    <p className="text-sm">시가총액 데이터가 없습니다.</p>
                    <p className="text-xs mt-1">데이터를 확인해 주세요.</p>
                </div>
            </div>
        );
    }

    // 🔥 추가 방어: 첫 번째 데이터 항목 검증
    if (!data[0] || typeof data[0] !== "object") {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                    <p className="text-sm">잘못된 데이터 형식입니다.</p>
                </div>
            </div>
        );
    }

    // 🎨 CD3 색상 시스템 적용
    const colors = [
        "#2563EB", // Primary Trust Blue
        "#22C55E", // Success Green
        "#EF4444", // Danger Red
        "#ffa300",
        "#e6d800",
        "#b3d4ff",
        "#50e991",
        "#9b19f5",
        "#00bfa0",
    ];

    // 🔥 안전하게 Object.keys 사용
    const keys = Object.keys(data[0]);

    // 🔥 CD3 규칙: 날짜 정렬 (시계열 데이터)
    const sortedData = [...data].sort((a, b) => (a.date < b.date ? -1 : 1));

    return (
        <div className="mt-5 min-h-[200px] w-full">
            {/* 🔥 CD3 규칙: 반응형 차트 컨테이너 */}
            <ResponsiveContainer width="100%" aspect={2}>
                <AreaChart
                    data={sortedData}
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

                    {/* 🔥 동적 Area 렌더링 */}
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

                    {/* 🔥 CD3 X축: 연도만 표시 */}
                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(date) => date.split("-")[0]}
                        interval={50}
                        className="text-xs sm:text-sm"
                    />

                    {/* 🔥 CD3 Y축: 동적 포맷터 */}
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) =>
                            format === "formatNumber" ? formatNumber(value) : formatNumberRaw(value)
                        }
                        tickMargin={0}
                        className="text-xs sm:text-base"
                    />

                    {/* 🔥 CD3 툴팁: 커스텀 컴포넌트 */}
                    <Tooltip
                        content={<CustomTooltip formatTooltip={formatTooltip} />}
                        position={{ y: -84 }}
                        isAnimationActive={false}
                    />

                    {/* 🔥 CD3 그리드 */}
                    <CartesianGrid opacity={0.8} vertical={false} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// 🔥 CD3 커스텀 툴팁 컴포넌트
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
        <div className="flex flex-col items-center justify-end bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-3">
            <div className="text-muted-foreground text-sm font-medium mb-2">
                {data.date}
            </div>
            {Object.entries(data).map(
                ([key, value]) =>
                    key !== "date" &&
                    key !== "value" && (
                        <div key={key} className="text-sm text-foreground">
                            <span className="font-medium">
                                {key === "totalValue" ? "시가총액" : key}:
                            </span>{" "}
                            <span className="text-primary font-semibold">
                                {formatTooltipFunction(value as number, formatTooltip)}
                            </span>
                        </div>
                    )
            )}
        </div>
    );
}

// 🔥 CD3 툴팁 포맷 함수
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
