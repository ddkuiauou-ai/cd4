const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { readFileSync, existsSync } = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { JSDOM } = require("jsdom");

const project = path.resolve(__dirname, "..");

function loadPresentations(pathname) {
  const loaded = new Map();
  let displayedFacts;
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => {
      if (name === "next/navigation") return { usePathname: () => pathname };
      if (name === "next/link") return ({ children, ...props }) => React.createElement("a", props, children);
      // The existing compact formatter rounds both 100 and 80 to 0.1천.
      // Keep this formatting boundary lossless so a wrong snapshot cannot pass.
      if (name === "@/lib/utils") return {
        formatNumberWithSeparateUnit: value => ({ number: String(value), unit: "" }),
        formatNumber: value => String(value),
        formatChangeRate: value => ({ value: `${value}%` }),
        cn: (...classes) => classes.filter(Boolean).join(" "),
      };
      if (name === "./detail-metric-facts") return {
        DetailMetricFacts: props => {
          displayedFacts = props;
          return React.createElement("section", null,
            React.createElement("dl", null, props.rows.map(([label, value]) =>
              React.createElement("div", { key: label },
                React.createElement("dt", null, label), React.createElement("dd", null, value)))),
            React.createElement("p", null, props.note));
        },
      };
      const local = name.startsWith("@/") ? path.join(project, name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (!local) return require(name);
      const resolved = [local, `${local}.ts`, `${local}.tsx`].find(existsSync);
      assert.ok(resolved, `Local module not found: ${name}`);
      return load(resolved);
    };
    mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
  }
  const Sidebar = load(path.join(project, "components/key-metrics-sidebar.tsx")).KeyMetricsSidebar;
  const Section = load(path.join(project, "components/key-metrics-section.tsx")).KeyMetricsSection;
  const Card = load(path.join(project, "components/card-marketcap.tsx")).default;
  return props => {
    const sidebarHtml = renderToStaticMarkup(React.createElement(Sidebar, props));
    const sectionHtml = renderToStaticMarkup(React.createElement(Section, {
      ...props,
      activeMetric: { id: "marketcap", label: "시가총액" },
      periodAnalysis: "periodAnalysis" in props ? props.periodAnalysis : { minMax: { min: 80, max: 100 } },
    }));
    const ticker = pathname.split('/').find(part => part.includes('.'))?.split('.')[1];
    const cardSecurity = pathname.includes('/security/')
      ? props.companySecs.find(item => item.ticker === (props.currentTickerOverride ?? ticker)) ?? props.security
      : props.security;
    const cardHtml = renderToStaticMarkup(React.createElement(Card, { security: cardSecurity }));
    return { sidebarHtml, sectionHtml, cardHtml, facts: displayedFacts };
  };
}

function currentSectionSnapshot(html, label) {
  const dom = new JSDOM(html);
  const section = dom.window.document.querySelector("#indicators");
  assert.ok(section, "the actual metrics section must render");
  const currentLabel = [...section.querySelectorAll("div")]
    .find(element => element.textContent.trim() === label);
  assert.ok(currentLabel, `Current marketcap label not rendered: ${label}`);
  const value = currentLabel.parentElement.firstElementChild.textContent;
  const comparison = currentLabel.parentElement.children.length === 3
    ? currentLabel.parentElement.children[1].textContent : null;
  const note = [...section.querySelectorAll("p")]
    .find(element => element.textContent.startsWith("시가총액 기준 "))?.textContent;
  dom.window.close();
  return { value, note, comparison };
}

function snapshotFixture(rawValue) {
  const normalizedSelected = {
    securityId: "selected-preferred", ticker: "000002", type: "우선주",
    name: "테스트기업우", korName: "테스트기업우", marketcap: 80,
    marketcapDate: "2026-09-30", percentage: 50, prices: [], marketcapHistory: [],
  };
  const normalizedSibling = {
    ...normalizedSelected, securityId: "sibling-preferred", ticker: "000003",
  };
  // A sibling's missing current value made company normalization use history.
  // The selected raw security still has its independent current snapshot.
  const rawSibling = { ...normalizedSibling, marketcap: null, marketcapDate: "2026-10-05" };
  const security = {
    ...normalizedSelected, marketcap: rawValue, marketcapDate: "2026-10-05",
    company: { companyId: "company", marketcap: 500, marketcapDate: "2026-10-05", marketcapRank: 1 },
  };
  return {
    security,
    companySecs: [security, rawSibling],
    companyMarketcapData: {
      companyId: "company", companyName: "테스트기업", companyKorName: "테스트기업",
      totalMarketcap: 160, totalMarketcapDate: "2026-09-30",
      securities: [normalizedSelected, normalizedSibling],
      aggregatedHistory: [{ date: "2026-09-30", totalMarketcap: 160,
        securitiesBreakdown: { "selected-preferred": 80, "sibling-preferred": 80 } }],
    },
    marketCapRanking: { currentRank: 3, priorRank: 4, rankChange: 1, value: rawValue },
    rankDate: "2026-10-05",
    rawSibling,
  };
}

