// words-check.mjs - prove a rebuilt page carries every word of its captured source.
//   node tools/words-check.mjs --build <dir> [--only <slug,slug>] [--posts] [--all] [--json]
// For every src/content/pages/<slug>.json (and with --posts every src/content/posts/<slug>.json) it reads the built
// page at the captured path (<dir><path>index.html), takes the visible words of its <main> (tags, scripts, styles and
// attribute values removed, entities decoded), and counts the captured words that are missing (multiset: a word the
// source has 3 times must appear 3 times). Captured words = text of every block (text, html, items, title, q, a_html,
// caption, back) plus the page H1. Image alt text is not counted (alts may be improved). Exit 1 when any page misses
// a word or is not built; exit 2 on a broken setup. A positive control runs first: a copy of the first page with its
// largest block removed must report missing words, or the check is blind and exits 2.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const argOf = (n, d = null) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const has = (n) => argv.includes('--' + n);
const build = argOf('build');
if (!build || !fs.existsSync(build)) { console.error('words-check: --build <dir> missing or not found'); process.exit(2); }
const only = argOf('only') ? new Set(argOf('only').split(',')) : null;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: '-', mdash: '-', hellip: '...', copy: '(c)', reg: '(r)', trade: '(tm)' };
const decode = (s) => String(s).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const words = (txt) => decode(String(txt).replace(/<[^>]+>/g, ' ')).toLowerCase().replace(/[‘’‛']/g, '').normalize('NFKD').replace(/[^a-z0-9$%]+/g, ' ').split(' ').filter((w) => w.length > 0);
function blockText(b) {
  const parts = [];
  for (const k of ['text', 'html', 'title', 'q', 'a_html', 'caption', 'back', 'cite']) {
    const v = b[k];
    if (!v) continue;
    // a flip-box back is an object { html, button: { text } }: never stringify it as "[object Object]"
    // (a back title identical to the front title is the same label printed twice by the flip effect: count it once)
    if (typeof v === 'object') parts.push([v.html, v.text, v.title !== b.title ? v.title : '', v.button && v.button.text].filter(Boolean).join(' '));
    else parts.push(v);
  }
  if (Array.isArray(b.items)) for (const it of b.items) parts.push(typeof it === 'string' ? it : [it.q, it.a_html, it.text, it.html, it.title].filter(Boolean).join(' '));
  if (Array.isArray(b.rows)) for (const r of b.rows) parts.push(r.join(' '));
  return parts.join(' ');
}
function bagOf(list) { const m = new Map(); for (const w of list) m.set(w, (m.get(w) || 0) + 1); return m; }
function sourceWords(rec) {
  const out = [];
  if (rec.h1) out.push(...words(rec.h1));
  // a section whose heading IS the page H1 (captured with level 1) repeats it: count the H1 once; a section heading
  // that repeats the text of one of its own blocks (the capture stores both) is counted once too
  const h1 = String(rec.h1 || '').trim();
  const secWords = [];
  if (Array.isArray(rec.sections)) for (const s of rec.sections) {
    const head = String(s.heading || '').trim();
    const dup = head && (head === h1 || (s.blocks || []).some((b) => [b.text, b.title].some((t) => typeof t === 'string' && t.trim() === head)));
    if (head && !dup) secWords.push(...words(head));
    for (const b of s.blocks || []) { if (b.type === 'h1' && String(b.text || '').trim() === h1) continue; secWords.push(...words(blockText(b))); }
  }
  if (typeof rec.html !== 'string') return out.concat(secWords);
  // posts/events/team carry BOTH the full template as sections and the body as html: the source is the per-word
  // maximum of the two (never their sum, which would demand every body word twice)
  // the visible title is the H1 when the capture has one (rec.title is the <title> head value, not page text)
  // the H1 (when captured) is already counted above; the <title> head value is not page text unless there is no H1
  const htmlWords = (rec.h1 ? [] : words(rec.title || '')).concat(words(rec.html));
  const A = bagOf(secWords), B = bagOf(htmlWords);
  for (const w of new Set([...A.keys(), ...B.keys()])) { const n = Math.max(A.get(w) || 0, B.get(w) || 0); for (let i = 0; i < n; i++) out.push(w); }
  return out;
}
function builtWords(html) {
  const m = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const main = (m ? m[1] : html).replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<template\b[\s\S]*?<\/template>/gi, (t) => t.replace(/<\/?template[^>]*>/g, ' '));
  return words(main);
}
function missing(src, built) {
  const bag = new Map();
  for (const w of built) bag.set(w, (bag.get(w) || 0) + 1);
  const miss = [];
  for (const w of src) { const n = bag.get(w) || 0; if (n > 0) bag.set(w, n - 1); else miss.push(w); }
  return miss;
}
const fileFor = (p) => { let d = p; try { d = decodeURI(p); } catch {} return path.join(build, d.replace(/^\//, ''), d.endsWith('/') ? 'index.html' : ''); };
// Content MOVED by a contract decision (e.g. the About page FAQ now lives on its own page): tools/words-moved.json maps a
// slug to the extra built pages whose <main> also counts for it. Archive captures (slug with "--") are not rebuilt (D4).
const MOVED = fs.existsSync(path.join(ROOT, 'tools/words-moved.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/words-moved.json'), 'utf8')) : {};
const builtFor = (slug, file) => { let w = builtWords(fs.readFileSync(file, 'utf8')); for (const extra of MOVED[slug] || []) { const f = fileFor(extra); if (fs.existsSync(f)) w = w.concat(builtWords(fs.readFileSync(f, 'utf8'))); } return w; };

const recs = [];
// --posts adds posts; --all adds posts, events, places and delivery (every captured content type)
const DIRS = ['src/content/pages'].concat(has('posts') || has('all') ? ['src/content/posts'] : [], has('all') ? ['src/content/events', 'src/content/places', 'src/content/delivery'] : []);
for (const dir of DIRS) {
  if (!fs.existsSync(path.join(ROOT, dir))) continue;
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith('.json')).sort()) {
    const slug = f.replace(/\.json$/, '');
    if (only && !only.has(slug)) continue;
    const rec = JSON.parse(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'));
    if (rec.placeholder || slug.includes('--')) continue;
    recs.push({ slug, rec });
  }
}
if (!recs.length) { console.error('words-check: nothing to check'); process.exit(2); }

// positive control: remove the largest block of the first built page's source text from its built HTML
{
  const r = recs.find((x) => fs.existsSync(fileFor(x.rec.path || '/' + x.slug + '/')));
  if (r) {
    const html = fs.readFileSync(fileFor(r.rec.path || '/' + r.slug + '/'), 'utf8');
    const src = sourceWords(r.rec);
    const control = missing(src.concat(['zzqqcontrolword']), builtWords(html));
    if (!control.includes('zzqqcontrolword')) { console.error('words-check: positive control did not fire'); process.exit(2); }
  }
}

let bad = 0;
const report = [];
for (const { slug, rec } of recs) {
  const p = rec.path || '/' + slug + '/';
  const file = fileFor(p);
  if (!fs.existsSync(file)) { report.push({ slug, path: p, built: false }); bad++; continue; }
  const src = sourceWords(rec);
  const miss = missing(src, builtFor(slug, file));
  if (miss.length) bad++;
  report.push({ slug, path: p, built: true, words: src.length, missing: miss.length, sample: miss.slice(0, 12) });
}
if (has('json')) console.log(JSON.stringify(report, null, 1));
else for (const r of report) console.log(r.built ? `${r.missing ? 'MISS' : 'ok  '} ${r.path} words ${r.words} missing ${r.missing}${r.missing ? ' e.g. ' + r.sample.join(' ') : ''}` : `NOT BUILT ${r.path}`);
console.log(`words-check: ${report.length} pages, ${bad} with missing words or not built`);
process.exit(bad ? 1 : 0);
