# kling-loop.py - turn a Kling image-to-video clip (first frame = last frame, 241 frames) into the home hero loop frames.
# 1) time map: calm head (src 0-23) and calm tail (src 156-239) at 2x, the birds/leaves/wind section (24-155) at 1x;
# 2) a linear brightness ramp removes the clip's slow drift (frame 240 is ~1 grey level brighter than frame 0), so the
#    loop's wrap (last output frame -> frame 0) is a normal 2x tail step, not a jump. Frame 240 itself is dropped.
import os, sys, numpy as np
# Usage: python -I tools/loop/kling-loop.py <frames dir: 001.png ...> <out dir>; then encode with ffmpeg (docs/MEDIA.md).
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    os.remove(os.path.join(out, f))
load = lambda i: np.asarray(Image.open(os.path.join(src, f'{i+1:03d}.png')).convert('RGB'), dtype=np.float32)
f0, f240 = load(0), load(240)
delta = (f240 - f0).reshape(-1, 3).mean(axis=0)
print('per-channel drift over the clip (R,G,B):', np.round(delta, 3))
seq = list(range(0, 24, 2)) + list(range(24, 156)) + list(range(156, 240, 2))
print('output frames', len(seq), '=', round(len(seq) / 24, 3), 's')
lum = lambda a: a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114
prev = first = None
steps = []
for k, i in enumerate(seq):
    o = np.clip(load(i) - delta * (i / 240.0) + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(o).save(os.path.join(out, f'{k:03d}.png'))
    l = lum(o.astype(np.float32))
    if prev is not None:
        steps.append(np.abs(l - prev).mean())
    else:
        first = l
    prev = l
# 3) fold: the last F output frames (calm 2x tail) blend toward frame 0, so the remaining texture difference at the
#    wrap (~1.1 grey levels, same size as the clip's largest single step) is spread over F+1 steps.
F = 10
N = len(seq)
o0 = np.asarray(Image.open(os.path.join(out, '000.png')), dtype=np.float32)
for j in range(1, F + 1):
    k = N - F - 1 + j
    w = j / (F + 1)
    ok = np.asarray(Image.open(os.path.join(out, f'{k:03d}.png')), dtype=np.float32)
    Image.fromarray(np.clip(ok * (1 - w) + o0 * w + 0.5, 0, 255).astype(np.uint8)).save(os.path.join(out, f'{k:03d}.png'))
L = [lum(np.asarray(Image.open(os.path.join(out, f'{k:03d}.png')), dtype=np.float32)) for k in range(N)]
steps = [np.abs(L[k + 1] - L[k]).mean() for k in range(N - 1)]
prev, first = L[-1], L[0]
wrap = np.abs(first - prev).mean()
corr240 = lum(np.clip(f240 - delta + 0.5, 0, 255).astype(np.uint8).astype(np.float32))
print(f'steps: median {np.median(steps):.3f} p95 {np.percentile(steps, 95):.3f} max {max(steps):.3f} | wrap (last -> first) {wrap:.3f} | corrected f240 vs f0 {np.abs(corr240 - first).mean():.3f}')
