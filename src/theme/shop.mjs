// shop.mjs: SHOP lane (docs/BUILD-CONTRACT.md section 6). "Dream inventory": the catalogue as a museum inventory,
// spec labels, vitrine glass, floating objects. Pages:
//   /products/                 hub: page hero, the 8 category tiles (ia.nav Products children), BUZZY's own
//                              "Everything on the BUZZY Menu, Delivered" words, the service pair, an order band, deals strip
//   /products/<slug>/ x 8      category: hero with the category still in a vitrine, WRITER glue (ctx.glue[slug]),
//                              BUZZY's quotes (glue.buzzy) with source links, related posts (glue.related) as .acard,
//                              "Shop <Category> for delivery or pickup" (menu(ctx, slug)), other categories, deals strip
//   /deals/                    src/content/deals.json: every deal line verbatim on a glass offer card, grouped
//   captured pages             rewards, rewards-copy, rewards-signup-page, brands, menu, product, bingo, dabkitcontest26:
//                              EVERY word, head verbatim, inner-page layout (page hero + alternating sections)
// Every new word is neutral glue (D2). Lane classes are prefixed s-.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, escA, linkAttrs, gimg, img, absUrl, menu, rewriteLinks, liveHref, localPhoto, stripTags, demoForm, slugify } from './util.mjs';
import * as shell from './shell.mjs';
import { normaliseDashes } from '../lib/punct.mjs';

const { page, crumbsHtml, icon } = shell;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TAIL = ' | BUZZY';
const CAPTURED = ['rewards', 'rewards-copy', 'rewards-signup-page', 'brands', 'menu', 'product', 'bingo', 'dabkitcontest26'];
const pad = (n) => String(n).padStart(2, '0');
const rw = (h) => rewriteLinks(h || '');
const text = (h) => stripTags(String(h || '')).replace(/\s+/g, ' ').trim();
const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

// ---------- data ----------
const cats = (ctx) => (((ctx.ia.nav || []).find((n) => n.href === '/products/') || {}).children || [])
  .map((c, i) => ({ ...c, slug: c.href.replace(/^\/products\/|\/$/g, ''), i }));
function glueOf(ctx, slug) {
  const g = ctx.glue || {};
  const hit = g[slug] || (g.categories && (Array.isArray(g.categories) ? g.categories.find((x) => x.slug === slug) : g.categories[slug]));
  return hit && typeof hit === 'object' ? hit : null;
}
const glueText = (g) => arr(g && (g.format || g.description || g.intro || g.text || g.glue)).flatMap((x) => (typeof x === 'string' ? [x] : x && x.text ? [x.text] : []));
function glueQuotes(g) {
  return arr(g && (g.buzzy || g.quotes)).map((q) => {
    if (typeof q === 'string') return { html: esc(q) };
    const body = q.html || (q.quote || q.text || q.line ? esc(q.quote || q.text || q.line) : '');
    const to = q.href || q.path || q.source || q.url || q.from_path || '';
    return { html: body, href: to ? liveHref(to) : '', from: q.from || q.page || q.title || q.label || q.sourceTitle || '', heading: q.heading || '' };
  }).filter((q) => q.html);
}
const glueRelated = (ctx, g) => arr(g && (g.related || g.posts)).map((r) => (typeof r === 'string' ? r : r && (r.slug || r.path || ''))).map((s) => String(s).replace(/^\/|\/$/g, ''))
  .map((s) => (ctx.posts || []).find((p) => p.slug === s || String(p.path || '').replace(/^\/|\/$/g, '') === s)).filter(Boolean);
