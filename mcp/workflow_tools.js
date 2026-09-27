// Session-aware MCP facade. The underlying engine, graders, schemas and native
// workflow receipts remain the authority; no provider-specific music logic.
//
// Every tool here wraps a raw engine tool whose description is written for a
// caller that threads its own state. This file owns what differs in a session:
// the SESSION paragraph in front of each wrapped description, the labels on the
// caller-managed parameters, and the initialization guidance, which is the raw
// engine's own guidance under a paragraph saying what the session replaces.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer, guardEditKeys } from './tools.js';
import { requestContext } from './execution_context.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TOOL_SCHEMAS } from './schemas.js';
import { LYRIC_TOOL_SCHEMAS } from './lyric_tools.js';
import { expectedSurface } from './surface_contract.js';
import { executeNative, publicToolResult } from './workflow_sessions.js';
import { CONNECTOR_VERSION } from './contract_version.js';

// /mcp is the endpoint the discovery card and server.json describe, so it
// reports the same version they do.
export const WORKFLOW_CONNECTOR_VERSION = CONNECTOR_VERSION;
const id = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .describe('The exact private capability returned by this connector.');
const textBlock = z.object({ type: z.literal('text'), text: z.string() });
const resultShape = {
  operation_id: id
    .optional()
    .describe('The operation this receipt describes; absent only when status is unsaved.'),
  status: z
    .enum(['pending', 'completed', 'interrupted', 'retired', 'unsaved'])
    .describe(
      'pending: poll get_operation again. completed: the tool returned (tool_error says whether it refused). interrupted: resume only when resumable. retired: the saved state is gone. unsaved: the result was computed but the session store refused to record it.'
    ),
  session_id: id
    .optional()
    .describe(
      'Pass this to the next call in the same workflow. Absent while pending, when the operation must be resumed instead, and when nothing can continue from it.'
    ),
  successor_id: id.optional(),
  tool: z.string().optional(),
  tool_result: z
    .object({ content: z.array(textBlock), isError: z.boolean().optional() })
    .optional()
    .describe(
      "The tool's own result. In the content blocks it comes first, with private state withheld."
    ),
  tool_error: z.boolean().optional(),
  accepted_draft: z.array(z.string()).optional(),
  interruption: z.string().optional(),
  note: z.string().optional(),
  retry_after_seconds: z.number().optional(),
  resumable: z.boolean(),
  durable: z.boolean(),
  retention_ms: z
    .number()
    .describe(
      'The longest this receipt is kept after its last update. Storage pressure can retire a superseded or older receipt sooner; a retired id then reads status retired.'
    ),
  expires_at: z.number().optional().describe('Epoch milliseconds when retention_ms runs out.'),
  uncertain_proposal: z.boolean(),
};
const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
};
const stateful = { ...readOnly, readOnlyHint: false };
// Parameters that carry state a session keeps for its caller. They exist only
// on the compatibility surface, for callers that thread state themselves.
const privateInput = new Set(['workspace', 'state', 'checkpoint', 'run_id', 'run_revision']);
const surfaces = new Map();
async function surface(domain) {
  if (!surfaces.has(domain)) surfaces.set(domain, expectedSurface(domain));
  return surfaces.get(domain);
}

// Content leads with the tool's own blocks (private state withheld), so a text-only host sees
// the deliverable first and exactly as the tool wrote it. The receipt follows as
// the last block, without repeating those blocks: text-only hosts still need the
// recovery ids. structuredContent carries the whole envelope.
function receipt(value) {
  const { tool_result: _tool, ...rest } = value;
  return { type: 'text', text: JSON.stringify(rest) };
}
function response(value, { toolError = false } = {}) {
  return {
    structuredContent: value,
    content: [...(value.tool_result?.content ?? []), receipt(value)],
    // A read of an operation succeeds even when the tool it ran refused; only
    // a call that IS the tool (the synchronous recipe calls) reports its error.
    ...(toolError && value.tool_error ? { isError: true } : {}),
  };
}

