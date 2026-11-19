const assert = require("node:assert/strict");
const test = require("node:test");
const { drizzle } = require("drizzle-orm/pg-proxy");
const { loadModules } = require("./helpers/business-data.cjs");

const history = loadModules(null)("lib/data/history.ts");
const range = { exchange: "KOSPI", ticker: "005930", start: "2018-04-27", end: "2018-05-04" };

test("adjusted reads use the published columns or the last observation at the inclusive microsecond cutoff", async () => {
  const calls = [];
  const tx = drizzle(async (query, params) => {
    calls.push({ query, params });
    return { rows: [] };
  });
  assert.deepEqual(await history.readAdjustedPriceHistory(tx, range), []);
  assert.match(calls[0].query, /from "price" where/);
  assert.match(calls[0].query, /"price"."adv_observed_at" is not null/);
  const cutoff = "2026-11-09T10:02:03.123456+09:00";
  assert.deepEqual(await history.readAdjustedPriceHistory(tx, { ...range, observedAsOf: cutoff }), []);
  assert.match(calls[1].query, /select distinct on \("price_adjustment_history"."date"\)/);
  assert.match(calls[1].query, /"observed_at" <= \$\d+/);
  assert.match(calls[1].query, /order by "price_adjustment_history"."date" asc, "price_adjustment_history"."observed_at" desc$/);
  assert.ok(calls[1].params.includes(cutoff));
  assert.ok(calls[1].params.includes(range.exchange) && calls[1].params.includes(range.ticker));
  assert.equal(calls.length, 2);
});

test("invalid local cutoffs and inverted business windows never query the database", async () => {
  const tx = drizzle(async () => { throw Error("unexpected DB query"); });
  for (const observedAsOf of ["2026-11-09", "2026-11-09T15:30:00", "2026-02-30T15:30:00Z", "2026-11-09T31:00:00Z", "2026-11-09T10:30:00.1234567Z"]) {
    await assert.rejects(history.readAdjustedPriceHistory(tx, { ...range, observedAsOf }), /시각|날짜/);
  }
  await assert.rejects(history.readAdjustedPriceHistory(tx, { ...range, start: "2018-05-05" }), /시작일/);
});
