"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { CommandMenu } from "@/components/command-menu";
import { MainNav } from "@/components/main-nav";
import { ModeToggle } from "@/components/mode-toggle";
import { RecentPanel } from "@/components/recent-panel";

export function SiteHeader() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const measure = () => {
      if (ref.current) document.documentElement.style.setProperty("--app-header-height", `${ref.current.offsetHeight}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return <header ref={ref} data-site-header className="app-header">
    <div className="app-container header-content">
      <Link prefetch={false} href="/dashboard" className="brand-wordmark" aria-label="천하제일 단타대회 · 메인">
        <span className="brand-first" aria-hidden="true">천하제일</span>
        <Image src="/icon.svg" alt="" width={32} height={32} />
        <span className="brand-last" aria-hidden="true">단타대회</span>
      </Link>
      <div className="header-main-nav"><MainNav /></div>
      <div className="header-actions">
        <CommandMenu />
        <div className="header-recent"><RecentPanel /></div>
        <ModeToggle />
      </div>
    </div>
  </header>;
}
