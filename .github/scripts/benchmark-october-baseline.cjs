/* eslint-disable @typescript-eslint/no-require-imports -- Standalone benchmark entry point. */
const fs = require('node:fs');
const path = require('node:path');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const postgres = require('postgres');
const { drizzle } = require('drizzle-orm/postgres-js');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
require('../../scripts/register-typescript.cjs');
const { getPostgresConnection } = require('../../db/connection.ts');
const { listedSecurityPeriods } = require('../../lib/data/listed-security-periods.ts');

const day = '2026-10-07';
const nextDay = '2026-10-08';
const boundary = `TIMESTAMPTZ '${day}T00:00:00+09:00'`;
const expectedRevision = '52';
const calculation = '4b9ed4e4-6628-48fa-9fdc-2a51fd89d853';
const provenance = 'benchmark-october-07-reconstructed';
const metrics = ['marketcap', 'bps', 'per', 'pbr', 'eps', 'div', 'dps'];
const keys = new Set(['security_latest/krx-all', 'company_marketcap/krx-all',
  ...metrics.map(metric => `security_rank/krx-all/${metric}`)]);
const refusal = Symbol('benchmark-refusal');
const mark = () => performance.now();
const elapsed = start => Math.round((mark() - start) / 1000);

function requireCondition(condition, reason) {
  if (!condition) throw Object.assign(new Error(reason), { [refusal]: reason });
}

function scratchUrl(value, role) {
  const url = new URL(value);
  requireCondition(['postgresql:', 'postgres:'].includes(url.protocol) && url.hostname === '127.0.0.1'
    && url.pathname === '/cd_october_qa' && url.port && url.username === role && url.password
    && !url.search && !url.hash, 'invalid-loopback-dsn');
  return url;
}

async function copy(from, to, table, columns, select) {
  const writer = await to.unsafe(`COPY ${table} (${columns}) FROM STDIN`).writable();
  let bytes = 0, rows = 0;
  try {
    const reader = await from.unsafe(`COPY (${select}) TO STDOUT`).readable();
    await pipeline(reader, new Transform({
      transform(chunk, _encoding, done) {
        bytes += chunk.length;
        for (let newline = chunk.indexOf(10); newline !== -1; newline = chunk.indexOf(10, newline + 1)) rows++;
        done(null, chunk);
      },
    }), writer);
    return { bytes, rows };
  } catch (error) {
    writer.destroy();
    throw error;
  }
}

