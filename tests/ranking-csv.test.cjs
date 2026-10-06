const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const { PgDialect } = require("drizzle-orm/pg-core");
const { sql } = require("drizzle-orm");

const root = path.resolve(__dirname, "..");
const dialect = new PgDialect();

// Only the database and cache boundary are substituted; no real DB is opened.
function modules(replacements = {}) {
  const loaded = new Map();
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = (name) => {
      if (Object.hasOwn(replacements, name)) return replacements[name];
      const local = name.startsWith("@/") ? path.join(root, name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (!local) return require(name);
      if (local === path.join(root, "lib/data/cache-policy")) {
        return { cachedData: (query) => query };
      }
      const resolved = [local, `${local}.ts`, `${local}.tsx`].find(existsSync);
      assert.ok(resolved, `Module not found: ${name}`);
      return load(resolved);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  return (relative) => load(path.join(root, relative));
}

const pure = modules();
const csv = pure("lib/csv/ranking.ts");
const downloads = pure("lib/ranking-download.ts");

function row(index = 1, value = 100) {
  return {
    currentRank: index, priorRank: index + 2,
    companyId: `company-${index}`, securityId: `security-${index}`,
    name: `예시종목 ${index}`, ticker: String(index).padStart(6, "0"),
    exchange: "KOSPI", type: "보통주", value, metricDate: "2026-09-30",
  };
}

function snapshot(overrides = {}) {
  const rows = overrides.rows ?? [row()];
  return {
    scope: "security", metric: "marketcap", rankDate: "2026-10-02",
    referenceDate: "2026-10-02", generatedAt: "2026-10-05T01:02:03.000Z",
    rows, totalCount: rows.length, ...overrides,
  };
}

test("CSV preserves UTF-8 BOM, real newlines, quotes, leading-zero ticker, zero and negative values", () => {
  const source = snapshot({ rows: [
    { ...row(1, 0), name: '회사, "인용"\n두 번째 줄', priorRank: null },
    row(2, -12.345), { ...row(3, null), priorRank: 3 },
  ] });
  const text = csv.serializeRankingCsv(source);
  assert.deepEqual([...Buffer.from(text).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.ok(text.includes('"회사, ""인용""\n두 번째 줄"'));
  assert.ok(text.includes("'000001"));
  assert.ok(text.includes(",0,2026-09-30"));
  assert.ok(text.includes(",-12.345,2026-09-30"));
  assert.ok(text.includes(",,2026-09-30"));
  assert.equal(csv.readRankingCsvMetadata(text).totalCount, 3);
  assert.equal(csv.escapeCsvValue(0), "0");
  assert.equal(csv.escapeCsvValue(false), "false");
  assert.equal(csv.escapeCsvValue(null), "");
});

test("detail serialization escapes headers and keeps the supplied row/column order", () => {
  assert.equal(csv.serializeCsvRows([{ '이름,설명': '가"나', value: 0 }, { value: -1, '이름,설명': null }]),
    '"이름,설명",value\n"가""나",0\n,-1');
  assert.equal(csv.serializeCsvRows([]), "");
});

test("company CSV compares visible rows across mixed dates and later pages without assuming one reference date", () => {
  const first = { ...row(1, 0), metricDate: "2025-09-22" };
  const later = { ...row(21, 200), metricDate: "2026-10-02" };
  const file = csv.serializeRankingCsv(snapshot({ scope: "company", rankDate: null,
    referenceDate: first.metricDate, rows: [first, later] }));
  const expected = [{ id: later.companyId, rank: later.currentRank, priorRank: later.priorRank,
    value: later.value, metricDate: later.metricDate }];
  assert.equal(csv.hasCompanyRankingCsvChanges(file, expected), false);
  for (const change of [{ value: 201 }, { rank: 22 }, { priorRank: 24 },
    { metricDate: "2026-10-05" }, { id: "company-removed" }]) {
    assert.equal(csv.hasCompanyRankingCsvChanges(file, [{ ...expected[0], ...change }]), true);
  }
  assert.equal(csv.hasCompanyRankingCsvChanges(file, [{ id: first.companyId, rank: 1,
    priorRank: 3, value: 0, metricDate: first.metricDate }]), false);
});

test("all metric units and eight fixed download URLs are scope-specific", () => {
  const units = { marketcap: "원", per: "배", pbr: "배", eps: "원", bps: "원", div: "%", dps: "원" };
  assert.equal(downloads.getRankingDownloadUrl("company", "marketcap"), "/ranking-data/companies-marketcap.csv");
  for (const metric of downloads.RANKING_DOWNLOAD_METRICS) {
    assert.equal(downloads.getRankingDownloadUrl("security", metric), `/ranking-data/securities-${metric}.csv`);
    assert.ok(csv.serializeRankingCsv(snapshot({ metric })).includes(`security,${metric},${units[metric]},`));
  }
  assert.throws(() => downloads.getRankingDownloadUrl("company", "per"));
  assert.throws(() => downloads.getRankingDownloadUrl("security", "unknown"));
  assert.throws(() => downloads.getRankingDownloadUrl("other", "marketcap"));
});

test("company files retain mixed row dates without inventing a company rank snapshot", () => {
  const text = csv.serializeRankingCsv(snapshot({
    scope: "company", rankDate: null, referenceDate: "2026-09-30",
    rows: [row(1), { ...row(2), metricDate: "2026-09-29" }],
  }));
  const metadata = csv.readRankingCsvMetadata(text);
  assert.equal(metadata.rankDate, null);
  assert.equal(metadata.referenceDate, "2026-09-30");
  assert.ok(text.includes("2026-09-29"));
  assert.equal(metadata.filename, "marketcap-companies-2026-09-30.csv");
});

test("empty, HTML, truncated and inconsistent ranking files are rejected", () => {
  assert.throws(() => csv.serializeRankingCsv(snapshot({ rows: [], totalCount: 0 })));
  assert.throws(() => csv.readRankingCsvMetadata("<html>not found</html>"));
  const text = csv.serializeRankingCsv(snapshot({ rows: [row(1), row(2)] }));
  assert.throws(() => csv.readRankingCsvMetadata(text.split("\n").slice(0, 2).join("\n")));
  assert.throws(() => csv.readRankingCsvMetadata(text.replace(/security,marketcap/, "company,per")));
});

function databaseFixture() {
  const state = {
    rankDate: "2026-10-02", latestReads: 0, queries: [], companies: [], failRows: false,
    securities: Array.from({ length: 205 }, (_, index) => ({
      ...row(index + 1), korName: `예시종목 ${index + 1}`,
      metric: "marketcap", rankDate: "2026-10-02", delistingDate: null,
    })),
  };
  const db = {
    select(columns) {
      const query = {
        columns, predicate: null, order: null,
        from(table) { this.table = table; return this; },
        where(predicate) { this.predicate = predicate; return this; },
        innerJoin() { return this; }, leftJoin() { return this; },
        orderBy(order) { this.order = order; return this; },
        limit() { throw new Error("Export must not paginate"); },
        offset() { throw new Error("Export must not paginate"); },
        getSQL() { return sql`select 1 from ${this.table} where ${this.predicate}`; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            if (columns.rankDate && Object.keys(columns).length === 1) {
              state.latestReads += 1;
              const rankDate = state.rankDate;
              // A concurrent update must not alter the date used by the next query.
              state.rankDate = "2026-10-05";
              return [{ rankDate }];
            }
            if (state.failRows) throw new Error("fixture-query-failed");
            const predicate = dialect.sqlToQuery(this.predicate);
            state.queries.push({ predicate, order: dialect.sqlToQuery(this.order).sql, columns });
            const [metric, rankDate] = predicate.params;
            return state.securities.filter((item) => item.metric === metric && item.rankDate === rankDate
              && (!predicate.sql.includes('"delisting_date" is null') || item.delistingDate === null)
              && (!predicate.sql.includes('"current_rank" is not null') || item.currentRank !== null))
              .map((item) => Object.fromEntries(Object.keys(columns).map((key) => [key, item[key]])));
          }).then(resolve, reject);
        },
      };
      return query;
    },
    query: {
      company: {
        async findMany(options) {
          assert.equal(options.limit, undefined);
          assert.equal(options.offset, undefined);
          assert.deepEqual(Object.keys(options.with), ["securities"]);
          const predicate = dialect.sqlToQuery(options.where);
          const common = dialect.sqlToQuery(options.with.securities.where);
          state.queries.push({ predicate, common });
          return state.companies.filter((company) => company.marketcapRank !== null
            && company.securities.some((security) => security.type === "보통주" && security.delistingDate === null))
            .map((company) => ({ ...company,
              securities: company.securities.filter((security) => security.type === "보통주" && security.delistingDate === null).slice(0, 1),
            }));
        },
      },
    },
  };
  return { db, state };
}

test("whole security export pins the date once, preserves all 205 ranks and excludes delisted/unranked rows", async () => {
  const { db, state } = databaseFixture();
  state.securities.push(
    { ...row(206), metric: "per", rankDate: "2026-10-02", delistingDate: null },
    { ...row(207), metric: "marketcap", rankDate: "2026-10-05", delistingDate: null },
    { ...row(208), metric: "marketcap", rankDate: "2026-10-02", delistingDate: "2026-01-01" },
    { ...row(209), currentRank: null, metric: "marketcap", rankDate: "2026-10-02", delistingDate: null },
  );
  const exports = modules({ "@/db": { db } })("lib/data/ranking-export.ts");
  const result = await exports.getWholeRankingExport("security", "marketcap");
  assert.equal(state.latestReads, 1);
  assert.equal(result.rankDate, "2026-10-02");
  assert.equal(result.totalCount, 205);
  assert.equal(result.rows.at(-1).currentRank, 205);
  assert.deepEqual(state.queries[0].predicate.params, ["marketcap", "2026-10-02"]);
  assert.match(state.queries[0].order, /"current_rank" asc/);
  assert.equal(Object.hasOwn(state.queries[0].columns, "prices"), false);
});

test("company export uses the listed common-stock predicate and retains zero/null/mixed-date values", async () => {
  const { db, state } = databaseFixture();
  const common = { securityId: "security-1", ticker: "000001", exchange: "KOSPI", type: "보통주", delistingDate: null };
  const company = { companyId: "company-1", name: "Example", korName: "예시기업", marketcap: 0, marketcapRank: 1, marketcapPriorRank: 1, marketcapDate: "2026-09-30", securities: [common] };
  state.companies = [company, { ...company, companyId: "company-2", marketcapRank: 2, marketcap: null, marketcapDate: "2026-09-29" },
    { ...company, companyId: "preferred-only", securities: [{ ...common, type: "우선주" }] },
    { ...company, companyId: "delisted", securities: [{ ...common, delistingDate: "2026-01-01" }] }];
  const exports = modules({ "@/db": { db } })("lib/data/ranking-export.ts");
  const result = await exports.getWholeRankingExport("company", "marketcap");
  assert.equal(result.totalCount, 2);
  assert.equal(result.rankDate, null);
  assert.equal(result.rows[0].value, 0);
  assert.equal(result.rows[1].value, null);
  assert.equal(result.rows[1].metricDate, "2026-09-29");
  assert.match(state.queries[0].predicate.sql, /"marketcap_rank" is not null/);
  assert.match(state.queries[0].predicate.sql, /exists/);
  assert.match(state.queries[0].common.sql, /"delisting_date" is null/);
  assert.ok(state.queries[0].common.params.includes("보통주"));
});

test("security metric order shares the existing value-descending vs rank-ascending contract", () => {
  const { db } = databaseFixture();
  const security = modules({ "@/db": { db } })("lib/data/security.ts");
  for (const metric of downloads.RANKING_DOWNLOAD_METRICS) {
    const order = dialect.sqlToQuery(security.getSecurityRankingOrder(metric)).sql;
    assert.match(order, ["div", "dps", "bps", "eps"].includes(metric) ? /"value" desc/ : /"current_rank" asc/);
  }
});

test("empty exports return an error status and DB failures propagate instead of a successful CSV", async () => {
  const { db, state } = databaseFixture();
  const exports = modules({ "@/db": { db } })("lib/data/ranking-export.ts");
  state.rankDate = null;
  const empty = await exports.createRankingCsvResponse("security", "marketcap");
  assert.equal(empty.status, 404);
  assert.ok(!empty.headers.get("content-type").includes("text/csv"));
  state.rankDate = "2026-10-02";
  state.failRows = true;
  await assert.rejects(exports.createRankingCsvResponse("security", "marketcap"), /fixture-query-failed/);
});

test("all eight fixed GET handlers produce the matching CSV response without request values", async () => {
  const calls = [];
  const load = modules({ "@/lib/data/ranking-export": {
    createRankingCsvResponse: async (scope, metric) => {
      calls.push([scope, metric]);
      return new Response(csv.serializeRankingCsv(snapshot({ scope, metric })), { headers: { "Content-Type": "text/csv; charset=utf-8" } });
    },
  } });
  const pairs = [["company", "marketcap"], ...downloads.RANKING_DOWNLOAD_METRICS.map((metric) => ["security", metric])];
  for (const [scope, metric] of pairs) {
    const url = downloads.getRankingDownloadUrl(scope, metric);
    const route = load(`app${url}/route.ts`);
    assert.equal(route.dynamic, "force-static");
    assert.equal(route.revalidate, 300);
    assert.equal(route.GET.length, 0);
    const response = await route.GET();
    assert.equal(response.status, 200);
    const metadata = csv.readRankingCsvMetadata(await response.text());
    assert.equal(metadata.scope, scope);
    assert.equal(metadata.metric, metric);
  }
  assert.deepEqual(calls, pairs);
});
