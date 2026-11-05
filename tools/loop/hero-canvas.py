# hero-canvas.py - cut the home hero's still files from the extended canvas (reference scale: 1920 wide, BUZZY's art and
# the loop occupy the 1920x1080 rectangle starting at y = T) and encode them. Usage, from the project root:
#   python -I tools/loop/hero-canvas.py <canvas.png> <canvas.json>
# Every still carries the AI label because everything outside the art rectangle is generated (docs/MEDIA.md).
import json, os, subprocess, sys
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
canvas = Image.open(sys.argv[1]).convert('RGB')
meta = json.load(open(sys.argv[2]))
T, AH = meta['T'], meta['artH']
OUT = 'assets/media'
TMP = 'tmp/hf3/enc'
os.makedirs(TMP, exist_ok=True)
# name: (left, top, right, bottom in reference px, output width, webp quality)
VARIANTS = json.loads(os.environ.get('HERO_VARIANTS', 'null')) or {
    'hero-buzzy': [0, 0, 1920, canvas.height, 1920, 80],
    'hero-buzzy-sm': [60, 0, 1400, canvas.height, 800, 78],
}
out = {}
for name, (l, t, r, b, w, q) in VARIANTS.items():
    h = round((b - t) * w / (r - l))
    im = canvas.crop((l, t, r, b)).resize((w, h), Image.LANCZOS)
    png = f'{TMP}/{name}.png'
    im.save(png)
    tmp = f'{TMP}/{name}.webp'
    subprocess.run(['cwebp', '-quiet', '-q', str(q), '-m', '6', png, '-o', tmp], check=True)
    subprocess.run(['webpmux', '-set', 'xmp', 'tools/ai-label.xmp', tmp, '-o', f'{OUT}/{name}.webp'], check=True)
    im.save(f'{OUT}/{name}.jpg', quality=82, optimize=True, progressive=True)
    subprocess.run(['node', 'tools/ai-label.mjs', 'embed', f'{OUT}/{name}.jpg'], check=True, stdout=subprocess.DEVNULL)
    out[name] = {'w': w, 'h': h, 'top_px': T - t, 'webp_kb': round(os.path.getsize(f'{OUT}/{name}.webp') / 1024), 'jpg_kb': round(os.path.getsize(f'{OUT}/{name}.jpg') / 1024)}
print(json.dumps(out, indent=1))
