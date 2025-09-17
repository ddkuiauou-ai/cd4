'use client';

import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatNumber } from '@/lib/utils';

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
        "#4a5568", // Medium dark gray - 총합계/메인 항목 (기존 #222222에서 밝게 조정)
        "#666666", // Medium gray - 보통주
        "#AAAAAA", // Light gray - 우선주  
        "#888888", // Medium gray - 기타
        "#CCCCCC", // Light gray - 기타
        "#4b5563", // 추가 그레이
        "#6b7280", // 추가 그레이
        "#9ca3af", // 추가 그레이
    ],
    // 브랜드 액센트 컬러 (라인 차트와 동일)
    accent: {
        "시가총액구성": "#d83d1e", // 브랜드 주황색
        "보통주": "#D60000",        // 한국 상승 빨간색
        "우선주": "#0066CC",        // 한국 하락 파란색
        "삼성전자": "#4a5568",      // 메인 항목 (밝게 조정된 그레이)
        "삼성전자우": "#666666"     // 서브 항목 (미디엄 그레이)
    }
};

// 스마트 컬러 매칭 (어노테이션 기능)
const getSmartColor = (name: string, index: number, selectedType?: string) => {
    const shouldHighlight = shouldHighlightSegment(name, selectedType);

    // 선택된 타입에 해당하는 세그먼트만 브랜드 컬러 사용
    if (selectedType && selectedType !== "시가총액 구성" && shouldHighlight) {
        // 삼성전자 관련 특별 처리
        if (name.includes("삼성전자우") || name === "삼성전자우") {
            return COLORS.accent["우선주"]; // 파란색으로 강조
        }
        if (name.includes("삼성전자") || name === "삼성전자") {
            return COLORS.accent["보통주"]; // 빨간색으로 강조
        }

        // 일반적인 키워드 매칭
        if (name.includes("보통주")) {
            return COLORS.accent["보통주"];
        }
        if (name.includes("우선주")) {
            return COLORS.accent["우선주"];
        }

        // 강조할 항목이지만 특별한 키워드가 없는 경우
        return COLORS.accent["시가총액구성"];
    }

    // 기본 상태 또는 강조하지 않을 세그먼트는 그레이스케일 사용
    return COLORS.base[index % COLORS.base.length];
};

// 세그먼트 강조 여부 결정
const shouldHighlightSegment = (name: string, selectedType?: string): boolean => {
    if (!selectedType || selectedType === "시가총액 구성") {
        return false; // 기본 상태에서는 어노테이션 없음
    }

    switch (selectedType) {
        case "보통주":
            return name.includes("보통주") || (name.includes("삼성전자") && !name.includes("우"));
        case "우선주":
            return name.includes("우선주") || name.includes("삼성전자우");
        default:
            return false; // 알 수 없는 타입은 강조하지 않음
    }
};

const CustomTooltip = ({ active, payload, selectedType }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;

        return (
            <div
                className="bg-white dark:bg-gray-800 p-2.5 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-32"
                style={{ zIndex: 50, position: 'relative' }}
            >
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1.5">
                    {data.name}
                </div>
                <div className="space-y-1">
                    <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center space-x-1.5">
                            <div
                                className="w-2.5 h-0.5 rounded"
                                style={{ backgroundColor: data.color }}
                            />
                            <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                시총
                            </span>
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 text-right">
                            {formatNumber(data.value)}원
                        </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                            비율
                        </span>
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

export default function ChartPieMarketcap({ data, centerText, selectedType = "시가총액 구성" }: ChartPieMarketcapProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // 🎨 스마트 색상 할당 (어노테이션 기능 포함)
    const chartData = data.map((item, index) => ({
        ...item,
        color: item.color || getSmartColor(item.name, index, selectedType)
    }));

    if (!isClient || !data || data.length === 0) {
        return (
            <div className="w-full h-full relative flex items-center justify-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {!isClient ? "차트 로딩 중..." : "차트 데이터가 없습니다"}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full relative">
            <div style={{ width: '100%', height: '100%', minHeight: '200px' }}>
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
                                const hasAnnotation = selectedType && selectedType !== "시가총액 구성";

                                return (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color}
                                        fillOpacity={hasAnnotation ? (isHighlighted ? 1 : 0.4) : 1} // 🎯 어노테이션이 있을 때만 투명도 조정
                                        stroke="#ffffff" // 항상 화이트 스트로크
                                        strokeWidth={hasAnnotation ? (isHighlighted ? 2 : 1) : 2} // 어노테이션이 있을 때만 두께 조정
                                    />
                                );
                            })}
                        </Pie>
                        <Tooltip
                            content={<CustomTooltip selectedType={selectedType} />}
                            wrapperStyle={{ zIndex: 50 }}
                            isAnimationActive={false}
                        />
                        {/* 범례 - 더 컴팩트하게 조정 */}
                        <Legend
                            verticalAlign="bottom"
                            height={18} // 24 → 18로 6px 줄임
                            formatter={(value, entry) => {
                                const isHighlighted = shouldHighlightSegment(value, selectedType);
                                const hasAnnotation = selectedType && selectedType !== "시가총액 구성";

                                return (
                                    <span style={{
                                        color: hasAnnotation ? (isHighlighted ? '#374151' : '#9ca3af') : '#374151', // 🎯 라이트모드 색상 유지
                                        fontSize: '10px',
                                        fontWeight: hasAnnotation ? (isHighlighted ? '600' : '400') : '500' // 🎯 어노테이션이 있을 때만 폰트 웨이트 조정
                                    }} className={hasAnnotation ? (isHighlighted ? 'dark:text-gray-200' : 'dark:text-gray-500') : 'dark:text-gray-300'}>
                                        {value}
                                    </span>
                                );
                            }}
                            wrapperStyle={{
                                paddingTop: '4px', // 8px → 4px로 4px 줄임
                                fontSize: '10px' // 11px → 10px로 줄임
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* 중앙 텍스트 - 깔끔한 오버레이 */}
            {centerText && (
                <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{ zIndex: 10 }}
                >
                    <div className="text-center" style={{ marginTop: '-10px' }}>
                        {/* 타이틀 */}
                        <p className="text-sm lg:text-base text-slate-600 dark:text-slate-400 font-semibold leading-tight mb-0.5">
                            {centerText.title}
                        </p>
                        {/* 값 */}
                        <p className="text-lg lg:text-xl xl:text-2xl font-black leading-tight text-slate-900 dark:text-slate-100">
                            {centerText.value}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
