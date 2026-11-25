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
async function renderDashboard(result, searchParams = {}, inspectTrends = false, arena = null, marketCsv = null) {
  const calls = []; let trends;
  const loader = createBusinessPageLoader({
    "@/lib/data/company": { getCompanyRankingPage: async (...args) => { calls.push(args); return result; } },
    "@/lib/data/dashboard-arena": { getDashboardArena: async () => arena },
    "@/lib/data/market-csv": { getMarketCsvMetadata: async () => marketCsv },
    "@/lib/data/security": {},
    ...(inspectTrends ? { "@/components/MarketTrends": { default: props => {
      trends = props; return React.createElement("section", null, "관측 데이터 테스트");
    } } } : {}),
  });
  return { ...await loader.renderRoute("app/dashboard/page.tsx", { searchParams }), calls, getTrends: () => trends };
}
const documentOf = html => new JSDOM(html).window.document;

test("the live dashboard shows the four arena scenes and keeps the linked market records available", async () => {
  const { html } = await renderDashboard(snapshot([withPrice(1, "2", "100")]), {}, false, {
    today: [], past: [{ metric: "pbr", date: "2025-10-02", currentDate: publication.asOf, tiedCount: 2,
      row: { id: "pbr-1", name: "대표 종목", value: "0.11", href: null, rank: 1, type: "보통주", current: null } }],
    score: { ready: true, count: 0, scores: [] },
  });
  const document = documentOf(html);
  const heading = document.querySelector(".pageHeading");
  assert.equal(heading.querySelector("h1").textContent, "대회장");
  assert.equal(heading.querySelector("time").dateTime, publication.asOf);
  assert.equal(heading.nextElementSibling.getAttribute("aria-label"), "대회장 전광판");
  assert.equal(document.querySelectorAll("h1").length, 1);
  assert.deepEqual([...document.querySelectorAll("[data-arena-scene]")].map(scene => [scene.dataset.arenaScene, scene.hidden]),
    [["today", false], ["past", true], ["overall", true], ["closing", true]]);
  const menus = document.querySelectorAll('nav[aria-label="대회장 장면"]');
  assert.equal(menus.length, 1);
  const trigger = menus[0].querySelector('[aria-expanded]');
  assert.equal(trigger.textContent, "오늘의 장");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  const options = document.getElementById(trigger.getAttribute("aria-controls"));
  assert.equal(options.hidden, true);
  assert.deepEqual([...options.querySelectorAll('[aria-controls]')].map(button => document.getElementById(button.getAttribute('aria-controls')).dataset.arenaScene),
    ["past", "overall", "closing"]);
  assert.ok(menus[0].parentElement.querySelector('[aria-label="장면 자동 순환 일시 정지"]'));
  const pbr = document.querySelector('#arena-panel-past article:last-child');
  assert.match(pbr.querySelector('h3').textContent, /PBR.*2025-10-02.*공동 1위/);
  assert.deepEqual([...pbr.querySelectorAll('li strong')].map(node => node.textContent), ["대표 종목"]);
  const records = document.querySelector(".recordsDetails");
  assert.equal(records.open, false);
  assert.equal(records.querySelector(".recordsLabel").textContent, "기록실");
  assert.ok(records.querySelector('a[href^="/ranking-data/companies-marketcap.csv"]'));
});

test("the historical card picks one tied leader using the exact same-day capitalization", () => {
  const { historicalRepresentative } = createBusinessPageLoader().load("lib/dashboard-arena.ts");
  const entry = (ticker, observedMarketcap, name = ticker) => ({ id: ticker, ticker, name, observedMarketcap,
    href: null, rank: 1, value: "0.11", type: "보통주" });
  const smaller = entry("000010", "9007199254740992");
  const larger = entry("000020", "9007199254740993");
  assert.equal(historicalRepresentative([smaller, larger]).id, larger.id);
  assert.equal(historicalRepresentative([entry("000001", null), entry("000030", "0")]).id, "000030");
  assert.equal(historicalRepresentative([entry("000020", "100"), entry("000010", "100")]).id, "000010");
  assert.equal(historicalRepresentative([{ ...larger, ticker: undefined, name: "나", observedMarketcap: undefined },
    { ...smaller, ticker: undefined, name: "가", observedMarketcap: undefined }]).id, smaller.id);
  assert.equal(historicalRepresentative([]), null);
});

test("arena scoring uses a common eligible set, sums three ranks, and retains ties and zero dividends", () => {
  const { scoreArena } = createBusinessPageLoader().load("lib/dashboard-arena.ts");
  const date = publication.asOf;
  const metricRows = values => Object.entries(values).map(([id, value]) => ({ id, value, name: id, href: null, rank: 1, type: "보통주" }));
  const ranks = Object.fromEntries(Object.entries({
    per: { a: "2", b: "3", c: "99", excluded: "0.1" }, pbr: { a: "2", b: "1", c: "9", excluded: "0.1" },
    div: { a: "5", b: "5", c: "0", excluded: "10" }, eps: { a: "100", b: "20", c: "10", excluded: "0" },
    bps: { a: "200", b: "30", c: "40", excluded: "10" }, dps: { a: "50", b: "30", c: "0", excluded: "10" },
  }).map(([metric, values]) => [metric, { date, rows: metricRows(values) }]));
  const score = scoreArena(ranks, date);
  assert.equal(score.count, 3);
  assert.deepEqual(score.scores.map(row => [row.entry.id, row.place, row.total, row.divisions.map(division => division.rank)]),
    [["a", 1, 4, [1, 2, 1]], ["b", 1, 4, [2, 1, 1]], ["c", 3, 9, [3, 3, 3]]]);
  assert.equal(score.scores[2].divisions[2].raw, "0");
  assert.equal(scoreArena({ ...ranks, eps: { ...ranks.eps, date: "2026-10-05" } }, date).ready, false);
});

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

test("records-room entry keeps company exports with TOP5 and gives each of the eight ranking shortcuts its own scope", async () => {
  const { html } = await renderDashboard(snapshot([withPrice(1, "2", "100")]), {}, false, null,
    { date: "2026-10-08", rowCount: 2872, url: "/downloads/market/2026-10-08.csv" });
  const document = documentOf(html);
  assert.equal(document.querySelector("h1").textContent, "대회장");
  const top5 = document.getElementById("dashboard-ranking").closest("section");
  assert.ok(top5.querySelector('a[href^="/ranking-data/companies-marketcap.csv"]'));
  assert.ok(top5.querySelector('a[href="/company/company-1/marketcap"]'));
  assert.ok(top5.querySelector('button[data-rank="1"]'));
  const shortcuts = document.querySelector('nav[aria-label="지표별 전체 순위"]');
  assert.equal(shortcuts.querySelectorAll("a").length, 8);
  assert.match(shortcuts.querySelector('a[href="/marketcap"]').textContent, /시가총액종목별/);
  assert.equal(document.querySelector('a[download][href="/downloads/market/2026-10-08.csv"] time').dateTime, '2026-10-08');
  assert.equal(shortcuts.querySelector("a").getAttribute("href"), `/marketcaps?revision=${publication.revision}`);
  assert.match(shortcuts.querySelector("a").textContent, /기업 합산/);
  assert.equal(shortcuts.querySelector('a[href="/per"]').textContent.includes("종목별"), true);
  assert.ok(document.querySelector('#market-trends').closest("section").querySelector('a[href="/security/KOSPI.000001/marketcap"]'));
});
