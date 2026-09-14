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
} from './state_codec.js';
import { HTTP_REQUEST_BYTES, jsonBytes } from './payload_limits.js';

// Persisted namespace from the first release: keep existing capabilities recoverable.
const INTEGRATION = 'chatgpt-v1';
const capability = () => randomBytes(32).toString('hex');
const clone = (value) => structuredClone(value);
const fail = (code, message) =>
  Object.assign(new Error(`${code}: ${message}`), { code, beforeDispatch: true });
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
const privateFields = new Set([
  'workspace',
  'state',
  'checkpoint',
  'replay_draft',
  'run_id',
  'run_revision',
]);

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

function visible(value) {
  if (Array.isArray(value)) return value.map(visible);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !privateFields.has(key))
      .map(([key, item]) => [key, visible(item)])
  );
}

export function publicToolResult(result) {
  return {
    content: (result.content || []).map((block) => {
      if (block.type !== 'text') throw new Error('Unexpected non-text connector result.');
      try {
        return { type: 'text', text: JSON.stringify(visible(JSON.parse(block.text))) };
      } catch {
        // Keep the song verbatim; replace only the raw connector's continuation
        // footnote, which otherwise exposes an internal run capability.
        const text = block.text
          .replace(
            /\n\nCONTINUE: (?:call lyric_revise|no question is pending)[\s\S]*$/,
            '\n\nContinue with the returned session_id.'
          )
          .replace(/run_[a-f0-9]{64}/g, '[private run]');
        return { type: 'text', text };
      }
    }),
    ...(result.isError ? { isError: true } : {}),
  };
}

