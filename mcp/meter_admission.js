// meter_admission.js — the recognition caps, checked before anything queues.
//
// #677 W5. Three caps bound what the meter recognizer (#751) can be fed for
// one request. They are COST GUARDS: an input over one is refused whole with
// RESOURCE_LIMIT and the cap's cause, and nothing is truncated, renumbered or
// queued. Values: R2's derivation (#665 6692298979), confirmed by BB8
// (6692374129) with the lowercase causes and the check order below.
//
//   raw_rows             RAW_ROWS_CAP = 3 × 463 = 1,389 physical rows per line
//                        set, before blank rows and [SECTION] markers are
//                        dropped. Ids never move: the sung lines are numbered
//                        L001… after normalising, whatever the rows around them.
//   meter_line_digits    METER_LINE_DIGITS_CAP = floor(1.5 × (512 + 1)) = 769
//                        syllable digits per normalised line.
//   meter_request_digits METER_REQUEST_DIGITS_CAP = 463 × 301 = 139,363 digits over
//                        the normalised lines of one request (below): what
//                        463 lines of 200 characters could reach.
//
// THE LINE LIMIT ROSE; THE REQUEST TOTAL DID NOT (issue #851, 2026-11-12).
// Until then a line was at most 200 characters, its cap was 301, and the
// request total was simply 463 of those. The line limit is 512 now, for
// reading and for writing alike (`lyric_tools.js` MAX_LINE_CHARS): the stored
// corpus has lines of 417 characters and 80 words, and a line of 201 was
// refused whole. The total a request may carry stays where it was, sized for
// REQUEST_BUDGET_LINE_CHARS = 200: a long line spends more of the same total,
// so a request of long lines carries fewer of them, and every byte figure
// derived from the total (the state a run carries, the journal, the response)
// is as it was. One thing therefore stopped following from the caps alone and
// is checked instead: A REVISION'S ANSWERS, below.
//
// WHAT THE SERVER KEEPS BETWEEN CALLS IS BOUNDED SEPARATELY (2026-11-13). The
// total bounds what one request asks the reader to read, not the characters
// of a draft: a declared reading takes its word's units out of the total, and
// a draft can grow inside one call (the website writer, below; one answer to
// a line a verbatim return repeats). So the drafts the run cache keeps are
// held to their own budget, in one place: run_store.js RUN_TEXT_BUDGET.
//
// ONE DECISION RULE ON EVERY PATH (BB8 condition 1). A line's digit figure is
// an UPPER BOUND computed here, in Node, without the lexicon: the stressed
// vowels of each reading the request DECLARES for one of its tokens, plus 1.5
// digits per unit for everything else, a unit being a character or the
// separator that ends a token. No token the reader can produce reads more
// than 1.5 digits per unit (the derivation; the gate is
// lyric-harness/quality/test_meter_digit_bound.py), so a line with no
// declaration is never over 769 at 512 characters. A declared line can be
// refused although its real count would fit; that is accepted, and the
// refusal says the line COULD REACH the figure, never that it has it. No
// other path counts digits another way.
//
// EVERY DECLARATION COUNTS. Declarations are not merged by their `token`
// number: the harness maps each row's token through its own `numbering`
// (`pronunciation.numbered_token`), so one raw number can name two different
// tokens and both rows are applied. The bound sums the stressed vowels of
// every row on the line and takes a declared word's units out of the
// undeclared rest once per (numbering, token); a true duplicate is refused
// by the harness anyway, so summing it can only overcount a request that
// fails regardless.
//
// A final line break ends the last row; it does not open another, so one
// trailing empty row is dropped before rows are counted (as `.splitlines()`).
//
// CHECK ORDER (BB8): raw rows for every line set first, the cheapest check and
// the one that bounds the rest; then every normalised line of every set the
// recognizer reads, and every declared line; then the request's total.
//
// A LINE SET is one sequence of lines a call carries: `draft`, `draft_text`,
// `lines`, `lines_text`, `before`/`after` and their text twins, a
// continuation's `input_draft` and `accepted_lines`, lyric_recover's rows, and
// a declared blueprint's line texts. Every one meets the raw-row cap. All but
// the blueprint's are read by the recognizer and meet the per-line cap too; a
// blueprint's stored text is not read (see ONE TOTAL PER REQUEST below), so it
// meets the raw-row cap only, and a declaration on that text is measured as a
// declared line. lyric_recover reads its paste as SOURCE (apparatus
// rows set aside, bracket spans resolved), so its rows are measured as rows
// and a refusal names the row, never an L id the harness would not give.
//
// DECLARED LINES. A declaration binds by exact line text, and the harness
// keeps one whose line is in no draft (it is reported stale, not refused); a
// revision's answer, or the source reading of a recovered row, can make that
// text a sung line later. So every distinct declared line that could ever be
// sung (at most 512 code points, one row) is also measured, against the
// per-line cap only. An undeclared answer is refused over 512 characters
// (ANSWER_TOO_LONG and the `answers` schema) and so stays inside the per-line
// cap, and a declared one is a declared line.
//
// A REVISION'S ANSWERS. An answer replaces a line, and the line it replaces
// may have counted less, so a revised draft can outgrow the draft that was
// admitted. While a line's cap was 301 that could not pass the request total
// (463 × 301 is the total). At 769 it can, so the answers a `lyric_revise`
// call carries are measured WITH the draft they will be folded into: the
// draft's bound plus every answered line's bound must be inside the total,
// counting nothing off for the lines replaced. A call over it is refused
// before anything runs, with the question still pending, so a shorter answer
// continues the run; and the draft a run carries forward is then inside the
// total on its next call, because each call that grew it was admitted this
// way. (The website chat's own writer answers inside one call and is not
// measured here; a run it grows past the total is refused on its next
// continuation, by name, with its accepted draft kept for recover_only.)
//
// ONE TOTAL PER REQUEST (BB8 ruling 2). The per-request cap is over every line
// whose recognition the response carries: the draft (whichever of its
// spellings is largest, since a continuation's input_draft and accepted_lines
// and the call's own draft are one song read once), plus lyric_verify's
// `before` and `after` and lyric_recover's rows, summed. A blueprint's stored
// line texts are NOT in it: every lyric tool fits the draft's own lines to the
// blueprint's placements and never reads that text (only the CLI `fit` verb
// does), so they meet the raw-row cap only, not the per-line cap (BB8's
// ruling on #827). Declared lines are
// counted with the set that holds them. The refusal names every set it summed
// and every set it left out.

