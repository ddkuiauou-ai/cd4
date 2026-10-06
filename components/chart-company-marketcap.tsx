"use client";

import { useEffect, useMemo, useState } from "react";
import {
    formatNumberRaw,
    formatNumberTooltip,
    formatNumberRatio,
    formatNumberPercent,
    formatNumberCompactForChart,
    formatDateKorean,
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
    usePlotArea,
    useYAxisScale,
} from "recharts";

import { getMarketcapSeriesLabel, getMarketcapSelectionColor, isMarketcapSeriesSelected, type MarketcapSeries } from "@/lib/chart-selection";

type MarketcapDataPoint = {
    date: string;
    totalValue?: number;
    [key: string]: string | number | boolean | null | undefined;
};

type Props = {
    data: MarketcapDataPoint[];
    format: string;
    formatTooltip: string;
    selectedType?: string; // 선택된 종목 타입 (보통주, 우선주, 시가총액 구성)
    selectedSecurityId?: string;
    series?: readonly MarketcapSeries[];
};

type AxisBreakConfig = {
    breakStart: number;
    compressionRatio: number;
    maxValue: number;
    forward: (value: number) => number;
    inverse: (value: number) => number;
};

type SeriesStats = {
    key: string;
    min: number;
    max: number;
    values: number[];
};

const AXIS_BREAK_RATIO_THRESHOLD = 1.75; // 축 생략을 적용할 최소 배율 차이 (완화)
const AXIS_BREAK_GAP_THRESHOLD = 0.35; // 최대값 대비 갭 비중 기준
const MIN_COMPRESSION_RATIO = 0.08;
const MAX_COMPRESSION_RATIO = 0.35;

function computeSeriesStats(
    data: MarketcapDataPoint[],
    keys: string[],
): SeriesStats[] {
    return keys
        .map((key) => {
            const values: number[] = [];

            data.forEach((item) => {
                const raw = item?.[key];

                if (typeof raw === "number" && Number.isFinite(raw)) {
                    values.push(raw);
                }
            });

            if (!values.length) {
                return null;
            }

            const min = Math.min(...values);
            const max = Math.max(...values);

            if (!Number.isFinite(min) || !Number.isFinite(max)) {
                return null;
            }

            return { key, min, max, values };
        })
        .filter((stat): stat is SeriesStats => Boolean(stat));
}

function createAxisBreakConfig(seriesStats: SeriesStats[]): AxisBreakConfig | null {
    const positiveStats = seriesStats
        .map((stat) => ({
            ...stat,
            values: stat.values.filter((value) => typeof value === "number" && Number.isFinite(value) && value >= 0),
        }))
        .filter((stat) => stat.values.length > 0);

    if (positiveStats.length < 2) {
        return null;
    }

    const sortedByMax = [...positiveStats].sort((a, b) => a.max - b.max);

    const largestSeries = sortedByMax[sortedByMax.length - 1];
    const comparisonSeries = sortedByMax[sortedByMax.length - 2];

    const maxValue = largestSeries.max;
    const comparisonValue = comparisonSeries.max;

    if (!Number.isFinite(maxValue) || maxValue <= 0) {
        return null;
    }

    const ratio = comparisonValue > 0 ? maxValue / comparisonValue : Number.POSITIVE_INFINITY;
    const gapShare = comparisonValue > 0 ? (maxValue - comparisonValue) / maxValue : 1;

    if (
        (!Number.isFinite(ratio) || ratio < AXIS_BREAK_RATIO_THRESHOLD)
        && gapShare < AXIS_BREAK_GAP_THRESHOLD
    ) {
        return null;
    }

    const thirdLargest = sortedByMax.length >= 3 ? sortedByMax[sortedByMax.length - 3] : undefined;

    const fallbackReference = thirdLargest && thirdLargest.max > 0
        ? thirdLargest.max
        : comparisonValue > 0
            ? comparisonValue
            : maxValue * 0.1;

    const comparisonBase = comparisonValue > 0 ? comparisonValue : fallbackReference;
    const gapBetween = maxValue - comparisonBase;

    let breakStart = comparisonBase > 0
        ? comparisonBase + gapBetween * 0.25
        : fallbackReference * 1.2;

    if (comparisonBase > 0) {
        const minimumBreak = comparisonBase * 1.05;
        if (!Number.isFinite(breakStart) || breakStart < minimumBreak) {
            breakStart = minimumBreak;
        }
    }

    if (!Number.isFinite(breakStart) || breakStart <= 0) {
        breakStart = maxValue * 0.4;
    }

    if (breakStart >= maxValue) {
        breakStart = maxValue * 0.7;
    }

    const gap = maxValue - breakStart;

    if (gap <= 0) {
        return null;
    }

    const desiredGap = Math.max(
        comparisonBase > 0 ? comparisonBase * 0.35 : 0,
        breakStart * 0.45,
    );
    const compressionRatio = Math.min(
        MAX_COMPRESSION_RATIO,
        Math.max(MIN_COMPRESSION_RATIO, desiredGap / gap),
    );

    const forward = (value: number) => {
        if (!Number.isFinite(value)) {
            return value;
        }

        if (value <= breakStart) {
            return value;
        }

        return breakStart + (value - breakStart) * compressionRatio;
    };

    const inverse = (value: number) => {
        if (!Number.isFinite(value)) {
            return value;
        }

        if (value <= breakStart) {
            return value;
        }

        return breakStart + (value - breakStart) / compressionRatio;
    };

    return {
        breakStart,
        compressionRatio,
        maxValue,
        forward,
        inverse,
    };
}

