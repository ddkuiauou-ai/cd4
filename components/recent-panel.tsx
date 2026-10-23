"use client";
import { useEffect,useRef } from "react";
import { History } from "lucide-react";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
export function RecentPanel(){
  const ref=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const close=(event:MouseEvent)=>{
      const panel=ref.current;
      if(panel?.open&&!panel.contains(event.target as Node)) {
        const restoreFocus=panel.contains(document.activeElement);
        panel.open=false;
        if(restoreFocus) panel.querySelector("summary")?.focus({preventScroll:true});
      }
    };
    document.addEventListener("click",close);return()=>document.removeEventListener("click",close);
  },[]);
  return <details ref={ref} className="recent-panel" onKeyDown={event=>{if(event.key==="Escape"&&ref.current){ref.current.open=false;ref.current.querySelector("summary")?.focus();}}}>
    <summary aria-label="최근 본 종목" title="최근 본 종목"><History size={20} aria-hidden="true"/><span>최근 본</span></summary>
    <div className="recent-panel-content" onClick={event=>{
      if(event.target instanceof Element&&event.target.closest("a")&&ref.current) ref.current.open=false;
    }}><RecentSecuritiesSidebar/></div>
  </details>;
}
