# capture-buzzy.py - turn BUZZY's untouched live pages (audit/raw/buzzy/*.html: WordPress + Elementor 4.3 + Elementor
# Pro, hello-biz child theme, The Events Calendar, Age Gate) into content JSON for the redesign. Every visible word of
# each page's CONTENT AREA (the page's Elementor document: wp-page / wp-post / single-post / archive /
# tec_event_single_dynamic) is carried; the global header (Elementor template 30) and footer (template 68), the age
# gate, GTM noscript iframes and screen-reader duplicates are not (FOUNDATION renders the chrome from site.json/ia.json).
# Head metadata (title, description, canonical, og:image) is carried verbatim.
#   python -I tools/capture-buzzy.py [<project-dir>] [--fetch-css] [--fetch]
#   --fetch-css  download the per-page Elementor CSS files (wp-content/uploads/elementor/css/post-<id>.css) that hold
#                the CSS background images, politely, into tmp/capture/css/
#   --fetch      download every content image (largest srcset candidate, wp-content/uploads only) politely into
#                tmp/capture/dl/ (1 connection, >= 0.4 s apart, stop the host on 401/403/429), then copy them to
#                assets/photos/bz/ (lowercase names, de-duplicated by sha1, magic-byte check) and rewrite img.src.
# Without the flags it reuses what earlier runs fetched (tmp/capture/css/_log.json, tmp/capture/dl/_log.json).
# Never edits audit/raw/. Writes src/content/{pages,posts,events,delivery}/*.json, facts/asset-map.json,
# assets/photos/bz/*, assets/brand/buzzy-* + favicon* + apple-touch-icon.png, tmp/capture/stats.json.
import sys, os, re, json, html, hashlib, time, shutil, urllib.request, urllib.parse, urllib.error
from html.parser import HTMLParser
sys.stdout.reconfigure(encoding='utf-8')

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
ROOT = os.path.abspath(ARGS[0]) if ARGS else os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FETCH = '--fetch' in sys.argv
FETCH_CSS = '--fetch-css' in sys.argv
RAW = os.path.join(ROOT, 'audit', 'raw', 'buzzy')
CONTENT = os.path.join(ROOT, 'src', 'content')
PHOTOS = os.path.join(ROOT, 'assets', 'photos', 'bz')
BRAND = os.path.join(ROOT, 'assets', 'brand')
SCRATCH = os.path.join(ROOT, 'tmp', 'capture')
DL = os.path.join(SCRATCH, 'dl')
CSSDIR = os.path.join(SCRATCH, 'css')
ORIGIN = 'https://getbuzzy.com'
HOST = 'getbuzzy.com'
UA = 'site-reforge/1.0 (redesign pitch research)'
CONTENT_DOCS = {'wp-page', 'wp-post', 'single-post', 'single-page', 'single', 'archive', 'tec_event_single_dynamic', 'error-404', 'search-results'}
CHROME_DOCS = {'header', 'footer', 'popup'}

VOID = {'img', 'br', 'hr', 'source', 'input', 'meta', 'link', 'wbr', 'area', 'col', 'embed', 'track', 'param'}
SKIP_TAGS = {'script', 'style', 'noscript', 'svg', 'template', 'link', 'meta', 'input', 'select', 'textarea', 'option', 'source'}
INLINE_TAGS = {'a', 'strong', 'em', 'b', 'i', 'br', 'span', 'small', 'sup', 'sub', 'u', 's', 'mark', 'code', 'abbr', 'time', 'cite', 'q', 'kbd', 'label', 'font', 'del', 'ins'}
BLOCK_TAGS = {'p', 'div', 'section', 'article', 'ul', 'ol', 'dl', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'figure', 'blockquote',
              'details', 'table', 'iframe', 'video', 'picture', 'header', 'footer', 'nav', 'aside', 'form', 'pre', 'fieldset', 'button', 'hr', 'li'}


class Node:
    __slots__ = ('tag', 'attrs', 'children', 'parent')

    def __init__(self, tag, attrs, parent=None):
        self.tag, self.attrs, self.children, self.parent = tag, dict(attrs), [], parent

    def cls(self):
        return (self.attrs.get('class') or '').split()


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('root', [])
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(n)
        if tag not in VOID:
            self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(Node(tag, attrs, self.stack[-1]))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def parse(h):
    p = P()
    p.feed(h)
    return p.root


def clean(s):
    return re.sub(r'\s+', ' ', (s or '').replace('​', '').replace('﻿', '')).strip()


def esc(s):
    return html.escape((s or '').replace('​', ''), quote=False)


TEC_MACHINERY = {'tribe-events-header__events-bar', 'tribe-events-c-top-bar', 'tribe-events-c-subscribe-dropdown__container',
                 'tribe-events-c-nav', 'tribe-events-c-ical', 'tribe-events-header__top-bar', 'tribe-events-c-events-bar',
                 'tribe-events-c-view-selector', 'tribe-events-c-search', 'tribe-events-after-html', 'tribe-events-before-html'}


def is_sr(n):
    c = n.cls()
    if any(k in TEC_MACHINERY for k in c):
        return True
    # hidden SEO-injection blocks (data-otto-pixel="dynamic-seo", style display:none) are not visible content
    if n.attrs.get('data-otto-pixel') or re.search(r'display\s*:\s*none', n.attrs.get('style') or ''):
        return True
    return 'screen-reader-text' in c or 'elementor-screen-only' in c or 'sr-only' in c or 'visually-hidden' in c or 'tribe-common-a11y-visual-hide' in c or 'tribe-common-a11y-hidden' in c


def text_of(n):
    if isinstance(n, str):
        return n
    if n.tag in SKIP_TAGS or is_sr(n):
        return ''
    if n.tag == 'br':
        return ' '
    if '__cf_email__' in n.cls():
        return cf_decode(n.attrs.get('data-cfemail', ''))
    return ''.join(text_of(c) for c in n.children)


def find_all(n, pred, acc=None, stop=None):
    acc = [] if acc is None else acc
    if isinstance(n, str):
        return acc
    if pred(n):
        acc.append(n)
        if stop:
            return acc
    for c in n.children:
        find_all(c, pred, acc, stop)
    return acc


def find1(n, pred):
    if isinstance(n, str) or n is None:
        return None
    if pred(n):
        return n
    for c in n.children:
        r = find1(c, pred)
        if r is not None:
            return r
    return None


def has_cls(c):
    return lambda n: c in n.cls()


def cf_decode(hexs):
    try:
        b = bytes.fromhex(hexs)
        k = b[0]
        return ''.join(chr(x ^ k) for x in b[1:])
    except Exception:
        return ''


def fix_href(h):
    h = html.unescape((h or '').strip())
    m = re.match(r'^(?:https?://(?:www\.)?getbuzzy\.com)?/cdn-cgi/l/email-protection#([0-9a-fA-F]+)$', h)
    if m:
        return 'mailto:' + cf_decode(m.group(1))
    if h.startswith('/') and not h.startswith('//'):
        return ORIGIN + h
    return h


def eid(n):
    for c in n.cls():
        m = re.match(r'^elementor-element-([0-9a-f]{6,8})$', c)
        if m:
            return m.group(1)
    return n.attrs.get('data-id', '')


def hidden_of(n):
    out = []
    for c in n.cls():
        m = re.match(r'^elementor-hidden-(desktop|tablet|mobile|widescreen|laptop|tablet_extra|mobile_extra)$', c)
        if m:
            out.append(m.group(1))
    return out


def wtype(n):
    if n.attrs.get('data-element_type') == 'widget':
        return (n.attrs.get('data-widget_type') or '').split('.')[0]
    return ''


# ---------------------------------------------------------------- inline HTML
def inline_html(n, spaced_spans=False):
    out = []
    for c in n.children:
        if isinstance(c, str):
            out.append(esc(c))
            continue
        if c.tag in SKIP_TAGS or is_sr(c):
            continue
        if c.attrs.get('aria-hidden') == 'true' and c.tag != 'a':
            continue
        if c.tag == 'br':
            out.append('<br>')
            continue
        if '__cf_email__' in c.cls() and c.tag != 'a':
            out.append(esc(cf_decode(c.attrs.get('data-cfemail', ''))))
            continue
        if c.tag == 'img':
            if is_emoji(c):
                out.append(esc(c.attrs.get('alt', '')))
            continue
        inner = inline_html(c, spaced_spans)
        if c.tag == 'a':
            href = fix_href(c.attrs.get('href'))
            attrs = ' href="%s"' % html.escape(href) if href else ''
            if c.attrs.get('target') == '_blank':
                attrs += ' target="_blank"'
            out.append('<a%s>%s</a>' % (attrs, inner))
        elif c.tag in ('strong', 'b'):
            out.append('<strong>%s</strong>' % inner if inner.strip() else inner)
        elif c.tag in ('em', 'i'):
            out.append('<em>%s</em>' % inner if inner.strip() else inner)
        elif c.tag in ('sup', 'sub'):
            out.append('<%s>%s</%s>' % (c.tag, inner, c.tag) if inner.strip() else inner)
        elif spaced_spans and c.tag == 'span':
            out.append(' ' + inner + ' ')
        elif c.tag in BLOCK_TAGS:
            out.append(' ' + inner + ' ')
        else:
            out.append(inner)
    return ''.join(out)


def tidy_inline(h):
    h = re.sub(r'\s+', ' ', h).strip()
    h = re.sub(r'\s*<br>\s*', '<br>', h)
    h = re.sub(r'^(<br>)+|(<br>)+$', '', h)
    h = re.sub(r'<(strong|em|sup|sub)>\s*</\1>', ' ', h)
    h = re.sub(r'<a( [^>]*)?>\s*</a>', ' ', h)
    return re.sub(r'\s+', ' ', h).strip()


def plain(h):
    return clean(html.unescape(re.sub(r'<br>', ' ', re.sub(r'<(?!br)[^>]+>', '', h or ''))))


