const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { ROOT, STAGE, OUT, WORKSPACE, MARKER, readJson, readManifest, writeJson, freeBytes, diskPreflight, sourceFingerprint, runtimeInfo } = require('./static-tools.cjs');
const { finalize } = require('./finalize-static.cjs');
const { verifyStatic } = require('./verify-static.cjs');

function resourceSummary(filename) {
  if (!fs.existsSync(filename)) return { sampledPeakRssBytes: null, samples: 0 };
  const entries = fs.readFileSync(filename, 'utf8').split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const live = new Map();
  const runtimes = new Map();
  let peak = 0;
  for (const entry of entries) {
    if (entry.event === 'start' && entry.nodeVersion && entry.execPath) {
      const key = `${entry.nodeVersion}:${entry.execPath}`;
      const runtime = runtimes.get(key) || { nodeVersion: entry.nodeVersion, execPath: entry.execPath, processes: new Set() };
      runtime.processes.add(entry.pid); runtimes.set(key, runtime);
    }
    if (entry.event === 'exit') live.delete(entry.pid);
    else live.set(entry.pid, entry);
    let current = 0;
    for (const [pid, row] of live) {
      if (entry.at - row.at > 6000) live.delete(pid);
      else current += row.rss;
    }
    peak = Math.max(peak, current);
  }
  return { sampledPeakRssBytes: peak, samples: entries.length,
    observedNodeRuntimes: [...runtimes.values()].map(runtime => ({ ...runtime, processes: [...runtime.processes].sort((a, b) => a - b) })),
    note: 'Sum of live Node process RSS sampled every 2 seconds; excludes non-Node native subprocesses and short-lived peaks.' };
}

function phaseTimings(logPath) {
  const log = fs.readFileSync(logPath, 'utf8').replace(/\u001b\[[0-9;]*m/g, '');
  const result = {};
  for (const [name, expression] of [
    ['compileSeconds', /Compiled successfully in ([\d.]+)(ms|s|min)/],
    ['typecheckSeconds', /Finished TypeScript in ([\d.]+)(ms|s|min)/],
    ['renderSeconds', /Generating static pages[^\n]* in ([\d.]+)(ms|s|min)/],
  ]) {
    const match = log.match(expression);
    if (match) result[name] = Number(match[1]) * ({ ms: 0.001, s: 1, min: 60 }[match[2]]);
  }
  return result;
}

async function runNodeStage(name, args, { env, reportDirectory, reserveBytes, cwd = ROOT }) {
  const logPath = path.join(reportDirectory, `${name}.log`);
  const resourceLog = path.join(reportDirectory, `${name}.resources.jsonl`);
  const log = fs.createWriteStream(logPath);
  const started = performance.now();
  const initialFreeBytes = freeBytes();
  let minimumFreeBytes = initialFreeBytes, stoppedForDisk = false;
  const hook = path.join(__dirname, 'static-resource-hook.cjs');
  const nodeOptions = `${env.NODE_OPTIONS || ''} --require ${JSON.stringify(hook)}`.trim();
  const child = spawn(process.execPath, args, { cwd, env: { ...env, NODE_OPTIONS: nodeOptions,
    PATH: [path.dirname(process.execPath), env.PATH].filter(Boolean).join(path.delimiter),
    STATIC_BUILD_RESOURCE_LOG: resourceLog }, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { process.stdout.write(chunk); log.write(chunk); });
  child.stderr.on('data', chunk => { process.stderr.write(chunk); log.write(chunk); });
  const stopChild = signal => {
    try { if (process.platform === 'win32') child.kill(signal); else process.kill(-child.pid, signal); } catch { /* The child may already have exited. */ }
  };
  const interrupt = () => stopChild('SIGINT');
  const terminate = () => stopChild('SIGTERM');
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', terminate);
  const diskSamples = [];
  const timer = setInterval(() => {
    try {
      const availableBytes = freeBytes();
      minimumFreeBytes = Math.min(minimumFreeBytes, availableBytes);
      diskSamples.push({ at: Date.now(), availableBytes });
      if (availableBytes < reserveBytes && !stoppedForDisk) { stoppedForDisk = true; stopChild('SIGTERM'); }
    } catch { /* The next regular filesystem operation still fails if the disk is unavailable. */ }
  }, 2000);
  const result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); })
    .finally(() => { clearInterval(timer); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate); log.end(); });
  await new Promise(resolve => { if (log.closed) resolve(); else log.once('close', resolve); });
  const resources = resourceSummary(resourceLog);
  const runtimeMismatch = resources.observedNodeRuntimes?.some(runtime => runtime.nodeVersion !== process.versions.node || runtime.execPath !== process.execPath);
  const report = { name, seconds: (performance.now() - started) / 1000, ...result, logPath, resourceLog,
    resources, ...(name === 'next-build' ? { phaseTimings: phaseTimings(logPath) } : {}),
    disk: { initialFreeBytes, minimumFreeBytes, sampledAdditionalAllocatedBytes: Math.max(0, initialFreeBytes - minimumFreeBytes), stoppedForDisk, samples: diskSamples } };
  writeJson(path.join(reportDirectory, `${name}.json`), report);
  if (result.code !== 0 || stoppedForDisk || runtimeMismatch) {
    const error = new Error(stoppedForDisk ? `Stopped ${name}: disk reserve crossed. Partial out/ is not a completed export.`
      : runtimeMismatch ? `${name} spawned an unexpected Node runtime; see ${resourceLog}` : `${name} failed (${result.signal || result.code}); see ${logPath}`);
    error.stageReport = report;
    throw error;
  }
  return report;
}

