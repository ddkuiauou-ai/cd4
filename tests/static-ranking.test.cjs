const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');

const publication = { asOf: '2026-10-06', revision: '9007199254740993', scopeKey: 'krx-all',
  calculationId: 'calc-static', publishedAt: '2026-10-06T08:00:00Z' };
const item = { securityId: 'security-1', companyId: 'company-1', korName: '정적종목', exchange: 'KOSPI',
  ticker: '005930', type: '보통주', currentRank: 1, priorRank: 2, value: '9007199254740993.125', prices: [] };
function scope(key = 'krx-all', overrides = {}) {
  return { state: 'published', publication: { ...publication, scopeKey: key }, totalCount: 1, totalPages: 1,
    pages: { 1: `/data/static/${key}-1.json` }, csv: null, ...overrides };
}
function manifest(overrides = {}) {
  return { version: 1, metric: 'per', scope: 'security', scopes: {
    'krx-all': scope(), kospi: scope('kospi'), empty: scope('empty', { totalCount: 0, totalPages: 0 }),
    unpublished: scope('unpublished', { state: 'unpublished', publication: null, totalCount: 0, totalPages: 0, pages: {} }),
  }, ...overrides };
}
function snapshot(key = 'kospi', overrides = {}) {
  return { items: [item], totalCount: 1, totalPages: 1, publication: { ...publication, scopeKey: key },
    state: 'published', revisionChanged: false, ...overrides };
}
function outputMode(t, value) {
  const previous = process.env.NEXT_OUTPUT_MODE;
  t.after(() => { if (previous === undefined) delete process.env.NEXT_OUTPUT_MODE; else process.env.NEXT_OUTPUT_MODE = previous; });
  process.env.NEXT_OUTPUT_MODE = value;
}

test('static ranking queries preserve server scope and revision semantics without using prototype keys', () => {
  const { selectStaticRanking } = createBusinessPageLoader().load('lib/static-ranking.ts');
  const select = (query, page = 1, source = manifest()) => selectStaticRanking(source, new URLSearchParams(query), page);
  assert.equal(select('scope=kospi').url, '/data/static/kospi-1.json');
  for (const query of ['scope=bad%2Fscope', 'scope=kospi&scope=empty', 'scope=']) assert.equal(select(query).scopeKey, 'krx-all');
  assert.equal(select('scope=kospi', 1, manifest({ scope: 'company' })).scopeKey, 'krx-all');
  for (const key of ['unknown', '__proto__', 'constructor']) assert.equal(select(`scope=${key}`).scope, undefined);
  assert.equal(select('scope=kospi&revision=old').revisionChanged, true);
  assert.equal(select('scope=kospi&revision=old').url, undefined);
  assert.equal(select(`scope=kospi&revision=${publication.revision}`).revisionChanged, false);
  assert.equal(select('revision=old&revision=another').revisionChanged, false);
  assert.equal(select('scope=unpublished&revision=old').revisionChanged, true);
  assert.equal(select('scope=empty').outOfRange, false);
  assert.equal(select('scope=empty', 2).outOfRange, true);
});

test('scoped JSON rejects mixed publication metadata and retains exact decimals and published zero rows', () => {
  const { validateStaticRankingSnapshot: validate } = createBusinessPageLoader().load('lib/static-ranking.ts');
  assert.equal(validate(snapshot(), manifest(), 'kospi').items[0].value, '9007199254740993.125');
  for (const overrides of [{ totalCount: 2 }, { totalPages: 2 }, { state: 'unpublished' }, { revisionChanged: true },
    { publication: { ...publication, scopeKey: 'kospi', revision: '9007199254740994' } },
    { publication: { ...publication, scopeKey: 'kosdaq' } },
    { publication: { ...publication, scopeKey: 'kospi', calculationId: 'other' } }]) {
    assert.throws(() => validate(snapshot('kospi', overrides), manifest(), 'kospi'));
  }
  assert.equal(validate(snapshot('empty', { items: [], totalCount: 0, totalPages: 0 }), manifest(), 'empty').items.length, 0);
});

test('export query reader never touches request searchParams while server mode remains request-bound', async (t) => {
  let connections = 0;
  const { readPageSearch } = createBusinessPageLoader({ 'next/server': { connection: async () => { connections++; } } })
    .load('lib/static-page-search.ts');
  outputMode(t, 'export');
  const forbidden = { then() { throw new Error('Request query was accessed during export'); } };
  assert.deepEqual(await readPageSearch(forbidden), {});
  assert.equal(connections, 0);
  process.env.NEXT_OUTPUT_MODE = 'standalone';
  assert.deepEqual(await readPageSearch(Promise.resolve({ scope: 'kospi' })), { scope: 'kospi' });
  assert.equal(connections, 1);
});

