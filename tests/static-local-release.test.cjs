const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createHash } = require('node:crypto');
const { acquireStoreLock, blob, publishRelease, readRelease, rollbackRelease, writeReleaseBuildState } = require('../scripts/static-release-store.cjs');
const { createReleaseServer } = require('../scripts/preview-static-release.cjs');
const { cleanReleaseRuns, markReleaseRun } = require('../scripts/clean-static-release.cjs');

function sandbox(t, beforeRemove) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-local-release-'));
  t.after(async () => {
    await beforeRemove?.();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

function generate(root, objects) {
  for (const [key, value] of Object.entries(objects)) {
    const file = path.join(root, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
  }
}

function asset(value) {
  const hash = createHash('sha256').update(value).digest('hex');
  return `static-data/shared/${hash.slice(0, 2)}/${hash.slice(0, 20)}.json`;
}

test('a killed publisher leaves the last release active and reuses already stored blobs on retry', async t => {
  const dir = sandbox(t), store = path.join(dir, 'store'), first = path.join(dir, 'first'), second = path.join(dir, 'second');
  generate(first, { 'index.html': 'first', 'obsolete/index.html': 'obsolete',
    'downloads/market/2026-10-08.csv': '\uFEFF기준일,종목코드\n2026-10-08,005930' });
  generate(second, { 'index.html': 'second', 'added/index.html': 'new' });
  const initial = publishRelease({ root: store, candidate: first });
  const target = publishRelease({ root: store, candidate: second, dryRun: true });
  assert.deepEqual(target.changedKeys, ['added/index.html', 'index.html']);
  assert.deepEqual(target.deletedKeys, ['obsolete/index.html']);
  assert.equal(target.pointerWrites, 0);
  assert.equal(readRelease(store).releaseId, initial.releaseId);

  const script = `
    const { publishRelease } = require(process.argv[1]);
    publishRelease({ root: process.argv[2], candidate: process.argv[3], beforeCommit() {
      process.stdout.write('stored');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    } });
  `;
  const child = spawn(process.execPath, ['-e', script, require.resolve('../scripts/static-release-store.cjs'), store, second],
    { stdio: ['ignore', 'pipe', 'inherit'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const progress = await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(result => result)]);
  assert.equal(String(progress[0]), 'stored');
  child.kill('SIGKILL');
  await once(child, 'exit');
  assert.equal(readRelease(store).releaseId, initial.releaseId);

  const repeated = publishRelease({ root: store, candidate: second });
  assert.equal(repeated.releaseId, target.releaseId);
  assert.equal(repeated.pointerWrites, 1);
  assert.equal(repeated.objectWrites, 0);
  assert.throws(() => publishRelease({ root: store, candidate: first, expectedPrevious: initial.releaseId }), /candidate build base/);
  const building = acquireStoreLock(store, 'build');
  assert.throws(() => acquireStoreLock(store, 'build'), { code: 'RELEASE_LOCK_BUSY' });
  building();
  const committed = readRelease(store);
  assert.ok(committed.objects.has('downloads/market/2026-10-08.csv'));
  assert.ok(!committed.objects.has('obsolete/index.html'));
  const noop = publishRelease({ root: store, candidate: second, expectedPrevious: initial.releaseId });
  assert.deepEqual([noop.changedKeys, noop.deletedKeys, noop.objectWrites, noop.pointerWrites], [[], [], 0, 0]);

  const currentBlob = blob(store, committed.objects.get('index.html').sha256);
  fs.writeFileSync(currentBlob, 'broken');
  assert.throws(() => publishRelease({ root: store, candidate: second }), /digest mismatch/);
  assert.equal(readRelease(store).releaseId, repeated.releaseId);
  generate(second, { 'manifest.json': '{}' });
  assert.throws(() => publishRelease({ root: store, candidate: second }), /Unexpected public JSON/);
});

test('object-only preview serves stable keys, typed assets and actual public text', async t => {
  let server;
  const dir = sandbox(t, () => server?.listening && new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const store = path.join(dir, 'store'), candidate = path.join(dir, 'candidate'), logDirectory = path.join(dir, 'logs');
  const log = path.join(logDirectory, 'requests.jsonl');
  fs.mkdirSync(logDirectory);
  generate(candidate, {
    'index.html': 'front', '404.html': 'absent', 'per/index.html': 'stock', 'per/index.txt': 'generated',
    'per/__next._full.txt': 'generated', 'robots.txt': 'allowed', 'ads.txt': 'ads',
    '_next/static/chunks/app.js': 'App()', [asset('{}')]: '{}',
    'downloads/market/2026-10-08.csv': '\uFEFF기준일,종목코드\n2026-10-08,005930',
  });
  const result = publishRelease({ root: store, candidate });
  assert.equal(result.changedKeys.length, 8);
  server = createReleaseServer({ root: store, requestLog: log });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const file = await fetch(base + '/downloads/market/2026-10-08.csv');
  assert.equal(file.headers.get('x-market-row-count'), '1');
  assert.match(file.headers.get('content-disposition'), /2026-10-08\.csv/);
  assert.match(file.headers.get('cache-control'), /must-revalidate/);
  assert.equal((await file.arrayBuffer()).byteLength, Number(file.headers.get('content-length')));
  const unchanged = await fetch(base + '/downloads/market/2026-10-08.csv', { headers: { 'If-None-Match': file.headers.get('etag') } });
  assert.equal(unchanged.status, 304);
  const redirection = await fetch(base + '/per?period=2020', { redirect: 'manual' });
  assert.equal(redirection.status, 308);
  assert.equal(redirection.headers.get('location'), '/per/?period=2020');
  assert.equal(await (await fetch(base + '/per/')).text(), 'stock');
  assert.equal(await (await fetch(base + '/ads.txt')).text(), 'ads');
  assert.equal(await (await fetch(base + '/robots.txt')).text(), 'allowed');
  const script = await fetch(base + '/_next/static/chunks/app.js');
  assert.match(script.headers.get('cache-control'), /immutable/);
  await script.text();
  assert.equal((await fetch(base + '/per/index.txt')).status, 404);
  assert.equal((await fetch(base + '/per/?_rsc=x')).status, 404);
  assert.equal((await fetch(base + '/data/market-download.csv')).status, 404);
  const entries = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(entries.filter(row => row.requestClass === 'rsc').length, 2);
  assert.ok(entries.find(row => row.key === 'per/index.html' && row.releaseId === result.releaseId));
  const warn = t.mock.method(console, 'warn', () => {});
  fs.rmSync(logDirectory, { recursive: true });
  assert.equal(await (await fetch(base + '/per/')).text(), 'stock');
  assert.equal(await (await fetch(base + '/')).text(), 'front');
  assert.equal(warn.mock.callCount(), 1);
});

test('ordered forward and rollback key replay keeps linked data available, with bounded retention', t => {
  const dir = sandbox(t), root = path.join(dir, 'store'), first = path.join(dir, 'first'), second = path.join(dir, 'second'),
    third = path.join(dir, 'third'), fourth = path.join(dir, 'fourth');
  const historyFirst = asset('{"close":"1"}');
  const historySecond = asset('{"close":"2"}');
  const historyThird = asset('{"close":"3"}');
  const listed = 'downloads/market/2026-10-08.csv';
  const create = (directory, key, value, extra = {}) => generate(directory, {
    'index.html': `<a href="/${key}">${value}</a>`, [key]: value, 'sitemap.xml': value, ...extra,
  });
  create(first, historyFirst, '{"close":"1"}', {
    'retired/index.html': 'page to retire', [listed]: '\uFEFF기준일,종목코드\n2026-10-08,005930',
  });
  create(second, historySecond, '{"close":"2"}');
  create(third, historyThird, '{"close":"3"}');
  create(fourth, historyThird, '{"close":"3"}', { 'new/index.html': 'changed HTML' });
  const initial = publishRelease({ root, candidate: first });
  const replay = new Map();
  function run(operations) {
    for (const operation of operations) {
      if (operation.action === 'retire') replay.delete(operation.key);
      else replay.set(operation.key, operation.sha256);
      const index = replay.get('index.html');
      if (!index) continue;
      const html = fs.readFileSync(blob(root, index), 'utf8');
      const key = html.match(/href="\/([^"]+)"/)?.[1];
      assert.ok(replay.has(key), `missing link during ${operation.action} of ${operation.key}: ${key}`);
    }
  }
  run(initial.operations);
  const next = publishRelease({ root, candidate: second });
  assert.deepEqual(next.operations.map(op => op.key), [historySecond, 'index.html', 'sitemap.xml', 'retired/index.html']);
  run(next.operations);
  assert.ok(replay.has(historyFirst));
  const rollback = rollbackRelease({ root });
  run(rollback.operations);
  assert.equal(rollback.restoredReleaseId, initial.releaseId);
  assert.ok(readRelease(root).objects.has(historySecond));
  assert.ok(replay.has('retired/index.html'));
  assert.equal(replay.get('index.html'), readRelease(root).objects.get('index.html').sha256);
  assert.equal(rollback.pointerWrites, 1);
  const reapply = publishRelease({ root, candidate: second });
  run(reapply.operations);
  assert.equal(reapply.releaseId, next.releaseId);
  const onward = publishRelease({ root, candidate: third });
  run(onward.operations);
  assert.ok(onward.deletedKeys.includes(historyFirst));
  assert.ok(fs.existsSync(blob(root, next.operations.find(op => op.key === historySecond).sha256)));
  assert.ok(readRelease(root).objects.has(listed));
  const clean = publishRelease({ root, candidate: fourth });
  run(clean.operations);
  assert.ok(clean.deletedKeys.includes(historySecond));
  assert.equal(fs.readdirSync(path.join(root, 'releases')).length, 2);
});

test('planned PUT counts include equal-byte aliases and cleanup preserves proven release dependencies', t => {
  const dir = sandbox(t), root = path.join(dir, 'store'), secondary = path.join(dir, 'other'), base = path.join(dir, 'runs');
  const runs = Object.fromEntries(['active', 'prior', 'orphan', 'pending', 'referenced', 'unmarked'].map(name => [
    name, path.join(base, 'release-' + name),
  ]));
  for (const run of Object.values(runs)) generate(run, { 'source/archive.json': 'private' });
  for (const name of ['active', 'prior', 'orphan', 'referenced']) markReleaseRun(runs[name], root, 'published');
  markReleaseRun(runs.pending, secondary, 'candidate', [path.join(runs.referenced, 'source')]);
  generate(path.join(runs.prior, 'out'), { 'index.html': 'same', 'alias-a/index.html': 'same', 'alias-b/index.html': 'same' });
  generate(path.join(runs.active, 'out'), { 'index.html': 'new' });
  const first = publishRelease({ candidate: path.join(runs.prior, 'out'), root });
  assert.equal(first.putKeys, 3);
  assert.equal(first.putBytes, 12);
  assert.equal(first.objectWrites, 1);
  assert.equal(first.bytesWritten, 4);
  writeReleaseBuildState(root, first.releaseId, { source: path.join(runs.prior, 'source') });
  const second = publishRelease({ candidate: path.join(runs.active, 'out'), root });
  writeReleaseBuildState(root, second.releaseId, { candidateOut: path.join(runs.active, 'out') });
  assert.equal(second.deleteKeys, 2);
  const plan = cleanReleaseRuns({ store: root, dryRun: true, base });
  assert.deepEqual(plan.reclaimedPaths, [path.join(runs.orphan, 'source')]);
  assert.ok(fs.existsSync(path.join(runs.orphan, 'source')));
  assert.deepEqual(cleanReleaseRuns({ store: root, base }).reclaimedPaths, plan.reclaimedPaths);
  assert.ok(!fs.existsSync(path.join(runs.orphan, 'source')));
  for (const name of ['active', 'prior', 'pending', 'referenced', 'unmarked']) {
    assert.ok(fs.existsSync(path.join(runs[name], 'source')), name);
  }
});