// the visible title of the BUZZY page a quote or deal comes from (captured page, post, event or delivery page)
function titleFor(ctx, to) {
  const p = String(to || '').replace(/^https?:\/\/(?:www\.)?getbuzzy\.com/i, '').replace(/[?#].*$/, '');
  const want = p.endsWith('/') ? p : p + '/';
  const recs = [...Object.values(ctx.content || {}), ...(ctx.posts || []), ...(ctx.events || []), ...(ctx.delivery || [])];
  const r = recs.find((x) => x && (x.path === want || x.path === p));
  return r ? String(r.h1 || r.title || '').split(' | ')[0].trim() : '';
}
const pageName = (rec) => String((rec && (rec.h1 || rec.title)) || '').split(/\s[|:]\s|\s-\s/)[0].trim();

// a photo only when the local file exists (img() fails the build on a missing file, even when the throw is caught)
function photoHtml(src, { alt = '', w, h } = {}, opts = {}) {
  const rec = localPhoto(src);
  if (!rec || !rec.src || !fs.existsSync(path.join(ROOT, rec.src.replace(/^\//, '')))) return '';
  return img({ src: rec.src, alt, w: w || rec.w, h: h || rec.h }, opts);
}

// ---------- shared pieces ----------
const arrowed = (label) => `<span>${esc(label)}</span>${icon('arrow', 's-arr')}`;
function btn(u, label, cls = 'btn') {
  const h = liveHref(u);
  return `<a class="${cls}"${linkAttrs(h)}>${esc(label)}${/^https?:/i.test(h) ? icon('ext', 's-ext') : ''}</a>`;
}
const crumbsLd = (ctx, crumbs) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, ...(c.href ? { item: absUrl(ctx, c.href) } : {}) })) });
function out(ctx, { path: p, title, description, crumbs, bodyClass, main, jsonld = [] }) {
  return { path: p, html: page({ ctx, path: p, title, description, crumbs, heroCrumbs: true, bodyClass: 'page-shop ' + bodyClass, main, og: { title, description, type: 'website', url: absUrl(ctx, p) }, jsonld: [crumbsLd(ctx, crumbs), ...jsonld] }) };
}
const sky = (eager = true) => `<div class="band__clip s-clip" aria-hidden="true">${gimg('g-sky-field', { alt: '', cls: 'band__bg s-clip__bg', eager, sizes: '100vw' })}<span class="s-clip__grid"></span></div>`;
const kicker = (t, cls = '') => (t ? `<p class="kicker ${cls}">${esc(t)}</p>` : '');
// registration crosses at a frame's corners (inner elements: .frame owns its pseudo-elements)
const reg = () => '<span class="s-reg s-reg--tl" aria-hidden="true"></span><span class="s-reg s-reg--br" aria-hidden="true"></span>';

// The page hero (adopted inner-page pattern): SKY ground with the grid, kicker, H1, one line, CTAs, breadcrumb, and a
// vitrine frame on the right breaking out over the hero's bottom edge into the next band, a cut-out floating in front.
function hero({ crumbs, kick, h1, line = '', ctas = '', after = '', media = '', cut = '', label = '', cls = '' }) {
  return `<section class="page-hero band band--sky s-hero ${cls}">
${sky()}
<div class="wrap s-hero__grid">
<div class="s-hero__text">
${crumbsHtml(crumbs)}
${kick ? `<p class="kicker s-hero__kicker" data-reveal>${kick}</p>` : ''}
<h1 class="display s-hero__h1" data-reveal style="--i:1">${h1}</h1>
${line ? `<div class="lede s-hero__line" data-reveal style="--i:2">${line}</div>` : ''}
${ctas ? `<div class="btn-row s-hero__ctas" data-reveal style="--i:3">${ctas}</div>` : ''}
${after}
</div>
${media ? `<div class="s-hero__art protrude" data-reveal style="--i:2">
<figure class="frame frame--float s-vitrine" data-tilt="3">${reg()}<span class="frame__img s-vitrine__img">${media}</span>${label ? `<figcaption class="tag tag--ink s-vitrine__tag">${label}</figcaption>` : ''}</figure>
${cut ? `<span class="cut s-hero__cut" data-float data-depth="0.12" aria-hidden="true">${gimg(cut, { alt: '', sizes: '(min-width: 1024px) 220px, 32vw' })}</span>` : ''}
</div>` : ''}
</div>
</section>`;
}

const TILE_SIZES = '(min-width: 1240px) 300px, (min-width: 768px) 30vw, 70vw';
function tile(c, i, { small = false } = {}) {
  return `<li class="s-tiles__item" data-reveal style="--i:${i % 4}"><a class="tile s-tile${small ? ' s-tile--sm' : ''}"${linkAttrs(c.href)}>
<span class="s-tile__spec" aria-hidden="true"><span>N° ${pad(c.i + 1)}</span><span>${esc(c.label.toUpperCase())}</span></span>
<span class="tile__media s-tile__media">${gimg(c.gimg, { alt: '', sizes: small ? '(min-width: 1024px) 160px, 40vw' : TILE_SIZES })}</span>
<span class="tile__title s-tile__title">${esc(c.label)}</span>
<span class="tile__cta s-tile__cta">${arrowed('Explore')}</span>
</a></li>`;
}
const tilesHtml = (list, opts = {}) => `<ul class="s-tiles${opts.small ? ' s-tiles--sm' : ''}" role="list">${list.map((c, i) => tile(c, i, opts)).join('\n')}</ul>`;

function quoteCard(q, i = 0) {
  return `<figure class="glass glass--lift s-quote" data-reveal data-spot style="--i:${i}">
<span class="s-quote__no" aria-hidden="true">${pad(i + 1)}</span>
${q.heading ? `<p class="s-quote__h">${esc(q.heading)}</p>` : ''}
<blockquote class="s-quote__body"><p>${q.html}</p></blockquote>
${q.href ? `<figcaption class="s-quote__src">From <a${linkAttrs(q.href)}>${esc(q.from || 'the BUZZY page')}</a></figcaption>` : ''}
</figure>`;
}

function postImage(p, sizes) {
  const im = p.image && typeof p.image === 'object' ? p.image.src || p.image.url : p.image;
  return (im && photoHtml(im, { alt: '' }, { sizes })) || gimg('g-guide', { alt: '', sizes });
}
function acard(p, i) {
  const cat = (p.categories || [])[0];
  return `<li class="s-acards__item" data-reveal style="--i:${i % 3}"><article class="acard s-acard">
<a class="acard__media s-acard__media"${linkAttrs(p.path || '/' + p.slug + '/')} tabindex="-1" aria-hidden="true">${postImage(p, '(min-width: 1024px) 400px, 86vw')}</a>
<p class="acard__meta">${[p.dateText, cat && cat.name].filter(Boolean).map(esc).join(' / ')}</p>
<h3 class="acard__title"><a${linkAttrs(p.path || '/' + p.slug + '/')}>${esc(p.title)}</a></h3>
<a class="acard__more link-arrow"${linkAttrs(p.path || '/' + p.slug + '/')}>${arrowed('Read more')}</a>
</article></li>`;
}

// ---------- deals ----------
function loadDeals() {
  const f = path.join(ROOT, 'src/content/deals.json');
  if (!fs.existsSync(f)) return [];
  let d;
  try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; }
  const list = Array.isArray(d) ? d : d.deals || d.items || [];
  // the same punctuation-only dash normalisation every other copy source gets at load (src/lib/punct.mjs)
  return normaliseDashes(list.map((x) => (typeof x === 'string' ? { line: x } : x)).filter((x) => x && (x.line || x.text || x.quote || x.deal)));
}
const GROUPS = [
  ['weekly', 'Every week', /week|daily|every\s+(mon|tue|wed|thu|fri|sat|sun)|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|flower friday/i],
  ['events', 'Events and pop-ups', /event|pop-?up|bingo|giveaway|sweepstake|contest|halloween|holiday|420|green wednesday/i],
  ['rewards', 'Rewards and perks', /reward|points?|loyal|refer|birthday|member|sign up|join/i],
  ['travel', 'Visitors and hotel guests', /tourist|hotel|visitor|travel|guest/i],
];
function dealGroup(x) {
  const g = String(x.group || x.type || x.kind || x.category || '').toLowerCase();
  for (const [k] of GROUPS) if (g.startsWith(k.slice(0, 4))) return k;
  const hay = [x.line, x.text, x.quote, x.title, x.terms, x.source, x.path].filter(Boolean).join(' ');
  for (const [k, , re] of [GROUPS[3], GROUPS[2], GROUPS[1], GROUPS[0]]) if (re.test(hay)) return k;
  return 'weekly';
}
const dealLine = (x) => x.line || x.text || x.quote || x.deal || '';
const dealSrc = (x) => x.source || x.path || x.href || x.sourcePath || x.url || '';
function dealCard(ctx, x, i) {
  const to = dealSrc(x) ? liveHref(dealSrc(x)) : '';
  const srcName = x.sourceTitle || x.from || x.page || titleFor(ctx, to) || (to ? (to.replace(/^https?:\/\/[^/]+/, '').replace(/^\/|\/$/g, '').replace(/[-/]/g, ' ') || 'home') : '');
  const end = x.end || x.endDate || x.until || x.ends || '';
  return `<li class="s-offers__item" data-reveal style="--i:${i % 3}"><article class="glass glass--lift s-offer" data-spot>
<p class="s-offer__top"><span class="tag tag--signal s-offer__tag">Deal ${pad(i + 1)}</span>${end ? `<span class="s-offer__end">Ends ${esc(end)}</span>` : ''}</p>
${x.title ? `<h3 class="s-offer__h">${esc(x.title)}</h3>` : ''}
<p class="s-offer__line">${esc(dealLine(x))}</p>
${x.terms ? `<p class="s-offer__terms">${esc(x.terms)}</p>` : ''}
${to ? `<p class="s-offer__src"><a class="link-arrow"${linkAttrs(to)}>${arrowed('Source: ' + srcName)}</a></p>` : ''}
</article></li>`;
}
function dealsStrip(ctx) {
  const n = loadDeals().length;
  return `<section class="band band--signal s-dealstrip" aria-label="Deals">
<div class="wrap s-dealstrip__row">
<p class="s-dealstrip__k">${icon('tag', 's-dealstrip__ico')}<span>Deals and rewards</span></p>
<p class="s-dealstrip__t">${n ? `${n} deals and perks from BUZZY, each with a link to where BUZZY states it.` : 'BUZZY\'s current deals and perks, each with a link to where BUZZY states it.'}</p>
<div class="btn-row"><a class="btn s-dealstrip__btn"${linkAttrs('/deals/')}>See the deals</a><a class="btn btn--ghost s-dealstrip__btn2"${linkAttrs('/rewards/')}>BUZZY Rewards</a></div>
</div>
</section>`;
}

