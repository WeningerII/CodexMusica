// Item 1/5: exercise the Hirschberg branch of lyAlignUnits directly (delimiter
// sequences differ so the per-member fast path is skipped). Function-level only:
// the migration itself never changes delimiters, so this branch is not reached by
// lyEnsureTokenScheme in practice.
'use strict';
const make = require('./ctx.js');
const { run } = make(process.argv[2]);
const lcsLen = (u, v) => { // reference full DP
  let prev = new Int32Array(v.length + 1);
  for (const x of u) { const next = new Int32Array(v.length + 1);
    for (let j = 0; j < v.length; j++) next[j + 1] = x === v[j] ? prev[j] + 1 : Math.max(prev[j + 1], next[j]);
    prev = next; }
  return prev[v.length];
};
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
let bad = 0;
for (let t = 0; t < 40; t++) {
  const n = 400 + Math.floor(rnd() * 800), m = 400 + Math.floor(rnd() * 800);
  const alpha = ['a', 'b', 'c', 'd', ';', ','];
  const u = Array.from({ length: n }, () => ({ text: alpha[Math.floor(rnd() * 3 + (rnd() < .3 ? 3 : 0))] }));
  const v = Array.from({ length: m }, () => ({ text: alpha[Math.floor(rnd() * 3 + (rnd() < .3 ? 3 : 0))] }));
  const pairs = run('lyAlignUnits(__u, __v)', { __u: u, __v: v });
  const valid = pairs.every(([p, q], i) => u[p].text === v[q].text && (i === 0 || (p > pairs[i - 1][0] && q > pairs[i - 1][1])));
  const want = lcsLen(u.map((x) => x.text), v.map((x) => x.text));
  if (!valid || pairs.length !== want) { bad++; console.log('MISMATCH', t, n, m, valid, pairs.length, want); }
}
console.log('random LCS optimality: mismatches', bad, 'of 40');
// Mapping through the Hirschberg path: first 2.end selection with a far delimiter changed.
for (const count of [124, 2000]) {
  const before = '[SETUP — rhyme groups — ' + Array(count).fill('1.T2,2.end').join(';') + ']\n[VERSE]\nx';
  let after = before.replace(/1\.T2/g, '1.T3');
  const k = after.lastIndexOf(';'); after = after.slice(0, k) + ',' + after.slice(k + 1); // delimiter differs
  after = after.replace(']\n', ' — cut v2]\n');
  const a = before.indexOf('2.end');
  const t0 = Date.now();
  const s = run('lyMapOffset(__b, __a, __s, "start")', { __b: before, __a: after, __s: a });
  const e = run('lyMapOffset(__b, __a, __s, "end")', { __b: before, __a: after, __s: a + 5 });
  console.log('hirschberg map', count, [a, a + 5], '->', [s, e], JSON.stringify(after.slice(s, e)), (Date.now() - t0) + 'ms');
}
// Timing of the quadratic branch on a large row (units ~ 4*count).
for (const count of [5000, 20000]) {
  const u = Array.from({ length: count * 4 }, (_, i) => ({ text: ['1.T2', ',', '2.end', ';'][i % 4] }));
  const v = u.map((x, i) => ({ text: i % 4 === 0 ? '1.T3' : i === 7 ? ',' : x.text }));
  const t0 = Date.now();
  const pairs = run('lyAlignUnits(__u, __v)', { __u: u, __v: v });
  console.log('hirschberg timing units', u.length, 'pairs', pairs.length, (Date.now() - t0) + 'ms');
}
