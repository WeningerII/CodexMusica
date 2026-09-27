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

// The tree's own surface for a task never changes within a process: build it
// once per domain, not once per connection.
const expectedSurfaces = new Map();
export function expectedSurfaceFor(domain) {
  if (!expectedSurfaces.has(domain)) {
    const pending = expectedSurface(domain);
    pending.catch(() => expectedSurfaces.delete(domain));
    expectedSurfaces.set(domain, pending);
  }
  return expectedSurfaces.get(domain);
}

// A stopped revision returns its journal as `state` for provenance. It is the
// record of a finished run, not a question awaiting an answer, so it never
// becomes the connection's live continuation.
export function revisionStopped(verdict) {
  return (
    verdict.measurement_status === 'finished' ||
    verdict.resumable === false ||
    !!verdict.new_run_required ||
    [0, 3].includes(verdict.exit_code)
  );
}

// `verifySurface: false` is for a transport to a server this process built from
// this tree: comparing that server with the tree compares the tree with itself.
export async function connectConnector({
  url,
  task,
  transport,
  session = null,
  verifySurface = true,
} = {}) {
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
    const endpoint = new URL(url || 'https://mcp.codexmusica.com/mcp');
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
    const expected = await expectedSurfaceFor(domain);
    let tools = expected.tools;
    if (verifySurface) {
      tools = await listAll(client);
      const drift = [
        ...surfaceDrift(expected.tools, tools),
        ...initializationDrift(expected.init, readInitialization(client)),
      ];
      if (drift.length)
        throw new Error(
          'Connector contract is incompatible: ' +
            drift.map((row) => `${row.tool}: ${row.what}`).join('; ')
        );
    }
    return {
      // Pass the entire surface to the driving host; never print only names.
      surface: { task: structuredClone(selected), initialization, instructions, tools },
      snapshot: () =>
        structuredClone({
          version: 1,
          connector_contract: CONNECTOR_CONTRACT_VERSION,
          task: workflowTask,
          continuation,
        }),
      async call(name, args = {}, options = {}) {
        try {
          if (inFlight)
            throw new Error('A connector session must execute its workflow calls sequentially.');
          args = structuredClone(args);
          assertToolTask(selected, name, args);
          if (!tools.some((t) => t.name === name)) throw new Error('Unknown task tool: ' + name);
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
        } catch (error) {
          // Durable hosts can distinguish a rejected request from an unknown
          // outcome after dispatch. This flag never comes from model arguments.
          error.beforeDispatch = true;
          throw error;
        }
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
            if (revisionStopped(verdict)) continuation = null;
            else if (verdict.state || verdict.checkpoint) {
              const next = { ...args };
              for (const key of ['answer', 'answers', 'new_run', 'state', 'checkpoint'])
                delete next[key];
              if (verdict.state) next.state = verdict.state;
              if (verdict.checkpoint) next.checkpoint = verdict.checkpoint;
              // These identify the returned successor, not the request that
              // produced it. Persist them together with its state on reconnect.
              for (const key of ['run_id', 'run_revision']) {
                delete next[key];
                if (verdict[key] != null) next[key] = verdict[key];
              }
              continuation = { seed: args.seed, args: next };
            }
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
