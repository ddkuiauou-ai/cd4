"use client";
import type { DetailSecurity, DetailSecurityRow, DetailCompanyData } from './detail-types';
import { formatBusinessValue } from '@/lib/business-analysis';
import { DetailMetricFacts } from './detail-metric-facts';
export function KeyMetricsSidebar({ security, companyMarketcapData, rankDate }: { security: DetailSecurity; companyMarketcapData?: DetailCompanyData; companySecs?: DetailSecurityRow[]; marketCapRanking?: unknown; selectedSecurityTypeOverride?: string; currentTickerOverride?: string; rankDate?: string | null }) {
 return <DetailMetricFacts rows={[["현재 종목 시총", security.marketcap == null ? '—' : `${formatBusinessValue(security.marketcap)}원`],["기업 전체 시총", companyMarketcapData?.totalMarketcap == null ? '—' : `${formatBusinessValue(companyMarketcapData.totalMarketcap)}원`],["현재 주가",security.price == null ? '—' : `${formatBusinessValue(security.price)}원`]]} note={rankDate ? `순위 기준 ${rankDate}` : undefined} />;
}
