/* eslint-disable @typescript-eslint/no-require-imports -- Standalone rehearsal controller. */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');

const repo = fs.realpathSync(process.env.CD_REHEARSAL_APP_ROOT);
const load = name => require(path.join(repo, 'scripts', name + '.cjs'));
const home = fs.realpathSync(process.env.CD_REHEARSAL_HOME);
const stage = fs.realpathSync(process.env.STATIC_RELEASE_HOME);
if (process.env.RUNNER_OS !== 'Linux' || !home.startsWith(fs.realpathSync(process.env.RUNNER_TEMP) + path.sep)
  || !stage.startsWith(home + path.sep)) throw new Error('An isolated hosted Linux rehearsal directory is required');

const { buildRelease } = load('build-static-release');
const { deploy } = load('deploy-static-r2');
const { archiveSource } = load('static-portable-r2');
const { readJson, writeJson, relativeFile, sha256, sourceFingerprint } = load('static-tools');
const { jsonHash } = load('static-release-store');
const { execFileSync } = require('node:child_process');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const expected = readJson(path.resolve(__dirname, '../scripts/verify-october-benchmark-expectation.json'));
const appFingerprint = sourceFingerprint();
if (commit !== expected.appCommit || appFingerprint !== '4e7b25a62aa3361d58828db7cff07ef1c1e74828455ba37694c5ba79d47e4d10') {
  throw new Error('Rehearsal application does not match the published source');
}
const local = path.join(home, 'mock-object-store');
const stateFile = 'cd-release/current.json';
const day7 = '2026-10-07', day8 = '2026-10-08';
const config = { publicBucket: 'rehearsal-public', stateBucket: 'rehearsal-private', origin: new URL('https://local.invalid') };

function fileFor(bucket, key) {
  if (![config.publicBucket, config.stateBucket].includes(bucket)) throw new Error('Only local rehearsal buckets are allowed');
  return path.join(local, bucket, relativeFile(key));
}

const timings = {};
let privateArchiveStarted;
const stats = { publicPuts: 0, publicBytes: 0, deletes: 0, privatePutObjects: 0, privatePutBytes: 0 };
let sampleMin = Infinity;
function sample() {
  const { bavail, bsize } = fs.statfsSync(home);
  sampleMin = Math.min(sampleMin, bavail * bsize);
}
sample();
const meter = setInterval(sample, 2000);
meter.unref();
const runs = path.join(stage, 'release-builds');
const validStage = /^(?:prepare|publication-check|next-build(?:-[0-9]+|-full-fallback)?)$/;
const applicationLogs = () => fs.existsSync(runs) ? fs.readdirSync(runs).flatMap(run => {
  if (!/^release-[A-Za-z0-9]+$/.test(run)) return [];
  const directory = path.join(runs, run);
  return fs.readdirSync(directory).filter(file => file.endsWith('.log') && validStage.test(file.slice(0, -4)))
    .map(file => ({ name: file.slice(0, -4), time: fs.statSync(path.join(directory, file)).mtimeMs }));
}) : [];
const progress = setInterval(() => {
  const latest = applicationLogs().sort((a, b) => b.time - a.time)[0];
  const label = privateArchiveStarted != null ? 'private-archive'
    : stats.publicPuts > 0 ? 'local-public-replay'
      : latest?.name ?? 'initialize';
  // The workflow reserves fd 3 for allowlisted progress. Child logs stay private.
  fs.writeSync(3, JSON.stringify({ phase: label, minimumFreeBytes: sampleMin, localPublicPuts: stats.publicPuts }) + '\n');
}, 60_000);
progress.unref();
async function measure(name, task) {
  const start = performance.now();
  try { return await task(); }
  finally { timings[name] = (timings[name] ?? 0) + (performance.now() - start) / 1000; sample(); }
}
async function parallel(items, count, work) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(count, items.length) }, async () => {
    while (index < items.length) await work(items[index++]);
  }));
}

