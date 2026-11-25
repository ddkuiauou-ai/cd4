const fs = require('node:fs');
const path = require('node:path');
const { STAGE, readJson, writeJson } = require('./static-tools.cjs');
const { acquireStoreLock, readRelease, releaseBuildState } = require('./static-release-store.cjs');

const RUNS = path.join(STAGE, 'release-builds');
const OWNER = 'release-owner.json';
const heavy = ['source', 'market-input', 'packed-input', 'out', 'incompatible-out'];

function markReleaseRun(run, store, status, references = []) {
  const marker = path.join(run, OWNER);
  const prior = fs.existsSync(marker) ? readJson(marker) : null;
  writeJson(marker, { version: 1, store: prior?.store ?? store, stores: [...new Set([...(prior?.stores ?? []), store])],
    status, references: references.filter(Boolean).map(file => path.resolve(file)), pid: process.pid });
}

function live(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

function ownedRuns(base) {
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true }).filter(entry => entry.isDirectory() && /^release-[A-Za-z0-9]+$/.test(entry.name))
    .flatMap(entry => {
      const run = path.join(base, entry.name);
      const marker = path.join(run, OWNER);
      if (!fs.existsSync(marker) || fs.lstatSync(marker).isSymbolicLink()) return [];
      const note = readJson(marker);
      if (note.version !== 1 || typeof note.store !== 'string' || !path.isAbsolute(note.store)) return [];
      const status = note.status === 'building' && !live(note.pid) ? 'failed' : note.status;
      return [{ run, ...note, status, mtime: fs.statSync(marker).mtimeMs }];
    });
}

function releaseReferences(store) {
  const release = readRelease(store);
  if (!release) return [];
  return [release.releaseId, release.previousReleaseId].map(id => releaseBuildState(store, id)).filter(Boolean)
    .flatMap(state => [state.source, state.packInput, state.candidateOut].filter(Boolean));
}

function cleanReleaseRuns({ store, dryRun = false, base = RUNS }) {
  const root = path.resolve(store);
  const home = path.resolve(base);
  const runs = ownedRuns(home);
  const stores = [...new Set([root, ...runs.flatMap(run => run.stores ?? [run.store])])];
  const references = [...stores.flatMap(releaseReferences), ...runs.filter(run => ['building', 'candidate'].includes(run.status))
    .flatMap(run => run.references ?? [])].flatMap(file => fs.existsSync(file) ? [file, fs.realpathSync(file)] : [file]);
  const sourceRuns = runs.filter(run => run.store === root);
  const recentFailure = sourceRuns.filter(run => run.status === 'failed')
    .sort((a, b) => b.mtime - a.mtime)[0]?.run;
  const keep = ({ run, status }) => status === 'building' || status === 'candidate' || run === recentFailure
    || references.some(file => file === run || file.startsWith(run + path.sep));
  const retired = sourceRuns.filter(run => !keep(run) && ['published', 'failed', 'unchanged'].includes(run.status));
  const paths = retired.flatMap(entry => heavy.map(name => path.join(entry.run, name))).filter(file => fs.existsSync(file));
  if (!dryRun) for (const file of paths) fs.rmSync(file, { recursive: true, force: true });
  return { dryRun, reclaimedPaths: paths, keptRuns: sourceRuns.filter(keep).map(entry => entry.run) };
}

if (require.main === module) {
  const { parseArgs } = require('node:util');
  try {
    const { values } = parseArgs({ options: { store: { type: 'string' }, 'dry-run': { type: 'boolean' } } });
    const store = path.resolve(values.store ?? path.join(STAGE, 'local-release'));
    if (values['dry-run']) console.log(JSON.stringify(cleanReleaseRuns({ store, dryRun: true })));
    else {
      const unlockBuild = acquireStoreLock(store, 'build');
      try {
        const unlockPublish = acquireStoreLock(store, 'publish');
        try { console.log(JSON.stringify(cleanReleaseRuns({ store }))); }
        finally { unlockPublish(); }
      } finally { unlockBuild(); }
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { RUNS, markReleaseRun, cleanReleaseRuns };
