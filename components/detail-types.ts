import type { company, price, security } from '@/db/schema-postgres';
import type { CompanyMarketcapAggregated } from '@/lib/data/company';

export type DetailSecurity = typeof security.$inferSelect & {
    company: (typeof company.$inferSelect & { sector?: string | null }) | null;
    prices: Array<typeof price.$inferSelect>;
};
export interface DetailSecurityRow {
    securityId: string;
    name: string | null;
    korName?: string | null;
    ticker: string | null;
    type: string | null;
    exchange?: string | null;
    marketcap?: number | null;
    marketcapDate?: Date | string | null;
    per?: number | null;
    pbr?: number | null;
    eps?: number | null;
    bps?: number | null;
    div?: number | null;
    dps?: number | null;
    prices?: Array<{ close: number | null; rate?: number | null; date?: Date | string | null }>;
}
export type DetailCompanyData = CompanyMarketcapAggregated | null | undefined;
export type DetailRanking = { currentRank: number | null; priorRank: number | null; rankChange: number; value: number | null } | null;