function transformChartData(
    data: MarketcapDataPoint[],
    keys: string[],
    axisBreak: AxisBreakConfig | null,
) {
    return data.map((item) => {
        const transformed: MarketcapDataPoint = {
            date: item.date,
        };

        if (Object.prototype.hasOwnProperty.call(item, "value")) {
            const rawValue = item.value as number | null | undefined;

            if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
                transformed.value = axisBreak ? axisBreak.forward(rawValue) : rawValue;
                transformed.__original__value = rawValue;
            } else {
                transformed.value = rawValue ?? null;
                transformed.__original__value = typeof rawValue === "number" ? rawValue : null;
            }
        }

        keys.forEach((key) => {
            const rawValue = item?.[key];

            if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
                const transformedValue = axisBreak ? axisBreak.forward(rawValue) : rawValue;
                transformed[key] = transformedValue;
                transformed[`__original__${key}`] = rawValue;
            } else {
                transformed[key] = rawValue ?? null;
                transformed[`__original__${key}`] = typeof rawValue === "number" ? rawValue : null;
            }
        });

        return transformed;
    });
}

function computeYAxisDomain(
    data: MarketcapDataPoint[],
    keys: string[],
) {
    const domainValues = keys.reduce<number[]>((acc, key) => {
        data.forEach((item) => {
            const value = item?.[key];
            if (typeof value === "number" && Number.isFinite(value)) {
                acc.push(value);
            }
        });
        return acc;
    }, []);

    if (!domainValues.length) {
        return ['dataMin - 5%', 'dataMax + 5%'];
    }

    const minValue = Math.min(...domainValues);
    const maxValue = Math.max(...domainValues);

    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
        return ['dataMin - 5%', 'dataMax + 5%'];
    }

    if (maxValue === minValue) {
        const center = minValue;
        const padding = Math.max(Math.abs(center) * 0.1, 1_000_000);
        return [center - padding, center + padding];
    }

    const range = maxValue - minValue;
    const padding = range * 0.08;

    return [Math.max(0, minValue - padding), maxValue + padding];
}

function generateAxisBreakTicks(
    minValue: number,
    axisBreak: AxisBreakConfig,
) {
    if (!Number.isFinite(minValue)) {
        return undefined;
    }

    const ticks = new Set<number>();

    ticks.add(minValue);
    const lowerRange = axisBreak.breakStart - minValue;

    if (lowerRange > 0) {
        const segments = 3;
        for (let index = 1; index < segments; index += 1) {
            const tickValue = minValue + (lowerRange * index) / segments;
            if (tickValue > minValue && tickValue < axisBreak.breakStart) {
                ticks.add(tickValue);
            }
        }
    }

    ticks.add(axisBreak.breakStart);
    ticks.add(axisBreak.maxValue);

    return Array.from(ticks)
        .sort((a, b) => a - b)
        .map((tick) => axisBreak.forward(tick));
}

