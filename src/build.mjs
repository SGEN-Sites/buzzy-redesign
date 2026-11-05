// build.mjs - BUZZY redesign pitch: src/content/*.json -> static site in dist/ (or --out <dir> for a lane).
//   MSYS_NO_PATHCONV=1 node src/build.mjs [--out dist]
// Node builtins + cwebp (webpmux optional) on PATH. Theme modules in src/theme/index.mjs MODULES each export
// render(ctx) -> [{ path, html }]; path "/x/" writes x/index.html, "/404.html" writes 404.html. Exit 1 on a missing
// image, a template error or a duplicate path. Warnings: h1 count != 1, no <main id="main">, empty description.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/paths.mjs';
import { loadAll } from './lib/data.mjs';
import { scanGenerated, writeVariants, imageErrors } from './lib/images.mjs';
import { minifyCss } from './lib/minify-css.mjs';
import { MODULES } from './theme/index.mjs';
import { CSS_ORDER } from './theme/shell.mjs';

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const OUT = path.resolve(ROOT, argOf('out', 'dist'));
if (!OUT.startsWith(ROOT + path.sep)) { console.error('refusing --out outside the project: ' + OUT); process.exit(2); }
const t0 = Date.now();
const fail = (msg) => { console.error('BUILD FAILED: ' + msg); process.exit(1); };

const data = loadAll();
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

function copyDir(src, dst, filter = () => true) {
  const s = path.join(ROOT, src);
  if (!fs.existsSync(s)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(s, { withFileTypes: true })) {
    if (e.isDirectory()) { n += copyDir(path.join(src, e.name), path.join(dst, e.name), filter); continue; }
    if (!filter(e.name)) continue;
    fs.mkdirSync(path.join(OUT, dst), { recursive: true });
    fs.copyFileSync(path.join(s, e.name), path.join(OUT, dst, e.name));
    n++;
  }
  return n;
}

// ---------- static assets ----------
const cssFiles = CSS_ORDER.filter((f) => fs.existsSync(path.join(ROOT, 'src/styles', f + '.css')));
fs.mkdirSync(path.join(OUT, 'assets/css'), { recursive: true });
for (const f of cssFiles) fs.writeFileSync(path.join(OUT, 'assets/css', f + '.css'), minifyCss(fs.readFileSync(path.join(ROOT, 'src/styles', f + '.css'), 'utf8')));
const extraCss = fs.readdirSync(path.join(ROOT, 'src/styles')).filter((f) => f.endsWith('.css') && !CSS_ORDER.includes(f.replace(/\.css$/, '')));
if (extraCss.length) console.warn('warning: stylesheets not in CSS_ORDER are not linked: ' + extraCss.join(', '));
fs.mkdirSync(path.join(OUT, 'assets/js'), { recursive: true });
const jsFiles = fs.readdirSync(path.join(ROOT, 'src/scripts')).filter((f) => f.endsWith('.js'));
for (const f of jsFiles) fs.copyFileSync(path.join(ROOT, 'src/scripts', f), path.join(OUT, 'assets/js', f));
const copied = {
  brand: copyDir('assets/brand', 'assets/brand', (n) => /\.(png|webp|svg|jpg|ico)$/i.test(n)),
  fonts: copyDir('assets/fonts', 'assets/fonts', (n) => /\.(woff2?|ttf)$/i.test(n)),
  media: copyDir('assets/media', 'assets/media', (n) => /\.(mp4|webm|webp|jpg|png)$/i.test(n)),
  photos: copyDir('assets/photos', 'assets/photos', (n) => /\.(webp|jpe?g|png|gif|avif|svg)$/i.test(n)),
};
for (const f of ['favicon.ico', 'favicon-32.png', 'favicon-48.png', 'apple-touch-icon.png']) {
  const s = path.join(ROOT, 'assets/brand', f);
  if (fs.existsSync(s)) fs.copyFileSync(s, path.join(OUT, f));
}
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nAllow: /\n');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// ---------- images ----------
fs.mkdirSync(path.join(ROOT, 'assets/generated'), { recursive: true });
scanGenerated();