test("sidebar and actual metrics section agree on each current marketcap/date pair, including individual history and zero", () => {
  const cases = [
    { name: "raw current security survives a sibling-triggered historical company fallback", rawValue: 100,
      pathname: "/security/KOSPI.000002/marketcap/", label: "종목 시가총액", value: "100원", date: "2026-10-05" },
    { name: "missing raw value uses the normalized security value and normalized date together", rawValue: null,
      pathname: "/security/KOSPI.000002/marketcap/", label: "이력 마지막 종목 시가총액", value: "80원", date: "2026-09-30" },
    { name: "raw zero is a real current snapshot rather than a fallback signal", rawValue: 0,
      pathname: "/security/KOSPI.000002/marketcap/", label: "종목 시가총액", value: "0원", date: "2026-10-05" },
    { name: "company composition uses the normalized total and normalized total date", rawValue: 100,
      pathname: "/company/KOSPI.000002/marketcap/", selectedSecurityTypeOverride: "시가총액 구성",
      label: "기업 전체 시가총액", value: "160원", date: "2026-09-30" },
    { name: "missing raw value uses the selected security's newest history ahead of its normalized snapshot", rawValue: null,
      pathname: "/security/KOSPI.000002/marketcap/", label: "이력 마지막 종목 시가총액", value: "90원", date: "2026-10-01", historyValue: 90 },
    { name: "zero in the selected security's latest history is valid and keeps its own history date", rawValue: null,
      pathname: "/security/KOSPI.000002/marketcap/", label: "이력 마지막 종목 시가총액", value: "0원", date: "2026-10-01", historyValue: 0 },
  ];
  for (const scenario of cases) {
    const { rawSibling, ...props } = snapshotFixture(scenario.rawValue);
    assert.equal(rawSibling.marketcap, null, "fixture must retain the missing sibling that caused normalization fallback");
    if (scenario.selectedSecurityTypeOverride) props.selectedSecurityTypeOverride = scenario.selectedSecurityTypeOverride;
    if (scenario.historyValue != null) {
      // Deliberately unordered selected history, plus a later sibling observation.
      // The selected value/date must not come from the company-wide last date.
      props.companyMarketcapData.securities[0].marketcapHistory = [
        { date: "2026-10-01", marketcap: scenario.historyValue },
        { date: "2026-09-29", marketcap: 70 },
      ];
      props.companyMarketcapData.securities[1].marketcapHistory = [
        { date: "2026-10-04", marketcap: 999 },
      ];
      props.companyMarketcapData.aggregatedHistory.push({
        date: "2026-10-04", totalMarketcap: 999,
        securitiesBreakdown: { "sibling-preferred": 999 },
      });
    }
    const before = JSON.stringify(props);
    const { sidebarHtml, sectionHtml, facts } = loadPresentations(scenario.pathname)(props);
    const sidebarValue = facts.rows.find(([label]) => label === scenario.label)?.[1];
    assert.equal(sidebarValue, scenario.value, scenario.name);
    assert.ok(facts.note.includes(`시가총액 기준 ${scenario.date}.`), `${scenario.name}: date must come from the same value source`);
    assert.match(sidebarHtml, new RegExp(`<dt>${scenario.label}</dt><dd>${scenario.value}</dd>`), scenario.name);
    const sectionSnapshot = currentSectionSnapshot(sectionHtml,
      scenario.selectedSecurityTypeOverride === "시가총액 구성" ? "현재 시총"
        : scenario.rawValue == null ? "이력 마지막 우선주 시총" : "현재 우선주 시총");
    assert.equal(sectionSnapshot.value, sidebarValue, `${scenario.name}: section and sidebar must show the same value`);
    assert.equal(sectionSnapshot.note, `시가총액 기준 ${scenario.date}`, `${scenario.name}: section must use the same value's date`);
    assert.equal(JSON.stringify(props), before, `${scenario.name}: presentation must not mutate either snapshot`);
  }
});

