const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { loader, pageLoader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');

const metrics = [['per', '배'], ['pbr', '배'], ['eps', '원'], ['bps', '원'], ['div', '%'], ['dps', '원']];
const tabNames = ['기본 정보', '시가총액', 'PER', 'PBR', 'EPS', 'BPS', '배당수익률', '주당배당금'];
const common = { securityId: 'common', routeCode: 'KOSPI.005930', name: 'Common', korName: '삼성전자', ticker: '005930', exchange: 'KOSPI', type: '보통주', marketcap: '100' };
const preferred = { ...common, securityId: 'preferred', routeCode: 'KOSPI.005935', name: 'Preferred', korName: '삼성전자우', ticker: '005935', type: '우선주', marketcap: null };
const company = { companyId: 'company', routeCode: 'KOSPI.005930', state: 'published', totalMarketcap: '100', securities: [common, preferred] };
const range = { start: '2026-09-01', end: '2026-10-01', periodId: 'common-listing-period' };
const documentFor = (Component, props) => new JSDOM(renderToStaticMarkup(React.createElement(Component, props)));

for (const [metric, unit] of metrics) {
  test(`${metric}: sibling selection retains metric and range, isolates its listing period, and exposes every target`, () => {
    const { DetailEntitySelector } = loader()('components/detail-entity-selector.tsx');
    const dom = documentFor(DetailEntitySelector, { company, companySecs: [common, preferred], security: common, companyPage: false, basic: false, metric, ...range });
    try {
      const doc = dom.window.document;
      const links = [...doc.querySelectorAll('.detail-entity-grid a')];
      assert.equal(links.length, 3);
      assert.deepEqual(links.slice(1).map(link => link.dataset.securityId), ['common', 'preferred']);
      for (const [member, selected] of [[common, true], [preferred, false]]) {
        const link = doc.querySelector(`[data-security-id="${member.securityId}"]`);
        const destination = new URL(link.getAttribute('href'), 'https://example.test');
        assert.equal(destination.pathname, `/security/${member.routeCode}/${metric}`);
        assert.equal(destination.searchParams.get('start'), range.start);
        assert.equal(destination.searchParams.get('end'), range.end);
        assert.equal(destination.searchParams.get('period'), selected ? range.periodId : null);
        assert.equal(link.getAttribute('aria-current'), selected ? 'page' : null);
      }
      assert.match(doc.querySelector('[data-security-id="preferred"]').textContent, /—/);
      const aggregate = new URL(doc.querySelector('.detail-entity-aggregate').getAttribute('href'), 'https://example.test');
      assert.equal(aggregate.pathname, '/company/KOSPI.005930/marketcap');
      assert.equal(aggregate.searchParams.get('start'), range.start);
      assert.equal(aggregate.searchParams.get('period'), null);
      assert.equal(doc.querySelectorAll('select, details, [hidden]').length, 0);
    } finally { dom.window.close(); }
  });

  test(`${metric}: fixed eight tabs retain own episode and date window while only the active metric changes`, () => {
    const { CompanyFinancialTabs } = loader({ 'next/navigation': { usePathname: () => `/security/KOSPI.005930/${metric}/` } })('components/company-financial-tabs.tsx');
    const dom = documentFor(CompanyFinancialTabs, { security: common, company, ...range });
    try {
      const links = [...dom.window.document.querySelectorAll('a')];
      assert.deepEqual(links.map(link => link.textContent), tabNames);
      assert.equal(links.filter(link => link.getAttribute('aria-current') === 'page').length, 1);
      assert.equal(new URL(links.find(link => link.getAttribute('aria-current') === 'page').href, 'https://example.test').pathname, `/security/KOSPI.005930/${metric}`);
      for (const link of links) {
        const destination = new URL(link.getAttribute('href'), 'https://example.test');
        assert.equal(destination.searchParams.get('period'), range.periodId);
        assert.equal(destination.searchParams.get('start'), range.start);
        assert.equal(destination.searchParams.get('end'), range.end);
      }
    } finally { dom.window.close(); }
  });

  test(`${metric}: current summary preserves its unit, real zero and independent quote date`, () => {
    const RankHeader = loader()('components/header-rank.tsx').default;
    for (const value of ['0', undefined]) {
      const dom = documentFor(RankHeader, { marketcap: value, marketcapUnit: unit, marketcapDate: '2025-12-30', price: '262000', priceDate: '2026-10-08', priceRate: 0, rank: 7 });
      try {
        const doc = dom.window.document;
        assert.equal(doc.querySelector('[data-role="metric"] .detail-summary-value').textContent, value === undefined ? '—' : `0${unit}`);
        assert.equal(doc.querySelector('[data-role="metric"] .detail-summary-date').textContent, '지표 기준 2025-12-30');
        assert.equal(doc.querySelector('[data-role="price"] .detail-summary-value').textContent, '262,000원');
        assert.equal(doc.querySelector('[data-role="price"] .detail-summary-date').textContent, '거래 기준 2026-10-08');
        assert.equal(doc.querySelector('[data-role="change"] .detail-summary-value').textContent, '0.00%');
      } finally { dom.window.close(); }
    }
  });
}

test('nearby financial ranks keep the selected metric and date window without carrying another security’s listing period', async () => {
  for (const [metric] of metrics) {
    const fixture = pageLoader({
      security: { ...common, state: 'published', publication: { asOf: '2026-10-08' }, company: null,
        [metric]: '0', [`${metric}State`]: 'provided', [`${metric}Date`]: '2026-10-08', price: null, priceState: 'source_missing' },
      company: null, companySecs: [], history: [], priceHistory: [],
      ranking: { currentRank: 7, rankDate: '2026-10-08' },
      neighbors: [
        { securityId: 'peer-before', routeCode: 'KOSPI.000001', ticker: '000001', exchange: 'KOSPI', korName: '이전 종목', currentRank: 6 },
        { securityId: 'peer-after', routeCode: 'KOSPI.000002', ticker: '000002', exchange: 'KOSPI', korName: '다음 종목', currentRank: 8 },
      ],
    });
    const element = await fixture.pages.RestoredSecurityDetail({ code: common.routeCode, metric, search: { start: range.start, end: range.end, period: range.periodId } });
    const dom = new JSDOM(renderToStaticMarkup(element));
    try {
      const links = [...dom.window.document.querySelectorAll('#nearby-ranks a')];
      assert.equal(links.length, 2, metric);
      for (const link of links) {
        const destination = new URL(link.getAttribute('href'), 'https://example.test');
        assert.match(destination.pathname, new RegExp(`/security/KOSPI\\.00000[12]/${metric}$`));
        assert.equal(destination.searchParams.get('start'), range.start, `${metric} start`);
        assert.equal(destination.searchParams.get('end'), range.end, `${metric} end`);
        assert.equal(destination.searchParams.get('period'), null, `${metric} foreign episode`);
      }
    } finally { dom.window.close(); }
  }
});
