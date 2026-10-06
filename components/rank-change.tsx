import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { rankMovement } from "@/lib/ranking-view";

export type Props = {
  priorRank: number | null | undefined;
  currentRank: number | null | undefined;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  variant?: "default" | "compact";
};

/** Ranking movement is neutral and separate from the stock's price change. */
export default function RankChange({ priorRank, currentRank, size = "sm", showIcon = true }: Props) {
  const movement = rankMovement(currentRank, priorRank);
  if (movement == null) return null;
  const iconSize = { sm: 11, md: 13, lg: 15 }[size];
  const label = movement === 0 ? "순위 유지" : `${Math.abs(movement).toLocaleString("ko-KR")}계단 ${movement > 0 ? "상승" : "하락"}`;
  return (
    <span className={cn("inline-flex items-center justify-center gap-0.5 font-normal tabular-nums text-muted-foreground", { sm: "text-xs", md: "text-sm", lg: "text-base" }[size])}
      aria-label={`이전 ${priorRank}위 → 현재 ${currentRank}위 · ${label}`} title="이전 순위 대비 · 주가 등락과 별개">
      {movement === 0 ? "유지" : <>{showIcon && (movement > 0 ? <ArrowUp size={iconSize} aria-hidden="true" /> : <ArrowDown size={iconSize} aria-hidden="true" />)}<span aria-hidden="true">{Math.abs(movement).toLocaleString("ko-KR")}</span></>}
    </span>
  );
}