// ---------- order band ----------
function orderBand(ctx, { slug = '', label = '', id = 'order-h' } = {}) {
  const u = menu(ctx, slug || undefined);
  const d = ctx.site.delivery || {};
  const head = label ? `Shop ${esc(label)} for <em class="accent">delivery</em> or pickup` : `Order <em class="accent">online</em>`;
  return `<section class="band band--night s-order" aria-labelledby="${id}">
<div class="band__clip" aria-hidden="true">${gimg('g-night-sky', { alt: '', cls: 'band__bg s-order__bg', sizes: '100vw' })}</div>
<div class="wrap s-order__grid">
<div class="s-order__text" data-reveal>
<p class="kicker">BUZZY's live menu</p>
<h2 class="display s-h2" id="${id}">${head}</h2>
${ctx.site.deliveryLine ? `<p class="s-order__line">${esc(ctx.site.deliveryLine)}</p>` : ''}
<div class="btn-row">${btn(u, label ? `Shop ${label} for delivery` : (d.cta || 'Order for Delivery'), 'btn btn--signal')}${btn(u, label ? `Shop ${label} for pickup` : 'Order for Pickup', 'btn btn--light')}</div>
<p class="s-order__more"><a class="link-arrow"${linkAttrs('/cannabis-delivery-brooklyn/')}>${arrowed('How delivery works')}</a><a class="link-arrow"${linkAttrs('/in-store-pickup/')}>${arrowed('How pickup works')}</a></p>
</div>
<div class="glass glass--dark s-order__card" data-reveal style="--i:1">
<p class="s-order__cardk">Delivery facts</p>
${shell.specTable((d.facts || []).slice(0, 5), 's-order__spec')}
</div>
</div>
</section>`;
}

// ---------- /products/ ----------
const HUB_WORDS = { heading: 'Everything on the BUZZY Menu, Delivered', lines: ['Explore our curated catalog of premium craft cannabis, artisanal concentrates, and design-forward accessories.', 'Hand-delivered straight to your door, fast and discreet.'], button: 'Browse the Full Menu', from: 'Cannabis delivery in Brooklyn', href: '/cannabis-delivery-brooklyn/' };
function productsPage(ctx) {
  const p = '/products/';
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Products' }];
  const all = cats(ctx);
  const a = ctx.site.address || {};
  const main = `${hero({
    crumbs,
    kick: 'The BUZZY inventory',
    h1: 'Cannabis <em class="accent">products</em>',
    line: `<p>${all.length} categories on BUZZY's menu, for delivery across Brooklyn or pickup at ${esc(a.street || a.streetShort)}.</p>`,
    ctas: `${btn(menu(ctx), 'Shop Now', 'btn btn--signal')}${btn('/deals/', 'See the deals', 'btn btn--ghost')}`,
    media: gimg('g-curation', { eager: true, alt: '', sizes: '(min-width: 1024px) 420px, 70vw' }),
    cut: 'g-bud-cut',
    label: 'INVENTORY / 08 CATEGORIES',
    cls: 's-hero--hub',
  })}
