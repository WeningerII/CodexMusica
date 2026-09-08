// Maintained client contract for native/SDK integrations. Initialization guidance,
// descriptions, annotations and raw tool output are part of the interface.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { assertToolTask, instructionsForTask, taskDomain } from './task_contract.js';
import { TOOL_BUDGET_MS, TOOL_DELIVERY_MARGIN_MS } from './budget.js';
import { creationRefusal, recordCreation } from './lyric_workflow.js';
import { CONNECTOR_CONTRACT_VERSION } from './contract_version.js';
import {
  expectedSurface,
  initialization as readInitialization,
  listAll,
  surfaceDrift,
  initializationDrift,
} from './surface_contract.js';

export async function connectConnector({ url, task, transport, session = null } = {}) {
  const domain = taskDomain(task);
  const selected = structuredClone(
    typeof task === 'string' ? { domain, format: 'rich', maxChars: 1000 } : task
  );
  if (domain === 'lyrics' && selected.phase === undefined) selected.phase = 'create';
  if (domain === 'lyrics' && !['create', 'edit'].includes(selected.phase))
    throw new Error('Select lyrics phase create or edit in the host task.');
  // This state belongs to the host, never tool arguments. Persist it privately
  // across CLI invocations so reconnecting does not lose the executed receipts.
  if (
    session &&
    (session.version !== 1 ||
      session.connector_contract !== CONNECTOR_CONTRACT_VERSION ||
      session.task?.domain !== domain ||
      session.task?.phase !== selected.phase)
  )
    throw new Error('Session task differs from selected task.');
  const workflowTask = session ? structuredClone(session.task) : structuredClone(selected);
  let continuation = session?.continuation ? structuredClone(session.continuation) : null;
  let inFlight = false;
  if (!transport) {
    const endpoint = new URL(url || 'https://codex-musica-mcp.onrender.com/mcp');
    endpoint.pathname = endpoint.pathname.replace(/\/$/, '');
    if (!endpoint.pathname.endsWith('/' + domain)) {
      if (/\/(recipe|lyrics)$/.test(endpoint.pathname))
        throw new Error('Endpoint domain differs from the requested task.');
      endpoint.pathname += '/' + domain;
    }
    transport = new StreamableHTTPClientTransport(endpoint);
  }
  const client = new Client(
    { name: 'codex-musica-supported-client', version: '1' },
    { capabilities: {} }
  );
  try {
    await client.connect(transport);
    const initialization = client.getInstructions();
    const instructions = instructionsForTask(initialization, domain);
    const tools = await listAll(client);
    const expected = await expectedSurface(domain);
    const drift = [
      ...surfaceDrift(expected.tools, tools),
      ...initializationDrift(expected.init, readInitialization(client)),
    ];
    if (drift.length)
      throw new Error(
        'Connector contract is incompatible: ' +
          drift.map((row) => `${row.tool}: ${row.what}`).join('; ')
      );
    const scoped = tools;
    return {
      // Pass the entire surface to the driving host; never print only names.
      surface: { task: structuredClone(selected), initialization, instructions, tools: scoped },
      snapshot: () =>
        structuredClone({
          version: 1,
          connector_contract: CONNECTOR_CONTRACT_VERSION,
          task: workflowTask,
          continuation,
        }),
      async call(name, args = {}, options = {}) {
        if (inFlight)
          throw new Error('A connector session must execute its workflow calls sequentially.');
        args = structuredClone(args);
        assertToolTask(selected, name, args);
        if (!scoped.some((t) => t.name === name)) throw new Error('Unknown task tool: ' + name);
        if (name === 'lyric_revise' && selected.phase === 'create' && !args.recover_only) {
          if (continuation && !args.new_run) {
            for (const [key, value] of Object.entries(continuation.args)) {
              if (args[key] !== undefined && JSON.stringify(args[key]) !== JSON.stringify(value))
                throw new Error(
                  'CREATION_CONTINUATION: ' + key + ' differs from the recorded run.'
                );
              args[key] = structuredClone(value);
            }
          } else if (args.state || args.checkpoint) {
            throw new Error('CREATION_CONTINUATION: this session has no receipt for that run.');
          }
        }
        const refusal = creationRefusal(workflowTask, name, args, continuation);
        if (refusal) throw new Error(refusal);
        inFlight = true;
        try {
          const result = await client.callTool({ name, arguments: args }, undefined, {
            timeout: TOOL_BUDGET_MS + TOOL_DELIVERY_MARGIN_MS,
            ...options,
          });
          let verdict = null;
          for (const block of result.content || []) {
            if (block.type !== 'text') continue;
            try {
              const parsed = JSON.parse(block.text);
              if (Number.isInteger(parsed?.exit_code)) verdict = parsed;
            } catch {
              /* Plain-text deliverable, not a receipt. */
            }
          }
          recordCreation(workflowTask, name, args, verdict, result.isError);
          if (!result.isError && name === 'lyric_plan') continuation = null;
          if (!result.isError && name === 'lyric_revise' && verdict && !args.recover_only) {
            if (verdict.state || verdict.checkpoint) {
              const next = { ...args };
              for (const key of ['answer', 'answers', 'new_run', 'state', 'checkpoint'])
                delete next[key];
              if (verdict.state) next.state = verdict.state;
              if (verdict.checkpoint) next.checkpoint = verdict.checkpoint;
              continuation = { seed: args.seed, args: next };
            } else if (verdict.measurement_status === 'finished') continuation = null;
          }
          return result;
        } finally {
          inFlight = false;
        }
      },
      close: () => client.close(),
    };
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}
