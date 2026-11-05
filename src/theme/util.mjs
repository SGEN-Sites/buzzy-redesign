// util.mjs - shared helpers (main session owns this file; lanes import, never edit - ask through your report).
import { img, picture, imgUrl, hasGenerated } from '../lib/images.mjs';
export { img, picture, imgUrl, hasGenerated };

// Generated image by id (docs/BUILD-CONTRACT.md "Generated image ids"). While IMAGERY is still producing, a lane build
// with ALLOW_MISSING_GEN=1 gets a styled placeholder slot instead of a build failure; the final build (no env) fails on
// any missing id.
export function gimg(id, opts = {}) {
  if (hasGenerated(id) || process.env.ALLOW_MISSING_GEN !== '1') return img(id, opts);
  return `<span class="img-slot ${opts.cls || ''}" data-slot="${String(id).replace(/"/g, '')}" role="img" aria-label="${String(opts.alt || '').replace(/"/g, '&quot;')}"></span>`;
}

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escA = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const attrs = (o = {}) => Object.entries(o).filter(([, v]) => v !== false && v != null && v !== '').map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escA(v)}"`)).join('');
export const isExternal = (u) => /^(https?:)?\/\//i.test(String(u)) || /^(mailto|tel|sms):/i.test(String(u));

// Internal page paths are directories ("/shop" -> "/shop/"); "#frag" and "?q" survive; files ("/404.html",
// "/assets/...") are left alone. External URLs unchanged.
export function href(u) {
  const s = String(u ?? '');
  if (!s || isExternal(s) || s.startsWith('#')) return s;
  const m = s.match(/^([^?#]*)([?#].*)?$/);
  let p = m[1];
  const rest = m[2] || '';
  if (!p.startsWith('/')) return s;
  if (p.startsWith('/assets/') || /\.[a-z0-9]{2,5}$/i.test(p)) return s;
  if (!p.endsWith('/')) p += '/';
  return p + rest;
}

// <a> attributes for any URL: external links open in a new tab with rel noopener (mailto/tel stay in place).
export function linkAttrs(u, extra = {}) {
  const h = href(String(u ?? ''));
  const ext = /^(https?:)?\/\//i.test(h);
  return attrs({ href: h, ...(ext ? { target: '_blank', rel: 'noopener' } : {}), ...extra });
}

// Client photo by file name in assets/photos ("watermelon-sherbet.webp"): <img> with WebP variants + srcset.
// alt defaults to site.json productPhotos[file].alt when present.
export function photo(ctx, file, opts = {}) {
  const meta = ((ctx.site && ctx.site.productPhotos) || {})[file] || {};
  return img({ src: '/assets/photos/' + file, alt: opts.alt != null ? opts.alt : meta.alt || '' }, opts);
}

export const slugify = (s) => String(s).toLowerCase().replace(/&[a-z]+;/g, '').replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const stripTags = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Absolute URL for canonicals / og:url on the preview origin (site.json origin).
export const absUrl = (ctx, p) => ctx.site.origin + href(p);

// BUZZY's live upload URL (any size variant, e.g. "-300x200.webp") -> the local copy CAPTURE downloaded, from
// facts/asset-map.json: { src: '/assets/photos/bz/<file>', w, h } or null when the image was not captured.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/paths.mjs';
let PHOTO_INDEX = null;
const normUpload = (u) => String(u || '').replace(/^https?:\/\/(?:www\.)?getbuzzy\.com/i, '').replace(/[?#].*$/, '').replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, '').replace(/-scaled(?=\.[a-z0-9]+$)/i, '').toLowerCase();
export function localPhoto(u) {
  if (!PHOTO_INDEX) {
    PHOTO_INDEX = new Map();
    const f = path.join(ROOT, 'facts/asset-map.json');
    if (fs.existsSync(f)) for (const im of JSON.parse(fs.readFileSync(f, 'utf8')).images || []) {
      const rec = { src: '/' + String(im.file).replace(/^\/?/, ''), w: im.w, h: im.h };
      for (const s of im.sources || []) { PHOTO_INDEX.set(normUpload(s), rec); PHOTO_INDEX.set(String(s).toLowerCase(), rec); }
    }
  }
  if (!u) return null;
  if (/^\/assets\//.test(u)) return { src: u };
  return PHOTO_INDEX.get(String(u).toLowerCase()) || PHOTO_INDEX.get(normUpload(u)) || null;
}

// BUZZY's live online menu (https://getbuzzy.com/menu/, a Dutchie embed on its own domain, with ?dtche[category]=...
// filters): every "Shop / Order" CTA that leaves the site ends there. menu(ctx) = the menu home; menu(ctx, 'flower') =
// that category's live menu URL from site.json menu.categories (slug match), falling back to the menu home.
// In-site navigation goes to /products/ pages; only explicit order buttons leave for the live menu.
// Link rule D4 for captured hrefs: BUZZY's own absolute URLs become in-site directory paths; links into the live menu
// (/menu/?dtche...), uploads and the CDN stay absolute on getbuzzy.com (relative ones are made absolute); everything
// else (mailto, tel, other hosts, #frag) is unchanged. DEAD maps live paths the rebuild does not carry to their nearest
// kept page (main session fills it from the link check).
const LIVE = 'https://getbuzzy.com';
const LIVE_RE = /^https?:\/\/(?:www\.)?getbuzzy\.com/i;
export const DEAD = {
  '/visit/': '/visit-us/',
  '/brand/ayrloom/': '/brands/',
  '/categories/drinks/': '/products/edibles/',
  '/categories/gummies/': '/products/edibles/',
  '/categories/hardware/': '/products/accessories/',
  '/categories/flower/': '/products/flower/',
  '/categories/vapes/': '/products/vapes/',
  '/categories/edibles/': '/products/edibles/',
  '/categories/pre-rolls/': '/products/pre-rolls/',
  '/categories/concentrates/': '/products/concentrates/',
  '/categories/tinctures/': '/products/tinctures/',
  '/categories/topicals/': '/products/topicals/',
  '/categories/accessories/': '/products/accessories/',
  '/news-events/': '/learn/',
  '/faqs/': '/brooklyn-dispensary-faqs/',
  '/wp-admin/post.php': '/doobie-labs-built-on-patience-powered-by-quality/',
};
export function liveHref(u) {
  let s = String(u ?? '').trim();
  if (!s || s.startsWith('#') || /^(mailto|tel|sms):/i.test(s)) return s;
  if (LIVE_RE.test(s)) s = s.replace(LIVE_RE, '') || '/';
  if (/^\/(wp-content|cdn-cgi)\//i.test(s) || /^\/menu\/?\?/i.test(s)) return LIVE + s;
  if (/^\/tel:/i.test(s)) return s.slice(1);
  if (isExternal(s)) return s;
  const m = s.match(/^([^?#]*)([?#].*)?$/);
  let p = m[1] || '/';
  if (!p.startsWith('/')) return s;
  if (!p.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(p)) p += '/';
  if (DEAD[p]) return href(DEAD[p]);
  return href(p + (m[2] || ''));
}
// Rewrite every <a href> inside trusted captured HTML through liveHref (entities in the URL are decoded first).
export function rewriteLinks(html) {
  return String(html ?? '').replace(/(<a\b[^>]*?\shref=)(["'])(.*?)\2/gi, (all, pre, q, u) => {
    const raw = u.replace(/&amp;/g, '&').replace(/&#0?38;/g, '&');
    return pre + q + escA(liveHref(raw)) + q;
  });
}

export function menu(ctx, slug) {
  const c = (ctx.site && ctx.site.menu) || {};
  if (!slug) return c.base || '#';
  const hit = (c.categories || []).find((x) => x.slug === slug);
  return hit ? hit.url : c.base || '#';
}
export const cart = menu;
export const liveMenu = menu;

// Directions links are built from the store address, so no distance or travel time is ever stated.
export const serviceAreas = (ctx) => ctx.site.serviceAreas || [];
export function directionsFrom(ctx, origin) {
  const a = ctx.site.address || {};
  const dest = [a.street, a.city, a.state + ' ' + a.zip].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(origin) + '&destination=' + encodeURIComponent(dest);
}

// Preview forms are NOT wired to any service: every form renders with data-demo-form; site.js stops the submit and
// shows the inline note. Use demoForm() for every form so the wording stays one sentence site-wide.
export const DEMO_NOTE = 'This preview form is not connected yet, so nothing is sent.';
export function demoForm({ id = '', fields = [], button = 'Submit', cls = '' } = {}) {
  return `<form class="demo-form ${cls}" data-demo-form novalidate${id ? ` id="${escA(id)}"` : ''}>
${fields.map((f, i) => { const name = slugify(f); const type = /email/i.test(f) ? 'email' : /zip/i.test(f) ? 'text' : 'text'; return `<label class="demo-form__field"><span class="demo-form__label">${esc(f)}</span><input class="demo-form__input" type="${type}" name="${name}" autocomplete="${/email/i.test(f) ? 'email' : /zip/i.test(f) ? 'postal-code' : /name/i.test(f) ? 'name' : 'off'}"${/zip/i.test(f) ? ' inputmode="numeric"' : ''}></label>`; }).join('\n')}
<button class="btn btn--signal demo-form__btn" type="submit">${esc(button)}</button>
<p class="demo-form__note" data-demo-note hidden role="status">${esc(DEMO_NOTE)}</p>
</form>`;
}
