const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-r2-test-'));
process.env.STATIC_RELEASE_HOME = home;
test.after(() => fs.rmSync(home, { recursive: true, force: true }));
const { RUNS, markReleaseRun } = require('../scripts/clean-static-release.cjs');
const { deploy, compareActive, seoulCalendar } = require('../scripts/deploy-static-r2.cjs');
const { r2Config, createR2Client } = require('../scripts/static-r2-client.cjs');

const commit = '1'.repeat(40);
const stateFile = 'cd-release/current.json';
const config = { stateBucket: 'private-test', publicBucket: 'public-test', origin: new URL('https://www.chundan.xyz') };
const signature = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function memoryR2() {
  const values = new Map(), publicKeys = new Map(), puts = [], deletes = [];
  let failKey;
  const client = {
    async checkBucket(bucket) { assert.ok([config.publicBucket, config.stateBucket].includes(bucket)); },
    async probeBucket(bucket) { await client.checkBucket(bucket); return { headHttp: 200, listHttp: 200, readable: true }; },
    async getJson(_bucket, key) { return values.has(key) ? structuredClone(values.get(key)) : null; },
    async putJson(bucket, key, value, etag = null) {
      assert.equal(bucket, config.stateBucket);
      if ((values.get(key)?.etag ?? null) !== etag) throw Object.assign(Error('conflict'), { code: 'R2_CONFLICT' });
      const newTag = signature(value);
      values.set(key, { value: structuredClone(value), etag: newTag });
      return newTag;
    },
    async putObject(bucket, object, file) {
      assert.equal(bucket, config.publicBucket);
      if (failKey === object.key) throw Error('simulated transport outage');
      puts.push(object.key);
      publicKeys.set(object.key, { body: fs.readFileSync(file, 'utf8'), headers: object.headers });
    },
    async deleteKeys(bucket, keys) {
      assert.equal(bucket, config.publicBucket);
      deletes.push(keys);
      for (const key of keys) publicKeys.delete(key);
    },
    async *listKeys(bucket, prefix) {
      assert.equal(bucket, config.publicBucket);
      for (const key of publicKeys.keys()) if (key.startsWith(prefix)) yield key;
    },
  };
  return { client, publicKeys, puts, deletes, values, outage(key) { failKey = key; } };
}

function candidate(day, revision, calls) {
  return async options => {
    calls.push(options);
    fs.mkdirSync(RUNS, { recursive: true });
    const run = fs.mkdtempSync(path.join(RUNS, 'release-'));
    const output = path.join(run, 'out'), source = path.join(run, 'source');
    fs.mkdirSync(path.join(output, 'downloads/market'), { recursive: true });
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'manifest.json'), JSON.stringify({ securityAliases: { 'known alias': 'sid' }, companyAliases: {} }));
    fs.writeFileSync(path.join(output, 'index.html'), '<p>' + revision + '</p>');
    fs.writeFileSync(path.join(output, 'robots.txt'), 'User-agent: *');
    fs.writeFileSync(path.join(output, 'downloads', 'market', day + '.csv'), '﻿기준일,종목코드\n' + day + ',005930');
    fs.writeFileSync(path.join(run, 'build-state.json'), JSON.stringify({ source, candidateOut: output, day }));
    markReleaseRun(run, options.store, 'candidate', [source, output]);
    return { run, output, source, day };
  };
}

