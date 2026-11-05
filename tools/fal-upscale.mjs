// fal-upscale.mjs - upscale a supplied video with fal's Topaz video upscaler (fal-ai/topaz/upscale/video). Node builtins.
//
//   node tools/fal-upscale.mjs --in <video> --out <file.mp4> --key-file <path outside the project> [--factor 1.5]
//        [--model Proteus] [--dry]
//
// The key is read from a file outside the project tree, never from or into it. The input is uploaded to fal storage
// (initiate + PUT), the job runs through the queue API, the result is downloaded to --out, and a sidecar <out>.json
// records the model, factor, request id, sizes and the list price (fal, 2026-10-24: $0.01 per second up to 720p output,
// $0.02 from 720p to 1080p, $0.08 above 1080p; UNVERIFIED against the invoice).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2);
  args[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
}
if (!args.in || !args.out || !args['key-file']) { console.error('need --in, --out and --key-file'); process.exit(2); }
if (path.resolve(args['key-file']).toLowerCase().startsWith(PROJ.toLowerCase())) { console.error('refusing a key file inside the project tree'); process.exit(2); }
const KEY = fs.readFileSync(args['key-file'], 'utf8').trim();
const MODEL = 'fal-ai/topaz/upscale/video';
const inp = path.resolve(PROJ, String(args.in)), out = path.resolve(PROJ, String(args.out));
const factor = Number(args.factor || 1.5), topaz = String(args.model || 'Proteus');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const probe = (f) => JSON.parse(spawnSync(process.env.FFPROBE || 'ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames,codec_name:format=duration,size', '-of', 'json', f], { encoding: 'utf8' }).stdout);

const src = probe(inp);
const s0 = src.streams[0], dur = Number(src.format.duration);
const outH = Math.round(s0.height * factor);
const rate = outH <= 720 ? 0.01 : outH <= 1080 ? 0.02 : 0.08;
const estUSD = +(rate * Math.ceil(dur)).toFixed(2);
console.log(`in ${s0.width}x${s0.height} ${dur.toFixed(2)}s -> x${factor} = ${Math.round(s0.width * factor)}x${outH}, ${topaz}, list price about $${estUSD}`);
if (args.dry) process.exit(0);

async function upload(file) {
  const init = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', {
    method: 'POST', headers: { Authorization: 'Key ' + KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_type: 'video/mp4', file_name: path.basename(file) }),
  });
  if (!init.ok) throw new Error('upload initiate HTTP ' + init.status + ' ' + (await init.text()).slice(0, 300));
  const { upload_url, file_url } = await init.json();
  const put = await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: fs.readFileSync(file) });
  if (!put.ok) throw new Error('upload PUT HTTP ' + put.status + ' ' + (await put.text()).slice(0, 300));
  return file_url;
}

const videoUrl = await upload(inp);
console.log('uploaded', (fs.statSync(inp).size / 1048576).toFixed(1) + ' MB');
const input = { video_url: videoUrl, model: topaz, upscale_factor: factor, H264_output: true };
const sub = await fetch('https://queue.fal.run/' + MODEL, { method: 'POST', headers: { Authorization: 'Key ' + KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
if (!sub.ok) throw new Error('submit HTTP ' + sub.status + ' ' + (await sub.text()).slice(0, 300));
const s = await sub.json();
console.log('queued', s.request_id);
const t0 = Date.now();
for (;;) {
  await sleep(5000);
  const st = await fetch(s.status_url, { headers: { Authorization: 'Key ' + KEY } });
  const sj = await st.json().catch(() => ({}));
  if (sj.status === 'COMPLETED') break;
  if (sj.status === 'FAILED' || sj.error) throw new Error('failed: ' + JSON.stringify(sj).slice(0, 400));
  if (Date.now() - t0 > 1500000) throw new Error('timed out after 25 min (request ' + s.request_id + ')');
}
const r = await fetch(s.response_url, { headers: { Authorization: 'Key ' + KEY } });
if (!r.ok) throw new Error('result HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
const res = await r.json();
if (!res.video || !res.video.url) throw new Error('no video in result: ' + JSON.stringify(res).slice(0, 300));
const dl = await fetch(res.video.url);
if (!dl.ok) throw new Error('download HTTP ' + dl.status);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(await dl.arrayBuffer()));
const o = probe(out);
const rec = {
  tool: 'tools/fal-upscale.mjs', model: MODEL, topazModel: topaz, upscaleFactor: factor, requestId: s.request_id,
  input: { file: path.relative(PROJ, inp).split(path.sep).join('/'), ...o && { width: s0.width, height: s0.height, frames: Number(s0.nb_frames), duration: dur } },
  output: { file: path.relative(PROJ, out).split(path.sep).join('/'), width: o.streams[0].width, height: o.streams[0].height, frames: Number(o.streams[0].nb_frames), duration: Number(o.format.duration), bytes: Number(o.format.size), codec: o.streams[0].codec_name },
  listPriceUSD: estUSD, minutes: +((Date.now() - t0) / 60000).toFixed(1), at: new Date().toISOString(),
  note: 'AI upscaling of camera footage: IPTC digital source type algorithmicallyEnhanced (the content is the supplied clip; the model adds resolution, not subject matter).',
};
fs.writeFileSync(out + '.json', JSON.stringify(rec, null, 2) + '\n');
console.log('done', JSON.stringify(rec.output), 'in', rec.minutes, 'min');
