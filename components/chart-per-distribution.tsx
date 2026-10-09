"use client";

import { Bar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";

interface ChartPERDistributionProps {
    data: { date: string; value: number }[];
    className?: string;
    sourceSummary?: string;
    formatCoordinate?: (value: number) => string;
    formatDetailCoordinate?: (value: number) => string;
}

// 간단한 히스토그램 데이터 생성
function createHistogramData(data: { date: string; value: number }[], formatCoordinate?: (value: number) => string) {
    if (!data || data.length === 0) return { histogramData: [], stats: null };

    const validValues = data.map(item => item.value).filter(value => Number.isFinite(value));
    if (!validValues.length) return { histogramData: [], stats: null };

    // 기본 통계
    const mean = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    const sorted = [...validValues].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // 히스토그램 빈 생성 (간단하게 10개 빈으로)
    const minValue = Math.min(...validValues);
    const maxValue = Math.max(...validValues);
    const binCount = maxValue === minValue ? 1 : 10;
    const binSize = (maxValue - minValue || 1) / binCount;

    const histogramData = [];
    for (let i = 0; i < binCount; i++) {
        const binStart = minValue + (i * binSize);
        const binEnd = minValue + ((i + 1) * binSize);
        const count = validValues.filter(value => value >= binStart && (value < binEnd || i === binCount - 1 && value <= maxValue)).length;

        histogramData.push({
            bin: formatCoordinate ? `${formatCoordinate(binStart)}–${formatCoordinate(binEnd)}` : `${binStart.toFixed(0)}-${binEnd.toFixed(0)}`,
            binStart,
            binEnd,
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
function CustomTooltip({ active, payload, formatDetailCoordinate }: { active?: boolean; formatDetailCoordinate?: (value: number) => string; payload?: ReadonlyArray<{ payload?: { bin: string; binStart: number; binEnd: number; count: number; percentage: number } | { x: number; density: number } }> }) {
    if (active && payload?.[0]?.payload) {
        const data = payload[0].payload;

        // 히스토그램 툴팁
        if ('bin' in data) {
            return (
                <div className="rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md">
                    <p className="text-sm font-medium text-foreground">
                        PER 구간: {formatDetailCoordinate ? `${formatDetailCoordinate(data.binStart)}–${formatDetailCoordinate(data.binEnd)}` : data.bin}배
                    </p>
                    <p className="text-sm text-muted-foreground">
                        빈도: <span className="font-semibold text-foreground">{data.count}개</span>
                        ({data.percentage.toFixed(1)}%)
                    </p>
                </div>
            );
        }

        // KDE 툴팁
        if ('x' in data) {
            return (
                <div className="rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md">
                    <p className="text-sm font-medium text-foreground">
                        PER: {formatDetailCoordinate ? formatDetailCoordinate(data.x) : data.x.toFixed(1)}배
                    </p>
                    <p className="text-sm text-muted-foreground">
                        밀도: <span className="font-semibold text-foreground">{data.density.toFixed(3)}</span>
                    </p>
                </div>
            );
        }
    }
    return null;
}

export default function ChartPERDistribution({ data, className, sourceSummary, formatCoordinate, formatDetailCoordinate }: ChartPERDistributionProps) {
    const { histogramData, stats } = createHistogramData(data, formatCoordinate);

    if (!histogramData || histogramData.length === 0 || !stats) {
        return (
            <div className="h-[300px] flex items-center justify-center border border-dashed border-muted-foreground/25 rounded-lg">
                <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        PER 분포 데이터 없음
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
        .filter(value => Number.isFinite(value));

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
                    <XAxis
                        dataKey="bin"
                        axisLine={false}
                        tickLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={30}
                        interval={0}
                        className="text-xs"
                        tick={{ fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        className="text-xs"
                        tick={{ fill: "var(--muted-foreground)" }}
                        label={{ value: '빈도', angle: -90, position: 'insideLeft', fill: 'var(--muted-foreground)' }}
                    />
                    <Tooltip content={<CustomTooltip formatDetailCoordinate={formatDetailCoordinate} />} cursor={{ fill: "var(--muted)" }} />
                    <Bar
                        dataKey="count"
                        fill="var(--chart-3)"
                        radius={[2, 2, 0, 0]}
                    />
                    <Line
                        type="monotone"
                        dataKey="density"
                        data={scaledKdeData}
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
            <div className="text-xs text-muted-foreground mt-2 text-center">
                <span className="text-chart-2 font-medium">KDE 곡선</span> |
                {sourceSummary || "제공 관측 " + stats.count + "개"}
            </div>
        </div>
    );
}
