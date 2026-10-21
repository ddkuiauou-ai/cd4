import { Skeleton } from "@/components/ui/skeleton";
import styles from "@/components/dashboard.module.css";

export default function DashboardLoading() {
  return (
    <section className={`dashboard-content ${styles.page}`} aria-busy="true">
      <p role="status" className="sr-only">대시보드 데이터를 불러오는 중입니다.</p>
      <div className={styles.skeletonHeading} aria-hidden="true"><Skeleton className="h-10 w-56" /><Skeleton className="h-4 w-72 max-w-full mt-4" /></div>
      <div className={styles.panels} aria-hidden="true">
        <div className={`${styles.companies} ${styles.skeletonPanel}`}><Skeleton className="h-7 w-60 max-w-full mb-6" />{Array.from({length:5},(_,index)=><div key={index} className={styles.skeletonRow}><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>)}</div>
        <div className={`${styles.trendsArea} ${styles.skeletonPanel}`}><Skeleton className="h-7 w-52 max-w-full mb-6" /><Skeleton className="h-10 w-full" />{Array.from({length:5},(_,index)=><div key={index} className={styles.skeletonRow}><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>)}</div>
        <div className={`${styles.shortcuts} ${styles.skeletonPanel}`}><Skeleton className="h-7 w-60 max-w-full mb-4" /><Skeleton className="h-24 w-full" /></div>
      </div>
    </section>
  );
}
