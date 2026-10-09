const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const STAGE = path.join(ROOT, '.static-build');
const OUT = path.join(ROOT, 'out');
const WORKSPACE = path.join(STAGE, 'workspace');
const MARKER = '_static-build.json';

function relativeFile(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0')
    || path.posix.isAbsolute(value) || value.split('/').some(part => part === '..' || part === '.')) {
    throw new Error(`Unsafe output file path: ${String(value)}`);
  }
  return value;
}

function routePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || /[?#\\\0]/.test(value)) {
    throw new Error(`Invalid static URL: ${String(value)}`);
  }
  const decoded = decodeURIComponent(value);
  if (decoded.split('/').some(part => part === '..' || part === '.') || decoded.includes('\\') || decoded.includes('\0')) {
    throw new Error(`Unsafe static URL: ${value}`);
  }
  return decoded;
}

function outputFileForRoute(value) {
  const route = routePath(value);
  return route === '/' ? 'index.html' : relativeFile(`${route.slice(1)}${route.endsWith('/') ? 'index.html' : ''}`);
}

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function writeJson(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filename);
}

function readManifest({ allowSample = false, filename = path.join(STAGE, 'manifest.json') } = {}) {
  const manifest = readJson(filename);
  if (manifest.version !== 1 || typeof manifest.snapshotId !== 'string' || !manifest.snapshotId
    || !manifest.sample || typeof manifest.sample.enabled !== 'boolean' || !Array.isArray(manifest.routes)
    || !Array.isArray(manifest.assets)) throw new Error('Incomplete or unsupported static build manifest');
  if (manifest.sample.enabled && !allowSample) throw new Error('This is a sample snapshot. A full build must prepare fresh, complete input.');
  const routes = new Set();
  for (const route of manifest.routes) {
    if (route.kind !== 'page' || !route.path.endsWith('/')) throw new Error(`Expected a canonical page URL: ${route.path}`);
    const key = routePath(route.path);
    if (routes.has(key)) throw new Error(`Duplicate page URL: ${route.path}`);
    routes.add(key);
  }
  for (const alias of manifest.aliases ?? []) {
    const key = routePath(alias.path);
    routePath(alias.target);
    if (routes.has(key)) throw new Error(`Alias overwrites an existing page: ${alias.path}`);
    routes.add(key);
  }
  for (const asset of manifest.assets) {
    relativeFile(asset.path);
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
      throw new Error(`Invalid asset metadata: ${asset.path}`);
    }
  }
  for (const file of manifest.requiredFiles ?? []) relativeFile(file);
  return manifest;
}

