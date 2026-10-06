"use client";

import type { CSSProperties } from "react";
import { useMemo, memo } from "react";
import { TrendingUp } from "lucide-react";

interface KeyMetricsSectionDPSProps {
    security: {
        prices?: Array<{ close?: number }>;
    };
    dpsRank: number | null;
    latestDPS: number | null;
    dps12Month: number | null;
    dps3Year: number | null;
    dps5Year: number | null;
    dps10Year: number | null;
    dps20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    result: Array<{ date: string; value: number }>;
}

const DEFAULT_BACKGROUND: CSSProperties = {};

const EDGE_TO_EDGE_SECTION_CLASS = "detail-section space-y-5 border-t border-border py-6 sm:py-8";

const MARQUEE_CARD_CLASS = "min-w-0 space-y-2 border-b border-border py-4";

const KeyMetricsSectionDPSComponent = ({
    security,
    dpsRank,
    latestDPS,
    dps12Month,
    dps3Year,
    dps5Year,
    dps10Year,
    dps20Year,
    rangeMin,
    rangeMax,
}: KeyMetricsSectionDPSProps) => {

    // DPS 변화율 계산 - PER 컴포넌트처럼 수정
    const getDPSChangeRate = useMemo(() => (current: number | null | undefined, previous: number | null | undefined) => {
        if (current == null || previous == null || previous === 0) return { value: "—", color: "text-muted-foreground text-muted-foreground" };

        const changeRate = ((current - previous) / previous) * 100;
        const value = `${changeRate >= 0 ? '+' : ''}${changeRate.toFixed(1)}%`;
        const color = changeRate > 0 ? "market-up" : changeRate < 0 ? "market-down" : "text-muted-foreground";

        return { value, color };
    }, []);

    return (
        <section
            id="indicators"
            className={`${EDGE_TO_EDGE_SECTION_CLASS} border-border border-border bg-background`}
            style={DEFAULT_BACKGROUND}
        >

            <header className="flex flex-wrap items-center gap-4">
                <div className="hidden bg-background bg-background">
                    <TrendingUp className="h-6 w-6 text-foreground text-foreground" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">핵심 지표</h2>
                    <p className="text-sm text-muted-foreground text-foreground md:text-base">
                        DPS 분석과 주요 투자 지표
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">

                {/* DPS 랭킹 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{dpsRank || "—"}</span>
                        {dpsRank && <span className="text-xs ml-1">위</span>}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">
                        DPS 랭킹
                    </div>
                </div>

                {/* 현재 DPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{latestDPS != null ? latestDPS.toFixed(0) : "—"}</span>
                        {latestDPS != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    {/* 전년 대비 변화율 */}
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getDPSChangeRate(latestDPS, dps12Month);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">
                        현재 DPS
                    </div>
                </div>

                {/* 12개월 평균 DPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{dps12Month != null ? dps12Month.toFixed(0) : "—"}</span>
                        {dps12Month != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    {/* 이전 12개월 대비 변화율 */}
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getDPSChangeRate(dps12Month, dps3Year);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">12개월 평균</div>
                </div>

                {/* 3년 평균 DPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{dps3Year != null ? dps3Year.toFixed(0) : "—"}</span>
                        {dps3Year != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getDPSChangeRate(dps3Year, dps5Year);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">3년 평균</div>
                </div>

                {/* 5년 평균 DPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{dps5Year != null ? dps5Year.toFixed(0) : "—"}</span>
                        {dps5Year != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getDPSChangeRate(dps5Year, dps10Year);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">5년 평균</div>
                </div>

                {/* 10년 평균 DPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{dps10Year != null ? dps10Year.toFixed(0) : "—"}</span>
                        {dps10Year != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getDPSChangeRate(dps10Year, dps20Year);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">10년 평균</div>
                </div>

                {/* 20년 평균 DPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{dps20Year != null ? dps20Year.toFixed(0) : "—"}</span>
                        {dps20Year != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">20년 평균</div>
                </div>

                {/* 최저 DPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{rangeMin != null ? rangeMin.toFixed(0) : "—"}</span>
                        {rangeMin != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">최저 DPS</div>
                </div>

                {/* 최고 DPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{rangeMax != null ? rangeMax.toFixed(0) : "—"}</span>
                        {rangeMax != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">최고 DPS</div>
                </div>
            </div>
        </section>
    );
};

export const KeyMetricsSectionDPS = memo(KeyMetricsSectionDPSComponent);