// Clients own short capabilities; the service owns exact workspaces and receipts.
// JobStore's single-successor admission makes a retried submission observe the
// same operation. A process restart never silently redispatches paid work.
import { randomBytes } from 'node:crypto';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { connectConnector } from './client.js';
import { requestDigest } from './job_store.js';
import { createOperationBudget } from './paid_budget.js';
import { withExecutionContext } from './execution_context.js';
import { CONNECTOR_CONTRACT_VERSION } from './contract_version.js';
import {
  assertContinuationSemantics,
  continuationSemanticIdentity,
  encodeState,
  recoverState,
} from './state_codec.js';
import { HTTP_REQUEST_BYTES, jsonBytes } from './payload_limits.js';
import { sessionView } from './verdict_view.js';

// Persisted namespace from the first release: keep existing capabilities recoverable.
export const INTEGRATION = 'chatgpt-v1';

// Connector sessions keep their own store, apart from /chat's receipts. /chat
// keeps a few large signed conversations (128 payload records); a session
// receipt is small (about 32 KB for a recipe, a few hundred KB for a lyric
// revision carrying its journal) and a public connector writes one per call. Sized here so neither surface's
// traffic can retire the other's work or fill the other's disk; the byte
// ceiling is what bounds memory, and eviction retires superseded receipts first.
export const SESSION_STORE_LIMITS = Object.freeze({
  maxRecords: 16384,
  maxPayloadRecords: 2048,
  maxBytes: 64 * 1024 * 1024,
});

const capability = () => randomBytes(32).toString('hex');
const clone = (value) => structuredClone(value);
const fail = (code, message) =>
  Object.assign(new Error(`${code}: ${message}`), { code, beforeDispatch: true });
const restartStep = (domain) =>
  domain === 'recipe'
    ? 'Call start_recipe to open a new recipe session.'
    : domain === 'lyrics'
      ? 'Call begin_lyrics to open a new lyrics session.'
      : 'Open a new session: start_recipe for a recipe, begin_lyrics for lyrics.';
// A closed budget settles every pending reservation as unknown. When the
// ledger cannot record that, the caller must treat the spend as unknown too;
// it must never be asked twice.
function closeBudget(budget) {
  try {
    budget?.close();
    return null;
  } catch (error) {
    return error;
  }
}
const retiredWriter = () =>
  fail(
    'SESSION_WRITER_RETIRED',
    "This session was opened for the service's own writer, which now runs only inside the website chat. Call begin_lyrics for a new session — you write every line — and grade your draft there before revising. lyric_revise with this session_id and recover_only: true exports what this session holds."
  );
const privateFields = new Set([
  'workspace',
  'state',
  'checkpoint',
  'replay_draft',
  'run_id',
  'run_revision',
]);
const privateRun = (text) => text.replace(/run_[a-f0-9]{64}/g, '[private run]');

export function verdictOf(result) {
  for (const block of result?.content || []) {
    if (block.type !== 'text') continue;
    try {
      const value = JSON.parse(block.text);
      if (Number.isInteger(value?.exit_code)) return value;
    } catch {
      /* Plain-text song. */
    }
  }
  return null;
}

// A revise the deadline stopped mid-run tells a caller-managed client to
// resume with run_id or state, both of which a session withholds. In a
// session the run's journal is carried, so the continuation is lyric_revise
// with the latest session_id and no answer (song run B, 2026-09-30: a writer
// told to send run_id re-sent the answer instead and was refused).
const CALLER_RESUME =
  / Resume explicitly with run_id or (?:state|checkpoint) under the same declarations; completed proposals are in that journal\./;
const SESSION_RESUME =
  ' Continue with lyric_revise, the latest session_id and no answer: the session carries this run and replays its journal. If that is stopped again, lyric_revise with recover_only: true exports the journal, and a new run can start from its accepted lines.';

function visible(value) {
  if (Array.isArray(value)) return value.map(visible);
  if (value && typeof value === 'object' && typeof value.meaning === 'string')
    value = { ...value, meaning: value.meaning.replace(CALLER_RESUME, SESSION_RESUME) };
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !privateFields.has(key))
      .map(([key, item]) => [key, visible(item)])
  );
}