function sessionGuide(domains, compatibility) {
  const recipe = domains.includes('recipe');
  const lyrics = domains.includes('lyrics');
  const opens =
    recipe && lyrics
      ? 'start_recipe and begin_lyrics each open a private session'
      : recipe
        ? 'start_recipe opens a private recipe session'
        : 'begin_lyrics opens a private lyrics session';
  const carried = [
    recipe ? 'the recipe `workspace`' : null,
    lyrics ? "a lyric run's `state`, `run_id` and `run_revision`" : null,
  ]
    .filter(Boolean)
    .join(', and ');
  const text = [
    recipe && lyrics
      ? "Codex Musica serves recording recipes and lyrics on this one connection. Use the tools the user's request calls for: a recipe request does not start lyrics, and a combined request uses both. Keep each workflow's latest session_id separately."
      : `Codex Musica ${recipe ? 'recording recipes' : 'lyrics'}, with sessions kept by the server.`,
    `SESSIONS. ${opens} and return a session_id; pass the latest session_id to that workflow's next call. The server carries what the engine guidance below has a caller-managed client thread by hand — ${carried} — so never send those with a session_id.`,
    "Every call that opens a session or takes a session_id, and get_operation, ends its content with a receipt (a JSON object) holding the next session_id. Every block before the receipt is the tool's own output with private state withheld (workspace, run state and ids are removed from its JSON, and a continue footnote is rewritten for the session); the deliverable text — song, plan, recipe string — is exact, and the first block is the deliverable the guidance below says to reproduce exactly.",
    recipe ? 'Recipe calls answer at once.' : null,
    lyrics
      ? 'Lyric calls queue a background operation and return its operation_id (lyric_types, a lookup, answers at once and takes no session): poll get_operation until it is no longer pending, never submit to a session while its operation is pending, and continue from the session_id in the completed receipt.'
      : null,
    lyrics
      ? "begin_lyrics phase 'create' is for a new song: the server enforces sweep → screen → plan → exact-draft grade → revise from receipts it records itself. Phase 'edit' is only for lyrics the user supplied; it skips those receipts, and this argument is the only thing that selects it."
      : null,
    'An interrupted operation continues with resume_operation only when resumable is true. Every refusal names the call that works instead. Session and operation ids are private: keep them out of what you show the user.',
    compatibility
      ? `WITHOUT session_id a tool runs the raw engine directly, for integrations that thread their own state: synchronous, with that state passed back by the caller exactly as the guidance below describes${lyrics ? ', and with no creation-order enforcement' : ''}. Never mix the two modes in one workflow.`
      : `This endpoint has no caller-managed mode: wherever the guidance below says to thread ${carried}, pass session_id instead.`,
  ];
  return text.filter(Boolean).join(' ');
}

function sessionParagraph(name, domain, shape, compatibility) {
  if (name === 'start_recipe')
    return (
      "SESSION: opens a recipe session. The first content block is this tool's own output" +
      (compatibility
        ? ' — the recipe, its cards and the caller-managed `workspace` — with the new session_id added'
        : ', with private state withheld') +
      '; the last block is the session receipt. Pass its session_id to edit_recipe or render_recipe and the server keeps the workspace. '
    );
  if (domain === 'recipe')
    return (
      "SESSION: pass the latest session_id; the server applies this call to the workspace it keeps. Every content block before the last is this tool's own output with private state withheld; the last is the receipt holding the next session_id." +
      (compatibility
        ? ' Without session_id, pass `workspace` instead (caller-managed): the raw engine runs and returns its own result, edited workspace included. Never send both.'
        : '') +
      ' '
    );
  const carried = ['state', 'run_id', 'run_revision'].filter((key) => key in shape);
  return (
    'SESSION: pass the latest session_id. This call queues a background operation and returns its operation_id at once' +
    (name === 'lyric_revise' ? ' (recover_only: true answers at once instead)' : '') +
    ". Poll get_operation until it is no longer pending: a completed operation's content leads with this tool's own result blocks, private state withheld and the song or plan text exact — wherever this description speaks of the first content block, it is the first of those — and ends with the receipt holding the next session_id." +
    (carried.length
      ? ` The session carries the run, its ${carried.join(', ')} and the draft it opened on.`
      : '') +
    (['lyric_check', 'lyric_recover'].includes(name)
      ? " For lyrics the user supplied (a begin_lyrics phase 'edit' session); a new-song session refuses it — grade your draft with lyric_grade there."
      : '') +
    (compatibility
      ? ' Without session_id (caller-managed) this call runs the raw engine synchronously and returns its own result directly, and no creation order is enforced; never send session_id together with caller-managed state.'
      : '') +
    ' '
  );
}

