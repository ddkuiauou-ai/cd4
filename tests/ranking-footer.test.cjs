const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { JSDOM } = require("jsdom");
const { createBusinessPageLoader } = require("./helpers/business-page-loader.cjs");

function createLoader() {
  return createBusinessPageLoader({
    "next/image": { default: props => React.createElement("img", props) },
    "@/components/recent-panel-trigger": { RecentPanelTrigger: ({ children, className }) => React.createElement("button", { type: "button", className }, children) },
    "@/components/mobile-header-context": { MobileHeaderProvider: ({ children }) => children },
    "@/components/site-header": { SiteHeader: () => React.createElement("header", { "data-site-header": true }) },
    "@/components/bottom-navigation": { BottomNavigation: () => React.createElement("nav", { "aria-label": "모바일 하단 탐색" }) },
  });
}

test("ranking footer exposes all ranking destinations in server HTML with distinct aggregate and security entries", async () => {
  const loader = createLoader();
  const { RankingDirectoryFooter } = loader.load("components/ranking-directory-footer.tsx");
  const { html } = await loader.renderElement(React.createElement(RankingDirectoryFooter));
  const document = new JSDOM(html).window.document;
  const footer = document.querySelector('footer[aria-label="전체 콘텐츠 목차"]');
  assert.ok(footer);
  const destinationNames = new Map([...footer.querySelectorAll("a")].map(link => [link.getAttribute("href"), link.textContent]));
  for (const [href, label] of [["/marketcaps", "기업 합산"], ["/marketcap", "종목별"], ["/per", "PER"], ["/pbr", "PBR"], ["/eps", "EPS"], ["/bps", "BPS"], ["/div", "배당수익률"], ["/dps", "주당배당금"]]) {
    assert.ok(destinationNames.get(href)?.startsWith(label), `${href} should identify ${label}`);
  }
  assert.equal(destinationNames.get("/"), "전체 순위 살펴보기");
  assert.equal(destinationNames.get("/dashboard"), "메인");
  assert.equal(destinationNames.get("#ranking-title"), "맨 위로");
  assert.equal(footer.querySelector('img[src="/icon.svg"]')?.getAttribute("alt"), "");
  assert.equal(footer.querySelector("button")?.textContent, "최근 본 종목");
  assert.equal(footer.querySelectorAll("nav").length, 4);
});

test("AppShell keeps its original footer by default and replaces it without duplicating the mobile navigation", async () => {
  const loader = createLoader();
  const { AppShell } = loader.load("components/app-shell.tsx");
  const original = await loader.renderElement(React.createElement(AppShell, null, "본문"));
  assert.equal(new JSDOM(original.html).window.document.querySelectorAll(".site-footer").length, 1);
  const replacement = await loader.renderElement(React.createElement(AppShell, {
    footer: React.createElement("footer", { "data-custom-footer": true }, "새 푸터"),
  }, "본문"));
  const document = new JSDOM(replacement.html).window.document;
  assert.equal(document.querySelectorAll(".site-footer").length, 0);
  assert.equal(document.querySelectorAll("footer[data-custom-footer]").length, 1);
  assert.equal(document.querySelectorAll('nav[aria-label="모바일 하단 탐색"]').length, 1);
  assert.equal(document.querySelector("main")?.textContent, "본문");
});

test("only the market layout selects the directory footer slot", async () => {
  const loader = createLoader();
  const { default: MarketLayout } = loader.load("app/(market)/layout.tsx");
  const { html } = await loader.renderElement(React.createElement(MarketLayout, null, "랭킹 본문"));
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelectorAll('footer[aria-label="전체 콘텐츠 목차"]').length, 1);
  assert.equal(document.querySelectorAll(".site-footer").length, 0);
  assert.equal(document.querySelector("main .app-container")?.textContent, "랭킹 본문");
});
