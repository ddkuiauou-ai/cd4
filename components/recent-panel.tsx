"use client";
import { useEffect,useRef } from "react";
import { Clock } from "lucide-react";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
export function RecentPanel(){
  const ref=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const close=(event:PointerEvent)=>{if(ref.current&&!ref.current.contains(event.target as Node)) ref.current.open=false;};
    document.addEventListener("pointerdown",close);return()=>document.removeEventListener("pointerdown",close);
  },[]);
  return <details ref={ref} className="recent-panel" onKeyDown={event=>{if(event.key==="Escape"&&ref.current){ref.current.open=false;ref.current.querySelector("summary")?.focus();}}}>
    <summary aria-label="최근 본 종목"><Clock size={17} aria-hidden="true"/><span>최근 본</span></summary>
    <div className="recent-panel-content"><RecentSecuritiesSidebar/></div>
  </details>;
}
