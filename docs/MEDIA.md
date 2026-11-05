# Generated media

Every image in `assets/generated/` is AI-generated illustrative imagery made for this redesign pitch. It sets a mood
only. None of it is a photograph or footage of BUZZY, its store, staff, customers, products or brands, and none of it
depicts a real place. Product-like objects (buds, pre-rolls, jars, bottles) are generic and unbranded.

The files in `assets/media/` are the home hero, and they are different: a stock time-lapse of the Brooklyn and Manhattan
Bridges at night, supplied for this pitch at 1280x720 (see "The home hero" below). It is camera footage enhanced by an AI
upscaler, not AI-generated imagery, and it does not show BUZZY, its store, staff, customers, products or brands.

Each generated still carries the IPTC `trainedAlgorithmicMedia` digital source type in its XMP metadata. The hero's stills
carry `algorithmicallyEnhanced` in theirs, and its videos say the same in their container tags. BUZZY's own photographs
live in `assets/photos/` and are not covered by this file.

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

## The home hero

| File | What it is | Served to |
|---|---|---|
| `assets/media/hero-bridges.mp4` | 1920x1080, 29.97 fps, a 6 second seamless loop, no audio, 5.6 MB | Most desktop and tablet screens |
| `assets/media/hero-bridges-hd.mp4` | The same at 2560x1440, 7.7 MB | Screens wider than 1920 px, and desktop screens of 1.6x pixel density or more |
| `assets/media/hero-bridges-4k.mp4` | The same at 3840x2160, 13.9 MB | Screens wider than 2560 px, and screens 1800 px or wider at 1.6x or more |
| `assets/media/hero-bridges-sm.mp4` | 1008x840, a 6:5 crop that keeps the left tower, the span and the midtown skyline, 1.1 MB | Phones, up to 720 px wide |
| `assets/media/hero-bridges.webp` / `.jpg`, `hero-bridges-sm.webp` / `.jpg` | The loop's first frame | Shown first, and instead of the video under reduced motion |

How it was made: the 1280x720 clip was upscaled to 3840x2160 with Topaz Gaia HQ on fal.ai, a non-generative enhancement. Gaia
HQ was chosen over Proteus and Artemis HQ on a 2 second test: it stayed the most faithful to the source (SSIM 0.993 against
0.968 and 0.991, scaled back to 720p) and the steadiest on static buildings, where the others shimmer more. Over all 314
frames the master scores SSIM 0.994 against its source. An original 4K master of the same clip would still be better.

`tools/loop/hero-bridges.py` cuts the loop from that master. The sky brightens for about 5 seconds and then holds, so the clip's
two ends never match; a 3 second dissolve from the end back into the start lets the head's own brightening cancel most of the
difference. The camera is locked off, so only clouds and water dissolve. It stops before frames 275 to 292, where a large ferry
fills the lower left of the picture for half a second. Two corrections on the way: exposure flicker in the sky is evened out
with one gain per frame, and the light trails of the planes crossing the left sky are removed. Measured on the served 1080p
file, the visible sky moves within 14 grey levels and at most 10 levels a second, no frame steps it by more than 2 levels, and the
step from the last frame to the first is 2.6 against a median frame step of 2.2. The page shows the still first, starts the video after
load, hides it under reduced motion and gives it a pause toggle.