async function copySource(source, target, stage, { verifyTls, revision }) {
  await target.unsafe(`
    CREATE TEMP TABLE benchmark_latest (security_id text PRIMARY KEY) ON COMMIT DROP;
    CREATE TEMP TABLE benchmark_company_rank ON COMMIT DROP AS
      SELECT company_id, marketcap_rank, ranking_state, exclusion_reason FROM company WITH NO DATA;
    CREATE TEMP TABLE benchmark_security_rank ON COMMIT DROP AS
      SELECT security_id, scope_key, metric_type, current_rank, value, value_observed_at, ranking_state, exclusion_reason,
        publication_key FROM security_rank WITH NO DATA
  `);
  return source.begin('isolation level repeatable read read only', async from => {
    const [session] = await from`
      SELECT current_setting('transaction_read_only') = 'on' AS readonly,
        current_setting('transaction_isolation') = 'repeatable read' AS repeatable,
        COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()), false) AS tls
    `;
    requireCondition(session.readonly && session.repeatable && (!verifyTls || session.tls), 'invalid-source-session');
    await from.unsafe("SET LOCAL statement_timeout = '20min'; SET LOCAL lock_timeout = '5s'; SET LOCAL idle_in_transaction_session_timeout = '5min'");
    const heads = await from`
      SELECT publication_key, revision::text, to_char(as_of AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day
      FROM public.result_publication
    `;
    requireCondition(heads.length === keys.size && heads.every(head => keys.has(head.publication_key)
      && head.day === nextDay && head.revision === revision), 'unexpected-october-08-publication');
    const result = {};
    const transfer = async (table, columns, select, label = table) => {
      stage(`copy-${label}`);
      const copied = await copy(from, target, table, columns, select);
      stage(`copy-${label}`, copied);
      result[label] = copied.bytes;
    };
    const relation = (table, columns, where = '') => transfer(table, columns, `SELECT ${columns} FROM public.${table} ${where}`);
    await transfer('result_publication',
      'publication_key, result_kind, scope_key, metric_type, as_of, revision, calculation_id, row_count, included_count, input_ref, rule_ref, published_at',
      `SELECT publication_key, result_kind, scope_key, metric_type, ${boundary}, revision - 1, '${calculation}'::uuid,
        row_count, included_count, '${provenance}', rule_ref, TIMESTAMPTZ '${day}T17:30:00+09:00' FROM public.result_publication`);
    await relation('company', 'company_id, name, kor_name, address, kor_address, country, type, tel, fax, postal_code, homepage, employees, industry, established_date, logo, created_at, updated_at');
    await relation('security', 'security_id, company_id, ticker, name, kor_name, listing_date, delisting_date, type, exchange, country, created_at, updated_at');
    await relation('security_listing_period', 'period_id, security_id, listing_date, delisting_date, last_present_on, listing_source_ref, delisting_source_ref, created_at, updated_at');
    await relation('security_event', 'event_id, security_id, company_id, event_type, effective_on, date_precision, event_year, old_name, new_name, source_ref, basis, created_at, updated_at');
    await transfer('stockcodename', 'date, ticker, source_ref, security_id, name, exchange',
      `SELECT DISTINCT roster.date, roster.ticker, roster.source_ref, roster.security_id, roster.name, roster.exchange
        FROM public.security_listing_period period
        JOIN LATERAL (
          SELECT date, ticker, source_ref, security_id, name, exchange FROM public.stockcodename
          WHERE security_id = period.security_id AND date = (period.last_present_on::timestamp AT TIME ZONE 'Asia/Seoul')
          OFFSET 0
        ) roster ON true`);
    const current = relation => `FROM public.${relation} r JOIN public.result_publication p
      ON r.publication_key = p.publication_key AND r.result_revision = p.revision AND r.calculation_id = p.calculation_id`;
    await transfer('benchmark_latest', 'security_id', `SELECT r.security_id ${current('security')}`, 'security-latest');
    await transfer('benchmark_company_rank', 'company_id, marketcap_rank, ranking_state, exclusion_reason',
      `SELECT r.company_id, r.marketcap_rank, r.ranking_state, r.exclusion_reason ${current('company')}`, 'company-rank');
    await transfer('benchmark_security_rank', 'security_id, scope_key, metric_type, current_rank, value, value_observed_at, ranking_state, exclusion_reason, publication_key',
      `SELECT r.security_id, r.scope_key, r.metric_type, r.current_rank, r.value, r.value_observed_at,
        r.ranking_state, r.exclusion_reason, r.publication_key ${current('security_rank')}
        WHERE r.scope_key = p.scope_key AND r.metric_type = p.metric_type AND r.rank_date = p.as_of`, 'security-rank');
    const observations = `WHERE security_id IS NOT NULL AND date <= ${boundary}`;
    // Bound each wire transfer using the source table's primary-key ranges.
    // All ranges still come from the same read-only repeatable-read snapshot.
    async function history(table, columns) {
      stage(`copy-${table}-bounds`);
      const [range] = await from.unsafe(
        `SELECT (SELECT id FROM public.${table} ORDER BY id LIMIT 1) AS first,
          (SELECT id FROM public.${table} ORDER BY id DESC LIMIT 1) AS last`
      );
      result[table] = 0;
      const batchSize = 500_000;
      for (let first = range.first; first != null && first <= range.last; first += batchSize) {
        const label = `copy-${table}-${Math.floor((first - range.first) / batchSize) + 1}`;
        stage(label);
        const copied = await copy(from, target, table, columns,
          `SELECT ${columns} FROM public.${table} ${observations}
           AND id >= ${first} AND id <= ${Math.min(first + batchSize - 1, range.last)}`);
        stage(label, copied);
        result[table] += copied.bytes;
      }
    }
    await history('price', 'security_id, date, ticker, exchange, source_ref, open, high, low, close, volume, fvolume, transaction, rate, year, month');
    await history('marketcap', 'security_id, date, ticker, exchange, source_ref, name, kor_name, marketcap, volume, shares, year, month');
    await history('bppedd', `security_id, date, ticker, exchange, source_ref, name, kor_name, year, month,
      ${metrics.slice(1).flatMap(metric => [metric, metric + '_state']).join(', ')}`);
    return result;
  });
}

async function eligibleListings(tx) {
  const securities = await tx`SELECT security_id AS "securityId", listing_date AS "listingDate", delisting_date AS "delistingDate" FROM security`;
  const periods = await tx`SELECT security_id AS "securityId", period_id AS "periodId", listing_date::text AS "listingDate",
    delisting_date::text AS "delistingDate" FROM security_listing_period ORDER BY listing_date`;
  const before = listedSecurityPeriods(securities, periods, day);
  const after = listedSecurityPeriods(securities, periods, nextDay);
  requireCondition(before.size === after.size && [...before].every(([id, period]) => after.has(id)
    && after.get(id)?.periodId === period?.periodId), 'october-listing-inventory-changed');
  requireCondition(before.size > 0, 'no-eligible-listings');
  await tx`CREATE TEMP TABLE benchmark_members (security_id text PRIMARY KEY) ON COMMIT DROP`;
  await tx`INSERT INTO benchmark_members SELECT unnest(${tx.array([...before.keys()])}::text[])`;
  return before.size;
}

