"use client";

import type { CSSProperties } from "react";
import { useMemo, memo } from "react";
import { TrendingUp } from "lucide-react";
import { Marquee } from "@/registry/magicui/marquee";

interface KeyMetricsSectionEPSProps {
    security: {
        prices?: Array<{ close?: number }>;
    };
    epsRank: number | null;
    latestEPS: number | null;
    eps12Month: number | null;
    eps3Year: number | null;
    eps5Year: number | null;
    eps10Year: number | null;
    eps20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    result: Array<{ date: string; value: number }>;
}

const DEFAULT_BACKGROUND: CSSProperties = {
    backgroundColor: "rgba(249, 115, 22, 0.02)",
    backgroundImage:
        "linear-gradient(180deg, rgba(249,115,22,0.09) 0px, rgba(249,115,22,0.05) 120px, rgba(249,115,22,0.025) 280px, rgba(249,115,22,0) 520px)",
};

const EDGE_TO_EDGE_SECTION_CLASS =
    "relative -mx-4 space-y-4 border-y px-4 py-4 shadow-sm sm:mx-0 sm:space-y-8 sm:overflow-hidden sm:rounded-3xl sm:border sm:px-6 sm:py-8";

const MARQUEE_CARD_CLASS =
    "group rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer flex-shrink-0 snap-center w-fit min-w-[112px] sm:min-w-[140px] lg:min-w-[168px] max-w-[260px] min-h-[96px]";

const KeyMetricsSectionEPSComponent = ({
    security,
    epsRank,
    latestEPS,
    eps12Month,
    eps3Year,
    eps5Year,
    eps10Year,
    eps20Year,
    rangeMin,
    rangeMax,
}: KeyMetricsSectionEPSProps) => {

    // EPS 변화율 계산 (간단 버전) - 메모이제이션
    const getEPSChangeRate = useMemo(() => (current: number | null | undefined, previous: number | null | undefined) => {
        if (!current || !previous) return { value: "—", color: "text-gray-500 dark:text-gray-400" };

        const changeRate = ((current - previous) / previous) * 100;
        const value = `${changeRate >= 0 ? '+' : ''}${changeRate.toFixed(1)}%`;
        const color = changeRate > 0 ? "text-red-600 dark:text-red-400" :
            changeRate < 0 ? "text-blue-600 dark:text-blue-400" :
                "text-gray-500 dark:text-gray-400";

        return { value, color };
    }, []);

    return (
        <section
            id="indicators"
            className={`${EDGE_TO_EDGE_SECTION_CLASS} border-orange-200/70 dark:border-orange-900/40 dark:bg-orange-950/20`}
            style={DEFAULT_BACKGROUND}
        >
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-orange-700/80">
                <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] uppercase tracking-widest text-orange-700 shadow-sm">
                    탭 연동
                </span>
                <span className="text-sm font-semibold text-orange-800/90">
                    EPS 기준 핵심 지표
                </span>
            </div>
            <header className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-900/40">
                    <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">핵심 지표</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 md:text-base">
                        EPS 분석과 주요 투자 지표
                    </p>
                </div>
            </header>

            <Marquee
                pauseOnHover
                className="[--duration:36s]"
                contentClassName="flex gap-1 pb-2"
                contentStyle={{ minWidth: "fit-content" }}
            >

                {/* EPS 랭킹 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{epsRank || "—"}</span>
                        {epsRank && <span className="text-sm sm:text-base ml-1">위</span>}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                        EPS 랭킹
                    </div>
                </div>

                {/* 현재 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{latestEPS ? Math.round(latestEPS).toLocaleString() : "—"}</span>
                        {latestEPS && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    {/* 전일 대비 변화율 */}
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getEPSChangeRate(latestEPS, eps12Month);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                        현재 EPS
                    </div>
                </div>

                {/* 현재 주가 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{security.prices?.[0]?.close ? security.prices[0].close.toLocaleString() : "—"}</span>
                        {security.prices?.[0]?.close && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    {/* 전일 대비 주가 변화율 */}
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            if (!security.prices || security.prices.length < 2) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                            const today = security.prices[0].close;
                            const yesterday = security.prices[1].close;
                            const change = getEPSChangeRate(today, yesterday);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">현재 주가</div>
                </div>

                {/* 12개월 평균 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{eps12Month ? Math.round(eps12Month).toLocaleString() : "—"}</span>
                        {eps12Month && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    {/* 이전 12개월 대비 변화율 */}
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getEPSChangeRate(eps12Month, eps3Year);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">12개월 평균</div>
                </div>

                {/* 3년 평균 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{eps3Year ? Math.round(eps3Year).toLocaleString() : "—"}</span>
                        {eps3Year && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getEPSChangeRate(eps3Year, eps5Year);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">3년 평균</div>
                </div>

                {/* 5년 평균 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{eps5Year ? Math.round(eps5Year).toLocaleString() : "—"}</span>
                        {eps5Year && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getEPSChangeRate(eps5Year, eps10Year);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">5년 평균</div>
                </div>

                {/* 10년 평균 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{eps10Year ? Math.round(eps10Year).toLocaleString() : "—"}</span>
                        {eps10Year && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getEPSChangeRate(eps10Year, eps20Year);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">10년 평균</div>
                </div>

                {/* 20년 평균 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{eps20Year ? Math.round(eps20Year).toLocaleString() : "—"}</span>
                        {eps20Year && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">20년 평균</div>
                </div>

                {/* 최저 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{rangeMin ? Math.round(rangeMin).toLocaleString() : "—"}</span>
                        {rangeMin && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최저 EPS</div>
                </div>

                {/* 최고 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{rangeMax ? Math.round(rangeMax).toLocaleString() : "—"}</span>
                        {rangeMax && <span className="text-sm sm:text-base ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최고 EPS</div>
                </div>
            </Marquee>
        </section>
    );
};

export const KeyMetricsSectionEPS = memo(KeyMetricsSectionEPSComponent);
