import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function runService(name, prefix, script) {
  const child = spawn(npmCmd, ['--prefix', prefix, 'run', script], {
    stdio: 'inherit',
    shell: isWin,
  });

  child.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
  });

  return child;
}

console.log('🚀 Starting Vyla Music (music-server :4000 + music-web :3000)...');
const server = runService('music-server', 'music-server', 'dev');
const web = runService('music-web', 'music-web', 'dev');

function shutdown() {
  server.kill();
  web.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
