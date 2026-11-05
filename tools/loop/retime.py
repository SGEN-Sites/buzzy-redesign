# retime.py - make the hero loop move at one constant speed all the way round, including across the loop point.
# Kling's first-frame = last-frame clip eases out to a near standstill at the end and eases back in at the start,
# so the loop visibly stops and restarts. Treat the 120 frames as a CLOSED cycle (frame 119 -> frame 0 is the seam
# step), measure motion between neighbours as mean absolute luma difference, and resample N output frames at equal
# steps of accumulated motion. Each output frame is a linear blend of the two source frames around its position.
# Usage: python -X utf8 tmp/hero3/retime.py <src_dir> <out_dir> [N=120]
import sys, os
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 120
files = sorted(f for f in os.listdir(src) if f.endswith('.png'))
M = len(files)
os.makedirs(out, exist_ok=True)

def load(i):
    return np.asarray(Image.open(os.path.join(src, files[i % M])).convert('RGB'), dtype=np.float32)

def luma(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114

# motion per step on a 1/4-size luma copy (fast and stable)
small = []
for i in range(M):
    im = Image.open(os.path.join(src, files[i])).convert('L').resize((480, 270), Image.BILINEAR)
    small.append(np.asarray(im, dtype=np.float32))
d = np.array([np.abs(small[(i + 1) % M] - small[i]).mean() for i in range(M)])  # d[M-1] = seam step 119 -> 0
cum = np.concatenate([[0.0], np.cumsum(d)])  # cum[i] = motion from frame 0 to frame i; cum[M] = full cycle
S = cum[-1]
print(f'source steps: mean {d.mean():.3f} min {d.min():.3f} max {d.max():.3f} seam {d[-1]:.3f} cycle {S:.2f}')

cache = {}
def frame(i):
    i %= M
    if i not in cache:
        if len(cache) > 6:
            cache.pop(next(iter(cache)))
        cache[i] = load(i)
    return cache[i]

for k in range(N):
    s = k * S / N
    i = int(np.searchsorted(cum, s, side='right') - 1)
    i = min(max(i, 0), M - 1)
    t = 0.0 if d[i] == 0 else (s - cum[i]) / d[i]
    a, b = frame(i), frame(i + 1)
    o = a * (1 - t) + b * t
    Image.fromarray(np.clip(o + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(out, f'{k:03d}.png'))
print('wrote', N, 'frames, constant step', round(S / N, 3))
