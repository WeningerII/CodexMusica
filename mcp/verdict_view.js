// THE SESSION VERDICT (2026-09-29). A finished grade or revise read through
// get_operation published the engine's whole verdict: 296,166 characters for
// a 56-line grade and 253,254 for its revise, past what a client shows inline,
// so Claude Code wrote both to a file and the writer saw neither. Almost all
// of it was measurement nobody acts on — 239 findings, the terminal report
// restating them, 10,000 characters of per-obligation coverage, and the song
// three more times.
//
// What a writer does with a grade or a stopped revise is: read the verdict,
// present the song, and fix what stands. So on the session endpoints the
// default verdict is that and nothing else: the verdict fields, one line per
// thing that stands (a flag — ~~or a banned pair~~, dropped 2026-10-04 by the
// owner's ruling — merged where the same thing stands on several lines), one line per line a requested obligation could not
// be judged on, a count of notes with its kinds, and the coverage layers the
// request did not ask (so "certified" is not read as "singable"). Everything else is still stored with the
// operation, and `get_operation` with `detail` returns it.
//
// ONLY THE SESSION VIEW CHANGES. The engine's verdict is unchanged: the
// website chat, the creation-order receipts, run continuation and the raw
// endpoints all read it whole, and the session stores it whole, so a detail
// read re-projects the stored result with nothing recomputed.
import { createHash } from 'node:crypto';
import { isStanding } from './lyric_tools.js';
import { obligationLines, unjudgedWords } from './coverage_advice.js';

export const SHORT_VIEW_TOOLS = new Set([
  'lyric_grade',
  'lyric_revise',
  'lyric_screen',
  'lyric_check',
]);
export const DETAIL_PARTS = ['full', 'findings', 'report', 'coverage', 'pronunciations', 'pairs'];
// The detail parts each finished tool actually has. Any other part used to be
// answered rather than refused: a sweep returned its summary for every part, a
// screen returned `null` for coverage, and a grade `null` for pairs, so a caller
// asking for something the operation does not have was told it was empty.
export const DETAIL_FOR = {
  lyric_grade: ['findings', 'report', 'coverage', 'pronunciations', 'full'],
  lyric_revise: ['findings', 'report', 'coverage', 'pronunciations', 'full'],
  lyric_check: ['findings', 'report', 'coverage', 'pronunciations', 'full'],
  lyric_screen: ['pairs', 'findings', 'report', 'full'],
};
// The parts `lines` narrows (detailOf); on any other part it would be ignored.
export const LINE_PARTS = ['findings', 'coverage', 'pronunciations'];

// A requested obligation is unjudged because a reading was undecided or a
// word could not be read: these are the findings that say which, per line.
const WHY_UNJUDGED = /UNDECIDED|UNREADABLE|UNJUDGED|REFUSED/;
// The verdict fields a caller acts on, kept whole. `presentation_sha256` is
// added for a stopped revise, so the song in block 0 can be checked against
// the verdict without a second copy of it.
const KEPT = [
  'exit_code',
  'meaning',
  'measurement_status',
  'certified',
  'status',
  'refusal',
  'numbering_notices',
  'numbered_mandate',
  'loop_stop_reason',
  'loop_rounds',
  'loop_unresolved_lines',
  'loop_whole_flag_codes',
  // What verify made of the answer this call folded: the writer's own last
  // answer, accepted or not.
  'folded',
  // Owner-approved 2026-10-02 (LOOP_REDESIGN.md §2.0, §2.3d; Q4, Q5): why a
  // saved position was not used, and how many calls in a row made no progress.
  'cursor_stripped',
  'no_progress_calls',
  'banned_pairs',
  'banned_pairs_reason',
  'structures_uncalibrated',
  'final_draft_sha256',
  'lexicon',
  // Present only under a plan that replaced the session's first plan: what
  // that first plan asked and this one does not (lyric_workflow.js, #676).
  'plan_lineage',
];

// A coverage layer the request did not ask, named with what would ask it
// (quality/revise.py: "Undeclared setting coordinates remain outside
// certification").
const NOT_CHECKED = {
  meter: 'meter: no blueprint declared',
  slot_grid: 'slot grid: no subdivision declared',
  setting: 'setting (which syllable sits on which pulse): no beat grid or isochrony declared',
};