test("actual security history keeps mixed and all-zero statistics while absent or invalid records remain missing in both surfaces", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-05T12:00:00Z").getTime() });
  const cases = [
    { name: "mixed actual zero and positive observations", history: [
      { date: "2026-09-29", marketcap: 0 }, { date: "2026-10-01", marketcap: 100 },
    ], average: "50원", min: "0원", max: "100원", hasHistory: true },
    { name: "all-zero actual records survive dates omitted by company aggregation", history: [
      { date: "2026-09-29", marketcap: 0 }, { date: "2026-10-01", marketcap: 0 },
    ], average: "0원", min: "0원", max: "0원", hasHistory: true, emptyAggregation: true },
    { name: "aggregation-injected zero without an actual security record is missing", history: [],
      average: "—", min: "—", max: "—", hasHistory: false },
    { name: "null, non-finite and invalid-dated security records do not become actual zero", history: [
      { date: "2026-09-29", marketcap: null }, { date: "2026-10-01", marketcap: Infinity },
      { date: "2026-10-02", marketcap: NaN }, { date: "invalid", marketcap: 0 },
    ], average: "—", min: "—", max: "—", hasHistory: false },
  ];
  for (const scenario of cases) {
    const { rawSibling, ...props } = snapshotFixture(200);
    props.security.prices = [{ close: 777, date: "2026-10-03" }];
    props.companyMarketcapData.securities[0].marketcapHistory = scenario.history;
    if (scenario.emptyAggregation) props.periodAnalysis = null;
    props.companyMarketcapData.aggregatedHistory = scenario.emptyAggregation ? [] : [
      { date: "2026-09-29", totalMarketcap: 1000, securitiesBreakdown: { "selected-preferred": 0, "sibling-preferred": 1000 } },
      { date: "2026-10-01", totalMarketcap: 1100, securitiesBreakdown: { "selected-preferred": 100, "sibling-preferred": 1000 } },
      { date: "2026-10-04", totalMarketcap: 1000, securitiesBreakdown: { "selected-preferred": 0, "sibling-preferred": 1000 } },
    ];
    const before = JSON.stringify(props);
    const { facts, sectionHtml } = loadPresentations("/security/KOSPI.000002/marketcap/")(props);
    for (const label of ["12개월 평균", "3년 평균", "5년 평균", "10년 평균", "전체 평균"]) {
      assert.equal(currentSectionSnapshot(sectionHtml, label).value, scenario.average, `${scenario.name}: ${label}`);
    }
    assert.equal(facts.rows.find(([label]) => label === "5년 평균")[1], scenario.average, `${scenario.name}: rail average`);
    for (const [sectionLabel, railLabel, expected] of [
      ["이력 최저 시총", "이력 최저 시가총액", scenario.min],
      ["이력 최고 시총", "이력 최고 시가총액", scenario.max],
    ]) {
      assert.equal(currentSectionSnapshot(sectionHtml, sectionLabel).value, expected, `${scenario.name}: ${sectionLabel}`);
      assert.equal(facts.rows.find(([label]) => label === railLabel)[1], expected, `${scenario.name}: ${railLabel}`);
    }
    assert.equal(facts.rows.find(([label]) => label === "현재 주가")[1], "777원");
    assert.equal(currentSectionSnapshot(sectionHtml, "현재 주가").value, "777원");
    for (const htmlOrNote of [sectionHtml, facts.note]) {
      assert.match(htmlOrNote, /시가총액 기준 2026-10-05/, `${scenario.name}: current snapshot date`);
      assert.match(htmlOrNote, /주가 기준 2026-10-03/, `${scenario.name}: price date comes from the same record`);
      assert.match(htmlOrNote, /기간 평균·비교는 오늘 기준으로 계산합니다/, `${scenario.name}: execution-day period basis`);
      assert.match(htmlOrNote, scenario.hasHistory
        ? /이력 통계 범위 2026-09-29 ~ 2026-10-01 \(마지막 기록\)/ : /이력 통계: 기록 없음/, scenario.name);
      assert.doesNotMatch(htmlOrNote, /이력 통계[^<]*2026-10-04/, `${scenario.name}: a sibling's final date is not this security's history date`);
    }
    assert.equal(JSON.stringify(props), before, `${scenario.name}: source snapshots must not mutate`);
  }
});

