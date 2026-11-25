// Build the actual PER routes against a frozen publication in an isolated Next workspace.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { syncWorkspace } = require('./build-static.cjs');
const { ROOT, STAGE, runtimeInfo, writeJson } = require('./static-tools.cjs');
const { createStaticAssetWriter } = require('./static-asset-writer.cjs');
const { createHistoryPackIndex, INDEX, PAIRS, pairKey } = require('./prepare-static-detail-history-packs.cjs');
const { cacheHeaders } = require('./finalize-static.cjs');
require('./register-typescript.cjs');
const { decodeStaticTable, combineStaticMetricRows } = require('../lib/static-data.ts');

const { arenaEntry, historicalRepresentative, scoreArena } = require('../lib/dashboard-arena.ts');
const { createRankingRows } = require('../lib/ranking-view.ts');
const { readPrivateJsonText } = require('../lib/static-build/read-private-json.ts');
const { listedSecurityPeriods } = require('../lib/data/listed-security-periods.ts');
const directory = path.resolve(process.env.PER_PILOT_DIR || path.join(STAGE, 'per-pilot'));
const frozen = path.resolve(process.env.PER_PILOT_SOURCE || STAGE);
const workspace = path.join(directory, 'workspace');
const input = path.join(directory, 'input');
const read = file => JSON.parse(readPrivateJsonText(file));
const perCode = 'KOSPI.005930';
const allDetailPacks = process.env.PER_PILOT_ALL_DETAIL_PACKS === '1';
const baseCodes = [perCode, 'KOSPI.005935', 'KOSPI.000660',
  ...(allDetailPacks ? ['KOSDAQ.036220', 'KOSDAQ.092040', 'KONEX.0070X0'] : [])];
const marketSource = process.env.PER_PILOT_MARKET_DIR;
const arenaSource = process.env.PER_PILOT_ARENA_FILE;
const seedOnly = process.env.PER_PILOT_SEED_ONLY === '1';
const detailMetrics = ['per', 'pbr', 'eps', 'bps', 'div', 'dps', 'marketcap'];

function makePerPacks(security, cutoff, publicDir) {
  const table = url => decodeStaticTable(read(path.join(frozen, 'assets', url)));
  const values = combineStaticMetricRows(table(security.assets.metrics.per), table(security.assets.metrics.eps), 'eps');
  const writer = createStaticAssetWriter(publicDir);
  const yearStart = cutoff.slice(0, 4) + '-01-01';
  function split(rows, columns) {
    const archive = [], current = [];
    let previous;
    for (const row of [...rows].sort((left, right) => left.date.localeCompare(right.date))) {
      if (row.date > cutoff) continue;
      if (row.date === previous) throw new Error('Duplicate trading date: ' + row.date);
      previous = row.date;
      const bucket = row.date < yearStart ? archive : current;
      bucket.push(columns.map(column => row[column] ?? null));
    }
    const write = rows => writer.write({ schemaVersion: 1, columns, rows });
    return { archive: write(archive), current: write(current), currentStart: yearStart };
  }
  const priceTable = read(path.join(frozen, 'assets', security.assets.prices));
  return {
    metric: split(values, ['date', 'per', 'perState', 'eps', 'epsState']),
    prices: split(decodeStaticTable(priceTable), priceTable.columns),
  };
}

function rankingManifest(scope, metric) { return read(path.join(frozen, 'rankings', `${scope}-${metric}.json`)); }

function cohortForArena(cutoff, history) {
  const page = url => read(path.join(frozen, 'assets', url)).items;
  const company = rankingManifest('company', 'marketcap').scopes['krx-all'];
  const firstCompanies = createRankingRows(page(company.pages['1']), 'marketcap', 'company');
  const rankings = Object.fromEntries(detailMetrics.map(metric => {
    const entry = rankingManifest('security', metric).scopes['krx-all'];
    const rows = Object.values(entry.pages).flatMap(url => createRankingRows(page(url), metric, 'security').map(arenaEntry).filter(Boolean));
    return [metric, { date: entry.publication?.asOf, rows }];
  }));
  const ids = new Set([
    ...firstCompanies.map(row => row.securityId),
    ...Object.values(rankings).flatMap(ranking => ranking.rows.slice(0, 3).map(row => row.id)),
    ...Object.values(history.leaders).map(group => historicalRepresentative(group.entries)?.id),
    ...scoreArena(rankings, cutoff).scores.map(row => row.entry.id),
  ].filter(Boolean));
  const companies = firstCompanies.map(row => row.href?.split('/')[2]).filter(Boolean);
  return { ids, companies };
}

