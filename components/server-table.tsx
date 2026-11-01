import { createRankingRows, RANKING_METRICS, type RankingMetric, type RankingRow, type RankingScope } from "@/lib/ranking-view";
import { RankingPosition } from "@/components/ranking-position";
import { RankingName, RankingPrice, RankingRate, RankingSparkline, RankingValue } from "@/components/ranking-row-parts";
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
        <colgroup><col className={styles.rankColumn} /><col className={styles.nameColumn} /><col className={styles.valueColumn} /><col /></colgroup>
        <thead><tr>
          <th scope="col">순위 · 이동</th>
          <th scope="col">{scope === "company" ? "기업" : "종목"}</th>
          <th scope="col" className={styles.valueColumn}>{scope === "company" ? "합산 시가총액" : RANKING_METRICS[metric].label}</th>
          <th scope="col" className={styles.quoteGroupHeading}>
            <span>{scope === "company" ? "대표 보통주" : "주가"}</span>
            <span className={styles.quoteHeadings}><span>주가 추이</span><span>종가 · 전일 대비</span></span>
          </th>
        </tr></thead>
        <tbody>{entries.map(row => <tr key={row.id}>
          <td><RankingPosition rank={row.rank} priorRank={row.priorRank} /></td>
          <td><RankingName row={row} /></td>
          <td className={styles.valueColumn}><RankingValue row={row} /></td>
          <td className={styles.quoteCell}><div className={styles.quoteGroup}>
            <RankingSparkline row={row} />
            <div className={styles.quoteValues}><RankingPrice row={row} /><RankingRate row={row} /></div>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