# ---------------------------------------------------------------- block HTML (FAQ answers, post bodies)
BODY_TAGS = {'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'blockquote', 'img', 'figure', 'figcaption',
             'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'sup', 'sub'}
RENAME = {'b': 'strong', 'i': 'em', 'h1': 'h2', 'h5': 'h4', 'h6': 'h4'}


def body_html(n, ctx, depth=0):
    out = []
    for c in n.children:
        if isinstance(c, str):
            out.append(esc(c))
            continue
        if c.tag in SKIP_TAGS or is_sr(c):
            continue
        if c.attrs.get('aria-hidden') == 'true':
            continue
        if '__cf_email__' in c.cls() and c.tag != 'a':
            out.append(esc(cf_decode(c.attrs.get('data-cfemail', ''))))
            continue
        w = wtype(c)
        if w in ('share-buttons', 'post-navigation', 'table-of-contents', 'spacer', 'divider', 'icon'):
            ctx['dropped'].append('%s widget inside a body (machinery)' % w)
            continue
        if w == 'loop-grid':
            ctx['dropped'].append('loop-grid inside a body (related-posts list): dropped')
            continue
        t = RENAME.get(c.tag, c.tag)
        if t == 'img' and is_emoji(c):
            out.append(esc(c.attrs.get('alt', '')))
            continue
        if t == 'img':
            ib = img_block(c, ctx)
            if ib:
                out.append('<img src="%s" alt="%s"%s>' % (html.escape(ib['src']), html.escape(ib.get('alt', '')),
                           ''.join(' %s="%s"' % (k2, ib[k]) for k, k2 in (('w', 'width'), ('h', 'height')) if ib.get(k))))
            continue
        if t == 'iframe':
            src = c.attrs.get('src') or c.attrs.get('data-src') or ''
            if src and 'googletagmanager' not in src:
                out.append('<p><a href="%s">%s</a></p>' % (html.escape(src), esc(c.attrs.get('title') or src)))
                ctx['embeds'].append(src)
            continue
        inner = body_html(c, ctx, depth + 1)
        if t not in BODY_TAGS:
            if t in ('div', 'section', 'article', 'header', 'footer', 'aside', 'nav', 'pre', 'dl', 'dt', 'dd', 'details', 'summary', 'main'):
                out.append('\n' + inner + '\n')
            else:
                out.append(inner)
            continue
        if t == 'br':
            out.append('<br>')
            continue
        attrs = ''
        if t == 'a':
            href = fix_href(c.attrs.get('href'))
            attrs = ' href="%s"' % html.escape(href) if href else ''
            if c.attrs.get('target') == '_blank':
                attrs += ' target="_blank"'
        if t in ('th', 'td'):
            for k in ('colspan', 'rowspan'):
                if c.attrs.get(k):
                    attrs += ' %s="%s"' % (k, html.escape(c.attrs[k]))
        if t in ('p', 'li', 'strong', 'em', 'a', 'h2', 'h3', 'h4', 'th', 'td', 'figcaption', 'blockquote', 'sup', 'sub') and not clean(re.sub(r'<[^>]+>', '', inner)) and '<img' not in inner:
            if t in ('td', 'th'):
                out.append('<%s%s></%s>' % (t, attrs, t))
            continue
        out.append('<%s%s>%s</%s>' % (t, attrs, inner, t))
    return ''.join(out)


def tidy_body(h):
    h = h.replace('​', '')
    h = re.sub(r'[ \t\r\f\v]+', ' ', h)
    h = re.sub(r'\s*\n\s*', '\n', h)
    h = re.sub(r'\s*(</?(?:p|ul|ol|li|h2|h3|h4|blockquote|figure|figcaption|table|thead|tbody|tr|th|td)\b[^>]*>)\s*', r'\1', h)
    h = re.sub(r'(</(?:p|ul|ol|h2|h3|h4|blockquote|figure|table)>)', r'\1\n', h)
    h = re.sub(r'\n+', '\n', h)
    # loose text between blocks becomes a paragraph
    parts = []
    for line in h.split('\n'):
        s = line.strip()
        if not s:
            continue
        if not re.match(r'^<(p|ul|ol|li|h2|h3|h4|blockquote|figure|table|img|thead|tbody|tr)\b', s):
            s = '<p>%s</p>' % s
        parts.append(s)
    return '\n'.join(parts).strip()


# ---------------------------------------------------------------- images
IMG_REFS = {}   # orig url -> {'pages': set(), 'alts': set()}


def largest_src(n):
    src = n.attrs.get('src') or ''
    if not src or src.startswith('data:'):
        src = n.attrs.get('data-src') or n.attrs.get('data-lazy-src') or src
    best, bw = src, -1
    for part in (n.attrs.get('srcset') or n.attrs.get('data-srcset') or n.attrs.get('data-lazy-srcset') or '').split(','):
        bits = part.strip().split()
        if len(bits) >= 2 and bits[1].endswith('w'):
            try:
                w = int(bits[1][:-1])
            except ValueError:
                continue
            if w > bw:
                best, bw = bits[0], w
    if bw < 0:
        best = src
    return fix_href(best), fix_href(src)


def is_emoji(n):
    s = n.attrs.get('src') or ''
    return 'fonts.gstatic.com/s/e/notoemoji' in s or 's.w.org/images/core/emoji' in s or 'emoji' in n.cls()


def add_ref(u, ctx, alt=''):
    if '/wp-content/uploads/' in u and urllib.parse.urlsplit(u).netloc.endswith(HOST):
        IMG_REFS.setdefault(u, {'pages': set(), 'alts': set()})
        IMG_REFS[u]['pages'].add(ctx['path'])
        if alt:
            IMG_REFS[u]['alts'].add(alt)
        return True
    ctx['remote_imgs'].append(u)
    return False


def img_block(n, ctx):
    big, src = largest_src(n)
    if not big or big.startswith('data:') or is_emoji(n):
        return None
    b = {'type': 'img', 'src': big, 'alt': clean(n.attrs.get('alt', ''))}
    if (n.attrs.get('width') or '').isdigit():
        b['w'] = int(n.attrs['width'])
    if (n.attrs.get('height') or '').isdigit():
        b['h'] = int(n.attrs['height'])
    add_ref(big, ctx, b['alt'])
    return b


def bg_blocks(n, ctx, repeater=None):
    """CSS background images of an Elementor element (per-page CSS files + inline style)."""
    out = []
    key = (eid(n), repeater)
    seen = set()
    for url, media in BG.get(key, []):
        if (url, media) in seen:
            continue
        seen.add((url, media))
        u = fix_href(url)
        b = {'type': 'img', 'role': 'background', 'src': u, 'alt': ''}
        if media:
            b['media'] = media
        add_ref(u, ctx)
        out.append(b)
    st = n.attrs.get('style') or ''
    for m in re.finditer(r'background-image:\s*url\((["\']?)([^)"\']+)\1\)', st):
        u = fix_href(m.group(2))
        b = {'type': 'img', 'role': 'background', 'src': u, 'alt': ''}
        add_ref(u, ctx)
        out.append(b)
    return out


# ---------------------------------------------------------------- Elementor CSS backgrounds
BG = {}   # (element id, repeater id|None) -> [(url, media)]


def css_rules(css):
    """Yield (selector, declarations, media) for a flat-or-@media-nested stylesheet."""
    i, n, media = 0, len(css), []
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    n = len(css)
    stack = []
    buf_start = 0
    while i < n:
        ch = css[i]
        if ch == '{':
            head = css[buf_start:i].strip()
            if head.startswith('@'):
                stack.append(head)
                i += 1
                buf_start = i
                continue
            j = css.find('}', i)
            if j < 0:
                break
            yield head, css[i + 1:j], ' '.join(s for s in stack if s.startswith('@media'))
            i = j + 1
            buf_start = i
            continue
        if ch == '}':
            if stack:
                stack.pop()
            i += 1
            buf_start = i
            continue
        i += 1


def media_label(m):
    if not m:
        return ''
    mx = re.search(r'max-width:\s*(\d+)px', m)
    mn = re.search(r'min-width:\s*(\d+)px', m)
    if mx and int(mx.group(1)) <= 767:
        return 'mobile'
    if mx and int(mx.group(1)) <= 1024:
        return 'tablet'
    if mn:
        return 'min-%s' % mn.group(1)
    return m


def load_css():
    log = {}
    p = os.path.join(CSSDIR, '_log.json')
    if os.path.exists(p):
        log = json.load(open(p, encoding='utf-8'))
    for u, v in log.items():
        if not v.get('ok'):
            continue
        css = open(v['file'], encoding='utf-8', errors='replace').read()
        for sel, decl, media in css_rules(css):
            m = re.search(r'background-image:\s*url\((["\']?)([^)"\']+)\1\)', decl)
            if not m:
                continue
            url = m.group(2)
            for part in sel.split(','):
                ids = re.findall(r'\.elementor-element-([0-9a-f]{6,8})', part)
                if not ids:
                    continue
                rep = re.findall(r'\.elementor-repeater-item-([0-9a-f]{6,8})', part)
                key = (ids[-1], rep[-1] if rep else None)
                lst = BG.setdefault(key, [])
                ent = (url, media_label(media))
                if ent not in lst:
                    lst.append(ent)
    return log


def fetch_css(urls):
    os.makedirs(CSSDIR, exist_ok=True)
    p = os.path.join(CSSDIR, '_log.json')
    log = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
    stop = False
    for u in sorted(set(urls)):
        if stop:
            break
        if u in log and log[u].get('ok'):
            continue
        time.sleep(0.45)
        fp = os.path.join(CSSDIR, re.sub(r'[^a-z0-9.-]+', '_', u.split('/')[-1].split('?')[0].lower()))
        try:
            req = urllib.request.Request(u, headers={'User-Agent': UA, 'Accept': 'text/css,*/*;q=0.1'})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
                status = r.status
        except urllib.error.HTTPError as e:
            log[u] = {'ok': False, 'status': e.code}
            print('css HTTP', e.code, u)
            if e.code in (401, 403, 429):
                print('STOP: HTTP', e.code, u)
                stop = True
            continue
        except Exception as e:
            log[u] = {'ok': False, 'status': None, 'note': str(e)}
            continue
        if data[:200].lstrip().lower().startswith(b'<!doctype') or b'<html' in data[:500].lower():
            log[u] = {'ok': False, 'status': status, 'note': 'HTML, not CSS'}
            continue
        open(fp, 'wb').write(data)
        log[u] = {'ok': True, 'status': status, 'file': fp, 'bytes': len(data)}
        print('css ok', status, len(data), u.split('/')[-1])
    with open(p, 'w', encoding='utf-8') as o:
        json.dump(log, o, ensure_ascii=False, indent=1)
    return log


# ---------------------------------------------------------------- Elementor-aware walker
def walk(n, ctx):
    out = []
    for c in n.children:
        if isinstance(c, str):
            t = clean(c)
            if t:
                out.append({'type': 'p', 'html': esc(t)})
            continue
        out.extend(node_blocks(c, ctx))
    return out


def heading_block(c, ctx, tag=None):
    tag = tag or c.tag
    lvl = int(tag[1]) if re.fullmatch(r'h[1-6]', tag) else 0
    txt = clean(html.unescape(re.sub(r'<br>', ' ', re.sub(r'<(?!br)[^>]+>', ' ', inline_html(c, spaced_spans=True)))))
    txt = clean(re.sub(r'\s+([,.!?;:])', r'\1', txt)) if txt else txt
    if not txt:
        return []
    if not lvl:
        b = {'type': 'p', 'html': tidy_inline(inline_html(c)), 'role': 'label'}
    else:
        b = {'type': 'h%d' % min(lvl, 4), 'text': txt}
        if lvl > 4:
            b['level'] = lvl
    a = c if c.tag == 'a' else find1(c, lambda x: x.tag == 'a')
    if a is not None and a.attrs.get('href') and b['type'] != 'p':
        b['href'] = fix_href(a.attrs['href'])
    return [b]


def p_block(c, ctx, spaced=False, role=None):
    h = tidy_inline(inline_html(c, spaced_spans=spaced))
    if not plain(h):
        return []
    b = {'type': 'p', 'html': h}
    if role:
        b['role'] = role
    return [b]


def list_block(c, ctx):
    items = []
    for li in c.children:
        if isinstance(li, Node) and li.tag == 'li':
            h = tidy_inline(inline_html(li))
            if plain(h):
                items.append(h)
    return [{'type': 'ol' if c.tag == 'ol' else 'ul', 'items': items}] if items else []


def table_block(c, ctx):
    rows, head = [], False
    for tr in find_all(c, lambda x: x.tag == 'tr'):
        cells = [x for x in tr.children if isinstance(x, Node) and x.tag in ('td', 'th')]
        if not rows and cells and all(x.tag == 'th' for x in cells):
            head = True
        rows.append([plain(tidy_inline(inline_html(x))) for x in cells])
    b = {'type': 'table', 'rows': rows}
    if head:
        b['head'] = True
    return [b] if rows else []


def embed_kind(src):
    s = src.lower()
    if 'google.com/maps/d/' in s:
        return 'mymaps'
    if 'maps.google' in s or 'google.com/maps' in s:
        return 'map'
    if 'alpineiq' in s:
        return 'alpineiq'
    if 'stickycards' in s or 'sticky' in s:
        return 'stickycards'
    if 'dutchie' in s:
        return 'dutchie'
    if 'youtu' in s:
        return 'youtube'
    if 'vimeo' in s:
        return 'vimeo'
    return 'iframe'


def iframe_block(c, ctx):
    src = c.attrs.get('src') or c.attrs.get('data-src') or ''
    if not src or 'googletagmanager' in src:
        return []
    b = {'type': 'embed', 'kind': embed_kind(src), 'src': html.unescape(src), 'note': clean(c.attrs.get('title', '') or c.attrs.get('aria-label', ''))}
    for k in ('width', 'height'):
        if (c.attrs.get(k) or '').isdigit():
            b[k[0]] = int(c.attrs[k])
    ctx['embeds'].append(src)
    return [b]


def scripts_embeds(c, ctx):
    out = []
    for s in find_all(c, lambda x: x.tag == 'script'):
        src = s.attrs.get('src') or ''
        body = ''.join(x for x in s.children if isinstance(x, str))
        m = re.search(r'https?://[^\s"\']*dutchie\.com/[^\s"\']+', src + ' ' + body)
        if m:
            out.append({'type': 'embed', 'kind': 'dutchie', 'src': m.group(0), 'note': 'Dutchie embedded menu script' + (' (id %s)' % s.attrs['id'] if s.attrs.get('id') else '')})
            ctx['embeds'].append(m.group(0))
    return out


def faq_nested(c, ctx):
    items = []
    for d in find_all(c, lambda x: x.tag == 'details' and 'e-n-accordion-item' in x.cls()):
        s = find1(d, lambda x: x.tag == 'summary')
        qn = find1(s, has_cls('e-n-accordion-item-title-text')) if s is not None else None
        qt = clean(text_of(qn if qn is not None else s)) if s is not None else ''
        body = Node('div', [])
        body.children = [x for x in d.children if x is not s]
        ah = tidy_body(body_html(body, ctx))
        items.append({'q': qt, 'a_html': ah})
    return [{'type': 'faq', 'items': items}] if items else []


def details_block(c, ctx):
    s = find1(c, lambda x: x.tag == 'summary')
    body = Node('div', [])
    body.children = [x for x in c.children if x is not s]
    return [{'type': 'faq', 'items': [{'q': clean(text_of(s)) if s is not None else '', 'a_html': tidy_body(body_html(body, ctx))}]}]


def form_block(c, ctx):
    fields, types, consent = [], [], ''
    seen_inputs = set()
    for lab in find_all(c, lambda x: x.tag == 'label'):
        t = clean(text_of(lab))
        inp = find1(lab, lambda x: x.tag == 'input')
        fid = lab.attrs.get('for', '')
        tgt = None
        if fid:
            tgt = find1(c, lambda x, fid=fid: x.tag in ('input', 'textarea', 'select') and x.attrs.get('id') == fid)
        if inp is None:
            inp = tgt
        typ = (inp.attrs.get('type') if inp is not None else '') or ('textarea' if tgt is not None and tgt.tag == 'textarea' else 'text')
        if typ == 'checkbox':
            consent = tidy_inline(inline_html(lab))
            continue
        if t:
            fields.append(t)
            types.append({'input': typ})
            if inp is not None:
                seen_inputs.add(id(inp))
    for inp in find_all(c, lambda x: x.tag in ('input', 'textarea')):
        if id(inp) in seen_inputs:
            continue
        typ = inp.attrs.get('type', 'textarea' if inp.tag == 'textarea' else 'text')
        if typ in ('hidden', 'submit', 'button'):
            continue
        ph = clean(inp.attrs.get('placeholder', '') or inp.attrs.get('aria-label', '') or inp.attrs.get('name', ''))
        if typ == 'checkbox':
            continue
        fields.append(ph)
        types.append({'input': typ, 'placeholder': True})
    btn = find1(c, lambda x: x.tag == 'button' or (x.tag == 'input' and x.attrs.get('type') == 'submit'))
    bt = clean(text_of(btn)) if btn is not None and btn.tag == 'button' else (btn.attrs.get('value', '') if btn is not None else '')
    b = {'type': 'form', 'fields': fields, 'fieldTypes': types, 'button': bt}
    if consent:
        b['consent'] = consent
    msgs = [clean(text_of(x)) for x in find_all(c, lambda x: 'message-success' in x.cls() or 'message-error' in x.cls())]
    msgs = [m for m in msgs if m]
    if msgs:
        b['messages'] = msgs
    return [b]


def loop_cards(c, ctx):
    items = []
    for it in find_all(c, lambda x: x.attrs.get('data-elementor-type') == 'loop-item', stop=True):
        d = {}
        t = find1(it, lambda x: wtype(x) in ('theme-post-title', 'heading'))
        if t is not None:
            hh = find1(t, lambda x: re.fullmatch(r'h[1-6]', x.tag) is not None) or t
            d['title'] = clean(text_of(hh))
        a = find1(t, lambda x: x.tag == 'a') if t is not None else None
        a = a or find1(it, lambda x: x.tag == 'a' and x.attrs.get('href'))
        d['href'] = fix_href(a.attrs.get('href')) if a is not None else ''
        im = find1(it, lambda x: x.tag == 'img')
        if im is not None:
            ib = img_block(im, ctx)
            if ib:
                d['img'] = {k: v for k, v in ib.items() if k != 'type'}
        meta = []
        for pi in find_all(it, lambda x: wtype(x) in ('post-info', 'shortcode', 'theme-post-excerpt', 'text-editor')):
            tt = clean(text_of(pi))
            if tt:
                meta.append(tt)
        if meta:
            d['meta'] = meta
        cats = [k[9:] for k in it.cls() if k.startswith('category-')]
        if cats:
            d['categories'] = cats
        items.append(d)
    return [{'type': 'cards', 'role': 'posts', 'items': items}] if items else []


def events_carousel(c, ctx):
    items = []
    # the custom carousel prints one card per event: month, day, category, time, title, venue
    cards = find_all(c, lambda x: x.tag in ('a', 'div', 'article', 'li') and any(k in ('swiper-slide',) for k in x.cls()), stop=True)
    if not cards:
        cards = find_all(c, lambda x: x.tag == 'a' and '/event/' in (x.attrs.get('href') or ''), stop=True)
    for cd in cards:
        texts = []
        for s in find_all(cd, lambda x: isinstance(x, Node) and x.tag in ('span', 'div', 'p', 'h3', 'h4', 'h2', 'a') and any(isinstance(y, str) and clean(y) for y in x.children)):
            t = clean(''.join(y for y in s.children if isinstance(y, str)))
            if t:
                texts.append((s.tag, ' '.join(s.cls()), t))
        a = cd if cd.tag == 'a' else find1(cd, lambda x: x.tag == 'a' and x.attrs.get('href'))
        h = find1(cd, lambda x: x.tag in ('h2', 'h3', 'h4'))
        d = {'title': clean(text_of(h)) if h is not None else '', 'href': fix_href(a.attrs.get('href')) if a is not None else ''}
        im = find1(cd, lambda x: x.tag == 'img')
        if im is not None:
            ib = img_block(im, ctx)
            if ib:
                d['img'] = {k: v for k, v in ib.items() if k != 'type'}
        parts = [t for _, _, t in texts]
        d['parts'] = parts
        if len(parts) == 6 and parts[4] == d['title']:
            d.update({'month': parts[0], 'day': parts[1], 'category': parts[2], 'timeText': parts[3], 'venue': parts[5],
                      'dateText': parts[0] + ' ' + parts[1], 'label': parts[2]})
        if d['href']:
            d['eventSlug'] = [x for x in d['href'].split('/') if x][-1]
        items.append(d)
    return [{'type': 'cards', 'role': 'events', 'items': items}] if items else []


def slides_block(c, ctx):
    items = []
    for sl in find_all(c, lambda x: 'swiper-slide' in x.cls(), stop=True):
        if 'swiper-slide-duplicate' in sl.cls():
            continue
        rep = next((k[24:] for k in sl.cls() if k.startswith('elementor-repeater-item-')), None)
        d = {}
        hd = find1(sl, has_cls('elementor-slide-heading'))
        ds = find1(sl, has_cls('elementor-slide-description'))
        bt = find1(sl, has_cls('elementor-slide-button'))
        if hd is not None:
            d['title'] = clean(text_of(hd))
        if ds is not None:
            d['html'] = tidy_inline(inline_html(ds))
        if bt is not None:
            d['label'] = clean(text_of(bt))
        a = find1(sl, lambda x: x.tag == 'a' and x.attrs.get('href'))
        if a is not None:
            d['href'] = fix_href(a.attrs['href'])
        bgs = []
        for wid in [eid(c)]:
            for url, media in BG.get((wid, rep), []):
                u = fix_href(url)
                add_ref(u, ctx)
                e = {'src': u, 'alt': '', 'role': 'background'}
                if media:
                    e['media'] = media
                bgs.append(e)
        st = find1(sl, has_cls('swiper-slide-bg'))
        if st is not None:
            for m in re.finditer(r'background-image:\s*url\((["\']?)([^)"\']+)\1\)', st.attrs.get('style', '')):
                u = fix_href(m.group(2))
                add_ref(u, ctx)
                bgs.append({'src': u, 'alt': '', 'role': 'background'})
        if bgs:
            d['img'] = bgs[0]
            if len(bgs) > 1:
                d['imgVariants'] = bgs[1:]
        if rep:
            d['repeaterId'] = rep
        if d.get('title') or d.get('html'):
            items.append(d)
    return [{'type': 'cards', 'role': 'slider', 'items': items}] if items else []


def image_box(c, ctx):
    d = {}
    im = find1(c, lambda x: x.tag == 'img')
    if im is not None:
        ib = img_block(im, ctx)
        if ib:
            d['img'] = {k: v for k, v in ib.items() if k != 'type'}
    t = find1(c, has_cls('elementor-image-box-title'))
    if t is not None:
        d['title'] = clean(text_of(t))
    ds = find1(c, has_cls('elementor-image-box-description'))
    if ds is not None and plain(tidy_inline(inline_html(ds))):
        d['html'] = tidy_inline(inline_html(ds))
    a = find1(c, lambda x: x.tag == 'a' and x.attrs.get('href'))
    if a is not None:
        d['href'] = fix_href(a.attrs['href'])
    return [{'type': 'card', **d}] if (d.get('title') or d.get('html') or d.get('img')) else []


def widget_blocks(c, ctx, w):
    if w in ('nav-menu', 'theme-site-logo', 'social-icons', 'search-form', 'menu-anchor', 'spacer', 'icon', 'share-buttons'):
        if w not in ('spacer', 'icon', 'menu-anchor'):
            ctx['dropped'].append('%s widget inside the content (chrome)' % w)
        if w == 'icon':
            a = find1(c, lambda x: x.tag == 'a' and x.attrs.get('href'))
            t = clean(text_of(c))
            if t:
                return p_block(c, ctx)
        return []
    if w in ('heading', 'theme-post-title', 'tec_events_elementor_widget_event_title'):
        hh = find1(c, lambda x: 'elementor-heading-title' in x.cls() or re.fullmatch(r'h[1-6]', x.tag) is not None)
        if hh is None:
            return p_block(c, ctx)
        return heading_block(hh, ctx)
    if w == 'text-editor' or w == 'theme-post-content' or w == 'theme-post-excerpt':
        inner = c
        wc = find1(c, has_cls('elementor-widget-container'))
        if wc is not None:
            inner = wc
        if any(isinstance(x, Node) and x.tag in BLOCK_TAGS - {'button'} for x in inner.children):
            return walk(inner, ctx)
        return p_block(inner, ctx, spaced=False)
    if w == 'icon-list':
        items = []
        for li in find_all(c, lambda x: x.tag == 'li'):
            tx = find1(li, has_cls('elementor-icon-list-text'))
            a = find1(li, lambda x: x.tag == 'a' and x.attrs.get('href'))
            h = tidy_inline(inline_html(tx if tx is not None else li))
            if a is not None and tx is not None and not find1(tx, lambda x: x.tag == 'a'):
                h = '<a href="%s">%s</a>' % (html.escape(fix_href(a.attrs['href'])), h)
            if plain(h):
                items.append(h)
        return [{'type': 'ul', 'role': 'icon-list', 'items': items}] if items else []
    if w in ('image', 'theme-post-featured-image', 'tec_events_elementor_widget_event_image'):
        out = []
        for im in find_all(c, lambda x: x.tag == 'img'):
            b = img_block(im, ctx)
            if b:
                a = im.parent
                while a is not None and a.tag not in ('a', 'root') and a is not c:
                    a = a.parent
                if a is not None and a.tag == 'a' and a.attrs.get('href'):
                    b['href'] = fix_href(a.attrs['href'])
                if w != 'image':
                    b['role'] = 'featured'
                out.append(b)
        cap = find1(c, lambda x: x.tag == 'figcaption')
        if cap is not None and clean(text_of(cap)) and out:
            out[-1]['caption'] = tidy_inline(inline_html(cap))
        return out
    if w == 'button':
        a = find1(c, lambda x: x.tag in ('a', 'button'))
        tx = find1(c, has_cls('elementor-button-text'))
        t = clean(text_of(tx if tx is not None else c))
        if not t:
            return []
        return [{'type': 'button', 'text': t, 'href': fix_href(a.attrs.get('href')) if a is not None and a.attrs.get('href') else ''}]
    if w == 'html' or w == 'shortcode':
        out = scripts_embeds(c, ctx)
        out += walk(find1(c, has_cls('elementor-widget-container')) or c, ctx)
        return out
    if w == 'google_maps':
        fr = find1(c, lambda x: x.tag == 'iframe')
        return iframe_block(fr, ctx) if fr is not None else []
    if w == 'post-info':
        items = []
        for li in find_all(c, lambda x: x.tag == 'li'):
            h = tidy_inline(inline_html(li, spaced_spans=True))
            if plain(h):
                items.append(h)
        if not items:
            return p_block(c, ctx, role='meta')
        return [{'type': 'ul', 'role': 'meta', 'items': items}]
    if w == 'divider':
        t = find1(c, has_cls('elementor-divider__text'))
        return p_block(t, ctx) if t is not None and clean(text_of(t)) else []
    if w == 'loop-grid':
        return loop_cards(c, ctx)
    if w.startswith('events_carousel'):
        return events_carousel(c, ctx)
    if w == 'nested-accordion':
        return faq_nested(c, ctx)
    if w == 'image-box':
        return image_box(c, ctx)
    if w == 'taxonomy-filter':
        items = [clean(text_of(x)) for x in find_all(c, lambda x: x.tag in ('button', 'a'))]
        items = [esc(x) for x in items if x]
        return [{'type': 'ul', 'role': 'filters', 'items': items}] if items else []
    if w == 'slides':
        return slides_block(c, ctx)
    if w == 'author-box':
        nm = find1(c, has_cls('elementor-author-box__name'))
        bio = find1(c, has_cls('elementor-author-box__bio'))
        ctx['author'] = {'name': clean(text_of(nm)) if nm is not None else '', 'bio': clean(text_of(bio)) if bio is not None else ''}
        out = []
        if nm is not None and clean(text_of(nm)):
            out.append({'type': 'p', 'html': esc(clean(text_of(nm))), 'role': 'author'})
        if bio is not None and clean(text_of(bio)):
            out.append({'type': 'p', 'html': tidy_inline(inline_html(bio)), 'role': 'author-bio'})
        return out
    if w in ('tec_events_elementor_widget_event_navigation', 'tec_events_elementor_widget_event_export', 'tec_events_elementor_widget_event_calendar_link'):
        if w.endswith('navigation'):
            for a in find_all(c, lambda x: x.tag == 'a'):
                ctx['adjacent'].append({'text': clean(text_of(a)), 'href': fix_href(a.attrs.get('href'))})
        ctx['dropped'].append('%s (The Events Calendar machinery: %s)' % (w, clean(text_of(c))[:120]))
        return []
    if w.startswith('tec_events_elementor_widget_'):
        role = w[len('tec_events_elementor_widget_event_'):]
        out = []
        hh = find1(c, lambda x: re.fullmatch(r'h[1-6]', x.tag) is not None)
        rest = walk(c, ctx)
        for b in rest:
            b.setdefault('role', 'event-' + role) if b['type'] == 'p' or b['type'] in ('ul',) else None
            out.append(b)
        return out
    return walk(c, ctx)


def node_blocks(c, ctx):
    if c.tag in SKIP_TAGS or is_sr(c):
        return []
    if c.attrs.get('aria-hidden') == 'true':
        t = clean(text_of(c))
        if t:
            ctx['aria_hidden'].append(t[:80])
        return []
    if c.attrs.get('data-elementor-type') in CHROME_DOCS or 'age-gate' in ' '.join(c.cls()):
        return []
    hid = hidden_of(c)
    out = _node_blocks(c, ctx)
    if hid:
        for b in out:
            b['hiddenOn'] = sorted(set(b.get('hiddenOn', [])) | set(hid))
    return out


def _node_blocks(c, ctx):
    w = wtype(c)
    pre = []
    if c.attrs.get('data-element_type') in ('container', 'section', 'column') or 'e-con' in c.cls():
        pre = bg_blocks(c, ctx)
    if w:
        return pre + widget_blocks(c, ctx, w)
    if c.attrs.get('data-element_type') == 'e-form' or (c.tag == 'form'):
        return pre + form_block(c, ctx)
    if 'e-form-success-message-base' in c.cls() or 'e-form-error-message-base' in c.cls():
        return []
    # container: walk it, then fold sibling card-like child containers into cards/steps
    if c.attrs.get('data-element_type') in ('container', 'section', 'column') or 'e-con' in c.cls():
        if c.tag == 'a' and c.attrs.get('href'):
            inner = walk(c, ctx)
            card = card_from(inner, fix_href(c.attrs['href']))
            return pre + ([dict(type='card', **card)] if card else inner)
        kids = [x for x in c.children if isinstance(x, Node)]
        groups = []
        for k in kids:
            groups.append((k, node_blocks(k, ctx)))
        out = list(pre)
        cardish = [g for g in groups if g[1] and is_cardish(g[0], g[1])]
        if len(cardish) >= 2 and len(cardish) == len([g for g in groups if g[1]]):
            items = []
            for k, bl in groups:
                if not bl:
                    continue
                items.append(card_from(bl, fix_href(k.attrs.get('href')) if k.tag == 'a' else None))
            out.append({'type': 'card-group', 'items': items})
            return out
        for k, bl in groups:
            out.extend(bl)
        return out
    t = c.tag
    if re.fullmatch(r'h[1-6]', t):
        return heading_block(c, ctx)
    if t == 'p':
        kids = [x for x in c.children if isinstance(x, Node) and x.tag not in SKIP_TAGS]
        if kids and find_all(c, lambda x: x.tag == 'img') and not clean(text_of(c)):
            out = []
            for im in find_all(c, lambda x: x.tag == 'img'):
                b = img_block(im, ctx)
                if b:
                    a = im.parent
                    if a is not None and a.tag == 'a' and a.attrs.get('href'):
                        b['href'] = fix_href(a.attrs['href'])
                    out.append(b)
            return out
        if any(isinstance(x, Node) and x.tag in BLOCK_TAGS - {'button', 'img'} for x in c.children):
            return walk(c, ctx)
        out = p_block(c, ctx)
        for im in find_all(c, lambda x: x.tag == 'img'):
            b = img_block(im, ctx)
            if b:
                out.append(b)
        return out
    if t in ('ul', 'ol'):
        return list_block(c, ctx)
    if t == 'blockquote':
        h = tidy_inline(inline_html(c))
        return [{'type': 'quote', 'html': h}] if plain(h) else []
    if t == 'table':
        return table_block(c, ctx)
    if t == 'figure':
        out = []
        cap = find1(c, lambda x: x.tag == 'figcaption')
        for im in find_all(c, lambda x: x.tag == 'img'):
            b = img_block(im, ctx)
            if b:
                out.append(b)
        if cap is not None and clean(text_of(cap)):
            if out:
                out[-1]['caption'] = tidy_inline(inline_html(cap))
            else:
                out.append({'type': 'p', 'html': tidy_inline(inline_html(cap)), 'role': 'caption'})
        rest = Node('div', [])
        rest.children = [x for x in c.children if not (isinstance(x, Node) and x.tag in ('img', 'figcaption', 'picture', 'a'))]
        if clean(text_of(rest)):
            out.extend(walk(rest, ctx))
        return out
    if t == 'img':
        b = img_block(c, ctx)
        return [b] if b else []
    if t == 'picture':
        im = find1(c, lambda x: x.tag == 'img')
        b = img_block(im, ctx) if im is not None else None
        return [b] if b else []
    if t == 'iframe':
        return iframe_block(c, ctx)
    if t == 'video':
        srcs = [x.attrs.get('src') for x in c.children if isinstance(x, Node) and x.tag == 'source' and x.attrs.get('src')]
        src = c.attrs.get('src') or (srcs[0] if srcs else '')
        ctx['videos'].append(src)
        return [{'type': 'video', 'src': fix_href(src), 'poster': fix_href(c.attrs.get('poster', ''))}] if src else []
    if t == 'details':
        return details_block(c, ctx)
    if t in ('br', 'hr'):
        return []
    if t == 'a':
        if any(isinstance(x, Node) and (x.tag in BLOCK_TAGS) for x in c.children):
            inner = walk(c, ctx)
            card = card_from(inner, fix_href(c.attrs.get('href')))
            return [dict(type='card', **card)] if card else inner
        h = tidy_inline(inline_html(wrap(c)))
        return [{'type': 'p', 'html': h, 'role': 'link'}] if plain(h) else []
    if t == 'button':
        tt = clean(text_of(c))
        if tt:
            return [{'type': 'button', 'text': tt, 'href': ''}]
        return []
    if t in INLINE_TAGS:
        h = tidy_inline(inline_html(wrap(c)))
        return [{'type': 'p', 'html': h}] if plain(h) else []
    out = scripts_embeds(c, ctx) if t == 'div' and find1(c, lambda x: x.tag == 'script') else []
    return out + walk(c, ctx)


def wrap(c):
    n = Node('x', [])
    n.children = [c]
    return n


CARD_TYPES = {'img', 'h2', 'h3', 'h4', 'p', 'button', 'card'}


def is_cardish(k, bl):
    if not (k.attrs.get('data-element_type') == 'container' or 'e-con' in k.cls()):
        return False
    types = [b['type'] for b in bl]
    if any(t not in CARD_TYPES for t in types):
        return False
    heads = [t for t in types if t in ('h2', 'h3', 'h4')]
    imgs = [t for t in types if t == 'img']
    ps = [t for t in types if t == 'p']
    if len(heads) != 1 or len(imgs) > 2 or len(ps) > 3 or types.count('button') > 1 or 'card' in types:
        return False
    return True


def card_from(bl, href=None):
    d = {}
    if href:
        d['href'] = href
    rest = []
    for b in bl:
        if b['type'] == 'img' and 'img' not in d:
            d['img'] = {k: v for k, v in b.items() if k != 'type'}
        elif b['type'] in ('h2', 'h3', 'h4') and 'title' not in d:
            d['title'] = b['text']
            d['level'] = int(b['type'][1])
            if b.get('href') and 'href' not in d:
                d['href'] = b['href']
        elif b['type'] == 'button' and 'label' not in d:
            d['label'] = b['text']
            if b.get('href') and 'href' not in d:
                d['href'] = b['href']
            elif b.get('href'):
                d['labelHref'] = b['href']
        elif b['type'] == 'p':
            rest.append(b['html'])
        elif b['type'] == 'img':
            d.setdefault('moreImgs', []).append({k: v for k, v in b.items() if k != 'type'})
        elif b['type'] == 'card':
            return None
        if b.get('hiddenOn'):
            d['hiddenOn'] = b['hiddenOn']
    if rest:
        d['html'] = '<br>'.join(rest) if len(rest) > 1 else rest[0]
    if not (d.get('title') or d.get('html') or d.get('img')):
        return None
    return d


# ---------------------------------------------------------------- post-processing
STEP_RE = re.compile(r'^(\d{1,2})[.)]\s*(.+)$')


def group_pass(blocks):
    """card-group -> steps (numbered titles) or cards; consecutive single cards -> cards; heading?+answer runs -> faq."""
    out = []
    for b in blocks:
        if b['type'] == 'card-group':
            items = [x for x in b['items'] if x]
            if items and all(STEP_RE.match(x.get('title', '')) for x in items) and not any(x.get('img') for x in items):
                st = []
                for x in items:
                    m = STEP_RE.match(x['title'])
                    st.append({'num': m.group(1), 'title': m.group(2), 'text': plain(x.get('html', '')), 'titleRaw': x['title'], 'html': x.get('html', '')})
                out.append({'type': 'steps', 'items': st})
            else:
                out.append({'type': 'cards', 'items': items})
            continue
        if b['type'] == 'card':
            item = {k: v for k, v in b.items() if k != 'type'}
            if out and out[-1]['type'] == 'cards' and out[-1].get('role') == 'image-box':
                out[-1]['items'].append(item)
            else:
                out.append({'type': 'cards', 'role': 'image-box', 'items': [item]})
            continue
        # an image-box tile followed by its own button widget ("Click here"): the button is the card's CTA label
        if b['type'] == 'button' and out and out[-1]['type'] == 'cards' and out[-1].get('role') == 'image-box' and 'label' not in out[-1]['items'][-1]:
            it = out[-1]['items'][-1]
            it['label'] = b['text']
            if b.get('href'):
                if not it.get('href'):
                    it['href'] = b['href']
                elif it['href'] != b['href']:
                    it['labelHref'] = b['href']
            continue
        out.append(b)
    # Q/A heading + text pairs (>= 2 in a row, same heading level, question mark) -> faq
    res, i = [], 0
    while i < len(out):
        b = out[i]
        if b['type'] in ('h3', 'h4', 'h2') and b['text'].rstrip().endswith('?'):
            lvl = b['type']
            items, j = [], i
            while j < len(out) and out[j]['type'] == lvl and out[j]['text'].rstrip().endswith('?'):
                k = j + 1
                ans = []
                while k < len(out) and out[k]['type'] in ('p', 'ul', 'ol', 'table', 'quote') and not out[k].get('role') in ('kicker',):
                    ans.append(out[k])
                    k += 1
                if not ans:
                    break
                items.append({'q': out[j]['text'], 'a_html': '\n'.join(block_to_html(a) for a in ans)})
                j = k
            if len(items) >= 2:
                res.append({'type': 'faq', 'items': items, 'from': 'headings'})
                i = j
                continue
        res.append(b)
        i += 1
    return res


def block_to_html(b):
    if b['type'] == 'p':
        return '<p>%s</p>' % b['html']
    if b['type'] in ('ul', 'ol'):
        return '<%s>%s</%s>' % (b['type'], ''.join('<li>%s</li>' % x for x in b['items']), b['type'])
    if b['type'] == 'quote':
        return '<blockquote>%s</blockquote>' % b['html']
    if b['type'] == 'table':
        return '<table>%s</table>' % ''.join('<tr>%s</tr>' % ''.join('<td>%s</td>' % esc(c) for c in r) for r in b['rows'])
    return ''


def table_pass(blocks):
    """two-column key/value runs printed as paired headings/texts (SERVICE / DETAILS) are kept as they are; real
    <table>s already become table blocks."""
    return blocks


def sig(b):
    t = b.get('type')
    if t == 'img':
        return 'img:' + b.get('src', '')
    s = json.dumps({k: v for k, v in b.items() if k not in ('hiddenOn', 'media')}, sort_keys=True, ensure_ascii=False)
    return s


def dedupe_variants(sections, ctx):
    """Elementor desktop/mobile variants: a block printed twice (once hidden on desktop, once hidden on mobile) with
    the same content is kept once (the desktop one, with the mobile copy's hiddenOn dropped)."""
    allb = [(si, bi, b) for si, s in enumerate(sections) for bi, b in enumerate(s['blocks'])]
    by = {}
    for si, bi, b in allb:
        by.setdefault(sig(b), []).append((si, bi, b))
    drop = set()
    for k, lst in by.items():
        if len(lst) < 2:
            continue
        hidden = [x for x in lst if x[2].get('hiddenOn')]
        if not hidden:
            continue
        keep = next((x for x in lst if 'desktop' not in (x[2].get('hiddenOn') or [])), lst[0])
        for x in lst:
            if x is keep:
                continue
            if x[2].get('hiddenOn'):
                drop.add((x[0], x[1]))
                ctx['dropped'].append('responsive duplicate (%s, hidden on %s) of a block shown elsewhere: kept once' % (x[2]['type'], ','.join(x[2]['hiddenOn'])))
        if keep[2].get('hiddenOn') and all(((x[0], x[1]) in drop) or x is keep for x in lst):
            del keep[2]['hiddenOn']
    for si, s in enumerate(sections):
        s['blocks'] = [b for bi, b in enumerate(s['blocks']) if (si, bi) not in drop]
    return [s for s in sections if s['blocks'] or s.get('heading')]


def slugify(s):
    s = html.unescape(s).lower()
    s = re.sub(r'[’\']', '', s)
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:60].strip('-') or 'section'


