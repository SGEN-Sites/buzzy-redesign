// shell.mjs - the page chrome (FOUNDATION, "DREAM INVENTORY"): <head>, the black top link bar (BUZZY's announcement
// line + the Delivery / Pickup service pills + quick links), the frosted main bar (logo, nav with image-card dropdown
// panels, Shop Now), the drawer below 1024px, the prefooter bands (areas + newsletter), the NIGHT footer with the giant
// HIGHLY CURATED wordmark and its light sweep, the yellow legal bar, the 21+ gate.
// Exports and the page() signature are FIXED (every lane calls them):
//   page({ ctx, path, title, description, canonical, og, jsonld, bodyClass, main, crumbs, heroCrumbs, scripts, preload, noPrefooter })
//     main         the page's <main> INNER html (page() wraps it in <main id="main">)
//     crumbs       [{ label, href }, ...] or [[href, label], ...] (last = current page). Printed in a slim bar under the
//                  header unless heroCrumbs is true (then the template prints crumbsHtml(crumbs) inside its .page-hero).
//                  A BreadcrumbList JSON-LD is added from crumbs unless the template passes one.
//     og           { title, description, type, image, url } (image defaults to the g-hero-dream still, absolute)
//     jsonld       object or array -> <script type="application/ld+json">
//     scripts      extra script file names under /assets/js/ (site.js always loads)
//     preload      [{ href, as, type, media, imagesrcset, imagesizes, fetchpriority, crossorigin }] -> <link rel="preload">
//     noPrefooter  true = skip BOTH prefooter bands; 'areas' or 'newsletter' = skip only that one
//   crumbsHtml(crumbs), icon(name, cls), logoHtml(ctx, opts), hoursHtml(ctx, cls), deliveryHoursHtml(ctx, cls),
//   specTable(rows, cls), serviceFacts(ctx), serviceCards(ctx, opts), areasBand(ctx), newsletterBand(ctx), CSS_ORDER,
//   ctaTrio (stub alias, returns '')
// Every word in the chrome comes from ctx.site / ctx.ia (BUZZY's own) except neutral glue labels (Menu, Close menu,
// Store Hours, Shop all products, Delivery details, Pickup details, Shop, Back to top, Skip to content).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/paths.mjs';
import { imageSize } from '../lib/images.mjs';
import { dePunct } from '../lib/punct.mjs';
import { esc, escA, attrs, href, linkAttrs, absUrl, gimg, img, imgUrl, hasGenerated, menu, demoForm } from './util.mjs';

export const CSS_ORDER = ['fonts', 'tokens', 'base', 'components', 'motion', 'shell', 'home', 'shop', 'services', 'learn', 'pages', 'mobile', 'fix'];

const ICONS = {
  ext: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>', chev: '<path d="m6 9 6 6 6-6"/>', menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h11"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>', pin: '<path d="M19 10c0 5.6-7 11-7 11s-7-5.4-7-11a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.6"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', bag: '<path d="M5.5 8h13l-1 12.5h-11L5.5 8Z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
  truck: '<path d="M2.5 6.5h11v9.5h-11z"/><path d="M13.5 10h4l3 3.2V16h-7"/><circle cx="6.5" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/>',
  arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>', tag: '<path d="M12.6 2.8H4.8a2 2 0 0 0-2 2v7.8l8.6 8.6a2.2 2.2 0 0 0 3.1 0l6.7-6.7a2.2 2.2 0 0 0 0-3.1Z"/><circle cx="8" cy="8" r="1.3"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.2"/><path d="M14 10h4M14 14h4"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  phone: '<path d="M5 3.5h3.6l1.8 4.6-2.4 1.6a11 11 0 0 0 6.3 6.3l1.6-2.4 4.6 1.8V19a1.8 1.8 0 0 1-1.9 1.8A16.5 16.5 0 0 1 3.2 5.4 1.8 1.8 0 0 1 5 3.5Z"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6.5L20.5 7"/>', up: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>',
  star: '<path d="m12 3.2 2.7 5.5 6 .9-4.35 4.25 1.03 6L12 17l-5.38 2.85 1.03-6L3.3 9.6l6-.9Z"/>', leaf: '<path d="M5 20c0-8.5 5.5-14 15-15-.6 9.5-6.4 15-15 15Z"/><path d="m5 20 8.5-8.5"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.9"/>',
  sparkle: '<path d="M12 3.5c.6 4.2 2.3 6 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.5 5.9-2.3 6.5-6.5Z"/>',
  moon: '<path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.5 6.5 0 0 0 10.1 10.1Z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.6v.1"/>', search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m20 20-4.4-4.4"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="12" rx="1"/><path d="M12 8.5v12M3.5 12.5h17"/>', user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  cart: '<path d="M3 4h2.2l2.3 11h10.3L20 7.5H6.4"/><circle cx="9.2" cy="19" r="1.4"/><circle cx="16.6" cy="19" r="1.4"/>', diamond: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12Z"/>',
  quote: '<path d="M9.5 7.5C6.6 8.4 5 10.6 5 13.6V17h4.6v-4.4H7.2c.1-1.8 1-3 2.8-3.6Z"/><path d="M18.5 7.5c-2.9.9-4.5 3.1-4.5 6.1V17h4.6v-4.4h-2.4c.1-1.8 1-3 2.8-3.6Z"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.6 4.2 4.2 0 0 0 7 18Z"/>',
  play: '<path d="M8 5.5v13l10-6.5Z"/>', pause: '<path d="M8 5.5v13M16 5.5v13"/>',
};
export function icon(name, cls = '') {
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.sparkle}</svg>`;
}

// ---------- small helpers ----------
const t = (s) => dePunct(String(s ?? '')); // ia.json is not dash-normalised at load: every ia string goes through this
const pathOf = (h) => href(String(h || '')).split('#')[0].split('?')[0];
const isCur = (h, p) => !!h && !/^(https?:)?\/\//i.test(h) && !String(h).includes('#') && pathOf(h) === p;
const cur = (h, p) => (isCur(h, p) ? ' aria-current="page"' : '');
const extIco = (u) => (/^https?:/i.test(String(u)) ? icon('ext', 'icon--ext') : '');
const addrLine = (s) => { const a = s.address || {}; return `${a.street}, ${a.city}, ${a.state} ${a.zip}`; };
const idOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// crumbs: [{ label, href }] or [[href, label]]; the last one is the current page. Separators are drawn by CSS ("/").
const crumbParts = (c) => (Array.isArray(c) ? { href: c[0], label: c[1] } : c || {});
export function crumbsHtml(crumbs = []) {
  if (!crumbs || !crumbs.length) return '';
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map((raw, i) => {
    const c = crumbParts(raw);
    return `<li>${i < crumbs.length - 1 && c.href ? `<a${linkAttrs(c.href)}>${esc(c.label)}</a>` : `<span aria-current="page">${esc(c.label)}</span>`}</li>`;
  }).join('')}</ol></nav>`;
}

