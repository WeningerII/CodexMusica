// Creation qualifications are host-owned receipts from executed tools. Model
// arguments and completedSteps are never evidence that a step occurred.
import { createHash } from 'node:crypto';
import { draftFromText, normalizeDraftLines } from './lyric_text.js';
import { refusedByRemedy } from './coverage_advice.js';

// The form a plan request gets when it names none (`quality/plan.py`
// DEFAULT_FORM): `open` requires no section function and no return.
export const DEFAULT_FORM = 'open';

// STATE IT OR SAY DRAW (writer plan, stage 3). A new song's lyric_sweep states
// each of these things: a value in its field, a sweep `want` on one of its
// `wants` names (a name ending `.*` stands for that name with any section
// function), or, where `draw` is true, its field named in `draw`. There is no
// draw over forms, so form takes a name. The `wants` names are the planner's
// own (`quality/plan.py` SWEEP_MEASURES, SWEEP_SETS and SWEEP_ORDERS),
// checked there by test_high_report. A want states sections when it bounds
// how many there are or which functions appear: `uses` and `before` hold
// only where each function they name is drawn. It states time when it bounds
// a line's beats, bars or slots. `lines_per_section` bounds a section's
// lines, not the song's, so it states no length.
export const STATEABLE = Object.freeze([
  { thing: 'form', field: 'form', draw: false, wants: [] },
  { thing: 'length', field: 'lines', draw: true, wants: ['lines'] },
  {
    thing: 'sections',
    field: 'functions',
    draw: true,
    wants: ['sections', 'sections.*', 'uses', 'before'],
  },
  { thing: 'rhyme', field: 'relation', draw: true, wants: [] },
  {
    thing: 'time',
    field: 'melody',
    draw: true,
    wants: ['beats_per_line', 'bars_per_line', 'slots_per_line'],
  },
]);
export const DRAWABLE = Object.freeze(STATEABLE.filter((r) => r.draw).map((r) => r.field));
// What no field or want can state yet: the planner draws it every time.
export const NOT_STATEABLE_YET = Object.freeze([
  { thing: 'rhyme scheme', what: "the letter scheme of each section's lines" },
  { thing: 'stress pattern', what: 'which syllables of a line are stressed' },
]);
// One row per planner form (`quality/plan.py` PLAN_FORMS): the functions it
// requires (FORM_REQUIRES), the ones that must come back (FORM_RECURS), and
// its fewest lines (min of fillable_line_counts). Pinned to the planner by
// test_high_report; PLAN_FORMS (lyric_tools.js) is read from it.
export const FORM_ROWS = Object.freeze([
  { form: 'open', requires: [], recurs: [], min_lines: 2 },
  { form: 'verse-chorus', requires: ['chorus', 'verse'], recurs: ['chorus'], min_lines: 12 },
]);
// The planner's length floor is the smallest form's fewest lines.
export const LINES_FLOOR = Math.min(...FORM_ROWS.map((r) => r.min_lines));

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const list = (value) =>
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map((v) => String(v).trim())
    .filter(Boolean)
    .sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// The declarations a plan is a function of, and the reading declarations a
// grade is taken under. Exported so the published tool text names exactly
// the fields these receipts compare.
export const PLAN_FIELDS = [
  'seed',
  'form',
  'lines',
  'relation',
  'group_types',
  'functions',
  'title',
  'narrative',
  'melody',
  'wants',
];
// What a plan declares that no sweep carries: kept when a stale plan is
// planned again (nextCreationCall).
const PLAN_ONLY_KEPT = ['title', 'narrative', 'group_types'];
export const READING_FIELDS = [
  'pronunciations',
  'fallback',
  'voices',
  'lexicon_supplement',
  'lexicon_supplement_sha256',
];
// A grade receipt without a supplement predates the field: it was read on
// CMUdict alone, and a revision it starts stays there (lexicon_basis.js).
const readingValue = (key, value) =>
  value ??
  (key === 'pronunciations'
    ? []
    : key === 'voices'
      ? false
      : key === 'lexicon_supplement'
        ? 'none'
        : null);
// -> the reading basis the grade's AUTHENTICATED record names, or null when it
// names none. The default a grade read under is the tool's to apply, so the
// receipt takes it from the verdict, never from the call's arguments.
const gradedLexicon = (verdict) => {
  const l = verdict?.lexicon;
  if (!l || typeof l !== 'object') return null;
  if (l.supplement_id === null && l.sha256 === null)
    return { lexicon_supplement: 'none', lexicon_supplement_sha256: null };
  return typeof l.supplement_id === 'string' &&
    typeof l.sha256 === 'string' &&
    /^[0-9a-f]{64}$/.test(l.sha256)
    ? { lexicon_supplement: l.supplement_id, lexicon_supplement_sha256: l.sha256 }
    : null;
};
const UNPLANNED_FIELDS = [
  'scheme',
  'groups',
  'returns',
  'numbering',
  'structures',
  'blueprint',
  'subdivision',
];
// plan.request carries the Python parser's structured story declaration;
// MCP carries the same declaration as ATOM,ATOM/JUNCTION cells.
const narrative = (value) => {
  if (value === undefined || value === null || value === false || value === '') return null;
  if (typeof value === 'object' && Array.isArray(value.atoms) && Array.isArray(value.junctions))
    return { atoms: [...value.atoms], junctions: [...value.junctions] };
  if (typeof value !== 'string') return value;
  if (value.trim().toLowerCase() === 'off') return 'off';
  const cells = value
    .split(',')
    .map((cell) => cell.split('/').map((part) => part.trim().toUpperCase()));
  if (cells.some((cell, i) => cell.length !== (i ? 2 : 1) || cell.some((part) => !part)))
    return value;
  return { atoms: cells.map((cell) => cell[0]), junctions: cells.slice(1).map((cell) => cell[1]) };
};
const narrativeArgument = (value) => {
  const n = narrative(value);
  return n && typeof n === 'object' && Array.isArray(n.atoms) && Array.isArray(n.junctions)
    ? n.atoms.map((atom, i) => (i ? `${atom}/${n.junctions[i - 1]}` : atom)).join(',')
    : n;
};
const ordered = (value) =>
  Array.isArray(value)
    ? value.map(ordered)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, ordered(value[k])])
        )
      : value;
const melodyValue = (value) => {
  if (typeof value !== 'string') return ordered(value ?? null);
  try {
    return ordered(JSON.parse(value));
  } catch {
    return value;
  }
};
// Each group's chosen type, as the plan's request records it.
const groupTypes = (value) =>
  Array.isArray(value) && value.length
    ? value.map((e) => ({ group: e?.group, type: e?.type }))
    : null;
const norm = (key, value) =>
  key === 'melody'
    ? melodyValue(value)
    : key === 'group_types'
      ? groupTypes(value)
      : key === 'functions' || key === 'wants'
        ? list(value)
        : key === 'form'
          ? value || DEFAULT_FORM
          : key === 'narrative'
            ? narrative(value)
            : value === ''
              ? null
              : (value ?? null);
const create = (task) => task?.domain === 'lyrics' && task.phase !== 'edit';
const edit = (task) => task?.domain === 'lyrics' && task.phase === 'edit';
// The calls that make a new song: a sweep, a plan, and a grade or revise of a
// seeded plan. An edit session refuses them, the mirror of the create
// session's refusal of lyric_check and lyric_recover (issue #671, B1).
const newSongCall = (name, args) =>
  ['lyric_sweep', 'lyric_plan'].includes(name) ||
  (['lyric_grade', 'lyric_revise'].includes(name) && args?.seed != null);
// The seed of the run a host is holding, whichever shape holds it: the SDK's
// continuation (`args`), or the chat's carried record (`seed`, `decl`). A
// revise that continues a held seeded run is a new-song call even when the
// caller leaves the seed out, because the run's own state carries it.
const heldSeed = (lyric) => lyric?.args?.seed ?? lyric?.seed ?? lyric?.decl?.seed ?? null;
const continuesSeededRun = (name, args, lyric) =>
  name === 'lyric_revise' && !args?.new_run && heldSeed(lyric) != null;
const answered = (v) => v && Number.isInteger(v.exit_code) && [0, 3].includes(v.exit_code);
// A screen or grade that ran but left no receipt is kept as an ATTEMPT beside
// the receipts: what it exited with, and a flag for the one cause the refusal
// texts can act on. Nothing that admits a call reads it; the report the call
// returned says why. 'overflow' is the bridge's output-cap refusal, keyed on
// its phrase (python_bridge.js); 'not_kept' is marked by the session layer
// when the store refused a measured result as too large (workflow_sessions.js).
const OVERFLOW = /printed more than this connector can carry/;
const attemptOf = (verdict, extra = {}) => ({
  ...extra,
  exit_code: Number.isInteger(verdict.exit_code) ? verdict.exit_code : null,
  ...(typeof verdict.measurement_status === 'string'
    ? { measurement_status: verdict.measurement_status }
    : {}),
  cause: OVERFLOW.test(String(verdict.refusal || '')) ? 'overflow' : 'other',
});
const attemptFacts = (a) =>
  [
    a.exit_code != null ? `exit ${a.exit_code}` : null,
    a.measurement_status ? `measurement_status ${a.measurement_status}` : null,
  ]
    .filter(Boolean)
    .join(', ');
const screenAttemptNote = (a) =>
  ` lyric_screen ran in this session but did not answer${attemptFacts(a) ? ` (${attemptFacts(a)})` : ''}` +
  (a.cause === 'overflow'
    ? ': it printed more than this connector can carry, so screening the same request again returns the same result. A grade needs one lyric_screen under its plan that answers (exit 0 or 3): call lyric_screen again with a smaller request.'
    : '; its report names why. A grade needs one lyric_screen under its plan that answers (exit 0 or 3): call lyric_screen again once that cause is fixed.');
