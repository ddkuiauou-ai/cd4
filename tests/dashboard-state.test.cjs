const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { JSDOM } = require("jsdom");
const { createBusinessPageLoader } = require("./helpers/business-page-loader.cjs");

const publication = {
  asOf: "2026-10-06", revision: "9007199254740993", scopeKey: "krx-all",
  calculationId: "calc-company-1", publishedAt: "2026-10-06T08:00:00Z",
};
function companyFixture(overrides = {}) {
  return { companyId: "company-1", name: "예시기업", korName: "예시기업", marketcap: "9007199254740993",
    marketcapRank: 1, marketcapPriorRank: 2, marketcapDate: "2026-10-06", marketcapCompleteness: "complete",
    rankingState: "included", securities: [], ...overrides };
}
const withPrice = (rank, rate, volume, date = "2026-10-06") => companyFixture({ companyId: `company-${rank}`,
  korName: `기업${rank}`, marketcapRank: rank, marketcap: String(1e12 * rank), securities: [{
    securityId: `security-${rank}`, exchange: "KOSPI", ticker: String(rank).padStart(6, "0"), type: "보통주",
    prices: [{ close: "83000", rate, volume, date }],
  }] });
function snapshot(items = [], overrides = {}) {
  return { state: "published", publication, revisionChanged: false, items, totalCount: items.length,
    totalPages: 1, ...overrides };
}
async function renderDashboard(result, searchParams = {}, inspectTrends = false) {
  const calls = []; let trends;
  const loader = createBusinessPageLoader({
    "@/lib/data/company": { getCompanyRankingPage: async (...args) => { calls.push(args); return result; } },
    "@/lib/data/security": {},
    ...(inspectTrends ? { "@/components/MarketTrends": { default: props => {
      trends = props; return React.createElement("section", null, "관측 데이터 테스트");
    } } } : {}),
  });
  return { ...await loader.renderRoute("app/dashboard/page.tsx", { searchParams }), calls, getTrends: () => trends };
}
const documentOf = html => new JSDOM(html).window.document;

test("dashboard restores the four facts, trends, TOP5, and recent sidebar while preserving exact official values", async () => {
  const { html, text, calls } = await renderDashboard(snapshot([companyFixture()]));
  const document = documentOf(html);
  assert.match(text, /한눈에 보기/); assert.match(text, /상위 기업의 주가 흐름/); assert.match(text, /시가총액 TOP 5/);
  assert.equal(document.querySelectorAll(".dashboard-facts > div").length, 4);
  assert.match(text, /자료 갱신 번호 9007199254740993/);
  assert.match(text, /9,007,199,254,740,993/);
  assert.ok(document.querySelector('a[href="/company/company-1/marketcap"]'));
  assert.match(text, /가격 정보 없음/); assert.match(text, /최근 본 종목/);
  assert.deepEqual(calls, [[1, undefined]]);
  assert.doesNotMatch(text, /실시간 데이터|데이터 버전/);
});

test("completed zero-company publications offer a header-only export; unpublished dashboards keep their navigation", async () => {
  const complete = await renderDashboard(snapshot());
  assert.match(complete.text, /공개된 순위 대상은 0개/);
  assert.match(complete.text, /조회 기업 수 0 개/);
  assert.match(complete.html, /companies-marketcap\.csv\?revision=9007199254740993/);
  assert.equal(documentOf(complete.html).querySelectorAll(".dashboard-companies li").length, 0);
  const unpublished = await renderDashboard(snapshot([], { state: "unpublished", publication: null }));
  assert.match(unpublished.text, /아직 공개된 회사 순위가 없습니다/);
  assert.ok(documentOf(unpublished.html).querySelector('a[href="/"]'));
  assert.doesNotMatch(unpublished.html, /ranking-data\/|dashboard-facts/);
});

test("TOP5 retains ranked companies with missing representative prices and partial inputs", async () => {
  const { html, text } = await renderDashboard(snapshot([
    companyFixture({ companyId: "company-no-representative", korName: "대표종목없는기업", marketcap: null, marketcapCompleteness: "missing_input" }),
    companyFixture({ companyId: "company-delisted", korName: "공식포함기업", marketcapRank: 9, delistedAt: "2025-01-01",
      marketcap: "0", securities: [{ type: "우선주", delistedAt: "2025-01-01", prices: [{ date: "2026-10-06", close: "1", rate: "50", volume: "100" }] }] }),
  ]));
  const document = documentOf(html);
  assert.equal(document.querySelectorAll(".dashboard-companies li").length, 2);
  assert.match(text, /대표종목없는기업/); assert.match(text, /공식포함기업/);
  assert.match(text, /합산 자료 부족/);
  assert.match(document.querySelector(".dashboard-companies li:last-child").textContent, /0원.*가격 정보 없음/);
});

test("gainers and losers use stored daily rates; volume is exact and dates reflect the representative observations", async () => {
  const items = [withPrice(1, "2", "9007199254740992", "2026-10-02"), withPrice(2, "-3", "9007199254740993"),
    withPrice(3, "5", "30"), withPrice(4, "-8", "0"), withPrice(5, "0", null)];
  const result = await renderDashboard(snapshot(items, { totalCount: 121 }), {}, true);
  const trends = result.getTrends();
  assert.deepEqual(trends.gainers.map(item => item.securityId), ["security-3", "security-1"]);
  assert.deepEqual(trends.losers.map(item => item.securityId), ["security-4", "security-2"]);
  assert.deepEqual(trends.volume.map(item => item.securityId), ["security-2", "security-1", "security-3", "security-4"]);
  assert.equal(trends.volume[0].volume, "9007199254740993");
  assert.equal(trends.gainers[0].price, "83000");
  assert.equal(trends.date, "2026-10-02–2026-10-06"); assert.equal(trends.sampleCount, 5);
  assert.match(result.text, /조회 기업 수 121 개/);
  assert.match(result.text, /상승률 1위 기업3 \+5\.00%/);
  assert.match(result.text, /하락률 1위 기업4 -8\.00%/);
});

test("dashboard pins full-ranking and CSV links to the publication instead of reconstructing the aggregate", async () => {
  const items = Array.from({ length: 20 }, (_, index) => companyFixture({ companyId: `company-${index + 1}`,
    korName: `기업${index + 1}`, marketcapRank: index + 1 }));
  const { html, text, calls } = await renderDashboard(snapshot(items, { totalCount: 121, totalPages: 3 }), { revision: publication.revision });
  const document = documentOf(html);
  assert.equal(document.querySelectorAll(".dashboard-companies li").length, 5);
  assert.match(text, /조회 기업 수 121 개/);
  assert.deepEqual(calls, [[1, publication.revision]]);
  assert.equal(document.querySelector(".dashboard-more").getAttribute("href"), `/marketcaps?revision=${publication.revision}`);
  assert.equal(document.querySelector('a[href^="/ranking-data/"]').getAttribute("href"), `/ranking-data/companies-marketcap.csv?revision=${publication.revision}&scope=krx-all`);
});

test("a replaced revision offers a dashboard refresh and renders no mixed ranking or export", async () => {
  const { html, text, calls } = await renderDashboard(snapshot([companyFixture()], { revisionChanged: true, totalCount: 20 }), { revision: "1" });
  assert.deepEqual(calls, [[1, "1"]]); assert.match(text, /자료가 갱신되었습니다/);
  assert.ok(documentOf(html).querySelector('a[href="/dashboard"]'));
  assert.doesNotMatch(html, /dashboard-companies|ranking-data\/|dashboard-facts/);
});
