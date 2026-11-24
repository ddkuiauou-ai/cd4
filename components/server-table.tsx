import { RANKING_METRICS, type RankingMetric, type RankingRow, type RankingScope } from "@/lib/ranking-view";
import { RankingName, RankingTablePosition, RankingTableValue } from "@/components/ranking-row-parts";
import { RankingQuote } from "@/components/ranking-quote";
import styles from "./ranking-view.module.css";
import { useId } from "react";

interface ServerTableProps {
  rows: RankingRow[];
  scope?: RankingScope;
  metric?: RankingMetric;
}

export function ServerTable({ rows, scope = "company", metric = "marketcap" }: ServerTableProps) {
  const id = useId();
  const company = scope === "company";
  const definition = RANKING_METRICS[metric];
  const columnLabel = company ? "합산 시가총액" : definition.columnLabel ?? definition.label;
  return (
    <div className={styles.responsiveTable}>
      <table className={`${styles.table} ${styles.responsiveRanking}`} role="table">
        <caption className="sr-only">{company ? "기업 합산" : "종목별"} {definition.label} 순위. 순위 변화는 이전 순위 대비이며 주가 등락과 별개입니다.</caption>
        <thead role="rowgroup"><tr role="row">
          <th id={`${id}-rank`} scope="col" role="columnheader">
            <span>순위</span>{" "}<span className={styles.rankMovementHeading}><span className={styles.rankHeadingSeparator}>· </span>이동</span>
          </th>
          <th id={`${id}-identity`} scope="col" role="columnheader">
            {company ? "기업" : "종목"}<span className={styles.compactMetricHeading} aria-hidden="true">{columnLabel}</span>
          </th>
          <th id={`${id}-metric`} scope="col" role="columnheader" className={styles.metricCell}>{columnLabel}</th>
          <th id={`${id}-quote`} scope="col" role="columnheader" className={styles.quoteHeading}>
            <strong>{company ? "대표 보통주 주가" : "주가"}</strong>
            <span className={styles.responsiveQuoteHeadings}><span>종가</span><span>전일 등락률</span><span>추이</span></span>
            <span className={styles.compactQuoteHeading}>종가 · 전일 등락</span>
          </th>
        </tr></thead>
        <tbody role="rowgroup">{rows.map(row => <tr key={row.id} role="row">
          <td role="cell" headers={`${id}-rank`} className={styles.rankCell}><RankingTablePosition rank={row.rank} priorRank={row.priorRank} /></td>
          <td role="cell" headers={`${id}-identity`} className={styles.identityCell}><RankingName row={row} /></td>
          <td role="cell" headers={`${id}-metric`} className={styles.metricCell}><RankingTableValue row={row} /></td>
          <td role="cell" headers={`${id}-quote`} className={styles.responsiveQuoteCell}><RankingQuote row={row} /></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
