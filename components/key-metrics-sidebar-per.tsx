"use client";

import { useEffect } from "react";
import { useCollapsedState } from "@/hooks/use-collapsed-state";
import { ChevronDown, ChevronUp } from "lucide-react";

interface KeyMetricsSidebarPERProps {
    perRank: number | null;
    latestPER: number | null;
    per12Month: number | null;
    per3Year: number | null;
    per5Year: number | null;
    per10Year: number | null;
    per20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    currentPrice: number | null;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebarPER({
    perRank,
    latestPER,
    per12Month,
    per3Year,
    per5Year,
    per10Year,
    per20Year,
    rangeMin,
    rangeMax,
    currentPrice,
    onCollapsedChange,
}: KeyMetricsSidebarPERProps) {
    const [isCollapsed, handleToggle] = useCollapsedState('key-metrics-collapsed', false);

    // 상태 변경 시 부모 컴포넌트에 알림
    useEffect(() => {
        onCollapsedChange?.(isCollapsed);
    }, [isCollapsed, onCollapsedChange]);

    return (
        <div className={`${isCollapsed ? 'bg-background px-2 py-0 mb-0' : 'rounded-xl border bg-background p-4 mb-6'}`}>
            <button
                onClick={handleToggle}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
                className={`flex items-center justify-between text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors w-full ${isCollapsed ? 'py-2 px-0 gap-1' : 'py-2 mb-3 gap-2'}`}
                aria-expanded={!isCollapsed}
                aria-controls="key-metrics-content"
                aria-label={`핵심 지표 ${isCollapsed ? '펼치기' : '접기'}`}
            >
                <span>핵심 지표</span>
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>

            {!isCollapsed && (
                <div id="key-metrics-content" className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">PER 랭킹</span>
                        <span className="font-medium">{perRank ? `${perRank}위` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">현재 PER</span>
                        <span className="font-medium">{latestPER ? `${latestPER.toFixed(2)}배` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">현재 주가</span>
                        <span className="font-medium">{currentPrice ? `${currentPrice.toLocaleString()}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">12개월 평균</span>
                        <span className="font-medium">{per12Month ? `${per12Month.toFixed(2)}배` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">3년 평균</span>
                        <span className="font-medium">{per3Year ? `${per3Year.toFixed(2)}배` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">최저 PER</span>
                        <span className="font-medium">{rangeMin ? `${rangeMin.toFixed(2)}배` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">최고 PER</span>
                        <span className="font-medium">{rangeMax ? `${rangeMax.toFixed(2)}배` : "—"}</span>
                    </div>
                </div>
            )}
        </div>
    );
}