test("selected period comparisons include zero, retain execution-day cutoffs and company statistics retain aggregate totals", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-05T12:00:00Z").getTime() });
  const { rawSibling, ...props } = snapshotFixture(200);
  props.companyMarketcapData.securities[0].marketcapHistory = [
    { date: "2025-09-01", marketcap: 100 },
    { date: "2026-09-29", marketcap: 0 },
    { date: "2026-10-01", marketcap: 100 },
  ];
  props.companyMarketcapData.aggregatedHistory = [
    { date: "2025-09-01", totalMarketcap: 200, securitiesBreakdown: { "selected-preferred": 100, "sibling-preferred": 100 } },
    { date: "2026-09-29", totalMarketcap: 120, securitiesBreakdown: { "selected-preferred": 0, "sibling-preferred": 120 } },
    { date: "2026-10-01", totalMarketcap: 220, securitiesBreakdown: { "selected-preferred": 100, "sibling-preferred": 120 } },
    { date: "2026-10-04", totalMarketcap: 100, securitiesBreakdown: { "selected-preferred": 0, "sibling-preferred": 100 } },
  ];
  const { sectionHtml } = loadPresentations("/security/KOSPI.000002/marketcap/")(props);
  const annualAverage = currentSectionSnapshot(sectionHtml, "12개월 평균");
  assert.equal(annualAverage.value, "50원");
  assert.equal(annualAverage.comparison, "-50%", "zero remains in the current-period mean when comparing to the previous period");
  assert.equal(currentSectionSnapshot(sectionHtml, "현재 우선주 시총").comparison, "—",
    "the last two actual records compare 100 against 0; a later injected zero cannot create a fake -100% change");

  props.selectedSecurityTypeOverride = "시가총액 구성";
  props.periodAnalysis = { minMax: { min: 100, max: 220 } };
  const company = loadPresentations("/company/KOSPI.000002/marketcap/")(props);
  assert.equal(currentSectionSnapshot(company.sectionHtml, "12개월 평균").value, `${(120 + 220 + 100) / 3}원`);
  assert.equal(currentSectionSnapshot(company.sectionHtml, "이력 최저 시총").value, "100원");
  assert.equal(currentSectionSnapshot(company.sectionHtml, "이력 최고 시총").value, "220원");
  assert.equal(company.facts.rows.find(([label]) => label === "5년 평균")[1], "160원");
});

test("history period means stay empty when stale records fall outside today's cutoff rather than the final history date", t => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2035-10-05T12:00:00Z").getTime() });
  const { rawSibling, ...props } = snapshotFixture(200);
  props.companyMarketcapData.securities[0].marketcapHistory = [
    { date: "2026-09-29", marketcap: 0 }, { date: "2026-10-01", marketcap: 100 },
  ];
  const { sectionHtml, facts } = loadPresentations("/security/KOSPI.000002/marketcap/")(props);
  for (const label of ["12개월 평균", "3년 평균", "5년 평균"]) {
    assert.equal(currentSectionSnapshot(sectionHtml, label).value, "—", label);
  }
  assert.equal(facts.rows.find(([label]) => label === "5년 평균")[1], "—");
  assert.equal(currentSectionSnapshot(sectionHtml, "전체 평균").value, "50원");
  assert.equal(currentSectionSnapshot(sectionHtml, "이력 최저 시총").value, "0원");
});

test("current price uses the same stored daily rate as the actual security card instead of comparing sparse closes", () => {
  const render = loadPresentations('/security/KOSPI.000002/marketcap/');
  for (const scenario of [
    { rate: 2.13, expected: '+2.13%' },
    { rate: -1.23, expected: '-1.23%' },
    { rate: 0, expected: '0.00%' },
    { rate: null, expected: '—' },
  ]) {
    const props = snapshotFixture(200);
    delete props.rawSibling;
    props.security.prices = [
      { close: 36_000, rate: scenario.rate, date: '2026-10-02' },
      { close: 39_300, rate: 7, date: '2025-09-22' },
    ];
    const before = JSON.stringify(props);
    const { sectionHtml, cardHtml } = render(props);
    const price = currentSectionSnapshot(sectionHtml, '현재 주가');
    assert.equal(price.value, '36,000원');
    assert.equal(price.comparison, `전일 대비${scenario.expected}`);
    assert.match(sectionHtml, /주가 기준 2026-10-02/);
    assert.doesNotMatch(sectionHtml, /-8\.3|-8\.4/, 'sparse-record change must not masquerade as the daily rate');
    if (scenario.rate != null) assert.ok(cardHtml.includes(scenario.expected), 'comparison card and current price share the stored rate and formatter');
    assert.equal(JSON.stringify(props), before, 'presentation must not rewrite stored price records');
  }
});

