// services.mjs - SERVICES lane: /cannabis-delivery-brooklyn/ (BUZZY's delivery hub), the 11 neighborhood pages
// (ctx.delivery, one template), /cannabis-delivery-brooklyn-map/, /cannabis-delivery-brooklyn-nyc-rules/ (only when it is
// captured as a PAGE), /in-store-pickup/ (NEW, BUZZY's own pickup words only), /brooklyn-dispensary-for-tourists/,
// /hotel-guest-landing-page/, /visit-us/. Captured pages print every word of their JSON; new words are labels only.
// The delivery template is cut into parts by BUZZY's own section words (steps, menu, areas, notify, zips, categories,
// spec, why, legal, faq, close); any block a part does not place is still printed in that part. Classes: v-.
import fs from 'node:fs';
import path from 'node:path';
import * as shell from './shell.mjs';
import { esc, escA, href, linkAttrs, isExternal, gimg, img, absUrl, menu, rewriteLinks, liveHref, localPhoto, stripTags, demoForm, slugify } from './util.mjs';
import { ROOT } from '../lib/paths.mjs';

const { page, crumbsHtml, icon, hoursHtml, specTable } = shell;
const HOME = { href: '/', label: 'Home' };
const HUB = { href: '/cannabis-delivery-brooklyn/', label: 'Cannabis Delivery Brooklyn' };