<section class="band band--paper s-after s-cats" aria-labelledby="cats-h">
<div class="wrap">
<div class="s-head" data-reveal><div><p class="kicker">The categories</p><h2 class="display s-h2" id="cats-h">Shop by <em class="accent">category</em></h2></div><p class="s-head__note">Each tile opens a category page with a link to that part of BUZZY's live menu.</p></div>
${tilesHtml(all)}
</div>
</section>
<section class="band band--fog s-words" aria-labelledby="words-h">
<div class="wrap s-words__grid">
<div class="s-words__text" data-reveal>
<p class="kicker">In BUZZY's words</p>
<h2 class="display s-h2" id="words-h">${esc(HUB_WORDS.heading)}</h2>
${HUB_WORDS.lines.map((l) => `<p class="lede">${esc(l)}</p>`).join('')}
<div class="btn-row">${btn(menu(ctx), HUB_WORDS.button, 'btn')}<a class="link-arrow"${linkAttrs(HUB_WORDS.href)}>${arrowed('From ' + HUB_WORDS.from)}</a></div>
</div>
<div class="s-words__svc" data-reveal style="--i:1">${typeof shell.serviceCards === 'function' ? shell.serviceCards(ctx) : ''}</div>
</div>
</section>
${orderBand(ctx)}
${dealsStrip(ctx)}`;
  return out(ctx, { path: p, title: 'Products' + TAIL, description: `Shop BUZZY by category: ${all.map((c) => c.label.toLowerCase()).join(', ')}. Order online for delivery in Brooklyn or pickup at ${a.street}, ${a.city}, ${a.state}.`, crumbs, bodyClass: 'page-products', main });
}

// ---------- /products/<slug>/ ----------
const CUT = { flower: 'g-bud-cut', 'pre-rolls': 'g-preroll-cut', vapes: 'g-cloud-cut', edibles: 'g-cloud-cut', concentrates: 'g-bud-cut', tinctures: 'g-cloud-cut', topicals: 'g-cloud-cut', accessories: 'g-preroll-cut' };
function categoryPage(ctx, cat, all) {
  const p = cat.href;
  const g = glueOf(ctx, cat.slug);
  const label = cat.label;
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Products', href: '/products/' }, { label }];
  const order = menu(ctx, cat.menu || cat.slug);
  const intro = glueText(g);
  const quotes = glueQuotes(g).map((q) => ({ ...q, from: q.from || titleFor(ctx, q.href) }));
  const related = glueRelated(ctx, g);
  const others = all.filter((c) => c.slug !== cat.slug);
  const main = `${hero({
    crumbs,
    kick: `N° ${pad(cat.i + 1)} / ${label.toUpperCase()}`,
    h1: esc(label),
    line: `<p>${esc(label)} on BUZZY's menu, for delivery across Brooklyn or in-store pickup.</p>`,
    ctas: `${btn(order, `Shop ${label}`, 'btn btn--signal')}${btn('/products/', 'All products', 'btn btn--ghost')}`,
    media: gimg(cat.gimg, { eager: true, alt: (g && g.alt) || '', sizes: '(min-width: 1024px) 440px, 70vw' }),
    cut: CUT[cat.slug] || 'g-cloud-cut',
    label: `SKU / ${esc(label.toUpperCase())}`,
    cls: 's-hero--cat',
  })}
<section class="band band--paper s-after s-format" aria-labelledby="format-h">
<div class="wrap s-format__grid">
<div class="s-format__text" data-reveal>
<p class="kicker">The format</p>
<h2 class="display s-h2" id="format-h">About <em class="accent">${esc(label.toLowerCase())}</em></h2>
<div class="prose s-format__prose">${intro.length ? intro.map((s) => `<p>${esc(s)}</p>`).join('') : `<p>${esc(label)} is one of the eight categories on BUZZY's menu.</p>`}</div>
<div class="btn-row">${btn(order, `Shop ${label} for delivery or pickup`, 'btn')}</div>
</div>
<aside class="glass glass--strong s-spec" data-reveal style="--i:1" aria-label="${escA(label)} at a glance">
<p class="s-spec__k">Inventory card</p>
${shell.specTable([['Category', label], ['Index', 'N° ' + pad(cat.i + 1) + ' of ' + pad(all.length)], ['Order', 'Delivery or pickup'], ['Store', (ctx.site.address || {}).streetShort || '']].filter((r) => r[1]), 's-spec__table')}
</aside>
</div>
</section>
${quotes.length ? `<section class="band band--fog s-words s-words--cat" aria-labelledby="lw-h">
<div class="wrap">
<div class="s-head" data-reveal><div><p class="kicker">In BUZZY's words</p><h2 class="display s-h2" id="lw-h">BUZZY on <em class="accent">${esc(label.toLowerCase())}</em></h2></div><p class="s-head__note">Quoted from BUZZY's own pages, each with a link to the page it comes from.</p></div>
<div class="s-quotes">${quotes.map((q, i) => quoteCard(q, i)).join('\n')}</div>
</div>
</section>` : ''}
${related.length ? `<section class="band band--paper s-related" aria-labelledby="rel-h">
<div class="wrap">
<div class="s-head" data-reveal><div><p class="kicker">From The Buzzy Guide</p><h2 class="display s-h2" id="rel-h">Read <em class="accent">more</em></h2></div><a class="link-arrow"${linkAttrs('/learn/')}>${arrowed('All articles')}</a></div>
<ul class="s-acards" role="list">${related.slice(0, 3).map(acard).join('\n')}</ul>
</div>
</section>` : ''}
${orderBand(ctx, { slug: cat.menu || cat.slug, label })}
<section class="band band--fog s-others" aria-labelledby="others-h">
<div class="wrap">
<div class="s-head" data-reveal><div><p class="kicker">Keep browsing</p><h2 class="display s-h2" id="others-h">Other <em class="accent">categories</em></h2></div><a class="link-arrow"${linkAttrs('/products/')}>${arrowed('All products')}</a></div>
${tilesHtml(others, { small: true })}
</div>
</section>
${dealsStrip(ctx)}`;
  const description = (g && g.description && typeof g.description === 'string' && g.description.length < 170 ? g.description : '') || `${label} at BUZZY, ${ctx.site.address.street}, Brooklyn: order online for delivery or in-store pickup.`;
  return out(ctx, { path: p, title: (g && g.seoTitle) || label + TAIL, description, crumbs, bodyClass: 'page-category cat-' + cat.slug, main });
}

// ---------- /deals/ ----------
function dealsPage(ctx) {
  const p = '/deals/';
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Deals' }];
  const deals = loadDeals();
  let n = 0;
  const groups = GROUPS.map(([k, title]) => ({ k, title, items: deals.filter((x) => dealGroup(x) === k) })).filter((g) => g.items.length);
  const body = groups.length ? groups.map((g, gi) => `<section class="band ${gi % 2 ? 'band--fog' : 'band--paper'}${gi === 0 ? ' s-after' : ''} s-deals" aria-labelledby="deals-${g.k}">
