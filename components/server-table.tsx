import { createRankingRows, RANKING_METRICS, type RankingMetric, type RankingRow, type RankingScope } from "@/lib/ranking-view";
import { RankingPosition } from "@/components/ranking-position";
import { RankingName, RankingRate, RankingSparkline, RankingValue } from "@/components/ranking-row-parts";
import styles from "./ranking-view.module.css";

interface ServerTableProps {
  rows?: RankingRow[];
  data?: readonly unknown[];
  scope?: RankingScope;
  metric?: RankingMetric;
  latestDate?: string;
  updatedDate?: string;
  title?: string;
  subTitle?: string;
  infoColumnHeader?: string;
  headerActions?: React.ReactNode;
}

export function ServerTable({ rows, data = [], scope = "company", metric = "marketcap" }: ServerTableProps) {
  const entries = rows ?? createRankingRows(data, metric, scope);
  return (
    <div className={styles.desktopTable}>
      <table className={styles.table}>
        <caption className="sr-only">{scope === "company" ? "기업 합산" : "종목별"} {RANKING_METRICS[metric].label} 순위. 순위 변화는 이전 순위 대비이며 주가 등락과 별개입니다.</caption>
        <thead><tr>
          <th scope="col" className={styles.rankColumn}>순위</th>
          <th scope="col">{scope === "company" ? "기업" : "종목"}</th>
          <th scope="col" className={styles.trendColumn}>최근 추이</th>
          <th scope="col" className={styles.valueColumn}>{RANKING_METRICS[metric].label}</th>
          <th scope="col" className={styles.rateColumn}>등락</th>
        </tr></thead>
        <tbody>{entries.map(row => <tr key={row.id}>
          <td><RankingPosition rank={row.rank} priorRank={row.priorRank} /></td>
          <td><RankingName row={row} /></td>
          <td className={styles.trendColumn}><RankingSparkline row={row} /></td>
          <td className={styles.valueColumn}><RankingValue row={row} /><div className={styles.tableInlineTrend}><RankingSparkline row={row} /></div></td>
          <td className={styles.rateColumn}><RankingRate row={row} /></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
