const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { JSDOM } = require("jsdom");
const { createBusinessPageLoader } = require("./helpers/business-page-loader.cjs");
const { fixture, publication: makePublication, day } = require("./helpers/business-data.cjs");

const publication = { asOf: "2026-10-02", revision: "3", scopeKey: "krx-all", calculationId: "fixture", publishedAt: "2026-10-03T01:00:00Z" };
const security = {
  securityId: "historical-security", companyId: null, name: "Example", korName: "예시종목",
  exchange: "KOSPI", ticker: "005930", routeCode: null, state: "published", publication,
  pbr: "2", pbrDate: "2026-10-02", pbrState: "provided",
  pbrLastProvided: "2", pbrLastProvidedDate: "2026-10-02",
  bps: null, bpsDate: "2026-10-02", bpsState: "source_missing",
  bpsLastProvided: "125", bpsLastProvidedDate: "2026-09-30",
};

async function renderPbr(history, search = {}, identity = security) {
  const { state, load } = fixture();
  const header = { ...makePublication("security_latest", "pbr", 3n), calculationId: "fixture" };
  const rankHeader = { ...makePublication("security_rank", "pbr", 3n), calculationId: "fixture" };
  const row = { ...state.securities[0], ...identity, company: null, prices: [], marketcaps: [],
    publicationKey: header.publicationKey, resultRevision: identity.state === "published" ? 3n : 4n, calculationId: "fixture",
    price: null, priceState: "no_observation", priceLastProvided: null, delistingDate: null };
  for (const key of Object.keys(row)) if (key.endsWith("Date") && typeof row[key] === "string") row[key] = day(row[key]);
  state.securities = [row]; state.companies = []; state.publications = [header, rankHeader]; state.ranks = [];
  state.metrics = history.map(observation => ({ ...observation, securityId: identity.securityId, date: day(observation.date) }));
  const data = load("lib/data/detail-snapshot.ts");
  const calls = [], downloads = [];
  let snapshot, RealCsvButton;
  const loader = createBusinessPageLoader({
    "@/lib/data/detail-snapshot": {
      getSecurityDetailSnapshot: async (...args) => { calls.push(args); snapshot = await data.getSecurityDetailSnapshot(...args); return snapshot; },
    },
    "./CsvDownloadButton": { CsvDownloadButton: props => { downloads.push(props); return React.createElement(RealCsvButton, props); } },
  });
  RealCsvButton = loader.load("components/CsvDownloadButton.tsx").CsvDownloadButton;
  const rendered = await loader.renderRoute("app/security/[secCode]/pbr/page.tsx", {
    params: { secCode: "historical-security" }, searchParams: search,
  });
  const dom = new JSDOM(rendered.html);
  const csv = downloads[0] ? loader.load("lib/csv/ranking.ts").serializeCsvRows(downloads[0].data) : null;
  return { ...rendered, calls, downloads, csv, snapshot, state, dom, document: dom.window.document };
}

function metricCard(document, label) {
  return [...document.querySelectorAll("#indicators div")]
    .find(row => row.children[0]?.tagName === "P" && row.children[0].textContent === label)?.children[1].textContent;
}