const client = {
  async checkBucket(bucket) { if (!Object.values(config).includes(bucket)) throw new Error('Unexpected local bucket'); },
  async getJson(bucket, key) {
    const file = fileFor(bucket, key);
    return fs.existsSync(file) ? { value: readJson(file), etag: sha256(file) } : null;
  },
  async putJson(bucket, key, value, etag = null) {
    if (privateArchiveStarted != null && key.startsWith('cd-release/candidates/')) {
      timings.dailyPrivateArchiveSeconds = (performance.now() - privateArchiveStarted) / 1000;
      privateArchiveStarted = undefined;
    }
    return measure(key === stateFile ? 'privatePointerSeconds' : 'privateJsonSeconds', () => {
      const file = fileFor(bucket, key);
      if ((fs.existsSync(file) ? sha256(file) : null) !== etag) {
        throw Object.assign(new Error('Local object changed'), { code: 'R2_CONFLICT' });
      }
      writeJson(file, value);
      return sha256(file);
    });
  },
  async putPrivateObject({ key, sha256: hash, bytes }, file) {
    return measure('privateBundleWriteSumSeconds', () => {
      const destination = fileFor(config.stateBucket, key);
      if (sha256(file) !== hash) throw new Error('Local bundle digest mismatch');
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      try { fs.linkSync(file, destination); stats.privatePutObjects++; stats.privatePutBytes += bytes; }
      catch (error) { if (error.code !== 'EEXIST' || sha256(destination) !== hash) throw error; }
    });
  },
  async getPrivateObject({ key, sha256: hash, bytes }, file) {
    return measure('privateBundleReadSumSeconds', () => {
      const source = fileFor(config.stateBucket, key);
      if (fs.statSync(source).size !== bytes || sha256(source) !== hash) throw new Error('Local bundle verification failed');
      fs.linkSync(source, file);
    });
  },
  async putObject(bucket, operation, file) {
    return measure('publicLocalReplaySumSeconds', () => {
      if (bucket !== config.publicBucket || fs.statSync(file).size !== operation.bytes) throw new Error('Unexpected public operation');
      stats.publicPuts++;
      stats.publicBytes += operation.bytes;
      // The durable local inventory holds the simulated public objects. The
      // production publisher verifies each payload from the private bundle.
    });
  },
  async deleteKeys(bucket, keys) {
    if (bucket === config.publicBucket) stats.deletes += keys.length;
    else for (const key of keys) fs.rmSync(fileFor(bucket, key), { force: true });
  },
  async *listPortableKeys() {
    // Retain all local verification inputs until the ephemeral runner exits.
  },
};

const safeName = key => key.startsWith('_next/static/') ? 'compiler'
  : key.endsWith('.html') ? 'html'
    : key.startsWith('downloads/market/') ? 'marketCsv'
      : key.endsWith('.csv') ? 'rankingCsv'
        : key.startsWith('static-data/') ? 'sharedJson'
          : /^(?:sitemaps?|search-data)/.test(key) ? 'discovery' : 'other';
