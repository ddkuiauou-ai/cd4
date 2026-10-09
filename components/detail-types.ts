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
export type DetailCorporation = Pick<CompanyMarketcapAggregated['company'], 'name' | 'korName' | 'logo' | 'industry' | 'establishedDate' | 'homepage'>;
export type DetailPublication = Pick<NonNullable<CompanyMarketcapAggregated['publication']>, 'asOf' | 'revision' | 'scopeKey'>;
type CompanyMember = CompanyMarketcapAggregated['securities'][number];
export type DetailCompanyView = Pick<CompanyMarketcapAggregated,
    'companyId' | 'companyName' | 'companyKorName' | 'totalMarketcap' | 'totalMarketcapDate' | 'marketcapCompleteness'
    | 'state' | 'routeCode' | 'compositionComplete' | 'compositionReason' | 'compositionObservedCount' | 'compositionTargetCount'
    | 'aggregatedHistory' | 'registeredHistory'> & {
    company: DetailCorporation;
    publication: DetailPublication | null;
    securities: Array<Omit<CompanyMember, 'marketcapHistory'> & {
        marketcapHistory: Array<Pick<CompanyMember['marketcapHistory'][number], 'date' | 'marketcap' | 'securityId'>>;
    }>;
};
export type DetailCompanyData = DetailCompanyView | null | undefined;
export type DetailRanking = { currentRank: number | null; priorRank: number | null; rankChange: number | null; value: number | string | null } | null;
