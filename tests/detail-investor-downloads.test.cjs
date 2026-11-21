const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { loader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');

const day = '2026-10-08';
const common = { securityId: 'common', korName: '테스트', ticker: '000001', type: '보통주',
  dps: '0', div: '0', price: '100', dpsDate: day, divDate: day, priceDate: day, priceState: 'provided' };
const preferred = { ...common, securityId: 'preferred', korName: '테스트우', ticker: '000002', type: '우선주',
  dps: '9007199254740993', div: '0.2', price: '110', priceDate: '2026-10-07' };

function comparisonDownload(componentName, props) {
  let download;
  const load = loader({ '@/components/CsvDownloadButton': { CsvDownloadButton: data => {
    download = data;
    return React.createElement('button', null, data.label);
  } } });
  const records = load('components/detail-investor-records.tsx');
  const { members, metric, securityId, scope = {} } = props;
  const current = members.find(member => member.securityId === securityId) ?? null;
  const candidates = metric ? records.detailSwitchCandidates({ members, current, metric, scope, basic: false, companyPage: false }) : undefined;
  const html = renderToStaticMarkup(React.createElement(records[componentName], { scope, csvStem: 'example', candidates, ...props }));
  const doc = JSDOM.fragment(html);
  const columns = Object.keys(download.data[0]);
  return { doc, download, columns };
}

test('both dividend details export exactly the displayed comparison, including genuine zeros, raw precision and matched-day differences', () => {
  for (const metric of ['div', 'dps']) {
    const { doc, download, columns } = comparisonDownload('DividendTable', { members: [common, preferred], securityId: 'preferred', metric });
    assert.deepEqual(columns, ['종목','주당배당금(원)','배당수익률(%)','종가(원)']);
    const cards = [...doc.querySelectorAll('.securityCard')];
    assert.deepEqual(cards.map(card => card.querySelector('.cardIdentity strong').textContent), download.data.slice(0, 2).map(row => row.종목));
    assert.deepEqual([...cards[0].querySelectorAll('dt')].map(cell => cell.textContent), ['주당배당금','배당수익률','종가']);
    assert.deepEqual(download.data.map(row => Object.values(row).slice(1)), [
      ['0','0','100'], ['9007199254740993','0.2','110'], ['9007199254740993','0.2',null],
    ]);
    const difference = doc.querySelector('.difference');
    assert.equal(difference.querySelector('h3').textContent, download.data.at(-1).종목);
    assert.match(difference.textContent, /\+9,007,199,254,740,993원/);
    assert.match(difference.textContent, /\+0\.2%p/);
    assert.deepEqual([...difference.querySelectorAll('dd')].map(cell => cell.textContent),
      ['+9,007,199,254,740,993원' + day, '+0.2%p' + day, '—']);
    assert.equal(doc.querySelector('.securityCard[data-selected] a[aria-current="page"] strong').textContent, '테스트우');
    assert.deepEqual([...doc.querySelectorAll('dd[data-emphasis]')].map(cell => cell.previousElementSibling.textContent),
      Array(2).fill(metric === 'dps' ? '주당배당금' : '배당수익률'));
    assert.match(download.label, /비교표 CSV/);
  }
});

test('dividend cards round prices and preserve tiny yield differences while CSV keeps raw values', () => {
  const members = [common, { ...preferred, dps: '12.75', div: '-0.00412', price: '110.49', priceDate: day }];
  const { doc, download } = comparisonDownload('DividendTable', { members, securityId: 'preferred', metric: 'div', basis: day });
  const display = node => [...node.querySelectorAll('dd')].map(cell => cell.textContent);
  assert.deepEqual(display(doc.querySelector('.securityCard[data-selected]')), ['13원', '−0.004%', '110원']);
  assert.deepEqual(display(doc.querySelector('.difference')), ['+13원', '−0.004%p', '+10원']);
  assert.deepEqual(download.data.slice(1).map(row => Object.values(row).slice(1)), [
    ['12.75', '-0.00412', '110.49'], ['12.75', '-0.00412', '10.49'],
  ]);
});

test('dividend card navigation requires two eligible identities and never nests or carries a foreign listing period', () => {
  const third = { ...preferred, securityId: 'third', ticker: '000003', availableMetrics: ['div'] };
  const scope = { start: '2026-10-08', periodId: 'preferred-period' };
  const metric = 'dps';
  const { doc, download } = comparisonDownload('DividendTable', { members: [common, preferred, third], securityId: 'preferred', metric, scope });
  const [commonCard, preferredCard, thirdCard] = doc.querySelectorAll('.securityCard');
  assert.match(commonCard.querySelector('.cardSelect').getAttribute('href'), /\/dps\?start=2026-10-08$/);
  assert.match(preferredCard.querySelector('.cardSelect').getAttribute('href'), /period=preferred-period/);
  assert.equal(thirdCard.querySelector('.cardSelect'), null);
  assert.equal(thirdCard.querySelector('[aria-disabled]').getAttribute('aria-disabled'), 'true');
  assert.match(thirdCard.textContent, /9,007,199,254,740,993원/);
  assert.equal(download.data[2]['주당배당금(원)'], '9007199254740993');
  assert.equal(doc.querySelector('a a'), null);
  assert.equal(commonCard.querySelector('dd a').getAttribute('href'), '/security/common?start=2026-10-08');
  const single = comparisonDownload('DividendTable', { members: [preferred, third], securityId: 'preferred', metric, scope }).doc;
  assert.equal(single.querySelector('.cardSelect'), null);
  assert.equal(single.querySelectorAll('dd a').length, 2);
});

test('dividend comparison names the actual scope and retains the single security information CSV', () => {
  const metric = 'div';
  const one = comparisonDownload('DividendTable', { members: [preferred], securityId: 'preferred', metric });
  assert.equal(one.doc.querySelector('h2').textContent, '종목 배당 정보');
  assert.equal(one.download.label, '종목 배당 정보 CSV');
  assert.equal(one.doc.querySelectorAll('a').length, 1);
  assert.equal(one.download.data.length, 1);
  const two = comparisonDownload('DividendTable', { members: [{ ...common, type: '우선주' }, preferred], securityId: 'preferred', metric });
  assert.equal(two.doc.querySelector('h2').textContent, '구성 종목 배당 비교');
  assert.equal(two.download.data.length, 2);
  assert.equal(two.doc.querySelector('.difference'), null);
});

test('the company constituent download preserves its displayed rows, Excel ticker zeros and unrounded market cap', () => {
  const { download, doc, columns } = comparisonDownload('ConstituentsTable', { members: [{ ...common, marketcap: '9007199254740993' }], showCsv: true });
  assert.deepEqual(columns, [...doc.querySelectorAll('thead th')].map(cell => cell.textContent));
  assert.equal(doc.querySelector('tbody th').firstChild.textContent, download.data[0].종목);
  assert.equal(download.data[0]['종목코드'], "'000001");
  assert.equal(download.data[0]['시가총액(원)'], '9007199254740993');
  assert.equal(doc.querySelectorAll('tbody tr').length, 1);
  assert.equal(doc.querySelector('tbody td').textContent, '000001');
});

test('PBR comparison uses independent same-day component cells while PER retains its same-day complete sample', () => {
  const { valuationReference } = loader()('components/detail-investor-records.tsx');
  for (const [metric, related] of [['per','eps'],['pbr','bps']]) {
    const history = [
      { date: '2025-10-08', [metric]: '99', [related]: '100', [related + 'State']: 'unsupported' },
      { date: '2025-10-07', [metric]: '2', [related]: '9007199254740993' },
    ];
    const prices = [{ date: '2025-10-08', close: '123' }, { date: '2025-10-07', close: '0' }];
    assert.deepEqual(valuationReference({ metric, currentDate: day, sourceHistory: history, prices }), metric === 'pbr'
      ? { date: '2025-10-08', metric: '99', related: null, price: '123' }
      : { date: '2025-10-07', metric: '2', related: '9007199254740993', price: '0' });
    assert.deepEqual(valuationReference({ metric, currentDate: day, sourceHistory: history.slice(1), prices: prices.slice(0,1) }),
      metric === 'pbr' ? { date: '2025-10-07', metric: '2', related: '9007199254740993', price: null } : null);
  }
});