// The song's length is the user's: a size limit is reported as this
// session's limit, never answered by asking for a shorter song.
// `sent` is whether this call carried the draft the attempt ran on: a revise
// that sent none can only be told about the draft last sent to lyric_grade.
const gradeAttemptNote = (a, lines, sent = true) => {
  const facts = attemptFacts(a) ? ` (${attemptFacts(a)})` : '';
  const limit =
    "that limit is this session's, not the song's: report it to the user with the song's length unchanged";
  const exact = sent ? 'this exact draft' : 'the draft last sent to it';
  const same = sent ? 'this same draft' : 'that same draft';
  const it = sent ? 'this draft' : 'that draft';
  if (a.cause === 'not_kept')
    return ` lyric_grade measured ${exact}${facts}, but its result was over the size this session can keep, so nothing it produced was kept and no grade receipt was written. Grading ${same} again returns the same result: ${limit}, or call lyric_grade on a different draft of this plan (it may be too large as well).`;
  if (a.cause === 'overflow')
    return ` lyric_grade ran on ${exact} but did not answer with a grade receipt${facts}: it printed more than this connector can carry. Grading ${same} again returns the same result: ${limit}, or grade a different draft of this plan's ${lines} lines. Neither is known to be a cure.`;
  return ` lyric_grade ran on ${exact} but did not answer with a grade receipt${facts}; its report names why. Read that report for the cause, then call lyric_grade again on ${it} once it is fixed.`;
};
// A revise sent a draft other than the one graded under the plan. `graded` is
// the grade receipt; one recorded before the draft's text was kept holds its
// fingerprint only, so no line can be named and no draft taken from it.
const SHOWN_DIFFERING = 12;
function notTheGradedDraft(graded, draft, seed) {
  const kept = Array.isArray(graded.draft);
  const at = kept
    ? draft.map((line, i) => (line === graded.draft[i] ? 0 : i + 1)).filter(Boolean)
    : [];
  const shown = at.slice(0, SHOWN_DIFFERING).join(', ');
  const where = !at.length
    ? ''
    : at.length === 1
      ? `: line ${shown} differs`
      : `: lines ${shown}${at.length > SHOWN_DIFFERING ? ` and ${at.length - SHOWN_DIFFERING} more` : ''} differ`;
  return (
    ` This draft is not the one lyric_grade graded under this plan${where}.` +
    (kept ? ' To revise the graded draft, send this call again without a draft.' : '') +
    ` To keep this draft, call lyric_grade with seed ${seed} and this draft first.`
  );
}
// The handler validates the original envelope and forbids all execution fields.
// A requested export must reach it unchanged, even when malformed, and never
// counts as planning, repair or completed work.
export const isRecoveryOnly = (name, args) =>
  name === 'lyric_revise' && args?.recover_only === true;

// A bare recover_only from a model that never holds the wire (/chat keeps the
// run's continuation server-side): the carried one fills it in — its
// checkpoint first, as a resume would use it, else its state. The run
// ledger's refusals name recover_only as the way out, which a model on /chat
// could otherwise never take (Jony's review, #519). An explicit wire wins.
export function recoveryWire(args, lyr) {
  if (args?.state != null || args?.checkpoint != null || !lyr) return null;
  if (typeof lyr.checkpoint === 'string') return { checkpoint: lyr.checkpoint };
  if (typeof lyr.state === 'string') return { state: lyr.state };
  return null;
}

// A refusal can be the answer to a requested assessment. A lone certification
// boolean cannot prove that assessment happened or account for its obligations.
export function assessmentCoverageValid(coverage) {
  if (!coverage || coverage.scope !== 'requested_layers') return false;
  const counts = ['pairs_mandated', 'pairs_judged', 'pairs_refused'].map((k) => coverage[k]);
  if (counts.some((n) => !Number.isSafeInteger(n) || n < 0) || counts[0] !== counts[1] + counts[2])
    return false;
  const rows = coverage.obligations,
    refused = coverage.refused_obligations;
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    !Array.isArray(refused) ||
    rows.some(
      (row) =>
        !row ||
        typeof row.id !== 'string' ||
        !row.id ||
        !['answered', 'refused', 'not_requested'].includes(row.status)
    ) ||
    !rows.some((row) => row.status !== 'not_requested')
  )
    return false;
  const actualRefused = rows.filter((row) => row.status === 'refused').map((row) => row.id);
  const rhyme = rows.filter((row) => row.id.startsWith('rhyme:'));
  return (
    new Set(rows.map((row) => row.id)).size === rows.length &&
    same(actualRefused, refused) &&
    typeof coverage.certified === 'boolean' &&
    coverage.certified === (refused.length === 0) &&
    rhyme.length === counts[0] &&
    rhyme.filter((row) => row.status === 'answered').length === counts[1] &&
    rhyme.filter((row) => row.status === 'refused').length === counts[2]
  );
}

export function workflowFor(task) {
  if (!create(task)) return null;
  task.phase = 'create';
  if (!task.workflow || task.workflow.version !== 1)
    task.workflow = {
      version: 1,
      sweeps: [],
      screen: null,
      plan: null,
      grade: null,
      started: null,
    };
  return task.workflow;
}

// The coordinates a plan must repeat from the sweep that accepted its seed.
// `relation` joined them with the sweep's own `relation` (stage 3); a sweep
// saved before that, which states no relation, does not bind the plan's.
export const SWEEP_COORDINATES = ['form', 'lines', 'functions', 'relation', 'melody'];
// The `wants` a creation session requires a plan to carry for a sweep: today,
// that sweep's `want` list. The one place the rule is read, by the gate and
// by the call it names (nextCreationCall).
const sweepWants = (sweep) => list(sweep.args.want);
const coordinatesOf = (s) =>
  SWEEP_COORDINATES.filter(
    (k) => k !== 'relation' || s.args.relation !== undefined || list(s.args.draw).includes(k)
  );
// A relation as the planner reads it: the namespace and the name each
// matched without case or outer spaces (`rhyme_types.resolve_relation`; no
// namespace holds two names that differ only in case, checked by
// test_statements). `same` on the raw strings refused a plan whose request
// holds the planner's spelling of the relation the call sent.
const relationKey = (value) => {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (!text) return null;
  const at = text.indexOf(':');
  return at < 0
    ? text.toLowerCase()
    : `${text.slice(0, at).trim().toLowerCase()}:${text
        .slice(at + 1)
        .trim()
        .toLowerCase()}`;
};
const sameField = (key, a, b) =>
  key === 'relation' ? relationKey(a) === relationKey(b) : same(norm(key, a), norm(key, b));
// A declaration sent against the one a plan's request recorded for it: the
// same, or for a relation sent with no namespace, the namespace the planner
// resolved it to (it refuses a bare name two namespaces hold).
const sameDeclared = (key, sent, recorded) => {
  if (sameField(key, sent, recorded)) return true;
  const bare = key === 'relation' ? relationKey(sent) : null;
  const planned = bare && !bare.includes(':') ? relationKey(recorded) : null;
  return !!planned && planned.slice(planned.indexOf(':') + 1) === bare;
};

// `anyForm`: a plan that leaves its form out takes the form of the newest
// sweep that matches it otherwise.
function sweepFor(w, args, { anyForm = false } = {}) {
  return [...w.sweeps]
    .reverse()
    .find(
      (s) =>
        s.accepted.includes(args.seed) &&
        coordinatesOf(s).every(
          (k) => (anyForm && k === 'form') || sameField(k, args[k], s.args[k])
        ) &&
        same(list(args.wants), sweepWants(s))
    );
}

// The newest sweep the recorded plan matches: it accepted the plan's seed,
// and each of its coordinates and its `want` list is the plan request's (the
// planner's own spelling of a relation the sweep sent bare included).
function planSweep(w) {
  const r = w.plan?.request;
  if (!r) return null;
  return (
    [...w.sweeps]
      .reverse()
      .find(
        (s) =>
          s.accepted.includes(r.seed) &&
          coordinatesOf(s).every((k) => sameDeclared(k, s.args[k], r[k])) &&
          same(list(r.wants), sweepWants(s))
      ) || null
  );
}

// A recorded plan declaration in the argument form the tools take, as the
// gate writes it back when a call leaves the declaration out.
const planArgument = (key, value) =>
  key === 'functions' && Array.isArray(value)
    ? value.join(',')
    : key === 'narrative'
      ? narrativeArgument(value)
      : key === 'melody'
        ? JSON.stringify(value)
        : structuredClone(value);
const unset = (v) => v === null || v === '' || (Array.isArray(v) && !v.length);

// ── State it or say draw ───────────────────────────────────────────────────
const joined = (items, word = 'and') =>
  items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} ${word} ${items[items.length - 1]}`;
// `draw` as one list: each name once, in table order (a name outside the
// table, which the schema refuses, after them).
export const drawList = (value) => {
  const named = new Set(list(value));
  return [...DRAWABLE.filter((f) => named.delete(f)), ...[...named].sort()];
};
const hasValue = (args, field) => args?.[field] !== undefined && !unset(args[field]);
const wantName = (want) =>
  String(want)
    .split(/<=|>=|=/)[0]
    .trim();
const wantStates = (row, want) =>
  row.wants.some((k) =>
    k.endsWith('.*')
      ? wantName(want).startsWith(k.slice(0, -1)) && wantName(want).length > k.length - 1
      : wantName(want) === k
  );
// -> for one call's arguments: each STATEABLE row with how this call said it
// ('value', 'want', 'draw' or null) and the wants that said it, the rows it
// does not say, and the drawable fields it gives both a value and a draw.
// `wantKey` is the sweep's `want` or the plan's `wants`.
export function statementsOf(args, wantKey = 'want') {
  const drawn = new Set(list(args?.draw));
  const wants = Array.isArray(args?.[wantKey]) ? args[wantKey].map(String) : [];
  const rows = STATEABLE.map((row) => {
    const by = wants.filter((w) => wantStates(row, w));
    const said = hasValue(args, row.field)
      ? 'value'
      : by.length
        ? 'want'
        : row.draw && drawn.has(row.field)
          ? 'draw'
          : null;
    return { row, said, wants: by };
  });
  return {
    rows,
    missing: rows.filter((s) => !s.said).map((s) => s.row),
    conflict: DRAWABLE.filter((f) => drawn.has(f) && hasValue(args, f)),
  };
}
// -> {field: whether this call states it}: a value, a stating want, or a draw.
export const statedFields = (args, wantKey = 'want') =>
  Object.fromEntries(statementsOf(args, wantKey).rows.map((s) => [s.row.field, !!s.said]));
const rowName = (r) => (r.thing === r.field ? r.field : `${r.thing} (${r.field})`);
const wantLabel = (k) => (k.endsWith('.*') ? `${k.slice(0, -1)}F` : k);
// `floor` false leaves out the form's fewest lines: published schema text
// states no line count (test_prompt_provenance); a refusal states it.
export const formRowText = (f, floor = true) => {
  const needs = [
    ...f.requires.map((fn) => (f.recurs.includes(fn) ? `${fn} at least twice` : fn)),
    ...f.recurs.filter((fn) => !f.requires.includes(fn)).map((fn) => `${fn} at least twice`),
    ...(floor && f.min_lines > LINES_FLOOR ? [`at least ${f.min_lines} lines`] : []),
  ];
  return `${f.form}, which requires ${needs.length ? joined(needs) : 'nothing'}`;
};
// -> what a STATEABLE field's own description says a new-song session's
// lyric_sweep needs of it, read from its row.
export const sweepNeeds = (field) => {
  const r = STATEABLE.find((row) => row.field === field);
  const ways = [
    "this field's value",
    ...(r.wants.length ? [`a \`want\` on ${joined(r.wants.map(wantLabel), 'or')}`] : []),
    ...(r.draw ? [`\`${r.field}\` in \`draw\``] : []),
  ];
  return `A new-song session's lyric_sweep needs ${ways.length < 2 ? ways[0] : `one of these: ${ways.join('; ')}`}.`;
};
const NOT_YET_TEXT = joined(NOT_STATEABLE_YET.map((r) => `${r.thing} (${r.what})`));
const named = STATEABLE.filter((r) => !r.draw).map((r) => r.field);
const STATEMENT_RULE =
  `a new song's lyric_sweep states each of ${joined(STATEABLE.map(rowName))}: a value, or the field named in \`draw\` ` +
  `(${joined(named)} takes a name; there is no draw over ${joined(named.map((f) => `${f}s`))}). ` +
  `A \`want\` on ${joined(
    STATEABLE.filter((r) => r.wants.length).map(
      (r) => `${joined(r.wants.map(wantLabel), 'or')} states ${r.thing}`
    )
  )}.`;