function AxisBreakIndicator({ axisBreak }: { axisBreak: AxisBreakConfig }) {
    const plotArea = usePlotArea();
    const yScale = useYAxisScale();
    const yCoord = yScale?.(axisBreak.forward(axisBreak.breakStart));

    if (!plotArea || yCoord === undefined || !Number.isFinite(yCoord)) {
        return null;
    }

    const indicatorX = plotArea.x + 6;
    const slashWidth = 6;
    const slashGap = 8;
    const slashHeight = 6;
    const secondSlashStartX = indicatorX + slashGap;
    const secondSlashEndX = secondSlashStartX + slashWidth;
    const upperY = yCoord - slashHeight;
    const lowerY = yCoord + slashHeight;

    return (
        <g pointerEvents="none">
            <path
                d={`M${indicatorX},${upperY} L${indicatorX + slashWidth},${lowerY}`}
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeLinecap="round"
            />
            <path
                d={`M${secondSlashStartX},${upperY} L${secondSlashEndX},${lowerY}`}
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeLinecap="round"
            />
            <text x={secondSlashEndX + 4} y={yCoord + 4} fill="var(--muted-foreground)" fontSize={10}>
                축 생략
            </text>
        </g>
    );
}

function ChartCompanyMarketcap({ data, formatTooltip, selectedType = "시가총액 구성", selectedSecurityId, series = [] }: Props) {
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
            "var(--foreground)", // Very dark gray - 총합계 (기본)
            "var(--chart-3)", // Dark gray - 보통주 (기본)
            "var(--muted-foreground)", // Medium gray - 우선주 (기본)
            "color-mix(in srgb, var(--foreground) 75%, var(--background))", // Light gray - 기타
            "color-mix(in srgb, var(--foreground) 85%, var(--background))", // Lighter gray - 기타
        ];

        // 선택시 브랜드 컬러 (한국 금융 표준)
        const accentColors = {
            "시가총액 구성": "var(--brand-ink)", // 브랜드 주황색 - 총합계 강조
            "보통주": "var(--market-up)",        // 한국 상승 빨간색 - 보통주 강조
            "우선주": "var(--market-down)"         // 한국 하락 파란색 - 우선주 강조
        };

        return { base: baseColors, accent: accentColors };
    }, []);

    // 🎯 선택된 타입에 따른 동적 컬러 결정 (개선된 버전)
    const getLineColor = (key: string, index: number) =>
      getMarketcapSelectionColor(key, series, selectedSecurityId, selectedType) ?? colors.base[index % colors.base.length];

    // 🎯 선택된 타입에 따른 라인 스타일 결정 함수 (개선)
    const getLineStyle = (key: string) => {
        const isHighlighted = shouldHighlightLine(key, selectedType);

        return {
            strokeWidth: isHighlighted ? 3 : 1.5, // 더 미묘한 차이
            strokeOpacity: isHighlighted ? 1 : 0.75, // 배경 라인을 더 연하게
            strokeDasharray: undefined, // 패턴은 getStrokePattern에서 처리
        };
    };

    const getActiveDotProps = (key: string, index: number) => {
        const color = getLineColor(key, index);
        const isHighlighted = shouldHighlightLine(key, selectedType);
        const baseRadius = isMobile ? 4 : 5;
        return {
            r: isHighlighted ? baseRadius + 1 : baseRadius,
            stroke: color,
            strokeWidth: isHighlighted ? 2 : 1.5,
            fill: 'var(--background)',
        };
    };

    // 🔍 라인을 강조할지 결정하는 함수 (최적화)
    const shouldHighlightLine = (key: string, type: string) =>
      isMarketcapSeriesSelected(key, series, selectedSecurityId, type);

    // 📈 라인 패턴 설정 (더 간단하게)
    const getStrokePattern = (key: string) => {
        if (key === "총합계" || key === "totalValue") return "0"; // 실선
        if (key.includes("보통주")) return "0"; // 실선
        if (key.includes("우선주")) return "0"; // 실선
        return "0"; // 모든 라인을 실선으로 (더 깔끔함)
    };

    const sortedData = useMemo(() => {
        if (!Array.isArray(data)) {
            return [] as typeof data;
        }

        return [...data].sort((a, b) => (a.date < b.date ? -1 : 1));
    }, [data]);

    const lineKeys = useMemo(() => {
        if (!sortedData.length) {
            return [] as string[];
        }

        return [...new Set(sortedData.flatMap(item => Object.keys(item)))].filter((key) => key !== "date" && key !== "value");
    }, [sortedData]);
    const seriesStats = useMemo(
        () => computeSeriesStats(sortedData, lineKeys),
        [sortedData, lineKeys]
    );

    const axisBreak = useMemo(
        () => createAxisBreakConfig(seriesStats),
        [seriesStats]
    );

    const transformedData = useMemo(
        () => transformChartData(sortedData, lineKeys, axisBreak),
        [sortedData, lineKeys, axisBreak]
    );

    const yAxisDomain = useMemo(
        () => computeYAxisDomain(transformedData, lineKeys),
        [transformedData, lineKeys]
    );

    const minActualValue = useMemo(
        () => {
            if (!seriesStats.length) {
                return Number.NaN;
            }

            const minima = seriesStats
                .map((stat) => stat.min)
                .filter((value) => typeof value === "number" && Number.isFinite(value));

            if (!minima.length) {
                return Number.NaN;
            }

            return Math.min(0, ...minima);
        },
        [seriesStats]
    );

    const yAxisTicks = useMemo(
        () => (axisBreak ? generateAxisBreakTicks(minActualValue, axisBreak) : undefined),
        [axisBreak, minActualValue]
    );

    const formatTickValue = (value: number) => {
        if (!axisBreak) {
            return formatNumberCompactForChart(value);
        }

        const originalValue = axisBreak.inverse(value);
        return formatNumberCompactForChart(originalValue);
    };

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[250px] sm:h-[280px] md:h-[320px] lg:h-[350px] xl:h-[380px] bg-muted rounded-lg border border-dashed border-border">
                <div className="text-center space-y-3">
                    <div className="w-16 h-16 mx-auto bg-background rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">차트 데이터 없음</p>
                        <p className="text-xs text-muted-foreground">시가총액 데이터가 없습니다</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isClient || !data || data.length === 0) {
        return (
            <div className="w-full h-[250px] sm:h-[280px] md:h-[320px] lg:h-[350px] xl:h-[380px] flex items-center justify-center">
                <div className="text-sm text-muted-foreground">
                    {!isClient ? "차트 로딩 중..." : "차트 데이터가 없습니다"}
                </div>
            </div>
        );
    }

    return (
        <div className="min-w-0 w-full h-[250px] sm:h-[280px] md:h-[320px] lg:h-[350px] xl:h-[380px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={250}>
                <LineChart
                    data={transformedData}
                    margin={{
                        top: 8,   // 5 -> 8로 조금 증가 (범례와의 여백)
                        right: 12, // 10 -> 12로 조금 증가
                        left: 8,   // 5 -> 8로 조금 증가
                        bottom: 10, // 12 -> 10으로 더 줄임 (더 타이트하게)
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(value) => {
                            const date = new Date(value);
                            return formatDateKorean(date, { year: 'numeric', month: 'short', day: 'numeric' });
                        }}
                        stroke="var(--muted-foreground)"

                        fontSize={12}
                        tick={{ fill: 'var(--muted-foreground)' }}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickLine={{ stroke: 'var(--border)' }}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        domain={yAxisDomain}
                        tickFormatter={formatTickValue}
                        stroke="var(--muted-foreground)"

                        fontSize={12}
                        tick={{ fill: 'var(--muted-foreground)' }}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickLine={{ stroke: 'var(--border)' }}
                        width={40} // 50 -> 40으로 더 줄임 (Y축과 카드 경계 가까이)
                        ticks={yAxisTicks}
                    />
                    <Tooltip
                        content={<CustomTooltip formatTooltip={formatTooltip} series={series} />}
                        isAnimationActive={false}
                    />
                    <Legend
                        itemSorter={(entry) => lineKeys.indexOf(String(entry.value))}
                        content={<CustomLegend payload={lineKeys.map((key, index) => ({ value: key, type: 'line', color: getLineColor(key, index) }))} selectedType={selectedType} selectedSecurityId={selectedSecurityId} series={series} />}
                        wrapperStyle={{
                            paddingTop: '2px', // 0px -> 2px로 약간 증가
                            position: 'relative',
                            marginTop: '-6px', // -8px -> -6px로 약간 완화
                        }}
                    />
                    {lineKeys.map((key, index) => {
                        const lineStyle = getLineStyle(key);

                        return (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={getLineColor(key, index)}
                                strokeWidth={lineStyle.strokeWidth}
                                strokeOpacity={lineStyle.strokeOpacity}
                                strokeDasharray={getStrokePattern(key)}
                                dot={false}
                                activeDot={getActiveDotProps(key, index)}
                            />
                        );
                    })}
                    {axisBreak && <AxisBreakIndicator axisBreak={axisBreak} />}
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
    series?: readonly MarketcapSeries[];
}

function CustomTooltip({ active, payload, formatTooltip, series = [] }: CustomTooltipProps) {
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


    // 🔄 중복 데이터 필터링 (payload 기반)
    const filteredEntries = (payload && payload.length > 0) ? (payload || []).reduce((acc, entry) => {
        if (entry.dataKey === "value") {
            return acc;
        }


        // 같은 데이터 키만 중복 제거 (첫 번째 것만 유지)
        if (!acc.some(item => item.dataKey === entry.dataKey)) {
            acc.push(entry);
        }

        return acc;
    }, [] as typeof payload) : [];

    return (
        <div className="bg-popover p-2.5 rounded-lg shadow-lg border border-border min-w-32">
            <div className="text-xs font-medium text-foreground mb-1.5">
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
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {getMarketcapSeriesLabel(entry.dataKey, series)}
                            </span>
                        </div>
                        <span className="text-xs font-medium text-foreground text-right">
                            {(() => {
                                const originalValueKey = `__original__${entry.dataKey}`;
                                const originalValue = entry.payload?.[originalValueKey];
                                const resolvedValue = (typeof originalValue === 'number' && Number.isFinite(originalValue))
                                    ? originalValue
                                    : (typeof entry.value === 'number' && Number.isFinite(entry.value)
                                        ? entry.value
                                        : null);
                                return formatTooltipFunction(resolvedValue, formatTooltip);
                            })()}
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
    }>;
    selectedType?: string;
    selectedSecurityId?: string;
    series?: readonly MarketcapSeries[];
}

function CustomLegend({ payload, selectedType, selectedSecurityId, series = [] }: CustomLegendProps) {
    if (!payload || !payload.length) return null;

    // 🔄 중복 제거
    const uniqueEntries = (payload && payload.length > 0) ? (payload || []).reduce((acc, entry) => {

        if (entry.value === "value") {
            return acc;
        }

        // 같은 데이터 키만 중복 제거
        if (!acc.some(item => item.value === entry.value)) {
            acc.push(entry);
        }

        return acc;
    }, [] as typeof payload) : [];

    return (
        <div className="flex flex-wrap justify-center gap-4">  {/* mt-1 제거 */}
            {uniqueEntries.map((entry) => (
                <div key={entry.value} className="flex items-center gap-1.5">
                    <div
                        className="w-4 h-0.5 rounded"
                        style={{ backgroundColor: entry.color }}
                    />
                    {(() => {
                        const label = getMarketcapSeriesLabel(entry.value, series);
                        const isHighlighted = isMarketcapSeriesSelected(entry.value, series, selectedSecurityId, selectedType);

                        return (
                            <span
                                className={`text-xs ${isHighlighted ? 'font-semibold' : 'text-muted-foreground'}`}
                                style={isHighlighted ? { color: entry.color } : undefined}
                            >
                                {label}
                            </span>
                        );
                    })()}
                </div>
            ))}
        </div>
    );
}

function formatTooltipFunction(value: number | null | undefined, formatType: string) {
    if (value == null || Number.isNaN(value)) {
        return "—";
    }

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