def finish_section(blocks, idx, src, page):
    blocks = group_pass(blocks)
    seen_embed, kept = set(), []
    for b in blocks:
        if b['type'] == 'embed':
            if b['src'] in seen_embed:
                continue
            seen_embed.add(b['src'])
        kept.append(b)
    blocks = kept
    sec = {'id': '', 'src': src, 'heading': '', 'blocks': blocks}
    hpos = None
    for i, b in enumerate(blocks):
        if b['type'] == 'h1':
            hpos = i
            break
    if hpos is None:
        for i, b in enumerate(blocks):
            if b['type'] in ('h2', 'h3', 'h4'):
                hpos = i
                break
    if hpos is not None:
        hb = blocks[hpos]
        sec['heading'] = hb['text']
        sec['headingLevel'] = int(hb['type'][1])
        if hb.get('hiddenOn'):
            sec['headingHiddenOn'] = hb['hiddenOn']
        if hb['type'] == 'h1' and not page.get('h1'):
            page['h1'] = hb['text']
        del blocks[hpos]
        if hpos > 0:
            pb = blocks[hpos - 1]
            if pb['type'] == 'p' and not pb.get('role') and len(plain(pb['html']).split()) <= 8 and '<a ' not in pb['html']:
                pb['role'] = 'kicker'
            elif pb['type'] == 'p' and pb.get('role') == 'label' and len(plain(pb['html']).split()) <= 8:
                pb['role'] = 'kicker'
    for b in blocks:
        if b['type'] == 'h1':
            if not page.get('h1'):
                page['h1'] = b['text']
            b['type'] = 'h2'
            b['wasH1'] = True
    sec['id'] = slugify(sec['heading']) if sec['heading'] else 's%d' % (idx + 1)
    return sec