// -> the refusal of a value and a draw for the same field, or null.
export function statementConflict(fields, code = 'CREATION_STATEMENT') {
  if (!fields.length) return null;
  return `${code}: ${joined(fields)} ${fields.length === 1 ? 'has a value and is' : 'each have a value and are'} also named in \`draw\`; send one of the two${fields.length === 1 ? '' : ' for each'}. Nothing ran.`;
}
// What is left out is the person's to choose: the writer asks them, and a
// draw is a choice the person makes too.
export const ASK_PERSON =
  'Ask the person for each one they have not said; a draw is theirs to choose too. Do not choose for them.';
// -> a new-song sweep's refusal for what it does not state, or null.
export function statementRefusal(args) {
  const { missing, conflict } = statementsOf(args);
  if (conflict.length) return statementConflict(conflict);
  if (!missing.length) return null;
  const forms = missing.some((r) => !r.draw)
    ? ` ${named.map((f) => f[0].toUpperCase() + f.slice(1)).join(', ')} takes one name: ${FORM_ROWS.map(formRowText).join('; ')}.`
    : '';
  return (
    `CREATION_STATEMENT: ${STATEMENT_RULE} This call leaves out ${joined(missing.map(rowName))}. Nothing ran.` +
    ` ${ASK_PERSON}` +
    forms +
    ` Cannot be stated yet, so tell the person: ${NOT_YET_TEXT}.`
  );
}
// What each thing is in a plan, read from the plan's own fields. A list a
// song can lengthen is given each name once, in the order the plan first
// holds it, with its count: the short view does not grow with the song.
const onceEach = (names) => [...new Set(names)];
const PLAN_VALUE = {
  form: (p) => p?.request?.form ?? null,
  lines: (p) => p?.total_lines ?? null,
  functions: (p) => {
    const drawn = p?.choices?.pattern?.functions || [];
    return { functions: onceEach(drawn), sections: drawn.length };
  },
  relation: (p) => {
    const groups = p?.choices?.relations?.groups || [];
    return { types: onceEach(groups.map((g) => g.type)), groups: groups.length };
  },
  melody: (p) => ({
    meter: p?.choices?.meter?.value ?? null,
    beats_per_line: p?.choices?.meter?.beats_per_line ?? null,
    bars_per_line: p?.choices?.bars_per_line ?? null,
    subdivision: p?.choices?.subdivision ?? null,
  }),
};
export const STATEMENT_FIELDS = Object.freeze(Object.keys(PLAN_VALUE));
// -> the plan result's `statements`: how the plan call (with what a session
// carried from its sweep) said each thing, and what the plan holds for it.
// 'unsaid' is a call that said nothing of it (the raw engine, or a session
// whose sweep was recorded before this rule); form says 'default' instead.
// RHYME IS SAID PER GROUP. `group_types` declares some groups' types; the
// plan records, per group, whether its type was declared (`chosen_from`
// "declared") or drawn. When the groups do not all agree with what the call
// said, the row says 'value' (every group declared) or 'mixed', and lists
// the groups whose type was declared.
const DECLARED = 'declared';
function rhymeSaid(said, plan) {
  const groups = plan?.choices?.relations?.groups || [];
  const declared = groups.filter((g) => g.chosen_from === DECLARED).map((g) => g.group);
  if (!groups.length || !declared.length || said === 'value') return { said };
  if (declared.length === groups.length) return { said: 'value', declared };
  return { said: 'mixed', declared };
}
export function planStatements(args, plan) {
  return {
    version: 1,
    rows: statementsOf(args, 'wants').rows.map(({ row, said, wants }) => {
      const base = said || (row.draw ? 'unsaid' : 'default');
      const rhyme = row.field === 'relation' ? rhymeSaid(base, plan) : { said: base };
      return {
        thing: row.thing,
        field: row.field,
        said: rhyme.said,
        ...(said === 'want' ? { wants } : {}),
        ...(rhyme.declared ? { declared_groups: rhyme.declared } : {}),
        value: PLAN_VALUE[row.field](plan),
      };
    }),
    not_stateable: NOT_STATEABLE_YET.map((r) => ({ ...r })),
  };
}

// What the recorded sweeps hold, for a plan the gate refused, newest first and
// bounded (the newest SHOWN_SWEEPS sweeps, the first SHOWN_SEEDS seeds of
// each). A melody is never printed, only whether one was declared; want lists
// print as JSON because a want can hold a comma.
const SHOWN_SWEEPS = 3;
const SHOWN_SEEDS = 5;
function sweepCoordinates(s) {
  const shown = SWEEP_COORDINATES.map((k) => {
    const v = norm(k, s.args[k]);
    if (k === 'melody') return `melody ${unset(v) ? 'none' : 'declared'}`;
    return `${k} ${unset(v) ? 'none' : Array.isArray(v) ? JSON.stringify(v) : v}`;
  });
  return [...shown, `want ${JSON.stringify(sweepWants(s))}`].join(', ');
}
function recordedSweeps(w, args) {
  const newest = [...w.sweeps].reverse();
  const accepting = newest.filter((s) => s.accepted.includes(args.seed));
  const pool = accepting.length ? accepting : newest;
  const shown = pool.slice(0, SHOWN_SWEEPS);
  const older =
    pool.length > shown.length
      ? ` (${pool.length - shown.length} older recorded sweep(s) not shown)`
      : '';
  if (accepting.length)
    return (
      `Recorded sweeps that accepted seed ${args.seed}, newest first: ` +
      shown
        .map((s, i) => {
          const differs = coordinatesOf(s).filter((k) => !sameField(k, args[k], s.args[k]));
          if (!same(list(args.wants), sweepWants(s))) differs.push("wants (the sweep's `want`)");
          return `(${i + 1}) ${sweepCoordinates(s)}; this call differs in ${differs.join(', ')}`;
        })
        .join('; ') +
      `${older}.`
    );
  const seeds = (s) =>
    JSON.stringify(s.accepted.slice(0, SHOWN_SEEDS)) +
    (s.accepted.length > SHOWN_SEEDS ? ` and ${s.accepted.length - SHOWN_SEEDS} more` : '');
  return (
    (args.seed === undefined
      ? 'This call names no seed. '
      : `No recorded sweep accepted seed ${JSON.stringify(args.seed)}. `) +
    'Recorded sweeps, newest first: ' +
    shown
      .map((s, i) => `(${i + 1}) accepted seeds ${seeds(s)}; ${sweepCoordinates(s)}`)
      .join('; ') +
    `${older}.`
  );
}

// The sweep a stale plan is planned again under: the plan's own, while it is
// still on record and no sweep was recorded after the grade found the plan
// stale. Otherwise none, and the newest sweep's seed is the plan to make.
export const stalePlanSweep = (w) => (w.grade_attempt?.swept_after ? null : planSweep(w));
// A grade rebuilt the recorded plan's seed and got another plan. The seed is
// named only when it is the plan the gate admits (nextCreationCall).
export const planChanged = (w) => {
  const seed = w.plan.request.seed;
  return `lyric_grade rebuilt seed ${seed}'s plan and got a different plan from the one on record (the planner changed after lyric_plan ran), so no grade under the recorded plan can be written. Call lyric_plan again${stalePlanSweep(w) ? ` with seed ${seed}` : ''}; then lyric_screen and lyric_grade under the new plan.`;
};
// What the plan recorded for a declaration a grade or revise contradicted,
// in the gate's own normalisation, and the call that works instead.
function recordedField(key, request, lines) {
  if (key === 'seed') return `The plan recorded seed ${request.seed}; send seed ${request.seed}.`;
  const value = norm(key, request[key]);
  if (unset(value))
    return (
      `lyric_plan was not given \`${key}\`; leave it out` +
      (key === 'lines' ? ` (the plan drew ${lines} lines; a report, not a declaration).` : '.')
    );
  if (key === 'melody')
    return 'The plan recorded a melody; leave `melody` out and the recorded one is used.';
  const shown =
    request[key] === null || request[key] === undefined ? value : planArgument(key, request[key]);
  return `The plan recorded ${key} ${JSON.stringify(shown)}; leave \`${key}\` out and the recorded value is used.`;
}