// ---------- logo: CAPTURE's buzzy-logo-black / buzzy-logo-white files when present, else the CSS boxed wordmark ----------
const BRAND_DIR = path.join(ROOT, 'assets/brand');
let LOGO;
function logoFiles() {
  if (LOGO !== undefined) return LOGO;
  let files = [];
  try { files = fs.readdirSync(BRAND_DIR); } catch { files = []; }
  const rank = (f) => (/\.svg$/i.test(f) ? 0 : /\.png$/i.test(f) ? 1 : 2);
  const info = (re) => {
    const f = files.filter((x) => re.test(x)).sort((a, b) => rank(a) - rank(b))[0];
    if (!f) return null;
    let w = 0, h = 0;
    try {
      const buf = fs.readFileSync(path.join(BRAND_DIR, f));
      if (/\.svg$/i.test(f)) {
        const vb = buf.toString('utf8').match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
        if (vb) { w = Math.round(+vb[1]); h = Math.round(+vb[2]); }
      } else { const s = imageSize(buf); if (s) ({ w, h } = s); }
    } catch { /* unreadable: treated as absent */ }
    return w && h ? { src: '/assets/brand/' + f, w, h } : null;
  };
  const black = info(/^buzzy-logo-black\.(svg|png|webp)$/i);
  const white = info(/^buzzy-logo-white\.(svg|png|webp)$/i);
  LOGO = black || white ? { black: black || white, white: white || null } : null;
  return LOGO;
}
// logoHtml(ctx, { on: 'light' | 'dark', link = true, eager = false, cls = '' }) -> the BUZZY mark. With link (default, as
// the stub) it is an <a class="logo"> to the home page; link: false gives a <span class="logo"> for use inside your own
// link. on: 'dark' picks the white file (or the white boxed wordmark).
export function logoHtml(ctx, { on = 'light', link = true, eager = false, cls = '', current = false } = {}) {
  const name = (ctx.site && ctx.site.name) || 'BUZZY';
  const L = logoFiles();
  const dark = on === 'dark';
  let inner;
  if (L && (!dark || L.white)) {
    const f = dark ? L.white : L.black;
    inner = `<img${attrs({ class: 'logo__img', src: f.src, width: f.w, height: f.h, alt: link ? '' : name, decoding: 'async', loading: eager ? 'eager' : 'lazy' })}>`;
  } else {
    inner = `<span class="logo__box" aria-hidden="true">${esc(name)}</span>`;
  }
  const c = `logo${dark ? ' logo--dark' : ''}${cls ? ' ' + cls : ''}`;
  if (!link) return `<span class="${c}"${L && (!dark || L.white) ? '' : ` role="img" aria-label="${escA(name)}"`}>${inner}</span>`;
  return `<a class="${c}"${linkAttrs('/')} aria-label="${escA(name)} home"${current ? ' aria-current="page"' : ''}>${inner}</a>`;
}

