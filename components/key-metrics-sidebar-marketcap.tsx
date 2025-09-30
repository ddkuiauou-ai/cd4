"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatMetricValue } from "@/lib/recent-securities";

interface KeyMetricsSidebarMARKETCAPProps {
    marketcapRank: number | null;
    latestMarketcap: number | null;
    marketcap12Month: number | null;
    marketcap3Year: number | null;
    marketcap5Year: number | null;
    marketcap10Year: number | null;
    marketcap20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    currentPrice: number | null;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebarMARKETCAP({
    marketcapRank,
    latestMarketcap,
    marketcap12Month,
    marketcap3Year,
    marketcap5Year,
    marketcap10Year,
    marketcap20Year,
    rangeMin,
    rangeMax,
    currentPrice,
    onCollapsedChange,
}: KeyMetricsSidebarMARKETCAPProps) {
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
                        <span className="text-muted-foreground">시가총액 랭킹</span>
                        <span className="font-medium">{marketcapRank ? `${marketcapRank}위` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">현재 시가총액</span>
                        <span className="font-medium">{latestMarketcap ? formatMetricValue('marketcap', latestMarketcap) : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">현재 주가</span>
                        <span className="font-medium">{currentPrice ? `${currentPrice.toLocaleString()}원` : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">12개월 평균</span>
                        <span className="font-medium">{marketcap12Month ? formatMetricValue('marketcap', marketcap12Month) : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">3년 평균</span>
                        <span className="font-medium">{marketcap3Year ? formatMetricValue('marketcap', marketcap3Year) : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">5년 평균</span>
                        <span className="font-medium">{marketcap5Year ? formatMetricValue('marketcap', marketcap5Year) : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">10년 평균</span>
                        <span className="font-medium">{marketcap10Year ? formatMetricValue('marketcap', marketcap10Year) : "—"}</span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">20년 평균</span>
                        <span className="font-medium">{marketcap20Year ? formatMetricValue('marketcap', marketcap20Year) : "—"}</span>
                    </div>

                    <hr className="my-3" />

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">시가총액 범위</span>
                        <span className="font-medium text-xs">
                            {rangeMin && rangeMax ? `${formatMetricValue('marketcap', rangeMin)} ~ ${formatMetricValue('marketcap', rangeMax)}` : "—"}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
