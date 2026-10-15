// Item 1: 3PO residual 1 counterexample, at/under/over the 250,000-pair threshold.
'use strict';
const make = require('./ctx.js');
const root = process.argv[2];
const { run, draft, sel } = make(root);
const SONG = '[VERSE]\nOh--oh, oh my love\nwe sing it plain tonight';
const cases = [];
for (const count of [1, 2, 50, 123, 124, 125, 500, 2000, 10000, 50000]) {
  const row = '[SETUP — rhyme groups — ' + Array(count).fill('1.T2,2.end').join(';') + ']';
  const text = `${row}\n${SONG}`;
  const targets = {
    first_2end: [row.indexOf('2.end'), row.indexOf('2.end') + 5],
    middle_2end: (() => { const k = row.indexOf('2.end', Math.floor(row.length / 2)); return [k, k + 5]; })(),
    last_2end: [row.lastIndexOf('2.end'), row.lastIndexOf('2.end') + 5],
    first_T2: [row.indexOf('1.T2'), row.indexOf('1.T2') + 4],
    caret_in_first_2end: [row.indexOf('2.end') + 2, row.indexOf('2.end') + 2],
    span_T2_to_2end: [row.indexOf('1.T2'), row.indexOf('2.end') + 5],
    song_word: [text.indexOf('sing it'), text.indexOf('sing it') + 7],
  };
  for (const [name, [a, b]] of Object.entries(targets)) {
    for (const dir of ['forward', 'backward']) {
      draft.value = text;
      sel.start = a; sel.end = b; sel.dir = dir;
      const t0 = process.hrtime.bigint();
      run('lyEnsureTokenScheme("open")');
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      const got = draft.value.slice(sel.start, sel.end);
      const want = text.slice(a, b).replace('1.T2', '1.T3');
      cases.push({ count, name, dir, before: [a, b], after: [sel.start, sel.end, sel.dir], selected: got,
        want, ok: got === want && sel.dir === dir && (a !== b || sel.start === draft.value.indexOf('2.end') + 2), ms: Math.round(ms) });
    }
  }
  run('delete app.lyricMeta.renumbered');
}
for (const c of cases) console.log(JSON.stringify(c));
console.log('FAILED', cases.filter((c) => !c.ok).length, 'of', cases.length);
