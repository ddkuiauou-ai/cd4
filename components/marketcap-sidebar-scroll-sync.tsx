"use client";

import { useEffect, useRef } from "react";
import { NavigationCollapsible } from "./navigation-collapsible";
import { KeyMetricsSidebar } from "./key-metrics-sidebar";
import { RecentSecuritiesSidebar } from "./recent-securities-sidebar";
import { InteractiveSecuritiesSection } from "./simple-interactive-securities";
import { PageNavigation } from "./page-navigation";
import type { CompanyMarketcapData, SecurityData } from "@/types/nav";

interface MarketcapSidebarScrollSyncProps {
    navigationSections: Array<{ id: string; label: string; icon?: React.ReactNode }>;
    hasCompanyMarketcapData: boolean;
    companyMarketcapData: CompanyMarketcapData | null;
    companySecs: SecurityData[];
    security: any;
    marketCapRanking: any;
    currentTicker: string;
    selectedType: string;
    secCode: string;
    market: string;
}

export function MarketcapSidebarScrollSync({
    navigationSections,
    hasCompanyMarketcapData,
    companyMarketcapData,
    companySecs,
    security,
    marketCapRanking,
    currentTicker,
    selectedType,
    secCode,
    market,
}: MarketcapSidebarScrollSyncProps) {
    const sidebarRef = useRef<HTMLDivElement>(null);

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
            <NavigationCollapsible
                title="페이지 내비게이션"
                defaultCollapsed={false}
                storageKey="navigation-collapsed"
            >
                <PageNavigation sections={navigationSections} collapsible={false} />
            </NavigationCollapsible>

            {hasCompanyMarketcapData && (
                <KeyMetricsSidebar
                    companyMarketcapData={companyMarketcapData}
                    companySecs={companySecs}
                    security={security}
                    marketCapRanking={marketCapRanking}
                    currentTickerOverride={currentTicker}
                    selectedSecurityTypeOverride={selectedType}
                />
            )}

            {/* 최근 본 종목 사이드바 */}
            <RecentSecuritiesSidebar currentSecCode={secCode} />

            {hasCompanyMarketcapData && companySecs.length > 0 && (
                <InteractiveSecuritiesSection
                    companyMarketcapData={companyMarketcapData}
                    companySecs={companySecs}
                    currentTicker={currentTicker}
                    market={market}
                    layout="sidebar"
                    maxItems={4}
                    showSummaryCard
                    compactMode={false}
                    baseUrl="security"
                    currentMetric="marketcap"
                    highlightActiveTicker
                />
            )}
        </div>
    );
}
