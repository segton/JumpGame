import http from 'node:http';
import { mkdirSync, readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDemoLeaderboard } from './demo-leaderboard.js';
import { createStore, RequestError } from './store.js';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
mkdirSync(resolve(root, 'data'), { recursive: true });
const store = createStore({ path: process.env.DB_PATH || resolve(root, 'data/leaderboard.sqlite') });
const port = Number(process.env.API_PORT || 3001), host = process.env.API_HOST || '127.0.0.1';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const demo=process.env.ENABLE_LEADERBOARD_DEMO==='1' && process.env.NODE_ENV!=='production'?createDemoLeaderboard():null;
const starts = new Map();
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); }
async function body(req) {
  if (!String(req.headers['content-type']).startsWith('application/json')) throw new RequestError('JSON required', 415);
  let length = 0, chunks = [];
  for await (const chunk of req) { length += chunk.length; if (length > 4_000_000) throw new RequestError('Replay too large', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new RequestError('Invalid JSON'); }
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`), token = String(req.headers.authorization || '').replace(/^Bearer /, '');
    if (req.method === 'POST' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new RequestError('Origin mismatch', 403);
    if(req.method==='GET' && url.pathname==='/api/demo/leaderboard'){if(!demo)throw new RequestError('Demo disabled',404);return json(res,200,{entries:demo.top(),simulation:true});}
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, database: 'sqlite' });
    if (req.method === 'GET' && url.pathname === '/api/leaderboard') return json(res, 200, { entries: store.top(url.searchParams.get('preset') || 'relaxed') });
    if (req.method === 'POST' && url.pathname === '/api/runs') {
      const address = req.socket.remoteAddress, now = Date.now(), window = starts.get(address) || { time: now, count: 0 };
      if (now - window.time > 60_000) { window.time = now; window.count = 0; }
      if (++window.count > 30) throw new RequestError('Too many run starts', 429); starts.set(address, window);
      const request=await body(req);return json(res, 201, store.start(request.preset,request.name));
    }
    const match = url.pathname.match(/^\/api\/runs\/([\w-]+)\/(finish|entry)$/);
    if (req.method === 'POST' && match) return json(res, 200, match[2] === 'finish' ? store.finish(match[1], token, await body(req)) : store.submit(match[1], token, await body(req)));
    if (url.pathname.startsWith('/api/')) throw new RequestError('Unknown endpoint', 404);
    if (req.method !== 'GET') throw new RequestError('Method not allowed', 405);
    const dist = resolve(root, 'dist'), path = resolve(dist, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
    if (!path.startsWith(dist + '/') && !path.startsWith(dist + '\\')) throw new RequestError('Invalid path', 403);
    if (!existsSync(path) || !statSync(path).isFile()) throw new RequestError('File not found', 404);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }); createReadStream(path).pipe(res);
  } catch (error) { json(res, error.status || 500, { error: error.status ? error.message : 'Server error' }); }
});
server.listen(port, host, () => console.log(`Cloud Ascent API + built site: http://${host}:${port}`));
const close = () => server.close(() => { demo?.close(); store.close(); process.exit(0); });
process.on('SIGTERM', close); process.on('SIGINT', close);
