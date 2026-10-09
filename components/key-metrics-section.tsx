"use client";
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import type { DetailSecurity, DetailSecurityRow, DetailCompanyData } from './detail-types';
import { formatCompactBusinessValue, summarizeBusinessWindow, businessChangePercent } from '@/lib/business-analysis';
import { getSecurityMarketcapSnapshot } from '@/lib/detail-marketcap-snapshot';
import { getSecurityMarketcapHistory, describeMarketcapHistory } from '@/lib/detail-marketcap-history';
import { getSnapshotHistoryComparison } from '@/lib/detail-change-basis';
import { periodMeans } from '@/lib/detail-presentation';
import { DetailCurrentPrice } from './detail-current-price';

export function KeyMetricsSection({ companyMarketcapData, companySecs, security, currentTickerOverride, selectedSecurityTypeOverride, backgroundStyle }: {
 companyMarketcapData: DetailCompanyData; companySecs: DetailSecurityRow[]; security: DetailSecurity;
 periodAnalysis?: unknown; marketCapRanking?: unknown; activeMetric: { id: string; label: string; description?: string }; rankDate?: string | null; backgroundStyle?: CSSProperties;
 currentTickerOverride?: string; selectedSecurityTypeOverride?: string;
}) {
 const company = usePathname().startsWith('/company/') && selectedSecurityTypeOverride !== '보통주' && selectedSecurityTypeOverride !== '우선주';
 const selected = companySecs.find(row => row.securityId === security.securityId || row.ticker === currentTickerOverride) ?? security;
 const snapshot = company ? { value: companyMarketcapData?.totalMarketcap ?? null, date: companyMarketcapData?.totalMarketcapDate ?? null } : getSecurityMarketcapSnapshot(selected, companyMarketcapData);
 const observations = company ? companyMarketcapData?.aggregatedHistory.map(row => ({ date: String(row.date), value: row.totalMarketcap })) ?? []
   : getSecurityMarketcapHistory(companyMarketcapData, selected.securityId).map(row => ({ date: String(row.date), value: row.value }));
 const summary = summarizeBusinessWindow(observations);
 const end = security.publication?.asOf ?? observations.at(-1)?.date ?? '';
 const comparison = getSnapshotHistoryComparison(snapshot, observations);
 const rate = comparison ? businessChangePercent(comparison.previous, comparison.current) : null;
 const rows = [[company ? '현재 시총' : `현재 ${selected.type || '종목'} 시총`, snapshot.value],
   ...periodMeans(observations, end).map(row => [row.label, row.mean]), ['최저 시총', summary.min], ['최고 시총', summary.max]];
 return <section id="indicators" className="detail-section space-y-5 border-t border-border py-6 sm:py-8" style={backgroundStyle}>
  <h2 className="text-xl font-semibold">핵심 지표</h2>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
   {rows.map(([label,value]) => <div key={String(label)} className="min-w-0 space-y-2 border-b border-border py-4"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold tabular-nums">{value == null ? '—' : `${formatCompactBusinessValue(value)}원`}</p>
   <p className="text-xs text-muted-foreground">{label === rows[0][0] ? snapshot.date ? `지표 기준 ${String(snapshot.date).slice(0,10)}` : '기준일 미확인' : `분석 기준 ${end}`}</p>
   {label === rows[0][0] && <p className="text-xs text-muted-foreground">{rate == null ? '—' : `${comparison!.previousDate} 이력 대비 ${Number(rate) > 0 ? '+' : ''}${Number(rate).toFixed(1)}%`}</p>}</div>)}
   <div className="border-b border-border py-4"><DetailCurrentPrice price={security.prices?.[0]} /></div>
  </div>
  <p className="text-xs text-muted-foreground">{describeMarketcapHistory(observations)} 기간 평균·비교는 표시된 분석 기준일로 계산합니다. 원천의 실제 제공값만 포함하며 0을 보존합니다.</p>
 </section>;
}
