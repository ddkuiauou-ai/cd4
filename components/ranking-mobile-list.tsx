import { RANKING_METRICS, type RankingMetric, type RankingRow, type RankingScope } from "@/lib/ranking-view";
import { RankingPosition } from "@/components/ranking-position";
import { RankingName, RankingPrice, RankingRate, RankingSparkline, RankingValue } from "@/components/ranking-row-parts";
import styles from "./ranking-view.module.css";

export function RankingMobileList({ rows, metric, scope }: { rows: RankingRow[]; metric: RankingMetric; scope: RankingScope }) {
  return (
    <div className={styles.mobileTable}>
      <table className={styles.table}>
        <caption className="sr-only">{scope === "company" ? "기업 합산" : "종목별"} {RANKING_METRICS[metric].label} 순위와 이전 순위 대비 변화</caption>
        <colgroup><col className={styles.rankColumn} /><col /><col className={styles.valueColumn} /></colgroup>
        <thead><tr>
          <th scope="col">순위</th>
          <th scope="col">{scope === "company" ? "기업" : "종목"}</th>
          <th scope="col" className={styles.valueColumn}>{scope === "company" ? "합산 시가총액" : RANKING_METRICS[metric].label}</th>
        </tr></thead>
        {rows.map(row => <tbody key={row.id} className={styles.mobileEntry}>
          <tr className={styles.mobilePrimary}>
            <td rowSpan={2} className={styles.mobileRankCell}><RankingPosition rank={row.rank} priorRank={row.priorRank} /></td>
            <td><RankingName row={row} /></td>
            <td className={styles.valueColumn}><RankingValue row={row} /></td>
          </tr>
          <tr className={styles.mobileSecondary}><td colSpan={2}>
            <div className={styles.mobilePriceGroup}>
              <div className={styles.mobileTrend}><span className={styles.columnHint}>{scope === "company" ? "대표 보통주" : "주가 추이"}</span><RankingSparkline row={row} /></div>
              <div className={styles.quoteValues}><RankingPrice row={row} /><RankingRate row={row} /></div>
            </div>
          </td></tr>
        </tbody>)}
      </table>
    </div>
  );
}
