import { AppShell } from "@/components/app-shell";

export default function MarketLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AppShell>
            <div className="app-container">{children}</div>
        </AppShell>
    );
}
