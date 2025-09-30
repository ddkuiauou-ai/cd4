// Navigation types for CD3 project

export interface NavItem {
    title: string;
    href?: string;
    disabled?: boolean;
    external?: boolean;
    icon?: string;
    label?: string;
}

export interface NavItemWithChildren extends NavItem {
    items: NavItemWithChildren[];
}

export interface MainNavItem extends NavItem { }

export interface SidebarNavItem extends NavItemWithChildren { }

// Metric Analysis Types
export interface PeriodData {
    label: string;
    value: number;
    desc: string;
}

export interface MetricPeriodAnalysis {
    periods: PeriodData[];
    minMax: { min: number; max: number };
    currentSecurity: string;
    market: string;
    latestValue?: number | null;
    latestPER?: number | null;
    latestBPS?: number | null;
    latestEPS?: number | null;
    latestPBR?: number | null;
    latestDPS?: number | null;
    latestDIV?: number | null;
    latestMarketcap?: number | null;
}

export interface SecurityData {
    securityId: string;
    type: string | null;
    ticker: string | null;
    name: string | null;
    korName?: string | null;
    exchange?: string;
    data?: any; // Keep as any for now, can be more specific later
    marketcap?: number | null;
    marketcapDate?: string | Date | null;
    percentage?: number;
    marketcapHistory?: any[];
}

export interface CompanyMarketcapData {
    securities?: SecurityData[];
    // Add other properties as needed
    [key: string]: any; // Allow additional properties for flexibility
}
