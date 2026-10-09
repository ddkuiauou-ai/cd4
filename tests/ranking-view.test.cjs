const assert = require("node:assert/strict");
const test = require("node:test");
const { JSDOM } = require("jsdom");
const { createBusinessPageLoader } = require("./helpers/business-page-loader.cjs");

const view = createBusinessPageLoader().load("lib/ranking-view.ts");
const pagination = createBusinessPageLoader().load("lib/data/pagination.ts");
const security = (rank, overrides = {}) => ({
  securityId: `s-${rank}`, companyId: `c-${rank}`, korName: `예시종목${rank}`,
  exchange: "KOSPI", ticker: String(rank).padStart(6, "0"), type: "보통주",
  currentRank: rank, priorRank: rank + 2, value: rank * 1e12, prices: [],
  ...overrides,
});
const company = (rank, overrides = {}) => ({
  companyId: `c-${rank}`, korName: `예시기업${rank}`,
  marketcap: rank * 1e12, marketcapRank: rank, marketcapPriorRank: rank + 2,
  marketcapDate: "2025-09-22T00:00:00.000Z",
  securities: [{ exchange: "KOSPI", ticker: String(rank).padStart(6, "0"), type: "보통주", prices: [] }],
  ...overrides,
});

test("company aggregate links and values stay distinct from the representative common stock", () => {
  const row = view.createRankingRows([company(1, { routeCode: "KOSPI.005930", marketcap: "549000000000000", securities: [{ securityId: "common-1", type: "보통주", exchange: "KOSPI", ticker: "005930", marketcap: "494300000000000", prices: [{ close: "83000", rate: "-4.51", date: "2025-09-23" }] }] })], "marketcap", "company")[0];
  assert.equal(row.value, "549000000000000");
  assert.equal(row.href, "/company/KOSPI.005930/marketcap");
  assert.equal(row.close, "83000");
  assert.equal(row.rate, -4.51);
  assert.equal(row.priceDate, "2025-09-23");
});

test("missing prices or representative security do not remove a ranked entity or fabricate links", () => {
  const rows = view.createRankingRows([company(1), company(2, { securities: [] })], "marketcap", "company");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].value, 1e12);
  assert.equal(rows[0].rate, null);
  assert.deepEqual(rows[0].prices, []);
  assert.equal(rows[1].href, "/company/c-2/marketcap");
  assert.equal(rows[1].value, 2e12);
});

test("every metric preserves null, zero, negative values, its detail URL, and raw security identity", () => {
  for (const metric of Object.keys(view.RANKING_METRICS)) {
    const rows = view.createRankingRows([security(1, { value: null, [metric]: 42, valueObservedAt: null, [`${metric}Date`]: "2026-10-06" }), security(2, { value: 0 }), security(3, { value: -12.3 })], metric, "security");
    assert.deepEqual(rows.map(row => row.value), [null, 0, -12.3]);
    assert.equal(rows[0].metricDate, null);
    assert.equal(rows[2].href, `/security/KOSPI.000003/${metric}`);
    assert.equal(rows[2].id, "s-3");
    assert.equal(view.formatRankingValue(metric, null), "—");
    assert.notEqual(view.formatRankingValue(metric, 0), "—");
    assert.match(view.formatRankingValue(metric, -12.3), /^-/);
  }
});

test("rank movement separates unchanged, unknown, improvement, decline, and large moves from prices", () => {
  assert.equal(view.rankMovement(2, 4), 2);
  assert.equal(view.rankMovement(3, 2), -1);
  assert.equal(view.rankMovement(1, 1), 0);
  assert.equal(view.rankMovement(1, null), null);
  assert.equal(view.rankMovement(0, 1), null);
  assert.equal(view.rankMovement(2, Infinity), null);
  assert.equal(view.rankMovement(103, 2_601), 2_498);
});