test("an individual selection keeps its own daily rate while company composition uses its representative security", () => {
  const props = snapshotFixture(200);
  delete props.rawSibling;
  const selected = { ...props.security, prices: [{ close: 50, rate: -2, date: '2026-10-01' }] };
  props.security = { ...props.security, ticker: '000001', securityId: 'representative', type: '보통주',
    prices: [{ close: 100, rate: 3, date: '2026-10-02' }] };
  props.companySecs = [props.security, selected];
  const preferred = loadPresentations('/security/KOSPI.000002/marketcap/')(props);
  assert.equal(currentSectionSnapshot(preferred.sectionHtml, '현재 주가').comparison, '전일 대비-2.00%');
  assert.match(preferred.sectionHtml, /주가 기준 2026-10-01/);
  props.selectedSecurityTypeOverride = '시가총액 구성';
  const company = loadPresentations('/company/KOSPI.000001/marketcap/')(props);
  assert.equal(currentSectionSnapshot(company.sectionHtml, '현재 주가').comparison, '전일 대비+3.00%');
  assert.match(company.sectionHtml, /주가 기준 2026-10-02/);
});

test("current marketcap comparison is tied to the displayed snapshot's own date and value, not later history", () => {
  const scenarios = [
    { name: 'older security snapshot has its own comparison', historyValue: 150, snapshotValue: 150,
      expected: '50%2025-01-01 이력 대비' },
    { name: 'unchanged positive snapshot is a real zero change rather than missing data', historyValue: 100, snapshotValue: 100,
      expected: '0%2025-01-01 이력 대비' },
    { name: 'same date with a different value cannot support a snapshot comparison', historyValue: 100, snapshotValue: 150,
      expected: '—' },
    { name: 'missing snapshot date cannot support a snapshot comparison', historyValue: 150, snapshotValue: 150,
      snapshotDate: null, expected: '—' },
    { name: 'actual zero snapshot remains comparable against positive earlier history', historyValue: 0, snapshotValue: 0,
      expected: '-100%2025-01-01 이력 대비' },
    { name: 'zero comparison denominator stays undefined', historyValue: 150, snapshotValue: 150,
      previousValue: 0, expected: '—2025-01-01 이력 대비' },
  ];
  for (const scenario of scenarios) {
    const props = snapshotFixture(scenario.snapshotValue);
    delete props.rawSibling;
    props.security.marketcapDate = 'snapshotDate' in scenario ? scenario.snapshotDate : '2025-09-22';
    props.companyMarketcapData.securities[0].marketcapHistory = [
      { date: '2026-10-02', marketcap: 10 },
      { date: '2025-01-01', marketcap: scenario.previousValue ?? 100 },
      { date: '2025-09-22', marketcap: scenario.historyValue },
      { date: 'invalid', marketcap: 999 },
    ];
    const before = JSON.stringify(props);
    const { sectionHtml } = loadPresentations('/security/KOSPI.000002/marketcap/')(props);
    assert.equal(currentSectionSnapshot(sectionHtml, '현재 우선주 시총').comparison, scenario.expected, scenario.name);
    assert.equal(JSON.stringify(props), before, `${scenario.name}: do not reorder or mutate history`);
  }
});

test("company composition comparison uses its dated total while historical fallback uses the actual final selected record", () => {
  const props = snapshotFixture(150);
  delete props.rawSibling;
  props.selectedSecurityTypeOverride = '시가총액 구성';
  props.companyMarketcapData.totalMarketcap = 150;
  props.companyMarketcapData.totalMarketcapDate = '2025-09-22';
  props.companyMarketcapData.aggregatedHistory = [
    { date: '2026-10-02', totalMarketcap: 10, securitiesBreakdown: {} },
    { date: '2025-01-01', totalMarketcap: 100, securitiesBreakdown: {} },
    { date: '2025-09-22', totalMarketcap: 150, securitiesBreakdown: {} },
  ];
  const company = loadPresentations('/company/KOSPI.000002/marketcap/')(props);
  assert.equal(currentSectionSnapshot(company.sectionHtml, '현재 시총').comparison, '50%2025-01-01 이력 대비');

  delete props.selectedSecurityTypeOverride;
  props.security.marketcap = null;
  props.companyMarketcapData.securities[0].marketcapHistory = [
    { date: '2026-10-01', marketcap: 120 },
    { date: '2025-09-22', marketcap: 100 },
  ];
  const individual = loadPresentations('/security/KOSPI.000002/marketcap/')(props);
  const snapshot = currentSectionSnapshot(individual.sectionHtml, '이력 마지막 우선주 시총');
  assert.equal(snapshot.value, '120원');
  assert.equal(snapshot.note, '시가총액 기준 2026-10-01');
  assert.equal(snapshot.comparison, '20%2025-09-22 이력 대비');
});
