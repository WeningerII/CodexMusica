// Test fixture (stage 3, "state it or say draw"): a new-song sweep's
// arguments with every STATEABLE thing stated. What the call states stays as
// it is. A missing form stays missing: a new song's form is a catalog form,
// and leaving out both form fields is the statement that the sweep chooses
// one (#902; a legacy `form` is CREATION_FORM). Every other missing row is
// drawn. Nothing here is a hand-picked value: the rest is `draw`.
import {
  FORM_ROWS,
  drawList,
  recordCreation,
  statementsOf,
  withPlanLineage,
  withSessionOutcome,
  withSweepNext,
} from './lyric_workflow.js';

const roster = (functions) =>
  functions == null
    ? null
    : String(functions)
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

// -> the FORM_ROWS rows a call with these `lines` and `functions` can plan.
// For a saved legacy job, or a raw call at the compatibility boundary.
export function formsFor(args = {}) {
  const fns = roster(args.functions);
  return FORM_ROWS.filter(
    (r) =>
      (args.lines == null || r.min_lines <= args.lines) &&
      (!fns || r.requires.every((f) => fns.includes(f)))
  );
}

export function stated(args = {}) {
  const out = { ...args };
  const drawn = statementsOf(args)
    .missing.filter((r) => r.draw)
    .map((r) => r.field);
  if (drawn.length) out.draw = drawList([...(args.draw || []), ...drawn]);
  return out;
}

// The statement a sweep made before #902: a missing form is a FORM_ROWS row
// the call can plan, picked by `seed` among those, and the rest is drawn.
// Only for a saved legacy job (legacySweep) or the raw engine.
export function legacyStated(args = {}, seed = 0) {
  const out = stated(args);
  if (args.form === undefined && args.catalog_form === undefined) {
    const forms = formsFor(args);
    out.form = forms[Math.abs(seed) % forms.length].form;
  }
  return out;
}

// A JOB SAVED BEFORE #902. A new-song session's sweep refuses the legacy
// `form` now (CREATION_FORM), and a session whose recorded sweep already holds
// one keeps planning, grading and revising under it. This runs that sweep on
// the raw engine, the compatibility boundary that keeps `form`, and records it
// on a new-song task as the SDK client recorded it then: the receipt, and the
// result as the session published it. `task` is the job's task so far (a
// copy is recorded on); a new one when absent.
// -> { task, args, result, verdict, published }.
const verdictIn = (result) =>
  (result?.content || [])
    .map((block) => {
      try {
        return JSON.parse(block.text);
      } catch {
        return null;
      }
    })
    .find((v) => Number.isInteger(v?.exit_code)) ?? null;
export async function legacySweep(args, task = { domain: 'lyrics', phase: 'create' }) {
  const { buildServer } = await import('./tools.js');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
  const server = buildServer({ task: { domain: 'lyrics' } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'legacy-job', version: '1' }, { capabilities: {} });
  await client.connect(b);
  try {
    const result = await client.callTool({ name: 'lyric_sweep', arguments: structuredClone(args) });
    const verdict = verdictIn(result);
    const held = structuredClone(task);
    recordCreation(held, 'lyric_sweep', structuredClone(args), verdict, !!result.isError);
    const published = withSessionOutcome(
      held,
      'lyric_sweep',
      withPlanLineage(held, 'lyric_sweep', withSweepNext(held, 'lyric_sweep', result, null)),
      null,
      args
    );
    return { task: held, args, result, verdict, published };
  } finally {
    await client.close();
    await server.close();
  }
}

// -> the SDK client's saved snapshot of that task (connectConnector `session`).
export async function legacySnapshot(task) {
  const { CONNECTOR_CONTRACT_VERSION } = await import('./contract_version.js');
  return {
    version: 1,
    connector_contract: CONNECTOR_CONTRACT_VERSION,
    task: structuredClone(task),
    continuation: null,
  };
}

// -> the id of a session in `sessions` holding that task, written into its
// store as WorkflowSessions.open writes a session. `base` is the session the
// job had so far (a copy is written); a fresh one when absent.
export async function legacySession(sessions, task, base = null) {
  const { INTEGRATION } = await import('./workflow_sessions.js');
  const { randomBytes } = await import('node:crypto');
  const session = base ? structuredClone(base) : sessions.fresh('lyrics');
  session.native.task = structuredClone(task);
  const id = randomBytes(32).toString('hex');
  sessions.store.begin(
    id,
    { request_id: id, integration: INTEGRATION, action: 'open' },
    sessions.build,
    { session }
  );
  sessions.store.complete(id, 200, { session, result: { content: [] } });
  return id;
}
