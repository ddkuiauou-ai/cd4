const fs = require('node:fs');
const path = require('node:path');
const { readJson, readManifest, STAGE, writeJson } = require('./static-tools.cjs');
require('./register-typescript.cjs');
const { readPrivateJsonText } = require('../lib/static-build/read-private-json.ts');
const { MARKET_CSV_INPUT, isMarketCsvTrade, marketCsvMetrics, serializeMarketCsv } = require('../lib/csv/market.ts');
const { listingContains } = require('../lib/security-lifecycle.ts');

function deriveMarketCsv(input, manifest) {
  const publication = manifest.sourcePublications?.['security_latest/krx-all'];
  if (!publication) return null;
  const date = publication.asOf;
  const eligible = readJson(path.join(input, 'search-security-ids.json'));
  const identityIds = new Set(readJson(path.join(input, 'identities.json')).map(row => row.securityId));
  if (!Array.isArray(eligible) || new Set(eligible).size !== eligible.length || !eligible.every(id => identityIds.has(id))) {
    throw new Error('Invalid frozen market membership');
  }
  const rows = eligible.map(id => {
    if (typeof id !== 'string' || /[\\/\0]/.test(id) || id === '.' || id === '..') throw new Error('Invalid frozen security ID');
    const file = JSON.parse(readPrivateJsonText(path.join(input, 'data', 'security', id + '.json')));
    const security = file.security;
    if (security.securityId !== id || !file.archive?.prices || !listingContains(security.selectedPeriod, date)) {
      throw new Error('Frozen market input lacks a current eligible security result; prepare a new input');
    }
    const current = security.state === 'published'
      && security.publication?.publicationKey === 'security_latest/krx-all'
      && security.publication.asOf === date && security.publication.revision === publication.revision
      && security.calculationId === security.publication.calculationId;
    const price = file.archive.prices.find(row => isMarketCsvTrade(row, security, date));
    const ranks = Object.fromEntries(marketCsvMetrics.map(metric => {
      const header = manifest.sourcePublications?.[`security_rank/krx-all/${metric}`];
      const rank = file.rankings[metric]?.ranking;
      if (header && (!rank || rank.publication?.revision !== header.revision || rank.rankDate !== header.asOf)) {
        throw new Error('Frozen market rank does not match the publication');
      }
      return [metric, header ? rank : undefined];
    }));
    return { security, current, price, ranks };
  });
  return serializeMarketCsv(date, rows);
}

function augmentMarketInput({ input, output, expectedCsv, allowSample = false }) {
  const source = fs.realpathSync(input);
  const manifest = readManifest({ allowSample, filename: path.join(source, 'manifest.json') });
  if (manifest.marketCsv || !manifest.sourcePublications?.['security_latest/krx-all']) return source;
  const destination = path.resolve(output);
  if (!destination.startsWith(STAGE + path.sep)) throw new Error('Augmented input must be inside .static-build');
  const csv = deriveMarketCsv(source, manifest);
  if (expectedCsv && fs.readFileSync(expectedCsv, 'utf8') !== csv.body) {
    throw new Error('Market CSV from the frozen input differs from the checked source');
  }
  fs.mkdirSync(destination);
  for (const name of ['assets', 'rankings', 'identities.json', 'companies.json', 'search-security-ids.json']) {
    const file = path.join(source, name);
    fs.symlinkSync(file, path.join(destination, name), fs.statSync(file).isDirectory() ? 'dir' : 'file');
  }
  const data = path.join(destination, 'data');
  fs.mkdirSync(data);
  for (const entry of fs.readdirSync(path.join(source, 'data'), { withFileTypes: true })) {
    fs.symlinkSync(path.join(source, 'data', entry.name), path.join(data, entry.name), entry.isDirectory() ? 'dir' : 'file');
  }
  fs.writeFileSync(path.join(destination, MARKET_CSV_INPUT), csv.body, { flag: 'wx' });
  writeJson(path.join(destination, 'manifest.json'), {
    ...manifest, marketCsv: csv.metadata, requiredFiles: [...new Set([...manifest.requiredFiles, csv.metadata.url.slice(1)])],
  });
  return destination;
}

if (require.main === module) {
  const [input, output, expectedCsv] = process.argv.slice(2);
  try {
    if (!input || !output) throw new Error('Usage: augment-static-market-input.cjs <input> <new .static-build directory> [checked CSV]');
    console.log(augmentMarketInput({ input, output, expectedCsv }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { augmentMarketInput };
