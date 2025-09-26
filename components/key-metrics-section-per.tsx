"use client";

import type { CSSProperties } from "react";
import { useMemo, memo } from "react";
import { TrendingUp } from "lucide-react";
import { Marquee } from "@/registry/magicui/marquee";

interface KeyMetricsSectionPERProps {
    security: {
        prices?: Array<{ close?: number }>;
    };
    perRank: number | null;
    latestPER: number | null;
    per12Month: number | null;
    per3Year: number | null;
    per5Year: number | null;
    per10Year: number | null;
    per20Year: number | null;
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

const KeyMetricsSectionPERComponent = ({
    security,
    perRank,
    latestPER,
    per12Month,
    per3Year,
    per5Year,
    per10Year,
    per20Year,
    rangeMin,
    rangeMax,
}: KeyMetricsSectionPERProps) => {

    // PER 변화율 계산 (간단 버전) - 메모이제이션
    const getPERChangeRate = useMemo(() => (current: number | null | undefined, previous: number | null | undefined) => {
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
                    PER 기준 핵심 지표
                </span>
            </div>
            <header className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-900/40">
                    <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">핵심 지표</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 md:text-base">
                        PER 분석과 주요 투자 지표
                    </p>
                </div>
            </header>

            <Marquee
                pauseOnHover
                className="[--duration:36s]"
                contentClassName="flex gap-1 pb-2"
                contentStyle={{ minWidth: "fit-content" }}
            >

                {/* PER 랭킹 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{perRank || "—"}</span>
                        {perRank && <span className="text-sm sm:text-base ml-1">위</span>}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                        PER 랭킹
                    </div>
                </div>

                {/* 현재 PER */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{latestPER ? latestPER.toFixed(1) : "—"}</span>
                        {latestPER && <span className="text-sm sm:text-base ml-1">배</span>}
                    </div>
                    {/* 전일 대비 변화율 */}
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getPERChangeRate(latestPER, per12Month);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                        현재 PER
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
                            const change = getPERChangeRate(today, yesterday);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">현재 주가</div>
                </div>

                {/* 12개월 평균 PER */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{per12Month ? per12Month.toFixed(1) : "—"}</span>
                        {per12Month && <span className="text-sm sm:text-base ml-1">배</span>}
                    </div>
                    {/* 이전 12개월 대비 변화율 */}
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getPERChangeRate(per12Month, per3Year);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">12개월 평균</div>
                </div>

                {/* 3년 평균 PER */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{per3Year ? per3Year.toFixed(1) : "—"}</span>
                        {per3Year && <span className="text-sm sm:text-base ml-1">배</span>}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getPERChangeRate(per3Year, per5Year);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">3년 평균</div>
                </div>

                {/* 5년 평균 PER */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{per5Year ? per5Year.toFixed(1) : "—"}</span>
                        {per5Year && <span className="text-sm sm:text-base ml-1">배</span>}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getPERChangeRate(per5Year, per10Year);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">5년 평균</div>
                </div>

                {/* 10년 평균 PER */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{per10Year ? per10Year.toFixed(1) : "—"}</span>
                        {per10Year && <span className="text-sm sm:text-base ml-1">배</span>}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getPERChangeRate(per10Year, per20Year);
                            return <span className={change.color}>{change.value}</span>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">10년 평균</div>
                </div>

                {/* 20년 평균 PER */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{per20Year ? per20Year.toFixed(1) : "—"}</span>
                        {per20Year && <span className="text-sm sm:text-base ml-1">배</span>}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">20년 평균</div>
                </div>

                {/* 최저 PER */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{rangeMin ? rangeMin.toFixed(1) : "—"}</span>
                        {rangeMin && <span className="text-sm sm:text-base ml-1">배</span>}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최저 PER</div>
                </div>

                {/* 최고 PER */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                        <span className="text-xl sm:text-2xl md:text-3xl">{rangeMax ? rangeMax.toFixed(1) : "—"}</span>
                        {rangeMax && <span className="text-sm sm:text-base ml-1">배</span>}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최고 PER</div>
                </div>
            </Marquee>
                </section>
            );
        };
        
        export const KeyMetricsSectionPER = memo(KeyMetricsSectionPERComponent);
