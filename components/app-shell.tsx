import type { ReactNode } from "react";
import { MobileHeaderProvider } from "@/components/mobile-header-context";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BottomNavigation } from "@/components/bottom-navigation";
import { cn } from "@/lib/utils";

export function AppShell({ children, navigation, className }: {
  children: ReactNode;
  navigation?: ReactNode;
  className?: string;
}) {
  return (
    <MobileHeaderProvider>
      <div className="app-shell">
        <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
        <SiteHeader />
        {navigation ? <div className="app-container shell-navigation">{navigation}</div> : null}
        <main id="main-content" className={cn("app-main", className)}>{children}</main>
        <SiteFooter />
        <BottomNavigation />
      </div>
    </MobileHeaderProvider>
  );
}
