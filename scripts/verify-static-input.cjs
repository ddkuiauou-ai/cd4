const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const metrics = ['marketcap', 'per', 'pbr', 'eps', 'bps', 'div', 'dps'];
const json = value => JSON.parse(JSON.stringify(value));
function normalizeAuditTimestamps(value, key) {
  if (typeof value === 'string' && (key === 'createdAt' || key === 'updatedAt')) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  if (Array.isArray(value)) return value.map(item => normalizeAuditTimestamps(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .map(([name, item]) => [name, normalizeAuditTimestamps(item, name)]));
  return value;
}

// Prepared DTOs may carry extra build fields. Every field returned by the live
// provider must still exist with the exact value, array order and decimal text.
function projectExpected(actual, expected) {
  if (Array.isArray(expected)) return Array.isArray(actual) ? actual.map((item, index) => projectExpected(item, expected[index])) : actual;
  if (expected && typeof expected === 'object') return actual && typeof actual === 'object'
    ? Object.fromEntries(Object.keys(expected).map(key => [key, projectExpected(actual[key], expected[key])])) : actual;
  return actual;
}
function firstDifference(actual, expected, at = '$') {
  if (Object.is(actual, expected)) return null;
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object') return { at, actual, expected };
  if (Array.isArray(actual) !== Array.isArray(expected)) return { at, actual: typeof actual, expected: typeof expected };
  if (Array.isArray(expected) && actual.length !== expected.length) return { at: `${at}.length`, actual: actual.length, expected: expected.length };
  for (const key of Object.keys(expected)) {
    const difference = firstDifference(actual[key], expected[key], `${at}.${key}`);
    if (difference) return difference;
  }
  return null;
}
function routeInventory(manifest, rankingManifests) {
  const rankingPages = rankingManifests.reduce((total, row) => total + 1 + Math.max(1, ...Object.values(row.scopes).map(scope => scope.totalPages)), 0);
  const expectedPages = 2 + manifest.securityCodes.length * 8 + manifest.companyCodes.length * 2 + rankingPages;
  return { expectedPages, actualPages: manifest.routes.length,
    fullPlannedPages: manifest.extraction ? 2 + manifest.extraction.sourceSecurities * 8 + manifest.extraction.sourceCompanies * 2 + rankingPages : null };
}

async function verifyStaticInput() {
  process.env.STATIC_PREPARING = '1';
  process.env.NODE_ENV = 'production';
  const root = path.resolve(__dirname, '..');
  const nextRequire = require('node:module').createRequire(require.resolve('next/package.json'));
  nextRequire('@next/env').loadEnvConfig(root, false, { info() {}, error() {} });
  require('./register-typescript.cjs');
  const prepared = require('../lib/static-build/server.ts');
  const { getSecurityDetailSnapshot, getCompanyDetailSnapshot } = require('../lib/data/detail-snapshot.ts');
  const { getSecurityRanksPage } = require('../lib/data/security.ts');
  const { getCompanyRankingPage } = require('../lib/data/company.ts');
  const { getWholeRankingExport } = require('../lib/data/ranking-export.ts');
  const { serializeRankingCsv } = require('../lib/csv/ranking.ts');
  const { createRankingRows } = require('../lib/ranking-view.ts');
  const { businessDate } = require('../lib/data/dto.ts');
  const { readSnapshot } = require('../lib/data/publication.ts');
  const { db, closeDatabase } = require('../db/index.ts');
  const { installQueryCounter } = require('./static-query-counter.cjs');
  const queryCounter = installQueryCounter(db.$client);
  const manifest = prepared.getStaticManifest(), started = performance.now();
  const report = { version: 1, snapshotId: manifest.snapshotId, success: false,
    sourcePublications: manifest.sourcePublications, referenceDate: manifest.referenceDate,
    normalization: 'Only createdAt/updatedAt audit timestamps normalize to ISO milliseconds, matching ORM Date precision; business dates, values and revisions remain exact.',
    checked: { securities: 0, companies: 0, detailMetrics: 0, rankingPages: 0, csvFiles: 0 }, failures: [] };
  const compare = (name, actual, expected) => {
    const target = normalizeAuditTimestamps(json(expected)), source = projectExpected(normalizeAuditTimestamps(json(actual)), target);
    const difference = firstDifference(source, target);
    if (difference) report.failures.push({ name, ...difference });
  };
  const liveSource = () => readSnapshot(async tx => {
    const rows = await tx.query.resultPublication.findMany();
    return { revisions: Object.fromEntries(rows.map(row => [row.publicationKey, String(row.revision)])),
      publications: Object.fromEntries(rows.map(row => [row.publicationKey, { asOf: businessDate(row.asOf), revision: String(row.revision) }])) };
  });
  const revisionState = values => ({ keys: Object.keys(values).sort(), values });
  const compareSource = (when, source) => {
    compare(`sourceRevisions.${when}`, revisionState(source.revisions), revisionState(manifest.sourceRevisions));
    if (manifest.sourcePublications) compare(`sourcePublications.${when}`, revisionState(source.publications), revisionState(manifest.sourcePublications));
  };
  try {
    queryCounter.phase('publication-validation');
    compareSource('before', await liveSource());
    if (report.failures.length) throw new Error('Database publications changed after input preparation');
    const limit = process.argv.includes('--all') || manifest.sample.enabled ? manifest.securityCodes.length : Math.max(40, Number(process.env.STATIC_PARITY_SECURITIES) || 40);
    const securityCodes = manifest.securityCodes.slice(0, limit);
    if (manifest.securityCodes.length >= 40 && securityCodes.length < 40) throw new Error('Input parity requires at least 40 securities');
    for (const code of securityCodes) {
      for (const metric of metrics) {
        queryCounter.phase('file-render');
        const actual = prepared.getStaticSecurityDetail(code, metric);
        queryCounter.phase('live-detail-pages');
        compare(`security.${code}.${metric}`, actual, await getSecurityDetailSnapshot(code, metric));
        report.checked.detailMetrics++;
      }
      report.checked.securities++;
      if (report.checked.securities % 10 === 0) console.log(`Input parity securities ${report.checked.securities}/${securityCodes.length}`);
    }
    const companyCodes = manifest.companyCodes.slice(0, manifest.sample.enabled || process.argv.includes('--all') ? undefined : 12);
    for (const code of companyCodes) {
      queryCounter.phase('file-render');
      const actual = prepared.getStaticCompanyDetail(code);
      queryCounter.phase('live-detail-pages');
      compare(`company.${code}`, actual, await getCompanyDetailSnapshot(code));
      report.checked.companies++;
    }
    const rankingManifests = [];
    for (const scope of ['security', 'company']) for (const metric of scope === 'company' ? ['marketcap'] : metrics) {
      queryCounter.phase('file-render');
      const ranking = prepared.getStaticRankingManifest(metric, scope); rankingManifests.push(ranking);
      for (const [scopeKey, entry] of Object.entries(ranking.scopes)) {
        const pages = [...new Set([1, Math.ceil(entry.totalPages / 2), Math.max(1, entry.totalPages)])];
        for (const page of pages) {
          queryCounter.phase('live-ranking-pages');
          const expected = scope === 'company' ? await getCompanyRankingPage(page) : await getSecurityRanksPage(metric, page, 'asc', scopeKey);
          queryCounter.phase('file-render');
          const actual = prepared.getStaticRankingPage(metric, scope, page, scopeKey);
          // Rank assets intentionally discard unused provider fields after compaction.
          compare(`ranking.${scope}.${scopeKey}.${metric}.${page}`, { ...actual, items: createRankingRows(actual.items, metric, scope) },
            { ...expected, items: createRankingRows(expected.items, metric, scope) });
          report.checked.rankingPages++;
        }
        if (entry.csv) {
          queryCounter.phase('live-csv');
          const expected = await getWholeRankingExport(scope, metric, undefined, scopeKey);
          expected.generatedAt = manifest.generatedAt;
          queryCounter.phase('file-render');
          const actual = fs.readFileSync(path.join(prepared.staticInputDirectory(), 'assets', entry.csv.url), 'utf8');
          const digest = value => crypto.createHash('sha256').update(value).digest('hex');
          compare(`csv.${scope}.${scopeKey}.${metric}`, digest(actual), digest(serializeRankingCsv(expected)));
          report.checked.csvFiles++;
        }
      }
    }
    report.routes = routeInventory(manifest, rankingManifests);
    compare('routeInventory', report.routes.actualPages, report.routes.expectedPages);
    queryCounter.phase('publication-validation');
    compareSource('after', await liveSource());
    report.success = report.failures.length === 0;
  } catch (error) {
    report.error = error.message;
    throw error;
  } finally {
    report.seconds = (performance.now() - started) / 1000;
    report.databaseQueries = queryCounter.snapshot();
    if (report.databaseQueries.phases['file-render'] !== 0) { report.success = false; report.failures.push({ name: 'file-render', expected: 0, actual: report.databaseQueries.phases['file-render'] }); }
    const destination = path.join(prepared.staticInputDirectory(), 'reports', 'input-parity.json');
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`);
    await closeDatabase();
    console.log(JSON.stringify({ success: report.success, checked: report.checked, routes: report.routes, databaseQueries: report.databaseQueries,
      failures: report.failures.slice(0, 20), seconds: report.seconds, report: destination }, null, 2));
  }
  if (!report.success) throw new Error(`Static input parity failed (${report.failures.length} mismatches)`);
  return report;
}

if (require.main === module) verifyStaticInput().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { verifyStaticInput, projectExpected, firstDifference, routeInventory, normalizeAuditTimestamps };
