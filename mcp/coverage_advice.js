// WHAT TO DO ABOUT AN UNCERTIFIED STOP, READ OFF WHAT WAS ACTUALLY REFUSED
// (issue #676, 2026-11-12).
//
// A revise that stops at exit 2 with no line open has an incomplete coverage
// record and nothing left to rewrite. The note it printed gave one next step
// whatever the cause: "Resolve the unread words with `pronunciations`". That
// is right when a word could not be read. It is wrong when the refused
// obligation is a DECLARATION -- a title with no hook to be asked of, a hook
// in sections that declare no function -- because no pronunciation and no
// rewrite of a line changes a declaration. In the twenty audited love-song
// trials seven runs stopped on exactly that, with no unread word in the
// draft, were told to fix pronunciations, and left by re-planning instead.
//
// So the next step is derived from the refused rows themselves:
//   * a row that names a line or a word could not be judged because of the
//     words there -- the pronunciation advice applies, unchanged;
//   * a row that carries a `code` and names no line is a declaration the
//     draft's words cannot move -- it is named, with the grader's own message
//     for it, and the caller is told what can and cannot clear it;
//   * anything else is pointed at by id.
// Pure: no imports, so the tool surface and the session view can both use it
// without a cycle.

// The lines a refused obligation id names, in the grader's own spelling:
// `rhyme:I:J:K` and `return:I:J` name lines I and J, `prominence:LN` and
// `meter:CODE:LN` and `function:CODE:TN:LN` name line N. The same reading as the harness's
// quality/pronunciation.py refused_lines; any other id names no line.
export function obligationLines(id) {
  const p = String(id).split(':');
  if (['rhyme', 'return'].includes(p[0]) && /^\d+$/.test(p[1] ?? '') && /^\d+$/.test(p[2] ?? ''))
    return [Number(p[1]), Number(p[2])];
  if (['prominence', 'meter', 'function'].includes(p[0]) && /^L\d+$/.test(p.at(-1)))
    return [Number(p.at(-1).slice(1))];
  return null;
}

// The pronunciation step, word for word as the note has always printed it.
export const READING_ADVICE =
  'Resolve the unread words with `pronunciations` (lyric_grade lists the options)';
const AGAIN = 'grade again, and start a new run with `new_run: true`';

// -> { reading, declarations, other }: the refused rows of a verdict's
// coverage, by what could clear them. `declarations` and `other` are lists of
// display names, each once; `reading` is whether any row is about words.
export function refusedByRemedy(verdict) {
  const coverage = verdict?.coverage || {};
  const findings = Array.isArray(verdict?.findings) ? verdict.findings : [];
  const rows = Array.isArray(coverage.obligations)
    ? coverage.obligations.filter((o) => o && o.status === 'refused' && typeof o.id === 'string')
    : [];
  const listed = Array.isArray(coverage.refused_obligations)
    ? coverage.refused_obligations.filter((id) => typeof id === 'string')
    : [];
  // A verdict may carry the id list without the rows (a short or older
  // record); read those ids as bare rows so nothing refused is dropped.
  const seen = new Set(rows.map((o) => o.id));
  for (const id of listed) if (!seen.has(id)) rows.push({ id, layer: id.split(':')[0] });
  const aboutWords = (o) =>
    Boolean(obligationLines(o.id)) ||
    (typeof o.word === 'string' && o.word !== '') ||
    Number.isInteger(o.line) ||
    (Array.isArray(o.failed_words) && o.failed_words.length > 0);
  let reading = false;
  const declarations = [];
  const other = [];
  // `layer:draft` is the layer's aggregate: it is refused BECAUSE a row under
  // it is, so it is named only when nothing under it says why.
  const detailed = new Set(
    rows.filter((o) => !/:draft$/.test(o.id)).map((o) => String(o.id).split(':')[0])
  );
  for (const o of rows) {
    if (/:draft$/.test(o.id) && detailed.has(String(o.id).split(':')[0])) continue;
    if (aboutWords(o)) {
      reading = true;
      continue;
    }
    if (typeof o.code === 'string' && o.code) {
      const said = findings.find((f) => f && f.code === o.code)?.message;
      const name =
        `${o.layer || String(o.id).split(':')[0]}: ${o.code}` + (said ? ` — ${said}` : '');
      if (!declarations.includes(name)) declarations.push(name);
      continue;
    }
    if (!other.includes(o.id)) other.push(o.id);
  }
  return { reading, declarations, other };
}

// -> the sentence that names the refused DECLARATIONS and says what can and
// cannot clear them, or '' when none is refused. `also` words it for a note
// that has already said something else is open.
export function declarationAdvice(verdict, { also = false } = {}) {
  const { reading, declarations } = refusedByRemedy(verdict);
  if (!declarations.length) return '';
  const one = declarations.length === 1;
  const lead = also
    ? `ALSO NOT JUDGED, and no rewrite will change it — ${one ? 'a DECLARATION' : 'DECLARATIONS'}, not ${one ? 'a word' : 'words'}`
    : `${reading ? 'Part of what' : 'What'} was not judged is ${one ? 'a DECLARATION' : 'DECLARATIONS'}, not ${one ? 'a word' : 'words'}`;
  return (
    `${lead}: ${declarations.join('; ')}. No rewrite of a line and no \`pronunciations\` entry can clear ${one ? 'it' : 'them'}; ` +
    `only changing what was declared can (the blueprint or plan declaration ${one ? 'that finding names' : 'those findings name'}).`
  );
}

// -> the sentence(s) that follow "NOT CERTIFIED: … (see `coverage`)."
// For a stop whose only refused rows are about words this is the note as it
// has always read.
export function uncertifiedAdvice(verdict) {
  const { reading, declarations, other } = refusedByRemedy(verdict);
  if (!declarations.length && !other.length)
    return reading
      ? `${READING_ADVICE}, ${AGAIN}.`
      : // Nothing refused is on the record to read a cause from: say so, and
        // do not guess that a word was the cause.
        `Read \`coverage\` for what was not judged; after any change, ${AGAIN}.`;
  const parts = [];
  if (declarations.length) parts.push(declarationAdvice(verdict));
  if (other.length)
    parts.push(`Read \`coverage\` for the refused obligation(s) ${other.join(', ')}.`);
  if (reading) parts.push(`${READING_ADVICE}.`);
  parts.push(`After any change, ${AGAIN}.`);
  return parts.join(' ');
}
