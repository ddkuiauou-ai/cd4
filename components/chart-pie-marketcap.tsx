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
    LabelList,
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

const BarPercentageLabel = ({ x, y, width, height, value }: any) => {
    if (typeof value !== 'number') return null;

    const labelX = (x ?? 0) + (width ?? 0) + 12;
    const labelY = (y ?? 0) + (height ?? 0) / 2;

    return (
        <text
            x={labelX}
            y={labelY}
            className="text-[11px] font-semibold text-slate-600 dark:text-slate-200"
            dominantBaseline="middle"
        >
            {`${value.toFixed(1)}%`}
        </text>
    );
};

export default function ChartPieMarketcap({ data, centerText, selectedType = '시가총액 구성' }: ChartPieMarketcapProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const chartData = useMemo(
        () =>
            data.map((item, index) => ({
                ...item,
                color: item.color || getSmartColor(item.name, index, selectedType),
            })),
        [data, selectedType],
    );

    const hasAnnotation = useMemo(() => Boolean(selectedType && selectedType !== '시가총액 구성'), [selectedType]);
    const barChartMinHeight = useMemo(() => Math.max(120, chartData.length * 32), [chartData.length]);

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
        <div className="grid h-full w-full grid-rows-[minmax(200px,1fr)_minmax(140px,0.8fr)_auto] gap-3">
            <div className="relative min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={CustomLabel}
                            outerRadius="72%" // 70% → 72%로 약간 확대 (290px 높이에 맞춤)
                            innerRadius="29%" // 28% → 29%로 비례 조정
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

            <div className="relative" style={{ minHeight: barChartMinHeight }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={barChartMinHeight}>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 32, bottom: 8, left: 12 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.35)" />
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis type="category" dataKey="name" hide />
                        <Tooltip
                            content={<CustomTooltip selectedType={selectedType} />}
                            cursor={{ fill: 'rgba(148, 163, 184, 0.16)' }}
                        />
                        <Bar dataKey="percentage" radius={[6, 6, 6, 6]} maxBarSize={32}>
                            {chartData.map((entry, index) => {
                                const isHighlighted = shouldHighlightSegment(entry.name, selectedType);

                                return (
                                    <Cell
                                        key={`bar-${index}`}
                                        fill={entry.color}
                                        fillOpacity={hasAnnotation ? (isHighlighted ? 0.95 : 0.35) : 0.9}
                                    />
                                );
                            })}
                            <LabelList dataKey="percentage" content={<BarPercentageLabel />} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="grid gap-1.5 text-[10px]">
                {chartData.map((entry, index) => {
                    const isHighlighted = shouldHighlightSegment(entry.name, selectedType);

                    return (
                        <div
                            key={`legend-${index}`}
                            className={cn(
                                'flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 transition-colors',
                                hasAnnotation
                                    ? isHighlighted
                                        ? 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-200'
                                        : 'border-transparent bg-slate-100/70 text-slate-400 dark:bg-slate-900/20 dark:text-slate-500'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-200',
                            )}
                        >
                            <div className="flex min-w-0 items-center gap-1.5">
                                <span
                                    className="h-2 w-2 flex-shrink-0 rounded-full"
                                    style={{
                                        backgroundColor: entry.color,
                                        opacity: hasAnnotation && !isHighlighted ? 0.4 : 1,
                                    }}
                                />
                                <span className="truncate">{entry.name}</span>
                            </div>
                            <span
                                className={cn(
                                    'tabular-nums font-semibold',
                                    hasAnnotation && !isHighlighted
                                        ? 'text-slate-400 dark:text-slate-500'
                                        : 'text-slate-600 dark:text-slate-200',
                                )}
                            >
                                {entry.percentage.toFixed(1)}%
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