// The raw engine's continue footnote tells a caller-managed client which run
// capability to send back. In a session the server holds that run, so the
// footnote is replaced with the procedure that works here. A suspended run
// continues with the answer; a stopped (parked) run has no pending question,
// so going on is a new run on a rewritten draft — graded first for a new song,
// because creation admits revision only of a draft graded against its plan.
export function continueNote(footnote, task = null) {
  if (!/no question is pending/.test(footnote))
    return (
      '\n\nCONTINUE: call lyric_revise with the latest session_id and `answer` (one line of song ' +
      'text) or `answers` (one {line, text} per asked line). The session carries the run, its ' +
      'state and its draft.'
    );
  return task?.phase === 'edit'
    ? '\n\nCONTINUE: no question is pending. Rewrite the open line(s), then call lyric_revise with ' +
        'the latest session_id, the complete rewritten draft, the same declarations this run ' +
        'was given (scheme or groups, relation, and any returns, structures or blueprint) and ' +
        '`new_run: true`.'
    : '\n\nCONTINUE: no question is pending. Rewrite the open line(s), grade the complete ' +
        'rewritten draft with lyric_grade, then call lyric_revise with that exact draft and ' +
        '`new_run: true` — each call with the latest session_id.';
}

// `view` is how a session publishes a lyric verdict: `tool` names the tool
// that produced it, so a finished grade or revise gets the short verdict, and
// `detail`/`lines` select what get_operation returns in its place
// (verdict_view.js). Without `tool` the blocks are published as stored.
export function publicToolResult(result, task = null, view = {}) {
  const content = (result.content || []).map((block) => {
    if (block.type !== 'text') throw new Error('Unexpected non-text connector result.');
    try {
      return { type: 'text', text: JSON.stringify(visible(JSON.parse(block.text))) };
    } catch {
      // Keep the song verbatim; replace only the raw connector's continuation
      // footnote, which otherwise names an internal run capability.
      const text = block.text.replace(/\n\nCONTINUE: [\s\S]*$/, (footnote) =>
        continueNote(footnote, task)
      );
      return { type: 'text', text: privateRun(text) };
    }
  });
  return {
    content: view.tool ? sessionView(view.tool, content, view) : content,
    ...(result.isError ? { isError: true } : {}),
  };
}

export async function executeNative(session, name, input) {
  const next = clone(session);
  const args = clone(input);
  if (next.task.domain === 'recipe') {
    // A format applies to the call that asks for it. Rich is the default for
    // every call, as published; an earlier call's format never carries over.
    next.task.format = args.format || 'rich';
    if (['edit_recipe', 'render_recipe'].includes(name)) {
      if (!next.workspace)
        throw fail(
          'SESSION_EMPTY',
          `This session holds no recipe: its start_recipe did not succeed. ${restartStep('recipe')}`
        );
      args.workspace = next.workspace;
    }
  } else if (name === 'lyric_revise') {
    if (args.new_run) next.native.continuation = null;
    const carried = next.native.continuation?.args;
    // The maintained client already does this in create mode. Edit sessions
    // need the same restoration, without exposing state to the language model.
    if (carried && next.task.phase === 'edit') {
      for (const [key, value] of Object.entries(carried)) {
        if (args[key] !== undefined && requestDigest(args[key]) !== requestDigest(value))
          throw fail(
            'SESSION_CONTINUATION',
            `${key} differs from the recorded run. To answer its pending question send only answer/answers; to revise a different draft or mandate, send the complete draft and mandate with new_run: true.`
          );
        args[key] = clone(value);
      }
    }
    // Sessions opened before the service writer was confined to the website
    // chat could name it. Such a session cannot revise.
    if (next.writer === 'kitchen') throw retiredWriter();
  }
  const server = buildServer({ task: next.task });
  const [a, b] = InMemoryTransport.createLinkedPair();
  let client;
  try {
    await server.connect(a);
    // The server was built from this tree a line above; comparing its surface
    // with the tree's would compare the tree with itself.
    client = await connectConnector({
      task: next.task,
      transport: b,
      session: next.native,
      verifySurface: false,
    });
    const result = await client.call(name, args);
    // The client drops a stopped run's continuation itself: a stop's archived
    // journal is provenance, not another pending question.
    next.native = client.snapshot();
    if (!result.isError && next.task.domain === 'recipe') {
      const value = JSON.parse(result.content[0].text);
      if (value.workspace) next.workspace = value.workspace;
    }
    const verdict = verdictOf(result);
    if (name === 'lyric_revise' && verdict && !result.isError) {
      // The last journal a revision returned. recover_only exports it on request.
      next.recovery = verdict.state || verdict.checkpoint || next.recovery || null;
      next.uncertain = !!verdict.uncertain_proposal;
    }
    return { session: next, result };
  } finally {
    await client?.close();
    await server.close();
  }
}

