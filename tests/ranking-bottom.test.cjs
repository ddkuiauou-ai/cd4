const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');

const publication = {
  asOf: '2026-10-08', revision: '9007199254740993', scopeKey: 'krx-all',
  calculationId: 'published-calculation', publishedAt: '2026-10-09T01:00:00Z',
};
const row = (index, priceDate) => ({
  id: `security-${index}`, scope: 'company', metric: 'marketcap', name: `기업${index}`,
  ticker: String(index).padStart(6, '0'), exchange: 'KOSPI', stockType: '보통주',
  href: `/company/company-${index}/marketcap`, rank: index, priorRank: index,
  value: '9007199254740993', securityId: null, securityHref: null, completeness: 'complete',
  metricDate: '2026-10-01', close: null, rate: null, priceDate, volume: null, prices: [],
});

async function renderBottom(overrides = {}) {
  const loader = createBusinessPageLoader();
  const { RankingPageView } = loader.load('components/ranking-page-view.tsx');
  const props = {
    rows: [row(1, '2026-09-29'), row(2, '2026-10-07')], metric: 'marketcap', scope: 'company',
    latestDate: '2026-10-11', publication, totalCount: 120, currentPage: 1,
    totalPages: 2, basePath: '/marketcaps', ...overrides,
  };
  const { html } = await loader.renderElement(React.createElement(RankingPageView, props));
  return new JSDOM(html).window.document;
}

test('ranking criteria follows the list and rail, keeping publication and price dates distinct', async () => {
  const document = await renderBottom();
  const listing = document.querySelector('.ranking-shell');
  const basis = document.querySelector('section[aria-labelledby="ranking-basis-title"]');
  assert.ok(listing);
  assert.ok(basis);
  assert.equal(listing.contains(basis), false, 'The sticky containing block must end before criteria');
  assert.equal(listing.nextElementSibling, basis);
  assert.equal(document.querySelectorAll('#ranking-basis-title').length, 1);
  assert.equal(listing.querySelector('.context-rail dl'), null, 'The rail must not repeat the data criteria');
  assert.match(basis.textContent, /보통주와 우선주를 합산/);
  assert.match(basis.textContent, /대표 보통주 기준/);
  const dates = Object.fromEntries([...basis.querySelectorAll('.dates>div')].map(entry =>
    [entry.querySelector('dt').textContent, entry.querySelector('dd').textContent]));
  assert.deepEqual(dates, { '공개 기준일': '2026.10.08', '가격 관측일': '2026.09.29–2026.10.07' });
  assert.doesNotMatch(basis.textContent, /2026.10.11/, 'The publication header takes precedence over the fallback');
  const disclosure = basis.querySelector('details');
  assert.equal(disclosure.open, false);
  assert.match(disclosure.textContent, /자료 갱신 번호9007199254740993/);
  assert.match(disclosure.textContent, /공개 대상KRX 전체/);
  assert.match(disclosure.textContent, /지표 단위원/);
  assert.match(disclosure.textContent, /순위 변화.*이전 순위.*주가 등락과 별개/);
});

test('missing observations, unpublished results, empty results and revision feedback keep their meanings', async () => {
  const missing = await renderBottom({ rows: [row(1, null)], publication: null, latestDate: null });
  const basis = missing.querySelector('.dataBasis');
  assert.match(basis.textContent, /공개 기준일정보 없음/);
  assert.match(basis.textContent, /가격 관측일정보 없음/);
  assert.match(basis.textContent, /자료 갱신 번호미공개/);

  const unpublished = await renderBottom({ state: 'unpublished', rows: [], publication: null, latestDate: null });
  assert.match(unpublished.querySelector('.empty[role="status"]').textContent, /아직 공개된 순위가 없습니다/);
  assert.match(unpublished.querySelector('.dates').textContent, /공개 기준일미공개.*가격 관측일정보 없음/);
  assert.equal(unpublished.querySelector('a[href^="/ranking-data/"]'), null);

  const empty = await renderBottom({ rows: [], totalCount: 0, totalPages: 1 });
  assert.match(empty.querySelector('.empty[role="status"]').textContent, /공개된 순위 대상은 0개/);
  assert.match(empty.querySelector('.dates').textContent, /공개 기준일2026.10.08.*가격 관측일정보 없음/);

  const changed = await renderBottom({ revisionChanged: true });
  assert.match(changed.querySelector('.empty[role="status"]').textContent, /자료가 갱신되었습니다/);
  assert.equal(changed.querySelector('a[href^="/ranking-data/"]'), null);
  assert.equal(changed.querySelectorAll('.dataBasis').length, 1);
});

