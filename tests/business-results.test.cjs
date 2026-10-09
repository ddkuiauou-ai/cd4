const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const root = path.resolve(__dirname, '..');

function loader(stubs = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const mod = new Module(file);
    cache.set(file, mod);
    mod.paths = Module._nodeModulePaths(path.dirname(file));
    mod.require = name => {
      if (name in stubs) return stubs[name];
      if (name === 'next/link') return ({ children, ...props }) => React.createElement('a', props, children);
      if (name === 'next/server') return { connection: async () => {} };
      if (name === 'next/navigation') return { notFound: () => { throw new Error('not-found'); } };
      const local = name.startsWith('@/') ? path.join(root, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
      if (!local) return require(name);
      const resolved = [local, `${local}.ts`, `${local}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
      assert.ok(resolved, name);
      return load(resolved);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, file);
    return mod.exports;
  }
  return file => load(path.join(root, file));
}

const analysis = loader()('lib/business-analysis.ts');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');
const publication = { asOf: '2026-10-02', revision: '3', scopeKey: 'krx-all', calculationId: 'fixture-calculation', publishedAt: '2026-10-03T01:00:00Z' };
const observation = (date, value, state = 'provided') => ({ date, value, state });

test('screen statistics preserve actual zero and negatives while skipping declared missing observations', () => {
  const result = analysis.summarizeBusinessWindow([
    observation('2026-10-03', -6), observation('2026-10-01', 0),
    observation('2026-10-02', null, 'source_missing'), observation('2026-10-04', 3),
  ]);
  assert.deepEqual(result, { count: 3, start: '2026-10-01', end: '2026-10-04', mean: '-1', min: '-6', max: '3', difference: '3', changePercent: null });
  assert.equal(analysis.summarizeBusinessWindow([observation('2026-10-01', -2), observation('2026-10-02', -1)]).changePercent, null);
  assert.equal(analysis.summarizeBusinessWindow([observation('2026-10-01', 2), observation('2026-10-02', 0)]).changePercent, '-100');
});

test('large exact integers survive screen formatting, arithmetic and normalized chart coordinates', () => {
  const rows = [observation('2026-10-01', '9007199254740993'), observation('2026-10-02', '9007199254740995')];
  const result = analysis.summarizeBusinessWindow(rows);
  assert.equal(analysis.formatBusinessValue(rows[0].value), '9,007,199,254,740,993');
  assert.equal(result.mean, '9007199254740994');
  assert.equal(result.difference, '2');
  assert.deepEqual(analysis.businessChartSegments(rows), ['0.00,180.00 720.00,0.00']);
  assert.equal(analysis.formatBusinessValue(null), '—');
  assert.equal(analysis.formatBusinessValue(0), '0');
});

test('a missing field breaks chart segments and cannot turn into a zero point', () => {
  const rows = [observation('2026-10-01', 12.3), observation('2026-10-02', null, 'unsupported'), observation('2026-10-03', 0)];
  const segments = analysis.businessChartSegments(rows);
  assert.equal(segments.length, 2);
  assert.ok(segments.every(segment => !segment.includes('NaN') && !segment.includes('Infinity')));
  assert.equal(analysis.summarizeBusinessWindow(rows).count, 2);
});

test('period selection validates calendar days and analyzes only the requested window', () => {
  assert.equal(analysis.isBusinessDay('2024-02-29'), true);
  assert.equal(analysis.isBusinessDay('2025-02-29'), false);
  const selected = analysis.selectBusinessWindow([observation('2026-10-03', 3), observation('2026-10-01', 1), observation('invalid', 9)], '2026-10-02', '2026-10-04');
  assert.deepEqual(selected, [observation('2026-10-03', 3)]);
});

function detailFixture(overrides = {}) {
  const security = { securityId: 'security-1', companyId: null, routeCode: 'KOSPI.005930',
    name: 'Samsung', korName: '삼성전자', ticker: '005930', exchange: 'KOSPI', type: '보통주',
    state: 'published', publication, company: null, price: null, priceState: 'no_observation',
    priceDate: null, shares: null, sharesDate: null, prices: [], marketcaps: [],
    ...Object.fromEntries(['marketcap','per','pbr','eps','bps','div','dps'].flatMap(metric => [
      [metric,null], [`${metric}State`,'no_observation'], [`${metric}Date`,'2026-10-02'],
      [`${metric}LastProvided`,null], [`${metric}LastProvidedDate`,null],
    ])), ...overrides };
  return { security, company: null, companySecs: [], ranking: null, neighbors: [], history: [], priceHistory: [] };
}
async function renderDetail(snapshot, metric) {
  const boundary = createBusinessPageLoader({
    '@/lib/data/detail-snapshot': { getSecurityDetailSnapshot: async () => snapshot },
    '@/components/mobile-header-context': { useMobileHeader: () => ({ setContent() {} }) },
  });
  const { RestoredSecurityDetail } = boundary.load('components/restored-detail-page.tsx');
  return boundary.renderElement(await RestoredSecurityDetail({ code: 'security-1', metric }));
}

test('restored details distinguish latest missing from last provided and preserve actual zero and negative EPS', async () => {
  const missing = await renderDetail(detailFixture({ per: null, perState: 'source_missing', perLastProvided: '12.3', perLastProvidedDate: '2026-10-01' }), 'per');
  assert.match(missing.text, /원천 미제공.*마지막 제공값 12\.3배/);
  const zero = await renderDetail(detailFixture({ dps: '0', dpsState: 'provided' }), 'dps');
  assert.match(zero.text, /현재 DPS 0원/);
  const negative = await renderDetail(detailFixture({ eps: '-5', epsState: 'provided' }), 'eps');
  assert.match(negative.text, /현재 EPS -5원/);
});

test('unpublished restored details hide unaccepted master values and retain navigation', async () => {
  const result = await renderDetail(detailFixture({ state: 'unpublished', publication: null, per: '999', perState: 'provided', perLastProvided: '999' }), 'per');
  assert.doesNotMatch(result.text, /999/);
  assert.match(result.text, /PER/);
  assert.match(result.html, /KOSPI.005930\/pbr/);
});

test('restored ranking distinguishes completed zero, unpublished and replaced results', async () => {
  for (const [snapshot, expected] of [
    [{ items: [], state: 'published', publication, totalCount: 0, totalPages: 0, revisionChanged: false }, '공개된 순위 대상은 0개'],
    [{ items: [], state: 'unpublished', publication: null, totalCount: 0, totalPages: 0, revisionChanged: false }, '아직 공개된 순위가 없습니다'],
    [{ items: [], state: 'published', publication, totalCount: 2, totalPages: 1, revisionChanged: true }, '자료가 갱신되었습니다'],
  ]) {
    const boundary = createBusinessPageLoader({ '@/lib/data/security': { getSecurityRanksPage: async () => snapshot }, '@/lib/data/company': { getCompanyRankingPage: async () => snapshot } });
    const { PublishedRankingPage } = boundary.load('components/published-ranking-page.tsx');
    const result = await boundary.renderElement(await PublishedRankingPage({ metric: 'per' }));
    assert.ok(result.text.includes(expected), expected);
  }
});

test('restored ranking preserves exact values, fallback identities and CSV revision', async () => {
  const snapshot = { items: [{ securityId: 'historical-security', routeCode: null, korName: '예시', currentRank: 1, priorRank: 2, value: '9007199254740993', valueObservedAt: '2026-10-02', prices: [] }], state: 'published', publication, totalCount: 21, totalPages: 2, revisionChanged: false };
  const boundary = createBusinessPageLoader({ '@/lib/data/security': { getSecurityRanksPage: async () => snapshot } });
  const { PublishedRankingPage } = boundary.load('components/published-ranking-page.tsx');
  const { html } = await boundary.renderElement(await PublishedRankingPage({ metric: 'marketcap' }));
  assert.ok(html.includes('9,007,199,254,740,993'));
  assert.ok(html.includes('/security/historical-security/marketcap'));
  assert.ok(html.includes('revision=3'));
  assert.ok(html.includes('/ranking-data/securities-marketcap.csv'));
});

test('restored company missing inputs preserve an absent total and the exclusion reason', async () => {
  const company = { companyId: 'company-1', companyKorName: '예시회사', totalMarketcap: null, totalMarketcapDate: '2026-10-02', state: 'published', publication, marketcapCompleteness: 'missing_input', marketcapRank: null, rankingState: 'excluded', securities: [], registeredHistory: [], aggregatedHistory: [] };
  const boundary = createBusinessPageLoader({
    '@/lib/data/detail-snapshot': { getCompanyDetailSnapshot: async () => ({ company, security: null, companySecs: [], history: [], priceHistory: [], neighbors: [], ranking: { currentRank: null, exclusionReason: 'missing evidence' } }) },
    '@/components/mobile-header-context': { useMobileHeader: () => ({ setContent() {} }) },
  });
  const { RestoredCompanyDetail } = boundary.load('components/restored-detail-page.tsx');
  const result = await boundary.renderElement(await RestoredCompanyDetail({ code: 'company-1' }));
  assert.match(result.text, /합산 자료.*부족/);
  assert.match(result.text, /missing evidence/);
  assert.doesNotMatch(result.text, /0원/);
});
