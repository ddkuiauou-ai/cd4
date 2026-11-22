const assert = require('node:assert/strict');
const test = require('node:test');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');

function withRecentStorage(run, initial = []) {
  const key = 'recently-viewed-securities';
  const storage = new Map([[key, JSON.stringify(initial)]]);
  global.window = { dispatchEvent() {} };
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  global.StorageEvent = class { constructor(type, data) { Object.assign(this, { type }, data); } };
  try { return run(createBusinessPageLoader().load('lib/recent-securities.ts'), () => JSON.parse(storage.get(key))); }
  finally { delete global.window; delete global.localStorage; delete global.StorageEvent; }
}

const identity = { securityId: 'relisted-id', companyId: 'company-id', name: 'Infopia', korName: '인포피아', exchange: 'KOSDAQ', ticker: '036220', type: '보통주' };
const period = 'listing-period:ec1669133cafe3d53ceb081f0017e997db599a77969f3609428c610b3ab5291b';
const context = { period, start: '2015-01-01', end: '2016-05-04' };
const record = overrides => ({ ...identity, secCode: 'relisted-id', lastViewed: 20, metrics: { marketcap: { value: null, lastViewed: 20 } }, ...overrides });

test('a historical recent visit restores its listing period and date window after storage and alias migration', () => withRecentStorage((recent, stored) => {
  const path = recent.recentDetailPath('/security/relisted-id/marketcap', context);
  recent.addRecentlyViewedSecurity({ ...identity, secCode: 'relisted-id', lastPath: path }, 'marketcap', null);
  assert.equal(stored()[0].lastPath, path);
  recent.migrateRecentSecurityIdentities([identity]);
  const row = recent.getRecentlyViewedSecurities()[0];
  assert.equal(row.korName, '인포피아');
  assert.equal(row.metrics.marketcap.value, null);
  const destination = new URL(recent.getRecentSecurityPath(row), 'https://example.test');
  assert.equal(destination.pathname, '/security/KOSDAQ.036220/marketcap');
  assert.equal(destination.searchParams.get('period'), period);
  assert.equal(destination.searchParams.get('start'), context.start);
  assert.equal(destination.searchParams.get('end'), context.end);
  assert.equal(stored()[0].lastPath, `${destination.pathname}${destination.search}`);
}));

test('basic, financial and company recent destinations keep their view label and valid range', () => withRecentStorage(recent => {
  for (const [path, label] of [
    ['/security/relisted-id', '주가·거래'],
    ['/security/relisted-id/per', 'PER'],
    ['/security/relisted-id/div', '배당수익률'],
    ['/company/company-id/marketcap', '합산 시가총액'],
    ['/company/company-id', '기업 개요'],
  ]) {
    const destination = recent.recentDetailPath(path, context);
    recent.addRecentlyViewedSecurity({ ...identity, secCode: 'relisted-id', lastPath: destination }, 'marketcap', '0');
    recent.migrateRecentSecurityIdentities([identity]);
    const row = recent.getRecentlyViewedSecurities()[0];
    const href = recent.getRecentSecurityPath(row);
    const url = new URL(href, 'https://example.test');
    assert.deepEqual(recent.getRecentSecurityPreview(row, href), { label });
    assert.equal(url.pathname, path.replace(/relisted-id|company-id/, 'KOSDAQ.036220') + (label === '주가·거래' ? '/marketcap' : ''));
    assert.equal(url.hash, label === '주가·거래' ? '#price-history' : '');
    assert.equal(url.searchParams.get('period'), path.startsWith('/company/') ? null : period);
    assert.equal(url.searchParams.get('start'), context.start);
    assert.equal(url.searchParams.get('end'), context.end);
  }
}));

test('recent preview uses the amount from the visited metric and keeps company and security capitalization separate', () => withRecentStorage(recent => {
  const preview = row => recent.getRecentSecurityPreview(row, recent.getRecentSecurityPath(row));
  const metrics = { marketcap: { value: '93834000000000', lastViewed: 20 }, per: { value: '2', lastViewed: 10 }, pbr: { value: '0', lastViewed: 20 },
    dps: { value: '1668', lastViewed: 20 }, div: { value: '0.75', lastViewed: 20 } };
  assert.deepEqual(preview(record({ lastPath: '/security/relisted-id/marketcap', metrics })), { label: '시가총액', valueText: '시총 93조 8,340억 원' });
  assert.deepEqual(preview(record({ lastPath: '/security/relisted-id/pbr', metrics })), { label: 'PBR', valueText: 'PBR 0배' });
  assert.deepEqual(preview(record({ lastPath: '/security/relisted-id/dps', metrics })), { label: '주당배당금', valueText: '배당금 1,668원' });
  assert.deepEqual(preview(record({ lastPath: '/security/relisted-id/div', metrics })), { label: '배당수익률', valueText: '배당률 0.75%' });
  assert.deepEqual(preview(record({ lastPath: '/security/relisted-id/per', metrics })), { label: 'PER' });
  assert.deepEqual(preview(record({ lastPath: '/company/company-id/marketcap', metrics })), { label: '합산 시가총액' });
  const company = { ...identity, secCode: 'relisted-id', lastPath: '/company/company-id/marketcap', lastCompanyMarketcap: '100000000000000' };
  recent.addRecentlyViewedSecurity(company, 'marketcap', metrics.marketcap.value);
  recent.migrateRecentSecurityIdentities([identity]);
  assert.deepEqual(preview(recent.getRecentlyViewedSecurities()[0]), { label: '합산 시가총액', valueText: '합산 시총 100조 원' });
}));

