// For every T<k> under the v1 grader cut: the v2 token covering exactly the same characters (or none). Candidate's src/lyric-tokens.js; independent of the page's migration code (uses only the two cuts). Read-only.
const T = require(process.argv[2] + '/src/lyric-tokens.js');
const lines = require('fs').readFileSync(process.argv[3], 'utf8').split('\n').filter(Boolean);
for (const voices of [false, true]) {
  console.log(`== voices ${voices ? 'ON' : 'OFF'}`);
  lines.forEach((l, i) => {
    const v1 = T.v1GraderSpans(l, !voices) || [];
    const v2 = T.readerLine(l, { stripParens: !voices }).tokens;
    const map = v1.map((o, k) => {
      const hit = v2.findIndex((t) => JSON.stringify(t.pieces) === JSON.stringify(o.pieces));
      return `T${k + 1}${JSON.stringify(o.text)}->${hit < 0 ? 'NONE' : 'T' + (hit + 1)}`;
    });
    const same = v1.length === v2.length && v1.every((o, k) => o.text === v2[k].text && JSON.stringify(o.pieces) === JSON.stringify(v2[k].pieces));
    console.log(`L${i + 1} cut ${same ? 'SAME' : 'CHANGED'}  ${map.join(' ')}  v2pieces=${JSON.stringify(v2.map((t) => [t.text, t.pieces]))}`);
  });
}