// Called after host-carried continuation fields are restored and before any
// tool dispatch. Returned refusals consume no tool/provider operation.
export function creationRefusal(task, name, args, lyric = null) {
  if (isRecoveryOnly(name, args)) return null;
  if (edit(task) && (newSongCall(name, args) || continuesSeededRun(name, args, lyric)))
    return `CREATION_PLAN: ${name}${args?.seed != null || heldSeed(lyric) != null ? ' with a seed' : ''} is for a new song, and a new song needs begin_lyrics phase 'create'. This session is phase 'edit', for lyrics the user supplied: structure them with lyric_recover, grade them with lyric_check, and revise them with lyric_revise without a seed.`;
  const w = workflowFor(task);
  if (!w || !name.startsWith('lyric_')) return null;
  // STATE IT OR SAY DRAW (stage 3): every new-song sweep states each
  // STATEABLE thing, and none twice. Refused before dispatch: nothing runs.
  if (name === 'lyric_sweep') return statementRefusal(args);
  // THE WORD-CHECK FOLLOWS THE PLAN (writer plan, stage 3; the owner's ruling
  // of 15 Nov 2026). It was forced before the plan, where no rhyming line was
  // known yet. Its receipt now names the plan it ran under, and a grade needs
  // the receipt of its own plan, so a replacement plan needs a new one.
  if (name === 'lyric_screen')
    return w.plan
      ? null
      : `CREATION_ORDER: a new song's lyric_screen comes after its lyric_plan, and its receipt is recorded for that plan. Call ${w.sweeps.length ? 'lyric_plan' : 'lyric_sweep, then lyric_plan,'} before lyric_screen.`;
  // lyric_verify is a diff of one revision and records nothing, so it serves a
  // new song's revision rounds too. lyric_check and lyric_recover grade or
  // structure a draft without the plan, which would route around the plan and
  // lyric_grade this phase enforces.
  if (!['lyric_plan', 'lyric_grade', 'lyric_revise'].includes(name)) {
    if (['lyric_check', 'lyric_recover'].includes(name))
      return `CREATION_PLAN: ${name} is for lyrics the user supplied. In this new-song session, grade your draft with lyric_grade (same seed and declarations as lyric_plan); for lyrics the user supplied, call begin_lyrics with phase 'edit'.`;
    return null;
  }
  if (!w.sweeps.length)
    return 'CREATION_ORDER: execute a successful lyric_sweep before planning or writing a new song.';
  if (name === 'lyric_plan') {
    const conflict = statementConflict(statementsOf(args, 'wants').conflict);
    if (conflict) return conflict;
    const s = sweepFor(w, args, { anyForm: args.form === undefined });
    if (!s)
      return (
        `CREATION_PLAN: plan a seed an accepted lyric_sweep returned, with that sweep's ${joined(SWEEP_COORDINATES)}, and its \`want\` list as \`wants\`. ` +
        recordedSweeps(w, args)
      );
    // What the sweep stated goes with the plan: its form (a plan that leaves
    // it out plans the sweep's form) and its `draw`, a sweep-time statement:
    // the plan's record says what the sweep drew, whatever the plan sends.
    // Neither changes a plan byte.
    if (args.form === undefined && s.args.form) args.form = planArgument('form', s.args.form);
    const drawn = drawList(s.args.draw);
    if (drawn.length) args.draw = drawn;
    else delete args.draw;
    return null;
  }
  if (!w.plan)
    return 'CREATION_PLAN: execute lyric_plan successfully before grading or revising a new song.';
  const handAuthored = UNPLANNED_FIELDS.filter((k) => args[k] !== undefined);
  if (handAuthored.length)
    return `CREATION_PLAN: hand-authored mandate or placement fields cannot replace the canonical program plan. This call sent ${handAuthored.join(', ')}, which the recorded plan supplies: send this same call again without ${handAuthored.length === 1 ? 'it' : 'them'}.`;
  const request = w.plan.request;
  // A REVISE AFTER A GRADE (writer plan, stage 2). The plan's declarations are
  // restored from the record below; the draft was not, so a caller had to send
  // the whole graded draft again unchanged. The grade receipt keeps the draft's
  // text now, and a revise that starts a run without a draft takes it from
  // there. A run under way keeps its own draft: the graded one is where that
  // run STARTED, and the host restores the run's draft before this gate.
  const continuing =
    name === 'lyric_revise' &&
    !args.new_run &&
    lyric &&
    w.started?.plan_sha256 === w.plan.sha256 &&
    (lyric.seed === request.seed || lyric.decl?.seed === request.seed);
  for (const key of PLAN_FIELDS) {
    if (args[key] !== undefined && !sameDeclared(key, args[key], request[key]))
      return `CREATION_PLAN: ${key} differs from the recorded program plan. ${recordedField(key, request, w.plan.lines)}`;
    // Restore the host's actual plan coordinates, not a model's recollection.
    // One sent is the same declaration in another spelling (a reordered list,
    // a melody's keys in another order, another case): the grade rebuilds the
    // plan from these arguments, so it is given the spelling the plan
    // recorded, and rebuilds the same plan. A run under way keeps the
    // spelling it was sent: the run compares each call with the declarations
    // it started with, byte for byte.
    if (
      request[key] !== null &&
      request[key] !== undefined &&
      request[key] !== '' &&
      (args[key] === undefined || !continuing)
    )
      args[key] = planArgument(key, request[key]);
  }
  if (Array.isArray(args.draft)) args.draft = normalizeDraftLines(args.draft);
  if (typeof args.draft_text === 'string') {
    const draft = draftFromText(args.draft_text);
    if (Array.isArray(args.draft) && !same(args.draft, draft))
      return 'CREATION_DRAFT: conflicting draft and draft_text; send one exact draft representation.';
    args.draft = draft;
  }
  const gradedDraft = w.grade?.plan_sha256 === w.plan.sha256 ? w.grade : null;
  if (
    w.grade_attempt?.cause === 'plan_changed' &&
    w.grade_attempt.plan_sha256 === w.plan.sha256 &&
    !continuing &&
    (name === 'lyric_grade' || (name === 'lyric_revise' && !gradedDraft))
  )
    return `CREATION_ORDER: ${planChanged(w)}`;
  // The word-check is asked for once, at the grade (and of a revise that has
  // no grade under this plan, whose next call is that grade). A run or a
  // grade already standing under this plan is not sent back to it.
  if (
    w.screen?.plan_sha256 !== w.plan.sha256 &&
    (name === 'lyric_grade' || (name === 'lyric_revise' && !continuing && !gradedDraft))
  )
    return (
      'CREATION_ORDER: lyric_grade needs one answered lyric_screen under this plan, and none is on record for it.' +
      (w.screen_attempt?.plan_sha256 === w.plan.sha256 ? screenAttemptNote(w.screen_attempt) : '')
    );
  if (name === 'lyric_revise' && !continuing && !(Array.isArray(args.draft) && args.draft.length)) {
    if (!gradedDraft)
      return (
        `CREATION_GRADE: no graded draft is on record for this plan, and this call sent none. Call lyric_grade with seed ${request.seed} and the complete ${w.plan.lines}-line draft; lyric_revise then takes that graded draft from the record.` +
        (w.grade_attempt?.plan_sha256 === w.plan.sha256
          ? gradeAttemptNote(w.grade_attempt, w.plan.lines, false)
          : '')
      );
    if (Array.isArray(gradedDraft.draft)) {
      args.draft = structuredClone(gradedDraft.draft);
      // An empty `draft_text` sent beside it is not a second draft.
      delete args.draft_text;
    }
  }
  if (!Array.isArray(args.draft) || !args.draft.length)
    return (
      'CREATION_DRAFT: the exact complete draft is required. Send this same call again with ' +
      (name === 'lyric_revise' ? 'the exact draft lyric_grade graded' : 'the draft') +
      ' as `draft` (one line per item) or `draft_text` (one newline-separated string).'
    );
  if (args.draft.length !== w.plan.lines)
    return `CREATION_DRAFT: the draft line count differs from the canonical program plan. The plan has ${w.plan.lines} lines and this draft has ${args.draft.length}: send this same call again with a draft of ${w.plan.lines} lines.`;
  if (name === 'lyric_grade') return null;
  if (continuing) return null;
  if (
    !w.grade ||
    w.grade.plan_sha256 !== w.plan.sha256 ||
    w.grade.draft_sha256 !== hash(args.draft)
  )
    return (
      'CREATION_GRADE: lyric_grade must answer for this exact draft and canonical plan before revision starts.' +
      // Another draft IS graded under this plan: say which lines differ and
      // name both ways on, so a change is neither revised unseen nor lost.
      (gradedDraft ? notTheGradedDraft(gradedDraft, args.draft, request.seed) : '') +
      (w.grade_attempt?.plan_sha256 === w.plan.sha256 &&
      w.grade_attempt.draft_sha256 === hash(args.draft)
        ? gradeAttemptNote(w.grade_attempt, w.plan.lines)
        : '')
    );
  for (const key of READING_FIELDS) {
    const graded = readingValue(key, w.grade.readings?.[key]);
    if (
      key === 'pronunciations' &&
      Array.isArray(w.grade.normalized_pronunciations) &&
      same(args[key], w.grade.normalized_pronunciations)
    )
      args[key] = structuredClone(graded);
    if (args[key] !== undefined && !same(readingValue(key, args[key]), graded))
      return `CREATION_GRADE: ${key} differs from the graded reading; execute lyric_grade again before starting a new revision. Leave \`${key}\` out and the graded reading is used, or grade again with this reading.`;
    if (args[key] === undefined && graded !== null) args[key] = structuredClone(graded);
  }
  return null;
}

// The verdict-only half of the grade receipt: the draft was measured under an
// authenticated reading basis, with coverage that accounts for its
// obligations. recordCreation adds the session half (this plan, this exact
// draft); the grade's `next` names lyric_revise only when this holds.
export function gradeVerdictQualifies(verdict) {
  return !!(
    verdict &&
    [0, 2, 3].includes(verdict.exit_code) &&
    verdict.measurement_status === 'graded' &&
    assessmentCoverageValid(verdict.coverage) &&
    verdict.certified === verdict.coverage.certified &&
    (verdict.exit_code !== 2 || verdict.coverage.certified === false) &&
    gradedLexicon(verdict)
  );
}

// WHAT A PLAN ASKS OF THE DRAFT, IN A FORM TWO PLANS CAN BE COMPARED ON
// (issue #676, 2026-11-12).
//
// The gate above protects a RECORDED plan: a grade or revise that contradicts
// it is refused. It did nothing about a plan being REPLACED. Any admitted
// lyric_plan clears the plan, the grade and the run and records the new one,
// so a session could plan a rhymed, titled, returning song, fail to finish
// it, sweep again with less declared, plan that, and finish — and nothing on
// the final result said the song now answers to a different contract. In the
// twenty audited trials several "successes" were exactly that.
//
// Replacing a plan is not a fault: the first plan may have been the mistake.
// What was missing is the record. So the session keeps what its FIRST recorded
// plan asked, and every plan, grade and revise result under a plan that
// replaced it carries `plan_lineage`: what was declared then and is not now,
// and what the planner bound then and does not now. Nothing is refused and no
// declaration is added; the result simply cannot be read as answering for the
// first plan any more.
//
// Two kinds of difference, kept apart because they are different facts:
//   declared — what the CALLER asked (every plan declaration but the seed,
//              which names a draw and is not a requirement);
//   drawn    — what the PLANNER bound from it: total lines, the relation types
//              its groups are judged on, how many groups are bound, how many
//              lines return, whether a hook is planned.
// A melody is never printed, only whether one was declared and whether it is
// the same one.
const DECLARED_FIELDS = PLAN_FIELDS.filter((key) => key !== 'seed');
const cells = (value) =>
  String(value || '')
    .split(';')
    .map((cell) => cell.trim())
    .filter(Boolean);
function planAsks(p) {
  const declared = {};
  for (const key of DECLARED_FIELDS) {
    const value = norm(key, p.request?.[key]);
    declared[key] = key === 'melody' ? (unset(value) ? null : hash(value)) : value;
  }
  return {
    declared,
    drawn: {
      lines: p.total_lines,
      relation_types: [...new Set(Object.values(p.relations || {}).map(String))].sort(),
      bound_groups: cells(p.groups).length,
      returns: cells(p.returns).length,
      hook: p.hook_slot !== null && p.hook_slot !== undefined && p.hook_slot !== '',
    },
  };
}
const shownDeclaration = (key, value) =>
  unset(value)
    ? null
    : key === 'melody'
      ? 'declared'
      : key === 'narrative'
        ? narrativeArgument(value)
        : value;
const said = (value) =>
  value === null || value === undefined
    ? 'none'
    : typeof value === 'string'
      ? value
      : typeof value === 'boolean'
        ? value
          ? 'yes'
          : 'no'
        : JSON.stringify(value);

