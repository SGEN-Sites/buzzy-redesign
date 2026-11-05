// fal-video.mjs - one fal.ai image-to-video job through the queue API, saved to a file you name, with a sidecar record.
// Node builtins only. Used for the hero haze loop when the Higgsfield account could not run video jobs.
//   node tools/fal-video.mjs --key-file <path outside the project> --model fal-ai/kling-video/v2.1/pro/image-to-video \
//        --input '{"prompt":"...","duration":"5","image_url":"https://...","tail_image_url":"https://..."}' --out tmp/img/loop/raw.mp4
// The key is never printed or written; the sidecar <out>.json keeps the model, input, request id, size, sha256, time.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
if (!args['key-file'] || path.resolve(args['key-file']).toLowerCase().startsWith(PROJ.toLowerCase())) { console.error('pass --key-file outside the project'); process.exit(2); }
const KEY = fs.readFileSync(args['key-file'], 'utf8').trim();
const model = String(args.model);
// --input-file <json> for inputs too large for a command line (a data-URI image is over 1 MB)
const input = JSON.parse(args['input-file'] ? fs.readFileSync(path.resolve(PROJ, String(args['input-file'])), 'utf8') : String(args.input));
const out = path.resolve(PROJ, String(args.out));
const H = { Authorization: 'Key ' + KEY, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();

const sub = await fetch('https://queue.fal.run/' + model, { method: 'POST', headers: H, body: JSON.stringify(input) });
const sj = await sub.json().catch(() => ({}));
if (!sub.ok || !sj.request_id) { console.error('submit failed HTTP ' + sub.status + ' ' + JSON.stringify(sj).slice(0, 300)); process.exit(1); }
console.log('submitted', model, 'request', sj.request_id);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out + '.pending.json', JSON.stringify({ model, requestId: sj.request_id, status_url: sj.status_url, response_url: sj.response_url }, null, 1));
let st = {};
for (let i = 0; i < 180; i++) {
  await sleep(i < 6 ? 5000 : 8000);
  const r = await fetch(sj.status_url, { headers: H });
  st = await r.json().catch(() => ({}));
  if (st.status === 'COMPLETED') break;
  if (st.status && !/IN_QUEUE|IN_PROGRESS/.test(st.status)) { console.error('status ' + st.status + ' ' + JSON.stringify(st).slice(0, 300)); process.exit(1); }
  if (i % 6 === 5) console.log('...', st.status, Math.round((Date.now() - t0) / 1000) + 's');
}
if (st.status !== 'COMPLETED') { console.error('timed out waiting; resume from ' + out + '.pending.json'); process.exit(1); }
const res = await (await fetch(sj.response_url, { headers: H })).json();
const url = res.video && res.video.url;
if (!url) { console.error('no video in result ' + JSON.stringify(res).slice(0, 300)); process.exit(1); }
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
fs.writeFileSync(out, buf);
fs.writeFileSync(out + '.json', JSON.stringify({ tool: 'tools/fal-video.mjs', provider: 'fal.ai', model, input, requestId: sj.request_id, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), seconds: Math.round((Date.now() - t0) / 1000), at: new Date().toISOString() }, null, 1));
fs.rmSync(out + '.pending.json', { force: true });
console.log('saved', path.relative(PROJ, out), buf.length, 'bytes in', Math.round((Date.now() - t0) / 1000) + 's');
