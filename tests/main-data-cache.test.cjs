const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const { AsyncLocalStorage } = require("node:async_hooks");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { PgDialect } = require("drizzle-orm/pg-core");

// Next's real cache implementation expects the runtime to provide this global.
globalThis.AsyncLocalStorage = AsyncLocalStorage;
const { unstable_cache } = require("next/cache");
const { workAsyncStorage } = require("next/dist/server/app-render/work-async-storage.external");
const root = path.resolve(__dirname, "..");

// Load the actual TS queries, replacing only the DB boundary. No business DB is used.
function loadQueries(db, environment = "production", outputMode = "standalone") {
  const loaded = new Map();
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = (name) => {
      if (name === "@/db") return { db };
      const local = name.startsWith("@/")
        ? path.join(root, name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      return local ? load(`${local}.ts`) : require(name);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  const prior = process.env.NODE_ENV;
  const priorOutput = process.env.NEXT_OUTPUT_MODE;
  process.env.NODE_ENV = environment;
  process.env.NEXT_OUTPUT_MODE = outputMode;
  try {
    return {
      ...load(path.join(root, "lib/data/company.ts")),
      ...load(path.join(root, "lib/data/security.ts")),
      ...load(path.join(root, "lib/getSearch.ts")),
      ...load(path.join(root, "lib/select.ts")),
      ...load(path.join(root, "lib/data/cache-policy.ts")),
    };
  } finally {
    if (prior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prior;
    if (priorOutput === undefined) delete process.env.NEXT_OUTPUT_MODE;
    else process.env.NEXT_OUTPUT_MODE = priorOutput;
  }
}

function fixture() {
  const company = {
    companyId: "company-1", name: "Example", korName: "예시기업", logo: null,
    marketcap: 100, marketcapRank: 1, marketcapDate: new Date("2025-09-22T00:00:00Z"),
    marketcapPriorRank: 1, securities: [{ securityId: "security-1", ticker: "000001",
      marketcap: 100, marketcapDate: new Date("2025-09-22T00:00:00Z") }],
  };
  const state = {
    companies: [company], prices: [], names: [{ securityId: "security-1", ticker: "000001" }],
    security: { securityId: "security-1", companyId: null, ticker: "000001", prices: [],
      marketcapDate: new Date("2026-10-02T00:00:00Z") },
    marketcaps: [], metrics: [], faults: new Set(), calls: {},
  };
  const read = (kind, value) => {
    state.calls[kind] = (state.calls[kind] || 0) + 1;
    if (state.faults.has(kind)) throw new Error(`fixture-${kind}-unavailable`);
    return structuredClone(value);
  };
  // EXISTS is built by Drizzle; it isn't executed by this fixture boundary.
  const subquery = { from() { return this; }, where() { return this; } };
  const db = {
    select: () => subquery,
    query: {
      company: {
        findMany: async (options) => read(options.columns.marketcap ? "company" : "count", state.companies),
        findFirst: async (options) => options.columns ? read("aggregate", state.companies[0] ?? null) : null,
      },
      price: { findMany: async () => read("price", state.prices) },
      security: {
        findMany: async () => read("search", state.names),
        findFirst: async () => read("security", state.security),
      },
      marketcap: { findMany: async () => read("marketcap", state.marketcaps) },
      bppedd: { findMany: async () => read("metrics", state.metrics) },
    },
  };
  return { state, db };
}

function exportQuery(policy, ...args) {
  // Query exports are initialized while loadQueries has the build environment;
  // a test-created generic wrapper needs the same environment at construction.
  const previous = process.env.NEXT_OUTPUT_MODE;
  process.env.NEXT_OUTPUT_MODE = "export";
  try {
    return policy.cachedData(...args);
  } finally {
    if (previous === undefined) delete process.env.NEXT_OUTPUT_MODE;
    else process.env.NEXT_OUTPUT_MODE = previous;
  }
}

async function withOutputMode(mode, callback) {
  const previous = process.env.NEXT_OUTPUT_MODE;
  process.env.NEXT_OUTPUT_MODE = mode;
  try {
    return await callback();
  } finally {
    if (previous === undefined) delete process.env.NEXT_OUTPUT_MODE;
    else process.env.NEXT_OUTPUT_MODE = previous;
  }
}

// In-memory IncrementalCache storage; caching/revalidation uses the installed Next.
function cacheStorage() {
  const entries = new Map();
  return {
    entries, now: 0,
    async generateCacheKey(input) { return createHash("sha256").update(input).digest("hex"); },
    async generateSimpleCacheKey(input) { return createHash("sha256").update(input).digest("hex"); },
    async get(key, options) {
      const stored = entries.get(key);
      if (!stored) return null;
      return { value: stored.value, isStale: this.now - stored.time >= options.revalidate * 1000 };
    },
    async set(key, value, options) { entries.set(key, { value, time: this.now, tags: options.tags }); },
  };
}

async function request(cache, callback) {
  const store = { incrementalCache: cache, nextFetchId: 1, isStaticGeneration: false, isDraftMode: false };
  const result = await workAsyncStorage.run(store, callback);
  await Promise.all(Object.values(store.pendingRevalidates || {}));
  return result;
}

for (const failure of ["company", "count", "price"]) {
  test(`a cold ${failure} failure is not cached as an empty company page; retry recovers`, async (t) => {
    t.mock.method(console, "error", () => {});
    const { state, db } = fixture();
    const queries = loadQueries(db);
    const cache = cacheStorage();
    state.faults.add(failure);
    await assert.rejects(request(cache, () => queries.getCompanyMarketcapsPage(1)), new RegExp(`fixture-${failure}-unavailable`));
    assert.equal([...cache.entries.values()].some(entry => entry.tags.includes("getCompanyMarketcapsPage")), false);
    state.faults.clear();
    const result = await request(cache, () => queries.getCompanyMarketcapsPage(1));
    assert.equal(result.items.length, 1);
    assert.equal(result.totalCount, 1);
    assert.deepEqual(result.items[0].securities[0].prices, []);
  });
}

test("search query failure propagates and the same request recovers", async (t) => {
  t.mock.method(console, "error", () => {});
  const { state, db } = fixture();
  const queries = loadQueries(db);
  const cache = cacheStorage();
  state.faults.add("search");
  await assert.rejects(request(cache, () => queries.getSecuritySearchNames()), /fixture-search-unavailable/);
  assert.equal(cache.entries.size, 0);
  state.faults.clear();
  assert.equal((await request(cache, () => queries.getSecuritySearchNames())).length, 1);
});

test("development reads reflect DB changes without retaining an empty result", async () => {
  const { state, db } = fixture();
  const queries = loadQueries(db, "development");
  const companies = state.companies;
  state.companies = [];
  assert.equal((await queries.getCompanyMarketcapsPage(1)).totalCount, 0);
  state.companies = companies;
  assert.equal((await queries.getCompanyMarketcapsPage(1)).items.length, 1);
  assert.equal(state.calls.company, 2);
});

test("a legitimate empty result is distinguishable from a failure and expires", async () => {
  const { state, db } = fixture();
  const queries = loadQueries(db);
  const cache = cacheStorage();
  const companies = state.companies;
  state.companies = [];
  const empty = await request(cache, () => queries.getCompanyMarketcapsPage(1));
  assert.deepEqual(empty.items, []);
  assert.equal(empty.totalCount, 0);
  state.companies = companies;
  assert.equal((await request(cache, () => queries.getCompanyMarketcapsPage(1))).items.length, 0);
  cache.now += 301_000;
  // App Router serves stale once while refreshing; the following request is fresh.
  await request(cache, () => queries.getCompanyMarketcapsPage(1));
  assert.equal((await request(cache, () => queries.getCompanyMarketcapsPage(1))).items.length, 1);
  assert.equal(state.calls.company, 2);
});

test("failed warm revalidation preserves good data and a later refresh recovers", async (t) => {
  t.mock.method(console, "error", () => {});
  const { state, db } = fixture();
  const queries = loadQueries(db);
  const cache = cacheStorage();
  await request(cache, () => queries.getCompanyMarketcapsPage(1));
  cache.now += 301_000;
  state.faults.add("price");
  assert.equal((await request(cache, () => queries.getCompanyMarketcapsPage(1))).items.length, 1);
  state.faults.clear();
  state.companies[0].marketcap = 200;
  await request(cache, () => queries.getCompanyMarketcapsPage(1));
  assert.equal((await request(cache, () => queries.getCompanyMarketcapsPage(1))).items[0].marketcap, 200);
});

test("the new cache namespace does not reuse an old empty entry", async () => {
  const { db } = fixture();
  const { cachedData } = loadQueries(db);
  const cache = cacheStorage();
  let rows = [];
  const read = async () => rows;
  const legacy = unstable_cache(read, ["company-page"], { tags: ["company-page"] });
  await request(cache, () => legacy());
  rows = ["company-1"];
  const current = cachedData(read, "company-page", ["company-page"]);
  assert.deepEqual(await request(cache, () => current()), ["company-1"]);
});

test("financial dates have the same ISO DTO on cold, warm and development reads", async () => {
  const { state, db } = fixture();
  state.companies[0].optional = undefined;
  const production = loadQueries(db);
  const cache = cacheStorage();
  const run = () => production.getCompanyMarketcapsPage(1);
  const cold = await request(cache, run);
  const warm = await request(cache, run);
  const local = await loadQueries(db, "development").getCompanyMarketcapsPage(1);
  assert.equal(cold.items[0].marketcapDate, "2025-09-22T00:00:00.000Z");
  assert.deepEqual(warm, cold);
  assert.deepEqual(local, cold);
  assert.equal(Object.hasOwn(cold.items[0], "optional"), false);
});

test("a top-level undefined result is retained without a serialization error", async () => {
  const { db } = fixture();
  const { cachedData } = loadQueries(db);
  let calls = 0;
  const query = cachedData(async () => { calls += 1; return undefined; }, "optional-result", []);
  const cache = cacheStorage();
  assert.equal(await request(cache, query), undefined);
  assert.equal(await request(cache, query), undefined);
  assert.equal(calls, 1);
});

for (const [name, failure, args] of [
  ["getSecurityByCode", "security", ["KOSPI.000001"]],
  ["getMarketCapHistoryBySecurityId", "marketcap", ["security-1"]],
  ["getSecurityMetricsHistory", "metrics", ["security-1"]],
  ["getCompanyAggregatedMarketcap", "aggregate", ["company-1"]],
]) {
  test(`${name}: a DB failure rejects, leaves no cache and can recover`, async (t) => {
    t.mock.method(console, "error", () => {});
    const { state, db } = fixture();
    const queries = loadQueries(db);
    const cache = cacheStorage();
    state.faults.add(failure);
    const run = () => queries[name](...args);
    await assert.rejects(request(cache, run), new RegExp(`fixture-${failure}-unavailable`));
    assert.equal(cache.entries.size, 0);
    state.faults.clear();
    await request(cache, run);
    assert.equal(state.calls[failure], 2);
  });
}

test("an absent security is a normal cached null and becomes available after revalidation", async () => {
  const { state, db } = fixture();
  const queries = loadQueries(db);
  const cache = cacheStorage();
  const security = state.security;
  state.security = null;
  const run = () => queries.getSecurityByCode("KOSPI.000001");
  assert.equal(await request(cache, run), null);
  state.security = security;
  assert.equal(await request(cache, run), null);
  cache.now += 301_000;
  await request(cache, run);
  assert.equal((await request(cache, run)).marketcapDate, "2026-10-02T00:00:00.000Z");
});

test("static export reads a fresh build snapshot and never reuses the server cache", async () => {
  const { db } = fixture();
  const server = loadQueries(db);
  const cache = cacheStorage();
  let rows = ["old-server-row"];
  let reads = 0;
  const read = async () => { reads += 1; return rows; };
  const live = server.cachedData(read, "build-snapshot", ["build-snapshot"]);
  assert.deepEqual(await request(cache, live), ["old-server-row"]);
  rows = ["new-build-row"];
  const exported = loadQueries(db, "production", "export");
  const build = exportQuery(exported, read, "build-snapshot", ["build-snapshot"]);
  const [first, duplicate] = await Promise.all([build(), build()]);
  assert.deepEqual(first, ["new-build-row"]);
  assert.deepEqual(duplicate, first);
  assert.equal(reads, 2);
  assert.equal(cache.entries.size, 1);
  rows = ["next-build-row"];
  const nextBuild = exportQuery(loadQueries(db, "production", "export"), read, "build-snapshot", []);
  assert.deepEqual(await nextBuild(), ["next-build-row"]);
});

test("failed static export reads are evicted and retried, and large query retention is bounded", async () => {
  const { db } = fixture();
  const policy = loadQueries(db, "production", "export");
  const { EXPORT_CACHE_MAX_ENTRIES } = policy;
  let fail = true;
  const reads = new Map();
  const query = exportQuery(policy, async (id) => {
    reads.set(id, (reads.get(id) ?? 0) + 1);
    if (fail) throw new Error("export-db-unavailable");
    return { id, date: new Date("2026-10-02T00:00:00Z") };
  }, "bounded-export", []);
  await assert.rejects(query(0), /export-db-unavailable/);
  fail = false;
  assert.equal((await query(0)).date, "2026-10-02T00:00:00.000Z");
  assert.equal(reads.get(0), 2);
  for (let id = 1; id <= EXPORT_CACHE_MAX_ENTRIES; id += 1) await query(id);
  await query(EXPORT_CACHE_MAX_ENTRIES);
  assert.equal(reads.get(EXPORT_CACHE_MAX_ENTRIES), 1);
  await query(0);
  assert.equal(reads.get(0), 3);
});

test("static export name-list failure propagates instead of generating missing pages", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "log", () => {});
  // Exercise all existing retries without waiting through real backoff delays.
  t.mock.method(global, "setTimeout", (callback) => { queueMicrotask(callback); return 0; });
  const { db, state } = fixture();
  const queries = loadQueries(db, "production", "export");
  state.faults.add("search");
  await assert.rejects(queries.getAllSecurityCodes(), /Database connection failed after 5 attempts/);
  assert.equal(state.calls.search, 5);
  state.faults.clear();
  const codes = await queries.getAllSecurityCodes();
  assert.equal(codes.length, 1);
  assert.equal(state.calls.search, 6);
});

test("export code queries include active history-only securities and omit delisted company URLs", async (t) => {
  t.mock.method(console, "log", () => {});
  const dialect = new PgDialect();
  const { db } = fixture();
  const options = [];
  db.query.security.findMany = async (query) => {
    options.push(query);
    return [{ exchange: "KOSDAQ", ticker: "0001A0" }];
  };
  const queries = loadQueries(db, "production", "export");
  await withOutputMode("export", async () => {
    assert.deepEqual(await queries.getTopSecurityCodesByMetric("marketcap"), ["KOSDAQ.0001A0"]);
    assert.deepEqual(await queries.getTopCompanyCodesByMetric("marketcap"), ["KOSDAQ.0001A0"]);
  });
  assert.equal(options.length, 2);
  for (const query of options) {
    const where = dialect.sqlToQuery(query.where).sql;
    assert.match(where, /"delisting_date" is null/);
    assert.doesNotMatch(where, /"marketcap" is not null/);
    assert.match(dialect.sqlToQuery(query.orderBy[0]).sql, /"marketcap" DESC NULLS LAST/);
    assert.match(dialect.sqlToQuery(query.orderBy[1]).sql, /"security_id" asc/);
  }
  assert.match(dialect.sqlToQuery(options[1].where).sql, /"company_id" is not null/);
});

test("server static params retain their ten ranked securities and ten distinct companies", async (t) => {
  t.mock.method(console, "log", () => {});
  const { db } = fixture();
  const rows = Array.from({ length: 24 }, (_, index) => ({
    exchange: "KOSPI", ticker: String(index).padStart(6, "0"), type: "보통주",
    companyId: `company-${index}`, currentRank: index + 1,
  }));
  db.select = (shape) => ({
    from() { return this; }, innerJoin() { return this; }, where() { return this; }, orderBy() { return this; },
    async limit(limit) { return shape.maxDate ? [{ maxDate: "2025-09-22" }] : rows.slice(0, limit); },
  });
  db.query.security.findMany = async () => { throw new Error("server must select ranked codes"); };
  const queries = loadQueries(db);
  await withOutputMode("standalone", async () => {
    const cache = cacheStorage();
    const securities = await request(cache, () => queries.getTopSecurityCodesByMetric("marketcap"));
    const companies = await request(cache, () => queries.getTopCompanyCodesByMetric("marketcap"));
    const metrics = await request(cache, () => queries.getTopSecuritiesWithTypeByMetric("per"));
    assert.deepEqual(securities, rows.slice(0, 10).map((row) => `${row.exchange}.${row.ticker}`));
    assert.deepEqual(companies, securities);
    assert.deepEqual(metrics.map((item) => item.code), securities);
  });
});

function historicalFixture() {
  const result = fixture();
  const { state } = result;
  Object.assign(state.security, { exchange: "KOSDAQ", ticker: "0001A0", type: "보통주",
    name: "History", korName: "이력기업", companyId: "company-1", marketcap: null, marketcapDate: null });
  Object.assign(state.companies[0], { marketcap: null, marketcapDate: null });
  Object.assign(state.companies[0].securities[0], { marketcap: null, marketcapDate: null,
    name: "History", korName: "이력기업", ticker: "0001A0", type: "보통주" });
  state.names = [];
  state.marketcaps = [
    { securityId: "security-1", date: new Date("2026-09-30T00:00:00Z"), marketcap: 1_000_000_000 },
    { securityId: "security-1", date: new Date("2026-10-02T00:00:00Z"), marketcap: 2_000_000_000 },
  ];
  return result;
}

test("a company without a current snapshot uses its latest real history value and date", async () => {
  const { db } = historicalFixture();
  const queries = loadQueries(db);
  const cache = cacheStorage();
  const run = () => queries.getCompanyAggregatedMarketcap("company-1");
  const cold = await request(cache, run);
  const warm = await request(cache, run);
  assert.equal(cold.totalMarketcap, 2_000_000_000);
  assert.equal(cold.totalMarketcapDate, "2026-10-02T00:00:00.000Z");
  assert.equal(cold.securities[0].marketcap, 2_000_000_000);
  assert.equal(cold.securities[0].marketcapDate, cold.totalMarketcapDate);
  assert.equal(cold.securities[0].percentage, 100);
  assert.deepEqual(warm, cold);
});

test("a company with neither a current snapshot nor history is normally absent", async () => {
  const { db, state } = historicalFixture();
  state.marketcaps = [];
  const queries = loadQueries(db);
  const cache = cacheStorage();
  assert.equal(await request(cache, () => queries.getCompanyAggregatedMarketcap("company-1")), null);
  assert.equal(await request(cache, () => queries.getCompanyAggregatedMarketcap("company-1")), null);
  assert.equal(state.calls.aggregate, 1);
});

// Keep the actual pages' history selection, dates and empty states. Stub visual
// child components so this test does not depend on browser chart APIs.
function loadDetailPage(kind, metric, queries) {
  const props = new Map();
  const loaded = new Map();
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = (name) => {
      if (name === "@/lib/data/company") return queries;
      if (name === "@/lib/data/security") return { ...queries,
        getBpsRank: async () => null, getPerRank: async () => null,
        getPbrRank: async () => null, getEpsRank: async () => null,
        getDivRank: async () => null, getDpsRank: async () => null };
      if (name === "@/lib/data/ranking") return { getSecurityRank: async () => null };
      if (name === "@/lib/select") return { ...queries, getSecurityMarketCapRanking: async () => null };
      if (name === "next/navigation") return {
        usePathname: () => `/security/KOSDAQ.0001A0/${metric}`,
        notFound() { throw new Error("fixture-page-not-found"); },
      };
      if (name === "next/link") return { __esModule: true,
        default: ({ href, children }) => React.createElement("a", { href }, children) };
      if ((name.startsWith("@/components/") && !["@/components/marketcap/layout",
          "@/components/security-metric-empty", "@/components/company-financial-tabs"].includes(name)) ||
          ["lucide-react", "@radix-ui/react-icons"].includes(name)) {
        return new Proxy({ __esModule: true }, { get(target, key) {
          if (key in target) return target[key];
          return (value) => {
            const id = `${name}:${key}`;
            if (!props.has(id)) props.set(id, []);
            props.get(id).push(value);
            return React.createElement(React.Fragment, null, value.children);
          };
        } });
      }
      const local = name.startsWith("@/") ? path.join(root, name.slice(2)) : null;
      if (!local) return require(name);
      const resolved = [`${local}.ts`, `${local}.tsx`].find(existsSync);
      assert.ok(resolved, `Local module not found: ${name}`);
      return load(resolved);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  const page = load(path.join(root, `app/${kind}/[secCode]/${metric}/page.tsx`));
  return { page, props };
}

async function renderDetailPage(kind, metric, queries) {
  const { page, props } = loadDetailPage(kind, metric, queries);
  const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ secCode: "KOSDAQ.0001A0" }) }));
  return { html, props };
}

