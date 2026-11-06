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
//   meter_line_digits    METER_LINE_DIGITS_CAP = floor(1.5 × (200 + 1)) = 301
//                        syllable digits per normalised line.
//   meter_request_digits METER_REQUEST_DIGITS_CAP = 463 × 301 = 139,363 digits over
//                        the normalised lines of one request (below).
//
// ONE DECISION RULE ON EVERY PATH (BB8 condition 1). A line's digit figure is
// an UPPER BOUND computed here, in Node, without the lexicon: the stressed
// vowels of each reading the request DECLARES for one of its tokens, plus 1.5
// digits per unit for everything else, a unit being a character or the
// separator that ends a token. No token the reader can produce reads more
// than 1.5 digits per unit (the derivation; the gate is
// lyric-harness/quality/test_meter_digit_bound.py), so a line with no
// declaration is never over 301 at 200 characters. A declared line can be
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
// CHECK ORDER (BB8): raw rows for every line set first, the cheapest check and
// the one that bounds the rest; then every normalised line; then the
// request's total.
//
// A LINE SET is one sequence of lines the recognizer would read: `draft`,
// `draft_text`, `lines`, `lines_text`, `before`/`after` and their text twins,
// a continuation's `input_draft` and `accepted_lines`, and a declared
// blueprint's line texts. lyric_recover reads its paste as SOURCE (apparatus
// rows set aside, bracket spans resolved), so its rows are measured as rows
// and a refusal names the row, never an L id the harness would not give.
//
// DECLARED LINES. A declaration binds by exact line text, and the harness
// keeps one whose line is in no draft (it is reported stale, not refused); a
// revision's answer, or the source reading of a recovered row, can make that
// text a sung line later. So every distinct declared line that could ever be
// sung (at most 200 code points, one row) is also measured, against the
// per-line cap only: with every line that can be sung at or under 301 and at
// most 463 of them, no request passes 139,363 that way. A revision's
// `answer`/`answers` then need no set of their own: an undeclared answer is
// refused at 200 characters (ANSWER_TOO_LONG and the `answers` schema) and so
// stays inside the cap, and a declared one is a declared line.
//
// ONE TOTAL PER REQUEST. The per-request cap is over every line the request
// carries for recognition: the draft (whichever of its spellings is largest,
// since a continuation's input_draft and accepted_lines and the call's own
// draft are one song read once), plus a blueprint's lines, lyric_verify's
// `before` and `after`, and lyric_recover's rows, summed.

import { draftFromText, normalizeDraftLines } from './lyric_text.js';
import { decodeState } from './state_codec.js';

// Mirrors of the connector's line ceilings (`lyric_tools.js` MAX_LINES and
// MAX_LINE_CHARS). Kept literal so this module imports nothing from the tool
// registry; mcp/test_meter_admission.mjs holds the two equal.
export const ADMISSION_MAX_LINES = 463;
export const ADMISSION_MAX_LINE_CHARS = 200;
// 1.5 digits per unit, as the exact ratio 3/2 so no float rounding enters.
export const DIGITS_PER_UNIT = Object.freeze({ numerator: 3, denominator: 2 });
const atRate = (units) =>
  Math.floor((units * DIGITS_PER_UNIT.numerator) / DIGITS_PER_UNIT.denominator);
// The three caps, written as numbers so the limits map lists them
// (lyric-harness/map/limits.md); the tests hold each to its derivation.
// floor(1.5 × (ADMISSION_MAX_LINE_CHARS + 1)):
export const METER_LINE_DIGITS_CAP = 301;
// ADMISSION_MAX_LINES × METER_LINE_DIGITS_CAP:
export const METER_REQUEST_DIGITS_CAP = 139_363;
// 3 × ADMISSION_MAX_LINES:
export const RAW_ROWS_CAP = 1_389;
if (
  METER_LINE_DIGITS_CAP !== atRate(ADMISSION_MAX_LINE_CHARS + 1) ||
  METER_REQUEST_DIGITS_CAP !== ADMISSION_MAX_LINES * METER_LINE_DIGITS_CAP ||
  RAW_ROWS_CAP !== 3 * ADMISSION_MAX_LINES
)
  throw new Error('meter_admission: a cap no longer matches its derivation');
export const ADMISSION_CAUSES = Object.freeze([
  'raw_rows',
  'meter_line_digits',
  'meter_request_digits',
]);

