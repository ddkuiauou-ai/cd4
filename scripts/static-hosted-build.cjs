const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { filesBelow, outputFileForRoute, sha256 } = require('./static-tools.cjs');
const { documentAssetKeys, isRsc } = require('./static-release-store.cjs');

// Next writes both prerendered output and exported copies before we can drop RSC.
// Use prior HTML sizes to bound each wave, including pages with large rank payloads.
const BATCH_HTML_BYTES = 512 * 2 ** 20;
const BASE_HTML_BYTES = 96 * 2 ** 10;

function hostedRenderBatches(changed, previous, maxBytes = BATCH_HTML_BYTES) {
  const batches = [[]];
  let bytes = 0;
  for (const route of changed) {
    const previousBytes = previous?.objects.get(outputFileForRoute(route))?.bytes ?? 0;
    const estimate = Math.max(BASE_HTML_BYTES, previousBytes);
    if (bytes && bytes + estimate > maxBytes) {
      batches.push([]);
      bytes = 0;
    }
    batches.at(-1).push(route);
    bytes += estimate;
  }
  return batches;
}

function mergeHostedExport({ exported, output, compressedHtml, compressedDirectory }) {
  fs.mkdirSync(output, { recursive: true });
  for (const key of filesBelow(exported)) {
    if (isRsc(key)) continue;
    const file = path.join(exported, key);
    if (compressedHtml && key.endsWith('.html')) {
      const bytes = fs.readFileSync(file);
      const digest = createHash('sha256').update(bytes).digest('hex');
      const prior = compressedHtml.get(key);
      if (prior) {
        if (prior.bytes !== bytes.length || prior.sha256 !== digest) throw new Error(`Hosted export batches disagree on shared output: ${key}`);
      } else {
        const target = path.join(compressedDirectory, key + '.gz');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, gzipSync(bytes, { level: 1 }), { flag: 'wx' });
        compressedHtml.set(key, { file: target, bytes: bytes.length, sha256: digest, dependencies: documentAssetKeys(bytes.toString('utf8')) });
      }
      continue;
    }
    const target = path.join(output, key);
    if (fs.existsSync(target)) {
      if (fs.statSync(file).size !== fs.statSync(target).size || sha256(file) !== sha256(target)) {
        throw new Error(`Hosted export batches disagree on shared output: ${key}`);
      }
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(file, target);
  }
  fs.rmSync(exported, { recursive: true });
}

module.exports = { hostedRenderBatches, mergeHostedExport };
