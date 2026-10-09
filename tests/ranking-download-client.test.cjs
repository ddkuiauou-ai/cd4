const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');

test('real ranking downloader validates pinned revision and scope before saving, including zero-member exports', async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/per' });
  const saved = new Map();
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
  for (const [key, value] of Object.entries(globals)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const files = []; const requests = []; const blobs = [];
  let response;
  t.mock.method(globalThis, 'fetch', async (url, options) => { requests.push({ url, options }); return response; });
  t.mock.method(URL, 'createObjectURL', blob => { blobs.push(blob); return 'blob:test-export'; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const nativeClick = dom.window.HTMLAnchorElement.prototype.click;
  t.mock.method(dom.window.HTMLAnchorElement.prototype, 'click', function () {
    if (this.download && this.href.startsWith('blob:')) files.push({ name: this.download, href: this.href });
    else nativeClick.call(this);
  });
  let mounted;
  const loader = createBusinessPageLoader();
  const { CsvDownloadButton } = loader.load('components/CsvDownloadButton.tsx');
  const csv = loader.load('lib/csv/ranking.ts');
  const basis = { scope: 'security', metric: 'per', scopeKey: 'kospi', rankDate: '2026-10-06', referenceDate: '2026-10-06',
    generatedAt: '2026-10-06T08:00:00Z', revision: '9007199254740993', calculationId: 'calc-export' };
  const row = { currentRank: 1, priorRank: 3, companyId: 'company-1', securityId: 'security-1', name: '기업',
    ticker: '005930', exchange: 'KOSPI', type: '보통주', value: '9007199254740993', metricDate: '2026-10-06' };
  const valid = overrides => csv.serializeRankingCsv({ ...basis, rows: [row], totalCount: 1, ...overrides });
  let key = 0;
  async function activate(nextResponse) {
    response = nextResponse;
    await React.act(async () => mounted.render(React.createElement(CsvDownloadButton, { key: ++key,
      scope: 'security', metric: 'per', scopeKey: 'kospi', revision: basis.revision, refreshHref: '/per?scope=kospi' })));
    const link = document.querySelector('a[href^="/ranking-data/"]');
    await React.act(async () => link.click());
  }
  try {
    const { createRoot } = require('react-dom/client');
    mounted = createRoot(document.getElementById('root'));
    await activate(new Response(valid()));
    assert.deepEqual(requests[0], { url: '/ranking-data/securities-per.csv?revision=9007199254740993&scope=kospi', options: { cache: 'no-store' } });
    assert.equal(files.length, 1); assert.equal(files[0].name, 'per-securities-2026-10-06.csv');
    assert.match(await blobs[0].text(), /9007199254740993/);
    assert.match(document.body.textContent, /다운로드 시작 · 전체 1행/);

    await activate(new Response('changed', { status: 409 }));
    assert.equal(files.length, 1); assert.match(document.body.textContent, /자료가 갱신되었습니다/);
    assert.ok(document.querySelector('a[href="/per?scope=kospi"]'));
    await activate(new Response('unpublished', { status: 404 }));
    assert.equal(files.length, 1); assert.match(document.body.textContent, /아직 공개되지 않아/);
    assert.equal(document.querySelector('a[href="/per?scope=kospi"]'), null);

    await activate(new Response(valid({ scopeKey: 'kosdaq' })));
    assert.equal(files.length, 1); assert.match(document.body.textContent, /내려받지 못했어요/);
    await activate(new Response(valid({ revision: '9007199254740994' })));
    assert.equal(files.length, 1); assert.match(document.body.textContent, /화면과 파일의 자료가 다릅니다/);
    assert.ok(document.querySelector('a[href="/per?scope=kospi"]'));

    const zero = valid({ rows: [], totalCount: 0 });
    const zeroHeaders = { 'X-Ranking-Scope': 'security', 'X-Ranking-Metric': 'per', 'X-Ranking-Scope-Key': 'kospi',
      'X-Ranking-Reference-Date': basis.referenceDate, 'X-Ranking-Generated-At': basis.generatedAt,
      'X-Ranking-Revision': basis.revision, 'X-Ranking-Calculation-Id': basis.calculationId, 'X-Ranking-Row-Count': '0' };
    await activate(new Response(zero, { headers: zeroHeaders }));
    assert.equal(files.length, 2); assert.match(document.body.textContent, /다운로드 시작 · 전체 0행/);
    assert.equal((await blobs[1].text()).split('\n').length, 1);
    await activate(new Response(zero));
    assert.equal(files.length, 2); assert.match(document.body.textContent, /내려받지 못했어요/);
  } finally {
    if (mounted) await React.act(async () => mounted.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('dashboard trend tabs render real volume and preserve observation dates and security links', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/dashboard', pretendToBeVisual: true });
  const saved = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, DocumentFragment: dom.window.DocumentFragment,
    CustomEvent: dom.window.CustomEvent, MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  let mounted;
  try {
    const { createRoot } = require('react-dom/client');
    const MarketTrends = createBusinessPageLoader().load('components/MarketTrends.tsx').default;
    const item = (id, name, changePercent, volume, priceDate) => ({ securityId: id, href: `/security/${id}/marketcap`,
      name, korName: name, price: '9007199254740993', changePercent, volume, priceDate });
    mounted = createRoot(document.getElementById('root'));
    await React.act(async () => mounted.render(React.createElement(MarketTrends, {
      gainers: [item('gainer', '상승기업', 2, '10', '2026-10-02')], losers: [item('loser', '하락기업', -3, '20', '2026-10-06')],
      volume: [item('volume', '거래기업', null, '9007199254740993', '2026-10-06')], date: '2026-10-02–2026-10-06', sampleCount: 20,
    })));
    assert.match(document.querySelector('[role="tabpanel"][data-state="active"]').textContent, /상승기업.*2026-10-02.*9,007,199,254,740,993원.*\+2\.00%/);
    assert.match(document.body.textContent, /시가총액 상위 20개 기업의 대표 보통주/);
    const activate = async text => React.act(async () => [...document.querySelectorAll('[role="tab"]')]
      .find(tab => tab.textContent === text).dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, button: 0 })));
    await activate('하락');
    assert.match(document.querySelector('[role="tabpanel"][data-state="active"]').textContent, /하락기업.*2026-10-06.*-3\.00%/);
    await activate('거래량');
    assert.match(document.querySelector('[role="tabpanel"][data-state="active"]').textContent, /거래기업.*2026-10-06.*9,007,199,254,740,993주.*—/);
    assert.ok(document.querySelector('[role="tabpanel"][data-state="active"] a[href="/security/volume/marketcap"]'));
    assert.equal(document.querySelector('[role="tab"][aria-selected="true"]').textContent, '거래량');
  } finally {
    if (mounted) await React.act(async () => mounted.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