<div class="wrap">
<div class="s-head" data-reveal><div><p class="kicker">${pad(gi + 1)} / ${esc(g.k.toUpperCase())}</p><h2 class="display s-h2" id="deals-${g.k}">${esc(g.title)}</h2></div><p class="s-head__note">${g.items.length} ${g.items.length === 1 ? 'line' : 'lines'} in BUZZY's own words.</p></div>
<ul class="s-offers" role="list">${g.items.map((x) => dealCard(ctx, x, n++)).join('\n')}</ul>
</div>
</section>`).join('\n') : `<section class="band band--paper s-after s-deals"><div class="wrap wrap--narrow"><p class="lede">BUZZY's deals are being gathered from its own pages. Meanwhile, the live menu and BUZZY Rewards are linked above.</p></div></section>`;
  const main = `${hero({
    crumbs,
    kick: 'Deals and perks',
    h1: 'BUZZY <em class="accent">deals</em>',
    line: `<p>Every deal, discount and perk BUZZY states on its own pages, quoted as written, each with a link to its source.</p>`,
    ctas: `${btn(menu(ctx), 'Shop Now', 'btn btn--signal')}${btn('/rewards/', 'BUZZY Rewards', 'btn btn--ghost')}`,
    media: gimg('g-rewards', { eager: true, alt: '', sizes: '(min-width: 1024px) 400px, 70vw' }),
    cut: 'g-cloud-cut',
    label: `DEALS / ${pad(deals.length)}`,
    cls: 's-hero--deals',
  })}
${body}
${orderBand(ctx)}`;
  return out(ctx, { path: p, title: 'Deals' + TAIL, description: 'BUZZY deals, discounts and rewards perks in Cobble Hill, Brooklyn, quoted from BUZZY\'s own pages with links to each source.', crumbs, bodyClass: 'page-deals', main });
}

// ---------- captured pages: BUZZY's own words, every block ----------
const itemHtml = (it) => (typeof it === 'string' ? it : it.html || esc(it.text || it.title || ''));
const isQ = (b) => b && /^h[2-5]$/.test(b.type) && /\?\s*$/.test(b.text || '');
const isH = (b) => b && /^h[3-5]$/.test(b.type);

function embedHtml(ctx, b, slug) {
  const src = String(b.src || '');
  const dutchie = /dutchie/i.test(src + ' ' + (b.kind || ''));
  const iframe = /iframe/i.test(b.kind || '') || (/^https?:/i.test(src) && !/\.js(\?|$)/i.test(src) && !dutchie);
  const fallback = dutchie || slug === 'menu' ? menu(ctx) : /^https?:/i.test(src) ? src : 'https://getbuzzy.com/' + (slug ? slug + '/' : '');
  const fbLabel = dutchie || slug === 'menu' ? 'Open the live menu' : /alpine|stickycard|reward|signup|sign-up/i.test(src + slug) ? 'Open the sign-up form' : 'Open it on getbuzzy.com';
  let live = '';
  if (dutchie && /^https?:/i.test(src)) live = `<div class="s-embed__live"><script async src="${escA(src)}"${b.id ? ` id="${escA(b.id)}"` : ''}></script></div>`;
  else if (iframe && /^https?:/i.test(src)) live = `<div class="s-embed__live"><iframe src="${escA(src)}" title="${escA(fbLabel.replace(/^Open /, ''))}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`;
  return `<div class="glass glass--strong s-embed${dutchie ? ' s-embed--menu' : ''}" data-reveal>
<p class="s-embed__k">${icon(dutchie ? 'cart' : 'gift', 's-embed__ico')}<span>${dutchie ? 'Live menu' : 'Sign-up form'}</span></p>
${live}
${b.note ? `<p class="s-embed__note">${esc(b.note)}</p>` : ''}
<p class="s-embed__fb"><a class="btn btn--signal"${linkAttrs(fallback)}>${esc(fbLabel)}${icon('ext', 's-ext')}</a></p>
</div>`;
}

function faqHtml(items) {
  return `<div class="faq s-faq">${items.map((it, i) => `<details class="faq__item s-faq__item"${i === 0 ? ' open' : ''}>
<summary class="faq__q s-faq__q"><span>${esc(it.q)}</span>${icon('plus', 's-faq__ico')}</summary>
<div class="faq__a s-faq__a prose">${it.html}</div>
</details>`).join('\n')}</div>`;
}

