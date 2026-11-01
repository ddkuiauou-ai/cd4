const assert = require('node:assert/strict');
const test = require('node:test');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');

const storageKey = 'recently-viewed-securities';
const samsung = overrides => ({
  secCode: 'KOSPI.005930', securityId: 'current-id', routeCode: 'KOSPI.005930',
  name: 'Samsung', korName: '삼성전자', ticker: '005930', exchange: 'KOSPI',
  lastViewed: 30, lastMetric: 'pbr', lastPath: '/security/KOSPI.005930/pbr',
  metrics: { pbr: { value: '0', lastViewed: 30 } }, ...overrides,
});

function withStorage(initial, run) {
  let text = JSON.stringify(initial), writes = 0, failWrites = false;
  const values = {
    window: { dispatchEvent() {} },
    localStorage: {
      getItem: () => text,
      setItem: (key, value) => {
        assert.equal(key, storageKey);
        if (failWrites) throw new Error('Storage quota exceeded');
        writes++; text = value;
      },
    },
    StorageEvent: class { constructor(type, data) { Object.assign(this, { type }, data); } },
  };
  const prior = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  try {
    return run(createBusinessPageLoader().load('lib/recent-securities.ts'), {
      stored: () => JSON.parse(text), writes: () => writes,
      failWrites: () => { failWrites = true; },
    });
  } finally {
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test('stored duplicate IDs merge before rendering and keep the latest visit and each metric observation', () => {
  const path = '/security/KOSPI.005930/pbr?period=historical&start=2020-01-01&end=2020-12-31';
  withStorage([
    samsung({ securityId: 'old-id', lastViewed: 10, lastMetric: 'per', metrics: {
      pbr: { value: '9', lastViewed: 10 },
      marketcap: { value: '9007199254740993', lastViewed: 10 },
      per: { value: '-5', lastViewed: 40 },
    } }),
    samsung({ lastPath: path, metrics: {
      pbr: { value: '0', lastViewed: 30 }, per: { value: null, lastViewed: 20 },
      eps: { value: null, lastViewed: 30 },
    } }),
  ], (recent, storage) => {
    const [row, ...remaining] = recent.getRecentlyViewedSecurities();
    assert.deepEqual(remaining, []);
    assert.equal(row.securityId, 'current-id');
    assert.equal(row.lastViewed, 30);
    assert.equal(row.lastMetric, 'pbr');
    assert.equal(row.lastPath, path);
    assert.equal(row.metrics.pbr.value, '0');
    assert.equal(row.metrics.marketcap.value, '9007199254740993');
    assert.equal(row.metrics.per.value, '-5');
    assert.equal(row.metrics.eps.value, null);
    assert.equal(storage.writes(), 0, 'Reading snapshots must not mutate storage during React render');
  });
});

test('repeated visits update one ticker across ID, route alias and market changes', () => withStorage([
  samsung({ securityId: 'old-id', secCode: 'old-id', routeCode: null, exchange: 'KOSDAQ', lastViewed: 10,
    metrics: { marketcap: { value: '9007199254740993', lastViewed: 10 } } }),
], (recent, storage) => {
  const visit = { secCode: 'KOSPI.005930', securityId: 'current-id', routeCode: 'KOSPI.005930',
    name: 'Samsung', korName: '삼성전자', ticker: '005930', exchange: 'KOSPI', lastPath: '/company/KOSPI.005930' };
  recent.addRecentlyViewedSecurity(visit, 'per', '0');
  recent.addRecentlyViewedSecurity({ ...visit, lastPath: '/security/KOSPI.005930/pbr' }, 'pbr', null);
  const rows = storage.stored();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].securityId, 'current-id');
  assert.equal(rows[0].exchange, 'KOSPI');
  assert.equal(rows[0].lastPath, '/security/KOSPI.005930/pbr');
  assert.equal(rows[0].lastMetric, 'pbr');
  assert.equal(rows[0].metrics.marketcap.value, '9007199254740993');
  assert.equal(rows[0].metrics.per.value, '0');
  assert.equal(rows[0].metrics.pbr.value, null);
}));

test('the ten-item limit applies after duplicates are merged and different tickers remain distinct', () => {
  const otherRows = Array.from({ length: 11 }, (_, index) => {
    const ticker = String(index + 1).padStart(6, '0');
    return samsung({ ticker, secCode: `KOSPI.${ticker}`, securityId: `id-${ticker}`, lastViewed: 20 - index });
  });
  withStorage([
    ...Array.from({ length: 11 }, (_, index) => samsung({ securityId: `old-${index}`, lastViewed: 100 - index })),
    ...otherRows,
  ], recent => {
    const rows = recent.getRecentlyViewedSecurities();
    assert.equal(rows.length, 10);
    assert.equal(new Set(rows.map(row => row.ticker)).size, 10);
    assert.deepEqual(rows.map(row => row.ticker), ['005930', ...otherRows.slice(0, 9).map(row => row.ticker)]);
  });
});

test('repair persists legacy duplicates once and snapshots remain stable', () => withStorage([
  samsung(), samsung({ securityId: 'old-id', lastViewed: 10 }),
], (recent, storage) => {
  const before = recent.getRecentSecuritiesSnapshot();
  assert.equal(before.length, 1);
  assert.equal(recent.getRecentSecuritiesSnapshot(), before);
  assert.equal(storage.writes(), 0);
  recent.repairRecentlyViewedSecurities();
  assert.equal(storage.stored().length, 1);
  assert.equal(storage.writes(), 1);
  const after = recent.getRecentSecuritiesSnapshot();
  assert.equal(recent.getRecentSecuritiesSnapshot(), after);
  recent.repairRecentlyViewedSecurities();
  assert.equal(storage.writes(), 1, 'A second sidebar mount must not rewrite already repaired storage');
}));

