// "Every refusal names the call that works instead" (workflow_tools.js, the
// /mcp initialization guidance), held as a table: one row per refusal the
// session surface can return, reached the way a host reaches it, with the
// phrases that name the working call. A refusal names the call that works if
// it names a published tool to call, or tells the caller to send the refused
// call again with a stated change. A row another note fixes carries that
// note's name and is printed, not judged. Offline: every gate and client
// refusal comes before dispatch, the store rows use small limits, and the one
// result-size row stubs the grade it refuses.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { LEXICON_MANIFEST } from './lexicon_basis.js';
import { recordCreation } from './lyric_workflow.js';
import { _verdictInternals } from './lyric_tools.js';
import { JobStore } from './job_store.js';
import { INTEGRATION, WorkflowSessions, executeNative } from './workflow_sessions.js';
import { buildWorkflowServer } from './workflow_tools.js';
import { wanderRefusal, _agentInternals } from './gemini_agent.js';

const source = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hex = () => randomBytes(32).toString('hex');
const draft = ['My kettle whistles by the stove', 'Your fingers brush my heavy coat'];
const other = ['A different opening line', 'A different closing line'];
const sweepArgs = { seed_from: 10, count: 10, want: ['lines<=30'] };
const planArgs = { seed: 16, wants: ['lines<=30'] };

function planReceipt() {
  const request = {
    seed: 16,
    form: 'verse-chorus',
    lines: null,
    relation: '',
    functions: null,
    title: '',
    narrative: false,
    wants: ['lines<=30'],
  };
  const plan = {
    plan_version: 3,
    request,
    total_lines: 2,
    line_slots: [{}, {}],
    sections: [{ name: 'VERSE' }],
  };
  return { exit_code: 0, plan, plan_sha256: sha(plan), plan_request: request };
}
const V1 = LEXICON_MANIFEST.versions.find((v) => v.id === 'v1');
const gradeReceipt = (p, lines = draft) => ({
  ..._verdictInternals.verdictOf({
    code: 3,
    stdout: '',
    stderr: '',
    lyric_result: {
      version: 1,
      status: 'graded',
      command: 'song',
      coverage: {
        scope: 'requested_layers',
        certified: true,
        pairs_mandated: 1,
        pairs_judged: 1,
        pairs_refused: 0,
        obligations: [
          { id: 'floor:draft', layer: 'floor', status: 'answered' },
          { id: 'rhyme:1:2:A', layer: 'rhyme', status: 'answered' },
        ],
        refused_obligations: [],
      },
      final_draft: lines,
      findings: [],
      lexicon: { supplement_id: V1.id, sha256: V1.sha256 },
    },
  }),
  plan_sha256: p.plan_sha256,
});
// Receipts recorded on a session's native task, as the client records them.
const swept = (t) =>
  recordCreation(t, 'lyric_sweep', sweepArgs, { exit_code: 0, accepted_shown: [16, 17] });
function planned(t) {
  swept(t);
  recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
  const p = planReceipt();
  recordCreation(t, 'lyric_plan', planArgs, p);
  return p;
}
function graded(t) {
  const p = planned(t);
  recordCreation(t, 'lyric_grade', { seed: 16, draft }, gradeReceipt(p));
  return p;
}

