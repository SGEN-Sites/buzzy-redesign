#!/usr/bin/env node
// phone-audit.mjs - measure every built page the way a phone gets it: 390x844 (and 360x740) CSS px, DPR 3, mobile
// viewport, touch emulation (so (hover:none) / (pointer:coarse) rules apply), 21+ consent pre-set.
// Serves --dir itself (in-process static server with Range support), so no external server can die mid-run.
// Per page: innerWidth vs scrollWidth (horizontal overflow) and the offending elements; document height; tap
// targets under 44x44 (inline links inside running text are exempt, as WCAG 2.5.8 allows); visible text under 13px;
// how many visible elements use backdrop-filter; fixed/sticky chrome height on the first screen; bytes fetched before
// any scroll and after scrolling to the bottom (images, video, css, js, fonts); the LCP element.
//   node tools/phone-audit.mjs [--dir dist] [--widths 390,360] [--pages /,/faq/] [--json tmp/phone-audit.json]
// Positive control: a page with a planted 900px-wide element must report overflow, or the run exits 2.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const DIR = path.resolve(ROOT, argOf('dir', 'dist'));
const WIDTHS = String(argOf('widths', '390,360')).split(',').map(Number);
const HEIGHT = { 390: 844, 360: 740 };
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain' };

function listPages(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'assets') walk(p); continue; }
      if (e.name === 'index.html') out.push('/' + path.relative(dir, d).split(path.sep).join('/') + (d === dir ? '' : '/'));
    }
  })(dir);
  return out.map((p) => p.replace(/^\/\/?$/, '/').replace(/^\/+/, '/')).sort();
}
const PAGES = argOf('pages') ? String(argOf('pages')).split(',') : listPages(DIR);

const CONTROL_PATH = '/__phone-audit-control__/';
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === CONTROL_PATH) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div style="width:900px;height:10px">x</div></body>');
  }
  let f = path.join(DIR, u);
  if (!f.startsWith(DIR)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end(fs.existsSync(path.join(DIR, '404.html')) ? fs.readFileSync(path.join(DIR, '404.html')) : 'not found'); }
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
const BASE = `http://127.0.0.1:${server.address().port}`;

const PROBE = `(async () => {
  const W = innerWidth, H = innerHeight;
  const vis = (el) => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  // content of a CLOSED <details> (anything but its summary) is not on screen, even when an animated
  // ::details-content keeps a box for it: count it only when the details is open
  const inClosedDetails = (el) => { const d = el.closest('details:not([open])'); return !!d && !el.closest('summary'); };
  const inHidden = (el) => { if (inClosedDetails(el)) return true; for (let a = el; a; a = a.parentElement) { if (a.hidden || a.getAttribute('aria-hidden') === 'true' || a.closest('[inert]')) return true; const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden') return true; } return false; };
  const inFixed = (el) => { for (let a = el; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') return true; return false; };
  const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(hidden|clip|auto|scroll)/.test(s.overflowX)) return true; } return false; };
  const sel = (el) => { const p = []; for (let n = el; n && n !== document.body && p.length < 4; n = n.parentElement) p.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.classList.length ? '.' + [...n.classList].slice(0, 2).join('.') : '')); return p.join('>'); };
  // first-screen resources (before any scroll)
  const resNow = () => performance.getEntriesByType('resource').map((e) => ({ n: e.name.replace(location.origin, ''), t: e.initiatorType, b: e.encodedBodySize || e.transferSize || 0 }));
  const first = resNow();
  // fixed / sticky chrome height on the first screen
  let chrome = 0;
  for (const el of document.querySelectorAll('header, .topbar, [data-header], .promo, .utility, .crumbs-bar')) { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); if (/(fixed|sticky)/.test(s.position) && r.top < H && r.bottom > 0) chrome = Math.max(chrome, Math.round(r.bottom)); }
  // scroll to the bottom in steps so lazy media and reveals run
  const docH0 = document.documentElement.scrollHeight;
  for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(H * 0.8)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 900)); scrollTo(0, 0); await new Promise((r) => setTimeout(r, 300));
  const all = resNow();
  const sum = (list, re) => list.filter((e) => re.test(e.n) || re.test(e.t)).reduce((a, e) => a + e.b, 0);
  const kinds = (list) => ({ img: sum(list, /\\.(webp|png|jpe?g|svg|avif|gif)(\\?|$)/), video: sum(list, /\\.(mp4|webm)(\\?|$)/), css: sum(list, /\\.css(\\?|$)/), js: sum(list, /\\.m?js(\\?|$)/), font: sum(list, /\\.(woff2?|ttf|otf)(\\?|$)|fonts\\.gstatic/), total: list.reduce((a, e) => a + e.b, 0), n: list.length });
  // overflow offenders
  const over = [];
  for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width === 0 || r.right <= W + 0.5 || inFixed(el) || clipped(el)) continue; over.push({ sel: sel(el), right: Math.round(r.right) }); }
  // tap targets
  const small = [];
  for (const el of document.querySelectorAll('a[href], button, summary, input:not([type=hidden]), select, textarea, [role=button], label[for]')) {
    if (inHidden(el) || !vis(el) || inFixed(el) && !el.closest('header, [data-header], .topbar')) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= 44 && r.height >= 44) continue;
    // inline links inside running text are exempt (WCAG 2.5.8 inline exception)
    const blk = el.parentElement && el.parentElement.closest('p, li, dd, td, blockquote, figcaption');
    if (el.tagName === 'A' && blk && (blk.innerText || '').trim().length > (el.innerText || '').trim().length + 12) continue;
    small.push({ sel: sel(el), w: Math.round(r.width), h: Math.round(r.height), t: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30) });
  }
  // tiny text
  const tiny = []; const seen = new Set();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) { const t = tw.currentNode; if (!t.nodeValue.trim()) continue; const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el); if (inHidden(el) || !vis(el)) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 13) tiny.push({ sel: sel(el), fs, t: t.nodeValue.trim().slice(0, 30) }); }
  // glass
  let glass = 0; for (const el of document.querySelectorAll('body *')) { const s = getComputedStyle(el); const bf = s.backdropFilter || s.webkitBackdropFilter; if (bf && bf !== 'none' && vis(el)) glass++; }
  // LCP
  const lcp = await new Promise((res) => { let last = null; try { new PerformanceObserver((l) => { const e = l.getEntries(); if (e.length) last = e[e.length - 1]; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {} setTimeout(() => res(last ? { tag: last.element ? sel(last.element) : '', size: last.size, url: (last.url || '').replace(location.origin, '') } : null), 300); });
  const heavy = all.slice().sort((a, b) => b.b - a.b).slice(0, 5);
  return { W, sw: document.documentElement.scrollWidth, docH: docH0, chrome, first: kinds(first), all: kinds(all), heavy, over: over.slice(0, 6), small: small.length, smallList: small.slice(0, 400), tiny: tiny.length, tinyList: tiny.slice(0, 400), glass, lcp };
})()`;

