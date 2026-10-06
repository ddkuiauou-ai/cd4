"use client";
import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
interface TrendItem {name:string;korName:string;securityId:string;href:string;price:number|null;change:number;changePercent:number;}
export default function MarketTrends({gainers=[],losers=[],volume=[],date,sampleCount,className}:{gainers:TrendItem[];losers:TrendItem[];volume:TrendItem[];date?:string;sampleCount:number;className?:string}){
  const [active,setActive]=useState("gainers");
  const rows=(items:TrendItem[])=>items.length?items.slice(0,5).map(item=><Link key={item.securityId} href={item.href} className="trend-row"><span className="trend-name">{item.korName||item.name}</span><span className="trend-price">{item.price!=null?`${item.price.toLocaleString()}원`:"가격 정보 없음"}</span><span className={item.changePercent>0?"market-up":item.changePercent<0?"market-down":"text-muted-foreground"}>{item.changePercent>0?"+":""}{item.changePercent.toFixed(2)}%</span></Link>):<p className="empty-state data-note">{active==="volume"?"현재 조회 데이터에는 거래량 정보가 없습니다.":"이 범위에 해당하는 종목이 없습니다."}</p>;
  return <section className={cn("dashboard-trends",className)} aria-labelledby="market-trends"><div className="section-header"><h2 id="market-trends" className="section-heading">상위 기업의 주가 흐름</h2><span className="data-note">{date??"기준일 미확인"} 기준</span></div><p className="data-note mb-4">시가총액 상위 {sampleCount}개 기업 내 비교</p><Tabs value={active} onValueChange={setActive}><TabsList className="trend-tabs"><TabsTrigger value="gainers">상승</TabsTrigger><TabsTrigger value="losers">하락</TabsTrigger><TabsTrigger value="volume">거래량</TabsTrigger></TabsList><TabsContent value="gainers">{rows(gainers)}</TabsContent><TabsContent value="losers">{rows(losers)}</TabsContent><TabsContent value="volume">{rows(volume)}</TabsContent></Tabs></section>;
}
