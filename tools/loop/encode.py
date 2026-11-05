# encode.py - encode a folded loop (PNG frames) into the hero MP4s and posters.
#  - desktop: scaled to 1920 wide; phone: a 2:3 crop chosen on the motion (column window with the most frame-to-frame change) at 720x1080;
#  - H.264 yuv420p, keyint = frame count, ipratio=1:pbratio=1 (no quality pulse at the keyframe), tv range tagged in the
#    bitstream (h264_metadata) and the container, no audio, +faststart; posters = frame 0 as JPEG and WebP.
# Usage: python -I tools/loop/encode.py <folded_dir> <out_dir> <name> [fps=24]
import os, sys, subprocess
import numpy as np
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
src, out, name = sys.argv[1], sys.argv[2], sys.argv[3]
fps = sys.argv[4] if len(sys.argv) > 4 else "24"
fs = sorted(f for f in os.listdir(src) if f.endswith(".png"))
n = len(fs)
first = Image.open(os.path.join(src, fs[0])).convert("RGB")
W, H = first.size
# phone crop chosen ON THE MOTION (default, LOOP_CROP=motion): per-column sum of absolute luma differences between
# consecutive frames (every 4th pair), so the 2:3 window keeps the part of the frame that moves; LOOP_CROP=light keeps
# the older rule (column sums of light above the median).
mode = os.environ.get("LOOP_CROP", "motion")
step = max(1, n // 30)
if mode == "motion":
    col = np.zeros(W, np.float64)
    prev = None
    for f in fs[::step]:
        cur = np.asarray(Image.open(os.path.join(src, f)).convert("L"), np.float32)
        if prev is not None:
            col += np.abs(cur - prev).sum(axis=0)
        prev = cur
else:
    acc = np.zeros((H, W), np.float32)
    for f in fs[:: max(1, n // 12)]:
        acc += np.asarray(Image.open(os.path.join(src, f)).convert("L"), np.float32)
    lum = acc / len(fs[:: max(1, n // 12)])
    col = np.clip(lum - np.median(lum), 0, None).sum(axis=0)
cw = int(round(H * 2 / 3)) // 2 * 2
cs = np.concatenate([[0], np.cumsum(col)])
x = int(np.argmax(cs[cw:] - cs[:-cw]))
x = max(0, min(W - cw, x)) // 2 * 2
print("source %dx%d, %d frames; phone crop (%s) %dx%d at x=%d (%.1f%%-%.1f%% of the width)" % (W, H, n, mode, cw, H, x, 100 * x / W, 100 * (x + cw) / W))
os.makedirs(out, exist_ok=True)
x264 = "keyint=%d:min-keyint=%d:scenecut=0:ipratio=1:pbratio=1" % (n, n)  # tried 2026-11-04: crf 17 + no-dct-decimate + deadzones 6 + aq-mode 3 cut the encoded wrap step only 0.44 -> 0.34 at 2.8x the bytes
common = ["-c:v", "libx264", "-preset", "slow", "-crf", os.environ.get("LOOP_CRF", "20"), "-pix_fmt", "yuv420p", "-x264-params", x264,
          "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
          "-bsf:v", "h264_metadata=video_full_range_flag=0", "-an", "-movflags", "+faststart"]
inp = ["ffmpeg", "-y", "-v", "error", "-framerate", fps, "-i", os.path.join(src, "o%04d.png")]
desk = os.path.join(out, name + ".mp4")
phone = os.path.join(out, name + "-sm.mp4")
subprocess.run(inp + ["-vf", "scale=1920:-2:flags=lanczos,format=yuv420p"] + common + [desk], check=True)
subprocess.run(inp + ["-vf", "crop=%d:%d:%d:0,scale=720:1080:flags=lanczos,format=yuv420p" % (cw, H, x)] + common + [phone], check=True)
# posters from frame 0 (the frame the video starts on)
d = first.resize((1920, int(round(H * 1920 / W / 2)) * 2), Image.LANCZOS)
p = first.crop((x, 0, x + cw, H)).resize((720, 1080), Image.LANCZOS)
for im, base in ((d, name), (p, name + "-sm")):
    im.save(os.path.join(out, base + ".jpg"), "JPEG", quality=84, optimize=True, progressive=True)
    tmpp = os.path.join(out, base + ".poster-tmp.png")
    im.save(tmpp)
    subprocess.run(["cwebp", "-quiet", "-q", "78", "-m", "6", "-metadata", "none", tmpp, "-o", os.path.join(out, base + ".webp")], check=True)
    os.remove(tmpp)
print("desktop %dx%d, phone 720x1080" % d.size)