function blockHtml(ctx, b, slug) {
  switch (b.type) {
    case 'p': return `<p>${rw(b.html)}</p>`;
    case 'h1': case 'h2': return `<h2 class="display s-h2">${esc(b.text)}</h2>`;
    case 'h3': return `<h3 class="s-h3">${esc(b.text)}</h3>`;
    case 'h4': case 'h5': case 'h6': return `<h4 class="s-h4">${esc(b.text)}</h4>`;
    case 'ul': case 'ol': return `<${b.type} class="s-list">${(b.items || []).map((it) => `<li>${rw(itemHtml(it))}</li>`).join('')}</${b.type}>`;
    case 'img': { const h = photoHtml(b.src, { alt: b.alt || '', w: b.w, h: b.h }, { sizes: '(min-width: 1024px) 520px, 90vw' }); return h ? `<figure class="s-fig">${b.href ? `<a${linkAttrs(liveHref(b.href))}>${h}</a>` : h}${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>` : (b.caption ? `<p>${esc(b.caption)}</p>` : ''); }
    case 'button': return b.text ? `<div class="btn-row s-btns">${btn(b.href || menu(ctx), b.text, 'btn')}</div>` : '';
    case 'quote': return `<blockquote class="s-bq">${b.html ? rw(b.html) : esc(b.text || '')}${b.cite ? `<footer>${esc(b.cite)}</footer>` : ''}</blockquote>`;
    case 'faq': return faqHtml((b.items || []).map((it) => ({ q: it.q, html: rw(it.a_html) })));
    case 'icon-box': return `<div class="glass glass--lift s-ibox">${b.icon && /^\p{Extended_Pictographic}/u.test(b.icon) ? `<span class="s-ibox__emoji" aria-hidden="true">${esc(b.icon)}</span>` : ''}${b.title ? `<h3 class="s-h3">${esc(b.title)}</h3>` : ''}${b.html ? `<div>${rw(b.html)}</div>` : ''}</div>`;
    case 'form': return `<div class="glass glass--strong s-form">${demoForm({ fields: (b.fields || []).map((f) => (typeof f === 'string' ? f : f.label || f.name || '')).filter(Boolean), button: b.button || 'Submit' })}${b.consent ? `<p class="s-small">${rw(b.consent)}</p>` : ''}</div>`;
    case 'embed': return embedHtml(ctx, b, slug);
    case 'table': return `<table class="s-table"><tbody>${(b.rows || []).map((r) => `<tr>${r.map((c) => `<td>${rw(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    case 'hours': return `<table class="s-table s-table--hours"><tbody>${(b.rows || []).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    case 'steps': return `<ol class="steps s-steps" role="list">${(b.items || []).map((s, i) => `<li class="step s-step" data-reveal style="--i:${i % 4}"><div class="glass glass--lift s-step__card"><span class="step__num numeral s-step__n">${esc(s.num || pad(i + 1))}</span>${s.title ? `<h3 class="step__title">${esc(s.title)}</h3>` : ''}${s.text ? `<p class="step__text">${rw(s.text)}</p>` : ''}${s.html ? `<div class="step__text">${rw(s.html)}</div>` : ''}</div></li>`).join('')}</ol>`;
    case 'cards': return `<ul class="s-cards" role="list">${(b.items || []).map((c, i) => {
      const im = c.img ? photoHtml(typeof c.img === 'string' ? c.img : c.img.src, { alt: '' }, { sizes: '(min-width: 1024px) 300px, 80vw' }) : '';
      const t = c.title ? `<h3 class="s-card__t">${esc(c.title)}</h3>` : '';
      const inner = `<span class="s-card__no" aria-hidden="true">${pad(i + 1)}</span>${im ? `<span class="s-card__img">${im}</span>` : ''}${c.label ? `<p class="tag tag--ink s-card__label">${esc(c.label)}</p>` : ''}${t}${c.html ? `<div class="s-card__d">${rw(c.html)}</div>` : ''}${c.text ? `<p class="s-card__d">${esc(c.text)}</p>` : ''}${c.href ? `<a class="link-arrow s-card__go"${linkAttrs(liveHref(c.href))}>${arrowed(c.button || 'Open')}</a>` : ''}`;
      return `<li class="s-cards__item" data-reveal style="--i:${i % 4}"><div class="glass glass--lift s-card" data-spot>${inner}</div></li>`;
    }).join('')}</ul>`;
    case 'video': return '';
    default: return b.html ? `<div>${rw(b.html)}</div>` : b.text ? `<p>${esc(b.text)}</p>` : '';
  }
}

// group a section's blocks: FAQ runs (h3/h4 ending in "?" + answers), card runs (2+ h3/h4 headings each with content:
// tiers, perks, steps, brand groups), the rest as prose. Every block is rendered exactly once.
// a captured section that holds several h2 parts (the capture flattens some pages into one section): one band per h2;
// a short label paragraph right before an h2 becomes that band's kicker. Every block stays, in order.
function splitAtH2(secs) {
  const res = [];
  for (const s of secs) {
    let cur = { ...s, blocks: [] };
    res.push(cur);
    for (const b of s.blocks) {
      const dup = b.type === 'h2' && !cur.blocks.length && String(b.text || '').trim() === String(cur.heading || '').trim();
      if (b.type === 'h2' && !dup && (cur.blocks.length || String(cur.heading || '').trim())) {
        const prev = cur.blocks[cur.blocks.length - 1];
        const t = prev && prev.type === 'p' && !prev.role ? text(prev.html) : '';
        const kick = t && t.length <= 48 && !/[.!?:]$/.test(t) ? cur.blocks.pop() : null;
        cur = { id: slugify(b.text || ''), heading: b.text, kickerHtml: kick ? kick.html : '', blocks: [] };
        res.push(cur);
        continue;
      }
      cur.blocks.push(b);
    }
  }
  return res;
}
const TIER_LABEL = /^(\d+(st|nd|rd|th)\s+purchase|\d+\s*pts)$/i;

function piecesOf(bl) {
  const pieces = [];
  let i = 0;
  while (i < bl.length) {
    const b = bl[i];
    // reward tiers: a label ("1st Purchase", "100PTS") + its value and line, as captured paragraphs
    if (b.type === 'p' && TIER_LABEL.test(text(b.html))) {
      const cards = [];
      while (i < bl.length && bl[i].type === 'p' && TIER_LABEL.test(text(bl[i].html))) {
        const c = { label: bl[i], blocks: [] }; i++;
        while (i < bl.length && bl[i].type === 'p' && !TIER_LABEL.test(text(bl[i].html)) && c.blocks.length < 2) { c.blocks.push(bl[i]); i++; }
        cards.push(c);
      }
      pieces.push({ kind: 'tiers', cards });
      continue;
    }
    if (b.type === 'faq') {
      const items = [];
      while (i < bl.length && bl[i].type === 'faq') { items.push(...(bl[i].items || [])); i++; }
      pieces.push({ kind: 'faqblock', items });
      continue;
    }
    if (isQ(b)) {
      const items = [];
      while (i < bl.length && isQ(bl[i])) {
        const q = bl[i].text; const ans = []; i++;
        while (i < bl.length && !/^h[1-5]$/.test(bl[i].type) && bl[i].type !== 'button') { ans.push(bl[i]); i++; }
        items.push({ q, blocks: ans });
      }
      pieces.push({ kind: 'faq', items });
      continue;
    }
    if (isH(b)) {
      // a run of 2+ minor headings, each followed by its own content: a card group
      let j = i; const cards = [];
      while (j < bl.length && isH(bl[j]) && !isQ(bl[j])) {
        const c = { head: bl[j], blocks: [] }; j++;
        while (j < bl.length && !/^h[1-5]$/.test(bl[j].type) && !['faq', 'embed', 'form', 'cards', 'steps'].includes(bl[j].type)) { c.blocks.push(bl[j]); j++; }
        cards.push(c);
      }
      if (cards.length >= 2) { pieces.push({ kind: 'cards', cards }); i = j; continue; }
    }
    pieces.push({ kind: 'block', b });
    i++;
  }
  return pieces;
}
function piecesHtml(ctx, pieces, slug, faqs) {
  return pieces.map((p) => {
    if (p.kind === 'faq') { const items = p.items.map((it) => ({ q: it.q, html: it.blocks.map((b) => blockHtml(ctx, b, slug)).join('') })); faqs.push(...items); return faqHtml(items); }
    if (p.kind === 'cards') return `<ul class="s-cards${p.cards.length === 3 || p.cards.length > 4 ? ' s-cards--3' : ''}" role="list">${p.cards.map((c, i) => `<li class="s-cards__item" data-reveal style="--i:${i % 4}"><div class="glass glass--lift s-card" data-spot><span class="s-card__no" aria-hidden="true">${pad(i + 1)}</span><h3 class="s-card__t">${esc(c.head.text)}</h3>${c.blocks.map((b) => blockHtml(ctx, b, slug)).join('')}</div></li>`).join('')}</ul>`;
    if (p.kind === 'faqblock') { const items = p.items.map((it) => ({ q: it.q, html: rw(it.a_html) })); faqs.push(...items); return faqHtml(items); }
    if (p.kind === 'tiers') return `<ol class="s-tiers${p.cards.length === 3 ? ' s-tiers--3' : ''}" role="list">${p.cards.map((c, i) => `<li class="s-tiers__item" data-reveal style="--i:${i % 4}"><div class="glass glass--strong glass--lift s-tier" data-spot><p class="numeral s-tier__n">${rw(c.label.html)}</p>${c.blocks.map((b) => `<p class="${text(b.html).length <= 16 ? 's-tier__v' : 's-tier__d'}">${rw(b.html)}</p>`).join('')}</div></li>`).join('')}</ol>`;
    return blockHtml(ctx, p.b, slug);
  }).join('\n');
}

// mood stills for prose sections without a photo of their own (never captioned as BUZZY's store, staff or products)
const POOL = ['g-vitrine', 'g-curation', 'g-brands', 'g-pickup', 'g-rewards'];
const PAGE = {
  rewards: { kick: 'BUZZY Rewards', img: 'g-rewards', cut: 'g-cloud-cut', label: 'REWARDS / FREE TO JOIN', anchors: { 'reward-form': /^your first 5% is calling/i, welcome: /^three visits\. three reasons/i } },
  'rewards-copy': { kick: 'BUZZY Rewards', img: 'g-rewards', cut: 'g-cloud-cut', label: 'REWARDS / POINTS' },
  'rewards-signup-page': { kick: 'BUZZY Rewards', img: 'g-rewards', cut: 'g-cloud-cut', label: 'REWARDS / SIGN UP', h1: 'Rewards Program Sign Up' },
  brands: { kick: 'Brands', img: 'g-brands', cut: 'g-bud-cut', label: 'BRANDS / CURATED', anchors: { directory: /find your kind of cannabis/i }, frags: { 'gummies-edibles': '/products/edibles/', 'vapes-concentrates': '/products/vapes/', 'flower-pre-rolls': '/products/flower/', 'cannabis-beverages': 'DRINKS', 'tinctures-topicals': '/products/tinctures/', 'vaporizers-accessories': '/products/accessories/' } },
  menu: { kick: 'The live menu', img: 'g-curation', cut: 'g-bud-cut', label: 'MENU / LIVE' },
  product: { kick: 'Product', img: 'g-vitrine', cut: 'g-bud-cut', label: 'SKU / PRODUCT' },
  bingo: { kick: 'In-store game', img: 'g-events', cut: 'g-cloud-cut', label: 'EVENT / BINGO', anchors: { 'bzb-card': /^the cards$/i } },
  dabkitcontest26: { kick: 'Official rules', img: 'g-vitrine', cut: 'g-cloud-cut', label: 'RULES / SWEEPSTAKES' },
};

// fallback while CAPTURE's JSON is not written yet: the page's visible text lines between the header and the footer
function txtRecord(slug) {
  const f = path.join(ROOT, 'tmp/txt', slug + '.txt');
  if (!fs.existsSync(f)) return null;
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const title = lines[0];
  let start = 0;
  lines.forEach((l, k) => { if (l === 'Neighborhood Map' && k < 80) start = k + 1; });
  let end = lines.findIndex((l, k) => k > start && /^Open 8am . 10pm Everyday$/.test(l));
  if (end < 0) end = lines.length;
  const body = lines.slice(start, end);
  return { slug, path: '/' + slug + '/', title, description: '', h1: body[0] || title, sections: [{ id: 'body', heading: '', blocks: body.slice(1).map((t) => ({ type: 'p', html: esc(t) })) }], fromTxt: true };
}

// captured in-page links (#frag) whose target the rebuild does not carry: a mapped in-site page, or plain text (words kept)
function fixFragments(ctx, html, frags) {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  return html.replace(/<a\b([^>]*?)\shref="#([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (m, pre, frag, post, inner) => {
    if (frag && ids.has(frag)) return m;
    const to = frags[frag] === 'DRINKS' ? menu(ctx, 'drinks') : frags[frag];
    if (to) return `<a${pre}${linkAttrs(to)}${post}>${inner}</a>`;
    return `<span class="s-nolink">${inner}</span>`;
  });
}

function capturedPage(ctx, slug, rec) {
  const conf = PAGE[slug] || {};
  const p = rec.path || '/' + slug + '/';
  const h1 = String(rec.h1 || conf.h1 || pageName(rec) || '').trim();
  const crumbs = [{ label: 'Home', href: '/' }, ...(/^rewards-/.test(slug) ? [{ label: 'Rewards', href: '/rewards/' }] : []), { label: pageName(rec) || h1 }];
  const secs = splitAtH2((rec.sections || []).map((s) => ({ ...s, blocks: (s.blocks || []).slice() })));
  // the hero takes the section that carries the H1: a short label before it (kicker), its leading paragraphs + buttons
  let heroSec = secs.find((s) => (s.blocks || []).some((b) => b.type === 'h1')) || secs.find((s) => String(s.heading || '').trim() === h1);
  if (!heroSec && secs.length && !(secs[0].heading || '').trim()) heroSec = secs[0];
  const heroKick = []; const heroLine = []; const heroCtas = []; const heroFacts = [];
  let heroPhoto = '';
  if (heroSec) {
    const rest = [];
    const hasH1 = heroSec.blocks.some((b) => b.type === 'h1');
    let seenH1 = !hasH1;
    for (const b of heroSec.blocks) {
      if (b.type === 'h1') { seenH1 = true; continue; }
      if ((b.role === 'kicker' || /^h[3-6]$/.test(b.type)) && /^(p|h[3-6])$/.test(b.type) && text(b.html || b.text).length < 70 && !heroKick.length && !heroLine.length && !rest.length) { heroKick.push(text(b.html || b.text)); continue; }
      // a captured link paragraph ("Explore Brand Directory") is a hero button
      if (b.type === 'p' && b.role === 'link' && heroLine.length && heroCtas.length < 2 && !rest.length && /<a\b/i.test(b.html || '')) { heroCtas.push({ text: text(b.html), href: ((b.html || '').match(/href="([^"]*)"/) || [])[1] || '' }); continue; }
      if (b.type === 'ul' && heroLine.length && !heroFacts.length && !rest.length && (b.items || []).length <= 4 && (b.items || []).every((it) => text(itemHtml(it)).length <= 48)) { heroFacts.push(b); continue; }
      if (!seenH1) { if ((b.type === 'p' || /^h[2-6]$/.test(b.type)) && text(b.html || b.text).length < 70 && !heroKick.length) { heroKick.push(text(b.html || b.text)); continue; } rest.push(b); continue; }
      if (rest.length) { rest.push(b); continue; }
      if (b.type === 'p' && heroLine.length < 2 && !heroCtas.length) { heroLine.push(b); continue; }
      if (b.type === 'button' && heroCtas.length < 2) { heroCtas.push(b); continue; }
      if (b.type === 'img' && !heroPhoto) { heroPhoto = photoHtml(b.src, { alt: b.alt || '', w: b.w, h: b.h }, { eager: true, sizes: '(min-width: 1024px) 420px, 70vw' }); if (heroPhoto) continue; }
      if (b.type === 'ul' && heroCtas.length && !heroFacts.length && (b.items || []).length <= 4) { heroFacts.push(b); continue; }
      rest.push(b);
    }
    heroSec.blocks = rest;
    if (String(heroSec.heading || '').trim() === h1) heroSec.heading = '';
  }
  const media = heroPhoto || gimg(conf.img || 'g-vitrine', { eager: true, alt: '', sizes: '(min-width: 1024px) 420px, 70vw' });
  const faqs = [];
  let pool = 0; let side = 0;
  const live = secs.filter((s) => (s.blocks || []).length || String(s.heading || '').trim());
  const body = live.map((s, si) => {
    const head = String(s.heading || '').trim();
    const dupHead = head && s.blocks.some((b) => /^h[1-4]$/.test(b.type) && String(b.text || '').trim() === head);
    const pieces = piecesOf(s.blocks);
    const special = pieces.some((x) => x.kind !== 'block' || /^(faq|embed|cards|steps|form|table)$/.test(x.b.type));
    const imgs = s.blocks.filter((b) => b.type === 'img').length;
    const prose = s.blocks.filter((b) => b.type === 'p').length;
    const html = piecesHtml(ctx, pieces, slug, faqs);
    const ground = si % 2 ? 'band--fog' : 'band--paper';
    const headHtml = (s.kickerHtml ? `<p class="kicker s-sec__kicker">${rw(s.kickerHtml)}</p>` : '') + (head && !dupHead ? `<h2 class="display s-h2">${esc(head)}</h2>` : '');
    const anchor = Object.entries(conf.anchors || {}).find(([, re]) => re.test(head) || s.blocks.some((b) => /^h[1-4]$/.test(b.type) && re.test(b.text || '')));
    const sid = anchor ? anchor[0] : s.id;
    const id = sid && /^[a-z][\w-]*$/i.test(sid) ? ` id="${escA(sid)}"` : '';
    if (!special && !imgs && prose >= 2 && !rec.fromTxt && side < 3) {
      const flip = side++ % 2 ? ' s-row--flip' : '';
      return `<section class="band ${ground} s-sec s-row${flip}"${id}>
<div class="wrap s-row__grid">
<div class="s-row__text prose" data-reveal>${headHtml}${html}</div>
<div class="s-row__media" data-reveal style="--i:1"><figure class="frame s-row__frame" data-tilt="2">${reg()}<span class="frame__img">${gimg(POOL[pool++ % POOL.length], { alt: '', sizes: '(min-width: 1024px) 420px, 80vw' })}</span></figure></div>
</div>
</section>`;
    }
    return `<section class="band ${ground} s-sec${special ? ' s-sec--wide' : ''}"${id}>
<div class="wrap${special ? '' : ' wrap--narrow'} s-sec__inner">
<div class="s-sec__body${special ? '' : ' prose'}" data-reveal>${headHtml}${html}</div>
</div>
</section>`;
  });
  if (body.length) body[0] = body[0].replace('class="band ', 'class="band s-after ');
  const lineHtml = heroLine.map((b) => `<p>${rw(b.html)}</p>`).join('');
  const after = heroFacts.map((b) => `<ul class="s-hero__facts" data-reveal style="--i:4">${(b.items || []).map((it) => `<li>${icon('diamond', 's-hero__fico')}<span>${rw(itemHtml(it))}</span></li>`).join('')}</ul>`).join('');
  const ctas = heroCtas.map((b, i) => btn(b.href || menu(ctx), b.text, i ? 'btn btn--ghost' : 'btn btn--signal')).join('');
  const kick = heroKick.length ? esc(heroKick[0]) : esc(conf.kick || '');
  const main = fixFragments(ctx, `${hero({ crumbs, kick, h1: esc(h1), line: lineHtml, ctas, after, media, cut: conf.cut, label: conf.label || '', cls: 's-hero--page s-hero--' + slug })}
${body.join('\n')}`, conf.frags || {});
  const firstP = secs.flatMap((s) => s.blocks).find((b) => b.type === 'p');
  const description = rec.description || (firstP ? text(firstP.html).slice(0, 155) : h1) || h1;
  const jsonld = faqs.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: text(f.html) } })) }] : [];
  return out(ctx, { path: p, title: rec.title || h1 + TAIL, description, crumbs, bodyClass: 'page-captured page-' + slug, main, jsonld });
}

export async function render(ctx) {
  const all = cats(ctx);
  const pages = [productsPage(ctx), ...all.map((c) => categoryPage(ctx, c, all)), dealsPage(ctx)];
  for (const slug of CAPTURED) {
    const rec = (ctx.content || {})[slug] || txtRecord(slug);
    if (rec) pages.push(capturedPage(ctx, slug, rec));
  }
  return pages;
}
