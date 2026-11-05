#!/usr/bin/env node
// parity.mjs - prove every captured word reached the built site: for each page in src/content/pages/*.json, every
// text-bearing block (headings, paragraphs, list items, dt/dd, FAQ summaries, quotes, link labels) must appear, after
// tag stripping, entity decoding and whitespace collapsing, inside the built page's <main> text. Blocks that are
// deliberately not text (aria-hidden marquee copies, inline SVG art, buttons, video) are skipped and counted.
//   node tools/parity.mjs [--dir dist] [--json <report.json>]
// Positive control: a planted block that exists nowhere must be reported missing, or the run fails (exit 2).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const DIR = path.resolve(ROOT, argOf('dir', 'dist'));
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', middot: '·', copy: '©' };
const decode = (s) => String(s).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : m));
const norm = (s) => decode(String(s).replace(/<[^>]+>/g, ' ')).replace(/[ \s]+/g, ' ').trim();

function texts(blocks, out, skipped) {
  for (const b of blocks || []) {
    if (['hidden', 'svg', 'button', 'video'].includes(b.t)) { skipped.n++; continue; }
    if (b.html) out.push(b.html);
    if (b.summary) out.push(b.summary);
    if (b.caption) out.push(b.caption);
    if (b.t === 'ul' || b.t === 'ol') for (const it of b.items) { if (typeof it === 'string') out.push(it); else texts(it.blocks, out, skipped); }
    if (b.t === 'dl') for (const it of b.items) { out.push(it.dt); for (const d of it.dd) out.push(d); }
    if (b.t === 'links') for (const it of b.items) out.push(it.html);
    if (b.blocks) texts(b.blocks, out, skipped);
  }
  return out;
}

function builtMain(p) {
  const rel = p === '/' ? 'index.html' : p.replace(/^\//, '').replace(/\/?$/, '/') + 'index.html';
  const f = path.join(DIR, rel);
  if (!fs.existsSync(f)) return null;
  const html = fs.readFileSync(f, 'utf8');
  const m = html.match(/<main\b[\s\S]*<\/main>/);
  return sq(norm((m ? m[0] : html).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')));
}
// Words are compared with ALL whitespace removed: a capture can join two cells the source painted apart ("1 g" + "$11"
// became "1 g$11" when the converter unwrapped the spans), while the rebuild puts them in two cells again ("1 g $11").
// Letters, digits, punctuation and their order must still match exactly.
function sq(s) { return String(s).replace(/\s+/g, ''); }

const pagesDir = path.join(ROOT, 'src/content/pages');
const report = [];
let totalMissing = 0;
for (const f of fs.readdirSync(pagesDir).filter((x) => x.endsWith('.json')).sort()) {
  const doc = JSON.parse(fs.readFileSync(path.join(pagesDir, f), 'utf8'));
  const skipped = { n: 0 };
  const want = [...new Set(texts(doc.sections.flatMap((s) => s.blocks), [], skipped).map(norm).filter((t) => t.length > 1))];
  const main = builtMain(doc.path);
  if (main == null) { report.push({ page: doc.path, built: false, blocks: want.length, missing: want.length }); totalMissing += want.length; continue; }
  const missing = want.filter((t) => !main.includes(sq(t)));
  totalMissing += missing.length;
  report.push({ page: doc.path, built: true, blocks: want.length, found: want.length - missing.length, skipped: skipped.n, missing });
}
// controls, through the same comparison: a planted block must be reported missing, and a block known to be on the
// home page (its first heading) must be found - otherwise the instrument is blind or broken
const home = builtMain('/');
if (home != null) {
  const lost = (list) => list.map(norm).filter((t) => !home.includes(sq(t))).length;
  if (lost(['PARITY-CONTROL-' + 'zq9x string that exists nowhere']) !== 1) { console.error('control: a planted block was not reported missing'); process.exit(2); }
  const homeDoc = JSON.parse(fs.readFileSync(path.join(pagesDir, 'home.json'), 'utf8'));
  const h1 = homeDoc.sections.flatMap((s) => s.blocks).find((b) => b.t === 'h1');
  if (h1 && lost([h1.html]) !== 0) { console.error('control: the home h1 was not found (normalisation broken?)'); process.exit(2); }
}

for (const r of report) {
  console.log(`${r.built ? (r.missing.length ? 'LOSS' : 'ok  ') : 'MISS'} ${r.page.padEnd(20)} ${r.built ? `${r.found}/${r.blocks}` : 'page not built'}${r.skipped ? ` (skipped ${r.skipped} non-text)` : ''}`);
  if (r.built) for (const m of r.missing.slice(0, 6)) console.log('       missing: ' + m.slice(0, 140));
}
console.log(`parity: ${report.length} captured pages, ${report.reduce((a, r) => a + r.blocks, 0)} text blocks, missing ${totalMissing}; controls ${home != null ? 'passed (a planted block reported missing, the home h1 found)' : 'skipped (no home built)'}`);
if (argOf('json')) fs.writeFileSync(path.resolve(ROOT, argOf('json')), JSON.stringify(report, null, 1));
process.exit(totalMissing ? 1 : 0);
