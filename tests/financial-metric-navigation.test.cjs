const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { loader, pageLoader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');

const metrics = [['per', '배'], ['pbr', '배'], ['eps', '원'], ['bps', '원'], ['div', '%'], ['dps', '원']];
const common = { securityId: 'common', routeCode: 'KOSPI.005930', name: 'Common', korName: '삼성전자', ticker: '005930', exchange: 'KOSPI', type: '보통주', marketcap: '100', availableMetrics: ['marketcap', 'per', 'pbr', 'eps', 'bps', 'dps', 'div'] };
const preferred = { ...common, securityId: 'preferred', routeCode: 'KOSPI.005935', name: 'Preferred', korName: '삼성전자우', ticker: '005935', type: '우선주', marketcap: null, availableMetrics: ['marketcap', 'dps', 'div'] };
const company = { companyId: 'company', routeCode: 'KOSPI.005930', state: 'published', totalMarketcap: '100', securities: [common, preferred] };
const range = { start: '2026-09-01', end: '2026-10-01', periodId: 'common-listing-period' };
const documentFor = (Component, props) => new JSDOM(renderToStaticMarkup(React.createElement(Component, props)));

test('one marketcap menu follows the current entity and overview retains its own route', () => {
  const load = loader();
  const { detailNavGroups } = load('components/detail-investor-records.tsx');
  const { DetailInvestorNavigation } = load('components/detail-investor-navigation.tsx');
  for (const [companyPage, basic, security, current] of [
    [true, true, common, '기업 개요'],
    [true, false, common, '시가총액'],
    [false, false, preferred, '시가총액'],
  ]) {
    const groups = detailNavGroups({ company, security, companyPage, basic, metric: 'marketcap', scope: range });
    const dom = documentFor(DetailInvestorNavigation, { groups, name: '삼성전자' });
    try {
      const links = [...dom.window.document.querySelectorAll('nav a')];
      assert.deepEqual(links.slice(0, 2).map(link => link.textContent), ['기업 개요', '시가총액']);
      assert.ok(links.every(link => link.textContent !== '주가·거래'));
      assert.equal(links.filter(link => link.textContent === '시가총액').length, 1);
      assert.deepEqual(links.filter(link => link.getAttribute('aria-current') === 'page').map(link => link.textContent), [current]);
      const [overview, cap] = links.map(link => new URL(link.getAttribute('href'), 'https://example.test'));
      assert.equal(overview.pathname, '/company/KOSPI.005930');
      assert.equal(cap.pathname, companyPage ? '/company/KOSPI.005930/marketcap' : `/security/${security.routeCode}/marketcap`);
      assert.equal(cap.searchParams.get('period'), companyPage ? null : range.periodId);
    } finally { dom.window.close(); }
  }
});

test('the detail menu keeps every metric in order and leaves unavailable items out of keyboard navigation', () => {
  const load = loader();
  const { detailNavGroups } = load('components/detail-investor-records.tsx');
  const { DetailInvestorNavigation } = load('components/detail-investor-navigation.tsx');
  const labels = ['기업 개요', '시가총액', 'PER', 'PBR', 'EPS', 'BPS', '주당배당금', '배당수익률'];
  for (const [companyPage, security, enabled] of [
    [false, common, labels],
    [false, preferred, ['기업 개요', '시가총액', '주당배당금', '배당수익률']],
    [false, { ...preferred, availableMetrics: ['dps'] }, ['기업 개요', '시가총액', '주당배당금']],
    [true, null, ['기업 개요', '시가총액']],
  ]) {
    const groups = detailNavGroups({ company, security, companyPage, basic: false, metric: 'dps', scope: range });
    const dom = documentFor(DetailInvestorNavigation, { groups });
    try {
      const items = [...dom.window.document.querySelectorAll('nav .metricItem')];
      assert.deepEqual(items.map(item => item.textContent), labels);
      assert.deepEqual(items.filter(item => item.hasAttribute('href')).map(item => item.textContent), enabled);
      for (const item of items.filter(item => !enabled.includes(item.textContent))) {
        assert.equal(item.getAttribute('role'), 'link');
        assert.equal(item.getAttribute('aria-disabled'), 'true');
        assert.equal(item.tabIndex, -1);
        assert.equal(dom.window.document.getElementById(item.getAttribute('aria-describedby')).textContent,
          '이 종목은 해당 지표를 제공하지 않아요');
      }
      assert.equal(dom.window.document.querySelector('nav [aria-current="page"]').textContent, companyPage ? '시가총액' : '주당배당금');
    } finally { dom.window.close(); }
  }
});

test('marketcap target links retain the reading chapter and remember the return location', () => {
  const sections = [{ id: 'chart-analysis', label: '추이' }, { id: 'annual-data', label: '연도별 기록' }];
  const aggregate = '/company/KOSPI.005930/marketcap';
  const stock = '/security/KOSPI.005935/marketcap';
  const origin = 'https://example.test';
  const assigned = [];
  const load = loader({
    '@/components/page-navigation': { getReadingSection: targets => targets.find(target => target.id === 'annual-data')?.id },
    react: { ...React, useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    'next/navigation': { useRouter: () => ({ push(href, options) {
      assert.equal(options.scroll, !href.includes('#'));
      assigned.push(origin + href);
    } }) },
  });
  const { DetailSwitchLink } = load('components/detail-investor-navigation.tsx');
  const visits = [];
  const history = { state: { otherState: true }, replaceState(next) { this.state = next; } };
  const location = { href: origin + aggregate, assign: href => assigned.push(href) };
  const globals = {
    window: { location, history, scrollY: 870 },
    document: { getElementById: id => ({ id }) },
    sessionStorage: { setItem: (_, value) => visits.push(JSON.parse(value)) },
  };
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  try {
    const click = (href, securityId, chapters, surface, modifiers = {}) => {
      const disclosure = { open: true, querySelector: () => ({ focus() {} }) };
      let prevented = false;
      const { props } = DetailSwitchLink({ candidate: { href, securityId, selected: false }, sections: chapters });
      props.onClick({
        button: 0, detail: 0, preventDefault: () => { prevented = true; },
        currentTarget: {
          href: origin + props.href,
          closest: selector => surface === 'header' && selector === '[data-detail-cap-title]' ? disclosure
            : surface === 'summary' && selector === '[data-detail-cap-summary]' ? {} : null,
        },
        ...modifiers,
      });
      return { prevented, open: disclosure.open };
    };
    assert.deepEqual(click(stock, 'preferred', sections, 'rail'), { prevented: true, open: true });
    assert.equal(assigned.at(-1), origin + stock + '#annual-data');
    assert.equal(visits.at(-1).destination, stock + '#annual-data');
    assert.deepEqual(history.state.detailPeerReturn, { source: aggregate, scrollTop: 870, focusSecurityId: 'preferred', surface: 'rail' });
    assert.equal(history.state.otherState, true);

    location.href = origin + stock + '?capRange=1Y&priceRange=5Y#annual-data';
    assert.deepEqual(click(aggregate, 'company:company', sections, 'header'), { prevented: true, open: false });
    assert.equal(assigned.at(-1), origin + aggregate + '?capRange=1Y&priceRange=5Y#annual-data');
    assert.equal(history.state.detailPeerReturn.surface, 'header');
    assert.equal(history.state.detailPeerReturn.source, stock + '?capRange=1Y&priceRange=5Y#annual-data');
    assert.equal(click(aggregate, 'company:company', sections, 'header', { metaKey: true }).prevented, false);
    assert.equal(assigned.length, 2);

    // A full card opens its destination from the summary even when returning from an old fragment.
    click(aggregate, 'company:company', [], 'summary');
    assert.equal(assigned.at(-1), origin + aggregate + '?capRange=1Y&priceRange=5Y');
    assert.equal(history.state.detailPeerReturn.surface, 'summary');
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

for (const [metric, unit] of metrics) {
  test(`${metric}: stock selection retains the date window and offers only members that supply this metric`, () => {
    const { detailSwitchCandidates, StockSelection } = loader()('components/detail-investor-records.tsx');
    const candidates = detailSwitchCandidates({ members: [common, preferred], current: common, companyPage: false, basic: false, metric, scope: range });
    const dom = documentFor(StockSelection, { candidates, label: '종목 전환' });
    try {
      const links = [...dom.window.document.querySelectorAll('a')];
      const expected = preferred.availableMetrics.includes(metric) ? [common, preferred] : [common];
      assert.deepEqual(candidates.filter(candidate => candidate.href).map(candidate => candidate.securityId), expected.map(member => member.securityId));
      if (expected.length === 1) {
        assert.equal(links.length, 0, 'a single available security has no switch');
        return;
      }
      assert.equal(links.length, expected.length);
      for (const [i, member] of expected.entries()) {
        const destination = new URL(links[i].href, 'https://example.test');
        assert.equal(destination.pathname, `/security/${member.routeCode}/${metric}`);
        assert.equal(destination.searchParams.get('start'), range.start);
        assert.equal(destination.searchParams.get('end'), range.end);
        assert.equal(destination.searchParams.get('period'), i === 0 ? range.periodId : null);
        assert.equal(links[i].getAttribute('aria-current'), i === 0 ? 'page' : null);
      }
    } finally { dom.window.close(); }
  });

  test(`${metric}: the metric rail marks the destination and scopes the listing period to the same security`, () => {
    const load = loader();
    const { detailNavGroups } = load('components/detail-investor-records.tsx');
    const { DetailInvestorNavigation } = load('components/detail-investor-navigation.tsx');
    const groups = detailNavGroups({ company, security: common, metric, basic: false, companyPage: false, scope: range });
    const dom = documentFor(DetailInvestorNavigation, { groups });
    try {
      const links = [...dom.window.document.querySelectorAll('a')];
      assert.equal(links.length, 8);
      const selected = links.filter(link => link.getAttribute('aria-current') === 'page');
      assert.equal(selected.length, 1);
      assert.equal(new URL(selected[0].href, 'https://example.test').pathname, `/security/${common.routeCode}/${metric}`);
      for (const link of links) {
        const destination = new URL(link.href, 'https://example.test');
        assert.equal(destination.searchParams.get('period'), destination.pathname.startsWith('/company/') ? null : range.periodId);
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
        { securityId: 'peer-before', routeCode: 'KOSPI.000001', ticker: '000001', exchange: 'KOSPI', korName: '이전 종목', currentRank: 6, value: '1.005' },
        { securityId: 'peer-after', routeCode: 'KOSPI.000002', ticker: '000002', exchange: 'KOSPI', korName: '다음 종목', currentRank: 8, value: '0' },
      ],
    });
    const element = await fixture.pages.RestoredSecurityDetail({ code: common.routeCode, metric, search: { start: range.start, end: range.end, period: range.periodId } });
    const dom = new JSDOM(renderToStaticMarkup(element));
    try {
      const links = [...dom.window.document.querySelectorAll('#nearby-ranks nav a')];
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
