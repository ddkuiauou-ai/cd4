const fs = require('node:fs');
const path = require('node:path');
process.env.STATIC_PREPARING = '1';
process.env.NODE_ENV = 'production';
const root = path.resolve(__dirname, '..');
const nextRequire = require('node:module').createRequire(require.resolve('next/package.json'));
nextRequire('@next/env').loadEnvConfig(root, false, { info() {}, error() {} });
require('./register-typescript.cjs');
const { db, closeDatabase } = require('../db/index.ts');
const { readSnapshot } = require('../lib/data/publication.ts');
const { businessDate } = require('../lib/data/dto.ts');
const { securityRouteCodes } = require('../lib/entity-paths.ts');
const { createPreparedRankings } = require('../lib/static-build/ranking-snapshots.ts');
const { createRankingRows } = require('../lib/ranking-view.ts');
const { firstDifference } = require('./verify-static-input.cjs');
const { installQueryCounter } = require('./static-query-counter.cjs');
const input = require('../lib/static-build/server.ts');
const counter = installQueryCounter(db.$client);
const metrics = ['marketcap', 'per', 'pbr', 'eps', 'bps', 'div', 'dps'];

async function verify() {
  const manifest = input.getStaticManifest(), started = performance.now();
  const report = { success: false, snapshotId: manifest.snapshotId, pages: 0, rows: 0, failures: [] };
  try {
    let prepared;
    await readSnapshot(async tx => {
      counter.phase('inventory');
      const raw = { securities: await tx.query.security.findMany(), companies: await tx.query.company.findMany(),
        publications: await tx.query.resultPublication.findMany(), ranks: await tx.query.securityRank.findMany() };
      for (const publication of raw.publications) {
        if (manifest.sourceRevisions[publication.publicationKey] !== String(publication.revision)) throw new Error('Source revision changed after input preparation');
        if (manifest.sourcePublications?.[publication.publicationKey]?.asOf !== undefined
          && manifest.sourcePublications[publication.publicationKey].asOf !== businessDate(publication.asOf)) throw new Error('Source date changed after input preparation');
      }
      prepared = createPreparedRankings(raw, securityRouteCodes(raw.securities));
      counter.phase('ranking-prices'); await prepared.loadPrices(tx);
    });
    counter.phase('offline-page-comparison');
    for (const scope of ['security', 'company']) for (const metric of scope === 'company' ? ['marketcap'] : metrics) {
      const ranking = input.getStaticRankingManifest(metric, scope);
      for (const [scopeKey, entry] of Object.entries(ranking.scopes)) for (const page of Object.keys(entry.pages)) {
        const expected = input.getStaticRankingPage(metric, scope, Number(page), scopeKey);
        const actual = prepared.getPage(scope, metric, Number(page), scopeKey);
        const display = snapshot => ({ ...snapshot, items: createRankingRows(snapshot.items, metric, scope) });
        const difference = firstDifference(display(actual), display(expected));
        if (difference) report.failures.push({ scope, metric, scopeKey, page, ...difference });
        report.pages++; report.rows += expected.items.length;
      }
    }
    report.priceBatches = prepared.stats; report.success = report.failures.length === 0;
  } finally {
    report.seconds = (performance.now() - started) / 1000; report.databaseQueries = counter.snapshot();
    const destination = path.join(input.staticInputDirectory(), 'reports', 'ranking-batch-parity.json');
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, JSON.stringify(report, null, 2));
    await closeDatabase(); console.log(JSON.stringify({ ...report, failures: report.failures.slice(0, 10), report: destination }, null, 2));
  }
  if (!report.success) throw new Error(`Ranking batch parity failed (${report.failures.length} differences)`);
}
verify().catch(error => { console.error(error.message); process.exitCode = 1; });
