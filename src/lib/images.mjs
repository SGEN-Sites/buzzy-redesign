// images.mjs - image registry + WebP variants (FOUNDATION). Node builtins + cwebp/webpmux on PATH.
//  - every file in assets/generated/ (.png cut-outs with alpha, .jpg backdrops) becomes WebP variants at a few widths
//    (never upscaled), written to <out>/assets/img/<id>-<w>.webp. cwebp keeps alpha by default (-alpha_q 90).
//  - variants are cached in tmp/img-cache keyed by source size+mtime, so a rebuild only copies.
//  - generated variants get tools/ai-label.xmp attached with webpmux (cwebp -metadata none strips metadata), when
//    webpmux is available; the <img> carries data-ai="generated" either way.
//  - img()/picture()/cutout() throw on an unknown id or a missing photo file: build.mjs turns that into exit 1.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT } from './paths.mjs';

const GEN_DIR = 'assets/generated';
const CACHE = path.join(ROOT, 'tmp/img-cache');
const CUT_WIDTHS = [240, 400, 640, 960, 1400];
const BACK_WIDTHS = [640, 960, 1440, 1920, 2560];

/** width/height of a PNG, JPEG or WebP buffer, or null */
export function imageSize(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  }
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const c = b.toString('ascii', 12, 16);
    if (c === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (c === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (c === 'VP8L') { const n = b.readUInt32LE(21); return { w: 1 + (n & 0x3fff), h: 1 + ((n >> 14) & 0x3fff) }; }
  }
  return null;
}

const registry = new Map(); // id -> { id, file, w, h, alt, ai, cut, variants: [{ w, url, cache }] }
const errors = [];
export const imageErrors = () => errors.slice();

function planAlts() {
  const p = path.join(ROOT, 'src/content/image-plan.json');
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const im of JSON.parse(fs.readFileSync(p, 'utf8')).images || []) if (im.file) out[path.basename(im.file).replace(/\.\w+$/, '')] = im.alt || '';
  return out;
}

/** scan assets/generated and plan the variants (nothing is encoded yet) */
export function scanGenerated() {
  const alts = planAlts();
  const dir = path.join(ROOT, GEN_DIR);
  for (const f of fs.readdirSync(dir).filter((x) => /\.(png|jpe?g)$/i.test(x)).sort()) {
    const file = path.join(dir, f);
    const st = fs.statSync(file);
    const size = imageSize(fs.readFileSync(file));
    if (!size) { errors.push('cannot read image size: ' + GEN_DIR + '/' + f); continue; }
    const id = f.replace(/\.\w+$/, '');
    const cut = /\.png$/i.test(f);
    const widths = [...new Set((cut ? CUT_WIDTHS : BACK_WIDTHS).map((w) => Math.min(w, size.w)))];
    const key = st.size.toString(36) + Math.floor(st.mtimeMs).toString(36);
    registry.set(id, {
      id, file, ...size, cut, ai: true, alt: alts[id] || '',
      variants: widths.map((w) => ({ w, url: `/assets/img/${id}-${w}.webp`, cache: path.join(CACHE, `${id}-${w}-${key}.webp`) })),
    });
  }
  scanPhotos();
  return registry;
}