test("finite source decimals written in exponent form remain values rather than missing observations", () => {
  const row = view.createRankingRows([security(1, { value: "3.82158e-05", prices: [{ date: "2026-10-06", close: "1.23e5", rate: "2.5e-1" }] })], "per", "security")[0];
  assert.equal(row.value, "3.82158e-05"); assert.equal(row.close, "1.23e5"); assert.equal(row.rate, .25);
  assert.equal(view.exactRankingValue("per", row.value), "0.0000382158배");
  assert.equal(view.formatRankingValue("per", row.value), "0.00배");
});

test("page boundaries expose all first twenty then the next hundred without overlap or an empty next link", () => {
  assert.deepEqual(pagination.computeMixedPagination(1), { page: 1, pageSize: 20, limit: 20, skip: 0 });
  assert.deepEqual(pagination.computeMixedPagination(2), { page: 2, pageSize: 100, limit: 100, skip: 20 });
  assert.deepEqual(pagination.computeMixedPagination(3), { page: 3, pageSize: 100, limit: 100, skip: 120 });
  assert.deepEqual(view.getRankingPager(1, 1), { prev: null, next: null });
  assert.deepEqual(view.getRankingPager(2, 2), { prev: 1, next: null });
  assert.deepEqual(view.getRankingPager(2, 3), { prev: 1, next: 3 });
  assert.equal(view.getRankingPager(4, 3), null);
  assert.equal(view.getRankingPager(1.5, 3), null);
});

test("detail neighbor selection independently handles first, middle, last, gaps, and missing ranks", () => {
  const items = [{ rank: null }, { rank: 4 }, { rank: 1 }, { rank: 2 }, { rank: 4 }, { rank: 0 }];
  const getRank = item => item.rank;
  assert.deepEqual(view.getRankNeighbors(items, 1, getRank), { prev: null, next: { rank: 2 } });
  assert.deepEqual(view.getRankNeighbors(items, 2, getRank), { prev: { rank: 1 }, next: { rank: 4 } });
  assert.deepEqual(view.getRankNeighbors(items, 4, getRank), { prev: { rank: 2 }, next: null });
  assert.deepEqual(view.getRankNeighbors(items, 3, getRank), { prev: { rank: 2 }, next: { rank: 4 } });
});

const publication = {
  asOf: "2026-10-06", revision: "9007199254740993", scopeKey: "krx-all",
  calculationId: "calc-ranking-1", publishedAt: "2026-10-06T08:00:00Z",
};
const publishedSecurity = (rank, overrides = {}) => ({
  securityId: `security-${rank}`, companyId: `company-${rank}`, korName: `공식종목${rank}`,
  exchange: "KOSPI", ticker: "005930", type: "보통주", currentRank: rank, priorRank: rank + 2,
  value: "9007199254740993", valueObservedAt: "2000-01-04", rankingState: "included", ...overrides,
});
const publishedCompany = (rank, overrides = {}) => ({
  companyId: `company-${rank}`, korName: `공식기업${rank}`, marketcap: "9007199254740993",
  marketcapRank: rank, marketcapPriorRank: rank + 2, marketcapDate: "2026-10-06",
  rankingState: "included", marketcapCompleteness: "complete", securities: [], ...overrides,
});

async function renderPage(route, {
  items = [], total = 120, page = 1, searchParams = {}, state = "published", revisionChanged = false,
  resultPublication = publication,
} = {}) {
  const calls = [];
  const result = { items, totalCount: total, totalPages: pagination.computeTotalPagesMixed(total),
    publication: resultPublication, state, revisionChanged };
  const loader = createBusinessPageLoader({
    "@/lib/data/security": { getSecurityRanksPage: async (...args) => { calls.push(["security", ...args]); return result; } },
    "@/lib/data/company": { getCompanyRankingPage: async (...args) => { calls.push(["company", ...args]); return result; } },
  });
  return { ...await loader.renderRoute(route, { params: { page: String(page) }, searchParams }), calls };
}

