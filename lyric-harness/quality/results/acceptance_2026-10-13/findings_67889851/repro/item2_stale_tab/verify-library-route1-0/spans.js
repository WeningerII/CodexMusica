const T = require(process.argv[2] + '/src/lyric-tokens.js');
for (const line of ['Oh--oh, oh, oh my love', 'Oh--oh, oh my love']) {
  const v1 = T.v1GraderSpans(line, false).map((t, k) => [k + 1, t.text, JSON.stringify(t.pieces)]);
  const v2 = T.readerLine(line, { stripParens: false }).tokens.map((t, k) => [k + 1, t.text, JSON.stringify(t.pieces)]);
  console.log(line); console.log(' v1', JSON.stringify(v1)); console.log(' v2', JSON.stringify(v2));
  for (const tok of [2, 3, 4]) console.log('  rebind v1 tok', tok, JSON.stringify(T.rebindBySpan(line, tok, 'oh', T.v1GraderSpans(line, false), false)));
}
