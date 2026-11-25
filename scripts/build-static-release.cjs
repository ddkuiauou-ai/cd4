const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { parseArgs } = require('node:util');
const { setTimeout: sleep } = require('node:timers/promises');
const {
  ROOT, STAGE, readManifest, readJson, writeJson, sha256, filesBelow, outputFileForRoute, diskPreflight, sourceFingerprint, runtimeInfo,
} = require('./static-tools.cjs');
const { runNodeStage, syncWorkspace, selectBuildSettings } = require('./build-static.cjs');
const { augmentMarketInput } = require('./augment-static-market-input.cjs');
const { augmentDetailHistoryPacks } = require('./prepare-static-detail-history-packs.cjs');
const { blob, documentAssetKeys, isRsc, publishRelease, readRelease,
  acquireStoreLock, releaseBuildState, writeReleaseBuildState } = require('./static-release-store.cjs');
const { planRender, routeFingerprints } = require('./static-render-plan.cjs');
const { RUNS, markReleaseRun, cleanReleaseRuns } = require('./clean-static-release.cjs');

const storeState = 'build-state.json';
const metrics = ['marketcap', 'per', 'pbr', 'eps', 'bps', 'div', 'dps'];

async function waitForCompiler() {
  for (;;) {
    try { return acquireStoreLock(STAGE, 'release-compiler'); }
    catch (error) { if (error.code !== 'RELEASE_LOCK_BUSY') throw error; }
    await sleep(500);
  }
}

function prepareReleaseRoutes(workspace, manifest) {
  if (!manifest.securityCodes.length) fs.rmSync(path.join(workspace, 'app/security/[secCode]'), { recursive: true, force: true });
  if (!manifest.companyCodes.length) fs.rmSync(path.join(workspace, 'app/company/[secCode]'), { recursive: true, force: true });
  const routes = ['app/dashboard', 'app/company/[secCode]/(basic)', 'app/company/[secCode]/marketcap',
    ...metrics.map(metric => `app/security/[secCode]/${metric}`)];
  for (const route of routes) fs.rmSync(path.join(workspace, route, 'loading.tsx'), { force: true });
}

function linkFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try { fs.linkSync(source, target); }
  catch (error) {
    if (error.code !== 'EXDEV') throw error;
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL | fs.constants.COPYFILE_FICLONE);
  }
}

function rankingObjects(input) {
  const assets = new Set();
  const unavailable = new Set();
  for (const base of ['company-marketcap', ...metrics.map(metric => `security-${metric}`)]) {
    const rank = readJson(path.join(input, 'rankings', base + '.json'));
    const name = base === 'company-marketcap' ? 'companies-marketcap' : `securities-${rank.metric}`;
    if (rank.scopes['krx-all']?.state !== 'published') unavailable.add(`ranking-data/${name}.csv`);
    for (const scope of Object.values(rank.scopes)) {
      for (const url of [...Object.values(scope.pages), scope.csv?.url]) {
        if (url) assets.add(url.slice(1));
      }
    }
  }
  return { assets, unavailable };
}

function assembleCandidate({ output, input, manifest, changed, previous, store }) {
  const changedRoutes = new Set(changed);
  const { assets: dependencies, unavailable } = rankingObjects(input);
  for (const { path: address } of manifest.routes) {
    const key = outputFileForRoute(address);
    const file = path.join(output, key);
    const fixedEntry = address.split('/').filter(Boolean).length < 2;
    const old = previous?.objects.get(key);
    if (!fixedEntry && !changedRoutes.has(address) && old) {
      fs.rmSync(file, { force: true });
      linkFile(blob(store, old.sha256), file);
    }
    if (!fs.existsSync(file)) throw new Error(`Missing generated document: ${address}`);
    for (const asset of documentAssetKeys(fs.readFileSync(file, 'utf8'))) {
      if (asset.startsWith('static-data/')) dependencies.add(asset);
    }
  }
  for (const key of filesBelow(output)) {
    if (isRsc(key) || key === 'downloads/market/_unpublished' || unavailable.has(key)) fs.rmSync(path.join(output, key));
  }
  const inventory = new Map(manifest.assets.map(asset => [asset.path, asset]));
  for (const asset of dependencies) {
    const staged = inventory.get(asset);
    const file = path.join(output, asset);
    if (fs.existsSync(file)) continue;
    if (!staged) throw new Error(`Candidate references an unknown staged asset: ${asset}`);
    const source = path.join(input, 'assets', asset);
    if (fs.statSync(source).size !== staged.bytes || sha256(source) !== staged.sha256) {
      throw new Error(`Staged asset changed: ${asset}`);
    }
    linkFile(source, file);
  }
  for (const key of manifest.requiredFiles ?? []) if (!unavailable.has(key) && !fs.existsSync(path.join(output, key))) {
    throw new Error(`Missing required public file: ${key}`);
  }
  return dependencies.size;
}

