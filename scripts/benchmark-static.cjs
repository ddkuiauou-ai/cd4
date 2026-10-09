const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildStatic, runNodeStage } = require('./build-static.cjs');
const { ROOT, STAGE, WORKSPACE, readManifest, readJson, writeJson, filesBelow, directoryUsage,
  freeBytes, diskPreflight, sourceFingerprint, runtimeInfo } = require('./static-tools.cjs');

const median = values => { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
const compilerDirectory = path.join(WORKSPACE, '.next');
const cacheDirectory = path.join(compilerDirectory, 'cache');

function hashFiles(root, files) {
  const digest = crypto.createHash('sha256'), buffer = Buffer.alloc(64 * 1024);
  for (const file of files) {
    digest.update(`${file}\0`);
    const descriptor = fs.openSync(path.join(root, file), 'r');
    try { let size; while ((size = fs.readSync(descriptor, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, size)); }
    finally { fs.closeSync(descriptor); }
  }
  return digest.digest('hex');
}

function inputFingerprint(directory = STAGE) {
  const files = fs.readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.json')).map(entry => entry.name);
  for (const family of ['assets', 'data', 'rankings']) files.push(...filesBelow(path.join(directory, family)).map(file => `${family}/${file}`));
  return hashFiles(directory, files.sort());
}

function copyCache(source, destination, reserveBytes) {
  const usage = directoryUsage(source);
  if (freeBytes() < reserveBytes + usage.logicalBytes) throw new Error('Insufficient disk space to safely restore the benchmark compiler cache');
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(source)) fs.cpSync(source, destination, { recursive: true, mode: fs.constants.COPYFILE_FICLONE });
  else fs.mkdirSync(destination, { recursive: true });
  return { ...directoryUsage(destination), fingerprint: hashFiles(destination, filesBelow(destination)),
    copyMethod: 'Filesystem clone when supported; ordinary copy otherwise. Only compiler/typecheck cache is restored.' };
}

function summarize(runs) {
  const builds = runs.map(report => report.stages.find(stage => stage.name === 'next-build'));
  return { runs: runs.length, medianBuildSeconds: median(builds.map(stage => stage.seconds)),
    minimumBuildSeconds: Math.min(...builds.map(stage => stage.seconds)), maximumBuildSeconds: Math.max(...builds.map(stage => stage.seconds)),
    medianTotalSeconds: median(runs.map(report => report.seconds)),
    sampledPeakRssBytes: Math.max(...builds.map(stage => stage.resources.sampledPeakRssBytes || 0)),
    logicalBytes: runs.at(-1).verification.output.logicalBytes, byFamily: runs.at(-1).verification.output.byFamily,
    reportIds: runs.map(report => report.reportId) };
}

function selectCandidate(candidates) {
  if (!candidates.length) throw new Error('No benchmark candidate passed the static correctness gates');
  const fastest = Math.min(...candidates.map(row => row.medianBuildSeconds));
  return candidates.filter(row => row.medianBuildSeconds <= fastest * 1.05)
    .sort((left, right) => left.sampledPeakRssBytes - right.sampledPeakRssBytes || left.medianBuildSeconds - right.medianBuildSeconds)[0];
}

function diskFailure(error) {
  if (error.stageReport?.disk?.stoppedForDisk || /Insufficient disk|disk reserve|ENOSPC/i.test(error.message)) return true;
  return error.stageReport?.logPath && fs.existsSync(error.stageReport.logPath)
    && /ENOSPC|no space left on device/i.test(fs.readFileSync(error.stageReport.logPath, 'utf8'));
}

async function benchmarkStatic({ reuse = false, resume } = {}) {
  const runtime = runtimeInfo({ enforce: true });
  let directory = resume ? path.resolve(resume) : path.join(STAGE, 'reports', `benchmark-${Date.now()}`);
  if (directory.endsWith('.json')) directory = path.dirname(directory);
  if (!directory.startsWith(`${path.join(STAGE, 'reports')}${path.sep}`)) throw new Error('Benchmark reports must be inside .static-build/reports');
  const report = resume ? readJson(path.join(directory, 'benchmark.json')) : {
    version: 1, runtime, success: false, startedAt: new Date().toISOString(), compilerDirectory,
    sampleCount: Number(process.env.STATIC_BUILD_SAMPLE || 40), repeats: Number(process.env.STATIC_BUILD_BENCH_REPEATS || 3),
    candidates: [], attempts: {},
    selectionRule: 'Among verified candidates within 5% of the fastest median next-build time, prefer the lowest sampled peak RSS; then the lower time.',
  };
  if (!Number.isSafeInteger(report.sampleCount) || report.sampleCount < 40) throw new Error('STATIC_BUILD_SAMPLE must be a count of at least 40 securities');
  if (!Number.isSafeInteger(report.repeats) || report.repeats < 1 || report.repeats > 10) throw new Error('STATIC_BUILD_BENCH_REPEATS must be an integer from 1 to 10');
  if (!report.attempts || !Array.isArray(report.candidates)) throw new Error('Unsupported benchmark resume report');
  const previous = Object.fromEntries(['STATIC_BUILD_SAMPLE', 'STATIC_BUILD_CPUS', 'STATIC_BUILD_CONCURRENCY', 'STATIC_BUILD_COMPILER_CACHE'].map(key => [key, process.env[key]]));
  let interrupted = false;
  const interrupt = () => { interrupted = true; };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  report.resumeCommand = `pnpm benchmark:static --resume ${path.relative(ROOT, directory)}`;
  const save = () => { report.updatedAt = new Date().toISOString(); writeJson(path.join(directory, 'benchmark.json'), report); writeJson(path.join(STAGE, 'reports', 'benchmark-latest.json'), report); };
  const unchanged = run => {
    if (interrupted) throw new Error('Benchmark interrupted; completed measurements are checkpointed for resume');
    if (sourceFingerprint() !== report.sourceFingerprint || inputFingerprint() !== report.inputFingerprint
      || readManifest({ allowSample: true }).snapshotId !== report.snapshotId
      || (run && (run.sourceFingerprint !== report.sourceFingerprint || run.snapshotId !== report.snapshotId))) {
      throw new Error('Benchmark source or immutable input changed; start a new matrix after the changes settle');
    }
  };
  try {
    fs.mkdirSync(directory, { recursive: true });
    process.env.STATIC_BUILD_SAMPLE = String(report.sampleCount);
    process.env.STATIC_BUILD_CPUS = '2'; process.env.STATIC_BUILD_CONCURRENCY = '2'; process.env.STATIC_BUILD_COMPILER_CACHE = '1';
    const preflight = diskPreflight();
    report.status = 'running'; report.success = false; delete report.error; delete report.finishedAt;
    save();
    if (!resume) {
      report.prepare = await runNodeStage('prepare', [path.join(ROOT, 'scripts', 'prepare-static.cjs'), ...(reuse ? ['--reuse'] : [])], {
        env: { ...process.env, NEXT_OUTPUT_MODE: 'export', NEXT_TELEMETRY_DISABLED: '1', STATIC_SNAPSHOT_DIR: STAGE }, reportDirectory: directory, reserveBytes: preflight.reserveBytes,
      });
      const manifest = readManifest({ allowSample: true });
      if (!manifest.sample.enabled || manifest.sample.securities < 40) throw new Error('Prepared benchmark input contains fewer than 40 sample securities');
      report.snapshotId = manifest.snapshotId; report.sample = manifest.sample;
      report.sourceFingerprint = sourceFingerprint(); report.inputFingerprint = inputFingerprint();
      save();
    } else {
      if (report.runtime.node !== runtime.node || report.runtime.pnpm !== runtime.pnpm) throw new Error('Benchmark resume requires the same pinned runtime');
      unchanged();
    }
    if (!report.cold) {
      unchanged();
      report.active = { phase: 'cold', workers: 2, concurrency: 2 }; save();
      // A cold run discards only this task's generated compiler directory; root .next and out remain intact.
      fs.rmSync(compilerDirectory, { recursive: true, force: true });
      report.cold = await buildStatic({ allowSample: true, reuse: true, compression: true });
      unchanged(report.cold);
      report.cold.cacheCondition = 'workspace/.next removed; compiler filesystem cache enabled so the run also creates the common cache seed';
      save();
    }
    const seed = path.join(directory, 'cache-seed');
    if (!report.cacheSeed) {
      report.cacheSeed = copyCache(cacheDirectory, seed, preflight.reserveBytes);
      report.cacheSeed.fromReportId = report.cold.reportId;
      save();
    }
    if (!fs.existsSync(seed) || hashFiles(seed, filesBelow(seed)) !== report.cacheSeed.fingerprint) throw new Error('Immutable benchmark cache seed is missing or changed');
    async function candidate(workers, concurrency) {
      unchanged();
      const key = `${workers}x${concurrency}`;
      const attempt = report.attempts[key] ??= { workers, concurrency, status: 'pending', measurements: [] };
      if (attempt.status === 'complete') return report.candidates.find(row => row.workers === workers && row.concurrency === concurrency);
      if (attempt.status === 'excluded') return null;
      process.env.STATIC_BUILD_CPUS = String(workers); process.env.STATIC_BUILD_CONCURRENCY = String(concurrency);
      const primed = path.join(directory, `cache-${key}`);
      try {
        attempt.status = 'running';
        if (!attempt.prime || !attempt.primedCache) {
          report.active = { candidate: key, phase: 'prime' }; save();
          attempt.seedRestore = copyCache(seed, cacheDirectory, preflight.reserveBytes);
          attempt.prime = await buildStatic({ allowSample: true, reuse: true }); unchanged(attempt.prime);
          attempt.primedCache = copyCache(cacheDirectory, primed, preflight.reserveBytes);
          save();
        }
        if (!fs.existsSync(primed) || hashFiles(primed, filesBelow(primed)) !== attempt.primedCache.fingerprint) throw new Error('Primed candidate compiler cache is missing or changed');
        for (let index = attempt.measurements.length; index < report.repeats; index++) {
          unchanged(); report.active = { candidate: key, phase: 'warm', repeat: index + 1 }; save();
          const restoredCache = copyCache(primed, cacheDirectory, preflight.reserveBytes);
          const run = await buildStatic({ allowSample: true, reuse: true }); unchanged(run);
          run.restoredCompilerCache = restoredCache;
          attempt.measurements.push(run); save();
        }
        const row = { workers, concurrency, primeReportId: attempt.prime.reportId,
          cacheCondition: 'Common cold-run seed restored before candidate prime; the same immutable candidate-primed cache restored before every warm measurement.',
          primedCacheFingerprint: attempt.primedCache.fingerprint, ...summarize(attempt.measurements) };
        report.candidates.push(row); attempt.status = 'complete'; save();
        console.log(`Benchmark ${workers} workers × ${concurrency}: median ${row.medianBuildSeconds.toFixed(2)}s; output ${row.logicalBytes} bytes`);
        return row;
      } catch (error) {
        if (interrupted || diskFailure(error)) throw error;
        unchanged();
        attempt.status = 'excluded'; attempt.error = error.message;
        attempt.failedBuildReportId = error.buildReport?.reportId || null;
        attempt.failure = error.stageReport?.signal === 'SIGKILL' ? 'Process killed; possible OOM' : 'Build or correctness gate failed';
        save(); console.error(`Excluded benchmark ${key}: ${error.message}`);
        return null;
      }
    }
    for (const workers of [2, 4, 8]) await candidate(workers, 2);
    const selectedWorkers = selectCandidate(report.candidates).workers;
    for (const concurrency of [1, 2, 4, 8]) await candidate(selectedWorkers, concurrency);
    unchanged();
    const best = selectCandidate(report.candidates);
    report.selected = { workers: best.workers, concurrency: best.concurrency, medianBuildSeconds: best.medianBuildSeconds, sampledPeakRssBytes: best.sampledPeakRssBytes };
    report.success = true; report.status = 'complete'; delete report.active;
    report.fullBuildCommand = `STATIC_BUILD_CPUS=${best.workers} STATIC_BUILD_CONCURRENCY=${best.concurrency} pnpm build:static`;
    report.note = 'Sample-selected settings must pass the full export. Samples do not guarantee full-output duration, size, or memory. Failed candidates are excluded; disk failures stop the matrix. Published RSC/JS/CSS files are retained.';
  } catch (error) { report.error = error.message; report.status = interrupted ? 'interrupted' : 'failed'; throw error; }
  finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    report.finishedAt = new Date().toISOString(); save();
    console.log(`Benchmark report: ${path.join(directory, 'benchmark.json')}\nResume: ${report.resumeCommand}`);
  }
  return report;
}

if (require.main === module) {
  const resumeIndex = process.argv.indexOf('--resume');
  const resume = resumeIndex >= 0 ? process.argv[resumeIndex + 1] : undefined;
  if (resumeIndex >= 0 && (!resume || resume.startsWith('--'))) { console.error('--resume requires a benchmark report directory'); process.exitCode = 1; }
  else benchmarkStatic({ reuse: process.argv.includes('--reuse'), resume }).then(report => console.log(report.fullBuildCommand)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { benchmarkStatic, median, summarize, selectCandidate, inputFingerprint, hashFiles, copyCache, diskFailure };
