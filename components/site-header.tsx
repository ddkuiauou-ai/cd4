"use client";
import { useEffect,useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { CommandMenu } from "@/components/command-menu";
import { MainNav } from "@/components/main-nav";
import { ModeToggle } from "@/components/mode-toggle";
import { RecentPanel } from "@/components/recent-panel";
export function SiteHeader(){
  const ref=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!ref.current)return;
    const measure=()=>document.documentElement.style.setProperty("--app-header-height",`${ref.current?.offsetHeight??76}px`);
    measure();const observer=new ResizeObserver(measure);observer.observe(ref.current);return()=>observer.disconnect();
  },[]);
  return <header ref={ref} data-site-header className="app-header"><div className="app-container header-content">
    <Link href="/" className="brand-wordmark" aria-label="천하제일 단타대회 · 랭킹"><span className="brand-first">천하제일</span><Image src="/icon.svg" alt="" width={28} height={28}/><span className="brand-last">단타대회</span></Link>
    <div className="header-main-nav"><MainNav/></div>
    <div className="header-search"><CommandMenu/></div>
    <div className="header-recent"><RecentPanel/></div><ModeToggle/>
  </div></header>;
}
