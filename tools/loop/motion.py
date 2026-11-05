# motion.py - per-step motion of a frame sequence as mean absolute luma difference on a 480 px wide copy (0-255 scale).
# Treats the sequence as a closed cycle: the last value is the wrap step (last frame -> first frame).
# Usage: python -I tools/loop/motion.py <png_dir | video.mp4> [--list]
import os, sys, subprocess, tempfile
import numpy as np
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
src = sys.argv[1]
tmp = None
if os.path.isfile(src):
    tmp = tempfile.mkdtemp(prefix="motion-")
    subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", "scale=480:-2", os.path.join(tmp, "m%04d.png")], check=True)
    src = tmp
fs = sorted(f for f in os.listdir(src) if f.endswith(".png"))
small = []
for f in fs:
    im = Image.open(os.path.join(src, f)).convert("L")
    if im.width != 480:
        im = im.resize((480, round(im.height * 480 / im.width)), Image.BILINEAR)
    small.append(np.asarray(im, dtype=np.float32))
n = len(small)
d = np.array([np.abs(small[(i + 1) % n] - small[i]).mean() for i in range(n)])
inner = d[:-1]
print("frames %d; motion per frame min %.3f p50 %.3f max %.3f (argmax step %d->%d); wrap step %.3f; first-vs-last %.3f"
      % (n, inner.min(), float(np.median(inner)), inner.max(), int(inner.argmax()), int(inner.argmax()) + 1, d[-1], d[-1]))
if "--list" in sys.argv:
    print(" ".join("%.3f" % x for x in d))
if tmp:
    import shutil; shutil.rmtree(tmp, ignore_errors=True)