function documentOf(html) { return new JSDOM(html).window.document; }
function desktopRows(document) { return [...document.querySelectorAll(".desktopTable tbody tr")]; }
function mobileRows(document) { return [...document.querySelectorAll(".mobileTable tbody tr")]; }

test("actual company routes render the twenty official entities with stable links and a revision-pinned export", async () => {
  const items = Array.from({ length: 20 }, (_, index) => publishedCompany(index + 1));
  for (const route of ["app/(market)/page.tsx", "app/(market)/marketcaps/page.tsx"]) {
    const { html, text, calls } = await renderPage(route, { items, total: 121 });
    const document = documentOf(html);
    assert.deepEqual(calls, [["company", 1, undefined]]);
    assert.equal(desktopRows(document).length, 20);
    assert.equal(mobileRows(document).length, 20);
    assert.match(text, /공식기업20/);
    assert.match(text, /전체 121개 기업 · 1–20위/);
    assert.ok(document.querySelector('a[href="/company/company-20/marketcap"]'));
    assert.equal(document.querySelector('a[href^="/marketcaps/2"]').getAttribute("href"), `/marketcaps/2?revision=${publication.revision}`);
    assert.equal(document.querySelector('a[href^="/ranking-data/"]').getAttribute("href"), `/ranking-data/companies-marketcap.csv?revision=${publication.revision}&scope=krx-all`);
    assert.match(text, /9,007,199,254,740,993/);
  }
});

test("all seven actual metric pages use tem ranks without replacing their order or raw identity", async () => {
  const items = Array.from({ length: 20 }, (_, index) => publishedSecurity(index + 1));
  for (const metric of Object.keys(view.RANKING_METRICS)) {
    const { html, text, calls } = await renderPage(`app/(market)/${metric}/page.tsx`, { items });
    const document = documentOf(html);
    assert.deepEqual(calls, [["security", metric, 1, "asc", "krx-all", undefined]]);
    assert.equal(desktopRows(document).length, 20);
    assert.equal(mobileRows(document).length, 20);
    assert.ok(document.querySelector(`a[href="/security/KOSPI.005930/${metric}"]`));
    const exportURL = new URL(document.querySelector('a[href^="/ranking-data/"]').getAttribute("href"), "https://example.test");
    assert.equal(exportURL.pathname, `/ranking-data/securities-${metric}.csv`);
    assert.equal(exportURL.searchParams.get("revision"), publication.revision);
    assert.equal(exportURL.searchParams.get("scope"), "krx-all");
    assert.match(text, /공개 기준일 2026-10-06/);
    assert.match(text, /2000-01-04/);
    assert.match(text, /9,007,199,254,740,993/);
  }
});

test("official ranking values preserve supplied zero and negatives and are not filtered by current master status", async () => {
  const { html } = await renderPage("app/(market)/per/page.tsx", { items: [
    publishedSecurity(1, { value: "0", type: "우선주", delistedAt: "2020-01-01" }),
    publishedSecurity(6, { value: "-12.30", priorRank: 4, delistedAt: "2025-01-01" }),
    publishedSecurity(9, { value: "9007199254740993.125", priorRank: null }),
  ], total: 3 });
  const document = documentOf(html);
  const rows = desktopRows(document);
  assert.deepEqual(rows.map(row => row.querySelector("button[data-rank]").dataset.rank), ["1", "6", "9"]);
  assert.deepEqual(rows.map(row => row.querySelector(".valueDetails p").textContent), [
    "0배지표 관측일 2000-01-04", "-12.3배지표 관측일 2000-01-04", "9,007,199,254,740,993.125배지표 관측일 2000-01-04",
  ]);
  assert.match(rows[0].textContent, /우선주/);
  assert.match(rows[1].querySelector("button").getAttribute("aria-label"), /2계단 하락/);
  assert.match(rows[2].querySelector("button").getAttribute("aria-label"), /이전 순위 정보가 없습니다/);
  assert.equal(mobileRows(document).length, 3);
});