function observationFor(metric) {
  if (metric === 'price') return { table: 'price', value: 'close' };
  if (metric === 'shares' || metric === 'marketcap') return { table: 'marketcap', value: metric };
  return { table: 'bppedd', value: metric, state: `${metric}_state` };
}

async function synthesizeLatest(tx) {
  await tx.unsafe(`
    UPDATE security s SET publication_key = p.publication_key, result_revision = p.revision, calculation_id = p.calculation_id
    FROM benchmark_latest l, result_publication p
    WHERE s.security_id = l.security_id AND p.result_kind = 'security_latest'
  `);
  for (const metric of ['price', 'shares', ...metrics]) {
    const { table, value, state } = observationFor(metric);
    // Use the Oct 7 observation where available and preserve the last actual provided value for missing fields.
    await tx.unsafe(`
      WITH observed AS (
        SELECT s.security_id, today.${value} AS value, today.date AS observed_at,
          COALESCE(${state ? `today.${state}::text` : "CASE WHEN today.date IS NOT NULL THEN 'provided' END"},
            CASE WHEN previous.date IS NULL THEN 'no_observation' ELSE 'row_missing' END)::result_field_state AS state,
          previous.${value} AS last_value, previous.date AS last_date
        FROM benchmark_latest latest JOIN security s USING (security_id)
        LEFT JOIN ${table} today ON today.security_id = s.security_id AND today.exchange = s.exchange
          AND today.ticker = s.ticker AND today.date = ${boundary}
        LEFT JOIN LATERAL (
          SELECT history.${value}, history.date FROM ${table} history
          WHERE history.security_id = s.security_id AND history.date < ${boundary} AND history.${value} IS NOT NULL
          ORDER BY history.date DESC, history.exchange, history.ticker LIMIT 1
        ) previous ON today.${value} IS NULL
      )
      UPDATE security s SET ${metric} = o.value, ${metric}_state = o.state,
        ${metric}_date = CASE WHEN o.state = 'no_observation' THEN NULL ELSE ${boundary} END,
        ${metric}_source_ref = CASE WHEN o.state = 'no_observation' THEN NULL ELSE '${provenance}' END,
        ${metric}_last_provided = COALESCE(o.value, o.last_value),
        ${metric}_last_provided_date = COALESCE(CASE WHEN o.value IS NOT NULL THEN o.observed_at END, o.last_date),
        ${metric}_last_provided_source_ref = CASE WHEN COALESCE(o.value, o.last_value) IS NOT NULL THEN '${provenance}' END
      FROM observed o WHERE s.security_id = o.security_id
    `);
  }
}

