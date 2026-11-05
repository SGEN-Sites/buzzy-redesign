"""subset-fonts.py - cut the web fonts down to the characters the built site uses (adapted from an earlier pitch tool).

fonts-src/ holds the full Latin files (Google Fonts subsets, OFL, no Reserved Font Name); assets/fonts/ gets the cut
files under the same names, so tokens.css does not change. Every variation axis and every OpenType feature is kept,
so text that renders in the cut font has the same glyphs, advances and kerning as before. A character missing from
the cut falls back to the next font in the stack for that character only: run this again after content changes.

  python tools/subset-fonts.py [built site dir, default dist]

Kept: every character found in the built HTML, CSS, JS and JSON (entities decoded), printable ASCII, and both cases of
each letter. Montserrat (normal) also keeps Latin-1 and common punctuation, because it is the font of the form fields people type in.
"""
import html
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else 'dist')
SRC = os.path.join(ROOT, 'fonts-src')
OUT = os.path.join(ROOT, 'assets', 'fonts')
TYPED = set(range(0xA0, 0x100)) | set(range(0x2018, 0x201F)) | {0x2026, 0x2039, 0x203A, 0x20AC, 0x2122, 0x2212}
FONTS = {'bricolage-grotesque.woff2': set(), 'caveat.woff2': set(), 'montserrat-normal.woff2': TYPED, 'montserrat-italic.woff2': set()}

if not os.path.isfile(os.path.join(SITE, 'index.html')):
    sys.exit('no built site at ' + SITE + ' (build first)')
chars = set(chr(c) for c in range(0x20, 0x7F))
for d, _, files in os.walk(SITE):
    for f in files:
        if f.endswith(('.html', '.css', '.js', '.json')):
            with open(os.path.join(d, f), encoding='utf-8', errors='ignore') as fh:
                chars |= set(html.unescape(fh.read()))
chars |= {u for c in list(chars) for u in c.upper() + c.lower()}
used = {ord(c) for c in chars if ord(c) >= 0x20}

for name, extra in FONTS.items():
    src = os.path.join(SRC, name)
    cmap = TTFont(src).getBestCmap()
    keep = sorted((used | extra) & set(cmap))
    opts = subset.Options()
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.flavor = 'woff2'
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=keep)
    sub.subset(font)
    dst = os.path.join(OUT, name)
    subset.save_font(font, dst, opts)
    print('%-26s %4d of %4d characters  %7d -> %7d bytes' % (name, len(keep), len(cmap), os.path.getsize(src), os.path.getsize(dst)))