// -> null when the recorded plan IS the session's first plan (or nothing is
// recorded to compare), else what this plan is not asked that the first was.
export function planLineage(task) {
  if (!create(task)) return null;
  const w = task.workflow;
  const first = w?.first_plan;
  if (!w?.plan || !first?.asks || first.sha256 === w.plan.sha256) return null;
  if (task.plan?.sha256 !== w.plan.sha256 || !task.plan.result) return null;
  const now = planAsks(task.plan.result);
  const declared = DECLARED_FIELDS.filter(
    (key) => !same(first.asks.declared[key], now.declared[key])
  ).map((key) => {
    const was = shownDeclaration(key, first.asks.declared[key]);
    const is = shownDeclaration(key, now.declared[key]);
    return {
      field: key,
      first: was,
      // Two different melodies both read "declared"; say they differ.
      now: key === 'melody' && was && is ? 'declared (a different melody)' : is,
    };
  });
  const drawn = Object.keys(now.drawn)
    .filter((key) => !same(first.asks.drawn[key], now.drawn[key]))
    .map((key) => ({ what: key, first: first.asks.drawn[key], now: now.drawn[key] }));
  const changes = (rows, name) =>
    rows.map((row) => `${row[name]} ${said(row.first)} → ${said(row.now)}`).join('; ');
  const note =
    `PLAN REPLACED: this is not the first plan this session recorded (that was seed ${first.seed}). ` +
    (declared.length
      ? `It was declared differently — ${changes(declared, 'field')}. `
      : 'Its declarations are the same. ') +
    (drawn.length ? `The planner bound a different shape — ${changes(drawn, 'what')}. ` : '') +
    'A grade or revise under this plan answers for this plan only: it does not show that what the first plan asked was met.';
  return {
    first_plan: { seed: first.seed, plan_sha256: first.sha256 },
    plans_recorded: first.recorded,
    declared_changes: declared,
    drawn_changes: drawn,
    note,
  };
}

// A plan, grade or revise result under a replaced plan carries the lineage in
// its verdict (the JSON block with an exit code). Every other result, and
// every result in a session still on its first plan, passes through unchanged.
const LINEAGE_TOOLS = new Set(['lyric_plan', 'lyric_grade', 'lyric_revise']);
export function withPlanLineage(task, name, result) {
  if (!LINEAGE_TOOLS.has(name) || !result || result.isError || !Array.isArray(result.content))
    return result;
  const lineage = planLineage(task);
  if (!lineage) return result;
  let changed = false;
  const content = result.content.map((block) => {
    if (changed || block?.type !== 'text') return block;
    let v;
    try {
      v = JSON.parse(block.text);
    } catch {
      return block;
    }
    if (!v || typeof v !== 'object' || Array.isArray(v) || !Number.isInteger(v.exit_code))
      return block;
    changed = true;
    return { ...block, text: JSON.stringify({ ...v, plan_lineage: lineage }) };
  });
  return changed ? { ...result, content } : result;
}

// SEEDS THE PLANNER REFUSED IN A ROW (writer plan, stage 2; the rule is R2's).
// `refused_sweep` counts the seeds of consecutive windows the planner refused
// whole under one request: the sweep's arguments apart from where the window
// starts and how wide it is. Any other sweep result, or a changed request,
// ends the count.
// The request a window was swept under, its seeds left out. `draw` is a set:
// the same fields in another order are the same request.
const sweepRequest = (args) => {
  const { seed_from: _from, count: _count, ...request } = args || {};
  if (request.draw !== undefined) request.draw = drawList(request.draw);
  return JSON.stringify(Object.fromEntries(Object.entries(request).sort()));
};
// The 95% bound on the share of seeds that plan, when none of `seeds` did.
export const planShareBound = (seeds) => 1 - 0.05 ** (1 / seeds);
// "Sweep again" stops being the next call when, even at that bound, a further
// window of `count` seeds is more likely than not to find no plan:
// 1 - (1 - bound)^count < 1/2, which is 1 - 0.05^(count / seeds) < 1/2. The
// test is the same for every window size: it is first true after the fifth
// refused window. (Counting expected plans instead, bound x count < 1, is
// true after ONE seed for a window of one.)
const sweepingIsSpent = (seeds, count) =>
  Number.isInteger(seeds) &&
  seeds > 0 &&
  Number.isInteger(count) &&
  count > 0 &&
  1 - 0.05 ** (count / seeds) < 0.5;

// WHAT A WINDOW THAT KEPT NO SEED SAYS (writer plan, stage 2). The paragraph
// was one fixed string: it told a caller who had declared `lines` to declare
// it "if you have not", and pointed at held_by without saying a count. It is
// now built from the verdict and the call:
// - each predicate's own count, said, so the one that never holds is seen;
// - the 95% bound that no seed kept leaves on the share of seeds kept;
// - advice only for what the call did not state (a value, a stating `want`
//   or a draw: statedFields);
// - `row`, from a host that keeps receipts: the windows swept in a row under
//   this request, and whether a further one is more likely than not to keep
//   none. Then sweeping on is no longer offered.
const orList = (xs) =>
  xs.length < 3 ? xs.join(' or ') : `${xs.slice(0, -1).join(', ')}, or ${xs[xs.length - 1]}`;
export function noneKeptMeaning(v, declared = {}, row = null) {
  const pct = (x) => `${(100 * x).toFixed(1)}%`;
  const held = (Array.isArray(v.held_by) ? v.held_by : [])
    .map((h) => `${h.want} on ${h.held}`)
    .join('; ');
  const advice = [];
  if (!declared.lines)
    advice.push(
      'declare a target length in `lines` (an undeclared length is drawn long, so a length cap rarely holds)'
    );
  if (!declared.functions) advice.push('declare the section roster in `functions`');
  if (!row?.spent) advice.push('continue from next_seed_from');
  return (
    'no seed in THIS WINDOW satisfies every predicate.' +
    (held ? ` Each predicate held on its own, of the ${v.planned} planned: ${held}.` : '') +
    (typeof v.accept_share_bound === 'number'
      ? ` None of the ${v.swept} seed(s) swept was kept, so at most ${pct(v.accept_share_bound)} of seeds are kept under this request (95% bound).`
      : '') +
    (row && row.seeds > v.swept
      ? ` Across the windows swept in a row under this request, none of the ${row.seeds} seeds was kept: at most ${pct(row.bound)} of seeds are kept (95% bound).`
      : '') +
    (row?.spent
      ? ' A further window of this size is more likely than not to keep none, so sweeping on is not offered.'
      : '') +
    (advice.length
      ? ` Before dropping a predicate: ${orList(advice)}.`
      : ' What is left is to change or drop a predicate.')
  );
}
export function recordCreation(task, name, args, verdict, isError = false) {
  if (isRecoveryOnly(name, args)) return;
  const w = workflowFor(task);
  if (!w || isError || !verdict) return;
  if (name === 'lyric_sweep') {
    const request = sweepRequest(args);
    if (verdict.sweep_outcome === 'planner refused every seed' && Number.isInteger(verdict.swept))
      w.refused_sweep = {
        request,
        seeds: (w.refused_sweep?.request === request ? w.refused_sweep.seeds : 0) + verdict.swept,
      };
    else delete w.refused_sweep;
    // The same count for windows that planned and kept no seed.
    if (verdict.sweep_outcome === 'no seed kept' && Number.isInteger(verdict.swept))
      w.unkept_sweep = {
        request,
        seeds: (w.unkept_sweep?.request === request ? w.unkept_sweep.seeds : 0) + verdict.swept,
      };
    else delete w.unkept_sweep;
  }
  if (
    name === 'lyric_sweep' &&
    verdict.exit_code === 0 &&
    Array.isArray(verdict.accepted_shown) &&
    verdict.accepted_shown.length
  ) {
    const accepted = verdict.accepted_shown.filter(Number.isInteger);
    if (accepted.length) {
      w.sweeps = [...w.sweeps, { args: structuredClone(args), accepted }].slice(-8);
      // A sweep after the grade found the plan stale is the newest request:
      // the plan named next is that sweep's, not the stale plan's own.
      if (w.grade_attempt?.cause === 'plan_changed') w.grade_attempt.swept_after = true;
    }
  } else if (name === 'lyric_screen' && w.plan) {
    // The screen receipt names the plan it ran under: the grade's gate reads
    // it for its own plan, so a replacement plan needs a new one.
    if (answered(verdict)) {
      w.screen = {
        words: structuredClone(args.words || []),
        relation: args.relation ?? null,
        plan_sha256: w.plan.sha256,
      };
      delete w.screen_attempt;
    } else w.screen_attempt = { ...attemptOf(verdict), plan_sha256: w.plan.sha256 };
  } else if (name === 'lyric_plan') {
    // A session recorded before lineage was kept holds a plan and no first
    // plan: the plan it holds is its first (#676).
    if (!w.first_plan && w.plan && task.plan?.sha256 === w.plan.sha256 && task.plan.result)
      w.first_plan = {
        sha256: w.plan.sha256,
        seed: w.plan.request.seed,
        asks: planAsks(task.plan.result),
        last: w.plan.sha256,
        recorded: 1,
      };
    w.plan = null;
    w.grade = null;
    w.started = null;
    delete w.grade_attempt;
    const p = verdict.plan;
    if (
      verdict.exit_code !== 0 ||
      !p ||
      p.plan_version !== 3 ||
      verdict.plan_sha256 !== hash(p) ||
      !p.request ||
      !same(p.request, verdict.plan_request) ||
      !PLAN_FIELDS.every((key) => sameDeclared(key, args[key], p.request[key])) ||
      !Number.isInteger(p.total_lines) ||
      !Array.isArray(p.line_slots) ||
      p.line_slots.length !== p.total_lines ||
      !Array.isArray(p.sections) ||
      !p.sections.length ||
      // The relation the gate matched to the sweep is the one sent.
      !sweepFor(w, { ...p.request, relation: args.relation ?? p.request.relation })
    )
      return;
    w.plan = {
      sha256: verdict.plan_sha256,
      request: structuredClone(p.request),
      lines: p.total_lines,
    };
    task.plan = {
      args: structuredClone(p.request),
      result: structuredClone(p),
      sha256: verdict.plan_sha256,
    };
    // What the session's FIRST plan asked is kept for good; a later plan is
    // compared with it (planLineage), never with the plan just before it, so
    // a chain of small steps cannot walk away from the first contract unseen.
    if (!w.first_plan)
      w.first_plan = {
        sha256: verdict.plan_sha256,
        seed: p.request.seed,
        asks: planAsks(p),
        last: verdict.plan_sha256,
        recorded: 1,
      };
    else if (w.first_plan.last !== verdict.plan_sha256) {
      w.first_plan.recorded += 1;
      w.first_plan.last = verdict.plan_sha256;
    }
  } else if (name === 'lyric_grade') {
    w.grade = null;
    if (
      gradeVerdictQualifies(verdict) &&
      w.plan &&
      verdict.plan_sha256 === w.plan.sha256 &&
      Array.isArray(verdict.final_draft) &&
      same(verdict.final_draft, args.draft) &&
      verdict.final_draft_sha256 === hash(args.draft)
    )
      w.grade = {
        plan_sha256: w.plan.sha256,
        draft_sha256: verdict.final_draft_sha256,
        // The text beside its fingerprint: a revise that sends no draft takes
        // it from here (creationRefusal).
        draft: structuredClone(verdict.final_draft),
        coverage_certified: verdict.coverage.certified,
        ...(Array.isArray(verdict.pronunciations) &&
        !same(verdict.pronunciations, args.pronunciations ?? [])
          ? { normalized_pronunciations: structuredClone(verdict.pronunciations) }
          : {}),
        readings: {
          ...Object.fromEntries(
            READING_FIELDS.map((key) => [key, structuredClone(readingValue(key, args[key]))])
          ),
          ...gradedLexicon(verdict),
        },
      };
    // The attempt is not a receipt: nothing that admits a call reads it.
    if (w.grade) delete w.grade_attempt;
    else if (w.plan)
      w.grade_attempt = attemptOf(verdict, {
        plan_sha256: w.plan.sha256,
        draft_sha256: hash(args.draft ?? null),
      });
    // The grade builds this seed's plan again. A planner deployed since
    // lyric_plan ran builds a different one, and no grade under the recorded
    // plan can be written: the way on is a new plan, not the same grade.
    if (
      w.grade_attempt &&
      typeof verdict.plan_sha256 === 'string' &&
      verdict.plan_sha256 !== w.plan.sha256
    )
      w.grade_attempt.cause = 'plan_changed';
  } else if (name === 'lyric_revise' && w.plan && [0, 3, 4].includes(verdict.exit_code)) {
    w.started = { plan_sha256: w.plan.sha256 };
  }
}