async function synthesizeRanks(tx) {
  await tx.unsafe(`
    WITH company_cap AS (
      SELECT s.company_id, CASE WHEN count(c.security_id) = count(*) THEN sum(c.marketcap) END AS value
      FROM benchmark_members m JOIN security s USING(security_id)
      LEFT JOIN marketcap c ON c.security_id = s.security_id AND c.exchange = s.exchange
        AND c.ticker = s.ticker AND c.date = ${boundary}
      WHERE s.company_id IS NOT NULL GROUP BY s.company_id
    )
    UPDATE company c SET marketcap = cap.value,
      marketcap_rank = CASE WHEN cap.value IS NOT NULL THEN r.marketcap_rank END, marketcap_date = ${boundary},
      marketcap_completeness = CASE WHEN cap.value IS NULL THEN 'missing_input' ELSE 'complete' END::marketcap_completeness,
      ranking_state = CASE WHEN cap.value IS NULL THEN 'excluded' ELSE r.ranking_state::text END::ranking_state,
      exclusion_reason = COALESCE(r.exclusion_reason, CASE WHEN cap.value IS NULL THEN 'benchmark_missing_prior_observation' END),
      result_source_ref = '${provenance}', publication_key = p.publication_key, result_revision = p.revision, calculation_id = p.calculation_id
    FROM benchmark_company_rank r LEFT JOIN company_cap cap USING (company_id), result_publication p
    WHERE c.company_id = r.company_id AND p.result_kind = 'company_marketcap'
  `);
  for (const metric of metrics) {
    const { table, value } = observationFor(metric);
    await tx.unsafe(`
      WITH observations AS (
        SELECT r.*, COALESCE(CASE WHEN r.value_observed_at <= ${boundary} THEN r.value END, history.${value}::numeric) AS prior_value,
          COALESCE(CASE WHEN r.value_observed_at <= ${boundary} THEN r.value_observed_at END, history.date) AS prior_date
        FROM benchmark_security_rank r
        LEFT JOIN LATERAL (
          SELECT h.${value}, h.date FROM ${table} h WHERE h.security_id = r.security_id AND h.${value} IS NOT NULL
          ORDER BY h.date DESC, h.exchange, h.ticker LIMIT 1
        ) history ON r.value_observed_at IS NULL OR r.value_observed_at > ${boundary}
        WHERE r.metric_type = '${metric}'
      )
      INSERT INTO security_rank (security_id, scope_key, metric_type, rank_date, current_rank, value, value_observed_at,
        ranking_state, exclusion_reason, evidence_ref, publication_key, result_revision, calculation_id)
      SELECT r.security_id, r.scope_key, r.metric_type, ${boundary}, CASE WHEN r.prior_value IS NOT NULL THEN r.current_rank END,
        r.prior_value, r.prior_date,
        CASE WHEN r.prior_value IS NOT NULL THEN r.ranking_state ELSE 'excluded' END,
        COALESCE(r.exclusion_reason, CASE WHEN r.prior_value IS NULL THEN 'benchmark_missing_prior_observation' END),
        '${provenance}', p.publication_key, p.revision, p.calculation_id
      FROM observations r JOIN result_publication p USING (publication_key)
    `);
  }
  await tx.unsafe(`
    UPDATE result_publication p SET row_count = counts.total, included_count = counts.included
    FROM (SELECT publication_key, count(*)::int AS total, count(*) FILTER (WHERE ranking_state = 'included')::int AS included
      FROM security_rank GROUP BY publication_key) counts WHERE p.publication_key = counts.publication_key;
    UPDATE result_publication p SET row_count = counts.total, included_count = counts.included
    FROM (SELECT publication_key, count(*)::int AS total, count(*) FILTER (WHERE ranking_state = 'included')::int AS included
      FROM company WHERE publication_key IS NOT NULL GROUP BY publication_key) counts WHERE p.publication_key = counts.publication_key;
    UPDATE result_publication SET row_count = (SELECT count(*)::int FROM benchmark_latest) WHERE result_kind = 'security_latest'
  `);
}

async function trimScratchIndexes(target) {
  // The empty rehearsal DB only needs the unique business keys and per-security history range scans.
  const indexes = await target`
    SELECT quote_ident(ns.nspname) || '.' || quote_ident(idx.relname) AS name
    FROM pg_index x JOIN pg_class tbl ON tbl.oid = x.indrelid
      JOIN pg_class idx ON idx.oid = x.indexrelid JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
    WHERE ns.nspname = 'public' AND tbl.relname IN ('price', 'marketcap', 'bppedd')
      AND NOT x.indisunique AND NOT x.indisexclusion
      AND idx.relname NOT IN ('price_security_id_date_idx', 'marketcap_security_id_date_idx', 'bppedd_security_id_date_idx')
  `;
  if (indexes.length) await target.unsafe('DROP INDEX ' + indexes.map(index => index.name).join(', '));
}

