const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

// Compile the page's actual metadata declaration while leaving its render tree
// and unrelated imports out of this test. Only the existing DB lookup is stubbed.
function loadMetadata(relative, security, overrides = {}) {
  const filename = path.join(__dirname, "..", relative);
  const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find((statement) =>
    (ts.isFunctionDeclaration(statement) && statement.name?.text === "generateMetadata") ||
    (ts.isVariableStatement(statement) && statement.declarationList.declarations.some((value) => value.name.getText(source) === "metadata"))
  );
  assert.ok(declaration, `metadata declaration in ${relative}`);
  const calls = [];
  const siteConfig = {
    name: "천하제일 단타대회", description: "시장 정보",
    url: "https://www.chundan.xyz", ogImage: "https://www.chundan.xyz/opengraph-image.png",
  };
  const dependencies = { siteConfig, getSecurityByCode: async (code) => { calls.push(code); return security; }, ...overrides };
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.require = (name) => {
    assert.equal(name, "metadata-fixture");
    return dependencies;
  };
  const extracted = `const { siteConfig, getSecurityByCode, getSecurityRanksPage, getCompanyMarketcapsPage, getLatestDateFromMarketData } = require("metadata-fixture");\n${declaration.getText(source)}`;
  const { outputText } = ts.transpileModule(extracted, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  loaded._compile(outputText, filename);
  return { ...loaded.exports, calls };
}

const fixture = {
  ticker: "005930", korName: "삼성전자", name: "Samsung", type: "보통주",
  company: { marketcap: 2000 }, prices: [{ close: 1000, rate: 1 }],
};
const parentGraph = {
  title: "기존 사이트 제목", description: "기존 사이트 설명",
  url: "https://www.chundan.xyz/", type: "website", locale: "ko_KR",
  images: [{ url: "https://www.chundan.xyz/opengraph-image.png", width: 1200, height: 630 }],
};

test("every security metadata function uses its own canonical and OG URL with existing OG fields retained", async () => {
  for (const metric of ["", "marketcap", "per", "pbr", "eps", "bps", "div", "dps"]) {
    const relative = `app/security/[secCode]/${metric ? `${metric}/` : ""}page.tsx`;
    for (const secCode of ["KOSPI.005930", "KOSDAQ.0001A0"]) {
      const loaded = loadMetadata(relative, fixture);
      const metadata = await loaded.generateMetadata({ params: Promise.resolve({ secCode }) }, Promise.resolve({ openGraph: parentGraph }));
      const url = `https://www.chundan.xyz/security/${secCode}/${metric ? `${metric}/` : ""}`;
      assert.equal(metadata.alternates.canonical, url, relative);
      assert.equal(metadata.openGraph.url, url, relative);
      assert.deepEqual(metadata.openGraph.images, parentGraph.images, relative);
      assert.equal(metadata.openGraph.description, parentGraph.description, relative);
      assert.deepEqual(loaded.calls, [secCode], relative);
      assert.equal(parentGraph.url, "https://www.chundan.xyz/");
    }
  }
});

test("company base and marketcap metadata have separate URLs and identify the actual company", async () => {
  const secCode = "KOSPI.005935";
  const base = loadMetadata("app/company/[secCode]/page.tsx", fixture);
  const baseMetadata = await base.generateMetadata({ params: Promise.resolve({ secCode }) });
  assert.equal(baseMetadata.alternates.canonical, `https://www.chundan.xyz/company/${secCode}/`);
  assert.equal(baseMetadata.openGraph.url, baseMetadata.alternates.canonical);
  assert.deepEqual(base.calls, [secCode]);

  const marketcap = loadMetadata("app/company/[secCode]/marketcap/page.tsx", fixture);
  const metadata = await marketcap.generateMetadata({ params: Promise.resolve({ secCode }) }, Promise.resolve({ openGraph: parentGraph }));
  assert.equal(metadata.alternates.canonical, `https://www.chundan.xyz/company/${secCode}/marketcap/`);
  assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
  assert.deepEqual(metadata.openGraph.images, parentGraph.images);
  assert.deepEqual(marketcap.calls, [secCode]);
  assert.equal(metadata.title, "삼성전자 기업 전체 시가총액");
});

test("dashboard metadata overrides its URL while root canonical stays at home", () => {
  const dashboard = loadMetadata("app/dashboard/page.tsx", fixture).metadata;
  const root = loadMetadata("app/layout.tsx", fixture).metadata;
  assert.equal(dashboard.alternates.canonical, "https://www.chundan.xyz/dashboard/");
  assert.equal(dashboard.openGraph.url, dashboard.alternates.canonical);
  assert.equal(root.alternates.canonical, "https://www.chundan.xyz");
});

test("security ranking has its own URL while the identical company ranking alias keeps the home canonical", async () => {
  const securityCalls = [];
  const companyCalls = [];
  const items = [fixture, { ...fixture, korName: "SK하이닉스", ticker: "000660" }];
  const dependencies = {
    getSecurityRanksPage: async (...args) => {
      securityCalls.push(args);
      return { items, latestDate: "2026-10-02" };
    },
    getCompanyMarketcapsPage: async (...args) => {
      companyCalls.push(args);
      return { items };
    },
    getLatestDateFromMarketData: () => "2026-10-02",
  };

  const security = await loadMetadata("app/(market)/marketcap/page.tsx", fixture, dependencies).generateMetadata();
  assert.equal(security.alternates.canonical, "https://www.chundan.xyz/marketcap/");
  assert.equal(security.openGraph.url, security.alternates.canonical);
  assert.match(security.description, /종목별 시가총액 순위/);
  assert.equal(security.openGraph.images[0].url, "https://www.chundan.xyz/opengraph-image.png");
  assert.deepEqual(securityCalls, [["marketcap", 1, "asc"]]);

  for (const relative of ["app/(market)/page.tsx", "app/(market)/marketcaps/page.tsx"]) {
    const company = await loadMetadata(relative, fixture, dependencies).generateMetadata();
    assert.equal(company.alternates.canonical, "https://www.chundan.xyz", relative);
    assert.equal(company.openGraph.url, company.alternates.canonical, relative);
  }
  assert.deepEqual(companyCalls, [[1], [1]]);

  const renderBody = (relative) => {
    const filename = path.join(__dirname, "..", relative);
    const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    return source.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "HomePage").body.getText(source);
  };
  assert.equal(renderBody("app/(market)/marketcaps/page.tsx"), renderBody("app/(market)/page.tsx"));
});

