const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');

function createLoader(recharts) {
  const loaded = new Map();
  return function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => {
      if (name === 'recharts' && recharts) return recharts;
      const local = name.startsWith('@/') ? path.join(root, name.slice(2))
        : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
      if (!local) return require(name);
      const resolved = [local, `${local}.ts`, `${local}.tsx`].find(existsSync);
      assert.ok(resolved, `Local module not found: ${name}`);
      return load(resolved);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  };
}

const helpers = createLoader()(path.join(root, 'lib/chart-selection.ts'));
const identities = Object.freeze([
  Object.freeze({ securityId: 'KOSPI.005930', name: '테스트기업', ticker: '005930', type: '보통주' }),
  Object.freeze({ securityId: 'KOSPI.005935', name: '같은기업우', ticker: '005935', type: '우선주' }),
  Object.freeze({ securityId: 'KOSPI.005936', name: '같은기업우', ticker: '005936', type: '우선주' }),
]);
const series = helpers.createMarketcapSeries(identities);
const history = Object.freeze([
  Object.freeze({ date: '2026-10-01', totalMarketcap: 1000,
    securitiesBreakdown: Object.freeze({ 'KOSPI.005930': 700, 'KOSPI.005935': 100, 'KOSPI.005936': 200 }) }),
  Object.freeze({ date: '2026-10-02', totalMarketcap: 1100,
    securitiesBreakdown: Object.freeze({ 'KOSPI.005930': 770, 'KOSPI.005935': 110, 'KOSPI.005936': 220 }) }),
]);
const points = helpers.createMarketcapChartData(history, series);
const chartProps = { data: points, series, format: 'formatNumber', formatTooltip: 'formatNumberTooltip' };
const pieData = identities.map((identity, index) => ({ ...identity, value: [700, 100, 200][index],
  percentage: [70, 10, 20][index] }));

test('same-name preferred securities retain distinct identity, labels and raw values', () => {
  assert.equal(new Set(series.map(item => item.key)).size, 3);
  for (const item of series) assert.ok(!item.key.includes('.'), 'Recharts must not treat an ID as a nested property path');
  assert.match(helpers.getMarketcapSeriesLabel(series[1].key, series), /005935/);
  assert.match(helpers.getMarketcapSeriesLabel(series[2].key, series), /005936/);
  const values = helpers.createMarketcapChartData([
    { date: new Date('2026-10-03T00:00:00Z'), totalMarketcap: -30,
      securitiesBreakdown: { 'KOSPI.005935': 0, 'KOSPI.005936': -30 } },
    { date: '2026-10-04', totalMarketcap: 0,
      securitiesBreakdown: { 'KOSPI.005935': null } },
  ], series);
  assert.equal(values[0].date, '2026-10-03');
  assert.equal(values[0][series[1].key], 0);
  assert.equal(values[0][series[2].key], -30);
  assert.equal(values[0][series[0].key], null);
  assert.equal(values[1][series[1].key], null);
  assert.equal(values[1][series[2].key], null);
  assert.equal(values[0]['총합계'], -30);
  assert.deepEqual(points.map(point => series.map(item => point[item.key])), [[700, 100, 200], [770, 110, 220]]);
});

test('selection follows the exact security ID across order changes and never falls back to all preferred shares', () => {
  for (const ordered of [series, [...series].reverse()]) {
    for (const selected of [identities[2].securityId, identities[1].securityId]) {
      const matches = ordered.filter(item => helpers.isMarketcapSeriesSelected(item.key, ordered, selected, '우선주'));
      assert.deepEqual(matches.map(item => item.securityId), [selected]);
      assert.equal(helpers.isMarketcapSeriesSelected('총합계', ordered, selected), false);
    }
    assert.equal(ordered.filter(item => helpers.isMarketcapSeriesSelected(item.key, ordered, 'missing')).length, 0);
    assert.equal(ordered.filter(item => helpers.isMarketcapSeriesSelected(item.key, ordered, undefined, '우선주')).length, 0);
    assert.equal(helpers.isMarketcapSeriesSelected('총합계', ordered), true);
    assert.equal(helpers.getMarketcapSeriesLabel('총합계', ordered), '전체 시총');
  }
});

for (const filename of ['chart-company-marketcap.tsx', 'chart-marketcap.tsx', 'chart-pie-marketcap.tsx']) {
  test(`${filename}: actual Recharts component preserves the SSR loading boundary without browser globals`, () => {
    assert.equal(typeof window, 'undefined');
    const Chart = createLoader()(path.join(root, 'components', filename)).default;
    const data = filename.includes('pie') ? pieData : points;
    const html = renderToStaticMarkup(React.createElement(Chart, { ...chartProps, data,
      selectedSecurityId: identities[2].securityId, selectedType: '우선주' }));
    assert.match(html, /차트 로딩 중/);
    assert.doesNotMatch(html, /recharts-surface|recharts-line|recharts-pie/);
  });
}

