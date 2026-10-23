const assert = require("node:assert/strict");
const test = require("node:test");
const { createBusinessPageLoader } = require("./helpers/business-page-loader.cjs");
const { createSecurityTypoIndex, searchSecurityTypos } =
  createBusinessPageLoader().load("lib/security-typo-search.ts");

function security(securityId, overrides = {}) {
  return {
    securityId, companyId: null, korName: "삼성전자", type: "보통주",
    exchange: "KOSPI", ticker: "005930", ...overrides,
  };
}

function ids(items) {
  return items.map(item => item.securityId);
}

test("Korean jamo typos find the original security and rank a shorter name before longer equal matches", () => {
  const data = [
    security("long", { korName: "검색검증삼성전자상품" }),
    security("preferred", { korName: "삼성전자우", ticker: "005935" }),
    security("samsung"),
    security("electro-mechanics", { korName: "삼성전기", ticker: "009150" }),
  ];
  const index = createSecurityTypoIndex(data);
  for (const query of ["삼성전저", "삼성전쟈", "삼성전저".normalize("NFD"), "삼 성 전 저"]) {
    const result = searchSecurityTypos(index, query);
    assert.equal(result[0], data[2], query);
    assert.ok(result.includes(data[1]), query);
  }
});

test("partial company-name typos and mixed Latin/Korean names remain searchable", () => {
  const data = [
    security("hynix", { korName: "SK 하이닉스", ticker: "000660" }),
    security("kakao", { korName: "카카오", ticker: "035720" }),
    security("naver", { korName: "NAVER", ticker: "035420" }),
  ];
  const index = createSecurityTypoIndex(data);
  assert.equal(searchSecurityTypos(index, "하이닉서")[0], data[0]);
  assert.equal(searchSecurityTypos(index, "sk하이닉서")[0], data[0]);
  assert.equal(searchSecurityTypos(index, "카카우")[0], data[1]);
  assert.equal(searchSecurityTypos(index, "NAVOR")[0], data[2]);
});

test("short, numeric, code-qualified, initial-only, mixed-initial and oversized queries are not corrected", () => {
  const index = createSecurityTypoIndex([security("samsung")]);
  for (const query of [
    "", " ", "삼", "삼성", "005930", "005931", "A005930", "삼성005930", "kospi.005930",
    "ㅅㅅㅈㅈ", "ᄉᄉᄌᄌ", "삼성ㅈㅈ", "삼성전ㅈ", "삼성전저*", "삼성전저|삼성전자",
    "삼성전저".repeat(20), " ".repeat(257) + "삼성전저",
  ]) {
    assert.deepEqual(searchSecurityTypos(index, query), [], query);
  }
});

test("only security names are fuzzy search keys, never public codes, type, market or private identities", () => {
  const index = createSecurityTypoIndex([security("hiddenidentity", {
    companyId: "privatecompany", routeCode: "secretroute", companyRouteCode: "companyroute",
    ticker: "ABCDEF", type: "우선주", exchange: "KOSDAQ",
  })]);
  for (const query of ["hiddenidentitx", "privatecompanx", "secretroutx", "companyroutx", "ABCDEG", "우선쥬", "KOSDAW"]) {
    assert.deepEqual(searchSecurityTypos(index, query), [], query);
  }
});

test("suggestions keep original objects, deduplicate only security identities and stay capped at five", () => {
  const sharedTicker = Array.from({ length: 8 }, (_, position) => security(`samsung-${position}`));
  const index = createSecurityTypoIndex([sharedTicker[0], sharedTicker[0], ...sharedTicker]);
  const result = searchSecurityTypos(index, "삼성전저");
  assert.equal(result.length, 5);
  assert.deepEqual(ids(result), sharedTicker.slice(0, 5).map(item => item.securityId));
  result.forEach((item, position) => assert.equal(item, sharedTicker[position]));
});

test("unrelated names stay empty and repeated searches reuse the same index deterministically", () => {
  const data = [security("samsung"), security("hynix", { korName: "SK하이닉스" })];
  const index = createSecurityTypoIndex(data);
  for (const query of ["쿠쿠다스", "zzzxxyy", "전혀무관한검색어", "삼숭쥰쟈"]) {
    assert.deepEqual(searchSecurityTypos(index, query), [], query);
  }
  const first = searchSecurityTypos(index, "삼성전저");
  searchSecurityTypos(index, "하이닉서");
  assert.deepEqual(searchSecurityTypos(index, "삼성전저"), first);
  assert.deepEqual(searchSecurityTypos(createSecurityTypoIndex([]), "삼성전저"), []);
});

test("a long matching name does not make several unrelated letter changes acceptable", () => {
  const item = security("long-name", { korName: "한국항공우주연구기업" });
  const index = createSecurityTypoIndex([item]);
  assert.deepEqual(searchSecurityTypos(index, "한국항공우쥬연구기업"), [item]);
  assert.deepEqual(searchSecurityTypos(index, "한각항궁워주연구기업"), []);
});
