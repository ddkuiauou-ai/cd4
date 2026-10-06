/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node.js CommonJS integration test. */
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { constants, accessSync, mkdirSync, mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");
const postgres = require("postgres");
const { drizzle } = require("drizzle-orm/postgres-js");
const { migrate } = require("drizzle-orm/postgres-js/migrator");

const migrationsFolder = path.resolve(__dirname, "../drizzle");
const requiredTables = [
  "bppedd", "company", "display_name", "marketcap", "pension", "price",
  "search_name", "security", "security_rank", "stockcodename",
  "tmp_bppedds", "tmp_marketcaps", "tmp_prices",
];
const expectedMetrics = ["marketcap", "bps", "per", "pbr", "eps", "div", "dps"];

function executable(filename) {
  try {
    accessSync(filename, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findPostgresTools() {
  const directories = [...new Set([
    ...(process.env.PATH || "").split(path.delimiter),
    "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin",
  ].filter(Boolean))];
  for (const directory of directories) {
    const initdb = path.join(directory, "initdb");
    const pgCtl = path.join(directory, "pg_ctl");
    if (executable(initdb) && executable(pgCtl)) return { initdb, pgCtl };
  }
  return null;
}

function command(filename, args, environment) {
  const result = spawnSync(filename, args, {
    encoding: "utf8", env: environment, timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${path.basename(filename)} failed: ${result.error?.message || ""}\n${result.stdout || ""}${result.stderr || ""}`);
  }
  return result;
}

function normalizedSql(value) {
  return String(value)
    .replace(/"[^"\n]+"\./g, "")
    .replace(/"/g, "")
    .replace(/::(?:text|character varying|integer|bigint|double precision)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\((.*)\)$/, "$1");
}

function normalizedType(value) {
  return String(value)
    .replace(/^serial$/, "integer")
    .replace(/^bigserial$/, "bigint")
    .replace(/^varchar(?=\(|$)/, "character varying")
    .replace(/^timestamp$/, "timestamp without time zone")
    .replace(/^public\./, "")
    .replace(/"/g, "");
}

async function compareCatalog(sql, snapshot) {
  const tables = Object.values(snapshot.tables);
  const columns = await sql`
    SELECT c.relname AS table_name, a.attname AS column_name,
      format_type(a.atttypid, a.atttypmod) AS type,
      a.attnotnull AS not_null, a.attidentity AS identity,
      pg_get_expr(d.adbin, d.adrelid) AS default_expression
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum
  `;
  const expectedColumns = tables.flatMap((table) => Object.values(table.columns)
    .map((column) => ({ table: table.name, column })));
  assert.equal(columns.length, expectedColumns.length, "catalog column count matches the PostgreSQL snapshot");
  const columnMap = new Map(columns.map((column) => [`${column.table_name}.${column.column_name}`, column]));
  for (const { table, column } of expectedColumns) {
    const label = `${table}.${column.name}`;
    const actual = columnMap.get(label);
    assert.ok(actual, `${label} exists`);
    assert.equal(normalizedType(actual.type), normalizedType(column.type), `${label} type`);
    assert.equal(actual.not_null, column.notNull || column.primaryKey, `${label} nullability`);
    assert.equal(actual.identity, column.identity ? (column.identity.type === "always" ? "a" : "d") : "", `${label} identity`);
    if (Object.hasOwn(column, "default")) {
      assert.equal(normalizedSql(actual.default_expression), normalizedSql(column.default), `${label} default`);
    } else if (/^(?:big)?serial$/.test(column.type)) {
      assert.match(actual.default_expression, /^nextval\(/, `${label} sequence default`);
    } else {
      assert.equal(actual.default_expression, null, `${label} has no undeclared default`);
    }
  }

  const indexes = await sql`
    SELECT c.relname AS table_name, ic.relname AS name,
      i.indisunique AS is_unique, am.amname AS method,
      pg_get_expr(i.indpred, i.indrelid) AS predicate,
      (SELECT json_agg(json_build_object(
        'expression', pg_get_indexdef(i.indexrelid, key_number, true),
        'descending', (i.indoption[key_number - 1]::integer & 1) = 1,
        'nullsFirst', (i.indoption[key_number - 1]::integer & 2) = 2
      ) ORDER BY key_number)
      FROM generate_series(1, i.indnkeyatts) AS key_number) AS columns
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_am am ON am.oid = ic.relam
    WHERE n.nspname = 'public' AND NOT i.indisprimary
    ORDER BY ic.relname
  `;
  const expectedIndexes = tables.flatMap((table) => Object.values(table.indexes)
    .map((index) => ({ table: table.name, index })));
  assert.equal(indexes.length, expectedIndexes.length, "all declared secondary indexes are installed");
  const indexMap = new Map(indexes.map((index) => [index.name, index]));
  for (const { table, index } of expectedIndexes) {
    const actual = indexMap.get(index.name);
    assert.ok(actual, `${index.name} exists`);
    assert.equal(actual.table_name, table, `${index.name} table`);
    assert.equal(actual.is_unique, index.isUnique, `${index.name} uniqueness`);
    assert.equal(actual.method, index.method || "btree", `${index.name} method`);
    assert.equal(actual.predicate == null ? null : normalizedSql(actual.predicate),
      index.where == null ? null : normalizedSql(index.where), `${index.name} predicate`);
    assert.equal(actual.columns.length, index.columns.length, `${index.name} key count`);
    index.columns.forEach((column, position) => {
      const key = actual.columns[position];
      const expression = column.expression;
      const descending = /\sDESC\b/i.test(expression) || column.asc === false;
      const nulls = expression.match(/\sNULLS\s+(FIRST|LAST)\b/i)?.[1]?.toLowerCase()
        || column.nulls || (descending ? "first" : "last");
      const withoutSort = (value) => normalizedSql(value)
        .replace(/\s+(?:ASC|DESC)\b/gi, "")
        .replace(/\s+NULLS\s+(?:FIRST|LAST)\b/gi, "");
      assert.equal(withoutSort(key.expression), withoutSort(expression), `${index.name} key ${position + 1}`);
      assert.equal(key.descending, descending, `${index.name} key ${position + 1} direction`);
      assert.equal(key.nullsFirst, nulls === "first", `${index.name} key ${position + 1} null ordering`);
    });
  }

  const foreignKeys = await sql`
    SELECT con.conname AS name, c.relname AS table_from, target.relname AS table_to,
      target_ns.nspname AS schema_to, con.confupdtype AS on_update, con.confdeltype AS on_delete,
      ARRAY(SELECT a.attname FROM unnest(con.conkey) WITH ORDINALITY AS k(number, position)
        JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.number
        ORDER BY k.position) AS columns_from,
      ARRAY(SELECT a.attname FROM unnest(con.confkey) WITH ORDINALITY AS k(number, position)
        JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.number
        ORDER BY k.position) AS columns_to
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class target ON target.oid = con.confrelid
    JOIN pg_namespace target_ns ON target_ns.oid = target.relnamespace
    WHERE n.nspname = 'public' AND con.contype = 'f'
    ORDER BY con.conname
  `;
  const expectedForeignKeys = tables.flatMap((table) => Object.values(table.foreignKeys));
  assert.equal(foreignKeys.length, expectedForeignKeys.length, "all declared foreign keys are installed");
  const foreignKeyMap = new Map(foreignKeys.map((foreignKey) => [foreignKey.name, foreignKey]));
  const actions = { "no action": "a", restrict: "r", cascade: "c", "set null": "n", "set default": "d" };
  for (const foreignKey of expectedForeignKeys) {
    const actual = foreignKeyMap.get(foreignKey.name);
    assert.ok(actual, `${foreignKey.name} exists`);
    assert.equal(actual.table_from, foreignKey.tableFrom, `${foreignKey.name} source table`);
    assert.equal(actual.table_to, foreignKey.tableTo, `${foreignKey.name} target table`);
    assert.equal(actual.schema_to, foreignKey.schemaTo || "public", `${foreignKey.name} target schema`);
    assert.deepEqual(actual.columns_from, foreignKey.columnsFrom, `${foreignKey.name} source columns`);
    assert.deepEqual(actual.columns_to, foreignKey.columnsTo, `${foreignKey.name} target columns`);
    assert.equal(actual.on_update, actions[foreignKey.onUpdate || "no action"], `${foreignKey.name} update action`);
    assert.equal(actual.on_delete, actions[foreignKey.onDelete || "no action"], `${foreignKey.name} delete action`);
  }
  return { columns: columns.length, indexes: indexes.length, foreignKeys: foreignKeys.length };
}

test("PostgreSQL migrations install and enforce the schema in an isolated local cluster", { timeout: 120_000 }, async (t) => {
  if (process.platform === "win32") {
    t.skip("This isolated PostgreSQL integration test requires native Unix sockets and is unsupported on Windows.");
    return;
  }
  const tools = findPostgresTools();
  if (!tools) {
    t.skip("Native PostgreSQL initdb and pg_ctl are unavailable; install PostgreSQL to run the isolated migration integration test.");
    return;
  }
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("PostgreSQL initdb cannot run as root; run this integration test as a regular local user.");
    return;
  }

  const journal = JSON.parse(readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8"));
  assert.equal(journal.dialect, "postgresql");
  assert.ok(journal.entries.length > 0, "the PostgreSQL migration history is nonempty");
  const latestMigration = journal.entries.at(-1);
  const snapshotName = `${String(latestMigration.idx).padStart(4, "0")}_snapshot.json`;
  const snapshot = JSON.parse(readFileSync(path.join(migrationsFolder, "meta", snapshotName), "utf8"));
  assert.equal(snapshot.dialect, "postgresql");
  const expectedTables = Object.values(snapshot.tables).map((table) => table.name).sort();
  for (const table of requiredTables) assert.ok(expectedTables.includes(table), `the latest snapshot contains ${table}`);

  // A short, unique socket path also avoids macOS's Unix socket path length limit.
  const temporaryBase = process.platform === "darwin" ? "/tmp" : tmpdir();
  const temporaryRoot = mkdtempSync(path.join(temporaryBase, "cd4-postgres-test-"));
  const dataDirectory = path.join(temporaryRoot, "data");
  const socketDirectory = path.join(temporaryRoot, "socket");
  mkdirSync(socketDirectory, { mode: 0o700 });
  const environment = { ...process.env, LC_ALL: "C" };
  // Never inherit connection settings or load the application's .env files.
  for (const name of Object.keys(environment)) {
    if (name.startsWith("PG") || name.startsWith("POSTGRES_") || name === "DATABASE_URL") delete environment[name];
  }
  let clusterStarted = false;
  let sql;
  try {
    command(tools.initdb, ["-D", dataDirectory, "-U", "cd4_migration_test", "--auth=trust", "--encoding=UTF8", "--locale=C"], environment);
    // TCP is disabled; only this test's unique Unix socket accepts connections.
    clusterStarted = true;
    command(tools.pgCtl, ["-D", dataDirectory, "-l", path.join(temporaryRoot, "postgres.log"), "-w", "-t", "20", "-o",
      `-h '' -k ${socketDirectory} -p 5432 -F -c synchronous_commit=off -c full_page_writes=off`, "start"], environment);
    sql = postgres({
      host: socketDirectory, port: 5432, user: "cd4_migration_test", database: "postgres",
      password: "isolated-test-only", ssl: false, max: 1, connect_timeout: 10, prepare: false,
      onnotice: () => {},
    });
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder });
    await migrate(db, { migrationsFolder });

    const applied = await sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`;
    assert.equal(applied.length, journal.entries.length, "running the migrator twice applies each migration only once");
    journal.entries.forEach((migration, position) => {
      const migrationSql = readFileSync(path.join(migrationsFolder, `${migration.tag}.sql`), "utf8");
      assert.equal(applied[position].hash, createHash("sha256").update(migrationSql).digest("hex"), `${migration.tag} hash`);
      assert.equal(String(applied[position].created_at), String(migration.when), `${migration.tag} timestamp`);
    });

    const installedTables = await sql`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    assert.deepEqual(installedTables.map((row) => row.tablename), expectedTables);
    const labels = await sql`
      SELECT e.enumlabel FROM pg_enum e JOIN pg_type p ON p.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = p.typnamespace
      WHERE n.nspname = 'public' AND p.typname = 'metric_type' ORDER BY e.enumsortorder
    `;
    assert.deepEqual(labels.map((row) => row.enumlabel), expectedMetrics);
    const catalog = await compareCatalog(sql, snapshot);
    t.diagnostic(`Installed ${installedTables.length} tables; compared ${catalog.columns} columns, ${catalog.indexes} indexes, and ${catalog.foreignKeys} foreign keys with the committed PostgreSQL snapshot.`);

    const largeInteger = "9007199254740993";
    const [company] = await sql`
      INSERT INTO company (company_id, name, kor_name, marketcap)
      VALUES ('migration-company', 'Migration Company', '마이그레이션 회사', ${largeInteger})
      RETURNING marketcap, created_at IS NOT NULL AS created_default,
        updated_at IS NOT NULL AS updated_default
    `;
    assert.equal(company.marketcap, largeInteger, "bigint retains precision beyond JavaScript's safe integer limit");
    assert.equal(company.created_default, true);
    assert.equal(company.updated_default, true);
    await sql`
      INSERT INTO security (security_id, company_id, ticker, name, kor_name, exchange)
      VALUES ('migration-security', 'migration-company', '000001', 'Migration Security', '마이그레이션 종목', 'KOSPI')
    `;
    const [displayName] = await sql`
      INSERT INTO display_name (value, company_id, company_name)
      VALUES ('Migration', 'migration-company', 'Migration Company') RETURNING id, "order"
    `;
    assert.ok(displayName.id > 0, "serial primary keys are generated");
    assert.equal(displayName.order, 0, "the declared order default is applied");
    const [rank] = await sql`
      INSERT INTO security_rank (security_id, metric_type, rank_date, current_rank, value)
      VALUES ('migration-security', 'marketcap', '2026-10-06', 1, 123.5)
      RETURNING id, rank_date::text AS rank_date,
        created_at IS NOT NULL AS created_default, updated_at IS NOT NULL AS updated_default
    `;
    assert.equal(typeof rank.id, "string");
    assert.ok(BigInt(rank.id) > 0n, "bigint identity keys are generated");
    assert.equal(rank.rank_date, "2026-10-06", "ranking uses a PostgreSQL date");
    assert.equal(rank.created_default, true);
    assert.equal(rank.updated_default, true);
    await assert.rejects(async () => await sql`
      INSERT INTO security_rank (security_id, metric_type, rank_date)
      VALUES ('missing-security', 'marketcap', '2026-10-06')
    `, (error) => error.code === "23503", "security_rank enforces its security foreign key");
    await assert.rejects(async () => await sql`
      INSERT INTO security_rank (security_id, metric_type, rank_date)
      VALUES ('migration-security', 'marketcap', '2026-10-06')
    `, (error) => error.code === "23505", "security_rank rejects duplicate security/metric/date entries");
    await assert.rejects(async () => await sql`
      INSERT INTO security_rank (security_id, metric_type, rank_date)
      VALUES ('migration-security', 'invalid-metric', '2026-10-07')
    `, (error) => error.code === "22P02", "metric_type rejects invalid enum labels");
    t.diagnostic("Verified migration idempotence, enum labels, defaults, serial/identity generation, bigint precision, foreign key enforcement, and ranking uniqueness.");
  } finally {
    try {
      if (sql) await sql.end({ timeout: 5 });
    } finally {
      try {
        if (clusterStarted) command(tools.pgCtl, ["-D", dataDirectory, "-m", "immediate", "-w", "-t", "10", "stop"], environment);
      } finally {
        rmSync(temporaryRoot, { recursive: true, force: true });
      }
    }
  }
});
