import { LayoutWrapper } from "@/components/layout-wrapper";
import { getSecuritySearchNames } from "@/lib/getSearch";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
    const searchData = await getSecuritySearchNames();

    return (
        <LayoutWrapper searchData={searchData} showMarketNav={false}>
            {children}
        </LayoutWrapper>
    );
}