def head_meta(h):
    m = {}
    t = re.search(r'<title>([\s\S]*?)</title>', h)
    m['title'] = clean(html.unescape(t.group(1))) if t else ''

    def meta(attr, name):
        for x in re.finditer(r'<meta\s+[^>]*>', h):
            tag = x.group(0)
            if re.search(r'%s=["\']%s["\']' % (attr, re.escape(name)), tag):
                c = re.search(r'content=["\']([^"\']*)["\']', tag)
                return html.unescape(c.group(1)) if c else ''
        return ''
    m['description'] = meta('name', 'description')
    x = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']*)["\']', h)
    m['canonical'] = x.group(1) if x else ''
    m['ogImage'] = meta('property', 'og:image')
    m['ogTitle'] = meta('property', 'og:title')
    m['ogDescription'] = meta('property', 'og:description')
    m['published'] = meta('property', 'article:published_time')
    m['modified'] = meta('property', 'article:modified_time')
    ld = []
    for s in re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>', h):
        try:
            ld.append(json.loads(s))
        except Exception:
            pass
    m['jsonld'] = ld
    return m


def ld_nodes(ld):
    for x in ld:
        if isinstance(x, list):
            for y in x:
                yield from ld_nodes([y])
        elif isinstance(x, dict):
            yield x
            for g in x.get('@graph', []) or []:
                if isinstance(g, dict):
                    yield g


