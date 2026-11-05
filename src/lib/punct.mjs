// punct.mjs - punctuation-only normalisation of captured copy at load time (main session). The operator's standing rule
// for pitch sites: no em dashes and no spaced hyphens used as dashes anywhere, section titles above all. Captured
// copy keeps every WORD (tools/words-check.mjs still compares against the JSON on disk); only dash punctuation changes:
//   time ranges  "11AM – 9PM" -> "11AM to 9PM"      day ranges "MON - THURS" -> "MON to THURS"
//   number ranges "1–2 grams" / "1 - 2" -> "1 to 2"
//   spaced dash in a heading/title -> ": "          spaced dash in body text -> ", "
//   unspaced em dash between words "business—it's" -> "business, it's"
//   unspaced en dash between letters -> "-"          a dash opening or closing a string -> removed
// Hyphens inside words and URLs are untouched. Keys that hold URLs, ids or paths are never changed.
const DASHES = '\\u2012\\u2013\\u2014\\u2015';
const ANY_DASH = new RegExp('[' + DASHES + ']|&(?:mdash|ndash);|&#821[12];|&#x201[34];|\\s-\\s', 'i');
const DAY = '(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const TIME = '\\d{1,2}(?::\\d{2})?\\s*(?:[ap]\\.?m\\.?)?';
const RE_TIME = new RegExp('(' + TIME + ')\\s*[' + DASHES + '-]\\s*(' + TIME + ')', 'gi');
const RE_DAY = new RegExp('\\b(' + DAY + ')(\\.?)\\s*[' + DASHES + '-]\\s*(' + DAY + ')\\b', 'gi');
const RE_NUM = new RegExp('(\\d[\\d.,]*\\s*%?)\\s*[' + DASHES + ']\\s*(\\d)|(\\d[\\d.,]*\\s*%?)\\s+-\\s+(\\d)', 'g');
const SKIP = new Set(['src', 'href', 'path', 'canonical', 'url', 'liveUrl', 'image', 'icon', 'file', 'slug', 'id', 'date', 'modified', '@context', '@type', '@id', 'sameAs', 'logo', 'live', 'art', 'gen', 'mp4', 'poster']);
const HEADING_KEYS = new Set(['heading', 'h1', 'title', 'seoTitle', 'q', 'name']);

export const punctStats = { strings: 0 };

export function dePunct(s, heading = false) {
  if (typeof s !== 'string' || !ANY_DASH.test(s)) return s;
  let t = s.replace(/&mdash;|&#8212;|&#x2014;/gi, '—').replace(/&ndash;|&#8211;|&#x2013;/gi, '–');
  t = t.replace(RE_TIME, (m, a, b) => (/[ap]\.?m/i.test(m) ? a.trim() + ' to ' + b.trim() : m));
  t = t.replace(RE_DAY, (m, a, dot, b) => a + dot + ' to ' + b);
  t = t.replace(RE_NUM, (m, a, b, c, d) => (a !== undefined ? a.trim() + ' to ' + b : c.trim() + ' to ' + d));
  const sep = heading ? ': ' : ', ';
  t = t.replace(new RegExp('\\s+[' + DASHES + ']\\s+|\\s+-\\s+', 'g'), sep);
  t = t.replace(new RegExp('([\\w)\\]"”’.])[—―]([\\w(\\["“‘<])', 'g'), '$1, $2');
  t = t.replace(new RegExp('([A-Za-z])[‒–]([A-Za-z])', 'g'), '$1-$2');
  t = t.replace(new RegExp('(^|>)\\s*[' + DASHES + ']\\s*', 'g'), '$1').replace(new RegExp('\\s*[' + DASHES + ']\\s*($|<)', 'g'), '$1');
  t = t.replace(new RegExp('[' + DASHES + ']', 'g'), heading ? ': ' : ', ');
  t = t.replace(/([,:])\s*([,.;:!?])/g, '$2').replace(/:\s*:/g, ':').replace(/ {2,}/g, ' ');
  if (t !== s) punctStats.strings++;
  return t;
}

// deep walk: heading-style for heading keys and for the text of h1-h4 blocks, body-style elsewhere
export function normaliseDashes(v, key = '', parent = null) {
  if (typeof v === 'string') {
    if (SKIP.has(key)) return v;
    const heading = HEADING_KEYS.has(key) || (key === 'text' && parent && /^h[1-6]$/.test(parent.type || ''));
    return dePunct(v, heading);
  }
  if (Array.isArray(v)) return v.map((x) => normaliseDashes(x, key, parent));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = normaliseDashes(x, k, v);
    return out;
  }
  return v;
}
