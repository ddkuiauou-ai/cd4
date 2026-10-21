"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Home, ListOrdered, Menu, Search } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { metricItems, isRankingPath } from "@/lib/metric-navigation";

export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetTrigger asChild>
      <button type="button" className="header-menu-trigger" aria-label="서비스 메뉴 열기"><Menu size={23} aria-hidden="true" /></button>
    </SheetTrigger>
    <SheetContent side="right" className="site-menu-content">
      <SheetTitle className="section-heading">대회 기록실</SheetTitle>
      <SheetDescription>궁금한 숫자에서 다음 종목까지</SheetDescription>
      <nav aria-label="서비스 메뉴" className="site-menu-links">
        <SheetClose asChild><Link href="/dashboard" prefetch={false} aria-current={pathname.startsWith('/dashboard') ? 'page' : undefined}><Home size={19} aria-hidden="true" />메인</Link></SheetClose>
        <SheetClose asChild><Link href="/" prefetch={false} aria-current={isRankingPath(pathname) ? 'page' : undefined}><ListOrdered size={19} aria-hidden="true" />전체 랭킹</Link></SheetClose>
        <SheetClose asChild><button type="button" onClick={() => window.dispatchEvent(new Event('app:open-search'))}><Search size={19} aria-hidden="true" />기업·종목 검색</button></SheetClose>
      </nav>
      <h2 className="site-menu-heading">종목 지표 순위</h2>
      <nav aria-label="지표별 전체 순위" className="site-menu-metrics">
        {metricItems.map(item => <SheetClose asChild key={item.key}><Link href={item.key === 'marketcap' ? '/marketcap' : item.href} prefetch={false}>{item.label}<ArrowUpRight size={15} aria-hidden="true" /></Link></SheetClose>)}
      </nav>
    </SheetContent>
  </Sheet>;
}
