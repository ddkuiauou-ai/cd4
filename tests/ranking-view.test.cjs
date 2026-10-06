const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
function loader(overrides = {}) {
  const loaded = new Map();
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => {
      if (overrides[name]) return { __esModule: true, ...overrides[name] };
      if (name.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      const local = name.startsWith("@/") ? path.join(root, name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (!local) return require(name);
      const resolved = [local, `${local}.ts`, `${local}.tsx`].find(existsSync);
      assert.ok(resolved, `Missing module ${name}`);
      return load(resolved);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  return name => load(path.join(root, name));
}

const view = loader()("lib/ranking-view.ts");
const pagination = loader()("lib/data/pagination.ts");
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
  const row = view.createRankingRows([company(1, { marketcap: 549e12, securities: [{ exchange: "KOSPI", ticker: "005930", marketcap: 494.3e12, prices: [{ close: 83_000, rate: -4.51, date: "2025-09-23" }] }] })], "marketcap", "company")[0];
  assert.equal(row.value, 549e12);
  assert.equal(row.href, "/company/KOSPI.005930/marketcap");
  assert.equal(row.close, 83_000);
  assert.equal(row.rate, -4.51);
  assert.equal(row.priceDate, "2025-09-23");
});

test("missing prices or representative security do not remove a ranked entity or fabricate links", () => {
  const rows = view.createRankingRows([company(1), company(2, { securities: [] })], "marketcap", "company");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].value, 1e12);
  assert.equal(rows[0].rate, null);
  assert.deepEqual(rows[0].prices, []);
  assert.equal(rows[1].href, null);
  assert.equal(rows[1].value, 2e12);
});

test("every metric preserves null, zero, negative values, its detail URL, and raw security identity", () => {
  for (const metric of Object.keys(view.RANKING_METRICS)) {
    const rows = view.createRankingRows([security(1, { value: null }), security(2, { value: 0 }), security(3, { value: -12.3 })], metric, "security");
    assert.deepEqual(rows.map(row => row.value), [null, 0, -12.3]);
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

async function renderPage(route, { items, total = 120, date = "2025-09-22", page = 1, scope = "security" }) {
  const calls = [];
  const downloads = [];
  const load = loader({
    "next/link": { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
    "next/navigation": { notFound: () => { throw new Error("NOT_FOUND"); }, redirect: href => { throw new Error(`REDIRECT:${href}`); } },
    "@/components/spike-chart": { default: () => React.createElement("svg", { "data-testid": "trend" }) },
    "@/components/recent-securities-sidebar": { RecentSecuritiesSidebar: () => React.createElement("section", null, "최근 본 종목") },
    "@/components/CsvDownloadButton": { CsvDownloadButton: props => {
      downloads.push(props);
      return React.createElement("a", { href: "csv" }, "전체 순위 CSV");
    } },
    "@/lib/data/security": {
      getSecurityRanksPage: async (...args) => { calls.push(args); return { items, latestDate: date }; },
      countSecurityRanks: async metric => { calls.push(["count", metric]); return total; },
    },
    "@/lib/data/company": {
      getCompanyMarketcapsPage: async value => {
        calls.push([value]);
        return { items, totalCount: total, totalPages: pagination.computeTotalPagesMixed(total) };
      },
      countCompanyMarketcaps: async () => total,
    },
  });
  const { default: Page } = load(route);
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ page: String(page) }) }));
  return { html, calls, downloads, text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(), scope };
}

