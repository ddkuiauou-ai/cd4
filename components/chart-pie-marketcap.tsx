'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import { cn, formatNumber } from '@/lib/utils';

interface ChartPieMarketcapProps {
    data: Array<{
        name: string;
        value: number;
        percentage: number;
        type?: string;
        color?: string;
    }>;
    centerText?: {
        title: string;
        value: string;
    };
    selectedType?: string; // 🎯 라인 차트와 동일한 어노테이션 기능
}

// 🎨 라인 차트와 동일한 색상 시스템 적용 (가독성 개선)
const COLORS = {
    // 기본 그레이스케일 (라인 차트와 동일, 가독성 개선)
    base: [
        '#4a5568', // Medium dark gray - 총합계/메인 항목 (기존 #222222에서 밝게 조정)
        '#666666', // Medium gray - 보통주
        '#AAAAAA', // Light gray - 우선주
        '#888888', // Medium gray - 기타
        '#CCCCCC', // Light gray - 기타
        '#4b5563', // 추가 그레이
        '#6b7280', // 추가 그레이
        '#9ca3af', // 추가 그레이
    ],
    // 브랜드 액센트 컬러 (라인 차트와 동일)
    accent: {
        '시가총액구성': '#d83d1e', // 브랜드 주황색
        '보통주': '#D60000', // 한국 상승 빨간색
        '우선주': '#0066CC', // 한국 하락 파란색
        '삼성전자': '#4a5568', // 메인 항목 (밝게 조정된 그레이)
        '삼성전자우': '#666666', // 서브 항목 (미디엄 그레이)
    },
} as const;

// 스마트 컬러 매칭 (어노테이션 기능)
const getSmartColor = (name: string, index: number, selectedType?: string) => {
    const shouldHighlight = shouldHighlightSegment(name, selectedType);

    // 선택된 타입에 해당하는 세그먼트만 브랜드 컬러 사용
    if (selectedType && selectedType !== '시가총액 구성' && shouldHighlight) {
        // 삼성전자 관련 특별 처리
        if (name.includes('삼성전자우') || name === '삼성전자우') {
            return COLORS.accent['우선주']; // 파란색으로 강조
        }
        if (name.includes('삼성전자') || name === '삼성전자') {
            return COLORS.accent['보통주']; // 빨간색으로 강조
        }

        // 일반적인 키워드 매칭
        if (name.includes('보통주')) {
            return COLORS.accent['보통주'];
        }
        if (name.includes('우선주')) {
            return COLORS.accent['우선주'];
        }

        // 강조할 항목이지만 특별한 키워드가 없는 경우
        return COLORS.accent['시가총액구성'];
    }

    // 기본 상태 또는 강조하지 않을 세그먼트는 그레이스케일 사용
    return COLORS.base[index % COLORS.base.length];
};

// 세그먼트 강조 여부 결정
const shouldHighlightSegment = (name: string, selectedType?: string): boolean => {
    if (!selectedType || selectedType === '시가총액 구성') {
        return false; // 기본 상태에서는 어노테이션 없음
    }

    switch (selectedType) {
        case '보통주':
            return name.includes('보통주') || (name.includes('삼성전자') && !name.includes('우'));
        case '우선주':
            return name.includes('우선주') || name.includes('삼성전자우');
        default:
            return false; // 알 수 없는 타입은 강조하지 않음
    }
};