const b = await launch({ port: 0 });
const results = [];
try {
  for (const w of WIDTHS) {
    const pg = await b.newPage({ width: w, height: HEIGHT[w] || 800, mobile: true });
    await pg.send('Emulation.setDeviceMetricsOverride', { width: w, height: HEIGHT[w] || 800, deviceScaleFactor: 3, mobile: true });
    await pg.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await pg.send('Page.addScriptToEvaluateOnNewDocument', { source: "try{localStorage.setItem('buzzy-age-ok','1')}catch(e){}" });
    await pg.send('Network.setCacheDisabled', { cacheDisabled: true });
    // control first: the instrument must see a planted overflow
    await pg.goto(BASE + CONTROL_PATH, { settle: 200 });
    const ctl = await pg.eval('document.documentElement.scrollWidth');
    if (!(ctl > w)) { console.error(`control failed at ${w}: scrollWidth ${ctl}`); process.exit(2); }
    for (const p of PAGES) {
      try {
        await pg.goto(BASE + p, { settle: 700 });
        // --open-details: open every <details> first, so the links inside FAQ answers are measured as a reader sees
        // them after a tap (closed answers are excluded from the default run)
        if (argv.includes('--open-details')) { await pg.eval("document.querySelectorAll('details').forEach(function (d) { d.open = true; }); true"); await sleep(400); }
        const r = await pg.eval(PROBE, { timeout: 90000 });
        results.push({ page: p, width: w, ...r });
        console.log(`${String(w).padEnd(4)} ${p.padEnd(38)} ${r.sw > r.W ? 'OVERFLOW ' + r.sw : 'ok      '} h ${String(r.docH).padStart(5)} | small taps ${String(r.small).padStart(3)} | tiny text ${String(r.tiny).padStart(3)} | glass ${String(r.glass).padStart(3)} | chrome ${r.chrome}px | first ${(r.first.total / 1024).toFixed(0)} KB (img ${(r.first.img / 1024).toFixed(0)}, video ${(r.first.video / 1024).toFixed(0)}) | full ${(r.all.total / 1024).toFixed(0)} KB`);
      } catch (e) {
        results.push({ page: p, width: w, error: String(e.message || e).slice(0, 200) });
        console.log(`${w} ${p} ERROR ${String(e.message || e).slice(0, 120)}`);
      }
    }
  }
} finally { await b.close(); server.close(); }
const out = argOf('json', 'tmp/phone-audit.json');
fs.mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true });
fs.writeFileSync(path.resolve(ROOT, out), JSON.stringify(results, null, 1));
const ok = results.filter((r) => !r.error);
const agg = (w) => { const L = ok.filter((r) => r.width === w); return `width ${w}: pages ${L.length}, overflow ${L.filter((r) => r.sw > r.W).length}, small taps ${L.reduce((a, r) => a + r.small, 0)}, tiny text ${L.reduce((a, r) => a + r.tiny, 0)}, mean height ${Math.round(L.reduce((a, r) => a + r.docH, 0) / Math.max(1, L.length))}px, mean first-load ${Math.round(L.reduce((a, r) => a + r.first.total, 0) / Math.max(1, L.length) / 1024)} KB, mean full-scroll ${Math.round(L.reduce((a, r) => a + r.all.total, 0) / Math.max(1, L.length) / 1024)} KB`; };
for (const w of WIDTHS) console.log(agg(w));
console.log(`errors ${results.length - ok.length}; control fired (planted 900px element seen as overflow); json -> ${out}`);
process.exit(0);
