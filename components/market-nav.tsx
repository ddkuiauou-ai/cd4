"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { metricItems } from "@/lib/metric-navigation";
import { cn } from "@/lib/utils";
import type { RankingMetric, RankingScope } from "@/lib/ranking-view";
import styles from "./ranking-view.module.css";
export function CorpSecTabs({path}:{path:string}){
  const company=path==="/"||path.startsWith("/marketcaps");
  return <nav className="flex gap-2" aria-label="시가총액 조회 범위"><Link prefetch={false} href="/marketcaps" aria-current={company?"page":undefined}>기업 합산</Link><Link prefetch={false} href="/marketcap" aria-current={!company?"page":undefined}>종목</Link></nav>;
}
export function MarketNav({className,showCorpSecTabs=false,metric,scope,scopeKey="krx-all"}:{className?:string;showCorpSecTabs?:boolean;metric?:RankingMetric;scope?:RankingScope;scopeKey?:string}){
  const navRef=useRef<HTMLElement>(null);
  const pathname=usePathname(); const company=scope ? scope==="company" : pathname==="/"||pathname.startsWith("/marketcaps");
  const marketcap=metric ? metric==="marketcap" : company||/^\/marketcap(?:\/|$)/.test(pathname);
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
  },[metric,pathname]);
  return <><nav ref={navRef} className={cn(styles.metricNavigation,className)} aria-label="전체 순위 지표">
    {metricItems.map(item=>{
      const base=item.key==="marketcap"?(company?"/marketcaps":"/marketcap"):item.href;
      const href=scopeKey!=="krx-all" && !(item.key==="marketcap"&&company) ? `${base}?scope=${encodeURIComponent(scopeKey)}` : base;
      const active=metric ? item.key===metric : item.key==="marketcap"?marketcap:pathname===item.href||pathname.startsWith(item.href+"/");
      return <Link prefetch={false} key={item.key} href={href} aria-current={active?"page":undefined} title={item.name}>{item.label}</Link>;
    })}
  </nav>{showCorpSecTabs&&marketcap?<CorpSecTabs path={pathname}/>:null}</>;
}
