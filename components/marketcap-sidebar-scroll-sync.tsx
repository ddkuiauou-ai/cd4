"use client";
import type { DetailSecurity, DetailSecurityRow, DetailCompanyData, DetailRanking } from './detail-types';

import { SidebarManager } from './sidebar-manager';

interface MarketcapSidebarScrollSyncProps {
    navigationSections: Array<{ id: string; label: string; icon?: React.ReactNode }>;
    hasCompanyMarketcapData: boolean;
    companyMarketcapData: DetailCompanyData;
    companySecs: DetailSecurityRow[];
    security: DetailSecurity;
    marketCapRanking: DetailRanking;
    currentTicker: string;
    selectedType: string;
    secCode: string;
    rankDate?: string | null;
    market: string;
}

/** Retained export for existing pages; the rail now uses native scrolling. */
export function MarketcapSidebarScrollSync(props: MarketcapSidebarScrollSyncProps) {
    return <SidebarManager {...props} periodAnalysis={null} perRank={props.marketCapRanking?.currentRank ?? null}
        metricType="marketcap" selectedSecurityType={props.selectedType} />;
}
