import type { getSecurityByCode } from '@/lib/data/security';
import type { CompanyMarketcapAggregated } from '@/lib/data/company';

type SecurityDTO = NonNullable<Awaited<ReturnType<typeof getSecurityByCode>>>;
export type DetailSecurity = Omit<SecurityDTO, 'company'> & {
    company: (NonNullable<SecurityDTO['company']> & { sector?: string | null }) | null;
};
export interface DetailSecurityRow {
    securityId: string;
    routeCode?: string | null;
    name: string | null;
    korName?: string | null;
    ticker: string | null;
    type: string | null;
    exchange?: string | null;
    marketcap?: number | string | null;
    marketcapDate?: Date | string | null;
    per?: number | string | null;
    pbr?: number | string | null;
    eps?: number | string | null;
    bps?: number | string | null;
    div?: number | string | null;
    dps?: number | string | null;
    prices?: Array<{ close: number | string | null; rate?: number | null; date?: Date | string | null }>;
}
export type DetailCompanyData = CompanyMarketcapAggregated | null | undefined;
export type DetailRanking = { currentRank: number | null; priorRank: number | null; rankChange: number | null; value: number | string | null } | null;
