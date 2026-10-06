import type { DetailSecurity, DetailSecurityRow, DetailCompanyData } from './detail-types';
import Link from 'next/link';
import { CompanyFinancialTabs } from './company-financial-tabs';
import { StickyCompanyHeader } from './sticky-company-header';
import { SidebarManager } from './sidebar-manager';
import { RecentSecurityTracker } from './recent-security-tracker';
import { InteractiveSecuritiesSection } from './simple-interactive-securities';
import ShareButton from './share-button';
import RankHeader from './header-rank';
import type { MetricType } from '@/lib/recent-securities';
import { siteConfig } from '@/config/site';

export function SecurityMetricEmpty({ secCode, displayName, metricLabel, metricType, security,
    companySecs = [], companyMarketcapData, rank = null, rankDate }: {
    secCode: string; displayName: string; metricLabel: string; metricType: MetricType;
    security: DetailSecurity; companySecs?: DetailSecurityRow[]; companyMarketcapData?: DetailCompanyData;
    rank?: number | null; rankDate?: string | null;
}) {
    const value = security[metricType];
    const date = security[`${metricType}Date`];
    const dateLabel = date && !Number.isNaN(new Date(date).getTime())
        ? new Date(date).toISOString().slice(0, 10) : '—';
    const comparisonSecurities = security.companyId && !companySecs.some(item => item.securityId === security.securityId)
        ? [...companySecs, security] : companySecs;
    return <div className="app-container detail-grid">
        <RecentSecurityTracker secCode={secCode} name={security.name || displayName} korName={security.korName}
            ticker={security.ticker} exchange={security.exchange || 'KOSPI'} metricType={metricType} metricValue={value} />
        <div className="detail-content min-w-0">
            <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground"><Link href="/">홈</Link> · {displayName} · {metricLabel}</nav>
            <StickyCompanyHeader displayName={displayName} companyName={security.company?.korName}
                logoUrl={security.company?.logo} titleSuffix={metricLabel} titleBadge={security.type}
                actions={<ShareButton title={`${displayName} ${security.type || '종목'} ${metricLabel}`}
                    text={`${displayName}의 ${metricLabel}와 종목 정보를 ${siteConfig.name}에서 확인하세요.`}
                    url={`${siteConfig.url}/security/${secCode}/${metricType}/`} />} />
            <RankHeader rank={rank} rankLabel={`종목 ${metricLabel} 순위`} marketcap={value ?? undefined} price={security.prices?.[0]?.close} exchange={security.exchange}
                marketcapLabel={`현재 ${metricLabel}`} marketcapUnit={['per', 'pbr'].includes(metricType) ? '배' : metricType === 'div' ? '%' : '원'}
                marketcapDate={date ?? null} priceDate={security.prices?.[0]?.date ?? null} />
            <p className="mt-2 text-xs text-muted-foreground">{security.type || '종목'} · {security.ticker} · 지표 기준 {dateLabel} · 순위 기준 {rankDate || '—'}</p>
            <CompanyFinancialTabs secCode={secCode} className="mt-4" />
            <section className="my-8 border-y border-border py-8">
                <h2 className="text-lg font-semibold">{metricLabel} 이력 준비 중</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">이 종목의 {metricLabel} 이력이 아직 등록되지 않았습니다. 다른 지표와 기본 종목 정보는 계속 확인할 수 있습니다.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                    <Link href={`/security/${secCode}`} className="inline-flex min-h-11 items-center border border-border px-4 text-sm font-medium hover:bg-muted">기본 종목 정보 보기</Link>
                    {metricType !== 'marketcap' && <Link href={`/security/${secCode}/marketcap`} className="inline-flex min-h-11 items-center border border-border px-4 text-sm font-medium hover:bg-muted">시가총액 보기</Link>}
                </div>
            </section>
            {comparisonSecurities.length > 0 && <InteractiveSecuritiesSection
                companyMarketcapData={companyMarketcapData} companySecs={comparisonSecurities}
                currentTicker={security.ticker} market={security.exchange || 'KOSPI'} currentMetric={metricType} />}
        </div>
        <aside className="context-rail hidden xl:block">
            <SidebarManager navigationSections={[]} periodAnalysis={null} perRank={rank} rankDate={rankDate} security={security}
                secCode={secCode} metricType={metricType} companySecs={comparisonSecurities} companyMarketcapData={companyMarketcapData}
                currentTicker={security.ticker} selectedSecurityType={security.type || '종목'}
                market={security.exchange || 'KOSPI'} hasCompanyMarketcapData={comparisonSecurities.length > 0} />
        </aside>
    </div>;
}
