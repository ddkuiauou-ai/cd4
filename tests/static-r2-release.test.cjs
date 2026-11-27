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
const { deploy, compareActive, smokeRelease } = require('../scripts/deploy-static-r2.cjs');
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
  mock.publicKeys.set('security/unrelated/per/index.html', { body: 'unrelated' });
  const day7 = '2026-10-07', day8 = '2026-10-08';
  const preflight = await run('status', null);
  assert.deepEqual([preflight.buckets.public.readable, preflight.buckets.state.readable, preflight.current], [true, true, null]);
  assert.equal(mock.values.size, 0);
  assert.equal(mock.puts.length, 0);
  await assert.rejects(run('daily', candidate(day7, '7', calls)), /Publish a full R2 baseline first/);
  assert.equal(calls.length, 0);
  assert.equal(mock.puts.length, 0);

  const first = await run('full', candidate(day7, '7', calls));
  assert.equal(calls[0].input, undefined);
  assert.equal(first.putKeys, 3);
  assert.equal(first.deleteKeys, 0);
  assert.deepEqual(mock.deletes, []);
  assert.ok(mock.publicKeys.has('security/unrelated/per/index.html'));

  const differentCommit = await run('daily', candidate(day8, '8', calls), { commit: '2'.repeat(40) });
  assert.equal(differentCommit.requiresFull, true);
  assert.equal(differentCommit.putKeys, 0);
  assert.equal(mock.puts.length, first.putKeys);
  assert.equal(calls.length, 1);

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

test('active comparison and R2 S3 transport without network', async () => {
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
    assert.fail('Unexpected S3 request');
  };
  const api = createR2Client(cfg, { request, now: () => new Date('2026-10-08T05:00:00Z'), pause: async () => {} });
  await api.checkBucket(cfg.stateBucket);
  assert.equal(await api.putJson(cfg.stateBucket, stateFile, { fixture: true }, '"current"'), '"next"');
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

test('smoke compares only active Samsung and dated CSV, keeping anonymous confirmation separate', async () => {
  const day = '2026-10-08';
  const fixtures = {
    'security/KOSPI.005930/per/index.html': { body: '<p>삼성전자 PER</p>', type: 'text/html; charset=utf-8' },
    [`downloads/market/${day}.csv`]: { body: '\uFEFF기준일,종목코드\n2026-10-08,005930', type: 'text/csv; charset=utf-8' },
  };
  const objects = Object.entries(fixtures).map(([key, { body, type }]) => ({
    key, sha256: createHash('sha256').update(body).digest('hex'), bytes: Buffer.byteLength(body), headers: { 'content-type': type },
  }));
  const inventory = { version: 1, activeKeys: Object.keys(fixtures), objects };
  const descriptor = { version: 1, run: 'release-smoke', commit, day, inventory, releaseId: signature(inventory) };
  const candidateId = signature(descriptor);
  const pointer = { version: 1, current: { commit, day, releaseId: descriptor.releaseId, candidateId } };
  const requests = [];
  let changed = false;
  const api = createR2Client({ ...config, endpoint: new URL('https://storage.example.test'), accessKey: 'fake-id', secret: 'fake-token' }, {
    request: async (url, options) => {
      assert.equal(options.method, 'GET');
      assert.ok(options.headers.authorization);
      requests.push(url.pathname);
      if (url.pathname.endsWith('/' + stateFile)) return Response.json(pointer, { headers: { etag: '"pointer"' } });
      if (url.pathname.endsWith('/' + candidateId + '.json')) return Response.json(descriptor, { headers: { etag: '"descriptor"' } });
      const fixture = fixtures[url.pathname.slice('/public-test/'.length)];
      return new Response(changed && fixture.type.startsWith('text/html') ? 'different' : fixture.body,
        { headers: { 'content-type': fixture.type } });
    },
  });
  const signed = await smokeRelease(api, config, () => assert.fail('anonymous origin was not configured'));
  assert.equal(signed.bucket.verified, true);
  assert.match(signed.publicOrigin.skipped, /not configured/);
  assert.equal(requests.length, 4);
  assert.deepEqual(requests.slice(2).sort(), Object.keys(fixtures).map(key => '/public-test/' + key).sort());

  const anonymous = await smokeRelease(api, { ...config, publicOriginConfigured: true }, async (url, options) => {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers, undefined);
    if (url.pathname === '/security/KOSPI.005930/per/') return new Response('private challenge', { status: 403 });
    const csv = fixtures[url.pathname.slice(1)];
    return new Response(csv.body, { headers: { 'content-type': csv.type } });
  });
  assert.equal(anonymous.bucket.verified, true);
  assert.equal(anonymous.publicOrigin.verified, false);
  assert.equal(anonymous.publicOrigin.objects.samsungPer.http, 403);
  assert.equal(anonymous.publicOrigin.objects.marketCsv.sha256Matches, true);
  assert.doesNotMatch(JSON.stringify(anonymous), /private challenge|삼성전자|fake-token/);

  changed = true;
  const mismatch = await smokeRelease(api, config);
  assert.equal(mismatch.bucket.objects.samsungPer.sha256Matches, false);
  assert.equal(mismatch.bucket.objects.samsungPer.contentTypeMatches, true);
  assert.equal(mismatch.bucket.verified, false);
});
