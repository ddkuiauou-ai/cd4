import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { readPageSearch } from "@/lib/static-page-search";
import { isStaticBuild, getStaticRankingManifest } from "@/lib/static-build/server";
import { StaticRevisionBoundary } from "@/components/static-revision-boundary";
import MarketTrends, { type TrendItem } from "@/components/MarketTrends";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { RankingValue } from "@/components/ranking-row-parts";
import { RankingPosition } from "@/components/ranking-position";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { getCompanyRankingPage } from "@/lib/data/company";
import { compareVolumes, createRankingRows, formatRankingRate, getPriceDateRange, type RankingRow, type RankingSearch } from "@/lib/ranking-view";
import { dashboardMetadata } from "@/lib/business-metadata";
import { formatBusinessValue } from "@/lib/business-analysis";
import { metricItems } from "@/lib/metric-navigation";
import { cn } from "@/lib/utils";
import styles from "@/components/dashboard.module.css";

export const metadata = dashboardMetadata;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<RankingSearch> }) {
  const search = await readPageSearch(searchParams);
  const expectedRevision = typeof search.revision === "string" ? search.revision : undefined;
  const snapshot = await getCompanyRankingPage(1, expectedRevision);
  const rows = createRankingRows(snapshot.items, "marketcap", "company");
  const priceDate = getPriceDateRange(rows);
  const withRates = rows.filter(row => row.rate !== null && row.securityHref);
  const gainers = withRates.filter(row => row.rate! > 0).toSorted((a, b) => b.rate! - a.rate!).slice(0, 5);
  const losers = withRates.filter(row => row.rate! < 0).toSorted((a, b) => a.rate! - b.rate!).slice(0, 5);
  const volumes = rows.filter(row => row.volume !== null && row.securityHref).toSorted((a, b) => compareVolumes(a.volume, b.volume)).slice(0, 5);
  const trend = (row: RankingRow): TrendItem => ({ securityId: row.securityId!, name: row.name, korName: row.name,
    href: row.securityHref!, price: row.close, changePercent: row.rate, priceDate: row.priceDate, volume: row.volume,
    ticker: row.ticker, exchange: row.exchange, stockType: row.stockType });
  const revision = snapshot.publication?.revision;
  const rankingHref = `/marketcaps${revision ? `?revision=${encodeURIComponent(revision)}` : ""}`;
  const usable = snapshot.state === "published" && !snapshot.revisionChanged;
  const manifest = isStaticBuild() ? await getStaticRankingManifest("marketcap", "company") : undefined;
  const body = <div className={cn("dashboard-shell", styles.page)}>
    <div className="dashboard-content">
      <header className={styles.heading}>
        <h1>대회 기록실</h1>
        <p>기업의 규모와 대표 보통주의 흐름을 살펴보세요.</p>
        <div className={styles.dates}><span>시장 · {snapshot.publication?.scopeKey === "krx-all" || !snapshot.publication ? "코스피 · 코스닥 전체" : snapshot.publication.scopeKey}</span><span>시가총액 공개 기준일 · {snapshot.publication?.asOf ?? "미공개"}</span><span>가격 관측일 · {priceDate ?? "정보 없음"}</span></div>
      </header>
      {snapshot.revisionChanged ? <div className="empty-state" role="status"><h2 className="section-heading">자료가 갱신되었습니다</h2><p className="data-note mt-2">최신 자료에서 대시보드를 다시 확인해 주세요.</p><Link prefetch={false} href="/dashboard" className="inline-block mt-5 underline underline-offset-4">최신 자료 보기</Link></div>
        : !usable ? <div className="empty-state" role="status"><h2 className="section-heading">아직 공개된 회사 순위가 없습니다</h2><p className="data-note mt-2">검색에서 종목 정보와 다른 지표를 확인할 수 있습니다.</p><Link prefetch={false} href="/" className="inline-block mt-5 underline underline-offset-4">랭킹으로 이동 →</Link></div>
        : <>
          {!rows.length && <p className="empty-state data-note" role="status">공개된 순위 대상은 0개입니다. 전체 순위 CSV는 열 이름만 포함합니다.</p>}
          <div className={styles.panels}>
            <section className={styles.companies} aria-labelledby="dashboard-ranking">
              <div className={styles.sectionHeading}><h2 id="dashboard-ranking">기업 합산 시가총액 TOP 5</h2><span>보통주 · 우선주 합산</span></div>
              <div className={styles.csvTools}><span>기업 전체 순위</span><CsvDownloadButton className={styles.downloadButton} scope="company" metric="marketcap" revision={revision} expectedDate={snapshot.publication?.asOf} expectedTotalCount={snapshot.totalCount} refreshHref="/dashboard" staticSource={manifest?.scopes["krx-all"]?.csv ?? undefined} /></div>
              <div className={styles.companyColumns} aria-hidden="true"><span>순위 · 이동</span><span>기업</span><span>합산 시가총액</span></div>
              <ol className="dashboard-companies">{rows.slice(0, 5).map(row => <li key={row.id} className={cn("dashboard-company-row", styles.companyRow)}>
                <RankingPosition rank={row.rank} priorRank={row.priorRank} />
                <div className={styles.companyIdentity}><Link prefetch={false} href={row.href!} className="dashboard-company-name" title={`${row.name} 기업 합산 시가총액 상세`}>{row.name}</Link><p>{row.ticker ? `${row.ticker} · ${row.exchange}` : "대표 보통주 없음"}</p></div>
                <div className={styles.companyValue}><RankingValue row={row} /><p>{row.close !== null ? `${formatBusinessValue(row.close)}원` : "가격 정보 없음"}<span>대표 보통주</span></p></div>
              </li>)}</ol>
              <p className={styles.note}>기업명에서 합산 시가총액 상세로 이어집니다. 가격은 대표 보통주 기준이며 시가총액과 관측일이 다를 수 있습니다.</p>
              <Link prefetch={false} href={rankingHref} className={cn("dashboard-more", styles.more)}>전체 기업 순위 보기<ArrowRight size={17} aria-hidden="true" /></Link>
            </section>
            <section className={styles.shortcuts} aria-labelledby="dashboard-metrics">
              <div className={styles.sectionHeading}><h2 id="dashboard-metrics">주요 지표별 순위 바로가기</h2></div>
              <nav aria-label="지표별 전체 순위" className={styles.metricLinks}>{metricItems.map(item => <Link key={item.key} prefetch={false} href={item.key === "marketcap" ? rankingHref : item.href}><strong>{item.label}</strong><span>{item.key === "marketcap" ? "기업 합산" : "종목별"}</span><span className={styles.metricAction}>순위 보기<ArrowRight size={13} aria-hidden="true" /></span></Link>)}</nav>
            </section>
            <MarketTrends gainers={gainers.map(trend)} losers={losers.map(trend)} volume={volumes.map(trend)} date={priceDate ?? undefined} sampleCount={rows.length} className={styles.trendsArea} />
          </div>
          <section className={styles.overview} aria-labelledby="dashboard-overview">
            <h2 id="dashboard-overview">한눈에 보기</h2>
            <p className={styles.note}>상승·하락·거래량은 시가총액 상위 {rows.length}개 기업의 대표 보통주 내 비교입니다.</p>
            <dl className={cn("dashboard-facts", styles.facts)}>
              <div><dt>조회 기업 수</dt><dd><strong>{snapshot.totalCount.toLocaleString("ko-KR")}<small>개</small></strong><span>공개된 기업 시가총액 순위</span></dd></div>
              <div><dt>시가총액 1위</dt><dd>{rows[0] ? <><Link prefetch={false} href={rows[0].href!}>{rows[0].name}</Link><RankingValue row={rows[0]} /></> : <span>순위 대상 없음</span>}</dd></div>
              <div><dt>상승률 1위</dt><dd>{gainers[0] ? <><Link prefetch={false} href={gainers[0].securityHref!}>{gainers[0].name}</Link><span className="market-up">{formatRankingRate(gainers[0].rate)}</span></> : <span>{withRates.length ? "상승 종목 없음" : "가격 등락 정보 없음"}</span>}</dd></div>
              <div><dt>하락률 1위</dt><dd>{losers[0] ? <><Link prefetch={false} href={losers[0].securityHref!}>{losers[0].name}</Link><span className="market-down">{formatRankingRate(losers[0].rate)}</span></> : <span>{withRates.length ? "하락 종목 없음" : "가격 등락 정보 없음"}</span>}</dd></div>
            </dl>
          </section>
        </>}
    </div>
    <aside className="context-rail dashboard-rail"><RecentSecuritiesSidebar /><section className={styles.basis}><h2>조회 기준</h2><dl><div><dt>시가총액 공개 기준일</dt><dd>{snapshot.publication?.asOf ?? "미공개"}</dd></div><div><dt>가격 관측일</dt><dd>{priceDate ?? "정보 없음"}</dd></div></dl><p>회사 순위는 공개된 합산 결과입니다. 대표 보통주의 가격이 없어도 순위 대상은 유지됩니다.</p>{snapshot.publication && <details><summary>자료 공개 정보</summary><p>자료 갱신 번호 {snapshot.publication.revision} · 대상 {snapshot.publication.scopeKey === "krx-all" ? "KRX 전체" : snapshot.publication.scopeKey}</p></details>}</section></aside>
  </div>;
  return isStaticBuild() ? <Suspense fallback={body}><StaticRevisionBoundary revision={revision ?? null}>{body}</StaticRevisionBoundary></Suspense> : body;
}
