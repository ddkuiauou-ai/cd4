const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { execFileSync } = require('node:child_process');
const { ROOT, STAGE, readJson, readManifest, relativeFile, sha256 } = require('./static-tools.cjs');
const { acquireStoreLock, jsonHash, operationPhase, planRelease, publishRelease, readRelease, writeReleaseBuildState } = require('./static-release-store.cjs');
const { RUNS, markReleaseRun, cleanReleaseRuns } = require('./clean-static-release.cjs');
const { createR2Client, r2Config, compareObjectResponse } = require('./static-r2-client.cjs');
const { buildRelease } = require('./build-static-release.cjs');

const CURRENT = 'cd-release/current.json';
const digest = /^[a-f0-9]{64}$/;
const commitHash = /^[a-f0-9]{40}$/;
const daySyntax = /^\d{4}-\d{2}-\d{2}$/;
const runName = /^release-[A-Za-z0-9]+$/;
const legacyDocument = /^(?:security\/[^/]+\/(?:(?:marketcap|per|pbr|bps|eps|div|dps)\/)?|company\/[^/]+\/(?:marketcap\/)?)index\.html$/;
const reviewKey = id => `cd-release/candidates/${id}.json`;

function seoulCalendar(now = new Date()) {
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${fields.year}-${fields.month}-${fields.day}`, firstSaturday: fields.weekday === 'Sat' && Number(fields.day) <= 7 };
}

function compareActive(left, right) {
  const active = inventory => {
    const byKey = new Map((inventory?.objects ?? []).map(row => [row.key, row]));
    return new Map((inventory?.activeKeys ?? [...byKey.keys()]).map(key => [key, byKey.get(key)]));
  };
  const current = active(left), candidate = active(right);
  const changed = [...candidate].filter(([key, record]) => JSON.stringify(record) !== JSON.stringify(current.get(key))).map(([key]) => key);
  const removed = [...current.keys()].filter(key => !candidate.has(key));
  return { changed, removed };
}

function batches(operations, chunk = 256) {
  const groups = new Map();
  for (const operation of operations) {
    const phase = operation.action === 'retire' ? 4 : operationPhase(operation.key);
    const group = groups.get(phase) ?? [];
    group.push(operation);
    groups.set(phase, group);
  }
  return [...groups].sort(([a], [b]) => a - b).flatMap(([phase, group]) => {
    const size = phase === 4 ? 1_000 : chunk;
    return Array.from({ length: Math.ceil(group.length / size) }, (_, i) => ({ phase, operations: group.slice(i * size, (i + 1) * size) }));
  });
}

async function bounded(items, limit, work) {
  let index = 0, failure;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!failure && index < items.length) {
      try { await work(items[index++]); } catch (error) { failure ??= error; }
    }
  });
  await Promise.all(workers);
  if (failure) throw failure;
}

async function getState(client, config) {
  const entry = await client.getJson(config.stateBucket, CURRENT);
  if (!entry) return { value: { version: 1, current: null, previous: null, pending: null }, etag: null };
  const { value } = entry;
  if (value.version !== 1 || [value.current, value.previous].filter(Boolean).some(row => !digest.test(row.releaseId) || !digest.test(row.candidateId)
    || !commitHash.test(row.commit) || !daySyntax.test(row.day))
    || (value.pending && (!digest.test(value.pending.id) || !Number.isSafeInteger(value.pending.next) || value.pending.next < 0))) {
    throw new Error('Invalid durable R2 release pointer');
  }
  return entry;
}

async function getDescriptor(client, config, id) {
  if (!digest.test(id ?? '')) throw new Error('Invalid candidate ID');
  const entry = await client.getJson(config.stateBucket, reviewKey(id));
  if (!entry || entry.value.version !== 1 || jsonHash(entry.value) !== id || !runName.test(entry.value.run)
    || !commitHash.test(entry.value.commit) || !daySyntax.test(entry.value.day)) {
    throw new Error('Invalid or missing release candidate');
  }
  if (jsonHash(entry.value.inventory) !== entry.value.releaseId) throw new Error('R2 release inventory digest mismatch');
  return entry.value;
}

async function checkActiveInventory(client, config, active) {
  if (!active) return;
  const descriptor = await getDescriptor(client, config, active.candidateId);
  if (descriptor.releaseId !== active.releaseId || descriptor.commit !== active.commit || descriptor.day !== active.day) {
    throw new Error('R2 active inventory differs from its success pointer');
  }
  return descriptor.inventory;
}

async function smokeRelease(client, config, request = fetch) {
  const { value: { current } } = await getState(client, config);
  if (!current) throw new Error('No completed release to verify');
  const inventory = await checkActiveInventory(client, config, current);
  const active = new Set(inventory.activeKeys ?? inventory.objects.map(object => object.key));
  const objects = new Map(inventory.objects.map(object => [object.key, object]));
  const paths = {
    samsungPer: '/security/KOSPI.005930/per/',
    marketCsv: `/downloads/market/${current.day}.csv`,
  };
  const targets = Object.entries(paths).map(([label, url]) => {
    const key = url.slice(1) + (url.endsWith('/') ? 'index.html' : '');
    return { label, url, object: active.has(key) ? objects.get(key) : undefined };
  });
  async function compare(read) {
    const checks = await Promise.all(targets.map(async ({ label, url, object }) => {
      if (!object) return [label, { result: 'missing-active-key' }];
      try { return [label, await read(object, url)]; }
      catch { return [label, { result: 'request-failed' }]; }
    }));
    return { verified: checks.every(([, result]) => result.sha256Matches && result.contentTypeMatches),
      objects: Object.fromEntries(checks) };
  }
  const bucket = await compare(object => client.verifyObject(config.publicBucket, object));
  const publicOrigin = config.publicOriginConfigured
    ? await compare(async (object, url) => compareObjectResponse(await request(new URL(url, config.origin), {
      credentials: 'omit', redirect: 'manual', cache: 'no-cache', signal: AbortSignal.timeout(30_000),
    }), object))
    : { verified: false, skipped: 'R2_PUBLIC_ORIGIN is not configured' };
  return { mode: 'smoke', day: current.day, bucket, publicOrigin };
}

async function register(client, config, descriptor) {
  const id = jsonHash(descriptor);
  try { await client.putJson(config.stateBucket, reviewKey(id), descriptor); }
  catch (error) {
    if (error.code !== 'R2_CONFLICT') throw error;
    await getDescriptor(client, config, id);
  }
  return id;
}

function fullOperations(plan) {
  const active = new Set(plan.inventory.activeKeys);
  return [...plan.inventory.objects.filter(object => active.has(object.key)).map(object => ({ action: 'put', ...object })),
    ...plan.operations.filter(operation => operation.action === 'retire')];
}

async function legacyRetirements(client, config, keys, identities) {
  const retired = [];
  for (const prefix of ['security/', 'company/']) {
    for await (const key of client.listKeys(config.publicBucket, prefix)) {
      const [kind, alias] = key.split('/');
      if (legacyDocument.test(key) && !keys.has(key) && (!identities || Object.hasOwn(identities[kind], alias))) {
        retired.push({ action: 'retire', key });
      }
    }
  }
  return retired.sort((a, b) => a.key < b.key ? -1 : Number(a.key > b.key));
}

function plannedCounts(operations) {
  const puts = operations.filter(row => row.action === 'put');
  return { putKeys: puts.length, putBytes: puts.reduce((total, row) => total + row.bytes, 0),
    deleteKeys: operations.length - puts.length };
}

async function executePending({ client, config, entry, descriptor, candidate, concurrency = 24 }) {
  let { value, etag } = entry;
  const pending = value.pending;
  if (!pending || pending.id !== jsonHash(descriptor) || pending.base !== (value.current?.releaseId ?? null)
    || descriptor.base !== pending.base || descriptor.baseCandidateId !== (value.current?.candidateId ?? null)) {
    throw new Error('R2 candidate base changed');
  }
  const ordered = batches(descriptor.operations);
  if (pending.next > ordered.length) throw new Error('Invalid R2 checkpoint');
  for (const operation of descriptor.operations) {
    relativeFile(operation.key);
    if (operation.action !== 'retire' && (operation.action !== 'put' || !digest.test(operation.sha256))) throw new Error('Invalid R2 key operation');
  }
  for (let index = pending.next; index < ordered.length; index++) {
    const group = ordered[index];
    if (group.phase === 4) await client.deleteKeys(config.publicBucket, group.operations.map(operation => operation.key));
    else await bounded(group.operations, concurrency, async operation => {
      const file = path.join(candidate, ...operation.key.split('/'));
      if (fs.statSync(file).size !== operation.bytes || sha256(file) !== operation.sha256) {
        throw new Error(`Candidate object changed: ${operation.key}`);
      }
      await client.putObject(config.publicBucket, operation, file);
    });
    value = { ...value, pending: { ...pending, next: index + 1 } };
    etag = await client.putJson(config.stateBucket, CURRENT, value, etag);
  }
  const current = { releaseId: descriptor.releaseId, candidateId: pending.id, commit: descriptor.commit, day: descriptor.day };
  const completed = { version: 1, current, previous: value.current, pending: null };
  await client.putJson(config.stateBucket, CURRENT, completed, etag);
  return completed;
}

function adoptLocal(store, descriptor) {
  const run = path.join(RUNS, descriptor.run);
  const candidate = path.join(run, 'out');
  const state = readJson(path.join(run, 'build-state.json'));
  const result = publishRelease({ candidate, root: store, expectedPrevious: descriptor.base,
    beforeCommit({ releaseId }) {
      if (releaseId !== descriptor.releaseId) throw new Error('Local candidate diverges from the R2 release');
      writeReleaseBuildState(store, releaseId, state);
    } });
  if (result.releaseId !== descriptor.releaseId) throw new Error('Local candidate diverges from the R2 release');
  if (!result.pointerWrites) writeReleaseBuildState(store, result.releaseId, state);
  markReleaseRun(run, store, 'published', [state.source, state.packInput, candidate]);
  return result;
}

async function deploy(options, { client, config, build = buildRelease } = {}) {
  const { mode, store, candidateId, retireLegacy, commit, concurrency = 24, day, input, inputCommit } = options;
  if (mode === 'smoke') return smokeRelease(client, config);
  const roles = ['public', 'state'];
  if (mode === 'status') {
    const probes = await Promise.allSettled(roles.map(role => client.probeBucket(config[role + 'Bucket'])));
    const buckets = Object.fromEntries(probes.map((result, index) => [roles[index], result.status === 'fulfilled'
      ? result.value : { readable: false, transportFailed: true }]));
    if (probes.some(result => result.status !== 'fulfilled' || !result.value.readable)) return { mode, buckets, readable: false };
    const entry = await getState(client, config);
    await checkActiveInventory(client, config, entry.value.current);
    return { mode, ...entry.value, buckets, readable: true };
  }
  if (mode === 'provision') {
    const unlock = acquireStoreLock(store, 'r2-operation');
    try {
      const stateBucket = await client.prepareBucket(config.stateBucket);
      const publicBucket = await client.prepareBucket(config.publicBucket);
      return { mode, buckets: { public: publicBucket.status, state: stateBucket.status } };
    } finally { unlock(); }
  }
  const checks = await Promise.allSettled(roles.map(role => client.checkBucket(config[role + 'Bucket'])));
  const faults = checks.flatMap((result, index) => result.status === 'rejected' ? [roles[index] + ': ' + result.reason.message] : []);
  if (faults.length) throw new Error('R2 bucket preflight failed (' + faults.join(', ') + ')');
  const unlock = acquireStoreLock(store, 'r2-operation');
  try {
    let entry = await getState(client, config);
    if (entry.value.pending && !['resume', 'promote'].includes(mode)) throw new Error('Resume the interrupted R2 release before starting another');
    if (mode === 'resume' && !entry.value.pending) {
      if (!entry.value.current) return { mode, ...plannedCounts([]) };
      const local = readRelease(store);
      if (local?.releaseId !== entry.value.current.releaseId) adoptLocal(store, await getDescriptor(client, config, entry.value.current.candidateId));
      return { mode, releaseId: entry.value.current.releaseId, ...plannedCounts([]) };
    }
    const base = entry.value.current?.releaseId ?? null;
    if (input && (mode !== 'full' || base || inputCommit !== commit || !daySyntax.test(day))) {
      throw new Error('Frozen input requires first full publication, the verified checkout commit and an explicit business day');
    }
    const local = readRelease(store);
    if ((local?.releaseId ?? null) !== base) throw new Error('Runner baseline differs from R2; run resume on the persistent runner');
    await checkActiveInventory(client, config, entry.value.current);
    let descriptor, id;
    if (mode === 'resume' || mode === 'promote') {
      id = mode === 'resume' ? entry.value.pending?.id : candidateId;
      if (entry.value.pending && entry.value.pending.id !== id) throw new Error('A different R2 candidate is pending');
      descriptor = await getDescriptor(client, config, id);
      if (mode === 'promote' && descriptor.mode !== 'verify') throw new Error('Only an independent review candidate can be promoted');
    } else {
      if (['daily', 'verify'].includes(mode) && !base) throw new Error('Publish a full R2 baseline first');
      if (mode === 'verify' && commit !== entry.value.current.commit) throw new Error('Independent verification requires the last successful commit');
      if (mode === 'daily' && commit !== entry.value.current.commit) {
        return { mode, requiresFull: true, reason: 'The checked-out commit differs from the last successful release.', ...plannedCounts([]) };
      }
      const targetDay = mode === 'verify' ? entry.value.current.day : day;
      if (input) {
        const manifest = readManifest({ filename: path.join(input, 'manifest.json') });
        if (!manifest.separatedCompanyAssets || !manifest.historyPacks || !digest.test(manifest.sourceIndexDigest)
          || manifest.referenceDate !== targetDay || manifest.marketCsv?.date !== targetDay
          || manifest.sample.selection !== 'full') throw new Error('Frozen input is not a complete canonical release for the requested day');
        const { digest: sourceDigest, ...index } = readJson(path.join(input, 'source-index.json'));
        if (sourceDigest !== manifest.sourceIndexDigest || jsonHash(index) !== sourceDigest) {
          throw new Error('Frozen input source index does not match its manifest');
        }
      }
      const report = await build({ store, input, daily: mode === 'daily', candidateOnly: true, clean: mode === 'verify',
        independent: mode === 'verify', day: targetDay });
      if (report.requiresFull) return { mode, requiresFull: true, reason: report.reason, ...plannedCounts([]) };
      if (report.unchanged) return { mode, releaseId: base, ...plannedCounts([]) };
      if (!daySyntax.test(report.day)) throw new Error('R2 publication requires a valid frozen business day');
      const plan = planRelease({ candidate: report.output, root: store, previous: local });
      const diff = compareActive(local?.inventory, plan.inventory);
      if (mode === 'verify' && !diff.changed.length && !diff.removed.length) {
        markReleaseRun(report.run, store, 'unchanged');
        try { cleanReleaseRuns({ store }); } catch (error) { console.warn('Local release cleanup deferred:', error.code ?? error.name); }
        return { mode, equal: true, releaseId: base, ...plannedCounts([]) };
      }
      const operations = mode === 'daily' ? plan.operations : fullOperations(plan);
      if (mode === 'full' && retireLegacy) {
        const already = new Set(operations.filter(op => op.action === 'retire').map(op => op.key));
        const { securityAliases, companyAliases } = readJson(path.join(report.source, 'manifest.json'));
        for (const operation of await legacyRetirements(client, config, new Set(plan.inventory.activeKeys), {
          security: securityAliases, company: companyAliases,
        })) {
          if (!already.has(operation.key)) operations.push(operation);
        }
      }
      let unmanagedIndex = false;
      if (!base) for await (const key of client.listKeys(config.publicBucket, 'index.html')) {
        if (key === 'index.html') { unmanagedIndex = true; break; }
      }
      descriptor = { version: 1, mode, run: path.basename(report.run), base, baseCandidateId: entry.value.current?.candidateId ?? null,
        releaseId: plan.releaseId, commit,
        day: report.day, inventory: plan.inventory, operations, unmanagedIndex };
      id = await register(client, config, descriptor);
      if (mode === 'verify') return { mode, equal: false, candidateId: id, releaseId: plan.releaseId,
        changedKeys: diff.changed.length, removedKeys: diff.removed.length, ...plannedCounts([]), promotion: plannedCounts(operations) };
      if (!operations.length) return { mode, releaseId: base, ...plannedCounts([]) };
    }
    if (descriptor.base !== base || descriptor.baseCandidateId !== (entry.value.current?.candidateId ?? null)) {
      throw new Error('Review candidate base is stale; build another candidate');
    }
    const candidate = path.join(RUNS, descriptor.run, 'out');
    if (!fs.existsSync(candidate)) throw new Error('Candidate unavailable on this runner; restore its dedicated release storage');
    if (!entry.value.pending) {
      const value = { ...entry.value, pending: { id, base, next: 0 } };
      entry = { value, etag: await client.putJson(config.stateBucket, CURRENT, value, entry.etag) };
    }
    await executePending({ client, config, entry, descriptor, candidate, concurrency });
    adoptLocal(store, descriptor);
    try { cleanReleaseRuns({ store }); } catch (error) { console.warn('Local release cleanup deferred:', error.code ?? error.name); }
    return { mode, candidateId: id, releaseId: descriptor.releaseId, day: descriptor.day, ...plannedCounts(descriptor.operations) };
  } finally { unlock(); }
}

function githubSummary(report) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    '### R2 ' + report.mode, '', `- 릴리스: ${report.releaseId ?? '—'}`,
    `- 후보: ${report.candidateId ?? '—'}`, `- PUT 키: ${report.putKeys ?? 0} (${report.putBytes ?? 0} bytes)`,
    `- 철회: ${report.deleteKeys ?? 0}`,
    ...(report.equal === false ? [`- 변경 ${report.changedKeys}, 제거 ${report.removedKeys}. 후보 ID로 promote를 실행해 검수본을 게시합니다.`] : []),
    ...(report.requiresFull ? [`- 전체 빌드 필요: ${String(report.reason).replace(/[\r\n]/g, ' ')}`] : []), '',
  ].join('\n') + '\n');
}

if (require.main === module) {
  Promise.resolve().then(async () => {
    const { values } = parseArgs({ options: { mode: { type: 'string' }, store: { type: 'string' }, day: { type: 'string' },
      input: { type: 'string' }, 'input-commit': { type: 'string' },
      'candidate-id': { type: 'string' }, 'retire-legacy': { type: 'boolean' }, 'first-saturday': { type: 'boolean' } } });
    if (!['full', 'daily', 'verify', 'promote', 'resume', 'status', 'provision', 'smoke'].includes(values.mode)) {
      throw new Error('Choose --mode full, daily, verify, promote, resume, status, provision or smoke');
    }
    if (values.input && (values.mode !== 'full' || !path.isAbsolute(values.input) || !values['input-commit'] || !values.day)) {
      throw new Error('--input requires an absolute path, --mode full, --input-commit and --day');
    }
    if (values['retire-legacy'] && values.mode !== 'full') throw new Error('Legacy HTML retirement requires --mode full');
    if (values['first-saturday'] && !seoulCalendar().firstSaturday) return;
    if (!process.env.STATIC_RELEASE_HOME) throw new Error('Set STATIC_RELEASE_HOME to the dedicated persistent runner directory');
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (!commitHash.test(commit)) throw new Error('Cannot resolve the checked-out commit');
    const config = r2Config();
    const client = createR2Client(config);
    const concurrency = Number(process.env.R2_PUT_CONCURRENCY ?? 24);
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 64) throw new Error('R2_PUT_CONCURRENCY must be between 1 and 64');
    const result = await deploy({ mode: values.mode, store: path.resolve(values.store ?? path.join(STAGE, 'r2-local-release')),
      commit, concurrency, candidateId: values['candidate-id'], retireLegacy: values['retire-legacy'],
      day: values.day, input: values.input, inputCommit: values['input-commit'] }, { client, config });
    if (values.mode === 'status' && result.readable && process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `release_commit=${result.current?.commit ?? ''}\nrelease_day=${result.current?.day ?? ''}\n`);
    }
    if (values.mode === 'status') {
      console.log(JSON.stringify({ mode: 'status', buckets: result.buckets,
        ...(result.readable ? { activeRelease: Boolean(result.current), interruptedRelease: Boolean(result.pending) } : {}),
        publicOrigin: config.origin.href }));
      if (!result.readable) process.exitCode = 1;
    } else if (values.mode === 'provision') {
      console.log(JSON.stringify(result));
    } else if (values.mode === 'smoke') {
      console.log(JSON.stringify(result));
      if (!result.bucket.verified || (config.publicOriginConfigured && !result.publicOrigin.verified)) process.exitCode = 1;
    } else {
      githubSummary(result);
      console.log(JSON.stringify(result));
    }
    if (result.requiresFull) process.exitCode = 2;
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { seoulCalendar, compareActive, batches, plannedCounts, executePending, legacyRetirements, deploy, smokeRelease };