// Parameter text for a session surface. On the compatibility surface a
// parameter's raw description follows, marked as the caller-managed contract.
const CALLER_MANAGED =
  'CALLER-MANAGED STATE — only without session_id: a session carries this, and sending it with session_id is refused. ';
const SESSION_PARAMETERS = {
  recover_only:
    "With session_id: true exports at once, without an operation, the accepted lyrics and journal this session holds — an interrupted revision's checkpoint, the suspended run, or the run that last stopped. Send only session_id, recover_only and optional recovery_part; nothing is replayed, graded or changed.",
  new_run:
    'true starts a new run on the draft you send, setting aside any run the session holds (for a new song, grade that draft first).',
};

// Compatibility dispatch invokes the same tool engine with the caller's original
// state. It does not manufacture create-phase receipts or reinterpret old runs.
async function rawCall(name, args) {
  const server = buildServer();
  const client = new Client({ name: 'codex-musica-compatibility', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(a);
    await client.connect(b);
    return await client.callTool({ name, arguments: args }, undefined, {
      timeout: 630000,
      signal: requestContext()?.signal,
    });
  } finally {
    await client.close();
    await server.close();
  }
}

export async function buildWorkflowServer({ domain = null, sessions, compatibility = false }) {
  if (domain !== null && !['recipe', 'lyrics'].includes(domain))
    throw new Error('Unknown workflow domain.');
  const domains = domain ? [domain] : ['recipe', 'lyrics'];
  const tools = (
    await Promise.all(
      domains.map(async (taskDomain) =>
        (await surface(taskDomain)).tools.map((tool) => ({ tool, taskDomain }))
      )
    )
  ).flat();
  // The raw engine's guidance is the single source for how to use the tools;
  // the session paragraph in front of it says what a session replaces.
  const instructions =
    sessionGuide(domains, compatibility) + '\n' + (await surface(domain)).init.instructions;
  const server = new McpServer(
    {
      name: domain ? `codex-musica-${domain}` : 'codex-musica',
      version: WORKFLOW_CONNECTOR_VERSION,
    },
    { instructions }
  );
  const register = (name, config, handler) =>
    server.registerTool(name, config, async (args) => {
      try {
        return await handler(args);
      } catch (error) {
        return { isError: true, content: [{ type: 'text', text: error.message }] };
      }
    });

  register(
    'get_operation',
    {
      title: 'Read a saved operation',
      description:
        "Read an operation (or any session) by its id; this never dispatches work. pending: poll again after retry_after_seconds. completed: the content leads with the tool's own result blocks, private state withheld — present the deliverable from them exactly — and ends with the receipt, whose session_id is the next step's; a refused call reads tool_error: true, and its session_id continues the session as it was before that call. interrupted: when resumable is true, call resume_operation; otherwise accepted_draft holds the accepted lyrics, lyric_revise with recover_only: true exports the journal, and session_id (when present) starts new work from before the interruption. retired: the saved state is gone; open a new session. If successor_id is present, read it first: an older id cannot branch the workflow. Ids are private capabilities.",
      inputSchema: z.object({ operation_id: id }),
      outputSchema: resultShape,
      annotations: readOnly,
    },
    ({ operation_id }) => response(sessions.status(operation_id, domain))
  );

  register(
    'resume_operation',
    {
      title: 'Resume interrupted work',
      description:
        'Continue an interrupted operation when get_operation reports resumable: true. A recipe call reruns from its saved input and answers at once; a lyric revision continues from its accepted checkpoint (no answer is replayed) as a new operation to poll. Repeating this returns the same successor. When the operation cannot resume, the refusal says what to do instead.',
      inputSchema: z.object({ operation_id: id }),
      outputSchema: resultShape,
      annotations: stateful,
    },
    async ({ operation_id }) => {
      const operation = sessions.resume(operation_id, domain);
      if (!operation.tool?.startsWith('lyric_')) await sessions.wait(operation.operation_id);
      return response(sessions.status(operation.operation_id, domain));
    }
  );

  if (domains.includes('lyrics')) {
    register(
      'begin_lyrics',
      {
        title: 'Begin a lyric task',
        description:
          "Open a private lyrics session and return its session_id. Phase 'create' (the default) is for a new song: the session enforces sweep → screen → plan → exact-draft grade → revise from receipts the server records. Phase 'edit' is only for lyrics the user supplied: it skips those receipts, so choose it only then — this argument is the only thing that selects it. The phase is fixed for the session. You write every line; the service plans and grades, and lyric_revise asks you each question it needs answered. No lyric call reaches a model provider or spends money.",
        inputSchema: z.object({
          phase: z
            .enum(['create', 'edit'])
            .default('create')
            .describe(
              "'create' (default) for a new song; 'edit' only for lyrics the user supplied. Fixed for the session."
            ),
        }),
        outputSchema: resultShape,
        annotations: { ...stateful, idempotentHint: false },
      },
      (args) => response(sessions.open('lyrics', args))
    );
  }

  const unsaved = (name, out, error) => {
    const content = compatibility ? out.result.content : publicToolResult(out.result).content;
    const value = {
      status: 'unsaved',
      tool: name,
      tool_result: { content, ...(out.result.isError ? { isError: true } : {}) },
      ...(out.result.isError ? { tool_error: true } : {}),
      note:
        `NOT SAVED: the session store refused to record this call (${error.message}), so no session_id was issued for it. The result above is exact but belongs to no session. ` +
        (compatibility
          ? 'To keep working without a session, pass the `workspace` it carries to the next call (caller-managed); or retry this call later.'
          : 'Retry this call later; the last session_id you hold does not include it.'),
      resumable: false,
      durable: sessions.store.durable,
      retention_ms: 0,
      uncertain_proposal: false,
    };
    return response(value, { toolError: true });
  };

  // Recipe calls are awaited here, so they answer at once. A refusal from the
  // store (full, or latched after a write failed) does not stop free,
  // deterministic work: the result is computed without a receipt and says so.
  async function recipeCall(name, sessionId, args) {
    let result;
    try {
      const operation = sessions.submit(sessionId ?? null, 'recipe', name, args);
      await sessions.wait(operation.operation_id);
      result = sessions.status(operation.operation_id, 'recipe');
    } catch (error) {
      if (!sessions.storeRefused(error)) throw error;
      return unsaved(name, await sessions.compute(sessionId, 'recipe', name, args), error);
    }
    if (result.status !== 'completed' && sessions.store.failure)
      return unsaved(
        name,
        await sessions.compute(sessionId, 'recipe', name, args),
        new Error(sessions.store.failure)
      );
    if (compatibility && name === 'start_recipe' && !result.tool_error && result.session_id) {
      // Existing consumers read the raw start_recipe payload, workspace
      // included, from the first block; the session_id rides along with it.
      const workspace = sessions.record(result.session_id, 'recipe').session.workspace;
      const payload = {
        ...JSON.parse(result.tool_result.content[0].text),
        workspace,
        session_id: result.session_id,
        operation_id: result.operation_id,
      };
      return {
        structuredContent: result,
        content: [
          { type: 'text', text: JSON.stringify(payload) },
          ...result.tool_result.content.slice(1),
          receipt(result),
        ],
      };
    }
    return response(result, { toolError: true });
  }

  const lookup = (tool, taskDomain) =>
    taskDomain === 'recipe'
      ? !['start_recipe', 'edit_recipe', 'render_recipe'].includes(tool.name)
      : tool.name === 'lyric_types';

  for (const { tool, taskDomain } of tools) {
    const originalShape =
      taskDomain === 'recipe' ? TOOL_SCHEMAS[tool.name].shape : LYRIC_TOOL_SCHEMAS[tool.name];
    if (lookup(tool, taskDomain)) {
      // Lookups answer directly: they read the catalog or the lexicon and
      // change nothing a session holds, so they take no session_id.
      register(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: taskDomain === 'recipe' ? TOOL_SCHEMAS[tool.name] : z.object(originalShape),
          annotations: readOnly,
        },
        async (args) => {
          const session = {
            task:
              taskDomain === 'recipe'
                ? { domain: taskDomain, format: 'rich', maxChars: 1000 }
                : { domain: taskDomain, phase: 'create' },
            native: null,
          };
          return publicToolResult((await executeNative(session, tool.name, args)).result);
        }
      );
      continue;
    }
    const shape = {};
    for (const [key, schema] of Object.entries(originalShape)) {
      if (privateInput.has(key)) {
        if (compatibility)
          shape[key] = schema.optional().describe(CALLER_MANAGED + (schema.description ?? ''));
      } else if (SESSION_PARAMETERS[key]) {
        shape[key] = schema.describe(
          SESSION_PARAMETERS[key] +
            (compatibility && schema.description
              ? ' Without session_id: ' + schema.description
              : '')
        );
      } else shape[key] = schema;
    }
    if (tool.name !== 'start_recipe') shape.session_id = compatibility ? id.optional() : id;
    register(
      tool.name,
      {
        title: tool.title,
        description:
          sessionParagraph(tool.name, taskDomain, originalShape, compatibility) + tool.description,
        inputSchema: z.object(shape),
        ...(compatibility ? {} : { outputSchema: resultShape }),
        annotations: {
          ...stateful,
          // A repeat with the same session_id and arguments returns the same
          // operation. start_recipe opens a new session every call; on the
          // compatibility surface a call without session_id is the raw tool.
          idempotentHint:
            compatibility && taskDomain === 'lyrics'
              ? (tool.annotations?.idempotentHint ?? false)
              : tool.name !== 'start_recipe',
          openWorldHint: false,
        },
      },
      async ({ session_id, ...args }) => {
        if (compatibility && session_id) {
          // A refusal names the field it refuses, so a caller mirroring the
          // published schema can tell which of its arguments to drop.
          const mixed = Object.keys(args).filter((key) => privateInput.has(key));
          if (mixed.length)
            throw new Error(
              'Choose session_id or caller-managed state, never both: ' +
                `${mixed.join(', ')} ${mixed.length === 1 ? 'is' : 'are'} caller-managed state ` +
                'the session already carries; omit it with session_id.'
            );
        }
        if (compatibility && !session_id && tool.name !== 'start_recipe') {
          if (taskDomain === 'recipe' && !args.workspace)
            throw new Error(
              'Pass the latest session_id (start_recipe returns one), or the caller-managed workspace.'
            );
          return rawCall(tool.name, args);
        }
        if (taskDomain === 'recipe') return recipeCall(tool.name, session_id, args);
        if (tool.name === 'lyric_revise' && args.recover_only) {
          const extra = Object.keys(args).filter(
            (key) => args[key] !== undefined && !['recover_only', 'recovery_part'].includes(key)
          );
          if (extra.length)
            throw new Error(
              `recover_only exports what the session holds; send only session_id, recover_only and optional recovery_part (not ${extra.join(', ')}).`
            );
          const exported = sessions.recover(session_id, taskDomain, args);
          const { tool_error: _refused, ...read } = sessions.status(session_id, taskDomain);
          return response({
            ...read,
            tool: 'lyric_revise',
            tool_result: exported,
            note: 'Exported without an operation: nothing in the session changed.',
          });
        }
        return response(sessions.submit(session_id, taskDomain, tool.name, args));
      }
    );
  }
  return guardEditKeys(server);
}

// Release verification compares the exact deployed public contract, including
// shared workflow controls; native task clients retain their original contract.
export async function expectedSharedSurface({ domain = null, compatibility = true } = {}) {
  const { JobStore } = await import('./job_store.js');
  const { WorkflowSessions } = await import('./workflow_sessions.js');
  const { listAll, initialization } = await import('./surface_contract.js');
  const server = await buildWorkflowServer({
    domain,
    sessions: new WorkflowSessions({ store: new JobStore() }),
    compatibility,
  });
  const client = new Client({ name: 'shared-surface-check', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(a);
    await client.connect(b);
    return { tools: await listAll(client), init: initialization(client) };
  } finally {
    await client.close();
    await server.close();
  }
}
