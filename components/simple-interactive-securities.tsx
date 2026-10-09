"use client";

import type { DetailCompanyData, DetailSecurityRow } from './detail-types';
import Link from "next/link";
import { companyPath, securityPath } from "@/lib/entity-paths";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import CardMarketcap from "@/components/card-marketcap";
import { cn, formatNumber } from "@/lib/utils";

interface InteractiveSecuritiesSectionProps {
    companyMarketcapData: DetailCompanyData;
    companySecs: DetailSecurityRow[];
    currentTicker: string;
    currentSecurityId?: string;
    market: string;
    onTickerChange?: (newTicker: string) => void;
    baseUrl?: string;
    currentMetric?: string;
    layout?: 'main' | 'sidebar';
    maxItems?: number;
    showSummaryCard?: boolean;
    compactMode?: boolean;
    highlightActiveTicker?: boolean;
    defaultFilter?: string;
}

export function InteractiveSecuritiesSection({ companyMarketcapData, companySecs, currentTicker, currentSecurityId, market,
    currentMetric = 'marketcap', layout = 'main', maxItems, showSummaryCard = true,
    highlightActiveTicker = true }: InteractiveSecuritiesSectionProps) {
    const pathname = usePathname();
    const [showAll, setShowAll] = useState(false);
    // Every row is selected by the concrete security id/ticker, including distinct preferred classes.
    const securities = [...companySecs].sort((a, b) => {
        const aCommon = a.type?.includes('보통주') ? 0 : 1;
        const bCommon = b.type?.includes('보통주') ? 0 : 1;
        return aCommon - bCommon || (a.type || '').localeCompare(b.type || '');
    });
    const companyHref = companyMarketcapData ? companyPath(companyMarketcapData, 'marketcap') : null;
    const summarySelected = pathname.startsWith('/company/');
    const limit = maxItems ?? (layout === 'sidebar' ? 4 : 6);
    const visible = showAll ? securities : securities.slice(0, limit);
    return <section className={cn('security-comparison space-y-2', layout === 'sidebar' && 'border-t border-border pt-5')}>
        <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold">종목별 비교</h3>
            <span className="text-xs text-muted-foreground">{securities.length}개 종목</span>
        </div>
        {showSummaryCard && companyHref && <Link href={companyHref}
            aria-current={summarySelected ? 'page' : undefined}
            className={cn('flex min-w-0 items-center gap-3 border-b border-border py-4 hover:bg-muted/30', summarySelected && 'font-semibold')}>
            <span className="min-w-0 flex-1 text-sm">기업 전체 시가총액<span className="mt-1 block text-xs font-normal text-muted-foreground">보통주·우선주 합산</span></span>
            <span className="text-right text-sm font-semibold tabular-nums">{companyMarketcapData?.totalMarketcap != null ? `${formatNumber(companyMarketcapData.totalMarketcap)}원` : '—'}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>}
        {visible.length > 0 ? <div>{visible.map(security => <CardMarketcap
            key={security.securityId || security.ticker} security={security} market={market}
            currentMetric={currentMetric} isCompanyPage
            isSelected={highlightActiveTicker && !summarySelected && (currentSecurityId ? security.securityId === currentSecurityId : security.ticker === currentTicker)}
            href={securityPath(security,currentMetric)} />)}</div>
            : <p className="py-4 text-sm text-muted-foreground">비교할 종목 정보가 없습니다.</p>}
        {securities.length > limit && <button type="button" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}
            className="min-h-10 w-full text-sm text-muted-foreground hover:text-foreground">{showAll ? '접기' : `종목 ${securities.length}개 모두 보기`}</button>}
    </section>;
}

export default InteractiveSecuritiesSection;
