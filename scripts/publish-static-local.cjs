const path = require('node:path');
const fs = require('node:fs');
const { parseArgs } = require('node:util');
const { STAGE, readJson, writeJson } = require('./static-tools.cjs');
const { publishRelease, rollbackRelease, releaseBuildState, writeReleaseBuildState } = require('./static-release-store.cjs');
const { RUNS, markReleaseRun } = require('./clean-static-release.cjs');

try {
  const { values } = parseArgs({ options: { candidate: { type: 'string' }, store: { type: 'string' },
    'dry-run': { type: 'boolean' }, rollback: { type: 'boolean' }, 'replace-base': { type: 'boolean' }, report: { type: 'string' } } });
  if (Boolean(values.candidate) === Boolean(values.rollback)) {
    throw new Error('Usage: publish-static-local.cjs (--candidate <output> | --rollback) [--store <directory>] [--dry-run] [--report <report.json>]');
  }
  const options = { root: path.resolve(values.store ?? path.join(STAGE, 'local-release')), dryRun: values['dry-run'] };
  const statePath = values.candidate && path.join(path.dirname(path.resolve(values.candidate)), 'build-state.json');
  const candidateState = statePath && fs.existsSync(statePath) ? readJson(statePath) : null;
  if (candidateState?.sample && (!options.root.startsWith(STAGE + path.sep) || !path.basename(options.root).startsWith('fixture-'))) {
    throw new Error('Sample candidate must be confined to an isolated .static-build/fixture-* store');
  }
  if (values['replace-base'] && candidateState?.mode !== 'full') throw new Error('--replace-base requires a staged full build');
  const report = values.rollback ? rollbackRelease(options) : publishRelease({ ...options, candidate: values.candidate,
    expectedPrevious: values['replace-base'] ? undefined : candidateState?.baseReleaseId,
    beforeCommit(pending) {
      if (candidateState) writeReleaseBuildState(options.root, pending.releaseId, candidateState);
    },
  });
  if (!report.dryRun) {
    const state = values.rollback ? releaseBuildState(options.root, report.restoredReleaseId) : candidateState;
    if (state && (values.rollback || !report.pointerWrites)) writeReleaseBuildState(options.root, report.releaseId, state);
    if (candidateState && path.dirname(path.dirname(statePath)) === RUNS) {
      markReleaseRun(path.dirname(statePath), options.root, 'published');
    }
  }
  if (values.report) writeJson(path.resolve(values.report), report);
  console.log(JSON.stringify({
    releaseId: report.releaseId, totalObjects: report.totalObjects, dryRun: report.dryRun,
    putKeys: report.putKeys, putBytes: report.putBytes, deleteKeys: report.deleteKeys,
    objectWrites: report.objectWrites, bytesWritten: report.bytesWritten, pointerWrites: report.pointerWrites,
  }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
