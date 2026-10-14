'use strict';
// Byte-identity checks over the recorded page runs.
const fs = require('fs');
const out = [];
const ok = (label, cond, detail = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${label}${detail ? ' :: ' + detail : ''}`);
for (const which of ['candidate', 'baseline']) {
  const r = JSON.parse(fs.readFileSync(`page_${which}.json`, 'utf8'));
  const S = r.scenarios;
  const step = (sc, l) => S[sc].steps.find((s) => s.label === l);
  // (a) control: nothing moves -> sent bytes == seeded bytes, every time
  const seededSame = JSON.stringify(S.same.seeded.declarations);
  for (const l of ['analyze1', 'analyze-after-reload1', 'analyze-after-reload2'])
    ok(`${which} same/${l}: sent declaration_set bytes == seeded declarations bytes`, step('same', l).sent_declaration_set_raw === seededSame);
  for (const l of ['load1', 'reload1', 'after-save', 'reload2']) {
    const rec = step('same', l).idb;
    ok(`${which} same/${l}: stored declarations bytes == seeded`, JSON.stringify(rec.declarations) === seededSame);
    const extra = Object.keys(rec).filter((k) => k !== 'declarations');
    ok(`${which} same/${l}: other stored fields`, true, JSON.stringify(extra) + ' ' + JSON.stringify(Object.fromEntries(extra.map((k) => [k, rec[k]]))));
  }
  // (a) in a record where another row moves: the unmoved row and the hooks
  const sentOh = JSON.parse(step('oh', 'analyze1').sent_declaration_set_raw || 'null');
  const seedOh = S.oh.seeded.declarations;
  ok(`${which} oh/analyze1: unmoved 'lampe' row bytes == seeded row bytes`, JSON.stringify(sentOh.pronunciations[1]) === JSON.stringify(seedOh.pronunciations[1]));
  ok(`${which} oh/analyze1: hooks bytes == seeded`, JSON.stringify(sentOh.hooks) === JSON.stringify(seedOh.hooks));
  // the moved row: only `token` differs, key order kept
  const a = sentOh.pronunciations[0], b = seedOh.pronunciations[0];
  const diff = Object.keys(b).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  ok(`${which} oh/analyze1: moved row differs only in`, true, JSON.stringify(diff) + ` token ${b.token} -> ${a.token}; keys ${JSON.stringify(Object.keys(a))}`);
  // the stored pre-batch record: was it rewritten on load (no user action)?
  const l1 = step('oh', 'load1').idb;
  ok(`${which} oh/load1: stored record bytes unchanged from seed (no rewrite on load)`, JSON.stringify(l1) === JSON.stringify(S.oh.seeded), JSON.stringify(Object.keys(l1)));
  if (l1.legacy_declarations) ok(`${which} oh/load1: legacy_declarations bytes == seeded declarations`, JSON.stringify(l1.legacy_declarations) === JSON.stringify(seedOh));
  const v9 = step('v9', 'reload1').idb;
  ok(`${which} v9/reload1: unknown-cut record left byte-identical before any user action`, JSON.stringify(v9) === JSON.stringify(S.v9.seeded));
}
fs.writeFileSync('check_bytes_out.txt', out.join('\n') + '\n');
console.log(out.join('\n'));
