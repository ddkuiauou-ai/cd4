const fs = require('node:fs');
const path = require('node:path');
const { createStaticServer } = require('./preview-static.cjs');
const { STAGE, readJson } = require('./static-tools.cjs');

try {
  const pilot = path.resolve(process.env.PER_PILOT_DIR || path.join(STAGE, 'per-pilot'));
  const output = path.join(pilot, 'workspace/out');
  if (!fs.existsSync(path.join(output, 'security/KOSPI.005930/per/index.html'))) throw new Error('먼저 bun run build:per-pilot 을 실행해 주세요.');
  const { snapshotId, cutoff } = readJson(path.join(output, '_per-pilot.json'));
  const trafficIndex = process.argv.indexOf('--traffic-report');
  const trafficReport = trafficIndex < 0 ? undefined : process.argv[trafficIndex + 1];
  const portIndex = process.argv.indexOf('--port');
  const port = Number(portIndex < 0 ? 4186 : process.argv[portIndex + 1]);
  const server = createStaticServer({ output, trafficReport, compression: true });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`PER 시범 화면 http://127.0.0.1:${server.address().port}/per/ (${cutoff}, ${snapshotId})`));
} catch (error) { console.error(error.message); process.exitCode = 1; }
