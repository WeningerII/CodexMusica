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
// thing that stands (a flag or a banned pair, merged where the same thing
// stands on several lines), one line per line a requested obligation could not
// be judged on, and a count of notes. Everything else is still stored with the
// operation, and `get_operation` with `detail` returns it.
//
// ONLY THE SESSION VIEW CHANGES. The engine's verdict is unchanged: the
// website chat, the creation-order receipts, run continuation and the raw
// endpoints all read it whole, and the session stores it whole, so a detail
// read re-projects the stored result with nothing recomputed.
import { createHash } from 'node:crypto';
import { isStanding } from './lyric_tools.js';

export const SHORT_VIEW_TOOLS = new Set(['lyric_grade', 'lyric_revise', 'lyric_screen']);
export const DETAIL_PARTS = ['full', 'findings', 'report', 'coverage', 'pronunciations', 'pairs'];

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
  'loop_stop_reason',
  'loop_rounds',
  'loop_unresolved_lines',
  'loop_whole_flag_codes',
  // What verify made of the answer this call folded: the writer's own last
  // answer, accepted or not.
  'folded',
  'banned_pairs',
  'banned_pairs_reason',
  'structures_uncalibrated',
  'final_draft_sha256',
];

export const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

// The lines a refused obligation id names, in the grader's own spelling:
// `rhyme:I:J:K` and `return:I:J` name lines I and J, `prominence:LN` and
// `meter:CODE:LN` name line N. The same reading as the harness's
// quality/pronunciation.py refused_lines; any other id names no line.
export function obligationLines(id) {
  const p = String(id).split(':');
  if (['rhyme', 'return'].includes(p[0]) && /^\d+$/.test(p[1] ?? '') && /^\d+$/.test(p[2] ?? ''))
    return [Number(p[1]), Number(p[2])];
  if (['prominence', 'meter'].includes(p[0]) && /^L\d+$/.test(p.at(-1)))
    return [Number(p.at(-1).slice(1))];
  return null;
}

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
const lineList = (lines) => 'L' + [...new Set(lines)].sort((a, b) => a - b).join('/');

export function blockingOf(verdict) {
  const findings = Array.isArray(verdict.findings) ? verdict.findings : [];
  const out = [];
  const same = new Map();
  for (const f of findings.filter(isStanding)) {
    const h = head(f.evidence);
    const pair = comparedPair(f.evidence);
    const key = [f.code, f.message, h, pair].join('\u0000');
    if (!same.has(key)) same.set(key, { f, h, pair, lines: [] });
    same.get(key).lines.push(...(f.locations || []));
  }
  for (const { f, h, pair, lines } of same.values())
    out.push(
      `${lines.length ? lineList(lines) : 'whole draft'}: ${f.code} — ${f.message}` +
        (h ? ` (${h})` : '') +
        (pair ? `; compared ${pair}` : '')
    );
  const perLine = new Map();
  const unplaced = [];
  for (const id of verdict.coverage?.refused_obligations || []) {
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
  for (const n of [...perLine.keys()].sort((a, b) => a - b)) {
    const e = perLine.get(n);
    const why = [
      ...new Set(
        findings
          .filter((f) => WHY_UNJUDGED.test(f.code) && (f.locations || []).includes(n))
          .map((f) => f.code)
      ),
    ];
    const words = [
      ...new Set(options.filter((o) => o.matching_lines?.includes(n)).map((o) => o.word)),
    ];
    out.push(
      `L${n}: not judged — ${[...e.kinds].join(', ')}` +
        (e.partners.size ? ` with ${lineList([...e.partners])}` : '') +
        (why.length ? ` (${why.join(', ')})` : '') +
        (words.length ? `; words with more than one reading: ${words.join(', ')}` : '')
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

export function pairLine(p) {
  const out = [`${p.a} ~ ${p.b}` + (typeof p.score === 'number' ? ` ${p.score.toFixed(3)}` : '')];
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
  return [{ type: 'text', text: JSON.stringify(short) }];
}

export function sessionView(tool, content, { detail, lines } = {}) {
  if (!SHORT_VIEW_TOOLS.has(tool)) return content;
  if (tool === 'lyric_screen') return screenAt(content) < 0 ? content : screenView(content, detail);
  const at = verdictAt(content);
  if (at < 0 || detail === 'full') return content;
  const verdict = JSON.parse(content[at].text);
  if (detail) return [{ type: 'text', text: JSON.stringify(detailOf(verdict, detail, lines)) }];
  const short = {};
  for (const key of KEPT) if (verdict[key] !== undefined) short[key] = verdict[key];
  if (typeof verdict.presentation_text === 'string')
    short.presentation_sha256 = sha256(verdict.presentation_text);
  short.blocking = blockingOf(verdict);
  short.notes = (verdict.findings || []).filter((f) => !isStanding(f)).length;
  short.detail = DETAIL_NOTE;
  return [content[0], { type: 'text', text: JSON.stringify(short) }];
}

export function detailOf(verdict, part, lines) {
  const want = Array.isArray(lines) && lines.length ? new Set(lines) : null;
  const touches = (ns) => !want || (ns || []).some((n) => want.has(n));
  const out = { exit_code: verdict.exit_code, detail: part };
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
