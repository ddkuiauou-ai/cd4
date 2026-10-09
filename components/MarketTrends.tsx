"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatBusinessValue } from "@/lib/business-analysis";
import { formatRankingRate, type RankingAmount } from "@/lib/ranking-view";

export interface TrendItem { name: string; korName: string; securityId: string; href: string; price: RankingAmount; changePercent: number | null; priceDate: string | null; volume: RankingAmount }
export default function MarketTrends({ gainers = [], losers = [], volume = [], date, sampleCount, className }: {
  gainers: TrendItem[]; losers: TrendItem[]; volume: TrendItem[]; date?: string; sampleCount: number; className?: string;
}) {
  const [active, setActive] = useState("gainers");
  const rows = (items: TrendItem[]) => items.length ? items.slice(0, 5).map(item => <Link prefetch={false} key={item.securityId} href={item.href} className="trend-row">
    <span className="trend-name">{item.korName || item.name}<span className="block text-xs font-normal text-muted-foreground mt-1">{item.priceDate ?? "가격 관측일 없음"}</span></span>
    <span className="trend-price">{active === "volume" ? `${formatBusinessValue(item.volume)}주` : item.price !== null ? `${formatBusinessValue(item.price)}원` : "가격 정보 없음"}</span>
    <span className={item.changePercent !== null && item.changePercent > 0 ? "market-up" : item.changePercent !== null && item.changePercent < 0 ? "market-down" : "text-muted-foreground"}>{formatRankingRate(item.changePercent)}</span>
  </Link>) : <p className="empty-state data-note">{active === "volume" ? "이 범위에 제공된 거래량 관측이 없습니다." : "이 범위에 해당하는 가격 등락 관측이 없습니다."}</p>;
  return <section className={cn("dashboard-trends", className)} aria-labelledby="market-trends"><div className="section-header"><h2 id="market-trends" className="section-heading">상위 기업의 주가 흐름</h2><span className="data-note">가격 관측일 {date ?? "정보 없음"}</span></div><p className="data-note mb-4">시가총액 상위 {sampleCount}개 기업의 대표 보통주 내 비교 · 등락은 저장된 전일 대비</p><Tabs value={active} onValueChange={setActive}><TabsList className="trend-tabs"><TabsTrigger value="gainers">상승</TabsTrigger><TabsTrigger value="losers">하락</TabsTrigger><TabsTrigger value="volume">거래량</TabsTrigger></TabsList><TabsContent value="gainers">{rows(gainers)}</TabsContent><TabsContent value="losers">{rows(losers)}</TabsContent><TabsContent value="volume">{rows(volume)}</TabsContent></Tabs></section>;
}
