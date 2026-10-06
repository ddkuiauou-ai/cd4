"use client";
import type { DetailSecurity, DetailSecurityRow, DetailCompanyData, DetailRanking } from './detail-types';

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { KeyMetricsSidebarPER } from "./key-metrics-sidebar-per";
import { KeyMetricsSidebarBPS } from "./key-metrics-sidebar-bps";
import { KeyMetricsSidebarEPS } from "./key-metrics-sidebar-eps";
import { KeyMetricsSidebarPBR } from "./key-metrics-sidebar-pbr";
import { KeyMetricsSidebarDPS } from "./key-metrics-sidebar-dps";
import { KeyMetricsSidebarDIV } from "./key-metrics-sidebar-div";
import { KeyMetricsSidebar } from "./key-metrics-sidebar";
import { RecentSecuritiesSidebar } from "./recent-securities-sidebar";
import { PageNavigation } from "./page-navigation";
import { InteractiveSecuritiesSection } from "./simple-interactive-securities";
import type { MetricPeriodAnalysis, PeriodData } from "@/types/nav";
import { DetailMetricFacts } from "./detail-metric-facts";
import { METRIC_CONFIG, formatMetricValue } from "@/lib/recent-securities";

interface SidebarManagerProps {
    navigationSections: Array<{ id: string; label: string; icon?: React.ReactNode }>;
    periodAnalysis: MetricPeriodAnalysis | null;
    perRank: number | null;
    security: DetailSecurity;
    secCode: string;
    rankDate?: string | null;
    hasCompanyMarketcapData?: boolean;
    companySecs?: DetailSecurityRow[];
    comparableSecuritiesWithPER?: DetailSecurityRow[];
    currentTicker?: string;
    market?: string;
    companyMarketcapData?: DetailCompanyData;
    marketCapRanking?: DetailRanking;
    selectedSecurityType?: string;
    metricType?: 'per' | 'bps' | 'eps' | 'pbr' | 'dps' | 'div' | 'marketcap';
}

