// learn.mjs - LEARN lane ("Dream Inventory" reading room): /learn/ (BUZZY's guide hub: captured words + featured newest
// post + every post as .acard with category chips), the 5 category archives (/category/.../: captured words + that
// category's posts), every post at /<slug>/ (article template), /education/ (NEW hub) and /education/<slug>/ for every
// ctx.learn guide. Lane classes are prefixed n-; FOUNDATION's component classes are used as is. No cross-lane imports.
import { esc, escA, href, linkAttrs, gimg, img, stripTags, hasGenerated, imgUrl, rewriteLinks, liveHref, localPhoto, menu, absUrl } from './util.mjs';
import { page, icon, crumbsHtml } from './shell.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtDate = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : ''; };
const ymd = (iso) => String(iso || '').slice(0, 10);
const words = (html) => stripTags(html).split(/\s+/).filter(Boolean).length;
const SUFFIX_RE = /\s*\|\s*BUZZY\s*$/i;
const plainTitle = (t) => stripTags(String(t || '').replace(SUFFIX_RE, '')).trim();
function clip(s, n = 150) {
  const t = stripTags(s).replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const i = cut.lastIndexOf(' ');
  return (i > n / 2 ? cut.slice(0, i) : cut).replace(/[\s,;:.]+$/, '') + '…';
}
const pathOf = (u) => href(liveHref(u || '')).split(/[?#]/)[0];
const pageTitle = (t) => `${t} | BUZZY`;
const orgLd = (ctx) => ({ '@type': 'Organization', name: ctx.site.name || 'BUZZY', url: ctx.site.origin + '/' });

// a captured photo reference (string URL or { src, alt, w, h }) -> a local photo { src, w, h, alt } or null
function photoOf(im) {
  if (!im) return null;
  const o = typeof im === 'string' ? { src: im } : { ...im };
  const src = o.src || o.url;
  if (!src) return null;
  const hit = localPhoto(src);
  if (!hit || !hit.src) return null;
  return { src: hit.src, w: o.w || hit.w, h: o.h || hit.h, alt: o.alt || '' };
}
const firstImg = (html) => { const m = String(html || '').match(/<img\b[^>]*\ssrc="([^"]+)"[^>]*>/i); if (!m) return null; return { src: m[1], alt: stripTags((m[0].match(/\salt="([^"]*)"/i) || [])[1] || '') }; };
// a photo when captured locally, else generated mood art (decorative)
const media = (ph, gen, opts = {}) => (ph
  ? img({ src: ph.src, alt: ph.alt || '', w: ph.w, h: ph.h }, { ...opts, alt: opts.alt != null ? opts.alt : ph.alt || '' })
  : gimg(gen, { ...opts, alt: '' }));

