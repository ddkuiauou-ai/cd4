"use client";

import { useMemo, useState, useEffect } from "react";
import {
  formatNumberRaw,
  formatNumberTooltip,
  formatNumberRatio,
  formatNumberPercent,
  formatNumberForChart,
  formatNumberRawForChart,
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

// 라벨 간소화 함수
const getSimplifiedLabel = (key: string): string => {
  if (key === "총합계" || key === "totalValue") {
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

function ChartMarketcap({ data, format, formatTooltip, selectedType = "시가총액 구성" }: Props) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // 🛡️ 데이터 안전성 검증
  const safeData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }
    return data.filter(item => item && typeof item === 'object' && item.date);
  }, [data]);

  // 빈 데이터 처리
  if (safeData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>차트 데이터가 없습니다</p>
      </div>
    );
  }

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

  // 🎯 선택된 타입에 따른 동적 컬러 결정
  const getLineColor = (key: string, index: number) => {
    // 선택된 타입에 해당하는 라인만 컬러로 강조
    if (selectedType === "시가총액 구성" && (key === "총합계" || key === "totalValue")) {
      return colors.accent["시가총액 구성"];
    }
    if (selectedType === "보통주" && key.includes("보통주")) {
      return colors.accent["보통주"];
    }
    if (selectedType === "우선주" && key.includes("우선주")) {
      return colors.accent["우선주"];
    }

    // 기본: 그레이스케일 유지
    return colors.base[index % colors.base.length];
  };

  // 📊 라인 스타일 결정 함수 (선택적 강조)
  const getLineStyle = (key: string) => {
    const isHighlighted = shouldHighlightLine(key, selectedType);

    return {
      strokeWidth: isHighlighted ? 3 : 1.5, // 더 미묘한 차이
      strokeOpacity: isHighlighted ? 1 : 0.4, // 배경 라인을 더 연하게
    };
  };

  const getActiveDotProps = (key: string, index: number) => {
    const color = getLineColor(key, index);
    const isHighlighted = shouldHighlightLine(key, selectedType);

    return {
      r: isHighlighted ? 6 : 5,
      stroke: color,
      strokeWidth: isHighlighted ? 2 : 1.5,
      fill: '#ffffff',
    };
  };

  // 🎯 라인 강조 여부 결정 함수
  const shouldHighlightLine = (key: string, selectedType: string) => {
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

  // 📈 라인 패턴 결정 함수 (더 간단하게)
  const getStrokePattern = (key: string) => {
    if (key === "총합계" || key === "totalValue") return "0"; // 실선
    if (key.includes("보통주")) return "0"; // 실선 (어노테이션 강조)
    if (key.includes("우선주")) return "0"; // 실선 (어노테이션 강조)
    return "0"; // 모든 라인을 실선으로 (더 깔끔함)
  };

  // 📊 데이터 키 추출
  const keys = useMemo(() => {
    if (!data.length) return [];
    return Object.keys(data[0]).filter(key => key !== "date");
  }, [data]);

  // 📊 Y축 도메인 계산 (데이터 범위에 맞게 조정)
  const getYAxisDomain = () => {
    if (!data.length || !keys.length) return [0, 100];

    let minValue = Infinity;
    let maxValue = -Infinity;

    data.forEach(item => {
      keys.forEach(key => {
        // "date"와 "value" 키는 제외
        if (key !== "date" && key !== "value") {
          const value = (item as any)[key];
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

  // reoder by date in inputValues
  data.sort((a, b) => (a.date < b.date ? -1 : 1));

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
          data={safeData}
          margin={{ top: 8, right: 12, left: 8, bottom: 10 }}
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
            tickFormatter={
              format === "formatNumber" ? formatNumberForChart : formatNumberRawForChart
            }
            stroke="#666666"
            className="dark:stroke-gray-400"
            fontSize={12}
            tick={{ fill: '#666666', className: 'dark:fill-gray-400' }}
            axisLine={{ stroke: '#E5E5E5', className: 'dark:stroke-gray-600' }}
            tickLine={{ stroke: '#E5E5E5', className: 'dark:stroke-gray-600' }}
            width={40} // 50 -> 40으로 더 줄임
          />
          <Tooltip
            content={<CustomTooltip formatTooltip={formatTooltip} selectedType={selectedType} />}
            isAnimationActive={false}
          />
          <Legend
            content={<CustomLegend payload={keys.filter(key => key !== "date" && key !== "value").map((key, index) => ({ value: key, type: 'line', color: getLineColor(key, index) }))} selectedType={selectedType} />}
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
                dot={false}
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
      return dateStr.replace(/-/g, '.');
    }
  };

  // 🔄 중복 데이터 필터링 (payload 기반)
  const filteredEntries = (payload && payload.length > 0) ? (payload || []).reduce((acc, entry) => {
    const label = getSimplifiedLabel(entry.dataKey);

    // "value" 키는 제외 (totalValue와 중복됨)
    if (entry.dataKey === "value") {
      return acc;
    }

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
  selectedType?: string;
}

function CustomLegend({ payload, selectedType }: CustomLegendProps) {
  if (!payload || !payload.length) return null;

  // 🔄 중복 제거 및 불필요한 항목 필터링
  const uniqueEntries = (payload && payload.length > 0) ? (payload || []).reduce((acc, entry) => {
    const simplifiedLabel = getSimplifiedLabel(entry.value);

    // "value" 키는 제외 (totalValue와 중복됨)
    if (entry.value === "value") {
      return acc;
    }

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
          {(() => {
            const label = getSimplifiedLabel(entry.value);
            const isHighlighted = (() => {
              if (!selectedType) return false;
              if (selectedType === "시가총액 구성") {
                return label === "전체 시총";
              }
              return label === selectedType;
            })();

            return (
              <span
                className={`text-xs ${isHighlighted ? 'font-semibold' : 'text-gray-600 dark:text-gray-400'}`}
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