// One line per distinct thing not checked. An obligation that carries a
// `code` (function:FUNCTION_UNDECLARED:0) is named by it and by the finding
// that says what it means; a layer row (setting:draft) by what would ask it.
// A question that was never put has no finding, so its row carries the
// grader's sentence itself (function:CONTRAST_NOT_CHECKED:draft, #676). A
// layer row may carry one too (function:draft when no section declares a
// function): it is the grader's, and it is said rather than "not requested".
function notCheckedOf(verdict) {
  const findings = Array.isArray(verdict.findings) ? verdict.findings : [];
  const out = new Set();
  for (const o of verdict.coverage?.obligations || []) {
    if (o.status !== 'not_requested') continue;
    if (o.code) {
      const f = findings.find((x) => x.code === o.code);
      const said = f?.message || o.message;
      out.add(`${o.layer}: ${o.code}` + (said ? ` — ${said}` : ''));
    } else if (typeof o.message === 'string' && o.message.trim())
      out.add(`${o.layer}: ${o.message.trim()}`);
    else out.add(NOT_CHECKED[o.layer] ?? `${o.layer}: not requested`);
  }
  return [...out];
}

export const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

// The lines a refused obligation id names live in coverage_advice.js (a pure
// module, so the tool surface can read the same spelling without importing
// this file); re-exported here for the callers that always took it from here.
export { obligationLines };

