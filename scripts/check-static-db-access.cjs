const net = require('node:net');
const tls = require('node:tls');

const sslRequest = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]);

function checkDatabaseAccess({ host, port = '5432', timeout = 10_000 }) {
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
      secure = tls.connect({
        socket, servername: net.isIP(host) ? undefined : host, rejectUnauthorized: true,
        checkServerIdentity: (_, certificate) => tls.checkServerIdentity(host, certificate),
      });
      secure.once('secureConnect', () => finish('verified-tls'));
      secure.once('error', () => finish('tls-verification-failed'));
    });
  });
}

if (require.main === module) {
  checkDatabaseAccess({ host: process.env.POSTGRES_HOST, port: process.env.POSTGRES_PORT || '5432' }).then(result => {
    console.log(JSON.stringify({ databaseAccess: result }));
    if (result !== 'verified-tls' && !process.argv.includes('--report-only')) process.exitCode = 1;
  });
}

module.exports = { checkDatabaseAccess };