const lexical = (a, b) => a < b ? -1 : Number(a > b);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const headerEntries = row => Object.entries(row.headers).sort(([a], [b]) => lexical(a, b));
const publicRecord = row => [row.key, row.bytes, row.sha256, headerEntries(row)];
function referenceKind(key) {
  if (key.endsWith('.html')) return 'html';
  if (key.startsWith('_next/static/')) return 'nextStatic';
  if (key.startsWith('static-data/') || key.startsWith('downloads/market/')) return 'businessAssets';
  if (key === 'search-data.json' || /^sitemaps?(?:[./-]|$)/.test(key)) return 'sitemapSearch';
  return 'other';
}
function aggregate(inventory) {
  const active = inventory.activeKeys ? new Set(inventory.activeKeys) : null;
  const rows = inventory.objects.filter(row => !active || active.has(row.key)).sort((a, b) => lexical(a.key, b.key));
  function summarize(list) {
    return { count: list.length, bytes: list.reduce((total, row) => total + row.bytes, 0),
      keySha256: digest(list.map(row => row.key)), recordSha256: digest(list.map(publicRecord)),
      bodySha256: digest(list.map(row => [row.key, row.bytes, row.sha256])),
      headerSha256: digest(list.map(row => [row.key, headerEntries(row)])) };
  }
  const categories = Object.fromEntries(Object.keys(expected.categories).map(kind => [kind,
    summarize(rows.filter(row => referenceKind(row.key) === kind))]));
  return { active: summarize(rows), categories, retainedKeys: inventory.objects.length - rows.length,
    retainedDatedCsv: inventory.objects.filter(row => active && !active.has(row.key) && safeName(row.key) === 'marketCsv').length };
}
function compareFields(reference, actual) {
  return Object.fromEntries(Object.keys(reference).map(key => [key, reference[key] === actual[key]]));
}
function metricsFile(mode, metrics) {
  writeJson(path.join(home, mode + '-metrics.json'), { appCommit: commit, appFingerprint, ...metrics });
}
function buildMetrics(report) {
  const manifest = readJson(path.join(report.source, 'manifest.json'));
  const stages = report.stages.map(stage => {
    let phaseTimings = stage.phaseTimings;
    if (!phaseTimings && /^next-build-\d+$/.test(stage.name) && stage.logPath) {
      const output = fs.readFileSync(stage.logPath, 'utf8').replace(/\u001b\[[0-9;]*m/g, '');
      const labels = { compile: /Compiled successfully in ([\d.]+)(ms|s|min)/,
        typecheck: /Finished TypeScript in ([\d.]+)(ms|s|min)/,
        render: /Generating static pages[^\n]* in ([\d.]+)(ms|s|min)/ };
      phaseTimings = Object.fromEntries(Object.entries(labels).flatMap(([label, regex]) => {
        const match = output.match(regex);
        return match ? [[label + 'Seconds', Number(match[1]) * { ms: 0.001, s: 1, min: 60 }[match[2]]]] : [];
      }));
    }
    return { name: stage.name, seconds: stage.seconds, code: stage.code, minimumDiskBytes: stage.disk?.minimumFreeBytes,
      peakRssBytes: stage.resources?.sampledPeakRssBytes, phaseTimings };
  });
  const queries = manifest.extraction?.databaseQueries;
  return { day: manifest.referenceDate, rows: manifest.marketCsv?.rowCount, affectedDocuments: report.selection?.changed.length,
    stages, databaseReads: queries && { statements: queries.total, phases: queries.phases, secondsByPhase: queries.phaseSeconds } };
}
function operationMetrics(ops) {
  const result = {};
  for (const { key, action, bytes } of ops) {
    const family = result[safeName(key)] ??= { puts: 0, bytes: 0, deletes: 0 };
    if (action === 'put') { family.puts++; family.bytes += bytes; } else family.deletes++;
  }
  return result;
}
async function full() {
  if (process.env.STATIC_RELEASE_POSTGRES_TLS || !/^postgres(?:ql)?:\/\/[^/]*@127\.0\.0\.1:\d+\//.test(process.env.DATABASE_URL ?? '')) {
    throw new Error('Full rehearsal must read the loopback cluster');
  }
  const report = await measure('fullBuildSeconds', () => buildRelease({ store: path.join(stage, 'store'),
    day: day7, candidateOnly: true, previousRelease: null, previousState: null, clean: true }));
  if (!report.success || report.day !== day7 || !report.plan || !report.state) throw new Error('October 7 full rehearsal did not complete');
  const descriptor = { version: 1, mode: 'full', run: path.basename(report.run), releaseId: report.releaseId, commit,
    day: day7, inventory: report.plan.inventory };
  descriptor.portable = await measure('fullPrivateArchiveSeconds', () => archiveSource({ client, state: report.state,
    run: descriptor.run, temporary: stage, parallel }));
  const candidateId = jsonHash(descriptor);
  await client.putJson(config.stateBucket, 'cd-release/candidates/' + candidateId + '.json', descriptor);
  await client.putJson(config.stateBucket, stateFile, { version: 1, current: { releaseId: descriptor.releaseId,
    candidateId, commit, day: day7, portable: descriptor.portable.head }, previous: null, pending: null });
  metricsFile('full', { ...buildMetrics(report), timings, ...aggregate(descriptor.inventory), minFreeBytes: sampleMin,
    localPortableBundleWrites: stats.privatePutObjects, localPortableBundleBytes: stats.privatePutBytes });
}
async function daily() {
  if (process.env.DATABASE_URL || process.env.STATIC_RELEASE_POSTGRES_TLS !== 'verify-full') throw new Error('Daily rehearsal requires explicit TLS production read fields');
  let metrics;
  const result = await measure('dailyTotalLocalReplaySeconds', () => deploy({ mode: 'daily', store: path.join(stage, 'store'), commit, day: day8 },
    { client, config, async build(options) {
      const restore = options.portable.restoreSource;
      options.portable.restoreSource = (...args) => measure('localPortableRestoreSeconds', () => restore(...args));
      const report = await measure('dailyBuildSeconds', () => buildRelease(options));
      if (!report.success || report.day !== day8 || !report.plan || !report.state) {
        const reason = typeof report.reason === 'string' && /^[a-z-]+$/.test(report.reason) ? report.reason : 'unspecified';
        throw new Error('October 8 daily did not build: ' + reason);
      }
      metrics = buildMetrics(report);
      privateArchiveStarted = performance.now();
      return report;
    } }));
  if (!result.putKeys || stats.publicPuts !== result.putKeys || stats.publicBytes !== result.putBytes || stats.deletes !== result.deleteKeys) {
    throw new Error('Daily replay operation totals did not match the production plan');
  }
  const { value: { current } } = await client.getJson(config.stateBucket, stateFile);
  const { value: descriptor } = await client.getJson(config.stateBucket, 'cd-release/candidates/' + current.candidateId + '.json');
  timings.dailyBuildUnattributedSeconds = Math.max(0, timings.dailyBuildSeconds - (timings.localPortableRestoreSeconds ?? 0)
    - metrics.stages.reduce((total, row) => total + (row.seconds ?? 0), 0));
  timings.dailyLocalPublicationAndCleanupSeconds = Math.max(0, timings.dailyTotalLocalReplaySeconds
    - timings.dailyBuildSeconds - (timings.dailyPrivateArchiveSeconds ?? 0));
  const actual = aggregate(descriptor.inventory);
  const { value: pointer } = await client.getJson(config.stateBucket, stateFile);
  const { value: baseline } = await client.getJson(config.stateBucket, 'cd-release/candidates/' + pointer.previous.candidateId + '.json');
  const oct7Csv = 'downloads/market/' + day7 + '.csv';
  const priorCsv = baseline.inventory.objects.find(row => row.key === oct7Csv);
  const retainedCsv = descriptor.inventory.objects.find(row => row.key === oct7Csv);
  const oct7DatedCsvRetained = Boolean(priorCsv && retainedCsv && !descriptor.inventory.activeKeys.includes(oct7Csv)
    && digest(publicRecord(priorCsv)) === digest(publicRecord(retainedCsv)));
  const comparison = { exact: expected.active.recordSha256 === actual.active.recordSha256,
    active: compareFields(expected.active, actual.active), oct7DatedCsvRetained,
    categories: Object.fromEntries(Object.entries(actual.categories)
      .map(([kind, fields]) => [kind, compareFields(expected.categories[kind], fields)])),
    samples: expected.samples.map(row => {
      const object = descriptor.inventory.objects.find(candidate => candidate.key === row.key);
      return { key: row.key, matches: Boolean(object && digest(publicRecord(row)) === digest(publicRecord(object))) };
    }) };
  metricsFile('daily', { ...metrics, timings, putKeys: result.putKeys, putBytes: result.putBytes, deleteKeys: result.deleteKeys,
    operations: operationMetrics(descriptor.operations), actual, comparison, minFreeBytes: sampleMin,
    expectedRelease: expected.referenceReleaseId, remoteR2Writes: 0, productionDbWrites: 0, simulated: stats });
  if (!comparison.exact || !oct7DatedCsvRetained || metrics.rows !== 2872) process.exitCode = 2;
}
(async () => {
  const mode = process.argv[2];
  if (mode === 'full') await full();
  else if (mode === 'daily') await daily();
  else throw new Error('Expected rehearsal mode full or daily');
})().catch(error => {
  const safe = /^(?:October [78] |Daily replay |Full rehearsal |Daily rehearsal )/.test(error.message) ? error.message : 'Rehearsal stage failed';
  const stages = fs.existsSync(path.join(stage, 'release-builds')) ? fs.readdirSync(path.join(stage, 'release-builds')).flatMap(run => {
    const filename = path.join(stage, 'release-builds', run, 'report.json');
    if (!fs.existsSync(filename)) return [];
    return readJson(filename).stages.map(({ name, seconds, code, signal, disk }) => ({ name, seconds, code, signal,
      stoppedForDisk: disk?.stoppedForDisk }));
  }) : [];
  if (process.argv[2] === 'full' || process.argv[2] === 'daily') {
    writeJson(path.join(home, process.argv[2] + '-failure.json'), { failure: safe, stages, timings, minFreeBytes: sampleMin });
  }
  console.error(safe);
  process.exitCode = 1;
}).finally(() => { clearInterval(meter); clearInterval(progress); });