function syncWorkspace({ projectRoot = ROOT, workspace = WORKSPACE } = {}) {
  const started = performance.now();
  if (!workspace.startsWith(`${path.join(projectRoot, '.static-build')}${path.sep}`)) throw new Error('Static workspace must be inside .static-build');
  fs.mkdirSync(workspace, { recursive: true });
  if (fs.lstatSync(workspace).isSymbolicLink()) throw new Error('Static workspace cannot be a symbolic link');
  const exclusions = ['.git', 'node_modules', '.next', '.next-static', '.static-build', 'out', '.env*', '.pnpm-store', '.impeccable', '.kilo', '.vercel', '.aws', '.codex', '.agents'];
  // Excluded compiler/output directories survive --delete; source files mirror the current checkout.
  const result = spawnSync('rsync', ['-a', '--checksum', '--delete', ...exclusions.map(name => `--exclude=/${name}`), `${projectRoot}/`, `${workspace}/`], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Could not copy the static build workspace: ${result.stderr || result.error?.message || result.status}`);
  const dependencyLink = path.join(workspace, 'node_modules');
  const dependencies = fs.realpathSync(path.join(projectRoot, 'node_modules'));
  if (fs.existsSync(dependencyLink) || fs.lstatSync(dependencyLink, { throwIfNoEntry: false })) {
    if (!fs.lstatSync(dependencyLink).isSymbolicLink() || fs.realpathSync(dependencyLink) !== dependencies) throw new Error('Static workspace has an unexpected node_modules path');
  } else fs.symlinkSync(path.join(projectRoot, 'node_modules'), dependencyLink, 'dir');
  return { name: 'workspace-copy', seconds: (performance.now() - started) / 1000, directory: workspace,
    compilerDirectory: path.join(workspace, '.next'), exportDirectory: path.join(workspace, 'out') };
}

function publishOutput({ source = path.join(WORKSPACE, 'out'), output = OUT, backup = path.join(STAGE, 'previous-out') } = {}) {
  if (!fs.existsSync(path.join(source, 'index.html'))) throw new Error('Next has not created the workspace export');
  if (fs.existsSync(backup)) throw new Error(`Previous output backup still exists; preserve or inspect it before building: ${backup}`);
  const previous = fs.existsSync(output);
  if (previous) {
    const marker = readJson(path.join(output, MARKER));
    if (marker.version !== 1 || !marker.snapshotId) throw new Error('Existing out/ is not recognized as generated static output');
    fs.renameSync(output, backup);
  }
  try { fs.renameSync(source, output); }
  catch (error) { if (previous) fs.renameSync(backup, output); throw error; }
  return {
    commit() { if (previous) fs.rmSync(backup, { recursive: true }); },
    rollback() {
      // Retain the failed new export for diagnosis and restore the last completed output.
      fs.renameSync(output, source);
      if (previous) fs.renameSync(backup, output);
    },
  };
}

async function verifyAndPublishOutput({ source = path.join(WORKSPACE, 'out'), output = OUT,
  backup = path.join(STAGE, 'previous-out'), allowSample = false, compression = false,
  finalization = {}, verification = {} } = {}) {
  const finalizeStarted = performance.now();
  // Keep the completed root output untouched throughout every asynchronous check.
  finalize({ ...finalization, allowSample, output: source });
  const finalizeSeconds = (performance.now() - finalizeStarted) / 1000;
  const verified = await verifyStatic({ ...verification, allowSample, compression, output: source });
  const publication = publishOutput({ source, output, backup });
  publication.commit();
  return { verification: verified, finalizeSeconds };
}

function selectBuildSettings({ env = process.env, fingerprint = sourceFingerprint(), benchmarkPath = path.join(STAGE, 'reports', 'benchmark-latest.json') } = {}) {
  const explicitWorkers = env.STATIC_BUILD_CPUS !== undefined && env.STATIC_BUILD_CPUS !== '';
  const explicitConcurrency = env.STATIC_BUILD_CONCURRENCY !== undefined && env.STATIC_BUILD_CONCURRENCY !== '';
  if (explicitWorkers || explicitConcurrency) return {
    workers: env.STATIC_BUILD_CPUS || '4', concurrency: env.STATIC_BUILD_CONCURRENCY || '2',
    origin: 'environment', note: 'Explicit environment settings take priority; unspecified values use 4 workers / 2 concurrent pages.',
  };
  let benchmark;
  if (fs.existsSync(benchmarkPath)) {
    try { benchmark = readJson(benchmarkPath); } catch { /* A missing or invalid local report uses the conservative fallback. */ }
  }
  const valid = value => Number.isSafeInteger(value) && value > 0;
  if (benchmark?.success && benchmark.sourceFingerprint === fingerprint
    && valid(benchmark.selected?.workers) && valid(benchmark.selected?.concurrency)) return {
    workers: String(benchmark.selected.workers), concurrency: String(benchmark.selected.concurrency),
    origin: 'benchmark', benchmarkPath, benchmarkStartedAt: benchmark.startedAt,
    note: 'Selected by the completed benchmark for this exact source fingerprint.',
  };
  return { workers: '4', concurrency: '2', origin: 'default',
    note: 'No completed matching-source benchmark is available; fallback is 4 workers / 2 concurrent pages.' };
}

async function buildStatic({ allowSample = false, reuse = false, compression = false } = {}) {
  const started = performance.now();
  if (!allowSample && process.env.STATIC_BUILD_SAMPLE) throw new Error('build:static is a full export. Unset STATIC_BUILD_SAMPLE; use benchmark:static for samples.');
  const runtime = runtimeInfo({ enforce: true });
  const reportId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  const reportDirectory = path.join(STAGE, 'reports', reportId);
  fs.mkdirSync(reportDirectory, { recursive: true });
  const initialDisk = diskPreflight();
  const fingerprint = sourceFingerprint();
  const settings = selectBuildSettings({ fingerprint });
  const env = { ...process.env, NEXT_OUTPUT_MODE: 'export', NEXT_TELEMETRY_DISABLED: '1',
    STATIC_SNAPSHOT_DIR: STAGE, STATIC_BUILD_PROJECT_ROOT: ROOT,
    STATIC_BUILD_CPUS: settings.workers, STATIC_BUILD_CONCURRENCY: settings.concurrency };
  const report = { version: 1, reportId, success: false, runtime, mode: allowSample ? 'sample' : 'full',
    sourceFingerprint: fingerprint, settingsOrigin: settings.origin, settings, workers: Number(env.STATIC_BUILD_CPUS),
    concurrencyPerWorker: Number(env.STATIC_BUILD_CONCURRENCY), compilerCache: env.STATIC_BUILD_COMPILER_CACHE !== '0', reuse, stages: [] };
  try {
    report.stages.push(await runNodeStage('prepare', [path.join(__dirname, 'prepare-static.cjs'), ...(reuse ? ['--reuse'] : [])], {
      env, reportDirectory, reserveBytes: initialDisk.reserveBytes,
    }));
    const manifest = readManifest({ allowSample });
    if (allowSample && !manifest.sample.enabled) throw new Error('Benchmark/sample build requires a sample manifest');
    report.snapshotId = manifest.snapshotId;
    report.sample = manifest.sample;
    report.sourcePublications = manifest.sourcePublications;
    report.referenceDate = manifest.referenceDate;
    report.extraction = manifest.extraction;
    report.preflight = diskPreflight(manifest);
    report.stages.push(syncWorkspace());
    report.stages.push(await runNodeStage('next-build', [path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], {
      env, reportDirectory, reserveBytes: report.preflight.reserveBytes, cwd: WORKSPACE,
    }));
    const completed = await verifyAndPublishOutput({ allowSample, compression });
    report.stages.push({ name: 'finalize', seconds: completed.finalizeSeconds });
    report.verification = completed.verification;
    writeJson(path.join(STAGE, 'reports', 'verify-latest.json'), report.verification);
    report.success = true;
  } catch (error) {
    report.error = error.message;
    if (error.stageReport) report.stages.push(error.stageReport);
    error.buildReport = report;
    throw error;
  } finally {
    report.seconds = (performance.now() - started) / 1000;
    writeJson(path.join(reportDirectory, 'report.json'), report);
    writeJson(path.join(STAGE, 'reports', 'build-latest.json'), report);
    console.log(`Static build report: ${path.join(reportDirectory, 'report.json')}`);
  }
  return report;
}

if (require.main === module) {
  if (process.argv.includes('--full') && process.argv.includes('--sample')) { console.error('build:static cannot be turned into a sample build'); process.exitCode = 1; }
  else buildStatic({ allowSample: process.argv.includes('--sample'), reuse: process.argv.includes('--reuse'),
    compression: process.argv.includes('--compression') }).then(report => {
    console.log(JSON.stringify({ success: report.success, mode: report.mode, snapshotId: report.snapshotId,
      pages: report.verification.canonicalPages, outputBytes: report.verification.output.logicalBytes, seconds: report.seconds }, null, 2));
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { buildStatic, runNodeStage, syncWorkspace, publishOutput, verifyAndPublishOutput, selectBuildSettings, resourceSummary, phaseTimings };
