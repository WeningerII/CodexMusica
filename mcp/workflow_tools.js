// Session-aware MCP facade. The underlying engine, graders, schemas and native
// workflow receipts remain the authority; no provider-specific music logic.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { requestContext } from './execution_context.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TOOL_SCHEMAS } from './schemas.js';
import { LYRIC_TOOL_SCHEMAS } from './lyric_tools.js';
import { expectedSurface } from './surface_contract.js';
import { executeNative, publicToolResult } from './workflow_sessions.js';

export const WORKFLOW_CONNECTOR_VERSION = '1.2.0';
const id = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .describe('The exact private capability returned by this connector.');
const textBlock = z.object({ type: z.literal('text'), text: z.string() });
const resultShape = {
  operation_id: id,
  status: z.enum(['pending', 'completed', 'interrupted', 'retired']),
  session_id: id.optional(),
  successor_id: id.optional(),
  tool: z.string().optional(),
  tool_result: z
    .object({ content: z.array(textBlock), isError: z.boolean().optional() })
    .optional(),
  accepted_draft: z.array(z.string()).optional(),
  interruption: z.string().optional(),
  retry_after_seconds: z.number().optional(),
  resumable: z.boolean(),
  durable: z.boolean(),
  retention_ms: z.number(),
  uncertain_proposal: z.boolean(),
};
const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
};
const stateful = { ...readOnly, readOnlyHint: false };
const privateInput = new Set([
  'workspace',
  'state',
  'checkpoint',
  'run_id',
  'run_revision',
  'writer',
  'recover_only',
  'recovery_part',
]);
const surfaces = new Map();
async function surface(domain) {
  if (!surfaces.has(domain)) surfaces.set(domain, expectedSurface(domain));
  return surfaces.get(domain);
}

function response(value) {
  return {
    structuredContent: value,
    // Text-only hosts must receive the recovery IDs too, even on completed calls.
    content: [{ type: 'text', text: JSON.stringify(value) }],
    ...(value.tool_result?.isError ? { isError: true } : {}),
  };
}

const recipeInstructions =
  'Recipe session contract: start_recipe returns session_id. Pass the latest session_id to edit_recipe/render_recipe; the server carries the workspace. Each call returns the next session_id. Resolve catalog IDs, realize requested preferences through edits, and present the final recipe verbatim. Rich is the default; format may explicitly select tags, prose or compact. Recipes stay within 1000 characters. Do not start lyrics for a recipe-only request.';
