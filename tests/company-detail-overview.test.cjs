const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { loader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');
const { CompanyProfile, CompanyMarketcapOverview } = loader()('components/company-detail-overview.tsx');

const { ConstituentsTable } = loader()('components/detail-investor-records.tsx');

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

test('the constituent table links exact published amounts to their stock and price histories', () => {
  const data = fixture();
  data.members = data.members.map(row => ({...row, marketcap: '1', marketcapDate: '2026-10-09'}));
  inspect(ConstituentsTable, {...data, scope: {start: '2026-07-01', end: day}, basis: day}, doc => {
    const rows = doc.querySelectorAll('tbody tr');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].cells[2].querySelector('a').title, '495,000,000,000,000원');
    assert.equal(rows[0].cells[2].querySelector('a').getAttribute('href'), '/security/KOSPI.005930/marketcap?start=2026-07-01&end=2026-10-08');
    assert.equal(rows[1].cells[3].querySelector('a').getAttribute('href'), '/security/preferred?start=2026-07-01&end=2026-10-08');
  });
});

test('the constituent table keeps a missing latest close and displays a differing trading date', () => {
  const data = fixture();
  data.preferred.prices = [{date: '2026-10-07', close: '60000'}, {date: day, close: null}];
  inspect(ConstituentsTable, {...data, scope: {}, basis: day}, doc => {
    const cell = doc.querySelectorAll('tbody tr')[1].cells[3];
    assert.equal(cell.textContent, '—');
    assert.equal(cell.querySelector('a'), null);
  });
  data.preferred.prices.pop();
  inspect(ConstituentsTable, {...data, scope: {}, basis: day}, doc => {
    assert.match(doc.querySelectorAll('tbody tr')[1].cells[3].textContent, /60,000원.*2026-10-07/);
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

test('empty membership stays explicit and unlisted rows never enter the company composition', () => {
  inspect(ConstituentsTable, {company: null, members: [], scope: {}}, doc => {
    assert.match(doc.body.textContent, /확인된 구성 종목이 없습니다/);
    assert.equal(doc.querySelectorAll('table').length, 0);
  });
  const data = fixture();
  data.members.push({...data.common, securityId: 'another', routeCode: 'KOSPI.000001'});
  inspect(CompanyMarketcapOverview, {...data, ranking: null}, doc => assert.equal(doc.querySelectorAll('.detail-company-composition-segment').length, 2));
});