export function creationQualified(task) {
  if (!create(task)) return true;
  const w = workflowFor(task);
  return !!(
    w.sweeps.length &&
    w.screen &&
    w.plan &&
    w.grade &&
    w.started &&
    w.grade.plan_sha256 === w.plan.sha256 &&
    w.started.plan_sha256 === w.plan.sha256
  );
}

// THE NEXT CALL THE GATE ADMITS (P2 F1). Read from what creationRefusal reads:
// the receipts, the carried run (the client's continuation, or /chat's carried
// record) and the tool the caller was trying to reach. It names a tool and
// the arguments the receipts fix, never a draft, title, narrative or melody
// text in its NEXT line, and leaves the other plan declarations for the gate
// to restore. A sweep's melody rides in `args`, since the plan gate cannot
// restore it.
// -> null outside a create session, and for a carried record /chat will not
// continue in this task (an uncertified parked run, an unknown-outcome
// proposal), whose way on is the person's choice.
function carriedMove(carried) {
  if (!carried || typeof carried !== 'object') return null;
  const parked = carried.parked === true && typeof carried.state !== 'string';
  if (carried.uncertain_proposal || (parked && carried.uncertified)) return 'hold';
  if (parked) return 'rewrite';
  const run = carried.args && typeof carried.args === 'object' ? carried.args : carried;
  return carried.resumable || (typeof run.state !== 'string' && run.checkpoint != null)
    ? 'resume'
    : 'answer';
}

// `args` are the refused call's own, when there is one: a sweep refused for
// what it leaves out or states twice is answered by that sweep again, with
// the rows it left out or the fields it stated twice (data, never a value).
export function nextCreationCall(task, carried, name, args = null) {
  const w = workflowFor(task);
  if (!w) return null;
  const move = carriedMove(carried);
  if (move === 'hold') return null;
  if (name === 'lyric_sweep' && args) {
    const { missing, conflict } = statementsOf(args);
    if (conflict.length) return { tool: 'lyric_sweep', args: {}, missing: [], conflict };
    if (missing.length) return { tool: 'lyric_sweep', args: {}, missing, conflict: [] };
  }
  if (!w.sweeps.length) return { tool: 'lyric_sweep', args: {} };
  const stale =
    w.plan &&
    w.grade_attempt?.cause === 'plan_changed' &&
    w.grade_attempt.plan_sha256 === w.plan.sha256;
  // A stale plan is planned again under the sweep it was recorded under: its
  // seed belongs to that sweep, and another sweep's coordinates would refuse
  // it. With no such sweep on record, or with a sweep recorded after the
  // grade found the plan stale, the newest sweep's own seed and coordinates
  // are the plan the gate admits.
  const own = stale ? stalePlanSweep(w) : null;
  if (!w.plan || name === 'lyric_plan' || stale) {
    const s = own || w.sweeps[w.sweeps.length - 1];
    const args = { seed: own ? w.plan.request.seed : s.accepted[0] };
    if (s.args.form) args.form = planArgument('form', s.args.form);
    if (s.args.lines != null) args.lines = planArgument('lines', s.args.lines);
    if (list(s.args.functions).length) args.functions = planArgument('functions', s.args.functions);
    if (!unset(s.args.relation ?? null)) args.relation = planArgument('relation', s.args.relation);
    if (sweepWants(s).length) args.wants = sweepWants(s);
    // The sweep's melody goes in the call as the sweep sent it: the gate
    // refuses a plan whose melody differs from its sweep's, and a caller
    // that follows only the call has no other copy. The NEXT line prints
    // no melody text (formatNextCall).
    const declared = s.args.melody !== undefined && s.args.melody !== null;
    if (declared)
      args.melody =
        typeof s.args.melody === 'string' ? s.args.melody : planArgument('melody', s.args.melody);
    // A stale plan is the person's: what it declared that no sweep carries
    // (its title, narrative and per-group types) goes in the call too, so
    // planning it again changes none of their choices. The group types name
    // the old seed's groups, so under another seed they are not carried, and
    // the call says so.
    const kept = [];
    const dropped = [];
    if (stale) {
      const r = w.plan.request;
      for (const key of PLAN_ONLY_KEPT) {
        if (unset(r[key] ?? null) || r[key] === false) continue;
        if (key === 'group_types' && !own) {
          dropped.push(key);
          continue;
        }
        args[key] = planArgument(key, r[key]);
        kept.push(key);
      }
    }
    return {
      tool: 'lyric_plan',
      args,
      melody: declared,
      ...(kept.length ? { kept } : {}),
      ...(dropped.length ? { dropped, from_seed: w.plan.request.seed } : {}),
    };
  }
  const seed = w.plan.request.seed;
  const lines = w.plan.lines;
  if (
    move &&
    w.started?.plan_sha256 === w.plan.sha256 &&
    (carried.seed === seed || carried.decl?.seed === seed)
  )
    return { tool: 'lyric_revise', args: { seed }, continues: move, lines };
  if (w.grade?.plan_sha256 === w.plan.sha256 && name !== 'lyric_grade')
    return {
      tool: 'lyric_revise',
      args: { seed, ...(move ? { new_run: true } : {}) },
      draft: 'graded',
      // The record holds the graded draft's text: the call needs no draft.
      recorded: Array.isArray(w.grade.draft),
      lines,
    };
  // The grade's gate asks for this plan's word-check first. The screen's
  // words are the writer's, so the call names none; `seed` is the grade's.
  if (w.screen?.plan_sha256 !== w.plan.sha256)
    return { tool: 'lyric_screen', args: {}, seed, lines };
  return { tool: 'lyric_grade', args: { seed }, draft: 'complete', lines };
}

const argumentText = (v) => (typeof v === 'number' ? String(v) : JSON.stringify(v));
// -> the call as one line starting "NEXT: ", or null.
export function formatNextCall(next) {
  if (!next) return null;
  const { tool, args } = next;
  if (tool === 'lyric_sweep') {
    const plan = `the plan repeats the sweep's ${joined([...SWEEP_COORDINATES, '`want`'])}`;
    if (next.conflict?.length)
      return `NEXT: lyric_sweep with ${joined(next.conflict)} as a value or in \`draw\`, not both; ${plan}.`;
    const rows = next.missing?.length ? next.missing : STATEABLE;
    const drawn = rows.filter((r) => r.draw).map((r) => r.field);
    const names = rows.filter((r) => !r.draw).map((r) => r.field);
    const how = !drawn.length
      ? 'as one name'
      : `${rows.length > 1 ? 'each ' : ''}as a value or in \`draw\`` +
        (names.length ? ` (${joined(names)} as one name)` : '');
    return `NEXT: lyric_sweep stating ${joined(rows.map((r) => r.field))}, ${how}; ${plan}.`;
  }
  if (tool === 'lyric_plan') {
    const quiet = new Set(['melody', ...(next.kept || [])]);
    const parts = Object.entries(args)
      .filter(([k]) => !quiet.has(k))
      .map(([k, v]) => `${k} ${argumentText(v)}`);
    if (next.melody) parts.push("melody: the sweep's melody unchanged");
    for (const key of next.kept || []) parts.push(`${key}: the plan's ${key} unchanged`);
    for (const key of next.dropped || [])
      parts.push(
        `no ${key}: the recorded plan's ${key} named seed ${next.from_seed}'s groups, so state them again for this plan if they still apply`
      );
    return `NEXT: lyric_plan with ${parts.join(', ')}.`;
  }
  if (tool === 'lyric_screen')
    return `NEXT: lyric_screen with candidate words for this plan's rhymes; then lyric_grade with seed ${next.seed} and the complete ${next.lines}-line draft.`;
  if (tool === 'lyric_grade')
    return `NEXT: lyric_grade with seed ${args.seed} and the complete ${next.lines}-line draft.`;
  if (next.continues === 'answer')
    return `NEXT: lyric_revise with seed ${args.seed} and \`answer\` to the run's pending question; the recorded run supplies its draft and declarations.`;
  if (next.continues === 'resume')
    return `NEXT: lyric_revise with seed ${args.seed} to resume the interrupted run; the recorded run supplies its draft and declarations.`;
  if (next.continues === 'rewrite')
    return `NEXT: lyric_revise with seed ${args.seed} and the complete rewritten ${next.lines}-line draft as draft_text.`;
  if (next.recorded)
    return (
      `NEXT: lyric_revise with seed ${args.seed}${args.new_run ? ', new_run: true' : ''} and no draft; the ${next.lines}-line draft lyric_grade graded is taken from the record. ` +
      'To change a line, grade the changed draft first.'
    );
  return (
    `NEXT: lyric_revise with seed ${args.seed}${args.new_run ? ', new_run: true' : ''} and the exact ${next.lines}-line draft lyric_grade graded. ` +
    'To change a line, grade the changed draft first.'
  );
}

// A CREATION_* text keeps its code and words first; the derived NEXT follows
// after a space. Any other text, and every text outside a create session,
// passes through unchanged.
export function withNextCall(text, task, carried, name, args = null) {
  if (typeof text !== 'string' || !text.startsWith('CREATION_')) return text;
  const line = formatNextCall(nextCreationCall(task, carried, name, args));
  return line ? `${text} ${line}` : text;
}

