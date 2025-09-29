"use client";

import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";
import { useTheme } from "next-themes";

interface ChartBPSDistributionProps {
    data: { date: string; value: number }[];
    className?: string;
}

// 간단한 히스토그램 데이터 생성
function createHistogramData(data: { date: string; value: number }[]) {
    if (!data || data.length === 0) return { histogramData: [], stats: null };

    // 유효한 BPS 값만 필터링 (양수 BPS만, 합리적인 범위)
    let validValues = data
        .map(item => item.value)
        .filter(value => value !== null && !isNaN(value) && value > 0 && value < 1000000); // 합리적인 범위 제한

    if (validValues.length === 0) return { histogramData: [], stats: null };

    // 상위 1% 클리핑
    const sortedValues = [...validValues].sort((a, b) => a - b);
    const clipIndex = Math.floor(sortedValues.length * 0.99);
    const maxAllowed = sortedValues[clipIndex];
    validValues = validValues.filter(value => value <= maxAllowed);

    // 기본 통계
    const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    const sorted = [...validValues].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // 히스토그램 빈 생성 (간단하게 10개 빈으로)
    const minValue = Math.min(...validValues);
    const maxValue = Math.max(...validValues);
    const binCount = 10;
    const binSize = (maxValue - minValue) / binCount;

    const histogramData = [];
    for (let i = 0; i < binCount; i++) {
        const binStart = minValue + (i * binSize);
        const binEnd = minValue + ((i + 1) * binSize);
        const count = validValues.filter(value => value >= binStart && value < binEnd).length;

        histogramData.push({
            bin: `${(binStart / 1000).toFixed(0)}K-${(binEnd / 1000).toFixed(0)}K`,
            count,
            percentage: (count / validValues.length) * 100,
            binCenter: (binStart + binEnd) / 2
        });
    }

    return {
        histogramData,
        stats: {
            mean,
            median,
            count: validValues.length,
            min: minValue,
            max: maxValue
        }
    };
}

// KDE 계산 함수
function calculateKDE(values: number[], bandwidth: number = 0.3) {
    if (values.length === 0) return [];

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    // 범위가 너무 작거나 0인 경우 처리
    if (range <= 0.01) {
        // 모든 값이 동일한 경우 단일 포인트 반환
        const density = 1 / (values.length * bandwidth * Math.max(range, 0.1));
        return [{
            x: minValue,
            density: density
        }];
    }

    // KDE를 위한 x 값들 생성 (최대 200 포인트로 제한)
    const xValues = [];
    const maxPoints = 200;
    const step = Math.max(range / 100, range / maxPoints);
    for (let x = minValue; x <= maxValue; x += step) {
        xValues.push(x);
        // 안전을 위해 최대 포인트 수 제한
        if (xValues.length >= maxPoints) break;
    }

    // 각 x 값에 대한 KDE 계산 (Gaussian kernel)
    const kdeData = xValues.map(x => {
        let density = 0;
        values.forEach(value => {
            const diff = (x - value) / (bandwidth * range);
            density += Math.exp(-0.5 * diff * diff) / Math.sqrt(2 * Math.PI);
        });
        density /= (values.length * bandwidth * range);

        return {
            x,
            density: density * range // 스케일 조정
        };
    });

    return kdeData;
}


// 툴팁 컴포넌트
function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;

        // 히스토그램 툴팁
        if (data.bin && data.count !== undefined) {
            return (
                <div className="rounded-lg border bg-background p-2 shadow-md">
                    <p className="text-sm font-medium text-foreground">
                        BPS 구간: {data.bin}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        빈도: <span className="font-semibold text-primary">{data.count}개</span>
                        ({data.percentage.toFixed(1)}%)
                    </p>
                </div>
            );
        }

        // KDE 툴팁
        if (data.x !== undefined && data.density !== undefined) {
            return (
                <div className="rounded-lg border bg-background p-2 shadow-md">
                    <p className="text-sm font-medium text-foreground">
                        BPS: {(data.x / 1000).toFixed(0)}K원
                    </p>
                    <p className="text-sm text-muted-foreground">
                        밀도: <span className="font-semibold text-primary">{data.density.toFixed(3)}</span>
                    </p>
                </div>
            );
        }
    }
    return null;
}

export default function ChartBPSDistribution({ data, className }: ChartBPSDistributionProps) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";

    const { histogramData, stats } = createHistogramData(data);

    if (!histogramData || histogramData.length === 0 || !stats) {
        return (
            <div className="h-[300px] flex items-center justify-center border border-dashed border-muted-foreground/25 rounded-lg">
                <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        BPS 분포 데이터 없음
                    </p>
                    <p className="text-xs text-muted-foreground">
                        표시할 데이터가 없습니다
                    </p>
                </div>
            </div>
        );
    }

    // KDE 데이터 계산
    const validValues = data
        .map(item => item.value)
        .filter(value => value !== null && !isNaN(value) && value > 0 && value < 1000000);

    const kdeData = calculateKDE(validValues, 0.2);

    // KDE 데이터를 히스토그램과 같은 스케일로 조정
    const maxCount = Math.max(...histogramData.map(d => d.count));
    const maxDensity = Math.max(...kdeData.map(d => d.density));
    const scaleFactor = maxCount / maxDensity;

    const scaledKdeData = kdeData.map(d => ({
        ...d,
        density: d.density * scaleFactor
    }));

    return (
        <div className={className}>
            <div className="text-xs text-muted-foreground mb-2">
                📊 KDE 곡선: 히스토그램으로는 보이지 않는 연속적인 분포 흐름을 보여줍니다
            </div>
            <ResponsiveContainer width="100%" height={250}>
                <ComposedChart
                    data={histogramData}
                    margin={{
                        top: 10,
                        right: 10,
                        left: 5,
                        bottom: 5,
                    }}
                >
                    <defs>
                        <linearGradient id="histogramGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop
                                offset="5%"
                                stopColor="#3b82f6"
                                stopOpacity={isDark ? 0.7 : 0.8}
                            />
                            <stop
                                offset="95%"
                                stopColor="#3b82f6"
                                stopOpacity={isDark ? 0.3 : 0.4}
                            />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="bin"
                        axisLine={false}
                        tickLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={30}
                        interval={0}
                        className="text-xs fill-muted-foreground"
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        className="text-xs fill-muted-foreground"
                        label={{ value: '빈도', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                        dataKey="count"
                        fill="url(#histogramGradient)"
                        radius={[2, 2, 0, 0]}
                    />
                    <Line
                        type="monotone"
                        dataKey="density"
                        data={scaledKdeData}
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
            <div className="text-xs text-muted-foreground mt-2 text-center">
                <span className="text-red-500 font-medium">빨간선: KDE 곡선</span> |
                평균: {(stats.mean / 1000).toFixed(0)}K원 | 중앙값: {(stats.median / 1000).toFixed(0)}K원 | 데이터: {stats.count}개
            </div>
        </div>
    );
}