test("metric page two renders the hundred-item next window and carries both revision and scope", async () => {
  const scope = "kosdaq-preferred";
  const resultPublication = { ...publication, scopeKey: scope };
  const items = Array.from({ length: 100 }, (_, index) => publishedSecurity(index + 21));
  for (const metric of Object.keys(view.RANKING_METRICS)) {
    const { html, text, calls } = await renderPage(`app/(market)/${metric}/[page]/page.tsx`, {
      items, page: 2, searchParams: { scope, revision: publication.revision }, resultPublication,
    });
    const document = documentOf(html);
    assert.deepEqual(calls, [["security", metric, 2, "asc", scope, publication.revision]]);
    assert.equal(desktopRows(document).length, 100);
    assert.equal(mobileRows(document).length, 100);
    assert.match(text, /공식종목21/);
    assert.match(text, /공식종목120/);
    assert.match(text, /전체 120개 종목 · 21–120위/);
    const pager = document.querySelector('nav[aria-label="순위 목록 페이지"]');
    assert.equal(pager.querySelector("a").getAttribute("href"), `/${metric}?revision=${publication.revision}&scope=${scope}`);
    assert.equal(pager.querySelectorAll("a").length, 1);
  }
});

test("company page two renders one hundred official totals with a first-page previous link", async () => {
  const { html, calls } = await renderPage("app/(market)/marketcaps/[page]/page.tsx", {
    items: Array.from({ length: 100 }, (_, index) => publishedCompany(index + 21)), page: 2,
    searchParams: { revision: publication.revision },
  });
  const document = documentOf(html);
  assert.deepEqual(calls, [["company", 2, publication.revision]]);
  assert.equal(desktopRows(document).length, 100);
  assert.equal(mobileRows(document).length, 100);
  const pager = document.querySelector('nav[aria-label="순위 목록 페이지"]');
  assert.equal(pager.querySelector("a").getAttribute("href"), `/marketcaps?revision=${publication.revision}`);
  assert.equal(pager.querySelectorAll("a").length, 1);
});

test("published zero-member rankings allow a header-only export while unpublished rankings have no export", async () => {
  const completed = await renderPage("app/(market)/per/page.tsx", { total: 0 });
  assert.match(completed.text, /공개된 순위 대상은 0개/);
  assert.match(completed.text, /자료 갱신 번호 9007199254740993/);
  assert.match(completed.html, /securities-per\.csv\?revision=9007199254740993/);
  assert.doesNotMatch(completed.html, /다음 페이지|<tbody>/);
  const unpublished = await renderPage("app/(market)/per/page.tsx", { total: 0, state: "unpublished", resultPublication: null });
  assert.match(unpublished.text, /아직 공개된 순위가 없습니다/);
  assert.doesNotMatch(unpublished.text, /완료됐으며.*0건/);
  assert.doesNotMatch(unpublished.html, /ranking-data\/|다음 페이지|<tbody>/);
});

test("a replaced revision refreshes from the same scope and does not display new rows under an old URL", async () => {
  const { html, text, calls } = await renderPage("app/(market)/per/[page]/page.tsx", {
    total: 1, page: 2, revisionChanged: true,
    searchParams: { revision: "1", scope: "kospi" }, resultPublication: { ...publication, scopeKey: "kospi" },
  });
  assert.deepEqual(calls, [["security", "per", 2, "asc", "kospi", "1"]]);
  assert.match(text, /자료가 갱신되었습니다/);
  assert.match(html, /href="\/per\?scope=kospi"[^>]*>최신 자료 보기/);
  assert.doesNotMatch(html, /<tbody>|ranking-data\/|다음 페이지/);
});