// ---------- small helpers ----------
const norm = (s) => stripTags(String(s ?? '')).replace(/\s+/g, ' ').trim();
const key = (s) => norm(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
const isHead = (b) => b && /^h[1-6]$/.test(b.type || '');
const textOf = (b) => norm(b && (b.text ?? b.html ?? b.title ?? ''));
const itemHtml = (it) => (typeof it === 'string' ? it : (it && (it.html || esc(it.text || it.title || ''))) || '');
const pad2 = (n) => String(n).padStart(2, '0');
// captured links into live pages the rebuild does not carry go to their kept equivalents: the live /categories/<cat>/
// archives -> /products/<cat>/ (in-site shop navigation, D4), the live /faqs/ -> /brooklyn-dispensary-faqs/
const CAT_SLUGS = new Set(['flower', 'pre-rolls', 'vapes', 'edibles', 'concentrates', 'tinctures', 'topicals', 'accessories']);
const kept = (u) => String(u).replace(/^\/categories\/([a-z-]+)\/(?=$|[?#])/, (m, c) => (CAT_SLUGS.has(c) ? `/products/${c}/` : m)).replace(/^\/faqs\/(?=$|[?#])/, '/brooklyn-dispensary-faqs/');
const rw = (h) => rewriteLinks(h).replace(/(<a\b[^>]*?\shref=")([^"]*)"/gi, (m, pre, u) => pre + kept(u) + '"');
const extIco = (u) => (isExternal(u) && !/^(tel|mailto|sms):/i.test(u) ? icon('ext') : icon('arrow'));
const isNum = (b) => b && !isHead(b) && b.type === 'p' && /^0?\d{1,2}\.?$/.test(textOf(b));

function photoOf(src) {
  const lp = localPhoto(src);
  if (!lp || !lp.src) return null;
  const f = path.join(ROOT, lp.src.replace(/^\//, '').split(/[?#]/)[0]);
  return fs.existsSync(f) ? lp : null;
}
function photoImg(b, opts = {}) {
  const lp = photoOf(b.src);
  if (!lp) return '';
  return img({ src: lp.src, alt: norm(b.alt), w: lp.w || b.w, h: lp.h || b.h }, { sizes: '(min-width: 1024px) 480px, 90vw', ...opts });
}

// order buttons leave for BUZZY's live menu; every other captured button keeps its own (rewritten) link
const ORDER_RE = /^(order|shop|browse|check my address|view our menu|view the menu)/i;
function btnUrl(ctx, b) {
  const t = norm(b.text);
  const u = b.href ? kept(liveHref(b.href)) : '';
  if (u && !u.startsWith('#') && !/getbuzzy\.com\/menu\/?$/i.test(u)) return u;
  if (/zone map/i.test(t)) return '/cannabis-delivery-brooklyn-map/';
  if (/call/i.test(t)) return ctxPhone;
  if (/direction/i.test(t)) return ctxMap;
  return ORDER_RE.test(t) ? menu(ctx) : (u || menu(ctx));
}
let ctxPhone = 'tel:+17182528999';
let ctxMap = '#';
const btn = (ctx, b, cls = 'btn') => { const u = btnUrl(ctx, b); return `<a class="${cls}"${linkAttrs(u)}>${esc(norm(b.text))}${extIco(u)}</a>`; };

// ---------- one captured block -> html (every text field printed) ----------
function blk(ctx, b, st = {}) {
  if (!b) return '';
  switch (b.type) {
    case 'p': return `<p>${rw(b.html ?? esc(b.text || ''))}</p>`;
    case 'h1': return `<p class="v-sub">${esc(b.text)}</p>`;
    case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': { const n = Math.min(6, Math.max(st.min || 3, Number(b.type[1]))); return `<h${n} class="v-h">${esc(b.text)}</h${n}>`; }
    case 'ul': case 'ol': return `<${b.type} class="v-list">${(b.items || []).map((it) => `<li>${rw(itemHtml(it))}</li>`).join('')}</${b.type}>`;
    case 'img': { const im = photoImg(b); return im ? `<figure class="frame v-fig"><span class="frame__img">${im}</span>${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>` : (b.caption ? `<p>${esc(b.caption)}</p>` : ''); }
    case 'video': { const im = b.poster ? photoImg({ src: b.poster, alt: '' }) : ''; return (im ? `<figure class="frame v-fig"><span class="frame__img">${im}</span></figure>` : '') + (b.text || b.caption ? `<p>${esc(b.text || b.caption)}</p>` : ''); }
    case 'button': return `<p class="btn-row">${btn(ctx, b, st.btnCls || 'btn')}</p>`;
    case 'quote': return `<blockquote class="v-quote"><p>${rw(b.html ?? esc(b.text || ''))}</p>${b.cite ? `<cite>${esc(b.cite)}</cite>` : ''}</blockquote>`;
    case 'faq': return faqHtml(b.items || []);
    case 'icon-box': { const ic = b.icon ? photoOf(b.icon) : null; return `<div class="v-ibox">${ic ? `<span class="v-ibox__ico" aria-hidden="true">${img({ src: ic.src, alt: '', w: ic.w, h: ic.h }, { sizes: '56px' })}</span>` : ''}${b.title ? `<h${st.min || 3} class="v-ibox__t">${esc(b.title)}</h${st.min || 3}>` : ''}${b.html ? `<div class="v-ibox__b">${rw(b.html)}</div>` : b.text ? `<p>${esc(b.text)}</p>` : ''}</div>`; }
    case 'form': return formHtml(b);
    case 'embed': return embedHtml(ctx, b);
    case 'table': case 'hours': return rowsHtml(b);
    case 'steps': { const its = (b.items || []).map(stepItem); return stepsHtml(its) + (its.some((it) => it.text) ? `<ol class="v-track" role="list">${its.map((it) => `<li class="v-track__i"><span class="v-track__dot" aria-hidden="true"></span><span class="v-track__t">${esc(it.text)}</span></li>`).join('')}</ol>` : ''); }
    case 'cards': return `<ul class="v-cards" role="list">${(b.items || []).map((it, i) => cardHtml(ctx, it, i)).join('')}</ul>`;
    default: return b.html ? `<div>${rw(b.html)}</div>` : b.text ? `<p>${esc(b.text)}</p>` : '';
  }
}
function blocks(ctx, list, st = {}) {
  const out = []; let row = [];
  const flush = () => { if (row.length) out.push(`<div class="btn-row v-btns">${row.join('')}</div>`); row = []; };
  for (const b of list) {
    if (b.type === 'button') { row.push(btn(ctx, b, row.length ? (st.btnAlt || 'btn btn--ghost') : (st.btnCls || 'btn'))); continue; }
    flush(); out.push(blk(ctx, b, st));
  }
  flush();
  return out.join('\n');
}
function faqHtml(items) {
  return `<div class="faq v-faq">${items.map((it, i) => `<details class="v-faq__item"${i === 0 ? ' open' : ''}><summary><span class="v-faq__q">${esc(norm(it.q))}</span><span class="v-faq__ico" aria-hidden="true">${icon('plus')}</span></summary><div class="v-faq__a">${rw(it.a_html || esc(it.a || ''))}</div></details>`).join('\n')}</div>`;
}
function rowsHtml(b) {
  const rows = (b.rows || []).map((r) => [].concat(r));
  if (!rows.length) return b.title ? `<p>${esc(b.title)}</p>` : '';
  return `${b.title ? `<p class="v-label">${esc(b.title)}</p>` : ''}<dl class="spec v-spec">${rows.map((r) => `<div class="spec__row"><dt>${esc(r[0])}</dt><dd>${esc(r.slice(1).join(' '))}</dd></div>`).join('')}</dl>`;
}
function formHtml(b) {
  const fields = (b.fields || []).map((f) => (typeof f === 'string' ? f : f.label || f.name || f.placeholder || '')).filter(Boolean);
  const consent = b.consent ? `<p class="demo-form__check v-consent"><span class="v-consent__box" aria-hidden="true"></span>${esc(norm(b.consent))}</p>` : '';
  const extra = [b.text, b.html].filter(Boolean).map((t) => `<p class="v-form__msg">${rw(t)}</p>`).join('');
  // the live form's own status lines stay hidden until a submit, as on the live page (site.js shows the demo note)
  const msgs = [b.success, b.error, ...(Array.isArray(b.messages) ? b.messages : [])].filter(Boolean).map((t) => `<p class="v-form__msg" hidden>${esc(t)}</p>`).join('');
  return `<div class="v-form">${demoForm({ fields: fields.length ? fields : ['Email'], button: norm(b.button) || 'Submit', cls: 'v-form__f' })}${consent}${extra}${msgs}</div>`;
}
function embedHtml(ctx, b) {
  const src = String(b.src || '');
  const isMap = /google\.[a-z.]+\/maps|maps\.google/i.test(src);
  if (!isMap) return b.note ? `<p>${esc(b.note)}</p>` : '';
  const my = /\/maps\/d\//.test(src);
  const open = my ? src.replace('/maps/d/embed', '/maps/d/viewer') : ctx.site.mapUrl;
  return `<figure class="v-map glass" data-reveal><div class="v-map__frame"><iframe src="${escA(src)}" title="${escA(my ? 'BUZZY delivery zone map' : 'Map of BUZZY, 137 Court Street')}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>
<figcaption class="v-map__cap">${b.note ? `<span>${esc(b.note)}</span>` : ''}<a class="link-arrow"${linkAttrs(open)}>${my ? 'Open the delivery zone map' : 'Open in Google Maps'}${icon('ext')}</a></figcaption></figure>`;
}
function stepsHtml(items, cls = '') {
  return `<ol class="steps v-steps ${cls}" role="list">${items.map((it, i) => `<li class="step v-step glass glass--lift" data-reveal style="--i:${i % 5}">
<span class="step__num numeral v-step__n" aria-hidden="true">${esc(String(it.num || pad2(i + 1)).replace(/\.$/, '').padStart(2, '0'))}</span>
${it.title ? `<h3 class="step__title v-step__t">${esc(norm(it.title))}</h3>` : ''}
${it.html ? `<div class="step__text v-step__b">${rw(it.html)}</div>` : ''}
${(it.rest || []).length ? `<div class="v-step__b">${it.rest}</div>` : ''}
</li>`).join('\n')}</ol>`;
}
function cardHtml(ctx, it, i) {
  const u = it.href ? kept(liveHref(it.href)) : '';
  const pic = it.img && (it.img.src || typeof it.img === 'string') ? photoImg(typeof it.img === 'string' ? { src: it.img, alt: '' } : it.img, { sizes: '(min-width: 1024px) 300px, 70vw' }) : '';
  return `<li class="v-card glass glass--lift" data-reveal style="--i:${i % 4}">${pic ? `<span class="v-card__media">${pic}</span>` : ''}
${it.title ? `<h3 class="v-card__t">${u ? `<a${linkAttrs(u)}>${esc(it.title)}</a>` : esc(it.title)}</h3>` : ''}
${it.html ? `<div class="v-card__b">${rw(it.html)}</div>` : it.text ? `<p>${esc(it.text)}</p>` : ''}
${it.label ? `<p class="v-card__more">${u ? `<a class="link-arrow"${linkAttrs(u)}>${esc(it.label)}${extIco(u)}</a>` : esc(it.label)}</p>` : ''}</li>`;
}

// ---------- captured record -> one flat block list (section headings become h2 unless they repeat a block) ----------
function flat(rec) {
  const h1 = norm(rec.h1);
  const out = [];
  for (const s of rec.sections || []) {
    const head = norm(s.heading);
    const bl = s.blocks || [];
    const dup = !head || head === h1 || bl.some((b) => [b.text, b.title].some((t) => typeof t === 'string' && norm(t) === head));
    if (!dup) out.push({ type: 'h2', text: s.heading, sec: true });
    for (const b of bl) { if (b.type === 'h1' && norm(b.text) === h1) continue; out.push(b); }
  }
  return out;
}
// lane builds before CAPTURE lands: the plain text of the live page as paragraph blocks (never used once JSON exists)
function txtRecord(p, h1re) {
  const f = path.join(ROOT, 'tmp/txt', p.replace(/^\/|\/$/g, '').replace(/\//g, '__') + '.txt');
  if (process.env.ALLOW_MISSING_GEN !== '1' || !fs.existsSync(f)) return null;
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  const title = lines[0];
  let n = 0; let s = -1; let e = lines.length;
  lines.forEach((l, i) => { if (l === 'Neighborhood Map' && ++n === 2) s = i + 1; });
  for (let i = s; i < lines.length; i++) if (/^Open 8am . 10pm Everyday$/.test(lines[i])) { e = i; break; }
  if (s < 0) return null;
  const body = lines.slice(s, e).filter((l) => l.trim() && l.trim() !== '>' && l.trim() !== '.');
  const hi = body.findIndex((l) => h1re.test(l));
  const h1 = hi >= 0 ? body[hi] : body[0];
  const bl = body.filter((l, i) => i !== (hi >= 0 ? hi : 0)).map((l) => (/^(order|shop|browse|view|check my|get it|get directions|call|more about|explore the|read more|see you)/i.test(l) && l.length < 40 ? { type: 'button', text: l } : { type: 'p', html: esc(l) }));
  return { slug: p, path: p, title, description: '', h1, sections: [{ heading: '', blocks: bl }], fromTxt: true };
}

// ---------- the delivery template: parts by BUZZY's own words ----------
const PARTS = [
  ['steps', /^fast and direct$|how buzzy delivery works/],
  ['menu', /^shop for delivery$|brooklyns finest selection|everything on the buzzy menu/],
  ['areas', /^now dispatching$|where we deliver in brooklyn|^cannabis delivery across/],
  ['notify', /delivery zone expanding soon/],
  ['zips', /^delivery coverage$|zip codes we deliver to/],
  ['cats', /^shop by category$|jump straight to what you want/],
  ['spec', /everything you need to know/],
  ['why', /^the buzzy standard$|why choose buzzy/],
  ['legal', /nys ocm compliant|is cannabis delivery legal in brooklyn/],
  ['faq', /delivery faqs/],
  ['close', /now comes to you|^ready\?? we deliver/],
];
const kx = (b) => textOf(b).toLowerCase().replace(/&/g, 'and').replace(/[’']/g, '').replace(/[^a-z0-9?]+/g, ' ').trim();
function cutParts(list) {
  const parts = { hero: [] }; let cur = 'hero'; let at = 0;
  for (const b of list) {
    const t = kx(b);
    const hit = PARTS.findIndex(([, re], i) => i >= at && re.test(t) && (isHead(b) || b.type === 'p') && t.length < 90);
    if (hit >= 0 && PARTS[hit][0] !== cur) { cur = PARTS[hit][0]; at = hit + 1; parts[cur] = []; }
    parts[cur].push(b);
  }
  return parts;
}
// leading short lines = kicker + sub-heading; the main heading = the first h2 (or the last short leading line)
function headOf(list) {
  const first = list.slice(0, 4);
  let hIdx = first.findIndex((b) => b.type === 'h2');
  if (hIdx < 0) hIdx = first.findIndex((b) => isHead(b));
  if (hIdx < 0) hIdx = first.findIndex((b) => b.type === 'p' && textOf(b).length <= 60 && !/[.!:]$/.test(textOf(b)) && b.role !== 'kicker' && b.role !== 'link');
  const kick = first.filter((b, i) => i !== hIdx && b.type === 'p' && (b.role === 'kicker' || (i === hIdx - 1 && textOf(b).length <= 40 && !/[.!:]$/.test(textOf(b)) && b.role !== 'link')));
  const h = hIdx >= 0 ? first[hIdx] : null;
  return { kicker: kick, h, after: [], rest: list.filter((b) => b !== h && !kick.includes(b)) };
}
function headHtml(hd, id, { accent = '' } = {}) {
  const kick = hd.kicker.map((b) => `<p class="kicker">${esc(textOf(b))}</p>`).join('');
  const after = hd.after.map((b) => `<p class="v-head__sub">${esc(textOf(b))}</p>`).join('');
  return `<header class="v-head" data-reveal>${kick}${hd.h ? `<h2 class="display v-head__h" id="${escA(id)}">${esc(textOf(hd.h))}</h2>` : ''}${after}</header>`;
}
// numbered runs: "01" + title + text (or steps / icon-box / h3 blocks) -> items
function numbered(list) {
  const items = []; const rest = [];
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.type === 'steps') { for (const it of b.items || []) items.push(stepItem(it)); continue; }
    if (b.type === 'cards') { for (const it of b.items || []) items.push(stepItem(it)); continue; }
    if (b.type === 'icon-box') { items.push({ title: b.title, html: b.html || esc(b.text || '') }); continue; }
    if (isNum(b) && list[i + 1] && list[i + 2] && list[i + 2].type === 'p' && !isNum(list[i + 2])) { items.push({ num: textOf(b), title: textOf(list[i + 1]), html: list[i + 2].html ?? esc(list[i + 2].text || '') }); i += 2; continue; }
    if ((b.type === 'h3' || b.type === 'h4') && list[i + 1] && list[i + 1].type === 'p' && !isNum(list[i + 1])) { items.push({ title: textOf(b), html: list[i + 1].html ?? esc(list[i + 1].text || '') }); i += 1; continue; }
    if (isNum(b) && list[i + 1] && isHead(list[i + 1])) { items.push({ num: textOf(b), title: textOf(list[i + 1]), html: '' }); i += 1; continue; }
    rest.push(b);
  }
  return { items, rest };
}
// "01<br>Browse full menu" -> numeral 01 + body; the plain text copy rides on the tracking bar (steps only)
function stepItem(it) {
  const h = String(it.html || esc(it.text || ''));
  const m = h.match(/^\s*(\d{1,2})\s*<br\s*\/?>\s*/i);
  return { num: m ? m[1] : it.num, title: it.title || it.titleRaw || '', html: m ? h.slice(m[0].length) : h, text: it.html && it.text ? it.text : '' };
}
function faqItems(list) {
  const items = []; const rest = [];
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.type === 'faq') { items.push(...(b.items || [])); continue; }
    const t = textOf(b);
    if (/\?$/.test(t) && t.length < 160 && list[i + 1] && list[i + 1].type === 'p' && !/\?$/.test(textOf(list[i + 1]))) { items.push({ q: t, a_html: list[i + 1].html ?? esc(list[i + 1].text || '') }); i++; continue; }
    rest.push(b);
  }
  return { items, rest };
}
function specRows(list) {
  const rows = []; const rest = [];
  const tbl = list.find((b) => b.type === 'table' || b.type === 'hours');
  if (tbl) { for (const r of tbl.rows || []) rows.push([].concat(r)); return { rows, rest: list.filter((b) => b !== tbl), title: tbl.title }; }
  const shortP = list.filter((b) => b.type === 'p' && textOf(b).length < 60);
  if (shortP.length >= 4) { for (let i = 0; i + 1 < shortP.length; i += 2) rows.push([textOf(shortP[i]), textOf(shortP[i + 1])]); return { rows, rest: list.filter((b) => !shortP.includes(b)) }; }
  return { rows, rest: list };
}
const lfaq = (items) => (items.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map((it) => ({ '@type': 'Question', name: norm(it.q), acceptedAnswer: { '@type': 'Answer', text: norm(it.a_html || it.a || '') } })) }] : []);

// ---------- page hero (inner-page pattern: sky ground, grid, registration marks, protruding object) ----------
function hero({ crumbs, kicker = '', h1, lede = '', sub = '', ctas = [], side = '', bg = 'g-sky-field', cut = '', mod = '', extra = '' }) {
  return `<section class="page-hero band band--sky v-hero ${mod}">
<div class="band__clip" aria-hidden="true"><span class="band__bg v-hero__bg">${gimg(bg, { alt: '', eager: true, sizes: '100vw' })}</span><span class="v-hero__scrim"></span><span class="v-grid"></span></div>
<div class="wrap v-hero__in">
<div class="v-hero__text">
${crumbsHtml(crumbs)}
${kicker ? `<p class="kicker v-hero__kicker">${kicker}</p>` : ''}
<h1 class="display v-hero__h1">${h1}</h1>
${lede ? `<p class="lede v-hero__lede">${lede}</p>` : ''}
${sub}
${ctas.length ? `<div class="btn-row v-hero__ctas">${ctas.join('')}</div>` : ''}
${extra}
</div>
${side ? `<div class="v-hero__side" data-reveal style="--i:1">${side}</div>` : ''}
</div>
${cut ? `<span class="cut protrude v-hero__cut" aria-hidden="true" data-float data-depth="0.12">${gimg(cut, { alt: '', sizes: '(min-width: 1024px) 260px, 140px' })}</span>` : ''}
</section>`;
}
const orderBtn = (ctx, label = 'Order for Delivery', cls = 'btn btn--signal') => `<a class="${cls}"${linkAttrs(menu(ctx))}>${esc(label)}${icon('ext')}</a>`;
function out(ctx, { path: p, title, description, crumbs, main, mod, jsonld = [] }) {
  return { path: p, html: page({ ctx, path: p, title, description, canonical: absUrl(ctx, p), og: { title, description, type: 'website', url: absUrl(ctx, p) }, jsonld: [crumbLd(ctx, crumbs), ...jsonld], bodyClass: `v-page v-page--${mod}`, main, crumbs, heroCrumbs: true }) };
}
const crumbLd = (ctx, crumbs) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: absUrl(ctx, c.href) })) });