test('durable R2 full, delta, resumable batch and independent verify/promotion with memory S3', async () => {
  const store = path.join(home, 'store');
  const mock = memoryR2(), calls = [];
  const options = { store, commit };
  const run = (mode, build, extra = {}) => deploy({ ...options, mode, ...extra }, { client: mock.client, config, build });
  mock.publicKeys.set('keep.bin', { body: 'unrelated' });
  mock.publicKeys.set('security/known alias/per/index.html', { body: 'known redirect' });
  mock.publicKeys.set('security/unrelated/per/index.html', { body: 'unrelated' });
  const day7 = '2026-10-07', day8 = '2026-10-08';
  const preflight = await run('status', null);
  assert.deepEqual([preflight.buckets.public.readable, preflight.buckets.state.readable, preflight.current], [true, true, null]);
  assert.equal(mock.values.size, 0);
  assert.equal(mock.puts.length, 0);
  const first = await run('full', candidate(day7, '7', calls), { retireLegacy: true });
  assert.equal(first.putKeys, 3);
  assert.deepEqual(mock.deletes, [['security/known alias/per/index.html']]);
  assert.ok(mock.publicKeys.has('security/unrelated/per/index.html'));

  mock.outage('index.html');
  await assert.rejects(run('daily', candidate(day8, '8', calls), { day: day8 }), /simulated transport outage/);
  assert.equal(mock.values.get(stateFile).value.current.releaseId, first.releaseId);
  assert.equal(mock.values.get(stateFile).value.pending.next, 1);
  assert.equal(mock.publicKeys.get('index.html').body, '<p>7</p>');
  const preResume = mock.puts.length;
  mock.outage(null);
  const daily = await run('resume', null);
  assert.deepEqual(mock.puts.slice(preResume), ['index.html']);
  assert.equal(daily.putKeys, 2);
  assert.ok(mock.publicKeys.has(`downloads/market/${day7}.csv`));
  assert.equal(mock.publicKeys.get('index.html').body, '<p>8</p>');

  const count = mock.puts.length;
  const equal = await run('verify', candidate(day8, '8', calls));
  assert.equal(equal.equal, true);
  assert.equal(equal.putKeys, 0);
  assert.equal(mock.puts.length, count);
  assert.deepEqual({ day: calls.at(-1).day, independent: calls.at(-1).independent, clean: calls.at(-1).clean },
    { day: day8, independent: true, clean: true });

  const reviewed = await run('verify', candidate(day8, 'corrected', calls));
  const stale = await run('verify', candidate(day8, 'stale proposal', calls));
  assert.equal(reviewed.equal, false);
  assert.equal(reviewed.putKeys, 0);
  assert.equal(mock.puts.length, count);
  const result = await run('promote', null, { candidateId: reviewed.candidateId });
  assert.equal(result.putKeys, 3);
  assert.equal(mock.publicKeys.get('index.html').body, '<p>corrected</p>');
  assert.ok(mock.publicKeys.has('keep.bin'));
  await assert.rejects(run('promote', null, { candidateId: stale.candidateId }), /base is stale/);
});

test('KST first Saturday, active comparison and R2 S3 transport without network', async () => {
  assert.deepEqual(seoulCalendar(new Date('2026-09-04T16:00:00Z')), { date: '2026-09-05', firstSaturday: true });
  assert.equal(seoulCalendar(new Date('2026-09-12T00:00:00Z')).firstSaturday, false);
  const index = { key: 'index.html', sha256: 'hash', bytes: 1, headers: { 'content-type': 'text/html' } };
  assert.deepEqual(compareActive({ activeKeys: [index.key], objects: [index, { key: 'old.csv' }] },
    { activeKeys: [index.key], objects: [index] }), { changed: [], removed: [] });
  assert.deepEqual(compareActive({ objects: [index] }, { objects: [{ ...index, headers: {} }] }),
    { changed: ['index.html'], removed: [] });
  const cfg = r2Config({ R2_ENDPOINT_URL: 'https://example.test', R2_BUCKET_NAME: 'site',
    R2_ACCESS_KEY_ID: 'fake-access', R2_SECRET_ACCESS_KEY: 'fake-secret' });
  assert.equal(cfg.stateBucket, 'site-state');
  assert.equal(cfg.origin.href, 'https://www.chundan.xyz/');
  const request = async (url, options) => {
    assert.match(options.headers.authorization, /Credential=fake-access\/20261008\/auto\/s3\/aws4_request/);
    assert.equal(options.headers['x-amz-date'], '20261008T050000Z');
    if (options.method === 'HEAD') {
      assert.equal(url.pathname, '/site-state');
      return new Response(null);
    }
    if (url.searchParams.get('max-keys') === '1') {
      return new Response('<ListBucketResult><Contents><Key>never printed</Key></Contents></ListBucketResult>');
    }
    if (options.method === 'PUT') {
      assert.equal(options.headers['if-match'], '"current"');
      return new Response('', { headers: { etag: '"next"' } });
    }
    assert.equal(url.searchParams.get('prefix'), 'security/');
    if (!url.searchParams.has('continuation-token')) return new Response(
      '<ListBucketResult><Contents><Key>security%2F%ED%95%9C</Key></Contents><IsTruncated>true</IsTruncated><NextContinuationToken>x&amp;y</NextContinuationToken></ListBucketResult>');
    assert.equal(url.searchParams.get('continuation-token'), 'x&y');
    return new Response('<ListBucketResult><Contents><Key>security%2Ftwo</Key></Contents><IsTruncated>false</IsTruncated></ListBucketResult>');
  };
  const api = createR2Client(cfg, { request, now: () => new Date('2026-10-08T05:00:00Z'), pause: async () => {} });
  await api.checkBucket(cfg.stateBucket);
  assert.equal(await api.putJson(cfg.stateBucket, stateFile, { fixture: true }, '"current"'), '"next"');
  const listed = [];
  for await (const key of api.listKeys(cfg.publicBucket, 'security/')) listed.push(key);
  assert.deepEqual(listed, ['security/한', 'security/two']);
});

