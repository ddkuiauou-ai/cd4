import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";
import type { Security } from "@/typings";
import Rate from "@/components/rate";

export default function CardMarketcap({ security, name, href, market = 'KOSPI', isSelected = false,
    isCompanyPage = false, currentMetric = 'marketcap' }: {
    security: Security; name?: string; href?: string; market?: string; isSelected?: boolean;
    isCompanyPage?: boolean; currentMetric?: string;
}) {
    const metric = currentMetric as keyof Security;
    const rawValue = (security as any)[metric] as number | null | undefined;
    const value = rawValue == null || !Number.isFinite(rawValue) ? '—'
        : currentMetric === 'marketcap' ? `${formatNumber(rawValue)}원`
        : ['per', 'pbr'].includes(currentMetric) ? `${rawValue.toFixed(2)}배`
        : currentMetric === 'div' ? `${rawValue.toFixed(2)}%` : `${rawValue.toLocaleString('ko-KR')}원`;
    const selected = isSelected || Boolean(name && security.name === name);
    const code = `${security.exchange || market}.${security.ticker || security.name}`;
    const target = href ? (href.endsWith('/') ? `${href}${security.ticker || security.name}` : href)
        : `/security/${code}/${currentMetric}`;
    const price = security.prices?.[0];
    return <Link href={target} aria-current={selected ? 'page' : undefined} data-sec-id={security.securityId}
        className={cn('security-link-row flex min-w-0 items-center gap-3 border-b border-border px-1 py-4 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            selected && 'bg-muted/40') }>
        <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{security.korName || security.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{security.ticker} · {security.type || (isCompanyPage ? '종목' : '')}</span>
        </span>
        <span className="shrink-0 text-right tabular-nums">
            <span className="block text-sm font-semibold">{value}</span>
            {price?.close != null && <span className="mt-1 block text-xs text-muted-foreground">
                {price.close.toLocaleString('ko-KR')}원 {price.rate != null && <Rate rate={price.rate} />}
            </span>}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>;
}