export class WorkflowSessions {
  constructor({
    store,
    // A store written by an earlier release, read so its sessions stay
    // recoverable and continuable until they expire there.
    legacyStore = null,
    build = {},
    execute = executeNative,
    createBudget = createOperationBudget,
    maxActive = 16,
  } = {}) {
    this.store = store;
    this.legacyStore = legacyStore;
    this.build = build;
    this.execute = execute;
    this.createBudget = createBudget;
    this.maxActive = maxActive;
    this.active = new Map();
    // Only lyric work is queued in the background; recipe calls are awaited
    // by their own request and do not count against the lyric queue.
    this.queued = new Set();
  }

  lookup(id) {
    const own = this.store.get(id);
    if (own) return own;
    const legacy = this.legacyStore?.get(id);
    return legacy && legacy.state !== 'retired' && legacy.intent?.integration === INTEGRATION
      ? legacy
      : null;
  }

  record(id, domain) {
    const record = this.lookup(id);
    if (record?.state === 'retired')
      throw fail(
        'SESSION_RETIRED',
        `This id's saved state was retired: its retention ended, or newer work needed the space. ${restartStep(domain)}`
      );
    if (!record || record.intent?.integration !== INTEGRATION)
      throw fail(
        'SESSION_UNAVAILABLE',
        `No session or operation with this id is retained here: it was never issued, or it expired. ${restartStep(domain)}`
      );
    const session = record.response?.body?.session || record.checkpoint?.session;
    if (!session)
      throw fail('SESSION_UNAVAILABLE', `This receipt holds no session. ${restartStep(domain)}`);
    if (domain != null && session.task.domain !== domain)
      throw fail(
        'SESSION_SCOPE',
        `This id belongs to a ${session.task.domain} session, not a ${domain} one; use it only with the ${session.task.domain} tools. ${restartStep(domain)}`
      );
    return { record, session };
  }

  fresh(domain, { phase = 'create', format = 'rich' } = {}) {
    const task = domain === 'recipe' ? { domain, format, maxChars: 1000 } : { domain, phase };
    return {
      version: 1,
      task,
      // Every outside session is written by its caller. The field stays on the
      // record so a session opened for the service writer still reads back as
      // one (and is refused revision).
      writer: domain === 'lyrics' ? 'interview' : null,
      semantic_identity: continuationSemanticIdentity(),
      workspace: null,
      native: {
        version: 1,
        connector_contract: CONNECTOR_CONTRACT_VERSION,
        task: clone(task),
        continuation: null,
      },
    };
  }

  open(domain, options = {}) {
    const session = this.fresh(domain, options);
    const id = capability();
    this.store.begin(id, { request_id: id, integration: INTEGRATION, action: 'open' }, this.build, {
      session,
    });
    this.store.complete(id, 200, { session, result: { content: [] } });
    return this.status(id, domain);
  }

  // Lyric continuations are bound to the scorer that produced them; a recipe
  // workspace is plain data that any release of the engine renders.
  assertSemantics(session) {
    if (session.task.domain !== 'lyrics') return;
    try {
      assertContinuationSemantics(session.semantic_identity);
    } catch (error) {
      if (error.code !== 'CONTINUATION_MIGRATION_REQUIRED') throw error;
      throw fail(
        'CONTINUATION_MIGRATION_REQUIRED',
        'The scorer, its lexical data or its runtime changed after this session was recorded, and its receipts cannot be replayed under the new ones. lyric_revise with this session_id and recover_only: true exports the lyrics and journal it holds; then call begin_lyrics for a new session.'
      );
    }
  }

  // Whether an interrupted operation can continue with resume_operation.
  resumable(record, session) {
    if (record.state !== 'interrupted' || this.store.failure) return false;
    try {
      this.resumeSnapshot(record, session);
      return true;
    } catch {
      return false;
    }
  }