def content_docs(root):
    docs = []

    def rec(n, inside_chrome=False):
        if isinstance(n, str):
            return
        t = n.attrs.get('data-elementor-type')
        if t in CHROME_DOCS:
            return
        if t in CONTENT_DOCS:
            docs.append(n)
            return
        for c in n.children:
            rec(c)
    rec(root)
    return docs


# ---------------------------------------------------------------- main capture
def capture_page(url, file):
    h = open(os.path.join(RAW, file), encoding='utf-8', errors='strict').read()
    root = parse(h)
    body = find1(root, lambda x: x.tag == 'body')
    bclass = body.attrs.get('class', '')
    pid = re.search(r'\b(?:page-id|postid)-(\d+)', bclass)
    meta = head_meta(h)
    path = urllib.parse.urlsplit(url).path or '/'
    ctx = {'path': path, 'dropped': [], 'adjacent': [], 'aria_hidden': [], 'remote_imgs': [], 'videos': [], 'embeds': [], 'author': None}
    page = {'h1': ''}
    docs = content_docs(body)
    top = []
    if not docs:
        # no Elementor content document (e.g. The Events Calendar views): body minus chrome
        main = find1(body, lambda x: x.tag == 'main') or body
        docs = [main]
        ctx['dropped'].append('no Elementor content document: used <%s>' % main.tag)
    sections = []
    for d in docs:
        for c in d.children:
            if isinstance(c, str) or c.tag in SKIP_TAGS:
                continue
            if c.attrs.get('data-elementor-type') in CHROME_DOCS or 'age-gate' in ' '.join(c.cls()) or c.attrs.get('id') in ('wpadminbar',):
                continue
            if c.tag == 'a' and 'skip-link' in c.cls():
                continue
            top.append({'tag': c.tag, 'id': eid(c), 'cls': ' '.join(c.cls())[:80], 'chars': len(clean(text_of(c)))})
            blocks = node_blocks(c, ctx)
            if not blocks:
                continue
            sec = finish_section(blocks, len(sections), eid(c), page)
            sections.append(sec)
    sections = dedupe_variants(sections, ctx)
    ids = {}
    for s in sections:
        if s['id'] in ids:
            ids[s['id']] += 1
            s['id'] = '%s-%d' % (s['id'], ids[s['id']])
        else:
            ids[s['id']] = 1
    rec = {'url': url, 'path': path, 'postId': pid.group(1) if pid else '', 'bodyClass': bclass, 'title': meta['title'],
           'description': meta['description'], 'canonical': meta['canonical'], 'ogImage': meta['ogImage'], 'h1': page['h1']}
    rec['sections'] = sections
    return rec, ctx, top, root, h, meta, docs


