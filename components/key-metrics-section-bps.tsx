"use client";

import type { CSSProperties } from "react";
import { useMemo, memo } from "react";
import { TrendingUp } from "lucide-react";

interface KeyMetricsSectionBPSProps {
    security: {
        prices?: Array<{ close?: number }>;
    };
    bpsRank: number | null;
    latestBPS: number | null;
    bps12Month: number | null;
    bps3Year: number | null;
    bps5Year: number | null;
    bps10Year: number | null;
    bps20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    result: Array<{ date: string; value: number }>;
}

const DEFAULT_BACKGROUND: CSSProperties = {};

const EDGE_TO_EDGE_SECTION_CLASS = "detail-section space-y-5 border-t border-border py-6 sm:py-8";

const MARQUEE_CARD_CLASS = "min-w-0 space-y-2 border-b border-border py-4";

const KeyMetricsSectionBPSComponent = ({
    security,
    bpsRank,
    latestBPS,
    bps12Month,
    bps3Year,
    bps5Year,
    bps10Year,
    bps20Year,
    rangeMin,
    rangeMax,
}: KeyMetricsSectionBPSProps) => {

    // BPS 변화율 계산 (간단 버전) - 메모이제이션
    const getBPSChangeRate = useMemo(() => (current: number | null | undefined, previous: number | null | undefined) => {
        if (current == null || previous == null || previous === 0) return { value: "—", color: "text-muted-foreground text-muted-foreground" };

        const changeRate = ((current - previous) / previous) * 100;
        const value = `${changeRate >= 0 ? '+' : ''}${changeRate.toFixed(1)}%`;
        const color = changeRate > 0 ? "market-up" : changeRate < 0 ? "market-down" : "text-muted-foreground";

        return { value, color };
    }, []);

    return (
        <section
            id="indicators"
            className={`${EDGE_TO_EDGE_SECTION_CLASS} border-border bg-background border-border bg-background`}
            style={DEFAULT_BACKGROUND}
        >

            <header className="flex flex-wrap items-center gap-4">
                <div className="hidden bg-background bg-background">
                    <TrendingUp className="h-6 w-6 text-foreground text-foreground" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">핵심 지표</h2>
                    <p className="text-sm text-muted-foreground text-foreground md:text-base">
                        BPS 분석과 주요 투자 지표
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">

                {/* BPS 랭킹 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{bpsRank || "—"}</span>
                        {bpsRank && <span className="text-xs ml-1">위</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">BPS 랭킹</div>
                </div>

                {/* 현재 BPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{latestBPS != null ? `${latestBPS.toLocaleString()}` : "—"}</span>
                        {latestBPS != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">현재 BPS</div>
                </div>

                {/* 현재 주가 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{security.prices?.[0]?.close != null ? `${security.prices[0].close.toLocaleString()}` : "—"}</span>
                        {security.prices?.[0]?.close != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">현재 주가</div>
                </div>

                {/* 12개월 평균 BPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{bps12Month != null ? `${Math.round(bps12Month).toLocaleString()}` : "—"}</span>
                        {bps12Month != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">1년 평균</div>
                </div>

                {/* 3년 평균 BPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{bps3Year != null ? `${Math.round(bps3Year).toLocaleString()}` : "—"}</span>
                        {bps3Year != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">3년 평균</div>
                </div>

                {/* 5년 평균 BPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{bps5Year != null ? `${Math.round(bps5Year).toLocaleString()}` : "—"}</span>
                        {bps5Year != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">5년 평균</div>
                </div>

                {/* 10년 평균 BPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{bps10Year != null ? `${Math.round(bps10Year).toLocaleString()}` : "—"}</span>
                        {bps10Year != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">10년 평균</div>
                </div>

                {/* 20년 평균 BPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{bps20Year != null ? `${Math.round(bps20Year).toLocaleString()}` : "—"}</span>
                        {bps20Year != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">20년 평균</div>
                </div>

                {/* BPS 범위 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-sm sm:text-base md:text-lg">{rangeMin != null ? `${rangeMin.toLocaleString()}` : "—"}</span>
                        <span className="text-xs sm:text-sm mx-1">~</span>
                        <span className="text-sm sm:text-base md:text-lg">{rangeMax != null ? `${rangeMax.toLocaleString()}` : "—"}</span>
                        {(rangeMin || rangeMax) && <span className="text-xs sm:text-sm ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">BPS 범위</div>
                </div>

            </div>
        </section>
    );
};

export const KeyMetricsSectionBPS = memo(KeyMetricsSectionBPSComponent);
