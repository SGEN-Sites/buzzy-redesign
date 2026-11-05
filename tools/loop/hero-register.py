# hero-register.py - fit a generated canvas onto BUZZY's art (scale and offset), so the art can be restored exactly in its
# own rectangle. A generated "extension" also redraws the middle of the picture, so it can never simply be stacked.
#   python -I tools/loop/hero-register.py <generated.png> <art.png> <start-y-fraction> <out.json>
# <start-y-fraction>: where the art's top was placed in the seed canvas sent to the model (art top / canvas height).
import json, sys
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
gen_path, art_path, frac, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
gen = Image.open(gen_path).convert('RGB')
art = Image.open(art_path).convert('RGB')
GW, GH = gen.size
AW, AH = art.size
sx = GW / AW
p = dict(sx=sx, sy=sx, tx=0.0, ty=frac * GH)   # art (u, v) -> generated (sx * u + tx, sy * v + ty)
W, H = AW // 2, AH // 2
ref = np.asarray(art.resize((W, H), Image.LANCZOS).convert('L'), dtype=np.float32)
def err(q):
    im = gen.transform((W, H), Image.AFFINE, (q['sx'] * AW / W, 0, q['tx'], 0, q['sy'] * AH / H, q['ty']), resample=Image.BILINEAR)
    return float(np.abs(np.asarray(im.convert('L'), dtype=np.float32) - ref).mean())
best = err(p)
print('start', round(best, 3))
for ds, dt in [(0.02, 24), (0.01, 12), (0.005, 6), (0.0025, 3), (0.001, 1.5), (0.0005, 0.75)]:
    improved = True
    while improved:
        improved = False
        for k, d in (('sx', ds), ('sy', ds), ('tx', dt), ('ty', dt)):
            for sign in (1, -1):
                q = dict(p)
                q[k] = p[k] + sign * d
                e = err(q)
                if e < best - 1e-4:
                    best, p, improved = e, q, True
print('fit', round(best, 3), {k: round(v, 4) for k, v in p.items()})
json.dump(p, open(out, 'w'))