test('storage write failure still exposes a deduplicated stable snapshot', () => withStorage([
  samsung(), samsung({ securityId: 'old-id', lastViewed: 10 }),
], (recent, storage) => {
  storage.failWrites();
  assert.doesNotThrow(() => recent.repairRecentlyViewedSecurities());
  assert.equal(storage.stored().length, 2, 'Original records survive unavailable writes');
  const rows = recent.getRecentSecuritiesSnapshot();
  assert.equal(rows.length, 1);
  assert.equal(recent.getRecentSecuritiesSnapshot(), rows);
}));

test('a loaded identity inventory restores an obsolete SID and market after local deduplication', () => {
  const query = '?period=historical&start=2020-01-01&end=2020-12-31';
  withStorage([
    samsung({ secCode: 'obsolete-id', securityId: 'obsolete-id', routeCode: null,
      exchange: 'KOSDAQ', lastPath: `/security/obsolete-id/pbr${query}` }),
    samsung({ lastViewed: 10, lastMetric: 'marketcap', lastPath: '/security/KOSPI.005930/marketcap',
      metrics: { marketcap: { value: '9007199254740993', lastViewed: 10 } } }),
  ], (recent, storage) => {
    recent.repairRecentlyViewedSecurities();
    assert.equal(storage.stored().length, 1);
    assert.equal(storage.stored()[0].securityId, 'obsolete-id', 'Local cleanup keeps the newest visit until inventory is available');
    recent.migrateRecentSecurityIdentities([
      { securityId: 'current-id', companyId: 'samsung-company', exchange: 'KOSPI', ticker: '005930', type: '보통주' },
    ]);
    const [row] = storage.stored();
    assert.equal(row.securityId, 'current-id');
    assert.equal(row.secCode, 'KOSPI.005930');
    assert.equal(row.routeCode, 'KOSPI.005930');
    assert.equal(row.lastPath, `/security/KOSPI.005930/pbr${query}`);
    assert.equal(row.lastMetric, 'pbr');
    assert.equal(row.lastViewed, 30);
    assert.equal(row.metrics.pbr.value, '0');
    assert.equal(row.metrics.marketcap.value, '9007199254740993');
  });
});

test('legacy empty tickers fall back to their individual codes for deduplication', () => withStorage([
  samsung({ ticker: '', secCode: 'legacy-code-a', securityId: 'new-a', lastViewed: 30 }),
  samsung({ ticker: '', secCode: 'legacy-code-b', securityId: 'new-b', lastViewed: 20 }),
  samsung({ ticker: '', secCode: 'legacy-code-a', securityId: 'old-a', lastViewed: 10,
    metrics: { per: { value: '-5', lastViewed: 10 } } }),
], (recent, storage) => {
  recent.repairRecentlyViewedSecurities();
  const rows = storage.stored();
  assert.deepEqual(rows.map(row => row.secCode), ['legacy-code-a', 'legacy-code-b']);
  assert.equal(rows[0].securityId, 'new-a');
  assert.equal(rows[0].metrics.pbr.value, '0');
  assert.equal(rows[0].metrics.per.value, '-5');
  assert.equal(rows[1].securityId, 'new-b');
}));

test('two recent sidebars repair storage without fetches or duplicate-key errors and share deletions', async () => {
  const React = require('react');
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3001/' });
  const errors = [];
  let requests = 0, root;
  const values = {
    window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
    StorageEvent: dom.window.StorageEvent, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => { requests++; throw new Error('Recent history must not fetch'); },
  };
  const prior = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const originalError = console.error;
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  console.error = (...args) => errors.push(args.map(String).join(' '));
  try {
    localStorage.setItem(storageKey, JSON.stringify([
      samsung(), samsung({ securityId: 'old-id', lastViewed: 10 }),
      samsung({ secCode: 'KOSPI.000660', securityId: 'hynix-id', ticker: '000660', korName: 'SK하이닉스', lastViewed: 20 }),
    ]));
    const { load } = createBusinessPageLoader();
    const { RecentSecuritiesSidebar } = load('components/recent-securities-sidebar.tsx');
    const { createRoot } = require('react-dom/client');
    root = createRoot(document.getElementById('root'));
    await React.act(async () => root.render(React.createElement(React.StrictMode, null,
      React.createElement(RecentSecuritiesSidebar), React.createElement(RecentSecuritiesSidebar))));
    assert.equal(document.querySelectorAll('.recent-securities li').length, 4);
    assert.equal(JSON.parse(localStorage.getItem(storageKey)).length, 2);
    assert.equal(requests, 0);
    assert.deepEqual(errors, [], 'Both copies must render without duplicate-key or snapshot warnings');

    await React.act(async () => document.querySelector('button[aria-label="삼성전자 최근 기록 삭제"]').click());
    assert.equal(document.querySelectorAll('.recent-securities li').length, 2);
    assert.equal(JSON.parse(localStorage.getItem(storageKey)).length, 1);
    const clear = [...document.querySelectorAll('.recent-securities button')].find(button => button.textContent === '전체 삭제');
    await React.act(async () => clear.click());
    assert.equal(document.querySelectorAll('.recent-securities li').length, 0);
    assert.equal(document.querySelectorAll('.recent-securities').length, 2);
    assert.equal(localStorage.getItem(storageKey), null);
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
