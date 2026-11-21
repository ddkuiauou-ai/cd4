const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { createElement } = require('react');
const { JSDOM } = require('jsdom');
const { loader, renderToStaticMarkup } = require('./helpers/detail-presentation-loader.cjs');

test('metric route fallbacks reserve their summary and first chart with one accessible status', () => {
  const load = loader();
  for (const [metric, label, chart] of [
    ['per', 'PER', 'per'],
    ['pbr', 'PBR', 'pbr'],
    ['eps', 'EPS', 'eps'],
    ['bps', 'BPS', 'bps'],
    ['dps', '주당배당금', 'dps'],
    ['div', '배당수익률', 'comparison'],
  ]) {
    const Loading = load(`app/security/[secCode]/${metric}/loading.tsx`).default;
    const { document } = new JSDOM(renderToStaticMarkup(createElement(Loading))).window;
    const statuses = [...document.querySelectorAll('[role="status"]')];
    assert.equal(statuses.length, 1);
    assert.equal(statuses[0].textContent, `${label} 상세 정보를 불러오는 중…`);
    assert.equal(statuses[0].closest('[aria-hidden="true"]'), null);
    assert.equal(document.querySelectorAll('a, button, input, select, [tabindex], svg').length, 0);
    const layout = document.querySelector('.investor-detail[aria-hidden="true"]');
    assert.ok(layout.querySelector('.metrics + .investor-content + .rail'));
    assert.ok(layout.querySelector('.summaryHero .headlineRow[data-ranked]'));
    const valuation = metric === 'per' || metric === 'pbr';
    const related = metric === 'eps' || metric === 'bps';
    const dividend = metric === 'dps' || metric === 'div';
    assert.equal(layout.querySelectorAll('.valuationTable tr').length, valuation ? 3 : 0);
    assert.equal(layout.querySelectorAll('.relatedSummary dt').length, related ? 2 : 0);
    assert.equal(layout.querySelectorAll('.summaryHero .comparisonStrip').length, 1);
    assert.equal(layout.querySelectorAll('.summaryHero .comparisonStrip .reference > span').length, related ? 3 : 0);
    assert.equal(layout.querySelectorAll('.securityCard').length, dividend ? 2 : 0);
    assert.ok(layout.querySelector(`.investor-record [data-variant="${chart}"]`));
    assert.equal(layout.querySelectorAll('.controls > span').length, chart === 'comparison' ? 0 : metric === 'bps' || metric === 'dps' ? 1 : 2);
    assert.equal(layout.querySelectorAll('.yearEndResult + [data-variant="bps"]').length, metric === 'bps' ? 1 : 0);
    assert.equal(layout.textContent, '');
  }
});

test('no shared detail loading boundary precedes the route-specific fallbacks', () => {
  for (const route of ['app/company', 'app/company/[secCode]', 'app/security', 'app/security/[secCode]']) {
    for (const extension of ['js', 'jsx', 'ts', 'tsx']) {
      assert.equal(existsSync(resolve(__dirname, '..', route, `loading.${extension}`)), false);
    }
  }
});

test('company overview and stock trade routes keep their existing fallbacks in their own segment', () => {
  const load = loader();
  for (const scope of ['company', 'security']) {
    const Loading = load(`app/${scope}/[secCode]/(basic)/loading.tsx`).default;
    const { document } = new JSDOM(renderToStaticMarkup(createElement(Loading))).window;
    assert.match(document.querySelector('[role="status"]').textContent, /불러오는 중…$/);
    assert.equal(document.querySelector('.investor-detail'), null);
  }
});

test('marketcap routes reserve the two member cards, full-width aggregate, first trend and annual record', () => {
  const load = loader();
  for (const [scope, label] of [['company', '기업 합산 시가총액'], ['security', '종목 시가총액']]) {
    const Loading = load(`app/${scope}/[secCode]/marketcap/loading.tsx`).default;
    const dom = new JSDOM(renderToStaticMarkup(createElement(Loading)));
    try {
      const { document } = dom.window;
      const statuses = [...document.querySelectorAll('[role="status"]')];
      assert.equal(statuses.length, 1);
      assert.equal(statuses[0].textContent, `${label} 상세 정보를 불러오는 중…`);
      assert.equal(statuses[0].closest('[aria-hidden="true"]'), null);
      assert.equal(document.querySelectorAll('a, button, input, select, [tabindex], svg').length, 0);
      const layout = document.querySelector('.investor-detail[aria-hidden="true"]');
      assert.ok(layout.querySelector('.metrics + .investor-content + .rail'));
      const composition = layout.querySelector('#current-overview .marketcapComposition');
      assert.equal(composition.querySelectorAll('.securityCard').length, 2);
      assert.ok(composition.querySelector('.securityCards + .compositionJoin + .aggregateCard'));
      assert.equal(composition.querySelector('.portionTrack').childElementCount, 0);
      assert.ok(layout.querySelector(`[data-chart="marketcap"][data-marketcap-scope="${scope}"] [data-variant="marketcap"]`));
      const annual = layout.querySelector(`.annual[data-marketcap-scope="${scope}"]`);
      assert.equal(annual.querySelectorAll('.annualRow').length, 5);
      assert.ok(annual.closest('.investor-record').previousElementSibling.querySelector('[data-chart="marketcap"]'));
      assert.doesNotMatch(layout.textContent, /[\d%]/);
    } finally {
      dom.window.close();
    }
  }
});
