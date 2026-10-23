const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { loader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');
const load = loader();
const { prepareDetailComparison } = load('lib/detail-comparison.ts');
const { DetailComparisonSummary } = load('components/detail-comparison-summary.tsx');

const day = '2026-10-08';
function fixtures() {
  const common = { securityId: 'common', name: 'Common', korName: '삼성전자', ticker: '005930', type: '보통주',
    marketcap: '495000000000000', marketcapDate: day, prices: [{date: day, close: '74000'}] };
  const preferred = { securityId: 'preferred', name: 'Preferred', korName: '삼성전자우', ticker: '005935', type: '우선주',
    marketcap: '54000000000000', marketcapDate: day, prices: [{date: day, close: '60000'}] };
  const company = { state: 'published', marketcapCompleteness: 'complete', compositionComplete: true, compositionReason: null,
    compositionObservedCount: 2, compositionTargetCount: 2, totalMarketcap: '549000000000000', totalMarketcapDate: day,
    securities: [common, preferred] };
  return { common, preferred, company, members: [common, preferred] };
}

test('composition uses the official total and exact arithmetic for marketcaps above safe-integer range', () => {
  const { company, members } = fixtures();
  company.securities[0].marketcap = '900719925474099312345';
  company.securities[1].marketcap = '900719925474099312345';
  company.totalMarketcap = '1801439850948198624690';
  const result = prepareDetailComparison(company, members);
  assert.equal(result.composition.complete, true);
  assert.deepEqual(result.composition.rows.map(row => row.percentage), ['50', '50']);
  company.totalMarketcap = '1801439850948198624691';
  assert.equal(prepareDetailComparison(company, members).composition.complete, false, 'a difference of one must not disappear in Number conversion');
});

test('same-date price differences use exact decimal amounts and the common-stock price denominator', () => {
  const { company, common, preferred, members } = fixtures();
  common.prices = [{ date: day, close: '100.25' }];
  preferred.prices = [{ date: day, close: '80.20' }];
  const { priceComparisons } = prepareDetailComparison(company, members);
  assert.equal(priceComparisons[0].difference, '20.05');
  assert.equal(priceComparisons[0].percent, '20');
  assert.equal(priceComparisons[0].commonPrice, '100.25');
  assert.equal(priceComparisons[0].direction, 'lower');
});

test('a higher preferred price and equal prices are distinct from a discount', () => {
  const { company, common, preferred, members } = fixtures();
  common.prices = [{ date: day, close: '90071992547409930' }];
  preferred.prices = [{ date: day, close: '99079191802150923' }];
  let row = prepareDetailComparison(company, members).priceComparisons[0];
  assert.equal(row.direction, 'higher'); assert.equal(row.difference, '9007199254740993'); assert.equal(row.percent, '10');
  preferred.prices[0].close = common.prices[0].close;
  row = prepareDetailComparison(company, members).priceComparisons[0];
  assert.equal(row.direction, 'same'); assert.equal(row.difference, '0'); assert.equal(row.percent, '0');
});

test('different latest trading days do not fall back to an older shared quote', () => {
  const { company, common, preferred, members } = fixtures();
  common.prices = [{ date: '2026-10-07', close: '72000' }, { date: day, close: '74000' }];
  preferred.prices = [{ date: '2026-10-07', close: '60000' }];
  const row = prepareDetailComparison(company, members).priceComparisons[0];
  assert.equal(row.difference, null); assert.equal(row.percent, null);
  assert.equal(row.commonDate, day); assert.equal(row.date, '2026-10-07');
  assert.match(row.reason, /거래 기준일이 달라/);
});

test('a missing or conflicting newest close is not replaced by an older or duplicate price', () => {
  const { company, common, preferred, members } = fixtures();
  for (const newest of [null, 'invalid', '-1', 'Infinity']) {
    preferred.prices = [{ date: '2026-10-07', close: '60000' }, { date: day, close: newest }];
    assert.equal(prepareDetailComparison(company, members).priceComparisons[0].direction, null);
  }
  common.prices.push({date: day, close: '75000'});
  preferred.prices = [{date: day, close: '60000'}];
  assert.equal(prepareDetailComparison(company, members).priceComparisons[0].direction, null);
});

test('an invalid or missing quote date prevents guessing the latest price from older dated records', () => {
  for (const invalidDate of ['2026-02-30', 'invalid', undefined, new Date('invalid')]) {
    const {company, preferred, members} = fixtures();
    preferred.prices.push({date: invalidDate, close: '60000'});
    const row = prepareDetailComparison(company, members).priceComparisons[0];
    assert.equal(row.date, null); assert.equal(row.direction, null); assert.equal(row.difference, null);
  }
});

test('zero is valid for a constituent and preferred quote, while the common-price denominator must be positive', () => {
  const { company, common, preferred, members } = fixtures();
  preferred.marketcap = '0'; company.totalMarketcap = common.marketcap;
  preferred.prices[0].close = '0';
  let result = prepareDetailComparison(company, members);
  assert.equal(result.composition.rows[1].percentage, '0');
  assert.equal(result.priceComparisons[0].percent, '100');
  assert.equal(result.priceComparisons[0].direction, 'lower');
  for (const invalid of ['0', '-1', null, 'invalid']) {
    common.prices[0].close = invalid;
    result = prepareDetailComparison(company, members);
    assert.equal(result.priceComparisons[0].direction, null);
  }
});

test('partial, unpublished, mismatched-date, zero-total and invalid compositions never become normalized percentages', () => {
  const changes = [
    company => { company.compositionComplete = false; company.compositionObservedCount = 1; },
    company => { company.state = 'unpublished'; },
    company => { company.marketcapCompleteness = 'missing_input'; },
    company => { company.securities[1].marketcapDate = '2026-10-07'; },
    company => { company.totalMarketcapDate = '2026-02-30'; },
    company => { company.totalMarketcap = '0'; },
    company => { company.securities[1].marketcap = null; },
    company => { company.securities[1].marketcap = '-1'; },
    company => { company.compositionTargetCount = 3; },
    company => { company.compositionReason = 'different_total'; company.totalMarketcap = '550000000000000'; },
  ];
  for (const change of changes) {
    const { company, members } = fixtures(); change(company);
    const composition = prepareDetailComparison(company, members).composition;
    assert.equal(composition.complete, false);
    assert.ok(composition.reason); assert.ok(composition.rows.every(row => row.percentage === null));
  }
});

test('composition reads its own official snapshot rather than a newer security-publication value', () => {
  const { company, members } = fixtures();
  const projected = members.map(member => ({...member, marketcap: '1', marketcapDate: '2026-10-09'}));
  const result = prepareDetailComparison(company, projected);
  assert.equal(result.composition.complete, true);
  assert.equal(result.composition.date, day);
  assert.equal(result.composition.rows[0].value, '495000000000000');
  assert.equal(result.composition.rows[0].percentage, '90.16');
});

test('all identities remain distinct with duplicate labels; retired/nonmember rows do not enter price pairing or the denominator', () => {
  const { company, preferred, members } = fixtures();
  const another = {...preferred, securityId: 'preferred-2', marketcap: '0'};
  company.securities.push(another); company.compositionObservedCount = company.compositionTargetCount = 3;
  const retired = {...preferred, securityId: 'retired', marketcap: '999999999999999', prices: [{date: day, close: '1'}]};
  const result = prepareDetailComparison(company, [...members, another, retired]);
  assert.equal(result.composition.complete, true);
  assert.deepEqual(result.composition.rows.map(row => row.securityId), ['common', 'preferred', 'preferred-2', 'retired']);
  assert.equal(result.composition.rows[3].percentage, null);
  assert.deepEqual(result.priceComparisons.map(row => row.securityId), ['preferred', 'preferred-2']);
});

test('duplicate official identity invalidates composition; duplicate caller identities do not double count or produce ambiguous price gaps', () => {
  let { company, preferred, members } = fixtures();
  company.securities = [company.securities[0], preferred, preferred];
  company.compositionTargetCount = company.compositionObservedCount = 3;
  assert.equal(prepareDetailComparison(company, members).composition.complete, false);
  ({company, preferred, members} = fixtures());
  const result = prepareDetailComparison(company, [...members, preferred]);
  assert.equal(result.composition.rows.length, 2);
  assert.equal(result.priceComparisons[0].direction, null);
});

test('multiple or absent common stocks do not pick an arbitrary comparison baseline', () => {
  const { company, common, members } = fixtures();
  const second = {...common, securityId: 'common-2'};
  company.securities.push(second);
  assert.match(prepareDetailComparison(company, [...members, second]).priceComparisons[0].reason, /하나로 확인/);
  assert.match(prepareDetailComparison(company, members.slice(1)).priceComparisons[0].reason, /하나로 확인/);
});

test('rendered summary carries the composition basis, the explicit common-price denominator and the current target without adding controls', () => {
  const { company, members } = fixtures();
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(DetailComparisonSummary, {company, members, selectedSecurityId: 'preferred'})));
  try {
    const doc = dom.window.document;
    assert.match(doc.querySelector('.detail-composition-basis').textContent, /2026-10-08.*549조원 기준/);
    assert.equal(doc.querySelectorAll('.detail-composition-row').length, 2);
    assert.match(doc.querySelector('.detail-composition-row[data-selected="true"]').textContent, /삼성전자우.*9.84%/);
    assert.match(doc.querySelector('.detail-price-gap').textContent, /삼성전자 74,000원 기준/);
    assert.match(doc.querySelector('.detail-price-gap-row').textContent, /14,000원 \(18.92%\) 낮음/);
    assert.match(doc.querySelector('.detail-price-gap').textContent, /\|우선주 − 보통주\| ÷ 보통주 × 100/);
    assert.equal(doc.querySelectorAll('a,button,details').length, 0);
    assert.equal(renderToStaticMarkup(React.createElement(DetailComparisonSummary, {company: null, members})), '');
  } finally {dom.window.close();}
});
