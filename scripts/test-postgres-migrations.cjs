/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node.js CommonJS integration test. */
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { constants, accessSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");
const Module = require("node:module");
const ts = require("typescript");
const postgres = require("postgres");
const { drizzle } = require("drizzle-orm/postgres-js");
const { migrate } = require("drizzle-orm/postgres-js/migrator");

const migrationsFolder = path.resolve(__dirname, "../drizzle");
const requiredTables = [
  "bppedd", "company", "display_name", "marketcap", "pension", "price",
  "search_name", "security", "security_rank", "stockcodename",
  "tmp_bppedds", "tmp_marketcaps", "tmp_prices",
  "result_publication",
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
    process.env.CD_TEST_PG_BIN,
    "/opt/homebrew/opt/postgresql@18/bin", "/usr/local/opt/postgresql@18/bin",
    ...(process.env.PATH || "").split(path.delimiter),
    "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin",
  ].filter(Boolean))];
  for (const directory of directories) {
    const initdb = path.join(directory, "initdb");
    const pgCtl = path.join(directory, "pg_ctl");
    if (!executable(initdb) || !executable(pgCtl)) continue;
    const version = spawnSync(pgCtl, ["--version"], { encoding: "utf8", timeout: 5_000 });
    if (version.status === 0 && /\(PostgreSQL\) 18\./.test(version.stdout)) {
      const share = ["../share/postgresql@18", "../share/postgresql"]
        .map((relative) => path.resolve(directory, relative))
        .find((candidate) => existsSync(path.join(candidate, "postgres.bki")));
      return { initdb, pgCtl, version: version.stdout.trim(), share };
    }
  }
  return null;
}

// Compile the real schema/helpers without opening the application's configured DB.
function loadTypeScript(relativePath) {
  const filename = path.resolve(__dirname, "..", relativePath);
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return loaded.exports;
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
    .replace(/::(?:metric_type|source_field_state|result_field_state|ranking_state|marketcap_completeness|result_kind)\b/g, "")
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
    // PostgreSQL truncates ASCII identifiers to 63 bytes, including generated FK names.
    const actual = foreignKeyMap.get(foreignKey.name.slice(0, 63));
    assert.ok(actual, `${foreignKey.name} exists`);
    assert.equal(actual.table_from, foreignKey.tableFrom, `${foreignKey.name} source table`);
    assert.equal(actual.table_to, foreignKey.tableTo, `${foreignKey.name} target table`);
    assert.equal(actual.schema_to, foreignKey.schemaTo || "public", `${foreignKey.name} target schema`);
    assert.deepEqual(actual.columns_from, foreignKey.columnsFrom, `${foreignKey.name} source columns`);
    assert.deepEqual(actual.columns_to, foreignKey.columnsTo, `${foreignKey.name} target columns`);
    assert.equal(actual.on_update, actions[foreignKey.onUpdate || "no action"], `${foreignKey.name} update action`);
    assert.equal(actual.on_delete, actions[foreignKey.onDelete || "no action"], `${foreignKey.name} delete action`);
  }
  const constraints = await sql`
    SELECT c.relname AS table_name, con.conname AS name, con.contype AS kind,
      ARRAY(SELECT a.attname FROM unnest(con.conkey) WITH ORDINALITY AS k(number, position)
        JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.number
        ORDER BY k.position) AS columns
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND con.contype IN ('p', 'c')
    ORDER BY c.relname, con.conname
  `;
  const expectedChecks = tables.flatMap((table) => Object.keys(table.checkConstraints || {})).sort();
  assert.deepEqual(constraints.filter((constraint) => constraint.kind === "c").map((constraint) => constraint.name).sort(),
    expectedChecks, "all declared CHECK constraints are installed");
  for (const table of tables) {
    const primary = Object.values(table.compositePrimaryKeys || {})[0]?.columns
      || Object.values(table.columns).filter((column) => column.primaryKey).map((column) => column.name);
    const installed = constraints.filter((constraint) => constraint.table_name === table.name && constraint.kind === "p");
    assert.equal(installed.length, primary.length ? 1 : 0, `${table.name} primary key count`);
    if (primary.length) assert.deepEqual(installed[0].columns, primary, `${table.name} primary key columns`);
  }
  const deferredKeys = await sql`
    SELECT c.relname AS table_name FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND con.contype = 'f' AND con.conname LIKE '%publication_key%'
      AND con.condeferrable AND con.condeferred ORDER BY c.relname
  `;
  assert.deepEqual(deferredKeys.map((key) => key.table_name), ["company", "security", "security_rank"],
    "publication foreign keys allow one atomic deferred replacement");
  const customTriggers = await sql`
    SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
  `;
  const guardFunctions = await sql`
    SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'cd_guard_%'
  `;
  assert.equal(customTriggers.length, 0, "0002 removes all eight custom publication triggers; internal FK triggers remain");
  assert.equal(guardFunctions.length, 0, "0002 removes all four publication guard functions");
  assert.equal(expectedChecks.length, 168, "the minimal contract retains its 168 row-local CHECK constraints");
  return { columns: columns.length, indexes: indexes.length, foreignKeys: foreignKeys.length, checks: expectedChecks.length };
}

