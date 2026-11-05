# BUZZY: redesign pitch

A redesign proposal for [getbuzzy.com](https://getbuzzy.com), BUZZY's licensed cannabis dispensary on Court Street in
Cobble Hill, Brooklyn. This is a working static preview made for a pitch. It is not BUZZY's official site, and its forms
send nothing.

**Preview:** https://sgen-sites.github.io/buzzy-redesign/ (noindex)

## What it is

- **BUZZY's own content.** Every page of the live site is rebuilt at its own URL with its own words: the home page,
  delivery and the 11 Brooklyn neighborhood pages, rewards, brands, the menu, visit, about, FAQs, careers, events and
  the Buzzy Guide articles.
- **A new structure.** A top bar that puts Delivery and Pickup first, a seven-part main menu with image-rich dropdowns,
  shop-by-category pages, a deals page, an in-store pickup page, an education hub and a sitemap. New pages are built
  from BUZZY's own words, quoted with links to where BUZZY wrote them.
- **A new design: "Dream Inventory".** Glassmorphism, utilitarian and surreal, kept clean and modern on BUZZY's black
  and white brand with the yellow of its legal bar. Frosted glass vitrines float over a calm Brooklyn dreamscape;
  label-maker tags, spec tables and numbered steps carry the facts; surreal objects break out of their frames and cross
  section edges. Scroll reveals, parallax depth and hover effects throughout, all off for visitors who prefer reduced
  motion. See [docs/DESIGN.md](docs/DESIGN.md).
- **Imagery.** BUZZY's own photography and brand banners, plus AI-generated illustrative stills and a hero loop, each
  labelled as AI-generated in its metadata and listed in [docs/MEDIA.md](docs/MEDIA.md). None of them shows BUZZY's
  store, staff, customers, products or brands.

## Build

Node 18 or newer and `cwebp` on the PATH. No dependencies.

```bash
node src/build.mjs            # writes dist/
node tools/serve.mjs --root dist --port 8080 --not-found 404.html
```

Content lives in `src/content/` (JSON), templates in `src/theme/`, styles in `src/styles/`, the one script in
`src/scripts/site.js`.

## Notes

- Fonts: Geist, Geist Mono and Instrument Serif (SIL Open Font License) stand in for BUZZY's licensed brand fonts.
- The live menu, the delivery zone map and the rewards sign up are BUZZY's own live services, embedded with fallback
  links.
