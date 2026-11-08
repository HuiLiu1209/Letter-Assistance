import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChatHandler } from './src/server/chat.mjs';
const project = path.dirname(fileURLToPath(import.meta.url));
for (const file of ['.env.local', '.env']) {
  try { process.loadEnvFile(path.join(project, file)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const root = path.join(project, 'dist');
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain'};
export function createServer({chat = createChatHandler({apiKey: process.env.GEMINI_API_KEY})} = {}) {
  return http.createServer((req, res) => {
    let pathname, p;
    try { pathname = new URL(req.url, 'http://localhost').pathname; p = path.resolve(root, '.' + decodeURIComponent(pathname)); }
    catch { res.writeHead(400).end(); return; }
    if (pathname === '/api/chat') { void chat(req, res); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, {Allow:'GET, HEAD'}).end(); return; }
    if (p !== root && !p.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (p === root) p = path.join(root, 'index.html');
    fs.stat(p, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404).end('Not found'); return; }
      res.writeHead(200, {'Content-Type':types[path.extname(p)] || 'application/octet-stream', 'Cache-Control':'no-store'});
      if (req.method === 'HEAD') res.end(); else fs.createReadStream(p).pipe(res);
    });
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createServer().listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
}
