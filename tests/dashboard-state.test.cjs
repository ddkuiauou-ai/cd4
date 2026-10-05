const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const element = (tag) => ({ children, className }) => React.createElement(tag, { className }, children);

// Render the actual async page. Only its query and child components are replaced;
// formatting and the page's data selection, states, and markup remain real.
async function renderDashboard(result) {
  const queryCalls = [];
  const trendProps = [];
  const children = {
    "next/link": { default: ({ href, children, className }) => React.createElement("a", { href, className }, children) },
    "@/components/site-footer": { SiteFooter: () => React.createElement("footer") },
    "@/components/ui/card": {
      Card: element("section"), CardContent: element("div"),
      CardDescription: element("p"), CardHeader: element("header"), CardTitle: element("h2"),
    },
    "@/components/ui/badge": { Badge: element("span") },
    "@/components/ui/skeleton": {
      Skeleton: () => React.createElement("div", { "data-testid": "loading-skeleton" }),
    },
    "@/components/exchange": { default: ({ exchange }) => React.createElement("span", null, exchange) },
    "@/components/CompanyLogo": { default: () => React.createElement("span", { "data-testid": "company-logo" }) },
    "@/components/rate": {
      default: ({ rate }) => React.createElement("span", { "data-testid": "rate" }, `${rate}%`),
    },
    "@/components/MarketTrends": {
      default: (props) => {
        trendProps.push(props);
        return React.createElement("div", { "data-testid": "market-trends" });
      },
    },
  };
  const loaded = new Map();
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = (name) => {
      if (name === "@/lib/data/company") {
        return { getCompanyMarketcapsPage: async (page) => {
          queryCalls.push(page);
          return result;
        } };
      }
      if (children[name]) return { __esModule: true, ...children[name] };
      const local = name.startsWith("@/")
        ? path.join(root, name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (!local) return require(name);
      const resolved = [local, `${local}.ts`, `${local}.tsx`].find(existsSync);
      assert.ok(resolved, `Local module not found: ${name}`);
      return load(resolved);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  const { default: DashboardPage } = load(path.join(root, "app/dashboard/page.tsx"));
  const html = renderToStaticMarkup(await DashboardPage());
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return { html, text, queryCalls, trendProps };
}

function companyFixture(prices = []) {
  return {
    companyId: "company-1", name: "예시기업", korName: "예시기업", logo: null,
    marketcap: 2_000_000_000_000, marketcapRank: 1, marketcapPriorRank: 2,
    marketcapDate: new Date("2025-09-22T00:00:00Z"),
    securities: [{ securityId: "security-1", exchange: "KOSPI", ticker: "000001", prices }],
  };
}

test("a completed empty dashboard shows an empty state instead of a loading skeleton", async () => {
  const { html, text, queryCalls, trendProps } = await renderDashboard({ items: [], totalCount: 0 });
  assert.match(text, /대시보드/);
  assert.match(text, /표시할 기업 데이터가 없습니다/);
  assert.match(html, /href="\/"[^>]*>랭킹으로 이동/);
  assert.doesNotMatch(html, /loading-skeleton|animate-pulse/);
  assert.deepEqual(queryCalls, [1]);
  assert.equal(trendProps.length, 0);
});

test("a company without prices still renders its market cap and marks prices as unavailable", async () => {
  const { html, text, trendProps } = await renderDashboard({ items: [companyFixture()], totalCount: 1 });
  assert.match(text, /시가총액 기준일: 2025-09-22/);
  assert.match(text, /가격 기준일: 미확인/);
  assert.match(html, /href="\/company\/KOSPI\.000001"[^>]*>예시기업<\/a>/);
  assert.match(text, /2\.0조/);
  assert.match(html, /<span>—<\/span>/);
  assert.doesNotMatch(html, /data-testid="rate"|loading-skeleton/);
  assert.deepEqual(trendProps[0].gainers, []);
  assert.deepEqual(trendProps[0].losers, []);
  assert.deepEqual(trendProps[0].volume, []);
});

test("different market-cap and price dates remain distinct and the total is not the page length", async () => {
  const prices = [
    { date: new Date("2026-09-29T00:00:00Z"), close: 42_000, rate: 0.1 },
    { date: new Date("2026-09-30T00:00:00Z"), close: 44_000, rate: 1.1 },
  ];
  const { text, trendProps } = await renderDashboard({ items: [companyFixture(prices)], totalCount: 2_601 });
  assert.match(text, /시가총액 기준일: 2025-09-22/);
  assert.match(text, /가격 기준일: 2026-09-30/);
  assert.match(text, /총 상장기업 2,601 상장 기업 수/);
  assert.match(text, /44,000원/);
  assert.doesNotMatch(text, /실시간 데이터 업데이트 중/);
  assert.equal(trendProps[0].date, "2026-09-30");
  assert.equal(trendProps[0].gainers[0].price, 44_000);
});