// ---------- trusted captured HTML: D4 link rule, old classes and inline styles dropped, h1 demoted, images local ----------
function prose(html, { sizes = '(min-width: 900px) 720px, 92vw' } = {}) {
  let h = rewriteLinks(String(html || ''));
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  h = h.replace(/\s(?:class|style|id|data-[\w-]+)=("[^"]*"|'[^']*')/gi, '');
  h = h.replace(/<h1(\s[^>]*)?>/gi, '<h2>').replace(/<\/h1>/gi, '</h2>');
  h = h.replace(/<img\b([^>]*?)\s*\/?>/gi, (m, a) => {
    const src = (a.match(/\ssrc="([^"]+)"/i) || [])[1];
    const alt = stripTags((a.match(/\salt="([^"]*)"/i) || [])[1] || '');
    const ph = src ? photoOf(src) : null;
    if (ph) return img({ src: ph.src, w: ph.w, h: ph.h }, { alt, sizes });
    const s2 = src ? liveHref(src) : '';
    if (!/^https?:/i.test(s2)) return alt ? `<span class="n-imgalt">${esc(alt)}</span>` : '';
    return `<img src="${escA(s2)}" alt="${escA(alt)}" loading="lazy" decoding="async">`;
  });
  h = h.replace(/<a\b([^>]*?)\shref="(https?:[^"]+)"([^>]*)>/gi, (m, pre, u, post) => (/\starget=/i.test(pre + post) ? m : `<a${pre} href="${u}"${post} target="_blank" rel="noopener">`));
  h = h.replace(/<table\b/gi, '<div class="n-table"><table').replace(/<\/table>/gi, '</table></div>');
  h = h.replace(/<p>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p>/gi, '');
  return h;
}

// ---------- items + cards ----------
const GEN_BY_CAT = { education: 'g-guide', guides: 'g-guide', reviews: 'g-curation', community: 'g-events', 'brooklyn-cannabis-brands': 'g-brands' };
function readLabel(p) {
  const r = p.readTime;
  if (typeof r === 'number' && r > 0) return `${r} min read`;
  if (typeof r === 'string' && r.trim()) return /min/i.test(r) ? r.trim() : `${r.trim()} min read`;
  return `${Math.max(1, Math.round(words(p.html) / 230))} min read`;
}
function postItem(p) {
  const path = href(p.path || `/${p.slug}/`);
  const cats = (p.categories || []).filter((c) => c && c.slug);
  const ph = photoOf(p.image) || photoOf(p.ogImage) || photoOf(firstImg(p.html));
  if (ph && !ph.alt) ph.alt = (p.image && p.image.alt) || '';
  const gen = (cats.map((c) => GEN_BY_CAT[c.slug]).find(Boolean)) || 'g-guide';
  return {
    kind: 'post', slug: p.slug, path, title: stripTags(p.h1 || plainTitle(p.title)), date: p.date, dateText: p.dateText || fmtDate(p.date),
    excerpt: clip(p.excerpt || p.description || p.html || ''), ph, gen, read: readLabel(p), cats, more: 'Read More',
  };
}
function metaOf(it) {
  if (it.kind === 'guide') return `<span class="n-meta__item">Guide</span><span class="n-meta__item">${esc(it.read)}</span>`;
  return `${it.dateText ? `<time class="n-meta__item" datetime="${escA(ymd(it.date))}">${esc(it.dateText)}</time>` : ''}<span class="n-meta__item">${esc(it.read)}</span>`;
}
const tagsOf = (it) => (it.cats || []).map((c) => `<span class="tag n-card__tag">${esc(c.name)}</span>`).join('');
const CARD_SIZES = '(min-width: 1180px) 400px, (min-width: 700px) 46vw, 82vw';
function card(it, { i = 0, h = 'h3', excerpt = true, filter = false, over = null } = {}) {
  const o = over || {};
  const title = o.title || it.title;
  const tagData = filter ? ` data-filter-item data-tags="${escA((it.cats || []).map((c) => c.slug).join(' '))}"` : '';
  return `<li class="n-grid__item"${tagData} data-reveal style="--i:${i % 6}"><a class="acard n-card"${linkAttrs(it.path)}>
<span class="acard__media n-card__media">${media(it.ph, it.gen, { sizes: CARD_SIZES, alt: '' })}</span>
<span class="n-card__body">
<span class="acard__meta n-meta n-card__meta">${o.label ? `<span class="n-meta__item">${esc(stripTags(o.label))}</span>` : ''}${metaOf(it)}</span>
<${h} class="acard__title n-card__title">${esc(title)}</${h}>
${o.html ? `<span class="n-card__excerpt">${esc(stripTags(o.html))}</span>` : excerpt && it.excerpt ? `<span class="n-card__excerpt">${esc(it.excerpt)}</span>` : ''}
${tagsOf(it) ? `<span class="n-card__tags">${tagsOf(it)}</span>` : ''}
<span class="acard__more link-arrow n-card__more">${esc(o.more || it.more)}${icon('arrow')}</span>
</span>
</a></li>`;
}
const grid = (items, opts = {}) => `<ul class="n-grid${opts.cls ? ' ' + opts.cls : ''}" role="list">${items.map((it, i) => card(it, { i, ...opts, over: opts.overOf ? opts.overOf(it) : null })).join('\n')}</ul>`;

// ---------- section pieces ----------
const kicker = (t) => `<p class="kicker">${t}</p>`;
function head({ k, title, id, line = '' }) {
  return `<header class="n-head" data-reveal>${k ? kicker(esc(k)) : ''}<h2 class="display n-head__title" id="${escA(id)}">${title}</h2>${line ? `<p class="n-head__line">${line}</p>` : ''}</header>`;
}
// the floating frame: one per hero, protruding over the hero's bottom edge into the reading band
const frame = (inner, mod = '') => `<figure class="frame frame--float n-frame${mod ? ' ' + mod : ''}" data-tilt="3"><span class="frame__img n-frame__img">${inner}</span><span class="n-frame__reg n-frame__reg--a" aria-hidden="true"></span><span class="n-frame__reg n-frame__reg--b" aria-hidden="true"></span></figure>`;
function hero({ crumbs, k = '', title, meta = '', lede = '', ctas = '', art = '', mod = '', label = '' }) {
  return `<section class="page-hero n-hero${mod ? ' ' + mod : ''}" aria-labelledby="n-title">
<div class="band__clip n-hero__clip" aria-hidden="true">${gimg('g-sky-field', { alt: '', cls: 'band__bg n-hero__bg', sizes: '100vw', eager: true })}<span class="n-hero__scrim"></span></div>
<div class="wrap page-hero__inner n-hero__inner${art ? '' : ' page-hero__inner--solo'}">
<div class="page-hero__text n-hero__text">
${crumbsHtml(crumbs)}
${k ? `<p class="kicker n-hero__kicker">${k}</p>` : ''}
<h1 class="display n-hero__title" id="n-title">${title}</h1>
${meta ? `<p class="page-hero__meta n-meta n-hero__meta">${meta}</p>` : ''}
${lede ? `<p class="lede n-hero__lede">${lede}</p>` : ''}
${ctas ? `<div class="btn-row n-hero__ctas">${ctas}</div>` : ''}
</div>
${art ? `<div class="page-hero__art n-hero__art">${label ? `<span class="n-hero__label" aria-hidden="true">${esc(label)}</span>` : ''}${art}</div>` : ''}
</div>
</section>`;
}

// the shop CTA band closing every post and guide: BUZZY's own service words, both buttons to the live menu
function shopBand(ctx) {
  const a = ctx.site.address || {};
  const d = ctx.site.delivery || {};
  const pk = ctx.site.pickup || {};
  return `<section class="band n-shop" aria-labelledby="n-shop-title">
<div class="band__clip" aria-hidden="true">${gimg('g-delivery-dream', { alt: '', cls: 'band__bg n-shop__bg', sizes: '100vw' })}<span class="n-shop__veil"></span></div>
<div class="wrap n-shop__wrap">
<div class="glass glass--strong n-shop__box" data-reveal data-spot>
${kicker('Delivery + Pickup')}
<h2 class="display n-shop__title" id="n-shop-title">${esc(d.promise || 'Shop the BUZZY menu')}</h2>
<p class="n-shop__line">${esc(pk.line || '')}</p>
<p class="n-shop__fact n-meta"><span class="n-meta__item">${esc(ctx.site.deliveryLine || '')}</span></p>
<div class="btn-row"><a class="btn btn--signal"${linkAttrs(menu(ctx))}>${icon('truck')}${esc(d.cta || 'Order for Delivery')}</a><a class="btn btn--ghost"${linkAttrs(menu(ctx))}>${icon('bag')}${esc(pk.cta || 'Shop Now')}</a></div>
<p class="n-shop__more"><a class="link-arrow"${linkAttrs('/cannabis-delivery-brooklyn/')}>Delivery details${icon('arrow')}</a><a class="link-arrow"${linkAttrs('/in-store-pickup/')}>Pickup at ${esc(a.streetShort || a.street || '')}${icon('arrow')}</a></p>
</div>
</div>
</section>`;
}

// ---------- captured blocks (pages/<slug>.json) ----------
const allLinks = (items) => items.length > 0 && items.every((x) => { const s = String(typeof x === 'string' ? x : x.html || '').trim(); return /^<a\b[^>]*>[^<]*<\/a>$/i.test(s); });
function capBlock(ctx, b, postsByPath) {
  switch (b.type) {
    case 'p': return `<p>${prose(b.html)}</p>`;
    case 'h1': case 'h2': return `<h2 class="n-cap__h">${esc(b.text)}</h2>`;
    case 'h3': case 'h4': return `<h3 class="n-cap__h3">${esc(b.text)}</h3>`;
    case 'ul': case 'ol': {
      const items = b.items || [];
      if (allLinks(items)) return `<ul class="n-chiplinks" role="list">${items.map((x) => `<li>${prose(typeof x === 'string' ? x : x.html).replace(/<a\b/i, '<a class="chip n-chiplink"')}</li>`).join('')}</ul>`;
      return `<${b.type} class="n-cap__list">${items.map((x) => `<li>${prose(typeof x === 'string' ? x : x.html || esc(x.text || ''))}</li>`).join('')}</${b.type}>`;
    }
    case 'img': { const ph = photoOf(b); if (!ph) return ''; const im = img({ src: ph.src, alt: b.alt || '', w: ph.w, h: ph.h }, { sizes: '(min-width: 1024px) 520px, 90vw', alt: b.alt || '' }); return `<figure class="n-cap__img">${b.href ? `<a${linkAttrs(liveHref(b.href))}>${im}</a>` : im}</figure>`; }
    case 'button': return `<p class="n-cap__btn"><a class="btn"${linkAttrs(liveHref(b.href || '#'))}>${esc(b.text)}${icon(/^https?:/i.test(liveHref(b.href || '')) ? 'ext' : 'arrow')}</a></p>`;
    case 'quote': return `<blockquote class="n-pull__q">${b.html ? prose(b.html) : `<p>${esc(b.text || '')}</p>`}${b.cite ? `<cite>${esc(b.cite)}</cite>` : ''}</blockquote>`;
    case 'faq': return `<div class="faq n-cap__faq">${(b.items || []).map((q) => `<details><summary>${esc(q.q)}</summary><div class="faq__a">${prose(q.a_html || '')}</div></details>`).join('')}</div>`;
    case 'cards': {
      const items = b.items || [];
      return `<ul class="n-latest" role="list">${items.map((x) => {
        const p = postsByPath.get(pathOf(x.href));
        const link = x.href ? liveHref(x.href) : p ? p.path : '';
        const inner = `${x.label ? `<span class="n-latest__label">${esc(stripTags(x.label))}</span>` : ''}<span class="n-latest__title">${esc(stripTags(x.title || ''))}</span>${x.html ? `<span class="n-latest__text">${esc(stripTags(x.html))}</span>` : ''}`;
        return `<li class="n-latest__item">${link ? `<a class="n-latest__link"${linkAttrs(link)}>${inner}${icon('arrow', 'n-latest__ico')}</a>` : `<span class="n-latest__link">${inner}</span>`}</li>`;
      }).join('')}</ul>`;
    }
    case 'table': return `<div class="n-table"><table>${(b.rows || []).map((r) => `<tr>${r.map((c) => `<td>${prose(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
    case 'icon-box': return `<div class="n-box">${b.title ? `<h3 class="n-cap__h3">${esc(b.title)}</h3>` : ''}${b.html ? `<div>${prose(b.html)}</div>` : ''}</div>`;
    case 'steps': return `<ol class="steps n-cap__steps">${(b.items || []).map((s) => `<li class="step"><span class="step__num">${esc(s.num || '')}</span><span class="step__title">${esc(s.title || '')}</span><span class="step__text">${prose(s.text || '')}</span></li>`).join('')}</ol>`;
    case 'embed': return b.note ? `<p class="n-cap__note">${esc(b.note)}</p>` : '';
    case 'video': return '';
    case 'form': return '';
    default: return b.html ? `<p>${prose(b.html)}</p>` : b.text ? `<p>${esc(b.text)}</p>` : '';
  }
}

// ---------- the post hub pieces shared by /learn/ and the category archives ----------
function chipsHtml(cats, label) {
  if (!cats.length) return '';
  return `<div class="n-chips" data-filter-group role="group" aria-label="${escA(label)}"><button class="chip n-chip" type="button" data-filter="all" aria-pressed="true">All</button>${cats.map((c) => `<button class="chip n-chip" type="button" data-filter="${escA(c.slug)}" aria-pressed="false">${esc(c.name)}</button>`).join('')}</div>`;
}
function catsOf(items) {
  const m = new Map();
  for (const it of items) for (const c of it.cats || []) if (!m.has(c.slug)) m.set(c.slug, { slug: c.slug, name: c.name, n: 0 });
  for (const it of items) for (const c of it.cats || []) m.get(c.slug).n++;
  return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}
// captured sections of a hub page: the H1 section feeds the hero; "cards" blocks naming posts are folded into the post
// cards (BUZZY's own card words); every other block is printed in its section, in order
function capSections(ctx, rec, postsByPath) {
  const h1 = String(rec.h1 || '').trim();
  const out = [];
  for (const s of rec.sections || []) {
    const blocks = (s.blocks || []).filter((b) => !(b.type === 'h1' && String(b.text || '').trim() === h1));
    const head = String(s.heading || '').trim();
    const dupHead = head && (head === h1 || blocks.some((b) => [b.text, b.title].some((t) => typeof t === 'string' && t.trim() === head)));
    if (!blocks.length && (!head || dupHead)) continue;
    out.push({ heading: dupHead ? '' : head, blocks });
  }
  return out;
}
function capHtml(ctx, secs, postsByPath, idBase) {
  return secs.map((s, i) => `<div class="n-cap__sec" aria-labelledby="${idBase}-${i}">
${s.heading ? `<h2 class="n-cap__h" id="${idBase}-${i}">${esc(s.heading)}</h2>` : `<span class="n-sr" id="${idBase}-${i}">${esc(stripTags((s.blocks.find((b) => b.text) || {}).text || 'More'))}</span>`}
${s.blocks.map((b) => capBlock(ctx, b, postsByPath)).join('\n')}
</div>`).join('\n');
}

// ---------- /learn/ ----------
function learnHub(ctx, rec, items, postsByPath, archives) {
  const path = '/learn/';
  rec = rec || { sections: [] };
  const h1 = stripTags(rec.h1 || 'The Buzzy Guide');
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'The Buzzy Guide', href: path }];
  const feat = items[0];
  const secs = capSections(ctx, rec, postsByPath);
  const cats = catsOf(items);
  const art = frame(feat ? media(feat.ph, feat.gen, { sizes: '(min-width: 1024px) 420px, 60vw', eager: true, alt: '' }) : gimg('g-guide', { alt: '', sizes: '(min-width: 1024px) 420px, 60vw', eager: true }), 'n-frame--hub');
  const ctas = `${feat ? `<a class="btn btn--signal" href="#n-latest">Read the latest${icon('arrow')}</a>` : ''}<a class="btn btn--ghost"${linkAttrs('/education/')}>Cannabis Education${icon('arrow')}</a>`;
  const archNav = archives.length ? `<nav class="n-archnav" aria-label="Categories"><span class="n-archnav__label">Categories</span>${archives.map((a) => `<a class="chip n-chiplink"${linkAttrs(a.path)}>${esc(a.name)}</a>`).join('')}</nav>` : '';
  const featHtml = feat ? `<section class="band band--paper n-feat-band" id="n-latest" aria-labelledby="n-feat-title">
<div class="wrap">
<article class="n-feat" data-reveal>
<a class="n-feat__media"${linkAttrs(feat.path)} tabindex="-1" aria-hidden="true"><span class="n-feat__img">${media(feat.ph, feat.gen, { sizes: '(min-width: 1024px) 720px, 92vw', alt: '' })}</span><span class="n-feat__stamp" aria-hidden="true">N° 01</span></a>
<div class="n-feat__body">
${kicker('Latest from The Buzzy Guide')}
<p class="n-meta n-feat__meta">${metaOf(feat)}</p>
<h2 class="display n-feat__title" id="n-feat-title"><a${linkAttrs(feat.path)}>${esc(feat.title)}</a></h2>
${feat.excerpt ? `<p class="n-feat__excerpt">${esc(feat.excerpt)}</p>` : ''}
${tagsOf(feat) ? `<p class="n-card__tags">${tagsOf(feat)}</p>` : ''}
<a class="btn"${linkAttrs(feat.path)}>Read More${icon('arrow')}</a>
</div>
</article>
</div>
</section>` : '';
  const listHtml = items.length ? `<section class="band band--fog n-list-band" aria-labelledby="n-all" data-filter-scope>
<div class="wrap">
<div class="n-list__top">
${head({ k: 'Every post, newest first', title: 'All <em class="accent">posts</em>', id: 'n-all' })}
<p class="n-count n-meta" aria-live="polite"><span data-filter-count data-one="post" data-many="posts">${items.length} posts</span></p>
</div>
${chipsHtml(cats, 'Filter posts by category')}
${grid(items, { filter: true, cls: 'n-grid--3', overOf: (it) => listedOver(rec, it, postsByPath) })}
<p class="n-empty" data-filter-empty hidden>No posts in this category yet.</p>
</div>
</section>` : `<section class="band band--fog"><div class="wrap"><p class="n-empty">New posts are on the way.</p></div></section>`;
  const capPart = secs.length ? `<section class="band band--paper n-cap" aria-label="More from The Buzzy Guide">
<div class="wrap wrap--narrow n-cap__wrap">
${capHtml(ctx, secs, postsByPath, 'n-cap')}
</div>
</section>` : '';
  const main = `${hero({ crumbs, k: 'The Buzzy Guide', title: esc(h1), lede: 'Guides, education and Brooklyn community stories from BUZZY, newest first.', ctas: ctas + archNav, art, mod: 'n-hero--hub', label: 'ZONE 11201 / LEARN' })}
${featHtml}
${listHtml}
${capPart}`;
  const title = rec.title || pageTitle('The Buzzy Guide');
  const description = rec.description || 'The Buzzy Guide: cannabis news, education and Brooklyn community stories from BUZZY in Cobble Hill.';
  return {
    path,
    html: page({
      ctx, path, title, description, canonical: absUrl(ctx, path), heroCrumbs: true, crumbs,
      og: { title, description, type: 'website', url: absUrl(ctx, path) },
      bodyClass: 'n-page n-page--hub', main,
      jsonld: [{ '@context': 'https://schema.org', '@type': 'Blog', name: h1, url: absUrl(ctx, path), publisher: orgLd(ctx), blogPost: items.slice(0, 40).map((it) => ({ '@type': 'BlogPosting', headline: it.title, datePublished: it.date, url: absUrl(ctx, it.path) })) }, crumbLd(ctx, crumbs)],
    }),
  };
}
// BUZZY's own card words for a post, when the captured hub lists it (title/label/excerpt as printed on the live hub)
function listedOver(rec, it, postsByPath) { return null; }
const crumbLd = (ctx, crumbs) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: absUrl(ctx, c.href) })) });

// ---------- /category/.../ ----------
const ARCHIVES = [
  { path: '/category/community/', slug: 'community', name: 'Community' },
  { path: '/category/community/brooklyn-cannabis-brands/', slug: 'brooklyn-cannabis-brands', name: 'Brooklyn Cannabis Brands', parent: 'community' },
  { path: '/category/education/', slug: 'education', name: 'Education' },
  { path: '/category/guides/', slug: 'guides', name: 'Guides' },
  { path: '/category/reviews/', slug: 'reviews', name: 'Product Reviews' },
];
function archivePage(ctx, a, rec, items, postsByPath, archives) {
  const path = a.path;
  rec = rec || { sections: [] };
  const kids = archives.filter((x) => x.parent === a.slug).map((x) => x.slug);
  const want = new Set([a.slug, ...kids]);
  const mine = items.filter((it) => (it.cats || []).some((c) => want.has(c.slug)));
  const h1 = stripTags(rec.h1 || a.name);
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'The Buzzy Guide', href: '/learn/' }, ...(a.parent ? [{ label: (archives.find((x) => x.slug === a.parent) || {}).name || a.parent, href: (archives.find((x) => x.slug === a.parent) || {}).path || '/learn/' }] : []), { label: a.name, href: path }];
  const secs = capSections(ctx, rec, postsByPath);
  const lead = mine[0];
  const art = frame(lead ? media(lead.ph, lead.gen, { sizes: '(min-width: 1024px) 400px, 60vw', eager: true, alt: '' }) : gimg(GEN_BY_CAT[a.slug] || 'g-guide', { alt: '', sizes: '(min-width: 1024px) 400px, 60vw', eager: true }), 'n-frame--arch');
  const archNav = `<nav class="n-archnav" aria-label="Categories"><span class="n-archnav__label">Categories</span>${archives.map((x) => `<a class="chip n-chiplink"${x.path === path ? ' aria-current="page"' : ''}${linkAttrs(x.path)}>${esc(x.name)}</a>`).join('')}</nav>`;
  const listHtml = `<section class="band band--fog n-list-band" aria-labelledby="n-all">
<div class="wrap">
<div class="n-list__top">
${head({ k: `Category / ${a.name}`, title: `${esc(a.name)}`, id: 'n-all' })}
<p class="n-count n-meta"><span>${mine.length} ${mine.length === 1 ? 'post' : 'posts'}</span></p>
</div>
${mine.length ? grid(mine, { cls: 'n-grid--3' }) : `<p class="n-empty">No posts in this category yet. <a class="link-arrow"${linkAttrs('/learn/')}>Every post${icon('arrow')}</a></p>`}
</div>
</section>`;
  const capPart = secs.length ? `<section class="band band--paper n-cap" aria-label="More from The Buzzy Guide">
<div class="wrap wrap--narrow n-cap__wrap">
${capHtml(ctx, secs, postsByPath, 'n-cap')}
</div>
</section>` : '';
  const main = `${hero({ crumbs, k: `The Buzzy Guide / ${esc(a.name)}`, title: esc(h1), lede: `${mine.length} ${mine.length === 1 ? 'post' : 'posts'} from BUZZY in ${esc(a.name)}, newest first.`, ctas: `<a class="btn btn--ghost"${linkAttrs('/learn/')}>All posts${icon('arrow')}</a>${archNav}`, art, mod: 'n-hero--archive', label: `SKU / ${a.slug.toUpperCase()}` })}
${listHtml}
${capPart}`;
  const title = rec.title || pageTitle(`${a.name} Archives`);
  const description = rec.description || `${a.name} posts from The Buzzy Guide by BUZZY, Cobble Hill, Brooklyn.`;
  return {
    path,
    html: page({
      ctx, path, title, description, canonical: absUrl(ctx, path), heroCrumbs: true, crumbs,
      og: { title, description, type: 'website', url: absUrl(ctx, path) },
      bodyClass: 'n-page n-page--archive', main,
      jsonld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: h1, url: absUrl(ctx, path), isPartOf: { '@type': 'WebSite', name: 'BUZZY', url: ctx.site.origin + '/' }, hasPart: mine.slice(0, 40).map((it) => ({ '@type': 'BlogPosting', headline: it.title, url: absUrl(ctx, it.path) })) }, crumbLd(ctx, crumbs)],
    }),
  };
}

// ---------- every post ----------
function keepReading(it, items, n = 3) {
  const same = new Set((it.cats || []).map((c) => c.slug));
  const others = items.filter((x) => x.path !== it.path);
  const a = others.filter((x) => (x.cats || []).some((c) => same.has(c.slug)));
  const b = others.filter((x) => !a.includes(x));
  return [...a, ...b].slice(0, n);
}
function postPage(ctx, p, it, items, archives) {
  const path = it.path;
  const can = absUrl(ctx, path);
  const cat = (it.cats || [])[0];
  const arch = cat ? archives.find((x) => x.slug === cat.slug) : null;
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'The Buzzy Guide', href: '/learn/' }, ...(arch ? [{ label: arch.name, href: arch.path }] : []), { label: clip(it.title, 48), href: path }];
  const art = frame(media(it.ph, it.gen, { sizes: '(min-width: 1024px) 460px, 80vw', eager: true, alt: it.ph ? it.ph.alt || '' : '' }), 'n-frame--post');
  const tags = (it.cats || []).map((c) => { const x = archives.find((y) => y.slug === c.slug); return x ? `<a class="tag n-hero__tag"${linkAttrs(x.path)}>${esc(c.name)}</a>` : `<span class="tag n-hero__tag">${esc(c.name)}</span>`; }).join('');
  const meta = `${it.dateText ? `<time class="n-meta__item" datetime="${escA(ymd(p.date))}">${esc(it.dateText)}</time>` : ''}<span class="n-meta__item">${esc(it.read)}</span>`;
  const keep = keepReading(it, items);
  const main = `${hero({ crumbs, k: tags || 'The Buzzy Guide', title: esc(it.title), meta, art, mod: 'n-hero--article', label: `N° ${String(items.length - items.indexOf(it)).padStart(2, '0')} / THE BUZZY GUIDE` })}
<section class="band band--paper n-body" aria-label="Article">
<div class="wrap n-body__wrap">
<article class="prose n-prose">
${prose(p.html)}
</article>
<p class="n-back"><a class="link-arrow"${linkAttrs('/learn/')}>Back to The Buzzy Guide${icon('arrow')}</a></p>
</div>
</section>
${keep.length ? `<section class="band band--fog n-more-band" aria-labelledby="n-keep">
<div class="wrap">
${head({ k: 'From The Buzzy Guide', title: 'Keep <em class="accent">reading</em>', id: 'n-keep' })}
${grid(keep, { cls: 'n-grid--3 n-grid--swipe', excerpt: false })}
</div>
</section>` : ''}
${shopBand(ctx)}`;
  const image = it.ph ? ctx.site.origin + it.ph.src : hasGenerated(it.gen) ? ctx.site.origin + imgUrl(it.gen, 1440) : null;
  const title = p.title || pageTitle(it.title);
  const description = p.description || clip(p.excerpt || p.html, 158);
  return {
    path,
    html: page({
      ctx, path, title, description, canonical: can, heroCrumbs: true, crumbs,
      og: { title, description, type: 'article', url: can, ...(image ? { image } : {}) },
      bodyClass: 'n-page n-page--post', main,
      jsonld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: it.title, description, datePublished: p.date, dateModified: p.modified || p.date, ...(image ? { image } : {}), mainEntityOfPage: can, author: orgLd(ctx), publisher: orgLd(ctx), articleSection: (it.cats || []).map((c) => c.name) }, crumbLd(ctx, crumbs)],
    }),
  };
}

// ---------- education guides (WRITER: src/content/learn/<slug>.json) ----------
const GUIDE_ART = { 'cannabis-101': 'g-guide', 'recreational-cannabis': 'g-curation', 'medical-cannabis': 'g-vitrine' };
function guideItem(g) {
  const path = href(g.path || `/education/${g.slug}/`);
  const all = (g.sections || []).flatMap((s) => (s.blocks || []).map((b) => [b.html, b.text, ...(b.items || [])].filter(Boolean).join(' ')));
  const n = all.reduce((a, t) => a + words(t), 0);
  return { kind: 'guide', slug: g.slug, path, title: stripTags(g.h1 || String(g.title || '').replace(/\s*\|\s*BUZZY\s*$/i, '')), excerpt: clip(g.description || g.lede || g.intro || '', 170), ph: null, gen: g.image || g.gimg || GUIDE_ART[g.slug] || 'g-guide', read: `${Math.max(1, Math.round(n / 230))} min read`, cats: [], more: 'Read the guide' };
}
function eduHub(ctx, guideItems, eduPosts) {
  const path = '/education/';
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Education', href: path }];
  const first = guideItems[0];
  const ctas = `${first ? `<a class="btn btn--signal"${linkAttrs(first.path)}>Start with ${esc(first.title.split(':')[0])}${icon('arrow')}</a>` : ''}<a class="btn btn--ghost"${linkAttrs('/learn/')}>The Buzzy Guide${icon('arrow')}</a>`;
  const art = frame(gimg('g-guide', { alt: '', sizes: '(min-width: 1024px) 420px, 60vw', eager: true }), 'n-frame--edu');
  const guidesHtml = guideItems.length ? `<section class="band band--paper n-guides-band" id="n-guides" aria-labelledby="n-guides-h">
<div class="wrap">
${head({ k: 'Three guides', title: 'Start with the <em class="accent">basics</em>', id: 'n-guides-h', line: 'Each guide is assembled from BUZZY’s own posts and answers, with a link to every source.' })}
<ol class="n-guides" role="list">
${guideItems.map((it, i) => `<li class="n-guides__item" data-reveal style="--i:${i}"><a class="acard n-guide"${linkAttrs(it.path)}>
<span class="acard__media n-guide__media">${gimg(it.gen, { alt: '', sizes: '(min-width: 1024px) 400px, 82vw' })}</span>
<span class="n-guide__body">
<span class="n-guide__num numeral" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
<span class="acard__meta n-meta"><span class="n-meta__item">Guide</span><span class="n-meta__item">${esc(it.read)}</span><span class="n-meta__item">By BUZZY</span></span>
<h3 class="acard__title n-guide__title">${esc(it.title)}</h3>
${it.excerpt ? `<span class="n-card__excerpt">${esc(it.excerpt)}</span>` : ''}
<span class="acard__more link-arrow">Read the guide${icon('arrow')}</span>
</span>
</a></li>`).join('\n')}
</ol>
</div>
</section>` : `<section class="band band--paper"><div class="wrap"><p class="n-empty">The guides are on the way.</p></div></section>`;
  const postsHtml = eduPosts.length ? `<section class="band band--fog n-edu-posts" aria-labelledby="n-edu-posts-h">
<div class="wrap">
${head({ k: 'BUZZY’s own posts', title: 'From The Buzzy <em class="accent">guide</em>', id: 'n-edu-posts-h' })}
${grid(eduPosts.slice(0, 6), { cls: 'n-grid--3 n-grid--swipe', excerpt: false })}
<p class="n-all"><a class="btn btn--ghost"${linkAttrs('/category/education/')}>Every education post${icon('arrow')}</a></p>
</div>
</section>` : '';
  const main = `${hero({ crumbs, k: 'Education', title: 'Cannabis <em class="accent">education</em>', lede: 'Plain-language guides from BUZZY, built from its own posts and answers.', ctas, art, mod: 'n-hero--edu', label: 'N° 101 / EDUCATION' })}
${guidesHtml}
${postsHtml}
${shopBand(ctx)}`;
  const title = pageTitle('Cannabis Education');
  const description = 'Cannabis education from BUZZY in Cobble Hill, Brooklyn: Cannabis 101, recreational cannabis and medical cannabis guides, plus BUZZY’s educational posts.';
  return {
    path,
    html: page({
      ctx, path, title, description, canonical: absUrl(ctx, path), heroCrumbs: true, crumbs,
      og: { title, description, type: 'website', url: absUrl(ctx, path) },
      bodyClass: 'n-page n-page--edu', main,
      jsonld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Cannabis Education', url: absUrl(ctx, path), isPartOf: { '@type': 'WebSite', name: 'BUZZY', url: ctx.site.origin + '/' }, hasPart: guideItems.map((it) => ({ '@type': 'Article', headline: it.title, url: absUrl(ctx, it.path) })) }, crumbLd(ctx, crumbs)],
    }),
  };
}
function guidePage(ctx, g, it, guideItems) {
  const path = it.path;
  const can = absUrl(ctx, path);
  const crumbs = [{ label: 'Home', href: '/' }, { label: 'Education', href: '/education/' }, { label: it.title.split(':')[0], href: path }];
  const ids = new Set();
  const uid = (t) => { const base = String(t).toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'; let id = base; let n = 2; while (ids.has(id)) id = `${base}-${n++}`; ids.add(id); return id; };
  const block = (b) => {
    switch (b.type) {
      case 'p': return `<p>${prose(b.html || esc(b.text || ''))}</p>`;
      case 'ul': case 'ol': return `<${b.type}>${(b.items || []).map((x) => `<li>${prose(typeof x === 'string' ? x : x.html || esc(x.text || ''))}</li>`).join('')}</${b.type}>`;
      case 'quote': {
        const src = b.source || b.href || '';
        const st = b.sourceTitle || b.cite || '';
        return `<figure class="n-pull" data-reveal><span class="n-pull__mark" aria-hidden="true">${icon('quote')}</span><blockquote class="n-pull__q"${src ? ` cite="${escA(absUrl(ctx, liveHref(src)))}"` : ''}>${b.html ? prose(b.html) : `<p>${esc(b.text || '')}</p>`}</blockquote>${src || st ? `<figcaption class="n-pull__src"><span class="n-pull__by">BUZZY, in</span> ${src ? `<a${linkAttrs(liveHref(src))}>${esc(st || src)}</a>` : esc(st)}</figcaption>` : ''}</figure>`;
      }
      case 'h3': case 'h4': return `<h3>${esc(b.text)}</h3>`;
      default: return b.html ? `<p>${prose(b.html)}</p>` : b.text ? `<p>${esc(b.text)}</p>` : '';
    }
  };
  const secs = (g.sections || []).filter((s) => s && (s.heading || (s.blocks || []).length)).map((s) => ({ ...s, id: uid(s.heading || 'section') }));
  const body = secs.map((s) => `<section class="n-sec" aria-labelledby="${escA(s.id)}">
${s.heading ? `<h2 id="${escA(s.id)}">${esc(s.heading)}</h2>` : `<h2 class="n-sr" id="${escA(s.id)}">${esc(it.title)}</h2>`}
${(s.blocks || []).map(block).join('\n')}
</section>`).join('\n');
  const toc = secs.filter((s) => s.heading);
  const tocHtml = toc.length >= 3 ? `<nav class="n-toc" aria-labelledby="n-toc-title"><p class="n-toc__title" id="n-toc-title">In this guide</p><ol class="n-toc__list">${toc.map((t, i) => `<li><a href="#${escA(t.id)}"><span class="n-toc__n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span><span>${esc(t.heading)}</span></a></li>`).join('')}</ol></nav>` : '';
  const note = 'Educational content, not medical or legal advice.';
  const related = [...guideItems.filter((x) => x.path !== path)].slice(0, 2);
  const meta = `<span class="n-meta__item">By BUZZY</span><span class="n-meta__item">${esc(it.read)}</span>`;
  const art = frame(gimg(it.gen, { alt: '', sizes: '(min-width: 1024px) 440px, 80vw', eager: true }), 'n-frame--guide');
  const idx = guideItems.indexOf(it);
  const main = `${hero({ crumbs, k: esc(g.kicker || 'Education'), title: esc(it.title), meta, lede: g.lede ? esc(stripTags(g.lede)) : '', art, mod: 'n-hero--article n-hero--guide', label: `GUIDE ${String(idx + 1).padStart(2, '0')} / 03` })}
<section class="band band--paper n-body n-body--guide${tocHtml ? ' n-body--toc' : ''}" aria-label="Guide">
<div class="wrap n-body__wrap">
${tocHtml}
<article class="prose n-prose">
<p class="n-note" role="note">${icon('info', 'n-note__ico')}<span>${esc(note)}</span></p>
${body}
</article>
</div>
</section>
<section class="band band--fog n-more-band" aria-labelledby="n-rel">
<div class="wrap">
${head({ k: 'Keep learning', title: 'More <em class="accent">guides</em>', id: 'n-rel' })}
<ul class="n-grid n-grid--3 n-grid--swipe" role="list">
${related.map((x, i) => card(x, { i })).join('\n')}
<li class="n-grid__item" data-reveal style="--i:${related.length}"><a class="acard n-card n-card--hub"${linkAttrs('/learn/')}>
<span class="acard__media n-card__media">${gimg('g-sky-field', { alt: '', sizes: CARD_SIZES })}</span>
<span class="n-card__body"><span class="acard__meta n-meta"><span class="n-meta__item">BUZZY’s own posts</span></span><h3 class="acard__title n-card__title">The Buzzy Guide</h3><span class="n-card__excerpt">Every post from BUZZY, newest first.</span><span class="acard__more link-arrow n-card__more">Read the posts${icon('arrow')}</span></span>
</a></li>
</ul>
</div>
</section>
${shopBand(ctx)}`;
  const image = hasGenerated(it.gen) ? ctx.site.origin + imgUrl(it.gen, 1440) : null;
  const title = g.seoTitle || pageTitle(it.title);
  const description = g.description || clip(g.lede || note, 158);
  return {
    path,
    html: page({
      ctx, path, title, description, canonical: can, heroCrumbs: true, crumbs,
      og: { title, description, type: 'article', url: can, ...(image ? { image } : {}) },
      bodyClass: 'n-page n-page--guide', main,
      jsonld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: it.title, description, ...(g.date ? { datePublished: g.date } : {}), ...(image ? { image } : {}), mainEntityOfPage: can, author: orgLd(ctx), publisher: orgLd(ctx) }, crumbLd(ctx, crumbs)],
    }),
  };
}

export async function render(ctx) {
  const posts = (ctx.posts || []).filter((p) => p && (p.path || p.slug) && (p.h1 || p.title));
  const items = posts.map(postItem);
  const postsByPath = new Map(items.map((it) => [it.path, it]));
  const content = ctx.content || {};
  const recs = Object.values(content);
  const recAt = (p) => recs.find((r) => r && href(r.path || '') === p) || null;
  // category names: BUZZY's own (post categories), else the archive defaults
  const catName = new Map();
  for (const it of items) for (const c of it.cats) if (!catName.has(c.slug)) catName.set(c.slug, c.name);
  const archives = ARCHIVES.map((a) => ({ ...a, name: catName.get(a.slug) || a.name }));
  const out = [learnHub(ctx, content.learn || recAt('/learn/'), items, postsByPath, archives)];
  for (const a of archives) out.push(archivePage(ctx, a, recAt(a.path), items, postsByPath, archives));
  posts.forEach((p, i) => out.push(postPage(ctx, p, items[i], items, archives)));
  const guides = (ctx.learn || []).filter((g) => g && g.slug && g.title && Array.isArray(g.sections));
  const guideItems = guides.map(guideItem);
  const eduPosts = items.filter((it) => it.cats.some((c) => c.slug === 'education'));
  out.push(eduHub(ctx, guideItems, eduPosts));
  guides.forEach((g, i) => out.push(guidePage(ctx, g, guideItems[i], guideItems)));
  return out;
}
