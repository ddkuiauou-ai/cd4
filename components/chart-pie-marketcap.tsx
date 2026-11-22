'use client';
import { formatBusinessValue, type BusinessValue } from '@/lib/business-analysis';

import React, { useMemo, useSyncExternalStore } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts';
import { createMarketcapSeries, getMarketcapSelectionColor, isMarketcapSeriesSelected } from '@/lib/chart-selection';

const subscribeReady = () => () => {};

interface ChartPieMarketcapProps {
    data: Array<{
        securityId: string;
        ticker?: string | null;
        name: string;
        value: number;
        rawValue?: BusinessValue;
        percentage: number;
        type?: string;
        color?: string;
    }>;
    centerText?: {
        title: string;
        value: string;
    };
    selectedType?: string; // 🎯 라인 차트와 동일한 어노테이션 기능
    selectedSecurityId?: string;
    compact?: boolean;
}

// 🎨 라인 차트와 동일한 색상 시스템 적용 (가독성 개선)
const COLORS = {
    // 기본 그레이스케일 (라인 차트와 동일, 가독성 개선)
    base: [
        'var(--foreground)',
        'var(--chart-3)',
        'color-mix(in srgb, var(--foreground) 75%, var(--background))',
        'color-mix(in srgb, var(--foreground) 85%, var(--background))',
    ],
    // 브랜드 액센트 컬러 (라인 차트와 동일)
    accent: {
        '시가총액구성': 'var(--brand-ink)', // 브랜드 주황색
        '보통주': 'var(--market-up)', // 한국 상승 빨간색
        '우선주': 'var(--market-down)', // 한국 하락 파란색
        '삼성전자': 'var(--foreground)', // 메인 항목 (밝게 조정된 그레이)
        '삼성전자우': 'var(--chart-3)', // 서브 항목 (미디엄 그레이)
    },
} as const;

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: ChartPieMarketcapProps['data'][number] & { compactLabel?: string } }> }) => {
    if (active && payload?.[0]?.payload) {
        const data = payload[0].payload;

        return (
            <div
                className="min-w-32 rounded-lg border border-border bg-popover p-2.5 shadow-lg  "
                style={{ zIndex: 50, position: 'relative' }}
            >
                <div className="mb-1.5 text-xs font-medium text-foreground">{data.name} · {data.compactLabel}</div>
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-1.5">
                            <div className="h-0.5 w-2.5 rounded" style={{ backgroundColor: data.color }} />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">시총</span>
                        </div>
                        <span className="text-xs font-medium text-foreground text-right">
                            {formatBusinessValue(data.rawValue ?? data.value)}원
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">비율</span>
                        <span className="text-xs font-medium text-foreground text-right">
                            {data.percentage.toFixed(2)}%
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

interface StackedBarTooltipProps {
    active?: boolean;
    payload?: Array<{
        dataKey: string;
        value: number;
        rawValue?: BusinessValue;
    }>;
    segments: Array<{
        key: string;
        name: string;
        label: string;
        percentage: number;
        value: number;
        rawValue?: BusinessValue;
        color: string;
        highlighted: boolean;
    }>;
    selectedType?: string;
}

const StackedBarTooltip = ({ active, payload, segments }: StackedBarTooltipProps) => {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    const visibleSegments = payload
        .map((entry) => {
            const segment = segments.find((item) => item.key === entry.dataKey);
            if (!segment || typeof entry.value !== 'number' || entry.value <= 0) {
                return null;
            }
            return segment;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (!visibleSegments.length) {
        return null;
    }

    return (
        <div className="min-w-36 rounded-lg border border-border bg-popover p-2.5 shadow-lg  ">
            <div className="space-y-1">
                {visibleSegments.map((segment) => (
                    <div key={segment.key} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: segment.color }}
                            />
                            <span className="text-xs text-muted-foreground" title={segment.name}>
                                {segment.label}
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-semibold text-foreground">
                                {segment.percentage.toFixed(2)}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {formatBusinessValue(segment.rawValue ?? segment.value)}원
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function ChartPieMarketcap({ data, centerText, selectedType = '시가총액 구성', selectedSecurityId, compact = false }: ChartPieMarketcapProps) {
    const isClient = useSyncExternalStore(subscribeReady, () => true, () => false);

    const series = useMemo(() => createMarketcapSeries(data), [data]);
    const chartData = useMemo(() => data.map((item, index) => ({
        ...item,
        key: series[index].key,
        color: item.color || getMarketcapSelectionColor(series[index].key, series, selectedSecurityId, selectedType) || COLORS.base[index % COLORS.base.length],
        compactLabel: series[index].label,
        highlighted: isMarketcapSeriesSelected(series[index].key, series, selectedSecurityId, selectedType),
    })), [data, series, selectedType, selectedSecurityId]);

    const hasAnnotation = Boolean(selectedSecurityId);

    const stackedSegments = useMemo(
        () =>
            compact ? [] : chartData.map((item) => ({
                key: item.key,
                name: item.name,
                label: item.compactLabel,
                percentage: item.percentage,
                value: item.value,
                rawValue: item.rawValue,
                color: item.color,
                highlighted: item.highlighted,
            })),
        [chartData, compact],
    );

    const stackedBarData = useMemo(() => {
        if (!stackedSegments.length) {
            return [] as Array<Record<string, number | string>>;
        }

        const total = stackedSegments.reduce((sum, segment) => sum + segment.value, 0);
        const totalRow = stackedSegments.reduce(
            (acc, segment) => {
                acc[segment.key] = total > 0 ? segment.value / total * 100 : 0;
                return acc;
            },
            { name: '시가총액 구성' } as Record<string, number | string>,
        );

        return [totalRow];
    }, [stackedSegments]);

    const stackedBarHeight = 56;

    if (!isClient || chartData.length === 0) {
        return (
            <div className={compact ? "relative flex min-h-36 w-full items-center justify-center" : "relative flex h-full w-full items-center justify-center"}>
                <div className="text-sm text-muted-foreground">
                    {!isClient ? '차트 로딩 중...' : '차트 데이터가 없습니다'}
                </div>
            </div>
        );
    }

    return (
        <div className={compact ? "grid w-full grid-cols-[min(9rem,35%)_minmax(0,1fr)] items-center gap-3" : "flex h-full w-full flex-col gap-3"}>
            <div className={compact ? "relative aspect-square min-w-0" : "relative min-h-60 flex-1"}>
                <ResponsiveContainer width="100%" height="100%" minWidth={compact ? 0 : 240} minHeight={compact ? 0 : 240}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={compact ? "94%" : "100%"}
                            innerRadius={compact ? "70%" : "32%"}
                            fill="var(--chart-3)"
                            dataKey="value"
                            stroke="var(--background)"
                            strokeWidth={2}
                            isAnimationActive={!compact}
                        >
                            {chartData.map((entry) => {
                                const isHighlighted = entry.highlighted;

                                return (
                                    <Cell
                                        key={entry.key}
                                        fill={entry.color}
                                        fillOpacity={hasAnnotation ? (isHighlighted ? 1 : 0.8) : 1}
                                        stroke="var(--background)"
                                        strokeWidth={hasAnnotation ? (isHighlighted ? 2 : 1) : 2}
                                    />
                                );
                            })}
                        </Pie>
                        <Tooltip
                            content={<CustomTooltip />}
                            wrapperStyle={{ zIndex: 50 }}
                            allowEscapeViewBox={compact ? { x: true } : undefined}
                            isAnimationActive={false}
                        />
                    </PieChart>
                </ResponsiveContainer>

                {centerText && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
                        <div className={compact ? "text-center" : "-mt-2 text-center"}>
                            <p className={compact ? "mb-0.5 text-xs leading-tight text-muted-foreground" : "mb-0.5 text-sm font-semibold leading-tight text-muted-foreground lg:text-base"}>
                                {centerText.title}
                            </p>
                            <p className={compact ? "text-sm font-bold leading-tight tabular-nums" : "text-lg font-black leading-tight text-foreground lg:text-xl xl:text-2xl"}>
                                {centerText.value}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex min-w-0 flex-col gap-2">
                {!compact && <div className="relative flex items-center justify-center" style={{ minHeight: stackedBarHeight }}>
                    <ResponsiveContainer width="90%" height={stackedBarHeight} minWidth={200}>
                        <BarChart data={stackedBarData} layout="vertical" margin={{ top: 6, right: 12, bottom: 6, left: 12 }}>
                            <CartesianGrid horizontal={false} vertical={false} />
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis type="category" dataKey="name" hide />
                            <Tooltip
                                content={<StackedBarTooltip segments={stackedSegments} selectedType={selectedType} />}
                                cursor={{ fill: 'var(--muted)' }}
                                isAnimationActive={false}
                            />
                            {stackedSegments.map((segment) => (
                                <Bar
                                    key={segment.key}
                                    dataKey={segment.key}
                                    stackId="total"
                                    fill={segment.color}
                                    fillOpacity={hasAnnotation ? (segment.highlighted ? 1 : 0.8) : 1}
                                    radius={0}
                                    isAnimationActive={false}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>}

                <div
                    className={compact ? "grid w-full gap-1 text-sm text-foreground" : "flex w-full flex-wrap items-baseline justify-center gap-x-3 gap-y-1 text-sm text-foreground"}
                    role="list"
                    aria-label="시가총액 구성 종목"
                >
                    {chartData.map((entry) => {
                        const isHighlighted = entry.highlighted;

                        return (
                            <span
                                key={entry.key}
                                role="listitem"
                                aria-current={isHighlighted || undefined}
                                title={compact ? `${entry.name} · ${formatBusinessValue(entry.rawValue ?? entry.value)}원` : undefined}
                                className={compact ? "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-1.5" : "inline-flex min-w-0 items-baseline gap-1.5"}
                            >
                                <span
                                    className="inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                                    style={{
                                        backgroundColor: entry.color,
                                        opacity: hasAnnotation && !isHighlighted ? 0.6 : 1,
                                    }}
                                    aria-hidden="true"
                                />
                                <span className="min-w-0 break-keep break-words font-medium tracking-tight">{entry.compactLabel}</span>
                                <span className="shrink-0 font-semibold tabular-nums">{entry.percentage.toFixed(2)}%</span>
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