test("PostgreSQL 18 installs row constraints and exercises the writer contract in an isolated local cluster", { timeout: 180_000 }, async (t) => {
  assert.notEqual(process.platform, "win32", "the isolated integration test requires Unix sockets");
  assert.match(process.versions.node, /^22\./, "run the integration test with the supported Node 22 runtime");
  const [, nodeMinor, nodePatch] = process.versions.node.split(".").map(Number);
  assert.ok(nodeMinor > 23 || (nodeMinor === 23 && nodePatch >= 3), "Node 22.23.3 or newer is required");
  const tools = findPostgresTools();
  assert.ok(tools, "PostgreSQL 18 initdb/pg_ctl are required; set CD_TEST_PG_BIN to their directory (the test never silently skips)");
  assert.ok(typeof process.getuid !== "function" || process.getuid() !== 0, "run initdb as a regular local user");

  const journal = JSON.parse(readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8"));
  assert.equal(journal.dialect, "postgresql");
  assert.equal(journal.entries.length, 3, "the fresh installation includes 0000, 0001 and the 0002 simplification");
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
  let verified = false;
  let sql;
  try {
    command(tools.initdb, ["-D", dataDirectory, "-U", "cd4_migration_test", "--auth=trust", "--encoding=UTF8", "--locale=C",
      ...(tools.share ? ["-L", tools.share] : [])], environment);
    // TCP is disabled; only this test's unique Unix socket accepts connections.
    clusterStarted = true;
    command(tools.pgCtl, ["-D", dataDirectory, "-l", path.join(temporaryRoot, "postgres.log"), "-w", "-t", "20", "-o",
      `-h '' -k ${socketDirectory} -p 5432 -F -c synchronous_commit=off -c full_page_writes=off`, "start"], environment);
    sql = postgres({
      host: socketDirectory, port: 5432, user: "cd4_migration_test", database: "postgres",
      password: "isolated-test-only", ssl: false, max: 4, connect_timeout: 10, prepare: false,
      onnotice: () => {},
    });
    const [{ server_version_num: serverVersion }] = await sql`SHOW server_version_num`;
    assert.ok(Number(serverVersion) >= 180000 && Number(serverVersion) < 190000, "the running server really is PostgreSQL 18");
    const schema = loadTypeScript("db/schema-postgres.ts");
    const db = drizzle(sql, { schema });
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
    t.diagnostic(`Installed ${installedTables.length} tables; compared ${catalog.columns} columns, ${catalog.indexes} indexes, ${catalog.foreignKeys} foreign keys and ${catalog.checks} CHECK constraints with the committed PostgreSQL snapshot.`);

    const largeInteger = "9007199254740993";
    const day = new Date("2000-01-04T00:00:00+09:00");
    const priorDay = new Date("2000-01-03T00:00:00+09:00");
    const calculationId = "00000000-0000-4000-8000-000000000001";
    const correctedId = "00000000-0000-4000-8000-000000000002";
    const { and, eq } = require("drizzle-orm");
    const { toDataDTO, businessDate } = loadTypeScript("lib/data/dto.ts");
    const rejectsCode = (action, code, reason) => assert.rejects(async () => await action(),
      (error) => (error.code || error.cause?.code) === code, reason);
    const verify = async (name, action) => {
      await action();
      t.diagnostic(`Verified: ${name}.`);
    };
    const header = (kind, scope = "krx-all", metric = null, rows = 0, included = null) => ({
      publicationKey: `${kind}/${scope}${metric ? `/${metric}` : ""}`,
      resultKind: kind, scopeKey: scope, metricType: metric, asOf: day,
      revision: 1n, calculationId, rowCount: rows, includedCount: included,
      inputRef: "test-input/immutable-1", ruleRef: "test-rule/v1",
    });
    const rawPrice = {
      date: day, ticker: "000001", exchange: "KOSPI", securityId: null,
      sourceRef: "test-source/price-1", open: 0, high: 0, low: 0, close: 1000,
      volume: 0n, transaction: BigInt(largeInteger), year: 2000, month: 1,
    };
    const rawMetrics = {
      date: day, ticker: "000001", exchange: "KOSPI", sourceRef: "test-source/metrics-1",
      bps: null, bpsState: "source_missing", per: 0, perState: "provided",
      pbr: null, pbrState: "unsupported", eps: -34, epsState: "provided",
      div: 0, divState: "provided", dps: null, dpsState: "source_missing", year: 2000, month: 1,
    };
    const rankRow = (metric = "per", scope = "krx-all", securityId = "migration-security", value = "0") => ({
      securityId, metricType: metric, scopeKey: scope, rankDate: day,
      currentRank: 1, priorRank: null, value, valueObservedAt: day,
      rankingState: "included", exclusionReason: null, evidenceRef: "test-rank/evidence-1",
      publicationKey: `security_rank/${scope}/${metric}`, resultRevision: 1n, calculationId,
    });

    // Test-only reference writer: tem must implement and verify its own lock/CAS
    // and publication policy. These checks are not automatic database guards.
    // Each final scope is scanned once, never once per changed result row.
    const scanFixturePublication = async (tx, publication) => {
      const kind = publication.result_kind;
      const table = { security_latest: "security", company_marketcap: "company", security_rank: "security_rank" }[kind];
      assert.ok(table, "fixture writer recognizes the publication kind");
      const ignored = kind === "security_latest"
        ? ["security_id", "company_id", "ticker", "name", "kor_name", "listing_date", "delisting_date", "type", "exchange", "country", "created_at", "updated_at"]
        : kind === "company_marketcap"
          ? ["company_id", "name", "kor_name", "address", "kor_address", "country", "type", "tel", "fax", "postal_code", "homepage", "employees", "industry", "established_date", "logo", "created_at", "updated_at"]
          : ["id", "created_at", "updated_at"];
      // Stable identity is preserved in the semantic comparison even when a
      // rank DELETE/INSERT allocates a different serial ID or audit timestamp.
      const identity = kind === "company_marketcap" ? "company_id" : "security_id";
      const included = kind === "security_latest" ? tx`NULL::int`
        : tx`count(*) FILTER (WHERE ranking_state = 'included')::int`;
      const dateMismatch = kind === "security_latest"
        ? tx`price_date > ${publication.as_of}::timestamptz OR shares_date > ${publication.as_of}::timestamptz
          OR marketcap_date > ${publication.as_of}::timestamptz OR bps_date > ${publication.as_of}::timestamptz
          OR per_date > ${publication.as_of}::timestamptz OR pbr_date > ${publication.as_of}::timestamptz
          OR eps_date > ${publication.as_of}::timestamptz OR div_date > ${publication.as_of}::timestamptz
          OR dps_date > ${publication.as_of}::timestamptz`
        : kind === "company_marketcap"
          ? tx`marketcap_date IS DISTINCT FROM ${publication.as_of}::timestamptz`
          : tx`rank_date IS DISTINCT FROM ${publication.as_of}::timestamptz
            OR scope_key IS DISTINCT FROM ${publication.scope_key}
            OR metric_type::text IS DISTINCT FROM ${publication.metric_type}`;
      const [result] = await tx`
        SELECT count(*)::int AS row_count, ${included} AS included_count,
          COALESCE(bool_or(result_revision IS DISTINCT FROM ${publication.revision}::bigint
            OR calculation_id IS DISTINCT FROM ${publication.calculation_id}::uuid
            OR (${dateMismatch})), false) AS wrong_metadata,
          COALESCE(jsonb_agg(jsonb_build_object('identity', ${tx(identity)},
            'result', to_jsonb(r) - ${tx.array(ignored)}::text[]) ORDER BY ${tx(identity)}), '[]'::jsonb) AS results
        FROM ${tx(table)} r WHERE publication_key = ${publication.publication_key}
      `;
      return result;
    };
    const withFixturePublication = (expected, mutate) => db.transaction(async (orm) => {
      // The pinned postgres-js driver exposes this transaction's SQL client on
      // its session; keep raw validation and real ORM writes on that connection.
      const tx = orm.session.client;
      const ordered = [...expected].sort((a, b) => a.key.localeCompare(b.key));
      const before = new Map();
      for (const { key, revision } of ordered) {
        // Lock the key even for the first publication, when no header exists.
        await tx`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
        const [publication] = await tx`SELECT * FROM result_publication WHERE publication_key = ${key} FOR UPDATE`;
        assert.equal(publication?.revision ?? "0", String(revision), "fixture writer expected revision/CAS mismatch");
        before.set(key, { publication, scope: publication ? await scanFixturePublication(tx, publication) : null });
      }
      await mutate(tx, orm);
      for (const { key } of ordered) {
        const [publication] = await tx`SELECT * FROM result_publication WHERE publication_key = ${key}`;
        assert.ok(publication, "fixture writer requires a final publication header");
        const scope = await scanFixturePublication(tx, publication);
        assert.equal(scope.row_count, publication.row_count, "fixture writer final row count mismatch");
        assert.equal(scope.included_count, publication.included_count, "fixture writer final included count mismatch");
        assert.equal(scope.wrong_metadata, false, "fixture writer final result metadata/date mismatch");
        const old = before.get(key);
        if (old.publication) {
          assert.ok(BigInt(publication.revision) >= BigInt(old.publication.revision), "fixture writer revision cannot retreat");
          assert.ok(new Date(publication.as_of) >= new Date(old.publication.as_of), "fixture writer business date cannot retreat");
          if (publication.revision === old.publication.revision) {
            assert.deepEqual(publication, old.publication, "fixture writer same revision metadata must be identical");
            assert.deepEqual(scope.results, old.scope.results, "fixture writer same revision results must be identical");
          }
        }
      }
    });

    await db.insert(schema.company).values([
      { companyId: "migration-company", name: "Migration Company", korName: "검증 회사", type: "상장법인" },
      { companyId: "incomplete-company", name: "Incomplete Company", korName: "자료 부족 회사", type: "상장법인" },
    ]);
    await db.insert(schema.security).values([
      { securityId: "migration-security", companyId: "migration-company", ticker: "000001", name: "Migration Security", korName: "검증 종목", exchange: "KOSPI" },
      { securityId: "reuse-security", ticker: "000001", name: "Reused Code", korName: "재사용 종목", exchange: "KOSPI" },
    ]);

    await verify("natural keys, nullable identity, market distinction, rerun and correction", async () => {
      const [original] = await db.insert(schema.price).values(rawPrice).returning();
      assert.equal(original.securityId, null);
      assert.equal(original.close, 1000, "individual zero open/volume preserves its supplied close");
      await rejectsCode(() => db.insert(schema.price).values(rawPrice), "23505", "a NULL security_id cannot bypass the natural unique key");
      await db.insert(schema.price).values({ ...rawPrice, exchange: "KOSDAQ" });
      const [corrected] = await db.insert(schema.price).values({ ...rawPrice, close: 1001, sourceRef: "test-source/price-correction" })
        .onConflictDoUpdate({ target: [schema.price.date, schema.price.exchange, schema.price.ticker], set: { close: 1001, sourceRef: "test-source/price-correction" } }).returning();
      assert.equal(corrected.id, original.id);
      assert.equal(corrected.createdAt.getTime(), original.createdAt.getTime());
      assert.equal(corrected.close, 1001);
      assert.equal(corrected.transaction, BigInt(largeInteger), "Drizzle actually returns bigint with all digits intact");
      await rejectsCode(() => db.insert(schema.price).values({ ...rawPrice, ticker: "bad-id", securityId: "missing-security" }), "23503", "unknown identity FK is rejected");
      await rejectsCode(() => db.insert(schema.price).values({ ...rawPrice, ticker: "blank-exchange", exchange: " " }), "23514", "blank market is rejected");
      await rejectsCode(() => db.insert(schema.price).values({ ...rawPrice, ticker: "null-exchange", exchange: null }), "23502", "a NULL market is rejected");
      await rejectsCode(() => db.insert(schema.price).values({ ...rawPrice, ticker: "blank-source", sourceRef: " " }), "23514", "blank evidence is rejected");
      await rejectsCode(() => db.insert(schema.price).values({ ...rawPrice, ticker: "nan", close: NaN }), "23514", "NaN prices are rejected");
      await rejectsCode(() => db.insert(schema.price).values({ ...rawPrice, ticker: "infinity", close: Infinity }), "23514", "infinite prices are rejected");
      await rejectsCode(() => db.insert(schema.price).values({ ...rawPrice, ticker: "negative-volume", volume: -1n }), "23514", "negative volume is rejected");
      await db.insert(schema.marketcap).values({ date: day, ticker: "000001", exchange: "KOSPI", sourceRef: "test-source/cap-1", marketcap: BigInt(largeInteger), volume: 0n, shares: 1n, year: 2000, month: 1 });
      await rejectsCode(() => db.insert(schema.marketcap).values({ date: day, ticker: "000001", exchange: "KOSPI", sourceRef: "test-source/cap-1", marketcap: 1n, volume: 0n, shares: 1n, year: 2000, month: 1 }), "23505", "marketcap natural key is enforced");
    });

    await verify("Seoul daily anchors, equivalent UTC instants, sessions and historical Saturdays", async () => {
      await rejectsCode(() => db.insert(schema.price).values({ ...rawPrice, ticker: "intraday", date: new Date("2000-01-04T01:00:00+09:00") }), "23514", "intraday timestamp is outside the daily contract");
      await rejectsCode(() => db.insert(schema.price).values({ ...rawPrice, ticker: "wrong-year", year: 1999 }), "23514", "year agrees with the Korean business date");
      await rejectsCode(() => db.insert(schema.price).values({ ...rawPrice, ticker: "wrong-month", month: 2 }), "23514", "month agrees with the Korean business date");
      await rejectsCode(() => db.insert(schema.price).values({ ...rawPrice, date: new Date("2000-01-03T15:00:00Z") }), "23505", "equivalent offsets address the same business key");
      await db.insert(schema.price).values({ ...rawPrice, ticker: "saturday", date: new Date("1997-01-04T00:00:00+09:00"), year: 1997 });
      for (const timezone of ["UTC", "America/New_York", "Asia/Seoul"]) {
        await sql.begin(async (tx) => {
          await tx`SELECT set_config('TimeZone', ${timezone}, true)`;
          const [row] = await tx`SELECT (date AT TIME ZONE 'Asia/Seoul')::date::text AS day FROM price WHERE ticker = '000001' AND exchange = 'KOSPI'`;
          assert.equal(row.day, "2000-01-04");
        });
      }
      assert.equal(businessDate(day), "2000-01-04", "the DTO does not slice the previous UTC day");
    });

    await verify("zero, negative metrics, field absence, row absence and confirmed NULL correction", async () => {
      const [original] = await db.insert(schema.bppedd).values(rawMetrics).returning();
      assert.equal(original.per, 0);
      assert.equal(original.eps, -34);
      assert.equal(original.bps, null);
      assert.equal(original.bpsState, "source_missing");
      assert.equal(original.pbrState, "unsupported");
      await rejectsCode(() => db.insert(schema.bppedd).values(rawMetrics), "23505", "fundamental natural key is enforced");
      await rejectsCode(() => db.insert(schema.bppedd).values({ ...rawMetrics, ticker: "absent-status", perState: null }), "23502", "a raw status cannot silently default or disappear");
      for (const bad of [{ per: null }, { perState: "source_missing" }, { bps: 0 }, { bpsState: "provided" }]) {
        await rejectsCode(() => db.insert(schema.bppedd).values({ ...rawMetrics, ...bad, ticker: `bad-${Object.keys(bad)[0]}` }), "23514", "value/state contradictions are rejected");
      }
      await rejectsCode(() => db.insert(schema.bppedd).values({ ...rawMetrics, ticker: "bad-finite", eps: -Infinity }), "23514", "nonfinite negative metrics are rejected");
      const [corrected] = await db.insert(schema.bppedd).values({ ...rawMetrics, per: null, perState: "source_missing", sourceRef: "test-source/confirmed-correction" })
        .onConflictDoUpdate({ target: [schema.bppedd.date, schema.bppedd.exchange, schema.bppedd.ticker], set: { per: null, perState: "source_missing", sourceRef: "test-source/confirmed-correction" } }).returning();
      assert.equal(corrected.id, original.id);
      assert.equal(corrected.per, null, "confirmed missing replaces an earlier genuine zero");
      assert.equal(corrected.eps, -34, "other supplied fields survive");
      const [{ count }] = await sql`SELECT count(*)::int AS count FROM bppedd WHERE ticker = 'absent-source-row'`;
      assert.equal(count, 0, "a missing source row is not fabricated as six NULL/zero values");
      await assert.rejects(sql.begin(async (tx) => {
        await tx`UPDATE bppedd SET eps = -99 WHERE id = ${original.id}`;
        throw new Error("synthetic partial response");
      }), /synthetic partial response/);
      const [after] = await db.select().from(schema.bppedd).where(eq(schema.bppedd.id, original.id));
      assert.equal(after.eps, -34, "a failed partial replacement rolls back");
    });

    await verify("dated identity mapping, unlinked roster and code reuse", async () => {
      await db.insert(schema.stockcodename).values([
        { date: priorDay, ticker: "000001", exchange: "KOSPI", securityId: "migration-security", sourceRef: "test-roster/prior", name: "Old entity" },
        { date: day, ticker: "000001", exchange: "KOSPI", securityId: "reuse-security", sourceRef: "test-roster/current", name: "New entity" },
        { date: day, ticker: "unlinked", exchange: "KOSPI", securityId: null, sourceRef: "test-roster/unlinked", name: "Unlinked entity" },
      ]);
      const roster = await db.select().from(schema.stockcodename).where(eq(schema.stockcodename.ticker, "000001"));
      assert.equal(new Set(roster.map((row) => row.securityId)).size, 2, "the same ticker can link to different dated identities");
      await rejectsCode(() => db.insert(schema.stockcodename).values({ date: day, ticker: "unlinked", exchange: "KOSPI", securityId: null, sourceRef: "test-roster/unlinked" }), "23505", "unlinked roster retains the natural key");
    });

    await verify("atomic official publication, nullable latest versus last provided and exact numeric DTO", async () => {
      await withFixturePublication([
        { key: "security_latest/krx-all", revision: 0 },
        { key: "company_marketcap/krx-all", revision: 0 },
        { key: "security_rank/krx-all/per", revision: 0 },
        { key: "security_rank/krx-all/marketcap", revision: 0 },
        { key: "security_rank/empty-scope/per", revision: 0 },
      ], async (_tx, orm) => {
        await orm.insert(schema.resultPublication).values(header("security_latest", "krx-all", null, 2));
        await orm.update(schema.security).set({ publicationKey: "security_latest/krx-all", resultRevision: 1n, calculationId }).where(eq(schema.security.securityId, "reuse-security"));
        await orm.update(schema.security).set({
          publicationKey: "security_latest/krx-all", resultRevision: 1n, calculationId,
          per: 0, perDate: day, perState: "provided", perSourceRef: "test-result/per",
          perLastProvided: 0, perLastProvidedDate: day, perLastProvidedSourceRef: "test-result/per",
          eps: -34, epsDate: day, epsState: "provided", epsSourceRef: "test-result/eps",
          epsLastProvided: -34, epsLastProvidedDate: day, epsLastProvidedSourceRef: "test-result/eps",
          bps: null, bpsDate: day, bpsState: "source_missing", bpsSourceRef: "test-result/bps-missing",
          bpsLastProvided: 123, bpsLastProvidedDate: priorDay, bpsLastProvidedSourceRef: "test-result/bps-prior",
          shares: BigInt(largeInteger), sharesDate: day, sharesState: "provided", sharesSourceRef: "test-result/shares",
          sharesLastProvided: BigInt(largeInteger), sharesLastProvidedDate: day, sharesLastProvidedSourceRef: "test-result/shares",
        }).where(eq(schema.security.securityId, "migration-security"));
        await orm.insert(schema.resultPublication).values(header("company_marketcap", "krx-all", null, 2, 1));
        await orm.update(schema.company).set({ marketcap: "18014398509481986", marketcapDate: day, marketcapCompleteness: "complete",
          rankingState: "included", marketcapRank: 1, marketcapPriorRank: null, resultSourceRef: "test-company/complete",
          publicationKey: "company_marketcap/krx-all", resultRevision: 1n, calculationId }).where(eq(schema.company.companyId, "migration-company"));
        await orm.update(schema.company).set({ marketcap: null, marketcapDate: day, marketcapCompleteness: "missing_input",
          rankingState: "excluded", marketcapRank: null, exclusionReason: "incomplete constituent inputs", resultSourceRef: "test-company/missing-input",
          publicationKey: "company_marketcap/krx-all", resultRevision: 1n, calculationId }).where(eq(schema.company.companyId, "incomplete-company"));
        await orm.insert(schema.resultPublication).values([
          header("security_rank", "krx-all", "per", 2, 2),
          header("security_rank", "krx-all", "marketcap", 1, 1),
          header("security_rank", "empty-scope", "per", 0, 0),
        ]);
        await orm.insert(schema.securityRank).values([
          rankRow(), rankRow("per", "krx-all", "reuse-security", "-5"),
          rankRow("marketcap", "krx-all", "migration-security", largeInteger),
        ]);
      });
      const [security] = await db.select().from(schema.security).where(eq(schema.security.securityId, "migration-security"));
      assert.equal(security.bps, null);
      assert.equal(security.bpsLastProvided, 123);
      assert.equal(security.per, 0);
      assert.equal(security.eps, -34);
      assert.equal(typeof security.shares, "bigint", "this is the real ORM type, not only the raw driver");
      const [company] = await db.select().from(schema.company).where(eq(schema.company.companyId, "migration-company"));
      assert.equal(company.marketcap, "18014398509481986");
      const [incomplete] = await db.select().from(schema.company).where(eq(schema.company.companyId, "incomplete-company"));
      assert.equal(incomplete.marketcap, null, "incomplete totals cannot appear as zero or a partial official total");
      assert.equal(incomplete.marketcapCompleteness, "missing_input");
      assert.equal(incomplete.rankingState, "excluded");
      const [rank] = await db.select().from(schema.securityRank).where(eq(schema.securityRank.metricType, "marketcap"));
      assert.equal(rank.value, largeInteger, "numeric rank value preserves bigint source precision");
      const dto = JSON.parse(JSON.stringify(toDataDTO({ security, company, rank })));
      assert.equal(dto.security.shares, largeInteger);
      assert.equal(dto.security.sharesDate, "2000-01-04");
      assert.equal(dto.company.marketcap, "18014398509481986");
      assert.equal(dto.rank.value, largeInteger);
      assert.equal(dto.rank.rankDate, "2000-01-04");
      assert.equal(dto.rank.resultRevision, "1");
      const empty = await db.select().from(schema.resultPublication).where(eq(schema.resultPublication.publicationKey, "security_rank/empty-scope/per"));
      assert.equal(empty[0].rowCount, 0, "published zero results have a real header");
      const absent = await db.select().from(schema.resultPublication).where(eq(schema.resultPublication.publicationKey, "security_rank/unpublished/per"));
      assert.equal(absent.length, 0, "unpublished differs from zero results");
    });

    await verify("database row-local publication kind/scope/metric, state and foreign-key constraints", async () => {
      await rejectsCode(() => db.insert(schema.securityRank).values({ ...rankRow("pbr", "empty-scope"), publicationKey: "security_rank/empty-scope/per" }), "23514", "a rank cannot point to another metric's header");
      await rejectsCode(() => db.insert(schema.securityRank).values({ ...rankRow("per", "wrong-scope"), publicationKey: "security_rank/empty-scope/per" }), "23514", "a rank cannot point to another scope's header");
      await rejectsCode(() => db.insert(schema.securityRank).values({ ...rankRow("per", "empty-scope"), publicationKey: "security_latest/krx-all" }), "23514", "a rank cannot use a security latest header");
      await rejectsCode(() => db.update(schema.security).set({ publicationKey: "company_marketcap/krx-all" }).where(eq(schema.security.securityId, "migration-security")), "23514", "security requires a security_latest key");
      await rejectsCode(() => db.update(schema.company).set({ publicationKey: "security_latest/krx-all" }).where(eq(schema.company.companyId, "migration-company")), "23514", "company requires a company_marketcap key");
      await rejectsCode(() => db.insert(schema.securityRank).values(rankRow("per", "missing-header")), "23503", "an otherwise valid key still requires a publication header");
      await rejectsCode(() => db.insert(schema.resultPublication).values({ ...header("security_rank", "invalid-local", "per", 0, 0), revision: 0n }), "23514", "publication revision is positive");
      await rejectsCode(() => db.insert(schema.resultPublication).values(header("security_rank", "invalid-local", "per", 0, 1)), "23514", "included count cannot exceed declared row count");
      await rejectsCode(() => db.update(schema.security).set({ perLastProvided: null }).where(eq(schema.security.securityId, "migration-security")), "23514", "partially filled last-provided tuples are rejected");
      await rejectsCode(() => db.update(schema.company).set({ resultRevision: 2n, marketcap: null }).where(eq(schema.company.companyId, "migration-company")), "23514", "a complete total cannot be NULL");
      await rejectsCode(() => db.update(schema.company).set({ resultRevision: 2n, marketcap: "99" }).where(eq(schema.company.companyId, "incomplete-company")), "23514", "an incomplete total cannot become a numeric subtotal");
    });

    await verify("test-only writer rejects partial coverage, stale metadata and conflicting same-revision changes", async () => {
      await assert.rejects(withFixturePublication([{ key: "security_rank/bad-count/per", revision: 0 }], async (_tx, orm) => {
        await orm.insert(schema.resultPublication).values(header("security_rank", "bad-count", "per", 1, 1));
      }), /fixture writer final row count mismatch/);
      const [{ count }] = await sql`SELECT count(*)::int AS count FROM result_publication WHERE publication_key = 'security_rank/bad-count/per'`;
      assert.equal(count, 0, "failed fixture validation rolls back the new header");
      await assert.rejects(withFixturePublication([{ key: "security_rank/empty-scope/per", revision: 1 }], async (_tx, orm) => {
        await orm.insert(schema.securityRank).values(rankRow("per", "empty-scope"));
      }), /fixture writer final row count mismatch/);
      await assert.rejects(withFixturePublication([{ key: "security_rank/krx-all/per", revision: 1 }], async (tx) => {
        await tx`UPDATE result_publication SET revision = 2, calculation_id = ${correctedId} WHERE publication_key = 'security_rank/krx-all/per'`;
      }), /fixture writer final result metadata\/date mismatch/);
      await assert.rejects(withFixturePublication([{ key: "security_rank/krx-all/per", revision: 1 }], async (tx) => {
        await tx`UPDATE result_publication SET included_count = 0 WHERE publication_key = 'security_rank/krx-all/per'`;
      }), /fixture writer final included count mismatch/);
      await assert.rejects(withFixturePublication([{ key: "security_rank/krx-all/per", revision: 1 }], async (tx) => {
        await tx`UPDATE security_rank SET calculation_id = ${correctedId} WHERE publication_key = 'security_rank/krx-all/per'`;
      }), /fixture writer final result metadata\/date mismatch/);
      await assert.rejects(withFixturePublication([{ key: "security_rank/krx-all/per", revision: 1 }], async (tx) => {
        await tx`UPDATE result_publication SET rule_ref = 'other-rule' WHERE publication_key = 'security_rank/krx-all/per'`;
      }), /fixture writer same revision metadata must be identical/);
      await assert.rejects(withFixturePublication([{ key: "security_rank/krx-all/per", revision: 1 }], async (tx) => {
        await tx`UPDATE security_rank SET value = 10 WHERE publication_key = 'security_rank/krx-all/per'`;
      }), /fixture writer same revision results must be identical/);
      await assert.rejects(withFixturePublication([{ key: "security_rank/krx-all/per", revision: 1 }], async (tx) => {
        await tx`DELETE FROM security_rank WHERE publication_key = 'security_rank/krx-all/per'`;
      }), /fixture writer final row count mismatch/);
      await assert.rejects(withFixturePublication([{ key: "security_rank/krx-all/per", revision: 1 }], async (tx) => {
        await tx`UPDATE result_publication SET revision = 2, calculation_id = ${correctedId} WHERE publication_key = 'security_rank/krx-all/per'`;
        await tx`UPDATE security_rank SET result_revision = 2, calculation_id = ${correctedId}, value = 999 WHERE publication_key = 'security_rank/krx-all/per'`;
        throw new Error("synthetic failed publication");
      }), /synthetic failed publication/);
      const [{ revision }] = await sql`SELECT revision FROM result_publication WHERE publication_key = 'security_rank/krx-all/per'`;
      assert.equal(revision, "1", "failed publication leaves the old header intact");
      await withFixturePublication([{ key: "security_rank/krx-all/per", revision: 1 }], async (_tx, orm) => {
        await orm.update(schema.securityRank).set({ value: "0" }).where(and(
          eq(schema.securityRank.securityId, "migration-security"), eq(schema.securityRank.publicationKey, "security_rank/krx-all/per")));
      });
    });

    await verify("separate UPDATE ordering and a semantically identical same-revision DELETE/INSERT retry", async () => {
      await withFixturePublication([{ key: "security_latest/krx-all", revision: 1 }], async (tx) => {
        // Intermediate state is allowed; validate the completed scope once.
        await tx`UPDATE security SET per = NULL, per_state = 'source_missing', per_source_ref = 'test-result/withdrawn', per_last_provided = -2, per_last_provided_date = '2000-01-03T00:00:00+09:00', per_last_provided_source_ref = 'test-result/last-corrected' WHERE security_id = 'migration-security'`;
        await tx`UPDATE security SET result_revision = 2, calculation_id = ${correctedId} WHERE publication_key = 'security_latest/krx-all'`;
        await tx`UPDATE result_publication SET revision = 2, calculation_id = ${correctedId} WHERE publication_key = 'security_latest/krx-all'`;
      });
      const [latest] = await db.select().from(schema.security).where(eq(schema.security.securityId, "migration-security"));
      assert.equal(latest.per, null, "confirmed missing clears the latest provided zero");
      assert.equal(latest.perLastProvided, -2, "tem can reselect an earlier provided negative after withdrawal");
      assert.equal(latest.resultRevision, 2n);
      const [rankBefore] = await db.select().from(schema.securityRank).where(and(eq(schema.securityRank.securityId, "migration-security"), eq(schema.securityRank.metricType, "per")));
      await withFixturePublication([{ key: "security_rank/krx-all/per", revision: 1 }], async (_tx, orm) => {
        await orm.delete(schema.securityRank).where(eq(schema.securityRank.publicationKey, "security_rank/krx-all/per"));
        await orm.insert(schema.securityRank).values([rankRow(), rankRow("per", "krx-all", "reuse-security", "-5")]);
      });
      const [rankAfter] = await db.select().from(schema.securityRank).where(and(eq(schema.securityRank.securityId, "migration-security"), eq(schema.securityRank.metricType, "per")));
      assert.notEqual(rankAfter.id, rankBefore.id, "identical retry may reallocate the storage ID");
      assert.equal(rankAfter.value, rankBefore.value, "official meaning is retained by the fixture writer policy");
      await assert.rejects(withFixturePublication([{ key: "security_latest/krx-all", revision: 1 }], async () => {}), /fixture writer expected revision\/CAS mismatch/);
      await assert.rejects(withFixturePublication([{ key: "security_latest/krx-all", revision: 2 }], async (tx) => {
        await tx`UPDATE result_publication SET revision = 1, calculation_id = ${calculationId} WHERE publication_key = 'security_latest/krx-all'`;
        await tx`UPDATE security SET result_revision = 1, calculation_id = ${calculationId} WHERE publication_key = 'security_latest/krx-all'`;
      }), /fixture writer revision cannot retreat/);
      await assert.rejects(withFixturePublication([{ key: "security_rank/empty-scope/per", revision: 1 }], async (tx) => {
        await tx`UPDATE result_publication SET revision = 2, as_of = ${priorDay.toISOString()} WHERE publication_key = 'security_rank/empty-scope/per'`;
      }), /fixture writer business date cannot retreat/);
    });

    await verify("request-level repeatable-read remains consistent during atomic replacement", async () => {
      await sql.begin("isolation level repeatable read read only", async (reader) => {
        const [before] = await reader`SELECT revision, row_count FROM result_publication WHERE publication_key = 'security_rank/krx-all/per'`;
        await withFixturePublication([{ key: "security_rank/krx-all/per", revision: 1 }], async (writer) => {
          await writer`UPDATE result_publication SET revision = 2, calculation_id = ${correctedId}, row_count = 1, included_count = 1 WHERE publication_key = 'security_rank/krx-all/per'`;
          await writer`DELETE FROM security_rank WHERE publication_key = 'security_rank/krx-all/per' AND security_id = 'reuse-security'`;
          await writer`UPDATE security_rank SET result_revision = 2, calculation_id = ${correctedId}, value = 12 WHERE publication_key = 'security_rank/krx-all/per'`;
        });
        const [during] = await reader`SELECT revision, row_count FROM result_publication WHERE publication_key = 'security_rank/krx-all/per'`;
        const rows = await reader`SELECT result_revision, value FROM security_rank WHERE publication_key = 'security_rank/krx-all/per'`;
        assert.equal(during.revision, before.revision);
        assert.equal(rows.length, before.row_count);
        assert.ok(rows.every((row) => row.result_revision === before.revision));
      });
      const [after] = await sql`SELECT revision, row_count FROM result_publication WHERE publication_key = 'security_rank/krx-all/per'`;
      assert.equal(after.revision, "2");
      assert.equal(after.row_count, 1);
    });

    await verify("actual CD current-result filter hides a daily row whose date differs from its header", async () => {
      const { loadModules } = require("../tests/helpers/business-data.cjs");
      await assert.rejects(withFixturePublication([{ key: "security_rank/krx-all/per", revision: 2 }], async (_tx, orm) => {
        await orm.update(schema.securityRank).set({ rankDate: priorDay, valueObservedAt: priorDay })
          .where(eq(schema.securityRank.publicationKey, "security_rank/krx-all/per"));
        const [publication] = await orm.select().from(schema.resultPublication)
          .where(eq(schema.resultPublication.publicationKey, "security_rank/krx-all/per"));
        const raw = await orm.select().from(schema.securityRank)
          .where(eq(schema.securityRank.publicationKey, publication.publicationKey));
        assert.equal(raw.length, 1, "row-local daily CHECKs permit a different valid business date");
        const { currentRankResultFilter, currentRankFilter } = loadModules(orm)("lib/data/publication.ts");
        const current = await orm.select().from(schema.securityRank).where(currentRankResultFilter(publication));
        const included = await orm.select().from(schema.securityRank).where(currentRankFilter(publication));
        assert.equal(current.length, 0, "the real production filter excludes the inconsistent date");
        assert.equal(included.length, 0, "the included filter uses the same real production condition");
      }), /fixture writer final result metadata\/date mismatch/);
      const [restored] = await db.select().from(schema.securityRank)
        .where(eq(schema.securityRank.publicationKey, "security_rank/krx-all/per"));
      assert.equal(businessDate(restored.rankDate), "2000-01-04", "writer validation restores the old valid date by rollback");
    });

    await verify("reference writer serializes competing expected-revision publications", async () => {
      const compete = (value) => withFixturePublication([{ key: "security_rank/krx-all/per", revision: 2 }], async (tx) => {
        await tx`UPDATE security_rank SET result_revision = 3, value = ${value} WHERE publication_key = 'security_rank/krx-all/per'`;
        await tx`UPDATE result_publication SET revision = 3 WHERE publication_key = 'security_rank/krx-all/per'`;
      });
      const attempts = await Promise.allSettled([compete("17"), compete("99")]);
      assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
      const loser = attempts.find((attempt) => attempt.status === "rejected");
      assert.match(loser.reason.message, /fixture writer expected revision\/CAS mismatch/);
      const [publication] = await sql`SELECT revision FROM result_publication WHERE publication_key = 'security_rank/krx-all/per'`;
      const [row] = await sql`SELECT result_revision, value FROM security_rank WHERE publication_key = 'security_rank/krx-all/per'`;
      assert.equal(publication.revision, "3");
      assert.equal(row.result_revision, "3");
      assert.ok(["17", "99"].includes(row.value), "only one complete competing input was published");
      const first = () => withFixturePublication([{ key: "security_rank/first-race/per", revision: 0 }], async (_tx, orm) => {
        await orm.insert(schema.resultPublication).values(header("security_rank", "first-race", "per", 0, 0));
      });
      const firstAttempts = await Promise.allSettled([first(), first()]);
      assert.equal(firstAttempts.filter((attempt) => attempt.status === "fulfilled").length, 1, "a missing header is also serialized by its key");
      assert.match(firstAttempts.find((attempt) => attempt.status === "rejected").reason.message, /fixture writer expected revision\/CAS mismatch/);
    });
    t.diagnostic("Publication lock/CAS, scope validation and same-revision retry policy were exercised by a test-only reference writer; the actual tem writer was not tested. PostgreSQL enforces row constraints/FKs, not these cross-row publication policies.");
    t.diagnostic(`Actual runtime: Node ${process.versions.node}; ${tools.version}. No application environment file or shared business database was used.`);
    verified = true;

  } finally {
    try {
      if (sql) await sql.end({ timeout: 5 });
    } finally {
      try {
        if (clusterStarted && !(verified && process.env.CD_TEST_KEEP_CLUSTER === "1")) {
          command(tools.pgCtl, ["-D", dataDirectory, "-m", "immediate", "-w", "-t", "10", "stop"], environment);
        }
      } finally {
        if (verified && process.env.CD_TEST_KEEP_CLUSTER === "1") {
          t.diagnostic(`Explicitly retained synthetic fixture only: socket=${socketDirectory}; port=5432; user=cd4_migration_test; database=postgres; data=${dataDirectory}. Stop this cluster and remove ${temporaryRoot} after browser verification.`);
        } else {
          rmSync(temporaryRoot, { recursive: true, force: true });
        }
      }
    }
  }
});
