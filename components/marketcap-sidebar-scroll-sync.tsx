"use client";

import { SidebarManager } from './sidebar-manager';
import type { CompanyMarketcapData, SecurityData } from '@/types/nav';

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

/** Retained export for existing pages; the rail now uses native scrolling. */
export function MarketcapSidebarScrollSync(props: MarketcapSidebarScrollSyncProps) {
    return <SidebarManager {...props} periodAnalysis={null} perRank={props.marketCapRanking?.currentRank ?? null}
        metricType="marketcap" selectedSecurityType={props.selectedType} />;
}
