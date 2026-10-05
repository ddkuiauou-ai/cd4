import { LayoutWrapper } from "@/components/layout-wrapper";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <LayoutWrapper showMarketNav={false}>
            {children}
        </LayoutWrapper>
    );
}
