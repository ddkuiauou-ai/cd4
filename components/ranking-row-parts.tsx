import Link from "next/link";
import { businessChartSegments, formatBusinessValue } from "@/lib/business-analysis";
import { exactRankingValue, formatRankingRate, formatRankingValue, type RankingRow } from "@/lib/ranking-view";
import styles from "./ranking-view.module.css";

export function RankingName({ row }: { row: RankingRow }) {
  const contents = <><span className={styles.name}>{row.name}</span><span className={styles.code}>{row.ticker || "대표 종목 없음"}{row.exchange && <> · {row.exchange}</>}{row.scope === "security" && row.stockType && row.stockType !== "보통주" && <> · {row.stockType}</>}</span></>;
  return row.href ? <Link href={row.href} className={styles.nameLink}>{contents}</Link> : <div className={styles.nameLink}>{contents}</div>;
}

export function RankingValue({ row }: { row: RankingRow }) {
  return <><details className={styles.valueDetails}><summary className={styles.value} aria-label={`${exactRankingValue(row.metric, row.value)}${row.metricDate ? ` · 지표 관측일 ${row.metricDate}` : ""}. 정확한 값과 기준일 보기`}>{formatRankingValue(row.metric, row.value)}</summary><p>{exactRankingValue(row.metric, row.value)}<br />지표 관측일 {row.metricDate ?? "정보 없음"}</p></details>{row.completeness && row.completeness !== "complete" && <span className={styles.completeness}>합산 자료 {row.completeness === "missing_input" ? "부족" : "연결 근거 부족"}</span>}</>;
}

export function RankingRate({ row }: { row: RankingRow }) {
  const direction = row.rate == null || row.rate === 0 ? "flat" : row.rate > 0 ? "up" : "down";
  const label = row.close == null ? "가격 정보 없음" : `최근 종가 ${formatBusinessValue(row.close)}원${row.priceDate ? ` · 가격 관측일 ${row.priceDate}` : ""} · 저장된 전일 대비 ${formatRankingRate(row.rate)}`;
  return <span className={styles.rate} data-direction={direction} title={label} aria-label={label}>{formatRankingRate(row.rate)}</span>;
}

export function RankingSparkline({ row }: { row: RankingRow }) {
  const observations = row.prices.flatMap(price => price.date ? [{ date: price.date, value: price.close }] : []);
  const segments = businessChartSegments(observations, 108, 20);
  if (!segments.length) return <span className={styles.noTrend} aria-label="가격 추이 정보 없음">—</span>;
  const direction = row.rate == null || row.rate === 0 ? "flat" : row.rate > 0 ? "up" : "down";
  return <span className={styles.sparkline} data-direction={direction} role="img" aria-label={`${row.name} 가격 관측 ${observations[0]?.date}–${observations.at(-1)?.date}. 결측 구간은 연결하지 않습니다.`}><svg viewBox="-2 -2 112 24" width={110} height={24} aria-hidden="true">{segments.map((points, index) => <g key={index}><polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} />{points.split(" ").length === 1 && <circle cx={points.split(",")[0]} cy={points.split(",")[1]} r={2} fill="currentColor" />}</g>)}</svg></span>;
}
