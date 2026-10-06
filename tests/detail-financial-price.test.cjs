const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync, existsSync } = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = require('jsdom');

const project = path.resolve(__dirname, '..');

function loadPresentation(metric) {
  const loaded = new Map();
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => {
      if (name === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
      const local = name.startsWith('@/') ? path.join(project, name.slice(2))
        : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
      if (!local) return require(name);
      const resolved = [local, `${local}.ts`, `${local}.tsx`].find(existsSync);
      assert.ok(resolved, `Local module not found: ${name}`);
      return load(resolved);
    };
    mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
  }
  const Component = load(path.join(project, `components/key-metrics-section-${metric.toLowerCase()}.tsx`))
    [`KeyMetricsSection${metric}`];
  return props => renderToStaticMarkup(React.createElement(Component, props));
}

function fixture(metric, security) {
  const prefix = metric.toLowerCase();
  return {
    security,
    [`${prefix}Rank`]: 7,
    [`latest${metric}`]: 90,
    [`${prefix}12Month`]: 60,
    [`${prefix}3Year`]: 40,
    [`${prefix}5Year`]: 20,
    [`${prefix}10Year`]: 10,
    [`${prefix}20Year`]: 5,
    rangeMin: 1, rangeMax: 100,
    result: [{ date: '2026-10-02', value: 90 }],
  };
}

function readCard(html, label) {
  const dom = new JSDOM(html);
  const currentLabel = [...dom.window.document.querySelectorAll('#indicators div')]
    .find(element => element.textContent.trim() === label);
  assert.ok(currentLabel, `Card label not found: ${label}`);
  const elements = [...currentLabel.parentElement.children];
  const result = { value: elements[0].textContent, comparison: elements[1].textContent,
    text: currentLabel.parentElement.textContent };
  dom.window.close();
  return result;
}

for (const metric of ['PER', 'PBR', 'EPS']) {
  const render = loadPresentation(metric);
  test(`${metric} current price preserves stored daily rate and date across sparse, single, zero and missing data`, () => {
    const record = { close: 36_000, rate: 2.13, date: '2026-10-02' };
    const cases = [
      { name: 'sparse earlier close must not become a daily comparison', prices: [record,
        { close: 39_300, rate: 7, date: '2025-09-22' }], value: '36,000원', rate: '+2.13%', date: '2026-10-02' },
      { name: 'one stored record is enough', prices: [record], value: '36,000원', rate: '+2.13%', date: '2026-10-02' },
      { name: 'actual daily zero is not missing', prices: [{ ...record, rate: 0 }], value: '36,000원', rate: '0.00%', date: '2026-10-02' },
      { name: 'actual close zero is not missing', prices: [{ ...record, close: 0, rate: 0 }], value: '0원', rate: '0.00%', date: '2026-10-02' },
      { name: 'negative stored rate', prices: [{ ...record, rate: -1.23 }], value: '36,000원', rate: '-1.23%', date: '2026-10-02' },
      { name: 'null rate has no computed fallback', prices: [{ ...record, rate: null },
        { close: 39_300, rate: 7, date: '2025-09-22' }], value: '36,000원', rate: '—', date: '2026-10-02' },
      { name: 'absent rate has no computed fallback', prices: [{ close: record.close, date: record.date }], value: '36,000원', rate: '—', date: '2026-10-02' },
      { name: 'infinite rate stays missing', prices: [{ ...record, rate: Infinity }], value: '36,000원', rate: '—', date: '2026-10-02' },
      { name: 'NaN rate stays missing', prices: [{ ...record, rate: NaN }], value: '36,000원', rate: '—', date: '2026-10-02' },
      { name: 'no price rows', prices: [], value: '—', rate: '—' },
      { name: 'no price field', value: '—', rate: '—' },
      { name: 'missing close cannot carry a rate', prices: [{ ...record, close: null }], value: '—', rate: '—' },
      { name: 'infinite close cannot carry a rate', prices: [{ ...record, close: Infinity }], value: '—', rate: '—' },
      { name: 'invalid date is honestly unknown', prices: [{ ...record, date: 'invalid' }], value: '36,000원', rate: '+2.13%', unknownDate: true },
    ];
    for (const scenario of cases) {
      const props = fixture(metric, 'prices' in scenario ? { prices: scenario.prices } : {});
      const before = JSON.stringify(props);
      const price = readCard(render(props), '현재 주가');
      assert.equal(price.value, scenario.value, scenario.name);
      assert.equal(price.comparison, `전일 대비${scenario.rate}`, scenario.name);
      assert.doesNotMatch(price.text, /NaN|Infinity|-8\.3|-8\.4/, scenario.name);
      if (scenario.date) assert.ok(price.text.includes(`주가 기준 ${scenario.date}`), scenario.name);
      else if (scenario.unknownDate) assert.match(price.text, /주가 기준일 미등록/, scenario.name);
      else assert.doesNotMatch(price.text, /주가 기준/, scenario.name);
      assert.equal(JSON.stringify(props), before, `${scenario.name}: presentation must not mutate records`);
    }
  });

  test(`${metric} financial comparisons identify their actual average targets without changing the calculations`, () => {
    const props = fixture(metric, { prices: [] });
    const html = render(props);
    for (const [label, current, previous, comparisonLabel] of [
      [`현재 ${metric}`, 90, 60, '12개월 평균'],
      ['12개월 평균', 60, 40, '3년 평균'],
      ['3년 평균', 40, 20, '5년 평균'],
      ['5년 평균', 20, 10, '10년 평균'],
      ['10년 평균', 10, 5, '20년 평균'],
    ]) {
      const expectedRate = `+${(((current - previous) / previous) * 100).toFixed(1)}%`;
      assert.equal(readCard(html, label).comparison, `${expectedRate}${comparisonLabel} 대비`, label);
    }
    const prefix = metric.toLowerCase();
    props[`latest${metric}`] = -40;
    props[`${prefix}12Month`] = -20;
    assert.equal(readCard(render(props), `현재 ${metric}`).comparison, '+100.0%12개월 평균 대비',
      'existing signed financial denominator policy remains unchanged');
    props[`${prefix}12Month`] = 0;
    assert.equal(readCard(render(props), `현재 ${metric}`).comparison, '—12개월 평균 대비',
      'existing zero denominator policy remains unchanged');
  });
}
