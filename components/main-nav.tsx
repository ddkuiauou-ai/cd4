"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isRankingPath } from "@/lib/metric-navigation";
export function MainNav(){
  const pathname=usePathname();
  return <nav className="main-nav" aria-label="주 메뉴">
    <Link href="/dashboard" aria-current={pathname.startsWith("/dashboard")?"page":undefined}>메인</Link>
    <Link href="/" aria-current={isRankingPath(pathname)?"page":undefined}>랭킹</Link>
  </nav>;
}
