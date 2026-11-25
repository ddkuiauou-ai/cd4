const revalidate = 'public, max-age=0, must-revalidate';
const immutable = 'public, max-age=31536000, immutable';
const metrics = 'marketcap|per|pbr|eps|bps|div|dps';
const marketCode = '[A-Z][A-Z0-9_-]*\\.[A-Z0-9][A-Z0-9.-]*';
const leaderboard = new RegExp(`^(?:/marketcaps(?:/[1-9]\\d*)?|/(?:${metrics})(?:/(?:[A-Za-z0-9._-]{1,80}~)?[1-9]\\d*)?)$`);
const security = new RegExp(`^/security/${marketCode}/(?:${metrics})$`);
const company = new RegExp(`^/company/${marketCode}(?:/marketcap)?$`);

const rootFiles = new Set([
  '404.html', 'ads.txt', 'android-chrome-192x192.png', 'android-chrome-512x512.png',
  'apple-touch-icon.png', 'browserconfig.xml', 'favicon-16x16.png', 'favicon-32x32.png',
  'favicon.ico', 'file.svg', 'globe.svg', 'icon.svg', 'index.html', 'logo_long.svg', 'logo_short.svg',
  'mstile-150x150.png', 'next.svg', 'opengraph-image.png', 'placeholder.jpg', 'placeholder.svg',
  'robots.txt', 'safari-pinned-tab.svg', 'search-data.json', 'site.webmanifest', 'sitemap.xml',
  'vercel.svg', 'window.svg',
]);
const marketCsv = /^downloads\/market\/(\d{4}-\d{2}-\d{2})\.csv$/;
const rankingCsv = new RegExp(`^ranking-data/(?:companies-marketcap|securities-(?:${metrics}))\\.csv$`);
const hashedTable = /^static-data\/(?:shared\/[a-f0-9]{2}\/[a-f0-9]{20}\.json|ranking\/shared\/[a-f0-9]{2}\/[a-f0-9]{20}\.csv)$/;
const sitemap = /^sitemaps\/(?:core|companies|securities)-\d+\/sitemap\.xml$/;
const nextAsset = /^_next\/static\/(?:[\w.()[\]-]+\/)*[\w.()[\]-]+\.(?:js|css|svg|ttf|woff2?|png|jpg|webp|avif|gif|wasm)$/;
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.gif': 'image/gif', '.wasm': 'application/wasm',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function resolvePath(encoded) {
  if (/%(?:2f|5c|25|2e)/i.test(encoded)) return null;
  let pathname;
  try { pathname = decodeURIComponent(encoded); } catch { return null; }
  if (/[\\\x00-\x20\x7f]/.test(pathname) || pathname.includes('//')
    || pathname.split('/').some(part => part.startsWith('.') || part === '_benchmarks' || part === '_private')) return null;
  if (pathname === '/') return { key: 'index.html' };
  const bare = pathname.replace(/\/$/, '');
  if (bare === '/dashboard' || leaderboard.test(bare) || security.test(bare) || company.test(bare)) {
    return { key: bare.slice(1) + '/index.html', redirect: pathname === bare ? bare + '/' : undefined };
  }
  const key = pathname.slice(1);
  if (rootFiles.has(key) || /^naver[a-f0-9]{32}\.html$/.test(key) || marketCsv.test(key) || rankingCsv.test(key)
    || hashedTable.test(key) || sitemap.test(key) || nextAsset.test(key)) return { key };
  return null;
}

function errorResponse(method, status, message, other = {}) {
  return new Response(method === 'HEAD' ? null : message, {
    status, headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8', ...other },
  });
}

function matchingTag(condition, tag) {
  return condition?.trim() === '*' || [...(condition ?? '').matchAll(/(?:^|,)\s*(?:W\/)?("[^"]*")\s*(?=,|$)/g)]
    .some(match => match[1] === tag);
}

const worker = {
  async fetch(request, { CD_STATIC: bucket }) {
    const { method } = request;
    if (method !== 'GET' && method !== 'HEAD') {
      return errorResponse(method, 405, 'Method Not Allowed', { allow: 'GET, HEAD' });
    }
    const url = new URL(request.url);
    const route = resolvePath(url.pathname);
    if (!route) return errorResponse(method, 404, 'Not Found');

    const { key, redirect } = route;
    const condition = request.headers.get('if-none-match');
    const object = redirect || method === 'HEAD'
      ? await bucket.head(key)
      : await (condition ? bucket.get(key, { onlyIf: new Headers({ 'if-none-match': condition }) }) : bucket.get(key));
    if (!object) return errorResponse(method, 404, 'Not Found');
    if (redirect) return new Response(null, {
      status: 308, headers: { location: redirect + url.search, 'cache-control': revalidate },
    });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    if (!headers.has('content-type')) headers.set('content-type', contentTypes[key.slice(key.lastIndexOf('.'))]);
    if (!headers.has('cache-control')) headers.set('cache-control', nextAsset.test(key) || hashedTable.test(key) ? immutable : revalidate);
    headers.set('etag', object.httpEtag);
    headers.set('x-content-type-options', 'nosniff');
    if (marketCsv.test(key)) {
      for (const name of ['market-reference-date', 'market-row-count']) {
        const value = object.customMetadata?.[name];
        if (value !== undefined) headers.set('x-' + name, value);
      }
    }
    if (method === 'HEAD' ? matchingTag(condition, object.httpEtag) : !object.body) {
      return new Response(null, { status: 304, headers });
    }
    headers.set('content-length', String(object.size));
    return new Response(method === 'HEAD' ? null : object.body, { headers, encodeBody: 'manual' });
  },
};

export default worker;
