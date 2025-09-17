"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  formatNumber,
  formatNumberRaw,
  formatNumberTooltip,
  formatNumberRatio,
  formatNumberPercent,
  formatFunctionMapForChart,
} from "../lib/utils";

interface Props {
  data: Item[];
  format: string;
  formatTooltip: string;
}

interface Item {
  date: string;
  value: number;
}

function getLatestDecemberDates(data: Item[]): string[] {
  const lastDecDates: Record<string, string> = {};
  data.forEach(({ date }) => {
    const [year, month] = date.split("-");
    if (month === "12") {
      if (!lastDecDates[year] || date > lastDecDates[year]) {
        lastDecDates[year] = date;
      }
    }
  });
  return Object.values(lastDecDates); // Convert Record<string, string> to string[]
}

interface FormatFunctionMap {
  [key: string]: (value: number, index?: number) => string; // Fixed type signature 
}

// Use the centralized Recharts formatter map
const formatFunctionMap: FormatFunctionMap = formatFunctionMapForChart;

const ChartBPS: React.FC<Props> = ({ data, format, formatTooltip }) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const lastDatesOfDec = React.useMemo(
    () => getLatestDecemberDates(data),
    [data]
  );

  const values = React.useMemo(
    () => data.filter((item) => lastDatesOfDec.includes(item.date)),
    [data, lastDatesOfDec]
  );

  // reorder by date in values
  values.sort((a, b) => (a.date < b.date ? -1 : 1));

  // 🎨 전문적인 그레이스케일 팔레트 (레이어링 최적화)
  const colors = useMemo(() => [
    "#000000", // Black - 총합계 (배경 레이어, 가장 진하게)
    "#222222", // Very dark gray - 보통주 (중요 레이어, 더 진하게)
    "#AAAAAA", // Light gray - 우선주 (전경 레이어, 밝게)
    "#333333", // Dark gray - 기타 데이터
    "#666666", // Medium gray - 추가 데이터
    "#888888", // Medium gray - 추가 데이터
    "#CCCCCC", // Light gray - 추가 데이터
    "#DDDDDD", // Very light gray - 추가 데이터
    "#EEEEEE", // Near white - 추가 데이터
  ], []);

  if (!isClient || !data || data.length === 0) {
    return (
      <div className="w-full h-[200px] sm:h-[220px] md:h-[250px] lg:h-[280px] xl:h-[300px] flex items-center justify-center">
        <div className="text-sm text-gray-500">
          {!isClient ? "차트 로딩 중..." : "차트 데이터가 없습니다"}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 w-full h-[200px] sm:h-[220px] md:h-[250px] lg:h-[280px] xl:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={values}
          margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            {colors.map((color, index) => (
              <linearGradient
                key={`color${index}`}
                id={`color${index}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color} stopOpacity={0.9} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <Bar
            type="monotone"
            dataKey="value"
            stroke={colors[2]}
            fill={`url(#color2)`}
          />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tickFormatter={(date) => date.split("-")[0]}
            interval={5}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={formatFunctionMap[format]}
            tickMargin={0}
            className="text-xs sm:text-base"
          />
          <Tooltip
            content={<CustomTooltip formatTooltip={formatTooltip} />}
            position={{ y: -54 }}
            isAnimationActive={false}
          />
          <CartesianGrid opacity={0.8} vertical={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      date: string;
      value: number;
      [key: string]: string | number | boolean | null | undefined;
    };
  }>;
  formatTooltip: string;
}

const CustomTooltip = ({ active, payload, formatTooltip }: CustomTooltipProps) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  // Define tooltip formatter map (uses original functions, not chart formatters)
  const tooltipFormatMap = {
    formatNumber,
    formatNumberRaw,
    formatNumberTooltip,
    formatNumberRatio,
    formatNumberPercent,
  };

  return (
    <div className="flex flex-col items-center justify-end">
      <div className="text-gray-500">{data.date}</div>
      {Object.entries(data).map(
        ([key, value]) =>
          key !== "date" && (
            <div key={key} className="font-sm text-muted-foreground">
              {key === "value" ? "주당순자산가치" : key}:{" "}
              {tooltipFormatMap[formatTooltip as keyof typeof tooltipFormatMap]?.(value as number) || value}
            </div>
          )
      )}
    </div>
  );
};

export default ChartBPS;
