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
//                        one line set's normalised lines.
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
// CHECK ORDER (BB8): raw rows for every line set first, the cheapest check and
// the one that bounds the rest; then every normalised line; then each line
// set's total.
//
// A LINE SET is one sequence of lines the recognizer would read: `draft`,
// `draft_text`, `lines`, `lines_text`, `before`/`after` and their text twins,
// a continuation's `input_draft` and `accepted_lines`, and a declared
// blueprint's line texts. A revision's `answer`/`answers` are not a set: each
// replaces one line of a draft that was admitted, and each is refused at 200
// characters before any work (ANSWER_TOO_LONG and the `answers` schema), so it
// stays inside the per-line cap undeclared. The per-request cap applies to
// each set: two sets of one request (lyric_verify's `before` and `after`) are
// two songs, each inside the cap.

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
  // One reading per token: a repeated (line, token) is refused later as a
  // duplicate; here it is counted once, at its largest reading.
  const byToken = new Map();
  for (const d of declarations) {
    if (d.line !== text) continue;
    const key = Number.isInteger(d.token) ? d.token : `?${d.index}`;
    const vowels = stressedVowels(d.phones);
    const held = byToken.get(key);
    if (!held || vowels > held.vowels) byToken.set(key, { ...d, vowels });
  }
  let declaredDigits = 0;
  let declaredUnits = 0;
  const contributing = [];
  for (const d of byToken.values()) {
    declaredDigits += d.vowels;
    const word = typeof d.word === 'string' ? d.word.replace(OPENING_MARK, '') : '';
    declaredUnits += codePoints(word) + 1;
    contributing.push({ p: d.index, token: d.token, digits: d.vowels });
  }
  const undeclaredUnits = Math.max(0, units - declaredUnits);
  return {
    bound: declaredDigits + atRate(undeclaredUnits),
    declared_digits: declaredDigits,
    undeclared_units: undeclaredUnits,
    contributing: contributing.sort((a, b) => a.p - b.p),
  };
}

const lineSetOfArray = (name, items) => ({
  name,
  rows: items.reduce((n, item) => n + (typeof item === 'string' ? rowsOf(item) : 1), 0),
  lines: normalizeDraftLines(items).filter((l) => typeof l === 'string'),
});
const lineSetOfText = (name, text) => ({ name, rows: rowsOf(text), lines: draftFromText(text) });

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
export function recognitionInputOf(args = {}) {
  const sets = [];
  for (const [arrayName, textName] of [
    ['draft', 'draft_text'],
    ['lines', 'lines_text'],
    ['before', 'before_text'],
    ['after', 'after_text'],
  ]) {
    // `lines` is also a line COUNT on the planning tools: only an array is a set.
    if (Array.isArray(args[arrayName])) sets.push(lineSetOfArray(arrayName, args[arrayName]));
    if (typeof args[textName] === 'string') sets.push(lineSetOfText(textName, args[textName]));
  }
  let carried = null;
  for (const field of ['state', 'checkpoint']) {
    const decoded = continuationOf(args[field]);
    if (!decoded) continue;
    for (const key of ['input_draft', 'accepted_lines'])
      if (Array.isArray(decoded[key])) sets.push(lineSetOfArray(`${field}.${key}`, decoded[key]));
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
    }))
    .filter((d) => typeof d.line === 'string');
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
    rows: set.rows,
    lines: set.lines.map((text, i) => ({ id: lid(i + 1), ...lineDigitBound(text, declarations) })),
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
        throw new AdmissionRefusal(
          'meter_line_digits',
          `${line.id} of \`${set.name}\` could reach ${fmt(line.bound)} syllable digits ${how}; the per-line cap is ${fmt(METER_LINE_DIGITS_CAP)}. This is an upper bound, not a count of the line.`,
          {
            set: set.name,
            line: line.id,
            bound: line.bound,
            cap: METER_LINE_DIGITS_CAP,
            declarations: line.contributing.map((c) => pid(c.p)),
          }
        );
      }
  for (const set of measured) {
    const total = set.lines.reduce((n, l) => n + l.bound, 0);
    if (total > METER_REQUEST_DIGITS_CAP)
      throw new AdmissionRefusal(
        'meter_request_digits',
        `the ${fmt(set.lines.length)} lines of \`${set.name}\` could reach ${fmt(total)} syllable digits together; the per-request cap is ${fmt(METER_REQUEST_DIGITS_CAP)}. This is an upper bound, not a count.`,
        { set: set.name, bound: total, cap: METER_REQUEST_DIGITS_CAP }
      );
  }
  return measured;
}

export const admitRecognitionArgs = (args) => admitRecognitionInput(recognitionInputOf(args));
