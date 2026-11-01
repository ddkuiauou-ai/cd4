"use client";

import type { ReactNode } from "react";

export const OPEN_RECENT_PANEL_EVENT = "app:open-recent";

export function RecentPanelTrigger({ children, className }: { children: ReactNode; className?: string }) {
  return <button type="button" className={className} onClick={event => {
    event.currentTarget.focus({ preventScroll: true });
    window.dispatchEvent(new Event(OPEN_RECENT_PANEL_EVENT));
  }}>{children}</button>;
}
