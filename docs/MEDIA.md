# Generated media

Every image in `assets/generated/` and every file in `assets/media/` is AI-generated illustrative imagery made for this
redesign pitch. It sets a mood only. None of it is a photograph or footage of BUZZY, its store, staff, customers,
products or brands, and none of it depicts a real place. Product-like objects (buds, pre-rolls, jars, bottles) are
generic and unbranded. Each still carries the IPTC `trainedAlgorithmicMedia` digital source type in its XMP metadata;
the videos carry the same note in their container tags, and the WebP and JPEG posters carry the XMP label. BUZZY's own
photographs live in `assets/photos/` and are not covered by this file.

Prompts, alt text and calm areas for every id: `src/content/image-plan.json`.

## Stills

| Id | What it depicts | Model family | Provider |
|---|---|---|---|
| `g-hero-dream` | A brownstone stoop with an open door floating in a pale morning sky among clouds (the social share image; it was the key frame of the first hero) | FLUX 1.1 pro ultra, left sky extended with FLUX.1 pro fill | fal.ai |
| `g-sky-field` | A pale dream sky of soft clouds, blue fading to peach (ground behind glass panes) | FLUX 1.1 pro ultra | fal.ai |
| `g-night-sky` | A lit doorway standing alone on still black water under a night sky | FLUX 1.1 pro ultra | fal.ai |
| `g-delivery-dream` | A riderless, unbranded cargo bicycle crossing a curved bridge above misty rooftops at dawn | FLUX 1.1 pro ultra | fal.ai |
| `g-visitor` | An open vintage suitcase spilling clouds onto a brownstone sidewalk | FLUX 1.1 pro ultra | fal.ai |
| `g-events` | A long table set on a rooftop above the clouds under string lights, no people | FLUX 1.1 pro ultra | fal.ai |
| `g-brands` | Floating glass vitrines on plinths holding abstract objects in a pale sky | FLUX 1.1 pro ultra | fal.ai |
| `g-vitrine` | A cannabis bud displayed in a glass museum vitrine floating in a pale sky | FLUX 1.1 pro ultra | fal.ai |
| `g-curation` | Cannabis buds, a glass jar and plain boxes laid out on a white grid like a museum inventory | FLUX 1.1 pro ultra | fal.ai |
| `g-guide` | An open book with blank pages, a cloud rising out of it | FLUX 1.1 pro ultra | fal.ai |
| `g-pickup` | A plain kraft paper bag floating on a cloud above brownstone steps | FLUX 1.1 pro ultra | fal.ai |
| `g-rewards` | A giant blank yellow ticket floating among clouds | FLUX 1.1 pro ultra | fal.ai |
| `g-cat-flower` | A cannabis flower bud floating above a white plinth | FLUX 1.1 pro ultra | fal.ai |
| `g-cat-prerolls` | A cone-shaped pre-roll floating above a white plinth (the `g-preroll-cut` cut-out composited over a generated empty plinth from the same series) | FLUX 1.1 pro ultra, BiRefNet v2 | fal.ai |
| `g-cat-vapes` | An unbranded vape cartridge on a plain battery floating above a white plinth | FLUX 1.1 pro ultra | fal.ai |
| `g-cat-edibles` | Three soft square gummies floating above a white plinth | FLUX 1.1 pro ultra | fal.ai |
| `g-cat-concentrates` | A small clear glass jar of golden cannabis resin floating above a white plinth | FLUX 1.1 pro ultra | fal.ai |
| `g-cat-tinctures` | A plain amber dropper bottle floating above a white plinth | FLUX 1.1 pro ultra | fal.ai |
| `g-cat-topicals` | A small plain jar of balm floating above a white plinth | FLUX 1.1 pro ultra | fal.ai |
| `g-cat-accessories` | A clear glass hand pipe floating above a white plinth | FLUX 1.1 pro ultra | fal.ai |
| `g-bud-cut` | A cannabis flower bud, transparent background | FLUX 1.1 pro ultra, BiRefNet v2 matting | fal.ai |
| `g-cloud-cut` | A soft white cloud, transparent background | FLUX 1.1 pro ultra, BiRefNet v2 matting | fal.ai |
| `g-preroll-cut` | A cone-shaped pre-roll, transparent background | FLUX 1.1 pro ultra, BiRefNet v2 matting | fal.ai |
| `g-stoop-cut` | Brownstone stoop steps with an iron railing, transparent background | FLUX 1.1 pro ultra, BiRefNet v2 matting | fal.ai |

Formats: backdrops 16:9 JPEG (2752x1536), category tiles 1:1 JPEG (2048x2048), features 4:5 JPEG (generated at 3:4 and
cropped), cut-outs transparent PNG trimmed to the subject. The build encodes WebP variants and re-attaches the label.

## Motion

| File | What it shows | Model family | Provider |
|---|---|---|---|
| `assets/media/hero-buzzy.mp4` (1920x1080) and `hero-buzzy-sm.mp4` (720x720 phone crop on the storefront) | BUZZY's own Court Street storefront illustration (the getbuzzy.com home background, used without its white fade), brought to life: a flock of birds crosses the sunset sky, wind shakes the street tree and its leaves fall, the sign lamps and shop windows flicker. The building, signs and lettering stay as drawn. A 7.75 second seamless loop, no audio | Kling 3.0 pro, image to video, with the illustration as both the first and the last frame | fal.ai |
| `assets/media/hero-buzzy.webp` / `.jpg`, `hero-buzzy-sm.webp` / `.jpg` | The still under the video: BUZZY's illustration itself (a 16:9 crop, and the 1:1 phone crop) | none, BUZZY's own artwork | getbuzzy.com |

How the loop was made: the clip starts and ends on the illustration, but its motion gathers in the middle (birds,
leaves, wind) and its brightness drifts by about one level. `tools/loop/kling-loop.py` keeps that middle at normal
speed, plays the calm opening and ending at double speed, ramps the drift out and folds the last 10 frames into the
first, so the loop wraps with no jump; the change between frames stays under 1.1 grey levels (no flashing). The
phone file is the 1:1 window on the storefront. The page shows the still first, starts the video
after load, hides it under reduced motion and gives it a pause toggle.