import { draftFromText, normalizeDraftLines } from './lyric_text.js';
import { decodeState } from './state_codec.js';

// Mirrors of the connector's line ceilings (`lyric_tools.js` MAX_LINES and
// MAX_LINE_CHARS). Kept literal so this module imports nothing from the tool
// registry; mcp/test_meter_admission.mjs holds the two equal.
export const ADMISSION_MAX_LINES = 463;
export const ADMISSION_MAX_LINE_CHARS = 512;
// The line length the REQUEST TOTAL is sized for: the line limit as it was
// before #851. Not a limit on any line.
export const REQUEST_BUDGET_LINE_CHARS = 200;
// 1.5 digits per unit, as the exact ratio 3/2 so no float rounding enters.
export const DIGITS_PER_UNIT = Object.freeze({ numerator: 3, denominator: 2 });
const atRate = (units) =>
  Math.floor((units * DIGITS_PER_UNIT.numerator) / DIGITS_PER_UNIT.denominator);
// The three caps, written as numbers so the limits map lists them
// (lyric-harness/map/limits.md); the tests hold each to its derivation.
// floor(1.5 × (ADMISSION_MAX_LINE_CHARS + 1)):
export const METER_LINE_DIGITS_CAP = 769;
// ADMISSION_MAX_LINES × floor(1.5 × (REQUEST_BUDGET_LINE_CHARS + 1)) = 463 × 301:
export const METER_REQUEST_DIGITS_CAP = 139_363;
// 3 × ADMISSION_MAX_LINES:
export const RAW_ROWS_CAP = 1_389;
if (
  METER_LINE_DIGITS_CAP !== atRate(ADMISSION_MAX_LINE_CHARS + 1) ||
  METER_REQUEST_DIGITS_CAP !== ADMISSION_MAX_LINES * atRate(REQUEST_BUDGET_LINE_CHARS + 1) ||
  REQUEST_BUDGET_LINE_CHARS > ADMISSION_MAX_LINE_CHARS ||
  RAW_ROWS_CAP !== 3 * ADMISSION_MAX_LINES
)
  throw new Error('meter_admission: a cap no longer matches its derivation');