test('static route HTML retains default ranking rows even when a scoped page extends beyond the default range', async (t) => {
  outputMode(t, 'export');
  const source = manifest();
  source.scopes.kospi.totalPages = 3;
  let connections = 0;
  const loader = createBusinessPageLoader({
    'next/server': { connection: async () => { connections++; throw new Error('runtime connection'); } },
    'next/navigation': { useSearchParams: () => { throw new Promise(() => {}); }, usePathname: () => '/',
      notFound: () => { throw new Error('NOT_FOUND'); } },
    '@/lib/static-build/server': { isStaticBuild: () => true, getStaticRankingManifest: () => source },
    '@/lib/data/security': { getSecurityRanksPage: async () => snapshot('krx-all') },
  });
  const { PublishedRankingPage } = loader.load('components/published-ranking-page.tsx');
  const first = await loader.renderElement(await PublishedRankingPage({ metric: 'per' }));
  assert.match(first.html, /정적종목/);
  assert.match(first.text, /9,007,199,254,740,993.125/);
  await assert.doesNotReject(() => PublishedRankingPage({ metric: 'per', page: 3 }));
  await assert.rejects(() => PublishedRankingPage({ metric: 'per', page: 4 }), /NOT_FOUND/);
  assert.equal(connections, 0);
});

test('every exported ranking CSV route reads its prepared body without request access or runtime data calls', async () => {
  let result = { body: 'prepared CSV', headers: { 'Content-Type': 'text/csv; charset=utf-8' }, status: 200 };
  const calls = [];
  const loader = createBusinessPageLoader({
    'next/server': { connection: async () => { throw new Error('runtime connection'); } },
    '@/lib/static-build/server': { isStaticBuild: () => true,
      getStaticRankingCsv: (...args) => { calls.push(args); return result; } },
    '@/lib/data/ranking-export': { createRankingCsvResponse: async () => { throw new Error('runtime database'); } },
  });
  const request = { get url() { throw new Error('request URL access'); } };
  for (const metric of ['marketcap', 'per', 'pbr', 'eps', 'bps', 'div', 'dps']) {
    const { GET } = loader.load(`app/ranking-data/securities-${metric}.csv/route.ts`);
    const response = await GET(request);
    assert.equal(response.status, 200); assert.equal(await response.text(), 'prepared CSV');
    assert.deepEqual(calls.pop(), ['security', metric]);
  }
  const { GET } = loader.load('app/ranking-data/companies-marketcap.csv/route.ts');
  assert.equal((await GET(request)).status, 200); assert.deepEqual(calls.pop(), ['company', 'marketcap']);
  result = { body: 'unpublished', headers: { 'Content-Type': 'text/plain' }, status: 404 };
  assert.equal((await GET(request)).status, 404);
});

async function withDom(run) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/per' });
  const saved = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const root = require('react-dom/client').createRoot(document.getElementById('root'));
  try { await run(root, dom); }
  finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test('ranking browser adapter prevents old rows during scope changes and aborts obsolete JSON fetches', async (t) => {
  await withDom(async root => {
    let query = new URLSearchParams();
    const pending = []; const calls = [];
    t.mock.method(globalThis, 'fetch', (url, options) => new Promise(resolve => { calls.push({ url, options }); pending.push(resolve); }));
    const loader = createBusinessPageLoader({
      'next/navigation': { useSearchParams: () => query },
      './ranking-page-view': { RankingPageView: props => React.createElement('output', { 'data-scope': props.scopeKey },
        JSON.stringify({ names: props.rows.map(row => row.name), values: props.rows.map(row => row.value),
          state: props.state, revisionChanged: props.revisionChanged, totalCount: props.totalCount })) },
    });
    const { StaticRankingPage } = loader.load('components/static-ranking-page.tsx');
    const source = manifest();
    const initial = { rows: [{ name: '기본종목', value: '10' }], metric: 'per', scope: 'security', latestDate: publication.asOf,
      currentPage: 1, totalPages: 1, totalCount: 1, basePath: '/per', scopeKey: 'krx-all', state: 'published', publication };
    const render = async search => {
      query = new URLSearchParams(search);
      await React.act(async () => root.render(React.createElement(StaticRankingPage, { initial, manifest: source })));
    };
    await render('');
    assert.match(document.body.textContent, /기본종목/); assert.equal(calls.length, 0);
    await render('scope=kospi');
    assert.doesNotMatch(document.body.textContent, /기본종목/); assert.match(document.body.textContent, /불러오고 있어요/);
    await render('scope=unknown');
    assert.equal(calls[0].options.signal.aborted, true);
    assert.match(document.body.textContent, /"state":"unpublished"/);
    await React.act(async () => { pending.shift()(new Response(JSON.stringify(snapshot()))); });
    assert.doesNotMatch(document.body.textContent, /정적종목/);
    await render('scope=kospi');
    await React.act(async () => { pending.shift()(new Response(JSON.stringify(snapshot()))); });
    assert.match(document.body.textContent, /정적종목/);
    assert.match(document.body.textContent, /9007199254740993.125/);
    await render('scope=kospi&revision=old');
    assert.match(document.body.textContent, /"revisionChanged":true/);
    assert.doesNotMatch(document.body.textContent, /정적종목/);
    await render('scope=empty');
    await React.act(async () => { pending.shift()(new Response(JSON.stringify(snapshot('empty', { items: [], totalCount: 0, totalPages: 0 })))); });
    assert.match(document.body.textContent, /"state":"published"/);
    assert.match(document.body.textContent, /"totalCount":0/);
  });
});

