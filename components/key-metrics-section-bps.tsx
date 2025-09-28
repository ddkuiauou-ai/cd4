"use client";

import type { CSSProperties } from "react";
import { useMemo, memo } from "react";
import { TrendingUp } from "lucide-react";
import { Marquee } from "@/registry/magicui/marquee";

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

const DEFAULT_BACKGROUND: CSSProperties = {
    backgroundColor: "rgba(139, 69, 19, 0.02)",
    backgroundImage:
        "linear-gradient(180deg, rgba(139,69,19,0.09) 0px, rgba(139,69,19,0.05) 120px, rgba(139,69,19,0.025) 280px, rgba(139,69,19,0) 520px)",
};

const EDGE_TO_EDGE_SECTION_CLASS =
    "relative -mx-4 space-y-4 border-y px-4 py-4 shadow-sm sm:mx-0 sm:space-y-8 sm:overflow-hidden sm:rounded-3xl sm:border sm:px-6 sm:py-8";

const MARQUEE_CARD_CLASS =
    "group rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer flex-shrink-0 snap-center w-fit min-w-[112px] sm:min-w-[140px] lg:min-w-[168px] max-w-[260px] min-h-[96px]";

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
        if (!current || !previous) return { value: "—", color: "text-gray-500 dark:text-gray-400" };

        const changeRate = ((current - previous) / previous) * 100;
        const value = `${changeRate >= 0 ? '+' : ''}${changeRate.toFixed(1)}%`;
        const color = changeRate > 0 ? "text-green-600 dark:text-green-400" :
            changeRate < 0 ? "text-red-600 dark:text-red-400" :
                "text-gray-500 dark:text-gray-400";

        return { value, color };
    }, []);

    return (
        <section
            id="indicators"
            className={`${EDGE_TO_EDGE_SECTION_CLASS} border-orange-200/60 bg-orange-50/60 dark:border-orange-900/40 dark:bg-orange-950/10`}
            style={DEFAULT_BACKGROUND}
        >
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-orange-700/80 dark:text-orange-200/80">
                <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] uppercase tracking-widest text-orange-700 shadow-sm">
                    탭 연동
                </span>
                <span className="text-sm font-semibold text-orange-800/90">
                    BPS 기준 핵심 지표
                </span>
            </div>
            <header className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-900/40">
                    <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">핵심 지표</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 md:text-base">
                        BPS 분석과 주요 투자 지표
                    </p>
                </div>
            </header>

            <Marquee
                pauseOnHover
                className="[--duration:36s]"
                contentClassName="flex gap-1 pb-2"
                contentStyle={{ minWidth: "fit-content" }}
            >

                {/* BPS 랭킹 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{bpsRank || "—"}</span>
                        {bpsRank && <span className="text-sm sm:text-base ml-1">위</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">BPS 랭킹</div>
                </div>

                {/* 현재 BPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{latestBPS ? `${latestBPS.toLocaleString()}` : "—"}</span>
                        {latestBPS && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">현재 BPS</div>
                </div>

                {/* 현재 주가 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{security.prices?.[0]?.close ? `${security.prices[0].close.toLocaleString()}` : "—"}</span>
                        {security.prices?.[0]?.close && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">현재 주가</div>
                </div>

                {/* 12개월 평균 BPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{bps12Month ? `${Math.round(bps12Month).toLocaleString()}` : "—"}</span>
                        {bps12Month && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">1년 평균</div>
                </div>

                {/* 3년 평균 BPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{bps3Year ? `${Math.round(bps3Year).toLocaleString()}` : "—"}</span>
                        {bps3Year && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">3년 평균</div>
                </div>

                {/* 5년 평균 BPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{bps5Year ? `${Math.round(bps5Year).toLocaleString()}` : "—"}</span>
                        {bps5Year && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">5년 평균</div>
                </div>

                {/* 10년 평균 BPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{bps10Year ? `${Math.round(bps10Year).toLocaleString()}` : "—"}</span>
                        {bps10Year && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">10년 평균</div>
                </div>

                {/* 20년 평균 BPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{bps20Year ? `${Math.round(bps20Year).toLocaleString()}` : "—"}</span>
                        {bps20Year && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">20년 평균</div>
                </div>

                {/* BPS 범위 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-sm sm:text-base md:text-lg">{rangeMin ? `${rangeMin.toLocaleString()}` : "—"}</span>
                        <span className="text-xs sm:text-sm mx-1">~</span>
                        <span className="text-sm sm:text-base md:text-lg">{rangeMax ? `${rangeMax.toLocaleString()}` : "—"}</span>
                        {(rangeMin || rangeMax) && <span className="text-xs sm:text-sm ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">BPS 범위</div>
                </div>

            </Marquee>
        </section>
    );
};

export const KeyMetricsSectionBPS = memo(KeyMetricsSectionBPSComponent);
