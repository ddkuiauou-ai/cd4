import { RANKING_METRICS, type RankingMetric, type RankingRow, type RankingScope } from "@/lib/ranking-view";
import { RankingPosition } from "@/components/ranking-position";
import { RankingName, RankingRate, RankingSparkline, RankingValue } from "@/components/ranking-row-parts";
import styles from "./ranking-view.module.css";

export function RankingMobileList({ rows, metric, scope }: { rows: RankingRow[]; metric: RankingMetric; scope: RankingScope }) {
  return (
    <div className={styles.mobileTable}>
      <table className={styles.table}>
        <caption className="sr-only">{scope === "company" ? "기업 합산" : "종목별"} {RANKING_METRICS[metric].label} 순위와 이전 순위 대비 변화</caption>
        <thead><tr>
          <th scope="col" className={styles.rankColumn}>순위</th>
          <th scope="col">{scope === "company" ? "기업" : "종목"}</th>
          <th scope="col" className={styles.valueColumn}>{RANKING_METRICS[metric].label}</th>
          <th scope="col" className={styles.rateColumn}>등락</th>
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td><RankingPosition rank={row.rank} priorRank={row.priorRank} /></td>
          <td><RankingName row={row} /></td>
          <td className={styles.valueColumn}><RankingValue row={row} /><RankingSparkline row={row} /></td>
          <td className={styles.rateColumn}><RankingRate row={row} /></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
