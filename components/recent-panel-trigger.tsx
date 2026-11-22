"use client";

import { useSyncExternalStore, type ReactNode } from "react";

export const TOGGLE_RECENT_PANEL_EVENT = "app:toggle-recent";
export const RECENT_PANEL_ID = "header-recent-records";
export const RECENT_PANEL_TRIGGER_SELECTOR = "button[data-recent-panel-trigger]";

function getRecentPanel() {
  return document.getElementById(RECENT_PANEL_ID)?.closest<HTMLDetailsElement>("details");
}

function subscribeToRecentPanel(listener: () => void) {
  const onToggle = (event: Event) => {
    if (event.target === getRecentPanel()) listener();
  };
  document.addEventListener("toggle", onToggle, true);
  return () => document.removeEventListener("toggle", onToggle, true);
}

const isRecentPanelOpen = () => getRecentPanel()?.open ?? false;
const isRecentPanelOpenFromPreview = () => {
  const panel = getRecentPanel();
  return Boolean(panel?.open && panel.hasAttribute("data-opened-from-preview"));
};
const isRecentPanelOpenOnServer = () => false;

export function useRecentPanelOpen(fromPreview = false) {
  return useSyncExternalStore(subscribeToRecentPanel, fromPreview ? isRecentPanelOpenFromPreview : isRecentPanelOpen, isRecentPanelOpenOnServer);
}

export function RecentPanelTrigger({ children, className, previewDisclosure }: {
  children: ReactNode;
  className?: string;
  previewDisclosure?: { controls: string; expand: () => void };
}) {
  const expanded = useRecentPanelOpen();
  return <button type="button" className={className} data-recent-panel-trigger
    aria-label={previewDisclosure ? '최근 본 종목 더 보기' : undefined}
    aria-controls={previewDisclosure?.controls ?? RECENT_PANEL_ID} aria-expanded={!previewDisclosure && expanded} onClick={event => {
    event.currentTarget.focus({ preventScroll: true });
    if (previewDisclosure) previewDisclosure.expand();
    else window.dispatchEvent(new Event(TOGGLE_RECENT_PANEL_EVENT));
  }}>{children}</button>;
}