// Client photos (assets/photos/*.webp|jpg|png) get WebP variants too, so a phone never downloads the 1800 px file:
// /assets/img/p-<name>-<w>.webp, widths below. They are photographs, so they carry NO AI label (ai: false). The
// original file still ships under /assets/photos/ for any direct reference (video posters, preloads).
const PHOTO_WIDTHS = [480, 800, 1200, 1800];
const photos = new Map(); // '/assets/photos/<file>' -> registry entry
// Subfolders are scanned too (assets/photos/uf/, assets/photos/menu/): the variant id flattens the relative path.
function listPhotos(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...listPhotos(dir, r));
    else if (/\.(webp|png|jpe?g)$/i.test(e.name)) out.push(r);
  }
  return out.sort();
}
function scanPhotos() {
  const dir = path.join(ROOT, 'assets/photos');
  if (!fs.existsSync(dir)) return;
  for (const f of listPhotos(dir)) {
    const file = path.join(dir, f);
    const st = fs.statSync(file);
    const size = imageSize(fs.readFileSync(file));
    if (!size) { errors.push('cannot read image size: assets/photos/' + f); continue; }
    let id = 'p-' + f.replace(/\.\w+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-');
    // vendor CDN names (base64 JSON, 150+ chars) overflow Windows' 260-char path limit in tmp/img-cache: hash them
    if (id.length > 64) id = 'p-' + id.slice(2, 20) + '-' + crypto.createHash('sha1').update(f).digest('hex').slice(0, 10);
    // two files that differ only by extension (uf/Picture3.png + uf/Picture3.webp) must not share an id
    if (registry.has(id)) id += '-' + f.split('.').pop().toLowerCase();
    const widths = [...new Set(PHOTO_WIDTHS.map((w) => Math.min(w, size.w)))];
    const key = st.size.toString(36) + Math.floor(st.mtimeMs).toString(36);
    const entry = { id, file, ...size, cut: false, ai: false, photo: true, alt: '', variants: widths.map((w) => ({ w, url: `/assets/img/${id}-${w}.webp`, cache: path.join(CACHE, `${id}-${w}-${key}.webp`) })) };
    registry.set(id, entry);
    photos.set('/assets/photos/' + f, entry);
  }
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => resolve({ code: -1, err: String(e) }));
    p.on('close', (code) => resolve({ code, err }));
  });
}

/** encode missing variants into the cache (worker pool), then copy every variant into <out>/assets/img */
export async function writeVariants(outDir, { log = console.log } = {}) {
  fs.mkdirSync(CACHE, { recursive: true });
  const xmp = path.join(ROOT, 'tools/ai-label.xmp');
  const hasMux = fs.existsSync(xmp) && spawnSync('webpmux', ['-version']).status === 0;
  const jobs = [];
  for (const im of registry.values()) for (const v of im.variants) if (!fs.existsSync(v.cache)) jobs.push({ im, v });
  if (jobs.length) log(`images: encoding ${jobs.length} WebP variants (cached afterwards)`);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const { im, v } = jobs[next++];
      const tmp = v.cache + '.' + process.pid + '.tmp.webp';
      const resize = v.w < im.w ? ['-resize', String(v.w), '0'] : [];
      const q = im.cut ? ['-q', '82', '-alpha_q', '90', '-exact'] : ['-q', '78'];
      const r = await run('cwebp', ['-quiet', '-m', '5', '-metadata', 'none', ...q, ...resize, im.file, '-o', tmp]);
      if (r.code !== 0) { errors.push(`cwebp failed for ${im.id}@${v.w}: ${r.err.trim().slice(0, 200)}`); continue; }
      if (hasMux && im.ai) {
        const m = await run('webpmux', ['-set', 'xmp', xmp, tmp, '-o', v.cache]);
        if (m.code === 0) { fs.rmSync(tmp, { force: true }); continue; }
      }
      // Parallel lane builds share this cache: on Windows a rename onto a file another build just wrote (or holds
      // open) fails with EPERM/EBUSY/EEXIST. The other build produced the same variant from the same input, so keep
      // theirs and drop ours.
      try { fs.renameSync(tmp, v.cache); } catch (e) {
        if (!['EPERM', 'EBUSY', 'EEXIST', 'EACCES'].includes(e.code) || !fs.existsSync(v.cache)) throw e;
        fs.rmSync(tmp, { force: true });
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  const dst = path.join(outDir, 'assets/img');
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const im of registry.values()) for (const v of im.variants) if (fs.existsSync(v.cache)) { fs.copyFileSync(v.cache, path.join(dst, path.basename(v.url))); n++; }
  return { encoded: jobs.length, copied: n, labelled: hasMux };
}

