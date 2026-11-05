# hero-bridges.py - the home hero's video and still files, from the 4K Topaz master of the supplied bridges time-lapse.
#   python -I tools/loop/hero-bridges.py <master.mp4> <workdir> <outdir> [desktopCRF hdCRF uhdCRF phoneCRF]
# Defaults are the shipped settings; delete <workdir>/loop-4k.mp4 to recut the loop from a new master.
#
# The loop is clip[FADE..TAIL) with its last FADE frames dissolving into clip[HEAD..HEAD+FADE), so its last frame flows into its
# first. The camera is locked off, so only clouds and water dissolve. In this clip the sky brightens for about 5 seconds and then
# holds, so the two ends of any long window differ by some 40 grey levels: a 1 s dissolve shows as a reset every cycle. Over 3 s the
# head's own brightening cancels most of it (net 6.7 levels, 13.9 per second at most, against a natural drift of up to 36).
# TAIL stops before the large ferry at frames 275 to 292, which fills the lower left for half a second.
# Two corrections on the way: exposure flicker in the sky (one gain per frame, sky only), and the light trails of the planes that
# cross the left sky on one flight path for about 10 frames each. Only the thin bright line is subtracted (what is brighter than the
# same place either side of it in time, after removing anything broad), so the clouds keep moving underneath. Frames 4 to 13 carry
# one more, but they sit under 5% opacity at the very start of the dissolve.
# Colour tags are set inside -x264-params: ffmpeg's own -color_primaries does not reach the stream, and Chrome then tints short videos.
import os, subprocess, sys
import numpy as np
from scipy import ndimage

master, work, out = sys.argv[1:4]
crf = [int(x) for x in sys.argv[4:8]] + [20, 21, 22, 26][len(sys.argv[4:8]):]
HEAD, TAIL, FADE = 0, 272, 90
W, H = 3840, 2160
RATE = '30000/1001'
TRAILS = ((60, 70), (94, 106), (157, 169), (213, 224), (263, 270))  # first and last frame of each plane, measured on the master
PATH = (0, 960, 1640, 1480)  # their flight path: left, top, right, bottom
NOTE = ('Stock time-lapse of the Brooklyn and Manhattan Bridges, 1280x720 as supplied, upscaled with AI (Topaz Gaia HQ on fal.ai, '
        'a non-generative enhancement) and looped. Not footage of BUZZY. http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicallyEnhanced')
X264 = 'keyint=120:min-keyint=30:scenecut=0:colorprim=bt709:transfer=bt709:colormatrix=bt709'
os.makedirs(work, exist_ok=True)
os.makedirs(out, exist_ok=True)
FRAME = W * H * 3 // 2

def run(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True)

def reader(start, count):
    vf = f'trim=start_frame={start}:end_frame={start + count},setpts=PTS-STARTPTS,format=yuv420p'
    return subprocess.Popen(['ffmpeg', '-v', 'error', '-i', master, '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-'], stdout=subprocess.PIPE, bufsize=FRAME * 2)