async function seedBaseline(source, target, stage, { verifyTls = true, revision = expectedRevision, majorVersion = 18, readerPassword } = {}) {
  stage('check-scratch');
  const [targetInfo] = await target`
    SELECT current_database() AS database, current_user AS username, host(inet_server_addr()) AS address,
      current_setting('server_version_num')::int / 10000 AS major,
      to_regclass('public.result_publication') IS NULL AND to_regnamespace('drizzle') IS NULL
        AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'october_reader') AS empty
  `;
  requireCondition(targetInfo.database === 'cd_october_qa' && targetInfo.username === 'october_admin'
    && targetInfo.major === majorVersion && targetInfo.empty && targetInfo.address, 'scratch-not-a-fresh-benchmark-database');
  stage('migrate-scratch');
  await migrate(drizzle(target), { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  await trimScratchIndexes(target);
  const report = await target.begin(async tx => {
    stage('check-source');
    const startCopy = mark();
    const sourceBytes = await copySource(source, tx, stage, { verifyTls, revision });
    const copySeconds = elapsed(startCopy), startProjection = mark();
    stage('analyze-scratch');
    await tx.unsafe('ANALYZE price; ANALYZE marketcap; ANALYZE bppedd');
    stage('check-listings');
    const listed = await eligibleListings(tx);
    stage('derive-latest');
    await synthesizeLatest(tx);
    stage('derive-ranks');
    await synthesizeRanks(tx);
    stage('count-observations');
    const [counts] = await tx.unsafe(`
      SELECT (SELECT count(*)::int FROM security) AS securities, (SELECT count(*)::int FROM company) AS companies,
        (SELECT count(*)::int FROM price) AS prices, (SELECT count(*)::int FROM marketcap) AS marketcaps,
        (SELECT count(*)::int FROM bppedd) AS metrics,
        (SELECT count(*)::int FROM price WHERE date = ${boundary} AND close > 0) AS trading_day_prices,
        (SELECT count(*)::int FROM security_rank WHERE ranking_state = 'included') AS included_security_ranks,
        (SELECT count(*)::int FROM company WHERE ranking_state = 'included') AS included_company_ranks
    `);
    requireCondition(counts.trading_day_prices > 0 && counts.included_company_ranks > 0 && counts.included_security_ranks > 0, 'incomplete-october-07-benchmark');
    return { listed, counts, sourceBytes: Object.values(sourceBytes).reduce((sum, bytes) => sum + bytes, 0),
      copySeconds, projectionSeconds: elapsed(startProjection) };
  });
  stage('configure-reader');
  const [{ password }] = await target`SELECT quote_literal(${readerPassword}) AS password`;
  await target.unsafe(`
    CREATE ROLE october_reader LOGIN PASSWORD ${password};
    GRANT CONNECT ON DATABASE cd_october_qa TO october_reader;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO october_reader;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO october_reader;
    ALTER ROLE october_reader SET default_transaction_read_only = 'on'
  `);
  const [{ database_bytes }] = await target`SELECT pg_database_size(current_database())::text AS database_bytes`;
  return { day, revision: String(BigInt(revision) - 1n), ...report, databaseBytes: Number(database_bytes),
    assumptions: ['Oct 8 master, listing boundaries, roster names, and official rank positions reused; Oct 6 rank unavailable.',
      'Oct 7 latest fields and company totals use actual observations. Missing earlier rank values leave an official position unused.',
      'Oct 7 publication revision, calculation ID, evidence references, and publication timestamps are reconstructed for this benchmark.'] };
}

async function main() {
  let stage = 'configure';
  let source, target;
  try {
    const seed = scratchUrl(process.env.CD_QA_SEED_DATABASE_URL, 'october_admin');
    const reader = scratchUrl(process.env.CD_QA_FULL_DATABASE_URL, 'october_reader');
    requireCondition(seed.port === reader.port, 'scratch-dsn-port-mismatch');
    requireCondition(process.env.STATIC_RELEASE_POSTGRES_TLS === 'verify-full', 'source-requires-verified-tls');
    const connection = getPostgresConnection(process.env);
    requireCondition(!['localhost', '127.0.0.1', '::1'].includes(connection.host), 'source-must-be-separate');
    const options = { max: 1, connect_timeout: 12, prepare: false, onnotice: () => {}, connection: { timezone: 'Asia/Seoul' } };
    source = postgres({ ...connection, ...options });
    target = postgres(seed.href, { ...options, ssl: false });
    const report = await seedBaseline(source, target, (value, copied) => {
      stage = value;
      if (process.env.CD_QA_SEED_PROGRESS === '1') {
        const { bavail, bsize } = fs.statfsSync(process.env.CD_REHEARSAL_HOME);
        fs.writeSync(3, JSON.stringify({ phase: stage, diskFreeBytes: bavail * bsize, ...copied }) + '\n');
      }
    }, { readerPassword: decodeURIComponent(reader.password) });
    stage = 'check-market-coverage';
    requireCondition(report.counts.securities === 5496 && report.counts.companies === 4227 && report.listed === 2872,
      'unexpected-full-market-inventory');
    console.log(JSON.stringify(report));
  } catch (error) {
    const transportCodes = ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'CONNECTION_CLOSED', 'CONNECTION_DESTROYED',
      'ERR_STREAM_PREMATURE_CLOSE', 'ERR_SOCKET_TIMEOUT', 'ENOSPC'];
    const code = (error.severity && /^[A-Z0-9]{5}$/.test(error.code)) || transportCodes.includes(error.code)
      ? error.code : undefined;
    console.error(JSON.stringify({ stage, reason: error[refusal] ?? 'benchmark-baseline-failed', ...(code ? { code } : {}) }));
    process.exitCode = 1;
  } finally { await Promise.allSettled([source?.end({ timeout: 2 }), target?.end({ timeout: 2 })]); }
}

if (require.main === module) void main();
module.exports = { seedBaseline };
