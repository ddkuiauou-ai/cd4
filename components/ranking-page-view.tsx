import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { ServerTable } from "@/components/server-table";
import { RankingMobileList } from "@/components/ranking-mobile-list";
import { Pager } from "@/components/pager";
import { getRankingPriceDate, RANKING_METRICS, type RankingMetric, type RankingRow, type RankingScope } from "@/lib/ranking-view";
import styles from "./ranking-view.module.css";

export interface RankingPageViewProps {
  rows: RankingRow[];
  metric: RankingMetric;
  scope: RankingScope;
  latestDate: string | null;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  basePath: string;
}

const formatDate = (date: string | null) => date && date !== "N/A" ? date.replaceAll("-", ".") : "정보 없음";

export function RankingPageView({ rows, metric, scope, latestDate, totalCount, currentPage, totalPages, basePath }: RankingPageViewProps) {
  const priceDate = getRankingPriceDate(rows);
  const rankValues = rows.flatMap(row => row.rank == null ? [] : [row.rank]);
  const firstRank = rankValues.length ? Math.min(...rankValues) : null;
  const lastRank = rankValues.length ? Math.max(...rankValues) : null;
  const offset = currentPage === 1 ? 0 : 20 + (currentPage - 2) * 100;
  const nextCount = Math.max(0, Math.min(100, totalCount - offset - rows.length));
  const entity = scope === "company" ? "기업" : "종목";
  return (
    <div className="ranking-shell">
      <section className="ranking-main" aria-labelledby="ranking-title">
        <header className={styles.pageHeader}>
          <div className={styles.heading}>
            <h1 id="ranking-title">{RANKING_METRICS[metric].title}</h1>
            <div className={styles.summary}>
              {metric === "marketcap" ? <details className={styles.scopeMenu}>
                <summary>{scope === "company" ? "기업 합산" : "종목별"}<ChevronDown size={14} aria-hidden="true" /></summary>
                <div className={styles.scopeOptions}>
                  <Link href="/marketcaps" aria-current={scope === "company" ? "page" : undefined}>기업 합산<span>보통주·우선주 합산</span></Link>
                  <Link href="/marketcap" aria-current={scope === "security" ? "page" : undefined}>종목별<span>보통주·우선주 각각</span></Link>
                </div>
              </details> : <span className={styles.scopeLabel}>종목별</span>}
              <span className={styles.basis}>{formatDate(latestDate)}{latestDate && latestDate !== "N/A" ? " 기준" : ""}</span>
            </div>
          </div>
          {totalCount > 0 && <div className={styles.download}><CsvDownloadButton scope={scope} metric={metric} expectedDate={latestDate} expectedTotalCount={totalCount} expectedCompanyRows={scope === "company" ? rows.map(row => ({ id: row.id, rank: row.rank, priorRank: row.priorRank, value: row.value, metricDate: row.metricDate ?? null })) : undefined} /></div>}
        </header>
        {rows.length ? <>
          <ServerTable rows={rows} metric={metric} scope={scope} />
          <RankingMobileList rows={rows} metric={metric} scope={scope} />
          <footer className={styles.listFooter}>
            <p>전체 {totalCount.toLocaleString("ko-KR")}개 {entity}{firstRank != null && <> · {firstRank.toLocaleString("ko-KR")}–{lastRank?.toLocaleString("ko-KR")}위</>}</p>
            <Pager basePath={basePath} currentPage={currentPage} totalPages={totalPages} nextCount={nextCount} />
          </footer>
        </> : <div className={styles.empty} role="status"><h2>표시할 순위 데이터가 없습니다</h2><p>다른 지표의 순위를 확인하거나 잠시 후 다시 방문해 주세요.</p></div>}
        <p className={styles.dataNote}>{scope === "company" ? "기업 시총은 보통주·우선주 합산입니다. 가격·등락·추이는 대표 보통주 기준입니다." : RANKING_METRICS[metric].description}{priceDate && <> 가격 기준일 {formatDate(priceDate)}.</>}</p>
      </section>
      <aside className="context-rail" aria-label="최근 본 종목과 조회 기준">
        <RecentSecuritiesSidebar />
        <section className={styles.contextSection} aria-labelledby="ranking-context-title">
          <h2 id="ranking-context-title">조회 기준</h2>
          <dl><div><dt>범위</dt><dd>{scope === "company" ? "기업 합산" : "종목별"}</dd></div><div><dt>기준일</dt><dd>{formatDate(latestDate)}</dd></div><div><dt>단위</dt><dd>{RANKING_METRICS[metric].unit}</dd></div>{priceDate && <div><dt>최근 가격</dt><dd>{formatDate(priceDate)}</dd></div>}</dl>
          <p>{entity}을 누르면 해당 {entity}의 상세로 이동합니다.</p>
          <div className={styles.rankKey}><strong>순위 변화</strong><span>화살표와 숫자 · 이동한 계단 수</span><span>이전 순위 대비 · 주가 등락과 별개</span></div>
        </section>
      </aside>
    </div>
  );
}