def main():
    idx = json.load(open(os.path.join(RAW, '_index.json'), encoding='utf-8'))
    # CSS backgrounds first (they are needed while walking)
    css_urls = set()
    for url, v in idx.items():
        h = open(os.path.join(RAW, v['file']), encoding='utf-8').read()
        for u in re.findall(r"https://getbuzzy\.com/wp-content/uploads/elementor/css/post-\d+\.css(?:\?ver=\d+)?", h):
            css_urls.add(u)
    if FETCH_CSS:
        fetch_css(css_urls)
    css_log = load_css()
    stats = {'pages': {}, 'top': {}, 'dropped': {}, 'aria_hidden': {}, 'remote_imgs': {}, 'videos': {}, 'embeds': {},
             'css': {'urls': len(css_urls), 'ok': sum(1 for v in css_log.values() if v.get('ok')), 'bgKeys': len(BG)}}
    recs = {}
    for url, v in idx.items():
        if v.get('status') != 200:
            continue
        rec, ctx, top, root, h, meta, docs = capture_page(url, v['file'])
        recs[url] = (rec, ctx, root, h, meta, docs)
        stats['top'][rec['path']] = top
        stats['dropped'][rec['path']] = sorted(set(ctx['dropped']))
        stats['aria_hidden'][rec['path']] = ctx['aria_hidden']
        stats['remote_imgs'][rec['path']] = sorted(set(ctx['remote_imgs']))
        if ctx['videos']:
            stats['videos'][rec['path']] = ctx['videos']
        if ctx['embeds']:
            stats['embeds'][rec['path']] = sorted(set(ctx['embeds']))

    # post bodies + featured images, before fetching (their images are content images too)
    post_data = {}
    for url, (rec, ctx, root, h, meta, docs) in recs.items():
        if 'single-post' not in rec['bodyClass'].split():
            continue
        bctx = dict(ctx, embeds=[], dropped=[])
        pc = None
        for d in docs:
            pc = pc or find1(d, lambda x: wtype(x) == 'theme-post-content')
        bh = tidy_body(body_html(pc, bctx)) if pc is not None else ''
        fi = None
        for d in docs:
            fi = fi or find1(d, lambda x: wtype(x) == 'theme-post-featured-image')
        fim = find1(fi, lambda x: x.tag == 'img') if fi is not None else None
        fib = img_block(fim, ctx) if fim is not None else None
        post_data[url] = {'html': bh, 'featured': fib, 'dropped': bctx['dropped']}

    # brand images (header logo, footer logo, site icons, rewards logos, home pictograms)
    home = recs[ORIGIN + '/']
    brand = []
    hroot = home[2]
    hdr = find1(hroot, lambda x: x.attrs.get('data-elementor-type') == 'header')
    ftr = find1(hroot, lambda x: x.attrs.get('data-elementor-type') == 'footer')
    for im in find_all(hdr, lambda x: x.tag == 'img') if hdr is not None else []:
        brand.append(('logo-header', largest_src(im)[0], im.attrs.get('alt', '')))
    for im in find_all(ftr, lambda x: x.tag == 'img') if ftr is not None else []:
        brand.append(('logo-footer', largest_src(im)[0], im.attrs.get('alt', '')))
    for m in re.finditer(r'<link rel="(icon|apple-touch-icon)" href="([^"]+)"(?: sizes="([^"]+)")?', home[3]):
        brand.append(('icon:%s:%s' % (m.group(1), m.group(3) or ''), m.group(2), ''))
    for u in list(IMG_REFS.keys()):
        if 'reward' in u.lower().split('/')[-1]:
            brand.append(('rewards', u, ''))
    og_urls = set(r[0]['ogImage'] for r in recs.values() if r[0].get('ogImage'))
    all_urls = list(IMG_REFS.keys()) + [b[1] for b in brand] + [u for u in og_urls if '/wp-content/uploads/' in u]
    fetched = fetch_all(all_urls) if FETCH else load_fetch_log()
    local = place_images(fetched)

    written = {'pages': [], 'posts': [], 'events': [], 'delivery': []}
    for d in written:
        os.makedirs(os.path.join(CONTENT, d), exist_ok=True)
    for url, (rec, ctx, root, h, meta, docs) in recs.items():
        rewrite_imgs(rec, local)
        segs = [urllib.parse.unquote(s) for s in rec['path'].split('/') if s]
        bodyc = rec['bodyClass'].split()
        typ = 'pages'
        if 'single-post' in bodyc:
            typ = 'posts'
        elif len(segs) == 2 and segs[0] == 'event':
            typ = 'events'
        elif len(segs) == 2 and segs[0] == 'cannabis-delivery-brooklyn':
            typ = 'delivery'
        slug = segs[-1] if typ != 'pages' else ('-'.join(segs) if segs else 'home')
        og = rec['ogImage']
        lo = local.get(og) if og else None
        rec2 = {'slug': slug, 'path': rec['path'], 'url': url, 'title': rec['title'], 'description': rec['description'],
                'canonical': rec['canonical'], 'ogImage': lo['path'] if lo else og, 'ogImageSrc': og, 'h1': rec['h1'], 'postId': rec['postId']}
        if typ == 'posts':
            pd = post_data[url]
            bh = rewrite_html_imgs(pd['html'], local)
            iso = meta.get('published') or ''
            if not iso:
                for g in ld_nodes(meta['jsonld']):
                    if g.get('datePublished') and g.get('@type') in ('BlogPosting', 'Article', 'NewsArticle'):
                        iso = g['datePublished']
                        break
            rec2['date'] = iso
            rec2['modified'] = meta.get('modified', '')
            # dateText / readTime as shown in the template's post-info / shortcode widgets
            shown = []
            for s in rec['sections']:
                for b in s['blocks']:
                    if b.get('role') == 'meta':
                        shown += [plain(x) for x in b.get('items', [])] or [plain(b.get('html', ''))]
                    elif b['type'] == 'p' and re.search(r'\b\d+\s*min(ute)?s?\b', plain(b.get('html', '')), re.I) and len(plain(b['html'])) < 40:
                        shown.append(plain(b['html']))
            dt = next((x for x in shown if re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d', x)), '')
            rt = next((x for x in shown if re.search(r'\bmin', x, re.I)), '')
            rec2['dateText'] = dt
            rec2['readTime'] = rt
            cats = []
            for k in bodyc:
                pass
            cat_slugs = [k[9:] for k in bodyc if k.startswith('category-')]
            names = {}
            for a in re.findall(r'<a [^>]*href="https://getbuzzy\.com/category/(?:[a-z0-9-]+/)*([a-z0-9-]+)/"[^>]*>([^<]+)</a>', h):
                names.setdefault(a[0], clean(html.unescape(a[1])))
            for cs in cat_slugs:
                cats.append({'name': names.get(cs, cs.replace('-', ' ').title()), 'slug': cs})
            if not cats:
                for g in ld_nodes(meta['jsonld']):
                    sec = g.get('articleSection')
                    if sec:
                        for nm in (sec if isinstance(sec, list) else [sec]):
                            cats.append({'name': nm, 'slug': slugify(nm)})
                        break
            rec2['categories'] = cats
            fb = pd['featured']
            if fb:
                li = local.get(fb['src'])
                rec2['image'] = {'src': li['path'] if li else fb['src'], 'w': li['w'] if li else fb.get('w'), 'h': li['h'] if li else fb.get('h'), 'alt': fb.get('alt', '')}
            elif lo:
                rec2['image'] = {'src': lo['path'], 'w': lo['w'], 'h': lo['h'], 'alt': ''}
            else:
                rec2['image'] = None
            paras = re.findall(r'<p>(.*?)</p>', bh)
            rec2['excerpt'] = plain(paras[0]) if paras else rec['description']
            if ctx.get('author'):
                rec2['author'] = ctx['author']
            rec2['html'] = bh
            stats['dropped'][rec['path']] = sorted(set(stats['dropped'][rec['path']] + pd['dropped']))
        elif typ == 'events':
            ev = None
            for g in ld_nodes(meta['jsonld']):
                if g.get('@type') == 'Event':
                    ev = g
                    break
            first_blocks = [b for s in rec['sections'] for b in s['blocks']]
            dtb = [b for b in first_blocks if b.get('role') == 'event-datetime']
            vnb = [b for b in first_blocks if b.get('role') == 'event-venue']
            ctb = [b for b in first_blocks if b.get('role') == 'event-categories']
            dtt = ' '.join(plain(b.get('html', '')) or ' '.join(plain(x) for x in b.get('items', [])) for b in dtb)
            rec2['startISO'] = (ev or {}).get('startDate', '')
            rec2['endISO'] = (ev or {}).get('endDate', '')
            # "November 30 @ 7:00 pm - 9:00 pm" style: split date / time at "@"
            m = re.match(r'^(.*?)\s*@\s*(.*)$', dtt)
            rec2['dateText'] = clean(m.group(1)) if m else dtt
            rec2['timeText'] = clean(m.group(2)) if m else ''
            loc = (ev or {}).get('location') or {}
            if isinstance(loc, list):
                loc = loc[0] if loc else {}
            addr = loc.get('address') or {}
            if isinstance(addr, dict):
                addr_s = ', '.join(x for x in [addr.get('streetAddress'), addr.get('addressLocality'), ' '.join(y for y in [addr.get('addressRegion'), addr.get('postalCode')] if y)] if x)
            else:
                addr_s = str(addr)
            rec2['venue'] = html.unescape(loc.get('name', '')) if loc else ''
            rec2['address'] = html.unescape(addr_s)
            rec2['venueShown'] = [plain(b.get('html', '')) or ' '.join(plain(x) for x in b.get('items', [])) for b in vnb]
            # past events carry no Event JSON-LD: the dates come from the calendar export link (startdt/enddt, with the
            # UTC offset) and the venue from the venue widget
            if not rec2['startISO']:
                m2 = re.search(r'[?&]startdt=([^&"]+)', h)
                m3 = re.search(r'[?&]enddt=([^&"]+)', h)
                if m2:
                    rec2['startISO'] = urllib.parse.unquote(m2.group(1))
                    rec2['startSource'] = 'calendar export link (no Event JSON-LD on past events)'
                if m3:
                    rec2['endISO'] = urllib.parse.unquote(m3.group(1))
            vn = None
            for d in docs:
                vn = vn or find1(d, has_cls('tec-events-elementor-event-widget__venue-name'))
            va = None
            for d in docs:
                va = va or find1(d, has_cls('tec-events-elementor-event-widget__venue-address'))
            if not rec2['venue'] and vn is not None:
                rec2['venue'] = clean(text_of(vn))
            if not rec2['address'] and va is not None:
                rec2['address'] = re.sub(r'\s*\+\s*Google Map\s*$', '', clean(text_of(va)))
            cat_links = re.findall(r'<a [^>]*href="https://getbuzzy\.com/events/category/([a-z0-9-]+)/"[^>]*>([^<]+)</a>', ' '.join(b.get('html', '') + ' '.join(b.get('items', [])) for b in ctb))
            if not cat_links:
                cat_links = re.findall(r'href="https://getbuzzy\.com/events/category/([a-z0-9-]+)/"[^>]*>([^<]+)</a>', h)
            rec2['category'] = clean(html.unescape(cat_links[0][1])) if cat_links else ''
            rec2['categorySlug'] = cat_links[0][0] if cat_links else ''
            rec2['categories'] = [{'name': clean(html.unescape(n)), 'slug': s} for s, n in dict(cat_links).items()] if cat_links else []
            imgs = [b for b in first_blocks if b['type'] == 'img']
            rec2['image'] = ({'src': imgs[0]['src'], 'w': imgs[0].get('w'), 'h': imgs[0].get('h'), 'alt': imgs[0].get('alt', '')} if imgs else None)
            rec2['eventDescription'] = html.unescape(re.sub(r'<[^>]+>', ' ', (ev or {}).get('description', ''))).strip()
            if ev and ev.get('offers'):
                rec2['offers'] = ev['offers']
            pc = None
            for d in docs:
                pc = pc or find1(d, lambda x: wtype(x) == 'theme-post-content')
            bctx = dict(ctx, embeds=[], dropped=[])
            rec2['html'] = rewrite_html_imgs(tidy_body(body_html(pc, bctx)) if pc is not None else '', local)
            if ctx['adjacent']:
                rec2['adjacent'] = ctx['adjacent']
            rec2['sections'] = rec['sections']
        else:
            rec2['sections'] = rec['sections']
        if typ == 'delivery':
            m = re.match(r'^Cannabis Delivery in (.+?), Brooklyn', rec['h1'] or '')
            nm = m.group(1) if m else slug.replace('-', ' ').title()
            rec2 = dict(list(rec2.items())[:3] + [('name', nm)] + list(rec2.items())[3:])
        fname = slug + '.json'
        with open(os.path.join(CONTENT, typ, fname), 'w', encoding='utf-8', newline='\n') as o:
            json.dump(rec2, o, ensure_ascii=False, indent=1)
        written[typ].append(fname)
        stats['pages'][rec['path']] = {'type': typ, 'file': typ + '/' + fname, 'sections': len(rec['sections']),
                                       'blocks': sum(len(s['blocks']) for s in rec['sections'])}
    # brand files
    os.makedirs(BRAND, exist_ok=True)
    brand_out = []
    try:
        from PIL import Image
    except Exception:
        Image = None
    reward_n = {}
    for role, u, alt in brand:
        f = fetched.get(u)
        if not f or not f.get('ok'):
            brand_out.append({'role': role, 'src': u, 'ok': False})
            continue
        ext = f['ext']
        base = u.split('/')[-1].lower()
        dst = None
        if role == 'logo-header':
            dst = 'buzzy-logo-black.' + ext
        elif role == 'logo-footer':
            dst = ('buzzy-highly-curated-white.' if 'highlycurated' in base else ('buzzy-logo-white.' if 'white' in base else 'buzzy-logo-footer.')) + ext
        elif role == 'rewards':
            col = 'white' if 'white' in base else ('black' if 'black' in base else '')
            key = col or 'logo'
            reward_n[key] = reward_n.get(key, 0) + 1
            dst = 'buzzy-rewards%s%s.%s' % ('-' + col if col else '', '' if reward_n[key] == 1 else '-%d' % reward_n[key], ext)
        elif role.startswith('icon:apple-touch-icon'):
            dst = None
            if Image is not None:
                Image.open(f['file']).convert('RGBA').resize((180, 180), Image.LANCZOS).save(os.path.join(BRAND, 'apple-touch-icon.png'))
                brand_out.append({'role': role, 'src': u, 'file': 'assets/brand/apple-touch-icon.png', 'w': 180, 'h': 180, 'from': 'PIL resize of the live apple-touch-icon (%s %sx%s)' % (ext, f.get('w'), f.get('h'))})
            continue
        elif role.startswith('icon:icon'):
            sz = role.split(':')[2]
            dst = 'favicon-%s.%s' % (sz.split('x')[0] if sz else 'src', ext)
        if dst:
            shutil.copyfile(f['file'], os.path.join(BRAND, dst))
            brand_out.append({'role': role, 'src': u, 'file': 'assets/brand/' + dst, 'w': f.get('w'), 'h': f.get('h'), 'bytes': f.get('bytes'), 'alt': alt})
    # PNG/ICO favicons from the largest live icon
    if Image is not None:
        icons = [b for b in brand_out if b.get('role', '').startswith('icon:icon') and b.get('file')]
        if icons:
            big = max(icons, key=lambda b: (b.get('w') or 0))
            im = Image.open(os.path.join(ROOT, big['file'])).convert('RGBA')
            im.resize((32, 32), Image.LANCZOS).save(os.path.join(BRAND, 'favicon-32.png'))
            im.resize((192, 192), Image.LANCZOS).save(os.path.join(BRAND, 'favicon-192.png'))
            im.save(os.path.join(BRAND, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
            brand_out.append({'role': 'icon:png+ico', 'files': ['assets/brand/favicon-32.png', 'assets/brand/favicon-192.png', 'assets/brand/favicon.ico'], 'from': big['file']})
    # the 8 home category pictograms
    hp = json.load(open(os.path.join(CONTENT, 'pages', 'home.json'), encoding='utf-8'))
    for s in hp['sections']:
        for b in s['blocks']:
            if b['type'] == 'cards':
                for it in b['items']:
                    t = (it.get('title') or '').strip()
                    if t.upper() in ('TINCTURES', 'TOPICALS', 'PRE-ROLLS', 'FLOWER', 'EDIBLES', 'VAPES', 'CONCENTRATES', 'ACCESSORIES') and it.get('img', {}).get('src', '').startswith('/assets/'):
                        src = os.path.join(ROOT, it['img']['src'].lstrip('/'))
                        dst = 'buzzy-icon-%s%s' % (slugify(t), os.path.splitext(src)[1])
                        shutil.copyfile(src, os.path.join(BRAND, dst))
                        brand_out.append({'role': 'category-icon', 'title': t, 'file': 'assets/brand/' + dst, 'from': it['img']['src'], 'w': it['img'].get('w'), 'h': it['img'].get('h')})
    stats['brand'] = brand_out
    stats['written'] = {k: len(v) for k, v in written.items()}
    stats['images'] = {'refs': len(IMG_REFS), 'local': len(set(v['path'] for v in local.values()))}
    with open(os.path.join(SCRATCH, 'stats.json'), 'w', encoding='utf-8') as o:
        json.dump(stats, o, ensure_ascii=False, indent=1, default=list)
    # asset map
    amap = {}
    for u, v in local.items():
        e = amap.setdefault(v['file'], {'file': 'assets/photos/bz/' + v['file'], 'sources': [], 'bytes': v['bytes'], 'w': v['w'], 'h': v['h'], 'type': v['ext'], 'sha1': v['sha1'], 'usedOn': set(), 'alts': set()})
        e['sources'].append(u)
        e['usedOn'] |= set(IMG_REFS.get(u, {}).get('pages', set()))
        e['alts'] |= set(IMG_REFS.get(u, {}).get('alts', set()))
        for r in recs.values():
            if r[0].get('ogImage') == u:
                e['usedOn'].add(r[0]['path'] + ' (og:image)')
    # every srcset variant URL seen in the raw pages maps to the same local file (localPhoto(url) resolves them)
    variants = {}
    for url, (rec, ctx, root, h, meta, docs) in recs.items():
        for im in find_all(root, lambda x: x.tag == 'img'):
            big, src = largest_src(im)
            allv = [src, big] + [p.strip().split()[0] for p in (im.attrs.get('srcset') or '').split(',') if p.strip()]
            for v in allv:
                if v:
                    variants.setdefault(big, set()).add(fix_href(v))
    for u, v in local.items():
        e = amap[v['file']]
        for x in sorted(variants.get(u, set())):
            if x not in e['sources']:
                e['sources'].append(x)
    rejected = [{'src': u, 'status': f.get('status'), 'magic': f.get('magic'), 'note': f.get('note', '')} for u, f in fetched.items() if not f.get('ok')]
    out = {'about': 'BUZZY content images captured from the live site (largest srcset candidate, wp-content/uploads), de-duplicated by sha1; sources = every live URL variant that maps to the file. Brand files in assets/brand/ are listed under brand.',
           'images': sorted(({**e, 'usedOn': sorted(e['usedOn']), 'alts': sorted(e['alts'])} for e in amap.values()), key=lambda e: e['file']),
           'brand': brand_out, 'rejected': rejected, 'census': census(fetched)}
    os.makedirs(os.path.join(ROOT, 'facts'), exist_ok=True)
    with open(os.path.join(ROOT, 'facts', 'asset-map.json'), 'w', encoding='utf-8', newline='\n') as o:
        json.dump(out, o, ensure_ascii=False, indent=1)
    print('written', stats['written'], 'images refs', len(IMG_REFS), 'local files', len(amap), 'rejected', len(rejected), 'css', stats['css'])


# ---------------------------------------------------------------- fetching + placing images
def magic(b):
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        return 'png'
    if b[:3] == b'\xff\xd8\xff':
        return 'jpg'
    if b[:6] in (b'GIF87a', b'GIF89a'):
        return 'gif'
    if b[:4] == b'RIFF' and b[8:12] == b'WEBP':
        return 'webp'
    if b[4:12] in (b'ftypavif', b'ftypavis'):
        return 'avif'
    head = b[:512].lstrip().lower()
    if (head.startswith(b'<?xml') or head.startswith(b'<svg')) and b'<svg' in b[:4096].lower():
        return 'svg'
    return None


def dims(path, kind):
    if kind == 'svg':
        s = open(path, encoding='utf-8', errors='replace').read(8192)
        m = re.search(r'<svg[^>]*>', s)
        tag = m.group(0) if m else ''
        w = re.search(r'\swidth="([\d.]+)', tag)
        h = re.search(r'\sheight="([\d.]+)', tag)
        if w and h:
            return int(float(w.group(1))), int(float(h.group(1)))
        vb = re.search(r'viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"', tag)
        if vb:
            return int(float(vb.group(1))), int(float(vb.group(2)))
        return None, None
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.size
    except Exception:
        return None, None


def load_fetch_log():
    p = os.path.join(DL, '_log.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}


def fetch_all(urls):
    os.makedirs(DL, exist_ok=True)
    log = load_fetch_log()
    stop = False
    n = 0
    for u in sorted(set(urls)):
        if u in log and (log[u].get('ok') or log[u].get('status') in (404, 410)):
            continue
        if stop:
            log[u] = {'ok': False, 'note': 'not fetched: the host refused an earlier request'}
            continue
        if urllib.parse.urlsplit(u).netloc not in (HOST, 'www.' + HOST) or '/wp-content/uploads/' not in u:
            log[u] = {'ok': False, 'note': 'not an upload on the same host: not fetched'}
            continue
        time.sleep(0.4)
        name = hashlib.sha1(u.encode()).hexdigest()[:16] + '.bin'
        fp = os.path.join(DL, name)
        try:
            safe = urllib.parse.quote(u, safe=':/?&=%#+,;@!$*()~-._')
            req = urllib.request.Request(safe, headers={'User-Agent': UA, 'Accept': 'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*;q=0.8'})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
                status = r.status
                ctype = r.headers.get('Content-Type', '')
        except urllib.error.HTTPError as e:
            log[u] = {'ok': False, 'status': e.code, 'note': 'HTTP error'}
            print('HTTP', e.code, u)
            if e.code in (401, 403, 429):
                print('STOP: HTTP', e.code, u)
                stop = True
            continue
        except Exception as e:
            log[u] = {'ok': False, 'status': None, 'note': 'fetch error: %s' % e}
            continue
        mk = magic(data)
        if not mk:
            log[u] = {'ok': False, 'status': status, 'magic': None, 'ctype': ctype, 'bytes': len(data), 'note': 'rejected: not PNG/JPEG/WebP/GIF/SVG/AVIF (soft-404?)'}
            continue
        open(fp, 'wb').write(data)
        w, h = dims(fp, mk)
        log[u] = {'ok': True, 'status': status, 'magic': mk, 'ext': mk, 'ctype': ctype, 'bytes': len(data),
                  'sha1': hashlib.sha1(data).hexdigest(), 'file': fp, 'w': w, 'h': h}
        n += 1
        if n % 25 == 0:
            print('fetched', n)
            with open(os.path.join(DL, '_log.json'), 'w', encoding='utf-8') as o:
                json.dump(log, o, ensure_ascii=False, indent=1)
    with open(os.path.join(DL, '_log.json'), 'w', encoding='utf-8') as o:
        json.dump(log, o, ensure_ascii=False, indent=1)
    return log


def census(log):
    c = {}
    for u, f in log.items():
        k = f.get('magic') or ('rejected-%s' % f.get('status') if f.get('status') else 'not-fetched')
        c[k] = c.get(k, 0) + 1
    return c


def place_images(log):
    os.makedirs(PHOTOS, exist_ok=True)
    by_sha, names, local = {}, {}, {}
    for u in sorted(IMG_REFS.keys()) + sorted(k for k in log if k not in IMG_REFS):
        f = log.get(u)
        if not f or not f.get('ok'):
            continue
        sha = f['sha1']
        if sha in by_sha:
            local[u] = by_sha[sha]
            continue
        base = urllib.parse.unquote(os.path.basename(urllib.parse.urlsplit(u).path)).lower()
        base = re.sub(r'[^a-z0-9._-]+', '-', base).strip('-')
        stem, ext = os.path.splitext(base)
        ext = '.' + f['ext']
        cand, n = stem + ext, 1
        while cand in names and names[cand] != sha:
            n += 1
            cand = '%s-%d%s' % (stem, n, ext)
        names[cand] = sha
        dst = os.path.join(PHOTOS, cand)
        if not os.path.exists(dst) or os.path.getsize(dst) != f['bytes']:
            shutil.copyfile(f['file'], dst)
        v = {'file': cand, 'path': '/assets/photos/bz/' + cand, 'w': f['w'], 'h': f['h'], 'bytes': f['bytes'], 'sha1': sha, 'ext': f['ext']}
        by_sha[sha] = v
        local[u] = v
    return local


def rewrite_imgs(rec, local):
    def fix(b):
        if not isinstance(b, dict):
            return
        if 'src' in b and isinstance(b.get('src'), str) and (b.get('type') == 'img' or b.get('type') is None):
            l = local.get(b.get('src'))
            if l:
                b['orig'] = b['src']
                b['src'] = l['path']
                b['w'], b['h'] = l['w'], l['h']
        for k in ('img',):
            if isinstance(b.get(k), dict):
                fix(b[k])
        for k in ('moreImgs', 'items', 'imgVariants'):
            if isinstance(b.get(k), list):
                for x in b[k]:
                    fix(x)
    for s in rec['sections']:
        for b in s['blocks']:
            fix(b)


def rewrite_html_imgs(h, local):
    def rep(m):
        src = html.unescape(m.group(1))
        l = local.get(src)
        if not l:
            return m.group(0)
        tag = m.group(0).replace(m.group(1), l['path'])
        tag = re.sub(r'\swidth="\d+"', '', tag)
        tag = re.sub(r'\sheight="\d+"', '', tag)
        return tag[:-1] + ' width="%s" height="%s">' % (l['w'], l['h'])
    return re.sub(r'<img src="([^"]+)"[^>]*>', rep, h)


if __name__ == '__main__':
    main()
