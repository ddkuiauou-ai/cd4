import Link from "next/link";
import type { ReactNode } from "react";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { ServerTable } from "@/components/server-table";
import { RankingMobileList } from "@/components/ranking-mobile-list";
import { Pager } from "@/components/pager";
import { MarketNav } from "@/components/market-nav";
import { getPriceDateRange, RANKING_METRICS, type RankingMetric, type RankingRow, type RankingScope, type RankingPublication } from "@/lib/ranking-view";
import styles from "./ranking-view.module.css";
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
  const priceDate = getPriceDateRange(rows);
  const revision = publication?.revision;
  const query = new URLSearchParams({ ...(revision ? { revision } : {}), ...(scope === "security" ? { scope: scopeKey } : {}) }).toString();
  const refreshHref = `${basePath}${scope === "security" ? `?scope=${encodeURIComponent(scopeKey)}` : ""}`;
  const rankValues = rows.flatMap(row => row.rank == null ? [] : [row.rank]);
  const firstRank = rankValues.length ? Math.min(...rankValues) : null;
  const lastRank = rankValues.length ? Math.max(...rankValues) : null;
  const offset = currentPage === 1 ? 0 : 20 + (currentPage - 2) * 100;
  const nextCount = Math.max(0, Math.min(100, totalCount - offset - rows.length));
  const entity = scope === "company" ? "기업" : "종목";
  const title = metric === "marketcap" ? `${scope === "company" ? "기업 합산" : "종목별"} 시가총액 순위` : RANKING_METRICS[metric].title;
  const marketLabel = scopeNames[scopeKey] ?? scopeKey;
  return (
    <div className="ranking-shell">
      <section className="ranking-main" aria-labelledby="ranking-title">
        <header className={styles.pageHeader}>
          <h1 id="ranking-title">{title}</h1>
          <div className={styles.marketContext}>
            <div className={styles.targetControl}><span className={styles.contextLabel}>대상</span>
              {metric === "marketcap" ? <nav className={styles.scopeOptions} aria-label="시가총액 조회 범위">
                <Link prefetch={false} href="/marketcaps" aria-current={scope === "company" ? "page" : undefined}>기업 합산</Link>
                <Link prefetch={false} href={`/marketcap${scopeKey !== "krx-all" ? `?scope=${encodeURIComponent(scopeKey)}` : ""}`} aria-current={scope === "security" ? "page" : undefined}>종목별</Link>
              </nav> : <span className={styles.scopeLabel}>종목별</span>}
            </div>
            <dl className={styles.basis}><div><dt>시장</dt><dd>{marketLabel}</dd></div><div><dt>공개 기준일</dt><dd>{formatDate(latestDate)}</dd></div></dl>
          </div>
        </header>
        <div className={styles.metricSection}>
          <MarketNav metric={metric} scope={scope} scopeKey={scopeKey} />
          {scope === "company" && <p className={styles.scopeHint}>시가총액은 기업 합산으로, PER 등 주당 지표는 종목별로 확인합니다.</p>}
        </div>
        <div className={styles.tableToolbar}>
          <p className={styles.tableContext}><strong>{scope === "company" ? "기업 합산" : "종목별"} · {RANKING_METRICS[metric].label}</strong><span>{entity}명을 누르면 해당 지표 상세로 이동합니다.</span></p>
          {state === "published" && !revisionChanged && !feedback && <div className={styles.download}><CsvDownloadButton scope={scope} metric={metric} scopeKey={scopeKey} revision={revision}
            refreshHref={refreshHref} expectedDate={latestDate} expectedTotalCount={totalCount} staticSource={staticCsvSource} /></div>}
        </div>
        {feedback ? <div className={styles.empty} role={feedback.alert ? "alert" : "status"} aria-busy={feedback.busy || undefined}><h2>{feedback.title}</h2>{feedback.description && <p>{feedback.description}</p>}{feedback.action}</div>
          : revisionChanged ? <div className={styles.empty} role="status"><h2>자료가 갱신되었습니다</h2><p>조회 중 순위 자료가 갱신되었습니다. 최신 결과에서 다시 확인해 주세요.</p><Link prefetch={false} className="inline-block mt-4 underline underline-offset-4" href={refreshHref}>최신 자료 보기</Link></div>
          : state === "unpublished" ? <div className={styles.empty} role="status"><h2>아직 공개된 순위가 없습니다</h2><p>다른 지표와 종목 정보는 계속 확인할 수 있습니다.</p></div>
          : rows.length ? <>
          <ServerTable rows={rows} metric={metric} scope={scope} />
          <RankingMobileList rows={rows} metric={metric} scope={scope} />
          <footer className={styles.listFooter}>
            <p>전체 {totalCount.toLocaleString("ko-KR")}개 {entity}{firstRank != null && <> · {firstRank.toLocaleString("ko-KR")}–{lastRank?.toLocaleString("ko-KR")}위</>}</p>
            <Pager basePath={basePath} currentPage={currentPage} totalPages={totalPages} nextCount={nextCount} query={query} />
          </footer>
        </> : <div className={styles.empty} role="status"><h2>이 기준에 해당하는 {entity}이 없습니다</h2><p>공개된 순위 대상은 0개입니다. 전체 순위 CSV는 열 이름만 포함합니다.</p></div>}
        <p className={styles.dataNote}>{scope === "company" ? "기업 시총은 보통주·우선주 합산입니다. 가격·등락·추이는 대표 보통주 기준입니다." : RANKING_METRICS[metric].description}{priceDate && <> 가격 기준일 {formatDate(priceDate)}.</>}</p>
      </section>
      <aside className="context-rail" aria-label="최근 본 종목과 조회 기준">
        <RecentSecuritiesSidebar />
        <section className={styles.contextSection} aria-labelledby="ranking-context-title">
          <h2 id="ranking-context-title">조회 기준</h2>
          <dl><div><dt>대상</dt><dd>{scope === "company" ? "기업 합산" : "종목별"}</dd></div><div><dt>시장</dt><dd>{marketLabel}</dd></div><div><dt>공개 기준일</dt><dd>{formatDate(latestDate)}</dd></div><div><dt>단위</dt><dd>{RANKING_METRICS[metric].unit}</dd></div>{priceDate && <div><dt>가격 관측일</dt><dd>{priceDate}</dd></div>}</dl>
          <p>{entity}명에서 {scope === "company" ? "기업 합산 시가총액" : RANKING_METRICS[metric].label} 상세로 이어집니다. 가격과 지표의 관측일은 서로 다를 수 있습니다.</p>
          <div className={styles.rankKey}><strong>순위 변화</strong><span>화살표와 숫자 · 이동한 계단 수</span><span>이전 순위 대비 · 주가 등락과 별개</span></div>
        </section>
      </aside>
      {publication && <details className={styles.publicationDetails}><summary>자료 공개 정보</summary><p>공개 기준일 {publication.asOf} · 자료 갱신 번호 {publication.revision} · 대상 {publication.scopeKey === "krx-all" ? "KRX 전체" : publication.scopeKey}</p></details>}
    </div>
  );
}
