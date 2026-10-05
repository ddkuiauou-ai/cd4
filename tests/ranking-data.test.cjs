const assert = require("node:assert/strict");
const { AsyncLocalStorage } = require("node:async_hooks");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

globalThis.AsyncLocalStorage = AsyncLocalStorage;
const { workAsyncStorage } = require("next/dist/server/app-render/work-async-storage.external");
const root = path.resolve(__dirname, "..");

// Exercise the actual query/cache/date code, substituting only the DB boundary.
function loadRanking(db, environment = "production") {
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
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = environment;
  try {
    return {
      ...load(path.join(root, "lib/data/security.ts")),
      ...load(path.join(root, "lib/utils.ts")),
    };
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

function fixture() {
  const state = {
    latestDate: "2025-09-22", faults: new Set(), calls: {},
    rows: [{ securityId: "security-1", name: "Example", korName: "예시종목", ticker: "000001",
      currentRank: 1, priorRank: 2, value: 100, updatedAt: new Date("2025-09-24T01:30:00Z") }],
    prices: [{ securityId: "security-1", date: new Date("2025-09-22T00:00:00Z"), close: 10 }],
  };
  async function read(kind) {
    state.calls[kind] = (state.calls[kind] || 0) + 1;
    if (state.faults.has(kind)) throw new Error(`fixture-${kind}-unavailable`);
    const values = {
      latest: [{ maxDate: state.latestDate }], count: [{ count: state.rows.length }],
      rows: state.rows, price: state.prices,
    };
    return structuredClone(values[kind]);
  }
  const db = {
    select(columns) {
      const kind = columns.maxDate ? "latest" : columns.count ? "count" : "rows";
      const query = { then: (resolve, reject) => read(kind).then(resolve, reject) };
      for (const method of ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit", "offset"]) {
        query[method] = () => query;
      }
      return query;
    },
    query: { price: { findMany: () => read("price") } },
  };
  return { db, state };
}

// Only the IncrementalCache storage/clock are fake; Next 15 manages revalidation.
function cacheStorage() {
  const entries = new Map();
  return {
    entries, now: 0,
    async generateCacheKey(input) { return createHash("sha256").update(input).digest("hex"); },
    async get(key, options) {
      const entry = entries.get(key);
      return entry ? { value: entry.value, isStale: this.now - entry.time >= options.revalidate * 1000 } : null;
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

for (const [query, failure] of [
  ["countSecurityRanks", "latest"], ["countSecurityRanks", "count"],
  ["getSecurityRanksPage", "latest"], ["getSecurityRanksPage", "rows"],
  ["getSecurityRanksPage", "price"],
]) {
  test(`${query}: ${failure} failure is not cached; retry recovers`, async (t) => {
    t.mock.method(console, "error", () => {});
    const { db, state } = fixture();
    const ranking = loadRanking(db);
    const cache = cacheStorage();
    const run = () => ranking[query]("marketcap", 1);
    state.faults.add(failure);
    await assert.rejects(request(cache, run), new RegExp(`fixture-${failure}-unavailable`));
    assert.equal(cache.entries.size, 0);
    state.faults.clear();
    const result = await request(cache, run);
    if (query === "countSecurityRanks") assert.equal(result, 1);
    else {
      assert.equal(result.items.length, 1);
      assert.equal(result.latestDate, "2025-09-22");
      assert.equal(result.items[0].prices[0].close, 10);
      assert.equal(ranking.getUpdatedDateFromMarketData(result.items), "2025-09-24 10:30:00");
    }
  });
}

test("normal absence of a ranking expires and resolves to the new snapshot", async () => {
  const { db, state } = fixture();
  const ranking = loadRanking(db);
  const cache = cacheStorage();
  state.latestDate = null;
  const page = () => ranking.getSecurityRanksPage("marketcap", 1);
  const count = () => ranking.countSecurityRanks("marketcap");
  assert.deepEqual(await request(cache, page), { items: [], latestDate: null });
  assert.equal(await request(cache, count), 0);
  state.latestDate = "2026-10-02";
  assert.equal((await request(cache, page)).items.length, 0);
  assert.equal(await request(cache, count), 0);
  cache.now += 301_000;
  await request(cache, page);
  await request(cache, count);
  assert.equal((await request(cache, page)).latestDate, "2026-10-02");
  assert.equal(await request(cache, count), 1);
});

test("development rereads the rank date, list and count after an empty result", async () => {
  const { db, state } = fixture();
  const ranking = loadRanking(db, "development");
  state.latestDate = null;
  assert.equal((await ranking.getSecurityRanksPage("marketcap", 1)).items.length, 0);
  assert.equal(await ranking.countSecurityRanks("marketcap"), 0);
  state.latestDate = "2026-10-02";
  assert.equal((await ranking.getSecurityRanksPage("marketcap", 1)).items.length, 1);
  assert.equal(await ranking.countSecurityRanks("marketcap"), 1);
  assert.equal(state.calls.latest, 4);
});

test("failed revalidation preserves the previous ranking, then refreshes after recovery", async (t) => {
  t.mock.method(console, "error", () => {});
  const { db, state } = fixture();
  const ranking = loadRanking(db);
  const cache = cacheStorage();
  const run = () => ranking.getSecurityRanksPage("marketcap", 1);
  await request(cache, run);
  cache.now += 301_000;
  state.faults.add("price");
  state.latestDate = "2026-10-02";
  state.rows[0].value = 200;
  const previous = await request(cache, run);
  assert.equal(previous.latestDate, "2025-09-22");
  assert.equal(previous.items[0].value, 100);
  state.faults.clear();
  await request(cache, run);
  const refreshed = await request(cache, run);
  assert.equal(refreshed.latestDate, "2026-10-02");
  assert.equal(refreshed.items[0].value, 200);
});

test("company basis and update timestamp do not come from newer representative prices", () => {
  const ranking = loadRanking({});
  const companies = [{ marketcapDate: "2025-09-22T00:00:00.000Z", updatedAt: "2025-09-24T01:30:00.000Z",
    securities: [{ prices: [{ date: "2026-10-02T00:00:00.000Z", updatedAt: "2026-10-05T00:00:00.000Z" }] }] }];
  assert.equal(ranking.getLatestDateFromMarketData(companies), "2025-09-22");
  assert.equal(ranking.getUpdatedDateFromMarketData(companies), "2025-09-24 10:30:00");
  assert.equal(ranking.getLatestDateFromMarketData([{ ...companies[0], securities: [] }]), "2025-09-22");
  assert.equal(ranking.getLatestDateFromMarketData([{ securities: companies[0].securities }]), "N/A");
});

test("missing or invalid timestamps are unavailable, without a fabricated update time", () => {
  const ranking = loadRanking({});
  assert.equal(ranking.getLatestDateFromMarketData([]), "N/A");
  assert.equal(ranking.getLatestDateFromMarketData([{ marketcapDate: "invalid" }]), "N/A");
  assert.equal(ranking.getUpdatedDateFromMarketData([{ marketcapDate: "2025-09-22" }]), "N/A");
  assert.equal(ranking.getUpdatedDateFromMarketData([{ updatedAt: "invalid" }]), "N/A");
});
