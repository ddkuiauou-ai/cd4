const assert = require('node:assert/strict');
const test = require('node:test');
const { fixture, loadModules } = require('./helpers/business-data.cjs');
const csv = loadModules()('lib/csv/ranking.ts');
const makeRow = (value = '9007199254740993') => ({ currentRank: 1, priorRank: null, companyId: 'company-1',
  securityId: 'security-1', name: '회사, "인용"\n두 줄', ticker: '000001', exchange: 'KOSPI', type: '보통주', value, metricDate: '2026-10-02' });
const makeSnapshot = rows => ({ scope: 'security', metric: 'marketcap', rows, totalCount: rows.length,
  rankDate: '2026-10-02', referenceDate: '2026-10-02', generatedAt: '2026-10-03T01:00:00Z',
  scopeKey: 'krx-all', revision: '9007199254740993', calculationId: 'example-calculation' });

test('CSV preserves exact decimal/revision, quote/newline escaping, leading-zero ticker and missing/zero/negative values', () => {
  const rows = [makeRow(), makeRow(0), makeRow(-5), makeRow(null)];
  const text = csv.serializeRankingCsv(makeSnapshot(rows));
  assert.equal(text.charCodeAt(0), 0xfeff); assert.match(text, /9007199254740993/);
  assert.match(text, /'000001/); assert.match(text, /"회사, ""인용""\n두 줄"/);
  assert.match(text, /,0,2026-10-02/); assert.match(text, /,-5,2026-10-02/); assert.match(text, /,,2026-10-02/);
  const metadata = csv.readRankingCsvMetadata(text);
  assert.equal(metadata.revision, '9007199254740993'); assert.equal(metadata.scopeKey, 'krx-all');
  assert.equal(metadata.totalCount, 4);
});

test('CSV comparison never rounds exact integer strings into JS numbers', () => {
  const text = csv.serializeRankingCsv({ ...makeSnapshot([makeRow()]), scope: 'company' });
  const expected = [{ id: 'company-1', rank: 1, priorRank: null, value: '9007199254740993', metricDate: '2026-10-02' }];
  assert.equal(csv.hasCompanyRankingCsvChanges(text, expected), false);
  assert.equal(csv.hasCompanyRankingCsvChanges(text, [{ ...expected[0], value: '9007199254740992' }]), true);
});

test('export reads all rows with one header, uses rank observation date, propagates failures', async () => {
  const { state, load } = fixture(); const data = load('lib/data/ranking-export.ts');
  const result = await data.getWholeRankingExport('security', 'per');
  assert.equal(result.revision, '1'); assert.equal(result.rankDate, '2026-10-02'); assert.equal(result.rows[0].value, '-5');
  assert.equal(result.rows[0].metricDate, '2026-10-02');
  assert.deepEqual(state.transactions[0], { isolationLevel: 'repeatable read', accessMode: 'read only' });
  state.faults.add('rows'); await assert.rejects(data.getWholeRankingExport('security', 'per'), /unavailable/);
});

test('download distinguishes unpublished, published zero and changed revision', async () => {
  const { state, load } = fixture(); const data = load('lib/data/ranking-export.ts');
  const changed = await data.createRankingCsvResponse('security', 'per', '2'); assert.equal(changed.status, 409);
  state.publications.find(row => row.resultKind === 'security_rank').includedCount = 0; state.ranks = [];
  const zero = await data.createRankingCsvResponse('security', 'per'); assert.equal(zero.status, 200);
  assert.equal(zero.headers.get('x-ranking-row-count'), '0'); assert.equal(zero.headers.get('x-ranking-revision'), '1');
  assert.equal(zero.headers.get('cache-control'), 'no-store');
  const zeroText = await zero.text();
  assert.match(zeroText, /결과 revision/);
  const metadata = csv.readRankingCsvResponseMetadata(zeroText, zero.headers);
  assert.equal(metadata.totalCount, 0); assert.equal(metadata.scope, 'security'); assert.equal(metadata.metric, 'per');
  assert.equal(metadata.scopeKey, 'krx-all'); assert.equal(metadata.referenceDate, '2026-10-02');
  assert.equal(metadata.revision, '1'); assert.equal(metadata.calculationId, '11111111-1111-4111-8111-111111111111');
  assert.throws(() => csv.readRankingCsvMetadata(zeroText), /빈 순위 CSV/);
  state.publications = [];
  assert.equal((await data.createRankingCsvResponse('security', 'per')).status, 404);
});

test('header/result row-count mismatch never exports partial results as successful CSV', async () => {
  const { state, load } = fixture();
  state.publications.find(row => row.resultKind === 'security_rank').includedCount = 2;
  await assert.rejects(load('lib/data/ranking-export.ts').getWholeRankingExport('security', 'per'), /행 개수/);
});

test('Korea business dates and malformed/truncated CSV checks remain exact', () => {
  assert.equal(csv.csvDate(new Date('2000-01-03T15:00:00Z')), '2000-01-04');
  assert.throws(() => csv.readRankingCsvMetadata('<html>failure</html>'));
  const text = csv.serializeRankingCsv(makeSnapshot([makeRow(), makeRow(0)]));
  assert.throws(() => csv.readRankingCsvMetadata(text.split('\n').slice(0, 2).join('\n')));
});
