// Print v1 grader cut, v1 lookup and v2 reader cut for each line, voices off/on. Candidate's src/lyric-tokens.js. Read-only.
const T = require(process.argv[2] + '/src/lyric-tokens.js');
const lines = require('fs').readFileSync(process.argv[3], 'utf8').split('\n').filter(Boolean);
for (const voices of [false, true]) {
  console.log(`== voices ${voices ? 'ON (parens sung)' : 'OFF (parens stripped)'}`);
  lines.forEach((l, i) => {
    const v1 = T.v1GraderTokens(l, !voices);
    const look = T.v1GraderLookup ? T.v1GraderLookup(l, !voices) : null;
    const v2 = T.readerLine(l, { stripParens: !voices }).tokens.map((t) => t.text);
    const v1s = T.v1GraderSpans(l, !voices);
    const v2s = T.readerLine(l, { stripParens: !voices }).tokens.map((t) => JSON.stringify(t.pieces));
    console.log(`L${i + 1} ${JSON.stringify(l)}\n   v1 ${JSON.stringify(v1)}\n   lk ${JSON.stringify(look)}\n   v2 ${JSON.stringify(v2)}\n   v1spans ${JSON.stringify(v1s && v1s.map(s=>[s.text,s.pieces||s.start]))}`);
  });
}