function filesBelow(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Static output cannot contain symbolic links: ${filename}`);
      if (entry.isDirectory()) visit(filename);
      else if (entry.isFile()) files.push(path.relative(root, filename).split(path.sep).join('/'));
    }
  }
  visit(root);
  return files.sort();
}

function sha256(filename) {
  const digest = crypto.createHash('sha256'), buffer = Buffer.alloc(64 * 1024);
  const descriptor = fs.openSync(filename, 'r');
  try { let size; while ((size = fs.readSync(descriptor, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, size)); }
  finally { fs.closeSync(descriptor); }
  return digest.digest('hex');
}

function familyForRoute(route) {
  const parts = routePath(route).split('/').filter(Boolean);
  if (parts[0] === 'security' || parts[0] === 'company') return `${parts[0]}/${parts[2] || 'base'}`;
  return parts[0] || 'home';
}

function measureOutput(manifest, output = OUT) {
  const files = filesBelow(output);
  const sizes = new Map();
  const textBytesByDirectory = new Map();
  const byType = {};
  let logicalBytes = 0, allocatedBytes = 0;
  for (const file of files) {
    const stat = fs.statSync(path.join(output, file));
    sizes.set(file, stat.size);
    logicalBytes += stat.size;
    allocatedBytes += stat.blocks * 512;
    const type = path.extname(file).slice(1) || 'other';
    byType[type] ??= { files: 0, bytes: 0 };
    byType[type].files++;
    byType[type].bytes += stat.size;
    if (type === 'txt') {
      const directory = path.posix.dirname(file);
      textBytesByDirectory.set(directory, (textBytesByDirectory.get(directory) ?? 0) + stat.size);
    }
  }
  const byFamily = {};
  for (const route of manifest.routes) {
    const family = familyForRoute(route.path);
    const html = outputFileForRoute(route.path);
    const directory = path.posix.dirname(html);
    const payloadBytes = (sizes.get(html) ?? 0) + (textBytesByDirectory.get(directory) ?? 0);
    byFamily[family] ??= { pages: 0, htmlBytes: 0, payloadBytes: 0, maxPayloadBytes: 0 };
    byFamily[family].pages++;
    byFamily[family].htmlBytes += sizes.get(html) ?? 0;
    byFamily[family].payloadBytes += payloadBytes;
    byFamily[family].maxPayloadBytes = Math.max(byFamily[family].maxPayloadBytes, payloadBytes);
  }
  return { files: files.length, logicalBytes, allocatedBytes, byType, byFamily };
}

function freeBytes(directory = ROOT) {
  const stats = fs.statfsSync(directory);
  return stats.bavail * stats.bsize;
}

function directoryUsage(directory) {
  let files = 0, logicalBytes = 0, allocatedBytes = 0;
  if (fs.existsSync(directory)) {
    const visit = current => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.isDirectory()) visit(path.join(current, entry.name));
        else if (entry.isFile()) {
          const stat = fs.statSync(path.join(current, entry.name));
          files++;
          logicalBytes += stat.size;
          allocatedBytes += stat.blocks * 512;
        }
      }
    };
    visit(directory);
  }
  return { directory: path.relative(ROOT, directory), files, logicalBytes, allocatedBytes };
}

function sourceFingerprint(projectRoot = ROOT) {
  const digest = crypto.createHash('sha256');
  for (const directory of ['app', 'components', 'hooks', 'lib', 'db', 'config', 'types', 'scripts', 'public']) {
    for (const file of filesBelow(path.join(projectRoot, directory))) {
      if (directory !== 'public' && !/\.(?:[cm]?[jt]sx?|json|css|svg|png|ico|webp|woff2?)$/.test(file)) continue;
      digest.update(`${directory}/${file}\0`);
      digest.update(fs.readFileSync(path.join(projectRoot, directory, file)));
    }
  }
  for (const file of ['next.config.ts', 'package.json', 'pnpm-lock.yaml', '.nvmrc', 'pnpm-workspace.yaml', 'tsconfig.json', 'postcss.config.mjs']) {
    digest.update(file);
    digest.update(fs.readFileSync(path.join(projectRoot, file)));
  }
  return digest.digest('hex');
}

function diskProjection(manifest) {
  if (!manifest || manifest.sample.enabled) return null;
  const filename = path.join(STAGE, 'reports', 'benchmark-latest.json');
  if (!fs.existsSync(filename)) return null;
  const benchmark = readJson(filename);
  if (!benchmark.success || benchmark.sourceFingerprint !== sourceFingerprint()) return null;
  const candidate = benchmark.candidates.find(row => row.workers === benchmark.selected.workers && row.concurrency === benchmark.selected.concurrency);
  if (!candidate) return null;
  const counts = new Map();
  for (const route of manifest.routes) { const family = familyForRoute(route.path); counts.set(family, (counts.get(family) ?? 0) + 1); }
  let pagePayloadBytes = 0;
  for (const [family, count] of counts) {
    const sample = candidate.byFamily[family];
    if (!sample) return null;
    pagePayloadBytes += count * sample.maxPayloadBytes;
  }
  const samplePayload = Object.values(candidate.byFamily).reduce((total, family) => total + family.payloadBytes, 0);
  const nonPageOverhead = Math.max(0, candidate.logicalBytes - samplePayload);
  const sharedAssetBytes = manifest.assets.reduce((total, asset) => total + asset.bytes, 0);
  return { benchmarkSnapshotId: benchmark.snapshotId, pagePayloadBytes, sharedAssetBytes,
    additionalBytes: pagePayloadBytes * 2 + sharedAssetBytes + nonPageOverhead * 2,
    note: 'Projection uses the largest measured page in each family and accounts for workspace/.next plus out copies. Unseen larger histories or compiler growth can exceed it; runtime disk monitoring remains enabled.' };
}

function diskPreflight(manifest) {
  const reserveGiB = Number(process.env.STATIC_BUILD_RESERVE_GIB ?? 2);
  if (!Number.isFinite(reserveGiB) || reserveGiB < 0.25) throw new Error('STATIC_BUILD_RESERVE_GIB must be at least 0.25');
  const reserveBytes = Math.ceil(reserveGiB * 2 ** 30);
  const availableBytes = freeBytes();
  const stagedAssetBytes = manifest?.assets.reduce((total, asset) => total + asset.bytes, 0) ?? 0;
  const projection = diskProjection(manifest);
  const existingGeneratedDirectories = [OUT, path.join(WORKSPACE, '.next'), path.join(WORKSPACE, 'out')].map(directoryUsage);
  const minimumBytes = reserveBytes + Math.max(stagedAssetBytes, projection?.additionalBytes ?? 0);
  if (availableBytes < minimumBytes) throw new Error(`Insufficient disk space: ${availableBytes} bytes available; ${minimumBytes} needed for staged assets and reserve`);
  return { availableBytes, reserveBytes, stagedAssetBytes, minimumBytes, projection, existingGeneratedDirectories,
    note: projection ? 'Same-source sample projection checked; the build also stops if the reserve is crossed.' : 'No same-source complete-family benchmark exists. Only immediate asset space and reserve are checked; the build stops if the reserve is crossed.' };
}

function runtimeInfo({ enforce = false } = {}) {
  const result = spawnSync('pnpm', ['--version'], { cwd: ROOT, encoding: 'utf8' });
  const pnpm = result.status === 0 ? result.stdout.trim() : null;
  if (enforce && (process.versions.node !== '22.23.3' || pnpm !== '10.34.6')) {
    throw new Error(`Use pinned Node 22.23.3 and pnpm 10.34.6 (current Node ${process.versions.node}, pnpm ${pnpm || 'unavailable'}). pnpm-workspace.yaml pins the project Node runtime.`);
  }
  return { node: process.versions.node, pnpm, platform: process.platform, arch: process.arch,
    cpuCount: os.availableParallelism(), totalMemoryBytes: os.totalmem() };
}

module.exports = { ROOT, STAGE, OUT, WORKSPACE, MARKER, relativeFile, routePath, outputFileForRoute, readJson, writeJson, directoryUsage,
  readManifest, filesBelow, sha256, familyForRoute, measureOutput, freeBytes, diskPreflight, diskProjection, sourceFingerprint, runtimeInfo };
