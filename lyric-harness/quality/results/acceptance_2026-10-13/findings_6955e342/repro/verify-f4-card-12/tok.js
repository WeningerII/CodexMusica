const T = require(process.argv[2] + '/src/lyric-tokens.js');
for (const line of process.argv.slice(3)) {
  const v1 = T.v1GraderSpans(line, true);
  const v2 = T.readerLine(line, { stripParens: true }).tokens;
  console.log(JSON.stringify(line), '\n v1:', v1 && v1.map((s) => s.text).join(' | '), '\n v2:', v2.map((t) => t.text).join(' | '));
}
