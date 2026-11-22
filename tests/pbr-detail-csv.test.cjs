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

function currentPbr(document) {
  const overview = document.querySelector("#current-overview");
  return overview.querySelector(".investor-primary-value, .headlineMissing").textContent;
}

function periodMean(document, label) {
  return [...document.querySelectorAll("#indicators tbody tr")]
    .find(row => row.cells[0].textContent.startsWith(label))?.cells[1].textContent;
}

test("actual PBR detail keeps a supplied PBR independent from missing BPS and its last value, including the full source CSV", async () => {
  const history = [{ date: "2026-10-02", pbr: "2", pbrState: "provided", bps: null, bpsState: "source_missing" }];
  const original = structuredClone(history);
  const { document, calls, csv, snapshot, state, dom } = await renderPbr(history);
  assert.equal(currentPbr(document), "2배");
  assert.equal(snapshot.security.pbr, "2");
  assert.equal(snapshot.security.bps, null);
  assert.equal(snapshot.security.bpsState, "source_missing");
  assert.equal(snapshot.security.bpsLastProvided, "125");
  assert.equal(snapshot.security.bpsLastProvidedDate, "2026-09-30");
  assert.equal(snapshot.security.securityId, "historical-security");
  assert.equal(snapshot.security.routeCode, "KOSPI.005930");
  assert.ok(document.querySelector('a[href="/security/KOSPI.005930/pbr"][aria-current="page"]'));
  assert.ok(document.querySelector('a[href="/security/KOSPI.005930/per"]'), "the fixture supplies a current PER of zero");
  const [current, previous] = document.querySelectorAll("#current-overview .valuationPeriod");
  const inputs = [...current.querySelectorAll(".calculationInputs dd")].map(cell => cell.textContent);
  assert.deepEqual(inputs, ["—", "—"]);
  assert.equal(current.querySelector(".calculationResult dd").textContent, "2배");
  assert.equal(current.querySelector("[data-calculation]"), null);
  assert.match(previous.textContent, /비교할 관측값이 없습니다/);
  assert.deepEqual(calls, [["historical-security", "pbr"]]);
  assert.deepEqual(state.transactions, [{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  assert.match(csv, /^date,pbr,bps,state\r?\n2026-10-02,2,,provided/);
  const download = document.querySelector("#history-download button");
  assert.equal(download.textContent, "CSV");
  assert.equal(download.getAttribute("aria-label"), "예시종목 PBR 전체 이력 CSV");
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
  assert.match(document.querySelector("#chart-analysis").textContent, /직접 지정 기간 2026-09-30 ~ 2026-10-02/);
  assert.equal(periodMean(document, "12개월"), "−1배");
  assert.match(document.querySelector("#indicators").textContent, /최저\s*−2배.*최고\s*0배/);
  assert.match(text, /분석 범위 2026-09-30 ~ 2026-10-01 · 실제 관측 2개/);
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

test("the PBR detail preserves a missing December closing BPS instead of reusing an earlier December value", async () => {
  const { document, csv, dom } = await renderPbr([
    { date: "2025-12-01", pbr: "1", pbrState: "provided", bps: "70000", bpsState: "provided" },
    { date: "2025-12-30", pbr: "2", pbrState: "provided", bps: null, bpsState: "source_missing" },
    { date: "2026-10-02", pbr: "2", pbrState: "provided", bps: null, bpsState: "source_missing" },
  ]);
  assert.match(document.querySelector("#book-value").textContent, /이 기간에 표시할 연말 BPS 제공값이 없습니다/);
  assert.match(csv, /2025-12-01,1,70000,provided/);
  assert.match(csv, /2025-12-30,2,,provided/);
  dom.window.close();
});

test("an invalid period never reaches a SQL bound or produces analysis and remains distinct from an empty valid period", async () => {
  const invalid = await renderPbr([{ date: "2026-10-02", pbr: "2", pbrState: "provided" }], { start: "2026-02-30", end: "2026-10-02" });
  assert.deepEqual(invalid.calls, [["historical-security", "pbr"]]);
  assert.ok(invalid.document.querySelector('[role="alert"]'));
  assert.equal(periodMean(invalid.document, "12개월"), "—");
  assert.ok(invalid.state.queries.every(query => !query.params.includes("2026-02-30")));
  invalid.dom.window.close();
  const empty = await renderPbr([], { start: "2026-09-30", end: "2026-10-02" });
  assert.deepEqual(empty.calls, [["historical-security", "pbr"]]);
  assert.equal(empty.document.querySelector('[role="alert"]'), null);
  assert.match(empty.text, /이 범위에 제공된 관측이 없습니다|제공 이력이 없습니다/);
  assert.equal(empty.downloads.length, 0);
  empty.dom.window.close();
});

test("unpublished PBR values are hidden while available raw history and zero-valued CSV remain visible", async () => {
  const { document, text, csv, snapshot, dom } = await renderPbr(
    [{ date: "2026-10-02", pbr: "0", pbrState: "provided" }],
    { start: "2026-10-01", end: "2026-10-02" },
    { ...security, state: "unpublished", publication: null, pbr: "987654" },
  );
  assert.equal(currentPbr(document), "미제공");
  assert.equal(snapshot.security.state, "unpublished");
  assert.equal(snapshot.security.pbr, null);
  assert.equal(snapshot.security.pbrLastProvided, null);
  assert.doesNotMatch(text, /987654/);
  assert.match(text, /실제 관측 1개/);
  assert.match(csv, /2026-10-02,0,,provided/);
  dom.window.close();
});