test('static CSV uses manifest metadata for zero rows and rejects corrupted or replaced files without response headers', async (t) => {
  await withDom(async (root, dom) => {
    let response; const files = []; const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => { requests.push({ url, options }); return response; });
    t.mock.method(URL, 'createObjectURL', () => 'blob:static-csv');
    t.mock.method(URL, 'revokeObjectURL', () => {});
    t.mock.method(dom.window.HTMLAnchorElement.prototype, 'click', function () {
      if (this.href.startsWith('blob:')) files.push(this.download);
      else this.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    const loader = createBusinessPageLoader();
    const { CsvDownloadButton } = loader.load('components/CsvDownloadButton.tsx');
    const csv = loader.load('lib/csv/ranking.ts');
    const basis = { scope: 'security', metric: 'per', scopeKey: 'kospi', rankDate: publication.asOf, referenceDate: publication.asOf,
      generatedAt: publication.publishedAt, revision: publication.revision, calculationId: publication.calculationId };
    const zero = csv.serializeRankingCsv({ ...basis, rows: [], totalCount: 0 });
    const metadata = csv.readRankingCsvMetadata(zero, { ...basis, totalCount: 0 });
    let key = 0;
    async function activate(body, overrides = {}) {
      response = new Response(body);
      await React.act(async () => root.render(React.createElement(CsvDownloadButton, { key: ++key, scope: 'security', metric: 'per',
        scopeKey: 'kospi', revision: publication.revision, staticSource: { url: '/data/static/zero.csv', metadata }, ...overrides })));
      await React.act(async () => document.querySelector('a[download]').click());
    }
    await activate(zero);
    assert.deepEqual(requests[0], { url: '/data/static/zero.csv', options: { cache: 'force-cache' } });
    assert.deepEqual(files, ['per-securities-2026-10-06.csv']);
    assert.match(document.body.textContent, /전체 0행/);
    await activate('<!doctype html><p>404</p>');
    assert.equal(files.length, 1); assert.match(document.body.textContent, /내려받지 못했어요/);
    await activate(zero, { revision: 'old' });
    assert.equal(files.length, 1); assert.match(document.body.textContent, /화면과 파일의 자료가 다릅니다/);
    await activate(zero, { scopeKey: 'kosdaq' });
    assert.equal(files.length, 1); assert.match(document.body.textContent, /내려받지 못했어요/);
    const row = { currentRank: 1, priorRank: 2, companyId: 'company-1', securityId: 'security-1', name: '종목',
      ticker: '005930', exchange: 'KOSPI', type: '보통주', value: '9007199254740993.125', metricDate: publication.asOf };
    const nonempty = csv.serializeRankingCsv({ ...basis, rows: [row], totalCount: 1 });
    const nonemptySource = { url: '/data/static/current.csv', metadata: csv.readRankingCsvMetadata(nonempty) };
    await activate(nonempty, { staticSource: nonemptySource });
    assert.equal(files.length, 2);
    await activate(csv.serializeRankingCsv({ ...basis, rows: [row], totalCount: 1, revision: 'other' }), { staticSource: nonemptySource });
    assert.equal(files.length, 2); assert.match(document.body.textContent, /내려받지 못했어요/);
  });
});

test('static dashboard suppresses content for a stale revision but preserves array query semantics', async () => {
  await withDom(async root => {
    let query = new URLSearchParams();
    const { StaticRevisionBoundary } = createBusinessPageLoader({ 'next/navigation': { useSearchParams: () => query } })
      .load('components/static-revision-boundary.tsx');
    const render = async search => { query = new URLSearchParams(search); await React.act(async () => root.render(
      React.createElement(StaticRevisionBoundary, { revision: publication.revision }, React.createElement('p', null, '대시보드 본문')))); };
    await render(`revision=${publication.revision}`); assert.match(document.body.textContent, /대시보드 본문/);
    await render('revision=old'); assert.doesNotMatch(document.body.textContent, /대시보드 본문/);
    assert.match(document.body.textContent, /자료가 갱신되었습니다/);
    await render('revision=old&revision=another'); assert.match(document.body.textContent, /대시보드 본문/);
  });
});