def planes(buf):
    y = np.frombuffer(buf, np.uint8, W * H).reshape(H, W).astype(np.float32)
    u = np.frombuffer(buf, np.uint8, W * H // 4, W * H).reshape(H // 2, W // 2).astype(np.float32)
    v = np.frombuffer(buf, np.uint8, W * H // 4, W * H + W * H // 4).reshape(H // 2, W // 2).astype(np.float32)
    return y, u, v

def read_frames(start, count):
    p = reader(start, count)
    for _ in range(count):
        b = p.stdout.read(FRAME)
        if len(b) < FRAME:
            raise SystemExit('short read from the master')
        yield planes(b)
    p.stdout.close()
    p.wait()

mezz = f'{work}/loop-4k.mp4'
if not os.path.exists(mezz):
    # ---- one gain per frame for the sky's flicker, measured left of the bridge's rise
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', master, '-vf', 'scale=640:360:flags=area,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    low = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 360, 640).astype(np.float32)
    S = low[:, :int(360 * .45), :int(640 * .55)].mean(axis=(1, 2))
    target = ndimage.gaussian_filter1d(ndimage.median_filter(S, size=9, mode='nearest'), 5, mode='nearest')
    gains = np.clip(target / S, .94, 1.06)
    ramp = np.clip((.60 - np.arange(H) / H) / .18, 0, 1).reshape(H, 1).astype(np.float32)  # all of the sky, none of the skyline

    (l, t, r, b) = PATH
    refs = {}
    for first, last in TRAILS:
        refs[(first, last)] = (next(read_frames(first - 1, 1))[0][t:b, l:r], next(read_frames(last + 1, 1))[0][t:b, l:r])
    def fix(n, y, u, v):
        y = 16 + (y - 16) * (1 + ramp * (gains[n] - 1))
        for (first, last), (before, after) in refs.items():
            if first <= n <= last:
                w = (n - first + 1) / (last - first + 2)
                ref = before * (1 - w) + after * w
                y = y.copy()
                for _ in range(3):                                 # a thick bright line needs more than one pass
                    d = y[t:b, l:r] - ref
                    thin = d - ndimage.gaussian_filter(d, 16)      # a line stands out; a cloud edge does not
                    m = np.clip((thin - 5) / 8, 0, 1)
                    m = np.clip(ndimage.gaussian_filter(ndimage.maximum_filter(m, 9), 4) * 1.8, 0, 1)
                    y[t:b, l:r] = y[t:b, l:r] - m * np.maximum(thin, 0)
                    if _ == 0:
                        first_mask = m
                mc = first_mask[::2, ::2]                          # the trail's colour goes with its brightness
                for plane in (u, v):
                    region = plane[t // 2:b // 2, l // 2:r // 2]
                    plane[t // 2:b // 2, l // 2:r // 2] = region * (1 - mc) + ndimage.gaussian_filter(region, 8) * mc
        return y, u, v

    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', f'{W}x{H}', '-r', RATE, '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '12',
                            '-x264-params', X264, '-color_range', 'tv', mezz], stdin=subprocess.PIPE)
    def write(y, u, v):
        for p in (y, u, v):
            enc.stdin.write(np.clip(p + .5, 0, 255).astype(np.uint8).tobytes())
    # the body
    count = 0
    for i, (y, u, v) in enumerate(read_frames(HEAD + FADE, TAIL - FADE - HEAD - FADE)):
        write(*fix(HEAD + FADE + i, y, u.copy(), v.copy()))
        count += 1
    # the dissolve, eased at both ends
    tail, head = read_frames(TAIL - FADE, FADE), read_frames(HEAD, FADE)
    for k, (a, c) in enumerate(zip(tail, head)):
        y0, u0, v0 = fix(TAIL - FADE + k, a[0], a[1].copy(), a[2].copy())
        y1, u1, v1 = fix(HEAD + k, c[0], c[1].copy(), c[2].copy())
        s = float((1 - np.cos(np.pi * (k + .5) / FADE)) / 2)
        write(y0 * (1 - s) + y1 * s, u0 * (1 - s) + u1 * s, v0 * (1 - s) + v1 * s)
        count += 1
    enc.stdin.close()
    enc.wait()
    print('loop frames', count, 'gain range', round(float(gains[HEAD:TAIL].min()), 4), round(float(gains[HEAD:TAIL].max()), 4))

def encode(name, vf, c):
    dest = f'{out}/{name}.mp4'
    run(['-i', mezz, '-vf', vf + ':flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(c), '-profile:v', 'high',
         '-x264-params', X264, '-color_range', 'tv', '-metadata', f'comment={NOTE}', '-metadata', f'description={NOTE}', '-movflags', '+faststart', dest])
    return dest

encode('hero-bridges', 'scale=1920:1080', crf[0])
encode('hero-bridges-hd', 'scale=2560:1440', crf[1])
encode('hero-bridges-4k', 'scale=3840:2160', crf[2])
# the phone window: a 6:5 crop that keeps the left tower, the span and the midtown skyline
encode('hero-bridges-sm', 'crop=2592:2160:115:0,scale=1008:840', crf[3])

# camera footage enhanced by AI: IPTC algorithmicallyEnhanced, never trainedAlgorithmicMedia
EMBED = ("import fs from 'node:fs'; import { jpegEmbed } from './tools/ai-label.mjs'; "
         "const [f] = process.argv.slice(1); fs.writeFileSync(f, jpegEmbed(fs.readFileSync(f), fs.readFileSync('tools/ai-enhanced.xmp', 'utf8').trim()));")
def label(name):
    tmp = f'{out}/{name}.webp'
    subprocess.run(['webpmux', '-set', 'xmp', 'tools/ai-enhanced.xmp', tmp, '-o', tmp], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['node', '--input-type=module', '-e', EMBED, f'{out}/{name}.jpg'], check=True)

# the stills under the video are its first frame
png = f'{work}/first.png'
run(['-i', mezz, '-frames:v', '1', png])
for name, vf in (('hero-bridges', 'scale=1920:1080:flags=lanczos'), ('hero-bridges-sm', 'crop=2592:2160:115:0,scale=1008:840:flags=lanczos')):
    p = f'{work}/{name}.png'
    run(['-i', png, '-vf', vf, p])
    subprocess.run(['cwebp', '-quiet', '-q', '84', '-m', '6', p, '-o', f'{out}/{name}.webp'], check=True, stderr=subprocess.DEVNULL)
    run(['-i', p, '-q:v', '3', f'{out}/{name}.jpg'])
    label(name)
for f in sorted(os.listdir(out)):
    if f.startswith('hero-bridges'):
        print(f'{f:24s} {os.path.getsize(os.path.join(out, f)) / 1048576:7.2f} MB')