test("missing security metadata preserves the existing missing-record response", async () => {
  const loaded = loadMetadata("app/security/[secCode]/marketcap/page.tsx", null);
  const metadata = await loaded.generateMetadata({ params: Promise.resolve({ secCode: "KOSPI.000000" }) }, Promise.resolve({ openGraph: parentGraph }));
  assert.equal(metadata.title, "종목을 찾을 수 없습니다");
  assert.equal(metadata.alternates, undefined);
  assert.deepEqual(loaded.calls, ["KOSPI.000000"]);
});

test("dated ranking metadata does not claim real-time data", async () => {
  const dependencies = {
    getSecurityRanksPage: async () => ({ items: [{ ...fixture, value: 10 }], latestDate: "2025-09-22" }),
    getCompanyMarketcapsPage: async () => ({ items: [fixture] }),
    getLatestDateFromMarketData: () => "2025-09-22",
  };
  for (const route of ["", "marketcaps", "marketcap", "per", "pbr", "eps", "bps", "div", "dps"]) {
    const relative = `app/(market)/${route ? `${route}/` : ""}page.tsx`;
    const metadata = await loadMetadata(relative, fixture, dependencies).generateMetadata();
    assert.doesNotMatch(JSON.stringify(metadata), /실시간/, relative);
    assert.match(metadata.description, /2025-09-22/, relative);
  }
});
