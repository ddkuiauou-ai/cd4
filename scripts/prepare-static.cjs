const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { createStaticAliases } = require('./static-aliases.cjs');
const { createHistoryPackIndex, PAIRS } = require('./prepare-static-detail-history-packs.cjs');
const { createStaticAssetWriter } = require('./static-asset-writer.cjs');
process.env.STATIC_PREPARING = '1';
process.env.NODE_ENV = 'production';
const root = path.resolve(__dirname, '..');
const nextRequire = require('node:module').createRequire(require.resolve('next/package.json'));
nextRequire('@next/env').loadEnvConfig(root, false, { info() {}, error() {} });
require('./register-typescript.cjs');
const work = path.resolve(process.env.STATIC_SNAPSHOT_DIR || path.join(root, '.static-build'));
const previous = process.env.STATIC_PREVIOUS_SNAPSHOT_DIR ? path.resolve(process.env.STATIC_PREVIOUS_SNAPSHOT_DIR) : null;
const compactPrivate = process.env.STATIC_BUILD_COMPACT_PRIVATE === '1';
const releaseMode = process.env.STATIC_RELEASE_MODE ?? 'full';
const daily = releaseMode === 'daily';
const portableDaily = daily && process.env.STATIC_RELEASE_PORTABLE === '1';
const publicationCheck = process.argv.includes('--publication-check');
const indexed = process.env.STATIC_BUILD_SOURCE_INDEX === '1' && !process.env.STATIC_BUILD_SAMPLE;
const privateDigests = { security: {}, company: {} };
const historySources = Object.create(null);
const metrics = ['marketcap', 'per', 'pbr', 'bps', 'eps', 'div', 'dps'];
const { db, closeDatabase } = require('../db/index.ts');
const { installQueryCounter } = require('./static-query-counter.cjs');
const queryCounter = installQueryCounter(db.$client);
const schema = require('../db/schema-postgres.ts');
const { asc, sql } = require('drizzle-orm');
const { toDataDTO, businessDate } = require('../lib/data/dto.ts');
const { readSnapshot, isCurrentResult, publicationState, SECURITY_PUBLICATION_KEY } = require('../lib/data/publication.ts');
const { listedSecurityPeriods } = require('../lib/data/listed-security-periods.ts');
const { STATIC_SEARCH_SECURITY_IDS_FILE } = require('../lib/static-build/server.ts');
const { readPrivateHistory, encodePrivateHistory, normalizeLegacyHistory } = require('../lib/static-build/private-history.ts');
const { readPrivateJsonText } = require('../lib/static-build/read-private-json.ts');
const { currentSecurity } = require('../lib/data/security.ts');
const { currentCompany } = require('../lib/data/company.ts');
const { readBatchLifecycles, readSecurityBatch, readDailyHistorySources, readObservedMarketDays } = require('../lib/static-build/read-security-batch.ts');
const { aggregateRegisteredCompanyHistory, exactPercentage } = require('../lib/data/registered-company-history.ts');
const { securityRouteCodes, companyRouteCodes } = require('../lib/entity-paths.ts');
const { readWholeRankingExport } = require('../lib/data/ranking-export.ts');
const { serializeRankingCsv, readRankingCsvMetadata } = require('../lib/csv/ranking.ts');
const { createPreparedRankings } = require('../lib/static-build/ranking-snapshots.ts');
const { ARENA_HISTORY_FILE, readArenaHistory } = require('../lib/data/dashboard-arena.ts');
const { readMarketCsv } = require('../lib/data/market-csv.ts');
const { MARKET_CSV_INPUT } = require('../lib/csv/market.ts');
const { compareBusinessValues } = require('../lib/business-analysis.ts');
const { scopedRankingPagePath } = require('../lib/ranking-page-address.ts');
const { planDailyPublication, publicationHeads, readPreviousManifest, mergeBusinessDay } = require('./static-daily-input.cjs');
const { createFrozenArenaAccumulator } = require('../lib/static-build/frozen-arena.ts');
const { FILE: SOURCE_INDEX, buildSourceIndex, rankNeighborsByValue } = require('./static-source-index.cjs');
const { checkStaticDatabaseAccess } = require('./check-static-db-access.cjs');

