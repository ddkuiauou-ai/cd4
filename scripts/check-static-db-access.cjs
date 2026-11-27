const net = require('node:net');
const tls = require('node:tls');
require('./register-typescript.cjs');
const { getPostgresConnection, postgresTlsOptions } = require('../db/connection.ts');

const sslRequest = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]);

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

async function checkDatabaseRead(env) {
  let sql;
  try {
    const connection = getPostgresConnection({ ...env, STATIC_RELEASE_POSTGRES_TLS: 'verify-full' });
    sql = require('postgres')({ ...connection, max: 1, connect_timeout: 10, prepare: false,
      connection: { statement_timeout: 10_000 } });
    return await sql.begin('read only', async tx => {
      const [heartbeat] = await tx`SELECT 1 AS ok, EXISTS (
        SELECT FROM pg_stat_ssl WHERE pid = pg_backend_pid() AND ssl
      ) AS tls`;
      if (heartbeat?.ok !== 1 || heartbeat.tls !== true) return { databaseRead: 'tls-session-required' };
      const [publication] = await tx`SELECT to_char(as_of AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day
        FROM result_publication WHERE publication_key = 'security_latest/krx-all'`;
      const day = publication?.day;
      return { databaseRead: 'verified', publishedDay: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null };
    });
  } catch {
    return { databaseRead: 'read-failed' };
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => {});
  }
}

if (require.main === module) {
  checkStaticDatabaseAccess(process.env).then(async databaseAccess => {
    const reads = process.argv.includes('--authenticated');
    const report = reads && databaseAccess === 'verified-tls' ? await checkDatabaseRead(process.env) : {};
    console.log(JSON.stringify({ databaseAccess, ...report }));
    if (!process.argv.includes('--report-only') && (databaseAccess !== 'verified-tls' || reads && report.databaseRead !== 'verified')) {
      process.exitCode = 1;
    }
  });
}

module.exports = { checkDatabaseAccess, checkStaticDatabaseAccess };