export async function executeNative(session, name, input) {
  const next = clone(session);
  const args = clone(input);
  if (next.task.domain === 'recipe') {
    // This endpoint explicitly accepts the user's requested output view.
    next.task.format = args.format || next.task.format || 'rich';
    if (name !== 'start_recipe') args.workspace = next.workspace;
  } else if (name === 'lyric_revise' && !args.recover_only) {
    if (args.new_run) next.native.continuation = null;
    const carried = next.native.continuation?.args;
    // The maintained client already does this in create mode. Edit sessions
    // need the same restoration, without exposing state to the language model.
    if (carried && next.task.phase === 'edit') {
      for (const [key, value] of Object.entries(carried)) {
        if (args[key] !== undefined && requestDigest(args[key]) !== requestDigest(value))
          throw fail('SESSION_CONTINUATION', `${key} differs from the recorded run.`);
        args[key] = clone(value);
      }
    }
    args.writer = next.writer;
  }
  const server = buildServer({ task: next.task });
  const [a, b] = InMemoryTransport.createLinkedPair();
  let client;
  try {
    await server.connect(a);
    client = await connectConnector({ task: next.task, transport: b, session: next.native });
    const result = await client.call(name, args);
    next.native = client.snapshot();
    if (!result.isError && next.task.domain === 'recipe') {
      const value = JSON.parse(result.content[0].text);
      if (value.workspace) next.workspace = value.workspace;
    }
    const verdict = verdictOf(result);
    if (name === 'lyric_revise' && verdict && !result.isError) {
      next.recovery = verdict.state || verdict.checkpoint || next.recovery || null;
      // A stop's archived journal is provenance, not another pending question.
      if (
        verdict.measurement_status === 'finished' ||
        verdict.resumable === false ||
        verdict.new_run_required ||
        [0, 3].includes(verdict.exit_code)
      ) {
        next.native.continuation = null;
      }
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
    build = {},
    execute = executeNative,
    createBudget = createOperationBudget,
    maxActive = 16,
  } = {}) {
    this.store = store;
    this.build = build;
    this.execute = execute;
    this.createBudget = createBudget;
    this.maxActive = maxActive;
    this.active = new Map();
  }

  record(id, domain) {
    const record = this.store.get(id);
    if (!record || record.intent?.integration !== INTEGRATION)
      throw fail(
        'SESSION_UNAVAILABLE',
        'No retained session receipt. Do not recreate uncertain work.'
      );
    const session = record.response?.body?.session || record.checkpoint?.session;
    if (!session || (domain !== undefined && session.task.domain !== domain))
      throw fail('SESSION_SCOPE', 'This capability belongs to a different task.');
    return { record, session };
  }

  open(domain, { phase = 'create', writer = 'kitchen', format = 'rich' } = {}) {
    if (domain === 'lyrics' && writer === 'kitchen' && !this.store.durable)
      throw fail(
        'DURABLE_STORAGE_REQUIRED',
        'Kitchen sessions require the configured persistent recovery store.'
      );
    const task = domain === 'recipe' ? { domain, format, maxChars: 1000 } : { domain, phase };
    const session = {
      version: 1,
      task,
      writer: domain === 'lyrics' ? writer : null,
      semantic_identity: continuationSemanticIdentity(),
      workspace: null,
      native: {
        version: 1,
        connector_contract: CONNECTOR_CONTRACT_VERSION,
        task: clone(task),
        continuation: null,
      },
    };
    const id = capability();
    this.store.begin(id, { request_id: id, integration: INTEGRATION, action: 'open' }, this.build, {
      session,
    });
    this.store.complete(id, 200, { session, result: { content: [] } });
    return this.status(id, domain);
  }

  submit(sessionId, domain, tool, args, { resumed = false } = {}) {
    if (jsonBytes(args) > HTTP_REQUEST_BYTES - 4096)
      throw fail('SESSION_INPUT_LIMIT', 'Arguments exceed the recoverable request allowance.');
    const { record: parent, session: original } = this.record(sessionId, domain);
    const action = { tool, arguments: clone(args), resumed };
    if (parent.successor_id) {
      const { record: existing } = this.record(parent.successor_id, domain);
      if (requestDigest(existing.intent.action) !== requestDigest(action))
        throw fail(
          'STALE_SESSION',
          'This session already advanced. Read its operation before submitting different work.'
        );
      return this.status(existing.request_id, domain);
    }
    if ((!resumed && parent.state !== 'completed') || (resumed && parent.state !== 'interrupted'))
      throw fail('SESSION_BUSY', 'Read the current operation before continuing this session.');
    let session = clone(original);
    if (resumed) session = this.resumeSnapshot(parent, session);
    assertContinuationSemantics(session.semantic_identity);
    if (session.uncertain)
      throw fail(
        'CONTINUATION_UNCERTAIN',
        'Recover the accepted draft; an unknown provider outcome cannot be replayed.'
      );
    if ((domain === 'lyrics') !== tool.startsWith('lyric_'))
      throw fail('SESSION_SCOPE', 'Recipe and lyric operations cannot share a session.');
    if (this.active.size >= this.maxActive)
      throw fail(
        'SESSION_CAPACITY',
        'The operation queue is full. Retry this same session after an operation completes.'
      );
    const id = capability();
    this.store.begin(
      id,
      {
        request_id: id,
        continuation_id: sessionId,
        integration: INTEGRATION,
        action,
      },
      this.build,
      { session }
    );
    const promise = new Promise((resolve) => setImmediate(resolve))
      .then(() => this.run(id, session, tool, args))
      .finally(() => this.active.delete(id));
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
      // uncertain so it cannot be advanced, and the store stays healthy.
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
    assertContinuationSemantics(session.semantic_identity);
    if (record.intent.action.tool !== 'lyric_revise') return session;
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
        'No safe revision checkpoint is available. Recover the accepted draft; do not repeat the proposal.'
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
        [session.writer === 'interview' ? 'state' : 'checkpoint']: wire,
      },
    };
    return session;
  }

  resume(id, domain) {
    const { record } = this.record(id, domain);
    if (record.state !== 'interrupted')
      throw fail('RESUME_NOT_INTERRUPTED', 'Only an interrupted operation can be resumed.');
    const { tool, arguments: args } = record.intent.action;
    return this.submit(id, domain, tool, tool === 'lyric_revise' ? {} : args, { resumed: true });
  }

  status(id, domain) {
    const { record, session } = this.record(id, domain);
    const result = record.response?.body?.result;
    let resumable = false;
    if (record.state === 'interrupted' && !this.store.failure) {
      try {
        this.resumeSnapshot(record, session);
        resumable = true;
      } catch {
        /* Export only. */
      }
    }
    return {
      operation_id: id,
      status: record.state,
      ...(record.state === 'completed' ? { session_id: id } : {}),
      ...(record.successor_id ? { successor_id: record.successor_id } : {}),
      ...(record.intent.action?.tool ? { tool: record.intent.action.tool } : {}),
      ...(result ? { tool_result: publicToolResult(result) } : {}),
      ...(record.progress?.accepted_lines
        ? { accepted_draft: record.progress.accepted_lines }
        : {}),
      ...(record.interruption ? { interruption: record.interruption } : {}),
      ...(record.state === 'pending' ? { retry_after_seconds: 5 } : {}),
      resumable,
      durable: this.store.durable,
      retention_ms: this.store.ttlMs,
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
