import Link from "next/link";
import SpikeChart from "@/components/spike-chart";
import { formatRankingRate, formatRankingValue, RANKING_METRICS, type RankingRow } from "@/lib/ranking-view";
import styles from "./ranking-view.module.css";

export function RankingName({ row }: { row: RankingRow }) {
  const contents = <><span className={styles.name}>{row.name}</span><span className={styles.code}>{row.ticker || "코드 정보 없음"}{row.exchange && <> · {row.exchange}</>}{row.scope === "security" && row.stockType === "우선주" && <> · 우선주</>}</span></>;
  return row.href ? <Link href={row.href} className={styles.nameLink}>{contents}</Link> : <div className={styles.nameLink}>{contents}</div>;
}

export function RankingValue({ row }: { row: RankingRow }) {
  return <span className={styles.value} title={row.value == null ? "지표 정보 없음" : `${row.value.toLocaleString("ko-KR")}${RANKING_METRICS[row.metric].unit}`}>{formatRankingValue(row.metric, row.value)}</span>;
}

export function RankingRate({ row }: { row: RankingRow }) {
  const direction = row.rate == null || row.rate === 0 ? "flat" : row.rate > 0 ? "up" : "down";
  return <span className={styles.rate} data-direction={direction} title={row.close == null ? "가격 정보 없음" : `최근 종가 ${row.close.toLocaleString("ko-KR")}원${row.priceDate ? ` · ${row.priceDate}` : ""}`}>{formatRankingRate(row.rate)}</span>;
}

export function RankingSparkline({ row }: { row: RankingRow }) {
  if (row.prices.length < 2) return <span className={styles.noTrend} aria-label="가격 추이 정보 없음">—</span>;
  const suspended = row.prices[row.prices.length - 1]?.open === 0;
  const direction = suspended || row.rate == null || row.rate === 0 ? "flat" : row.rate > 0 ? "up" : "down";
  return <span className={styles.sparkline} data-direction={direction} role="img" aria-label={`${row.name} 최근 가격 추이${suspended ? ", 거래 정지" : ""}`}><SpikeChart prices={row.prices} rate={row.rate ?? undefined} width={110} height={24} /></span>;
}
