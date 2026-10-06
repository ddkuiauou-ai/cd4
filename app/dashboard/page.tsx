import type { Metadata } from "next";
import Link from "next/link";
import MarketTrends from "@/components/MarketTrends";
import Rate from "@/components/rate";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { siteConfig } from "@/config/site";
import { getCompanyMarketcapsPage } from "@/lib/data/company";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "국내 주식 지표 대시보드",
  description: "국내 기업의 시가총액과 주가 흐름을 확인하고 전체 순위를 탐색하세요.",
  alternates: { canonical: `${siteConfig.url}/dashboard/` },
  openGraph: {
    url: `${siteConfig.url}/dashboard/`,
    title: "국내 주식 지표 대시보드",
    description: "국내 기업의 숫자와 전체 순위",
    images: ["/opengraph-image.png"],
  },
};

type Company = Awaited<ReturnType<typeof getCompanyMarketcapsPage>>["items"][number];
const latestPrice = (company: Company) => company.securities?.[0]?.prices?.at(-1);
const companyName = (company: Company) => company.korName ?? company.name;
const companyHref = (company: Company) => {
  const security = company.securities?.[0];
  return `/company/${security?.exchange}.${security?.ticker}`;
};
const dateLabel = (date: string | Date | null | undefined) =>
  date ? new Date(date).toISOString().split("T")[0] : "미확인";

export default async function DashboardPage() {
  const { items: data, totalCount } = await getCompanyMarketcapsPage(1);
  const marketcapDate = dateLabel(data[0]?.marketcapDate);
  const priceDate = dateLabel(data[0] ? latestPrice(data[0])?.date : undefined);
  const withRates = data.filter(company => latestPrice(company)?.rate != null);
  const gainers = withRates
    .filter(company => (latestPrice(company)?.rate ?? 0) > 0)
    .sort((a, b) => (latestPrice(b)?.rate ?? 0) - (latestPrice(a)?.rate ?? 0))
    .slice(0, 5);
  const losers = withRates
    .filter(company => (latestPrice(company)?.rate ?? 0) < 0)
    .sort((a, b) => (latestPrice(a)?.rate ?? 0) - (latestPrice(b)?.rate ?? 0))
    .slice(0, 5);
  const trend = (company: Company) => {
    const security = company.securities?.[0];
    const price = latestPrice(company);
    return {
      name: company.name ?? "",
      korName: company.korName ?? company.name ?? "",
      securityId: security?.securityId ?? "",
      href: `/security/${security?.exchange}.${security?.ticker}/marketcap`,
      price: price?.close ?? null,
      change: price?.rate ?? 0,
      changePercent: price?.rate ?? 0,
    };
  };

  if (data.length === 0) {
    return (
      <section className="dashboard-content">
        <h1 className="page-heading mb-6">주식 지표 대시보드</h1>
        <div className="empty-state">
          <h2 className="section-heading">표시할 기업 데이터가 없습니다</h2>
          <p className="data-note mt-2">시가총액 순위를 조회할 수 있는기업 데이터가 아직 없습니다.</p>
          <Link href="/" className="inline-block mt-5 underline underline-offset-4">랭킹으로 이동 →</Link>
        </div>
      </section>
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="dashboard-content">
        <header className="dashboard-heading">
          <h1 className="page-heading">주식 지표 대시보드</h1>
          <p className="data-note mt-2">기업의 규모와 주가 흐름을 한눈에 확인하세요.</p>
          <div className="dashboard-dates data-note">
            <span>시가총액 기준일: {marketcapDate}</span>
            <span>가격 기준일: {priceDate}</span>
          </div>
        </header>

        <section className="dashboard-overview" aria-labelledby="dashboard-overview">
          <h2 id="dashboard-overview" className="section-heading">한눈에 보기</h2>
          <p className="data-note mt-2">상승·하락은 시가총액 상위 {data.length}개 기업의 대표 종목 내 비교입니다.</p>
          <dl className="dashboard-facts">
            <div>
              <dt>조회 기업 수</dt>
              <dd><strong>{totalCount.toLocaleString()}<small>개</small></strong><span>기업 합산 시총 순위</span></dd>
            </div>
            <div>
              <dt>시가총액 1위</dt>
              <dd><Link href={companyHref(data[0])}>{companyName(data[0])}</Link><span>{data[0].marketcap != null ? formatNumber(data[0].marketcap) : "—"}</span></dd>
            </div>
            <div>
              <dt>상승률 1위</dt>
              <dd>{gainers[0] ? <><Link href={trend(gainers[0]).href}>{companyName(gainers[0])}</Link><Rate rate={latestPrice(gainers[0])!.rate!} showIcon={false} /></> : <span>상승 종목 없음</span>}</dd>
            </div>
            <div>
              <dt>하락률 1위</dt>
              <dd>{losers[0] ? <><Link href={trend(losers[0]).href}>{companyName(losers[0])}</Link><Rate rate={latestPrice(losers[0])!.rate!} showIcon={false} /></> : <span>하락 종목 없음</span>}</dd>
            </div>
          </dl>
        </section>

        <div className="dashboard-panels">
          <MarketTrends gainers={gainers.map(trend)} losers={losers.map(trend)} volume={[]} date={priceDate} sampleCount={data.length} />
          <section className="dashboard-preview" aria-labelledby="dashboard-ranking">
            <div className="section-header">
              <h2 id="dashboard-ranking" className="section-heading">시가총액 TOP 5</h2>
              <Link href="/marketcaps" className="dashboard-more">전체 순위 →</Link>
            </div>
            <p className="data-note mb-4">보통주·우선주를 합산한 기업 시가총액입니다.</p>
            <ol className="dashboard-companies">
              {data.slice(0, 5).map(company => {
                const security = company.securities?.[0];
                const price = latestPrice(company);
                return (
                  <li key={company.companyId} className="dashboard-company-row">
                    <span className="dashboard-position">{company.marketcapRank ?? "—"}</span>
                    <div className="min-w-0">
                      <Link href={companyHref(company)} className="dashboard-company-name">{companyName(company)}</Link>
                      <p className="data-note">{security?.ticker} · {security?.exchange}</p>
                    </div>
                    <div className="dashboard-company-value">
                      <strong>{company.marketcap != null ? formatNumber(company.marketcap) : "—"}</strong>
                      <p className="data-note">{price?.close != null ? `${price.close.toLocaleString()}원` : "가격 정보 없음"}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="data-note mt-4">가격은 대표 보통주 기준이며, 시가총액과 기준일이 다를 수 있습니다.</p>
          </section>
        </div>
      </div>

      <aside className="context-rail dashboard-rail">
        <RecentSecuritiesSidebar />
        <section className="dashboard-basis">
          <h2 className="section-heading">조회 기준</h2>
          <dl>
            <div><dt>시가총액 기준일</dt><dd>{marketcapDate}</dd></div>
            <div><dt>가격 기준일</dt><dd>{priceDate}</dd></div>
          </dl>
          <p className="data-note">시가총액은 기업 합산, 가격과 등락률은 대표 보통주 기준입니다. 기업별 지표 기준일은 상세 화면에서 확인할 수 있습니다.</p>
        </section>
      </aside>
    </div>
  );
}
