// phone-shots.mjs - serve a build IN-PROCESS (port 0, no port collisions, nothing left running) and capture phone
// screenshots of a list of pages: the first screen at the true phone size, plus the whole page as viewport-height
// slices taken while scrolling at a FIXED viewport (full-height rasterising stretches vh-sized blocks; this does not).
// Mobile emulation: 390x844 (or --width) CSS px, DPR 1 for the files (layout review), touch on, 21+ consent pre-set.
//   node tools/phone-shots.mjs --dir tmp/build-x --pages /,/products/ --out tmp/x/shots [--width 390 --height 844]
//        [--max 10] [--first-only] [--reduced-motion]
// Writes <out>/<slug>.<w>.v00.png, v01 ... (v00 = first screen). Prints scrollWidth per page (must equal the width).
// One headless Chrome per run; the browser is closed in finally and the script exits.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { launch, sleep } from './cdp.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const DIR = path.resolve(String(arg('dir', 'dist')));
const pages = String(arg('pages', '/')).split(',').filter(Boolean);
const OUT = path.resolve(String(arg('out', 'tmp/phone-shots')));
const W = Number(arg('width', 390)), H = Number(arg('height', 844)), MAX = Number(arg('max', 10));
const firstOnly = !!arg('first-only', false);
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(DIR, u);
  if (!f.startsWith(DIR)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('not found'); }
  const st = fs.statSync(f);
  const type = MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${st.size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    return fs.createReadStream(f, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'accept-ranges': 'bytes' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const b = await launch({ port: 0 });
let code = 0;
try {
  const p = await b.newPage({ width: W, height: H, mobile: true });
  await p.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });
  await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('buzzy-age-ok','1')}catch(e){}" });
  if (arg('reduced-motion', false)) await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  for (const pg of pages) {
    await p.goto(base + pg, { settle: 700, timeout: 60000 });
    try { await p.send('Page.bringToFront'); } catch { /* older targets */ }
    const iw = await p.eval('innerWidth');
    if (iw !== W) throw new Error(`viewport not applied: wanted ${W} got ${iw}`);
    await p.eval('document.fonts.ready.then(() => true)');
    const docH = await p.eval('document.documentElement.scrollHeight');
    const sw = await p.eval('document.documentElement.scrollWidth');
    const slug = (pg.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'home');
    const steps = firstOnly ? 1 : Math.min(MAX, Math.ceil(docH / H));
    for (let k = 0; k < steps; k++) {
      await p.eval(`scrollTo(0, ${k * H})`);
      await sleep(k ? 650 : 300);
      const r = await p.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, `${slug}.${W}.v${String(k).padStart(2, '0')}.png`), Buffer.from(r.data, 'base64'));
    }
    console.log(`${W}  ${pg.padEnd(40)} scrollWidth ${sw}${sw > W ? ' OVERFLOW' : ' ok'}  height ${docH}  shots ${steps}${steps < Math.ceil(docH / H) ? ' (capped at --max)' : ''}`);
    if (sw > W) code = 1;
  }
} finally {
  await b.close().catch(() => {});
  server.close();
}
process.exit(code);
