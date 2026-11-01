const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { loader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');
const { CompanyProfile, CompanyMarketcapOverview, CompanyConstituents } = loader()('components/company-detail-overview.tsx');

const day = '2026-10-08';
function fixture() {
  const common = { securityId: 'common', routeCode: 'KOSPI.005930', name: 'Common', korName: '보통종목', ticker: '005930', exchange: 'KOSPI', type: '보통주', marketcap: '495000000000000', marketcapDate: day, prices: [{date: day, close: '74000', rate: -2.42}] };
  const preferred = { securityId: 'preferred', routeCode: null, name: 'Preferred', korName: '우선종목', ticker: '005935', exchange: 'KOSPI', type: '우선주', marketcap: '54000000000000', marketcapDate: day, prices: [{date: day, close: '60000', rate: 0}] };
  const company = { companyId: 'company', companyKorName: '기업명', companyName: '기업명', company: {name: '기업명', korName: '기업명', homepage: 'javascript:alert(1)'}, state: 'published', marketcapCompleteness: 'complete', compositionComplete: true, compositionReason: null, compositionObservedCount: 2, compositionTargetCount: 2, totalMarketcap: '549000000000000', totalMarketcapDate: day, securities: [common, preferred] };
  return { company, members: [common, preferred], common, preferred };
}
function inspect(Component, props, callback) {
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(Component, props)));
  try { callback(dom.window.document); } finally { dom.window.close(); }
}

test('company profile keeps five fields, hides duplicated English names, and only links HTTP homepages', () => {
  const data = fixture();
  inspect(CompanyProfile, data, doc => {
    assert.equal(doc.querySelectorAll('tbody tr').length, 5);
    assert.deepEqual([...doc.querySelectorAll('td')].map(cell => cell.textContent), ['기업명', '—', '—', '—', '—']);
    assert.equal(doc.querySelectorAll('a').length, 0);
    assert.match(doc.querySelector('.detail-company-scope').textContent, /구성 종목 2개.*보통주 1 · 우선주 1/);
  });
  Object.assign(data.company.company, {name: 'Example Corporation', establishedDate: '1969-01-13', homepage: 'www.example.com'});
  inspect(CompanyProfile, data, doc => {
    assert.equal(doc.querySelector('a').getAttribute('href'), 'https://www.example.com/');
    assert.match(doc.body.textContent, /Example Corporation.*1969-01-13/);
  });
});

test('constituent table uses official marketcap snapshot, exact titles and date/range-aware concrete links', () => {
  const data = fixture();
  data.members = data.members.map(row => ({...row, marketcap: '1', marketcapDate: '2026-10-09'}));
  inspect(CompanyConstituents, {...data, basic: false, start: '2026-07-01', end: day}, doc => {
    const rows = doc.querySelectorAll('tbody tr');
    assert.equal(doc.querySelectorAll('thead th').length, 3);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].querySelectorAll('td')[0].title, '495,000,000,000,000원 · 시가총액 기준 2026-10-08');
    assert.equal(rows[0].querySelector('a').getAttribute('href'), '/security/KOSPI.005930/marketcap?start=2026-07-01&end=2026-10-08');
    assert.equal(rows[1].querySelector('a').getAttribute('href'), '/security/preferred/marketcap?start=2026-07-01&end=2026-10-08');
    assert.match(rows[1].textContent, /60,000원0.00%/);
    assert.match(doc.querySelector('.detail-company-price-gap').textContent, /14,000원 \(18.92%\)/);
    assert.match(doc.querySelector('.detail-company-disclosure').textContent, /우선종목 가격이 보통종목보다 14,000원 낮습니다.*\|우선주 − 보통주\| ÷ 보통주 × 100/);
  });
  inspect(CompanyConstituents, {...data, basic: true}, doc => assert.equal(doc.querySelector('tbody a').getAttribute('href'), '/security/KOSPI.005930'));
});

test('missing latest quotes never fall back to stale values or rates; mismatched dates stay visible', () => {
  const data = fixture();
  data.preferred.prices = [{date: '2026-10-07', close: '60000', rate: -1}, {date: day, close: null, rate: 2}];
  inspect(CompanyConstituents, {...data, basic: true}, doc => {
    const quote = doc.querySelectorAll('tbody tr')[1].querySelectorAll('td')[1];
    assert.equal(quote.textContent, '——2026-10-08');
    assert.equal(doc.querySelector('.detail-company-price-gap strong').textContent, '—');
    assert.match(doc.querySelector('.detail-company-disclosure').textContent, /같은 기준일의 유효한 주가/);
  });
  data.preferred.prices = [{date: '2026-10-07', close: '60000', rate: -1}];
  inspect(CompanyConstituents, {...data, basic: true}, doc => {
    assert.match(doc.querySelectorAll('tbody tr')[1].textContent, /2026-10-07/);
    assert.match(doc.querySelector('.detail-company-disclosure').textContent, /거래 기준일이 달라/);
    assert.doesNotMatch(doc.querySelector('.detail-company-comparison-basis').textContent, /종가 기준/);
  });
});

test('the cap overview retains snapshot guards, distinct rank dates, and readable unpublished reasons', () => {
  const data = fixture();
  const ranking = {currentRank: 1, rankDate: '2026-10-07'};
  inspect(CompanyMarketcapOverview, {...data, ranking}, doc => {
    assert.equal(doc.querySelector('.detail-company-cap-value').title, '549,000,000,000,000원');
    assert.equal(doc.querySelectorAll('.detail-company-composition-segment').length, 2);
    assert.match(doc.querySelector('.detail-company-cap-basis').textContent, /시가총액 기준 2026-10-08 · 순위 기준 2026-10-07/);
  });
  data.company.compositionComplete = false;
  inspect(CompanyMarketcapOverview, {...data, ranking}, doc => {
    assert.equal(doc.querySelectorAll('.detail-company-composition-track').length, 0);
    assert.equal(doc.querySelector('.detail-company-composition-legend dd').textContent, '—');
  });
  data.company.state = 'unpublished';
  inspect(CompanyMarketcapOverview, {...data, ranking: {...ranking, exclusionReason: 'unrecognized_machine_code'}}, doc => {
    assert.equal(doc.querySelector('.detail-company-cap-value').textContent, '—');
    assert.equal(doc.querySelector('.detail-company-cap-rank strong').textContent, '—');
    assert.match(doc.querySelector('[role=status]').textContent, /아직 공개된 기업 합산값이 없습니다/);
    assert.doesNotMatch(doc.body.textContent, /unrecognized_machine_code/);
  });
});

test('empty membership remains explicit and valid supplied identities remain findable', () => {
  inspect(CompanyConstituents, {company: null, members: [], basic: true}, doc => {
    assert.match(doc.body.textContent, /등록된 구성 종목이 없습니다/);
    assert.equal(doc.querySelectorAll('table').length, 0);
  });
  const data = fixture();
  data.members.push({...data.common, securityId: 'another', routeCode: 'KOSPI.000001', korName: '추가종목'});
  inspect(CompanyConstituents, {...data, basic: true}, doc => {
    assert.equal(doc.querySelectorAll('tbody a').length, 3);
    assert.match(doc.body.textContent, /추가종목/);
  });
  inspect(CompanyMarketcapOverview, {...data, ranking: null}, doc => assert.equal(doc.querySelectorAll('.detail-company-composition-segment').length, 2));
});
