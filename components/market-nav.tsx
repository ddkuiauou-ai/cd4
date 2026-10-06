"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { metricItems } from "@/lib/metric-navigation";
import { cn } from "@/lib/utils";
export function CorpSecTabs({path}:{path:string}){
  const company=path==="/"||path.startsWith("/marketcaps");
  return <nav className="flex gap-2" aria-label="시가총액 조회 범위"><Link href="/marketcaps" aria-current={company?"page":undefined}>기업 합산</Link><Link href="/marketcap" aria-current={!company?"page":undefined}>종목</Link></nav>;
}
export function MarketNav({className,showCorpSecTabs=false}:{className?:string;showCorpSecTabs?:boolean}){
  const pathname=usePathname(); const company=pathname==="/"||pathname.startsWith("/marketcaps");
  const marketcap=company||/^\/marketcap(?:\/|$)/.test(pathname);
  return <><nav className={cn("metric-nav",className)} aria-label="전체 순위 지표">
    {metricItems.map(item=>{
      const href=item.key==="marketcap"?(company?"/marketcaps":"/marketcap"):item.href;
      const active=item.key==="marketcap"?marketcap:pathname===item.href||pathname.startsWith(item.href+"/");
      return <Link key={item.key} href={href} aria-current={active?"page":undefined} title={item.name}>{item.label}</Link>;
    })}
  </nav>{showCorpSecTabs&&marketcap?<CorpSecTabs path={pathname}/>:null}</>;
}
