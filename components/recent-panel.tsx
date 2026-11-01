"use client";

import { useEffect, useRef } from "react";
import { History } from "lucide-react";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { OPEN_RECENT_PANEL_EVENT } from "@/components/recent-panel-trigger";

export function RecentPanel() {
  const ref = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const close = (restoreFocus: boolean) => {
      const panel = ref.current;
      if (!panel) return;
      panel.open = false;
      const opener = openerRef.current;
      if (restoreFocus) (opener?.isConnected ? opener : panel.querySelector("summary"))?.focus({ preventScroll: true });
      openerRef.current = null;
    };
    const open = () => {
      const panel = ref.current;
      if (!panel) return;
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement && active !== document.body && !panel.contains(active)
        ? active : panel.querySelector("summary");
      panel.open = true;
      const content = contentRef.current;
      (content?.querySelector<HTMLAnchorElement>("a[href]") ?? content)?.focus({ preventScroll: true });
    };
    const closeOutside = (event: MouseEvent) => {
      const panel = ref.current;
      if (panel?.open && !panel.contains(event.target as Node)) {
        close(panel.contains(document.activeElement));
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const panel = ref.current;
      if (event.key !== "Escape" || event.defaultPrevented || !panel?.open) return;
      const active = document.activeElement;
      if (active !== document.body && !panel.contains(active)) return;
      event.preventDefault();
      close(true);
    };
    window.addEventListener(OPEN_RECENT_PANEL_EVENT, open);
    // Run before an outside trigger opens this panel during the same click.
    document.addEventListener("click", closeOutside, true);
    // Clearing history can remove the focused control and move focus to body.
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener(OPEN_RECENT_PANEL_EVENT, open);
      document.removeEventListener("click", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return <details ref={ref} className="recent-panel">
    <summary aria-label="최근 본 종목" title="최근 본 종목" onClick={event => {
      openerRef.current = event.currentTarget;
    }}><History size={20} aria-hidden="true" /><span>최근 본</span></summary>
    <div ref={contentRef} className="recent-panel-content" role="region" tabIndex={-1} aria-label="최근 본 종목 목록" onClick={event => {
      if (event.target instanceof Element && event.target.closest("a") && ref.current) {
        ref.current.open = false;
        openerRef.current = null;
      }
    }}><RecentSecuritiesSidebar /></div>
  </details>;
}