const lyricInstructions =
  'Lyrics session contract: begin_lyrics selects create or edit and the writer. Tools submit work and return operation_id. Poll get_operation until completed, then use its session_id for the next step. Never submit another operation while one is pending. Creation requires sweep → screen → plan → exact-draft grade → revise; receipts and continuations are stored by the server. Resume interrupted operations only when resumable is true. Never treat a finished call as proof of certification.';
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
  let instructions =
    domain === 'recipe'
      ? recipeInstructions
      : domain === 'lyrics'
        ? lyricInstructions
        : 'Codex Musica provides both recording recipes and lyrics in this connection. Select the appropriate tools from the user request; a combined request can use both workflows. Keep each workflow’s latest session_id separately. ' +
          recipeInstructions +
          ' ' +
          lyricInstructions;
  if (compatibility)
    instructions +=
      ' Existing caller-managed integrations may pass workspace for recipes or call lyric tools without session_id using their original state/run contract. Do not mix caller state and session_id. New conversations should use session_id to avoid reconstructing state and to recover background work.';
  const operationDomain = (operationId) =>
    domain ?? sessions.record(operationId).session.task.domain;
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
        'Read pending work, exact completed output, the next session_id, or accepted lyrics after interruption. This call never dispatches a worker or provider. If successor_id exists, read it before continuing; an older capability cannot branch the workflow. Retained IDs are private capabilities.',
      inputSchema: z.object({ operation_id: id }).strict(),
      outputSchema: resultShape,
      annotations: readOnly,
    },
    ({ operation_id }) => response(sessions.status(operation_id, operationDomain(operation_id)))
  );

  register(
    'resume_operation',
    {
      title: 'Resume interrupted work',
      description:
        'Explicitly continue an interrupted operation after get_operation reports resumable:true. Preserves its exact workspace or lyric declarations and accepted checkpoint. Unknown provider outcomes cannot resume. Repeating this request returns its existing successor rather than spending again.',
      inputSchema: z.object({ operation_id: id }).strict(),
      outputSchema: resultShape,
      annotations: { ...stateful, openWorldHint: domain !== 'recipe' },
    },
    async ({ operation_id }) => {
      const taskDomain = operationDomain(operation_id);
      const operation = sessions.resume(operation_id, taskDomain);
      if (taskDomain === 'lyrics') return response(operation);
      await sessions.wait(operation.operation_id);
      return response(sessions.status(operation.operation_id, taskDomain));
    }
  );

  if (domains.includes('lyrics')) {
    register(
      'begin_lyrics',
      {
        title: 'Begin a lyric task',
        description:
          'Create a private lyrics session. Use create for a new song; edit only for existing lyrics supplied by the user. Kitchen (default) uses the service Gemini writer and budget accounting, matching the website. Interview uses proposals supplied by the caller. The phase and writer are fixed for this session. Returns session_id; performs no paid work.',
        inputSchema: z
          .object({
            phase: z.enum(['create', 'edit']).default('create'),
            writer: z.enum(['kitchen', 'interview']).default('kitchen'),
          })
          .strict(),
        outputSchema: resultShape,
        annotations: { ...stateful, idempotentHint: false },
      },
      (args) => response(sessions.open('lyrics', args))
    );
  }

  for (const { tool, taskDomain: domain } of tools) {
    const recipeState = ['start_recipe', 'edit_recipe', 'render_recipe'].includes(tool.name);
    if (domain === 'recipe' && !recipeState) {
      register(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: TOOL_SCHEMAS[tool.name],
          annotations: readOnly,
        },
        async (args) => {
          const session = { task: { domain, format: 'rich', maxChars: 1000 }, native: null };
          return publicToolResult((await executeNative(session, tool.name, args)).result);
        }
      );
      continue;
    }
    const originalShape =
      domain === 'recipe' ? TOOL_SCHEMAS[tool.name].shape : LYRIC_TOOL_SCHEMAS[tool.name];
    const shape = Object.fromEntries(
      Object.entries(originalShape).filter(([key]) => !privateInput.has(key))
    );
    if (compatibility) {
      for (const [key, schema] of Object.entries(originalShape)) {
        if (privateInput.has(key))
          shape[key] = schema
            .optional()
            .describe(
              'CALLER-MANAGED STATE — omit with session_id (the session carries it). ' +
                (schema.description ?? '')
            );
      }
    }
    if (tool.name !== 'start_recipe') shape.session_id = compatibility ? id.optional() : id;
    const contract =
      domain === 'recipe'
        ? 'SESSION CONTRACT: pass session_id instead of workspace. The server carries the exact workspace and returns the next session_id. '
        : 'SESSION CONTRACT: requires the latest session_id; submits a background operation. Poll get_operation for its result and next session_id. State, checkpoint, run_id and writer are carried by the server, replacing the raw transport instructions below. ';
    register(
      tool.name,
      {
        title: tool.title,
        description:
          contract +
          (compatibility
            ? 'Compatibility: callers without session_id may use the original caller-managed workspace/state contract. Never mix both modes. '
            : '') +
          tool.description,
        inputSchema: z.object(shape).strict(),
        ...(compatibility ? {} : { outputSchema: resultShape }),
        annotations: {
          ...stateful,
          idempotentHint:
            compatibility && domain === 'lyrics'
              ? (tool.annotations?.idempotentHint ?? false)
              : tool.name !== 'start_recipe',
          openWorldHint: tool.name === 'lyric_revise',
        },
      },
      async ({ session_id, ...args }) => {
        if (compatibility && session_id) {
          // A refusal names the field it refuses. This one used to say only
          // "never both" while the offending key was `writer`, which
          // `begin_lyrics` fixes for the session and which nothing in the
          // published schema marked as caller-managed; a caller mirroring
          // the schema could not tell which of its arguments to drop.
          const mixed = Object.keys(args).filter((key) => privateInput.has(key));
          if (mixed.length)
            throw new Error(
              'Choose session_id or caller-managed state, never both: ' +
                `${mixed.join(', ')} ${mixed.length === 1 ? 'is' : 'are'} caller-managed state ` +
                'the session already carries; omit it with session_id.'
            );
        }
        if (compatibility && !session_id && tool.name !== 'start_recipe') {
          if (domain === 'recipe' && !args.workspace)
            throw new Error('Provide the latest session_id or the original workspace.');
          return rawCall(tool.name, args);
        }
        if (tool.name === 'start_recipe')
          session_id = sessions.open(domain, { format: args.format }).session_id;
        const operation = sessions.submit(session_id, domain, tool.name, args);
        if (domain === 'lyrics') return response(operation);
        await sessions.wait(operation.operation_id);
        const result = sessions.status(operation.operation_id, domain);
        if (compatibility && tool.name === 'start_recipe' && !result.tool_result?.isError) {
          // Preserve the historical top-level recipe/workspace response for old
          // consumers while allowing new ones to carry only the session capability.
          const workspace = sessions.record(result.session_id, domain).session.workspace;
          const payload = {
            ...JSON.parse(result.tool_result.content[0].text),
            workspace,
            session_id: result.session_id,
            operation_id: result.operation_id,
          };
          return {
            structuredContent: result,
            content: [{ type: 'text', text: JSON.stringify(payload) }],
          };
        }
        return response(result);
      }
    );
  }
  return server;
}

// Release verification compares the exact deployed public contract, including
// shared workflow controls; native task clients retain their original contract.
export async function expectedSharedSurface() {
  const { JobStore } = await import('./job_store.js');
  const { WorkflowSessions } = await import('./workflow_sessions.js');
  const { listAll, initialization } = await import('./surface_contract.js');
  const server = await buildWorkflowServer({
    sessions: new WorkflowSessions({ store: new JobStore() }),
    compatibility: true,
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
