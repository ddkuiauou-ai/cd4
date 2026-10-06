"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { metricItems } from "@/lib/metric-navigation";
import { cn } from "@/lib/utils";

export function CompanyFinancialTabs({ secCode, className }: { secCode: string; className?: string }) {
    const pathname = usePathname();
    const companyContext = pathname.startsWith('/company/');
    const currentMetric = pathname.split('/').filter(Boolean).at(-1);
    return <nav aria-label="이 종목의 투자 지표" className={cn('detail-metric-nav flex w-full overflow-x-auto border-b border-border', className)}>
        {metricItems.map(({ key: metric, label }) => {
            const href = `/${metric === 'marketcap' && companyContext ? 'company' : 'security'}/${secCode}/${metric}`;
            const active = currentMetric === metric;
            return <Link key={metric} href={href} aria-current={active ? 'page' : undefined}
                className={cn('shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                    active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                {label}
            </Link>;
        })}
    </nav>;
}
