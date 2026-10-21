"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { metricItems } from "@/lib/metric-navigation";
import { cn } from "@/lib/utils";
import { companyPath, securityPath, type CompanyRouteIdentity, type SecurityRouteIdentity } from "@/lib/entity-paths";

export function CompanyFinancialTabs({ secCode, security, company, className, periodId, start, end }: {
    secCode?: string;
    security?: SecurityRouteIdentity;
    company?: CompanyRouteIdentity;
    className?: string;
    periodId?: string;
    start?: string;
    end?: string;
}) {
    const pathname = usePathname().replace(/\/$/, '');
    const companyContext = pathname.startsWith('/company/');
    const base = companyContext
        ? company ? companyPath(company) : secCode ? `/company/${encodeURIComponent(secCode)}` : null
        : security ? securityPath(security) : secCode ? `/security/${encodeURIComponent(secCode)}` : null;
    const items = companyContext
        ? [{key: 'basic', label: '기업 정보'}, {key: 'marketcap', label: '기업 합산 시총'}]
        : [{key: 'basic', label: '기본 정보'}, ...metricItems];
    return <nav aria-label={companyContext ? '기업 상세 페이지' : '종목 상세 페이지'}
        className={cn('detail-metric-nav', companyContext && 'detail-company-nav', className)}>
        {items.map(({key, label}) => {
            const baseHref = base ? `${base}${key === 'basic' ? '' : `/${key}`}` : null;
            const query = new URLSearchParams();
            if (start) query.set('start', start);
            if (end) query.set('end', end);
            if (periodId && !companyContext) query.set('period', periodId);
            const href = baseHref && query.size ? `${baseHref}?${query}` : baseHref;
            const active = pathname === baseHref;
            if (!href) return <span key={key} aria-disabled="true" title="연결된 대상이 없습니다">{label}</span>;
            return <Link key={key} href={href} prefetch={false} aria-current={active ? 'page' : undefined}>{label}</Link>;
        })}
    </nav>;
}
