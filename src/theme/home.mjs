// home.mjs - BUZZY home "/" (HOME lane, "DREAM INVENTORY"). Section order = contract section 6 HOME:
//   1 hero on the dream sky (+ loop, bud cut-out protruding, glass Delivery + Pickup pair)  2 category tiles
//   3 brand promo slider  4 FEATURED Cannabis vitrine + yellow ticker  5 delivery showcase (site.json delivery words)
//   6 rewards on NIGHT  7 upcoming events  8 news & education  9 visit band.
// Every captured word of src/content/pages/home.json is rendered: each captured section is CLAIMED by a matcher and
// laid out by its own renderer; every block a renderer does not place is printed by the generic block renderer at the
// end of that section, and an unclaimed section is printed right after the claimed section it followed live.
// Facts come from ctx.site verbatim; new words are neutral glue only (kickers, labels, alt text). No inline JS; root-
// absolute URLs only in HTML attributes (D6).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/paths.mjs';
import * as shell from './shell.mjs';
import { esc, escA, linkAttrs, gimg, img, menu, rewriteLinks, liveHref, stripTags, localPhoto, absUrl, slugify } from './util.mjs';

const MISSING_OK = process.env.ALLOW_MISSING_GEN === '1';
// "upcoming" is measured against the capture day (the home snapshot was taken 2026-11-05); BUILD_TODAY overrides
const TODAY = process.env.BUILD_TODAY || '2026-11-05';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const ico = (n, c = '') => (typeof shell.icon === 'function' ? shell.icon(n, c) : '');
const norm = (s) => stripTags(String(s ?? '')).replace(/&amp;/g, '&').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
const textOf = (b) => String((b && (b.text ?? b.title ?? b.html)) || '');
const isHead = (b) => b && /^h[1-6]$/.test(b.type);
const pad2 = (n) => String(n).padStart(2, '0');
const rich = (html) => rewriteLinks(String(html ?? '')).replace(/<a\b([^>]*?)\shref="(https?:\/\/[^"]+)"([^>]*)>/gi, (m, a, u, b) => (/\btarget=/.test(m) ? m : `<a${a} href="${u}"${b} target="_blank" rel="noopener">`));
const htmlOf = (b) => (b.html != null ? rich(b.html) : esc(b.text ?? b.title ?? ''));
const plain = (b) => stripTags(textOf(b)).replace(/\s+/g, ' ').trim();
const kicker = (t, cls = '') => `<p class="kicker${cls ? ' ' + cls : ''}">${esc(t)}</p>`;
const extIco = (u) => (/^https?:/i.test(String(u)) ? ico('ext', 'ico--ext') : '');
// ia.json is not dash-normalised at load: a range dash becomes " to " (D2)
const undash = (s) => String(s ?? '').replace(/\s*[‒-―]\s*/g, ' to ');
// "8am" -> "08:00", "10pm" -> "22:00" (JSON-LD hours from site.json, never invented)
const hhmm = (t) => { const m = String(t || '').match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m/i); if (!m) return null; let h = +m[1] % 12; if (/p/i.test(m[3])) h += 12; return pad2(h) + ':' + (m[2] || '00'); };
// one lowercase serif accent word per heading (contract section 3 Type)
const accent = (t, re) => { const e = esc(t); if (!re) return e; let done = false; return e.replace(re, (m) => (done ? m : ((done = true), `<em class="accent">${m}</em>`))); };

