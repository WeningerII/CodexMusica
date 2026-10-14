// Evaluate lyMapOffset exactly as committed in a tree's src/pages/lyrics.js
// (function text extracted from the file, not a copy) on the c5 rewrite.
'use strict';
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] + '/src/pages/lyrics.js', 'utf8');
const a = src.indexOf('function lyMapOffset(');
const b = src.indexOf('\n}\n', a) + 2;
const lyMapOffset = new Function(src.slice(a, b) + '\nreturn lyMapOffset;')();
const BODY = '\n\n[VERSE]\nOh--oh, oh my love\nI walk the line tonight';
const before = '[SETUP — returns — 1.end, 2.end]' + BODY;
const after = '[SETUP — returns — 1.end (carried across the word-cut change), 2.end — cut v2]' + BODY;
const x = before.split('\n')[0], y = after.split('\n')[0];
let p = 0; while (p < x.length && x[p] === y[p]) p++;
let s = 0; while (s < x.length - p && s < y.length - p && x[x.length - 1 - s] === y[y.length - 1 - s]) s++;
console.log('row lengths', x.length, y.length, 'common prefix', p, JSON.stringify(x.slice(0, p)), 'common suffix', s, JSON.stringify(x.slice(x.length - s)));
for (const [name, pos, want] of [['|2.end', 26, 63], ['2.|end', 28, 65], ['2.end|', 31, 68], ['1.|end', 21, 21], ['after ]', 32, 78], ['walk', before.indexOf('walk'), after.indexOf('walk')]]) {
  const got = lyMapOffset(before, after, pos);
  console.log(`${name.padEnd(8)} before ${pos} -> page ${got}, same characters ${want} ${got === want ? 'OK' : 'DIFFERS'}`);
}
