const assert = require("node:assert/strict");
const test = require("node:test");
const { createBusinessPageLoader } = require("./helpers/business-page-loader.cjs");
const { SEARCH_RESULT_LIMIT, createSecuritySearchIndex, searchSecurityIndex } =
  createBusinessPageLoader().load("lib/security-search.ts");

function security(securityId, overrides = {}) {
  return {
    securityId, companyId: null, korName: "삼성전자", type: "보통주",
    exchange: "KOSPI", ticker: "005930", ...overrides,
  };
}

function ids(result) {
  return result.items.map(item => item.securityId);
}

test("an exact code at the end outranks earlier partial matches without matching numeric IDs or names", () => {
  const data = Array.from({ length: 60 }, (_, position) => security(`partial-${position}`, { ticker: `005930${position}` }));
  data.push(security("005930-private-id", { korName: "005930 회사", ticker: "888888" }));
  data.push(security("exact"));
  const result = searchSecurityIndex(createSecuritySearchIndex(data), "005930");
  assert.equal(result.items.length, SEARCH_RESULT_LIMIT);
  assert.equal(result.total, 61);
  assert.equal(result.items[0], data.at(-1));
  assert.deepEqual(ids(result).slice(1, 4), ["partial-0", "partial-1", "partial-2"]);
  assert.ok(!ids(result).includes("005930-private-id"));
});

test("code prefix and substring searches are deterministic and preserve distinct securities sharing one ticker", () => {
  const data = [
    security("substring", { ticker: "100593" }),
    security("old", { ticker: "005930", routeCode: null }),
    security("new", { ticker: "005930", routeCode: null }),
    security("exact-prefix", { ticker: "0059" }),
  ];
  const index = createSecuritySearchIndex(data);
  assert.deepEqual(ids(searchSecurityIndex(index, "0059")), ["exact-prefix", "old", "new", "substring"]);
  const exact = searchSecurityIndex(index, "005930");
  assert.deepEqual(ids(exact), ["old", "new"]);
  assert.equal(exact.total, 2);
  assert.equal(exact.items[0], data[1]);
});

test("names and initials support full, prefix, substring, whitespace and mixed syllable searches", () => {
  const index = createSecuritySearchIndex([
    security("preferred", { korName: "삼성전자우", ticker: "005935" }),
    security("samsung"),
    security("samsung-life", { korName: "삼성생명", ticker: "032830" }),
  ]);
  for (const query of ["삼성전자", "삼 성 전 자", "ㅅㅅㅈㅈ", "ᄉᄉᄌᄌ", "삼성ㅈㅈ", "삼성전자".normalize("NFD")]) {
    assert.deepEqual(ids(searchSecurityIndex(index, query)), ["samsung", "preferred"], query);
  }
  assert.deepEqual(ids(searchSecurityIndex(index, "ㅅㅅ")), ["preferred", "samsung", "samsung-life"]);
  assert.deepEqual(ids(searchSecurityIndex(index, "전자")), ["preferred", "samsung"]);
  assert.equal(searchSecurityIndex(index, "삼성전저").total, 0, "arbitrary typos are not fuzzy matched");
});

test("Latin names, exchanges and security types remain searchable with normalized case and spacing", () => {
  const index = createSecuritySearchIndex([
    security("sk", { korName: "SK 하이닉스", ticker: "000660" }),
    security("kosdaq", { korName: "코스닥기업", ticker: "123456", exchange: "KOSDAQ", type: "우선주" }),
  ]);
  assert.deepEqual(ids(searchSecurityIndex(index, "  sk하이닉스 ")), ["sk"]);
  assert.deepEqual(ids(searchSecurityIndex(index, "KoSdAq")), ["kosdaq"]);
  assert.deepEqual(ids(searchSecurityIndex(index, "우 선 주")), ["kosdaq"]);
  assert.deepEqual(ids(searchSecurityIndex(index, "kospi.000660")), ["sk"]);
  assert.equal(searchSecurityIndex(index, "kosdaq.000660").total, 0);
  assert.deepEqual(ids(searchSecurityIndex(index, " KOSPI . 0006 ")), ["sk"]);
});

