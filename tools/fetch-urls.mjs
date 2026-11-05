#!/usr/bin/env node
// Polite fetcher for a fixed URL list (sitemap-seeded). One connection per host,
// a pause between requests, identifying UA, robots honoured by the caller's list
// (both sites disallow only /wp-admin/). A 401/403/429 stops the host (never retried).
//   node tools/fetch-urls.mjs --list <urls.txt> --out <dir> [--delay 700]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const list = fs.readFileSync(args.list, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const out = path.resolve(args.out);
const delay = Number(args.delay || 700);
fs.mkdirSync(out, { recursive: true });
const UA = 'site-reforge/1.0 (redesign pitch research; static fetch)';

function slugOf(u) {
  const p = new URL(u);
  let s = decodeURIComponent(p.pathname).replace(/^\/|\/$/g, '') || 'home';
  s = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'home';
  const h = crypto.createHash('sha1').update(u).digest('hex').slice(0, 6);
  return `${s.slice(0, 90)}--${h}`;
}

const indexFile = path.join(out, '_index.json');
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : {};
let stopped = false;
for (const u of list) {
  if (stopped) { index[u] = index[u] || { status: 'not-fetched (host stopped)' }; continue; }
  if (index[u] && index[u].status === 200) continue;
  const file = slugOf(u) + '.html';
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept': 'text/html' }, redirect: 'manual' });
    const status = r.status;
    const loc = r.headers.get('location');
    const body = status === 200 ? await r.text() : '';
    if (status === 200) fs.writeFileSync(path.join(out, file), body);
    index[u] = { status, file: status === 200 ? file : null, bytes: body.length, location: loc || undefined, at: new Date().toISOString() };
    process.stdout.write(`${status} ${u}${loc ? ' -> ' + loc : ''}\n`);
    if ([401, 403, 429].includes(status)) { stopped = true; process.stdout.write(`STOP host after ${status}\n`); }
  } catch (e) {
    index[u] = { status: 'error', error: String(e && e.message || e) };
    process.stdout.write(`ERR ${u} ${e && e.message}\n`);
  }
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 1));
  await new Promise(r => setTimeout(r, delay));
}
const vals = Object.values(index);
console.log(`done: ${vals.filter(v => v.status === 200).length}/${list.length} 200, ${vals.filter(v => v.status !== 200).length} other`);
