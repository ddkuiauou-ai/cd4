"use client";

import { useEffect, useRef } from "react";
import { History } from "lucide-react";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { TOGGLE_RECENT_PANEL_EVENT, RECENT_PANEL_ID, RECENT_PANEL_TRIGGER_SELECTOR } from "@/components/recent-panel-trigger";

export function RecentPanel() {
  const ref = useRef<HTMLDetailsElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const panel = ref.current;
    const content = contentRef.current;
    if (!panel || !content) return;

    let frame: number | null = null;
    const fitPanelHeight = () => {
      const rail = panel.open
        ? document.querySelector(`[data-recent-preview] ${RECENT_PANEL_TRIGGER_SELECTOR}`)?.getBoundingClientRect()
        : undefined;
      const popup = content.getBoundingClientRect();
      const overlaps = rail && rail.height > 0 && rail.left < popup.right && rail.right > popup.left
        && rail.top >= popup.top && rail.top < window.innerHeight;
      // Keep the header anchor and stop a long list before it covers the rail's toggle.
      if (overlaps) content.style.setProperty("--recent-panel-available-height", `${Math.max(0, Math.floor(rail.top - popup.top - 8))}px`);
      else content.style.removeProperty("--recent-panel-available-height");
    };
    const schedulePanelHeight = (event?: Event) => {
      if (!panel.open || event?.target === content || frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        fitPanelHeight();
      });
    };
    const railObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => schedulePanelHeight()) : null;
    const onToggle = () => {
      railObserver?.disconnect();
      if (panel.open) {
        const preview = document.querySelector("[data-recent-preview]");
        if (preview) railObserver?.observe(preview);
      }
      fitPanelHeight();
    };

    const close = (restoreFocus: boolean) => {
      panel.open = false;
      const opener = openerRef.current;
      if (restoreFocus) (opener?.isConnected ? opener : panel.querySelector("summary"))?.focus({ preventScroll: true });
      openerRef.current = null;
    };
    const toggle = () => {
      if (panel.open) {
        close(false);
        return;
      }
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement && active !== document.body && !panel.contains(active)
        ? active : panel.querySelector("summary");
      panel.toggleAttribute("data-opened-from-preview", Boolean(openerRef.current?.closest("[data-recent-preview]")));
      panel.open = true;
      fitPanelHeight();
      content.scrollTop = 0;
      const first = content.querySelector<HTMLAnchorElement>("a[href]") ?? content;
      first.focus({ preventScroll: true });
      if (first !== content) {
        content.scrollTop = Math.max(0, first.getBoundingClientRect().bottom - content.getBoundingClientRect().bottom);
      }
    };
    const closeOutside = (event: MouseEvent) => {
      const target = event.target;
      if (panel.open && target instanceof Element && !panel.contains(target) && !target.closest(RECENT_PANEL_TRIGGER_SELECTOR)) {
        close(panel.contains(document.activeElement));
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || !panel.open) return;
      const active = document.activeElement;
      if (active !== document.body && !panel.contains(active)) return;
      event.preventDefault();
      close(true);
    };
    onToggle();
    panel.addEventListener("toggle", onToggle);
    window.addEventListener("resize", schedulePanelHeight);
    window.addEventListener("scroll", schedulePanelHeight, { capture: true, passive: true });
    window.addEventListener(TOGGLE_RECENT_PANEL_EVENT, toggle);
    document.addEventListener("click", closeOutside, true);
    // Clearing history can remove the focused control and move focus to body.
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      panel.removeEventListener("toggle", onToggle);
      railObserver?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedulePanelHeight);
      window.removeEventListener("scroll", schedulePanelHeight, true);
      window.removeEventListener(TOGGLE_RECENT_PANEL_EVENT, toggle);
      document.removeEventListener("click", closeOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return <details ref={ref} className="recent-panel">
    <summary aria-label="최근 본 종목" title="최근 본 종목" onClick={event => {
      openerRef.current = event.currentTarget;
      ref.current?.removeAttribute("data-opened-from-preview");
      if (!ref.current?.open && contentRef.current) contentRef.current.scrollTop = 0;
    }}><span className="header-icon-slot" aria-hidden="true"><History /></span></summary>
    <div id={RECENT_PANEL_ID} ref={contentRef} className="recent-panel-content" role="region" tabIndex={-1} aria-label="최근 본 종목 목록" onClick={event => {
      if (event.target instanceof Element && event.target.closest("a") && ref.current) {
        ref.current.open = false;
        openerRef.current = null;
      }
    }}><RecentSecuritiesSidebar /></div>
  </details>;
}
