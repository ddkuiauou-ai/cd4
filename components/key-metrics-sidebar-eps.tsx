"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface KeyMetricsSidebarEPSProps {
    epsRank: number | null;
    latestEPS: number | null;
    eps12Month: number | null;
    eps3Year: number | null;
    eps5Year: number | null;
    eps10Year: number | null;
    eps20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    currentPrice: number | null;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebarEPS({
    epsRank,
    latestEPS,
    eps12Month,
    eps3Year,
    eps5Year,
    eps10Year,
    eps20Year,
    rangeMin,
    rangeMax,
    currentPrice,
    onCollapsedChange,
}: KeyMetricsSidebarEPSProps) {
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
                        <span className="text-muted-foreground">EPS 랭킹</span>
                        <span className="font-medium">{epsRank ? `${epsRank}위` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">현재 EPS</span>
                        <span className="font-medium">{latestEPS ? `${latestEPS.toLocaleString()}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">현재 주가</span>
                        <span className="font-medium">{currentPrice ? `${currentPrice.toLocaleString()}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">12개월 평균</span>
                        <span className="font-medium">{eps12Month ? `${eps12Month.toLocaleString()}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">3년 평균</span>
                        <span className="font-medium">{eps3Year ? `${eps3Year.toLocaleString()}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">최저 EPS</span>
                        <span className="font-medium">{rangeMin ? `${rangeMin.toLocaleString()}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">최고 EPS</span>
                        <span className="font-medium">{rangeMax ? `${rangeMax.toLocaleString()}원` : "—"}</span>
                    </div>
                </div>
            )}
        </div>
    );
}