// the glass dispatch ticket in the delivery hero: BUZZY's own delivery facts (site.json, verbatim)
function dispatchTicket(ctx, { title = 'Delivery', streets = [] } = {}) {
  const d = ctx.site.delivery || {};
  const facts = (d.facts || []).slice(0, 5);
  return `<div class="v-ticket glass glass--strong" data-spot>
<p class="v-ticket__top"><span class="tag tag--ink">${icon('truck')}${esc(title)}</span><span class="v-ticket__live"><span class="v-dot" aria-hidden="true"></span>${esc(facts.find((f) => /tracking/i.test(f[0])) ? 'Live Tracking' : '')}</span></p>
${specTable(facts, 'v-ticket__spec')}
${streets.length ? `<ul class="v-ticket__streets" role="list">${streets.map((s) => `<li class="chip">${esc(s)}</li>`).join('')}</ul>` : ''}
</div>`;
}

function deliveryPage(ctx, rec, { hub = false } = {}) {
  const p = href(rec.path);
  const list = flat(rec);
  const parts = cutParts(list);
  const name = rec.name || norm(String(rec.h1 || '').replace(/^cannabis delivery in\s+/i, '').replace(/,\s*brooklyn.*$/i, '')) || 'Brooklyn';
  const crumbs = hub ? [HOME, { href: p, label: 'Cannabis Delivery Brooklyn' }] : [HOME, HUB, { href: p, label: name }];
  // hero: captured breadcrumb words (neighborhood pages) + lede + order button + anything else before the steps
  const hb = parts.hero.filter((b) => !(b.type === 'p' && (/^(home|cannabis delivery brooklyn)$/i.test(textOf(b)) || /^(>|&gt;)?$/.test(String(b.html || b.text || '').trim()) || (!hub && key(b.html) === key(name)))));
  const crumbWords = parts.hero.filter((b) => !hb.includes(b));
  const lede = hb.find((b) => b.type === 'p' && textOf(b).length > 50 && !/^not in\b/i.test(textOf(b)));
  const ctas = hb.filter((b) => b.type === 'button').map((b, i) => btn(ctx, b, i ? 'btn btn--ghost' : 'btn btn--signal'));
  if (!ctas.length) ctas.push(orderBtn(ctx));
  ctas.push(`<a class="btn btn--glass"${linkAttrs('#areas')}>Delivery areas${icon('pin')}</a>`);
  const other = hb.filter((b) => b !== lede && b.type !== 'button');
  const note = other.length ? `<div class="v-hero__note">${blocks(ctx, other)}</div>` : '';
  void crumbWords; // the captured breadcrumb words are printed by the hero's breadcrumb nav
  const streetsPart = parts.areas ? parts.areas : [];
  const streets = hub ? [] : listItems(streetsPart).slice(0, 5);
  let main = hero({ crumbs, kicker: esc(hub ? 'Same-day delivery' : `Delivery / ${name}`), h1: esc(rec.h1), lede: lede ? rw(lede.html ?? esc(lede.text)) : '', ctas, side: dispatchTicket(ctx, { title: hub ? 'Brooklyn' : name, streets }), bg: 'g-delivery-dream', cut: 'g-cloud-cut', mod: 'v-hero--delivery', extra: note });
  if (hub) main += `<section class="band band--paper v-svc"><div class="wrap">${shell.serviceCards(ctx, { h: 2, cls: 'v-svc__pair' })}</div></section>`;
  const used = new Set(['hero']);
  const sec = (k, fn) => { if (!parts[k]) return ''; used.add(k); return fn(parts[k]); };
  main += sec('steps', (l) => stepsBand(ctx, l));
  main += sec('menu', (l) => menuBand(ctx, l, parts.cats ? (used.add('cats'), parts.cats) : null));
  main += areasBand(ctx, parts, used, { hub, name });
  main += sec('spec', (l) => specBand(ctx, l));
  main += sec('why', (l) => whyBand(ctx, l));
  main += sec('legal', (l) => legalBand(ctx, l));
  let faqs = [];
  main += sec('faq', (l) => { const r = faqBand(ctx, l); faqs = r.items; return r.html; });
  main += sec('close', (l) => closeBand(ctx, l));
  for (const k of Object.keys(parts)) if (!used.has(k)) main += genericBand(ctx, parts[k], k);
  const title = rec.title || `Cannabis Delivery in ${name}, Brooklyn | BUZZY`;
  return out(ctx, { path: p, title, description: rec.description || norm(lede && (lede.html || lede.text)) || title, crumbs, main, mod: hub ? 'hub' : 'area', jsonld: lfaq(faqs) });
}
// list items from ul/ol blocks or short loose lines
function listItems(list) {
  const out2 = [];
  for (const b of list) if (b.type === 'ul' || b.type === 'ol') for (const it of b.items || []) out2.push(norm(itemHtml(it)));
  return out2;
}