test("internal IDs and routing identity never become search keywords", () => {
  const index = createSecuritySearchIndex([
    security("hidden-security-abc123", {
      companyId: "hidden-company-def456", ticker: "999999", routeCode: "hidden-route-ghi789",
    }),
  ]);
  for (const query of ["hidden", "abc123", "def456", "ghi789", "123", "456", "789", "security", "company"]) {
    assert.deepEqual(searchSecurityIndex(index, query), { items: [], total: 0 }, query);
  }
});

test("space-separated terms match across public fields with AND semantics and code ranking", () => {
  const index = createSecuritySearchIndex([
    security("substring", { ticker: "1005930" }),
    security("prefix", { ticker: "0059301" }),
    security("exact"),
    security("other-market", { exchange: "KOSDAQ" }),
    security("other-name", { korName: "현대자동차" }),
  ]);
  assert.deepEqual(ids(searchSecurityIndex(index, "삼성 005930")), ["exact", "other-market", "prefix", "substring"]);
  assert.deepEqual(ids(searchSecurityIndex(index, "005930 삼성")), ["exact", "other-market", "prefix", "substring"]);
  assert.deepEqual(ids(searchSecurityIndex(index, "삼성전자 KOSPI")), ["substring", "prefix", "exact"]);
  assert.deepEqual(ids(searchSecurityIndex(index, "ㅅㅅㅈㅈ 005930 kospi")), ["exact", "prefix", "substring"]);
  assert.deepEqual(ids(searchSecurityIndex(index, "삼성 kospi.005930")), ["exact", "prefix", "substring"]);
  assert.deepEqual(searchSecurityIndex(index, "삼성 005930 KOSPI", 1), { items: [index[2].item], total: 3 });
  assert.equal(searchSecurityIndex(index, "삼성 KOSDAQ 우선주").total, 0);
});

test("AND query tokens cannot match numeric names or internal identities", () => {
  const index = createSecuritySearchIndex([
    security("005930-hidden-id", { korName: "삼성 005930 회사", ticker: "888888", companyId: "hidden-company" }),
    security("real-code", { korName: "삼성생명" }),
  ]);
  assert.deepEqual(ids(searchSecurityIndex(index, "삼성 005930 KOSPI")), ["real-code"]);
  assert.equal(searchSecurityIndex(index, "삼성 hidden").total, 0);
  assert.equal(searchSecurityIndex(index, "삼성 company").total, 0);
});

test("empty input and bounded result sizes retain total counts and source ordering", () => {
  const data = Array.from({ length: 55 }, (_, position) => security(`item-${position}`));
  const index = createSecuritySearchIndex(data);
  const empty = searchSecurityIndex(index, " \t ");
  assert.equal(empty.total, 55);
  assert.equal(empty.items.length, SEARCH_RESULT_LIMIT);
  assert.deepEqual(empty.items, data.slice(0, SEARCH_RESULT_LIMIT));
  for (const query of ["", "삼성", "005930"]) {
    assert.deepEqual(searchSecurityIndex(index, query, 0), { items: [], total: 55 });
    assert.deepEqual(searchSecurityIndex(index, query, -1), { items: [], total: 55 });
    assert.deepEqual(searchSecurityIndex(index, query, 2.9), { items: data.slice(0, 2), total: 55 });
  }
  assert.deepEqual(searchSecurityIndex([], "삼성"), { items: [], total: 0 });
});

test("a reusable 3,000-security index consistently returns a bounded result set", () => {
  const data = Array.from({ length: 3_000 }, (_, position) => security(`item-${position}`, {
    korName: `검색기업${position}`, ticker: String(position).padStart(6, "0"),
  }));
  const index = createSecuritySearchIndex(data);
  for (let iteration = 0; iteration < 50; iteration++) {
    const broad = searchSecurityIndex(index, "ㄱㅅ");
    assert.equal(broad.total, 3_000);
    assert.equal(broad.items.length, SEARCH_RESULT_LIMIT);
    assert.equal(broad.items[0], data[0]);
    assert.deepEqual(searchSecurityIndex(index, "002999"), { items: [data[2999]], total: 1 });
  }
});
