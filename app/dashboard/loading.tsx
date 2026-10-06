import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <section className="dashboard-content" aria-busy="true">
      <p role="status" className="sr-only">대시보드 데이터를 불러오는 중입니다.</p>
      <Skeleton className="h-9 w-56 mb-8" />
      <div className="dashboard-facts" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}
      </div>
      <div className="dashboard-panels" aria-hidden="true">
        {Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-80" />)}
      </div>
    </section>
  );
}