test('read-only status distinguishes HEAD and List and provisioning creates only confirmed missing buckets', async () => {
  const cfg = r2Config({ R2_ENDPOINT_URL: 'https://example.test', R2_BUCKET_NAME: 'site',
    AWS_ACCESS_KEY_ID: 'ambient', AWS_SECRET_ACCESS_KEY: 'ambient-secret', AWS_SESSION_TOKEN: 'ambient-token',
    R2_ACCESS_KEY_ID: 'project-key', R2_SECRET_ACCESS_KEY: 'project-secret' });
  assert.equal(cfg.accessKey, 'project-key');
  assert.equal(cfg.token, undefined);
  assert.throws(() => r2Config({ R2_ENDPOINT_URL: 'https://example.test', R2_BUCKET_NAME: 'site',
    R2_ACCESS_KEY_ID: 'project-key', AWS_SECRET_ACCESS_KEY: 'ambient-secret' }), /credentials/);
  const existing = new Set(['/site']);
  const puts = [];
  const request = async (url, options) => {
    assert.equal(options.headers['x-amz-security-token'], undefined);
    if (options.method === 'HEAD') return new Response(null, { status: 404 });
    if (options.method === 'PUT') {
      puts.push(url.pathname);
      existing.add(url.pathname);
      return new Response(null);
    }
    assert.equal(url.searchParams.get('max-keys'), '1');
    if (url.pathname === '/permission-denied') return new Response('<Error><Code>AccessDenied</Code><Message>private value</Message></Error>', { status: 403 });
    if (url.pathname === '/unconfirmed') return new Response('private endpoint error', { status: 404 });
    if (!existing.has(url.pathname)) return new Response('<Error><Code>NoSuchBucket</Code><BucketName>private-name</BucketName></Error>', { status: 404 });
    return new Response('<ListBucketResult><Contents><Key>private-key</Key></Contents></ListBucketResult>');
  };
  const client = createR2Client(cfg, { request, pause: async () => {} });
  const store = path.join(home, 'provision-test');
  const before = await deploy({ mode: 'status', store }, { client, config: cfg });
  assert.equal(before.readable, false);
  assert.deepEqual(before.buckets.public, { headHttp: 404, listHttp: 200, listCode: undefined, readable: true });
  assert.equal(before.buckets.state.listCode, 'NoSuchBucket');
  assert.deepEqual(puts, []);
  await assert.rejects(client.prepareBucket('permission-denied'), /^Error: R2 ListObjectsV2 failed \(HTTP 403, AccessDenied\)$/);
  await assert.rejects(client.prepareBucket('unconfirmed'), /^Error: R2 ListObjectsV2 failed \(HTTP 404\)$/);
  assert.deepEqual(puts, []);
  assert.deepEqual((await deploy({ mode: 'provision', store }, { client, config: cfg })).buckets, { public: 'existing', state: 'created' });
  assert.deepEqual((await deploy({ mode: 'provision', store }, { client, config: cfg })).buckets, { public: 'existing', state: 'existing' });
  assert.deepEqual(puts, ['/site-state']);
});

test('first full can reuse only the explicitly verified canonical snapshot and day', async () => {
  const input = path.join(home, 'verified-frozen'), store = path.join(home, 'frozen-store');
  fs.mkdirSync(input);
  const mock = memoryR2(), day = '2026-10-08', calls = [];
  const source = { version: 1, metadata: 'accepted fixture', partitions: [] };
  const sourceIndexDigest = signature(source);
  fs.writeFileSync(path.join(input, 'source-index.json'), JSON.stringify({ ...source, digest: sourceIndexDigest }));
  fs.writeFileSync(path.join(input, 'manifest.json'), JSON.stringify({ version: 1, snapshotId: 'verified-fixture', routes: [], assets: [],
    sample: { enabled: false, selection: 'full' }, referenceDate: day, marketCsv: { date: day, rowCount: 1, url: '/downloads/market/' + day + '.csv' },
    separatedCompanyAssets: true, historyPacks: true, sourceIndexDigest }));
  const exec = (opts = {}) => deploy({ mode: 'full', store, day, commit, input, inputCommit: commit, ...opts },
    { client: mock.client, config, build: candidate(day, 'frozen', calls) });
  await assert.rejects(exec({ inputCommit: '2'.repeat(40) }), /verified checkout commit/);
  await assert.rejects(exec({ day: '2026-10-09' }), /complete canonical release/);
  assert.equal(mock.puts.length, 0);
  await exec();
  assert.equal(calls[0].input, input);
  assert.equal(calls[0].day, day);
  await assert.rejects(exec(), /first full publication/);
});