function stepsBand(ctx, l) {
  const hd = headOf(l);
  const { items, rest } = numbered(hd.rest);
  return `<section class="band band--paper band--grid v-sec v-steps-band" aria-labelledby="v-steps-h">
<div class="wrap">
${headHtml(hd, 'v-steps-h')}
${stepsHtml(items, 'v-steps--route')}
${items.some((it) => it.text) ? `<ol class="v-track" role="list" aria-label="Order status" data-reveal="wipe">${items.map((it) => `<li class="v-track__i"><span class="v-track__dot" aria-hidden="true"></span><span class="v-track__t">${esc(it.text)}</span></li>`).join('')}</ol>` : ''}
${rest.length ? `<div class="v-tail prose" data-reveal>${blocks(ctx, rest)}</div>` : ''}
</div>
</section>`;
}
const CAT = [[/flower/i, 'flower', 'g-cat-flower'], [/concentrate|rosin/i, 'concentrates', 'g-cat-concentrates'], [/edible|gumm/i, 'edibles', 'g-cat-edibles'], [/vape/i, 'vapes', 'g-cat-vapes'], [/pre-?roll/i, 'pre-rolls', 'g-cat-prerolls'], [/drink/i, 'drinks', 'g-cat-edibles'], [/tincture/i, 'tinctures', 'g-cat-tinctures'], [/topical/i, 'topicals', 'g-cat-topicals'], [/accessor/i, 'accessories', 'g-cat-accessories']];
const catOf = (t) => CAT.find(([re]) => re.test(t)) || null;
function catTiles(ctx, names) {
  return `<ul class="v-cats" role="list">${names.map((n, i) => { const c = catOf(n.text); const u = c ? (c[1] === 'drinks' ? menu(ctx, 'drinks') : `/products/${c[1]}/`) : menu(ctx); return `<li class="v-cat" data-reveal style="--i:${i % 4}"><a class="v-cat__a"${linkAttrs(u)}><span class="v-cat__media">${c ? gimg(c[2], { alt: '', sizes: '(min-width: 1024px) 220px, 42vw' }) : ''}</span><span class="v-cat__t">${esc(n.text)}</span>${n.sub ? `<span class="v-cat__s">${n.sub}</span>` : ''}<span class="v-cat__go">${n.cta ? esc(n.cta) : ''}${extIco(u)}</span></a></li>`; }).join('')}</ul>`;
}
function menuBand(ctx, l, cats) {
  const hd = headOf(l);
  let catHtml = '';
  if (cats) {
    const ch = headOf(cats);
    const names = ch.rest.filter((b) => textOf(b).length < 40 && b.type !== 'img').map((b) => ({ text: textOf(b) }));
    const left = ch.rest.filter((b) => !(textOf(b).length < 40 && b.type !== 'img'));
    catHtml = `<div class="v-menu__cats"><header class="v-head v-head--sm" data-reveal>${ch.kicker.map((b) => `<p class="kicker">${esc(textOf(b))}</p>`).join('')}${ch.h ? `<h3 class="v-head__h3">${esc(textOf(ch.h))}</h3>` : ''}${ch.after.map((b) => `<p class="v-head__sub">${esc(textOf(b))}</p>`).join('')}</header>${catTiles(ctx, names)}${left.length ? blocks(ctx, left) : ''}</div>`;
  }
  return `<section class="band band--sky v-sec v-menu" aria-labelledby="v-menu-h">
<div class="band__clip" aria-hidden="true"><span class="band__bg">${gimg('g-sky-field', { alt: '', sizes: '100vw' })}</span></div>
<div class="wrap v-menu__grid">
<div class="v-menu__text glass glass--strong" data-reveal>${headHtml(hd, 'v-menu-h')}<div class="prose">${blocks(ctx, hd.rest, { btnCls: 'btn btn--signal' })}</div></div>
<figure class="frame frame--float v-menu__art" data-reveal style="--i:1" data-depth="0.06"><span class="frame__img">${gimg('g-curation', { alt: '', sizes: '(min-width: 1024px) 420px, 80vw' })}</span></figure>
</div>
${catHtml ? `<div class="wrap">${catHtml}</div>` : ''}
</section>`;
}
// the dispatch board: neighborhoods (chips) + zips + the notify form, id="areas"
function areasBand(ctx, parts, used, { hub, name }) {
  if (!parts.areas && !parts.zips && !parts.notify) return '';
    const byName = (t) => DELIV.find((d) => d.slug === slugify(t)) || DELIV.find((d) => key(d.h1).includes(key(t)));
  const chip = (t) => { const d = t ? byName(t) : null; const u = d ? href(d.path) : null; return `<li>${u ? `<a class="chip v-chip"${linkAttrs(u)}>${icon('pin')}${esc(t)}</a>` : `<span class="chip v-chip">${esc(t)}</span>`}</li>`; };
  let board = '';
  if (parts.areas) {
    used.add('areas');
    const hd = headOf(parts.areas);
    const lists = hd.rest.filter((b) => b.type === 'ul' || b.type === 'ol');
    const looseNames = [];
    const restA = [];
    for (const b of hd.rest) {
      if (lists.includes(b)) continue;
      const t = textOf(b);
      if (b.type === 'p' && t.length <= 26 && !/[.:!?]$/.test(t) && !/^\d{5}$/.test(t)) looseNames.push(t); else restA.push(b);
    }
    // labels ("...deliver to:", "Nearby delivery areas:") stay in order before their list
    const flow = [];
    for (const b of hd.rest) {
      if (looseNames.includes(textOf(b)) && b.type === 'p') { const last = flow[flow.length - 1]; if (last && last.chips) last.chips.push(textOf(b)); else flow.push({ chips: [textOf(b)] }); continue; }
      if (b.type === 'ul' || b.type === 'ol') { flow.push({ chips: (b.items || []).map((it) => norm(itemHtml(it))), raw: b }); continue; }
      flow.push({ b });
    }
    const flowHtml = flow.map((f) => (f.chips ? `<ul class="v-chips" role="list">${f.chips.map(chip).join('')}</ul>` : f.b.type === 'button' ? `<p class="btn-row">${btn(ctx, f.b, 'btn btn--ghost')}</p>` : f.b.type === 'p' && /:$/.test(textOf(f.b)) ? `<p class="v-label">${rw(f.b.html ?? esc(f.b.text))}</p>` : blk(ctx, f.b))).join('\n');
    board = `<div class="v-board__main glass glass--strong" data-reveal>
<p class="v-board__bar"><span class="tag tag--signal">${esc(hd.kicker.map(textOf).join(' ') || 'Now dispatching')}</span><span class="v-board__live"><span class="v-dot" aria-hidden="true"></span>${esc(hub ? 'Brooklyn' : name)}</span></p>
${hd.h ? `<h2 class="display v-head__h" id="v-areas-h">${esc(textOf(hd.h))}</h2>` : ''}${hd.after.map((b) => `<p class="v-head__sub">${esc(textOf(b))}</p>`).join('')}
<div class="v-board__flow prose">${flowHtml}</div>
</div>`;
  }
  let zips = '';
  if (parts.zips) {
    used.add('zips');
    const hd = headOf(parts.zips);
    const codes = []; const restZ = [];
    for (const b of hd.rest) { if (b.type === 'p' && /^\d{5}$/.test(textOf(b))) codes.push(textOf(b)); else if ((b.type === 'ul' || b.type === 'ol') && (b.items || []).every((it) => /^\d{5}$/.test(norm(itemHtml(it))))) codes.push(...b.items.map((it) => norm(itemHtml(it)))); else restZ.push(b); }
    zips = `<div class="v-board__zips glass glass--dark" data-reveal style="--i:1">
${hd.kicker.map((b) => `<p class="kicker">${esc(textOf(b))}</p>`).join('')}${hd.h ? `<h3 class="v-board__h">${esc(textOf(hd.h))}</h3>` : ''}${hd.after.map((b) => `<p>${esc(textOf(b))}</p>`).join('')}
<div class="v-board__zipsb prose">${blocks(ctx, restZ)}</div>
<ul class="v-zips" role="list">${codes.map((z) => `<li class="v-zip"><span class="v-zip__k">ZIP</span><span class="v-zip__v">${esc(z)}</span></li>`).join('')}</ul>
</div>`;
  }
  let notify = '';
  if (parts.notify) {
    used.add('notify');
    const hd = headOf(parts.notify);
    const form = hd.rest.find((b) => b.type === 'form');
    const loose = hd.rest.filter((b) => b !== form);
    // the captured form words (fields, consent, button, the two status lines) when the form came as loose lines
    const fieldWords = loose.filter((b) => /^email$/i.test(textOf(b)));
    const consent = loose.find((b) => /^i consent/i.test(textOf(b)));
    const sub = loose.find((b) => (b.type === 'button' || b.type === 'p') && /^submit$/i.test(textOf(b)));
    const rest = loose.filter((b) => !fieldWords.includes(b) && b !== consent && b !== sub);
    const f = form || { type: 'form', fields: fieldWords.length ? fieldWords.map(textOf) : ['Email'], consent: consent ? textOf(consent) : '', button: sub ? textOf(sub) : 'Submit' };
    notify = `<div class="v-board__notify glass" data-reveal style="--i:2">
${hd.kicker.map((b) => `<p class="kicker">${esc(textOf(b))}</p>`).join('')}${hd.h ? `<h3 class="v-board__h">${esc(textOf(hd.h))}</h3>` : ''}${hd.after.map((b) => `<p>${esc(textOf(b))}</p>`).join('')}
<div class="prose">${rest.map((b) => blk(ctx, b)).join('')}</div>
${formHtml(f)}
</div>`;
  }
  return `<section class="band band--fog band--grid v-sec v-board" id="areas" aria-labelledby="v-areas-h">
<div class="band__clip" aria-hidden="true"><span class="v-board__glow"></span></div>
<div class="wrap v-board__grid${zips ? '' : ' v-board__grid--two'}">
${board}
${zips || notify ? `<div class="v-board__side">${zips}${notify}</div>` : ''}
</div>
<span class="cut protrude v-board__cut" aria-hidden="true" data-float data-depth="0.1">${gimg('g-stoop-cut', { alt: '', sizes: '(min-width: 1024px) 220px, 120px' })}</span>
</section>`;
}
function specBand(ctx, l) {
  const hd = headOf(l);
  const { rows, rest } = specRows(hd.rest);
  // a header row ("SERVICE" / "DETAILS") is the table's column labels
  const headRow = rows.length && /^service$/i.test(rows[0][0]) ? rows.shift() : null;
  return `<section class="band band--paper v-sec v-specs" aria-labelledby="v-spec-h">
<div class="wrap v-specs__grid">
<div class="v-specs__text">${headHtml(hd, 'v-spec-h')}${rest.length ? `<div class="prose" data-reveal>${blocks(ctx, rest)}</div>` : ''}</div>
<div class="v-specs__sheet" data-reveal style="--i:1">
${headRow ? `<p class="v-specs__cols" aria-hidden="false"><span>${esc(headRow[0])}</span><span>${esc(headRow.slice(1).join(' '))}</span></p>` : ''}
<dl class="spec v-spec v-spec--big">${rows.map((r, i) => `<div class="spec__row"><dt><span class="v-spec__n" aria-hidden="true">${pad2(i + 1)}</span>${esc(r[0])}</dt><dd>${esc(r.slice(1).join(' '))}</dd></div>`).join('')}</dl>
</div>
</div>
</section>`;
}
function whyBand(ctx, l) {
  const hd = headOf(l);
  const { items, rest } = numbered(hd.rest);
  return `<section class="band band--fog v-sec v-why" aria-labelledby="v-why-h">
<div class="wrap">
${headHtml(hd, 'v-why-h')}
<ol class="v-why__list" role="list">${items.map((it, i) => `<li class="v-why__item glass glass--lift" data-reveal data-tilt style="--i:${i % 5}"><span class="numeral v-why__n" aria-hidden="true">${esc(String(it.num || pad2(i + 1)).padStart(2, '0'))}</span><h3 class="v-why__t">${esc(norm(it.title))}</h3><div class="v-why__b">${rw(it.html || '')}</div></li>`).join('\n')}</ol>
${rest.length ? `<div class="v-tail prose" data-reveal>${blocks(ctx, rest)}</div>` : ''}
</div>
</section>`;
}
function legalBand(ctx, l) {
  const hd = headOf(l);
  const lic = hd.rest.findIndex((b) => /^ocm-retl-/i.test(textOf(b)));
  const label = lic > 0 && textOf(hd.rest[lic - 1]).length < 60 ? lic - 1 : -1;
  const before = hd.rest.slice(0, label >= 0 ? label : lic >= 0 ? lic : hd.rest.length);
  const after = lic >= 0 ? hd.rest.slice(lic + 1) : [];
  return `<section class="band band--night v-sec v-legal" aria-labelledby="v-legal-h">
<div class="band__clip" aria-hidden="true"><span class="band__bg v-legal__bg">${gimg('g-night-sky', { alt: '', sizes: '100vw' })}</span><span class="v-grid v-grid--dark"></span></div>
<div class="wrap v-legal__grid">
<div class="v-legal__text">${headHtml(hd, 'v-legal-h')}<div class="prose" data-reveal>${blocks(ctx, before, { btnCls: 'btn btn--light' })}</div></div>
${lic >= 0 ? `<div class="v-licence glass glass--dark" data-reveal style="--i:1">${label >= 0 ? `<p class="v-licence__k">${esc(textOf(hd.rest[label]))}</p>` : ''}<p class="v-licence__v">${esc(textOf(hd.rest[lic]))}</p><div class="v-licence__b">${blocks(ctx, after, { btnCls: 'btn btn--light' })}</div></div>` : ''}
</div>
</section>`;
}
function faqBand(ctx, l) {
  const hd = headOf(l);
  const { items, rest } = faqItems(hd.rest);
  return { items, html: `<section class="band band--paper v-sec v-faqs" aria-labelledby="v-faq-h">
<div class="wrap v-faqs__grid">
<div class="v-faqs__head">${headHtml(hd, 'v-faq-h')}${rest.length ? `<div class="prose" data-reveal>${blocks(ctx, rest)}</div>` : ''}</div>
<div class="v-faqs__list" data-reveal style="--i:1">${faqHtml(items)}</div>
</div>
</section>` };
}
function closeBand(ctx, l) {
  const hd = headOf(l);
  const lines = hd.rest.filter((b) => b.type === 'p' && /·/.test(textOf(b)));
  const body = hd.rest.filter((b) => !lines.includes(b));
  return `<section class="band band--signal v-sec v-close" aria-labelledby="v-close-h">
<div class="wrap v-close__in">
${headHtml(hd, 'v-close-h')}
<div class="v-close__b prose" data-reveal>${blocks(ctx, body, { btnCls: 'btn' })}</div>
${lines.map((b) => `<p class="v-close__line" data-reveal>${esc(textOf(b)).replace(/ · /g, '<span class="v-sep" aria-hidden="true"> / </span><span class="sr-only"> · </span>')}</p>`).join('')}
</div>
</section>`;
}
function genericBand(ctx, l, k, i = 0) {
  if (!l || !l.length) return '';
  const hd = headOf(l);
  const id = 'v-' + slugify(k) + '-h';
  const { items: faqs, rest: r1 } = faqItems(hd.rest);
  return `<section class="band ${i % 2 ? 'band--fog' : 'band--paper'} v-sec v-gen" aria-labelledby="${escA(id)}">
<div class="wrap">${headHtml(hd, id)}<div class="prose v-gen__b" data-reveal>${blocks(ctx, r1)}</div>${faqs.length ? faqHtml(faqs) : ''}</div>
</section>`;
}

