"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBusinessValue } from "@/lib/business-analysis";
import { formatRankingRate, type RankingAmount } from "@/lib/ranking-view";
import styles from "./dashboard.module.css";

export interface TrendItem { name: string; korName: string; securityId: string; href: string; price: RankingAmount; changePercent: number | null; priceDate: string | null; volume: RankingAmount; ticker?: string; exchange?: string; stockType?: string | null }
export default function MarketTrends({ gainers = [], losers = [], volume = [], date, sampleCount, className }: {
  gainers: TrendItem[]; losers: TrendItem[]; volume: TrendItem[]; date?: string; sampleCount: number; className?: string;
}) {
  const [active, setActive] = useState("gainers");
  const rows = (items: TrendItem[]) => items.length ? items.slice(0, 5).map((item,index) => <Link prefetch={false} key={item.securityId} href={item.href} className={styles.trendRow} title={`${item.korName || item.name} 종목 시가총액 상세 보기`}>
    <span className={styles.trendPosition} data-position={index+1} aria-label={`이 비교 내 ${index+1}번째`}>{index+1}</span>
    <span className={styles.trendName}>{item.korName || item.name}<span>{item.ticker && <>{item.stockType || "보통주"} · {item.ticker}<br /></>}{item.priceDate ?? "가격 관측일 없음"}</span></span>
    <span className={styles.trendQuote}><span className={styles.trendPrice}>{active === "volume" ? `${formatBusinessValue(item.volume)}주` : item.price !== null ? `${formatBusinessValue(item.price)}원` : "가격 정보 없음"}</span><span className={item.changePercent !== null && item.changePercent > 0 ? "market-up" : item.changePercent !== null && item.changePercent < 0 ? "market-down" : styles.flatRate}>{formatRankingRate(item.changePercent)}</span></span>
    <ChevronRight size={16} className={styles.trendArrow} aria-hidden="true" />
  </Link>) : <p className={styles.trendEmpty}>{active === "volume" ? "이 범위에 제공된 거래량 관측이 없습니다." : "이 범위에 해당하는 가격 등락 관측이 없습니다."}</p>;
  return <section className={cn(styles.trends,className)} aria-labelledby="market-trends"><div className={styles.sectionHeading}><h2 id="market-trends">상위 기업의 주가 흐름</h2><span>가격 관측일 {date ?? "정보 없음"}</span></div><p className={styles.note}>시가총액 상위 {sampleCount}개 기업의 대표 보통주 내 비교 · 등락은 저장된 전일 대비</p><Tabs value={active} onValueChange={setActive}><TabsList className={styles.trendTabs}><TabsTrigger value="gainers">상승</TabsTrigger><TabsTrigger value="losers">하락</TabsTrigger><TabsTrigger value="volume">거래량</TabsTrigger></TabsList><div className={styles.trendColumns} aria-hidden="true"><span>비교</span><span>종목</span><span>{active === "volume" ? "거래량 · 등락률" : "현재가 · 등락률"}</span></div><TabsContent value="gainers" className={styles.trendContent}>{rows(gainers)}</TabsContent><TabsContent value="losers" className={styles.trendContent}>{rows(losers)}</TabsContent><TabsContent value="volume" className={styles.trendContent}>{rows(volume)}</TabsContent></Tabs><p className={styles.trendHint}>종목을 누르면 종목 시가총액 상세로 이어집니다.</p></section>;
}