async function withSelectionEnvironment(run) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  const globals = { window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let currentData = [];
  const group = ({ children }) => React.createElement('div', null, children);
  // Exercise the application's hooks, identity decisions, legend and tooltip.
  // Geometry belongs to chart-upgrade.test.cjs; these library boundaries expose
  // the selected Line/Cell props without depending on JSDOM's absent layout.
  const chartBoundary = {
    ResponsiveContainer: group, LineChart: group, PieChart: group, BarChart: group,
    CartesianGrid: () => null, XAxis: () => null, YAxis: () => null,
    usePlotArea: () => null, useYAxisScale: () => () => undefined,
    Line: props => React.createElement('div', { 'data-series-key': props.dataKey,
      'data-stroke-width': props.strokeWidth, 'data-stroke': props.stroke }),
    Bar: () => null,
    Cell: props => React.createElement('div', { 'data-cell-security-id': props.identity,
      'data-fill-opacity': props.fillOpacity }),
    Pie: props => React.createElement('div', null, React.Children.map(props.children,
      (child, index) => React.cloneElement(child, { identity: props.data[index].securityId }))),
    Legend: props => React.createElement('section', { 'data-chart-legend': true }, props.content),
    Tooltip: props => {
      if (!React.isValidElement(props.content)) return null;
      const point = currentData.at(-1);
      const payload = point && !('percentage' in point)
        ? Object.keys(point).filter(key => key !== 'date' && key !== 'value').map(key => ({
          dataKey: key, name: key, value: point[key], color: 'black', payload: point,
        })) : [{ name: point?.name, value: point?.value, payload: point }];
      return React.createElement('section', { 'data-chart-tooltip': true },
        React.cloneElement(props.content, { active: true, payload }));
    },
  };
  const load = createLoader(chartBoundary);
  const { createRoot } = require('react-dom/client');
  const container = dom.window.document.getElementById('root');
  const chartRoot = createRoot(container);
  const render = async (Chart, props) => {
    currentData = props.data;
    await React.act(async () => chartRoot.render(React.createElement(Chart, props)));
  };
  try { await run({ container, render, load }); }
  finally {
    await React.act(async () => chartRoot.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

for (const filename of ['chart-company-marketcap.tsx', 'chart-marketcap.tsx']) {
  test(`${filename}: mounted selection changes one preferred series, preserves both coded legend/tooltip entries, then selects the total`, async () => {
    await withSelectionEnvironment(async ({ container, render, load }) => {
      const Chart = load(path.join(root, 'components', filename)).default;
      const selectedKeys = () => [...container.querySelectorAll('[data-series-key]')]
        .filter(node => Number(node.dataset.strokeWidth) > 1.5).map(node => node.dataset.seriesKey);
      for (const selectedSecurityId of [identities[2].securityId, identities[1].securityId]) {
        await render(Chart, { ...chartProps, selectedSecurityId, selectedType: '우선주' });
        assert.deepEqual(selectedKeys(), [series.find(item => item.securityId === selectedSecurityId).key]);
        const legend = container.querySelector('[data-chart-legend]').textContent;
        const tooltip = container.querySelector('[data-chart-tooltip]').textContent;
        for (const ticker of ['005935', '005936']) {
          assert.ok(legend.includes(ticker), `Legend must distinguish ${ticker}`);
          assert.ok(tooltip.includes(ticker), `Tooltip must retain ${ticker}`);
        }
      }
      const reversed = [...series].reverse();
      await render(Chart, { ...chartProps, series: reversed,
        data: helpers.createMarketcapChartData(history, reversed), selectedSecurityId: identities[2].securityId });
      assert.deepEqual(selectedKeys(), [series[2].key]);
      await render(Chart, { ...chartProps, selectedType: '시가총액 구성' });
      assert.deepEqual(selectedKeys(), ['총합계']);
      await render(Chart, { ...chartProps, data: [] });
      assert.match(container.textContent, /차트 데이터/);
      assert.equal(container.querySelector('[data-series-key]'), null);
      await render(Chart, { ...chartProps, selectedSecurityId: identities[2].securityId });
      assert.deepEqual(selectedKeys(), [series[2].key]);
    });
  });
}

test('pie selection follows security identity across equal names and reordered slices, and leaves company composition neutral', async () => {
  await withSelectionEnvironment(async ({ container, render, load }) => {
    const Chart = load(path.join(root, 'components/chart-pie-marketcap.tsx')).default;
    const selectedIds = () => [...container.querySelectorAll('[data-cell-security-id]')]
      .filter(node => Number(node.dataset.fillOpacity) === 1).map(node => node.dataset.cellSecurityId);
    for (const selectedSecurityId of [identities[2].securityId, identities[1].securityId]) {
      await render(Chart, { data: pieData, selectedSecurityId, selectedType: '우선주' });
      assert.deepEqual(selectedIds(), [selectedSecurityId]);
      const legend = container.querySelector('[aria-label="시가총액 구성 종목"]').textContent;
      for (const ticker of ['005935', '005936']) assert.ok(legend.includes(ticker), `Pie legend must distinguish ${ticker}`);
    }
    await render(Chart, { data: [...pieData].reverse(), selectedSecurityId: identities[2].securityId });
    assert.deepEqual(selectedIds(), [identities[2].securityId]);
    await render(Chart, { data: pieData, selectedType: '시가총액 구성' });
    assert.equal(selectedIds().length, pieData.length);
  });
});
