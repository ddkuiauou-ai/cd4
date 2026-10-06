"use client";

import type { CSSProperties } from "react";
import { useMemo, memo } from "react";
import { TrendingUp } from "lucide-react";
import type { DetailSecurityRow } from './detail-types';
import { DetailCurrentPrice } from './detail-current-price';

interface KeyMetricsSectionPERProps {
    security: Pick<DetailSecurityRow, 'prices'>;
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

const DEFAULT_BACKGROUND: CSSProperties = {};

const EDGE_TO_EDGE_SECTION_CLASS = "detail-section space-y-5 border-t border-border py-6 sm:py-8";

const MARQUEE_CARD_CLASS = "min-w-0 space-y-2 border-b border-border py-4";

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
            <>

                <header className="flex flex-wrap items-center gap-4">
                    <div className="hidden bg-background bg-background">
                        <TrendingUp className="h-6 w-6 text-foreground text-foreground" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold tracking-tight text-foreground">핵심 지표</h2>
                        <p className="text-sm text-muted-foreground text-foreground md:text-base">
                            PER 분석과 주요 투자 지표
                        </p>
                    </div>
                </header>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">

                    {/* PER 랭킹 */}
                    <div className={MARQUEE_CARD_CLASS}>
                        <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                            <span className="text-lg sm:text-xl">{perRank || "—"}</span>
                            {perRank && <span className="text-xs ml-1">위</span>}
                        </div>
                        <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">
                            PER 랭킹
                        </div>
                    </div>

                    {/* 현재 PER */}
                    <div className={MARQUEE_CARD_CLASS}>
                        <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                            <span className="text-lg sm:text-xl">{latestPER != null ? latestPER.toFixed(1) : "—"}</span>
                            {latestPER != null && <span className="text-xs ml-1">배</span>}
                        </div>
                        {/* 기간 비교 변화율 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPERChangeRate(latestPER, per12Month);
                                return <>
                                    <span className={change.color}>{change.value}</span>
                                    <span className="mt-1 block leading-tight text-muted-foreground">12개월 평균 대비</span>
                                </>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">
                            현재 PER
                        </div>
                    </div>

                    {/* 현재 주가와 저장된 거래일 등락률 */}
                    <div className={MARQUEE_CARD_CLASS}>
                        <DetailCurrentPrice price={security.prices?.[0]} />
                    </div>

                    {/* 12개월 평균 PER */}
                    <div className={MARQUEE_CARD_CLASS}>
                        <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                            <span className="text-lg sm:text-xl">{per12Month != null ? per12Month.toFixed(1) : "—"}</span>
                            {per12Month != null && <span className="text-xs ml-1">배</span>}
                        </div>
                        {/* 3년 평균과의 변화율 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPERChangeRate(per12Month, per3Year);
                                return <>
                                    <span className={change.color}>{change.value}</span>
                                    <span className="mt-1 block leading-tight text-muted-foreground">3년 평균 대비</span>
                                </>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">12개월 평균</div>
                    </div>

                    {/* 3년 평균 PER */}
                    <div className={MARQUEE_CARD_CLASS}>
                        <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                            <span className="text-lg sm:text-xl">{per3Year != null ? per3Year.toFixed(1) : "—"}</span>
                            {per3Year != null && <span className="text-xs ml-1">배</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPERChangeRate(per3Year, per5Year);
                                return <>
                                    <span className={change.color}>{change.value}</span>
                                    <span className="mt-1 block leading-tight text-muted-foreground">5년 평균 대비</span>
                                </>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">3년 평균</div>
                    </div>

                    {/* 5년 평균 PER */}
                    <div className={MARQUEE_CARD_CLASS}>
                        <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                            <span className="text-lg sm:text-xl">{per5Year != null ? per5Year.toFixed(1) : "—"}</span>
                            {per5Year != null && <span className="text-xs ml-1">배</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPERChangeRate(per5Year, per10Year);
                                return <>
                                    <span className={change.color}>{change.value}</span>
                                    <span className="mt-1 block leading-tight text-muted-foreground">10년 평균 대비</span>
                                </>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">5년 평균</div>
                    </div>

                    {/* 10년 평균 PER */}
                    <div className={MARQUEE_CARD_CLASS}>
                        <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                            <span className="text-lg sm:text-xl">{per10Year != null ? per10Year.toFixed(1) : "—"}</span>
                            {per10Year != null && <span className="text-xs ml-1">배</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPERChangeRate(per10Year, per20Year);
                                return <>
                                    <span className={change.color}>{change.value}</span>
                                    <span className="mt-1 block leading-tight text-muted-foreground">20년 평균 대비</span>
                                </>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">10년 평균</div>
                    </div>

                    {/* 20년 평균 PER */}
                    <div className={MARQUEE_CARD_CLASS}>
                        <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                            <span className="text-lg sm:text-xl">{per20Year != null ? per20Year.toFixed(1) : "—"}</span>
                            {per20Year != null && <span className="text-xs ml-1">배</span>}
                        </div>
                        <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">20년 평균</div>
                    </div>

                    {/* 최저 PER */}
                    <div className={MARQUEE_CARD_CLASS}>
                        <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                            <span className="text-lg sm:text-xl">{rangeMin != null ? rangeMin.toFixed(1) : "—"}</span>
                            {rangeMin != null && <span className="text-xs ml-1">배</span>}
                        </div>
                        <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">최저 PER</div>
                    </div>

                    {/* 최고 PER */}
                    <div className={MARQUEE_CARD_CLASS}>
                        <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                            <span className="text-lg sm:text-xl">{rangeMax != null ? rangeMax.toFixed(1) : "—"}</span>
                            {rangeMax != null && <span className="text-xs ml-1">배</span>}
                        </div>
                        <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">최고 PER</div>
                    </div>
                </div>
            </>
        </section>
    );
};

export const KeyMetricsSectionPER = memo(KeyMetricsSectionPERComponent);