function build() {
  runtimeInfo({ enforce: true });
  const manifest = read(path.join(frozen, 'manifest.json'));
  const identities = read(path.join(frozen, 'identities.json'));
  const seed = baseCodes.map(code => identities.find(row => row.routeCode === code));
  const cutoff = manifest.sourcePublications?.['security_latest/krx-all']?.asOf;
  if (seed.some(identity => !identity) || !cutoff) throw new Error('시범 종목과 공개 기준일이 있는 정적 빌드 입력이 필요합니다.');
  if (Boolean(marketSource) !== Boolean(arenaSource)) throw new Error('Set both PER_PILOT_MARKET_DIR and PER_PILOT_ARENA_FILE for the rankings and arena preview.');
  const marketCsv = marketSource && read(path.join(marketSource, 'market-csv.json'));
  const arena = arenaSource && read(arenaSource);
  const arenaCohort = arena && !seedOnly ? cohortForArena(cutoff, arena) : undefined;
  if (arena && rankingManifest('company', 'marketcap').scopes['krx-all'].publication?.asOf !== arena.anchor) {
    throw new Error('Arena snapshot anchor does not match published company ranking');
  }
  if (marketCsv && marketCsv.date !== cutoff) throw new Error('Market CSV date does not match the pilot baseline');
  const cohort = [...seed, ...identities.filter(identity => arenaCohort?.ids.has(identity.securityId) && !seed.includes(identity))];
  const securityCodes = cohort.map(identity => identity.routeCode);

  const stocks = cohort.map(identity => read(path.join(frozen, 'data/security', identity.securityId + '.json')));
  const companyCodes = [...new Set([...cohort.map(identity => identity.companyRouteCode).filter(Boolean), ...(arenaCohort?.companies ?? [])])];
  syncWorkspace({ workspace });
  const detailFile = path.join(workspace, 'components/detail-surface.tsx');
  const detail = fs.readFileSync(detailFile, 'utf8');
  const breadcrumb = '      <nav aria-label="Breadcrumb"';
  if (!detail.includes(breadcrumb)) throw new Error('Missing pilot detail insertion point');
  const demo = "import { Suspense } from 'react';\nimport { PerPilotReviewControls } from '@/scripts/per-pilot/review-controls';\n";
  fs.writeFileSync(detailFile, demo + detail.replace(breadcrumb,
    "      {metric === 'per' && <Suspense fallback={null}><PerPilotReviewControls /></Suspense>}\n" + breadcrumb));

  // Pre-render the complete document rather than a loading boundary that requires scripts to reveal content.
  for (const metric of detailMetrics) fs.rmSync(path.join(workspace, 'app/security/[secCode]', metric, 'loading.tsx'), { force: true });
  if (arena) fs.rmSync(path.join(workspace, 'app/dashboard/loading.tsx'), { force: true });
  if (allDetailPacks) for (const segment of ['(basic)', 'marketcap']) {
    fs.rmSync(path.join(workspace, 'app/company/[secCode]', segment, 'loading.tsx'), { force: true });
  }
  const publicDir = path.join(workspace, 'public');
  let history = allDetailPacks ? undefined : makePerPacks(stocks[0], cutoff, publicDir);
  const packIndex = allDetailPacks ? createHistoryPackIndex({ cutoff, companyCutoff: manifest.sourcePublications?.['company_marketcap/krx-all']?.asOf, writer: createStaticAssetWriter(publicDir) }) : undefined;
  fs.mkdirSync(input, { recursive: true });
  const dataDirs = arena ? ['data/security', 'data/company'] : ['data'];
  if (arena) {
    fs.mkdirSync(path.join(input, 'data'), { recursive: true });
    fs.copyFileSync(arenaSource, path.join(input, 'data/dashboard-arena-history.json'));
    fs.copyFileSync(path.join(marketSource, 'data/market-download.csv'), path.join(input, 'data/market-download.csv'));
  }
  for (const name of ['assets', ...dataDirs, 'rankings', 'identities.json', 'companies.json']) {
    const target = path.join(input, name), source = path.join(frozen, name);
    if (!fs.existsSync(target)) fs.symlinkSync(source, target);
    if (fs.realpathSync(target) !== fs.realpathSync(source)) throw new Error('Unexpected pilot input: ' + name);
  }
  writeJson(path.join(input, 'manifest.json'), {
    version: manifest.version, snapshotId: manifest.snapshotId, sourcePublications: manifest.sourcePublications,
    securityCodes, companyCodes, routes: [], aliases: [], assets: [],
    securityAliases: Object.fromEntries(cohort.map(identity => [identity.routeCode, identity.securityId])),
    companyAliases: Object.fromEntries(companyCodes.map(code => [code, manifest.companyAliases[code]])),
    ...(history ? { perPilot: { securityId: cohort[0].securityId, history } } : { historyPacks: true }),
    ...(marketCsv && { marketCsv }),
  });
  const searchIds = path.join(frozen, 'search-security-ids.json');
  const eligible = fs.existsSync(searchIds) ? new Set(read(searchIds))
    : listedSecurityPeriods(stocks.map(stock => stock.security), stocks.flatMap(stock => stock.security.listingPeriods), cutoff);
  writeJson(path.join(input, 'search-security-ids.json'), cohort.map(identity => identity.securityId).filter(id => eligible.has(id)));

  const copyAsset = url => {
    const target = path.join(publicDir, url);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(frozen, 'assets', url), target);
  };
  const metrics = arena ? detailMetrics : ['per'];
  const rankings = metrics.map(metric => rankingManifest('security', metric));
  if (arena) rankings.push(rankingManifest('company', 'marketcap'));
  for (const ranking of rankings) {
    for (const scope of Object.values(ranking.scopes)) {
      [...Object.values(scope.pages), ...(scope.csv ? [scope.csv.url] : [])].forEach(copyAsset);
    }
  }
  const readAsset = url => read(path.join(frozen, 'assets', url));
  function copyDetailAssets(assets) {
    const { prices, marketcap, companyHistory, metrics, memberPrices, memberMarketcaps } = assets;
    const paired = new Set();
    if (packIndex && metrics) for (const [first, second] of PAIRS) {
      const left = metrics[first], right = metrics[second];
      if (!left || !right) continue;
      packIndex.addPair(left, first, right, second, readAsset);
      paired.add(left); paired.add(right);
    }
    const urls = [prices, marketcap, companyHistory, ...Object.values(metrics || {}), ...Object.values(memberPrices || {}),
      ...Object.values(memberMarketcaps || {})].filter(Boolean);
    for (const url of urls) {
      if (paired.has(url)) continue;
      if (!packIndex) { copyAsset(url); continue; }
      const packs = packIndex.entries[url] ?? packIndex.add(url, readAsset(url));
      if (!packs || packs.archive === url || packs.current === url) copyAsset(url);
    }
  }
  stocks.forEach(stock => copyDetailAssets(stock.assets));
  for (const code of companyCodes) {
    const file = read(path.join(frozen, 'data/company', manifest.companyAliases[code] + '.json'));
    copyDetailAssets(file.assets);
    for (const member of file.companySecs) {
      copyDetailAssets(read(path.join(frozen, 'data/security', member.securityId + '.json')).assets);
    }
  }
  if (packIndex) {
    writeJson(path.join(input, INDEX), packIndex.entries);
    const { metrics, prices } = stocks[0].assets;
    history = { metric: packIndex.entries[pairKey(metrics.per, metrics.eps)], prices: packIndex.entries[prices] };
  }
  const rankingRoutes = arena ? [...metrics, 'marketcaps'] : metrics;
  const routes = ['app/search-data.json/route.ts', 'app/company/[secCode]/(basic)/page.tsx',
    'app/company/[secCode]/marketcap/page.tsx',
    ...rankingRoutes.flatMap(metric => [`app/(market)/${metric}/page.tsx`, `app/(market)/${metric}/[page]/page.tsx`]),
    ...metrics.map(metric => `app/ranking-data/securities-${metric}.csv/route.ts`),
    ...detailMetrics.map(metric => `app/security/[secCode]/${metric}/page.tsx`)];
  if (arena) routes.push('app/(market)/page.tsx', 'app/dashboard/page.tsx',
    'app/ranking-data/companies-marketcap.csv/route.ts', 'app/downloads/market/[file]/route.ts');
  const result = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build', '--webpack',
    '--debug-build-paths=' + routes.join(',')], { cwd: workspace, stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', NEXT_OUTPUT_MODE: 'export',
      NEXT_PUBLIC_STATIC_DOCUMENTS: '1', STATIC_SNAPSHOT_DIR: input, STATIC_BUILD_PROJECT_ROOT: ROOT, STATIC_BUILD_CPUS: '2' } });
  if (result.status !== 0) throw new Error('PER pilot build failed: ' + (result.error?.message || result.signal || result.status));
  const output = path.join(workspace, 'out');
  fs.writeFileSync(path.join(output, '_headers'), cacheHeaders(output, marketCsv || undefined));
  writeJson(path.join(output, '_per-pilot.json'), { snapshotId: manifest.snapshotId, cutoff, securityCodes, companyCodes, history, ...(marketCsv && { marketCsv }) });
  console.log('PER 시범 출력:', output);
}

if (require.main === module) {
  try { build(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
