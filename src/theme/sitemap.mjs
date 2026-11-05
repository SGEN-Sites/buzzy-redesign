// sitemap.mjs - PAGES lane: /sitemap/ (+ sitemap.xml in the build's out dir). Rendered LAST (index.mjs MODULES), so
// ctx.pages holds every rendered page: each is listed once, grouped Shop / Services / Delivery Areas / Learn / Articles /
// Events / About / Legal (a page no rule knows lands in About, never dropped). Labels: ia.json labels first, then
// post / event / neighborhood / guide titles, then the page's own <h1>.
import fs from 'node:fs';
import nodePath from 'node:path';
import { esc, escA, linkAttrs, stripTags, absUrl, menu } from './util.mjs';
import { page, crumbsHtml, icon } from './shell.mjs';

const PATH = '/sitemap/';
const GROUPS = [
  { name: 'Shop', ico: 'bag' }, { name: 'Services', ico: 'truck' }, { name: 'Delivery Areas', ico: 'pin' },
  { name: 'Learn', ico: 'leaf' }, { name: 'Articles', ico: 'sparkle' }, { name: 'Events', ico: 'star' },
  { name: 'About', ico: 'sun' }, { name: 'Legal', ico: 'id' },
];
const clean = (t) => stripTags(String(t || '')).replace(/\s*[|]\s*(BUZZY|Buzzy)\b.*$/, '').replace(/\s+/g, ' ').trim();
const SHOP = ['/products/', '/deals/', '/rewards/', '/rewards-copy/', '/rewards-signup-page/', '/brands/', '/menu/', '/product/', '/bingo/', '/dabkitcontest26/'];
const SERVICES = ['/cannabis-delivery-brooklyn/', '/cannabis-delivery-brooklyn-map/', '/cannabis-delivery-brooklyn-nyc-rules/', '/in-store-pickup/', '/brooklyn-dispensary-for-tourists/', '/hotel-guest-landing-page/', '/visit-us/'];
const LEGAL = ['/privacy-policy/', '/terms-of-service/', PATH];
const HUBS = ['/', '/products/', '/deals/', '/rewards/', '/brands/', '/menu/', '/cannabis-delivery-brooklyn/', '/in-store-pickup/', '/visit-us/', '/learn/', '/education/', '/events/', '/about/', '/brooklyn-dispensary-faqs/', '/careers/', '/brooklyn-map/', ...LEGAL];