test('returning to the current listing updates the historical label and clears the old period and range', () => withRecentStorage(recent => {
  recent.addRecentlyViewedSecurity({ ...identity, secCode: 'relisted-id', lastPath: recent.recentDetailPath('/security/relisted-id/marketcap', context) }, 'marketcap', null);
  recent.addRecentlyViewedSecurity({ ...identity, secCode: 'relisted-id', korName: '오상헬스케어', lastPath: '/security/relisted-id/per' }, 'per', '5');
  const rows = recent.getRecentlyViewedSecurities();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].korName, '오상헬스케어');
  assert.equal(recent.getRecentSecurityPath(rows[0]), '/security/relisted-id/per');
  assert.equal(rows[0].lastMetric, 'per');
}));

test('alias deduplication preserves the newest visit context and historical display name', () => withRecentStorage(recent => {
  recent.migrateRecentSecurityIdentities([identity]);
  const rows = recent.getRecentlyViewedSecurities();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].korName, '인포피아');
  assert.equal(new URL(recent.getRecentSecurityPath(rows[0]), 'https://example.test').searchParams.get('period'), period);
  assert.equal(rows[0].metrics.per.value, '5');
}, [
  record({ lastPath: `/security/relisted-id/marketcap?period=${encodeURIComponent(period)}` }),
  record({ secCode: 'KOSDAQ.036220', securityId: undefined, korName: '오상헬스케어', lastViewed: 10, lastPath: '/security/KOSDAQ.036220/per', metrics: { per: { value: '5', lastViewed: 10 } } }),
]));

test('untrusted recent destinations cannot escape the permitted detail routes', () => withRecentStorage((recent, stored) => {
  for (const path of [
    'https://evil.test/security/id', '//evil.test/security/id', 'javascript:alert(1)',
    '/security/../per', '/security/%2e%2e/per', '/security/%2f%2fevil.test/per',
    '/security/id\\evil/per', '/security/id#fragment', '/security/id/unsupported',
    '/security/%E0%A4%A/per', '/security/id?start=2026-01-01?end=2026-02-01',
  ]) {
    recent.addRecentlyViewedSecurity({ ...identity, secCode: 'relisted-id', lastPath: path }, 'marketcap', '0');
    assert.equal(recent.getRecentSecurityPath(recent.getRecentlyViewedSecurities()[0]), '/security/relisted-id/marketcap', path);
    assert.equal(stored()[0].lastPath, '/security/relisted-id/marketcap', path);
  }
}));

test('stored detail queries accept only the validated period and date range', () => withRecentStorage(recent => {
  const destination = path => new URL(recent.getRecentSecurityPath(record({ lastPath: path })), 'https://example.test');
  const safe = destination('/security/id/per/?end=2026-10-08&redirect=https%3A%2F%2Fevil.test&start=2026-09-01&period=old');
  assert.equal(safe.pathname, '/security/id/per');
  assert.deepEqual([...safe.searchParams], [['period', 'old'], ['start', '2026-09-01'], ['end', '2026-10-08']]);
  for (const query of [
    'start=2026-02-30&end=2026-10-08', 'start=2026-10-09&end=2026-10-08',
    'start=2026-01-01&start=2026-02-01&end=2026-10-08', 'end=not-a-date',
  ]) {
    const url = destination(`/security/id/per?period=old&${query}`);
    assert.equal(url.searchParams.get('period'), 'old');
    assert.equal(url.searchParams.get('start'), null);
    assert.equal(url.searchParams.get('end'), null);
  }
  assert.equal(destination('/security/id?period=old&period=new').search, '');
  assert.equal(destination('/security/id?period=%2F%2Fevil.test').search, '');
  assert.equal(destination('/company/id/marketcap?period=old&start=2026-01-01').search, '?start=2026-01-01');
}));

test('loading stored rows sanitizes destinations before any consumer reads them', () => withRecentStorage(recent => {
  const rows = recent.getRecentlyViewedSecurities();
  assert.equal(rows[0].lastPath, '/security/relisted-id/per?period=old&end=2026-10-08');
  assert.equal(rows[1].lastPath, undefined);
}, [
  record({ lastPath: '/security/relisted-id/per?period=old&end=2026-10-08&unknown=discard' }),
  record({ secCode: 'other', securityId: 'other', ticker: '000001', lastViewed: 10, lastPath: '//evil.test/security/id' }),
]));
