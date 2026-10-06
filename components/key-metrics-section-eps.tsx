"use client";

import type { CSSProperties } from "react";
import { useMemo, memo } from "react";
import { TrendingUp } from "lucide-react";
import type { DetailSecurityRow } from './detail-types';
import { DetailCurrentPrice } from './detail-current-price';

interface KeyMetricsSectionEPSProps {
    security: Pick<DetailSecurityRow, 'prices'>;
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

const DEFAULT_BACKGROUND: CSSProperties = {};

const EDGE_TO_EDGE_SECTION_CLASS = "detail-section space-y-5 border-t border-border py-6 sm:py-8";

const MARQUEE_CARD_CLASS = "min-w-0 space-y-2 border-b border-border py-4";

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
                        EPS 분석과 주요 투자 지표
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">

                {/* EPS 랭킹 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{epsRank || "—"}</span>
                        {epsRank && <span className="text-xs ml-1">위</span>}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">
                        EPS 랭킹
                    </div>
                </div>

                {/* 현재 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{latestEPS != null ? Math.round(latestEPS).toLocaleString() : "—"}</span>
                        {latestEPS != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    {/* 기간 비교 변화율 */}
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getEPSChangeRate(latestEPS, eps12Month);
                            return <>
                                <span className={change.color}>{change.value}</span>
                                <span className="mt-1 block leading-tight text-muted-foreground">12개월 평균 대비</span>
                            </>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">
                        현재 EPS
                    </div>
                </div>

                {/* 현재 주가와 저장된 거래일 등락률 */}
                <div className={MARQUEE_CARD_CLASS}>
                    <DetailCurrentPrice price={security.prices?.[0]} />
                </div>

                {/* 12개월 평균 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{eps12Month != null ? Math.round(eps12Month).toLocaleString() : "—"}</span>
                        {eps12Month != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    {/* 3년 평균과의 변화율 */}
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getEPSChangeRate(eps12Month, eps3Year);
                            return <>
                                <span className={change.color}>{change.value}</span>
                                <span className="mt-1 block leading-tight text-muted-foreground">3년 평균 대비</span>
                            </>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">12개월 평균</div>
                </div>

                {/* 3년 평균 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{eps3Year != null ? Math.round(eps3Year).toLocaleString() : "—"}</span>
                        {eps3Year != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getEPSChangeRate(eps3Year, eps5Year);
                            return <>
                                <span className={change.color}>{change.value}</span>
                                <span className="mt-1 block leading-tight text-muted-foreground">5년 평균 대비</span>
                            </>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">3년 평균</div>
                </div>

                {/* 5년 평균 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{eps5Year != null ? Math.round(eps5Year).toLocaleString() : "—"}</span>
                        {eps5Year != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getEPSChangeRate(eps5Year, eps10Year);
                            return <>
                                <span className={change.color}>{change.value}</span>
                                <span className="mt-1 block leading-tight text-muted-foreground">10년 평균 대비</span>
                            </>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">5년 평균</div>
                </div>

                {/* 10년 평균 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{eps10Year != null ? Math.round(eps10Year).toLocaleString() : "—"}</span>
                        {eps10Year != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs leading-none mb-1">
                        {(() => {
                            const change = getEPSChangeRate(eps10Year, eps20Year);
                            return <>
                                <span className={change.color}>{change.value}</span>
                                <span className="mt-1 block leading-tight text-muted-foreground">20년 평균 대비</span>
                            </>;
                        })()}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">10년 평균</div>
                </div>

                {/* 20년 평균 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{eps20Year != null ? Math.round(eps20Year).toLocaleString() : "—"}</span>
                        {eps20Year != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">20년 평균</div>
                </div>

                {/* 최저 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{rangeMin != null ? Math.round(rangeMin).toLocaleString() : "—"}</span>
                        {rangeMin != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">최저 EPS</div>
                </div>

                {/* 최고 EPS */}
                <div className={MARQUEE_CARD_CLASS}>
                    <div className="flex items-baseline font-semibold text-foreground text-foreground mb-1 leading-none">
                        <span className="text-lg sm:text-xl">{rangeMax != null ? Math.round(rangeMax).toLocaleString() : "—"}</span>
                        {rangeMax != null && <span className="text-xs ml-1">원</span>}
                    </div>
                    <div className="text-xs text-muted-foreground text-muted-foreground leading-tight px-1">최고 EPS</div>
                </div>
            </div>
        </section>
    );
};

export const KeyMetricsSectionEPS = memo(KeyMetricsSectionEPSComponent);
