const test = require('node:test');
const assert = require('node:assert/strict');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');
const loader = createBusinessPageLoader();
const { compactRankingItems } = loader.load('lib/static-build/compact-ranking.ts');
const { createRankingRows } = loader.load('lib/ranking-view.ts');

test('ranking compaction preserves rendered amounts, nullable routes and official quotes for both scopes', () => {
  const quote = { date: '2026-10-08', close: '9007199254740993', open: '10', rate: '-1.5', volume: '9007199254740995',
    high: '999999999999999999', createdAt: 'unused', securityId: 'unused' };
  const security = { securityId: 'stock', companyId: 'company', name: '기업', korName: '기업우', exchange: 'KOSPI', ticker: '000001',
    type: '우선주', routeCode: null, currentRank: 2, priorRank: 1, value: '-0.000000000001', valueObservedAt: '2026-10-08',
    prices: [quote], rawSource: { large: 'unused'.repeat(1000) } };
  const company = { companyId: 'company', name: '기업', korName: null, routeCode: null,
    marketcap: '90071992547409931234', marketcapRank: 3, marketcapPriorRank: null, marketcapDate: '2026-10-08',
    marketcapCompleteness: 'partial', representativeSecurity: security, securities: [security], prices: [quote] };
  for (const [scope, metric, rows] of [['security', 'per', [security]], ['company', 'marketcap', [company, {...company, representativeSecurity: null, prices: []}]]]) {
    const compact = compactRankingItems(rows, scope);
    assert.deepEqual(createRankingRows(compact, metric, scope), createRankingRows(rows, metric, scope));
    assert.equal(JSON.stringify(compact).includes('rawSource'), false);
    assert.equal(JSON.stringify(compact).includes('createdAt'), false);
  }
});
