# BUZZY design system: Dream Inventory

Glassmorphism, utilitarian detail and a touch of surrealism, kept clean and modern. BUZZY's curation is shown as a
dream inventory: a precise, label maker catalogue floating in a calm Brooklyn dreamscape, seen through frosted vitrines.

## Brand base

- Colours come from `src/styles/tokens.css` only: BUZZY black and white, the BUZZY greys, the fog and paper grounds,
  the dream sky gradient, and the yellow of BUZZY's 21+ legal bar as the one signal colour.
- Type: Geist for headings and body (headings uppercase, tight), Geist Mono for labels, tags, numerals and spec
  tables, Instrument Serif italic for one lowercase accent word in a heading at most (`<em class="accent">`).
- The boxed BUZZY wordmark sets the line weight: 2px black outlines on buttons, tiles, frames and inputs.

## Three planes

1. Back plane: grounds. Paper, fog, sky (gradient plus the generated sky images) and night (black, for the rewards
   band, one feature band and the footer). A fine grid (`.band--grid`) on some bands; never a busy pattern under text.
2. Mid plane: glass. `.glass` panes (frosted fill, blur, a sheen along the top left, a soft shadow), `.glass--strong`
   for long text, `.glass--dark` on night bands. Glass only sits over something varied (sky, photos, the loop).
   The header frosts on a pseudo element so the dropdown panels can blur too. On phones the big panes turn opaque;
   live blur stays on the header, the drawer and dialogs.
3. Front plane: floating objects. Cut outs (`.cut`) and framed photos (`.frame`) cross section seams
   (`.protrude`), levitate slowly (`data-float`) and move at their own scroll speed (`data-depth`). At most one or
   two per screen.

## Utilitarian details

- Square buttons (`.btn`, `.btn--signal`, `.btn--ghost`, `.btn--glass`, `.btn--light`); on hover a button inverts
  and gains a yellow offset label shadow.
- Kickers (`.kicker`) in mono caps with a small filled square before them. Never a dash, anywhere.
- Label maker tags (`.tag`, `.tag--signal`, `.tag--ink`) with a punched hole; chips (`.chip`) for neighborhoods and
  filters.
- Spec tables (`.spec`) with a mono key, a dotted leader and the value, for hours and service facts.
- Numbered steps (`.steps`, `.step__num` in mono).
- Frames (`.frame`) with registration crosses at two corners.
- The yellow ticker (`.ticker` with `data-marquee`) for BUZZY's own short lines.
- Breadcrumbs separated by "/".

## The chrome

- Top link bar (black): the Delivery and Pickup pills with their fact lines and a Shop link, BUZZY's announcement line
  in mono caps, quick links.
- Main bar (frosted): the BUZZY logo, the navigation with dropdown panels holding image cards (product categories,
  the store, the guide, a delivery map card, a delivery facts card), and Shop Now. Hover opens with a short intent
  delay and closes after a pause; a bridge covers the gap; click, arrow down and Escape work from the keyboard.
  Below 1024px a drawer holds every item.
- Prefooter on every page: the delivery areas band (neighborhood chips and zip codes) and the rewards sign up band.
- Footer (night with the grid): logo, hours, Instagram, the shop and quick link columns, contact, location with
  directions, the giant HIGHLY CURATED wordmark with a light band sweeping across it at a constant speed (paused off
  screen, still when motion is reduced), the yellow legal bar with the disclaimer and licence, copyright and legal
  links.
- A 21+ gate in BUZZY's own words: a glass dialog over a blurred sky. It never blocks the page without JavaScript.

## Motion

Scroll reveals fade up with a slight un blur (`data-reveal`, staggered with `--i`), a print style wipe
(`data-reveal="wipe"`), depth parallax, floating cut outs, pointer tilt (`data-tilt`), a soft light that follows the
cursor on glass (`data-spot`), marquees, rotators with real buttons, tabs, filter chips and a visible pause control on
every looping video. Everything stops under reduced motion, and a reveal always ends fully visible.

## Accessibility

One H1 per page, landmarks, real links and buttons, a yellow and black focus ring, 44px tap targets on phones, no
text under 13px, alt text on content images, nothing essential behind hover.