// WHAT ONE ADMITTED LINE COSTS A RESPONSE (BB8 ruling 1). The largest
// recognition one line of 301 digits (a 200-character line, the line the
// request total is sized for) can add to the default view,
// JSON-escaped as the bounded payload measures it, CANDIDATE ROWS INCLUDED:
// 7,507 B, at 301 digits (5,979 B without the candidate rows). Measured by
// lyric-harness/quality/test_meter_digit_bound.py over every surface the
// recognizer core can generate (`max_readings=1`, the default policy
// registry, every compared token guessed); it fails if the measurement moves
// or the candidate rows leave it. With 200 B per line for the withheld wrapper,
// 463 lines are 3,568,341 B, 42.5% of the 8 MiB default-view budget, before
// the response envelope, which is not measured yet. None of the caps above
// depends on it.
// NOT MEASURED FOR A LONGER LINE (#851): the recognizer core these figures
// were measured on (#751) is not on this head, so what a line of 302-769
// digits adds to a response has no figure here. The request total did not
// move, so the 463-line figure below still bounds every request whose
// per-line cost grows no faster than its digits; whether the core's does is
// for test_meter_digit_bound.py to measure, over 1-769 digits, the day the
// core is importable. It fails then rather than pass on the old range.
export const METER_LINE_RESPONSE_BYTES = 7_507;
export const METER_LINE_WRAPPER_BYTES = 200;
// ADMISSION_MAX_LINES × (METER_LINE_RESPONSE_BYTES + METER_LINE_WRAPPER_BYTES):
export const METER_REQUEST_RESPONSE_BYTES = 3_568_341;
if (
  METER_REQUEST_RESPONSE_BYTES !==
  ADMISSION_MAX_LINES * (METER_LINE_RESPONSE_BYTES + METER_LINE_WRAPPER_BYTES)
)
  throw new Error('meter_admission: the response figure no longer matches its derivation');
export const ADMISSION_CAUSES = Object.freeze([
  'raw_rows',
  'meter_line_digits',
  'meter_request_digits',
]);

const codePoints = (s) => [...s].length;
// Physical rows of one string. Every break the tools' readers split on counts
// (`\r\n`, a lone `\r`, `\n`), so no spelling of a break hides a row. A final
// break ends the last row rather than opening another (the harness reader's
// `.splitlines()`), so exactly one trailing empty row is dropped before counting.
const withoutFinalBreak = (rows) =>
  rows.length > 1 && rows[rows.length - 1] === '' ? rows.slice(0, -1) : rows;
const rowsOf = (s) => withoutFinalBreak(s.split(/\r\n|\r|\n/)).length;
// lyric_recover's paste as rows: the handler's own split (takeLines with
// preserveStructure) and the admission check both call this, so the row the
// check counts and names is the row the handler writes to the source reader.
export const pastedRowsOf = (text) =>
  withoutFinalBreak(String(text).replace(/\r\n?/g, '\n').split('\n'));
const fmt = (n) => n.toLocaleString('en-US');
const lid = (n) => `L${String(n).padStart(3, '0')}`;
const pid = (n) => `P${String(n).padStart(3, '0')}`;
// A stressed vowel is a phone carrying a stress digit (validate_choices
// accepts digits only on vowels), so the count needs no inventory.
const stressedVowels = (phones) =>
  Array.isArray(phones)
    ? phones.filter((p) => typeof p === 'string' && /[012]$/.test(p)).length
    : 0;
