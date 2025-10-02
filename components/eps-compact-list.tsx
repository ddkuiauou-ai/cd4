"use client";

import Link from "next/link";
import CompanyLogo from "@/components/CompanyLogo";
import Exchange from "@/components/exchange";
import Rate from "@/components/rate";
import SpikeChart from "@/components/spike-chart";
import RankChange from "@/components/rank-change";

type Security = {
  exchange?: string | null;
  ticker?: string | null;
  prices?: { open?: number | null; high?: number | null; low?: number | null; close?: number | null; rate?: number | null; date?: string | Date }[];
};

type Item = {
  securityId?: string;
  companyId?: string | number;
  name?: string | null;
  korName?: string | null;
  logo?: string | null;
  epsRank?: number | null;
  epsPriorRank?: number | null;
  eps?: number | null;
  securities?: Security[];
  prices?: { close?: number; rate?: number; open?: number; date?: string }[];
  exchange?: string;
  ticker?: string;
};

interface Props {
  items: Item[];
  limit?: number;
  className?: string;
  metric?: 'marketcap' | 'per' | 'div' | 'dps' | 'bps' | 'pbr' | 'eps';
}

export default function EpsCompactList({ items, limit, className, metric = 'eps' }: Props) {
  // Determine linkType based on data structure - if first item has securityId, it's security data
  const linkType = items.length > 0 && items[0].securityId ? 'security' : 'company';
  const list = (limit ? items.slice(0, limit) : items).filter(Boolean);

  return (
    <div className={className}>
      <ul className="-mx-4 sm:-mx-6 lg:mx-0 divide-y divide-border border-y border-border text-[13px] sm:text-sm">
        {list.map((it) => {
          const companyName = it.korName || it.name || "";
          const logoUrl = (it as any).company?.logo ?? it.logo ?? null;
          const rank = it.epsRank ?? null;
          const ex = it.exchange || it.securities?.[0]?.exchange || "";
          const tk = it.ticker || it.securities?.[0]?.ticker || "";
          const prices = it.prices || it.securities?.[0]?.prices || [];
          const last = prices.length > 0 ? prices[prices.length - 1] : undefined;
          const close = last?.close ?? null;
          const rate = (last as any)?.rate ?? null;
          const eps = it.eps ?? null;

          return (
            <li key={it.securityId ?? it.companyId ?? `${ex}.${tk}`} className="px-4 sm:px-6 py-3">
              <div className="flex w-full items-center justify-between gap-x-3">
                <div className="w-12 text-center font-semibold text-sm text-muted-foreground tabular-nums shrink-0">
                  <div>{rank != null ? `${rank}위` : "—"}</div>
                  <RankChange currentRank={it.epsRank} priorRank={it.epsPriorRank} />
                </div>

                <Link
                  href={ex && tk ? `/${linkType}/${ex}.${tk}/${metric}` : "#"}
                  className="flex items-center gap-3 group min-w-0"
                >
                  <div className="shrink-0">
                    <CompanyLogo companyName={companyName} logoUrl={logoUrl || undefined} size={32} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {companyName}
                    </div>
                    <div className="flex text-xs text-muted-foreground items-center gap-2">
                      <Exchange exchange={ex as string} />
                      <span className="font-mono">{tk}</span>
                    </div>
                  </div>
                </Link>

                <div className="text-right font-semibold tabular-nums shrink-0">
                  {eps != null ? `${eps.toLocaleString()}원` : "—"}
                </div>

                <div className="hidden sm:block text-right text-muted-foreground tabular-nums shrink-0">
                  {close != null ? `${close.toLocaleString()}` : "—"}
                </div>

                <div className="hidden md:block text-right shrink-0">
                  {rate != null ? <Rate rate={rate as number} size="sm" /> : null}
                </div>

                {prices && prices.length > 1 ? (
                  <div className="relative shrink-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 hidden sm:block md:hidden">
                      {rate != null ? <Rate rate={rate as number} size="xs" /> : null}
                    </div>
                    <div className="absolute top-[-8px] left-0 sm:hidden">
                      {rate != null ? <Rate rate={rate as number} size="xs" /> : null}
                    </div>
                    <div className="sm:hidden">
                      <SpikeChart prices={prices.slice(-30) as any} rate={rate as number | undefined} width={100} height={40} />
                    </div>
                    <div className="hidden sm:block">
                      <SpikeChart prices={prices.slice(-30) as any} rate={rate as number | undefined} width={150} height={40} />
                    </div>
                    <div className="absolute bottom-[-8px] right-0 sm:hidden text-xs font-semibold">
                      {close != null ? `${close.toLocaleString()}원` : ""}
                    </div>
                  </div>
                ) : (
                  <div className="w-[150px] shrink-0" />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
