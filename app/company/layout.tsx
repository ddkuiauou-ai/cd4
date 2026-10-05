import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BottomNavigation } from "@/components/bottom-navigation";
import { MobileHeaderProvider } from "@/components/mobile-header-context";

interface CompanyLayoutProps {
  children: React.ReactNode;
}

export default function CompanyLayout({ children }: CompanyLayoutProps) {
  return (
    <MobileHeaderProvider>
      <SiteHeader />
      <main className="flex-1 pb-20 md:pb-0">
        <div className="container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <SiteFooter />
      <BottomNavigation />
    </MobileHeaderProvider>
  );
}
