# hero-bridges.py - the home hero's video and still files, from the 4K Topaz master of the supplied bridges time-lapse.
#   python -I tools/loop/hero-bridges.py <master.mp4> <workdir> <outdir> [desktopCRF] [hdCRF] [phoneCRF]
# The loop: L = xfade(clip[HEAD..TAIL], clip[0..HEAD]), so its last frame flows into its first. The camera is locked off, so only
# clouds and water dissolve. TAIL stops before the large ferry at frames 275 to 292, which fills the lower left for half a second.
# Tags are set inside -x264-params: ffmpeg's own -color_primaries does not reach the stream, and Chrome then tints short videos.
import os, subprocess, sys

master, work, out = sys.argv[1:4]
crf = [int(x) for x in (sys.argv[4:7] + ['22', '23', '27'][len(sys.argv[4:7]):])]
HEAD, TAIL, RATE = 30, 270, 30000 / 1001
NOTE = ('Stock time-lapse of the Brooklyn and Manhattan Bridges, 1280x720 as supplied, upscaled with AI (Topaz Gaia HQ on fal.ai, '
        'a non-generative enhancement) and looped. Not footage of BUZZY. http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicallyEnhanced')
X264 = 'keyint=120:min-keyint=30:scenecut=0:colorprim=bt709:transfer=bt709:colormatrix=bt709'
os.makedirs(work, exist_ok=True)
os.makedirs(out, exist_ok=True)

def run(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True)

mezz = f'{work}/loop-4k.mp4'
if not os.path.exists(mezz):
    frames = TAIL - HEAD
    offset = (frames - HEAD) / RATE
    fade = HEAD / RATE
    graph = (f'[0:v]split=2[x][y];[x]trim=start_frame={HEAD}:end_frame={TAIL},setpts=PTS-STARTPTS[a];'
             f'[y]trim=start_frame=0:end_frame={HEAD},setpts=PTS-STARTPTS[b];'
             f'[a][b]xfade=transition=fade:duration={fade:.6f}:offset={offset:.6f},format=yuv420p[v]')
    run(['-i', master, '-filter_complex', graph, '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-x264-params', X264, '-color_range', 'tv', mezz])

def encode(name, vf, c):
    dest = f'{out}/{name}.mp4'
    run(['-i', mezz, '-vf', vf + ':flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(c), '-profile:v', 'high',
         '-x264-params', X264, '-color_range', 'tv', '-metadata', f'comment={NOTE}', '-metadata', f'description={NOTE}', '-movflags', '+faststart', dest])
    return dest

encode('hero-bridges', 'scale=1920:1080', crf[0])
encode('hero-bridges-hd', 'scale=2560:1440', crf[1])
# the phone window: a 6:5 crop that keeps the left tower, the span and the midtown skyline
encode('hero-bridges-sm', 'crop=2592:2160:115:0,scale=1008:840', crf[2])

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
for name, vf, w in (('hero-bridges', 'scale=1920:1080:flags=lanczos', 1920), ('hero-bridges-sm', 'crop=2592:2160:115:0,scale=1008:840:flags=lanczos', 1008)):
    p = f'{work}/{name}.png'
    run(['-i', png, '-vf', vf, p])
    subprocess.run(['cwebp', '-quiet', '-q', '84', '-m', '6', p, '-o', f'{out}/{name}.webp'], check=True)
    run(['-i', p, '-q:v', '3', f'{out}/{name}.jpg'])
    label(name)
for f in sorted(os.listdir(out)):
    if f.startswith('hero-bridges'):
        print(f'{f:24s} {os.path.getsize(os.path.join(out, f)) / 1048576:7.2f} MB')
