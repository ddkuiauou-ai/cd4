const { createHash, createHmac } = require('node:crypto');
const { createReadStream } = require('node:fs');
const { setTimeout: sleep } = require('node:timers/promises');
const { siteOrigin } = require('../config/site-origin.cjs');

const hash = (value, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(value).digest(encoding);
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase());
const escape = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const unescape = value => value.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity]);

function r2Config(env = process.env) {
  const endpoint = new URL(env.R2_ENDPOINT_URL || `https://${env.R2_ACCOUNT_ID || 'missing'}.r2.cloudflarestorage.com`);
  const publicBucket = env.R2_BUCKET_NAME;
  const stateBucket = env.R2_STATE_BUCKET_NAME || (publicBucket && publicBucket + '-state');
  if (!env.R2_ENDPOINT_URL && !/^[a-f\d]{32}$/i.test(env.R2_ACCOUNT_ID ?? '')) throw new Error('Configure R2_ACCOUNT_ID or R2_ENDPOINT_URL');
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
    throw new Error('R2_ENDPOINT_URL must be an HTTPS endpoint origin');
  }
  if (![publicBucket, stateBucket].every(name => /^[a-z\d][a-z\d-]{1,61}[a-z\d]$/.test(name ?? '')) || publicBucket === stateBucket) {
    throw new Error('Configure distinct R2_BUCKET_NAME and private R2_STATE_BUCKET_NAME');
  }
  const accessKey = env.AWS_ACCESS_KEY_ID || env.R2_ACCESS_KEY_ID;
  const secret = env.AWS_SECRET_ACCESS_KEY || env.R2_SECRET_ACCESS_KEY;
  if (!accessKey || !secret) throw new Error('Configure R2 S3 access credentials');
  const origin = new URL(env.R2_PUBLIC_ORIGIN || siteOrigin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('R2_PUBLIC_ORIGIN must be an HTTPS origin');
  }
  return { endpoint, publicBucket, stateBucket, accessKey, secret, token: env.AWS_SESSION_TOKEN, origin };
}

function createR2Client(config, { request = fetch, now = () => new Date(), pause = sleep } = {}) {
  const { endpoint, accessKey, secret, token } = config;
  async function call(method, bucket, key = '', { query = {}, headers = {}, body, file, sha256, bytes } = {}) {
    const pathname = '/' + [bucket, ...key.split('/')].map(encode).join('/').replace(/\/$/, '');
    const search = Object.entries(query).map(([name, value]) => [encode(name), encode(value)])
      .sort(([a], [b]) => a < b ? -1 : Number(a > b)).map(pair => pair.join('=')).join('&');
    const url = new URL(pathname + (search && '?' + search), endpoint);
    const digest = sha256 ?? hash(body ?? '');
    let status;
    for (let attempt = 0; attempt < 4; attempt++) {
      const time = now().toISOString().replace(/[-:]|\.\d{3}/g, '');
      const day = time.slice(0, 8);
      const scope = `${day}/auto/s3/aws4_request`;
      const signed = { ...headers, host: endpoint.host, 'x-amz-date': time, 'x-amz-content-sha256': digest,
        ...(token ? { 'x-amz-security-token': token } : {}) };
      const names = Object.keys(signed).sort();
      const canonical = names.map(name => name + ':' + signed[name].trim().replace(/\s+/g, ' ')).join('\n') + '\n';
      const signature = hmac(hmac(hmac(hmac('AWS4' + secret, day), 'auto'), 's3'), 'aws4_request');
      const message = ['AWS4-HMAC-SHA256', time, scope,
        hash([method, pathname, search, canonical, names.join(';'), digest].join('\n'))].join('\n');
      const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${names.join(';')}, Signature=${hmac(signature, message).toString('hex')}`;
      try {
        const response = await request(url, { method, headers: { ...signed, authorization, ...(file ? { 'content-length': bytes } : {}) },
          body: file ? createReadStream(file) : body, ...(file ? { duplex: 'half' } : {}), redirect: 'error',
          signal: AbortSignal.timeout(120_000) });
        if (response.ok || response.status === 404 || response.status === 412) return response;
        status = response.status;
        await response.body?.cancel();
        if (status !== 429 && status < 500) break;
      } catch { status = 'transport'; }
      if (attempt < 3) await pause(250 * 2 ** attempt);
    }
    throw new Error(`R2 ${method} failed (${status})`);
  }

  async function getJson(bucket, key) {
    const response = await call('GET', bucket, key);
    if (response.status === 404) { await response.body?.cancel(); return null; }
    if (!response.ok || !response.headers.get('etag')) throw new Error('R2 private object could not be read');
    return { value: await response.json(), etag: response.headers.get('etag') };
  }

  async function checkBucket(bucket) {
    const response = await call('HEAD', bucket);
    await response.body?.cancel();
    if (!response.ok) throw new Error(`R2 bucket read preflight failed (${response.status})`);
  }

  async function putJson(bucket, key, value, etag = null) {
    const response = await call('PUT', bucket, key, { body: JSON.stringify(value), headers: {
      'content-type': 'application/json', 'cache-control': 'no-store', ...(etag ? { 'if-match': etag } : { 'if-none-match': '*' }),
    } });
    await response.body?.cancel();
    if (response.status === 412) throw Object.assign(new Error('R2 private state changed concurrently'), { code: 'R2_CONFLICT' });
    if (!response.ok || !response.headers.get('etag')) throw new Error('R2 private state write could not be confirmed');
    return response.headers.get('etag');
  }

  async function putObject(bucket, object, file) {
    const headers = Object.fromEntries(Object.entries(object.headers).map(([name, value]) => [
      name.startsWith('x-market-') ? 'x-amz-meta-' + name.slice(2) : name, value,
    ]));
    const response = await call('PUT', bucket, object.key, { headers, file, sha256: object.sha256, bytes: object.bytes });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`R2 object PUT failed (${response.status})`);
  }

  async function deleteKeys(bucket, keys) {
    if (!keys.length || keys.length > 1000) throw new Error('R2 DELETE batch requires 1–1000 keys');
    const body = '<Delete xmlns="http://s3.amazonaws.com/doc/2006-03-01/">' +
      keys.map(key => '<Object><Key>' + escape(key) + '</Key></Object>').join('') + '<Quiet>true</Quiet></Delete>';
    const response = await call('POST', bucket, '', { query: { delete: '' }, body,
      headers: { 'content-type': 'application/xml', 'content-md5': hash(body, 'md5', 'base64') } });
    if (!response.ok || /<(?:\w+:)?Error(?:\s|>)/.test(await response.text())) throw new Error('R2 rejected a managed-key deletion batch');
  }

  async function* listKeys(bucket, prefix) {
    let continuation;
    do {
      const response = await call('GET', bucket, '', { query: { 'list-type': '2', 'encoding-type': 'url', prefix,
        ...(continuation ? { 'continuation-token': continuation } : {}) } });
      if (!response.ok) throw new Error('R2 managed-prefix list failed');
      const xml = await response.text();
      for (const match of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) yield decodeURIComponent(unescape(match[1]));
      const next = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1];
      if (/<IsTruncated>true<\/IsTruncated>/.test(xml) && !next) throw new Error('Missing R2 listing continuation');
      continuation = next && unescape(next);
    } while (continuation);
  }

  return { checkBucket, getJson, putJson, putObject, deleteKeys, listKeys };
}

module.exports = { createR2Client, r2Config };
