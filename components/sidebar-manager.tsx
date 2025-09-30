"use client";

import { useState, useCallback, useMemo } from "react";
import { NavigationCollapsible } from "./navigation-collapsible";
import { KeyMetricsSidebarPER } from "./key-metrics-sidebar-per";
import { KeyMetricsSidebarBPS } from "./key-metrics-sidebar-bps";
import { KeyMetricsSidebarEPS } from "./key-metrics-sidebar-eps";
import { KeyMetricsSidebarPBR } from "./key-metrics-sidebar-pbr";
import { KeyMetricsSidebarDPS } from "./key-metrics-sidebar-dps";
import { KeyMetricsSidebarDIV } from "./key-metrics-sidebar-div";
import { RecentSecuritiesSidebar } from "./recent-securities-sidebar";
import { PageNavigation } from "./page-navigation";
import { InteractiveSecuritiesSection } from "./simple-interactive-securities";
import type { MetricPeriodAnalysis, SecurityData, CompanyMarketcapData } from "@/types/nav";

interface SidebarManagerProps {
    navigationSections: Array<{ id: string; label: string; icon?: React.ReactNode }>;
    periodAnalysis: MetricPeriodAnalysis | null;
    perRank: number | null;
    security: any; // Keep as any for now - complex security object
    secCode: string;
    hasCompanyMarketcapData?: boolean;
    companySecs?: SecurityData[];
    comparableSecuritiesWithPER?: SecurityData[];
    currentTicker?: string;
    market?: string;
    companyMarketcapData?: CompanyMarketcapData;
    metricType?: 'per' | 'bps' | 'eps' | 'pbr' | 'dps' | 'div' | 'marketcap';
}

