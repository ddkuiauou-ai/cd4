const fs = require('node:fs');
const path = require('node:path');
const { ROOT, STAGE, writeJson } = require('./static-tools.cjs');

async function main() {
  const [target, date, revision] = process.argv.slice(2);
  const output = target && path.resolve(target);
  if (!output || !output.startsWith(STAGE + path.sep) || !date || !revision) {
    throw new Error('Usage: prepare-static-market.cjs <new .static-build directory> <expected business date> <expected revision>');
  }
  fs.mkdirSync(output);
  process.env.NODE_ENV = 'production';
  process.env.STATIC_PREPARING = '1';
  const nextRequire = require('node:module').createRequire(require.resolve('next/package.json'));
  nextRequire('@next/env').loadEnvConfig(ROOT, false, { info() {}, error() {} });
  require('./register-typescript.cjs');
  const { closeDatabase } = require('../db/index.ts');
  const { getLiveMarketCsv } = require('../lib/data/market-csv.ts');
  const { MARKET_CSV_INPUT } = require('../lib/csv/market.ts');
  try {
    const csv = await getLiveMarketCsv(`${date}.csv`);
    if (!csv || csv.revision !== revision) throw new Error('Current market publication does not match expected date/revision');
    const file = path.join(output, MARKET_CSV_INPUT);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, csv.body, { flag: 'wx' });
    writeJson(path.join(output, 'market-csv.json'), csv.metadata);
    console.log(JSON.stringify(csv.metadata));
  } finally {
    await closeDatabase();
  }
}

main().catch(error => {
  console.error('Market CSV extraction failed:', error.code || error.name, error.message?.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]'));
  process.exitCode = 1;
});
