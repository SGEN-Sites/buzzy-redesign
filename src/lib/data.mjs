// data.mjs - load every content file once.
//   ctx.site      src/content/site.json        BUZZY's facts (main session; every value traced to the live site)
//   ctx.ia        src/content/ia.json          the adopted architecture mapped onto BUZZY: top bar, nav, footer, page map
//   ctx.images    src/content/images.json      generated media registry (IMAGERY lane)
//   ctx.content   src/content/pages/<slug>.json     BUZZY's captured pages ({ path, title, description, h1, sections, ... })
//   ctx.posts     src/content/posts/<slug>.json     BUZZY's blog posts (/<slug>/ at the site root), newest first
//   ctx.events    src/content/events/<slug>.json    BUZZY's events (/event/<slug>/), newest first (by start date)
//   ctx.delivery  src/content/delivery/<slug>.json  BUZZY's neighborhood delivery pages (/cannabis-delivery-brooklyn/<slug>/)
//   ctx.learn     src/content/learn/<slug>.json     NEW education guides assembled from BUZZY's own words (WRITER lane)
//   ctx.glue      src/content/category-glue.json    NEW short neutral product-format intros for /products/<cat>/ (WRITER)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';
import { normaliseDashes } from './punct.mjs';

const readJson = (rel, fallback) => {
  const f = path.join(ROOT, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback;
};
const readDir = (rel) => {
  const dir = path.join(ROOT, rel);
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) out[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return out;
};
// newest first; events carry a display date plus startISO, posts an ISO date: compare as times
const when = (x) => { const t = Date.parse(x.startISO || x.date || x.start || ''); return Number.isNaN(t) ? 0 : t; };
const byDate = (a, b) => when(b) - when(a);
const byTitle = (a, b) => String(a.name || a.title || '').localeCompare(String(b.name || b.title || ''));

export function loadAll() {
  const site = normaliseDashes(readJson('src/content/site.json', {}));
  const ia = readJson('src/content/ia.json', {});
  const images = readJson('src/content/images.json', { photos: {}, media: {} });
  // punctuation-only dash normalisation of every copy source (src/lib/punct.mjs); words are unchanged.
  const content = normaliseDashes(readDir('src/content/pages'));
  const posts = normaliseDashes(Object.values(readDir('src/content/posts')).sort(byDate));
  const events = normaliseDashes(Object.values(readDir('src/content/events')).sort(byDate));
  // Four live event pages and two blog archives ship an empty or 13-character meta description ("Explore BUZZY").
  // Fill those from the record's own captured H1, date and venue only, describing BUZZY, never the venue's place.
  for (const e of events) {
    if (String(e.description || '').trim().length >= 20) continue;
    const name = String(e.h1 || e.title || '').replace(/\s*[-|:]\s*Buzzy\s*$/i, '').trim();
    e.description = `${name}${e.dateText ? ' on ' + e.dateText : ''}${e.venue ? ' at ' + e.venue : ''}. An event from BUZZY, the Cobble Hill, Brooklyn dispensary.`;
  }
  for (const c of Object.values(content)) {
    if (String(c.description || '').trim().length >= 20 || !/^\/category\//.test(c.path || '')) continue;
    c.description = `${String(c.h1 || '').trim()}. Articles from The Buzzy Guide by BUZZY, the Cobble Hill, Brooklyn dispensary.`;
  }
  const delivery = normaliseDashes(Object.values(readDir('src/content/delivery')).sort(byTitle));
  const learn = normaliseDashes(Object.values(readDir('src/content/learn')).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)));
  const glue = normaliseDashes(readJson('src/content/category-glue.json', {}));
  return { site, ia, images, content, posts, events, delivery, learn, glue, places: [], team: [] };
}