// The real /mcp construction: the shared endpoint with the compatibility
// surface, WorkflowSessions over an in-memory JobStore, the real client.
async function rig({ store = new JobStore(null), execute = executeNative, maxActive } = {}) {
  const sessions = new WorkflowSessions({
    store,
    execute,
    ...(maxActive != null ? { maxActive } : {}),
  });
  const server = await buildWorkflowServer({ sessions, compatibility: true });
  const client = new Client({ name: 'refusal-promise', version: '1' }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const read = async (id) => {
    await sessions.wait(id);
    return (await client.callTool({ name: 'get_operation', arguments: { operation_id: id } }))
      .structuredContent;
  };
  const outcome = (value) =>
    value.status === 'unsaved'
      ? { shape: 'unsaved', text: value.note }
      : value.tool_error
        ? { shape: 'receipt', text: value.tool_result.content[0].text, value }
        : { shape: 'none', value };
  return {
    store,
    sessions,
    instructions: client.getInstructions(),
    async call(name, args) {
      const r = await client.callTool({ name, arguments: args });
      const value = r.structuredContent;
      if (value?.status === 'pending') return outcome(await read(value.operation_id));
      if (value) return outcome(value);
      return r.isError
        ? { shape: 'bare', text: r.content[0].text }
        : { shape: 'none', value: r.content };
    },
    // A row the published schema cannot reach: WorkflowSessions directly.
    async direct(fn) {
      try {
        const value = await fn(sessions);
        if (value?.status === 'pending') return outcome(await read(value.operation_id));
        return value?.operation_id ? outcome(value) : { shape: 'none', value };
      } catch (error) {
        return { shape: 'bare', text: error.message };
      }
    },
    // A session written into the store as open() writes it, with its receipts.
    seed(domain, edit = (s) => s, options = {}) {
      const session = edit(sessions.fresh(domain, options)) ?? sessions.fresh(domain, options);
      const id = hex();
      store.begin(
        id,
        { request_id: id, integration: INTEGRATION, action: 'open' },
        {},
        { session }
      );
      store.complete(id, 200, { session, result: { content: [] } });
      return id;
    },
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
const lyrics =
  (fn = () => {}) =>
  (s) => {
    fn(s.native.task, s);
    return s;
  };

// One row per refusal. `phrases` name the call that works (judged rows);
// `owner` marks a row another note fixes; `schema: false` marks a row the
// published schema cannot reach (reached through WorkflowSessions directly).
// `shape` is the expected shape: receipt (a completed operation whose
// tool_error carries the text), bare (isError text, no receipt), unsaved,
// source (asserted in another file; judged on its source text) or website.
const ROWS = [];
const row = (spec) => ROWS.push(spec);

// --- The creation gate (lyric_workflow.js), through the real client.
row({
  code: 'CREATION_ORDER',
  where: 'lyric_workflow.js: screen before a sweep',
  shape: 'receipt',
  phrases: ['lyric_sweep'],
  reach: async (r) =>
    r.call('lyric_screen', { session_id: r.seed('lyrics'), words: ['stove', 'coat'] }),
});
row({
  code: 'CREATION_PLAN',
  where: 'lyric_workflow.js: lyric_check or lyric_recover in a new-song session',
  shape: 'receipt',
  phrases: ['lyric_grade', "begin_lyrics with phase 'edit'"],
  reach: async (r) => r.call('lyric_check', { session_id: r.seed('lyrics'), lines: draft }),
});
row({
  code: 'CREATION_ORDER',
  where: 'lyric_workflow.js: plan before sweep and screen',
  shape: 'receipt',
  phrases: ['lyric_sweep', 'lyric_screen'],
  reach: async (r) => r.call('lyric_plan', { session_id: r.seed('lyrics'), seed: 16 }),
});
row({
  code: 'CREATION_ORDER',
  where: 'lyric_workflow.js: plan after a screen that ran but did not answer (F8)',
  shape: 'receipt',
  phrases: ['call lyric_screen again'],
  reach: async (r) =>
    r.call('lyric_plan', {
      session_id: r.seed(
        'lyrics',
        lyrics((t) => {
          swept(t);
          recordCreation(
            t,
            'lyric_screen',
            { words: ['stove', 'coat'] },
            _verdictInternals.verdictOf({ code: 2, stdout: '  REFUSED — no tagger\n', stderr: '' })
          );
        })
      ),
      seed: 16,
    }),
});
row({
  code: 'CREATION_PLAN',
  where: 'lyric_workflow.js: plan a seed no recorded sweep accepted',
  shape: 'receipt',
  phrases: ['lyric_sweep'],
  reach: async (r) =>
    r.call('lyric_plan', {
      session_id: r.seed(
        'lyrics',
        lyrics((t) => {
          swept(t);
          recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
        })
      ),
      seed: 99,
    }),
});
row({
  code: 'CREATION_PLAN',
  where: 'lyric_workflow.js: grade before a plan',
  shape: 'receipt',
  phrases: ['lyric_plan'],
  reach: async (r) =>
    r.call('lyric_grade', {
      session_id: r.seed(
        'lyrics',
        lyrics((t) => {
          swept(t);
          recordCreation(t, 'lyric_screen', { words: ['stove', 'coat'] }, { exit_code: 0 });
        })
      ),
      seed: 16,
      draft,
    }),
});
row({
  code: 'CREATION_PLAN',
  where: 'lyric_workflow.js: hand-authored mandate or placement fields',
  shape: 'receipt',
  phrases: ['send this same call again without'],
  reach: async (r) =>
    r.call('lyric_revise', {
      session_id: r.seed('lyrics', lyrics(graded)),
      seed: 16,
      draft,
      groups: '1,2',
    }),
});
row({
  code: 'CREATION_PLAN',
  where: 'lyric_workflow.js: a declaration differs from the recorded plan',
  shape: 'receipt',
  phrases: [/send seed \d+/],
  reach: async (r) =>
    r.call('lyric_grade', { session_id: r.seed('lyrics', lyrics(planned)), seed: 17, draft }),
});
row({
  code: 'CREATION_DRAFT',
  where: 'lyric_workflow.js: conflicting draft and draft_text',
  shape: 'receipt',
  phrases: ['send one exact draft representation'],
  reach: async (r) =>
    r.call('lyric_grade', {
      session_id: r.seed('lyrics', lyrics(planned)),
      seed: 16,
      draft,
      draft_text: other.join('\n'),
    }),
});
row({
  code: 'CREATION_DRAFT',
  where: 'lyric_workflow.js: no draft (lyric_grade)',
  shape: 'receipt',
  phrases: ['Send this same call again', '`draft`', '`draft_text`'],
  reach: async (r) =>
    r.call('lyric_grade', { session_id: r.seed('lyrics', lyrics(planned)), seed: 16 }),
});
row({
  code: 'CREATION_DRAFT',
  where: 'lyric_workflow.js: no draft (lyric_revise)',
  shape: 'receipt',
  phrases: ['Send this same call again', 'the exact draft lyric_grade graded', '`draft_text`'],
  reach: async (r) =>
    r.call('lyric_revise', { session_id: r.seed('lyrics', lyrics(graded)), seed: 16 }),
});
row({
  code: 'CREATION_DRAFT',
  where: 'lyric_workflow.js: draft line count differs from the plan',
  shape: 'receipt',
  phrases: ['send this same call again with a draft of 2 lines'],
  reach: async (r) =>
    r.call('lyric_grade', {
      session_id: r.seed('lyrics', lyrics(planned)),
      seed: 16,
      draft: [...draft, 'A third line'],
    }),
});
row({
  code: 'CREATION_GRADE',
  where: 'lyric_workflow.js: revise a draft no grade answered for',
  shape: 'receipt',
  phrases: ['lyric_grade'],
  reach: async (r) =>
    r.call('lyric_revise', {
      session_id: r.seed('lyrics', lyrics(graded)),
      seed: 16,
      draft: other,
    }),
});
row({
  code: 'CREATION_GRADE',
  where: 'lyric_workflow.js: revise after a grade that ran but left no receipt (F8)',
  shape: 'receipt',
  phrases: ['call lyric_grade again on this draft'],
  reach: async (r) =>
    r.call('lyric_revise', {
      session_id: r.seed(
        'lyrics',
        lyrics((t) => {
          planned(t);
          recordCreation(
            t,
            'lyric_grade',
            { seed: 16, draft },
            _verdictInternals.verdictOf({ code: -1, stdout: '', stderr: 'worker died' })
          );
        })
      ),
      seed: 16,
      draft,
    }),
});
row({
  code: 'CREATION_GRADE',
  where: 'lyric_workflow.js: a reading differs from the graded one',
  shape: 'receipt',
  phrases: ['Leave `fallback` out', 'lyric_grade'],
  reach: async (r) =>
    r.call('lyric_revise', {
      session_id: r.seed('lyrics', lyrics(graded)),
      seed: 16,
      draft,
      fallback: 'high',
    }),
});

// --- The maintained client (client.js).
row({
  code: 'CREATION_CONTINUATION',
  where: 'client.js: a key differs from the recorded run',
  shape: 'receipt',
  phrases: ['lyric_revise with only `answer` or `answers`', 'lyric_grade', '`new_run: true`'],
  reach: async (r) =>
    r.call('lyric_revise', {
      session_id: r.seed(
        'lyrics',
        lyrics((t, s) => {
          graded(t);
          s.native.continuation = { seed: 16, args: { seed: 16, draft, state: 'held' } };
        })
      ),
      seed: 16,
      draft: other,
    }),
});
row({
  code: 'CREATION_CONTINUATION',
  where: 'client.js: state or checkpoint with no recorded run',
  shape: 'receipt',
  schema: false,
  phrases: ['lyric_revise without `state` or `checkpoint`', 'lyric_grade'],
  reach: async (r) => {
    const id = r.seed('lyrics', lyrics(graded));
    return r.direct((s) =>
      s.submit(id, 'lyrics', 'lyric_revise', { seed: 16, draft, state: 'forged' })
    );
  },
});

// --- The session layer (workflow_sessions.js).
row({
  code: 'SESSION_UNAVAILABLE',
  where: 'workflow_sessions.js record(): never issued or expired',
  shape: 'bare',
  phrases: ['begin_lyrics'],
  reach: async (r) => r.call('get_operation', { operation_id: hex() }),
});
row({
  code: 'SESSION_UNAVAILABLE',
  where: 'workflow_sessions.js record(): a receipt holding no session',
  shape: 'bare',
  phrases: ['begin_lyrics'],
  reach: async (r) => {
    const id = hex();
    r.store.begin(id, { request_id: id, integration: INTEGRATION, action: 'open' }, {}, null);
    r.store.complete(id, 200, { result: { content: [] } });
    return r.call('get_operation', { operation_id: id });
  },
});
row({
  code: 'SESSION_SCOPE',
  where: 'workflow_sessions.js record(): a recipe id on a lyric tool',
  shape: 'bare',
  phrases: ['begin_lyrics'],
  reach: async (r) =>
    r.call('lyric_sweep', { session_id: r.seed('recipe'), seed_from: 1, count: 1 }),
});
row({
  code: 'SESSION_SCOPE',
  where: 'workflow_sessions.js submit(): recipe and lyric operations in one session',
  shape: 'bare',
  schema: false,
  phrases: ['begin_lyrics'],
  reach: async (r) => {
    const id = r.seed('lyrics');
    return r.direct((s) => s.submit(id, 'lyrics', 'edit_recipe', {}));
  },
});
row({
  code: 'SESSION_SCOPE',
  where: 'workflow_sessions.js recover(): recover_only on a recipe session',
  shape: 'bare',
  schema: false,
  // record() refuses a recipe id first on every published path, with a
  // text that names the call; this one is never reached.
  unreachable: 'record() refuses the recipe id first, naming begin_lyrics',
  reach: async (r) => {
    const id = r.seed('recipe');
    return r.direct((s) => s.recover(id, null));
  },
});
row({
  code: 'SESSION_REQUIRED',
  where: 'workflow_sessions.js submit(): no session_id',
  shape: 'bare',
  schema: false,
  phrases: ['begin_lyrics'],
  reach: async (r) => r.direct((s) => s.submit(null, 'lyrics', 'lyric_sweep', {})),
});
row({
  code: 'SESSION_INPUT_LIMIT',
  where: 'workflow_sessions.js submit(): arguments over the request allowance',
  shape: 'bare',
  schema: false,
  phrases: ['Send a smaller request'],
  reach: async (r) => {
    const id = r.seed('lyrics');
    return r.direct((s) =>
      s.submit(id, 'lyrics', 'lyric_screen', { words: ['x'.repeat(4.5 * 1024 * 1024), 'y'] })
    );
  },
});
row({
  code: 'Request intent exceeds the durable wire-byte limit',
  where: "job_store.js begin(): arguments over the store's 2 MiB intent limit",
  shape: 'bare',
  schema: false,
  // Every lyric field is capped near 93 KB, so no published call carries a
  // 2 MiB intent; the session's own allowance is larger, so this text is the
  // store's, untranslated.
  unreachable: 'no published call carries a 2 MiB intent',
  reach: async (r) => {
    const id = r.seed('lyrics');
    return r.direct((s) =>
      s.submit(id, 'lyrics', 'lyric_screen', { words: ['x'.repeat(2.5 * 1024 * 1024), 'y'] })
    );
  },
});
row({
  code: 'STALE_SESSION',
  where: 'workflow_sessions.js submit(): the session already advanced',
  shape: 'bare',
  phrases: ['get_operation'],
  reach: async (r) => {
    const id = r.seed('lyrics');
    await r.call('lyric_plan', { session_id: id, seed: 16 });
    return r.call('lyric_screen', { session_id: id, words: ['stove', 'coat'] });
  },
});
row({
  code: 'RESUME_NOT_INTERRUPTED',
  where: 'workflow_sessions.js resume(): the operation is not interrupted',
  shape: 'bare',
  phrases: ['get_operation'],
  reach: async (r) => r.call('resume_operation', { operation_id: r.seed('lyrics') }),
});
row({
  code: 'RESUME_NOT_INTERRUPTED',
  where: 'workflow_sessions.js submit(): resumed on an operation not interrupted',
  shape: 'bare',
  schema: false,
  phrases: ['get_operation'],
  reach: async (r) => {
    const id = r.seed('lyrics');
    return r.direct((s) => s.submit(id, 'lyrics', 'lyric_sweep', {}, { resumed: true }));
  },
});
// An interrupted lyric operation, written as the store writes one.
function interrupted(r, tool, edit) {
  const id = hex();
  const session = edit(r.sessions.fresh('lyrics'));
  r.store.begin(
    id,
    { request_id: id, integration: INTEGRATION, action: { tool, arguments: {}, resumed: false } },
    {},
    { session }
  );
  r.store.interrupt(id, 'operation_interrupted');
  return id;
}
row({
  code: 'SESSION_BUSY',
  where: 'workflow_sessions.js submit(): an interrupted operation that can resume',
  shape: 'bare',
  phrases: ['resume_operation'],
  reach: async (r) =>
    r.call('lyric_sweep', {
      session_id: interrupted(r, 'lyric_sweep', (s) => s),
      seed_from: 1,
      count: 1,
    }),
});
row({
  code: 'CONTINUATION_UNCERTAIN',
  where: 'workflow_sessions.js resumeSnapshot(): no safe revision checkpoint',
  shape: 'bare',
  phrases: ['lyric_grade', 'new_run: true'],
  reach: async (r) =>
    r.call('resume_operation', { operation_id: interrupted(r, 'lyric_revise', (s) => s) }),
});
row({
  code: 'CONTINUATION_UNCERTAIN',
  where: "workflow_sessions.js submit(): the last revision's outcome is unknown",
  shape: 'bare',
  phrases: ['lyric_grade', 'new_run: true'],
  reach: async (r) =>
    r.call('lyric_revise', {
      session_id: r.seed(
        'lyrics',
        lyrics((t, s) => {
          graded(t);
          s.uncertain = true;
        })
      ),
      seed: 16,
      draft,
    }),
});
row({
  code: 'NO_PENDING_QUESTION',
  where: 'workflow_sessions.js submit(): an answer with no suspended revision',
  shape: 'bare',
  phrases: ['lyric_grade'],
  reach: async (r) =>
    r.call('lyric_revise', { session_id: r.seed('lyrics'), answer: 'A line of song' }),
});
row({
  code: 'CONTINUATION_MIGRATION_REQUIRED',
  where: 'workflow_sessions.js assertSemantics(): scorer changed since the session',
  shape: 'bare',
  phrases: ['recover_only: true', 'begin_lyrics'],
  reach: async (r) =>
    r.call('lyric_sweep', {
      session_id: r.seed('lyrics', (s) => ({ ...s, semantic_identity: 'an older scorer' })),
      seed_from: 1,
      count: 1,
    }),
});
row({
  code: 'NOTHING_TO_RECOVER',
  where: 'workflow_sessions.js recover(): no revision journal yet',
  shape: 'bare',
  phrases: ['get_operation'],
  reach: async (r) => r.call('lyric_revise', { session_id: r.seed('lyrics'), recover_only: true }),
});
row({
  code: 'SESSION_WRITER_RETIRED',
  where: "workflow_sessions.js retiredWriter(): a session opened for the service's writer",
  shape: 'receipt',
  phrases: ['begin_lyrics', 'recover_only: true'],
  reach: async (r) =>
    r.call('lyric_revise', {
      session_id: r.seed('lyrics', (s) => ({ ...s, writer: 'kitchen' }), { phase: 'edit' }),
      draft,
      scheme: 'AA',
    }),
});
row({
  code: 'SESSION_EMPTY',
  where: 'workflow_sessions.js executeNative(): a recipe session with no recipe',
  shape: 'receipt',
  phrases: ['start_recipe'],
  reach: async (r) => r.call('render_recipe', { session_id: r.seed('recipe') }),
});
row({
  code: 'SESSION_CONTINUATION',
  where: 'workflow_sessions.js executeNative(): an edit run differs from the recorded run',
  shape: 'receipt',
  phrases: ['answer/answers', 'new_run: true'],
  reach: async (r) =>
    r.call('lyric_revise', {
      session_id: r.seed(
        'lyrics',
        (s) => {
          s.native.continuation = { args: { draft, scheme: 'AA' } };
          return s;
        },
        { phase: 'edit' }
      ),
      draft: other,
    }),
});
// A grade that measured and recorded its receipt, with a result over the
// size one receipt keeps (the store's own limit, unchanged).
const oversized = () => ({
  execute: async (session, name, args) => {
    if (name !== 'lyric_grade') return executeNative(session, name, args);
    const next = structuredClone(session);
    recordCreation(next.native.task, name, { ...args, draft }, gradeReceipt(planReceipt()));
    const text = JSON.stringify({ exit_code: 3, padding: 'x'.repeat(9.5 * 1024 * 1024) });
    return { session: next, result: { content: [{ type: 'text', text }] } };
  },
});
row({
  code: 'SESSION_RESULT_NOT_KEPT',
  where: 'workflow_sessions.js run(): the store refuses a finished result as too large (F8)',
  shape: 'receipt',
  phrases: ['lyric_sweep declaring `lines`', 'lyric_plan'],
  rig: oversized,
  reach: async (r) =>
    r.call('lyric_grade', { session_id: r.seed('lyrics', lyrics(planned)), seed: 16, draft }),
});
row({
  code: 'CREATION_GRADE',
  where: 'lyric_workflow.js: revise after a grade measured but not kept (F8)',
  shape: 'receipt',
  phrases: ['lyric_sweep declaring `lines`', 'lyric_plan'],
  rig: oversized,
  // The refusal is the next call's, in the same session.
  reach: async (r) => {
    const id = r.seed('lyrics', lyrics(planned));
    const grade = await r.call('lyric_grade', { session_id: id, seed: 16, draft });
    assert.match(grade.text, /^SESSION_RESULT_NOT_KEPT/);
    return r.call('lyric_revise', { session_id: grade.value.session_id, seed: 16, draft });
  },
});

// --- The store, as the session layer surfaces it.
row({
  code: 'SESSION_STORE_FULL',
  where: 'workflow_sessions.js storeAdmissionRefusal(): JOB_CAPACITY at admission',
  shape: 'bare',
  phrases: ['Retry this same call'],
  rig: () => ({ store: new JobStore(null, { maxBytes: 1024 }) }),
  reach: async (r) => r.call('begin_lyrics', {}),
});
row({
  code: 'SESSION_RECORDS_FULL',
  where: 'workflow_sessions.js storeAdmissionRefusal(): JOB_RECORDS_FULL at admission',
  shape: 'bare',
  phrases: [/retry this same call/i],
  rig: () => ({ store: new JobStore(null, { maxRecords: 1 }) }),
  reach: async (r) => {
    await r.call('begin_lyrics', {});
    return r.call('begin_lyrics', {});
  },
});
row({
  code: 'SESSION_CAPACITY',
  where: 'workflow_sessions.js submit(): the lyric queue is full',
  shape: 'bare',
  phrases: ['Retry this same call'],
  rig: () => ({ maxActive: 0 }),
  reach: async (r) =>
    r.call('lyric_sweep', { session_id: r.seed('lyrics'), seed_from: 1, count: 1 }),
});
row({
  code: 'NOT SAVED',
  where: 'workflow_tools.js unsaved(): the store refused a recipe receipt',
  shape: 'unsaved',
  phrases: [/retry this call later/i],
  rig: () => ({ store: new JobStore(null, { maxBytes: 1024 }) }),
  reach: async (r) => r.call('start_recipe', { traditions: ['bluegrass'] }),
});
row({
  code: 'Job persistence unavailable',
  where: 'job_store.js assertHealthy(): the store latched after a failed write',
  shape: 'bare',
  owner: 'D9',
  reach: async (r) => {
    r.store.failure = 'disk full';
    return r.call('begin_lyrics', {});
  },
});

// --- Retired receipts, in a store small enough to retire them.
const retiring = () => ({ store: new JobStore(null, { maxPayloadRecords: 4 }) });
async function retiredParent(r) {
  const parent = r.seed('lyrics');
  await r.call('lyric_plan', { session_id: parent, seed: 16 });
  // Fill the payload slots: the parent, a completed receipt already
  // superseded, is the first one retired.
  for (let i = 0; i < 3; i++) r.seed('lyrics');
  assert.equal(r.store.get(parent).state, 'retired');
  return parent;
}
row({
  code: 'STALE_SESSION',
  where: 'workflow_sessions.js submit(): a retired parent advanced to another operation',
  shape: 'bare',
  phrases: ['get_operation'],
  rig: retiring,
  reach: async (r) =>
    r.call('lyric_screen', { session_id: await retiredParent(r), words: ['stove', 'coat'] }),
});
row({
  code: 'STALE_SESSION',
  where: "workflow_sessions.js resume(): a retired parent's successor is not its resume",
  shape: 'bare',
  phrases: ['get_operation'],
  rig: retiring,
  reach: async (r) => r.call('resume_operation', { operation_id: await retiredParent(r) }),
});
row({
  code: 'SESSION_RETIRED',
  where: 'workflow_sessions.js record(): a retired receipt with no live successor',
  shape: 'bare',
  phrases: ['begin_lyrics'],
  rig: retiring,
  reach: async (r) => {
    const first = r.seed('lyrics');
    for (let i = 0; i < 4; i++) r.seed('lyrics');
    assert.equal(r.store.get(first).state, 'retired');
    return r.call('lyric_sweep', { session_id: first, seed_from: 1, count: 1 });
  },
});

// --- A pending operation, held open by an execute that waits.
let release;
const holding = () => ({
  execute: (session, name, args) =>
    name === 'lyric_sweep'
      ? new Promise((resolve) => {
          release = () => resolve({ session, result: { content: [{ type: 'text', text: '{}' }] } });
        })
      : executeNative(session, name, args),
});
async function pendingOperation(r) {
  const opened = r.seed('lyrics');
  const value = (
    await (async () => r.sessions.submit(opened, 'lyrics', 'lyric_sweep', { seed_from: 1 }))()
  ).operation_id;
  await new Promise((resolve) => setImmediate(resolve));
  return value;
}
row({
  code: 'SESSION_BUSY',
  where: 'workflow_sessions.js submit(): the operation is still running',
  shape: 'bare',
  phrases: ['get_operation'],
  rig: holding,
  reach: async (r) => {
    const id = await pendingOperation(r);
    const out = await r.call('lyric_screen', { session_id: id, words: ['stove', 'coat'] });
    release();
    return out;
  },
});
row({
  code: 'SESSION_BUSY',
  where: 'workflow_sessions.js recover(): the operation is still running',
  shape: 'bare',
  phrases: ['get_operation'],
  rig: holding,
  reach: async (r) => {
    const id = await pendingOperation(r);
    const out = await r.call('lyric_revise', { session_id: id, recover_only: true });
    release();
    return out;
  },
});

// --- The compatibility surface's own refusals (workflow_tools.js).
row({
  code: 'Choose session_id or caller-managed state',
  where: 'workflow_tools.js: session_id together with caller-managed state',
  shape: 'bare',
  phrases: ['omit it with session_id'],
  reach: async (r) =>
    r.call('lyric_revise', { session_id: r.seed('lyrics'), draft, state: 'held' }),
});
row({
  code: 'Pass the latest session_id',
  where: 'workflow_tools.js: a recipe call with neither session_id nor workspace',
  shape: 'bare',
  phrases: ['start_recipe'],
  reach: async (r) => r.call('render_recipe', {}),
});
row({
  code: 'recover_only exports what the session holds',
  where: 'workflow_tools.js: recover_only with other fields',
  shape: 'bare',
  phrases: ['send only session_id, recover_only'],
  reach: async (r) =>
    r.call('lyric_revise', { session_id: r.seed('lyrics'), recover_only: true, draft }),
});

// --- Asserted in test_runtime_assets.mjs, where the release check can fail;
// judged here on the text the source throws.
const assetText = (file) => /'(LYRIC_ASSETS_UNAVAILABLE: [^']*)'/.exec(source(file))?.[1];
for (const file of ['./workflow_tools.js', './tools.js'])
  row({
    code: 'LYRIC_ASSETS_UNAVAILABLE',
    where: `${file.slice(2)}: the grading assets failed the release check`,
    shape: 'source',
    phrases: ['Retry this same call later'],
    reach: async () => ({ shape: 'source', text: assetText(file) }),
  });

// P8's per-record size refusal: no free room or wait admits it, so it names
// the call that opens a new session.
row({
  code: 'SESSION_RECORD_TOO_LARGE',
  where: 'workflow_sessions.js storeAdmissionRefusal(): a record over the per-record cap',
  shape: 'bare',
  phrases: ['Send a smaller request', 'begin_lyrics'],
  rig: () => ({
    store: new JobStore(null, { maxRecordBytes: 256, maxBytes: 1 << 30, maxRecords: 64 }),
  }),
  reach: async (r) => r.call('begin_lyrics', {}),
});

// --- The website writer (gemini_agent.js), called directly.
const website = (text) => ({ shape: 'website', text });
const uncertified = { parked: true, uncertified: true, seed: 16, draft };
const E28 = [
  'lyric_grade under the resolved declarations',
  '`new_run: true`',
  'Start independent work',
];
row({
  code: 'REFUSED by the connector',
  where: 'gemini_agent.js parkedRefusal(): uncertified run, through lyric_revise',
  shape: 'website',
  phrases: E28,
  reach: async () => website(wanderRefusal(uncertified, 'lyric_revise', { draft })),
});
row({
  code: 'REFUSED by the connector',
  where: 'gemini_agent.js parkedRefusal(): uncertified run, through lyric_plan',
  shape: 'website',
  phrases: E28,
  reach: async () => website(wanderRefusal(uncertified, 'lyric_plan', { seed: 16 })),
});
row({
  code: 'The lyric_revise run is UNCERTIFIED',
  where: "gemini_agent.js PARKED_RUN_NOTE: uncertified run, every hop's note",
  shape: 'website',
  phrases: E28,
  reach: async () => website(_agentInternals.PARKED_RUN_NOTE(uncertified)),
});
row({
  code: 'REFUSED by the connector',
  where: 'gemini_agent.js parkedRefusal(): a run parked at exit 3',
  shape: 'website',
  phrases: ['call lyric_revise with `seed` and `draft_text`'],
  reach: async () =>
    website(wanderRefusal({ parked: true, seed: 16, open: [2], draft }, 'lyric_plan', {})),
});
row({
  code: 'REFUSED by the connector',
  where: 'gemini_agent.js wanderRefusal(): an unknown proposal outcome',
  shape: 'website',
  phrases: ['new_run'],
  reach: async () => website(wanderRefusal({ uncertain_proposal: true }, 'lyric_revise', {})),
});
row({
  code: 'REFUSED by the connector',
  where: 'gemini_agent.js wanderRefusal(): an interrupted checkpoint',
  shape: 'website',
  phrases: ['Resume lyric_revise'],
  reach: async () => website(wanderRefusal({ resumable: true }, 'lyric_plan', {})),
});

let collected;
async function collect() {
  if (collected) return collected;
  collected = [];
  for (const spec of ROWS) {
    const r = await rig(spec.rig?.() ?? {});
    try {
      collected.push({
        spec,
        got: await spec.reach(r).catch((error) => ({ shape: 'unreached', error: error.message })),
      });
    } finally {
      await r.close();
    }
  }
  return collected;
}
const judged = (spec) => !spec.owner && !spec.unreachable;
const has = (text, phrase) =>
  phrase instanceof RegExp ? phrase.test(text) : String(text).includes(phrase);

test('every row is reached and returns a refusal carrying its code', async () => {
  for (const { spec, got } of await collect()) {
    assert.equal(typeof got.text, 'string', `${spec.where}: no refusal (${JSON.stringify(got)})`);
    assert.ok(got.text.includes(spec.code), `${spec.where}: ${got.text}`);
    // REFUSAL_TABLE=1 prints the table: where, shape and the text returned.
    if (process.env.REFUSAL_TABLE) console.log(`${spec.where} [${got.shape}]\n  ${got.text}`);
  }
});

test('every refusal names the call that works instead', async () => {
  const failing = [];
  for (const { spec, got } of await collect()) {
    if (!judged(spec)) {
      console.log(
        `${spec.owner ? `owned ${spec.owner}` : `unreachable (${spec.unreachable})`}: ${spec.where}`
      );
      continue;
    }
    const missing = spec.phrases.filter((p) => !has(got.text, p));
    if (missing.length) failing.push(`${spec.where}: lacks ${missing.join(' | ')}\n  ${got.text}`);
  }
  assert.deepEqual(failing, []);
});

test('each refusal arrives in the shape the receipt sentence promises', async () => {
  // workflow_tools.js (P5): every call that takes a session_id "ends its
  // content with a receipt (a JSON object) holding the next session_id; an
  // immediate refusal has none". So an admission refusal is immediate and
  // bare, and a refusal from a queued operation carries a receipt with the
  // session_id that continues the session.
  const r = await rig();
  try {
    assert.match(r.instructions, /holding the next session_id; an immediate refusal has none\./);
  } finally {
    await r.close();
  }
  const shapes = {};
  for (const { spec, got } of await collect()) {
    assert.equal(got.shape, spec.shape, `${spec.where}: ${got.text}`);
    if (got.shape === 'receipt')
      assert.match(
        `${got.value.operation_id} ${got.value.session_id}`,
        /^[a-f0-9]{64} [a-f0-9]{64}$/,
        `${spec.where}: a receipt holds the operation and the next session_id`
      );
    if (got.shape === 'bare')
      assert.equal(got.value, undefined, `${spec.where}: an immediate refusal has no receipt`);
    if (spec.schema !== false && ['receipt', 'bare'].includes(got.shape))
      shapes[got.shape] = (shapes[got.shape] || 0) + 1;
  }
  // The init text's receipt sentence (workflow_tools.js) against the rows a
  // published schema reaches: either change to it shows here.
  console.log(`receipt split, published schema: ${JSON.stringify(shapes)}`);
  assert.deepEqual(shapes, { receipt: 21, bare: 24 });
});

test('every coded refusal in the source has a row, and the gate has 12 texts', () => {
  const rowsFor = (code) => ROWS.filter((r) => r.code === code).length;
  const sessions = source('./workflow_sessions.js');
  const sites = {};
  for (const [, code] of sessions.matchAll(/fail\(\s*'([A-Z_]+)'/g))
    sites[code] = (sites[code] || 0) + 1;
  // Texts built with new Error, not fail(): storeAdmissionRefusal's store
  // translations and the result-size text. A new one needs its own row.
  for (const [, code] of sessions.matchAll(/[`'](SESSION_[A-Z_]+): /g)) sites[code] ||= 1;
  for (const code of [
    'SESSION_STORE_FULL',
    'SESSION_RECORDS_FULL',
    'SESSION_RECORD_TOO_LARGE',
    'SESSION_RESULT_NOT_KEPT',
  ])
    assert.ok(sites[code], `${code}: the scan no longer finds it`);
  assert.ok(Object.keys(sites).length >= 18, JSON.stringify(sites));
  for (const [code, n] of Object.entries(sites))
    assert.ok(
      rowsFor(code) >= n,
      `${code}: ${n} site(s) in workflow_sessions.js, ${rowsFor(code)} row(s)`
    );
  // String literals, not returns: a refusal written across several lines is
  // still one text.
  const literals = (file) =>
    source(file)
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
      .match(/[`'"]CREATION_[A-Z]+: [^`'"$]*/g)
      .map((s) => s.slice(1));
  const gate = literals('./lyric_workflow.js');
  assert.equal(gate.length, 12, gate.join('\n'));
  const client = literals('./client.js');
  assert.equal(client.length, 2, client.join('\n'));
  for (const prefix of [...gate, ...client]) {
    const code = prefix.slice(0, prefix.indexOf(':'));
    assert.ok(rowsFor(code), `${prefix}: no row`);
  }
  assert.equal(rowsFor('CREATION_DRAFT'), 4);
  assert.ok(rowsFor('CREATION_PLAN') >= 5 && rowsFor('CREATION_GRADE') >= 3);
});
