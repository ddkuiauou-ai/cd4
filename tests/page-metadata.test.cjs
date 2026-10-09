const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const { PgDialect } = require("drizzle-orm/pg-core");
const { createBusinessPageLoader } = require("./helpers/business-page-loader.cjs");

const origin = "https://www.chundan.xyz";
const security = { securityId: "stable-security", companyId: "stable-company", ticker: "005930", korName: "삼성전자", name: "Samsung", exchange: "KOSPI", type: "보통주" };
const company = { companyId: "stable-company", name: "Samsung", korName: "삼성전자 회사" };

function metadataFixture({ ambiguous = false, absent = false } = {}) {
  const calls = [];
  const dialect = new PgDialect();
  function args(query) { return query.where ? dialect.sqlToQuery(query.where).params : []; }
  const db = { query: {
    security: {
      findFirst: async query => {
        calls.push({ table: "security", method: "id", args: args(query), columns: query.columns });
        return !absent && args(query)[0] === security.securityId ? security : undefined;
      },
      findMany: async query => {
        calls.push({ table: "security", method: "alias", args: args(query), columns: query.columns, limit: query.limit });
        if (absent) return [];
        return ambiguous ? [security, { ...security, securityId: "reused-security" }] : [security];
      },
    },
    company: { findFirst: async query => {
      calls.push({ table: "company", method: "id", args: args(query), columns: query.columns });
      return !absent && args(query)[0] === company.companyId ? company : undefined;
    } },
  } };
  const loader = createBusinessPageLoader({ "@/db": { db } });
  return { calls, load: loader.load };
}

function pageProps(code, search = {}) {
  return { params: Promise.resolve({ secCode: code }), searchParams: Promise.resolve(search) };
}

function assertGraph(metadata, canonical) {
  assert.equal(metadata.alternates.canonical, canonical);
  assert.equal(metadata.openGraph.url, canonical);
  assert.equal(metadata.openGraph.siteName, "천하제일 단타대회");
  assert.equal(metadata.openGraph.locale, "ko_KR");
  assert.equal(metadata.openGraph.images[0].url, `${origin}/opengraph-image.png`);
  assert.equal(metadata.twitter.images[0], `${origin}/opengraph-image.png`);
  assert.doesNotMatch(JSON.stringify(metadata), /실시간/);
}

