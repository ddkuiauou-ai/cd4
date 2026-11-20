"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListOrdered, LoaderCircle, RotateCw, Search } from "lucide-react";
import { useSearchData } from "@/components/search-data";
import { isRankingPath } from "@/lib/metric-navigation";
export function BottomNavigation(){
  const pathname=usePathname();
  const { entryState } = useSearchData();
  const loading = entryState === "loading";
  const needsRetry = entryState === "retry";
  const Icon = loading ? LoaderCircle : needsRetry ? RotateCw : Search;
  return <nav className="bottom-navigation" aria-label="모바일 주 메뉴">
    <Link prefetch={false} href="/dashboard" aria-current={pathname.startsWith("/dashboard")?"page":undefined}><Home size={20} aria-hidden="true"/>메인</Link>
    <Link prefetch={false} href="/" aria-current={isRankingPath(pathname)?"page":undefined}><ListOrdered size={20} aria-hidden="true"/>랭킹</Link>
    <button type="button" disabled={loading}
      aria-label={loading ? "기업·종목 검색 준비 중" : needsRetry ? "기업·종목 검색 다시 시도" : "검색"}
      onClick={event => {
        event.currentTarget.focus({ preventScroll: true });
        window.dispatchEvent(new Event("app:open-search"));
      }}>
      <Icon size={20} className={loading ? "search-loading-icon" : undefined} aria-hidden="true" />
      {loading ? "준비 중" : needsRetry ? "다시 시도" : "검색"}
    </button>
  </nav>;
}
