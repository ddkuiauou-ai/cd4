const assert = require('node:assert/strict');
const { test } = require('node:test');
const { databaseStatus } = require('../scripts/check-static-db-access.cjs');

const env = {
  POSTGRES_HOST: 'private-server.example', POSTGRES_PORT: '5432', POSTGRES_USER: 'private-user',
  POSTGRES_PASSWORD: 'private-password', POSTGRES_DB: 'private-database', POSTGRES_TLS_CA: 'private-marker-ca',
};

const verifiedProbe = async () => 'verified-tls';

function driverAt(failureStage, error, session = { ok: 1, tls: true }) {
  const stages = [];
  function stage(name) {
    stages.push(name);
    if (failureStage === name) throw error;
  }
  return {
    stages,
    createDriver(options) {
      stage('create');
      assert.equal(options.ssl.rejectUnauthorized, true);
      assert.equal(options.ssl.ca, env.POSTGRES_TLS_CA);
      assert.equal(options.debug, false);
      options.onnotice({ message: 'private-notice' });
      return {
        async begin(mode, operation) {
          assert.equal(mode, 'read only');
          stage('authentication-or-begin');
          const report = await operation(async strings => {
            const query = strings.join('');
            if (query.includes('pg_stat_ssl')) {
              stage('session-check');
              return [session];
            }
            assert.match(query, /FROM result_publication/);
            stage('publication-query');
            return [{ day: '2026-11-26' }];
          });
          stage('end-read-only');
          return report;
        },
        async end() { stage('close'); },
      };
    },
  };
}

test('authentication is gated by verified TLS and missing configuration reports names only', async () => {
  const failure = driverAt('create', new Error('opened unexpectedly'));
  const report = await databaseStatus({ ...env, POSTGRES_PASSWORD: '' }, {
    authenticated: true, probe: async () => 'tls-verification-failed', createDriver: failure.createDriver,
  });
  assert.deepEqual(report, { databaseAccess: 'tls-verification-failed', databaseSettingsMissing: ['POSTGRES_PASSWORD'] });
  assert.deepEqual(failure.stages, []);
  assert.deepEqual(await databaseStatus(env, { probe: verifiedProbe, createDriver: failure.createDriver }),
    { databaseAccess: 'verified-tls' });
  const badConfig = await databaseStatus({ ...env, DATABASE_URL: 'private-url' }, {
    authenticated: true, probe: verifiedProbe, createDriver: failure.createDriver,
  });
  assert.deepEqual(badConfig, { databaseAccess: 'verified-tls', databaseUrlConflict: true,
    databaseRead: 'read-failed', databaseReadStage: 'configuration', databaseErrorCategory: 'configuration' });
  assert.deepEqual(failure.stages, []);
});

test('authenticated status reports the publication day only after the read-only TLS session check', async () => {
  const success = driverAt();
  assert.deepEqual(await databaseStatus(env, { authenticated: true, probe: verifiedProbe, createDriver: success.createDriver }),
    { databaseAccess: 'verified-tls', databaseRead: 'verified', publishedDay: '2026-11-26' });
  assert.deepEqual(success.stages, ['create', 'authentication-or-begin', 'session-check', 'publication-query', 'end-read-only', 'close']);
  const badSession = driverAt(undefined, undefined, { ok: 1, tls: false });
  assert.deepEqual(await databaseStatus(env, { authenticated: true, probe: verifiedProbe, createDriver: badSession.createDriver }),
    { databaseAccess: 'verified-tls', databaseRead: 'tls-session-required', databaseReadStage: 'session-check' });
  assert.deepEqual(badSession.stages, ['create', 'authentication-or-begin', 'session-check', 'end-read-only', 'close']);
});

test('authenticated status emits only allowlisted codes, stages and categories', async () => {
  const cases = [
    ['authentication-or-begin', '28P01', 'invalid-password'],
    ['authentication-or-begin', '28000', 'authorization'],
    ['authentication-or-begin', '3D000', 'invalid-database'],
    ['authentication-or-begin', '08P01', 'protocol'],
    ['authentication-or-begin', 'ERR_TLS_CERT_ALTNAME_INVALID', 'tls'],
    ['authentication-or-begin', 'ECONNRESET', 'connection'],
    ['session-check', '42501', 'insufficient-privilege'],
    ['session-check', '22023', 'invalid-parameter'],
    ['publication-query', '42P01', 'missing-relation'],
    ['publication-query', '42703', 'missing-column'],
    ['publication-query', '22003', 'numeric-range'],
    ['publication-query', 'private-error-code', 'unclassified'],
    ['end-read-only', '57014', 'query-canceled'],
  ];
  for (const [stage, code, category] of cases) {
    const error = Object.assign(new Error('private-message'), {
      code, detail: 'private-detail', hint: 'private-hint', query: 'private-query',
      host: env.POSTGRES_HOST, user: env.POSTGRES_USER, database: env.POSTGRES_DB,
    });
    const failure = driverAt(stage, error);
    const report = await databaseStatus(env, { authenticated: true, probe: verifiedProbe, createDriver: failure.createDriver });
    assert.deepEqual(report, { databaseAccess: 'verified-tls', databaseRead: 'read-failed', databaseReadStage: stage,
      databaseErrorCategory: category, ...(category !== 'unclassified' && { databaseErrorCode: code }) });
    assert.ok(!JSON.stringify(report).includes('private-'));
    assert.equal(failure.stages.at(-1), 'close');
  }
});

test('host access rule is distinguished only by authenticated PostgreSQL error metadata and its fixed marker', async () => {
  for (const [file, routine, message, category] of [
    ['auth.c', 'ClientAuthentication', 'private-message mentions pg_hba.conf', 'host-access-rule'],
    ['auth.c', 'ClientAuthentication', 'private-other-authentication-error', 'authorization'],
    ['auth.c', 'OtherRoutine', 'private-message mentions pg_hba.conf', 'authorization'],
    ['other.c', 'ClientAuthentication', 'private-message mentions pg_hba.conf', 'authorization'],
  ]) {
    const error = Object.assign(new Error(message), { code: '28000', file, routine });
    const { createDriver } = driverAt('authentication-or-begin', error);
    const report = await databaseStatus(env, { authenticated: true, probe: verifiedProbe, createDriver });
    assert.deepEqual(report, { databaseAccess: 'verified-tls', databaseRead: 'read-failed',
      databaseReadStage: 'authentication-or-begin', databaseErrorCategory: category, databaseErrorCode: '28000' });
  }
});
