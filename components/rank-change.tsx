import { TrendingUp, TrendingDown, Equal } from "lucide-react";
import { cn } from "@/lib/utils";

export type Props = {
  priorRank: number | null | undefined;
  currentRank: number | null | undefined;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  variant?: "default" | "compact";
};

/**
 * RankChange component displays rank changes with CD3 color system
 * Green (success) for rank improvement, Red (danger) for rank decrease
 */
function RankChange({
  priorRank,
  currentRank,
  size = "sm",
  showIcon = true,
  variant = "default"
}: Props) {
  // Handle null/undefined values and ensure we have valid numbers
  if (
    priorRank == null ||
    currentRank == null ||
    isNaN(priorRank) ||
    isNaN(currentRank)
  ) {
    return null;
  }

  // Calculate rank change (positive = rank improved, negative = rank decreased)
  const value = priorRank - currentRank;

  // No change
  if (value === 0) {
    return null;
  }

  const isImproved = value > 0; // 순위가 올라감 (숫자가 작아짐)
  const absValue = Math.abs(value);

  // CD3 색상 시스템 적용
  const colorClass = isImproved
    ? "text-primary" // 순위 상승: #FF0054 (CD3 상승 색상)
    : "text-destructive"; // 순위 하락: #390099 (CD3 하락 색상)

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16
  };

  const getIcon = () => {
    if (!showIcon) return null;

    if (isImproved) {
      return <TrendingUp size={iconSize[size]} className="text-primary" />;
    } else {
      return <TrendingDown size={iconSize[size]} className="text-destructive" />;
    }
  };

  const formatValue = (val: number) => {
    if (variant === "compact") {
      return val > 999 ? "999+" : val.toString();
    }
    return val.toString();
  };

  return (
    <div className={cn(
      "inline-flex items-center gap-1",
      sizeClasses[size],
      colorClass,
      "font-medium"
    )}>
      {getIcon()}
      <span className="tabular-nums">
        {isImproved ? "+" : "-"}{formatValue(absValue)}
      </span>
    </div>
  );
}

export default RankChange;
