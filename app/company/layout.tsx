import { getSecuritySearchNames } from "@/lib/getSearch";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BottomNavigation } from "@/components/bottom-navigation";

interface CompanyLayoutProps {
  children: React.ReactNode;
}

export default async function CompanyLayout({ children }: CompanyLayoutProps) {
  const searchData = await getSecuritySearchNames();

  return (
    <>
      <SiteHeader searchData={searchData} />
      <main className="flex-1 pb-20 md:pb-0">
        <div className="container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <SiteFooter />
      <BottomNavigation />
    </>
  );
}
