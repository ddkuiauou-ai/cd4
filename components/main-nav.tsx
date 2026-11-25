"use client";
import { SiteDocumentLink as Link } from "@/components/site-document-link";
import { usePathname } from "next/navigation";
import { dashboardLabel } from "@/config/site";
import { isRankingPath } from "@/lib/metric-navigation";
export function MainNav(){
  const pathname=usePathname();
  return <nav className="main-nav" aria-label="주 메뉴">
    <Link prefetch={false} href="/dashboard" aria-current={pathname.startsWith("/dashboard")?"page":undefined}>{dashboardLabel}</Link>
    <Link prefetch={false} href="/" aria-current={isRankingPath(pathname)?"page":undefined}>랭킹</Link>
  </nav>;
}
