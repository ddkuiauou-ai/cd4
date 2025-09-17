import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type Props = {
  rate: number;
  size?: "xs" | "sm" | "md" | "lg";
  showIcon?: boolean;
};

function RateDisplay({ rate, size = "md", showIcon = true }: Props) {
  const isPositive = rate > 0;
  const isNegative = rate < 0;
  const isZero = rate === 0;

  // 한국 주식 시장 색상 관례 적용
  const colorClass = isPositive
    ? "text-red-500 dark:text-red-400" // 상승: 빨간색 (한국 주식 관례)
    : isNegative
      ? "text-blue-600 dark:text-blue-400" // 하락: 파란색 (한국 주식 관례)  
      : "text-muted-foreground"; // 보합: 기본 회색

  const sizeClasses = {
    xs: "text-[11px]",
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  const iconSize = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16
  };

  const formatRate = (value: number): string => {
    if (value === 0) return "0.00%";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  };

  const getIcon = () => {
    if (!showIcon) return null;

    if (isPositive) {
      return <TrendingUp size={iconSize[size]} className="text-red-500 dark:text-red-400" />;
    } else if (isNegative) {
      return <TrendingDown size={iconSize[size]} className="text-blue-600 dark:text-blue-400" />;
    } else {
      return <Minus size={iconSize[size]} className="text-muted-foreground" />;
    }
  };

  return (
    <div className={cn(
      "inline-flex items-center gap-1",
      sizeClasses[size],
      colorClass,
      "font-medium"
    )}>
      {getIcon()}
      <span>{formatRate(rate)}</span>
    </div>
  );
}

export default RateDisplay;
