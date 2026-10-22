// Creation qualifications are host-owned receipts from executed tools. Model
// arguments and completedSteps are never evidence that a step occurred.
import { createHash } from 'node:crypto';
import { draftFromText, normalizeDraftLines } from './lyric_text.js';

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
  'functions',
  'title',
  'narrative',
  'melody',
  'wants',
];
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
const norm = (key, value) =>
  key === 'melody'
    ? melodyValue(value)
    : key === 'functions' || key === 'wants'
      ? list(value)
      : key === 'form'
        ? value || 'verse-chorus'
        : key === 'narrative'
          ? narrative(value)
          : value === ''
            ? null
            : (value ?? null);
const create = (task) => task?.domain === 'lyrics' && task.phase !== 'edit';
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
    ? ': it printed more than this connector can carry, so screening the same request again returns the same result. A plan needs one lyric_screen that answers (exit 0 or 3): call lyric_screen again with a smaller request.'
    : '; its report names why. A plan needs one lyric_screen that answers (exit 0 or 3): call lyric_screen again once that cause is fixed.');
// Never a shorter draft of the same plan: the line-count gate refuses it.
const gradeAttemptNote = (a, lines) => {
  const facts = attemptFacts(a) ? ` (${attemptFacts(a)})` : '';
  const fewer =
    'plan fewer lines (lyric_sweep declaring `lines`, then lyric_plan on a seed it accepts) and grade a draft of that plan';
  if (a.cause === 'not_kept')
    return ` lyric_grade measured this exact draft${facts}, but its result was over the size this session can keep, so nothing it produced was kept and no grade receipt was written. Grading this same draft again returns the same result: ${fewer}. A different draft of this plan may be too large as well.`;
  if (a.cause === 'overflow')
    return ` lyric_grade ran on this exact draft but did not answer with a grade receipt${facts}: it printed more than this connector can carry. Grading this same draft again returns the same result: ${fewer}, or grade a different draft of this plan's ${lines} lines. Neither is known to be the only cure.`;
  return ` lyric_grade ran on this exact draft but did not answer with a grade receipt${facts}; its report names why. Read that report for the cause, then call lyric_grade again on this draft once it is fixed.`;
};
// The handler validates the original envelope and forbids all execution fields.
// A requested export must reach it unchanged, even when malformed, and never
// counts as planning, repair or completed work.
export const isRecoveryOnly = (name, args) =>
  name === 'lyric_revise' && args?.recover_only === true;

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

// The coordinates a plan repeats from the sweep that accepted its seed; the
// sweep's `want` list is compared on its own, as the plan's `wants`.
export const SWEEP_COORDINATES = ['form', 'lines', 'functions', 'melody'];

function sweepFor(w, args) {
  return [...w.sweeps]
    .reverse()
    .find(
      (s) =>
        s.accepted.includes(args.seed) &&
        SWEEP_COORDINATES.every((k) => same(norm(k, args[k]), norm(k, s.args[k]))) &&
        same(list(args.wants), list(s.args.want))
    );
}

// The argument form the gate writes back for a recorded plan declaration.
const planArgument = (key, value) =>
  key === 'functions' && Array.isArray(value)
    ? value.join(',')
    : key === 'narrative'
      ? narrativeArgument(value)
      : key === 'melody'
        ? JSON.stringify(value)
        : structuredClone(value);
