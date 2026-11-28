/* eslint-disable @typescript-eslint/no-require-imports -- Standalone rehearsal comparison. */
const fs = require('node:fs');
const { isDeepStrictEqual } = require('node:util');

function read(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function receipt(metrics, baseline) {
  const { appCommit, appFingerprint, day, rows, source, actual, samples, oct7DatedCsvRetained, archiveAudit } = metrics;
  return { appCommit, appFingerprint, day, rows, source, actual, samples, oct7DatedCsvRetained, archiveAudit,
    ...(baseline && { baseline: { day: baseline.day, rows: baseline.rows, source: baseline.source, active: baseline.active } }) };
}

function compare(daily, reference) {
  const exactSha = (a, b, field) => /^[a-f0-9]{64}$/.test(a?.[field] ?? '') && a[field] === b?.[field];
  const sameApp = /^[a-f0-9]{40}$/.test(daily.appCommit) && daily.appCommit === reference.appCommit
    && exactSha(daily, reference, 'appFingerprint');
  const sameDay = daily.day === '2026-10-08' && daily.day === reference.day;
  const samePublications = exactSha(daily.source, reference.source, 'publicationsSha256')
    && exactSha(daily.source, reference.source, 'sourceIndexDigest') && isDeepStrictEqual(daily.source.revisions, ['52'])
    && isDeepStrictEqual(daily.source.revisions, reference.source.revisions);
  const sameRows = daily.rows === 2872 && daily.rows === reference.rows && daily.baseline?.rows === daily.rows
    && daily.baseline?.day === '2026-10-07' && isDeepStrictEqual(daily.baseline.source?.revisions, ['51']);
  const sameActive = daily.actual?.active?.count > 0 && ['recordSha256', 'keySha256', 'bodySha256', 'headerSha256']
    .every(field => exactSha(daily.actual.active, reference.actual?.active, field))
    && isDeepStrictEqual(daily.actual.active, reference.actual.active);
  const sameFamilies = isDeepStrictEqual(daily.actual?.categories, reference.actual?.categories);
  const sameSamples = daily.samples?.length === 6 && daily.samples.every(row => /^[a-f0-9]{64}$/.test(row.recordSha256))
    && isDeepStrictEqual(daily.samples, reference.samples);
  const previousCsvRetained = daily.oct7DatedCsvRetained === true;
  const archiveRows = Object.values(daily.archiveAudit?.cohorts ?? {});
  const fullRows = Object.values(reference.archiveAudit?.cohorts ?? {});
  const independentFullRendered = reference.archiveAudit?.fallback === false && fullRows.length > 0
    && fullRows.every(row => row.routes === row.exported && row.routes === row.plannedRender && row.invalidDependencies === 0);
  const archivedCohorts = ['closedSecurity', 'companyWithoutListedMember'];
  const activeCohorts = ['listedSecurity', 'companyWithListedMember'];
  const archivesReused = daily.archiveAudit?.fallback === false
    && archivedCohorts.some(cohort => daily.archiveAudit.cohorts[cohort]?.retainedExact > 0)
    && archiveRows.every(row => row.skipped === row.retainedExact && row.invalidDependencies === 0)
    && activeCohorts.every(cohort => {
      const row = daily.archiveAudit.cohorts[cohort];
      return row?.plannedRender > 0 && row.plannedRender === row.exported;
    })
    && daily.archiveAudit.controls.some(row => row.key === 'security/KOSPI.005930/per/index.html'
      && row.plannedRender && row.exported)
    && daily.archiveAudit.evidence.some(row => archivedCohorts.includes(row.cohort) && row.dependencyCount > 0
      && exactSha(row, { previousSha256: row.currentSha256 }, 'previousSha256')
      && exactSha(row, { previousDependencySha256: row.dependencySha256 }, 'previousDependencySha256'));
  const checks = { sameApp, sameDay, samePublications, sameRows, sameActive, sameFamilies, sameSamples,
    previousCsvRetained, independentFullRendered, archivesReused };
  const result = { exact: Object.values(checks).every(Boolean), checks, appCommit: daily.appCommit,
    daily: daily.actual, independent: reference.actual, baseline: daily.baseline,
    archiveAudit: { daily: daily.archiveAudit, independent: reference.archiveAudit } };
  const summary = JSON.stringify(result, null, 2) + '\n';
  process.stdout.write(summary);
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (!result.exact) process.exitCode = 2;
}

const [, , mode, metricsPath, baselinePath] = process.argv;
if (mode === 'receipt') {
  const digest = receipt(read(metricsPath), baselinePath && read(baselinePath));
  process.stdout.write(JSON.stringify(digest) + '\n');
} else if (mode === 'compare') {
  compare(read(metricsPath), read(baselinePath));
} else throw new Error('Expected receipt or compare mode');
