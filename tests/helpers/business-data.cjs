const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const { PgDialect } = require('drizzle-orm/pg-core');
const { getTableName } = require('drizzle-orm');
const root = path.resolve(__dirname, '../..');
const dialect = new PgDialect();

function loadModules(db) {
  const loaded = new Map();
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = (name) => {
      if (name === '@/db') return { db };
      const local = name.startsWith('@/') ? path.join(root, name.slice(2))
        : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
      if (!local) return require(name);
      const resolved = [local, `${local}.ts`, `${local}.tsx`].find(file => existsSync(file) && !require('node:fs').statSync(file).isDirectory());
      assert.ok(resolved, `Unknown module ${name}`);
      return load(resolved);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  return relative => load(path.join(root, relative));
}

const day = value => new Date(`${value}T00:00:00+09:00`);
const calculationId = '11111111-1111-4111-8111-111111111111';
function publication(kind = 'security_rank', metric = 'per', revision = 1n, includedCount = 1) {
  return { publicationKey: `${kind}/krx-all${kind === 'security_rank' ? `/${metric}` : ''}`,
    resultKind: kind, scopeKey: 'krx-all', metricType: kind === 'security_rank' ? metric : null,
    asOf: day('2026-10-02'), revision, calculationId, rowCount: includedCount,
    includedCount: kind === 'security_latest' ? null : includedCount,
    inputRef: 'tem://inputs/1', ruleRef: 'tem://rules/1', publishedAt: new Date('2026-10-03T01:00:00Z') };
}
function fixture() {
  const securityHeader = publication('security_latest');
  const companyHeader = publication('company_marketcap', 'marketcap');
  const rankHeader = publication();
  const security = { securityId: 'security-1', companyId: 'company-1', name: 'Example', korName: '예시종목',
    ticker: '000001', exchange: 'KOSPI', type: '보통주', delistingDate: day('2026-10-01'),
    publicationKey: securityHeader.publicationKey, resultRevision: 1n, calculationId,
    createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-10-03T01:00:00Z'), prices: [], marketcaps: [], company: null };
  for (const metric of ['price', 'shares', 'marketcap', 'bps', 'per', 'pbr', 'eps', 'div', 'dps']) {
    const value = ['shares', 'marketcap'].includes(metric) ? 9007199254740993n : 0;
    Object.assign(security, { [metric]: value, [`${metric}Date`]: day('2026-10-02'), [`${metric}State`]: 'provided',
      [`${metric}SourceRef`]: 'tem://source/latest', [`${metric}LastProvided`]: value,
      [`${metric}LastProvidedDate`]: day('2026-10-02'), [`${metric}LastProvidedSourceRef`]: 'tem://source/latest' });
  }
  const company = { companyId: 'company-1', name: 'Example', korName: '예시기업', marketcap: '9007199254740993',
    marketcapDate: day('2026-10-02'), marketcapRank: 1, marketcapPriorRank: null,
    marketcapCompleteness: 'complete', rankingState: 'included', exclusionReason: null, resultSourceRef: 'tem://source/company',
    publicationKey: companyHeader.publicationKey, resultRevision: 1n, calculationId, securities: [] };
  const rank = { securityId: 'security-1', companyId: 'company-1', name: 'Example', korName: '예시종목',
    ticker: '000001', exchange: 'KOSPI', type: '보통주', rankingState: 'included',
    currentRank: 1, priorRank: null, value: '-5', valueObservedAt: day('2026-10-02'), metricDate: day('2026-10-02'),
    evidenceRef: 'tem://evidence/rank', updatedAt: new Date('2026-10-03T01:00:00Z'), company: null,
    publicationKey: rankHeader.publicationKey, resultRevision: 1n, calculationId };
  const state = { publications: [securityHeader, companyHeader, rankHeader], securities: [security], companies: [company],
    ranks: [rank], prices: [], marketcaps: [], metrics: [], faults: new Set(), queries: [], transactions: [], afterHeader: null };

  function queryDatabase(snapshot) {
    const fault = kind => { if (state.faults.has(kind)) throw new Error(`fixture-${kind}-unavailable`); };
    const recordWhere = (table, where) => {
      if (!where) return null;
      const query = dialect.sqlToQuery(where);
      state.queries.push({ table, ...query });
      return query;
    };
    const fieldName = column => column.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const compare = (value, parameter, operator) => {
      const comparable = value instanceof Date ? value.toISOString() : value;
      if (operator === '=') return comparable === parameter;
      if (operator === '<=') return comparable <= parameter;
      if (operator === '>=') return comparable >= parameter;
      if (operator === '<') return comparable < parameter;
      return comparable > parameter;
    };
    function identityRows(rows, query) {
      if (!query) return rows;
      // The fixture deliberately does not emulate publication acceptance; assertions inspect that SQL.
      const identityFields = new Set(['security_id', 'company_id', 'name', 'kor_name', 'ticker', 'exchange', 'type', 'date', 'marketcap_rank']);
      const tests = [...query.sql.matchAll(/"([a-z_]+)"\s*(=|<=|>=|<|>)\s*\$(\d+)/g)]
        .filter(match => identityFields.has(match[1])).map(match => row => compare(row[fieldName(match[1])], query.params[Number(match[3]) - 1], match[2]));
      for (const match of query.sql.matchAll(/"([a-z_]+)"\s+in\s*\(([^)]+)\)/gi)) {
        if (!identityFields.has(match[1])) continue;
        const parameters = [...match[2].matchAll(/\$(\d+)/g)].map(item => query.params[Number(item[1]) - 1]);
        tests.push(row => parameters.includes(row[fieldName(match[1])]));
      }
      if (query.sql.includes('"delisting_date" is null')) tests.push(row => row.delistingDate == null);
      const any = query.sql.includes(' or ');
      return rows.filter(row => !tests.length || (any ? tests.some(check => check(row)) : tests.every(check => check(row))));
    }
    function orderRows(rows, options = {}) {
      const ordering = (options.orderBy ?? []).map(value => dialect.sqlToQuery(value).sql);
      return [...rows].sort((a, b) => {
        for (const order of ordering) {
          const column = [...order.matchAll(/"([a-z_]+)"/g)].at(-1)?.[1];
          if (!column) continue;
          const field = fieldName(column);
          const va = order.includes('is null') ? a[field] == null : a[field];
          const vb = order.includes('is null') ? b[field] == null : b[field];
          const delta = va < vb ? -1 : va > vb ? 1 : 0;
          if (delta) return order.endsWith(' desc') ? -delta : delta;
        }
        return 0;
      });
    }
    function attachRelations(kind, row, options) {
      if (kind === 'company' && options.with?.securities) {
        const child = options.with.securities;
        const where = child.where ? dialect.sqlToQuery(child.where) : null;
        let securities = identityRows(snapshot.securities.filter(item => item.companyId === row.companyId), where, 'security');
        securities = orderRows(securities, child).slice(0, child.limit);
        return { ...row, securities };
      }
      if (kind === 'security' && options.with?.company) return { ...row, company: snapshot.companies.find(item => item.companyId === row.companyId) ?? null };
      return row;
    }
    const relation = (kind, rowsForRead) => ({
      async findFirst(options = {}) {
        fault(kind); const where = recordWhere(kind, options.where); const rows = rowsForRead();
        if (kind === 'publication') {
          const row = snapshot.publications.find(row => where?.params.includes(row.publicationKey)) ?? null;
          if (state.afterHeader) state.afterHeader(state);
          return row;
        }
        const row = identityRows(rows, where, kind)[0];
        return row ? attachRelations(kind, row, options) : null;
      },
      async findMany(options = {}) {
        fault(kind); const where = recordWhere(kind, options.where);
        const rows = orderRows(identityRows(rowsForRead(), where, kind), options);
        return rows.slice(options.offset ?? 0, options.limit == null ? undefined : (options.offset ?? 0) + options.limit)
          .map(row => attachRelations(kind, row, options));
      },
    });
    return {
      async execute(statement) {
        fault('price');
        const query = dialect.sqlToQuery(statement); state.queries.push({ table: 'price-batch', ...query });
        assert.match(query.sql, /CROSS JOIN LATERAL/);
        const ids = query.params.filter(value => typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}T/.test(value));
        const asOfValue = query.params.find(value => value instanceof Date || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value));
        const asOf = asOfValue instanceof Date ? asOfValue.toISOString() : asOfValue;
        const limit = query.params.at(-1);
        return ids.flatMap(id => snapshot.prices.filter(row => row.securityId === id && (!asOf || row.date.toISOString() <= asOf))
          .sort((a, b) => b.date - a.date).slice(0, limit).reverse());
      },
      query: { resultPublication: relation('publication', () => snapshot.publications),
        security: relation('security', () => snapshot.securities), securityRank: relation('rank', () => snapshot.ranks), company: relation('company', () => snapshot.companies),
        price: relation('price', () => snapshot.prices), marketcap: relation('marketcap', () => snapshot.marketcaps), bppedd: relation('metrics', () => snapshot.metrics) },
      select(columns) {
        let table, where, limit, offset = 0, order = [];
        const query = {
          from(value) { table = getTableName(value); return this; },
          where(value) { where = recordWhere(table, value); return this; },
          innerJoin() { return this; }, leftJoin() { return this; }, orderBy(...value) { order = value; return this; },
          limit(value) { limit = value; return this; }, offset(value) { offset = value; return this; },
          then(resolve, reject) {
            return Promise.resolve().then(() => {
              const rawRows = table === 'price' ? snapshot.prices : table === 'bppedd' ? snapshot.metrics : null;
              if (rawRows) {
                fault(table === 'price' ? 'price' : 'metrics');
                return orderRows(identityRows(rawRows, where, table), { orderBy: order }).slice(offset, limit == null ? undefined : offset + limit);
              }
              fault('rows'); let rows = snapshot.ranks;
              if (where?.sql.includes('current_rank" <')) rows = rows.filter(row => row.currentRank < where.params.at(-1));
              if (where?.sql.includes('current_rank" >')) rows = rows.filter(row => row.currentRank > where.params.at(-1));
              rows = rows.slice(offset, limit == null ? undefined : offset + limit);
              if (columns.rank && Object.keys(columns).length === 1) return rows.map(row => ({ rank: row.currentRank }));
              return rows;
            }).then(resolve, reject);
          },
        };
        return query;
      },
    };
  }
  const db = {
    ...queryDatabase(state),
    async transaction(callback, options) {
      state.transactions.push(options);
      return callback(queryDatabase(structuredClone({ ...state, afterHeader: null })));
    },
  };
  return { state, db, load: loadModules(db) };
}
module.exports = { loadModules, fixture, publication, day, calculationId };
