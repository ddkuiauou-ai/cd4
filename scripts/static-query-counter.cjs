// postgres invokes debug for sent SQL, including transaction control. Never
// retain statement text, parameters, connection details or credential data.
function installQueryCounter(client) {
  if (!client?.options) throw new Error('PostgreSQL query counter requires the configured driver client');
  const previous = client.options.debug;
  let phase = 'bootstrap', total = 0, phaseStarted = performance.now();
  const phases = Object.create(null), commands = Object.create(null);
  const phaseSeconds = Object.create(null);
  client.options.debug = (_connection, statement) => {
    const first = typeof statement === 'string' ? statement.trimStart().match(/^[A-Za-z]+/)?.[0]?.toUpperCase() : undefined;
    const command = ['SELECT', 'WITH', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SET', 'SAVEPOINT', 'RELEASE'].includes(first) ? first : 'OTHER';
    total++; phases[phase] = (phases[phase] ?? 0) + 1; commands[command] = (commands[command] ?? 0) + 1;
  };
  return {
    phase(name) { const now = performance.now(); phaseSeconds[phase] = (phaseSeconds[phase] ?? 0) + (now - phaseStarted) / 1000;
      phase = name; phaseStarted = now; phases[phase] ??= 0; },
    snapshot() { return { total, phases: { ...phases }, commands: { ...commands },
      phaseSeconds: { ...phaseSeconds, [phase]: (phaseSeconds[phase] ?? 0) + (performance.now() - phaseStarted) / 1000 },
      note: 'Driver statement attempts, including transaction control; SQL text and parameters are never retained.' }; },
    restore() { client.options.debug = previous; },
  };
}

module.exports = { installQueryCounter };