// ---------- generic captured pages (map, tourists, hotel, visit, nyc rules): hero + alternating sections ----------
function segs(list) {
  const out2 = []; let cur = null;
  for (const b of list) {
    if (b.type === 'h2' || (b.sec && isHead(b))) { cur = { head: b, blocks: [] }; out2.push(cur); continue; }
    if (!cur) { cur = { head: null, blocks: [] }; out2.push(cur); }
    cur.blocks.push(b);
  }
  return out2;
}
function heroSplit(list, h1) {
  // hero = everything before the first h2 that follows a paragraph or button
  let cut = list.findIndex((b, i) => b.type === 'h2' && list.slice(0, i).some((x) => x.type === 'p' || x.type === 'button'));
  if (cut < 0) cut = list.length;
  return { heroBl: list.slice(0, cut), rest: list.slice(cut) };
}
// a captured paragraph that is one whole link (role "link") is a button on the live page
function asBtn(b) {
  if (!b || b.type !== 'p' || b.role !== 'link') return b;
  const h = String(b.html || '');
  const m = h.match(/^\s*<a\b[^>]*?\shref="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*$/i);
  if (!m || /<a\b/i.test(m[2])) return b;
  return { type: 'button', text: norm(m[2]), href: m[1].replace(/&amp;/g, '&') };
}
function genericPage(ctx, rec, { mod, bg = 'g-sky-field', art = '', cut = 'g-cloud-cut', crumbLabel, kicker = '' }) {
  const p = href(rec.path);
  const crumbs = [HOME, { href: p, label: crumbLabel || norm(rec.h1) }];
  const list = flat(rec).map(asBtn);
  const { heroBl, rest } = heroSplit(list);
  const kick = heroBl.filter((b, i) => i < 2 && textOf(b).length <= 70 && (isHead(b) || b.type === 'p') && !/[.!]$/.test(textOf(b)) && heroBl.slice(i + 1).some((x) => x.type === 'p'));
  const lede = heroBl.find((b) => b.type === 'p' && !kick.includes(b));
  const ctas = heroBl.filter((b) => b.type === 'button').map((b, i) => btn(ctx, b, i ? 'btn btn--ghost' : 'btn btn--signal'));
  if (!ctas.length) ctas.push(orderBtn(ctx, 'Shop Now'));
  // the captured hero background photos (desktop + mobile copies of one image, alt '') become the framed hero photo
  const bgImgs = heroBl.filter((b) => b.type === 'img' && b.role === 'background');
  // A wide captured strip (visit-us: a 1920x322 skyline drawing) cannot fill the 4:5 hero frame: the frame takes
  // BUZZY's own storefront photo instead and the strip runs full width in its own band right under the hero.
  const lp0 = bgImgs.length ? photoOf(bgImgs[0].src) : null;
  const wide = !!(lp0 && (lp0.w || bgImgs[0].w) / (lp0.h || bgImgs[0].h || 1) > 2.2);
  if (wide && !art) art = img({ src: '/assets/photos/bz/buzzy.exterior.streetcrop-copy.webp', alt: 'Illustration of the BUZZY storefront on Court Street', w: 800, h: 964 }, { eager: true, sizes: '(min-width: 1024px) 420px, 80vw' });
  const strip = wide ? `<div class="band band--paper v-strip" aria-hidden="true"><div class="wrap wrap--wide">${photoImg(bgImgs[0], { sizes: '(min-width: 1480px) 1480px, 100vw' }).replace('<img ', '<img class="v-strip__img" ')}</div></div>` : '';
  const heroPic = !art && bgImgs.length ? photoImg(bgImgs[0], { eager: true, sizes: '(min-width: 1024px) 420px, 80vw' }) : '';
  const restHero = heroBl.filter((b) => !kick.includes(b) && b !== lede && b.type !== 'button' && !bgImgs.includes(b));
  const extra = restHero.length ? `<div class="v-hero__more prose">${blocks(ctx, restHero, { min: 2 })}</div>` : '';
  const side = art || heroPic ? `<figure class="frame frame--float v-hero__frame" data-depth="0.05"><span class="frame__img">${art || heroPic}</span></figure>` : '';
  let main = hero({ crumbs, kicker: kick.map((b) => esc(textOf(b))).join(' ') || esc(kicker), h1: esc(rec.h1), lede: lede ? rw(lede.html ?? esc(lede.text || '')) : '', ctas, side, bg, cut, mod: 'v-hero--' + mod, extra }) + strip;
  const sg = segs(rest);
  const faqsAll = [];
  let flip = 0;
  main += sg.map((s, i) => {
    const t = s.head ? textOf(s.head) : '';
    const id = 'v-s' + i + '-h';
    const { items: faqs, rest: r1 } = faqItems(s.blocks);
    faqsAll.push(...faqs);
    const nums = numbered(r1);
    const ground = i % 2 ? 'band--fog' : 'band--paper';
    const pics = r1.filter((b) => b.type === 'img' && photoOf(b.src));
    const embeds = r1.filter((b) => b.type === 'embed');
    const headH = s.head ? `<header class="v-head" data-reveal><h2 class="display v-head__h" id="${id}">${esc(t)}</h2></header>` : '';
    if (faqs.length) {
      return `<section class="band ${ground} v-sec v-faqs"${s.head ? ` aria-labelledby="${id}"` : ''}><div class="wrap v-faqs__grid"><div class="v-faqs__head">${headH}${r1.length ? `<div class="prose" data-reveal>${blocks(ctx, r1)}</div>` : ''}</div><div class="v-faqs__list" data-reveal>${faqHtml(faqs)}</div></div></section>`;
    }
    if (nums.items.length >= 3) {
      return `<section class="band ${ground} band--grid v-sec"${s.head ? ` aria-labelledby="${id}"` : ''}><div class="wrap">${headH}${nums.rest.length ? `<div class="v-lead prose" data-reveal>${blocks(ctx, nums.rest)}</div>` : ''}${stepsHtml(nums.items, 'v-steps--grid')}</div></section>`;
    }
    if (embeds.length) {
      return `<section class="band band--sky v-sec v-mapband"${s.head ? ` aria-labelledby="${id}"` : ''}><div class="band__clip" aria-hidden="true"><span class="band__bg">${gimg('g-sky-field', { alt: '', sizes: '100vw' })}</span></div><div class="wrap">${headH}<div class="prose v-lead" data-reveal>${blocks(ctx, r1.filter((b) => !embeds.includes(b)))}</div>${embeds.map((b) => embedHtml(ctx, b)).join('')}</div></section>`;
    }
    const f = flip++ % 2;
    const pic = pics[0];
    const others = r1.filter((b) => b !== pic);
    const artHtml = pic ? `<figure class="frame v-split__art" data-reveal style="--i:1" data-depth="0.04"><span class="frame__img">${photoImg(pic, { sizes: '(min-width: 1024px) 460px, 90vw' })}</span></figure>` : '';
    return `<section class="band ${ground} v-sec v-split-band"${s.head ? ` aria-labelledby="${id}"` : ''}><div class="wrap${artHtml ? ` v-split${f ? ' v-split--flip' : ''}` : ''}"><div class="v-split__text">${headH}<div class="prose" data-reveal>${blocks(ctx, others)}</div></div>${artHtml}</div></section>`;
  }).join('\n');
  return out(ctx, { path: p, title: rec.title, description: rec.description || norm(lede && (lede.html || lede.text)) || rec.title, crumbs, main, mod, jsonld: lfaq(faqsAll) });
}

// ---------- /cannabis-delivery-brooklyn-map/ ----------
function mapPage(ctx, rec) {
  const has = flat(rec).some((b) => b.type === 'embed' && /maps\/d\//.test(b.src || ''));
  const r = genericPage(ctx, rec, { mod: 'map', bg: 'g-delivery-dream', cut: 'g-cloud-cut', crumbLabel: 'Delivery Zones & Map' });
  if (has) return r;
  // BUZZY's own My Maps delivery-zone embed (live page iframe) when the capture carries no embed block
  const fig = embedHtml(ctx, { src: 'https://www.google.com/maps/d/embed?mid=1XH4l5-SFLuZnyVkv8yGHBUnbLeVzQk4&ehbc=2E312F' });
  r.html = r.html.replace('</section>', `</section>\n<section class="band band--sky v-sec v-mapband" aria-label="Delivery zone map"><div class="band__clip" aria-hidden="true"><span class="band__bg">${gimg('g-sky-field', { alt: '', sizes: '100vw' })}</span></div><div class="wrap">${fig}</div></section>`);
  return r;
}

// ---------- /in-store-pickup/ (NEW: BUZZY's own words only; glue = labels) ----------
function findFaq(rec, re) {
  if (!rec) return null;
  const { items } = faqItems(flat(rec));
  return items.find((it) => re.test(norm(it.q))) || null;
}
function findAfter(rec, re) {
  if (!rec) return [];
  const list = flat(rec);
  const i = list.findIndex((b) => re.test(textOf(b)));
  if (i < 0) return [];
  const outL = [];
  for (let j = i + 1; j < list.length && outL.length < 4; j++) { if (isHead(list[j]) || list[j].type === 'button') break; outL.push(list[j]); }
  return outL;
}
function pickupPage(ctx) {
  const p = '/in-store-pickup/';
  const S = ctx.site;
  const crumbs = [HOME, { href: p, label: 'In-Store Pickup' }];
  const faq = ctx.content['brooklyn-dispensary-faqs'];
  const visit = ctx.content['visit-us'];
  const FAQP = '/brooklyn-dispensary-faqs/';
  const VISP = '/visit-us/';
  const q = (re) => findFaq(faq, re);
  const qa = [
    q(/order online for pickup/i) || { q: 'Can I order online for pickup?', a_html: esc(S.pickup.faq) },
    q(/dispensary hours/i),
    q(/check id/i),
    q(/credit card/i),
  ].filter(Boolean);
  // /visit-us/ "Directions to BUZZY" cards (Public Transit, Accessibility): quoted verbatim with a link to the page
  const card = (re) => { for (const b of (visit ? flat(visit) : [])) if (b.type === 'cards') for (const it of b.items || []) if (re.test(norm(it.title))) return [{ type: 'p', html: it.html }]; return findAfter(visit, re); };
  const transit = card(/^public transit$|^subway:?$/i);
  const bus = transit.some((b) => /bus:/i.test(String(b.html))) ? [] : findAfter(visit, /^bus:?$/i);
  const access = card(/^accessibility$/i);
  const quote = (bl, fallback) => (bl.length ? bl.map((b) => rw(b.html ?? esc(b.text || ''))).join(' ') : esc(fallback || ''));
  const a = S.address;
  const steps = [
    { title: 'Shop online', html: esc(S.pickup.faq) },
  ];
  const side = `<div class="v-ticket v-ticket--pickup glass glass--strong" data-spot>
<p class="v-ticket__top"><span class="tag tag--ink">${icon('bag')}Pickup</span><span class="v-ticket__live"><span class="v-dot" aria-hidden="true"></span>Order ahead</span></p>
${specTable([['Store', `${a.street}, ${a.city}, ${a.state} ${a.zip}`], ['Landmark', a.landmark], ['Hours', S.hoursLine], ['Payment', (S.payment || []).join(', ')]], 'v-ticket__spec')}
</div>`;
  let main = hero({ crumbs, kicker: 'In-Store Pickup', h1: 'In-Store <em class="accent">pickup</em>', lede: esc(S.pickup.line), ctas: [orderBtn(ctx, S.pickup.cta || 'Shop Now'), `<a class="btn btn--glass"${linkAttrs(S.mapUrl)}>Get Directions${icon('ext')}</a>`], side, bg: 'g-sky-field', cut: 'g-cloud-cut', mod: 'v-hero--pickup' });
  main += `<section class="band band--paper v-sec v-pk" aria-labelledby="v-pk-h">
<div class="wrap v-pk__grid">
<div class="v-pk__text">
<header class="v-head" data-reveal><p class="kicker">Order ahead</p><h2 class="display v-head__h" id="v-pk-h">${esc(qa[0].q)}</h2></header>
<blockquote class="v-bigquote" data-reveal><p>${rw(qa[0].a_html)}</p><cite>From the <a${linkAttrs(FAQP)}>BUZZY FAQs</a></cite></blockquote>
<div class="btn-row">${orderBtn(ctx, S.pickup.cta || 'Shop Now')}<a class="btn btn--ghost"${linkAttrs(FAQP)}>Read More FAQs${icon('arrow')}</a></div>
</div>
<figure class="frame frame--float v-pk__art" data-reveal style="--i:1" data-depth="0.06"><span class="frame__img">${gimg('g-pickup', { alt: '', sizes: '(min-width: 1024px) 420px, 80vw' })}</span></figure>
</div>
<span class="cut protrude v-pk__cut" aria-hidden="true" data-float data-depth="0.1">${gimg('g-bud-cut', { alt: '', sizes: '(min-width: 1024px) 200px, 110px' })}</span>
</section>
<section class="band band--fog band--grid v-sec v-pkq" aria-labelledby="v-pkq-h">
<div class="wrap">
<header class="v-head" data-reveal><p class="kicker">Before you visit</p><h2 class="display v-head__h" id="v-pkq-h">Pickup, ID and <em class="accent">payment</em></h2></header>
<ol class="v-why__list v-why__list--four" role="list">${qa.slice(1).concat([{ q: 'Payment', a_html: esc((S.payment || []).join(', ')), src: VISP, srcLabel: 'Visit Us' }]).map((it, i) => `<li class="v-why__item glass glass--lift" data-reveal style="--i:${i}"><span class="numeral v-why__n" aria-hidden="true">${pad2(i + 1)}</span><h3 class="v-why__t">${esc(norm(it.q))}</h3><div class="v-why__b"><p>${rw(it.a_html)}</p><p class="v-src"><a class="link-arrow"${linkAttrs(it.src || FAQP)}>${esc(it.srcLabel || 'BUZZY FAQs')}${icon('arrow')}</a></p></div></li>`).join('\n')}</ol>
</div>
</section>
<section class="band band--paper v-sec v-pkv" aria-labelledby="v-pkv-h">
<div class="wrap v-specs__grid">
<div class="v-specs__text">
<header class="v-head" data-reveal><p class="kicker">Find the store</p><h2 class="display v-head__h" id="v-pkv-h">${esc(S.address.street)}</h2><p class="v-head__sub">${esc(S.address.landmark)}</p></header>
<div class="btn-row" data-reveal><a class="btn btn--signal"${linkAttrs(S.mapUrl)}>Get Directions${icon('ext')}</a><a class="btn btn--ghost"${linkAttrs(VISP)}>Visit Us${icon('arrow')}</a></div>
</div>
<div class="v-specs__sheet" data-reveal style="--i:1">
<dl class="spec v-spec v-spec--big">
<div class="spec__row"><dt>Address</dt><dd>${esc(`${a.street}, ${a.city}, ${a.state} ${a.zip}`)}</dd></div>
<div class="spec__row"><dt>Hours</dt><dd>${esc(S.hoursLine)}</dd></div>
<div class="spec__row"><dt>Payment</dt><dd>${esc((S.payment || []).join(', '))}</dd></div>
<div class="spec__row"><dt>Public Transit</dt><dd>${quote(transit, S.transit)} <a class="v-src"${linkAttrs(VISP)}>Visit Us</a></dd></div>
${bus.length ? `<div class="spec__row"><dt>Bus</dt><dd>${quote(bus)} <a class="v-src"${linkAttrs(VISP)}>Visit Us</a></dd></div>` : ''}
${access.length ? `<div class="spec__row"><dt>Accessibility</dt><dd>${quote(access)} <a class="v-src"${linkAttrs(VISP)}>Visit Us</a></dd></div>` : ''}
<div class="spec__row"><dt>Phone</dt><dd><a${linkAttrs(S.phoneHref)}>${esc(S.phone)}</a></dd></div>
</dl>
</div>
</div>
</section>
<section class="band band--signal v-sec v-close" aria-labelledby="v-pkc-h">
<div class="wrap v-close__in"><header class="v-head" data-reveal><p class="kicker">Delivery</p><h2 class="display v-head__h" id="v-pkc-h">${esc(S.delivery.promise)}</h2></header>
<p class="v-close__line" data-reveal>${esc(S.deliveryLine).replace(/ · /g, '<span class="v-sep" aria-hidden="true"> / </span><span class="sr-only"> · </span>')}</p>
<div class="btn-row" data-reveal>${orderBtn(ctx, S.pickup.cta || 'Shop Now', 'btn')}<a class="btn btn--ghost"${linkAttrs('/cannabis-delivery-brooklyn/')}>Delivery details${icon('arrow')}</a></div></div>
</section>`;
  void steps;
  return out(ctx, { path: p, title: 'In-Store Pickup | BUZZY', description: `Order ahead online and pick up at BUZZY, ${a.street}, ${a.neighborhood}, Brooklyn: store hours, payment, ID and directions.`, crumbs, main, mod: 'pickup' });
}

// ---------- render ----------
const PAGE_SPECS = [
  ['cannabis-delivery-brooklyn', '/cannabis-delivery-brooklyn/', /^fast same-day/i],
  ['cannabis-delivery-brooklyn-map', '/cannabis-delivery-brooklyn-map/', /delivery zones/i],
  ['cannabis-delivery-brooklyn-nyc-rules', '/cannabis-delivery-brooklyn-nyc-rules/', /rules/i],
  ['brooklyn-dispensary-for-tourists', '/brooklyn-dispensary-for-tourists/', /^welcome to brooklyn/i],
  ['hotel-guest-landing-page', '/hotel-guest-landing-page/', /welcome/i],
  ['visit-us', '/visit-us/', /^visit buzzy/i],
];
let DELIV = [];
const NEIGHBORHOODS = ['boerum-hill', 'brooklyn-heights', 'carroll-gardens', 'cobble-hill', 'downtown-brooklyn', 'dumbo', 'fort-greene', 'gowanus', 'park-slope', 'prospect-heights', 'south-slope'];

export async function render(ctx) {
  ctxPhone = ctx.site.phoneHref || ctxPhone;
  ctxMap = ctx.site.mapUrl || ctxMap;
  const pages = [];
  const content = ctx.content || {};
  const deliv = (ctx.delivery && ctx.delivery.length) ? ctx.delivery : NEIGHBORHOODS.map((s) => txtRecord(`/cannabis-delivery-brooklyn/${s}/`, /^cannabis delivery in /i)).filter(Boolean);
  DELIV = deliv.map((d) => ({ slug: String(d.path || '/' + d.slug + '/').split('/').filter(Boolean).pop(), path: d.path || `/cannabis-delivery-brooklyn/${d.slug}/`, h1: d.h1 || '' }));

  const postPaths = new Set((ctx.posts || []).map((x) => href(x.path || '/' + x.slug + '/')));
  const get = (slug, p, re) => content[slug] || Object.values(content).find((c) => c && href(c.path) === p) || (postPaths.has(p) ? null : txtRecord(p, re));
  for (const [slug, p, re] of PAGE_SPECS) {
    if (postPaths.has(p)) continue; // a post: LEARN renders it
    if (slug === 'cannabis-delivery-brooklyn-nyc-rules' && !content[slug]) continue; // only when captured as a PAGE
    const rec = get(slug, p, re);
    if (!rec) continue;
    rec.path = rec.path || p;
    if (slug === 'cannabis-delivery-brooklyn') pages.push(deliveryPage(ctx, rec, { hub: true }));
    else if (slug === 'cannabis-delivery-brooklyn-map') pages.push(mapPage(ctx, rec));
    else if (slug === 'visit-us') pages.push(genericPage(ctx, rec, { mod: 'visit', bg: 'g-visitor', cut: 'g-stoop-cut', crumbLabel: 'Visit Us' }));
    else if (slug === 'brooklyn-dispensary-for-tourists') pages.push(genericPage(ctx, rec, { mod: 'tourists', bg: 'g-visitor', cut: 'g-cloud-cut', crumbLabel: 'Visiting Brooklyn' }));
    else if (slug === 'hotel-guest-landing-page') pages.push(genericPage(ctx, rec, { mod: 'hotel', bg: 'g-visitor', cut: 'g-cloud-cut', crumbLabel: 'Hotel Guests', kicker: 'Hotel guests' }));
    else pages.push(genericPage(ctx, rec, { mod: 'rules', bg: 'g-sky-field', cut: 'g-cloud-cut', crumbLabel: 'Delivery Rules' }));
  }
  for (const d of deliv) { d.path = d.path || `/cannabis-delivery-brooklyn/${d.slug}/`; pages.push(deliveryPage(ctx, d)); }
  pages.push(pickupPage(ctx));
  return pages;
}