const renderMarketcapPage = (kind, queries) => renderDetailPage(kind, "marketcap", queries);

test("all four common-stock metric params include export securities without current marketcap", async (t) => {
  t.mock.method(console, "log", () => {});
  const dialect = new PgDialect();
  const { db } = fixture();
  const options = [];
  db.query.security.findMany = async (query) => {
    options.push(query);
    return [{ exchange: "KOSDAQ", ticker: "0001A0", type: "보통주" },
      { exchange: "KOSPI", ticker: "000001", type: "우선주" }];
  };
  const queries = loadQueries(db, "production", "export");
  await withOutputMode("export", async () => {
    for (const metric of ["per", "pbr", "eps", "bps"]) {
      const { page } = loadDetailPage("security", metric, queries);
      assert.deepEqual(await page.generateStaticParams(), [{ secCode: "KOSDAQ.0001A0" }]);
    }
  });
  assert.equal(options.length, 1);
  const where = dialect.sqlToQuery(options[0].where).sql;
  assert.match(where, /"delisting_date" is null/);
  assert.doesNotMatch(where, /"marketcap" is not null/);
  assert.match(dialect.sqlToQuery(options[0].orderBy[0]).sql, /DESC NULLS LAST/);
  assert.match(dialect.sqlToQuery(options[0].orderBy[1]).sql, /"security_id" asc/);
});

