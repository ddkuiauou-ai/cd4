const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pipeline } = require('node:stream');
const { blob, readRelease } = require('./static-release-store.cjs');
const { STAGE } = require('./static-tools.cjs');

function classifyRequest(request, url, contentType) {
  if (request?.headers.rsc === '1' || url?.searchParams.has('_rsc')
    || /(?:index\.txt|__next[^/]*\.txt|\.rsc)$/.test(url?.pathname ?? '')) return 'rsc';
  if (contentType?.startsWith('text/html')) return 'document';
  if (contentType?.startsWith('text/csv')) return 'csv';
  if (contentType?.startsWith('application/json')) return 'json';
  if (contentType?.startsWith('text/javascript')) return 'script';
  if (contentType?.startsWith('text/css')) return 'style';
  return 'other';
}

function createReleaseServer({ root, requestLog } = {}) {
  const directory = fs.realpathSync(root);
  let logWarning = false;
  let signature;
  let release;
  function current() {
    const stat = fs.statSync(path.join(directory, 'current.json'), { bigint: true });
    const key = `${stat.ino}:${stat.mtimeNs}:${stat.size}`;
    if (signature !== key) {
      release = readRelease(directory);
      signature = key;
    }
    if (!release) throw new Error('No published local release');
    return release;
  }
  current();
  return http.createServer((request, response) => {
    let url, selectedKey, releaseId, requestClass = 'other';
    response.once('finish', () => {
      if (!requestLog) return;
      try {
        fs.appendFileSync(requestLog, JSON.stringify({
          method: request.method, url: request.url, requestClass, key: selectedKey, releaseId,
          status: response.statusCode, contentType: response.getHeader('content-type') ?? null,
          bodyBytes: request.method === 'HEAD' || response.statusCode === 304 ? 0 : Number(response.getHeader('content-length') ?? 0),
        }) + '\n');
      } catch (error) {
        if (!logWarning) console.warn('Local release request log failed:', error.code ?? error.name);
        logWarning = true;
      }
    });
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
      url = new URL(request.url, 'http://localhost');
      requestClass = classifyRequest(request, url);
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { response.writeHead(400).end(); return; }
      if (/[\\\0]/.test(pathname) || pathname.split('/').some(part => part === '..' || part === '.')) {
        response.writeHead(400).end();
        return;
      }
      if (requestClass === 'rsc') { response.writeHead(404, { 'Cache-Control': 'no-store' }).end(); return; }
      const snapshot = current();
      releaseId = snapshot.releaseId;
      const key = pathname.slice(1);
      const fileKey = pathname.endsWith('/') ? key + 'index.html' : key;
      let object = snapshot.objects.get(fileKey);
      if (!object && !pathname.endsWith('/') && snapshot.objects.has(key + '/index.html')) {
        response.writeHead(308, { Location: url.pathname + '/' + url.search }).end();
        return;
      }
      const status = object ? 200 : 404;
      object ??= snapshot.objects.get('404.html');
      if (!object) { response.writeHead(404, { 'Cache-Control': 'no-store' }).end(); return; }
      selectedKey = object.key;
      requestClass = classifyRequest(request, url, object.headers['content-type']);
      const filename = blob(directory, object.sha256);
      if (fs.statSync(filename).size !== object.bytes) throw new Error('Release object is unavailable');
      const etag = `"${object.sha256}"`;
      const matches = String(request.headers['if-none-match'] ?? '').split(',')
        .some(tag => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === etag);
      if (status === 200 && matches) { response.writeHead(304, { ...object.headers, etag }).end(); return; }
      response.writeHead(status, { ...object.headers, 'content-length': object.bytes, etag });
      if (request.method === 'HEAD') { response.end(); return; }
      pipeline(fs.createReadStream(filename), response, error => { if (error && !response.destroyed) response.destroy(error); });
    } catch {
      if (response.headersSent) response.destroy();
      else response.writeHead(500, { 'Cache-Control': 'no-store' }).end();
    }
  });
}

if (require.main === module) {
  const { parseArgs } = require('node:util');
  try {
    const { values } = parseArgs({ options: { store: { type: 'string' }, port: { type: 'string' }, 'request-log': { type: 'string' } } });
    const root = path.resolve(values.store ?? path.join(STAGE, 'local-release'));
    const port = Number(values.port ?? '4173');
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid preview port');
    const server = createReleaseServer({ root, requestLog: values['request-log'] });
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`Serving the current object release at http://127.0.0.1:${server.address().port}`));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { createReleaseServer };
