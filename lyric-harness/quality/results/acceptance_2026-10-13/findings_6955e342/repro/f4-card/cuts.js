// Print v1 (grader earlier cut) and v2 (current reader) tokens for lines. Usage: node cuts.js <tree> <line>...
const path = require('path');
const T = require(path.join(process.argv[2], 'src/lyric-tokens.js'));
for (const line of process.argv.slice(3)) {
  const v1 = T.v1GraderSpans(line, true);
  const v2 = T.readerLine(line, { stripParens: true }).tokens;
  console.log(JSON.stringify(line));
  console.log('  v1:', v1 ? v1.map((s) => `${s.text}[${s.pieces[0][0]},${s.pieces[0][1]}]`).join(' ') : null);
  console.log('  v2:', v2.map((t) => `${t.text}${JSON.stringify(t.pieces)}`).join(' '));
  for (let k = 1; k <= (v1 ? v1.length : 0); k++) {
    const r = T.rebindBySpan(line, k, null, v1.map((s) => ({ text: s.text, pieces: s.pieces })), true);
    console.log(`  T${k} ->`, JSON.stringify(r));
  }
}