for (const kind of ["security", "company"]) {
  test(`${kind} marketcap page displays history when current marketcap is missing`, async () => {
    const { db } = historicalFixture();
    const { html, props } = await renderMarketcapPage(kind, loadQueries(db, "production", "export"));
    const detail = props.get("@/components/sticky-company-header:StickyCompanyHeader")[0].detail;
    assert.match(detail.value, /20.*억/);
    if (kind === "company") assert.match(detail.badge, /2026.*10.*2/);
    else assert.match(html, /2026[^<]*10[^<]*2/);
    const metrics = props.get("@/components/key-metrics-section:KeyMetricsSection")[0];
    assert.equal(metrics.companyMarketcapData.totalMarketcap, 2_000_000_000);
    assert.equal(metrics.companyMarketcapData.totalMarketcapDate, "2026-10-02T00:00:00.000Z");
    for (const metric of ["per", "pbr", "eps", "bps"]) {
      assert.match(html, new RegExp(`href="/security/KOSDAQ\\.0001A0/${metric}"`));
    }
  });
}

test("a company marketcap page retains its normal empty state without current data or history", async () => {
  const { db, state } = historicalFixture();
  state.marketcaps = [];
  const { html, props } = await renderMarketcapPage("company", loadQueries(db, "production", "export"));
  assert.match(html, /종목 정보를 찾을 수 없습니다/);
  assert.equal(props.get("@/components/sticky-company-header:StickyCompanyHeader")[0].detail, undefined);
});

