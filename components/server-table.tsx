import { RANKING_METRICS, type RankingMetric, type RankingRow, type RankingScope } from "@/lib/ranking-view";
import { RankingPosition } from "@/components/ranking-position";
import { RankingName, RankingValue } from "@/components/ranking-row-parts";
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
  return (
    <div className={styles.responsiveTable}>
      <table className={`${styles.table} ${styles.responsiveRanking}`} role="table">
        <caption className="sr-only">{scope === "company" ? "기업 합산" : "종목별"} {RANKING_METRICS[metric].label} 순위. 순위 변화는 이전 순위 대비이며 주가 등락과 별개입니다.</caption>
        <thead role="rowgroup"><tr role="row">
          <th id={`${id}-rank`} scope="col" role="columnheader">순위 · 이동</th>
          <th id={`${id}-identity`} scope="col" role="columnheader">{scope === "company" ? "기업" : "종목"}<span className={styles.compactMetricHeading}> · {scope === "company" ? "합산 시총" : RANKING_METRICS[metric].label}</span></th>
          <th id={`${id}-metric`} scope="col" role="columnheader" className={styles.metricCell}>{scope === "company" ? "합산 시가총액" : RANKING_METRICS[metric].label}</th>
          <th id={`${id}-quote`} scope="col" role="columnheader" className={styles.quoteHeading}>
            <span>{scope === "company" ? "대표 보통주" : "주가"}</span>
            <span className={styles.responsiveQuoteHeadings}><span>종가</span><span>등락률</span><span>추이</span></span>
          </th>
        </tr></thead>
        <tbody role="rowgroup">{rows.map(row => <tr key={row.id} role="row">
          <td role="cell" headers={`${id}-rank`} className={styles.rankCell}><RankingPosition rank={row.rank} priorRank={row.priorRank} /></td>
          <td role="cell" headers={`${id}-identity`} className={styles.identityCell}><RankingName row={row} /></td>
          <td role="cell" headers={`${id}-metric`} className={styles.metricCell}><RankingValue row={row} /><span className={styles.metricHint} aria-hidden="true">{scope === "company" ? "시총" : RANKING_METRICS[metric].label}</span></td>
          <td role="cell" headers={`${id}-quote`} className={styles.responsiveQuoteCell}><RankingQuote row={row} /></td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
