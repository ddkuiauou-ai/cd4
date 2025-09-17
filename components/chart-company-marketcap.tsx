"use client";

import { useEffect, useMemo, useState } from "react";
import {
    formatNumberRaw,
    formatNumberTooltip,
    formatNumberRatio,
    formatNumberPercent,
    formatNumberForChart,
    formatNumberRawForChart,
    formatNumberCompactForChart,
} from "../lib/utils";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";

type Props = {
    data: {
        date: string;
        totalValue?: number;
    }[];
    format: string;
    formatTooltip: string;
    selectedType?: string; // 선택된 종목 타입 (보통주, 우선주, 시가총액 구성)
};

function ChartCompanyMarketcap({ data, format, formatTooltip, selectedType = "시가총액 구성" }: Props) {
    const [isMobile, setIsMobile] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // 🎨 선택적 컬러 어노테이션 팔레트 (CD3 브랜드 컬러 활용)
    const colors = useMemo(() => {
        // 기본 그레이스케일 (더 시각적으로 구분되는 색상)
        const baseColors = [
            "#1a1a1a", // Very dark gray - 총합계 (기본)
            "#404040", // Dark gray - 보통주 (기본)
            "#666666", // Medium gray - 우선주 (기본)
            "#808080", // Light gray - 기타
            "#999999", // Lighter gray - 기타
        ];

        // 선택시 브랜드 컬러 (한국 금융 표준)
        const accentColors = {
            "시가총액 구성": "#d83d1e", // 브랜드 주황색 - 총합계 강조
            "보통주": "#D60000",        // 한국 상승 빨간색 - 보통주 강조  
            "우선주": "#0066CC"         // 한국 하락 파란색 - 우선주 강조
        };

        return { base: baseColors, accent: accentColors };
    }, []);

    // 🎯 선택된 타입에 따른 동적 컬러 결정 (개선된 버전)
    const getLineColor = (key: string, index: number) => {
        // 선택된 타입에 해당하는 라인만 브랜드 컬러로 강조
        if (selectedType === "시가총액 구성" && (key === "총합계" || key === "totalValue")) {
            return colors.accent["시가총액 구성"];
        }
        if (selectedType === "보통주" && key.includes("보통주")) {
            return colors.accent["보통주"];
        }
        if (selectedType === "우선주" && key.includes("우선주")) {
            return colors.accent["우선주"];
        }

        // 기본: 더 구분하기 쉬운 그레이스케일 유지
        return colors.base[index % colors.base.length];
    };

    // 🎯 선택된 타입에 따른 라인 스타일 결정 함수 (개선)
    const getLineStyle = (key: string) => {
        const isHighlighted = shouldHighlightLine(key, selectedType);

        return {
            strokeWidth: isHighlighted ? 3 : 1.5, // 더 미묘한 차이
            strokeOpacity: isHighlighted ? 1 : 0.4, // 배경 라인을 더 연하게
            strokeDasharray: undefined, // 패턴은 getStrokePattern에서 처리
        };
    };

    // 🔍 라인을 강조할지 결정하는 함수 (최적화)
    const shouldHighlightLine = (key: string, selectedType: string): boolean => {
        switch (selectedType) {
            case "보통주":
                return key.includes("보통주");
            case "우선주":
                return key.includes("우선주");
            case "시가총액 구성":
                return key === "총합계" || key === "totalValue";
            default:
                return true; // 기본값: 모든 라인 강조
        }
    };

    // 📈 라인 패턴 설정 (더 간단하게)
    const getStrokePattern = (key: string) => {
        if (key === "총합계" || key === "totalValue") return "0"; // 실선
        if (key.includes("보통주")) return "0"; // 실선
        if (key.includes("우선주")) return "0"; // 실선
        return "0"; // 모든 라인을 실선으로 (더 깔끔함)
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[250px] sm:h-[280px] md:h-[320px] lg:h-[350px] xl:h-[380px] bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">차트 데이터 없음</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">시가총액 데이터가 없습니다</p>
                    </div>
                </div>
            </div>
        );
    }

    const keys = Object.keys(data[0]);
    // reoder by date in inputValues
    data.sort((a, b) => (a.date < b.date ? -1 : 1));

    // 📊 Y축 도메인 계산 (데이터 범위에 맞게 자동 조정)
    const getYAxisDomain = () => {
        const dataKeys = keys.filter(key => key !== "date");
        if (!dataKeys.length) return ['dataMin - 5%', 'dataMax + 5%'];

        let minValue = Infinity;
        let maxValue = -Infinity;

        data.forEach(item => {
            dataKeys.forEach(key => {
                const value = (item as any)[key];
                if (value !== null && value !== undefined && typeof value === 'number') {
                    minValue = Math.min(minValue, value);
                    maxValue = Math.max(maxValue, value);
                }
            });
        });

        // 유효한 데이터가 없는 경우
        if (minValue === Infinity || maxValue === -Infinity) {
            return ['dataMin - 5%', 'dataMax + 5%'];
        }

        // 데이터 범위가 너무 작은 경우 (예: 모든 값이 동일)
        if (maxValue - minValue < (maxValue * 0.01)) {
            const center = (minValue + maxValue) / 2;
            const padding = Math.max(center * 0.1, 1000000); // 최소 100만원 패딩
            return [center - padding, center + padding];
        }

        // 일반적인 경우: 5-10% 패딩
        const range = maxValue - minValue;
        const padding = range * 0.08;

        return [
            Math.max(0, minValue - padding), // 음수 방지
            maxValue + padding
        ];
    };

    const yAxisDomain = getYAxisDomain();

    if (!isClient || !data || data.length === 0) {
        return (
            <div className="w-full h-[250px] sm:h-[280px] md:h-[320px] lg:h-[350px] xl:h-[380px] flex items-center justify-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {!isClient ? "차트 로딩 중..." : "차트 데이터가 없습니다"}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-[250px] sm:h-[280px] md:h-[320px] lg:h-[350px] xl:h-[380px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={250}>
                <LineChart
                    data={data}
                    margin={{
                        top: 8,   // 5 -> 8로 조금 증가 (범례와의 여백)
                        right: 12, // 10 -> 12로 조금 증가
                        left: 8,   // 5 -> 8로 조금 증가
                        bottom: 10, // 12 -> 10으로 더 줄임 (더 타이트하게)
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" className="dark:opacity-30" strokeOpacity={0.5} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(value) => {
                            const date = new Date(value);
                            return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
                        }}
                        stroke="#666666"
                        className="dark:stroke-gray-400"
                        fontSize={12}
                        tick={{ fill: '#666666', className: 'dark:fill-gray-400' }}
                        axisLine={{ stroke: '#E5E5E5', className: 'dark:stroke-gray-600' }}
                        tickLine={{ stroke: '#E5E5E5', className: 'dark:stroke-gray-600' }}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        domain={yAxisDomain}
                        tickFormatter={formatNumberCompactForChart}
                        stroke="#666666"
                        className="dark:stroke-gray-400"
                        fontSize={12}
                        tick={{ fill: '#666666', className: 'dark:fill-gray-400' }}
                        axisLine={{ stroke: '#E5E5E5', className: 'dark:stroke-gray-600' }}
                        tickLine={{ stroke: '#E5E5E5', className: 'dark:stroke-gray-600' }}
                        width={40} // 50 -> 40으로 더 줄임 (Y축과 카드 경계 가까이)
                    />
                    <Tooltip
                        content={<CustomTooltip formatTooltip={formatTooltip} selectedType={selectedType} />}
                        isAnimationActive={false}
                    />
                    <Legend
                        content={<CustomLegend payload={keys.filter(key => key !== "date").map((key, index) => ({ value: key, type: 'line', color: getLineColor(key, index) }))} />}
                        wrapperStyle={{
                            paddingTop: '2px', // 0px -> 2px로 약간 증가
                            position: 'relative',
                            marginTop: '-6px', // -8px -> -6px로 약간 완화
                        }}
                    />
                    {keys.map(
                        (key, index) =>
                            key !== "date" && (
                                <Line
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    stroke={getLineColor(key, index)}
                                    strokeWidth={getLineStyle(key).strokeWidth}
                                    strokeOpacity={getLineStyle(key).strokeOpacity}
                                    strokeDasharray={getStrokePattern(key)}
                                    dot={false}
                                    activeDot={{ r: 4, fill: getLineColor(key, index) }}
                                />
                            )
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
        color: string;
        dataKey: string;
        payload: {
            date: string;
            value: number;
            [key: string]: string | number | boolean | null | undefined;
        };
        value: number;
    }>;
    formatTooltip: string;
    selectedType?: string;
}

function CustomTooltip({ active, payload, formatTooltip, selectedType }: CustomTooltipProps) {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    // 📅 날짜 포맷 간소화 함수
    const formatDate = (dateStr: string): string => {
        try {
            const date = new Date(dateStr);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}.${month}.${day}`;
        } catch {
            // 이미 간단한 형태인 경우 (예: "2024-12-15")
            return dateStr.replace(/-/g, '.');
        }
    };

    // 📝 라벨 간소화 및 중복 제거 함수
    const getSimplifiedLabel = (key: string): string => {
        if (key === "총합계" || key === "totalMarketcap" || key === "value") {
            return "전체 시총";
        }
        if (key.includes("보통주")) {
            return "보통주";
        }
        if (key.includes("우선주")) {
            return "우선주";
        }
        return key;
    };

    // 🔄 중복 데이터 필터링 (payload 기반)
    const filteredEntries = (payload && payload.length > 0) ? (payload || []).reduce((acc, entry) => {
        const label = getSimplifiedLabel(entry.dataKey);

        // 이미 같은 라벨이 있다면 건너뛰기 (첫 번째 것만 유지)
        if (!acc.some(item => getSimplifiedLabel(item.dataKey) === label)) {
            acc.push(entry);
        }

        return acc;
    }, [] as typeof payload) : [];

    return (
        <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-32">
            <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1.5">
                {formatDate(data.date)}
            </div>
            <div className="space-y-1">
                {filteredEntries.map((entry) => (
                    <div key={entry.dataKey} className="flex justify-between items-center gap-2">
                        <div className="flex items-center space-x-1.5">
                            <div
                                className="w-2.5 h-0.5 rounded"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {getSimplifiedLabel(entry.dataKey)}
                            </span>
                        </div>
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 text-right">
                            {formatTooltipFunction(entry.value, formatTooltip)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// 📊 커스텀 범례 컴포넌트
interface CustomLegendProps {
    payload?: Array<{
        value: string;
        type: string;
        color: string;
        payload?: any;
    }>;
}

function CustomLegend({ payload }: CustomLegendProps) {
    if (!payload || !payload.length) return null;

    // 📝 라벨 간소화 함수 (툴팁과 동일)
    const getSimplifiedLabel = (key: string): string => {
        if (key === "총합계" || key === "totalMarketcap" || key === "value") {
            return "전체 시총";
        }
        if (key.includes("보통주")) {
            return "보통주";
        }
        if (key.includes("우선주")) {
            return "우선주";
        }
        return key;
    };

    // 🔄 중복 제거
    const uniqueEntries = (payload && payload.length > 0) ? (payload || []).reduce((acc, entry) => {
        const simplifiedLabel = getSimplifiedLabel(entry.value);

        // 이미 같은 라벨이 있다면 건너뛰기
        if (!acc.some(item => getSimplifiedLabel(item.value) === simplifiedLabel)) {
            acc.push(entry);
        }

        return acc;
    }, [] as typeof payload) : [];

    return (
        <div className="flex flex-wrap justify-center gap-4">  {/* mt-1 제거 */}
            {uniqueEntries.map((entry, index) => (
                <div key={index} className="flex items-center gap-1.5">
                    <div
                        className="w-4 h-0.5 rounded"
                        style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                        {getSimplifiedLabel(entry.value)}
                    </span>
                </div>
            ))}
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

export default ChartCompanyMarketcap;