const CustomTooltip = ({ active, payload, selectedType }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;

        return (
            <div
                className="min-w-32 rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                style={{ zIndex: 50, position: 'relative' }}
            >
                <div className="mb-1.5 text-xs font-medium text-gray-900 dark:text-gray-100">{data.name}</div>
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-1.5">
                            <div className="h-0.5 w-2.5 rounded" style={{ backgroundColor: data.color }} />
                            <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">시총</span>
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 text-right">
                            {formatNumber(data.value)}원
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400">비율</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 text-right">
                            {data.percentage.toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
    // 5% 이상인 경우만 라벨 표시 (임계값 낮춤)
    if (percentage < 5) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.8; // 0.75 -> 0.8로 라벨을 조금 더 바깥쪽으로
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text
            x={x}
            y={y}
            fill="#ffffff" // 화이트 텍스트로 대비 강화
            textAnchor={x > cx ? 'start' : 'end'}
            dominantBaseline="central"
            fontSize={16} // 14 -> 16로 더 크게
            fontWeight={900} // 더 굵게
            stroke="#000000" // 검은색 아웃라인
            strokeWidth={1} // 0.8 -> 1로 아웃라인 더 강화
        >
            {`${percentage.toFixed(0)}%`}
        </text>
    );
};

interface StackedBarTooltipProps {
    active?: boolean;
    payload?: Array<{
        dataKey: string;
        value: number;
    }>;
    segments: Array<{
        key: string;
        name: string;
        label: string;
        percentage: number;
        value: number;
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
        <div className="min-w-36 rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="space-y-1">
                {visibleSegments.map((segment) => (
                    <div key={segment.key} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: segment.color }}
                            />
                            <span className="text-xs text-gray-600 dark:text-gray-300" title={segment.name}>
                                {segment.label}
                            </span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[11px] font-semibold text-gray-900 dark:text-gray-100">
                                {segment.percentage.toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                {formatNumber(segment.value)}원
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const getCompactLabel = (
    item: ChartPieMarketcapProps['data'][number],
    index: number,
    typeCounts: Map<string, number>,
    typeIndexes: Map<string, number>,
) => {
    const fallback = item.name?.replace(/\s+/g, '') || `구성 ${index + 1}`;
    const baseKey = item.type || item.name || fallback;

    const currentIndex = (typeIndexes.get(baseKey) ?? 0) + 1;
    typeIndexes.set(baseKey, currentIndex);

    const compactBase = item.type || item.name?.split(/\s+/)[0] || fallback;
    const hasDuplicates = (typeCounts.get(baseKey) ?? 0) > 1;

    if (hasDuplicates) {
        return `${compactBase} ${currentIndex}`;
    }

    return compactBase;
};

export default function ChartPieMarketcap({ data, centerText, selectedType = '시가총액 구성' }: ChartPieMarketcapProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const chartData = useMemo(() => {
        const typeCounts = new Map<string, number>();
        data.forEach((item) => {
            const key = item.type || item.name || '';
            typeCounts.set(key, (typeCounts.get(key) ?? 0) + 1);
        });

        const typeIndexes = new Map<string, number>();

        return data.map((item, index) => ({
            ...item,
            color: item.color || getSmartColor(item.name, index, selectedType),
            compactLabel: getCompactLabel(item, index, typeCounts, typeIndexes),
        }));
    }, [data, selectedType]);

    const hasAnnotation = useMemo(() => Boolean(selectedType && selectedType !== '시가총액 구성'), [selectedType]);

    const stackedSegments = useMemo(
        () =>
            chartData.map((item, index) => ({
                key: `segment_${index}`,
                name: item.name,
                label: item.compactLabel,
                percentage: item.percentage,
                value: item.value,
                color: item.color,
                highlighted: shouldHighlightSegment(item.name, selectedType),
            })),
        [chartData, selectedType],
    );

    const stackedBarData = useMemo(() => {
        if (!stackedSegments.length) {
            return [] as Array<Record<string, number | string>>;
        }

        const totalRow = stackedSegments.reduce(
            (acc, segment) => {
                acc[segment.key] = segment.percentage;
                return acc;
            },
            { name: '시가총액 구성' } as Record<string, number | string>,
        );

        return [totalRow];
    }, [stackedSegments]);

    const stackedBarHeight = 56;

    if (!isClient || chartData.length === 0) {
        return (
            <div className="relative flex h-full w-full items-center justify-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {!isClient ? '차트 로딩 중...' : '차트 데이터가 없습니다'}
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full flex-col gap-3.5">
            <div className="relative min-h-[200px] flex-1">
                <ResponsiveContainer width="100%" height="100%" minWidth={220} minHeight={200}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={CustomLabel}
                            outerRadius="78%"
                            innerRadius="26%"
                            fill="#8884d8"
                            dataKey="value"
                            stroke="#ffffff"
                            strokeWidth={2}
                        >
                            {chartData.map((entry, index) => {
                                const isHighlighted = shouldHighlightSegment(entry.name, selectedType);

                                return (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color}
                                        fillOpacity={hasAnnotation ? (isHighlighted ? 1 : 0.4) : 1}
                                        stroke="#ffffff"
                                        strokeWidth={hasAnnotation ? (isHighlighted ? 2 : 1) : 2}
                                    />
                                );
                            })}
                        </Pie>
                        <Tooltip
                            content={<CustomTooltip selectedType={selectedType} />}
                            wrapperStyle={{ zIndex: 50 }}
                            isAnimationActive={false}
                        />
                    </PieChart>
                </ResponsiveContainer>

                {centerText && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
                        <div className="-mt-2 text-center">
                            <p className="mb-0.5 text-sm font-semibold leading-tight text-slate-600 dark:text-slate-400 lg:text-base">
                                {centerText.title}
                            </p>
                            <p className="text-lg font-black leading-tight text-slate-900 dark:text-slate-100 lg:text-xl xl:text-2xl">
                                {centerText.value}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-2">
                <div className="relative flex items-center justify-center" style={{ minHeight: stackedBarHeight }}>
                    <ResponsiveContainer width="90%" height={stackedBarHeight} minWidth={200}>
                        <BarChart data={stackedBarData} layout="vertical" margin={{ top: 6, right: 12, bottom: 6, left: 12 }}>
                            <CartesianGrid horizontal={false} vertical={false} />
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis type="category" dataKey="name" hide />
                            <Tooltip
                                content={<StackedBarTooltip segments={stackedSegments} selectedType={selectedType} />}
                                cursor={{ fill: 'rgba(148, 163, 184, 0.18)' }}
                            />
                            {stackedSegments.map((segment, index) => (
                                <Bar
                                    key={segment.key}
                                    dataKey={segment.key}
                                    stackId="total"
                                    fill={segment.color}
                                    fillOpacity={hasAnnotation ? (segment.highlighted ? 0.95 : 0.35) : 0.9}
                                    radius={0}
                                    isAnimationActive={false}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div
                    className="flex w-full flex-nowrap items-center justify-center overflow-x-auto text-center text-[11px] text-slate-500 dark:text-slate-400"
                    role="list"
                    aria-label="시가총액 구성 종목"
                >
                    {chartData.map((entry, index) => {
                        const isHighlighted = shouldHighlightSegment(entry.name, selectedType);

                        return (
                            <span
                                key={`legend-${index}`}
                                role="listitem"
                                className={cn(
                                    'inline-flex items-center gap-1 whitespace-nowrap text-slate-700 dark:text-slate-200',
                                    hasAnnotation && !isHighlighted ? 'opacity-50' : 'opacity-100',
                                    index < chartData.length - 1
                                        ? "after:content-[','] after:mr-1 after:text-slate-400 dark:after:text-slate-500"
                                        : '',
                                )}
                            >
                                <span
                                    className="inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                                    style={{
                                        backgroundColor: entry.color,
                                        opacity: hasAnnotation && !isHighlighted ? 0.6 : 1,
                                    }}
                                    aria-hidden="true"
                                />
                                <span className="font-medium tracking-tight">{entry.compactLabel}</span>
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
