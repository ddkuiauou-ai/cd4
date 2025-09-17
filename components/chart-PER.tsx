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
  ReferenceLine,
  Legend,
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
      <div className="mt-5 w-full space-y-3">
        {/* 범례는 데이터가 없어도 표시 */}
        <CustomLegend />
        
        <div className="w-full h-[220px] sm:h-[260px] md:h-[300px] lg:h-[340px] xl:h-[380px] flex items-center justify-center">
          <div className="text-sm text-gray-500">
            {!isClient ? "차트 로딩 중..." : "차트 데이터가 없습니다"}
          </div>
        </div>
      </div>
    );
  }

  const keys = Object.keys(data[0]);
  // reoder by date in inputValues
  data.sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <div className="mt-5 w-full space-y-3">
      {/* 📊 범례를 차트 상단에 배치 */}
      <CustomLegend />
      
      <div className="w-full h-[220px] sm:h-[260px] md:h-[300px] lg:h-[340px] xl:h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
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
          
          {/* 📊 PER 기준선 */}
          <ReferenceLine 
            y={10} 
            stroke="#0066CC" 
            strokeDasharray="3 3" 
            strokeOpacity={0.7}
          />
          <ReferenceLine 
            y={20} 
            stroke="#D60000" 
            strokeDasharray="3 3" 
            strokeOpacity={0.7}
          />

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
            tickFormatter={(date) => {
              const year = new Date(date).getFullYear();
              // 5년 단위로만 표시하거나 특별한 연도만 표시
              return year % 5 === 0 ? `${year}` : '';
            }}
            tick={{ fill: '#666666', fontSize: 12 }}
            className="text-xs"
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => {
              // PER 값에 맞는 포맷 (소수점 1자리까지)
              return typeof value === 'number' ? `${value.toFixed(1)}` : value;
            }}
            tick={{ fill: '#666666', fontSize: 12 }}
            tickMargin={8}
            className="text-xs"
            domain={['dataMin - 5%', 'dataMax + 10%']}
            width={45}
          />
          <Tooltip
            content={<CustomTooltip formatTooltip={formatTooltip} />}
            position={{ y: -54 }}
            isAnimationActive={false}
          />
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#E5E5E5" 
            className="dark:opacity-30" 
            strokeOpacity={0.5} 
            vertical={false} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
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
  const perValue = data.totalValue || data.value;

  // PER 평가 구간 결정
  const getPerEvaluation = (per: number) => {
    if (per < 10) return { text: "저평가", color: "#0066CC" };
    if (per <= 20) return { text: "적정", color: "#666666" };
    return { text: "고평가", color: "#D60000" };
  };

  const evaluation = typeof perValue === 'number' ? getPerEvaluation(perValue) : null;

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 space-y-2">
      <div className="font-medium text-foreground border-b border-border pb-2">
        {new Date(data.date).getFullYear()}년
      </div>
      {Object.entries(data).map(
        ([key, value]) =>
          key !== "date" && (
            <div key={key} className="flex justify-between items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {key === "totalValue" || key === "value" ? "PER" : key}:
              </span>
              <span className="font-medium text-foreground">
                {formatTooltipFunction(value as number, formatTooltip)}
              </span>
            </div>
          )
      )}
      
      {/* PER 평가 구간 표시 */}
      {evaluation && (
        <div className="pt-2 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">평가:</span>
            <span 
              className="text-xs font-medium px-2 py-1 rounded"
              style={{ 
                backgroundColor: evaluation.color + '20', 
                color: evaluation.color 
              }}
            >
              {evaluation.text}
            </span>
          </div>
        </div>
      )}
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

// 📊 커스텀 범례 컴포넌트
function CustomLegend() {
  return (
    <div className="flex flex-wrap justify-center gap-4 px-4 py-2 bg-gray-50/50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* PER 라인 */}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-0.5 bg-black dark:bg-white rounded"></div>
        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">PER</span>
      </div>
      
      {/* 저평가 기준선 */}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-0.5 border-b border-dashed border-blue-600"></div>
        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">저평가 (10↓)</span>
      </div>
      
      {/* 고평가 기준선 */}
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-0.5 border-b border-dashed border-red-600"></div>
        <span className="text-xs text-red-600 dark:text-red-400 font-medium">고평가 (20↑)</span>
      </div>
    </div>
  );
}

export default ChartPER;