export function SidebarManager({
    navigationSections,
    periodAnalysis,
    perRank,
    security,
    secCode,
    hasCompanyMarketcapData = false,
    companySecs = [],
    comparableSecuritiesWithPER = [],
    currentTicker = "",
    market = "",
    companyMarketcapData,
    metricType = 'per'
}: SidebarManagerProps) {
    const [keyMetricsCollapsed, setKeyMetricsCollapsed] = useState(false);

    const handleKeyMetricsCollapsedChange = useCallback((collapsed: boolean) => {
        setKeyMetricsCollapsed(collapsed);
    }, []);

    return (
        <div className="sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent space-y-6">
            {/* 페이지 네비게이션 */}
            <div>
                <NavigationCollapsible
                    title="페이지 내비게이션"
                    defaultCollapsed={false}
                    storageKey="navigation-collapsed"
                >
                    <PageNavigation sections={navigationSections} collapsible={false} />
                </NavigationCollapsible>
            </div>

            {/* 핵심 지표 사이드바 */}
            {periodAnalysis && (
                <div>
                    {metricType === 'per' && (
                        <KeyMetricsSidebarPER
                            perRank={perRank}
                            latestPER={periodAnalysis.latestPER}
                            per12Month={periodAnalysis.periods.find((p: PeriodData) => p.label === '12개월 평균')?.value || null}
                            per3Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '3년 평균')?.value || null}
                            per5Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '5년 평균')?.value || null}
                            per10Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '10년 평균')?.value || null}
                            per20Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '20년 평균')?.value || null}
                            rangeMin={periodAnalysis.minMax.min}
                            rangeMax={periodAnalysis.minMax.max}
                            currentPrice={security.prices?.[0]?.close || null}
                            onCollapsedChange={handleKeyMetricsCollapsedChange}
                        />
                    )}
                    {metricType === 'bps' && (
                        <KeyMetricsSidebarBPS
                            bpsRank={perRank}
                            latestBPS={periodAnalysis.latestBPS}
                            bps12Month={periodAnalysis.periods.find((p: PeriodData) => p.label === '12개월 평균')?.value || null}
                            bps3Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '3년 평균')?.value || null}
                            bps5Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '5년 평균')?.value || null}
                            bps10Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '10년 평균')?.value || null}
                            bps20Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '20년 평균')?.value || null}
                            rangeMin={periodAnalysis.minMax.min}
                            rangeMax={periodAnalysis.minMax.max}
                            currentPrice={security.prices?.[0]?.close || null}
                            onCollapsedChange={handleKeyMetricsCollapsedChange}
                        />
                    )}
                    {metricType === 'eps' && (
                        <KeyMetricsSidebarEPS
                            epsRank={perRank}
                            latestEPS={periodAnalysis.latestEPS}
                            eps12Month={periodAnalysis.periods.find((p: PeriodData) => p.label === '12개월 평균')?.value || null}
                            eps3Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '3년 평균')?.value || null}
                            eps5Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '5년 평균')?.value || null}
                            eps10Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '10년 평균')?.value || null}
                            eps20Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '20년 평균')?.value || null}
                            rangeMin={periodAnalysis.minMax.min}
                            rangeMax={periodAnalysis.minMax.max}
                            currentPrice={security.prices?.[0]?.close || null}
                            onCollapsedChange={handleKeyMetricsCollapsedChange}
                        />
                    )}
                    {metricType === 'pbr' && (
                        <KeyMetricsSidebarPBR
                            pbrRank={perRank}
                            latestPBR={periodAnalysis.latestPBR}
                            pbr12Month={periodAnalysis.periods.find((p: PeriodData) => p.label === '12개월 평균')?.value || null}
                            pbr3Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '3년 평균')?.value || null}
                            pbr5Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '5년 평균')?.value || null}
                            pbr10Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '10년 평균')?.value || null}
                            pbr20Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '20년 평균')?.value || null}
                            rangeMin={periodAnalysis.minMax.min}
                            rangeMax={periodAnalysis.minMax.max}
                            currentPrice={security.prices?.[0]?.close || null}
                            onCollapsedChange={handleKeyMetricsCollapsedChange}
                        />
                    )}
                    {metricType === 'dps' && (
                        <KeyMetricsSidebarDPS
                            dpsRank={perRank}
                            latestDPS={periodAnalysis.latestDPS}
                            dps12Month={periodAnalysis.periods.find((p: PeriodData) => p.label === '12개월 평균')?.value || null}
                            dps3Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '3년 평균')?.value || null}
                            dps5Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '5년 평균')?.value || null}
                            dps10Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '10년 평균')?.value || null}
                            dps20Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '20년 평균')?.value || null}
                            rangeMin={periodAnalysis.minMax.min}
                            rangeMax={periodAnalysis.minMax.max}
                            currentPrice={security.prices?.[0]?.close || null}
                            onCollapsedChange={handleKeyMetricsCollapsedChange}
                        />
                    )}
                    {metricType === 'div' && (
                        <KeyMetricsSidebarDIV
                            divRank={perRank}
                            latestDIV={periodAnalysis.latestDIV}
                            div12Month={periodAnalysis.periods.find((p: PeriodData) => p.label === '12개월 평균')?.value || null}
                            div3Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '3년 평균')?.value || null}
                            div5Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '5년 평균')?.value || null}
                            div10Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '10년 평균')?.value || null}
                            div20Year={periodAnalysis.periods.find((p: PeriodData) => p.label === '20년 평균')?.value || null}
                            rangeMin={periodAnalysis.minMax.min}
                            rangeMax={periodAnalysis.minMax.max}
                            currentPrice={security.prices?.[0]?.close || null}
                            onCollapsedChange={handleKeyMetricsCollapsedChange}
                        />
                    )}
                </div>
            )}

            {/* 최근 본 종목 사이드바 */}
            <div>
                <RecentSecuritiesSidebar currentSecCode={secCode} />
            </div>

            {/* 종목별 PER 비교 */}
            {hasCompanyMarketcapData && companySecs.length > 0 && (
                <div>
                    <InteractiveSecuritiesSection
                        companyMarketcapData={companyMarketcapData}
                        companySecs={comparableSecuritiesWithPER}
                        currentTicker={currentTicker}
                        market={market}
                        layout="sidebar"
                        maxItems={4}
                        showSummaryCard={true}
                        compactMode={false}
                        baseUrl="security"
                        currentMetric="per"
                        highlightActiveTicker={true}
                    />
                </div>
            )}
        </div>
    );
}
