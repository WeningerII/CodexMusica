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
// The connector-parity gate diffs the regenerated output, so drift fails CI.

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

function main() {
  const lines = fs.readFileSync(APP, 'utf8').split('\n');
  const blocks = NAMES.map((n) => sliceConstBlock(lines, n));
  const out =
    '// AUTO-GENERATED from src/app.js by scripts/_gen_voice_parts.js — do not edit by hand.\n' +
    '// Regenerate: node scripts/_gen_voice_parts.js\n' +
    "'use strict';\n\n" +
    blocks.join('\n\n') +
    '\n\nmodule.exports = { ' + NAMES.join(', ') + ' };\n';
  fs.writeFileSync(OUT, out);
  // Validate it actually loads and is non-empty.
  delete require.cache[require.resolve(OUT)];
  const data = require(OUT);
  for (const n of NAMES) {
    const count = Object.keys(data[n] || {}).length;
    if (count === 0) throw new Error(`${n} extracted empty`);
    process.stderr.write(`${n}: ${count} entries\n`);
  }
  process.stderr.write(`wrote ${path.relative(path.join(__dirname, '..'), OUT)}\n`);
}

main();
