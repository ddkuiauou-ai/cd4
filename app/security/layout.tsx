import { MarketNav } from "@/components/market-nav";

interface SecurityLayoutProps {
  children: React.ReactNode;
}

export default function SecurityLayout({ children }: SecurityLayoutProps) {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {children}
    </div>
  );
}