  // sessionId is null only for start_recipe, which opens its session with the
  // operation instead of writing a separate empty session first.
  submit(sessionId, domain, tool, args, { resumed = false } = {}) {
    if (jsonBytes(args) > HTTP_REQUEST_BYTES - 4096)
      throw fail(
        'SESSION_INPUT_LIMIT',
        'Arguments exceed the recoverable request allowance. Send a smaller request, such as fewer edits or a shorter draft per call.'
      );
    if ((domain === 'lyrics') !== tool.startsWith('lyric_'))
      throw fail(
        'SESSION_SCOPE',
        `Recipe and lyric operations cannot share a session. ${restartStep(domain)}`
      );
    const action = { tool, arguments: clone(args), resumed };
    let parent = null;
    let session;
    if (sessionId == null) {
      if (tool !== 'start_recipe' || resumed)
        throw fail('SESSION_REQUIRED', `Pass the latest session_id. ${restartStep(domain)}`);
      session = this.fresh(domain, { format: args.format });
    } else {
      let original;
      ({ record: parent, session: original } = this.record(sessionId, domain));
      if (parent.successor_id) {
        const { record: existing } = this.record(parent.successor_id, domain);
        if (requestDigest(existing.intent.action) !== requestDigest(action))
          throw fail(
            'STALE_SESSION',
            `This session already advanced to operation ${parent.successor_id}. Read it with get_operation and continue from the session_id it returns.`
          );
        return this.status(existing.request_id, domain);
      }
      if (resumed) {
        if (parent.state !== 'interrupted')
          throw fail(
            'RESUME_NOT_INTERRUPTED',
            `Only an interrupted operation can be resumed; this one is ${parent.state}. Read it with get_operation and continue from its session_id.`
          );
        session = this.resumeSnapshot(parent, original);
      } else if (parent.state === 'pending') {
        throw fail(
          'SESSION_BUSY',
          'This operation is still running. Poll get_operation with this id and continue from the session_id it returns once completed.'
        );
      } else if (parent.state === 'interrupted') {
        if (this.resumable(parent, original))
          throw fail(
            'SESSION_BUSY',
            'This operation was interrupted and can resume: call resume_operation with this id, or read it with get_operation.'
          );
        // It cannot resume, so nothing of it replays: new work starts from the
        // session as it was before this operation, without its pending run.
        session = clone(original);
        session.native.continuation = null;
      } else {
        session = clone(original);
      }
    }
    this.assertSemantics(session);
    if (tool === 'lyric_revise') {
      if (session.uncertain && !args.new_run)
        throw fail(
          'CONTINUATION_UNCERTAIN',
          "The last revision's outcome is unknown, so its run cannot continue and nothing of it is replayed. Its accepted lines are in get_operation's accepted_draft (or the last verdict's final_draft). To go on, " +
            (session.task.phase === 'edit'
              ? 'call lyric_revise with the draft you keep, its mandate and new_run: true.'
              : 'grade the draft you keep with lyric_grade, then call lyric_revise with it and new_run: true.')
        );
      if ((args.answer != null || args.answers != null) && !args.new_run) {
        if (!session.native.continuation)
          throw fail(
            'NO_PENDING_QUESTION',
            'This session has no suspended revision awaiting an answer. ' +
              (session.task.phase === 'edit'
                ? 'Call lyric_revise with the complete draft and its mandate to start a run.'
                : 'To revise a draft, grade it with lyric_grade, then call lyric_revise with that exact draft.')
          );
      }
    }
    // Uncertainty forbids replaying the uncertain run, not independent work.
    if (session.uncertain) {
      session.uncertain = false;
      session.native.continuation = null;
    }
    if (domain === 'lyrics' && this.queued.size >= this.maxActive)
      throw fail(
        'SESSION_CAPACITY',
        'The lyric operation queue is full. Retry this same call with the same session_id shortly; nothing was queued.'
      );
    // A receipt written by an earlier release is copied here unchanged, so the
    // single-successor rule holds for it in the store that admits the successor.
    if (parent && !this.store.get(sessionId)) this.store.adopt(parent);
    const id = capability();
    this.store.begin(
      id,
      {
        request_id: id,
        ...(parent ? { continuation_id: sessionId } : {}),
        integration: INTEGRATION,
        action,
      },
      this.build,
      {
        session,
        // The resumed worker may stop before emitting its first checkpoint.
        // Preserve the parent's accepted words for export and retention only;
        // they are not progress from this operation and cannot authorize replay.
        ...(resumed && tool === 'lyric_revise'
          ? { accepted_lines: clone(parent.progress.accepted_lines) }
          : {}),
      }
    );
    if (domain === 'lyrics') this.queued.add(id);
    const promise = new Promise((resolve) => setImmediate(resolve))
      .then(() => this.run(id, session, tool, args))
      .finally(() => {
        this.active.delete(id);
        this.queued.delete(id);
      });
    this.active.set(id, promise);
    return this.status(id, domain);
  }

