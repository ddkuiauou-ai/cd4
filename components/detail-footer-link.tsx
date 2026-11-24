"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { metricItems } from "@/lib/metric-navigation";

export function DetailFooterLink({ className }: { className: string }) {
  const [, scope, , metric] = usePathname().split("/");
  const item = metricItems.find(({ key }) => key === metric);

  if (scope === "company") {
    return <Link prefetch={false} href="/marketcaps" className={className}>기업 합산 시총 순위 보기</Link>;
  }
  if (scope === "security" && item) {
    const href = item.key === "marketcap" ? "/marketcap" : item.href;
    const label = item.key === "marketcap" ? "종목별 시총 순위 보기" : `${item.label} 전체 순위 보기`;
    return <Link prefetch={false} href={href} className={className}>{label}</Link>;
  }
  return <Link prefetch={false} href="/" className={className}>전체 랭킹 보기</Link>;
}
