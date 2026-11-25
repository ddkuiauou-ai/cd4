import { SiteDocumentLink as RankingDocumentLink } from "./site-document-link";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { exactRankingValue, formatRankingRate, formatRankingValue, rankMovement, RANKING_METRICS, type RankingRow } from "@/lib/ranking-view";
import styles from "./ranking-view.module.css";

export function RankingName({ row }: { row: RankingRow }) {
  const contents = <><span className={styles.identity}><span className={styles.name}>{row.name}</span><span className={styles.code}>{row.scope === "security" && row.stockType && <span>{row.stockType} · </span>}<span>{row.ticker || "대표 종목 없음"}</span>{row.exchange && <span> · {row.exchange}</span>}</span></span>{row.href && <ChevronRight size={17} aria-hidden="true" className={styles.rowArrow} />}</>;
  return row.href ? <RankingDocumentLink href={row.href} className={styles.nameLink} title={`${row.name} ${row.scope === "company" ? "기업 합산 " : ""}${RANKING_METRICS[row.metric].label} 상세 보기`}>{contents}</RankingDocumentLink> : <div className={styles.nameLink}>{contents}</div>;
}

function RankingCompleteness({ status }: { status: RankingRow["completeness"] }) {
  if (!status || status === "complete") return null;
  return <span className={styles.completeness}>합산 자료 {status === "missing_input" ? "부족" : "연결 근거 부족"}</span>;
}

export function RankingValue({ row }: { row: RankingRow }) {
  const exact = exactRankingValue(row.metric, row.value);
  return <>
    <details className={styles.valueDetails}>
      <summary className={styles.value} aria-label={`${exact}${row.metricDate ? ` · 지표 관측일 ${row.metricDate}` : ""}. 정확한 값과 기준일 보기`}>{formatRankingValue(row.metric, row.value)}</summary>
      <p>{exact}<br />지표 관측일 {row.metricDate ?? "정보 없음"}</p>
    </details>
    <RankingCompleteness status={row.completeness} />
  </>;
}

export function RankingTableValue({ row }: { row: RankingRow }) {
  const value = formatRankingValue(row.metric, row.value);
  return <>
    <span className={styles.value}>{value === "—"
      ? <><span className="sr-only">지표 정보 없음</span><span aria-hidden="true">—</span></>
      : <>{value.slice(0, -1)}<span className={styles.valueUnit}>{value.slice(-1)}</span></>}</span>
    <RankingCompleteness status={row.completeness} />
  </>;
}

export function describeRankMovement(rank: number | null, priorRank: number | null, movement: number | null) {
  if (movement == null) return "이전 순위 정보가 없습니다.";
  const ranks = `이전 ${priorRank}위 → 현재 ${rank}위`;
  return movement === 0 ? `${ranks} · 순위 유지` : `${ranks} · ${Math.abs(movement)}계단 ${movement > 0 ? "상승" : "하락"}`;
}

export function RankingPositionNumbers({ rank, movement }: { rank: number | null; movement: number | null }) {
  return <>
    <span className={styles.rank} aria-hidden="true">{rank?.toLocaleString("ko-KR") ?? "—"}</span>
    {movement != null && <span className={styles.movement} data-direction={movement === 0 ? "flat" : movement > 0 ? "up" : "down"} aria-hidden="true">{movement === 0 ? "유지" : <>{movement > 0 ? <ArrowUp /> : <ArrowDown />}<span>{Math.abs(movement).toLocaleString("ko-KR")}</span></>}</span>}
  </>;
}

export function RankingTablePosition({ rank, priorRank }: { rank: number | null; priorRank: number | null }) {
  const movement = rankMovement(rank, priorRank);
  return <div className={styles.position} data-rank={rank ?? undefined} data-digits={String(rank ?? "").length}>
    <span className="sr-only">{rank == null ? "순위 정보 없음" : `${rank}위`}. {describeRankMovement(rank, priorRank, movement)}</span>
    <RankingPositionNumbers rank={rank} movement={movement} />
  </div>;
}

export function RankingRate({ row }: { row: RankingRow }) {
  const direction = row.rate == null || row.rate === 0 ? "flat" : row.rate > 0 ? "up" : "down";
  return <span className={styles.rate} data-direction={direction}>{formatRankingRate(row.rate)}</span>;
}