const codePoints = (s) => [...s].length;
// Physical rows of one string. Every break the tools' readers split on counts
// WHAT ONE ADMITTED LINE COSTS A RESPONSE (BB8 ruling 1). The largest
// recognition one line at the per-line cap can add to the default view,
// JSON-escaped as the bounded payload measures it, CANDIDATE ROWS INCLUDED:
// 7,507 B, at 301 digits (5,979 B without the candidate rows). Measured by
// lyric-harness/quality/test_meter_digit_bound.py over every surface the
// recognizer core can generate (`max_readings=1`, the default policy
// registry, every compared token guessed); it fails if the measurement moves
// or the candidate rows leave it. With 200 B per line for the withheld wrapper,
// 463 lines are 3,568,341 B, 42.5% of the 8 MiB default-view budget, before
// the response envelope, which is not measured yet. None of the caps above
// depends on it.
export const METER_LINE_RESPONSE_BYTES = 7_507;
export const METER_LINE_WRAPPER_BYTES = 200;
// ADMISSION_MAX_LINES × (METER_LINE_RESPONSE_BYTES + METER_LINE_WRAPPER_BYTES):
export const METER_REQUEST_RESPONSE_BYTES = 3_568_341;
if (
  METER_REQUEST_RESPONSE_BYTES !==
  ADMISSION_MAX_LINES * (METER_LINE_RESPONSE_BYTES + METER_LINE_WRAPPER_BYTES)
)
  throw new Error('meter_admission: the response figure no longer matches its derivation');
// (`\r\n`, a lone `\r`, `\n`), so no spelling of a break hides a row.
const rowsOf = (s) => s.split(/\r\n|\r|\n/).length;
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
        sets.push(recoverRowSet('lines_text', args.lines_text.replace(/\r\n?/g, '\n').split('\n')));
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
  const bp = blueprintTexts(args.blueprint);
  if (bp) sets.push(lineSetOfArray('blueprint.lines', bp));
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
  if (declaredLines.length)
    sets.push({
      name: 'pronunciations',
      family: null,
      rows: 0,
      lines: declaredLines,
      declaredOnly: true,
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
    ...(set.byRow ? { by_row: true } : {}),
    lines: set.lines.map((text, i) => {
      const bound = lineDigitBound(text, declarations);
      const id = set.declaredOnly
        ? bound.contributing.map((c) => pid(c.p)).join(', ')
        : set.ids
          ? set.ids[i]
          : lid(i + 1);
      return { id, ...bound };
    }),
  }));
  for (const set of measured)
    for (const line of set.lines)
      if (line.bound > METER_LINE_DIGITS_CAP) {
        const how = line.contributing.length
          ? `under its declared readings (${line.contributing
              .map((c) => `${pid(c.p)} ${c.digits}`)
              .join(
                ', '
              )}: ${fmt(line.declared_digits)} digits) and 1.5 digits per unit for its ${fmt(line.undeclared_units)} undeclared units`
          : `at 1.5 digits per unit for its ${fmt(line.undeclared_units)} units (each character and each token's separator)`;
        const which = set.declared_only
          ? `The line that ${line.id} declare${line.contributing.length > 1 ? '' : 's'} readings for is in no line set of this call, but an answer or a source reading can make it a sung line, and it`
          : set.by_row
            ? `The line at ${line.id} of \`${set.name}\` (lyric_recover numbers its sung lines after setting apparatus rows aside, so the row is named)`
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
  // the largest of them.
  const songs = [];
  let draft = null;
  for (const set of measured) {
    if (set.declared_only) continue;
    const song = {
      name: set.name,
      lines: set.lines.length,
      bound: set.lines.reduce((n, l) => n + l.bound, 0),
    };
    if (set.family !== 'draft') songs.push(song);
    else if (!draft || song.bound > draft.bound) draft = song;
  }
  if (draft) songs.unshift(draft);
  const total = songs.reduce((n, s) => n + s.bound, 0);
  if (total > METER_REQUEST_DIGITS_CAP) {
    const parts = songs
      .map((s) => `\`${s.name}\` ${fmt(s.lines)} lines, ${fmt(s.bound)}`)
      .join('; ');
    throw new AdmissionRefusal(
      'meter_request_digits',
      `the lines this call carries for recognition (${parts}) could reach ${fmt(total)} syllable digits together; the per-request cap is ${fmt(METER_REQUEST_DIGITS_CAP)}. This is an upper bound, not a count.`,
      {
        sets: songs.map((s) => s.name),
        bound: total,
        cap: METER_REQUEST_DIGITS_CAP,
      }
    );
  }
  return measured;
}

export const admitRecognitionArgs = (args, options) =>
  admitRecognitionInput(recognitionInputOf(args, options));