test("both actual first-page company routes render all twenty entries and export the whole scoped ranking", async () => {
  const items = Array.from({ length: 20 }, (_, i) => company(i + 1, i === 10 ? { securities: [] } : {}));
  for (const route of ["app/(market)/page.tsx", "app/(market)/marketcaps/page.tsx"]) {
    const { html, text, calls, downloads } = await renderPage(route, { items, total: 121, scope: "company" });
    assert.deepEqual(calls, [[1]]);
    assert.equal((html.match(/<tbody>/g) || []).length, 2);
    assert.equal((html.match(/<tr>/g) || []).length, 42);
    assert.match(text, /예시기업20/);
    assert.match(text, /전체 121개 기업 · 1–20위/);
    assert.match(html, /href="\/marketcaps\/2"/);
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].scope, "company");
    assert.equal(downloads[0].metric, "marketcap");
    assert.equal(downloads[0].expectedDate, "2025-09-22");
    assert.equal(downloads[0].expectedTotalCount, 121);
    assert.equal(downloads[0].expectedCompanyRows.length, 20);
    assert.deepEqual(downloads[0].expectedCompanyRows[10], { id: "c-11", rank: 11, priorRank: 13, value: 11e12, metricDate: "2025-09-22" });
    assert.doesNotMatch(text, /준비 중|불러오는 중/);
  }
});

test("all seven actual metric pages keep security scope, sort semantics, and every first-page row", async () => {
  const items = Array.from({ length: 20 }, (_, i) => security(i + 1));
  for (const metric of Object.keys(view.RANKING_METRICS)) {
    const { html, calls, downloads } = await renderPage(`app/(market)/${metric}/page.tsx`, { items });
    const order = ["marketcap", "per", "pbr"].includes(metric) ? "asc" : "desc";
    assert.deepEqual(calls, [["count", metric], [metric, 1, order]]);
    assert.equal((html.match(/<tr>/g) || []).length, 42);
    assert.match(html, new RegExp(`href="/security/KOSPI\\.000020/${metric}"`));
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].scope, "security");
    assert.equal(downloads[0].metric, metric);
    assert.equal(downloads[0].expectedDate, "2025-09-22");
    assert.equal(downloads[0].expectedTotalCount, 120);
    assert.equal(downloads[0].expectedCompanyRows, undefined);
  }
});

test("all seven metric page-two routes render the complete hundred rows and last-page previous URL", async () => {
  const items = Array.from({ length: 100 }, (_, i) => security(i + 21));
  for (const metric of Object.keys(view.RANKING_METRICS)) {
    const { html, text } = await renderPage(`app/(market)/${metric}/[page]/page.tsx`, { items, page: 2 });
    assert.equal((html.match(/<tr>/g) || []).length, 202);
    assert.match(text, /21–120위/);
    assert.match(html, new RegExp(`href="/${metric}"[^>]*rel="prev"`));
    assert.doesNotMatch(html, new RegExp(`href="/${metric}/3"`));
  }
});

test("completed empty rankings show absence without a loading claim or download/pager action", async () => {
  const { html, text, downloads } = await renderPage("app/(market)/per/page.tsx", { items: [], total: 0, date: null });
  assert.match(text, /표시할 순위 데이터가 없습니다/);
  assert.match(text, /정보 없음/);
  assert.doesNotMatch(html, /준비 중|불러오는 중|rel="next"/);
  assert.deepEqual(downloads, []);
});

test("company page two keeps one hundred entities and routes back to the first-page base", async () => {
  const { html, text } = await renderPage("app/(market)/marketcaps/[page]/page.tsx", {
    items: Array.from({ length: 100 }, (_, i) => company(i + 21)), page: 2, scope: "company",
  });
  assert.equal((html.match(/<tr>/g) || []).length, 202);
  assert.match(text, /21–120위/);
  assert.match(html, /href="\/marketcaps"[^>]*rel="prev"/);
  assert.doesNotMatch(html, /href="\/marketcaps\/3"/);
});

test("invalid and absent metric pages cannot render an impossible ranking page", async () => {
  await assert.rejects(renderPage("app/(market)/per/[page]/page.tsx", { items: [], page: 2, total: 20 }), /NOT_FOUND/);
  await assert.rejects(renderPage("app/(market)/per/[page]/page.tsx", { items: [], page: "2x", total: 200 }), /NOT_FOUND/);
  await assert.rejects(renderPage("app/(market)/per/[page]/page.tsx", { items: [], page: 0, total: 200 }), /NOT_FOUND/);
});