// The first clause of a finding's evidence carries its numbers
// ("7 syllables, 6 slots"); the rest is its provenance, which stays in detail.
function head(evidence) {
  if (typeof evidence !== 'string') return '';
  let s = evidence.split(/\. |; | \(/)[0].trim();
  if (s.length > 110) s = s.slice(0, 107).replace(/\s+\S*$/, '') + '…';
  return s;
}
const comparedPair = (evidence) =>
  (typeof evidence === 'string' && evidence.match(/'[^']+' ~ '[^']+'/)?.[0]) || '';
// The clause(s) of its rule a failed pair fails, as the grader words them
// (revise.py: "where P is on L.. and Q on L.., it fails: ..."). The head
// above stops before it, and it is the one part of the evidence a writer can
// act on.
const failedClause = (evidence) =>
  (typeof evidence === 'string' &&
    evidence.match(/; (where P is on L\d+ and Q on L\d+, it fails: .+?)(?: \(score |$)/)?.[1]) ||
  '';
const lineList = (lines) => 'L' + [...new Set(lines)].sort((a, b) => a - b).join('/');

export function blockingOf(verdict) {
  const findings = Array.isArray(verdict.findings) ? verdict.findings : [];
  const out = [];
  const same = new Map();
  for (const f of findings.filter(isStanding)) {
    const h = head(f.evidence);
    const pair = comparedPair(f.evidence);
    const clause = failedClause(f.evidence);
    const key = [f.code, f.message, h, pair, clause].join('\u0000');
    if (!same.has(key)) same.set(key, { f, h, pair, clause, lines: [] });
    same.get(key).lines.push(...(f.locations || []));
  }
  for (const { f, h, pair, clause, lines } of same.values())
    out.push(
      `${lines.length ? lineList(lines) : 'whole draft'}: ${f.code} — ${f.message}` +
        (h ? ` (${h})` : '') +
        (pair ? `; compared ${pair}` : '') +
        (clause ? `; ${clause}` : '')
    );
  const perLine = new Map();
  const unplaced = [];
  const refused = verdict.coverage?.refused_obligations || [];
  const functionDetails = refused.filter(
    (id) => id.startsWith('function:') && id !== 'function:draft'
  );
  for (const id of refused) {
    // The aggregate remains refused in coverage; concrete failures below
    // already render its cause. Keep unlocated function failures visible.
    if (id === 'function:draft' && functionDetails.length && functionDetails.every(obligationLines))
      continue;
    const lines = obligationLines(id);
    if (!lines) {
      unplaced.push(id);
      continue;
    }
    for (const n of lines) {
      if (!perLine.has(n)) perLine.set(n, { kinds: new Set(), partners: new Set() });
      const e = perLine.get(n);
      e.kinds.add(String(id).split(':')[0]);
      for (const m of lines) if (m !== n) e.partners.add(m);
    }
  }
  const options = verdict.pronunciation_options?.items || [];
  const { unanchored } = unjudgedWords(verdict);
  for (const n of [...perLine.keys()].sort((a, b) => a - b)) {
    const e = perLine.get(n);
    const why = [
      ...new Set(
        findings
          .filter((f) => WHY_UNJUDGED.test(f.code) && (f.locations || []).includes(n))
          .map((f) => f.code)
      ),
    ];
    // The words with more than one reading on THIS line and on the lines it
    // could not be judged with, each named with its line: a rhyme between
    // L9 and L11 goes unjudged because of a word on either, and naming only
    // L11's (`the`, `a`) while `wire` on L9 was the cause sent a writer to
    // the wrong line (song run A, 2026-09-30).
    const wordsAt = (ln, predicate) => [
      ...new Set(
        options.filter((o) => o.matching_lines?.includes(ln) && predicate(o)).map((o) => o.word)
      ),
    ];
    const wordsFor = (predicate) =>
      [n, ...[...e.partners].sort((a, b) => a - b)]
        .map((ln) => [ln, wordsAt(ln, predicate)])
        .filter(([, ws]) => ws.length)
        .map(([ln, ws]) => `L${ln} ${ws.join(', ')}`);
    const words = wordsFor((o) => o.dictionary_readings?.length > 1);
    const unknown = wordsFor(
      (o) => Array.isArray(o.dictionary_readings) && o.dictionary_readings.length === 0
    );
    const failures = (verdict.coverage?.obligations || [])
      .filter(
        (o) => o.status === 'refused' && o.code === 'END_WORD_UNREADABLE' && o.line === n && o.word
      )
      .map((o) =>
        Number.isInteger(o.token)
          ? `token ${o.token} '${o.word}'`
          : `endpoint '${o.word}' (no sung-token position)`
      );
    // A member that lacks the place its group's type reads is the cause,
    // named as the grader sent it, and no dictionary reading has it: when
    // that is all this line was refused for, the two-reading words are not
    // listed as if choosing among them could help (a 100-line song,
    // 2026-11-15). Another word clears it, or a declared reading that has
    // the place.
    const pairLines = [n, ...e.partners];
    const lacking = unanchored.filter((m) => pairLines.includes(m.line));
    const onlyLacking = lacking.length > 0 && e.kinds.size === 1 && e.kinds.has('rhyme');
    out.push(
      `L${n}: not judged — ${[...e.kinds].join(', ')}` +
        (e.partners.size ? ` with ${lineList([...e.partners])}` : '') +
        (why.length ? ` (${why.join(', ')})` : '') +
        (lacking.length
          ? `; ${lacking
              .map(
                (m) =>
                  `no dictionary reading of L${m.line} '${m.word}' has a place to be read ${m.how}, which this group's type needs: change the word, or declare a reading that has it`
              )
              .join('; ')}`
          : '') +
        (failures.length ? `; unreadable: ${[...new Set(failures)].join(', ')}` : '') +
        (words.length && !onlyLacking
          ? `; words with more than one reading: ${words.join('; ')}`
          : '') +
        (unknown.length ? `; no dictionary reading listed: ${unknown.join('; ')}` : '')
    );
  }
  if (unplaced.length) out.push(`whole draft: not judged — ${unplaced.join(', ')}`);
  return out;
}

const DETAIL_NOTE =
  'The rest of this verdict is kept with the operation: get_operation with this operation_id and ' +
  'detail "findings", "report", "coverage", "pronunciations" or "full" (and lines: [n, ...] to ' +
  'narrow findings, coverage and pronunciations to those lines) returns it.';

// Whether a stored result gets the short view: a grade or a stopped revise
// whose findings were measured, published as the song and then the verdict.
// A suspended revise (its question and brief ARE the answer), a refusal and a
// single-block result keep the shape they have.
function verdictAt(content) {
  if (content.length !== 2) return -1;
  try {
    JSON.parse(content[0].text);
    return -1;
  } catch {
    /* block 0 is the song */
  }
  try {
    const v = JSON.parse(content[1].text);
    return Number.isInteger(v?.exit_code) && v.findings_measured === true ? 1 : -1;
  } catch {
    return -1;
  }
}

// THE CHECK (owner's plan, stage 1, 2026-11-15). A measured check is ONE
// block, its verdict: the caller pasted the lyrics, so no song block leads it.
// It gets the short verdict a grade gets; a refusal keeps its shape.
function checkAt(content) {
  if (content.length !== 1) return -1;
  try {
    const v = JSON.parse(content[0].text);
    return Number.isInteger(v?.exit_code) && v.findings_measured === true ? 0 : -1;
  } catch {
    return -1;
  }
}
const verdictIndex = (tool, content) =>
  tool === 'lyric_check' ? checkAt(content) : verdictAt(content);

// THE SCREEN (2026-09-30). A finished screen is ONE block: its verdict, the
// report table and every pair it screened, each with every relation, every
// schema and every schema that could not decide at the pair. Ten words are 45
// pairs and about 64,000 characters, most of it the same fifteen undecided
// schema names on every pair and the table restating the pairs. What a writer
// does with a screen is decide which pairs to write, so the session view is
// one line per pair (the ban, the relations it stands in, the declared
// relation's answer) and the report's own counts; `detail` returns the rest.
function screenAt(content) {
  if (content.length !== 1) return -1;
  try {
    const v = JSON.parse(content[0].text);
    return Number.isInteger(v?.exit_code) &&
      v.measurement_status === 'screened' &&
      Array.isArray(v.pairs)
      ? 0
      : -1;
  } catch {
    return -1;
  }
}

const SCREEN_KEPT = ['exit_code', 'meaning', 'measurement_status', 'refusal'];
const SCREEN_DETAIL_NOTE =
  'The rest of this screen is kept with the operation: get_operation with this operation_id and ' +
  'detail "pairs" (every pair in full: its schemas, the schemas undecided at the pair and the ' +
  'grader\'s sentences), "report" (the engine table) or "full" returns it.';

// The schema list a grader sentence names is counted, not repeated: it is the
// same list on every pair that cannot be resolved.
const countSchemas = (text) =>
  String(text).replace(
    /(schema\(s\)): (.+)$/,
    (_m, label, list) => `${list.split(', ').length} ${label}`
  );

// A pair the grader reports as standing in no relation is compared with no
// cut, so its total is span similarity only. Printed bare beside the cut the
// grader's sentence names, it read as a near pass (0.850 against 0.75).
const comparedWithNoCut = (p) =>
  !p.refused && !p.relations?.length && String(p.why ?? '').startsWith('NO_RELATION');

export function pairLine(p) {
  const score =
    typeof p.score !== 'number'
      ? ''
      : comparedWithNoCut(p)
        ? ` span similarity ${p.score.toFixed(3)} (no relation, so no cut applies)`
        : ` ${p.score.toFixed(3)}`;
  const out = [`${p.a} ~ ${p.b}` + score];
  if (p.codes?.length) out.push(`BANNED: ${p.codes.join(', ')}`);
  if (p.refused) out.push(`REFUSED${p.reason ? `: ${p.reason}` : ''}`);
  out.push(p.coarse_relations?.length ? p.coarse_relations.join(', ') : 'no coarse relation');
  if (p.schema_relations?.length) out.push(`schemas: ${p.schema_relations.join(', ')}`);
  if ('named' in p)
    out.push(
      p.named === true
        ? 'SATISFIES the declared relation'
        : p.named === false
          ? 'VIOLATES the declared relation'
          : `declared relation not judged${p.named_reason ? `: ${p.named_reason}` : ''}`
    );
  if (p.why) out.push(`grade: ${p.why}`);
  else if (p.reason && !p.refused) out.push(`grade: ${countSchemas(p.reason)}`);
  if (p.undecided?.length) out.push(`${p.undecided.length} schema(s) undecided`);
  return out.join(' — ');
}

function screenView(content, detail) {
  const v = JSON.parse(content[0].text);
  if (detail === 'full') return content;
  if (detail) {
    const out = { exit_code: v.exit_code, detail };
    if (detail === 'pairs' || detail === 'findings') out.pairs = v.pairs;
    else if (detail === 'report') out.report = v.report ?? null;
    else out[detail] = null;
    return [{ type: 'text', text: JSON.stringify(out) }];
  }
  const short = {};
  for (const key of SCREEN_KEPT) if (v[key] !== undefined) short[key] = v[key];
  short.pairs = v.pairs.map(pairLine);
  // The report's own counts, never recomputed here: the harness partitions
  // banned / refused / standing / none, and a second partition could differ.
  short.counts = String(v.report || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\d+ banned, \d+ refused, /.test(l) || l.startsWith('NAMED COUNTS:'));
  short.detail = SCREEN_DETAIL_NOTE;
  // Who acts next, as data: after a screen that answered, the plan.
  if (v.outcome && typeof v.outcome === 'object') short.outcome = v.outcome;
  return [{ type: 'text', text: JSON.stringify(short) }];
}

// What a finished result can serve to `detail`, read from the result itself:
// whether it carries a verdict with parts at all (a revise suspended on a
// question, at exit 4, does not), and how many lines its song has. The count is
// the verdict's own final_draft, not the call's arguments (a revise continued
// with `answers`, or a grade sent as draft_text, has no `draft`) and not block
// 0's physical lines, which carry section headers, blanks and the footer: a
// 12-line song read as 31 there (Jony's re-check).
export function verdictShape(tool, content) {
  if (!Array.isArray(content)) return { ready: false, lines: null };
  if (tool === 'lyric_screen') return { ready: screenAt(content) >= 0, lines: null };
  const at = verdictIndex(tool, content);
  if (at < 0) return { ready: false, lines: null };
  const draft = JSON.parse(content[at].text).final_draft;
  return { ready: true, lines: Array.isArray(draft) && draft.length ? draft.length : null };
}

export function sessionView(tool, content, { detail, lines } = {}) {
  if (!SHORT_VIEW_TOOLS.has(tool)) return content;
  if (tool === 'lyric_screen') return screenAt(content) < 0 ? content : screenView(content, detail);
  const at = verdictIndex(tool, content);
  if (at < 0 || detail === 'full') return content;
  const verdict = JSON.parse(content[at].text);
  if (detail) return [{ type: 'text', text: JSON.stringify(detailOf(verdict, detail, lines)) }];
  const short = {};
  for (const key of KEPT) if (verdict[key] !== undefined) short[key] = verdict[key];
  if (typeof verdict.presentation_text === 'string')
    short.presentation_sha256 = sha256(verdict.presentation_text);
  short.blocking = blockingOf(verdict);
  const notes = (verdict.findings || []).filter((f) => !isStanding(f));
  short.notes = notes.length;
  // What the count is made of, so 48 meter notes on 16 lines are not read as
  // 48 unrelated remarks; and what certification did NOT cover, so
  // "certified" is not read as "singable" (both found on two songs, 2026-10-18).
  const byCode = {};
  for (const f of notes) byCode[f.code] = (byCode[f.code] || 0) + 1;
  short.notes_by_code = Object.fromEntries(
    Object.entries(byCode).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  );
  if (verdict.coverage) short.not_checked = notCheckedOf(verdict);
  short.detail = DETAIL_NOTE;
  // Who acts next, as data (lyric_workflow.js, outcomeOf): the verdict's
  // own field, copied ahead of the call and the sentence that say the same.
  if (verdict.outcome && typeof verdict.outcome === 'object') short.outcome = verdict.outcome;
  // The grade's own next call (exit 0 or 3), copied last; never invented
  // here. `next_call` is its tool and the args the server sets, not the whole
  // call (#671, B9).
  if (
    verdict.next_call &&
    typeof verdict.next_call === 'object' &&
    typeof verdict.next_call.tool === 'string'
  )
    short.next_call = verdict.next_call;
  if (typeof verdict.next === 'string') short.next = verdict.next;
  // The blocks before the verdict (a grade's song) stay exactly as stored.
  return [...content.slice(0, at), { type: 'text', text: JSON.stringify(short) }];
}

export function detailOf(verdict, part, lines) {
  const want = Array.isArray(lines) && lines.length ? new Set(lines) : null;
  const touches = (ns) => !want || (ns || []).some((n) => want.has(n));
  const out = { exit_code: verdict.exit_code, detail: part };
  if (verdict.lexicon !== undefined) out.lexicon = verdict.lexicon;
  if (want) out.lines = [...want].sort((a, b) => a - b);
  if (part === 'findings')
    out.findings = (verdict.findings || []).filter((f) => touches(f.locations));
  else if (part === 'report') out.report = verdict.report ?? null;
  else if (part === 'coverage') {
    const cov = verdict.coverage;
    out.coverage =
      cov && want
        ? {
            ...cov,
            obligations: (cov.obligations || []).filter((o) =>
              touches(Number.isInteger(o.line) ? [o.line] : obligationLines(o.id))
            ),
          }
        : (cov ?? null);
  } else if (part === 'pairs') out.pairs = verdict.pairs ?? null;
  else if (part === 'pronunciations') {
    out.pronunciations = verdict.pronunciations ?? [];
    const opts = verdict.pronunciation_options;
    out.pronunciation_options =
      opts && want
        ? { ...opts, items: (opts.items || []).filter((o) => touches(o.matching_lines)) }
        : (opts ?? null);
  }
  return out;
}
