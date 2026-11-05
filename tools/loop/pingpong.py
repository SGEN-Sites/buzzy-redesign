# pingpong.py - a closed loop from an OPEN clip (first frame != last frame): play the first SPAN source frames forward
# and back on a cosine time curve, t(k) = (SPAN-1)/2 * (1 - cos(2 pi k / N)), so the motion slows to a stop and turns
# round smoothly at both ends (no seam jump, no abrupt reversal). Output frame k blends the two source frames around t(k).
# Usage: python -I tools/loop/pingpong.py <src_png_dir> <out_dir> [SPAN=60] [N=120]
import os, sys, math
import numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
SPAN = int(sys.argv[3]) if len(sys.argv) > 3 else 60
N = int(sys.argv[4]) if len(sys.argv) > 4 else 120
fs = sorted(f for f in os.listdir(src) if f.endswith('.png'))[:SPAN]
os.makedirs(out, exist_ok=True)
cache = {}
def fr(i):
    if i not in cache:
        cache[i] = np.asarray(Image.open(os.path.join(src, fs[i])).convert('RGB'), np.float32)
    return cache[i]
for k in range(N):
    t = (len(fs) - 1) / 2 * (1 - math.cos(2 * math.pi * k / N))
    i = int(math.floor(t)); a = t - i
    o = fr(i) if a < 1e-6 or i + 1 >= len(fs) else fr(i) * (1 - a) + fr(i + 1) * a
    Image.fromarray(np.clip(o + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(out, 'o%04d.png' % k))
print('pingpong: %d source frames -> %d loop frames (cosine turnarounds)' % (len(fs), N))