const escA = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attrStr = (o = {}) => Object.entries(o).filter(([, v]) => v !== false && v != null).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escA(v)}"`)).join('');

/** resolve a local root-absolute asset path ("/assets/photos/x.webp") to its source file, or record an error */
export function assetFile(url) {
  const rel = String(url).replace(/^\//, '').split(/[?#]/)[0];
  const file = path.join(ROOT, rel);
  if (!rel.startsWith('assets/') || !fs.existsSync(file)) { errors.push('missing image: ' + url); return null; }
  return file;
}

/** true when assets/generated holds this id (no error recorded) */
export const hasGenerated = (id) => registry.has(id);

/** look up a generated image by id ("cut-bud"); throws on an unknown id */
export function generated(id) {
  const im = registry.get(id);
  if (!im) { errors.push('missing image: unknown generated id "' + id + '"'); throw new Error('missing image: ' + id); }
  return im;
}

/**
 * <img> for a generated id ("cut-bud", "g-hero") or a photo object { src, w, h, alt } (root-absolute src under /assets/).
 * opts: alt (defaults to the image plan alt for generated, photo.alt for photos; pass "" for decorative),
 *       sizes (CSS sizes, default "100vw"), cls, eager (true = loading eager + fetchpriority high), attrs {}.
 */
export function img(ref, opts = {}) {
  const { sizes = '100vw', cls, eager = false, attrs = {} } = opts;
  const lazy = eager ? { loading: 'eager', fetchpriority: 'high' } : { loading: 'lazy' };
  if (typeof ref === 'string' && !ref.startsWith('/')) {
    const im = generated(ref);
    const big = im.variants[im.variants.length - 1];
    const alt = opts.alt != null ? opts.alt : im.alt;
    return `<img${attrStr({ class: cls, src: im.variants.find((v) => v.w >= 960)?.url || big.url, srcset: im.variants.map((v) => `${v.url} ${v.w}w`).join(', '), sizes, width: im.w, height: im.h, alt, decoding: 'async', ...lazy, 'data-ai': 'generated', ...attrs })}>`;
  }
  const p = typeof ref === 'string' ? { src: ref } : ref || {};
  if (!p.src) { errors.push('missing image: empty photo reference'); throw new Error('missing image: empty photo reference'); }
  const ph = photos.get(String(p.src).split(/[?#]/)[0]);
  if (ph) {
    const alt = opts.alt != null ? opts.alt : p.alt || '';
    return `<img${attrStr({ class: cls, src: ph.variants.find((v) => v.w >= 800)?.url || ph.variants[ph.variants.length - 1].url, srcset: ph.variants.map((v) => `${v.url} ${v.w}w`).join(', '), sizes, width: ph.w, height: ph.h, alt, decoding: 'async', ...lazy, ...attrs })}>`;
  }
  const file = assetFile(p.src);
  if (!file) throw new Error('missing image: ' + p.src);
  let { w, h } = p;
  if (!w || !h) { const s = imageSize(fs.readFileSync(file)); if (s) ({ w, h } = s); }
  const alt = opts.alt != null ? opts.alt : p.alt || '';
  return `<img${attrStr({ class: cls, src: p.src, width: w, height: h, alt, decoding: 'async', ...lazy, ...attrs })}>`;
}

/** <picture class="..."> wrapper around img() (same args; opts.pictureCls for the wrapper) */
export function picture(ref, opts = {}) {
  return `<picture${attrStr({ class: opts.pictureCls })}>${img(ref, opts)}</picture>`;
}

/** url of the variant closest to a width (for CSS backgrounds / posters) */
export function imgUrl(id, width = 1920) {
  const im = generated(id);
  return (im.variants.find((v) => v.w >= width) || im.variants[im.variants.length - 1]).url;
}
