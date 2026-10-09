"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  formatNumberRaw,
  formatNumberTooltip,
  formatNumberRatio,
  formatNumberPercent,
  formatNumberForChart,
  formatNumberRawForChart,
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
} from "recharts";

import { getMarketcapSeriesLabel, getMarketcapSelectionColor, isMarketcapSeriesSelected, type MarketcapSeries } from "@/lib/chart-selection";

const subscribeMounted = () => () => {};

type MarketcapDataPoint = {
  date: string;
  totalValue?: number;
  [key: string]: string | number | boolean | null | undefined;
};

import { formatBusinessValue, type BusinessValue } from "@/lib/business-analysis";

type SourceValues = Record<string, Record<string, BusinessValue>>;
type Coverage = Record<string, { observedCount: number; targetCount: number }>;
type Props = {
  sourceValues?: SourceValues;
  coverage?: Coverage;
  totalLabel?: string;
  axisFormat?: (value: number) => string;
  data: MarketcapDataPoint[];
  format: string;
  formatTooltip: string;
  selectedType?: string; // 선택된 종목 타입 (보통주, 우선주, 시가총액 구성)
  selectedSecurityId?: string;
  series?: readonly MarketcapSeries[];
};


function ChartMarketcap({ data, format, formatTooltip, selectedType = "시가총액 구성", selectedSecurityId, series = [], sourceValues, coverage, totalLabel = "전체 시총", axisFormat }: Props) {
  const isClient = useSyncExternalStore(subscribeMounted, () => true, () => false);

  // 🛡️ 데이터 안전성 검증
  const safeData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }
    return data
      .filter(item => item && typeof item === 'object' && item.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

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

  // 🎯 선택된 타입에 따른 동적 컬러 결정
  const getLineColor = (key: string, index: number) =>
    getMarketcapSelectionColor(key, series, selectedSecurityId, selectedType) ?? colors.base[index % colors.base.length];

  // 📊 라인 스타일 결정 함수 (선택적 강조)
  const getLineStyle = (key: string) => {
    const isHighlighted = shouldHighlightLine(key, selectedType);

    return {
      strokeWidth: isHighlighted ? 3 : 1.5, // 더 미묘한 차이
      strokeOpacity: isHighlighted ? 1 : 0.75, // 배경 라인을 더 연하게
    };
  };

  const getActiveDotProps = (key: string, index: number) => {
    const color = getLineColor(key, index);
    const isHighlighted = shouldHighlightLine(key, selectedType);

    return {
      r: isHighlighted ? 6 : 5,
      stroke: color,
      strokeWidth: isHighlighted ? 2 : 1.5,
      fill: 'var(--background)',
    };
  };

  // 🎯 라인 강조 여부 결정 함수
  const shouldHighlightLine = (key: string, type: string) =>
    isMarketcapSeriesSelected(key, series, selectedSecurityId, type);

  // 📈 라인 패턴 결정 함수 (더 간단하게)
  const getStrokePattern = (key: string) => {
    if (key === "총합계" || key === "totalValue") return "0"; // 실선
    if (key.includes("보통주")) return "0"; // 실선 (어노테이션 강조)
    if (key.includes("우선주")) return "0"; // 실선 (어노테이션 강조)
    return "0"; // 모든 라인을 실선으로 (더 깔끔함)
  };

  // 📊 데이터 키 추출
  const keys = useMemo(() => {
    if (!safeData.length) return [];
    return [...new Set(safeData.flatMap(item => Object.keys(item)))].filter(key => key !== "date");
  }, [safeData]);

  // 📊 Y축 도메인 계산 (데이터 범위에 맞게 조정)
  const getYAxisDomain = () => {
    if (!safeData.length || !keys.length) return [0, 100];

    let minValue = Infinity;
    let maxValue = -Infinity;

    safeData.forEach(item => {
      keys.forEach(key => {
        // "date"와 "value" 키는 제외
        if (key !== "date" && key !== "value") {
          const value = item[key];
          if (value !== null && value !== undefined && typeof value === 'number') {
            minValue = Math.min(minValue, value);
            maxValue = Math.max(maxValue, value);
          }
        }
      });
    });

    // 여백을 위해 범위를 약간 확장 (10% 패딩)
    const padding = (maxValue - minValue) * 0.1;
    const adjustedMin = Math.max(0, minValue - padding);
    const adjustedMax = maxValue + padding;

    return [adjustedMin, adjustedMax];
  };

  const yAxisDomain = getYAxisDomain();

  // 빈 데이터 처리
  if (safeData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>차트 데이터가 없습니다</p>
      </div>
    );
  }

  if (!isClient || !data || data.length === 0) {
    return (
      <div className="w-full h-[200px] sm:h-[220px] md:h-[240px] lg:h-[260px] xl:h-[280px] flex items-center justify-center">
        <div className="text-sm text-muted-foreground">
          {!isClient ? "차트 로딩 중..." : "차트 데이터가 없습니다"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full h-[200px] sm:h-[220px] md:h-[240px] lg:h-[260px] xl:h-[280px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
        <LineChart
          data={safeData}
          margin={{ top: 8, right: 12, left: 8, bottom: 10 }}
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
            domain={axisFormat ? [0,1] : yAxisDomain} ticks={axisFormat ? [0,.25,.5,.75,1] : undefined}
            tickFormatter={
              axisFormat || (format === "formatNumber" ? formatNumberForChart : formatNumberRawForChart)
            }
            stroke="var(--muted-foreground)"

            fontSize={12}
            tick={{ fill: 'var(--muted-foreground)' }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={{ stroke: 'var(--border)' }}
            width={40} // 50 -> 40으로 더 줄임
          />
          <Tooltip
            content={<CustomTooltip formatTooltip={formatTooltip} series={series} sourceValues={sourceValues} coverage={coverage} totalLabel={totalLabel} />}
            isAnimationActive={false}
          />
          <Legend
            itemSorter={(entry) => keys.indexOf(String(entry.value))}
            content={<CustomLegend payload={keys.filter(key => key !== "date" && key !== "value").map((key, index) => ({ value: key, type: 'line', color: getLineColor(key, index) }))} selectedType={selectedType} selectedSecurityId={selectedSecurityId} series={series} sourceValues={sourceValues} coverage={coverage} totalLabel={totalLabel} />}
            wrapperStyle={{
              paddingTop: '2px', // 2px -> 2px 유지
              position: 'relative',
              marginTop: '-6px', // -8px -> -6px로 약간 완화
            }}
          />
          {keys.map((key, index) => {
            if (key === "date" || key === "value") {
              return null;
            }

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
                dot={safeData.length === 1}
                activeDot={getActiveDotProps(key, index)}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// 📊 커스텀 툴팁 컴포넌트
interface CustomTooltipProps {
  sourceValues?: SourceValues; coverage?: Coverage; totalLabel?: string;
  active?: boolean;
  payload?: Array<{
    color: string;
    dataKey: string;
    payload: {
      date: string;
      [key: string]: string | number | boolean | null | undefined;
    };
    value: number;
  }>;
  formatTooltip: string;
  series?: readonly MarketcapSeries[];
}

function CustomTooltip({ active, payload, formatTooltip, series = [], sourceValues, coverage, totalLabel = "전체 시총" }: CustomTooltipProps) {
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
      return dateStr.replace(/-/g, '.');
    }
  };

  // 🔄 중복 데이터 필터링 (payload 기반)
  const filteredEntries = (payload && payload.length > 0) ? (payload || []).reduce((acc, entry) => {

    // "value" 키는 제외 (totalValue와 중복됨)
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
        {coverage?.[data.date] && <p className="text-xs text-muted-foreground">{coverage[data.date].observedCount}/{coverage[data.date].targetCount}개 관측</p>}
                {series.filter(item => sourceValues?.[data.date] && sourceValues[data.date][item.key] == null).map(item => <p key={item.key} className="text-xs text-muted-foreground">{item.label}: — (미관측)</p>)}
        {filteredEntries.map((entry) => (
          <div key={entry.dataKey} className="flex justify-between items-center gap-2">
            <div className="flex items-center space-x-1.5">
              <div
                className="w-2.5 h-0.5 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {getMarketcapSeriesLabel(entry.dataKey, series, totalLabel)}
              </span>
            </div>
            <span className="text-xs font-medium text-foreground text-right">
              {sourceValues?.[data.date] ? `${formatBusinessValue(sourceValues[data.date][entry.dataKey])}원` : formatTooltipFunction(entry.value, formatTooltip)}
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
  series?: readonly MarketcapSeries[]; sourceValues?: SourceValues; coverage?: Coverage; totalLabel?: string;
}

function CustomLegend({ payload, selectedType, selectedSecurityId, series = [], totalLabel = "전체 시총" }: CustomLegendProps) {
  if (!payload || !payload.length) return null;

  // 🔄 중복 제거 및 불필요한 항목 필터링
  const uniqueEntries = (payload && payload.length > 0) ? (payload || []).reduce((acc, entry) => {

    // "value" 키는 제외 (totalValue와 중복됨)
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
            const label = getMarketcapSeriesLabel(entry.value, series, totalLabel);
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

export default ChartMarketcap;
