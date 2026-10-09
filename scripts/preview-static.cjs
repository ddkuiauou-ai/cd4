const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const { pipeline } = require('node:stream');
const { OUT, MARKER, readJson, writeJson } = require('./static-tools.cjs');

function negotiatedEncoding(value) {
  const qualities = new Map(String(value || '').split(',').map(part => {
    const [name, ...parameters] = part.trim().toLowerCase().split(';');
    const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
    const amount = quality ? Number(quality.trim().slice(2)) : 1;
    return [name, Number.isFinite(amount) && amount > 0 && amount <= 1 ? amount : 0];
  }));
  const score = name => qualities.get(name) ?? qualities.get('*') ?? 0;
  return ['br', 'gzip'].sort((left, right) => score(right) - score(left)).find(name => score(name) > 0) || null;
}

function trafficRecorder(filename) {
  if (!filename) return null;
  const report = { version: 1, startedAt: new Date().toISOString(),
    measurement: 'Server-observed local browser response body bytes written, excluding headers. Aborted responses are marked unfinished and can include queued bytes. Local Brotli quality 5/gzip compression; not Netlify CDN billing or compression measurements.',
    requests: [], totals: { requests: 0, responseBodyBytes: 0, byEncoding: {} } };
  writeJson(filename, report);
  return row => {
    report.requests.push(row);
    report.updatedAt = new Date().toISOString();
    report.totals.requests++;
    report.totals.responseBodyBytes += row.bodyBytes;
    const encoding = row.contentEncoding || 'identity';
    report.totals.byEncoding[encoding] ??= { requests: 0, bodyBytes: 0 };
    report.totals.byEncoding[encoding].requests++;
    report.totals.byEncoding[encoding].bodyBytes += row.bodyBytes;
    writeJson(filename, report);
  };
}

function contentType(filename) {
  if (filename.endsWith('.txt') && (path.basename(filename) === 'index.txt' || path.basename(filename).startsWith('__next'))) return 'text/x-component; charset=utf-8';
  return ({ '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff' })[path.extname(filename)] || 'application/octet-stream';
}

function headerRules(output) {
  const filename = path.join(output, '_headers');
  if (!fs.existsSync(filename)) return [];
  const rules = [];
  let current;
  for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const pattern = line.trim().split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
      current = { match: new RegExp(`^${pattern}$`), values: {} };
      rules.push(current);
    } else {
      const separator = line.indexOf(':');
      if (!current || separator < 1) throw new Error('Invalid generated _headers');
      current.values[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
  }
  return rules;
}

function createStaticServer({ output = OUT, trafficReport, compression = false } = {}) {
  const root = fs.realpathSync(output);
  const rules = headerRules(output);
  const record = trafficRecorder(trafficReport);
  let requestId = 0;
  return http.createServer(async (request, response) => {
    const started = performance.now();
    const row = { id: ++requestId, at: new Date().toISOString(), url: request.url, method: request.method, bodyBytes: 0 };
    if (record) {
      const count = (chunk, encoding) => { if (typeof chunk === 'string') row.bodyBytes += Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding : undefined); else if (chunk instanceof Uint8Array) row.bodyBytes += chunk.length; };
      const write = response.write.bind(response), end = response.end.bind(response);
      response.write = (chunk, encoding, callback) => { count(chunk, encoding); return write(chunk, encoding, callback); };
      response.end = (chunk, encoding, callback) => { count(chunk, encoding); return end(chunk, encoding, callback); };
    }
    let recorded = false;
    const complete = finished => {
      if (!record || recorded) return;
      recorded = true;
      record({ ...row, status: response.statusCode, contentType: response.getHeader('content-type') || null,
        contentEncoding: response.getHeader('content-encoding') || null, finished,
        finishedAt: new Date().toISOString(), durationMs: performance.now() - started });
    };
    if (record) { response.once('finish', () => complete(true)); response.once('close', () => complete(response.writableFinished)); }
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
      const url = new URL(request.url, 'http://localhost');
      let decoded;
      try { decoded = decodeURIComponent(url.pathname); } catch { response.writeHead(400); response.end(); return; }
      if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').includes('..')) { response.writeHead(400); response.end(); return; }
      let filename = path.join(root, decoded);
      let stat = await fs.promises.stat(filename).catch(() => null);
      if (stat?.isDirectory()) {
        if (!url.pathname.endsWith('/')) { response.writeHead(308, { Location: `${url.pathname}/${url.search}` }); response.end(); return; }
        filename = path.join(filename, 'index.html');
        stat = await fs.promises.stat(filename).catch(() => null);
      }
      let status = 200;
      if (!stat?.isFile()) {
        status = 404;
        filename = path.join(root, '404.html');
        stat = await fs.promises.stat(filename).catch(() => null);
      }
      if (!stat?.isFile()) { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found'); return; }
      const real = await fs.promises.realpath(filename);
      if (!real.startsWith(`${root}${path.sep}`)) { response.writeHead(403); response.end(); return; }
      const headers = { 'Content-Type': contentType(filename), 'Content-Length': String(stat.size), 'X-Content-Type-Options': 'nosniff' };
      for (const rule of rules) if (rule.match.test(url.pathname)) Object.assign(headers, rule.values);
      // Generated headers are case-insensitive; normalize them before compression and traffic recording.
      const normalized = Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
      const compressible = /^(?:text\/|application\/(?:json|xml|javascript))/.test(normalized['content-type']);
      const encoding = compression && compressible && stat.size >= 1024 ? negotiatedEncoding(request.headers['accept-encoding']) : null;
      row.uncompressedBytes = request.method === 'HEAD' ? 0 : stat.size;
      if (compression && compressible) normalized.vary = 'Accept-Encoding';
      if (encoding) { normalized['content-encoding'] = encoding; delete normalized['content-length']; }
      for (const [name, value] of Object.entries(normalized)) response.setHeader(name, value);
      response.writeHead(status);
      if (request.method === 'HEAD') response.end();
      else {
        const stream = fs.createReadStream(real);
        const encoded = encoding === 'br' ? zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } })
          : encoding === 'gzip' ? zlib.createGzip() : null;
        const streams = encoded ? [stream, encoded, response] : [stream, response];
        pipeline(...streams, error => { if (error) response.destroy(); });
      }
    } catch { if (!response.headersSent) response.writeHead(500); response.end(); }
  });
}

async function startPreview({ output = OUT, allowSample = false, port = 4173, host = '127.0.0.1', trafficReport } = {}) {
  const marker = readJson(path.join(output, MARKER));
  if (marker.sample.enabled && !allowSample) throw new Error('Sample output: pass --allow-sample to preview it explicitly');
  const server = createStaticServer({ output, trafficReport, compression: true });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  return server;
}

if (require.main === module) {
  const portIndex = process.argv.indexOf('--port');
  const trafficIndex = process.argv.indexOf('--traffic-report');
  const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : process.env.PORT || 4173);
  const trafficReport = trafficIndex >= 0 ? process.argv[trafficIndex + 1] : undefined;
  if (trafficIndex >= 0 && (!trafficReport || trafficReport.startsWith('--'))) throw new Error('--traffic-report requires a JSON filename');
  startPreview({ allowSample: process.argv.includes('--allow-sample'), port, trafficReport }).then(server => {
    console.log(`Serving only out/ at http://127.0.0.1:${server.address().port} (no application server or database)`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { contentType, headerRules, negotiatedEncoding, createStaticServer, startPreview };
