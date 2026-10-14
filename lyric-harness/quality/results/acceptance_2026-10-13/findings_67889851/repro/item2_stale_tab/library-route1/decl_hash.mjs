// declaration_hash as mcp/reader_scheduler.js:377 computes it, over the
// declaration_set each page actually sent (recorded POST bodies).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const [, , tree, outDir] = process.argv;
const { canonicalJSON, semanticDeclarations } = await import(`${tree}/mcp/reader_scheduler.js`);
const h = (d) => createHash('sha256').update(canonicalJSON(semanticDeclarations(d || {}))).digest('hex');
const page = (w) => JSON.parse(readFileSync(`${outDir}/page_${w}.json`, 'utf8'));
const B = page('baseline'), C = page('candidate');
const sent = (r, sc, l) => r.scenarios[sc].steps.find((s) => s.label === l).sent_declaration_set;
for (const [sc, l] of [['oh', 'analyze1'], ['oh', 'analyze-after-reload2'], ['same', 'analyze1'], ['same', 'analyze-after-reload2'], ['split', 'analyze1'], ['split', 'analyze2'], ['v9', 'analyze1']]) {
  const b = sent(B, sc, l), c = sent(C, sc, l);
  console.log(`${sc}/${l}: baseline ${b ? h(b).slice(0, 16) : 'not sent'}  candidate ${c ? h(c).slice(0, 16) : 'NOT SENT'}  ${b && c ? (h(b) === h(c) ? 'SAME' : 'DIFFERENT') : ''}`);
}
