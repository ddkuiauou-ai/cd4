import { dashboardLabel } from "@/config/site";
import styles from "@/components/dashboard-arena.module.css";
import pageStyles from "@/components/dashboard.module.css";

export default function DashboardLoading() {
  return (
    <>
      <header className={pageStyles.pageHeading}><h1>{dashboardLabel}</h1></header>
      <p role="status" className="sr-only">대회장 데이터를 불러오는 중입니다.</p>
      <div className={styles.arena} aria-hidden="true">
        <div className={`${styles.controls} ${styles.loadingMenu}`}><span /></div>
        <div className={`${styles.frame} ${styles.loadingFrame}`}>
          <div className={styles.stage}>
            <div className={styles.scene}>
              <div className={styles.todayGrid}>
                {Array.from({ length: 8 }, (_, index) => <div key={index} className={`${styles.event} ${styles.loadingEvent}`}><span /><span /><span /></div>)}
              </div>
            </div>
          </div>
          <div className={styles.arenaFoot}><span /></div>
        </div>
      </div>
    </>
  );
}
