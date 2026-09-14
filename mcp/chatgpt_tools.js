// Session-aware MCP facade. The underlying engine, graders, schemas and native
// workflow receipts remain the authority; no provider-specific music logic.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TOOL_SCHEMAS } from './schemas.js';
import { LYRIC_TOOL_SCHEMAS } from './lyric_tools.js';
import { expectedSurface } from './surface_contract.js';
import { executeNative, publicToolResult } from './chatgpt_sessions.js';

export const CHATGPT_CONNECTOR_VERSION = '1.0.0';
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
    content: value.tool_result?.content?.length
      ? value.tool_result.content
      : [{ type: 'text', text: JSON.stringify(value) }],
    ...(value.tool_result?.isError ? { isError: true } : {}),
  };
}

export async function buildChatGPTServer({ domain, sessions }) {
  if (!['recipe', 'lyrics'].includes(domain)) throw new Error('Select a ChatGPT task endpoint.');
  const raw = await surface(domain);
  const instructions =
    domain === 'recipe'
      ? 'Recipe session contract: start_recipe returns session_id. Pass the latest session_id to edit_recipe/render_recipe; the server carries the workspace. Each call returns the next session_id. Resolve catalog IDs, realize requested preferences through edits, and present the final recipe verbatim. Rich is the default; format may explicitly select tags, prose or compact. Recipes stay within 1000 characters. Never start lyrics for a recipe request.'
      : 'Lyrics session contract: begin_lyrics selects create or edit and the writer. Tools submit work and return operation_id. Poll get_operation until completed, then use its session_id for the next step. Never submit another operation while one is pending. Creation requires sweep → screen → plan → exact-draft grade → revise; receipts and continuations are stored by the server. Resume interrupted operations only when resumable is true. Never treat a finished call as proof of certification.';
  const server = new McpServer(
    { name: `codex-musica-chatgpt-${domain}`, version: CHATGPT_CONNECTOR_VERSION },
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
    ({ operation_id }) => response(sessions.status(operation_id, domain))
  );

  register(
    'resume_operation',
    {
      title: 'Resume interrupted work',
      description:
        'Explicitly continue an interrupted operation after get_operation reports resumable:true. Preserves its exact workspace or lyric declarations and accepted checkpoint. Unknown provider outcomes cannot resume. Repeating this request returns its existing successor rather than spending again.',
      inputSchema: z.object({ operation_id: id }).strict(),
      outputSchema: resultShape,
      annotations: { ...stateful, openWorldHint: domain === 'lyrics' },
    },
    async ({ operation_id }) => {
      const operation = sessions.resume(operation_id, domain);
      if (domain === 'lyrics') return response(operation);
      await sessions.wait(operation.operation_id);
      return response(sessions.status(operation.operation_id, domain));
    }
  );

  if (domain === 'lyrics') {
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
      (args) => response(sessions.open(domain, args))
    );
  }

  for (const tool of raw.tools) {
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
    if (tool.name !== 'start_recipe') shape.session_id = id;
    const contract =
      domain === 'recipe'
        ? 'SESSION CONTRACT: pass session_id instead of workspace. The server carries the exact workspace and returns the next session_id. '
        : 'SESSION CONTRACT: requires the latest session_id; submits a background operation. Poll get_operation for its result and next session_id. State, checkpoint, run_id and writer are carried by the server, replacing the raw transport instructions below. ';
    register(
      tool.name,
      {
        title: tool.title,
        description: contract + tool.description,
        inputSchema: z.object(shape).strict(),
        outputSchema: resultShape,
        annotations: {
          ...stateful,
          idempotentHint: tool.name !== 'start_recipe',
          openWorldHint: tool.name === 'lyric_revise',
        },
      },
      async ({ session_id, ...args }) => {
        if (tool.name === 'start_recipe')
          session_id = sessions.open(domain, { format: args.format }).session_id;
        const operation = sessions.submit(session_id, domain, tool.name, args);
        if (domain === 'lyrics') return response(operation);
        await sessions.wait(operation.operation_id);
        return response(sessions.status(operation.operation_id, domain));
      }
    );
  }
  return server;
}
