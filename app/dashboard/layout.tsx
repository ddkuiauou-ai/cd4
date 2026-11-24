import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="app-container">{children}</div>
    </AppShell>
  );
}