  async run(id, session, name, args) {
    let budget;
    try {
      budget = this.createBudget({ id });
      const controller = new AbortController();
      const out = await withExecutionContext(
        {
          task: session.task,
          signal: controller.signal,
          budget,
          jobId: id,
          onCheckpoint: (value) => this.store.checkpoint(id, value),
          onProposerUsage: (value) => this.store.proposerUsage(id, value),
        },
        () => this.execute(session, name, args)
      );
      // Settling the budget can itself fail (the paid-call ledger refusing to
      // persist). That is an accounting fact about THIS operation, not a
      // storage fault: the finished result is kept, the session is marked
      // uncertain so its run cannot be replayed, and the store stays healthy.
      const accountingError = closeBudget(budget);
      if (accountingError || budget.snapshot().unknownUsd > 0) out.session.uncertain = true;
      if (accountingError)
        this.store.proposerUsage(id, {
          ...this.store.get(id)?.proposer_usage,
          accounting_unknown: true,
        });
      this.store.complete(id, 200, { ...out, accounting: budget.snapshot() });
    } catch (error) {
      try {
        const accountingError = closeBudget(budget);
        // Tool refusals from the maintained client occur before dispatch.
        // Once a provider/checkpoint was recorded, preserve that journal and
        // uncertainty instead of replacing it with an ordinary error response.
        const record = this.store.get(id);
        if (accountingError || budget?.snapshot().unknownUsd > 0)
          this.store.proposerUsage(id, { ...record?.proposer_usage, accounting_unknown: true });
        if (
          accountingError ||
          record?.progress ||
          record?.proposer_usage ||
          budget?.snapshot().events.length ||
          (name === 'lyric_revise' && !error.beforeDispatch)
        )
          this.store.interrupt(id, 'operation_interrupted');
        else
          this.store.complete(id, 200, {
            session,
            result: { isError: true, content: [{ type: 'text', text: error.message }] },
            accounting: budget?.snapshot() || null,
          });
      } catch (storageError) {
        try {
          this.store.failedCompletion(id, storageError);
        } catch (fatal) {
          // A capacity refusal that cannot even record its own interruption is
          // a persistence failure. Latch it in memory (that path never writes)
          // so the receipt reads interrupted and no new work is admitted. This
          // promise is nobody's to await on the lyrics path; it must not reject.
          this.store.failedCompletion(
            id,
            Object.assign(new Error(fatal.message), { code: 'JOB_PERSISTENCE' })
          );
        }
      }
    }
  }

  resumeSnapshot(record, original) {
    const session = clone(original);
    this.assertSemantics(session);
    if (record.intent.action.tool !== 'lyric_revise') return session;
    if (session.writer === 'kitchen') throw retiredWriter();
    const progress = record.progress;
    if (
      !progress ||
      record.uncertain_proposal ||
      progress.uncertain_proposal ||
      progress.status === 'proposing' ||
      record.proposer_usage?.in_flight ||
      record.proposer_usage?.accounting_unknown ||
      progress.new_run_required ||
      ['journal_capacity', 'finished'].includes(progress.status) ||
      !Array.isArray(progress.input_draft) ||
      !Array.isArray(progress.accepted_lines) ||
      !progress.answered ||
      !progress.connector_declarations
    ) {
      throw fail(
        'CONTINUATION_UNCERTAIN',
        "This operation has no safe revision checkpoint, so it cannot resume and nothing of it is replayed. Its accepted lines are in get_operation's accepted_draft; lyric_revise with this id as session_id and recover_only: true exports its journal. To go on, pass this id as the session_id: " +
          (session.task.phase === 'edit'
            ? 'call lyric_revise with the draft you keep, its mandate and new_run: true.'
            : 'grade the draft you keep with lyric_grade, then call lyric_revise with it and new_run: true.')
      );
    }
    assertContinuationSemantics(progress.connector_semantic_identity);
    const declarations = progress.connector_declarations;
    const wire = encodeState(progress);
    session.native.continuation = {
      seed: declarations.seed,
      args: {
        ...declarations,
        draft: progress.input_draft,
        state: wire,
      },
    };
    return session;
  }

  // `domain` is null on the shared /mcp endpoint, which serves both families;
  // the operation's own session says which one it belongs to.
  resume(id, domain) {
    const { record, session } = this.record(id, domain);
    if (record.state !== 'interrupted')
      throw fail(
        'RESUME_NOT_INTERRUPTED',
        `Only an interrupted operation can be resumed; this one is ${record.state}. Read it with get_operation and continue from its session_id.`
      );
    const { tool, arguments: args } = record.intent.action;
    return this.submit(id, session.task.domain, tool, tool === 'lyric_revise' ? {} : args, {
      resumed: true,
    });
  }

