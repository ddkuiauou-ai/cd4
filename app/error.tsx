"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{console.error(error);},[error]);
  return <AppShell><section className="app-container py-16"><div className="empty-state"><h1 className="page-heading">데이터를 불러오지 못했습니다</h1><p className="data-note mt-3 mb-6">잠시 후 다시 시도하거나 랭킹에서 다른 지표를 확인해 주세요.</p><div className="flex flex-wrap justify-center gap-4"><Button onClick={reset}>다시 시도</Button><Link href="/" className="inline-flex items-center underline underline-offset-4">랭킹으로 이동</Link></div></div></section></AppShell>;
}