function labels(ctx) {
  const L = new Map();
  const put = (u, l) => {
    if (!u || !l || typeof u !== 'string' || !u.startsWith('/') || u.includes('#')) return;
    const p = u.replace(/[?#].*$/, '');
    const k = /\.[a-z0-9]{2,5}$/i.test(p) || p.endsWith('/') ? p : p + '/';
    if (!L.has(k)) L.set(k, clean(l));
  };
  put('/', 'Home');
  const walk = (o) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') { if (typeof o.href === 'string' && (o.label || o.title)) put(o.href, o.label || o.title); Object.values(o).forEach(walk); }
  };
  walk(ctx.ia && ctx.ia.nav);
  walk(ctx.ia && ctx.ia.footer);
  for (const p of ctx.posts || []) put(p.path || `/${p.slug}/`, p.h1 || p.title);
  for (const e of ctx.events || []) put(e.path || `/event/${e.slug}/`, e.h1 || e.title);
  for (const d of ctx.delivery || []) put(d.path, d.name || d.h1 || d.title);
  for (const g of ctx.learn || []) put(`/education/${g.slug}/`, g.title);
  put('/products/', 'Products');
  put('/events/category/pop-ups/', 'Brand Pop-Ups');
  put('/events/category/community-events/', 'Community Events');
  return L;
}

function groupOf(ctx, p) {
  if (p.startsWith('/products/') || SHOP.includes(p)) return 'Shop';
  if (p.startsWith('/cannabis-delivery-brooklyn/') && p !== '/cannabis-delivery-brooklyn/') return 'Delivery Areas';
  if (SERVICES.includes(p)) return 'Services';
  if (p.startsWith('/education/') || p === '/learn/' || p.startsWith('/category/')) return 'Learn';
  if (p.startsWith('/event/') || p.startsWith('/events/')) return 'Events';
  if (LEGAL.includes(p)) return 'Legal';
  if ((ctx.posts || []).some((x) => (x.path || `/${x.slug}/`) === p)) return 'Articles';
  return 'About';
}

export async function render(ctx) {
  const L = labels(ctx);
  const h1Of = (html) => { const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html || ''); return m ? clean(m[1]) : ''; };
  const all = [...ctx.pages.keys()].filter((p) => p.endsWith('/'));
  if (!all.includes(PATH)) all.push(PATH);
  const rank = (p) => { const i = HUBS.indexOf(p); return i === -1 ? HUBS.length : i; };
  const entries = all.map((p) => ({ path: p, label: L.get(p) || h1Of((ctx.pages.get(p) || {}).html) || p, group: groupOf(ctx, p) }));
  entries.sort((a, b) => rank(a.path) - rank(b.path) || a.label.localeCompare(b.label));
  const li = (e) => `<li><a class="p-sm__link"${linkAttrs(encodeURI(e.path), e.path === PATH ? { 'aria-current': 'page' } : {})}>${esc(e.label)}</a></li>`;
  const groups = GROUPS.map((g, gi) => {
    const items = entries.filter((e) => e.group === g.name);
    if (!items.length) return '';
    const id = 'sm-' + g.name.toLowerCase().replace(/[^a-z]+/g, '-');
    return `<section class="p-sm__group glass glass--strong${items.length > 12 ? ' p-sm__group--long' : ''}" data-reveal style="--i:${gi % 3}" aria-labelledby="${id}">
<h2 class="p-sm__title" id="${id}"><span class="p-sm__ico" aria-hidden="true">${icon(g.ico)}</span><span>${esc(g.name)}</span><span class="tag tag--signal p-sm__count">${items.length}</span></h2>
<ul class="p-sm__list" role="list">${items.map(li).join('')}</ul>
</section>`;
  }).join('\n');

  const crumbs = [{ href: '/', label: 'Home' }, { href: PATH, label: 'Sitemap' }];
  const title = 'Sitemap | BUZZY';
  const description = 'Every page of the BUZZY site, grouped: shop, services, delivery areas, learn, articles, events, about and legal.';
  const main = `<section class="page-hero p-hero p-hero--sitemap">
<div class="wrap page-hero__inner page-hero__inner--solo">
<div class="page-hero__text">
${crumbsHtml(crumbs)}
<p class="kicker" data-reveal>Sitemap</p>
<h1 class="display p-hero__h1" data-reveal style="--i:1">Every <em class="accent">page</em></h1>
<p class="lede" data-reveal style="--i:2">The whole BUZZY site, grouped: ${entries.length} pages in all.</p>
<div class="btn-row" data-reveal style="--i:3"><a class="btn"${linkAttrs(menu(ctx))}>Shop Now${icon('ext')}</a><a class="btn btn--ghost"${linkAttrs('/')}>Home</a></div>
</div>
</div>
</section>
<section class="band band--fog p-sm" aria-label="All pages">
<div class="wrap"><div class="p-sm__grid">${groups}</div></div>
</section>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.slice().sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((p) => `  <url><loc>${escA(absUrl(ctx, encodeURI(p)))}</loc></url>`).join('\n')}
</urlset>
`;
  if (ctx.out) { fs.mkdirSync(ctx.out, { recursive: true }); fs.writeFileSync(nodePath.join(ctx.out, 'sitemap.xml'), xml); }
  return [{ path: PATH, html: page({ ctx, path: PATH, title, description, canonical: absUrl(ctx, PATH), og: { title, description, type: 'website' }, bodyClass: 'p-page p-page--sitemap', main, crumbs, heroCrumbs: true }) }];
}