export function SidebarManager({
    navigationSections,
    periodAnalysis,
    perRank,
    security,
    secCode,
    rankDate,
    hasCompanyMarketcapData = false,
    companySecs = [],
    comparableSecuritiesWithPER = [],
    currentTicker = "",
    market = "",
    companyMarketcapData,
    marketCapRanking,
    selectedSecurityType,
    metricType = 'per'
}: SidebarManagerProps) {
    const [expanded, setExpanded] = useState(false);
    const panelId = useId();
    const metricDateValue = security[`${metricType}Date`];
    const metricDate = metricDateValue && !Number.isNaN(new Date(metricDateValue).getTime())
        ? new Date(metricDateValue).toISOString().slice(0, 10) : '—';
    return (
        <div className="detail-rail-content space-y-6">
            <div className="hidden xl:block"><RecentSecuritiesSidebar currentSecCode={secCode} /></div>
            <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(value => !value)}
                className="flex min-h-11 w-full items-center justify-between gap-3 text-sm font-semibold xl:hidden">
                페이지 목차 · 핵심 지표<ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            <div id={panelId} className={`${expanded ? 'block' : 'hidden'} space-y-6 xl:block`}>
            {rankDate && <p className="text-xs text-muted-foreground">순위 기준 {rankDate} · 지표 기준 {metricDate}</p>}
            {metricType !== 'marketcap' && !periodAnalysis && <DetailMetricFacts rows={[
                [`${METRIC_CONFIG[metricType].label} 순위`, perRank != null ? `${perRank}위` : '—'],
                [`현재 ${METRIC_CONFIG[metricType].label}`, formatMetricValue(metricType, security[metricType])],
                ['현재 주가', formatMetricValue('bps', security.prices?.[0]?.close ?? null)],
            ]} note="이력 데이터가 등록되면 기간별 평균과 범위가 표시됩니다." />}
            {/* 핵심 지표 사이드바 */}
            {(metricType === 'per' && periodAnalysis) && (
                <KeyMetricsSidebarPER
                    perRank={perRank}
                    latestPER={security.per ?? null}
                    per12Month={periodAnalysis.periods.find((p: PeriodData) => p.label === '12개월 평균')?.value ?? null}
                    per3Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '3년 평균')?.value ?? null}
                    per5Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '5년 평균')?.value ?? null}
                    per10Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '10년 평균')?.value ?? null}
                    per20Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '20년 평균')?.value ?? null}
                    rangeMin={periodAnalysis.minMax.min}
                    rangeMax={periodAnalysis.minMax.max}
                    currentPrice={security.prices?.[0]?.close ?? null}
                />
            )}
            {(metricType === 'bps' && periodAnalysis) && (
                <KeyMetricsSidebarBPS
                    bpsRank={perRank}
                    latestBPS={security.bps ?? null}
                    bps12Month={periodAnalysis.periods.find((p: PeriodData) => p.label === '12개월 평균')?.value ?? null}
                    bps3Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '3년 평균')?.value ?? null}
                    bps5Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '5년 평균')?.value ?? null}
                    bps10Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '10년 평균')?.value ?? null}
                    bps20Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '20년 평균')?.value ?? null}
                    rangeMin={periodAnalysis.minMax.min}
                    rangeMax={periodAnalysis.minMax.max}
                    currentPrice={security.prices?.[0]?.close ?? null}
                />
            )}
            {(metricType === 'eps' && periodAnalysis) && (
                <KeyMetricsSidebarEPS
                    epsRank={perRank}
                    latestEPS={security.eps ?? null}
                    eps12Month={periodAnalysis.periods.find((p: PeriodData) => p.label === '12개월 평균')?.value ?? null}
                    eps3Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '3년 평균')?.value ?? null}
                    eps5Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '5년 평균')?.value ?? null}
                    eps10Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '10년 평균')?.value ?? null}
                    eps20Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '20년 평균')?.value ?? null}
                    rangeMin={periodAnalysis.minMax.min}
                    rangeMax={periodAnalysis.minMax.max}
                    currentPrice={security.prices?.[0]?.close ?? null}
                />
            )}
            {(metricType === 'pbr' && periodAnalysis) && (
                <KeyMetricsSidebarPBR
                    pbrRank={perRank}
                    latestPBR={security.pbr ?? null}
                    pbr12Month={periodAnalysis.periods.find((p: PeriodData) => p.label === '12개월 평균')?.value ?? null}
                    pbr3Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '3년 평균')?.value ?? null}
                    pbr5Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '5년 평균')?.value ?? null}
                    pbr10Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '10년 평균')?.value ?? null}
                    pbr20Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '20년 평균')?.value ?? null}
                    rangeMin={periodAnalysis.minMax.min}
                    rangeMax={periodAnalysis.minMax.max}
                    currentPrice={security.prices?.[0]?.close ?? null}
                />
            )}
            {(metricType === 'dps' && periodAnalysis) && (
                <KeyMetricsSidebarDPS
                    dpsRank={perRank}
                    latestDPS={security.dps ?? null}
                    dps12Month={periodAnalysis.periods.find((p: PeriodData) => p.label === '12개월 평균')?.value ?? null}
                    dps3Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '3년 평균')?.value ?? null}
                    dps5Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '5년 평균')?.value ?? null}
                    dps10Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '10년 평균')?.value ?? null}
                    dps20Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '20년 평균')?.value ?? null}
                    rangeMin={periodAnalysis.minMax.min}
                    rangeMax={periodAnalysis.minMax.max}
                    currentPrice={security.prices?.[0]?.close ?? null}
                />
            )}
            {(metricType === 'div' && periodAnalysis) && (
                <KeyMetricsSidebarDIV
                    divRank={perRank}
                    latestDIV={security.div ?? null}
                    div12Month={periodAnalysis.periods.find((p: PeriodData) => p.label === '12개월 평균')?.value ?? null}
                    div3Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '3년 평균')?.value ?? null}
                    div5Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '5년 평균')?.value ?? null}
                    div10Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '10년 평균')?.value ?? null}
                    div20Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '20년 평균')?.value ?? null}
                    rangeMin={periodAnalysis.minMax.min}
                    rangeMax={periodAnalysis.minMax.max}
                    currentPrice={security.prices?.[0]?.close ?? null}
                />
            )}
            {metricType === 'marketcap' && (
                <KeyMetricsSidebar
                    companyMarketcapData={companyMarketcapData}
                    companySecs={companySecs}
                    security={security}
                    marketCapRanking={marketCapRanking ?? {
                        currentRank: perRank,
                        priorRank: null,
                        rankChange: 0,
                        value: null
                    }}
                    selectedSecurityTypeOverride={selectedSecurityType}
                    rankDate={rankDate}
                    currentTickerOverride={currentTicker}
                />
            )}

            {navigationSections.length > 0 && <section className="border-t border-border pt-5">
                <h3 className="mb-3 text-base font-semibold">이 페이지에서</h3>
                <PageNavigation sections={navigationSections} collapsible={false} />
            </section>}
            {/* 종목별 비교 */}
            {hasCompanyMarketcapData && companySecs.length > 0 && (
                <div className="mb-0">
                    <InteractiveSecuritiesSection
                        companyMarketcapData={companyMarketcapData}
                        companySecs={comparableSecuritiesWithPER.length ? comparableSecuritiesWithPER : companySecs}
                        currentTicker={currentTicker}
                        market={market}
                        layout="sidebar"
                        maxItems={4}
                        showSummaryCard={true}
                        compactMode={false}
                        baseUrl="security"
                        currentMetric={metricType}
                        highlightActiveTicker
                    />
                </div>
            )}
            </div>
        </div>
    );
}
