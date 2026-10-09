"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { metricItems } from "@/lib/metric-navigation";
import { cn } from "@/lib/utils";
import { companyPath, securityPath, type CompanyRouteIdentity, type SecurityRouteIdentity } from "@/lib/entity-paths";

export function CompanyFinancialTabs({ secCode, security, company, className }: {
    secCode?: string;
    security?: SecurityRouteIdentity;
    company?: CompanyRouteIdentity;
    className?: string;
}) {
    const pathname = usePathname();
    const companyContext = pathname.startsWith('/company/');
    const currentMetric = pathname.split('/').filter(Boolean).at(-1);
    return <nav aria-label="이 종목의 투자 지표" className={cn('detail-metric-nav flex w-full overflow-x-auto border-b border-border', className)}>
        {metricItems.map(({ key: metric, label }) => {
            const companyMetric = metric === 'marketcap' && companyContext;
            const href = companyMetric && company ? companyPath(company, metric)
                : security ? securityPath(security, metric)
                : secCode ? `/${companyMetric ? 'company' : 'security'}/${encodeURIComponent(secCode)}/${metric}` : null;
            const active = currentMetric === metric;
            if (!href) return <span key={metric} className="shrink-0 px-4 py-3 text-sm text-muted-foreground" title="연결된 종목이 없습니다">{label}</span>;
            return <Link key={metric} href={href} prefetch={false} aria-current={active ? 'page' : undefined}
                className={cn('shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                    active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                {label}
            </Link>;
        })}
    </nav>;
}