  // Export, without an operation, the revision journal a lyric session holds:
  // an interrupted revision's own checkpoint, else the suspended run, else the
  // run that last stopped. Nothing is replayed, graded, stamped or recorded.
  recover(id, domain, { recovery_part } = {}) {
    const { record, session } = this.record(id, domain);
    if (session.task.domain !== 'lyrics')
      throw fail('SESSION_SCOPE', 'recover_only exports a lyrics session, not a recipe.');
    if (record.state === 'pending')
      throw fail(
        'SESSION_BUSY',
        'This operation is still running. Poll get_operation with this id, then recover from the session_id it returns.'
      );
    // The store holds a checkpoint as the worker wrote it, not as a wire; hand
    // it over as the plain JSON journal it is (no checksum is claimed for it).
    const wire =
      (record.state === 'interrupted' && record.progress && JSON.stringify(record.progress)) ||
      session.native?.continuation?.args?.state ||
      session.recovery ||
      null;
    if (!wire)
      throw fail(
        'NOTHING_TO_RECOVER',
        "This session holds no revision journal yet: no lyric_revise has returned in it. Read its accepted lines, if any, from get_operation's accepted_draft."
      );
    const exported = recoverState(wire, { part: recovery_part || 'all' });
    return {
      content: [{ type: 'text', text: privateRun(JSON.stringify(exported)) }],
    };
  }

  // Compute a recipe call without recording it, for when the store refuses
  // the receipt. The result is exact; it belongs to no session.
  async compute(sessionId, domain, tool, args) {
    const session =
      sessionId == null
        ? this.fresh(domain, { format: args.format })
        : this.record(sessionId, domain).session;
    return this.execute(session, tool, args);
  }

  // A refusal that is about the store (full, out of space, or latched after a
  // write failed), not about the call.
  storeRefused(error) {
    return (
      !!this.store.failure ||
      ['JOB_CAPACITY', 'JOB_PAYLOAD_TOO_LARGE'].includes(error?.code) ||
      error?.status === 503
    );
  }

  status(id, domain, { detail, lines } = {}) {
    const found = this.lookup(id);
    if (found?.state === 'retired')
      return {
        operation_id: id,
        status: 'retired',
        interruption: found.interruption ?? 'receipt_payload_retired',
        note: `This id's saved state was retired: its retention ended, or newer work needed the space. ${restartStep(domain)}`,
        resumable: false,
        durable: this.store.durable,
        retention_ms: this.store.ttlMs,
        expires_at: found.updated_at + this.store.ttlMs,
        uncertain_proposal: false,
      };
    const { record, session } = this.record(id, domain);
    const result = record.response?.body?.result;
    const accepted = record.progress?.accepted_lines ?? record.checkpoint?.accepted_lines;
    const resumable = this.resumable(record, session);
    // The id continues the workflow when its operation finished, or when it was
    // interrupted and cannot resume (new work then starts from before it). A
    // start_recipe that failed opened nothing to continue.
    const continues =
      record.state === 'completed'
        ? !(record.intent.action?.tool === 'start_recipe' && !session.workspace)
        : record.state === 'interrupted' && !resumable && !this.store.failure;
    return {
      operation_id: id,
      status: record.state,
      ...(continues ? { session_id: id } : {}),
      ...(record.successor_id ? { successor_id: record.successor_id } : {}),
      ...(record.intent.action?.tool ? { tool: record.intent.action.tool } : {}),
      ...(result
        ? {
            tool_result: publicToolResult(result, session.task, {
              tool: record.intent.action?.tool,
              detail,
              lines,
            }),
          }
        : {}),
      ...(result?.isError ? { tool_error: true } : {}),
      ...(accepted ? { accepted_draft: accepted } : {}),
      ...(record.interruption ? { interruption: record.interruption } : {}),
      ...(record.state === 'pending' ? { retry_after_seconds: 5 } : {}),
      resumable,
      durable: this.store.durable,
      retention_ms: this.store.ttlMs,
      expires_at: record.updated_at + this.store.ttlMs,
      uncertain_proposal: !!(
        record.uncertain_proposal ||
        session.uncertain ||
        record.progress?.uncertain_proposal ||
        record.proposer_usage?.accounting_unknown
      ),
    };
  }

  async wait(id) {
    await this.active.get(id);
  }
}