// Root layout's unchanged declaration is extracted because local font/provider
// initialization is unrelated to metadata and requires a Next build context.
function rootMetadata() {
  const filename = path.resolve(__dirname, "../app/layout.tsx");
  const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find(statement => ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(value => value.name.getText(source) === "metadata"));
  const mod = new Module(filename);
  mod.require = name => {
    assert.equal(name, "site-config");
    return { siteConfig: createBusinessPageLoader().load("config/site.ts").siteConfig };
  };
  mod._compile(ts.transpileModule(`const { siteConfig } = require("site-config");\n${declaration.getText(source)}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports.metadata;
}

test("all actual security routes identify the security and retain their unique legacy canonical and branded OG", async () => {
  for (const metric of ["", "marketcap", "per", "pbr", "eps", "bps", "div", "dps"]) {
    const { load, calls } = metadataFixture();
    const page = load(`app/security/[secCode]/${metric ? `${metric}/` : ""}page.tsx`);
    const metadata = await page.generateMetadata(pageProps("stable-security", { start: "2020-01-01", end: "2026-10-02" }));
    assertGraph(metadata, `${origin}/security/KOSPI.005930${metric ? `/${metric}` : ""}/`);
    assert.match(metadata.title, /삼성전자/);
    assert.equal(calls.length, 2, "metadata reads identity and alias uniqueness, never financial results");
    assert.deepEqual(Object.keys(calls[0].columns).sort(), ["companyId", "exchange", "korName", "name", "securityId", "ticker"]);
    assert.doesNotMatch(metadata.description, /2020-01-01|2026-10-02/, "selected source windows cannot pretend to be an official metadata date");
  }
});

test("a unique market/ticker alias retains its original canonical while reused-code ambiguity stays unindexed", async () => {
  const unique = metadataFixture();
  const page = unique.load("app/security/[secCode]/pbr/page.tsx");
  const metadata = await page.generateMetadata(pageProps("KOSPI.005930"));
  assertGraph(metadata, `${origin}/security/KOSPI.005930/pbr/`);
  assert.equal(unique.calls[1].limit, 2);
  assert.deepEqual(unique.calls[1].args, ["KOSPI", "005930"]);
  const ambiguous = metadataFixture({ ambiguous: true });
  const unavailable = await ambiguous.load("app/security/[secCode]/pbr/page.tsx").generateMetadata(pageProps("KOSPI.005930"));
  assert.equal(unavailable.title, "종목을 찾을 수 없습니다");
  assert.equal(unavailable.robots.index, false);
  assert.equal(unavailable.alternates.canonical, null);
});

test("actual company metadata names the company and resolves a security alias to original company canonical", async () => {
  for (const suffix of ["", "marketcap/"]) {
    const { load, calls } = metadataFixture();
    const page = load(`app/company/[secCode]/${suffix}page.tsx`);
    const metadata = await page.generateMetadata(pageProps("KOSPI.005930"));
    assertGraph(metadata, `${origin}/company/KOSPI.005930${suffix ? "/marketcap" : ""}/`);
    assert.match(metadata.title, /삼성전자 회사/);
    assert.ok(calls.every(call => !Object.keys(call.columns).some(key => /marketcap|revision|publication/i.test(key))));
    assert.ok(calls.some(call => call.table === "company" && call.args[0] === "stable-company"));
  }
});

test("dashboard and company aliases preserve site branding and explicit canonical routes", async () => {
  const { load } = metadataFixture();
  assertGraph(load("app/dashboard/page.tsx").metadata, `${origin}/dashboard/`);
  assert.equal(rootMetadata().alternates.canonical, origin);
  for (const route of ["app/(market)/page.tsx", "app/(market)/marketcaps/page.tsx"]) {
    const metadata = await load(route).generateMetadata({ searchParams: Promise.resolve({ revision: "9" }) });
    assertGraph(metadata, `${origin}/`);
  }
});

test("all ranking metadata is route/scoped and page-specific while revision is omitted from canonical URLs", async () => {
  for (const metric of ["marketcap", "per", "pbr", "eps", "bps", "div", "dps"]) {
    const { load, calls } = metadataFixture();
    const first = await load(`app/(market)/${metric}/page.tsx`).generateMetadata({ searchParams: Promise.resolve({ scope: "kosdaq", revision: "9" }) });
    assertGraph(first, `${origin}/${metric}/?scope=kosdaq`);
    const second = await load(`app/(market)/${metric}/[page]/page.tsx`).generateMetadata({ params: Promise.resolve({ page: "2" }), searchParams: Promise.resolve({ scope: "kosdaq", revision: "10" }) });
    assertGraph(second, `${origin}/${metric}/2/?scope=kosdaq`);
    assert.equal(calls.length, 0, "metadata never loads rankings, source history or official publication data");
  }
  const { load } = metadataFixture();
  const companyPageTwo = await load("app/(market)/marketcaps/[page]/page.tsx").generateMetadata({ params: Promise.resolve({ page: "2" }), searchParams: Promise.resolve({ revision: "9" }) });
  assertGraph(companyPageTwo, `${origin}/marketcaps/2/`);
});

test("missing identities and invalid codes expose no canonical metadata and do not fabricate financial values", async () => {
  const { load, calls } = metadataFixture({ absent: true });
  const missing = await load("app/security/[secCode]/marketcap/page.tsx").generateMetadata(pageProps("missing-security"));
  assert.equal(missing.robots.index, false);
  assert.equal(missing.alternates.canonical, null);
  assert.equal(missing.openGraph, null);
  const invalid = await load("app/company/[secCode]/page.tsx").generateMetadata(pageProps("%invalid"));
  assert.equal(invalid.title, "회사를 찾을 수 없습니다");
  assert.equal(invalid.robots.index, false);
  assert.equal(invalid.alternates.canonical, null);
  assert.equal(calls.length, 2, "invalid encoded identity does not execute a query");
});
