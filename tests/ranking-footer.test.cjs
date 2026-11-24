const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { JSDOM } = require("jsdom");
const { createBusinessPageLoader } = require("./helpers/business-page-loader.cjs");

function createLoader(pathname) {
  return createBusinessPageLoader({
    "next/image": { default: props => React.createElement("img", props) },
    "next/navigation": { usePathname: () => pathname },
    "@/components/mobile-header-context": { MobileHeaderProvider: ({ children }) => children },
    "@/components/site-header": { SiteHeader: () => React.createElement("header", { "data-site-header": true }) },
    "@/components/bottom-navigation": { BottomNavigation: () => React.createElement("nav", { "aria-label": "모바일 하단 탐색" }) },
  });
}

const expectedDirectory = [
  ["시가총액", [["/marketcaps", "기업 합산"], ["/marketcap", "종목별"]]],
  ["주가 지표", [["/per", "PER"], ["/pbr", "PBR"], ["/eps", "EPS"], ["/bps", "BPS"]]],
  ["배당", [["/div", "배당수익률"], ["/dps", "주당배당금"]]],
];

test("dashboard, ranking and detail layouts share the visible directory and mobile navigation", async () => {
  for (const [layout, pathname, expectedAction] of [
    ["dashboard", "/dashboard/", ["/", "전체 랭킹 보기"]],
    ["(market)", "/", ["#ranking-metric-navigation", "지표 메뉴로 돌아가기"]],
    ["(market)", "/bps/2/", ["#ranking-metric-navigation", "지표 메뉴로 돌아가기"]],
    ["company", "/company/KOSPI.005930/marketcap/", ["/marketcaps", "기업 합산 시총 순위 보기"]],
    ["company", "/company/KOSPI.005930/", ["/marketcaps", "기업 합산 시총 순위 보기"]],
    ["security", "/security/KOSPI.005930/marketcap/", ["/marketcap", "종목별 시총 순위 보기"]],
    ["security", "/security/KOSPI.005930/per/", ["/per", "PER 전체 순위 보기"]],
    ["security", "/security/KOSPI.005930/div/", ["/div", "배당수익률 전체 순위 보기"]],
  ]) {
    const loader = createLoader(pathname);
    const { default: Layout } = loader.load(`app/${layout}/layout.tsx`);
    const { html } = await loader.renderElement(React.createElement(Layout, null, "본문"));
    const { window } = new JSDOM(html);
    try {
      const { document } = window;
      const footers = document.querySelectorAll(".app-shell > footer");
      assert.equal(footers.length, 1, pathname);
      const footer = footers[0];
      assert.equal(footer.getAttribute("aria-label"), "사이트 푸터");
      assert.equal(footer.previousElementSibling.textContent, "본문");
      const directory = footer.querySelector('nav[aria-label="전체 순위 목차"]');
      assert.equal(footer.querySelector("details"), null);
      assert.deepEqual([...directory.querySelectorAll("section")].map(section => [
        section.querySelector("h2").textContent,
        [...section.querySelectorAll("a")].map(link => [link.getAttribute("href"), link.textContent]),
      ]), expectedDirectory, pathname);
      const actions = [...footer.querySelectorAll("a")].filter(link => !directory.contains(link));
      assert.deepEqual(actions.map(action => [action.getAttribute("href"), action.textContent]), [expectedAction], pathname);
      assert.equal(footer.querySelector('img[src="/icon.svg"]')?.getAttribute("alt"), "");
      assert.equal(document.querySelectorAll('nav[aria-label="모바일 하단 탐색"]').length, 1);
    } finally {
      window.close();
    }
  }
});

test("ranking footer fragment targets the current ranking menu and can receive focus", async () => {
  const loader = createLoader("/bps/2/");
  const { MarketNav } = loader.load("components/market-nav.tsx");
  const { SiteFooter } = loader.load("components/site-footer.tsx");
  const { html } = await loader.renderElement(React.createElement(React.Fragment, null,
    React.createElement(MarketNav, { metric: "bps", scope: "security", scopeKey: "kosdaq" }),
    React.createElement(SiteFooter, { context: "ranking" })));
  const { window } = new JSDOM(html);
  try {
    const { document } = window;
    const href = document.querySelector('footer a[href^="#"]').getAttribute("href");
    const menu = document.querySelector(href);
    assert.equal(menu.getAttribute("aria-label"), "전체 순위 지표");
    assert.equal(menu.tabIndex, -1);
    assert.equal(menu.querySelector('a[aria-current="page"]').getAttribute("href"), "/bps?scope=kosdaq");
  } finally {
    window.close();
  }
});