// WHO ACTS NEXT, AS DATA (writer plan, stage 2). A result's next step was
// told four ways: a `next` sentence with `next_call` (plan, grade, check), a
// "NEXT:" line inside a report (sweep), a paragraph after the song (a revise
// stop), or nothing (screen, recover, verify, every refused verdict). A
// caller could not tell a stop that needs a call from one that needs a
// choice, or from one whose result is not known. Every result that carries a
// verdict now carries `outcome`, one of four kinds:
//   next_call  nothing is left to choose: `call` takes the work on.
//   decision   a choice comes first. `by` says whose: the WRITER's (which
//              words, which answer, which reading to declare) or the
//              PERSON's (what they asked for must change, or work they
//              started must be given up). `call` is the call that takes the
//              answer once it is made.
//   unknown    what the last action did is not known. `call`, when there is
//              one, only READS what happened; the action is never repeated
//              on this outcome.
//   finished   the finished-revise record. Never a clean grade or check.
// `call` is {tool, args}: the tool and the arguments the server sets, never
// a draft or an answer. Where a verdict already names its call (`next_call`),
// that same object is used, so the two cannot disagree; the `next` sentence
// keeps its form. This reads only the verdict. A session reads its receipts
// afterwards and replaces what they change (sessionOutcome).
export const OUTCOME_KINDS = Object.freeze(['next_call', 'decision', 'unknown', 'finished']);
export const OUTCOME_ACTORS = Object.freeze(['writer', 'person']);
const callOf = (tool, args = {}) => ({ tool, args });
const takeOn = (call) => ({ kind: 'next_call', by: 'writer', call });
const choose = (by, call) => ({ kind: 'decision', by, call });
// The declarations a plan call leaves out, as an outcome lists them.
export const droppedOf = (n) =>
  (n?.dropped || []).map((field) => ({ field, from_seed: n.from_seed }));
// A refused declaration is what was ASKED (a title with no hook to be asked
// of, a hook in sections that declare no function): no rewrite and no reading
// moves it, so the choice is the person's. Anything refused about words is
// the writer's. Read off the refused rows as the advice is (coverage_advice).
function declarationOnly(v) {
  const { reading, declarations, other } = refusedByRemedy(v);
  return declarations.length > 0 && !reading && !other.length;
}
export function outcomeOf(tool, v, args = {}) {
  if (!v || typeof v !== 'object' || !Number.isInteger(v.exit_code)) return null;
  const code = v.exit_code;
  // The harness died: nothing says what it did, and the same call dies the
  // same way. There is no record to read on the raw engine.
  if (code === 1) return { kind: 'unknown', by: 'writer', call: null };
  const named =
    v.next_call && typeof v.next_call === 'object' && typeof v.next_call.tool === 'string'
      ? v.next_call
      : null;
  if (tool === 'lyric_sweep') {
    if (code === 0) return takeOn(callOf('lyric_plan'));
    // Nothing planned or kept. A cause in a seed's own draw is answered by
    // the next window; a cause in the request is answered by changing it.
    const reasons = Array.isArray(v.planner_refusals) ? v.planner_refusals : [];
    const from = v.window?.next_seed_from;
    // A reason about a seed's own draw leaves open that another seed plans,
    // so the next window is the next call. One window cannot say more: with
    // no plan in N seeds the share of seeds that plan is under
    // 1 - 0.05^(1/N) (95%), and at that share a further window of the same
    // size finds a plan 95 times in 100. The verdict states the bound
    // (`plan_share_bound`); a host that keeps receipts adds the windows up
    // (sessionOutcome).
    if (
      v.sweep_outcome === 'planner refused every seed' &&
      reasons.some((g) => g?.scope === 'seed') &&
      Number.isInteger(from)
    )
      return takeOn(callOf('lyric_sweep', { seed_from: from }));
    return choose(
      v.sweep_outcome === 'arguments refused' ? 'writer' : 'person',
      callOf('lyric_sweep')
    );
  }
  if (tool === 'lyric_screen')
    return [0, 3].includes(code)
      ? takeOn(callOf('lyric_grade'))
      : choose('writer', callOf('lyric_screen'));
  if (tool === 'lyric_plan') {
    if (code === 0 && named) return takeOn(named);
    // Refused for what this seed drew: the sweep finds another seed. Refused
    // for the request: the declaration is the person's to change.
    return v.plan_refusal?.scope === 'seed'
      ? takeOn(callOf('lyric_sweep'))
      : choose('person', callOf('lyric_sweep'));
  }
  if (tool === 'lyric_grade' || tool === 'lyric_check') {
    if ([0, 3].includes(code) && named) return takeOn(named);
    // A clean check of lyrics the person supplied names no next step and no
    // call: nothing stands, and what happens next is theirs to say (they may
    // have asked only for the check). Naming lyric_revise here invited a run
    // nobody asked for (R2's note on pull request 869).
    if (
      tool === 'lyric_check' &&
      code === 0 &&
      v.findings_measured === true &&
      v.certified === true
    )
      return choose('person', null);
    // Measured and not all judged, or refused: words to change or a reading
    // to declare, then the same tool again.
    return choose(declarationOnly(v) ? 'person' : 'writer', callOf(tool));
  }
  if (tool === 'lyric_recover')
    return code === 0
      ? takeOn(callOf('lyric_check'))
      : choose('writer', callOf(code === 3 ? 'lyric_check' : 'lyric_recover'));
  if (tool === 'lyric_verify') return choose('writer', callOf('lyric_revise'));
  if (tool === 'lyric_revise') {
    // The tool that grades a changed draft: lyric_grade for a seeded plan,
    // lyric_check for lyrics the person supplied (a revise with no seed). A
    // continuing call's seed is restored into `args` by the handler.
    const regrade = args?.seed != null ? 'lyric_grade' : 'lyric_check';
    const run =
      typeof v.run_id === 'string' && v.run_revision != null
        ? { run_id: v.run_id, run_revision: v.run_revision }
        : {};
    if (v.status === 'recovered_artifact' || v.status === 'journal_capacity')
      return choose('person', callOf('lyric_revise', { new_run: true }));
    // A provider answer whose arrival is not known: the journal export reads
    // what was kept and replays nothing.
    if (v.uncertain_proposal === true || v.status === 'uncertain_proposal')
      return {
        kind: 'unknown',
        by: 'writer',
        call: callOf('lyric_revise', { recover_only: true }),
      };
    if (code === 4) return choose('writer', callOf('lyric_revise', run));
    if (code === 5 || v.status === 'interrupted') return takeOn(callOf('lyric_revise', run));
    if (code === 0)
      return v.status === 'finished_clean'
        ? { kind: 'finished' }
        : choose(declarationOnly(v) ? 'person' : 'writer', callOf(regrade));
    // Stopped with something open. At exit 3 the run takes a rewritten draft;
    // an uncertified stop (exit 2) is not continued, so the rewritten draft
    // is graded and starts a new run.
    if (code === 3) return choose('writer', callOf('lyric_revise', run));
    const open =
      (typeof v.loop_unresolved === 'number' && v.loop_unresolved > 0) ||
      (Array.isArray(v.loop_whole_flag_codes) && v.loop_whole_flag_codes.length > 0);
    return choose(!open && declarationOnly(v) ? 'person' : 'writer', callOf(regrade));
  }
  return null;
}
// Attach it to the verdict block of a tool result (the block whose JSON has an
// integer exit_code). A result with no verdict (a thrown refusal's text)
// passes through: its text names the call that works (test_refusal_promise).
export function withOutcome(tool, result, args = {}, derive = outcomeOf) {
  if (!tool.startsWith('lyric_') || !result || !Array.isArray(result.content)) return result;
  let changed = false;
  const content = result.content.map((block) => {
    if (changed || block?.type !== 'text') return block;
    let v;
    try {
      v = JSON.parse(block.text);
    } catch {
      return block;
    }
    const outcome = derive(tool, v, args);
    if (!outcome) return block;
    changed = true;
    // Kept ahead of `next_call` and `next`, which stay the verdict's last
    // fields where they exist.
    const { next_call, next, ...rest } = v;
    return {
      ...block,
      text: JSON.stringify({
        ...rest,
        outcome,
        ...(next_call !== undefined ? { next_call } : {}),
        ...(next !== undefined ? { next } : {}),
      }),
    };
  });
  return changed ? { ...result, content } : result;
}

