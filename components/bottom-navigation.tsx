"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home,ListOrdered,Search } from "lucide-react";
import { isRankingPath } from "@/lib/metric-navigation";
export function BottomNavigation(){
  const pathname=usePathname();
  return <nav className="bottom-navigation" aria-label="모바일 주 메뉴">
    <Link prefetch={false} href="/dashboard" aria-current={pathname.startsWith("/dashboard")?"page":undefined}><Home size={20} aria-hidden="true"/>메인</Link>
    <Link prefetch={false} href="/" aria-current={isRankingPath(pathname)?"page":undefined}><ListOrdered size={20} aria-hidden="true"/>랭킹</Link>
    <button type="button" onClick={()=>window.dispatchEvent(new Event("app:open-search"))}><Search size={20} aria-hidden="true"/>검색</button>
  </nav>;
}
