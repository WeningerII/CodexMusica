// Website tokenizer parity for the acceptance receipt: run the Lyrics page's own
// `lyTokens` (src/pages/lyrics.js at the measured tree) over every line of a
// record.py recording and list the lines where it cuts differently from the
// harness's `line_tokens` at the same head. Read-only.
//
//   node quality/results/acceptance_2026-10-13/js_parity.mjs RECORDING.jsonl.gz REPO_ROOT OUT.json
//
// REPO_ROOT is the tree whose src/pages/lyrics.js is measured (the same head
// as the recording). The function and the `LY_*` constants it names are taken
// from the file's text and run in a fresh context; if the page no longer
// defines `lyTokens` that way, this says CANNOT TELL instead of guessing.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { gunzipSync } from 'node:zlib';

const [recording, repoRoot, out] = process.argv.slice(2);
const srcPath = join(repoRoot, 'src', 'pages', 'lyrics.js');
const src = readFileSync(srcPath, 'utf8');

function extractFunction(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) return null;
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  return null;
}

const fn = extractFunction('lyTokens');
if (!fn) {
  console.log(`CANNOT TELL: ${srcPath} defines no function lyTokens`);
  process.exit(2);
}
const consts = [...new Set(fn.match(/\bLY_[A-Z_]+\b/g) || [])].map((n) => {
  const m = src.match(new RegExp(`^const ${n} = .*;$`, 'm'));
  if (!m) {
    console.log(`CANNOT TELL: constant ${n} used by lyTokens is not a one-line const`);
    process.exit(2);
  }
  return m[0];
});
const ctx = createContext({});
runInContext(`${consts.join('\n')}\n${fn}\nthis.lyTokens = lyTokens;`, ctx);

const rows = gunzipSync(readFileSync(recording))
  .toString('utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const header = rows.shift();
const ids = [];
const examples = [];
let lines = 0;
for (const r of rows) {
  if (r.fixture || r.error || !Array.isArray(r.tokens)) continue;
  lines++;
  const js = ctx.lyTokens(r.text, false);
  if (JSON.stringify(js) !== JSON.stringify(r.tokens)) {
    ids.push(r.id);
    if (examples.length < 25) examples.push({ id: r.id, text: r.text, harness: r.tokens, js });
  }
}
const rec = {
  recording_commit: header.commit,
  source: 'src/pages/lyrics.js',
  source_sha256: createHash('sha256').update(src).digest('hex'),
  lines,
  mismatches: ids.length,
  ids,
  examples,
};
writeFileSync(out, `${JSON.stringify(rec, null, 1)}\n`);
console.log(JSON.stringify({ recording_commit: header.commit.slice(0, 9), lines, mismatches: ids.length }));
