const assert = require('node:assert/strict');
const React = require('react');
const { JSDOM } = require('jsdom');
const { loader, renderToStaticMarkup } = require('./detail-presentation-loader.cjs');

const publication = { asOf: '2026-10-08', revision: '7', scopeKey: 'krx-all' };
const common = {
  securityId: 'common', routeCode: 'KOSPI.005930', name: 'Samsung', korName: '삼성전자',
  ticker: '005930', exchange: 'KOSPI', type: '보통주',
  marketcap: '495000000000000', marketcapDate: publication.asOf, per: '18.5',
  prices: [{ close: '74000', rate: 0, date: publication.asOf }],
};
const preferred = {
  ...common, securityId: 'preferred', routeCode: 'KOSPI.005935', korName: '삼성전자우',
  ticker: '005935', type: '우선주', marketcap: '54000000000000', per: null,
};
const company = {
  companyId: 'samsung', routeCode: common.routeCode, companyName: 'Samsung', companyKorName: '삼성전자',
  state: 'published', marketcapRank: 1, totalMarketcap: '549000000000000', totalMarketcapDate: publication.asOf,
  publication, company: { name: 'Samsung', korName: '삼성전자' }, securities: [common, preferred],
  aggregatedHistory: [], registeredHistory: [],
};
const selectorProps = {
  company, companySecs: company.securities, security: common, companyPage: false, basic: false, metric: 'marketcap',
};
function primaryDetailProps(overrides = {}) {
  return {
    ...selectorProps,
    security: {
      ...common, state: 'published', marketcapState: 'provided', price: '74000', priceState: 'provided',
      priceDate: publication.asOf, publication, company: company.company,
    },
    search: {}, ranking: { currentRank: 1, rankDate: publication.asOf },
    neighbors: [], history: [], sourceHistory: [], prices: common.prices,
    ...overrides,
  };
}

const empty = () => null;
const chartBoundary = ({ children }) => children;

function loadFor(pathname, extra = {}) {
  return loader({
    'next/navigation': { usePathname: () => pathname },
    '@/components/recent-security-tracker': { RecentSecurityTracker: empty },
    '@/components/recent-securities-sidebar': { RecentSecuritiesSidebar: empty },
    '@/components/page-navigation': {
      PageNavigation: ({ sections }) => React.createElement('nav', { 'aria-label': '본문 목차' },
        sections.map(({ id, label }) => React.createElement('a', { key: id, href: '#' + id }, label))),
    },
    '@/components/interactive-chart-section': { InteractiveChartSection: empty },
    '@/components/detail-history-chart': {
      DetailHistoryChart: ({ withStatistics }) => withStatistics
        ? React.createElement('aside', { id: 'trend-statistics' }, '표시 관측 통계') : null,
    },
    '@/components/restored-detail-charts': {
      ChartWhenVisible: chartBoundary, DividendComparisonChart: empty, DetailFinancialAnalysis: empty,
      DetailPriceHistory: empty, DetailAnnualHistory: empty,
    },
    '@/components/card-company-marketcap': { __esModule: true, default: empty },
    '@/components/share-button': { __esModule: true, default: empty },
    '@/components/CsvDownloadButton': { CsvDownloadButton: ({ label }) => React.createElement('button', null, label) },
    ...extra,
  });
}

function documentFor(Component, props) {
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(Component, props)));
  return { document: dom.window.document, close: () => dom.window.close() };
}

function assertOrder(doc, selectors) {
  let previous;
  for (const selector of selectors) {
    const node = doc.querySelector(selector);
    assert.ok(node, selector);
    if (previous) assert.ok(previous.compareDocumentPosition(node) & doc.defaultView.Node.DOCUMENT_POSITION_FOLLOWING, selector);
    previous = node;
  }
}

module.exports = {
  assertOrder, publication, common, preferred, company, empty, chartBoundary,
  loadFor, documentFor, selectorProps, primaryDetailProps,
};