test("company history periods are measured from the latest data date", async () => {
  const { db, state } = historicalFixture();
  state.marketcaps[0].date = new Date("2025-09-20T00:00:00Z");
  state.marketcaps[1].date = new Date("2025-09-22T00:00:00Z");
  const { props } = await renderMarketcapPage("company", loadQueries(db, "production", "export"));
  const metrics = props.get("@/components/key-metrics-section:KeyMetricsSection")[0];
  assert.equal(metrics.periodAnalysis.periods.find((period) => period.label === "12개월 평균").value, 1_500_000_000);
  assert.equal(metrics.companyMarketcapData.totalMarketcapDate, "2025-09-22T00:00:00.000Z");
});

test("a security marketcap page retains notFound when it has no history", async () => {
  const { db, state } = historicalFixture();
  state.marketcaps = [];
  await assert.rejects(renderMarketcapPage("security", loadQueries(db, "production", "export")), /fixture-page-not-found/);
});

for (const metric of ["per", "pbr", "eps", "bps", "div", "dps"]) {
  test(`${metric}: a known security without metrics history renders a normal empty page`, async () => {
    const { db } = historicalFixture();
    const { html } = await renderDetailPage("security", metric, loadQueries(db, "production", "export"));
    assert.match(html, /이력이 아직 등록되지 않았습니다/);
    assert.match(html, /이력기업/);
    assert.match(html, /href="\/security\/KOSDAQ\.0001A0\/marketcap"/);
    assert.doesNotMatch(html, /0원|기준|\d{4}-\d{2}-\d{2}/);
  });

  test(`${metric}: an unknown security retains notFound`, async () => {
    const { db, state } = historicalFixture();
    state.security = null;
    await assert.rejects(renderDetailPage("security", metric, loadQueries(db, "production", "export")), /fixture-page-not-found/);
    assert.equal(state.calls.metrics, undefined);
  });

  test(`${metric}: a DB history failure propagates and a later request recovers`, async (t) => {
    t.mock.method(console, "error", () => {});
    const { db, state } = historicalFixture();
    const queries = loadQueries(db, "production", "export");
    state.faults.add("metrics");
    await assert.rejects(renderDetailPage("security", metric, queries), /fixture-metrics-unavailable/);
    state.faults.clear();
    const { html } = await renderDetailPage("security", metric, queries);
    assert.match(html, /이력이 아직 등록되지 않았습니다/);
    assert.equal(state.calls.metrics, 2);
  });
}
