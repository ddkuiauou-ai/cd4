"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface KeyMetricsSidebarDPSProps {
    dpsRank: number | null;
    latestDPS: number | null;
    dps12Month: number | null;
    dps3Year: number | null;
    dps5Year: number | null;
    dps10Year: number | null;
    dps20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    currentPrice: number | null;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebarDPS({
    dpsRank,
    latestDPS,
    dps12Month,
    dps3Year,
    dps5Year,
    dps10Year,
    dps20Year,
    rangeMin,
    rangeMax,
    currentPrice,
    onCollapsedChange,
}: KeyMetricsSidebarDPSProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    // 세션 스토리지에서 접기 상태 불러오기
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = sessionStorage.getItem('key-metrics-collapsed');
            if (stored !== null) {
                const storedCollapsed = JSON.parse(stored);
                setIsCollapsed(storedCollapsed);
                onCollapsedChange?.(storedCollapsed);
            }
        }
    }, [onCollapsedChange]);

    const handleToggle = () => {
        const newCollapsed = !isCollapsed;
        setIsCollapsed(newCollapsed);

        // 세션 스토리지에 상태 저장
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('key-metrics-collapsed', JSON.stringify(newCollapsed));
        }

        onCollapsedChange?.(newCollapsed);
    };

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
                className={`flex items-center justify-between text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors w-full ${isCollapsed ? 'py-2 px-0 gap-1' : 'py-2 mb-3 gap-2'
                    }`}
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
                        <span className="text-muted-foreground">DPS 랭킹</span>
                        <span className="font-medium">{dpsRank ? `${dpsRank}위` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">현재 DPS</span>
                        <span className="font-medium">{latestDPS ? `${latestDPS.toFixed(0)}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">현재 주가</span>
                        <span className="font-medium">{currentPrice ? `${currentPrice.toLocaleString()}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">12개월 평균</span>
                        <span className="font-medium">{dps12Month ? `${dps12Month.toFixed(0)}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">3년 평균</span>
                        <span className="font-medium">{dps3Year ? `${dps3Year.toFixed(0)}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">5년 평균</span>
                        <span className="font-medium">{dps5Year ? `${dps5Year.toFixed(0)}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">10년 평균</span>
                        <span className="font-medium">{dps10Year ? `${dps10Year.toFixed(0)}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">20년 평균</span>
                        <span className="font-medium">{dps20Year ? `${dps20Year.toFixed(0)}원` : "—"}</span>
                    </div>

                    <hr className="my-3" />

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">DPS 범위</span>
                        <span className="font-medium text-xs">
                            {rangeMin && rangeMax ? `${rangeMin.toFixed(0)}원 ~ ${rangeMax.toFixed(0)}원` : "—"}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
