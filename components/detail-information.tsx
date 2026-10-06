import type { DetailSecurity, DetailSecurityRow, DetailCompanyData } from './detail-types';
import Link from 'next/link';
import { CompanyFinancialTabs } from './company-financial-tabs';
import { StickyCompanyHeader } from './sticky-company-header';
import { SidebarManager } from './sidebar-manager';
import { RecentSecurityTracker } from './recent-security-tracker';
import RankHeader from './header-rank';
import Rate from './rate';
import { DetailMobileNavigation } from './detail-mobile-navigation';

const dateLabel = (date: Date | string | null | undefined) => date && !Number.isNaN(new Date(date).getTime())
    ? new Date(date).toISOString().slice(0, 10) : '—';
const numberLabel = (value: number | bigint | null | undefined, unit = '') => value != null ? `${value.toLocaleString('ko-KR')}${unit}` : '—';

export function DetailInformation({ secCode, security, company = false, companySecs, companyMarketcapData }: {
    secCode: string; security: DetailSecurity; company?: boolean; companySecs: DetailSecurityRow[]; companyMarketcapData: DetailCompanyData;
}) {
    const name = security.korName || security.name || secCode;
    const price = security.prices?.[0];
    const corporation = security.company;
    const currentMarketcap = company ? companyMarketcapData?.totalMarketcap ?? corporation?.marketcap : security.marketcap;
    const currentDate = company ? companyMarketcapData?.totalMarketcapDate : security.marketcapDate;
    const navigationSections = [{ id: 'basic-information', label: '기본 정보' }, { id: 'price-information', label: '주가 정보' }, ...(corporation ? [{ id: 'company-information', label: '기업 정보' }] : [])];
    const facts = [
        ['종목코드', security.ticker], ['구분', security.type], ['거래소', security.exchange],
        ['영문명', security.name], ['발행주식 수', numberLabel(security.shares, '주')], ['발행주식 기준일', dateLabel(security.sharesDate)],
    ];
    return <div className="app-container detail-grid">
        <RecentSecurityTracker secCode={secCode} name={security.name || name} korName={security.korName}
            ticker={security.ticker} exchange={security.exchange || 'KOSPI'} metricType="marketcap" metricValue={security.marketcap} />
        <div className="detail-content min-w-0">
            <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground"><Link href="/">홈</Link> · {company ? '기업' : '종목'} · {name}</nav>
            <StickyCompanyHeader displayName={name} companyName={corporation?.korName || corporation?.name}
                logoUrl={corporation?.logo} titleSuffix="기본 정보" titleBadge={company ? '기업 전체' : security.type} />
            <RankHeader rank={company ? corporation?.marketcapRank : null} marketcap={currentMarketcap ?? undefined}
                price={price?.close} exchange={security.exchange} isCompanyLevel={company} />
            <p className="mt-2 text-xs text-muted-foreground">{company ? '보통주·우선주 합산' : `${security.type || '종목'} · ${security.ticker}`} · 시가총액 기준 {dateLabel(currentDate)}</p>
            <CompanyFinancialTabs secCode={secCode} className="mt-4" />
            <DetailMobileNavigation sections={navigationSections} />
            <section id="basic-information" className="detail-section border-t border-border py-8">
                <h2 className="mb-5 text-xl font-semibold">{company ? '기업' : '종목'} 기본 정보</h2>
                <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                    {facts.map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-border py-3"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium tabular-nums">{value || '—'}</dd></div>)}
                </dl>
            </section>
            <section id="price-information" className="detail-section border-t border-border py-8">
                <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-semibold">주가 정보</h2><p className="text-xs text-muted-foreground">거래 기준 {dateLabel(price?.date)}</p></div>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-5 text-sm sm:grid-cols-4">
                    <div><dt className="mb-2 text-muted-foreground">현재가</dt><dd className="font-semibold tabular-nums">{numberLabel(price?.close, '원')}</dd></div>
                    <div><dt className="mb-2 text-muted-foreground">가격 등락률</dt><dd className="font-semibold tabular-nums">{price?.rate != null ? <Rate rate={price.rate} /> : '—'}</dd></div>
                    <div><dt className="mb-2 text-muted-foreground">시가</dt><dd className="font-semibold tabular-nums">{numberLabel(price?.open, '원')}</dd></div>
                    <div><dt className="mb-2 text-muted-foreground">거래량</dt><dd className="font-semibold tabular-nums">{numberLabel(price?.volume, '주')}</dd></div>
                </dl>
            </section>
            {corporation && <section id="company-information" className="detail-section border-t border-border py-8">
                <h2 className="mb-5 text-xl font-semibold">기업 정보</h2>
                <dl className="space-y-4 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">기업명</dt><dd>{corporation.korName || corporation.name || '—'}</dd></div>
                    {corporation.sector && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">섹터</dt><dd>{corporation.sector}</dd></div>}
                    {corporation.industry && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">업종</dt><dd>{corporation.industry}</dd></div>}
                    {corporation.establishedDate && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">설립일</dt><dd>{dateLabel(corporation.establishedDate)}</dd></div>}
                    {corporation.homepage && <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">홈페이지</dt><dd className="min-w-0 break-all"><a href={corporation.homepage} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{corporation.homepage}</a></dd></div>}
                </dl>
            </section>}
        </div>
        <aside className="context-rail hidden xl:block">
            <SidebarManager navigationSections={navigationSections}
                periodAnalysis={null} perRank={null} security={security} secCode={secCode} metricType="marketcap"
                companySecs={companySecs} companyMarketcapData={companyMarketcapData} currentTicker={security.ticker}
                selectedSecurityType={company ? '시가총액 구성' : security.type ?? undefined} market={security.exchange || 'KOSPI'} hasCompanyMarketcapData={companySecs.length > 0} />
        </aside>
    </div>;
}
