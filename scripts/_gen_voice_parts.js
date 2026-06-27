#!/usr/bin/env node
'use strict';
// _gen_voice_parts.js — extract the voice-part override maps from src/app.js
// into a Node-requirable data module, with zero hand transcription.
//
// The browser's importTradition seeds a tradition's voice card from two maps
// declared inline in src/app.js:
//   TUNING_TO_VOICE_PARTS      — tuning id  -> { voice_part: variant, ... }
//   TRADITION_VOICE_OVERRIDES  — tradition id -> { voice_part: variant, ... }
// The Node-side deterministic seed (_seed_workspace.js) needs the SAME data.
// Rather than copy it by hand (a drift vector), we slice the exact `const X = {…};`
// blocks out of src/app.js and re-emit them. Re-run after editing those maps:
//   node scripts/_gen_voice_parts.js
//
// `--check` re-slices src/app.js and byte-diffs the result against the committed
// scripts/_voice_parts_data.js, failing if they differ — so a src/app.js voice-map
// edit that wasn't regenerated is caught in CI (wired into `npm run test:connector`).
// The recipe-parity gates do NOT reliably catch this: an override can drift without
// changing any rendered recipe, yet still desync the Node seed from the browser.

const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'src', 'app.js');
const OUT = path.join(__dirname, '_voice_parts_data.js');
const NAMES = ['TUNING_TO_VOICE_PARTS', 'TRADITION_VOICE_OVERRIDES'];

function sliceConstBlock(lines, name) {
  const start = lines.findIndex((l) => l.startsWith('const ' + name + ' = {'));
  if (start < 0) throw new Error(`could not find "const ${name} = {" in src/app.js`);
  // The map's closing brace is the first line at column 0 that is exactly "};"
  // (nested object closes are indented "  }," so they don't match).
  for (let i = start; i < lines.length; i++) {
    if (lines[i] === '};') return lines.slice(start, i + 1).join('\n');
  }
  throw new Error(`could not find closing "};" for ${name}`);
}

// Re-emit the data module from src/app.js. Deterministic: same source, same bytes.
function buildOutput() {
  const lines = fs.readFileSync(APP, 'utf8').split('\n');
  const blocks = NAMES.map((n) => sliceConstBlock(lines, n));
  return (
    '// AUTO-GENERATED from src/app.js by scripts/_gen_voice_parts.js — do not edit by hand.\n' +
    '// Regenerate: node scripts/_gen_voice_parts.js\n' +
    "'use strict';\n\n" +
    blocks.join('\n\n') +
    '\n\nmodule.exports = { ' +
    NAMES.join(', ') +
    ' };\n'
  );
}

function main() {
  const out = buildOutput();
  const rel = path.relative(path.join(__dirname, '..'), OUT);

  if (process.argv.includes('--check')) {
    // Gate: the committed mirror must equal a fresh slice of src/app.js.
    // Missing file -> exit 2 (can't compare); drift -> exit 1 (stale mirror).
    if (!fs.existsSync(OUT)) {
      console.error(`VOICE-PARTS: FAIL — ${rel} missing; run \`node scripts/_gen_voice_parts.js\``);
      process.exit(2);
    }
    if (fs.readFileSync(OUT, 'utf8') === out) {
      process.stderr.write(`VOICE-PARTS: in sync — ${rel} matches src/app.js\n`);
      process.exit(0);
    }
    console.error(`VOICE-PARTS: FAIL — ${rel} is stale vs src/app.js.`);
    console.error(
      '  A voice-map edit in src/app.js was not regenerated. Fix: node scripts/_gen_voice_parts.js'
    );
    process.exit(1);
  }

  fs.writeFileSync(OUT, out);
  // Validate it actually loads and is non-empty.
  delete require.cache[require.resolve(OUT)];
  const data = require(OUT);
  for (const n of NAMES) {
    const count = Object.keys(data[n] || {}).length;
    if (count === 0) throw new Error(`${n} extracted empty`);
    process.stderr.write(`${n}: ${count} entries\n`);
  }
  process.stderr.write(`wrote ${rel}\n`);
}

main();
