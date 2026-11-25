const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const nodeVersion = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim().replace(/^v/, '');
const packageManager = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).packageManager;
const pnpmVersion = /^pnpm@([\d.]+)/.exec(packageManager)?.[1];
const executable = name => process.platform === 'win32' ? name + '.exe' : name;

function installedToolchain() {
  if (!/^\d+\.\d+\.\d+$/.test(nodeVersion) || !pnpmVersion) throw new Error('Invalid repository toolchain pins');
  const home = os.homedir();
  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const local = process.env.LOCALAPPDATA;
  const pnpmHomes = [process.env.PNPM_HOME, process.env.XDG_DATA_HOME && path.join(process.env.XDG_DATA_HOME, 'pnpm'),
    path.join(home, 'Library', 'pnpm'), path.join(home, '.local', 'share', 'pnpm'), local && path.join(local, 'pnpm')].filter(Boolean);
  const nvm = process.env.NVM_DIR ?? path.join(home, '.nvm');
  const nodeDirs = [
    ...pnpmHomes.map(dir => path.join(dir, 'nodejs', nodeVersion, 'bin')),
    ...pnpmHomes.map(dir => path.join(dir, 'nodejs', nodeVersion)),
    path.join(nvm, 'versions', 'node', 'v' + nodeVersion, 'bin'), ...pathEntries,
  ];
  const offline = {
    ...process.env, COREPACK_ENABLE_NETWORK: '0', npm_config_offline: 'true', npm_config_manage_package_manager_versions: 'false',
  };
  function runs(file, expected, env) {
    if (!fs.existsSync(file)) return false;
    const result = spawnSync(file, ['--version'], { cwd: os.tmpdir(), env, encoding: 'utf8', timeout: 5000 });
    return result.status === 0 && result.stdout.trim().replace(/^v/, '') === expected;
  }
  const node = process.versions.node === nodeVersion ? process.execPath
    : [...new Set(nodeDirs)].map(dir => path.resolve(dir, executable('node'))).find(file => runs(file, nodeVersion, offline));
  if (!node) throw new Error(`Node ${nodeVersion} is required. Install it or put the installed version on PATH.`);
  const nodeDirectory = path.dirname(node);
  const pnpmDirs = [...pnpmHomes.map(dir => path.join(dir, '.tools', 'pnpm', pnpmVersion, 'bin')), ...pnpmHomes, ...pathEntries];
  const pnpm = [...new Set(pnpmDirs)].map(dir => path.resolve(dir, executable('pnpm'))).find(file => runs(file, pnpmVersion, {
    ...offline, PATH: [nodeDirectory, path.dirname(file), ...pathEntries].join(path.delimiter),
  }));
  if (!pnpm) throw new Error(`pnpm ${pnpmVersion} is required. Put the installed version on PATH.`);
  return { node, pnpm, env: { ...offline, PATH: [nodeDirectory, path.dirname(pnpm), ...pathEntries].join(path.delimiter) } };
}

try {
  const args = process.argv.slice(2);
  const remote = args[0] === '--r2';
  if (remote) args.shift();
  if (args.includes('--help')) {
    console.log(remote
      ? 'Usage: bun run deploy:r2 --mode full|daily|verify|promote|resume|status [--candidate-id <ID>] [--retire-legacy]'
      : 'Usage: bun run build:release[:daily] [--input <snapshot>] [--previous <snapshot>] [--store <path>] [--candidate-only] [--clean]');
  } else {
    const tools = installedToolchain();
    if (args.includes('--version')) console.log(JSON.stringify({ node: nodeVersion, pnpm: pnpmVersion }));
    else {
      const child = spawn(tools.node, [path.join(__dirname, remote ? 'deploy-static-r2.cjs' : 'build-static-release.cjs'), ...args], {
        cwd: process.cwd(), env: tools.env, stdio: 'inherit',
      });
      const forward = signal => child.kill(signal);
      process.on('SIGINT', forward);
      process.on('SIGTERM', forward);
      child.once('error', error => { console.error(error.message); process.exitCode = 1; });
      child.once('close', (code, signal) => {
        process.removeListener('SIGINT', forward);
        process.removeListener('SIGTERM', forward);
        process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
      });
    }
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