function writeJson(relative, value) {
  const compact = compactPrivate && /^data\/(security|company)\//.test(relative);
  const file = path.join(work, compact ? relative + '.gz' : relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const json = JSON.stringify(value);
  const entity = /^data\/(security|company)\/([^/]+)\.json$/.exec(relative);
  if (entity && indexed) privateDigests[entity[1]][entity[2]] = digest(json);
  fs.writeFileSync(file, compact ? gzipSync(json, { level: 1 }) : json);
}
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const assetWriter = createStaticAssetWriter(path.join(work, 'assets'),
  { previousDirectory: previous && !portableDaily ? path.join(previous, 'assets') : undefined });
const assets = assetWriter.assets;
// Entity labels describe call sites only; identical payload bytes always share one URL.
const asset = (_label, value, extension = 'json') => assetWriter.write(value, extension);
function table(rows, columns, paired = false) {
  return { schemaVersion: 1, columns, rows: rows.map(row => columns.map(key => paired && key.endsWith('Present') ? true : row[key] ?? null)) };
}
const listedOrder = (a, b) => Number(b.delistingDate == null) - Number(a.delistingDate == null)
  || a.exchange.localeCompare(b.exchange) || a.ticker.localeCompare(b.ticker) || a.securityId.localeCompare(b.securityId);
const readSecurity = id => JSON.parse(readPrivateJsonText(path.join(work, `data/security/${id}.json`)));

async function prepare() {
  if (!['full', 'daily'].includes(releaseMode) || daily && (!indexed || !compactPrivate)) throw new Error('Daily source requires canonical compact extraction');
  if (publicationCheck && !portableDaily) throw new Error('The publication check requires a portable daily release');
  if ((process.argv.includes('--reuse') || process.env.STATIC_BUILD_REUSE === '1')
    && fs.existsSync(path.join(work, 'manifest.json'))
    && fs.existsSync(path.join(work, STATIC_SEARCH_SECURITY_IDS_FILE))) {
    console.log('Reusing immutable static input'); return;
  }
  if (process.env.STATIC_RELEASE_POSTGRES_TLS === 'verify-full') {
    const access = await checkStaticDatabaseAccess(process.env);
    if (access !== 'verified-tls') throw new Error(`Hosted PostgreSQL preflight failed: ${access}`);
  }
  const started = Date.now(), generatedAt = new Date().toISOString();
  if (previous === work) throw new Error('Previous static snapshot must be separate from the new input');
  if (compactPrivate) fs.mkdirSync(work);
  else {
    fs.mkdirSync(work, { recursive: true });
    fs.rmSync(path.join(work, 'manifest.json'), { force: true });
    for (const directory of ['assets', 'data', 'rankings']) fs.rmSync(path.join(work, directory), { recursive: true, force: true });
  }
  const manifest = await readSnapshot(tx => publicationCheck
    ? tx.query.resultPublication.findMany().then(headlines => readDailyPlan(tx, headlines))
    : extract(tx, started, generatedAt));
  if (publicationCheck || manifest.unchanged || manifest.requiresFull) {
    writeJson('prepare-status.json', { ...manifest, input: previous, databaseQueries: queryCounter.snapshot() });
    console.log(JSON.stringify(manifest));
    if (manifest.requiresFull) process.exitCode = 2;
    return;
  }
  manifest.extraction.databaseQueries = queryCounter.snapshot();
  const manifestTemp = path.join(work, 'manifest.json.tmp');
  fs.writeFileSync(manifestTemp, JSON.stringify(manifest));
  fs.renameSync(manifestTemp, path.join(work, 'manifest.json'));
  console.log(JSON.stringify({snapshotId:manifest.snapshotId,sample:manifest.sample,routes:manifest.routes.length,assets:assets.length,extraction:manifest.extraction}));
}

async function readDailyPlan(tx, headlines, oldManifest = readPreviousManifest(previous)) {
  const expectedDay = process.env.STATIC_RELEASE_DAY;
  if (expectedDay && businessDate(expectedDay) !== expectedDay) throw new Error('Invalid STATIC_RELEASE_DAY');
  const dayPlan = planDailyPublication({ previous: oldManifest, publications: headlines, expectedDay });
  if (dayPlan.requiresFull) return dayPlan;
  if (dayPlan.unchanged) {
    if (dayPlan.reason === 'publication-not-advanced') {
      const observed = await readObservedMarketDays(tx, dayPlan.from, expectedDay);
      return { ...dayPlan, observedTradingDay: observed.includes(expectedDay) };
    }
    return dayPlan;
  }
  const days = await readObservedMarketDays(tx, dayPlan.from, dayPlan.day);
  if (!days.includes(dayPlan.day)) return { requiresFull: true, reason: 'published-day-without-market-observation', day: dayPlan.day };
  if (days.length !== 1) return { requiresFull: true, reason: 'missed-trading-day', days };
  return dayPlan;
}

async function extract(tx, started, generatedAt) {
  queryCounter.phase('inventory');
  const headlines = await tx.query.resultPublication.findMany();
  const expectedDay = process.env.STATIC_RELEASE_DAY;
  if (expectedDay && businessDate(expectedDay) !== expectedDay) throw new Error('Invalid STATIC_RELEASE_DAY');
  const oldManifest = readPreviousManifest(previous);
  const dayPlan = daily ? await readDailyPlan(tx, headlines, oldManifest) : null;
  if (dayPlan?.requiresFull || dayPlan?.unchanged) return dayPlan;
  if (!daily && expectedDay && publicationHeads(headlines)[SECURITY_PUBLICATION_KEY]?.asOf !== expectedDay) {
    return { requiresFull: true, reason: 'requested-full-day-not-current', expectedDay };
  }
  const raw = {
    securities: await tx.query.security.findMany({ orderBy: [asc(schema.security.securityId)] }),
    companies: await tx.query.company.findMany({ orderBy: [asc(schema.company.companyId)] }),
    publications: headlines,
    listingPeriods: await tx.query.securityListingPeriod.findMany(),
    ranks: await tx.query.securityRank.findMany(),
  };
  const publications = new Map(raw.publications.map(row => [row.publicationKey, row]));
  const secPub = publications.get(SECURITY_PUBLICATION_KEY) ?? null, coPub = publications.get('company_marketcap/krx-all') ?? null;
  const history = coPub && !indexed ? await readArenaHistory(tx, businessDate(coPub.asOf)) : null;
  const listed = listedSecurityPeriods(raw.securities, raw.listingPeriods, businessDate(secPub?.asOf));
  if (dayPlan) {
    const previousListed = listedSecurityPeriods(raw.securities, raw.listingPeriods, dayPlan.from);
    if (listed.size !== previousListed.size || [...listed].some(([id, period]) => !previousListed.has(id)
      || previousListed.get(id)?.periodId !== period?.periodId)) {
      return { requiresFull: true, reason: 'entity-inventory-or-membership-changed', day: dayPlan.day };
    }
  }
  const marketCsv = secPub
    ? await readMarketCsv(tx, secPub, raw.securities.filter(row => listed.has(row.securityId)), raw.publications, raw.ranks)
    : null;
  const sourceIndex = indexed ? buildSourceIndex({ publications: raw.publications }) : undefined;
  await tx.execute(sql`SET LOCAL work_mem = '32MB'`);
  if (history) writeJson(ARENA_HISTORY_FILE, history);
  if (marketCsv) {
    const file = path.join(work, MARKET_CSV_INPUT);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, marketCsv.body);
  }
  const secRoutes = securityRouteCodes(raw.securities), coRoutes = companyRouteCodes(raw.securities);
  const arena = indexed && coPub ? createFrozenArenaAccumulator(businessDate(coPub.asOf), secRoutes) : null;
  const priorIdentities = dayPlan ? new Map(JSON.parse(fs.readFileSync(path.join(previous, 'identities.json'), 'utf8'))
    .map(row => [row.securityId, row])) : null;
  const priorCompanies = dayPlan ? new Set(JSON.parse(fs.readFileSync(path.join(previous, 'companies.json'), 'utf8')).map(row => row.companyId)) : null;
  if (dayPlan && (priorIdentities.size !== raw.securities.length || priorCompanies.size !== raw.companies.length
    || raw.securities.some(row => {
      const old = priorIdentities.get(row.securityId);
      return !old || old.exchange !== row.exchange || old.ticker !== row.ticker || old.companyId !== row.companyId
        || old.type !== row.type || old.delistingDate !== businessDate(row.delistingDate);
    }) || raw.companies.some(row => !priorCompanies.has(row.companyId)))) {
    return { requiresFull: true, reason: 'entity-inventory-or-membership-changed', day: dayPlan.day };
  }
  const secById = new Map(raw.securities.map(row => [row.securityId, row]));
  const coById = new Map(raw.companies.map(row => [row.companyId, row]));
  const members = new Map();
  for (const row of raw.securities) if (row.companyId) {
    if (!members.has(row.companyId)) members.set(row.companyId, []);
    members.get(row.companyId).push(row);
  }
  for (const rows of members.values()) rows.sort(listedOrder);
  const rankingRows = new Map();
  for (const row of raw.ranks) {
    const pub = publications.get(row.publicationKey);
    if (!pub?.metricType || !pub.publicationKey.startsWith('security_rank/') || !isCurrentResult(row, pub)
      || row.scopeKey !== pub.scopeKey || row.metricType !== pub.metricType || businessDate(row.rankDate) !== businessDate(pub.asOf)) continue;
    const group = rankingRows.get(pub.publicationKey) ?? [];
    group.push(row);
    rankingRows.set(pub.publicationKey, group);
  }
  const sampleSize = process.env.STATIC_BUILD_SAMPLE ? Math.max(40, Number(process.env.STATIC_BUILD_SAMPLE) || 40) : 0;
  const selected = new Set();
  queryCounter.phase('sample-selection');
  if (sampleSize) {
    const longest = await tx.execute(sql`SELECT security_id AS id, count(*)::int AS count FROM price WHERE security_id IS NOT NULL GROUP BY security_id ORDER BY count(*) DESC, security_id LIMIT 16`);
    longest.forEach(row => selected.add(row.id));
    for (const rows of rankingRows.values()) {
      const sorted = rows.filter(row => row.rankingState === 'included').sort((a,b) => a.currentRank-b.currentRank);
      [sorted[0], sorted[Math.floor(sorted.length/2)], sorted.at(-1)].filter(Boolean).forEach(row => selected.add(row.securityId));
    }
    for (const predicate of [row => row.type !== '보통주', row => row.delistingDate != null,
      row => !isCurrentResult(row, secPub), row => metrics.some(metric => row[`${metric}State`] !== 'provided')]) {
      raw.securities.filter(predicate).slice(0, 4).forEach(row => selected.add(row.securityId));
    }
    for (const row of raw.securities) { if (selected.size >= sampleSize) break; selected.add(row.securityId); }
  } else raw.securities.forEach(row => selected.add(row.securityId));
  const selectedCompanies = new Set(sampleSize ? [...selected].map(id => secById.get(id)?.companyId).filter(Boolean).slice(0, 12) : raw.companies.map(row => row.companyId));
  const neededCompanies = new Set([...selectedCompanies, ...[...selected].map(id => secById.get(id)?.companyId).filter(Boolean)]);
  const neededSecurities = new Set(selected);
  for (const id of neededCompanies) (members.get(id) || []).forEach(row => neededSecurities.add(row.securityId));
  const byMetric = new Map(metrics.map(metric => {
    const rows = rankingRows.get(`security_rank/krx-all/${metric}`) ?? [];
    const ranked = rows.filter(row => row.rankingState === 'included')
      .sort((a, b) => a.currentRank - b.currentRank || a.securityId.localeCompare(b.securityId));
    return [metric, { byId: new Map(rows.map(row => [row.securityId, row])), neighbors: rankNeighborsByValue(ranked, row => row.currentRank) }];
  }));
  const neighbor = row => {
    const security = secById.get(row.securityId);
    return { securityId: security.securityId, name: security.name, korName: security.korName,
      exchange: security.exchange, ticker: security.ticker, type: security.type, companyId: security.companyId,
      currentRank: row.currentRank, value: row.value == null ? null : String(row.value), routeCode: secRoutes.get(row.securityId) ?? null };
  };
  queryCounter.phase('security-histories');
  const batchMemory = { batchSize: 50, batches: 0, maxHistoryRows: 0, peakRssBytes: 0, peakHeapUsedBytes: 0, seconds: 0,
    note: 'Process memory sampled after each bounded batch load/write; includes runtime overhead and unreclaimed prior allocations.' };
  const recordBatchMemory = () => {
    const memory = process.memoryUsage();
    batchMemory.peakRssBytes = Math.max(batchMemory.peakRssBytes, memory.rss);
    batchMemory.peakHeapUsedBytes = Math.max(batchMemory.peakHeapUsedBytes, memory.heapUsed);
  };
  const batchStarted = performance.now();
  const year = businessDate(secPub?.asOf)?.slice(0, 4);
  const companyYear = businessDate((coPub ?? secPub)?.asOf)?.slice(0, 4);
  const packs = indexed && year ? createHistoryPackIndex({ cutoff: businessDate(secPub.asOf),
    companyCutoff: businessDate(coPub?.asOf), writer: assetWriter }) : null;
  const priorAssets = new Map((oldManifest?.assets ?? []).map(entry => ['/' + entry.path, entry]));
  const inheritedAssets = new Map();
  function inheritAsset(url) {
    if (!url || inheritedAssets.has(url)) return;
    const entry = priorAssets.get(url);
    if (!entry) throw new Error('Previous immutable history object is missing from its manifest');
    inheritedAssets.set(url, entry);
    if (portableDaily) return;
    const target = path.join(work, 'assets', entry.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    try { fs.linkSync(path.join(previous, 'assets', entry.path), target); }
    catch (error) {
      if (error.code === 'EXDEV') fs.copyFileSync(path.join(previous, 'assets', entry.path), target, fs.constants.COPYFILE_EXCL);
      else if (error.code !== 'EEXIST') throw error;
    }
  }
  function nextPack(key, rows, columns, prior, { pair, splitYear = year } = {}) {
    const reuse = dayPlan && prior && (prior.currentStart === splitYear + '-01-01' || (!prior.current && !prior.currentDates))
      ? prior : undefined;
    if (reuse) inheritAsset(reuse.archive);
    return packs.add(key, table(reuse ? rows.filter(row => row.date.startsWith(splitYear)) : rows, columns, Boolean(pair)),
      { original: null, pair, previousArchive: reuse });
  }
  function persistHistory(id, archive, companyCaps, priorParts) {
    const prefix = 'data/security-history/' + digest(id).slice(0, 32);
    const rows = { ...archive, companyMarketcaps: companyCaps ?? [] };
    const split = (past) => Object.fromEntries(Object.entries(rows).map(([key, data]) =>
      [key, data.filter(row => (row.date < year + '-01-01') === past)]));
    const persist = (suffix, data) => {
      const relative = prefix + suffix + '.json';
      const text = JSON.stringify(encodePrivateHistory(data));
      const file = path.join(work, relative + '.gz');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, gzipSync(text, { level: 1 }));
      return { path: relative, digest: digest(text) };
    };
    let archived;
    if (dayPlan && priorParts?.year === year) {
      archived = priorParts.archive;
      const target = path.join(work, archived.path + '.gz');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      try { fs.linkSync(path.join(previous, archived.path + '.gz'), target); }
      catch (error) {
        if (error.code !== 'EXDEV') throw error;
        fs.copyFileSync(path.join(previous, archived.path + '.gz'), target, fs.constants.COPYFILE_EXCL);
      }
    } else archived = persist('.archive', split(true));
    return { year, archive: archived, current: persist('.current', split(false)) };
  }

  const companyInputs = new Map();
  const rankingPrices = new Map();
  const rankCutoffs = [...new Set(raw.publications.filter(row => row.resultKind !== 'security_latest').map(row => businessDate(row.asOf)))].sort();
  const compactMemberHistory = id => path.join(work, '_company-staging', id + '.json');
  if (indexed) fs.mkdirSync(path.join(work, '_company-staging'));
  let completed = 0;
  const ids = [...neededSecurities];
  const lifecycle = await readBatchLifecycles(tx, ids);
  const dailyRows = dayPlan ? await readDailyHistorySources(tx, ids, dayPlan.day) : undefined;
  for (let offset = 0; offset < ids.length; offset += batchMemory.batchSize) {
    const batchIds = ids.slice(offset, offset + batchMemory.batchSize);
    const oldFiles = new Map();
    const batch = await readSecurityBatch(tx, batchIds.map(id => secById.get(id)), coById, secPub, coPub, secRoutes,
      dayPlan ? async () => {
        const output = { prices: [], marketcaps: [], metrics: [] };
        for (const id of batchIds) {
          const old = JSON.parse(readPrivateJsonText(path.join(previous, `data/security/${id}.json`)));
          const history = old.historyParts ? readPrivateHistory(previous, old.historyParts) : old.archive && normalizeLegacyHistory({
            ...old.archive, companyMarketcaps: old.rawCompanyMarketcaps ?? [],
          });
          if (!history) throw new Error('Previous private source archive is unavailable');
          oldFiles.set(id, { security: old.security, assets: old.assets, historyParts: old.historyParts });
          for (const key of Object.keys(output)) {
            const companyCaps = history.companyMarketcaps?.length ? history.companyMarketcaps : old.rawCompanyMarketcaps;
            const rows = key === 'marketcaps' && companyCaps ? companyCaps : history[key];
            for (const row of mergeBusinessDay(rows, dailyRows[key].get(id) ?? [], dayPlan.from, dayPlan.day)) output[key].push(row);
          }
        }
        return output;
      } : undefined, { lifecycle, officialOnly: indexed, pricesThrough: indexed ? rankCutoffs.at(-1) : undefined });
    batchMemory.batches++; batchMemory.maxHistoryRows = Math.max(batchMemory.maxHistoryRows, batch.historyRows);
    recordBatchMemory();
    for (const { securityId: id, security, metrics: history, companyMember, allMarketcaps, rawCompanyMarketcaps, rankingPriceSources, archive } of batch.items) {
      const member = secById.get(id);
      if (dayPlan) {
        const old = oldFiles.get(id);
        const intervals = periods => periods.map(({ periodId, listingDate, delistingDate }) => [periodId, listingDate, delistingDate]);
        if (JSON.stringify(intervals(old.security.listingPeriods ?? [])) !== JSON.stringify(intervals(security.listingPeriods))) {
          return { requiresFull: true, reason: 'historical-listing-boundary-changed', day: dayPlan.day };
        }
        const matches = (field, rows, column = field) => security[field + 'State'] !== 'provided' || security[field + 'Date'] !== dayPlan.day
          || rows.some(row => row.date === dayPlan.day && row.exchange === security.exchange && row.ticker === security.ticker
            && compareBusinessValues(row[column], security[field]) === 0);
        if (!matches('price', archive.prices, 'close') || !matches('marketcap', archive.marketcaps)
          || metrics.filter(field => field !== 'marketcap').some(field => !matches(field, archive.metrics))) {
          return { requiresFull: true, reason: 'published-observation-missing-or-mismatched', day: dayPlan.day };
        }
      }
      if (indexed) for (const date of rankCutoffs) {
        const keyed = rankingPrices.get(date) ?? new Map();
        const end = rankingPriceSources.findLastIndex(row => row.date <= date) + 1;
        keyed.set(id, rankingPriceSources.slice(Math.max(0, end - 30), end)
          .map(({ date, open, close, rate, volume }) => ({ date, open, close, rate, volume })));
        rankingPrices.set(date, keyed);
      }
      arena?.observe(member, archive.metrics, rawCompanyMarketcaps ?? archive.marketcaps);

      const oldYearly = oldFiles.get(id)?.assets.yearly;
      const priceColumns = ['date','open','high','low','close','volume','fvolume','transaction','rate'];
      const capColumns = ['date','marketcap','shares'];
      let refs;
      if (packs) {
        const paired = {};
        for (const [first, second] of PAIRS) {
          const columns = ['date', first, first + 'State', first + 'Present', second, second + 'State', second + 'Present'];
          const pack = nextPack(id + '/' + first, archive.metrics, columns, oldYearly?.metrics?.[first], { pair: [first, second] });
          paired[first] = pack; paired[second] = pack;
        }
        refs = { yearly: { prices: nextPack(id + '/price', archive.prices, priceColumns, oldYearly?.prices),
          marketcap: nextPack(id + '/marketcap', archive.marketcaps, capColumns, oldYearly?.marketcap), metrics: paired } };
      } else {
        refs = {
          prices: asset(`security/${id}/prices`, table(archive.prices, priceColumns)),
          marketcap: asset(`security/${id}/marketcap`, table(archive.marketcaps, capColumns)), metrics: {},
        };
        for (const metric of metrics.filter(metric => metric !== 'marketcap')) refs.metrics[metric] = asset(`security/${id}/${metric}`,
          table(archive.metrics, ['date', metric, `${metric}State`]));
        historySources[id] = refs.metrics;
      }
      const rankings = {};
      for (const metric of metrics) {
        const publication = publications.get(`security_rank/krx-all/${metric}`);
        const index = byMetric.get(metric), row = index.byId.get(id), rank = row?.currentRank;
        const [previousRow, next] = index.neighbors(rank);
        rankings[metric] = { ranking: { ...publicationState(publication ?? null), currentRank: row?.currentRank ?? null,
          priorRank: row?.priorRank ?? null, rankingState: row?.rankingState ?? null, exclusionReason: row?.exclusionReason ?? null,
          value: row?.value == null ? null : String(row.value), valueObservedAt: row?.valueObservedAt ? businessDate(row.valueObservedAt) : null,
          rankDate: publication ? businessDate(publication.asOf) : null }, neighbors: [previousRow,next].filter(Boolean).map(neighbor) };
      }
      if (indexed && member.companyId && neededCompanies.has(member.companyId)) {
        companyInputs.set(id, { companyMember, assets: refs, prices: security.prices.slice(0, 1) });
        if (companyMember) fs.writeFileSync(compactMemberHistory(id), JSON.stringify(allMarketcaps.map(row => [row.date, row.marketcap])));
      }
      writeJson(`data/security/${id}.json`, packs
        ? { security: { ...security, prices: [], marketcaps: [] }, metrics: [],
          historyParts: persistHistory(id, archive, rawCompanyMarketcaps, oldFiles.get(id)?.historyParts), assets: refs, rankings }
        : indexed ? { security: { ...security, prices: [], marketcaps: [] }, metrics: [], rawCompanyMarketcaps, archive, assets: refs, rankings }
        : { security, metrics: history, companyMember, allMarketcaps, rawCompanyMarketcaps, archive, assets: refs, rankings });
      completed++; if (completed % 50 === 0) console.log(`Prepared securities ${completed}/${neededSecurities.size}`);
    }
    recordBatchMemory();
  }
  if (arena) writeJson(ARENA_HISTORY_FILE, arena.result());
  batchMemory.seconds = (performance.now() - batchStarted) / 1000;
  queryCounter.phase('company-assembly');
  const rankedCompanies = raw.companies.filter(row => isCurrentResult(row, coPub) && row.rankingState === 'included')
    .sort((a,b) => a.marketcapRank-b.marketcapRank || a.companyId.localeCompare(b.companyId));
  const companyAssetIndex = {};
  const priorCompanyAssets = dayPlan && oldManifest.separatedCompanyAssets
    ? JSON.parse(fs.readFileSync(path.join(previous, 'company-assets.json'), 'utf8')) : {};
  const adjacentCompanyRanks = rankNeighborsByValue(rankedCompanies, item => item.marketcapRank);
  for (const id of neededCompanies) {
    const row = coById.get(id), allMembers = members.get(id) || [];
    const sources = indexed ? companyInputs : new Map(allMembers.map(member => [member.securityId, readSecurity(member.securityId)]));
    const active = allMembers.filter(member => sources.get(member.securityId).companyMember);
    const historiesById = new Map(active.map(member => [member.securityId, indexed
      ? JSON.parse(fs.readFileSync(compactMemberHistory(member.securityId), 'utf8')).map(([date, marketcap]) => ({ securityId: member.securityId, date, marketcap }))
      : sources.get(member.securityId).allMarketcaps]));
    const histories = [...historiesById.values()].flat();
    const current = isCurrentResult(row, coPub), dto = toDataDTO(row), asOf = current ? dto.marketcapDate : null;
    const registeredHistory = aggregateRegisteredCompanyHistory(active.map(member => member.securityId), histories, asOf ? [asOf] : []);
    const composition = registeredHistory.find(item => item.date === asOf);
    const complete = Boolean(current && dto.marketcap != null && row.marketcapCompleteness === 'complete' && composition && !composition.partial && composition.totalMarketcap === dto.marketcap);
    const securities = active.map(member => ({ securityId:member.securityId,name:member.name,korName:member.korName,ticker:member.ticker,
      exchange:member.exchange,type:member.type,routeCode:secRoutes.get(member.securityId)??null,
      marketcap:composition?.securitiesBreakdown[member.securityId]??null,
      marketcapDate:composition?.securitiesBreakdown[member.securityId]!=null?asOf:null,
      percentage:complete&&composition?.securitiesBreakdown[member.securityId]!=null?exactPercentage(composition.securitiesBreakdown[member.securityId],dto.marketcap):null,
      marketcapHistory:historiesById.get(member.securityId) }));
    const company = { company:toDataDTO(currentCompany(row,coPub??null)),companyId:id,companyName:row.name,companyKorName:row.korName,
      totalMarketcap:current?dto.marketcap:null,totalMarketcapDate:current?dto.marketcapDate:null,
      marketcapCompleteness:current?row.marketcapCompleteness:null,marketcapRank:current?row.marketcapRank:null,
      marketcapPriorRank:current?row.marketcapPriorRank:null,rankingState:current?row.rankingState:null,
      exclusionReason:current?row.exclusionReason:null,resultSourceRef:current?row.resultSourceRef:null,
      state:current?'published':'unpublished',publication:current?toDataDTO(coPub):null,routeCode:coRoutes.get(id)??null,
      compositionComplete:complete,compositionReason:!current?'unpublished':!composition||composition.observedCount===0||composition.partial||row.marketcapCompleteness!=='complete'?'missing_input':!complete?'different_total':null,
      compositionObservedCount:composition?.observedCount??0,compositionTargetCount:active.length,securities,registeredHistory,aggregatedHistory:registeredHistory };
    const companySecs = [...active].sort((a,b)=>Number(a.type==null)-Number(b.type==null)
      ||(a.type??'').localeCompare(b.type??'')||listedOrder(a,b)).map(member=>{
      const source = sources.get(member.securityId);
      return { ...toDataDTO(currentSecurity(member, secPub ?? null)), company: toDataDTO(currentCompany(row, coPub ?? null)),
        prices: indexed ? source.prices : source.security.prices.slice(0, 1),
        marketcaps: indexed ? [] : source.security.marketcaps, routeCode: secRoutes.get(member.securityId) ?? null };
    });
    const rank = current ? row.marketcapRank : null;
    const neighbors = adjacentCompanyRanks(rank).filter(Boolean).map(item=>{
      const rep=(members.get(item.companyId)||[]).find(member=>member.type==='보통주');
      return {...toDataDTO(item),securities:rep?[{securityId:rep.securityId}]:[],routeCode:coRoutes.get(item.companyId)??null};
    });
    const detailRepresentative = companySecs.find(member => member.type === '보통주');
    const companyColumns = ['date','totalMarketcap','securitiesBreakdown','observedCount','targetCount','observedSecurityIds','partial'];
    const representativeAssets = detailRepresentative ? sources.get(detailRepresentative.securityId).assets : undefined;
    let refs;
    if (packs) {
      const priorCompanyIndex = dayPlan && oldManifest.separatedCompanyAssets ? priorCompanyAssets[id] : undefined;
      refs = { yearly: { companyHistory: nextPack(id + '/company', registeredHistory,
        companyColumns, priorCompanyIndex?.yearly?.companyHistory, { splitYear: companyYear }),
        prices: representativeAssets?.yearly?.prices } };
    } else {
      refs = { companyHistory: asset(`company/${id}/history`, table(registeredHistory, companyColumns)),
        prices: representativeAssets?.prices, memberMarketcaps: {}, memberPrices: {} };
      for (const member of allMembers) {
        refs.memberMarketcaps[member.securityId] = sources.get(member.securityId).assets.marketcap;
        refs.memberPrices[member.securityId] = sources.get(member.securityId).assets.prices;
      }
    }
    writeJson(`data/company/${id}.json`, { company, companySecs, assets: refs, neighbors });
    if (indexed) companyAssetIndex[id] = refs;
    else for(const member of allMembers){ const source=sources.get(member.securityId);source.assets.companyHistory=refs.companyHistory;
      source.assets.memberMarketcaps=refs.memberMarketcaps;source.assets.memberPrices=refs.memberPrices;
      writeJson(`data/security/${member.securityId}.json`,source); }
  }
  if (indexed) {
    fs.rmSync(path.join(work, '_company-staging'), { recursive: true });
    writeJson('company-assets.json', companyAssetIndex);
  }
  const rankingManifests={};
  queryCounter.phase('ranking-prices');
  const preparedRankings=createPreparedRankings(raw, secRoutes, members, coRoutes);
  await preparedRankings.loadPrices(tx, indexed ? (id, date) => rankingPrices.get(date)?.get(id) ?? [] : undefined);
  queryCounter.phase('ranking-pages-and-csv');
  for (const scope of ['security','company']) for (const metric of scope==='company'?['marketcap']:metrics) {
    const manifest={version:1,scope,metric,scopes:{}};
    const rankFile = `rankings/${scope}-${metric}.json`;
    const previousFile = previous && path.join(previous, rankFile);
    const previousScopes = previousFile && fs.existsSync(previousFile)
      ? JSON.parse(fs.readFileSync(previousFile, 'utf8')).scopes : {};
    const scopeKeys=scope==='company'?['krx-all']:[...new Set(['krx-all',...raw.publications.filter(pub=>pub.metricType===metric&&pub.publicationKey.startsWith('security_rank/')).map(pub=>pub.scopeKey)])];
    for (const scopeKey of scopeKeys) {
      const first=preparedRankings.getPage(scope,metric,1,scopeKey);
      const entry={state:first.state,publication:first.publication,totalCount:first.totalCount,totalPages:Math.max(1,first.totalPages),pages:{},csv:null};
      for(let page=1;page<=entry.totalPages;page++){
        const snapshot=page===1?first:preparedRankings.getPage(scope,metric,page,scopeKey);
        entry.pages[String(page)]=asset(`ranking/${scope}/${scopeKey}/${metric}-${page}`,snapshot);
      }
      if(first.state==='published'){
        const exported=await readWholeRankingExport(tx,scope,metric,undefined,scopeKey);
        if (indexed) exported.timestampSource = 'publication';
        const contentDigest = digest(JSON.stringify({
          publicationKey: exported.publicationKey, revision: exported.revision, calculationId: exported.calculationId,
          referenceDate: exported.referenceDate, rankDate: exported.rankDate,
          body: serializeRankingCsv({ ...exported, generatedAt: '' }),
        }));
        const priorCsv = previousScopes[scopeKey]?.csv;
        // Reuse the actual time when the identical CSV was first generated.
        const csvGeneratedAt = indexed ? exported.publication.publishedAt : priorCsv?.contentDigest === contentDigest ? priorCsv.metadata.generatedAt : generatedAt;
        exported.generatedAt = csvGeneratedAt;
        const body=serializeRankingCsv(exported);
        const basis={scope,metric,scopeKey,referenceDate:exported.referenceDate,rankDate:exported.rankDate,generatedAt:csvGeneratedAt,totalCount:exported.totalCount,
          revision:exported.revision,calculationId:exported.calculationId};
        const metadata=readRankingCsvMetadata(body,basis);
        entry.csv={url:asset(`ranking/${scope}/${scopeKey}/${metric}`,body,'csv'),metadata,contentDigest};
        if(scopeKey==='krx-all')writeJson(`rankings/${scope}-${metric}-headers.json`,{
          'Content-Type':'text/csv; charset=utf-8','Cache-Control':'no-store',
          'Content-Disposition':`attachment; filename="${metadata.filename}"`,
          'X-Ranking-Scope':scope,'X-Ranking-Metric':metric,'X-Ranking-Scope-Key':scopeKey,
          'X-Ranking-Reference-Date':metadata.referenceDate??'',
          [indexed ? 'X-Ranking-Published-At' : 'X-Ranking-Generated-At']:csvGeneratedAt,
          'X-Ranking-Row-Count':String(metadata.totalCount),'X-Ranking-Revision':metadata.revision,
          'X-Ranking-Calculation-Id':metadata.calculationId,'X-Ranking-Publication-Key':exported.publicationKey });
      }
      manifest.scopes[scopeKey]=entry;
    }
    writeJson(rankFile,manifest);rankingManifests[`${scope}-${metric}`]=manifest;
  }
  const identities=toDataDTO(raw.securities).map(row=>({securityId:row.securityId,companyId:row.companyId,name:row.name,korName:row.korName,
    ticker:row.ticker,exchange:row.exchange,type:row.type,delistingDate:row.delistingDate,routeCode:secRoutes.get(row.securityId)??null,
    companyRouteCode:row.companyId?coRoutes.get(row.companyId)??null:null}));
  writeJson('identities.json',identities);writeJson('companies.json',toDataDTO(raw.companies));
  writeJson('history-sources.json', historySources);
  writeJson(STATIC_SEARCH_SECURITY_IDS_FILE, [...listed.keys()]);
  const { securityAliases, companyAliases } = createStaticAliases(raw.securities, raw.companies);
  const securityCodes=[...selected].map(id=>secRoutes.get(id)||id),companyCodes=[...selectedCompanies].map(id=>coRoutes.get(id)||id);
  const routes=[{path:'/',kind:'page'},{path:'/dashboard/',kind:'page'}];
  for(const [key,manifest]of Object.entries(rankingManifests)){
    const base=key==='company-marketcap'?'marketcaps':manifest.metric;
    const pages=Math.max(...Object.values(manifest.scopes).map(entry=>entry.totalPages));
    routes.push({path:`/${base}/1/`,kind:'page'});
    for(let page=1;page<=pages;page++)routes.push({path:`/${base}/${page===1?'':`${page}/`}`,kind:'page'});
    if (manifest.scope === 'security') {
      for (const [scopeKey, entry] of Object.entries(manifest.scopes)) {
        if (scopeKey === 'krx-all' || entry.state !== 'published') continue;
        for (const page of Object.keys(entry.pages)) {
          routes.push({ path: scopedRankingPagePath(`/${base}`, scopeKey, Number(page)) + '/', kind: 'page' });
        }
      }
    }
  }
  for(const code of securityCodes)for(const segment of metrics)routes.push({path:`/security/${encodeURIComponent(code)}/${segment}/`,kind:'page'});
  for(const code of companyCodes)for(const segment of ['','marketcap'])routes.push({path:`/company/${encodeURIComponent(code)}/${segment?`${segment}/`:''}`,kind:'page'});
  const sourceRevisions=Object.fromEntries(raw.publications.map(pub=>[pub.publicationKey,String(pub.revision)]));
  const sourcePublications = publicationHeads(raw.publications);
  const snapshotId=digest(JSON.stringify({generatedAt,sourceRevisions,securityCodes,companyCodes})).slice(0,20);
  const requiredFiles=['search-data.json','sitemap.xml',...['companies-marketcap',...metrics.map(metric=>`securities-${metric}`)].map(name=>`ranking-data/${name}.csv`)];
  if (marketCsv) requiredFiles.push(marketCsv.metadata.url.slice(1));
  if (sourceIndex) {
    writeJson(SOURCE_INDEX, sourceIndex);
    writeJson('entity-digests.json', privateDigests);
  }
  return {version:1,snapshotId,generatedAt,sample:{enabled:Boolean(sampleSize),selection:sampleSize?`stratified-${sampleSize}`:'full',securities:selected.size,companies:selectedCompanies.size},
    routes,aliases:[],securityCodes,companyCodes,assets: [...new Map([...inheritedAssets.values(), ...assets].map(entry => [entry.path, entry])).values()],requiredFiles,securityAliases,companyAliases,companyRoutes:Object.fromEntries(coRoutes),sourceRevisions,
    sourcePublications,referenceDate:secPub?businessDate(secPub.asOf):null,marketCsv:marketCsv?.metadata,
    sourceIndexDigest:sourceIndex?.digest, separatedCompanyAssets: indexed, historyPacks: Boolean(packs),
    extraction:{seconds:(Date.now()-started)/1000,sourceSecurities:raw.securities.length,sourceCompanies:raw.companies.length,
      preparedSecurities:neededSecurities.size,batchMemory,rankingPrices:preparedRankings.stats}};
}
prepare().catch(error => {
  const tlsRequired = process.env.STATIC_RELEASE_POSTGRES_TLS === 'verify-full';
  const message = tlsRequired && (error.cause || !/^Hosted PostgreSQL preflight failed: [a-z-]+$/.test(error.message))
    ? 'Hosted snapshot preparation failed. Use the status operation to check TLS and read access.'
    : error.message?.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]');
  console.error('Static extraction failed:', error.code || error.name, message);
  process.exitCode = 1;
})
  .finally(()=>closeDatabase());
