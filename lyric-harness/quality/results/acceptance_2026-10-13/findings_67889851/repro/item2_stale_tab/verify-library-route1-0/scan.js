// Bounded sample: English Library units in the given shards; for each line whose
// v1 and v2 cuts differ, and each v1 token t, apply the candidate's rebinding
// twice (as the stale-tab sequence does) and classify the second pass.
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const T = require(process.argv[2] + '/src/lyric-tokens.js');
const DATA = process.argv[2] + '/library/data';
const shards = process.argv.slice(3);
const gz = (p) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATA, p))));
let units = 0, lines = 0, diff = 0, moved1 = 0; const res = { same_chars: 0, other_word: 0, blocked: 0, unchanged: 0 }; const ex = [];
for (const sh of shards) {
  for (const [id, rev] of gz(`u/${sh}.json.gz`).units) {
    const p = `r/${sh}/${id}/${rev}/head.json.gz`;
    if (!fs.existsSync(path.join(DATA, p))) continue;
    const h = gz(p); if (h.language !== 'eng') continue; units++;
    for (const l of h.lines) {
      const text = l[1]; if (typeof text !== 'string' || l[0] === 'title' || l[0] === 'apparatus') continue;
      lines++;
      const v1 = T.v1GraderSpans(text, false);
      const v2 = T.readerLine(text, { stripParens: false }).tokens;
      if (JSON.stringify(v1.map((t) => t.pieces)) === JSON.stringify(v2.map((t) => t.pieces))) continue;
      diff++;
      v1.forEach((s, k) => {
        const a = T.rebindBySpan(text, k + 1, s.text, v1, false);
        if (a.blocked || a.token === k + 1) return;
        moved1++;
        const b = T.rebindBySpan(text, a.token, s.text, v1, false); // stale tab re-saved v2 number unmarked
        if (b.blocked) res.blocked++;
        else if (b.token === a.token) res.unchanged++;
        else {
          const same = JSON.stringify(v2[b.token - 1].pieces) === JSON.stringify(s.pieces);
          if (same) res.same_chars++; else { res.other_word++; if (ex.length < 8) ex.push([text, s.text, k + 1, a.token, b.token]); }
        }
      });
    }
  }
}
console.log(JSON.stringify({ shards, units, lines, lines_cut_differs: diff, first_pass_moves: moved1, second_pass: res, examples: ex }, null, 1));
