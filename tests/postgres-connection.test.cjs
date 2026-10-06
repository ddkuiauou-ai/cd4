const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const postgres = require("postgres");

const filename = path.join(__dirname, "..", "db", "connection.ts");
const loaded = new Module(filename);
loaded.filename = filename;
loaded._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { getPostgresConnection } = loaded.exports;

const fields = {
  POSTGRES_HOST: "localhost",
  POSTGRES_USER: "test-user",
  POSTGRES_PASSWORD: "test-password",
  POSTGRES_DB: "test-db",
};

test("DATABASE_URL takes precedence and retains TLS parameters", async () => {
  for (const protocol of ["postgres", "postgresql"]) {
    const url = `${protocol}://url-user:url-password@localhost:5433/url-db?sslmode=require`;
    const connection = getPostgresConnection({ ...fields, DATABASE_URL: url });
    assert.deepEqual(connection, { url });
    const client = postgres(connection.url);
    try {
      assert.equal(client.options.ssl, "require");
      assert.equal(client.options.database, "url-db");
      assert.equal(client.options.user, "url-user");
    } finally {
      await client.end();
    }
  }
});

test("separate PostgreSQL fields default to port 5432 and support an explicit port", () => {
  assert.equal(getPostgresConnection(fields).port, 5432);
  assert.equal(getPostgresConnection({ ...fields, POSTGRES_PORT: "5433" }).port, 5433);
});

test("reserved characters in credentials and database names reach the driver unchanged", async () => {
  const env = { ...fields, POSTGRES_USER: "user@name", POSTGRES_PASSWORD: "p:/?#@% word", POSTGRES_DB: "데이터 db/name ?#" };
  const connection = getPostgresConnection(env);
  const client = postgres(connection);
  try {
    assert.equal(client.options.user, env.POSTGRES_USER);
    assert.equal(client.options.pass, env.POSTGRES_PASSWORD);
    assert.equal(client.options.database, env.POSTGRES_DB);
  } finally {
    await client.end();
  }
});

test("PostgreSQL multi-host URLs retain failover hosts and ports", async () => {
  const url = "postgresql://test-user:test-password@primary.example:5432,secondary.example:5433/cd4";
  const connection = getPostgresConnection({ DATABASE_URL: url });
  const client = postgres(connection.url);
  try {
    assert.deepEqual(client.options.host, ["primary.example", "secondary.example"]);
    assert.deepEqual(client.options.port, [5432, 5433]);
  } finally {
    await client.end();
  }
});

test("missing connection settings fail without exposing supplied secrets", () => {
  assert.throws(() => getPostgresConnection({ POSTGRES_PASSWORD: "secret-to-hide" }), (error) => {
    assert.match(error.message, /POSTGRES_HOST.*POSTGRES_USER.*POSTGRES_DB/);
    assert.ok(!error.message.includes("secret-to-hide"));
    return true;
  });
});

test("invalid PostgreSQL ports are rejected", () => {
  for (const port of ["0", "65536", "-1", "5432suffix", "54.32"]) {
    assert.throws(() => getPostgresConnection({ ...fields, POSTGRES_PORT: port }), /POSTGRES_PORT/);
  }
});

test("non-PostgreSQL and malformed DATABASE_URL values fail without exposing the URL", () => {
  for (const url of ["libsql://secret-to-hide@example.invalid", "sqlite:database.db", "secret-to-hide"]) {
    assert.throws(() => getPostgresConnection({ DATABASE_URL: url }), (error) => {
      assert.ok(!error.message.includes("secret-to-hide"));
      return true;
    });
  }
});