test('each security metric retains its description and identifies the price as that security', async () => {
  const { RANKING_METRICS } = createBusinessPageLoader().load('lib/ranking-view.ts');
  for (const [metric, definition] of Object.entries(RANKING_METRICS)) {
    const document = await renderBottom({
      metric, scope: 'security', scopeKey: 'kosdaq-preferred', basePath: `/${metric}`,
      rows: [], publication: { ...publication, scopeKey: 'kosdaq-preferred' },
    });
    const basis = document.querySelector('.dataBasis');
    assert.ok(basis.textContent.includes(definition.description), `${metric}: existing explanation must survive`);
    assert.match(basis.textContent, /해당 종목 기준/);
    assert.doesNotMatch(basis.textContent, /대표 보통주 기준|보통주와 우선주를 합산/);
    assert.match(basis.textContent, /종목별 · 코스닥 우선주/);
    assert.ok(basis.querySelector('details').textContent.includes(`지표 단위${definition.unit}`));
    assert.match(basis.querySelector('details').textContent, /공개 대상코스닥 우선주/);
  }
});

const storageKey = 'recently-viewed-securities';
function recentRecord(index) {
  const ticker = String(index + 1).padStart(6, '0');
  return {
    secCode: `KOSPI.${ticker}`, securityId: `recent-${index}`, routeCode: `KOSPI.${ticker}`,
    name: `Security ${index}`, korName: index === 0 ? '아주긴기업이름우선주를포함한최근기록' : `최근종목${index}`,
    ticker, exchange: 'KOSPI', lastViewed: 100 - index, lastMetric: 'pbr',
    lastPath: `/security/KOSPI.${ticker}/pbr?period=historical&start=2020-01-01&end=2020-12-31`,
    metrics: { pbr: { value: '0', lastViewed: 100 - index } },
  };
}

for (const count of [0, 1, 4, 10]) {
  test(`ranking preview limits ${count} stored records without changing full history or fetching`, async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3001/' });
    let root, requests = 0;
    const errors = [];
    const values = {
      window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
      StorageEvent: dom.window.StorageEvent, IS_REACT_ACT_ENVIRONMENT: true,
      fetch: async () => { requests++; throw new Error('History must not fetch'); },
    };
    const prior = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const originalError = console.error;
    for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    console.error = (...args) => errors.push(args.map(String).join(' '));
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from({ length: count }, (_, index) => recentRecord(index))));
      const { load } = createBusinessPageLoader();
      const { RecentSecuritiesSidebar } = load('components/recent-securities-sidebar.tsx');
      const { createRoot } = require('react-dom/client');
      root = createRoot(document.getElementById('root'));
      await React.act(async () => root.render(React.createElement(React.StrictMode, null,
        React.createElement('div', { id: 'preview' }, React.createElement(RecentSecuritiesSidebar, { variant: 'ranking-preview' })),
        React.createElement('div', { id: 'full' }, React.createElement(RecentSecuritiesSidebar)))));
      const preview = document.getElementById('preview'), full = document.getElementById('full');
      assert.equal(preview.querySelectorAll('li').length, Math.min(4, count));
      assert.equal(full.querySelectorAll('li').length, count);
      assert.match(preview.textContent, new RegExp(`${count}개`));
      assert.equal(preview.querySelector('button[aria-label$="최근 기록 삭제"]'), null);
      assert.doesNotMatch(preview.textContent, /전체 삭제|PBR 0배/);
      assert.equal(JSON.parse(localStorage.getItem(storageKey)).length, count, 'Preview limits must not truncate stored history');
      if (count) {
        assert.match(preview.textContent, /전체 기록 보기/);
        assert.match(full.textContent, /PBR 0배/);
        assert.equal(preview.querySelector('a').getAttribute('href'), recentRecord(0).lastPath);
        assert.equal(preview.querySelector('a>span').textContent, recentRecord(0).korName);
      } else {
        assert.match(preview.textContent, /종목을 둘러보면 이곳에 표시됩니다/);
        assert.equal(preview.querySelector('button'), null);
      }
      if (count === 10) {
        await React.act(async () => full.querySelector('button[aria-label$="최근 기록 삭제"]').click());
        assert.equal(full.querySelectorAll('li').length, 9);
        assert.equal(preview.querySelectorAll('li').length, 4);
        assert.match(preview.textContent, /9개/);
        assert.equal(preview.querySelector('a').getAttribute('href'), recentRecord(1).lastPath);
        const clear = [...full.querySelectorAll('button')].find(button => button.textContent === '전체 삭제');
        await React.act(async () => clear.click());
        assert.equal(preview.querySelectorAll('li').length, 0);
        assert.equal(full.querySelectorAll('li').length, 0);
        assert.match(preview.textContent, /0개/);
        assert.equal(localStorage.getItem(storageKey), null);
      }
      assert.equal(requests, 0);
      assert.deepEqual(errors, []);
    } finally {
      if (root) await React.act(async () => root.unmount());
      console.error = originalError;
      for (const [key, descriptor] of prior) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
      dom.window.close();
    }
  });
}
