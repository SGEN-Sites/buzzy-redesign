# fold.py - fold a retimed closed cycle of N frames into N-K frames with a K-frame crossfade, so the loop wraps with the
# same per-frame motion as everywhere else: out[i] = (1-a) * r[N-K+i] + a * r[i] for i < K (a = (i+0.5)/K), else r[i].
# Usage: python -X utf8 fold.py <retimed_dir> <out_dir> [K=12]
import os, sys
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
K = int(sys.argv[3]) if len(sys.argv) > 3 else 12
fs = sorted(f for f in os.listdir(src) if f.endswith('.png'))
N = len(fs)
M = N - K
os.makedirs(out, exist_ok=True)
load = lambda i: np.asarray(Image.open(os.path.join(src, fs[i])).convert('RGB'), dtype=np.float32)
for i in range(M):
    if i < K:
        a = (i + 0.5) / K
        fr = (1 - a) * load(M + i) + a * load(i)
    else:
        fr = load(i)
    Image.fromarray(np.clip(fr + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(out, 'o%04d.png' % i))
# motion check over the folded cycle, the wrap included
small = [np.asarray(Image.open(os.path.join(out, 'o%04d.png' % i)).convert('L').resize((480, 268)), dtype=np.float32) for i in range(M)]
d = [np.abs(small[(i + 1) % M] - small[i]).mean() for i in range(M)]
print('folded %d -> %d frames; motion per frame min %.3f p50 %.3f max %.3f; wrap step %.3f' % (N, M, min(d), float(np.median(d)), max(d), d[-1]))
