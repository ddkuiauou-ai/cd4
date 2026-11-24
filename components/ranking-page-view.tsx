import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { ServerTable } from "@/components/server-table";
import { Pager } from "@/components/pager";
import { MarketNav } from "@/components/market-nav";
import { RANKING_METRICS, type RankingMetric, type RankingRow, type RankingScope, type RankingPublication } from "@/lib/ranking-view";
import styles from "./ranking-view.module.css";
import bottom from "./ranking-bottom.module.css";
import type { StaticCsvSource } from "@/lib/static-build/types";

export interface RankingPageViewProps {
  rows: RankingRow[];
  metric: RankingMetric;
  scope: RankingScope;
  latestDate: string | null;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  basePath: string;
  publication?: RankingPublication | null;
  state?: "published" | "unpublished";
  revisionChanged?: boolean;
  scopeKey?: string;
  staticCsvSource?: StaticCsvSource;
  feedback?: { title: string; description?: string; alert?: boolean; busy?: boolean; action?: ReactNode };
}

const formatDate = (date: string | null) => date && date !== "N/A" ? date.replaceAll("-", ".") : "정보 없음";
const scopeNames: Record<string, string> = {
  "krx-all": "코스피 · 코스닥 전체", kospi: "코스피", kosdaq: "코스닥",
  "kospi-common": "코스피 보통주", "kospi-preferred": "코스피 우선주",
  "kosdaq-common": "코스닥 보통주", "kosdaq-preferred": "코스닥 우선주",
};

export function RankingPageView({ rows, metric, scope, latestDate, totalCount, currentPage, totalPages, basePath,
  publication, state = "published", revisionChanged = false, scopeKey = "krx-all", staticCsvSource, feedback }: RankingPageViewProps) {
  const isCurrent = state === "published" && !revisionChanged && !feedback;
  const referenceDate = isCurrent ? publication?.asOf ?? latestDate : null;
  const definition = RANKING_METRICS[metric];
  const revision = publication?.revision;
  const query = new URLSearchParams({ ...(revision ? { revision } : {}), ...(scope === "security" ? { scope: scopeKey } : {}) }).toString();
  const refreshHref = `${basePath}${scope === "security" ? `?scope=${encodeURIComponent(scopeKey)}` : ""}`;
  const rankValues = rows.flatMap(row => row.rank == null ? [] : [row.rank]);
  const firstRank = rankValues.length ? Math.min(...rankValues) : null;
  const lastRank = rankValues.length ? Math.max(...rankValues) : null;
  const offset = currentPage === 1 ? 0 : 20 + (currentPage - 2) * 100;
  const nextCount = Math.max(0, Math.min(100, totalCount - offset - rows.length));
  const entity = scope === "company" ? "기업" : "종목";
  const title = `${scope === "company" ? "기업 합산" : "종목별"} ${definition.title}`;
  const marketLabel = scopeNames[scopeKey] ?? scopeKey;
  return (
    <>
    <div className={`ranking-shell ${bottom.listing}`}>
      <section className={`ranking-main ${styles.rankingMain}`} aria-labelledby="ranking-title">
        <header className={styles.pageHeader}>
          <div className={styles.tableToolbar}>
            <h1 id="ranking-title" tabIndex={-1}>{title}</h1>
            <div className={styles.headingContext}>
              <dl className={styles.basis}>
                <div><dt>시장</dt><dd>{marketLabel}</dd></div>
                <div><dt>기준일</dt><dd>{referenceDate && referenceDate !== "N/A"
                  ? <time dateTime={referenceDate}>{formatDate(referenceDate)}</time>
                  : formatDate(null)}</dd></div>
              </dl>
              {definition.sortHint && <p className={styles.sortHint}>{definition.sortHint}</p>}
            </div>
            {isCurrent && <div className={styles.download}><CsvDownloadButton scope={scope} metric={metric} scopeKey={scopeKey} revision={revision}
              refreshHref={refreshHref} expectedDate={referenceDate} expectedTotalCount={totalCount} staticSource={staticCsvSource} /></div>}
          </div>
          <div className={styles.metricSection}>
            <MarketNav metric={metric} scope={scope} scopeKey={scopeKey} />
          </div>
        </header>
        {feedback ? <div className={styles.empty} role={feedback.alert ? "alert" : "status"} aria-busy={feedback.busy || undefined}><h2>{feedback.title}</h2>{feedback.description && <p>{feedback.description}</p>}{feedback.action}</div>
          : revisionChanged ? <div className={styles.empty} role="status"><h2>자료가 갱신되었습니다</h2><p>조회 중 순위 자료가 갱신되었습니다. 최신 결과에서 다시 확인해 주세요.</p><Link prefetch={false} className="inline-block mt-4 underline underline-offset-4" href={refreshHref}>최신 자료 보기</Link></div>
          : state === "unpublished" ? <div className={styles.empty} role="status"><h2>아직 공개된 순위가 없습니다</h2><p>다른 지표와 종목 정보는 계속 확인할 수 있습니다.</p></div>
          : rows.length ? <>
          <ServerTable rows={rows} metric={metric} scope={scope} />
          <footer className={styles.listFooter}>
            <p className={styles.listRange}>
              {firstRank != null && lastRank != null && (
                <strong>{firstRank.toLocaleString("ko-KR")}{firstRank !== lastRank && `–${lastRank.toLocaleString("ko-KR")}`}위</strong>
              )}
              <span>전체 {totalCount.toLocaleString("ko-KR")}개 {entity}</span>
            </p>
            <Pager basePath={basePath} currentPage={currentPage} totalPages={totalPages} nextCount={nextCount} query={query} />
          </footer>
        </> : <div className={styles.empty} role="status"><h2>이 기준에 해당하는 {entity}이 없습니다</h2><p>공개된 순위 대상은 0개입니다. 전체 순위 CSV는 열 이름만 포함합니다.</p></div>}
      </section>
      <aside className={`context-rail ${bottom.rail}`} aria-label="최근 본 종목 미리보기">
        <RecentSecuritiesSidebar variant="preview" />
      </aside>
    </div>
    <section className={bottom.dataBasis} aria-labelledby="ranking-basis-title">
      {scope === "company" && <p className={bottom.companyBasis}>시총은 보통주·우선주 합산. 종가·등락률·추이는 대표 보통주 기준.</p>}
      <details className={bottom.publication}>
        <summary id="ranking-basis-title">조회 기준 · 자료 공개 정보<ChevronDown size={16} aria-hidden="true" /></summary>
        {scope === "security" && <p>{definition.description} 종가·등락률·추이는 해당 종목의 주가 기준입니다.</p>}
        <dl><div><dt>자료 갱신 번호</dt><dd>{publication?.revision ?? "미공개"}</dd></div><div><dt>공개 대상</dt><dd>{publication ? publication.scopeKey === "krx-all" ? "KRX 전체" : scopeNames[publication.scopeKey] ?? publication.scopeKey : "미공개"}</dd></div><div><dt>지표 단위</dt><dd>{definition.unit}</dd></div></dl>
        <p className={bottom.rankKey}><strong>순위 변화</strong> 화살표와 숫자는 이전 순위에서 이동한 계단 수입니다. 주가 등락과 별개입니다.</p>
      </details>
    </section>
    </>
  );
}