// The opening quotation marks the reader may leave out of a declared word
// (`pronunciation.declared_spelling`). Not counting one as a token character
// can only raise the bound.
const OPENING_MARK = /^['‘‛“‟"`´′]/u;

export class AdmissionRefusal extends Error {
  constructor(cause, message, detail) {
    super(
      `RESOURCE_LIMIT: ${cause} — ${message} Nothing was queued; no line was truncated or renumbered.`
    );
    this.code = 'RESOURCE_LIMIT';
    this.cause = cause;
    this.detail = detail;
    // Read by the tool wrapper and the session endpoint the way every other
    // refusal is: a refusal before any work, never a failed run.
    this.isRefusal = true;
    this.beforeDispatch = true;
  }
}

// -> the bound for one normalised line, with what it was made of.
// `declarations` are {index (1-based P), line, token, word, phones}.
export function lineDigitBound(text, declarations = []) {
  const units = codePoints(text) + 1;
  let declaredDigits = 0;
  const contributing = [];
  // (numbering, token) -> the fewest units a row there names: what a declared
  // token takes out of the undeclared rest, counted once per coordinate.
  const unitsAt = new Map();
  for (const d of declarations) {
    if (d.line !== text) continue;
    const vowels = stressedVowels(d.phones);
    declaredDigits += vowels;
    contributing.push({ p: d.index, token: d.token, digits: vowels });
    const key = Number.isInteger(d.token)
      ? `${typeof d.numbering === 'string' ? d.numbering : ''}|${d.token}`
      : `?${d.index}`;
    const word = typeof d.word === 'string' ? d.word.replace(OPENING_MARK, '') : '';
    const wordUnits = codePoints(word) + 1;
    if (!unitsAt.has(key) || wordUnits < unitsAt.get(key)) unitsAt.set(key, wordUnits);
  }
  let declaredUnits = 0;
  for (const u of unitsAt.values()) declaredUnits += u;
  const undeclaredUnits = Math.max(0, units - declaredUnits);
  return {
    bound: declaredDigits + atRate(undeclaredUnits),
    declared_digits: declaredDigits,
    undeclared_units: undeclaredUnits,
    contributing: contributing.sort((a, b) => a.p - b.p),
  };
}

// `family: 'draft'` marks the spellings of the one song a call reads; every
// other set is its own song in the request total.
const lineSetOfArray = (name, items, family = null) => ({
  name,
  family,
  rows: items.reduce((n, item) => n + (typeof item === 'string' ? rowsOf(item) : 1), 0),
  lines: normalizeDraftLines(items).filter((l) => typeof l === 'string'),
});
const lineSetOfText = (name, text, family = null) => ({
  name,
  family,
  rows: rowsOf(text),
  lines: draftFromText(text),
});
// lyric_recover's paste, row by row as the handler writes it to the source
// reader (takeLines with preserveStructure): blank rows are not measured, and
// each line keeps its row number, because the sung-line number is the source
// reader's to give.
function recoverRowSet(name, rows) {
  const lines = [];
  const ids = [];
  rows.forEach((row, i) => {
    if (typeof row !== 'string' || !row.trim()) return;
    lines.push(row.trim());
    ids.push(`row ${i + 1}`);
  });
  return { name, family: null, rows: rows.length, lines, ids, byRow: true };
}
const SINGLE_ROW = /[\r\n\u2028\u2029]/;

// A continuation the handler will refuse anyway contributes nothing here: its
// own refusal names what is wrong with it, and nothing of it is read.
function continuationOf(wire) {
  if (typeof wire !== 'string') return null;
  try {
    const decoded = decodeState(wire);
    return decoded && typeof decoded === 'object' ? decoded : null;
  } catch {
    return null;
  }
}

function blueprintTexts(wire) {
  if (typeof wire !== 'string') return null;
  try {
    const bp = JSON.parse(wire);
    return Array.isArray(bp?.lines)
      ? bp.lines.map((l) => (typeof l?.text === 'string' ? l.text : ''))
      : null;
  } catch {
    return null;
  }
}

// -> { sets, declarations } for one tool call's arguments, as the handler
// will read them. Pure: nothing is decoded into the arguments.
export function recognitionInputOf(args = {}, { tool = null } = {}) {
  const sets = [];
  for (const [arrayName, textName, family] of [
    ['draft', 'draft_text', 'draft'],
    ['lines', 'lines_text', 'draft'],
    ['before', 'before_text', null],
    ['after', 'after_text', null],
  ]) {
    if (tool === 'lyric_recover' && arrayName === 'lines') {
      if (Array.isArray(args.lines)) sets.push(recoverRowSet('lines', args.lines));
      if (typeof args.lines_text === 'string')
        sets.push(recoverRowSet('lines_text', pastedRowsOf(args.lines_text)));
      continue;
    }
    // `lines` is also a line COUNT on the planning tools: only an array is a set.
    if (Array.isArray(args[arrayName]))
      sets.push(lineSetOfArray(arrayName, args[arrayName], family));
    if (typeof args[textName] === 'string')
      sets.push(lineSetOfText(textName, args[textName], family));
  }
  let carried = null;
  for (const field of ['state', 'checkpoint']) {
    const decoded = continuationOf(args[field]);
    if (!decoded) continue;
    for (const key of ['input_draft', 'accepted_lines'])
      if (Array.isArray(decoded[key]))
        sets.push(lineSetOfArray(`${field}.${key}`, decoded[key], 'draft'));
    const held = decoded.connector_declarations?.pronunciations;
    if (!carried && Array.isArray(held)) carried = held;
  }
  // A REVISION'S ANSWERS (the header): each answered line, measured with the
  // draft it will be folded into. `answers` is one {line, text} per asked
  // line; `answer` is one line, or one `L<n>: text` row per asked line.
  if (tool === 'lyric_revise') {
    const answered = [];
    if (Array.isArray(args.answers))
      for (const row of args.answers)
        if (typeof row?.text === 'string' && row.text.trim()) answered.push(row.text.trim());
    if (typeof args.answer === 'string')
      for (const row of args.answer.split(/\r\n|\r|\n/)) {
        const text = row.trim().replace(/^(?:L\s*\d+\s*[:.]|LINE\s*:)\s*/i, '');
        if (text) answered.push(text);
      }
    if (answered.length)
      sets.push({
        name: Array.isArray(args.answers) ? 'answers' : 'answer',
        family: null,
        rows: answered.length,
        lines: answered,
        answers: true,
      });
  }
  // A blueprint's stored line texts are rows the call carries, so they meet
  // the raw-row cap; but nothing recognises their text (the meter and
  // function passes fit the DRAFT's lines to the blueprint's placements; only
  // the CLI `fit` verb reads its own text), so they meet neither the per-line
  // cap (BB8's ruling on #827) nor the per-request total (BB8 ruling 2).
  // If any path ever recognises blueprint.lines text, both the per-line cap
  // and the request total apply to it again: drop `unrecognised` here.
  const bp = blueprintTexts(args.blueprint);
  const unreadTexts = new Set();
  if (bp) {
    const set = { ...lineSetOfArray('blueprint.lines', bp), unrecognised: true };
    sets.push(set);
    for (const text of [...bp, ...set.lines]) unreadTexts.add(text);
  }
  const list = Array.isArray(args.pronunciations) ? args.pronunciations : carried || [];
  const declarations = list
    .map((row, i) => ({
      index: i + 1,
      line: row?.line,
      token: row?.token,
      word: row?.word,
      phones: row?.phones,
      numbering: row?.numbering,
    }))
    .filter((d) => typeof d.line === 'string');
  // Every declared line that could be sung, for the per-line cap only.
  const declaredLines = [];
  const seen = new Set();
  for (const d of declarations) {
    if (seen.has(d.line)) continue;
    seen.add(d.line);
    if (d.line.trim() && !SINGLE_ROW.test(d.line) && codePoints(d.line) <= ADMISSION_MAX_LINE_CHARS)
      declaredLines.push(d.line);
  }
  // A declared line that is a blueprint text is named as one: that set is a
  // line set, but its text is not read, so the line is measured here.
  if (declaredLines.length)
    sets.push({
      name: 'pronunciations',
      family: null,
      rows: 0,
      lines: declaredLines,
      declaredOnly: true,
      unread: declaredLines.map((text) => unreadTexts.has(text)),
    });
  return { sets, declarations };
}

// Throws AdmissionRefusal for the first cap an input is over, in BB8's order;
// otherwise returns what was measured (the sets' rows, each line's bound).
export function admitRecognitionInput({ sets, declarations = [] }) {
  for (const set of sets)
    if (set.rows > RAW_ROWS_CAP)
      throw new AdmissionRefusal(
        'raw_rows',
        `\`${set.name}\` has ${fmt(set.rows)} raw rows (blank rows and [SECTION] markers included); at most ${fmt(RAW_ROWS_CAP)} are admitted (3 × ${ADMISSION_MAX_LINES}). Send the song with fewer rows.`,
        { set: set.name, rows: set.rows, cap: RAW_ROWS_CAP }
      );
  const measured = sets.map((set) => ({
    name: set.name,
    family: set.family,
    rows: set.rows,
    ...(set.declaredOnly ? { declared_only: true } : {}),
    ...(set.unrecognised ? { unrecognised: true, outside_total: true } : {}),
    ...(set.byRow ? { by_row: true } : {}),
    ...(set.answers ? { answers: true } : {}),
    lines: set.lines.map((text, i) => {
      const bound = lineDigitBound(text, declarations);
      const id = set.declaredOnly
        ? bound.contributing.map((c) => pid(c.p)).join(', ')
        : set.ids
          ? set.ids[i]
          : lid(i + 1);
      return { id, text, ...(set.unread?.[i] ? { blueprint_text: true } : {}), ...bound };
    }),
  }));
  for (const set of measured)
    // An answered line is held to the line limit by its own refusal
    // (ANSWER_TOO_LONG), which names the answer; it is measured here for the
    // request total only.
    for (const line of set.unrecognised || set.answers ? [] : set.lines)
      if (line.bound > METER_LINE_DIGITS_CAP) {
        const how = line.contributing.length
          ? `under its declared readings (${line.contributing
              .map((c) => `${pid(c.p)} ${c.digits}`)
              .join(
                ', '
              )}: ${fmt(line.declared_digits)} digits) and 1.5 digits per unit for its ${fmt(line.undeclared_units)} undeclared units`
          : `at 1.5 digits per unit for its ${fmt(line.undeclared_units)} units (each character and each token's separator)`;
        const which = set.declared_only
          ? `The line ${JSON.stringify(line.text)}, which ${line.id} declare${line.contributing.length > 1 ? '' : 's'} readings for, ${line.blueprint_text ? 'is a line of `blueprint.lines`, whose stored text no check reads,' : 'is in no line set of this call,'} but an answer or a source reading can make it a sung line, and it`
          : set.by_row
            ? set.name === 'lines'
              ? `The line at ${line.id} of \`lines\` (the row is the item's position in the array, counted from 1 with blank items included)`
              : `The line at ${line.id} of the pasted text (rows are counted from the top, including headings and blank rows, so you can find it as pasted)`
            : `${line.id} of \`${set.name}\``;
        throw new AdmissionRefusal(
          'meter_line_digits',
          `${which} could reach ${fmt(line.bound)} syllable digits ${how}; the per-line cap is ${fmt(METER_LINE_DIGITS_CAP)}. This is an upper bound, not a count of the line.`,
          {
            set: set.name,
            line: line.id,
            bound: line.bound,
            cap: METER_LINE_DIGITS_CAP,
            declarations: line.contributing.map((c) => pid(c.p)),
          }
        );
      }
  // One song per set, except the draft's spellings, which are one song at
  // the largest of them. A set no response recognises is left out, and the
  // refusal says so.
  const songs = [];
  const left = [];
  let draft = null;
  for (const set of measured) {
    if (set.declared_only || set.outside_total) {
      left.push(set);
      continue;
    }
    const song = {
      name: set.name,
      family: set.family,
      lines: set.lines.length,
      bound: set.lines.reduce((n, l) => n + l.bound, 0),
      ...(set.answers ? { answers: true } : {}),
    };
    if (set.family !== 'draft') songs.push(song);
    else if (!draft || song.bound > draft.bound) draft = song;
  }
  if (draft) songs.unshift(draft);
  const total = songs.reduce((n, s) => n + s.bound, 0);
  if (total > METER_REQUEST_DIGITS_CAP) {
    const parts = songs
      .map(
        (s) =>
          `${s.family === 'draft' ? 'the draft ' : ''}\`${s.name}\` (${fmt(s.lines)} line${s.lines === 1 ? '' : 's'}, ${fmt(s.bound)})`
      )
      .join(' and ');
    const notCounted = left.length
      ? ` Not counted, because no response carries their recognition: ${left
          .map((s) =>
            s.declared_only
              ? "the pronunciations' own lines (a declaration on a line already counted in this total is counted with that line; any other declared line, including one on a `blueprint.lines` text, was checked against the per-line cap instead)"
              : `\`${s.name}\` (its stored text is not read; the draft's lines are fitted to its placements)`
          )
          .join('; ')}.`
      : '';
    const answering = songs.some((s) => s.answers);
    const answerNote = answering
      ? ' The answered lines are counted with the draft they would be folded into, and nothing is taken off for the lines they replace. Nothing was run and the same question is still pending: answer it again with shorter lines.'
      : '';
    throw new AdmissionRefusal(
      'meter_request_digits',
      `${parts}${songs.length > 1 ? ' together' : ''} could reach ${fmt(total)} syllable digits; one request carries at most ${fmt(METER_REQUEST_DIGITS_CAP)} (the per-request cap). This is an upper bound, not a count.${answerNote}${notCounted}`,
      {
        sets: songs.map((s) => s.name),
        not_counted: left.map((s) => s.name),
        bound: total,
        cap: METER_REQUEST_DIGITS_CAP,
        ...(answering ? { answers: true } : {}),
      }
    );
  }
  return measured;
}

export const admitRecognitionArgs = (args, options) =>
  admitRecognitionInput(recognitionInputOf(args, options));