test("actual PBR detail keeps a supplied PBR independent from missing BPS and its last value, including the full source CSV", async () => {
  const history = [{ date: "2026-10-02", pbr: "2", pbrState: "provided", bps: null, bpsState: "source_missing" }];
  const original = structuredClone(history);
  const { document, calls, csv, snapshot, state, dom } = await renderPbr(history);
  assert.equal(metricCard(document, "현재 PBR"), "2배");
  assert.equal(snapshot.security.pbr, "2");
  assert.equal(snapshot.security.bps, null);
  assert.equal(snapshot.security.bpsState, "source_missing");
  assert.equal(snapshot.security.bpsLastProvided, "125");
  assert.equal(snapshot.security.bpsLastProvidedDate, "2026-09-30");
  assert.equal(snapshot.security.securityId, "historical-security");
  assert.equal(snapshot.security.routeCode, "KOSPI.005930");
  assert.ok(document.querySelector('form[action="/security/KOSPI.005930/pbr"]'));
  assert.ok(document.querySelector('a[href="/security/KOSPI.005930/per"]'));
  assert.deepEqual(calls, [["historical-security", "pbr"]]);
  assert.deepEqual(state.transactions, [{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  assert.match(csv, /^date,pbr,bps,state\r?\n2026-10-02,2,,provided/);
  assert.match(document.body.textContent, /선택 기간과 관계없이 전체 제공 이력/);
  assert.deepEqual(history, original);
  dom.window.close();
});

test("selected PBR history preserves zero and negative observations, skips missing fields, and exports the complete provided history", async () => {
  const history = [
    { date: "2026-09-29", pbr: "999", pbrState: "provided" },
    { date: "2026-09-30", pbr: "-2", pbrState: "provided", bps: null },
    { date: "2026-10-01", pbr: "0", pbrState: "provided", bps: null },
    { date: "2026-10-02", pbr: null, pbrState: "unsupported" },
    { date: "2026-10-03", pbr: "999", pbrState: "provided" },
  ];
  const { document, text, calls, csv, downloads, snapshot, dom } = await renderPbr(history, { start: "2026-09-30", end: "2026-10-02" });
  assert.deepEqual(calls, [["historical-security", "pbr"]]);
  assert.equal(document.querySelector('input[name="start"]').value, "2026-09-30");
  assert.equal(document.querySelector('input[name="end"]').value, "2026-10-02");
  assert.equal(metricCard(document, "12개월 평균"), "-1배");
  assert.equal(metricCard(document, "최저값"), "-2배");
  assert.equal(metricCard(document, "최고값"), "0배");
  assert.match(text, /분석 범위 2026-09-30 ~ 2026-10-01 · 실제 제공 2개/);
  assert.deepEqual(snapshot.history.map(row => row.pbr), ["999", "-2", "0", null]);
  assert.deepEqual(downloads[0].data.map(row => [row.date, row.pbr, row.state]), [
    ["2026-09-29", "999", "provided"], ["2026-09-30", "-2", "provided"],
    ["2026-10-01", "0", "provided"], ["2026-10-02", null, "unsupported"],
  ]);
  assert.match(csv, /2026-10-01,0,,provided/);
  assert.match(csv, /2026-10-02,,,unsupported/);
  assert.doesNotMatch(csv, /2026-10-03/);
  assert.doesNotMatch(document.querySelector("#indicators").textContent, /999/);
  dom.window.close();
});

test("an invalid period never reaches a SQL bound or produces analysis and remains distinct from an empty valid period", async () => {
  const invalid = await renderPbr([{ date: "2026-10-02", pbr: "2", pbrState: "provided" }], { start: "2026-02-30", end: "2026-10-02" });
  assert.deepEqual(invalid.calls, [["historical-security", "pbr"]]);
  assert.ok(invalid.document.querySelector('[role="alert"]'));
  assert.equal(metricCard(invalid.document, "12개월 평균"), "—");
  assert.ok(invalid.state.queries.every(query => !query.params.includes("2026-02-30")));
  invalid.dom.window.close();
  const empty = await renderPbr([], { start: "2026-09-30", end: "2026-10-02" });
  assert.deepEqual(empty.calls, [["historical-security", "pbr"]]);
  assert.equal(empty.document.querySelector('[role="alert"]'), null);
  assert.match(empty.text, /선택 기간에 제공된 관측값이 없습니다/);
  assert.equal(empty.downloads.length, 0);
  empty.dom.window.close();
});

test("unpublished PBR values are hidden while available raw history and zero-valued CSV remain visible", async () => {
  const { document, text, csv, snapshot, dom } = await renderPbr(
    [{ date: "2026-10-02", pbr: "0", pbrState: "provided" }],
    { start: "2026-10-01", end: "2026-10-02" },
    { ...security, state: "unpublished", publication: null, pbr: "987654" },
  );
  assert.equal(metricCard(document, "현재 PBR"), "—");
  assert.equal(snapshot.security.state, "unpublished");
  assert.equal(snapshot.security.pbr, null);
  assert.equal(snapshot.security.pbrLastProvided, null);
  assert.doesNotMatch(text, /987654/);
  assert.match(text, /실제 제공 1개/);
  assert.match(csv, /2026-10-02,0,,provided/);
  dom.window.close();
});
