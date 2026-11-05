// pages.mjs - PAGES lane (BUZZY redesign pitch, "Dream Inventory"): /about/ /brooklyn-dispensary-faqs/ /careers/ /events/
// /events/category/<cat>/ /event/<slug>/ /brooklyn-map/ /privacy-policy/ /terms-of-service/, every ctx.content page no
// other lane owns (generic captured-page template), /404.html. (/sitemap/ is sitemap.mjs.) Captured pages print EVERY
// block of src/content/pages/<slug>.json (inline HTML as captured, every <a href> through rewriteLinks); heads keep the
// captured title and description. New words are neutral glue only. Classes: contract classes + the p- prefix.
import fs from 'node:fs';
import nodePath from 'node:path';
import * as shell from './shell.mjs';
import * as U from './util.mjs';
import { ROOT } from '../lib/paths.mjs';

const { page, crumbsHtml, icon } = shell;
const { esc, escA, linkAttrs, isExternal, gimg, img, stripTags, absUrl, menu, demoForm, slugify, localPhoto, rewriteLinks: rewrite, liveHref: live } = U;

// "upcoming" = an event starting on or after the pitch date
const TODAY = '2026-11-05';
const HOME = { href: '/', label: 'Home' };
const ABOUT = { href: '/about/', label: 'About' };
const EVENTS = { href: '/events/', label: 'Events' };

// slugs other lanes render (contract section 6); anything else in ctx.content is rendered here
const OWNED = new Set(['home', 'rewards', 'rewards-copy', 'rewards-signup-page', 'brands', 'menu', 'product', 'bingo', 'dabkitcontest26',
  'cannabis-delivery-brooklyn', 'cannabis-delivery-brooklyn-map', 'cannabis-delivery-brooklyn-nyc-rules', 'brooklyn-dispensary-for-tourists',
  'hotel-guest-landing-page', 'visit-us', 'learn']);
const MINE = new Set(['about', 'brooklyn-dispensary-faqs', 'careers', 'events', 'brooklyn-map', 'privacy-policy', 'terms-of-service']);
const isCatArchive = (slug, rec) => /^category/.test(slug) || /^\/category\//.test(String((rec && rec.path) || ''));
const isEvCat = (slug, rec) => /^events[-_]+category/.test(slug) || /^\/events\/category\//.test(String((rec && rec.path) || ''));

// ---------- small helpers ----------
const norm = (s) => stripTags(String(s ?? '')).replace(/\s+/g, ' ').trim().toLowerCase();
const kick = (t, cls = '') => (t ? `<p class="kicker ${cls}">${esc(t)}</p>` : '');
const extIcon = (u) => (isExternal(u) && !/^(tel|mailto):/i.test(u) ? icon('ext') : icon('arrow'));
const btn = (u, label, cls = '', extra = {}) => `<a class="btn ${cls}"${linkAttrs(u, extra)}>${label}</a>`;
const arrow = (u, label, cls = '') => `<a class="link-arrow ${cls}"${linkAttrs(u)}>${esc(label)}${extIcon(u)}</a>`;
const blocksOf = (rec) => (rec.sections || []).flatMap((s) => s.blocks || []);
const captured = (ctx, slug) => (ctx.content || {})[slug] || null;
const findBy = (ctx, test) => Object.entries(ctx.content || {}).find(([slug, rec]) => test(slug, rec)) || [null, null];

