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
    assert.ok(layout.querySelector('.metrics > .leftOutline .outlineLine'));
    assert.ok(layout.querySelector('[data-detail-header-row] [data-detail-title-group] > .metricTitle'));
    assert.ok(layout.querySelector('.summaryHero .headlineRow[data-ranked]'));
    assert.ok(layout.querySelector('.headlineRow[data-compact-summary]'));
    const dividend = metric === 'dps' || metric === 'div';
    assert.equal(layout.querySelectorAll('.valuationPeriods .metricCalculation[data-calculation]').length, 2);
    assert.equal(layout.querySelectorAll('.valuationPeriods .metricCalculation[data-product]').length, metric === 'dps' ? 2 : 0);
    assert.equal(layout.querySelectorAll('.summaryHero .comparisonStrip').length, 1);
    assert.equal(layout.querySelectorAll('.summaryHero .comparisonStrip > span').length, 2);
    assert.equal(layout.querySelectorAll('.securityCard').length, dividend ? 2 : 0);
    assert.equal(Boolean(layout.querySelector('.dividendComparison[data-divider]')), metric === 'dps');
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

test('company overview loads in its own route segment', () => {
  const Loading = loader()('app/company/[secCode]/(basic)/loading.tsx').default;
  const { window } = new JSDOM(renderToStaticMarkup(createElement(Loading)));
  try {
    assert.match(window.document.querySelector('[role="status"]').textContent, /불러오는 중…$/);
    assert.equal(window.document.querySelector('.investor-detail'), null);
  } finally { window.close(); }
});

test('marketcap routes reserve the aggregate, two linked constituents, first trend and annual record', () => {
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
      assert.ok(layout.querySelector('.rail > .facts .railCapTargets'));
      assert.equal(layout.querySelector('.rail > .switcher'), null);
      assert.equal(composition.querySelectorAll('.compositionBranch').length, 2);
      assert.ok(composition.querySelector('.compositionAggregate + .compositionBranches'));
      assert.equal(composition.querySelector('.compositionAggregate > .portionTrack').childElementCount, 0);
      assert.ok(layout.querySelector(`[data-chart="marketcap"][data-marketcap-scope="${scope}"] [data-variant="marketcap"]`));
      const annual = layout.querySelector(`.annual[data-marketcap-scope="${scope}"]`);
      assert.equal(annual.querySelectorAll('.annualRow').length, 5);
      assert.equal(annual.querySelectorAll('.annualDate').length, 6);
      assert.equal(annual.querySelectorAll('.inlineAnnualDate').length, 5);
      assert.ok(annual.closest('.investor-record').previousElementSibling.querySelector('[data-chart="marketcap"]'));
      assert.doesNotMatch(layout.textContent, /[\d%]/);
    } finally {
      dom.window.close();
    }
  }
});
