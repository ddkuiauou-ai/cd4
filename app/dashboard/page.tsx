import Link from "next/link";
import { connection } from "next/server";
import MarketTrends, { type TrendItem } from "@/components/MarketTrends";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { RankingValue } from "@/components/ranking-row-parts";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { getCompanyRankingPage } from "@/lib/data/company";
import { compareVolumes, createRankingRows, formatRankingRate, getPriceDateRange, type RankingRow, type RankingSearch } from "@/lib/ranking-view";
import { dashboardMetadata } from "@/lib/business-metadata";
import { formatBusinessValue } from "@/lib/business-analysis";

export const dynamic = "force-dynamic";
export const metadata = dashboardMetadata;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<RankingSearch> }) {
  await connection();
  const search = await searchParams;
  const expectedRevision = typeof search.revision === "string" ? search.revision : undefined;
  const snapshot = await getCompanyRankingPage(1, expectedRevision);
  const rows = createRankingRows(snapshot.items, "marketcap", "company");
  const priceDate = getPriceDateRange(rows);
  const withRates = rows.filter(row => row.rate !== null && row.securityHref);
  const gainers = withRates.filter(row => row.rate! > 0).toSorted((a, b) => b.rate! - a.rate!).slice(0, 5);
  const losers = withRates.filter(row => row.rate! < 0).toSorted((a, b) => a.rate! - b.rate!).slice(0, 5);
  const volumes = rows.filter(row => row.volume !== null && row.securityHref).toSorted((a, b) => compareVolumes(a.volume, b.volume)).slice(0, 5);
  const trend = (row: RankingRow): TrendItem => ({ securityId: row.securityId!, name: row.name, korName: row.name,
    href: row.securityHref!, price: row.close, changePercent: row.rate, priceDate: row.priceDate, volume: row.volume });
  const revision = snapshot.publication?.revision;
  const rankingHref = `/marketcaps${revision ? `?revision=${encodeURIComponent(revision)}` : ""}`;
  const usable = snapshot.state === "published" && !snapshot.revisionChanged;
  return <div className="dashboard-shell">
    <div className="dashboard-content">
      <header className="dashboard-heading">
        <h1 className="page-heading">주식 지표 대시보드</h1>
        <p className="data-note mt-2">기업의 규모와 주가 흐름을 한눈에 확인하세요.</p>
        <div className="dashboard-dates data-note"><span>시가총액 공개 기준일: {snapshot.publication?.asOf ?? "미공개"}</span><span>가격 관측일: {priceDate ?? "정보 없음"}</span></div>
      </header>
      {snapshot.revisionChanged ? <div className="empty-state" role="status"><h2 className="section-heading">자료가 갱신되었습니다</h2><p className="data-note mt-2">최신 자료에서 대시보드를 다시 확인해 주세요.</p><Link href="/dashboard" className="inline-block mt-5 underline underline-offset-4">최신 자료 보기</Link></div>
        : !usable ? <div className="empty-state" role="status"><h2 className="section-heading">아직 공개된 회사 순위가 없습니다</h2><p className="data-note mt-2">검색에서 종목 정보와 다른 지표를 확인할 수 있습니다.</p><Link href="/" className="inline-block mt-5 underline underline-offset-4">랭킹으로 이동 →</Link></div>
        : <>
          <section className="dashboard-overview" aria-labelledby="dashboard-overview">
            <h2 id="dashboard-overview" className="section-heading">한눈에 보기</h2>
            <p className="data-note mt-2">상승·하락·거래량은 시가총액 상위 {rows.length}개 기업의 대표 보통주 내 비교입니다.</p>
            <dl className="dashboard-facts">
              <div><dt>조회 기업 수</dt><dd><strong>{snapshot.totalCount.toLocaleString("ko-KR")}<small>개</small></strong><span>공개된 기업 시가총액 순위</span></dd></div>
              <div><dt>시가총액 1위</dt><dd>{rows[0] ? <><Link href={rows[0].href!}>{rows[0].name}</Link><RankingValue row={rows[0]} /></> : <span>순위 대상 없음</span>}</dd></div>
              <div><dt>상승률 1위</dt><dd>{gainers[0] ? <><Link href={gainers[0].securityHref!}>{gainers[0].name}</Link><span className="market-up">{formatRankingRate(gainers[0].rate)}</span></> : <span>{withRates.length ? "상승 종목 없음" : "가격 등락 정보 없음"}</span>}</dd></div>
              <div><dt>하락률 1위</dt><dd>{losers[0] ? <><Link href={losers[0].securityHref!}>{losers[0].name}</Link><span className="market-down">{formatRankingRate(losers[0].rate)}</span></> : <span>{withRates.length ? "하락 종목 없음" : "가격 등락 정보 없음"}</span>}</dd></div>
            </dl>
          </section>
          {!rows.length && <p className="empty-state data-note" role="status">공개된 순위 대상은 0개입니다. 전체 순위 CSV는 열 이름만 포함합니다.</p>}
          <div className="dashboard-panels">
            <MarketTrends gainers={gainers.map(trend)} losers={losers.map(trend)} volume={volumes.map(trend)} date={priceDate ?? undefined} sampleCount={rows.length} />
            <section className="dashboard-preview" aria-labelledby="dashboard-ranking">
              <div className="section-header"><h2 id="dashboard-ranking" className="section-heading">시가총액 TOP 5</h2><Link href={rankingHref} className="dashboard-more">전체 순위 →</Link></div>
              <p className="data-note mb-4">공개된 기업 합산 시가총액입니다.</p>
              <ol className="dashboard-companies">{rows.slice(0, 5).map(row => <li key={row.id} className="dashboard-company-row"><span className="dashboard-position">{row.rank ?? "—"}</span><div className="min-w-0"><Link href={row.href!} className="dashboard-company-name">{row.name}</Link><p className="data-note">{row.ticker ? `${row.ticker} · ${row.exchange}` : "대표 보통주 없음"}</p></div><div className="dashboard-company-value"><RankingValue row={row} /><p className="data-note">{row.close !== null ? `${formatBusinessValue(row.close)}원` : "가격 정보 없음"}</p></div></li>)}</ol>
              <p className="data-note mt-4">가격은 대표 보통주 기준이며 시가총액과 관측일이 다를 수 있습니다.</p>
              <CsvDownloadButton scope="company" metric="marketcap" revision={revision} expectedDate={snapshot.publication?.asOf} expectedTotalCount={snapshot.totalCount} refreshHref="/dashboard" />
            </section>
          </div>
        </>}
    </div>
    <aside className="context-rail dashboard-rail"><RecentSecuritiesSidebar /><section className="dashboard-basis"><h2 className="section-heading">조회 기준</h2><dl><div><dt>시가총액 공개 기준일</dt><dd>{snapshot.publication?.asOf ?? "미공개"}</dd></div><div><dt>가격 관측일</dt><dd>{priceDate ?? "정보 없음"}</dd></div></dl><p className="data-note">회사 순위는 공개된 합산 결과입니다. 대표 보통주의 가격이 없어도 순위 대상은 유지됩니다.</p>{snapshot.publication && <details className="data-note mt-4"><summary>자료 공개 정보</summary><p>자료 갱신 번호 {snapshot.publication.revision} · 대상 {snapshot.publication.scopeKey === "krx-all" ? "KRX 전체" : snapshot.publication.scopeKey}</p></details>}</section></aside>
  </div>;
}
