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

  const colors = useMemo(() => [
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--brand-ink)",
  ], []);

  if (!isClient || !data || data.length === 0) {
    return (
      <div className="w-full h-[200px] sm:h-[220px] md:h-[250px] lg:h-[280px] xl:h-[300px] flex items-center justify-center">
        <div className="text-sm text-muted-foreground">
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
                <stop offset="5%" stopColor={color} stopOpacity={0.22} />
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
            tick={{ fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(date) => date.split("-")[0]}
            interval={50}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)" }}
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
          <CartesianGrid stroke="var(--border)" vertical={false} />
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
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <div className="text-muted-foreground">{data.date}</div>
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
