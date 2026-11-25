const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../scripts/register-typescript.cjs');
const { serializeMarketCsv } = require('../lib/csv/market.ts');

test('market CSV retains eligible missing results and separates trade, value and rank dates', () => {
  const date = '2026-10-08';
  const first = { securityId: 'one', ticker: '005930', exchange: 'KOSPI', korName: '삼성전자', type: '보통주',
    per: '0', perDate: '2026-10-07', perState: 'provided',
    eps: '1', epsDate: '2026-10-09', epsState: 'provided',
    marketcap: null, marketcapDate: date, marketcapState: 'row_missing',
  };
  const second = { securityId: 'two', ticker: '005935', exchange: 'KOSPI', korName: '삼성전자우' };
  const prices = { securityId: 'one', ticker: '005930', exchange: 'KOSPI', date,
    open: '0', high: '200', low: '0', close: '1', volume: '9007199254740993' };
  const csv = serializeMarketCsv(date, [
    { security: second, current: false, price: { ...prices, date: '2026-10-07' }, ranks: {} },
    { security: first, current: true, price: prices, ranks: {
      per: { rankDate: date, currentRank: 12, rankingState: 'included' },
      eps: { rankDate: '2026-10-07', currentRank: 2, rankingState: 'included' },
      marketcap: { rankDate: date, currentRank: null, rankingState: 'excluded' },
      div: { rankDate: '2026-10-09', currentRank: 5, rankingState: 'included' },
    } },
  ]);
  assert.deepEqual(csv.metadata, { date, rowCount: 2, url: '/downloads/market/2026-10-08.csv' });
  assert.equal(csv.body.charCodeAt(0), 0xfeff);
  const [columns, ...rows] = csv.body.slice(1).split('\n').map(line => line.split(','));
  const [stock, missing] = rows.map(row => Object.fromEntries(columns.map((column, index) => [column, row[index]])));
  assert.deepEqual([stock['종목코드'], stock['시가'], stock['거래량']], ['005930', '0', '9007199254740993']);
  assert.deepEqual([stock['PER 값'], stock['PER 관측일'], stock['PER 종목 순위']], ['0', '2026-10-07', '12']);
  assert.deepEqual([stock['EPS 값'], stock['EPS 상태'], stock['EPS 종목 순위'], stock['EPS 순위 상태']],
    ['', 'future_observation', '', 'stale']);
  assert.deepEqual([stock['시가총액 값'], stock['시가총액 상태'], stock['시가총액 순위 상태']], ['', 'row_missing', 'excluded']);
  assert.deepEqual([stock['배당수익률 순위 기준일'], stock['배당수익률 순위 상태']], ['', 'unpublished']);
  assert.deepEqual([missing['종목코드'], missing['거래일'], missing['거래 상태'], missing['PER 상태']],
    ['005935', '', 'no_observation', 'unpublished']);
  const empty = serializeMarketCsv(date, []);
  assert.equal(empty.metadata.rowCount, 0);
  assert.equal(empty.body, csv.body.split('\n')[0]);
});
