const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const { PgDialect } = require("drizzle-orm/pg-core");

const root = path.resolve(__dirname, "..");
const dialect = new PgDialect();

// Load the real ranking predicates, schema and cache policy; substitute only DB.
function loadDetail(db) {
  const loaded = new Map();
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => {
      if (name === "@/db") return { db };
      const local = name.startsWith("@/") ? path.join(root, name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      return local ? load(`${local}.ts`) : require(name);
    };
    mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, filename);
    return mod.exports;
  }
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try { return load(path.join(root, "lib/data/security-ranking-detail.ts")); }
  finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

function fixture(rows) {
  const state = { rows, calls: [], fault: null, advanceDateAfterLatest: false };
  const db = {
    select(columns) {
      const kind = columns.maxDate ? "latest" : columns.rank ? "detail" : "neighbor";
      let predicate = { sql: "", params: [] };
      let ordering = [];
      let limit = Infinity;
      const query = {
        from: () => query, innerJoin: () => query,
        where: value => { predicate = dialect.sqlToQuery(value); return query; },
        orderBy: (...values) => { ordering = values.map(value => dialect.sqlToQuery(value).sql); return query; },
        limit: value => { limit = value; return query; },
        then(resolve, reject) {
          const call = { kind, ...predicate, ordering, limit };
          state.calls.push(call);
          return Promise.resolve().then(() => {
            if (state.fault === kind) throw new Error(`fixture-${kind}-unavailable`);
            const [metric, date] = predicate.params;
            let values = state.rows.filter(row => row.metric === metric);
            if (kind === "latest") {
              const maxDate = values.map(row => row.rankDate).sort().at(-1) ?? null;
              if (state.advanceDateAfterLatest) {
                state.advanceDateAfterLatest = false;
                state.rows.push({ ...state.rows[0], securityId: "new-snapshot", rankDate: "2026-10-06", currentRank: 1 });
              }
              return [{ maxDate }];
            }
            // The fixture evaluates the actual Drizzle SQL at the database boundary.
            assert.match(predicate.sql, /"security"\."delisting_date" is null/);
            assert.match(predicate.sql, /"security_rank"\."current_rank" is not null/);
            values = values.filter(row => row.rankDate === date && row.delistingDate == null && row.currentRank != null);
            if (kind === "detail") {
              values = values.filter(row => row.securityId === predicate.params[2]);
              return values.slice(0, limit).map(row => ({ rank: row.currentRank }));
            }
            const target = predicate.params[2];
            const previous = /"current_rank" < \$3/.test(predicate.sql);
            assert.match(predicate.sql, /"current_rank" (?:<|>) \$3/);
            values = values.filter(row => previous ? row.currentRank < target : row.currentRank > target);
            values.sort((a, b) => (previous ? b.currentRank - a.currentRank : a.currentRank - b.currentRank) || a.securityId.localeCompare(b.securityId));
            return values.slice(0, limit).map(({ metric: _, rankDate: __, delistingDate: ___, ...row }) => row);
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { state, detail: loadDetail(db) };
}

const security = (rank, overrides = {}) => ({
  securityId: `s-${rank}`, name: `Security ${rank}`, korName: `예시종목${rank}`,
  ticker: String(rank).padStart(6, "0"), exchange: "KOSPI", companyId: "c-1", type: "보통주",
  metric: "per", rankDate: "2026-10-05", currentRank: rank, delistingDate: null,
  ...overrides,
});

test("detail rank uses stored latest metric snapshot, never an index or a current-value count", async () => {
  const { detail, state } = fixture([
    security(7, { securityId: "current", rankDate: "2026-10-04" }),
    security(12, { securityId: "current" }),
    security(3, { securityId: "other-metric", metric: "pbr" }),
  ]);
  assert.equal(await detail.getPerRank("current"), 12);
  assert.equal(await detail.getPbrRank("other-metric"), 3);
  assert.equal(await detail.getSecurityMetricDetailRank("missing", "per"), null);
  assert.equal(state.calls.filter(call => call.kind === "detail").length, 3);
  assert.ok(state.calls.every(call => !/COUNT|security"\."per/.test(call.sql)));
});

test("detail rank and date come from the same fixed evidence even if a newer snapshot arrives during lookup", async () => {
  const { detail, state } = fixture([security(12, { securityId: "current" })]);
  state.advanceDateAfterLatest = true;
  assert.deepEqual(await detail.getSecurityMetricDetailRanking("current", "per"), {
    currentRank: 12, rankDate: "2026-10-05",
  });
  assert.deepEqual(await detail.getSecurityMetricDetailRanking("missing", "per"), {
    currentRank: null, rankDate: null,
  });
});

test("every metric alias uses its own latest snapshot and common listed population", async () => {
  const metrics = ["per", "pbr", "div", "eps", "dps", "bps"];
  const { detail } = fixture(metrics.flatMap((metric, index) => [
    security(index + 4, { securityId: "current", metric }),
    security(1, { securityId: "delisted", metric, delistingDate: "2026-10-01" }),
    security(null, { securityId: "unranked", metric }),
  ]));
  for (let index = 0; index < metrics.length; index++) {
    const metric = metrics[index];
    const fn = `get${metric[0].toUpperCase()}${metric.slice(1)}Rank`;
    assert.equal(await detail[fn]("current"), index + 4);
    assert.equal(await detail[fn]("delisted"), null);
    assert.equal(await detail[fn]("unranked"), null);
  }
});

test("nearest neighbors handle gaps independently and exclude current/tied, stale, delisted and unranked rows", async () => {
  const { detail, state } = fixture([
    security(1), security(4), security(7), security(12),
    security(7, { securityId: "tied-current" }),
    security(6, { securityId: "old", rankDate: "2026-10-04" }),
    security(6, { securityId: "delisted", delistingDate: "2026-10-01" }),
    security(null, { securityId: "unranked" }),
  ]);
  const rows = await detail.getSecurityMetricNeighbors(7, "per");
  assert.deepEqual(rows.map(row => row.currentRank), [4, 12]);
  assert.deepEqual(rows.map(row => row.securityId), ["s-4", "s-12"]);
  const queries = state.calls.filter(call => call.kind === "neighbor");
  assert.equal(queries.length, 2);
  assert.ok(queries.every(call => call.limit === 1));
  assert.match(queries[0].ordering[0], /current_rank" desc/);
  assert.match(queries[1].ordering[0], /current_rank" asc/);
});

test("first and last metric ranks retain the independently available side", async () => {
  const { detail } = fixture([security(1), security(4), security(12)]);
  assert.deepEqual((await detail.getSecurityMetricNeighbors(1, "per")).map(row => row.currentRank), [4]);
  assert.deepEqual((await detail.getSecurityMetricNeighbors(12, "per")).map(row => row.currentRank), [4]);
});

test("both neighbor queries keep the same date when a newer snapshot arrives after date lookup", async () => {
  const { detail, state } = fixture([security(1), security(4), security(12)]);
  state.advanceDateAfterLatest = true;
  assert.deepEqual((await detail.getSecurityMetricNeighbors(4, "per")).map(row => row.currentRank), [1, 12]);
  assert.deepEqual(state.calls.filter(call => call.kind === "neighbor").map(call => call.params[1]), ["2026-10-05", "2026-10-05"]);
});

test("detail evidence date pins both neighbor queries to its snapshot without a second latest-date lookup", async () => {
  const { detail, state } = fixture([
    security(1), security(4), security(12),
    security(2, { securityId: "new-first", rankDate: "2026-10-06" }),
    security(7, { securityId: "new-last", rankDate: "2026-10-06" }),
  ]);
  assert.deepEqual((await detail.getSecurityMetricNeighbors(4, "per", "2026-10-05")).map(row => row.currentRank), [1, 12]);
  assert.equal(state.calls.filter(call => call.kind === "latest").length, 0);
  assert.ok(state.calls.every(call => call.params[1] === "2026-10-05"));
  state.calls.length = 0;
  assert.deepEqual(await detail.getSecurityMetricNeighbors(4, "per", null), []);
  assert.equal(state.calls.length, 0);
});

test("normal absence and invalid ranks perform no impossible neighbor reads", async () => {
  const { detail, state } = fixture([]);
  assert.equal(await detail.getPerRank("current"), null);
  assert.deepEqual(await detail.getSecurityMetricNeighbors(2, "per"), []);
  for (const rank of [0, -1, NaN, Infinity, 1.5]) assert.deepEqual(await detail.getSecurityMetricNeighbors(rank, "per"), []);
  assert.ok(state.calls.every(call => call.kind === "latest"));
});

test("query failures reject instead of becoming successful empty results, then a retry recovers", async () => {
  const { detail, state } = fixture([security(1), security(4), security(12)]);
  state.fault = "neighbor";
  await assert.rejects(detail.getSecurityMetricNeighbors(4, "per"), /fixture-neighbor-unavailable/);
  state.fault = "detail";
  await assert.rejects(detail.getPerRank("s-4"), /fixture-detail-unavailable/);
  state.fault = null;
  assert.equal(await detail.getPerRank("s-4"), 4);
  assert.deepEqual((await detail.getSecurityMetricNeighbors(4, "per")).map(row => row.currentRank), [1, 12]);
});
