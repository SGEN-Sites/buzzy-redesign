// Local receiver for bulk data carried out of a Chrome tab via window.name.
// GET  /recv?f=<name>  -> a page whose script POSTs window.name to /save?f=<name>
// POST /save?f=<name>  -> writes the body to <inbox>/<name>.txt
// Binds to 127.0.0.1 only. Usage: node tools/recv-server.mjs <inboxDir> [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const inbox = path.resolve(process.argv[2] || 'crawl/rise/inbox');
const port = Number(process.argv[3] || 47811);
fs.mkdirSync(inbox, { recursive: true });
const okName = n => /^[a-z0-9._-]{1,80}$/.test(n || '');

const page = name => `<!doctype html><meta charset="utf-8"><title>recv ${name}</title>
<body style="font:14px system-ui;padding:2em">receiving ${name}...
<script>
(async () => {
  const d = window.name || '';
  try {
    const r = await fetch('/save?f=' + encodeURIComponent(${JSON.stringify(name)}), { method: 'POST', body: d });
    const t = await r.text();
    document.title = 'saved ' + d.length + ' ' + r.status;
    document.body.textContent = 'saved ' + d.length + ' chars: ' + t;
    window.name = '';
  } catch (e) { document.title = 'error'; document.body.textContent = 'error ' + e; }
})();
</script>`;

http.createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${port}`);
  const f = u.searchParams.get('f');
  if (req.method === 'GET' && u.pathname === '/recv' && okName(f)) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(page(f));
  }
  if (req.method === 'POST' && u.pathname === '/save' && okName(f)) {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const out = path.join(inbox, f + '.txt');
      fs.writeFileSync(out, body);
      console.log(new Date().toISOString(), 'saved', out, body.length, 'bytes');
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(String(body.length));
    });
    return;
  }
  res.writeHead(404); res.end('no');
}).listen(port, '127.0.0.1', () => console.log('recv listening on 127.0.0.1:' + port + ' inbox=' + inbox));
