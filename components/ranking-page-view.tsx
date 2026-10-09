import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { ServerTable } from "@/components/server-table";
import { RankingMobileList } from "@/components/ranking-mobile-list";
import { Pager } from "@/components/pager";
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
}

const formatDate = (date: string | null) => date && date !== "N/A" ? date.replaceAll("-", ".") : "정보 없음";

export function RankingPageView({ rows, metric, scope, latestDate, totalCount, currentPage, totalPages, basePath,
  publication, state = "published", revisionChanged = false, scopeKey = "krx-all", staticCsvSource }: RankingPageViewProps) {
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
                  <Link prefetch={false} href="/marketcaps" aria-current={scope === "company" ? "page" : undefined}>기업 합산<span>보통주·우선주 합산</span></Link>
                  <Link prefetch={false} href="/marketcap" aria-current={scope === "security" ? "page" : undefined}>종목별<span>보통주·우선주 각각</span></Link>
                </div>
              </details> : <span className={styles.scopeLabel}>종목별</span>}
              <span className={styles.basis}>{formatDate(latestDate)}{latestDate && latestDate !== "N/A" ? " 기준" : ""}</span>
            </div>
          </div>
          {state === "published" && !revisionChanged && <div className={styles.download}><CsvDownloadButton scope={scope} metric={metric} scopeKey={scopeKey} revision={revision}
            refreshHref={refreshHref} expectedDate={latestDate} expectedTotalCount={totalCount} staticSource={staticCsvSource} /></div>}
        </header>
        {revisionChanged ? <div className={styles.empty} role="status"><h2>자료가 갱신되었습니다</h2><p>조회 중 순위 자료가 갱신되었습니다. 최신 결과에서 다시 확인해 주세요.</p><Link prefetch={false} className="inline-block mt-4 underline underline-offset-4" href={refreshHref}>최신 자료 보기</Link></div>
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
          <dl><div><dt>범위</dt><dd>{scope === "company" ? "기업 합산" : "종목별"} · {scopeKey === "krx-all" ? "KRX 전체" : scopeKey}</dd></div><div><dt>공개 기준일</dt><dd>{formatDate(latestDate)}</dd></div><div><dt>단위</dt><dd>{RANKING_METRICS[metric].unit}</dd></div>{priceDate && <div><dt>가격 관측일</dt><dd>{priceDate}</dd></div>}</dl>
          <p>{entity}을 누르면 해당 {entity}의 상세로 이동합니다.</p>
          <div className={styles.rankKey}><strong>순위 변화</strong><span>화살표와 숫자 · 이동한 계단 수</span><span>이전 순위 대비 · 주가 등락과 별개</span></div>
        </section>
      </aside>
      {publication && <details className={styles.publicationDetails}><summary>자료 공개 정보</summary><p>공개 기준일 {publication.asOf} · 자료 갱신 번호 {publication.revision} · 대상 {publication.scopeKey === "krx-all" ? "KRX 전체" : publication.scopeKey}</p></details>}
    </div>
  );
}
