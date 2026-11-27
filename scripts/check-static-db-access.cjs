const net = require('node:net');
const tls = require('node:tls');
require('./register-typescript.cjs');
const { getPostgresConnection, postgresTlsOptions } = require('../db/connection.ts');

const sslRequest = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]);

const errorCategories = new Map([
  ['28P01', 'invalid-password'], ['28000', 'authorization'],
  ['3D000', 'invalid-database'], ['42P01', 'missing-relation'], ['42501', 'insufficient-privilege'],
  ['42703', 'missing-column'], ['22023', 'invalid-parameter'], ['22003', 'numeric-range'],
  ['53300', 'connection-limit'], ['57P03', 'database-unavailable'], ['57014', 'query-canceled'],
  ['08P01', 'protocol'], ['SASL_SIGNATURE_MISMATCH', 'authentication-protocol'], ['MESSAGE_NOT_SUPPORTED', 'unsupported-protocol'],
  ...['CONNECT_TIMEOUT', 'ETIMEDOUT'].map(code => [code, 'timeout']),
  ...['ENOTFOUND', 'EAI_AGAIN'].map(code => [code, 'dns']),
  ...['08001', '08006', 'CONNECTION_CLOSED', 'CONNECTION_DESTROYED', 'ECONNREFUSED', 'ECONNRESET',
    'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE'].map(code => [code, 'connection']),
  ...['ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_GET_ISSUER_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_OSSL_PEM_NO_START_LINE', 'ERR_SSL_WRONG_VERSION_NUMBER',
    'ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION', 'ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE'].map(code => [code, 'tls']),
]);

function readFailure(stage, error) {
  const code = error?.code;
  const hostRule = code === '28000' && error.routine === 'ClientAuthentication'
    && typeof error.file === 'string' && /(?:^|[\\/])auth\.c$/.test(error.file)
    && typeof error.message === 'string' && error.message.includes('pg_hba.conf');
  const category = hostRule ? 'host-access-rule' : errorCategories.get(code);
  return { databaseRead: 'read-failed', databaseReadStage: stage,
    databaseErrorCategory: category ?? (stage === 'configuration' ? 'configuration' : 'unclassified'),
    ...(category && { databaseErrorCode: code }) };
}

function checkDatabaseAccess({ host, port = '5432', ca, timeout = 10_000 }) {
  if (!host || (!net.isIP(host) && !/^[A-Z0-9.-]+$/i.test(host))
    || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    return Promise.resolve('invalid-connection-settings');
  }
  return new Promise(resolve => {
    const socket = net.connect({ host, port: Number(port) });
    let secure;
    const timeoutHandle = setTimeout(() => finish('timeout'), timeout);
    function finish(code) {
      clearTimeout(timeoutHandle);
      secure?.destroy();
      socket.destroy();
      resolve(code);
    }
    socket.once('connect', () => socket.write(sslRequest));
    socket.once('error', error => finish(error.code === 'ENOTFOUND' ? 'dns-error' : 'tcp-error'));
    socket.once('end', () => finish('connection-closed'));
    socket.once('data', response => {
      if (response.length !== 1 || response[0] !== 83) {
        finish(response.length === 1 && response[0] === 78 ? 'tls-unavailable' : 'invalid-postgres-response');
        return;
      }
      try {
        secure = tls.connect({ socket, servername: net.isIP(host) ? undefined : host, ...postgresTlsOptions(host, ca) });
      } catch {
        finish('tls-verification-failed');
        return;
      }
      secure.once('secureConnect', () => finish('verified-tls'));
      secure.once('error', () => finish('tls-verification-failed'));
    });
  });
}

function checkStaticDatabaseAccess(env) {
  return checkDatabaseAccess({ host: env.POSTGRES_HOST, port: env.POSTGRES_PORT || '5432', ca: env.POSTGRES_TLS_CA });
}

async function checkDatabaseRead(env, createDriver) {
  let sql;
  let stage = 'configuration';
  try {
    const connection = getPostgresConnection({ ...env, STATIC_RELEASE_POSTGRES_TLS: 'verify-full' });
    sql = (createDriver ?? require('postgres'))({ ...connection, max: 1, connect_timeout: 10, prepare: false,
      onnotice() {}, debug: false,
      connection: { statement_timeout: 10_000 } });
    stage = 'authentication-or-begin';
    return await sql.begin('read only', async tx => {
      stage = 'session-check';
      const [heartbeat] = await tx`SELECT 1 AS ok, EXISTS (
        SELECT FROM pg_stat_ssl WHERE pid = pg_backend_pid() AND ssl
      ) AS tls`;
      if (heartbeat?.ok !== 1 || heartbeat.tls !== true) {
        stage = 'end-read-only';
        return { databaseRead: 'tls-session-required', databaseReadStage: 'session-check' };
      }
      stage = 'publication-query';
      const [publication] = await tx`SELECT to_char(as_of AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day
        FROM result_publication WHERE publication_key = 'security_latest/krx-all'`;
      const day = publication?.day;
      stage = 'end-read-only';
      return { databaseRead: 'verified', publishedDay: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null };
    });
  } catch (error) {
    return readFailure(stage, error);
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => {});
  }
}

async function databaseStatus(env, { authenticated = false, probe = checkStaticDatabaseAccess, createDriver } = {}) {
  const databaseAccess = await probe(env);
  if (!authenticated) return { databaseAccess };
  const missing = ['POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'].filter(key => !env[key]);
  const read = databaseAccess === 'verified-tls' ? await checkDatabaseRead(env, createDriver) : {};
  return { databaseAccess, ...(missing.length && { databaseSettingsMissing: missing }),
    ...(env.DATABASE_URL && { databaseUrlConflict: true }), ...read };
}

if (require.main === module) {
  const authenticated = process.argv.includes('--authenticated');
  databaseStatus(process.env, { authenticated }).then(report => {
    console.log(JSON.stringify(report));
    if (!process.argv.includes('--report-only') && (report.databaseAccess !== 'verified-tls'
      || authenticated && report.databaseRead !== 'verified')) {
      process.exitCode = 1;
    }
  });
}

module.exports = { checkDatabaseAccess, checkStaticDatabaseAccess, databaseStatus };
