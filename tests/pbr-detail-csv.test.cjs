const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const React = require('react');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

// Keep the actual page, PBR transforms and CSV serializer. Substitute only data
// queries and visual children so no database, server or browser is required.
function loadPage(history) {
  const loaded = new Map();
  const visuals = new Map();
  const security = {
    securityId: 'security-1', companyId: null, name: 'Example', korName: '예시종목',
    exchange: 'KOSPI', ticker: '005930', type: '보통주', pbr: 2, bps: null,
    pbrDate: '2026-10-02', prices: [],
  };
  const queries = {
    getSecurityByCode: async () => security,
    getCompanySecurities: async () => [],
    getSecurityMetricsHistory: async () => history,
  };

  function visual(name) {
    if (!visuals.has(name)) visuals.set(name, () => null);
    return visuals.get(name);
  }

  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => {
      if (name === '@/lib/data/security') return queries;
      if (name === '@/lib/data/company') return { getCompanyAggregatedMarketcap: async () => null };
      if (name === '@/lib/data/security-ranking-detail') return {
        getSecurityMetricDetailRanking: async () => ({ currentRank: 1, rankDate: '2026-10-02' }),
      };
      if (name === '@/lib/select') return { getTopSecuritiesWithTypeByMetric: async () => [] };
      if (name === 'next/navigation') return {
        notFound() { throw new Error('Unexpected notFound for a valid PBR history'); },
      };
      if (name === 'next/link') return { __esModule: true, default: visual(name) };
      if ((name.startsWith('@/components/') && name !== '@/components/marketcap/layout')
          || name === 'lucide-react' || name === '@radix-ui/react-icons') {
        return new Proxy({ __esModule: true }, {
          get: (target, key) => key in target ? target[key] : visual(`${name}:${String(key)}`),
        });
      }
      const local = name.startsWith('@/') ? path.join(root, name.slice(2))
        : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
      if (!local) return require(name);
      const resolved = [`${local}.ts`, `${local}.tsx`].find(existsSync);
      assert.ok(resolved, `Local module not found: ${name}`);
      return load(resolved);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }

  return {
    page: load(path.join(root, 'app/security/[secCode]/pbr/page.tsx')).default,
    utils: load(path.join(root, 'lib/pbr-utils.ts')),
    csv: load(path.join(root, 'lib/csv/ranking.ts')),
    visual,
  };
}

function findElements(node, type) {
  const found = [];
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!React.isValidElement(value)) return;
    if (value.type === type) found.push(value);
    visit(value.props.children);
  }
  visit(node);
  return found;
}

test('the actual PBR page exports all eligible history with empty missing BPS, real zero, dates and filename', async () => {
  const history = [
    { date: '2026-10-02', pbr: 2, bps: null },
    { date: new Date('2020-01-02T00:00:00Z'), pbr: 0, bps: 0 },
    { date: '2010-12-31', pbr: 1.5, bps: 2000 },
    { date: '2015-12-31T00:00:00Z', pbr: 1 },
    { date: '2022-12-31', pbr: 3, bps: 12.5 },
    { date: '2021-12-31', pbr: null, bps: 55 },
    { date: '2023-12-31', pbr: 4, bps: -5 },
    { date: '2024-12-31', pbr: 5, bps: 100 },
  ];
  const original = structuredClone(history);
  const { page, csv, visual } = loadPage(history);
  const tree = await page({ params: Promise.resolve({ secCode: 'KOSPI.005930' }) });
  const downloads = findElements(tree, visual('@/components/CsvDownloadButton:CsvDownloadButton'));
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].props.filename, 'KOSPI-005930-pbr-2026-10-02.csv');
  assert.equal(downloads[0].props.data.length, 7);
  assert.equal(csv.serializeCsvRows(downloads[0].props.data), [
    'date,pbr,bps',
    '2010-12-31,1.5,2000',
    '2015-12-31,1,',
    '2020-01-02,0,0',
    '2022-12-31,3,12.5',
    '2023-12-31,4,-5',
    '2024-12-31,5,100',
    '2026-10-02,2,',
  ].join('\n'));
  assert.deepEqual(history, original);

  const charts = findElements(tree, visual('@/components/pbr-chart-with-period-switcher:default'));
  assert.equal(charts.length, 1);
  assert.deepEqual(charts[0].props.initialData.map(row => row.bps), [2000, 0, 0, 12.5, -5, 100, 0]);
});

test('CSV preserves the chart path\'s history eligibility and ordering without inheriting its BPS zero fallback', () => {
  const history = [
    { date: '2026-03-03', pbr: 1, bps: null },
    { date: '2026-03-02', pbr: null, bps: 4 },
    { date: '2026-03-01', pbr: 0, bps: 0 },
  ];
  const { utils, csv } = loadPage(history);
  const chartRows = utils.processPBRData(history);
  const downloadRows = utils.processPBRCsvData(history);
  assert.deepEqual(chartRows, [
    { date: '2026-03-01', value: 0, bps: 0 },
    { date: '2026-03-03', value: 1, bps: 0 },
  ]);
  assert.equal(csv.serializeCsvRows(downloadRows), 'date,pbr,bps\n2026-03-01,0,0\n2026-03-03,1,');
  assert.equal(utils.calculatePBRPeriodAnalysis(chartRows, '예시종목', 'KOSPI').latestPBR, 1);
  assert.deepEqual(utils.processPBRCsvData([]), []);
});
