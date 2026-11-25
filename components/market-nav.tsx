"use client";
import { SiteDocumentLink as Link } from "@/components/site-document-link";
import { useEffect, useId, useRef } from "react";
import { usePathname } from "next/navigation";
import { metricItems, RANKING_METRIC_NAV_ID } from "@/lib/metric-navigation";
import { cn } from "@/lib/utils";
import type { RankingMetric, RankingScope } from "@/lib/ranking-view";
import styles from "./ranking-view.module.css";
const companyMarketCapPath = "/marketcaps";
const securityMarketCapPath = "/marketcap";
const marketCapRankings = [
  { href: companyMarketCapPath, label: "기업 합산", name: "기업 합산 시가총액" },
  { href: securityMarketCapPath, label: "종목별", name: "종목별 시가총액" },
];
const metricRankings = [
  ...metricItems.filter(item => item.key !== "marketcap" && item.key !== "div"),
  ...metricItems.filter(item => item.key === "div"),
];

interface MarketNavProps {
  className?: string;
  metric?: RankingMetric;
  scope?: RankingScope;
  scopeKey?: string;
}

export function MarketNav({ className, metric, scope, scopeKey = "krx-all" }: MarketNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const marketCapLabelId = useId();
  const pathname = usePathname();
  let activePath = pathname === "/" ? companyMarketCapPath : pathname;
  if (metric && metric !== "marketcap") activePath = `/${metric}`;
  if (metric === "marketcap" && scope) {
    activePath = scope === "company" ? companyMarketCapPath : securityMarketCapPath;
  }
  const marketQuery = scopeKey === "krx-all" ? "" : `?scope=${encodeURIComponent(scopeKey)}`;

  useEffect(()=>{
    const nav=navRef.current;
    if(!nav) return;
    const revealSelected=()=>{
      if(!nav.clientWidth||nav.scrollWidth<=nav.clientWidth) return;
      const selected=nav.querySelector<HTMLElement>('a[aria-current="page"]');
      if(!selected) return;
      const bounds=nav.getBoundingClientRect(), item=selected.getBoundingClientRect();
      // Scroll only this menu, preserving the page's vertical position.
      if(item.left<bounds.left+6) nav.scrollLeft=Math.max(0,nav.scrollLeft+item.left-bounds.left-6);
      else if(item.right>bounds.right-6) nav.scrollLeft+=item.right-bounds.right+6;
    };
    revealSelected();
    if(typeof ResizeObserver==="undefined") return;
    const observer=new ResizeObserver(revealSelected);
    observer.observe(nav);
    return ()=>observer.disconnect();
  }, [activePath]);

  function renderRankingLink(item: (typeof marketCapRankings)[number]) {
    const active = activePath === item.href || activePath?.startsWith(`${item.href}/`);
    const href = item.href === companyMarketCapPath ? item.href : `${item.href}${marketQuery}`;
    return <Link key={item.href} href={href} prefetch={false} aria-current={active ? "page" : undefined} title={item.name}>{item.label}</Link>;
  }

  return (
    <nav ref={navRef} id={metric ? RANKING_METRIC_NAV_ID : undefined} tabIndex={metric ? -1 : undefined}
      className={cn(styles.metricNavigation, className)} aria-label="전체 순위 지표">
      <div className={styles.marketCapGroup} role="group" aria-labelledby={marketCapLabelId}>
        <span id={marketCapLabelId} className={styles.marketCapLabel}>시가총액</span>
        {marketCapRankings.map(renderRankingLink)}
      </div>
      {metricRankings.map(renderRankingLink)}
    </nav>
  );
}
