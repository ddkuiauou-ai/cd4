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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Props = {
  data: {
    date: string;
    totalValue?: number;
  }[];
  format: string;
  formatTooltip: string;
};

function ChartPER({ data, format, formatTooltip }: Props) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

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

  const keys = Object.keys(data[0]);
  // reoder by date in inputValues
  data.sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <div className="mt-5 w-full h-[200px] sm:h-[220px] md:h-[250px] lg:h-[280px] xl:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
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
          {keys.map(
            (key, index) =>
              key !== "date" && (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  fill={`url(#color${index % colors.length})`}
                />
              )
          )}
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tickFormatter={(date) => date.split("-")[0]}
            interval={50}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={
              format === "formatNumber" ? formatNumberForChart : formatNumberRawForChart
            }
            tickMargin={0}
            className="text-xs sm:text-base"
          />
          <Tooltip
            content={<CustomTooltip formatTooltip={formatTooltip} />}
            position={{ y: -54 }}
            isAnimationActive={false}
          />
          <CartesianGrid opacity={0.8} vertical={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

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

function CustomTooltip({ active, payload, formatTooltip }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="flex flex-col items-center justify-end">
      <div className="text-gray-500">{data.date}</div>
      <div className="font-sm text-muted-foreground">
        배당수익률: {data.totalValue ? formatTooltipFunction(Number(data.totalValue), formatTooltip) : 'N/A'}
      </div>
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

export default ChartPER;
