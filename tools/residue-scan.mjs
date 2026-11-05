// residue-scan.mjs - fail when a public copy carries any word from a private pattern list (revision 2: the public repo
// and the preview must not name the site whose architecture was adopted). The list lives in tmp/ (gitignored, never
// exported), so this file names nothing.
//   node tools/residue-scan.mjs --dir <copy> --patterns <json> [--allow <json>]
// patterns json: { "patterns": ["<regex source>", ...], "controls": ["<text that must match>", ...] }
// allow json:    { "allow": [{ "file": "<path relative to --dir>", "text": "<substring of the reviewed line>" }] }
// Exit 0 clean, 1 on hits, 2 on a broken setup (missing list, a control that no pattern catches, nothing scanned).
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const argOf = (n) => { const i = argv.indexOf('--' + n); return i === -1 ? null : argv[i + 1]; };
const dir = argOf('dir');
const listFile = argOf('patterns');
const allowFile = argOf('allow');
const die = (msg) => { console.error('residue-scan: ' + msg); process.exit(2); };
if (!dir || !fs.existsSync(dir)) die('--dir missing or not found: ' + dir);
if (!listFile || !fs.existsSync(listFile)) die('pattern list not found (fail closed): ' + listFile);

const list = JSON.parse(fs.readFileSync(listFile, 'utf8'));
const res = (list.patterns || []).map((p) => new RegExp(p));
if (!res.length) die('the pattern list is empty');
// positive control: every control string must be caught, or a zero below would mean nothing
const controls = list.controls || [];
if (!controls.length) die('the pattern list has no controls');
for (const c of controls) if (!res.some((r) => r.test(c))) die('control not caught by any pattern: ' + JSON.stringify(c));
const allow = allowFile && fs.existsSync(allowFile) ? JSON.parse(fs.readFileSync(allowFile, 'utf8')).allow || [] : [];

const TEXT = /\.(html?|css|js|mjs|cjs|json|md|txt|xml|svg|sh|ya?ml|csv)$/i;
const hits = [];
let files = 0;
let allowed = 0;
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    const rel = path.relative(dir, p).split(path.sep).join('/');
    // a file NAME can carry residue too
    for (const r of res) if (r.test(e.name)) hits.push({ file: rel, line: 0, match: 'file name', snippet: e.name });
    if (!TEXT.test(e.name)) continue;
    files++;
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const r of res) {
        const m = line.match(r);
        if (!m) continue;
        if (allow.some((a) => a.file === rel && line.includes(a.text))) { allowed++; break; }
        const at = Math.max(0, m.index - 50);
        hits.push({ file: rel, line: i + 1, match: m[0], snippet: line.slice(at, m.index + m[0].length + 50).trim() });
        break;
      }
    });
  }
})(dir);
if (!files) die('no text files scanned under ' + dir);
console.log(`residue-scan  ${path.resolve(dir)} | text files ${files} | patterns ${res.length} | controls ${controls.length} caught | hits ${hits.length} | allowlisted ${allowed}`);
for (const h of hits.slice(0, 40)) console.log(`  ${h.file}:${h.line}  [${h.match}]  ${h.snippet}`);
if (hits.length > 40) console.log(`  ... ${hits.length - 40} more`);
process.exit(hits.length ? 1 : 0);
