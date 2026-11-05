# hero-compose.py - the extended hero canvas: BUZZY's art restored exactly in its own rectangle, generated art around it.
# Reference scale: 1920 wide, the art and the loop occupy the 1920x1080 rectangle starting at y = T. Then hero-canvas.py
# cuts and encodes the stills from the result.
#   python -I tools/loop/hero-compose.py <generated.png> <art.png> <register.json> <canvas.png> <canvas.json> [featherTop] [featherBottom]
# The two feathers run inside the art rectangle. The loop's CSS mask (src/styles/fix.css 8) must fade out before them, so
# the video only ever sits on BUZZY's exact art.
import json, sys
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
gen_path, art_path, reg_path, out_png, out_json = sys.argv[1:6]
FT = int(sys.argv[6]) if len(sys.argv) > 6 else 70
FB = int(sys.argv[7]) if len(sys.argv) > 7 else 110
gen = Image.open(gen_path).convert('RGB')
art = Image.open(art_path).convert('RGB')
p = json.load(open(reg_path))
AW, AH = art.size
RW, AHR = 1920, 1080
f = RW / AW
T = int(p['ty'] / p['sy'] * f)
B = int((gen.height - p['ty'] - p['sy'] * AH) / p['sy'] * f)
RH = T + AHR + B
a = p['sx'] / f
e = p['sy'] / (AHR / AH)
canvas = gen.resize((RW, RH), Image.LANCZOS, box=(p['tx'], p['ty'] - e * T, p['tx'] + a * RW, p['ty'] - e * T + e * RH))
c = np.asarray(canvas, dtype=np.float32).copy()
art_r = np.asarray(art.resize((RW, AHR), Image.LANCZOS), dtype=np.float32)
m = np.ones((AHR, RW, 1), dtype=np.float32)
ramp = lambda n: (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, n))).reshape(n, 1, 1)
m[:FT] = ramp(FT)
m[-FB:] = ramp(FB)[::-1]
c[T:T + AHR] = c[T:T + AHR] * (1 - m) + art_r * m
Image.fromarray(np.clip(c + 0.5, 0, 255).astype(np.uint8)).save(out_png)
json.dump({'W': RW, 'H': RH, 'T': T, 'artH': AHR, 'B': B, 'FT': FT, 'FB': FB}, open(out_json, 'w'))
print('canvas', RW, RH, 'T', T, 'art', AHR, 'B', B, 'feather', FT, FB)
