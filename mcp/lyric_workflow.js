// Creation qualifications are host-owned receipts from executed tools. Model
// arguments and completedSteps are never evidence that a step occurred.
import { createHash } from 'node:crypto';

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const list = (value) =>
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map((v) => String(v).trim())
    .filter(Boolean)
    .sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const PLAN_FIELDS = [
  'seed',
  'form',
  'lines',
  'relation',
  'functions',
  'title',
  'narrative',
  'wants',
];
const READING_FIELDS = ['pronunciations', 'fallback', 'voices'];
const readingValue = (key, value) =>
  value ?? (key === 'pronunciations' ? [] : key === 'voices' ? false : null);
const UNPLANNED_FIELDS = ['scheme', 'groups', 'returns', 'structures', 'blueprint', 'subdivision'];
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
const norm = (key, value) =>
  key === 'functions' || key === 'wants'
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

function sweepFor(w, args) {
  return [...w.sweeps]
    .reverse()
    .find(
      (s) =>
        s.accepted.includes(args.seed) &&
        ['form', 'lines', 'functions'].every((k) => same(norm(k, args[k]), norm(k, s.args[k]))) &&
        same(list(args.wants), list(s.args.want))
    );
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
  if (!['lyric_plan', 'lyric_grade', 'lyric_revise'].includes(name)) {
    if (['lyric_check', 'lyric_verify', 'lyric_recover'].includes(name))
      return 'CREATION_PLAN: a new song must use the program plan and lyric_grade. Pasted-song tools require an explicit edit task.';
    return null;
  }
  if (!w.sweeps.length || !w.screen)
    return 'CREATION_ORDER: execute lyric_sweep and lyric_screen before planning or writing a new song.';
  if (name === 'lyric_plan') {
    if (args.inspection_only === true)
      return 'CREATION_PLAN: an inspection-only plan cannot qualify a production song.';
    return sweepFor(w, args)
      ? null
      : 'CREATION_PLAN: use an accepted sweep seed with the same form, lines, functions and wants.';
  }
  if (!w.plan)
    return 'CREATION_PLAN: execute lyric_plan successfully before grading or revising a new song.';
  if (UNPLANNED_FIELDS.some((k) => args[k] !== undefined))
    return 'CREATION_PLAN: hand-authored mandate or placement fields cannot replace the canonical program plan.';
  const request = w.plan.request;
  for (const key of PLAN_FIELDS) {
    if (args[key] !== undefined && !same(norm(key, args[key]), norm(key, request[key])))
      return `CREATION_PLAN: ${key} differs from the recorded program plan.`;
    if (
      args[key] === undefined &&
      request[key] !== null &&
      request[key] !== undefined &&
      request[key] !== ''
    ) {
      // Restore the host's actual plan coordinates, not a model's recollection.
      args[key] =
        key === 'functions' && Array.isArray(request[key])
          ? request[key].join(',')
          : key === 'narrative'
            ? narrativeArgument(request[key])
            : structuredClone(request[key]);
    }
  }
  if (!Array.isArray(args.draft) || !args.draft.length)
    return 'CREATION_DRAFT: the exact complete draft is required.';
  if (args.draft.length !== w.plan.lines)
    return 'CREATION_DRAFT: the draft line count differs from the canonical program plan.';
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
    return 'CREATION_GRADE: lyric_grade must answer for this exact draft and canonical plan before revision starts.';
  for (const key of READING_FIELDS) {
    const graded = readingValue(key, w.grade.readings?.[key]);
    if (args[key] !== undefined && !same(readingValue(key, args[key]), graded))
      return `CREATION_GRADE: ${key} differs from the graded reading; execute lyric_grade again before starting a new revision.`;
    if (args[key] === undefined && graded !== null) args[key] = structuredClone(graded);
  }
  return null;
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
    if (accepted.length) {
      w.sweeps = [...w.sweeps, { args: structuredClone(args), accepted }].slice(-8);
      w.screen = null;
    }
  } else if (name === 'lyric_screen' && answered(verdict) && w.sweeps.length) {
    w.screen = { words: structuredClone(args.words || []), relation: args.relation ?? null };
  } else if (name === 'lyric_plan') {
    w.plan = null;
    w.grade = null;
    w.started = null;
    const p = verdict.plan;
    if (
      verdict.exit_code !== 0 ||
      !p ||
      p.plan_version !== 3 ||
      verdict.plan_sha256 !== hash(p) ||
      !p.request ||
      p.request.inspection_only ||
      !same(p.request, verdict.plan_request) ||
      !PLAN_FIELDS.every((key) => same(norm(key, args[key]), norm(key, p.request[key]))) ||
      !p.execution_limits ||
      p.execution_limits.admitted !== true ||
      !Number.isInteger(p.execution_limits.max_lines) ||
      !Number.isInteger(p.total_lines) ||
      p.total_lines > p.execution_limits.max_lines ||
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
      execution_limits: structuredClone(p.execution_limits),
    };
    task.plan = {
      args: structuredClone(p.request),
      result: structuredClone(p),
      sha256: verdict.plan_sha256,
    };
  } else if (name === 'lyric_grade') {
    w.grade = null;
    if (
      [0, 2, 3].includes(verdict.exit_code) &&
      verdict.measurement_status === 'graded' &&
      assessmentCoverageValid(verdict.coverage) &&
      verdict.certified === verdict.coverage.certified &&
      (verdict.exit_code !== 2 || verdict.coverage.certified === false) &&
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
        readings: Object.fromEntries(
          READING_FIELDS.map((key) => [key, structuredClone(readingValue(key, args[key]))])
        ),
      };
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
