"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface KeyMetricsSidebarDIVProps {
    divRank: number | null;
    latestDIV: number | null;
    div12Month: number | null;
    div3Year: number | null;
    div5Year: number | null;
    div10Year: number | null;
    div20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    currentPrice: number | null;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebarDIV({
    divRank,
    latestDIV,
    div12Month,
    div3Year,
    div5Year,
    div10Year,
    div20Year,
    rangeMin,
    rangeMax,
    currentPrice,
    onCollapsedChange,
}: KeyMetricsSidebarDIVProps) {
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
        <div className={`${isCollapsed ? 'bg-background p-2' : 'rounded-xl border bg-background p-4'}`}>
            <button
                onClick={handleToggle}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggle();
                    }
                }}
                className={`flex items-center gap-2 text-sm font-semibold text-foreground hover:text-muted-foreground transition-colors w-full justify-between ${isCollapsed ? 'py-2' : 'py-2 mb-3'
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
                        <span className="text-muted-foreground">배당률 랭킹</span>
                        <span className="font-medium">{divRank ? `${divRank}위` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">현재 배당률</span>
                        <span className="font-medium">{latestDIV ? `${latestDIV.toFixed(2)}%` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">현재 주가</span>
                        <span className="font-medium">{currentPrice ? `${currentPrice.toLocaleString()}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">12개월 평균</span>
                        <span className="font-medium">{div12Month ? `${div12Month.toFixed(2)}%` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">3년 평균</span>
                        <span className="font-medium">{div3Year ? `${div3Year.toFixed(2)}%` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">5년 평균</span>
                        <span className="font-medium">{div5Year ? `${div5Year.toFixed(2)}%` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">10년 평균</span>
                        <span className="font-medium">{div10Year ? `${div10Year.toFixed(2)}%` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">20년 평균</span>
                        <span className="font-medium">{div20Year ? `${div20Year.toFixed(2)}%` : "—"}</span>
                    </div>

                    <hr className="my-3" />

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">배당률 범위</span>
                        <span className="font-medium text-xs">
                            {rangeMin && rangeMax ? `${rangeMin.toFixed(2)}% ~ ${rangeMax.toFixed(2)}%` : "—"}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
