"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { NavigationCollapsible } from "./navigation-collapsible";
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
import type { MetricPeriodAnalysis, SecurityData, CompanyMarketcapData, PeriodData } from "@/types/nav";

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
    companyMarketcapData?: CompanyMarketcapData | any;
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
    const [navigationCollapsed, setNavigationCollapsed] = useState(false);
    const [keyMetricsCollapsed, setKeyMetricsCollapsed] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const handleNavigationCollapsedChange = useCallback((collapsed: boolean) => {
        setNavigationCollapsed(collapsed);
    }, []);

    const handleKeyMetricsCollapsedChange = useCallback((collapsed: boolean) => {
        setKeyMetricsCollapsed(collapsed);
    }, []);

    // 메인 콘텐츠 스크롤과 사이드바 스크롤 동기화 (최적화 버전)
    useEffect(() => {
        let lastExecution = 0;
        const throttleDelay = 16; // ~60fps

        const handleScroll = (e: WheelEvent) => {
            const now = Date.now();
            if (now - lastExecution < throttleDelay) return;
            lastExecution = now;

            if (!sidebarRef.current) return;

            const sidebar = sidebarRef.current;

            // Window 스크롤 상태 확인 (메인 콘텐츠는 window가 스크롤됨)
            const windowScrollY = window.scrollY;
            const documentHeight = document.documentElement.scrollHeight;
            const windowHeight = window.innerHeight;

            // 사이드바 스크롤 상태 확인
            const sidebarScrollTop = sidebar.scrollTop;
            const sidebarScrollHeight = sidebar.scrollHeight;
            const sidebarClientHeight = sidebar.clientHeight;

            // 스크롤 여지 계산 (더 여유로운 오차 범위)
            const windowCanScrollDown = windowScrollY + windowHeight < documentHeight - 10;
            const windowCanScrollUp = windowScrollY > 10;
            const sidebarCanScrollDown = sidebarScrollTop + sidebarClientHeight < sidebarScrollHeight - 10;
            const sidebarCanScrollUp = sidebarScrollTop > 10;

            const deltaY = e.deltaY;
            // 스크롤 속도를 부드럽게 조절 (너무 빠른 스크롤 방지)
            const adjustedDeltaY = Math.min(Math.abs(deltaY), 50) * Math.sign(deltaY);

            if (deltaY > 0) { // 아래로 스크롤
                if (windowCanScrollDown) {
                    // 메인 콘텐츠에 스크롤 여지가 충분하면 메인 콘텐츠 우선
                    return;
                } else if (sidebarCanScrollDown) {
                    // 메인 콘텐츠 끝에 도달했고 사이드바에 여지가 있으면 사이드바 부드럽게 스크롤
                    e.preventDefault();
                    sidebar.scrollTop += adjustedDeltaY;
                }
            } else { // 위로 스크롤
                if (!windowCanScrollUp) {
                    // 메인 콘텐츠가 상단에 도달했고 사이드바에 위로 스크롤 여지가 있으면 사이드바 스크롤
                    if (sidebarCanScrollUp) {
                        e.preventDefault();
                        sidebar.scrollTop += adjustedDeltaY;
                    }
                } else {
                    // 메인 콘텐츠에 위로 스크롤 여지가 있으면 메인 콘텐츠 우선
                    return;
                }
            }
        };

        if (typeof window !== 'undefined' && sidebarRef.current) {
            window.addEventListener('wheel', handleScroll, { passive: false });
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('wheel', handleScroll);
            }
        };
    }, []);

    return (
        <div ref={sidebarRef} className="sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {/* 페이지 네비게이션 */}
            <NavigationCollapsible
                title="페이지 내비게이션"
                defaultCollapsed={false}
                storageKey="navigation-collapsed"
                onCollapsedChange={handleNavigationCollapsedChange}
            >
                <PageNavigation sections={navigationSections} collapsible={false} />
            </NavigationCollapsible>

            {/* 핵심 지표 사이드바 */}
            {(metricType === 'per' && periodAnalysis) && (
                <KeyMetricsSidebarPER
                    perRank={perRank}
                    latestPER={periodAnalysis.latestPER ?? null}
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
            {(metricType === 'bps' && periodAnalysis) && (
                <KeyMetricsSidebarBPS
                    bpsRank={perRank}
                    latestBPS={periodAnalysis.latestBPS ?? null}
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
            {(metricType === 'eps' && periodAnalysis) && (
                <KeyMetricsSidebarEPS
                    epsRank={perRank}
                    latestEPS={periodAnalysis.latestEPS ?? null}
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
            {(metricType === 'pbr' && periodAnalysis) && (
                <KeyMetricsSidebarPBR
                    pbrRank={perRank}
                    latestPBR={periodAnalysis.latestPBR ?? null}
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
            {(metricType === 'dps' && periodAnalysis) && (
                <KeyMetricsSidebarDPS
                    dpsRank={perRank}
                    latestDPS={periodAnalysis.latestDPS ?? null}
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
            {(metricType === 'div' && periodAnalysis) && (
                <KeyMetricsSidebarDIV
                    divRank={perRank}
                    latestDIV={periodAnalysis.latestDIV ?? null}
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
            {metricType === 'marketcap' && (
                <KeyMetricsSidebar
                    companyMarketcapData={companyMarketcapData}
                    companySecs={companySecs}
                    security={security}
                    marketCapRanking={{
                        currentRank: perRank,
                        priorRank: null,
                        rankChange: 0,
                        value: null
                    }}
                    currentTickerOverride={currentTicker}
                    onCollapsedChange={handleKeyMetricsCollapsedChange}
                />
            )}

            {/* 최근 본 종목 사이드바 */}
            <div className="mb-6">
                <RecentSecuritiesSidebar currentSecCode={secCode} />
            </div>

            {/* 종목별 비교 */}
            {hasCompanyMarketcapData && companySecs.length > 0 && (
                <div className="mb-0">
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
                        currentMetric={metricType}
                        highlightActiveTicker={metricType === 'marketcap' ? false : true}
                    />
                </div>
            )}
        </div>
    );
}
