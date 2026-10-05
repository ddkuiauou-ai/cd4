const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { AsyncLocalStorage } = require("node:async_hooks");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

// Next's real cache implementation expects the runtime to provide this global.
globalThis.AsyncLocalStorage = AsyncLocalStorage;
const { unstable_cache } = require("next/cache");
const { workAsyncStorage } = require("next/dist/server/app-render/work-async-storage.external");
const root = path.resolve(__dirname, "..");

// Load the actual TS queries, replacing only the DB boundary. No business DB is used.
function loadQueries(db, environment = "production") {
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
  process.env.NODE_ENV = environment;
  try {
    return {
      ...load(path.join(root, "lib/data/company.ts")),
      ...load(path.join(root, "lib/data/security.ts")),
      ...load(path.join(root, "lib/getSearch.ts")),
      ...load(path.join(root, "lib/data/cache-policy.ts")),
    };
  } finally {
    if (prior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prior;
  }
}

function fixture() {
  const company = {
    companyId: "company-1", name: "Example", korName: "예시기업", logo: null,
    marketcap: 100, marketcapRank: 1, marketcapDate: new Date("2025-09-22T00:00:00Z"),
    marketcapPriorRank: 1, securities: [{ securityId: "security-1", ticker: "000001" }],
  };
  const state = { companies: [company], prices: [], names: [{ securityId: "security-1" }], faults: new Set(), calls: {} };
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
      company: { findMany: async (options) => read(options.columns.marketcap ? "company" : "count", state.companies) },
      price: { findMany: async () => read("price", state.prices) },
      security: { findMany: async () => read("search", state.names) },
    },
  };
  return { state, db };
}

// In-memory IncrementalCache storage; caching/revalidation itself is real Next 15.
function cacheStorage() {
  const entries = new Map();
  return {
    entries, now: 0,
    async generateCacheKey(input) { return createHash("sha256").update(input).digest("hex"); },
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