// ---------- BUZZY photos: the captured live URL resolved to CAPTURE's local copy (facts/asset-map.json) ----------
const fileExists = (u) => { try { return fs.existsSync(path.join(ROOT, String(u).replace(/^\//, '').split(/[?#]/)[0])); } catch { return false; } };
// src may be a URL string or a captured image object { src, w, h, alt } (events, posts, cards)
const photoRef = (src) => { if (src && typeof src === 'object') src = src.src; if (!src) return null; const r = localPhoto(src); return r && fileExists(r.src) ? r : null; };
const slot = (cls, alt = '') => `<span class="img-slot ${cls || ''}" role="img" aria-label="${escA(alt)}"></span>`;
function bz(src, opts = {}, fallbackGen = null) {
  const r = photoRef(src);
  if (r) return img({ src: r.src, w: r.w, h: r.h, alt: opts.alt ?? '' }, opts);
  if (fallbackGen) return gimg(fallbackGen, opts);
  return MISSING_OK ? slot(opts.cls, opts.alt) : '';
}
// the first local file whose live name matches (asset-map sources), e.g. the exterior banner or the phone mockup
let ASSETS = null;
function findPhoto(re) {
  if (!ASSETS) {
    ASSETS = [];
    try { for (const im of JSON.parse(fs.readFileSync(path.join(ROOT, 'facts/asset-map.json'), 'utf8')).images || []) ASSETS.push(im); } catch { /* not captured yet */ }
  }
  const hit = ASSETS.find((im) => [im.file, ...(im.sources || [])].some((s) => re.test(String(s || ''))));
  if (!hit) return null;
  const src = '/' + String(hit.file).replace(/^\/?/, '');
  return fileExists(src) ? { src, w: hit.w, h: hit.h } : null;
}
const bzFound = (re, opts = {}, fallbackGen = null) => { const r = findPhoto(re); return r ? img({ ...r, alt: opts.alt ?? '' }, opts) : fallbackGen ? gimg(fallbackGen, opts) : MISSING_OK ? slot(opts.cls, opts.alt) : ''; };

// ---------- the generic block renderer (contract section 4 block shapes) ----------
function block(ctx, b) {
  switch (b.type) {
    case 'p': return `<p>${htmlOf(b)}</p>`;
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': return `<h3 class="h-sub">${b.html != null ? rich(b.html) : esc(b.text)}</h3>`;
    case 'ul': case 'ol': return `<${b.type} class="h-list">${(b.items || []).map((it) => `<li>${typeof it === 'string' ? rich(it) : htmlOf(it)}</li>`).join('')}</${b.type}>`;
    case 'img': { const im = bz(b.src, { cls: 'h-fig__img', alt: b.alt || '', sizes: '(max-width: 720px) 92vw, 480px' }); return im ? `<figure class="h-fig">${b.href ? `<a${linkAttrs(liveHref(b.href))}>${im}</a>` : im}</figure>` : ''; }
    case 'button': { const u = b.href ? liveHref(b.href) : menu(ctx); return `<p class="btn-row"><a class="btn btn--ghost"${linkAttrs(u)}>${esc(b.text)}${extIco(u)}</a></p>`; }
    case 'quote': return `<blockquote class="h-quote">${htmlOf(b)}</blockquote>`;
    case 'faq': return `<div class="faq">${(b.items || []).map((it) => `<details><summary>${esc(it.q)}</summary><div class="prose">${rich(it.a_html || '')}</div></details>`).join('')}</div>`;
    case 'icon-box': return `<p class="h-ibox">${b.title ? `<strong>${esc(b.title)}</strong> ` : ''}${rich(b.html || '')}</p>`;
    case 'table': return `<table class="h-table"><tbody>${(b.rows || []).map((r) => `<tr>${(Array.isArray(r) ? r : Object.values(r)).map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    case 'hours': return `<dl class="hours spec">${(b.rows || []).map((r) => (Array.isArray(r) ? r : Object.values(r))).map((c) => `<div class="spec__row"><dt>${esc(c[0])}</dt><dd>${esc(c.slice(1).join(' '))}</dd></div>`).join('')}</dl>`;
    case 'steps': return `<ol class="steps">${(b.items || []).map((s) => `<li class="step"><span class="step__num">${esc(s.num || '')}</span><span class="step__title">${esc(s.title || '')}</span><span class="step__text">${esc(s.text || '')}</span></li>`).join('')}</ol>`;
    case 'cards': return `<ul class="h-list">${(b.items || []).map((c) => `<li>${c.title ? `<strong>${c.href ? `<a${linkAttrs(liveHref(c.href))}>${esc(c.title)}</a>` : esc(c.title)}</strong> ` : ''}${c.html ? rich(c.html) : ''}${c.label ? ` ${esc(c.label)}` : ''}</li>`).join('')}</ul>`;
    case 'embed': return b.src && /^https?:/i.test(b.src) && !/\.js(\?|$)/i.test(b.src) ?`<p><a class="link-arrow"${linkAttrs(b.src)}>${esc(b.note || 'Open')}${ico('arrow')}</a></p>` : b.note ? `<p>${esc(b.note)}</p>` : '';
    case 'form': return '';
    case 'video': return '';
    default: return b.html ? `<div>${rich(b.html)}</div>` : b.text ? `<p>${esc(b.text)}</p>` : '';
  }
}
const blocksHtml = (ctx, list) => list.map((b) => block(ctx, b)).filter(Boolean).join('\n');

// ---------- section bookkeeping ----------
function makeSec(s) {
  const used = new Set();
  const blocks = (s && s.blocks) || [];
  const heading = String((s && s.heading) || '').trim();
  for (const b of blocks) if (heading && isHead(b) && norm(b.text) === norm(heading)) used.add(b);
  return {
    s, heading, blocks,
    take(pred) { const b = blocks.find((x) => !used.has(x) && pred(x)); if (b) used.add(b); return b || null; },
    takeAll(pred) { const out = blocks.filter((x) => !used.has(x) && pred(x)); out.forEach((x) => used.add(x)); return out; },
    use(b) { if (b) used.add(b); return b; },
    rest() { return blocks.filter((x) => !used.has(x)); },
    head() { if (heading) return heading; const b = this.take((x) => /^h[1-3]$/.test(x.type)); return b ? b.text : ''; },
  };
}
const leftovers = (ctx, S) => { const r = S ? S.rest() : []; if (S) S.takeAll(() => true); return r.length ? `<div class="h-extra prose">${blocksHtml(ctx, r)}</div>` : ''; };
const sectionText = (s) => norm([s.heading, ...(s.blocks || []).map((b) => [textOf(b), ...((b.items || []).map((it) => (typeof it === 'string' ? it : [it.title, it.html, it.q].join(' '))))].join(' '))].join(' | '));

// slides / tiles / cards: a group opens at a title (a heading, or the first text after a finished group), takes its
// lines and its button; an image belongs to the group it sits in or the next one when it comes before a title
function groupsOf(blocks) {
  const out = [];
  let cur = null;
  let pend = [];
  const open = () => { cur = { title: null, lines: [], btn: null, imgs: [], blocks: [] }; out.push(cur); };
  const flush = () => { if (cur && pend.length) { cur.imgs.push(...pend); cur.blocks.push(...pend); pend = []; } };
  for (const b of blocks) {
    if (b.type === 'img') { pend.push(b); continue; }
    if (b.type === 'button') { if (!cur || cur.btn) open(); cur.btn = b; cur.blocks.push(b); flush(); continue; }
    if (!cur || cur.btn || (isHead(b) && cur.title)) open();
    if (!cur.title) cur.title = b; else cur.lines.push(b);
    cur.blocks.push(b);
    flush();
  }
  if (pend.length && !cur) open();
  flush();
  return out;
}

// a captured `cards` block as flat blocks (image, title, line, button) so groupsOf() can lay out tiles and slides
const expand = (b) => (b.type !== 'cards' ? [b] : (b.items || []).flatMap((it) => [
  it.img && it.img.src ? { type: 'img', src: it.img.src, alt: it.img.alt || '', w: it.img.w, h: it.img.h } : null,
  it.title ? { type: 'h3', text: it.title } : null,
  it.html ? { type: 'p', html: it.html } : null,
  it.label ? { type: 'button', text: it.label, href: it.href } : null,
].filter(Boolean)));

// ---------- events and posts ----------
const evDate = (e) => { const m = String((e && e.startISO) || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? { mon: MONTHS[+m[2] - 1], day: m[3], key: m[1] + '-' + m[2] + '-' + m[3] } : null; };
function upcoming(ctx, n) {
  const all = (ctx.events || []).filter(evDate);
  const up = all.filter((e) => evDate(e).key >= TODAY).sort((a, b) => String(a.startISO).localeCompare(String(b.startISO)));
  const past = all.filter((e) => evDate(e).key < TODAY);
  return up.concat(past).slice(0, n);
}
// the captured events widget as a list: NOV / 05 / BRAND POP-UPS / 4-7PM / TITLE / venue (one block each)
function capturedEvents(S) {
  if (!S) return [];
  const out = [];
  let cur = null;
  for (const b of S.rest()) {
    if (b.type === 'button' || b.type === 'img') continue;
    const t = plain(b);
    if (MONTHS.includes(t.toUpperCase())) { cur = { mon: b, parts: [] }; out.push(cur); S.use(b); continue; }
    if (!cur) continue;
    if (!cur.day && /^\d{1,2}$/.test(t)) cur.day = b;
    else if (!cur.cat && /pop-?ups?|events?$/i.test(t) && t === t.toUpperCase() && !cur.title) cur.cat = b;
    else if (!cur.time && /\d.*[ap]\.?m/i.test(t) && t.length < 24) cur.time = b;
    else if (!cur.title) cur.title = b;
    else if (!cur.venue) cur.venue = b;
    else continue;
    S.use(b);
  }
  return out;
}
const sameTitle = (a, b) => { const x = norm(a).replace(/\s*\|\s*buzzy$/, ''); const y = norm(b).replace(/\s*\|\s*buzzy$/, ''); return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x)); };

// ---------- the dev aid: words of home.json missing from the rendered <main> (tools/words-check.mjs logic) ----------
const wordsOf = (txt) => String(txt).replace(/<[^>]+>/g, ' ').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&').replace(/&[a-z]+;/gi, ' ').toLowerCase().replace(/[‘’‛']/g, '').normalize('NFKD').replace(/[^a-z0-9$%]+/g, ' ').split(' ').filter(Boolean);

export async function render(ctx) {
  const site = ctx.site;
  const ia = ctx.ia || {};
  const home = (ctx.content && ctx.content.home) || null;
  if (!home) console.warn('warning: home: src/content/pages/home.json not captured yet, rendering the site.json skeleton');
  const secs = (home && home.sections) || [];
  const claimed = new Map();
  const claim = (key, test) => { const s = secs.find((x) => !claimed.has(x) && test(x)); if (s) claimed.set(s, key); return s ? makeSec(s) : null; };
  const addr = site.address || {};
  const cats = ((ia.nav || []).find((n) => n.href === '/products/') || {}).children || [];
  const catByLabel = new Map(cats.map((c) => [norm(c.label), c]));
  const loop = ((ctx.images && ctx.images.media) || {})['hero-bridges'] || null;
  const D = site.delivery || {};
  const R = site.rewards || {};
  const html = {};
  const heroImgs = [];

  // ---------- claim the captured sections (most specific first) ----------
  const h1Text = String((home && home.h1) || 'Highly Curated Cannabis in Brooklyn').trim();
  const S = {};
  S.hero = claim('hero', (x) => sectionText(x).includes(norm(h1Text)));
  S.featured = claim('featured', (x) => /featured cannabis/.test(sectionText(x)));
  S.rewards = claim('rewards', (x) => /rewards program|sign up for rewards/.test(sectionText(x)));
  S.events = claim('events', (x) => /upcoming buzzy events/.test(sectionText(x)));
  S.news = claim('news', (x) => /cannabis news|more articles/.test(sectionText(x)));
  S.cats = claim('cats', (x) => cats.filter((c) => new RegExp('\\b' + norm(c.label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(sectionText(x))).length >= 5);
  const BRAND_RE = /\b(bingo|eaton|ruby farms|jaunty|wizard trees|umamii|ithaca|puffco)\b/;
  const brandSecs = [];
  for (let s; (s = claim('brands', (x) => BRAND_RE.test(sectionText(x)))); ) brandSecs.push(s);
  if (!S.hero && secs[0] && !claimed.has(secs[0])) { claimed.set(secs[0], 'hero'); S.hero = makeSec(secs[0]); }

  // ============================================================ 1. hero
  {
    const H = S.hero;
    if (H) H.take((b) => isHead(b) && norm(b.text) === norm(h1Text));
    const kick = H && H.take((b) => /neighborhood dispensary/i.test(plain(b)));
    const intro = H ? H.takeAll((b) => b.type === 'p') : [];
    const btns = H ? H.takeAll((b) => b.type === 'button') : [];
    const shop = btns.find((b) => /shop/i.test(b.text)) || { text: (site.pickup && site.pickup.cta) || 'Shop Now' };
    const visit = btns.find((b) => /visit/i.test(b.text)) || { text: 'Visit BUZZY', href: '/visit-us/' };
    const otherBtns = btns.filter((b) => b !== shop && b !== visit);
    if (H) heroImgs.push(...H.takeAll((b) => b.type === 'img')); // BUZZY's live hero photo: framed in the visit band (9)
    const video = loop && loop.mp4
      ? `<video class="h-hero__loop" id="h-hero-loop" data-inview-play data-after-load muted loop playsinline preload="none" width="${escA(loop.w || 1920)}" height="${escA(loop.h || 1080)}" aria-hidden="true" tabindex="-1">${loop.mp4Small ? `<source src="${escA(loop.mp4Small)}" type="video/mp4" media="(max-width: 720px)">` : ''}${loop.mp4Hd ? `<source src="${escA(loop.mp4Hd)}" type="video/mp4" media="(min-width: 1921px), (min-width: 1100px) and (min-resolution: 1.6dppx)">` : ''}<source src="${escA(loop.mp4)}" type="video/mp4"></video>`
      : '';
    const pair = typeof shell.serviceCards === 'function' ? shell.serviceCards(ctx, { h: 2, compact: true, reveal: true, cls: 'h-hero__pair' }) : '';
    html.hero = `<section class="h-hero band band--sky" id="h-hero" aria-labelledby="h-hero-h1" data-video-host>
<div class="band__clip h-hero__clip" aria-hidden="true">
<div class="h-hero__stage">
${loop && loop.poster
  ? `<picture>${loop.posterSmall ? `<source media="(max-width: 720px)" srcset="${escA(loop.posterSmall)}" type="image/webp">` : ''}${loop.posterSmallJpg ? `<source media="(max-width: 720px)" srcset="${escA(loop.posterSmallJpg)}" type="image/jpeg">` : ''}<source srcset="${escA(loop.poster)}" type="image/webp"><img class="h-hero__still" src="${escA(loop.posterJpg || loop.poster)}" alt="" width="${escA(loop.w || 1920)}" height="${escA(loop.h || 1080)}" fetchpriority="high" decoding="async"></picture>`
  : gimg('g-hero-dream', { alt: '', eager: true, cls: 'h-hero__still', sizes: '100vw' })}
${video}
</div>
</div>
<div class="wrap wrap--wide h-hero__inner">
<div class="h-hero__copy glass">
<p class="kicker h-hero__kicker" data-reveal>${esc(kick ? plain(kick) : site.kicker || 'Your Neighborhood Dispensary')}</p>
<h1 id="h-hero-h1" class="display h-hero__h1" data-reveal style="--i:1">${accent(h1Text, /curated/i)}</h1>
${intro.map((b, i) => `<p class="lede h-hero__lede" data-reveal style="--i:${2 + i}">${htmlOf(b)}</p>`).join('\n') || `<p class="lede h-hero__lede" data-reveal style="--i:2">${esc((site.pickup && site.pickup.line) || '')}</p>`}
<div class="btn-row h-hero__ctas" data-reveal style="--i:3">
<a class="btn btn--signal h-hero__cta"${linkAttrs(menu(ctx))}>${ico('bag')}${esc(shop.text)}${extIco(menu(ctx))}</a>
<a class="btn btn--ghost h-hero__cta"${linkAttrs(visit.href ? liveHref(visit.href) : '/visit-us/')}>${ico('pin')}${esc(visit.text)}</a>
${otherBtns.map((b) => `<a class="btn btn--ghost h-hero__cta"${linkAttrs(b.href ? liveHref(b.href) : menu(ctx))}>${esc(b.text)}</a>`).join('')}
</div>
${leftovers(ctx, H)}
</div>
${video ? `<div class="h-hero__ctrl"><button class="btn btn--glass btn--sm h-hero__toggle" type="button" data-video-toggle aria-controls="h-hero-loop" aria-pressed="false">${ico('minus', 'h-hero__pause-ico')}<span class="video-toggle__label">Pause motion</span></button></div>` : ''}
<div class="h-hero__side">${pair}</div>
</div>
<div class="h-hero__bud protrude" aria-hidden="true"><div class="h-hero__bud-in"><div data-float>${gimg('g-bud-cut', { alt: '', cls: 'cut h-hero__bud-img', sizes: '(max-width: 720px) 120px, 240px' })}</div></div></div>
</section>`;
  }

  // ============================================================ 2. the 8 category tiles (BUZZY's pictograms)
  {
    const C = S.cats;
    let tiles = [];
    const catExtra = [];
    if (C) {
      const raw = C.rest();
      C.takeAll(() => true);
      for (const g of groupsOf(raw.flatMap(expand))) {
        if (!g.title || !catByLabel.has(norm(plain(g.title)))) { catExtra.push(...g.blocks); continue; }
        const cta = g.btn || g.lines.find((b) => /click here/i.test(plain(b)));
        tiles.push({ cat: catByLabel.get(norm(plain(g.title))), label: plain(g.title), cta: cta ? plain(cta) : '', icon: g.imgs[0] || null, extra: g.lines.filter((b) => b !== cta) });
      }
    }
    if (!tiles.length) tiles = cats.map((c) => ({ cat: c, label: c.label, cta: '', icon: null, extra: [] }));
    const tile = (t, i) => {
      const pict = t.icon ? bz(t.icon.src, { alt: '', cls: 'h-tile__pict', sizes: '160px' }) : '';
      return `<li class="h-cats__item" data-reveal style="--i:${i % 4}"><a class="tile h-tile"${linkAttrs(t.cat.href)} data-tilt="4">
<span class="h-tile__num" aria-hidden="true">N° ${pad2(i + 1)}</span>
<span class="tile__media h-tile__media">${pict || gimg(t.cat.gimg, { alt: '', cls: 'h-tile__gen', sizes: '(max-width: 720px) 44vw, 280px' })}</span>
<span class="tile__title h-tile__title">${esc(t.label)}</span>
<span class="tile__cta h-tile__cta">${esc(t.cta || 'Shop ' + t.cat.label)}${ico('arrow')}</span>
${t.extra.length ? `<span class="h-tile__extra">${t.extra.map(plain).map(esc).join(' ')}</span>` : ''}
</a></li>`;
    };
    html.cats = `<section class="h-cats band band--paper" id="h-cats" aria-labelledby="h-cats-h">
<div class="band__clip" aria-hidden="true"><span class="h-cats__grid-bg"></span></div>
<div class="wrap wrap--wide">
<div class="h-head h-head--split">
<div data-reveal>${kicker('Shop by category')}<h2 class="display h-head__h" id="h-cats-h">${C && C.heading ? accent(C.heading, /curated|category/i) : `The ${'<em class="accent">curated</em>'} inventory`}</h2></div>
<p class="h-head__aside" data-reveal style="--i:1"><a class="link-arrow"${linkAttrs('/products/')}>All products${ico('arrow')}</a></p>
</div>
<ul class="h-cats__grid" role="list">
${tiles.map(tile).join('\n')}
</ul>
${catExtra.length ? `<div class="h-extra prose">${blocksHtml(ctx, catExtra)}</div>` : ''}
</div>
</section>`;
  }

  // ============================================================ 3. brand promo slider (BUZZY's banners, every line)
  {
    // the live page prints the slider twice (a desktop set and a phone set with its own lines and crops): each
    // captured cards block is one set, shown at its own breakpoint, as live
    const sets = [];
    const brandExtra = [];
    for (const B of brandSecs) {
      const raw = B.rest();
      B.takeAll(() => true);
      const loose = [];
      for (const b of raw) {
        if (b.type !== 'cards') { loose.push(b); continue; }
        const set = [];
        for (const g of groupsOf(expand(b))) (g.title ? set.push(g) : brandExtra.push(...g.blocks));
        if (set.length) sets.push(set);
      }
      if (loose.length) { const set = []; for (const g of groupsOf(loose)) (g.title ? set.push(g) : brandExtra.push(...g.blocks)); if (set.length) sets.push(set); }
    }
    if (!sets.length) sets.push([]);
    const slideHtml = (g, i, n, set) => {
      const u = g.btn && g.btn.href ? liveHref(g.btn.href) : menu(ctx);
      const banner = g.imgs[0] ? bz(g.imgs[0].src, { alt: '', cls: 'h-slide__img', sizes: set ? '92vw' : '(max-width: 1480px) 92vw, 1400px' }) : '';
      return `<li class="h-slide" data-slide aria-roledescription="slide" aria-label="${i + 1} of ${n}">
<figure class="h-slide__frame frame">${banner || gimg('g-brands', { alt: '', cls: 'h-slide__img', sizes: '92vw' })}</figure>
<div class="h-slide__card glass glass--strong" data-spot>
<span class="h-slide__num" aria-hidden="true">${pad2(i + 1)} / ${pad2(n)}</span>
<h3 class="h-slide__t">${esc(plain(g.title))}</h3>
${g.lines.map((b) => `<p class="h-slide__p">${htmlOf(b)}</p>`).join('')}
${g.btn ? `<a class="btn btn--sm h-slide__cta"${linkAttrs(u)}>${esc(g.btn.text)}${extIco(u)}</a>` : ''}
${g.imgs.slice(1).map((b) => bz(b.src, { alt: '', cls: 'h-slide__more', sizes: '240px' })).join('')}
</div>
</li>`;
    };
    const rot = (set, k) => (set.length ? `<div class="h-brands__rot h-brands__rot--${k ? 'phone' : 'wide'}${sets.length > 1 ? '' : ' h-brands__rot--all'}" data-rotator="6500" data-rotator-label="brand" role="region" aria-roledescription="carousel" aria-label="Brands at BUZZY${k ? ' (phone)' : ''}">
<ul class="h-brands__stage" role="list">
${set.map((g, i) => slideHtml(g, i, set.length, k)).join('\n')}
</ul>
<div class="h-brands__ctrl"><button class="h-brands__btn" type="button" data-rotator-prev aria-label="Previous brand">${ico('arrow', 'h-flip')}</button><div class="h-brands__dots" data-rotator-dots></div><button class="h-brands__btn" type="button" data-rotator-next aria-label="Next brand">${ico('arrow')}</button></div>
</div>` : '');
    const lead = brandSecs.map((B) => B.heading).find(Boolean);
    html.brands = `<section class="h-brands band band--fog" id="h-brands" aria-labelledby="h-brands-h">
<div class="band__clip" aria-hidden="true"><span class="h-brands__grid-bg"></span></div>
<div class="wrap wrap--wide">
<div class="h-head h-head--split">
<div data-reveal>${kicker('Brands')}<h2 class="display h-head__h" id="h-brands-h">${lead ? accent(lead, /brands?/i) : `Brands on our <em class="accent">shelves</em>`}</h2></div>
<p class="h-head__aside" data-reveal style="--i:1"><a class="link-arrow"${linkAttrs('/brands/')}>All brands${ico('arrow')}</a></p>
</div>
${sets.slice(0, 2).map((set, k) => rot(set, k)).join('\n')}
${sets.slice(2).map((set) => `<ul class="h-brands__more" role="list">${set.map((g, i) => slideHtml(g, i, set.length, 1)).join('')}</ul>`).join('')}
${brandExtra.length ? `<div class="h-extra prose">${blocksHtml(ctx, brandExtra)}</div>` : ''}
</div>
</section>`;
  }

  // ============================================================ 4. FEATURED Cannabis: the curated vitrine + ticker
  {
    const F = S.featured;
    const head = F ? F.head() || 'FEATURED Cannabis' : 'FEATURED Cannabis';
    if (F) F.take((b) => isHead(b) && norm(b.text) === norm(head));
    const ps = F ? F.takeAll((b) => b.type === 'p') : [];
    const btn = F && F.take((b) => b.type === 'button');
    const imgs = F ? F.takeAll((b) => b.type === 'img') : [];
    if (F) F.takeAll((b) => b.type === 'embed'); // BUZZY's Dutchie product carousel script: no third-party script here; the CTA opens the live menu
    const u = btn && btn.href ? liveHref(btn.href) : menu(ctx);
    const tick = [site.tagline, ...String(site.topbarLine || '').split('|')].map((x) => String(x || '').trim()).filter(Boolean);
    html.featured = `<section class="h-feat band band--sky" id="h-featured" aria-labelledby="h-feat-h">
<div class="band__clip" aria-hidden="true">${gimg('g-sky-field', { alt: '', cls: 'h-feat__sky', sizes: '100vw' })}<span class="h-feat__grid"></span></div>
<div class="wrap wrap--wide h-feat__grid-l">
<div class="h-feat__copy">
${kicker('Highly curated')}
<h2 class="display display--mega h-feat__h" id="h-feat-h" data-reveal>${accent(head, /cannabis/i)}</h2>
${ps.map((b, i) => `<p class="lede h-feat__p" data-reveal style="--i:${i + 1}">${htmlOf(b)}</p>`).join('')}
<p class="btn-row h-feat__ctas" data-reveal style="--i:3">${btn ? `<a class="btn"${linkAttrs(u)}>${esc(btn.text)}${extIco(u)}</a>` : ''}<a class="btn btn--ghost"${linkAttrs('/products/')}>Browse categories</a></p>
<dl class="spec h-feat__spec" data-reveal style="--i:4">${cats.slice(0, 4).map((c, i) => `<div class="spec__row"><dt>SKU / ${esc(c.label.toUpperCase())}</dt><dd><a${linkAttrs(c.href)}>N° ${pad2(i + 1)}</a></dd></div>`).join('')}</dl>
</div>
<div class="h-feat__stage">
<figure class="h-feat__vitrine glass" data-reveal style="--i:2" data-tilt="3" data-spot>
<span class="h-feat__reg h-feat__reg--tl" aria-hidden="true"></span><span class="h-feat__reg h-feat__reg--br" aria-hidden="true"></span>
<span class="h-feat__media">${imgs.length ? bz(imgs[0].src, { alt: imgs[0].alt || '', sizes: '(max-width: 720px) 80vw, 460px' }, 'g-vitrine') : gimg('g-vitrine', { alt: '', sizes: '(max-width: 720px) 80vw, 460px' })}</span>
<figcaption class="h-feat__cap"><span class="tag tag--ink">Featured</span><span class="h-feat__capt">Handpicked</span></figcaption>
</figure>
<div class="h-feat__cloud" aria-hidden="true"><div data-depth="0.12"><div data-float>${gimg('g-cloud-cut', { alt: '', cls: 'cut', sizes: '(max-width: 720px) 160px, 320px' })}</div></div></div>
</div>
${leftovers(ctx, F)}
</div>
</section>
<div class="ticker h-ticker band--signal" data-marquee aria-label="BUZZY">
<ul class="h-ticker__list" role="list">${[...tick, ...tick].map((t) => `<li class="h-ticker__item"><span class="h-ticker__box" aria-hidden="true"></span>${esc(t.toUpperCase())}</li>`).join('')}</ul>
</div>`;
  }

  // ============================================================ 5. delivery showcase (site.json delivery, verbatim)
  {
    const areas = (ctx.delivery || []).length ? ctx.delivery : [];
    const chipFor = (name) => { const d = areas.find((x) => norm(x.name || x.title).includes(norm(name)) || norm(x.slug || '') === slugify(name)); const nav = ((ia.nav || []).find((n) => /neighborhood/i.test(n.label)) || {}).children || []; const c = nav.find((x) => norm(x.label) === norm(name)); return (d && d.path) || (c && c.href) || '/cannabis-delivery-brooklyn/'; };
    html.delivery = `<section class="h-deliv band band--sky" id="h-delivery" aria-labelledby="h-deliv-h">
<div class="band__clip" aria-hidden="true">${gimg('g-delivery-dream', { alt: '', cls: 'h-deliv__bg', sizes: '100vw' })}<span class="h-deliv__veil"></span></div>
<div class="wrap wrap--wide">
<div class="h-deliv__top">
<div class="h-deliv__panel glass glass--strong" data-reveal data-spot>
<p class="kicker">Same-day delivery</p>
<h2 class="display h-deliv__h" id="h-deliv-h">${accent(D.headline || 'Delivery', /same-day/i)}</h2>
<p class="lede h-deliv__lede">${esc(D.lede || '')}</p>
<p class="h-deliv__line"><span class="tag tag--ink">${ico('truck')}BUZZY</span><span>${esc(site.deliveryLine || '')}</span></p>
<p class="btn-row h-deliv__ctas"><a class="btn btn--signal"${linkAttrs(menu(ctx))}>${ico('truck')}${esc(D.cta || 'Order for Delivery')}${extIco(menu(ctx))}</a><a class="btn btn--ghost"${linkAttrs('/cannabis-delivery-brooklyn/')}>Delivery details</a></p>
</div>
</div>
<ol class="steps h-deliv__steps" role="list">
${(D.steps || []).map(([t, x], i) => `<li class="step h-step glass" data-reveal style="--i:${i}"><span class="step__num numeral">${pad2(i + 1)}</span><span class="step__title">${esc(String(t).replace(/^\d+\.\s*/, ''))}</span><span class="step__text">${esc(x)}</span></li>`).join('\n')}
</ol>
<div class="h-deliv__areas glass" data-reveal>
<p class="h-deliv__areas-l">${ico('pin')}<span>${esc(D.neighborhoodsLine || '')}</span></p>
<ul class="h-deliv__chips" role="list">${(D.neighborhoods || []).map((n) => `<li><a class="chip"${linkAttrs(chipFor(n))}>${esc(n)}</a></li>`).join('')}</ul>
</div>
</div>
</section>`;
  }

  // ============================================================ 6. rewards on NIGHT
  {
    const W = S.rewards;
    const kick = W && W.take((b) => /rewards program/i.test(plain(b)));
    const line = W && W.take((b) => b.type === 'p' && /elevate/i.test(plain(b)));
    const btn = W && W.take((b) => b.type === 'button');
    const imgs = W ? W.takeAll((b) => b.type === 'img') : [];
    const logoB = imgs.find((b) => /rewards/i.test(b.src || '')) || null;
    const phoneB = imgs.find((b) => /phone|wallet/i.test(b.src || '')) || null;
    const u = btn && btn.href ? liveHref(btn.href) : '/rewards/';
    const logo = logoB ? bz(logoB.src, { alt: R.name || 'BUZZY Rewards', cls: 'h-rew__logo', sizes: '360px' }) : bzFound(/Buzzy_Rewards\.White/i, { alt: R.name || 'BUZZY Rewards', cls: 'h-rew__logo', sizes: '360px' });
    const phone = phoneB ? bz(phoneB.src, { alt: '', cls: 'h-rew__phone-img', sizes: '(max-width: 720px) 60vw, 420px' }) : bzFound(/PhoneWallet/i, { alt: '', cls: 'h-rew__phone-img', sizes: '(max-width: 720px) 60vw, 420px' }, 'g-rewards');
    html.rewards = `<section class="h-rew band band--night" id="h-rewards" aria-labelledby="h-rew-h">
<div class="band__clip" aria-hidden="true">${gimg('g-night-sky', { alt: '', cls: 'h-rew__bg', sizes: '100vw' })}<span class="h-rew__grid"></span></div>
<div class="wrap wrap--wide h-rew__grid-l">
<div class="h-rew__copy">
<h2 class="h-rew__h" id="h-rew-h">${logo ? `<span class="h-rew__logo-wrap">${logo}</span>` : ''}<span class="kicker h-rew__kicker">${esc(kick ? plain(kick) : R.kicker || '')}</span></h2>
<p class="lede h-rew__line" data-reveal>${line ? htmlOf(line) : esc(R.line || '')}</p>
<p class="btn-row" data-reveal style="--i:1"><a class="btn btn--signal"${linkAttrs(u)}>${ico('gift')}${esc(btn ? btn.text : R.cta || 'Rewards')}</a></p>
${leftovers(ctx, W)}
</div>
<div class="h-rew__phone protrude" data-reveal style="--i:2">${phone}</div>
</div>
</section>`;
  }

  // ============================================================ 7. upcoming events (.ecard, upcoming first)
  {
    const E = S.events;
    const head = E ? E.head() : 'Upcoming BUZZY Events';
    const evBlock = E && E.take((b) => b.type === 'cards' && (b.items || []).some((it) => it.month || it.parts));
    // the captured section also holds the news cards after their own h2: split them out for band 8
    if (E && !S.news) {
      const rest = E.rest();
      const i = rest.findIndex((b) => isHead(b) && /news|education/i.test(plain(b)));
      if (i >= 0) { const nb = rest.slice(i); nb.forEach((b) => E.use(b)); S.news = makeSec({ heading: plain(rest[i]), blocks: nb }); }
    }
    const cap = evBlock ? [] : capturedEvents(E);
    const evs = upcoming(ctx, 6);
    let cards;
    if (evBlock) {
      cards = evBlock.items.map((it) => {
        const e = (ctx.events || []).find((x) => it.eventSlug && x.slug === it.eventSlug) || (ctx.events || []).find((x) => sameTitle(x.title || x.h1, it.title)) || null;
        return { e, href: it.href, mon: it.month || '', day: it.day || '', cat: it.category || it.label || '', time: it.timeText || '', title: it.title || '', venue: it.venue || '' };
      });
    } else if (cap.length) {
      cards = cap.map((c) => {
        const e = (ctx.events || []).find((x) => c.title && sameTitle(x.title || x.h1, plain(c.title))) || null;
        return { e, mon: plain(c.mon), day: c.day ? plain(c.day) : '', cat: c.cat ? plain(c.cat) : (e && e.category) || '', time: c.time ? plain(c.time) : (e && e.timeText) || '', title: c.title ? plain(c.title) : (e && e.title) || '', venue: c.venue ? plain(c.venue) : (e && e.venue) || '' };
      });
    } else {
      cards = evs.map((e) => { const d = evDate(e); return { e, mon: d.mon, day: d.day, cat: e.category || '', time: e.timeText || '', title: e.title || e.h1 || '', venue: e.venue || '' }; });
    }
    const card = (c, i) => {
      const u = c.e ? c.e.path : c.href ? liveHref(c.href) : '/events/';
      const im = c.e && c.e.image ? bz(c.e.image, { alt: '', cls: 'h-ecard__img', sizes: '(max-width: 720px) 80vw, 400px' }, 'g-events') : gimg('g-events', { alt: '', cls: 'h-ecard__img', sizes: '(max-width: 720px) 80vw, 400px' });
      return `<li class="h-events__item" data-reveal style="--i:${i % 3}"><article class="ecard h-ecard glass--lift">
<a class="ecard__media h-ecard__media"${linkAttrs(u)} tabindex="-1" aria-hidden="true">${im}</a>
<p class="ecard__date h-ecard__date"><span class="h-ecard__mon">${esc(c.mon)}</span><span class="h-ecard__day">${esc(c.day)}</span></p>
<div class="h-ecard__body">
<p class="ecard__cat h-ecard__cat">${c.cat ? `<span class="tag tag--signal">${esc(c.cat)}</span>` : ''}${c.time ? `<span class="h-ecard__time">${ico('clock')}${esc(c.time)}</span>` : ''}</p>
<h3 class="ecard__title h-ecard__title"><a${linkAttrs(u)}>${esc(c.title)}</a></h3>
${c.venue ? `<p class="ecard__meta h-ecard__meta">${ico('pin')}${esc(c.venue)}</p>` : ''}
</div>
</article></li>`;
    };
    const btns = E ? E.takeAll((b) => b.type === 'button') : [];
    if (E) E.takeAll((b) => b.type === 'img');
    html.events = `<section class="h-events band band--paper" id="h-events" aria-labelledby="h-events-h">
<div class="wrap wrap--wide">
<div class="h-head h-head--split">
<div data-reveal>${kicker('What is on')}<h2 class="display h-head__h" id="h-events-h">${accent(head, /events/i)}</h2></div>
<p class="h-head__aside" data-reveal style="--i:1">${btns.map((b) => `<a class="btn btn--ghost btn--sm"${linkAttrs(b.href ? liveHref(b.href) : '/events/')}>${esc(b.text)}</a>`).join('')}<a class="link-arrow"${linkAttrs('/events/')}>All events${ico('arrow')}</a></p>
</div>
<ul class="h-events__grid" role="list">
${cards.map(card).join('\n')}
</ul>
${leftovers(ctx, E)}
</div>
</section>`;
  }

  // ============================================================ 8. news & education (.acard, newest 3)
  {
    const N = S.news;
    const head = N ? N.head() : 'Cannabis News & Education';
    const intro = N && N.take((b) => b.type === 'p' && /stay informed/i.test(plain(b)));
    const more = N && N.take((b) => b.type === 'button' || /more articles/i.test(plain(b)));
    // captured cards: a title (heading or link text) followed by its date line
    const capt = [];
    if (N) {
      for (const b of N.takeAll((x) => x.type === 'cards')) for (const it of b.items || []) {
        const p = (ctx.posts || []).find((x) => sameTitle(x.title, it.title) || (it.href && liveHref(it.href) === x.path)) || null;
        capt.push({ p, title: it.title || '', date: (it.meta || []).join(' '), href: it.href, img: it.img || null });
      }
      for (const g of groupsOf(N.rest())) {
        if (!g.title) continue;
        const p = (ctx.posts || []).find((x) => sameTitle(x.title, plain(g.title)) || sameTitle(x.seoTitle || '', plain(g.title)));
        g.blocks.forEach((b) => N.use(b));
        capt.push({ p, title: plain(g.title), date: g.lines.map(plain).join(' '), btn: g.btn });
      }
    }
    const list = capt.length ? capt : (ctx.posts || []).slice(0, 3).map((p) => ({ p, title: p.title, date: p.dateText || '' }));
    const card = (c, i) => {
      const u = c.p ? c.p.path : c.href ? liveHref(c.href) : '/learn/';
      const isz = { alt: '', cls: 'h-acard__img', sizes: '(max-width: 720px) 80vw, 420px' };
      const im = c.img && c.img.src && photoRef(c.img.src) ? bz(c.img.src, isz) : c.p && c.p.image ? bz(c.p.image, isz, 'g-guide') : gimg('g-guide', isz);
      const cat = c.p && c.p.categories && c.p.categories[0];
      return `<li class="h-news__item" data-reveal style="--i:${i}"><article class="acard h-acard">
<a class="acard__media h-acard__media"${linkAttrs(u)} tabindex="-1" aria-hidden="true">${im}</a>
<p class="acard__meta h-acard__meta">${cat ? `<span class="tag tag--ink">${esc(cat.name)}</span>` : ''}${c.date ? `<span>${esc(c.date)}</span>` : ''}</p>
<h3 class="acard__title h-acard__title"><a${linkAttrs(u)}>${esc(c.title)}</a></h3>
${c.btn ? `<a class="link-arrow acard__more"${linkAttrs(c.btn.href ? liveHref(c.btn.href) : u)}>${esc(c.btn.text)}${ico('arrow')}</a>` : `<span class="acard__more link-arrow" aria-hidden="true">Read${ico('arrow')}</span>`}
</article></li>`;
    };
    html.news = `<section class="h-news band band--fog" id="h-news" aria-labelledby="h-news-h">
<div class="wrap wrap--wide">
<div class="h-head h-head--split">
<div data-reveal>${kicker('The Buzzy Guide')}<h2 class="display h-head__h" id="h-news-h">${accent(head, /education/i)}</h2></div>
${intro ? `<p class="lede h-head__lede" data-reveal style="--i:1">${htmlOf(intro)}</p>` : ''}
</div>
<ul class="h-news__grid" role="list">
${list.map(card).join('\n')}
</ul>
<p class="btn-row h-news__more" data-reveal><a class="btn"${linkAttrs(more && more.href && !/news-events/.test(more.href) ? liveHref(more.href) : '/learn/')}>${esc(more ? plain(more) : 'More Articles')}${ico('arrow')}</a><a class="link-arrow"${linkAttrs('/education/')}>Education guides${ico('arrow')}</a></p>
${leftovers(ctx, N)}
</div>
</section>`;
  }

  // ============================================================ 9. visit band (site.json facts)
  {
    const addrLine = `${addr.streetShort || addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
    const vopt = { alt: (heroImgs[0] && heroImgs[0].alt) || 'BUZZY in Cobble Hill, Brooklyn', cls: 'h-visit__img', sizes: '(max-width: 720px) 88vw, 620px' };
    const ext = heroImgs[0] && photoRef(heroImgs[0].src) ? bz(heroImgs[0].src, vopt) : bzFound(/Exterior-Banner/i, vopt, 'g-visitor');
    html.visit = `<section class="h-visit band band--paper" id="h-visit" aria-labelledby="h-visit-h">
<div class="band__clip" aria-hidden="true"><span class="h-visit__grid-bg"></span></div>
<div class="wrap wrap--wide h-visit__grid">
<figure class="h-visit__frame frame frame--float" data-reveal data-depth="0.05">${ext}<figcaption class="h-visit__cap"><span class="tag tag--signal">${esc(addr.neighborhood || '')}</span><span>${esc(addr.landmark || '')}</span></figcaption></figure>
<div class="h-visit__copy">
${kicker('Visit us')}
<h2 class="display h-head__h" id="h-visit-h">Visit BUZZY on <em class="accent">court</em> Street</h2>
<dl class="spec h-visit__spec" data-reveal style="--i:1">
<div class="spec__row"><dt>Address</dt><dd>${esc(addrLine)}</dd></div>
<div class="spec__row"><dt>Landmark</dt><dd>${esc(addr.landmark || '')}</dd></div>
<div class="spec__row"><dt>Store hours</dt><dd>${esc(site.hoursLine || '')}</dd></div>
<div class="spec__row"><dt>Phone</dt><dd><a href="${escA(site.phoneHref || '')}">${esc(site.phone || '')}</a></dd></div>
<div class="spec__row"><dt>Email</dt><dd><a href="mailto:${escA(site.email || '')}">${esc(site.email || '')}</a></dd></div>
</dl>
<p class="h-visit__transit" data-reveal style="--i:2">${ico('info')}<span>${esc(site.transit || '')}</span></p>
<p class="btn-row" data-reveal style="--i:3"><a class="btn"${linkAttrs(site.mapUrl)}>${ico('pin')}${esc((ia.footer && ia.footer.directionsLabel) || 'Get Directions')}${extIco(site.mapUrl)}</a><a class="btn btn--ghost"${linkAttrs('/visit-us/')}>Visit Us</a></p>
</div>
</div>
</section>`;
  }

  // ---------- assemble in the contract order; unclaimed sections follow the claimed one they followed live ----------
  const ORDER = ['hero', 'cats', 'brands', 'featured', 'delivery', 'rewards', 'events', 'news', 'visit'];
  const after = new Map();
  let prev = 'hero';
  for (const s of secs) {
    if (claimed.has(s)) { prev = claimed.get(s); continue; }
    const S2 = makeSec(s);
    const head = S2.head();
    const out = `<section class="h-misc band band--paper"${head ? ` aria-label="${escA(head)}"` : ''}><div class="wrap wrap--narrow prose">${head ? `<h2 class="display h-head__h">${esc(head)}</h2>` : ''}${blocksHtml(ctx, S2.rest())}</div></section>`;
    after.set(prev, (after.get(prev) || '') + out);
  }
  const main = ORDER.map((k) => (html[k] || '') + (after.get(k) || '')).filter(Boolean).join('\n');

  // dev aid: report captured words the page does not carry (the gate is tools/words-check.mjs)
  if (home) {
    const src = [];
    if (home.h1) src.push(...wordsOf(home.h1));
    for (const s of secs) {
      const hd = String(s.heading || '').trim();
      if (hd && hd !== String(home.h1 || '').trim() && !(s.blocks || []).some((b) => [b.text, b.title].some((t) => typeof t === 'string' && t.trim() === hd))) src.push(...wordsOf(hd));
      for (const b of s.blocks || []) {
        if (b.type === 'h1' && String(b.text || '').trim() === String(home.h1 || '').trim()) continue;
        const parts = ['text', 'html', 'title', 'q', 'a_html', 'caption', 'cite'].map((k) => (typeof b[k] === 'string' ? b[k] : '')).concat((b.items || []).map((it) => (typeof it === 'string' ? it : [it.q, it.a_html, it.text, it.html, it.title].filter(Boolean).join(' '))), (b.rows || []).map((r) => [].concat(r).join(' ')));
        src.push(...wordsOf(parts.join(' ')));
      }
    }
    const bag = new Map();
    for (const w of wordsOf(main.replace(/<script\b[\s\S]*?<\/script>/gi, ' '))) bag.set(w, (bag.get(w) || 0) + 1);
    const miss = [];
    for (const w of src) { const n = bag.get(w) || 0; if (n > 0) bag.set(w, n - 1); else miss.push(w); }
    if (miss.length) console.warn(`warning: home: ${miss.length} captured words not on the page (raw JSON may differ by dash normalisation): ${miss.slice(0, 30).join(' ')}`);
  }

  // ---------- head: captured title + description verbatim; Store JSON-LD from site.json facts only ----------
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: site.name,
    url: site.origin + '/',
    telephone: site.phoneDigits || site.phone,
    email: site.email || undefined,
    address: { '@type': 'PostalAddress', streetAddress: addr.street, addressLocality: addr.city, addressRegion: addr.state, postalCode: addr.zip, addressCountry: 'US' },
    openingHoursSpecification: (site.hours || []).filter((h) => /every|daily/i.test(h.days) && hhmm(h.open) && hhmm(h.close)).map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: hhmm(h.open), closes: hhmm(h.close) })),
    hasMap: site.mapUrl || undefined,
    sameAs: (site.socials || []).map((x) => x.url),
  };
  const title = (home && home.title) || 'BUZZY Brooklyn Dispensary | Curated Cannabis in Cobble Hill';
  const description = (home && home.description) || `${site.name}, ${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}. ${(site.pickup && site.pickup.line) || ''}`.trim();
  const out = shell.page({
    ctx,
    path: '/',
    title,
    description,
    canonical: absUrl(ctx, '/'),
    og: { title, description, type: 'website' },
    jsonld: [ld],
    bodyClass: 'h-page',
    main,
    crumbs: [],
  });
  return [{ path: '/', html: out }];
}