// a BUZZY photo: a root-absolute /assets/ path on disk, or a live upload URL CAPTURE downloaded (localPhoto); '' if neither
function photoRef(ref) {
  const r = typeof ref === 'string' ? { src: ref } : ref || {};
  const s = String(r.src || r.url || '').trim();
  if (!s) return null;
  if (s.startsWith('/assets/')) return fs.existsSync(nodePath.join(ROOT, decodeURIComponent(s.split(/[?#]/)[0]))) ? { src: s, w: r.w, h: r.h } : null;
  const hit = localPhoto(s);
  return hit && fs.existsSync(nodePath.join(ROOT, hit.src.replace(/^\//, ''))) ? hit : null;
}
const missingPhotos = new Set();
function pic(ref, opts = {}) {
  const r = typeof ref === 'string' ? { src: ref } : ref || {};
  const p = photoRef(r);
  const alt = opts.alt != null ? opts.alt : r.alt && !/^(unnamed|image)$/i.test(r.alt) ? r.alt : '';
  if (!p) { if (r.src) missingPhotos.add(r.src); return opts.fallback ? gimg(opts.fallback, { alt: '', sizes: opts.sizes, cls: opts.cls, eager: opts.eager }) : ''; }
  if (/\.gif$/i.test(p.src)) return `<img${U.attrs({ class: opts.cls, src: p.src, alt, width: p.w || r.w, height: p.h || r.h, loading: opts.eager ? 'eager' : 'lazy', decoding: 'async' })}>`;
  return img({ src: p.src, alt, w: p.w || r.w, h: p.h || r.h }, { ...opts, alt });
}
const absImg = (ctx, ref) => { const p = photoRef(ref); return p ? ctx.site.origin + p.src : ''; };

// ---------- block renderer (every captured block type; nothing is dropped) ----------
function table(rows) {
  if (!rows || !rows.length) return '';
  return `<div class="p-table"><table><tbody>${rows.map((r) => `<tr>${(Array.isArray(r) ? r : [r]).map((c) => `<td>${rewrite(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function formHtml(b) {
  const fields = (b.fields || []).map((f) => (typeof f === 'string' ? f : f.label || f.name || f.placeholder || '')).filter(Boolean);
  let html = demoForm({ fields: fields.length ? fields : ['Email'], button: (b.button && (b.button.text || b.button)) || 'Submit', cls: 'p-form' });
  if (b.consent) html = html.replace('<button', `<label class="demo-form__check"><input type="checkbox" name="consent"> <span>${rewrite(b.consent)}</span></label>\n<button`);
  return html;
}
function faqHtml(items, { open = -1 } = {}) {
  return `<div class="faq p-faqlist">${(items || []).map((it, j) => `<details${j === open ? ' open' : ''}><summary>${esc(stripTags(it.q))}</summary><div class="faq__a">${rewrite(it.a_html || it.a || '')}</div></details>`).join('\n')}</div>`;
}
function embedHtml(ctx, b) {
  let src = String(b.src || '');
  let fallback = src.replace(/\/embed\?/, '/viewer?').replace(/&output=embed/, '');
  // a keyed Maps Embed API URL (the live calendar plugin's venue map) is never republished: a plain search link instead
  if (/[?&]key=/i.test(src)) { const q = (src.match(/[?&]q=([^&]+)/) || [])[1] || ''; fallback = 'https://www.google.com/maps/search/?api=1&query=' + q; src = ''; }
  const label = b.note || (/google\.com\/maps|maps\.google/i.test(String(b.src || '')) ? 'Open the map' : 'Open in a new tab');
  return `<figure class="p-embed glass glass--strong">${/^https:\/\//i.test(src) ? `<iframe class="p-embed__frame" src="${escA(src)}" title="${escA(stripTags(label))}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>` : ''}
<figcaption class="p-embed__cap">${icon('pin')}<a${linkAttrs(fallback || ctx.site.mapUrl)}>${esc(stripTags(label))}</a>${icon('ext')}</figcaption></figure>`;
}
function cardsHtml(items = [], o = {}) {
  return `<ul class="p-cards" role="list">${items.map((it, i) => {
    const media = it.img ? pic(it.img, { sizes: '(min-width: 1024px) 360px, 88vw', cls: 'p-card__img' }) : '';
    const t = it.title ? (it.href ? `<a${linkAttrs(live(it.href))}>${esc(stripTags(it.title))}</a>` : esc(stripTags(it.title))) : '';
    return `<li class="p-card glass glass--lift" data-reveal style="--i:${i % 3}">${media ? `<span class="p-card__media">${media}</span>` : ''}${it.label ? `<span class="tag tag--signal p-card__label">${esc(stripTags(it.label))}</span>` : ''}${t ? `<h3 class="p-card__title">${t}</h3>` : ''}${it.html ? `<div class="p-card__body">${rewrite(it.html)}</div>` : ''}</li>`;
  }).join('')}</ul>`;
}
function block(b, o = {}) {
  const t = b.type;
  switch (t) {
    case 'p': return b.html || b.text ? `<p>${b.html != null ? rewrite(b.html) : esc(b.text)}</p>` : '';
    case 'h1': if (o.h1 && norm(b.text) === norm(o.h1)) return ''; return `<h2${o.ids ? ` id="${escA(o.ids(b.text))}"` : ''}>${esc(b.text)}</h2>`;
    case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
      const n = Math.min(6, Math.max(2, Number(t[1]) + (o.shift || 0)));
      return `<h${n}${o.ids ? ` id="${escA(o.ids(b.text))}"` : ''}>${esc(b.text)}</h${n}>`;
    }
    case 'ul': case 'ol': return `<${t}>${(b.items || []).map((it) => `<li>${typeof it === 'string' ? rewrite(it) : rewrite(it.html || esc(it.text || ''))}</li>`).join('')}</${t}>`;
    case 'img': {
      const fig = pic(b, { sizes: o.imgSizes || '(min-width: 1024px) 640px, 92vw', cls: 'p-imgblock__img' });
      if (!fig) return '';
      return b.href ? `<p class="p-imgblock"><a${linkAttrs(live(b.href))}>${fig}</a></p>` : `<figure class="p-imgblock frame">${fig}</figure>${b.caption ? `<p class="p-caption">${esc(b.caption)}</p>` : ''}`;
    }
    case 'video': { const v = photoRef(b.src); return v ? `<figure class="p-imgblock frame"><video src="${escA(v.src)}" controls muted playsinline preload="none"></video></figure>` : ''; }
    case 'button': return b.text ? `<p class="p-btnline">${btn(live(b.href || '#'), `${esc(b.text)}${extIcon(live(b.href || '#'))}`, o.btnCls || '')}</p>` : '';
    case 'quote': return `<blockquote class="p-quote">${b.html ? rewrite(b.html) : `<p>${esc(b.text)}</p>`}${b.cite ? `<cite>${esc(b.cite)}</cite>` : ''}</blockquote>`;
    case 'faq': return faqHtml(b.items);
    case 'icon-box': return `<div class="p-ibox">${b.title ? `<h3 class="p-ibox__t">${esc(b.title)}</h3>` : ''}${b.html ? `<div class="p-ibox__b">${rewrite(b.html)}</div>` : ''}</div>`;
    case 'form': return formHtml(b);
    case 'embed': return embedHtml(o.ctx, b);
    case 'table': case 'hours': return table(b.rows);
    case 'steps': return `<ol class="steps p-steps">${(b.items || []).map((s, i) => `<li class="step"><span class="step__num">${esc(s.num || String(i + 1).padStart(2, '0'))}</span>${s.title ? `<span class="step__title">${esc(s.title)}</span>` : ''}${s.text ? `<span class="step__text">${rewrite(s.text)}</span>` : ''}</li>`).join('')}</ol>`;
    case 'cards': return cardsHtml(b.items, o);
    default: {
      const txt = [b.title, b.text, b.html].filter((x) => typeof x === 'string' && x).join(' ');
      const items = Array.isArray(b.items) ? b.items.map((it) => (typeof it === 'string' ? it : [it.title, it.text, it.html].filter(Boolean).join(' '))).filter(Boolean) : [];
      return (txt ? `<p>${rewrite(txt)}</p>` : '') + (items.length ? `<ul>${items.map((x) => `<li>${rewrite(x)}</li>`).join('')}</ul>` : '');
    }
  }
}
const blocksHtml = (list, o = {}) => (list || []).map((b) => block(b, o)).filter(Boolean).join('\n');

// the section's own heading, printed once (skipped when a block repeats it, or when it is the page H1)
function secHeading(s, rec) {
  const head = String(s.heading || '').trim();
  if (!head) return '';
  if (norm(head) === norm(rec.h1)) return '';
  if ((s.blocks || []).some((b) => [b.text, b.title].some((x) => typeof x === 'string' && norm(x) === norm(head)))) return '';
  return head;
}

// ---------- page wrapper ----------
function out(ctx, { path, title, description, crumbs, main, mod, jsonld = [], image = '', noPrefooter = false }) {
  const url = absUrl(ctx, encodeURI(path));
  return {
    path,
    html: page({
      ctx, path, title, description, canonical: url,
      og: { title, description, type: mod === 'event' ? 'article' : 'website', url, image: image || '' },
      jsonld, bodyClass: `p-page p-page--${mod}`, main, crumbs, heroCrumbs: true, noPrefooter,
    }),
  };
}

// the adopted inner-page hero (FOUNDATION .page-hero): sky ground + grid + registration marks; crumbs, kicker, H1, one
// line, CTAs on the left; a framed photo or a cut-out on the right, overhanging the hero's bottom edge
function hero({ crumbs, kicker = '', title, lede = '', ctas = [], art = '', mod = '', meta = '', bg = 'g-sky-field' }) {
  return `<section class="page-hero p-hero ${mod}">
<div class="band__clip" aria-hidden="true">${gimg(bg, { alt: '', eager: true, sizes: '100vw', cls: 'p-hero__bg' })}<span class="p-hero__scrim"></span><span class="p-reg p-reg--tr"></span></div>
<div class="wrap page-hero__inner${art ? '' : ' page-hero__inner--solo'}">
<div class="page-hero__text">
${crumbsHtml(crumbs)}
${kicker ? `<p class="kicker" data-reveal>${esc(kicker)}</p>` : ''}
<h1 class="display p-hero__h1" data-reveal style="--i:1">${title}</h1>
${meta}
${lede ? `<div class="lede p-hero__lede" data-reveal style="--i:2">${lede}</div>` : ''}
${ctas.length ? `<div class="btn-row" data-reveal style="--i:3">${ctas.join('')}</div>` : ''}
</div>
${art ? `<div class="page-hero__art">${art}</div>` : ''}
</div>
</section>`;
}
const heroFrame = (inner, label = '') => `<figure class="frame frame--float p-hero__frame" data-depth="0.08">${inner}${label ? `<span class="frame__label tag tag--ink">${esc(label)}</span>` : ''}</figure>`;
const heroPhoto = (ref, fallback, label = '') => heroFrame(ref ? pic(ref, { eager: true, sizes: '(min-width: 1024px) 420px, 70vw', cls: 'frame__img', fallback }) : gimg(fallback, { alt: '', eager: true, sizes: '(min-width: 1024px) 420px, 70vw', cls: 'frame__img' }), label);
const heroCut = (id, cls = '') => `<span class="cut p-hero__cut ${cls}" data-float data-depth="0.12" aria-hidden="true">${gimg(id, { alt: '', eager: true, sizes: '(min-width: 1024px) 460px, 60vw', cls: 'p-hero__cutimg' })}</span>`;

// an alternating content row: text column + framed media, PAPER and FOG alternating, sides alternating
function row({ id = '', ground = 'paper', side = 'l', kicker: k = '', heading = '', body = '', media = '', mod = '' }) {
  const hid = id ? `${id}-h` : '';
  return `<section class="band band--${ground} p-row p-row--${side} ${mod}"${id ? ` id="${escA(id)}"` : ''}${heading && hid ? ` aria-labelledby="${escA(hid)}"` : ''}>
<div class="wrap p-row__grid${media ? '' : ' p-row__grid--solo'}">
<div class="p-row__text" data-reveal>
${kick(k)}
${heading ? `<h2 class="display p-row__h"${hid ? ` id="${escA(hid)}"` : ''}>${esc(heading)}</h2>` : ''}
<div class="prose p-row__prose">${body}</div>
</div>
${media ? `<div class="p-row__media" data-reveal style="--i:1">${media}</div>` : ''}
</div>
</section>`;
}
const frameFig = (ref, { depth = '0.05', label = '' } = {}) => { const im = pic(ref, { sizes: '(min-width: 1024px) 480px, 88vw', cls: 'frame__img' }); return im ? `<figure class="frame frame--float p-row__frame" data-depth="${depth}">${im}${label ? `<span class="frame__label tag tag--signal">${esc(label)}</span>` : ''}</figure>` : ''; };

// split the first section's leading paragraphs off as the hero line (they move, they are not dropped)
function heroSplit(rec) {
  const S = (rec.sections || []).map((s) => ({ ...s, blocks: (s.blocks || []).slice() }));
  const first = S[0] || { blocks: [] };
  const lede = [];
  while (first.blocks.length && (first.blocks[0].type === 'h1' && norm(first.blocks[0].text) === norm(rec.h1))) first.blocks.shift();
  while (first.blocks.length && first.blocks[0].type === 'p' && lede.length < 1) lede.push(first.blocks.shift());
  return { S, lede: lede.map((b) => `<p>${rewrite(b.html != null ? b.html : esc(b.text))}</p>`).join('') };
}
// every section as alternating rows; the first image of a section becomes its framed media
function rowsOf(ctx, rec, S, { start = 0, grounds = ['paper', 'fog'], used = new Set() } = {}) {
  let k = start;
  return S.map((s) => {
    const blocks = (s.blocks || []).filter((b) => !(b.type === 'h1' && norm(b.text) === norm(rec.h1)));
    const heading = secHeading(s, rec);
    if (!blocks.length && !heading) return '';
    const imgs = blocks.filter((b) => b.type === 'img' && !b.href && photoRef(b) && !used.has(b.src));
    const lead = imgs[0];
    // an image already shown (the hero frame, an earlier row) is not printed twice
    const rest = blocks.filter((b) => b !== lead && !(b.type === 'img' && used.has(b.src)));
    if (lead) used.add(lead.src);
    const media = lead ? frameFig(lead, { depth: k % 2 ? '-0.04' : '0.05' }) : '';
    const html = row({ id: s.id ? 'sec-' + slugify(s.id) : '', ground: grounds[k % grounds.length], side: k % 2 ? 'r' : 'l', heading, body: blocksHtml(rest, { ctx, h1: rec.h1 }), media });
    k++;
    return html;
  }).filter(Boolean).join('\n');
}

// ---------- /about/ ----------
function about(ctx) {
  const c = captured(ctx, 'about');
  if (!c) return null;
  const path = c.path || '/about/';
  const crumbs = [HOME, { href: path, label: 'About' }];
  const { S, lede } = heroSplit(c);
  const allImgs = blocksOf(c).filter((b) => b.type === 'img' && photoRef(b));
  const heroImg = allImgs[0];
  const used = new Set(heroImg ? [heroImg.src] : []);
  const A = ctx.site.address || {};
  const visit = `<section class="band band--night band--grid p-visit" aria-labelledby="p-visit-h">
<div class="wrap p-visit__grid">
<div class="p-visit__text" data-reveal>${kick('Visit BUZZY')}<h2 class="display p-visit__h" id="p-visit-h">${esc(A.streetShort || A.street)}</h2><p class="lede">${esc(A.neighborhood)}, ${esc(A.city)}, ${esc(A.state)} ${esc(A.zip)}. ${esc(A.landmark || '')}</p>
<div class="btn-row">${btn('/visit-us/', 'Visit Us', 'btn--signal')}${btn(ctx.site.mapUrl, `Get Directions${icon('ext')}`, 'btn--light')}</div></div>
<div class="glass glass--dark p-visit__card" data-reveal style="--i:1">${shell.specTable([['Address', `${A.street}, ${A.city}, ${A.state} ${A.zip}`], ['Hours', ctx.site.hoursLine], ['Phone', ctx.site.phone], ['Email', ctx.site.email]], 'p-visit__spec')}</div>
</div>
</section>`;
  const main = `${hero({
    crumbs, kicker: ctx.site.kicker, title: esc(c.h1), lede,
    ctas: [btn('/visit-us/', 'Visit Us'), btn(menu(ctx), `Shop Now${icon('ext')}`, 'btn--ghost')],
    art: heroImg ? heroPhoto(heroImg, 'g-vitrine', 'Cobble Hill') : heroCut('g-stoop-cut'),
    mod: 'p-hero--about',
  })}
${rowsOf(ctx, c, S, { used })}
${visit}`;
  return out(ctx, { path, title: c.title, description: c.description, crumbs, main, mod: 'about', image: heroImg ? absImg(ctx, heroImg) : '' });
}

// ---------- /careers/ ----------
function careers(ctx) {
  const c = captured(ctx, 'careers');
  if (!c) return null;
  const path = c.path || '/careers/';
  const crumbs = [HOME, ABOUT, { href: path, label: 'Careers' }];
  const { S, lede } = heroSplit(c);
  const heroImg = blocksOf(c).find((b) => b.type === 'img' && photoRef(b));
  // a section holding a job title (h3/h4) + its text + an APPLY button becomes a glass job card
  const body = S.map((s, i) => {
    const blocks = (s.blocks || []).filter((b) => !(b.type === 'h1' && norm(b.text) === norm(c.h1)) && b !== heroImg);
    const heading = secHeading(s, c);
    if (!blocks.length && !heading) return '';
    const jobs = [];
    let pre = [];
    for (const b of blocks) {
      if (/^h[3-4]$/.test(b.type)) { jobs.push({ title: b.text, blocks: [] }); continue; }
      if (jobs.length) jobs[jobs.length - 1].blocks.push(b); else pre.push(b);
    }
    const jobHtml = jobs.map((j, n) => `<article class="glass glass--strong glass--lift p-job" data-reveal style="--i:${n % 3}"><span class="tag tag--signal p-job__tag">N° ${String(n + 1).padStart(2, '0')}</span><h3 class="display p-job__t">${esc(j.title)}</h3><div class="prose p-job__b">${blocksHtml(j.blocks, { ctx, btnCls: 'btn--signal' })}</div></article>`).join('');
    return `<section class="band band--${i % 2 ? 'fog' : 'paper'} p-row p-careers"${heading ? ` aria-label="${escA(heading)}"` : ''}><div class="wrap">
${heading ? `<h2 class="display p-row__h" data-reveal>${esc(heading)}</h2>` : ''}
${pre.length ? `<div class="prose p-row__prose">${blocksHtml(pre, { ctx, h1: c.h1 })}</div>` : ''}
${jobHtml ? `<div class="p-jobs">${jobHtml}</div>` : ''}
</div></section>`;
  }).filter(Boolean).join('\n');
  const main = `${hero({
    crumbs, kicker: 'Careers', title: esc(c.h1), lede,
    ctas: [btn('#p-jobs', 'Open positions'), btn('/about/', 'About BUZZY', 'btn--ghost')],
    art: heroImg ? heroPhoto(heroImg, 'g-curation') : heroCut('g-cloud-cut'),
    mod: 'p-hero--careers',
  })}
<div id="p-jobs">${body}</div>`;
  return out(ctx, { path, title: c.title, description: c.description, crumbs, main, mod: 'careers' });
}

// ---------- /brooklyn-dispensary-faqs/ ----------
function faqPage(ctx) {
  const c = captured(ctx, 'brooklyn-dispensary-faqs');
  if (!c) return null;
  const path = c.path || '/brooklyn-dispensary-faqs/';
  const crumbs = [HOME, ABOUT, { href: path, label: 'FAQs' }];
  const groups = [];
  const extra = [];
  let g = null;
  const open = (title) => { g = { title, items: [], notes: [] }; groups.push(g); };
  let q = null; // a question captured as a heading collects the blocks under it as its answer
  for (const s of c.sections || []) {
    const head = String(s.heading || '').trim();
    const blocks = s.blocks || [];
    const headIsQ = /\?\s*$/.test(head);
    if (head && norm(head) !== norm(c.h1) && !headIsQ && !blocks.some((b) => norm(b.text) === norm(head))) { open(head); q = null; }
    if (headIsQ && !blocks.some((b) => norm(b.text) === norm(head))) { if (!g) open('Questions'); q = { q: head, parts: [] }; g.items.push(q); }
    for (const b of blocks) {
      if (b.type === 'h1' && norm(b.text) === norm(c.h1)) continue;
      if (/^h[2-6]$/.test(b.type)) {
        if (/\?\s*$/.test(b.text)) { if (!g) open('Questions'); q = { q: b.text, parts: [] }; g.items.push(q); }
        else { open(b.text); q = null; }
        continue;
      }
      if (b.type === 'faq') { if (!g) open('Questions'); for (const it of b.items || []) g.items.push({ q: it.q, a_html: it.a_html }); q = null; continue; }
      if (q) q.parts.push(b); else if (g) g.notes.push(b); else extra.push(b);
    }
  }
  for (const gr of groups) for (const it of gr.items) if (it.parts) it.a_html = it.parts.map((b) => block(b, { ctx })).join('');
  const gid = (t) => 'faq-' + slugify(t);
  const n = groups.reduce((a, x) => a + x.items.length, 0);
  const groupHtml = groups.map((x, i) => `<section class="p-faq__group" id="${gid(x.title)}" aria-labelledby="${gid(x.title)}-h" data-reveal>
<h2 class="display p-faq__title" id="${gid(x.title)}-h"><span class="p-faq__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span>${esc(x.title)}</span></h2>
${x.items.length ? faqHtml(x.items, { open: i === 0 ? 0 : -1 }) : ''}
${x.notes.length ? `<div class="prose p-faq__note">${blocksHtml(x.notes, { ctx })}</div>` : ''}
</section>`).join('\n');
  const heroImg = blocksOf(c).find((b) => b.type === 'img' && photoRef(b));
  const main = `${hero({
    crumbs, kicker: 'FAQs', title: esc(c.h1),
    lede: `<p>${n} answers from BUZZY, ${groups.length > 1 ? 'grouped by topic' : 'in one place'}.</p>`,
    ctas: [btn('/visit-us/', 'Visit Us'), btn(ctx.site.phoneHref, `${icon('phone')}${esc(ctx.site.phoneDigits || ctx.site.phone)}`, 'btn--ghost')],
    art: heroImg ? heroPhoto(heroImg, 'g-guide') : heroFrame(gimg('g-guide', { alt: '', eager: true, sizes: '(min-width: 1024px) 340px, 70vw', cls: 'frame__img' }), `${n} answers`),
    mod: 'p-hero--faq',
  })}
<section class="band band--paper p-faq" aria-label="Questions and answers">
<div class="wrap p-faq__grid">
<aside class="p-faq__aside">
<nav class="p-faq__index glass glass--strong" aria-label="FAQ topics"><p class="p-faq__ih">Topics</p><ol>${groups.map((x, i) => `<li><a href="#${gid(x.title)}"><span class="p-faq__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span>${esc(x.title)}</span></a></li>`).join('')}</ol>
${shell.specTable([['Hours', ctx.site.hoursLine], ['Phone', ctx.site.phoneDigits || ctx.site.phone]], 'p-faq__spec')}
<a class="btn btn--signal btn--sm p-faq__cta"${linkAttrs(menu(ctx))}>Shop Now${icon('ext')}</a></nav>
</aside>
<div class="p-faq__groups">
${extra.length ? `<div class="prose">${blocksHtml(extra, { ctx })}</div>` : ''}
${groupHtml}
</div>
</div>
</section>`;
  const seen = new Map();
  for (const x of groups) for (const it of x.items) { const a = stripTags(it.a_html || '').replace(/\s+/g, ' ').trim(); const qq = stripTags(it.q).trim(); if (qq && a && (!seen.has(qq) || seen.get(qq).length < a.length)) seen.set(qq, a); }
  const jsonld = seen.size ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [...seen].map(([qq, a]) => ({ '@type': 'Question', name: qq, acceptedAnswer: { '@type': 'Answer', text: a } })) } : [];
  return out(ctx, { path, title: c.title, description: c.description, crumbs, main, mod: 'faq', jsonld });
}

// ---------- events ----------
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function sortDate(e) {
  if (e.startISO) return String(e.startISO).slice(0, 10);
  const t = String(e.dateText || '');
  const d = Date.parse(t.replace(/@.*$/, '').replace(/^[A-Za-z]+,\s*/, '') + (/\d{4}/.test(t) ? '' : ' 2026'));
  return Number.isNaN(d) ? '' : new Date(d).toISOString().slice(0, 10);
}
const isUpcoming = (e) => { const d = sortDate(e); return !!d && d >= TODAY; };
const evPath = (e) => { const p = e.path || `/event/${e.slug}/`; try { return decodeURI(p); } catch { return p; } };
const evTitle = (e) => stripTags(e.h1 || e.title || '').replace(/\s*[|]\s*(BUZZY|Buzzy).*$/, '').trim();
const catsOf = (e) => {
  const names = [].concat(e.category || []).map((x) => (typeof x === 'string' ? x : x.name)).filter(Boolean);
  const slugs = [].concat(e.categorySlug || []).map((x) => (typeof x === 'string' ? x : x.slug)).filter(Boolean);
  return names.map((n, i) => ({ name: n, slug: slugs[i] || slugify(n) }));
};
const venueName = (e) => (typeof e.venue === 'string' ? e.venue : (e.venue && e.venue.name) || '');
const addrText = (e) => (typeof e.address === 'string' ? e.address : e.address ? [e.address.street, e.address.city, e.address.state, e.address.zip].filter(Boolean).join(', ') : '');
function eventImgRef(e) {
  if (e.image) { const r = typeof e.image === 'string' ? { src: e.image } : e.image; if (photoRef(r)) return r; }
  return blocksOf(e).find((b) => b.type === 'img' && photoRef(b)) || null;
}
// BUZZY's date block: month + day, mono, on the card media
function dateBlock(e, cls = '') {
  const d = sortDate(e);
  if (!d) return '';
  return `<span class="ecard__date ${cls}"><span>${MON[+d.slice(5, 7) - 1]}</span><strong>${+d.slice(8, 10)}</strong></span>`;
}
function ecard(ctx, e, i, { h = 'h3', excerpt = '' } = {}) {
  const im = eventImgRef(e);
  const cats = catsOf(e);
  const media = im ? pic(im, { alt: '', sizes: '(min-width: 1280px) 380px, (min-width: 700px) 45vw, 86vw' }) : gimg('g-events', { alt: '', sizes: '(min-width: 1280px) 380px, (min-width: 700px) 45vw, 86vw' });
  return `<article class="ecard p-ecard${isUpcoming(e) ? '' : ' p-ecard--past'}" data-filter-item data-tags="${escA(cats.map((c) => c.slug).join(' '))} ${isUpcoming(e) ? 'upcoming' : 'past'}" data-reveal style="--i:${i % 3}">
<span class="ecard__media">${media}${dateBlock(e)}</span>
${cats.length ? `<span class="ecard__cat">${esc(cats.map((c) => c.name).join(' / '))}${isUpcoming(e) ? '' : ' <span class="p-ecard__past">Past</span>'}</span>` : ''}
<${h} class="ecard__title"><a${linkAttrs(encodeURI(evPath(e)))}>${esc(evTitle(e))}</a></${h}>
<span class="ecard__meta p-ecard__meta">${e.dateText ? `<span>${icon('clock')}${esc(stripTags(e.dateText))}${e.timeText ? ' ' + esc(stripTags(e.timeText)) : ''}</span>` : ''}${venueName(e) ? `<span>${icon('pin')}${esc(venueName(e))}</span>` : ''}</span>
${excerpt ? `<span class="p-ecard__ex">${excerpt}</span>` : ''}
</article>`;
}
const orderEvents = (list) => {
  const up = list.filter(isUpcoming).sort((a, b) => sortDate(a).localeCompare(sortDate(b)));
  const past = list.filter((e) => !isUpcoming(e)).sort((a, b) => (sortDate(b) || '').localeCompare(sortDate(a) || ''));
  return { up, past };
};
const FILTERS = [['all', 'All events'], ['pop-ups', 'Brand Pop-Ups'], ['community-events', 'Community Events']];
function board(ctx, list, { id = 'p-board', filters = true } = {}) {
  const { up, past } = orderEvents(list);
  const grid = (arr, off = 0) => `<div class="p-egrid">${arr.map((e, i) => ecard(ctx, e, i + off)).join('\n')}</div>`;
  return `<div class="p-board" id="${id}" data-filter-scope>
${filters ? `<div class="p-board__filters" data-filter-group role="group" aria-label="Filter events">${FILTERS.map(([v, l]) => `<button class="chip${v === 'all' ? ' chip--signal' : ''}" type="button" data-filter="${v}" aria-pressed="${v === 'all'}">${esc(l)} <span class="chip__num">${v === 'all' ? list.length : list.filter((e) => catsOf(e).some((c) => c.slug === v)).length}</span></button>`).join('')}</div>` : ''}
<section class="p-evgroup" aria-labelledby="${id}-up"><header class="p-evgroup__head"><h2 class="display p-evgroup__h" id="${id}-up">Upcoming</h2><span class="tag tag--signal">${up.length}</span></header>
${up.length ? grid(up) : '<p class="p-empty">No upcoming events are posted right now.</p>'}</section>
${past.length ? `<section class="p-evgroup p-evgroup--past" aria-labelledby="${id}-past"><header class="p-evgroup__head"><h2 class="display p-evgroup__h" id="${id}-past">Past events</h2><span class="tag tag--ink">${past.length}</span></header>${grid(past, up.length)}</section>` : ''}
<p class="p-empty" data-filter-empty hidden>No events match this filter.</p>
</div>`;
}
// the captured calendar page: its own blocks (intro, listing words), printed as a quiet "calendar" column
function calendarWords(ctx, rec) {
  const blocks = blocksOf(rec).filter((b) => !(b.type === 'h1' && norm(b.text) === norm(rec.h1)));
  const heads = (rec.sections || []).map((s) => secHeading(s, rec)).filter(Boolean);
  if (!blocks.length && !heads.length) return '';
  return `<section class="band band--fog p-cal" aria-label="From the BUZZY calendar"><div class="wrap p-cal__grid">
<div class="p-cal__label" data-reveal>${kick('The calendar')}<p class="p-cal__note">As listed on the BUZZY events calendar.</p></div>
<div class="prose p-cal__text" data-reveal style="--i:1">${heads.map((h) => `<h2>${esc(h)}</h2>`).join('')}${blocksHtml(blocks, { ctx, h1: rec.h1 })}</div>
</div></section>`;
}
function eventsHub(ctx) {
  const c = captured(ctx, 'events');
  const path = (c && c.path) || '/events/';
  const crumbs = [HOME, ABOUT, { href: path, label: 'Events' }];
  const evs = ctx.events || [];
  const { up } = orderEvents(evs);
  const main = `${hero({
    // the live events page's visible H1 (tmp/txt/events.txt); the capture stores no h1 for this calendar view
    crumbs, kicker: 'Events at BUZZY', title: esc((c && c.h1) || 'Buzzy Dispensary Events: Brooklyn Cannabis Pop-Ups & Gatherings'),
    lede: `<p>Brand pop-ups on Court Street and community nights around the neighborhood: ${up.length} upcoming, ${evs.length} in all.</p>`,
    ctas: [btn('#p-board', 'Browse events'), btn('/events/category/pop-ups/', 'Brand Pop-Ups', 'btn--ghost'), btn('/events/category/community-events/', 'Community Events', 'btn--ghost')],
    art: heroFrame(gimg('g-events', { alt: '', eager: true, sizes: '(min-width: 1024px) 420px, 70vw', cls: 'frame__img' }), up[0] ? `Next: ${MON[+sortDate(up[0]).slice(5, 7) - 1]} ${+sortDate(up[0]).slice(8, 10)}` : ''),
    mod: 'p-hero--events', bg: 'g-sky-field',
  })}
<section class="band band--paper p-ev" aria-label="All events"><div class="wrap">${board(ctx, evs)}</div></section>
${c ? calendarWords(ctx, c) : ''}`;
  return out(ctx, { path, title: c ? c.title : 'Events | BUZZY', description: c ? c.description : 'BUZZY events in Brooklyn: brand pop-ups and community events.', crumbs, main, mod: 'events' });
}
function eventsCat(ctx, catSlug, label) {
  const [slug, c] = findBy(ctx, (s, r) => isEvCat(s, r) && (String(r.path || '').includes('/' + catSlug + '/') || s.endsWith(catSlug)));
  const path = `/events/category/${catSlug}/`;
  const crumbs = [HOME, EVENTS, { href: path, label }];
  const list = (ctx.events || []).filter((e) => catsOf(e).some((x) => x.slug === catSlug || slugify(x.name) === catSlug));
  const { up } = orderEvents(list);
  const main = `${hero({
    crumbs, kicker: label, title: esc(c ? c.h1 : label),
    lede: `<p>${up.length} upcoming, ${list.length} in all.</p>`,
    ctas: [btn('#p-board', 'Browse events'), btn('/events/', 'All events', 'btn--ghost')],
    art: heroFrame(gimg(catSlug === 'pop-ups' ? 'g-curation' : 'g-events', { alt: '', eager: true, sizes: '(min-width: 1024px) 420px, 70vw', cls: 'frame__img' }), label),
    mod: 'p-hero--evcat',
  })}
<section class="band band--paper p-ev" aria-label="${escA(label)}"><div class="wrap">${board(ctx, list, { filters: false })}</div></section>
${c ? calendarWords(ctx, c) : ''}`;
  return out(ctx, { path, title: c ? c.title : `${label} | BUZZY`, description: c ? c.description : `BUZZY ${label.toLowerCase()} in Brooklyn.`, crumbs, main, mod: 'evcat' });
}
function eventPage(ctx, e, all) {
  const path = evPath(e);
  const t = evTitle(e);
  const crumbs = [HOME, EVENTS, { href: encodeURI(path), label: t }];
  const im = eventImgRef(e);
  const cats = catsOf(e);
  const all0 = blocksOf(e).filter((b) => !(b.type === 'h1' && norm(b.text) === norm(e.h1 || t)) && !(im && b.type === 'img' && b.src === im.src));
  // the captured date/time fragments and the cost go to the hero line; the calendar's venue / organizer boxes (from the
  // "Categories:" heading on) go to the details card; the story stays in the body
  const dt = all0.filter((b) => b.role === 'event-datetime');
  const cost = all0.filter((b) => b.role === 'event-cost');
  const rest0 = all0.filter((b) => !dt.includes(b) && !cost.includes(b));
  const cut = rest0.findIndex((b) => /^h[2-4]$/.test(b.type) && /^categor(y|ies):?$/i.test(String(b.text || '').trim()));
  const blocks = cut === -1 ? rest0 : rest0.slice(0, cut);
  const boxes = cut === -1 ? [] : rest0.slice(cut);
  const heads = (e.sections || []).map((s) => secHeading(s, e)).filter(Boolean);
  const body = blocks.length || heads.length ? heads.map((h) => `<h2>${esc(h)}</h2>`).join('') + blocksHtml(blocks, { ctx, h1: e.h1 }) : rewrite(e.html || '');
  const when = dt.length ? dt.map((b) => stripTags(b.html != null ? b.html : b.text).trim()).filter(Boolean).map((x) => (/^[^a-z0-9@]+$/i.test(x) ? 'to' : x)).join(' ').replace(/\s+@\s+/, ', ') : [e.dateText, e.timeText].filter(Boolean).map(stripTags).join(', ');
  const meta = `<p class="page-hero__meta p-evmeta" data-reveal style="--i:2">${when ? `<span class="tag tag--signal">${esc(when)}</span>` : ''}${cost.map((b) => `<span class="tag tag--ink">${esc(stripTags(b.html != null ? b.html : b.text))}</span>`).join('')}${cats.map((x) => `<a class="chip" ${linkAttrs(`/events/category/${x.slug}/`)}>${esc(x.name)}</a>`).join('')}</p>`;
  const boxHtml = boxes.length ? `<div class="p-evcard__cap"><p class="p-evcard__caph">As listed on the calendar</p>${boxes.map((b) => (/^h[2-6]$/.test(b.type) ? `<p class="p-evcard__k">${esc(b.text)}</p>` : block(b, { ctx }))).join('')}</div>` : '';
  const facts = [['Date', stripTags(e.dateText || '')], ['Time', stripTags(e.timeText || '')], ['Venue', venueName(e)], ['Address', addrText(e)], ['Category', cats.map((x) => x.name).join(', ')]].filter(([, v]) => v);
  const others = all.filter((x) => x.slug !== e.slug);
  const { up, past } = orderEvents(others);
  const more = up.concat(past).slice(0, 3);
  const main = `${hero({
    crumbs, kicker: isUpcoming(e) ? 'Upcoming event' : 'Past event', title: esc(t), meta,
    ctas: [btn('/events/', 'All events', 'btn--ghost'), btn(menu(ctx), `Shop Now${icon('ext')}`)],
    art: heroPhoto(im, 'g-events'),
    mod: 'p-hero--event',
  })}
<section class="band band--paper p-eventbody" aria-label="Event details">
<div class="wrap p-eventbody__grid">
<div class="prose p-eventbody__text" data-reveal>${body}</div>
<aside class="p-eventbody__aside" data-reveal style="--i:1"><div class="glass glass--strong p-evcard">${dateBlock(e, 'p-evcard__date')}${shell.specTable(facts, 'p-evcard__spec')}
${addrText(e) ? `<a class="link-arrow"${linkAttrs('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([venueName(e), addrText(e)].filter(Boolean).join(', ')))}>Open in Google Maps${icon('ext')}</a>` : ''}${boxHtml}</div>
<p class="p-eventbody__back">${arrow('/events/', 'Back to all events')}</p></aside>
</div>
</section>
${more.length ? `<section class="band band--fog band--grid p-moreev" aria-labelledby="p-moreev-h"><div class="wrap">
<header class="p-head" data-reveal>${kick('Events')}<h2 class="display p-head__h" id="p-moreev-h">More <em class="accent">events</em></h2></header>
<div class="p-egrid">${more.map((x, i) => ecard(ctx, x, i)).join('\n')}</div>
</div></section>` : ''}`;
  const jsonld = [];
  if (e.startISO) {
    const loc = venueName(e) || addrText(e) ? { '@type': 'Place', ...(venueName(e) ? { name: venueName(e) } : {}), ...(addrText(e) ? { address: addrText(e) } : {}) } : undefined;
    jsonld.push({ '@context': 'https://schema.org', '@type': 'Event', name: t, startDate: e.startISO, ...(e.endISO ? { endDate: e.endISO } : {}), ...(loc ? { location: loc } : {}), ...(im ? { image: absImg(ctx, im) } : {}), ...(e.description ? { description: e.description } : {}), url: absUrl(ctx, encodeURI(path)) });
  }
  return out(ctx, { path, title: e.title || t, description: e.description || t, crumbs, main, mod: 'event', jsonld, image: im ? absImg(ctx, im) : '' });
}

// ---------- /brooklyn-map/ ----------
function brooklynMap(ctx) {
  const c = captured(ctx, 'brooklyn-map');
  if (!c) return null;
  const path = c.path || '/brooklyn-map/';
  const crumbs = [HOME, ABOUT, { href: path, label: 'Neighborhood Map' }];
  const { S, lede } = heroSplit(c);
  const all = S.flatMap((s) => s.blocks);
  const embeds = all.filter((b) => b.type === 'embed');
  const rest = S.map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.type !== 'embed') }));
  const main = `${hero({
    crumbs, kicker: 'Neighborhood Map', title: esc(c.h1), lede,
    ctas: [embeds.length ? btn('#p-map', 'Open the map') : '', btn('/visit-us/', 'Visit Us', embeds.length ? 'btn--ghost' : ''), btn('/events/', 'Events', 'btn--ghost')].filter(Boolean),
    art: heroCut('g-stoop-cut', 'p-hero__cut--map'),
    mod: 'p-hero--map',
  })}
${embeds.length ? `<section class="band band--fog band--grid p-map" id="p-map" aria-label="Map"><div class="wrap">${embeds.map((b) => embedHtml(ctx, b)).join('')}</div></section>` : ''}
${rowsOf(ctx, c, rest, { start: embeds.length ? 0 : 1 })}`;
  return out(ctx, { path, title: c.title, description: c.description, crumbs, main, mod: 'map' });
}

// ---------- /privacy-policy/ /terms-of-service/ (verbatim prose on a calm reading ground) ----------
function legal(ctx, slug) {
  const c = captured(ctx, slug);
  if (!c) return null;
  const path = c.path || `/${slug}/`;
  const label = slug === 'privacy-policy' ? 'Privacy Policy' : 'Terms of Service';
  const crumbs = [HOME, { href: path, label }];
  // no captured H1: the page's own opening title (its first section heading, unless that is a numbered clause),
  // else BUZZY's own footer label for the page
  const first = String(((c.sections || [])[0] || {}).heading || '').trim();
  const h1 = c.h1 || (first && !/^\d/.test(first) ? first : label);
  const rec = { ...c, h1 };
  const used = new Map();
  const idOf = (t) => { let id = 'sec-' + (slugify(t) || 'x'); const n = used.get(id) || 0; used.set(id, n + 1); return n ? `${id}-${n + 1}` : id; };
  const heads = [];
  const ids = (t) => { const id = idOf(t); heads.push([id, t]); return id; };
  const parts = (c.sections || []).map((s) => { const h = secHeading(s, rec); return (h ? `<h2 id="${escA(ids(h))}">${esc(h)}</h2>` : '') + blocksHtml((s.blocks || []), { ctx, h1, ids }); }).join('\n');
  const toc = heads.length >= 4 ? `<nav class="p-toc glass glass--strong" aria-label="Contents"><p class="p-toc__h">Contents</p><ol>${heads.map(([id, t]) => `<li><a href="#${id}">${esc(t)}</a></li>`).join('')}</ol></nav>` : '';
  const main = `${hero({ crumbs, kicker: 'Legal', title: esc(h1), ctas: [btn('/visit-us/', 'Contact and visit', 'btn--ghost')], mod: 'p-hero--legal' })}
<section class="band band--paper p-legal" aria-label="${escA(label)}">
<div class="wrap p-legal__grid${toc ? '' : ' p-legal__grid--solo'}">
${toc ? `<aside class="p-legal__aside">${toc}</aside>` : ''}
<div class="prose p-legal__text">${parts}</div>
</div>
</section>`;
  return out(ctx, { path, title: c.title, description: c.description || `BUZZY ${label}: the full text as published on getbuzzy.com.`, crumbs, main, mod: 'legal' });
}

// ---------- any other captured page (generic captured-page template) ----------
function generic(ctx, slug, c) {
  const path = c.path || `/${slug}/`;
  const label = stripTags(c.h1 || c.title || slug);
  const crumbs = [HOME, { href: path, label }];
  const { S, lede } = heroSplit(c);
  const heroImg = blocksOf(c).find((b) => b.type === 'img' && photoRef(b));
  const used = new Set(heroImg ? [heroImg.src] : []);
  const main = `${hero({
    crumbs, kicker: 'BUZZY', title: esc(c.h1 || label), lede,
    ctas: [btn(menu(ctx), `Shop Now${icon('ext')}`), btn('/visit-us/', 'Visit Us', 'btn--ghost')],
    art: heroImg ? heroPhoto(heroImg, 'g-vitrine') : heroCut('g-cloud-cut'),
    mod: 'p-hero--generic',
  })}
${rowsOf(ctx, c, S, { used })}`;
  return out(ctx, { path, title: c.title || `${label} | BUZZY`, description: c.description || label, crumbs, main, mod: 'generic' });
}

// ---------- /404.html ----------
function notFound(ctx) {
  const path = '/404.html';
  const crumbs = [HOME, { href: '/404.html', label: 'Page not found' }];
  const links = [['/', 'Home', 'sparkle'], [menu(ctx), 'Shop the menu', 'cart'], ['/cannabis-delivery-brooklyn/', 'Delivery', 'truck'], ['/in-store-pickup/', 'In-Store Pickup', 'bag'], ['/products/', 'Products', 'leaf'], ['/deals/', 'Deals', 'tag'], ['/events/', 'Events', 'star'], ['/visit-us/', 'Visit Us', 'pin'], ['/sitemap/', 'Sitemap', 'search']];
  const main = `${hero({
    crumbs, kicker: 'Error 404', title: 'This page drifted <em class="accent">off</em>',
    lede: '<p>The page you asked for is not here. These will get you back on track.</p>',
    ctas: [btn('/', 'Home'), btn(menu(ctx), `Shop Now${icon('ext')}`, 'btn--ghost')],
    art: heroCut('g-cloud-cut', 'p-hero__cut--404'),
    mod: 'p-hero--404',
  })}
<section class="band band--paper p-lost" aria-labelledby="p-lost-h"><div class="wrap">
<header class="p-head" data-reveal>${kick('Popular pages')}<h2 class="display p-head__h" id="p-lost-h">Try one of <em class="accent">these</em></h2></header>
<ul class="p-lost__grid" role="list">${links.map(([u, l, ic], i) => `<li><a class="p-lost__card glass glass--lift"${linkAttrs(u)} data-reveal style="--i:${i % 3}"><span class="p-lost__ico">${icon(ic)}</span><span class="p-lost__t">${esc(l)}</span>${extIcon(u)}</a></li>`).join('')}</ul>
</div></section>`;
  const r = out(ctx, { path, title: 'Page Not Found | BUZZY', description: 'The page you were looking for is not on the BUZZY site.', crumbs, main, mod: '404' });
  r.html = r.html.replace(/<link rel="canonical"[^>]*>\n?/, '').replace('<head>', '<head>\n<meta name="robots" content="noindex">');
  return r;
}

export async function render(ctx) {
  const pages = [about(ctx), faqPage(ctx), careers(ctx), eventsHub(ctx), eventsCat(ctx, 'pop-ups', 'Brand Pop-Ups'), eventsCat(ctx, 'community-events', 'Community Events')];
  const evs = ctx.events || [];
  for (const e of evs) pages.push(eventPage(ctx, e, evs));
  pages.push(brooklynMap(ctx), legal(ctx, 'privacy-policy'), legal(ctx, 'terms-of-service'));
  const taken = new Set([...(ctx.pages ? ctx.pages.keys() : []), ...pages.filter(Boolean).map((p) => p.path)]);
  const generics = [];
  for (const [slug, rec] of Object.entries(ctx.content || {})) {
    if (OWNED.has(slug) || MINE.has(slug) || isCatArchive(slug, rec) || isEvCat(slug, rec) || slug.includes('--')) continue;
    const p = rec.path || `/${slug}/`;
    if (taken.has(p)) continue;
    taken.add(p);
    generics.push(generic(ctx, slug, rec));
  }
  pages.push(...generics, notFound(ctx));
  if (missingPhotos.size && process.env.PAGES_DEBUG) console.warn('pages: photos not captured: ' + [...missingPhotos].join(', '));
  return pages.filter(Boolean);
}