// ---------- render ----------
const pages = new Map();
const ctx = { ...data, cssFiles, jsFiles, out: OUT, pages };
// MODULES_EXTRA=name,name renders extra lane-private modules (e.g. FOUNDATION's _demo) in a lane build only.
const EXTRA = (process.env.MODULES_EXTRA || '').split(',').map((x) => x.trim()).filter(Boolean);
for (const name of [...MODULES, ...EXTRA]) {
  const file = path.join(ROOT, 'src/theme', name + '.mjs');
  if (!fs.existsSync(file)) { console.warn('warning: template module not written yet: ' + name); continue; }
  let mod;
  try { mod = await import('./theme/' + name + '.mjs'); } catch (e) { fail(`template ${name} failed to load: ${e.stack || e}`); }
  if (typeof mod.render !== 'function') fail('template ' + name + ' exports no render(ctx)');
  let out;
  try { out = await mod.render(ctx); } catch (e) { fail(`template ${name} threw: ${e.message}${/missing image/.test(e.message) ? '' : '\n' + e.stack}`); }
  for (const p of out || []) {
    if (!p || typeof p.path !== 'string' || typeof p.html !== 'string') fail('template ' + name + ' returned a page without path/html');
    if (pages.has(p.path)) fail(`duplicate page path ${p.path} (${pages.get(p.path).from} and ${name})`);
    pages.set(p.path, { ...p, from: name });
  }
}
const errs = imageErrors();
if (errs.length) fail([...new Set(errs)].join('\n  '));

// Long captured H1s (captured SEO titles run long) would push the hero CTAs below a 1280x585 first screen:
// tag them by visible length so fix.css can size them (h1--mid > 26 chars, h1--long > 40 chars). Home is excluded.
function tagLongH1(html) {
  return html.replace(/<h1(\s[^>]*)?>([\s\S]*?)<\/h1>/, (m, at = '', inner) => {
    const n = inner.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, 'x').replace(/\s+/g, ' ').trim().length;
    const tier = n > 40 ? 'h1--long' : n > 26 ? 'h1--mid' : '';
    if (!tier || /h-hero__h1/.test(at)) return m;
    const withClass = /\sclass="/.test(at) ? at.replace(/\sclass="/, ` class="${tier} `) : `${at} class="${tier}"`;
    return `<h1${withClass}>${inner}</h1>`;
  });
}
for (const [p, rec] of pages) if (p.endsWith('/') && p !== '/') rec.html = tagLongH1(rec.html);

const warnings = [];
for (const [p, { html, from }] of pages) {
  const rel = p.endsWith('/') ? p.slice(1) + 'index.html' : p.slice(1);
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) warnings.push(`${p} (${from}): ${h1} <h1>`);
  if (!/<main id="main"/.test(html)) warnings.push(`${p} (${from}): no <main id="main">`);
  if (!/<meta name="description" content="[^"]+"/.test(html)) warnings.push(`${p} (${from}): empty meta description`);
}
if (!pages.has('/404.html')) warnings.push('no /404.html page rendered');

const iv = await writeVariants(OUT);
const errs2 = imageErrors();
if (errs2.length) fail([...new Set(errs2)].join('\n  '));
for (const w of warnings) console.warn('warning: ' + w);
console.log(`built ${pages.size} pages -> ${path.relative(ROOT, OUT) || '.'} | css ${cssFiles.join(',')} | js ${jsFiles.join(',')} | brand ${copied.brand}, fonts ${copied.fonts}, media ${copied.media}, photos ${copied.photos} | img variants ${iv.copied} (encoded ${iv.encoded}, ai-label ${iv.labelled ? 'yes' : 'no'}) | ${((Date.now() - t0) / 1000).toFixed(1)}s`);