// ---------- hours + spec tables ----------
const hrsRows = (rows) => (rows || []).map((r) => `<div class="hours__row"><dt>${esc(r.days)}</dt><dd>${esc(r.open)} to ${esc(r.close)}</dd></div>`).join('');
export function hoursHtml(ctx, cls = '') { return `<dl class="hours spec${cls ? ' ' + cls : ''}">${hrsRows(ctx.site.hours)}</dl>`; }
export function deliveryHoursHtml(ctx, cls = '') { return `<dl class="hours hours--delivery spec${cls ? ' ' + cls : ''}">${hrsRows(ctx.site.deliveryHours)}</dl>`; }
// specTable([[key, value], ...], cls) -> <dl class="spec"> rows: mono key, dotted leader, value. Values are text (escaped);
// pass { html } as a value for trusted inline html.
export function specTable(rows = [], cls = '') {
  const v = (x) => (x && typeof x === 'object' && 'html' in x ? x.html : esc(x));
  return `<dl class="spec${cls ? ' ' + cls : ''}">${(rows || []).map(([k, val]) => `<div class="spec__row"><dt>${esc(k)}</dt><dd>${v(val)}</dd></div>`).join('')}</dl>`;
}

// ---------- service facts (BUZZY's own words from site.json) ----------
// { delivery: [[k, v], ...] (all 9 delivery facts), pickup: [[k, v], ...], deliveryLine, pickupLine, arrives }
export function serviceFacts(ctx) {
  const s = ctx.site || {};
  const d = s.delivery || {};
  return {
    delivery: d.facts || [],
    pickup: [['Store Hours', s.hoursLine || ''], ['Payment', (s.payment || []).join(', ')], ['ID Verification', (d.facts || []).find((f) => /^ID/i.test(f[0]))?.[1] || '']].filter((r) => r[1]),
    deliveryLine: s.deliveryLine || '',
    pickupLine: (s.pickup && s.pickup.line) || '',
    pickupFaq: (s.pickup && s.pickup.faq) || '',
    arrives: d.arrives || '',
  };
}

// serviceCards(ctx, { h = 3, cls = '', compact = false, reveal = true, dark = false }) -> the Delivery + Pickup .svc pair.
// compact = 3 delivery facts instead of 5 (hero slot); dark = .glass--dark panes for NIGHT grounds.
export function serviceCards(ctx, { h = 3, cls = '', compact = false, reveal = true, dark = false } = {}) {
  const F = serviceFacts(ctx);
  const s = ctx.site;
  const svcs = (ctx.ia.topbar && ctx.ia.topbar.services) || [];
  const del = svcs.find((x) => x.icon === 'truck') || {};
  const pick = svcs.find((x) => x.icon === 'bag') || {};
  const H = `h${Math.min(6, Math.max(2, h))}`;
  const cards = [
    { key: 'delivery', ico: 'truck', num: '01', label: t(del.label || 'Delivery'), title: 'Same-Day Delivery', line: (s.delivery && s.delivery.promise) || '', rows: F.delivery.slice(0, compact ? 3 : 5), cta: (s.delivery && s.delivery.cta) || 'Order for Delivery', ctaHref: del.href || menu(ctx), info: del.info || '/cannabis-delivery-brooklyn/', infoLabel: 'Delivery details' },
    { key: 'pickup', ico: 'bag', num: '02', label: t(pick.label || 'Pickup'), title: 'In-Store Pickup', line: F.pickupFaq, rows: F.pickup.slice(0, compact ? 2 : 3), cta: (s.pickup && s.pickup.cta) || 'Shop Now', ctaHref: pick.href || menu(ctx), info: pick.info || '/in-store-pickup/', infoLabel: 'Pickup details' },
  ];
  return `<div class="svc-pair${cls ? ' ' + cls : ''}">
${cards.map((c, i) => `<article class="svc svc--${c.key} glass glass--lift${dark ? ' glass--dark' : ''}"${reveal ? ` data-reveal style="--i:${i}"` : ''} data-spot>
<div class="svc__head"><span class="svc__icon" aria-hidden="true">${icon(c.ico)}</span><span class="tag tag--ink svc__tag">${esc(c.label)}</span><span class="svc__num" aria-hidden="true">N° ${c.num}</span></div>
<${H} class="svc__title">${esc(c.title)}</${H}>
${!compact && c.line ? `<p class="svc__line">${esc(c.line)}</p>` : ''}
${specTable(c.rows, 'spec--sm svc__spec')}
<div class="svc__cta"><a class="btn btn--sm${c.key === 'delivery' ? ' btn--signal' : ''}"${linkAttrs(c.ctaHref)}>${esc(c.cta)}${extIco(c.ctaHref)}</a><a class="link-arrow"${linkAttrs(c.info)}>${esc(c.infoLabel)}${icon('arrow')}</a></div>
</article>`).join('\n')}
</div>`;
}