async function buildRelease(options = {}) {
  runtimeInfo({ enforce: true });
  const root = path.resolve(options.store ?? path.join(STAGE, 'local-release'));
  const release = acquireStoreLock(root, 'build');
  try { return await buildLocked({ ...options, root }); }
  finally { release(); }
}

async function buildLocked({ input, previousInput, root, daily = false, candidateOnly = false, allowSample = false,
  clean = false, day, independent = false }) {
  if (allowSample && (!input || !root.startsWith(STAGE + path.sep) || !path.basename(root).startsWith('fixture-'))) {
    throw new Error('Sample release requires --input and a separate .static-build/fixture-* store');
  }
  const previous = readRelease(root);
  const state = releaseBuildState(root, previous?.releaseId);
  fs.mkdirSync(RUNS, { recursive: true });
  const run = fs.mkdtempSync(path.join(RUNS, 'release-'));
  markReleaseRun(run, root, 'building', [input, previousInput, state?.source, state?.packInput]);
  const report = { mode: daily ? 'daily' : 'full', run, stages: [] };
  const reportFile = path.join(run, 'report.json');
  const reserveBytes = diskPreflight(undefined, { inspectLegacyOutput: false }).reserveBytes;
  const sourceCode = sourceFingerprint();
  const workspace = path.join(STAGE, 'release-compiler-workspace');
  const compilerMatches = state?.compilerWorkspace === workspace && state?.sourceCode === sourceCode;
  const settings = selectBuildSettings({ fingerprint: sourceCode });
  const env = { ...process.env, NODE_ENV: 'production', NEXT_OUTPUT_MODE: 'export', NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_STATIC_DOCUMENTS: '1', STATIC_BUILD_PROJECT_ROOT: ROOT,
    STATIC_RELEASE_BUILD_ID: compilerMatches ? state.buildId ?? sourceCode : sourceCode,
    STATIC_BUILD_CPUS: settings.workers, STATIC_BUILD_CONCURRENCY: settings.concurrency,
    STATIC_BUILD_SAMPLE: '', STATIC_RELEASE_PARAMS: '', STATIC_BUILD_REUSE: '0', NEXT_PUBLIC_R2_PER_PILOT: '0' };
  try {
    let source = input && fs.realpathSync(input);
    let unchangedInput = false;
    const previousSource = independent ? null : previousInput ? fs.realpathSync(previousInput) : state?.source;
    if (!source) {
      source = path.join(run, 'source');
      try {
        report.stages.push(await runNodeStage('prepare', [path.join(__dirname, 'prepare-static.cjs')], {
          env: { ...env, STATIC_SNAPSHOT_DIR: source, STATIC_BUILD_COMPACT_PRIVATE: '1', STATIC_BUILD_SOURCE_INDEX: '1',
            STATIC_RELEASE_MODE: daily ? 'daily' : 'full', STATIC_RELEASE_DAY: day ?? '',
            STATIC_PREVIOUS_SNAPSHOT_DIR: previousSource ?? '' },
          reportDirectory: run, reserveBytes,
        }));
      } catch (error) {
        const status = path.join(source, 'prepare-status.json');
        if (error.stageReport) report.stages.push(error.stageReport);
        if (!fs.existsSync(status) || !readJson(status).requiresFull) throw error;
      }
      const status = path.join(source, 'prepare-status.json');
      if (fs.existsSync(status)) {
        const result = readJson(status);
        if (result.requiresFull) {
          Object.assign(report, result, { putKeys: 0, putBytes: 0, deleteKeys: 0 });
          markReleaseRun(run, root, 'failed');
          return report;
        }
        unchangedInput = Boolean(result.unchanged);
        source = result.input;
      }
    }
    if (!source) throw new Error('No complete frozen release input');
    report.source = source;
    const sourceManifest = readManifest({ allowSample, filename: path.join(source, 'manifest.json') });
    if (sourceManifest.perPilot) throw new Error('A PER pilot input cannot be used for a release build');
    if (day && !unchangedInput && sourceManifest.referenceDate !== day) throw new Error('Frozen source day differs from requested release day');
    report.day = sourceManifest.referenceDate;
    const prior = daily && compilerMatches;
    if (prior && source === state.source && sourceManifest.snapshotId === state.snapshotId) {
      if (readRelease(root)?.releaseId !== previous.releaseId) throw new Error('Current release changed while checking the source; retry');
      Object.assign(report, { success: true, unchanged: true, releaseId: previous.releaseId,
        putKeys: 0, putBytes: 0, deleteKeys: 0, objectWrites: 0, bytesWritten: 0, pointerWrites: 0 });
      markReleaseRun(run, root, 'unchanged');
      return report;
    }
    const marketInput = augmentMarketInput({ input: source, output: path.join(run, 'market-input'), allowSample });
    const packInput = augmentDetailHistoryPacks({ input: marketInput, output: path.join(run, 'packed-input'),
      previous: independent ? undefined : state?.packInput });
    const manifest = readManifest({ allowSample, filename: path.join(packInput, 'manifest.json') });
    const routes = routeFingerprints(packInput, manifest);
    let selection = planRender(routes, state?.routes, Boolean(prior));
    const envNext = { ...env, STATIC_SNAPSHOT_DIR: packInput };
    if (prior) {
      envNext.STATIC_RELEASE_PARAMS = path.join(run, 'render-params.json');
      writeJson(envNext.STATIC_RELEASE_PARAMS, selection.changed);
    }
    // Webpack includes generated app module locations in its numeric module IDs.
    // Keep the compiler path stable across releases and independent local stores.
    const baseReleaseId = previous?.releaseId ?? null;
    const candidateState = { source, packInput, sourceCode, routes, snapshotId: manifest.snapshotId,
      compilerWorkspace: workspace, buildId: envNext.STATIC_RELEASE_BUILD_ID,
      baseReleaseId, sample: manifest.sample.enabled, day: sourceManifest.referenceDate, mode: daily ? 'daily' : 'full' };
    let output, assets, result;
    function publishCandidate() {
      return publishRelease({ candidate: output, root, dryRun: candidateOnly, expectedPrevious: baseReleaseId,
        beforeCommit(pending) { writeReleaseBuildState(root, pending.releaseId, candidateState); } });
    }
    async function exportCandidate(name, reusePreview) {
      report.stages.push(await runNodeStage(name, [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build', '--webpack'], {
        cwd: workspace, env: envNext, reportDirectory: run, reserveBytes,
      }));
      output = path.join(run, 'out');
      candidateState.candidateOut = output;
      fs.renameSync(path.join(workspace, 'out'), output);
      assets = assembleCandidate({ output, input: packInput, manifest, changed: selection.changed,
        previous: reusePreview ? previous : null, store: root });
    }
    const releaseCompiler = await waitForCompiler();
    try {
      report.stages.push(syncWorkspace({ workspace }));
      if (sourceFingerprint(workspace) !== sourceCode) {
        throw new Error('Application source changed during preparation; rebuild using the closed frozen input');
      }
      prepareReleaseRoutes(workspace, manifest);
      if (clean) fs.rmSync(path.join(workspace, '.next'), { recursive: true, force: true });
      await exportCandidate('next-build', prior);
      try { result = publishCandidate(); }
      catch (error) {
        if (error.code !== 'IMMUTABLE_OBJECT_COLLISION' || !error.key.startsWith('_next/static/')) throw error;
        fs.renameSync(output, path.join(run, 'incompatible-out'));
        envNext.STATIC_RELEASE_PARAMS = '';
        envNext.STATIC_RELEASE_BUILD_ID = createHash('sha256').update(`${sourceCode}:${error.key}:${error.digest}`).digest('hex');
        candidateState.buildId = envNext.STATIC_RELEASE_BUILD_ID;
        selection = planRender(routes, state?.routes, false);
        await exportCandidate('next-build-full-fallback', false);
        result = publishCandidate();
        report.fallback = { reason: 'shared immutable object collision', key: error.key };
      }
    } finally {
      releaseCompiler();
    }
    writeJson(path.join(run, storeState), candidateState);
    if (!candidateOnly && result.pointerWrites === 0) writeReleaseBuildState(root, result.releaseId, candidateState);
    markReleaseRun(run, root, candidateOnly ? 'candidate' : 'published', [source, packInput, output]);
    if (!candidateOnly) {
      let unlock;
      try {
        unlock = acquireStoreLock(root, 'publish');
        report.cleanup = cleanReleaseRuns({ store: root });
      } catch (error) { report.runCleanupError = error.code ?? error.message; }
      finally { unlock?.(); }
    }
    Object.assign(report, { success: true, output, assets, selection, source, candidateOnly, ...result });
    return report;
  } catch (error) {
    report.error = error.message;
    markReleaseRun(run, root, 'failed');
    throw error;
  } finally {
    writeJson(reportFile, report);
    console.log('Release build report:', reportFile);
  }
}

if (require.main === module) {
  const { values } = parseArgs({ options: { input: { type: 'string' }, previous: { type: 'string' },
    store: { type: 'string' }, daily: { type: 'boolean' }, 'candidate-only': { type: 'boolean' }, 'allow-sample': { type: 'boolean' },
    clean: { type: 'boolean' }, day: { type: 'string' } } });
  buildRelease({ input: values.input, previousInput: values.previous, store: values.store, daily: values.daily,
    candidateOnly: values['candidate-only'], allowSample: values['allow-sample'], clean: values.clean, day: values.day }).then(report => {
      if (report.requiresFull) process.exitCode = 2;
      console.log(JSON.stringify({
    requiresFull: report.requiresFull, reason: report.reason,
    output: report.output, releaseId: report.releaseId, changedRoutes: report.selection?.changed.length ?? 0,
    putKeys: report.putKeys, putBytes: report.putBytes, deleteKeys: report.deleteKeys,
    objectWrites: report.objectWrites, bytesWritten: report.bytesWritten, pointerWrites: report.pointerWrites,
  })); }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { buildRelease, assembleCandidate };
