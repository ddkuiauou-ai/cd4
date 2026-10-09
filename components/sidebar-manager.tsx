"use client";
import type { DetailSecurity, DetailSecurityRow, DetailCompanyData, DetailRanking } from './detail-types';

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { KeyMetricsSidebar } from "./key-metrics-sidebar";
import { RecentSecuritiesSidebar } from "./recent-securities-sidebar";
import { PageNavigation } from "./page-navigation";
import { InteractiveSecuritiesSection } from "./simple-interactive-securities";
import type { MetricPeriodAnalysis } from "@/types/nav";
import { DetailMetricFacts } from "./detail-metric-facts";
import { METRIC_CONFIG, formatMetricValue } from "@/lib/recent-securities";
import { formatBusinessValue } from "@/lib/business-analysis";

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
            {metricType !== 'marketcap' && periodAnalysis && <DetailMetricFacts rows={[
                ['현재 ' + metricType.toUpperCase(), formatBusinessValue(security[metricType])],
                ...periodAnalysis.periods.map(period => [period.label, formatBusinessValue(period.value)] as [string,string]),
                ['최저값', formatBusinessValue(periodAnalysis.minMax.min)], ['최고값', formatBusinessValue(periodAnalysis.minMax.max)],
                ['현재 주가', security.price == null ? '—' : formatBusinessValue(security.price) + '원'],
            ]} note={'지표 기준 ' + metricDate} />}
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
