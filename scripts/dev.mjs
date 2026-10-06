import { spawn } from 'node:child_process';
const node = process.execPath;
const api = spawn(node, ['server/index.js'], { stdio: 'inherit', env: {...process.env,ENABLE_LEADERBOARD_DEMO:'1'} });
const vite = spawn(node, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
function stop() { api.kill(); vite.kill(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
api.on('exit', code => { vite.kill(); process.exitCode = code || 0; });
vite.on('exit', code => { api.kill(); process.exitCode = code || 0; });
