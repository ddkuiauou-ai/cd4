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

function tableDownload(componentName, props) {
  let download;
  const load = loader({ '@/components/CsvDownloadButton': { CsvDownloadButton: data => {
    download = data;
    return React.createElement('button', null, data.label);
  } } });
  const Component = load('components/detail-investor-records.tsx')[componentName];
  const html = renderToStaticMarkup(React.createElement(Component, { scope: {}, csvStem: 'example', ...props }));
  const doc = JSDOM.fragment(html);
  const columns = [...doc.querySelectorAll('thead th')].map(cell => cell.textContent);
  const labels = [...doc.querySelectorAll('tbody th')].map(cell => cell.firstChild.textContent);
  assert.deepEqual(Object.keys(download.data[0]), columns);
  assert.deepEqual(download.data.map(row => row[columns[0]]), labels);
  return { doc, download, columns };
}

test('both dividend details export exactly the displayed comparison, including genuine zeros, raw precision and matched-day differences', () => {
  for (const metric of ['div', 'dps']) {
    const { doc, download, columns } = tableDownload('DividendTable', { members: [common, preferred], securityId: 'preferred', metric });
    assert.deepEqual(columns, ['종목','주당배당금(원)','배당수익률(%)','종가(원)']);
    assert.deepEqual(download.data.map(row => Object.values(row).slice(1)), [
      ['0','0','100'], ['9007199254740993','0.2','110'], ['9007199254740993','0.2',null],
    ]);
    const difference = doc.querySelector('tr[data-difference]');
    assert.match(difference.textContent, /\+9,007,199,254,740,993원/);
    assert.match(difference.textContent, /\+0\.2%p/);
    assert.equal(difference.lastElementChild.textContent, '—');
    assert.equal(doc.querySelector('tbody tr[data-selected]').querySelector('th').firstChild.textContent, '테스트우');
    assert.match(download.label, /비교표 CSV/);
  }
});

test('the company constituent download preserves its displayed rows, Excel ticker zeros and unrounded market cap', () => {
  const { download, doc } = tableDownload('ConstituentsTable', { members: [{ ...common, marketcap: '9007199254740993' }], showCsv: true });
  assert.equal(download.data[0]['종목코드'], "'000001");
  assert.equal(download.data[0]['시가총액(원)'], '9007199254740993');
  assert.equal(doc.querySelectorAll('tbody tr').length, 1);
  assert.equal(doc.querySelector('tbody td').textContent, '000001');
});

test('valuation comparisons require the multiple, its denominator and the close to have actually been supplied on the same day', () => {
  const { valuationReference } = loader()('components/detail-investor-records.tsx');
  for (const [metric, related] of [['per','eps'],['pbr','bps']]) {
    const history = [
      { date: '2025-10-08', [metric]: '99', [related]: '100', [related + 'State']: 'unsupported' },
      { date: '2025-10-07', [metric]: '2', [related]: '9007199254740993' },
    ];
    const prices = [{ date: '2025-10-08', close: '123' }, { date: '2025-10-07', close: '0' }];
    assert.deepEqual(valuationReference({ metric, currentDate: day, sourceHistory: history, prices }), {
      date: '2025-10-07', metric: '2', related: '9007199254740993', price: '0',
    });
    assert.equal(valuationReference({ metric, currentDate: day, sourceHistory: history, prices: prices.slice(0,1) }), null);
  }
});