test("invalid page numbers and nonexistent current pages produce 404 rather than an empty result", async () => {
  for (const page of ["2x", 0, -1, 1.5, "Infinity", "9007199254740993"]) {
    await assert.rejects(renderPage("app/(market)/per/[page]/page.tsx", { page, total: 200 }), /NOT_FOUND/);
  }
  await assert.rejects(renderPage("app/(market)/per/[page]/page.tsx", { page: 2, total: 20 }), /NOT_FOUND/);
  await assert.rejects(renderPage("app/(market)/marketcaps/[page]/page.tsx", { page: 3, total: 120 }), /NOT_FOUND/);
});

test("ambiguous aliases use immutable IDs, prices stay exact, and dated chart gaps are preserved", async () => {
  const rows = view.createRankingRows([publishedSecurity(1, { routeCode: null, prices: [
    { date: "2026-10-06", close: "9007199254740993", rate: "-1.23", volume: "9007199254740993" },
    { date: "2026-10-02", close: "100", rate: "2", volume: "0" },
    { date: "2026-10-03", close: null, rate: null, volume: null },
  ] })], "marketcap", "security");
  assert.equal(rows[0].href, "/security/security-1/marketcap");
  assert.equal(rows[0].close, "9007199254740993");
  assert.equal(rows[0].volume, "9007199254740993");
  assert.equal(rows[0].rate, -1.23);
  assert.equal(rows[0].prices.at(-1).close, "9007199254740993");
  assert.deepEqual(rows[0].prices.map(price => price.date), ["2026-10-02", "2026-10-03", "2026-10-06"]);
  const loader = createBusinessPageLoader();
  const React = require("react");
  const { RankingRate, RankingSparkline } = loader.load("components/ranking-row-parts.tsx");
  const rate = documentOf((await loader.renderElement(React.createElement(RankingRate, { row: rows[0] }))).html);
  assert.match(rate.querySelector("span").getAttribute("aria-label"), /9,007,199,254,740,993원.*2026-10-06.*-1\.23%/);
  const sparkline = documentOf((await loader.renderElement(React.createElement(RankingSparkline, { row: rows[0] }))).html);
  assert.equal(sparkline.querySelectorAll("polyline").length, 2);
  assert.equal(sparkline.querySelectorAll("circle").length, 2);
  assert.match(sparkline.querySelector('[role="img"]').getAttribute("aria-label"), /2026-10-02–2026-10-06/);
  const adjacent = view.createRankingRows([publishedSecurity(2, { prices: [
    { date: "2026-10-02", close: "9007199254740992" }, { date: "2026-10-03", close: "9007199254740993" },
  ] })], "marketcap", "security")[0];
  const exactChart = documentOf((await loader.renderElement(React.createElement(RankingSparkline, { row: adjacent }))).html);
  assert.equal(exactChart.querySelector("polyline").getAttribute("points"), "0.00,20.00 108.00,0.00");
});

test("partial and missing company inputs remain ranked and the price basis states the actual range", async () => {
  const common = date => ({ securityId: `common-${date}`, exchange: "KOSPI", ticker: "005930", type: "보통주",
    prices: [{ date, close: "83000", rate: "2", volume: "1200" }] });
  const { html, text } = await renderPage("app/(market)/marketcaps/page.tsx", { items: [
    publishedCompany(1, { value: null, marketcap: null, securities: [common("2026-10-02")], marketcapCompleteness: "missing_input" }),
    publishedCompany(2, { securities: [common("2026-10-06")], marketcapCompleteness: "insufficient_link" }),
    publishedCompany(3),
  ], total: 3 });
  const document = documentOf(html);
  assert.equal(desktopRows(document).length, 3);
  assert.match(text, /합산 자료 부족/);
  assert.match(text, /합산 자료 연결 근거 부족/);
  assert.match(text, /가격 관측일 2026-10-02–2026-10-06/);
  assert.match(desktopRows(document)[2].textContent, /대표 종목 없음/);
  assert.ok(desktopRows(document)[2].querySelector('a[href="/company/company-3/marketcap"]'));
  assert.match(desktopRows(document)[0].querySelector(".valueDetails summary").getAttribute("aria-label"), /지표 정보 없음/);
});