// A HOST THAT KEEPS RECEIPTS (the maintained client behind a /mcp session, the
// website chat) knows what the verdict cannot: which call its own gate admits
// next. The kind and the actor stay the verdict's; the call is the one
// nextCreationCall derives from the receipts and the carried run, which is
// what a refusal's NEXT is printed from, so the two name the same call.
// `carried` is the run the host holds AFTER this result.
export function sessionOutcome(task, name, v, carried, args = {}) {
  const base = outcomeOf(name, v, args);
  if (!base || base.kind === 'finished' || base.kind === 'unknown' || !base.call) return base;
  // An unknown-outcome proposal is held: nothing is repeated, whatever tool
  // answered. The journal export reads what was kept.
  if (carried?.uncertain_proposal)
    return { kind: 'unknown', by: 'writer', call: callOf('lyric_revise', { recover_only: true }) };
  if (base.call.tool === 'lyric_sweep') {
    // The receipts add up what one window cannot: when the seeds refused in a
    // row leave a further window more likely than not to find no plan,
    // sweeping again is no longer the next call and the request is the
    // person's to change.
    const refused = workflowFor(task)?.refused_sweep;
    return name === 'lyric_sweep' &&
      base.kind === 'next_call' &&
      sweepingIsSpent(refused?.seeds, v.window?.count)
      ? choose('person', callOf('lyric_sweep'))
      : base;
  }
  if (base.call.args.new_run) return base;
  const w = workflowFor(task);
  const stopped =
    name === 'lyric_revise' && ![4, 5].includes(v.exit_code) && v.status !== 'interrupted';
  if (!w) {
    // Lyrics the person supplied. A stop ends the run on a host that does not
    // carry it, and the rewritten draft starts a new one.
    if (name !== 'lyric_revise') return base;
    if (stopped && base.call.tool === 'lyric_revise' && carriedMove(carried) !== 'rewrite')
      return { ...base, call: callOf('lyric_revise', { new_run: true }) };
    return base.call.tool === 'lyric_revise' ? { ...base, call: callOf('lyric_revise') } : base;
  }
  // What the caller reaches for next. After a stop it is the grade of the
  // rewritten draft (a host that carries the stopped run is handed its
  // rewrite call instead). The receipts then name the call the gate admits:
  // a grade reached for under a plan with no word-check is that word-check.
  const reach = stopped && base.call.tool === 'lyric_revise' ? 'lyric_grade' : base.call.tool;
  const n = nextCreationCall(task, carried, reach);
  // A held run (stopped uncertified): whether to go on here is the person's.
  if (!n) return choose('person', callOf('lyric_grade', { seed: w.plan?.request.seed }));
  // A plan call that cannot carry a declaration the person made is theirs to
  // take on, with what it leaves out as data.
  if (n.dropped?.length)
    return { ...choose('person', { tool: n.tool, args: n.args }), dropped: droppedOf(n) };
  return { ...base, call: { tool: n.tool, args: n.args } };
}
// A window the planner refused whole, or one that planned and kept no seed,
// on a host that keeps receipts: the verdict states the count its outcome was
// worked out from. One window's own bound is already in `window_meaning`;
// this adds the windows empty in a row under the same request.
function withRefusedInARow(task, name, result, args = {}) {
  const w = name === 'lyric_sweep' ? workflowFor(task) : null;
  const refused = w?.refused_sweep;
  const unkept = w?.unkept_sweep;
  if ((!refused && !unkept) || !result || result.isError || !Array.isArray(result.content))
    return result;
  let changed = false;
  const content = result.content.map((block) => {
    if (changed || block?.type !== 'text') return block;
    let v;
    try {
      v = JSON.parse(block.text);
    } catch {
      return block;
    }
    if (!v || !Number.isInteger(v.swept)) return block;
    // A window that planned and kept no seed: its paragraph is rebuilt with
    // the windows swept in a row, and stops offering a further window once
    // one is more likely than not to keep none.
    if (unkept && v.sweep_outcome === 'no seed kept') {
      changed = true;
      const bound = Math.round(planShareBound(unkept.seeds) * 1e4) / 1e4;
      const spent = sweepingIsSpent(unkept.seeds, v.window?.count);
      const { outcome, next_call, next, ...rest } = v;
      return {
        ...block,
        text: JSON.stringify({
          ...rest,
          window_meaning: noneKeptMeaning(v, statedFields(args), {
            seeds: unkept.seeds,
            bound,
            spent,
          }),
          unkept_in_a_row: { seeds: unkept.seeds, accept_share_bound: bound, spent },
          ...(outcome !== undefined ? { outcome } : {}),
          ...(next_call !== undefined ? { next_call } : {}),
          ...(next !== undefined ? { next } : {}),
        }),
      };
    }
    if (!refused || v.sweep_outcome !== 'planner refused every seed') return block;
    changed = true;
    const bound = Math.round(planShareBound(refused.seeds) * 1e4) / 1e4;
    const { next_call, next, ...rest } = v;
    return {
      ...block,
      text: JSON.stringify({
        ...rest,
        ...(refused.seeds > v.swept && typeof v.window_meaning === 'string'
          ? {
              window_meaning:
                v.window_meaning +
                ` Across the windows refused in a row under this request, none of the ${refused.seeds} seeds planned: at most ${(100 * bound).toFixed(1)}% of seeds plan (95% bound).`,
            }
          : {}),
        refused_in_a_row: { seeds: refused.seeds, plan_share_bound: bound },
        ...(next_call !== undefined ? { next_call } : {}),
        ...(next !== undefined ? { next } : {}),
      }),
    };
  });
  return changed ? { ...result, content } : result;
}
export const withSessionOutcome = (task, name, result, carried, args = {}) =>
  task?.domain === 'lyrics'
    ? withOutcome(name, withRefusedInARow(task, name, result, args), args, (tool, v, a) =>
        sessionOutcome(task, tool, v, carried, a)
      )
    : result;

// A create session's successful lyric_sweep: the report's "NEXT: lyric_plan
// with seed N" line (published by lyric_tools.js from the sweep's own
// arguments) becomes the call the gate admits, worked out after this sweep's
// receipt is recorded. A create session's lyric_grade verdict that names a
// `next` gets the call its receipts admit instead (withGradeNext). Every
// other result passes through unchanged.
export const SWEEP_NEXT = /NEXT: lyric_plan with seed -?\d+[^\n]*/;
// A raw lyric_sweep's NEXT line: the plan call for its first accepted seed,
// built exactly as a session builds it from a fresh sweep receipt (#671, C2).
export function sweepNextLine(args, seed) {
  const task = { domain: 'lyrics', phase: 'create' };
  workflowFor(task).sweeps.push({ args: structuredClone(args), accepted: [seed] });
  return formatNextCall(nextCreationCall(task, null, 'lyric_plan'));
}
// THE GRADE VERDICT'S NEXT STEP (#671, B9/C4). `next` is the sentence a
// caller reads; `next_call` is its tool and the args the server sets (seed,
// new_run), not the whole call. A raw grade
// knows only its own plan: lyric_revise with its seed. A session reads its
// receipts after this grade is recorded: no receipt for this plan, or a held
// run (an uncertified parked run, an unknown-outcome proposal), names none;
// a carried run, or a run this plan already started, makes it a new run, as
// the stop's CONTINUE note says.
export function gradeNext(code, newRun = false, recorded = false) {
  return (
    (code === 0 ? 'To finish it, call' : 'Call') +
    // A host that keeps the grade receipt holds the graded draft: the call
    // sends none, so no line can change between the grade and the revise.
    (recorded
      ? " lyric_revise with this grade's seed" +
        (newRun ? ', new_run: true' : '') +
        ' and no draft: the graded draft and its declarations are taken from the record'
      : " lyric_revise with this exact draft, unchanged, and this grade's seed and declarations" +
        (newRun ? ', with new_run: true' : '')) +
    (code === 0 ? '' : '; its revise loop works on the flagged lines') +
    '. If you change any line yourself instead, ' +
    'grade the changed draft with lyric_grade before starting a revision.'
  );
}
export function gradedNextCall(task, carried) {
  const w = workflowFor(task);
  if (!w?.plan || w.grade?.plan_sha256 !== w.plan.sha256) return null;
  const move = carriedMove(carried);
  if (move === 'hold') return null;
  const newRun = move != null || w.started?.plan_sha256 === w.plan.sha256;
  return {
    tool: 'lyric_revise',
    args: { seed: w.plan.request.seed, ...(newRun ? { new_run: true } : {}) },
    recorded: Array.isArray(w.grade.draft),
  };
}
function withGradeNext(task, result, carried) {
  let changed = false;
  const content = result.content.map((block) => {
    if (changed || block?.type !== 'text') return block;
    let v;
    try {
      v = JSON.parse(block.text);
    } catch {
      return block;
    }
    if (!v || typeof v !== 'object' || !Number.isInteger(v.exit_code) || !v.next) return block;
    // At exit 2 `next` names words to change and no call (a measured draft
    // that could not all be judged): there is no call to replace, so it stays.
    if (v.exit_code === 2) return block;
    changed = true;
    const { next: _text, next_call: _call, ...rest } = v;
    const call = gradedNextCall(task, carried);
    return {
      ...block,
      text: JSON.stringify(
        call
          ? {
              ...rest,
              next_call: { tool: call.tool, args: call.args },
              next: gradeNext(v.exit_code, !!call.args.new_run, call.recorded),
            }
          : rest
      ),
    };
  });
  return changed ? { ...result, content } : result;
}
// THE PLAN VERDICT'S NEXT STEP (writer plan, stage 2). The CLI's closing
// lines (the path it wrote, the python commands that grade it) are cut from
// the plan report, and nothing named the call that replaces them: a caller
// holding a finished plan was told nothing. `next` is the sentence a caller
// reads; `next_call` is its tool and the args the server sets. A raw plan
// knows only itself: lyric_grade with its seed. A session reads its receipts
// after this plan is recorded, as a grade does: a held run names no call, and
// a run or a grade already standing under this same plan names lyric_revise.
export function planNext(call, lines) {
  if (call.tool === 'lyric_grade')
    return (
      `Write the ${lines} lines to the brief, then call lyric_grade with the complete ` +
      `${lines}-line draft and this plan's seed and declarations.`
    );
  return formatNextCall({ ...call, lines }).replace(/^NEXT: /, 'Call ');
}
// A REFUSED PLAN'S NEXT STEP (writer plan, stage 2). The planner records
// whether it refused what this seed drew or the request itself
// (`plan_refusal.scope`, the exception's class). "Another seed" is said only
// for the first: a fault in the request is refused the same way on every
// seed. The second sentence states the gate's own rule for what a changed
// request needs (the plan repeats the sweep's SWEEP_COORDINATES and `want`).
export function planRefusedNext(scope) {
  return scope === 'seed'
    ? 'This refusal is about what this seed drew, not about the request: another seed under the ' +
        'same declarations may plan. Call lyric_sweep for further seeds, then lyric_plan with one ' +
        'it accepts.'
    : 'This refusal is about the request itself: every seed is refused the same way until what ' +
        `\`refusal\` names changes. A change to the ${joined([...SWEEP_COORDINATES, '`want`'], 'or')} needs ` +
        'a new lyric_sweep first; any other change goes to lyric_plan again with this seed.';
}
function withPlanNext(task, result, carried) {
  let changed = false;
  const content = result.content.map((block) => {
    if (changed || block?.type !== 'text') return block;
    let v;
    try {
      v = JSON.parse(block.text);
    } catch {
      return block;
    }
    if (!v || typeof v !== 'object' || !Number.isInteger(v.exit_code) || !v.next) return block;
    // A refused plan's `next` is about the refusal and is true on every
    // host: it is kept. Only a finished plan's call is the receipts' to name.
    if (v.exit_code !== 0) return block;
    changed = true;
    const { next: _text, next_call: _call, ...rest } = v;
    const call = nextCreationCall(task, carried);
    const admitted = call && ['lyric_screen', 'lyric_grade', 'lyric_revise'].includes(call.tool);
    return {
      ...block,
      text: JSON.stringify(
        admitted
          ? {
              ...rest,
              next_call: { tool: call.tool, args: call.args },
              next: planNext(call, call.lines),
            }
          : rest
      ),
    };
  });
  return changed ? { ...result, content } : result;
}
export function withSweepNext(task, name, result, carried) {
  if (!['lyric_sweep', 'lyric_plan', 'lyric_grade'].includes(name)) return result;
  if (!result || result.isError || !Array.isArray(result.content)) return result;
  const w = workflowFor(task);
  if (!w) return result;
  if (name === 'lyric_grade') return withGradeNext(task, result, carried);
  if (name === 'lyric_plan') return withPlanNext(task, result, carried);
  if (!w.sweeps.length) return result;
  // A held run (an uncertified parked run, an unknown-outcome proposal) gets
  // no NEXT; the harness's own "lyric_plan with seed N" line is removed too,
  // since the surface refuses that plan.
  const line = formatNextCall(nextCreationCall(task, carried, 'lyric_plan'));
  const NEXT_LINE = new RegExp(`[ \\t]*${SWEEP_NEXT.source}\\n?`);
  let changed = false;
  const content = result.content.map((block) => {
    if (block?.type !== 'text') return block;
    let v;
    try {
      v = JSON.parse(block.text);
    } catch {
      return block;
    }
    if (!v || typeof v.report !== 'string' || !SWEEP_NEXT.test(v.report)) return block;
    changed = true;
    const report = line ? v.report.replace(SWEEP_NEXT, line) : v.report.replace(NEXT_LINE, '');
    return { ...block, text: JSON.stringify({ ...v, report }) };
  });
  return changed ? { ...result, content } : result;
}