// ---------- media helper: a generated id, a BUZZY photo path, or the STORE_PHOTO placeholder ----------
const photoExists = (src) => !!src && String(src).startsWith('/assets/') && fs.existsSync(path.join(ROOT, String(src).replace(/^\//, '')));
function anyImg(ref, opts = {}) {
  if (!ref || ref === 'STORE_PHOTO') return gimg('g-sky-field', opts); // until CAPTURE names the store photo
  if (/^g-/.test(ref)) return gimg(ref, opts);
  if (photoExists(ref)) return img({ src: ref, alt: opts.alt ?? '' }, opts);
  return gimg('g-sky-field', opts);
}

// ---------- dropdown panels ----------
const navChildren = (ctx, re) => ((ctx.ia.nav || []).find((n) => re.test(n.href)) || {}).children || [];
function linkList(kids, p, cls = '') {
  return `<ul class="mega__links${cls}">${kids.map((l) => `<li><a class="mega__link"${linkAttrs(l.href)}${cur(l.href, p)}><span>${esc(t(l.label))}</span>${icon('arrow', 'icon--go')}</a></li>`).join('')}</ul>`;
}
function featureCard(f, sub, kicker) {
  return `<a class="mega__card"${linkAttrs(f.href)}>
<span class="mega__card-media frame">${anyImg(f.gimg || f.photo, { alt: '', sizes: '(min-width: 1024px) 320px, 1px', cls: 'frame__img' })}</span>
<span class="mega__card-body">${kicker ? `<span class="kicker">${esc(kicker)}</span>` : ''}<span class="mega__card-t">${esc(t(f.title))}</span>${sub ? `<span class="mega__card-l">${esc(sub)}</span>` : ''}<span class="mega__card-go" aria-hidden="true">${icon('arrow')}</span></span>
</a>`;
}
function panelInner(ctx, it, p) {
  const s = ctx.site;
  const kids = it.children || [];
  const head = (extra = '') => `<div class="mega__head"><p class="mega__h">${esc(t(it.label))}</p>${extra}</div>`;
  if (kids.some((k) => k.gimg)) { // Products: the 8 category image cards
    return `<div class="mega__col mega__col--full">${head(`<a class="link-arrow mega__all"${linkAttrs(it.href)}${cur(it.href, p)}>Shop all products${icon('arrow')}</a>`)}
<ul class="mega__tiles">${kids.map((k, i) => `<li><a class="mega__tile"${linkAttrs(k.href)}${cur(k.href, p)}><span class="mega__tile-media">${gimg(k.gimg, { alt: '', sizes: '(min-width: 1024px) 140px, 1px' })}</span><span class="mega__tile-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span class="mega__tile-t">${esc(t(k.label))}</span></a></li>`).join('')}</ul></div>`;
  }
  if (kids.some((k) => k.icon)) { // Services: icon links + the delivery-facts glass card
    const F = serviceFacts(ctx);
    const del = ((ctx.ia.topbar && ctx.ia.topbar.services) || []).find((x) => x.icon === 'truck') || {};
    const ctaHref = del.href || menu(ctx);
    return `<div class="mega__col">${head()}<ul class="mega__icons">${kids.map((k) => `<li><a class="mega__icon-link"${linkAttrs(k.href)}${cur(k.href, p)}><span class="mega__icon">${icon(k.icon || 'arrow')}</span><span class="mega__icon-t">${esc(t(k.label))}</span>${icon('arrow', 'icon--go')}</a></li>`).join('')}</ul></div>
<div class="mega__facts glass glass--strong">
<p class="kicker">${esc(t(del.label || 'Delivery'))}</p>
<p class="mega__facts-t">${esc((s.delivery && s.delivery.promise) || '')}</p>
${specTable(F.delivery.slice(0, 4), 'spec--sm')}
<a class="btn btn--signal btn--sm"${linkAttrs(ctaHref)}>${esc((s.delivery && s.delivery.cta) || 'Order for Delivery')}${extIco(ctaHref)}</a>
</div>`;
  }
  if (it.feature) { // About / Education: links + a feature image card
    const isStore = !!it.feature.photo;
    return `<div class="mega__col">${head()}${linkList(kids, p, ' mega__links--2')}</div>
<div class="mega__feature">${featureCard(it.feature, isStore ? addrLine(s) : '', isStore ? (s.address && s.address.neighborhood) || '' : 'Learn')}</div>`;
  }
  // Neighborhoods: the areas in two columns + a map card (the hub child is the card's link)
  const hub = kids.find((k) => pathOf(k.href) === pathOf(it.href));
  const areas = kids.filter((k) => k !== hub);
  const zips = (s.delivery && s.delivery.zips) || [];
  return `<div class="mega__col">${head()}
<ul class="mega__areas">${areas.map((k) => `<li><a class="mega__area"${linkAttrs(k.href)}${cur(k.href, p)}>${icon('pin')}<span>${esc(t(k.label))}</span></a></li>`).join('')}</ul></div>
<a class="mega__map"${linkAttrs((hub && hub.href) || it.href)}>
<span class="mega__map-art" aria-hidden="true"><span class="mega__map-pin">${icon('pin')}</span><span class="mega__map-coord">ZONE ${esc(s.address.zip)}</span></span>
<span class="mega__map-body"><span class="kicker">${esc(s.address.neighborhood || 'Brooklyn')}</span><span class="mega__card-t">${esc(t((hub && hub.label) || it.label))}</span>
<span class="mega__zips">${zips.map((z) => `<span class="tag">${esc(z)}</span>`).join('')}</span><span class="mega__card-go" aria-hidden="true">${icon('arrow')}</span></span>
</a>`;
}

function navHtml(ctx, p) {
  const s = ctx.site;
  const tb = ctx.ia.topbar || {};
  const items = (ctx.ia.nav || []).map((it) => {
    const kids = it.children || [];
    const owns = isCur(it.href, p) || kids.some((k) => isCur(k.href, p));
    if (!kids.length) {
      return `<li class="nav__item${owns ? ' is-current' : ''}"><div class="nav__row"><a class="nav__link"${linkAttrs(it.href)}${cur(it.href, p)}>${esc(t(it.label))}</a></div></li>`;
    }
    const id = 'mega-' + idOf(it.label);
    const kind = kids.some((k) => k.gimg) ? 'tiles' : kids.some((k) => k.icon) ? 'services' : it.feature ? 'feature' : 'areas';
    return `<li class="nav__item has-panel${owns ? ' is-current' : ''}" data-dropdown>
<div class="nav__row"><a class="nav__link"${linkAttrs(it.href)}${cur(it.href, p)}>${esc(t(it.label))}</a><button class="nav__more" type="button" aria-expanded="false" aria-controls="${id}" data-dropdown-trigger>${icon('chev')}<span class="sr-only">${esc(t(it.label))} menu</span></button></div>
<div class="mega mega--${kind}" id="${id}" data-dropdown-panel>
<div class="mega__panel glass glass--strong">${panelInner(ctx, it, p)}</div>
</div>
</li>`;
  }).join('\n');
  return `<nav class="nav" id="site-nav" aria-label="Main" data-nav>
<div class="nav__drawer-head">${logoHtml(ctx)}<button class="nav__close" type="button" data-nav-close>${icon('close')}<span class="sr-only">Close menu</span></button></div>
<ul class="nav__list">
${items}
</ul>
<div class="nav__drawer-foot">
<div class="nav__svcs">${(tb.services || []).map((sv) => `<a class="nav__svc"${linkAttrs(sv.info || sv.href)}>${icon(sv.icon || 'arrow')}<span><strong>${esc(t(sv.label))}</strong><small>${esc(t(sv.fact))}</small></span></a>`).join('')}</div>
<a class="btn btn--signal nav__cta"${linkAttrs(ctx.ia.cta.href)}>${esc(t(ctx.ia.cta.label))}${extIco(ctx.ia.cta.href)}</a>
<ul class="nav__quick">${(tb.links || []).map((l) => `<li><a${linkAttrs(l.href)}${cur(l.href, p)}>${esc(t(l.label))}</a></li>`).join('')}</ul>
<p class="nav__line">${esc(t(tb.line || s.topbarLine || ''))}</p>
<div class="nav__store">
<a class="nav__store-row"${linkAttrs(s.mapUrl)}>${icon('pin')}<span>${esc(addrLine(s))}</span></a>
<a class="nav__store-row"${linkAttrs(s.phoneHref)}>${icon('phone')}<span>${esc(s.phone)}</span></a>
<p class="nav__store-row">${icon('clock')}<span>${esc(s.hoursLine || '')}</span></p>
</div>
</div>
</nav>`;
}

function topbarHtml(ctx, p) {
  const tb = ctx.ia.topbar || {};
  const pills = (tb.services || []).map((sv) => {
    const k = sv.icon === 'bag' ? 'pickup' : 'delivery';
    return `<li class="svc-pill svc-pill--${k}"><a class="svc-pill__main"${linkAttrs(sv.info || sv.href)}${cur(sv.info, p)}>${icon(sv.icon || 'arrow')}<span class="svc-pill__label">${esc(t(sv.label))}</span><span class="svc-pill__fact">${esc(t(sv.fact))}</span></a><a class="svc-pill__shop"${linkAttrs(sv.href)}>Shop<span class="sr-only"> for ${esc(t(sv.label).toLowerCase())}</span>${icon('ext')}</a></li>`;
  }).join('');
  return `<div class="topbar">
<div class="topbar__inner">
<ul class="topbar__svcs">${pills}</ul>
<p class="topbar__line">${esc(t(tb.line || ctx.site.topbarLine || '')).split(/\s+\|\s+/).map((x) => `<span>${x}</span>`).join('<span class="topbar__sep"> | </span>')}</p>
<ul class="topbar__links">${(tb.links || []).map((l) => `<li><a class="topbar__link"${linkAttrs(l.href)}${cur(l.href, p)}>${esc(t(l.label))}</a></li>`).join('')}</ul>
</div>
</div>`;
}

function headerHtml(ctx, p) {
  return `${topbarHtml(ctx, p)}
<header class="site-header" data-header>
<div class="mainbar">
${logoHtml(ctx, { eager: true, current: p === '/', cls: 'mainbar__logo' })}
${navHtml(ctx, p)}
<div class="header-tools">
<a class="btn btn--sm header-cta"${linkAttrs(ctx.ia.cta.href)}>${esc(t(ctx.ia.cta.label))}${icon('arrow')}</a>
<button class="nav-toggle" type="button" aria-controls="site-nav" aria-expanded="false" data-nav-toggle>${icon('menu')}<span class="nav-toggle__t">Menu</span></button>
</div>
</div>
</header>
<div class="nav-scrim" data-nav-scrim hidden></div>`;
}

// ---------- prefooter: areas band (the neighborhood delivery pages as chips + the zips) ----------
export function areasBand(ctx) {
  const s = ctx.site;
  const a = (ctx.ia.prefooter && ctx.ia.prefooter.areas) || {};
  const navAreas = navChildren(ctx, /^\/cannabis-delivery-brooklyn-map\/?$/).filter((k) => /^\/cannabis-delivery-brooklyn\/[^/]+\/?$/.test(k.href));
  const navLabel = new Map(navAreas.map((k) => [pathOf(k.href), t(k.label)]));
  const list = (ctx.delivery && ctx.delivery.length)
    ? ctx.delivery.map((d) => { const pth = href(d.path || `/cannabis-delivery-brooklyn/${d.slug}/`); return { href: pth, label: navLabel.get(pth) || d.name || d.h1 || d.title }; })
    : navAreas.map((k) => ({ href: k.href, label: t(k.label) }));
  const zips = (s.delivery && s.delivery.zips) || [];
  return `<section class="areas band band--paper band--grid" aria-labelledby="areas-h">
<div class="wrap areas__inner">
<div class="areas__head" data-reveal>
<p class="kicker">Delivery</p>
<h2 class="display areas__h" id="areas-h">${esc(t(a.heading || 'Where We Deliver in Brooklyn'))}</h2>
<p class="areas__line">${esc(t(a.line || (s.delivery && s.delivery.neighborhoodsLine) || ''))}</p>
</div>
<ul class="areas__chips" data-reveal style="--i:1">${list.map((l, i) => `<li><a class="chip"${linkAttrs(l.href)}><span class="chip__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${esc(l.label)}</a></li>`).join('')}</ul>
<div class="areas__zips" data-reveal style="--i:2">
<h3 class="areas__zips-h">${esc(t(a.zipsHeading || 'Brooklyn Zip Codes We Deliver To'))}</h3>
<ul class="areas__zip-list">${zips.map((z) => `<li class="tag tag--signal">${esc(z)}</li>`).join('')}</ul>
<a class="link-arrow"${linkAttrs('/cannabis-delivery-brooklyn-map/')}>Delivery Zones &amp; Map${icon('arrow')}</a>
</div>
</div>
</section>`;
}

// ---------- prefooter: newsletter band (BUZZY's own sign-up words, a demo form with its consent line) ----------
export function newsletterBand(ctx) {
  const n = (ctx.ia.prefooter && ctx.ia.prefooter.newsletter) || {};
  let form = demoForm({ id: 'newsletter-form', fields: n.fields || ['Email'], button: t(n.button || 'Submit'), cls: 'demo-form--inline newsletter__form' });
  form = form.replace(/btn--sun/g, 'btn--signal');
  if (n.consent) form = form.replace(/<button /, `<label class="demo-form__check"><input type="checkbox" name="consent" value="yes"><span>${esc(t(n.consent))}</span></label>\n<button `);
  const link = n.link || {};
  return `<section class="newsletter band band--sky" aria-labelledby="newsletter-h">
<div class="band__clip" aria-hidden="true">${gimg('g-sky-field', { alt: '', cls: 'band__bg', sizes: '100vw' })}</div>
<div class="wrap newsletter__inner">
<div class="newsletter__copy" data-reveal>
<p class="kicker">${esc((ctx.site.rewards && ctx.site.rewards.name) || 'BUZZY Rewards')}</p>
<h2 class="display newsletter__h" id="newsletter-h">${esc(t(n.heading || ''))}</h2>
<p class="lede newsletter__line">${esc(t(n.line || ''))}</p>
${link.href ? `<a class="link-arrow newsletter__link"${linkAttrs(link.href)}>${esc(t(link.label))}${icon('arrow')}</a>` : ''}
</div>
<div class="newsletter__panel glass glass--strong" data-reveal style="--i:1">${form}</div>
</div>
</section>`;
}

// ---------- footer ----------
function footerHtml(ctx, p) {
  const s = ctx.site;
  const f = ctx.ia.footer || {};
  const col = (c) => `<div class="footer__col"><h2 class="footer__h">${esc(t(c.title))}</h2><ul class="footer__links">${(c.links || []).map((l) => `<li><a${linkAttrs(l.href)}${cur(l.href, p)}>${esc(t(l.label))}${extIco(l.href)}</a></li>`).join('')}</ul></div>`;
  const word = esc(t(f.wordmark || s.tagline || 'HIGHLY CURATED'));
  return `<footer class="site-footer band--night">
<div class="band__clip" aria-hidden="true"><span class="footer__grid-bg"></span></div>
<div class="wrap wrap--wide footer__inner">
<div class="footer__top">
<div class="footer__brand">
${logoHtml(ctx, { on: 'dark', cls: 'footer__logo' })}
<p class="footer__hours">${icon('clock')}<span>${esc(s.hoursLine || '')}</span></p>
<ul class="footer__socials">${(s.socials || []).map((x) => `<li><a class="footer__social"${linkAttrs(x.url)}>${icon(/instagram/i.test(x.name) ? 'instagram' : 'ext')}<span>${esc(x.handle || x.name)}</span><span class="sr-only"> on ${esc(x.name)}</span></a></li>`).join('')}</ul>
</div>
<nav class="footer__cols" aria-label="Footer">
${(f.columns || []).map(col).join('\n')}
</nav>
<div class="footer__col footer__contact">
<h2 class="footer__h">${esc(t(f.contactTitle || 'CONTACT'))}</h2>
<address class="footer__addr">
<a${linkAttrs(s.mapUrl)}>${icon('pin')}<span>${esc(s.address.street)}<br>${esc(`${s.address.city}, ${s.address.state} ${s.address.zip}`)}</span></a>
<a${linkAttrs(s.phoneHref)}>${icon('phone')}<span>${esc(s.phone)}</span></a>
${s.email ? `<a${linkAttrs('mailto:' + s.email)}>${icon('mail')}<span>${esc(s.email)}</span></a>` : ''}
</address>
</div>
<div class="footer__col footer__location">
<h2 class="footer__h">${esc(t(f.locationTitle || 'LOCATION'))}</h2>
<p class="footer__loc">${esc(s.address.neighborhood || '')}, ${esc(s.address.city)}<br><span class="footer__landmark">${esc(s.address.landmark || '')}</span></p>
<a class="btn btn--light btn--sm"${linkAttrs(s.mapUrl)}>${esc(t(f.directionsLabel || 'Get Directions'))}${icon('ext')}</a>
</div>
</div>
</div>
<div class="footer__mark" aria-hidden="true" data-footer-light>
<span class="footer__word">${word}<span class="footer__word-lit">${word}</span></span>
</div>
<div class="footer__legalbar">
<div class="wrap wrap--wide footer__legalbar-in">
<p class="footer__disclaimer">${esc(s.disclaimer || '')}</p>
<p class="footer__licence tag tag--ink">${esc(s.licence || '')}</p>
</div>
</div>
<div class="wrap wrap--wide footer__bottom">
<p class="footer__copy">${esc(s.copyright || '')}</p>
<ul class="footer__legal">${(f.legal || []).map((l) => `<li><a${linkAttrs(l.href)}${cur(l.href, p)}>${esc(t(l.label))}</a></li>`).join('')}</ul>
<a class="footer__totop" href="#top" data-to-top>Back to top${icon('up')}</a>
</div>
</footer>`;
}

// ---------- 21+ gate (D7): BUZZY's own words from site.json ageGate. Hidden in the HTML; site.js opens it unless
// localStorage buzzy-age-ok = 1, so it never blocks the page without JS. ----------
function gateHtml(ctx) {
  const g = ctx.site.ageGate || {};
  return `<div class="age-gate" data-age-gate data-age-key="buzzy-age-ok" hidden>
<div class="age-gate__sky" aria-hidden="true">${gimg('g-sky-field', { alt: '', cls: 'age-gate__bg', sizes: '100vw' })}</div>
<div class="age-gate__dialog glass glass--strong" role="dialog" aria-modal="true" aria-labelledby="age-gate-q" aria-describedby="age-gate-n">
<div class="age-gate__logo">${logoHtml(ctx, { link: false })}</div>
<p class="tag tag--signal age-gate__tag" id="age-gate-n">21+</p>
<h2 class="age-gate__q" id="age-gate-q">${esc(g.question || '')}</h2>
<div class="btn-row age-gate__actions"><button class="btn" type="button" data-age-yes>${esc(g.yes || 'Yes')}</button><button class="btn btn--ghost" type="button" data-age-no>${esc(g.no || 'No')}</button></div>
<p class="age-gate__no" data-age-refusal role="alert" hidden>${esc(g.denied || '')}</p>
</div>
</div>`;
}

function ogImage(ctx, og) {
  let u = og.image;
  if (!u && hasGenerated('g-hero-dream')) u = imgUrl('g-hero-dream', 1440);
  if (!u) return '';
  return /^https?:/i.test(u) ? u : (ctx.site.origin || '') + u;
}

function storeLd(ctx) {
  const s = ctx.site;
  const a = s.address || {};
  return {
    '@context': 'https://schema.org', '@type': 'Store', name: s.name, url: s.origin + '/',
    telephone: s.phoneHref ? s.phoneHref.replace(/^tel:/, '') : s.phone, email: s.email || undefined,
    address: { '@type': 'PostalAddress', streetAddress: a.street, addressLocality: a.city, addressRegion: a.state, postalCode: a.zip, addressCountry: 'US' },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '08:00', closes: '22:00' }],
    hasMap: s.mapUrl || undefined,
    sameAs: (s.socials || []).map((x) => x.url),
  };
}

const brandFile = (f) => fs.existsSync(path.join(BRAND_DIR, f));

// kept for lanes written against the stub
export function ctaTrio() { return ''; }

export function page({ ctx, path: p, title, description, canonical, og = {}, jsonld = [], bodyClass = '', main = '', crumbs = [], heroCrumbs = false, scripts = [], preload = [], noPrefooter = false }) {
  og = og || {};
  const can = canonical || absUrl(ctx, p);
  const css = (ctx.cssFiles || []).map((f) => `<link rel="stylesheet" href="/assets/css/${f}.css">`).join('\n');
  const lds = [].concat(jsonld || []).filter(Boolean);
  const types = lds.map((o) => o['@type']);
  if (crumbs && crumbs.length > 1 && !types.includes('BreadcrumbList')) {
    lds.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((raw, i) => { const c = crumbParts(raw); return { '@type': 'ListItem', position: i + 1, name: c.label, item: absUrl(ctx, c.href || p) }; }) });
  }
  if (p === '/' && !types.some((x) => /Store|LocalBusiness|Organization/.test(String(x)))) lds.push(storeLd(ctx));
  const ld = lds.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  const pre = (preload || []).filter(Boolean).map((x) => `<link rel="preload"${attrs(x)}>`).join('\n');
  const js = [...new Set(['site.js', ...(scripts || [])])].filter((f) => !ctx.jsFiles || ctx.jsFiles.includes(f));
  const ogi = ogImage(ctx, og);
  const fav = brandFile('favicon-32.png') ? '/favicon-32.png' : brandFile('favicon.ico') ? '/favicon.ico' : '';
  const touch = brandFile('apple-touch-icon.png') ? '/apple-touch-icon.png' : '';
  const skipAll = noPrefooter === true;
  const showAreas = !skipAll && noPrefooter !== 'areas';
  const showNews = !skipAll && noPrefooter !== 'newsletter';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${escA(description)}">
<link rel="canonical" href="${escA(can)}">
<meta property="og:site_name" content="${escA(ctx.site.name)}">
<meta property="og:title" content="${escA(og.title || title)}">
<meta property="og:description" content="${escA(og.description || description)}">
<meta property="og:url" content="${escA(og.url || can)}">
<meta property="og:type" content="${escA(og.type || 'website')}">
${ogi ? `<meta property="og:image" content="${escA(ogi)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<meta name="theme-color" content="#000000">
${fav ? `<link rel="icon" href="${escA(fav)}">` : ''}
${touch ? `<link rel="apple-touch-icon" href="${escA(touch)}">` : ''}
<link rel="preload" href="/assets/fonts/geist-var-latin.woff2" as="font" type="font/woff2" crossorigin>
${pre}
${css}
<script>document.documentElement.classList.add('js');</script>
${ld}
</head>
<body id="top"${attrs({ class: bodyClass })}>
<a class="skip" href="#main">Skip to content</a>
<div class="site">
${headerHtml(ctx, p)}
${crumbs && crumbs.length && !heroCrumbs ? `<div class="crumbs-bar"><div class="wrap wrap--wide">${crumbsHtml(crumbs)}</div></div>` : ''}
<main id="main">
${main}
</main>
${showAreas ? areasBand(ctx) : ''}
${showNews ? newsletterBand(ctx) : ''}
${footerHtml(ctx, p)}
</div>
${gateHtml(ctx)}
${js.map((f) => `<script src="/assets/js/${escA(f)}" defer></script>`).join('\n')}
</body>
</html>`;
}