const unset = (v) => v === null || v === '' || (Array.isArray(v) && !v.length);

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
  return [...shown, `want ${JSON.stringify(list(s.args.want))}`].join(', ');
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
          const differs = SWEEP_COORDINATES.filter(
            (k) => !same(norm(k, args[k]), norm(k, s.args[k]))
          );
          if (!same(list(args.wants), list(s.args.want)))
            differs.push("wants (the sweep's `want`)");
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
  const w = workflowFor(task);
  if (!w || !name.startsWith('lyric_')) return null;
  if (name === 'lyric_sweep') return null;
  if (name === 'lyric_screen')
    return w.sweeps.length
      ? null
      : 'CREATION_ORDER: execute a successful lyric_sweep before screening.';
  // lyric_verify is a diff of one revision and records nothing, so it serves a
  // new song's revision rounds too. lyric_check and lyric_recover grade or
  // structure a draft without the plan, which would route around the plan and
  // lyric_grade this phase enforces.
  if (!['lyric_plan', 'lyric_grade', 'lyric_revise'].includes(name)) {
    if (['lyric_check', 'lyric_recover'].includes(name))
      return `CREATION_PLAN: ${name} is for lyrics the user supplied. In this new-song session, grade your draft with lyric_grade (same seed and declarations as lyric_plan); for lyrics the user supplied, call begin_lyrics with phase 'edit'.`;
    return null;
  }
  if (!w.sweeps.length || !w.screen)
    return (
      'CREATION_ORDER: execute a successful lyric_sweep and a successful lyric_screen before planning or writing a new song.' +
      (w.sweeps.length && w.screen_attempt ? screenAttemptNote(w.screen_attempt) : '')
    );
  if (name === 'lyric_plan') {
    return sweepFor(w, args)
      ? null
      : "CREATION_PLAN: plan a seed an accepted lyric_sweep returned, with that sweep's form, lines, functions and melody, and its `want` list as `wants`. " +
          recordedSweeps(w, args);
  }
  if (!w.plan)
    return 'CREATION_PLAN: execute lyric_plan successfully before grading or revising a new song.';
  const handAuthored = UNPLANNED_FIELDS.filter((k) => args[k] !== undefined);
  if (handAuthored.length)
    return `CREATION_PLAN: hand-authored mandate or placement fields cannot replace the canonical program plan. This call sent ${handAuthored.join(', ')}, which the recorded plan supplies: send this same call again without ${handAuthored.length === 1 ? 'it' : 'them'}.`;
  const request = w.plan.request;
  for (const key of PLAN_FIELDS) {
    if (args[key] !== undefined && !same(norm(key, args[key]), norm(key, request[key])))
      return `CREATION_PLAN: ${key} differs from the recorded program plan. ${recordedField(key, request, w.plan.lines)}`;
    if (
      args[key] === undefined &&
      request[key] !== null &&
      request[key] !== undefined &&
      request[key] !== ''
    ) {
      // Restore the host's actual plan coordinates, not a model's recollection.
      args[key] = planArgument(key, request[key]);
    }
  }
  if (Array.isArray(args.draft)) args.draft = normalizeDraftLines(args.draft);
  if (typeof args.draft_text === 'string') {
    const draft = draftFromText(args.draft_text);
    if (Array.isArray(args.draft) && !same(args.draft, draft))
      return 'CREATION_DRAFT: conflicting draft and draft_text; send one exact draft representation.';
    args.draft = draft;
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
  const continuing =
    !args.new_run &&
    lyric &&
    w.started?.plan_sha256 === w.plan.sha256 &&
    (lyric.seed === request.seed || lyric.decl?.seed === request.seed);
  if (continuing) return null;
  if (
    !w.grade ||
    w.grade.plan_sha256 !== w.plan.sha256 ||
    w.grade.draft_sha256 !== hash(args.draft)
  )
    return (
      'CREATION_GRADE: lyric_grade must answer for this exact draft and canonical plan before revision starts.' +
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

export function recordCreation(task, name, args, verdict, isError = false) {
  if (isRecoveryOnly(name, args)) return;
  const w = workflowFor(task);
  if (!w || isError || !verdict) return;
  if (
    name === 'lyric_sweep' &&
    verdict.exit_code === 0 &&
    Array.isArray(verdict.accepted_shown) &&
    verdict.accepted_shown.length
  ) {
    const accepted = verdict.accepted_shown.filter(Number.isInteger);
    // A later sweep page keeps the screen receipt: the screen step records
    // that candidate words were screened in this session, and nothing it
    // checked depends on which sweep window the seed came from.
    if (accepted.length)
      w.sweeps = [...w.sweeps, { args: structuredClone(args), accepted }].slice(-8);
  } else if (name === 'lyric_screen' && w.sweeps.length) {
    if (answered(verdict)) {
      w.screen = { words: structuredClone(args.words || []), relation: args.relation ?? null };
      delete w.screen_attempt;
    } else w.screen_attempt = attemptOf(verdict);
  } else if (name === 'lyric_plan') {
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
      !PLAN_FIELDS.every((key) => same(norm(key, args[key]), norm(key, p.request[key]))) ||
      !Number.isInteger(p.total_lines) ||
      !Array.isArray(p.line_slots) ||
      p.line_slots.length !== p.total_lines ||
      !Array.isArray(p.sections) ||
      !p.sections.length ||
      !sweepFor(w, p.request) ||
      !w.screen
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
