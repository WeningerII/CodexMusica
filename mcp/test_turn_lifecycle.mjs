// Offline regressions for the complete turn lifetime. Only localhost HTTP;
// Gemini and lyric fixtures are explicit stubs, the router and MCP SDK are real.
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { runTurn, LIMITS, RETRY_TRANSIENT, priceFor } from './gemini_agent.js';
import { createChatRouter, CHAT_LIMITS } from './chat.js';
import { JobStore, createJobRouter } from './job_store.js';

const nativeFetch = globalThis.fetch;
const surface = {
  instructions: '',
  declarations: [],
  workspaceTools: new Set(),
  stateTools: new Set(['lyric_revise']),
};
const meta = { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 3 };
const fc = (id, name = 'lyric_types', args = {}) => ({
  functionCall: { id, name, args },
  thoughtSignature: `signature-${id}`,
});
const success = (parts, usageMetadata = meta) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts }, finishReason: 'STOP' }], usageMetadata }),
});
const result = { content: [{ type: 'text', text: 'completed' }] };
const opts = {
  apiKey: 'offline-test',
  surface,
  userText: 'continue',
  limits: { ...LIMITS, maxTurnUsd: 2.5, maxTurnMs: 1000, pruneFolded: false },
};
let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  } finally {
    globalThis.fetch = nativeFetch;
  }
}

await check('chat price overrides cannot price an unrelated unknown kitchen model', async () => {
  const keys = ['GEMINI_MODEL', 'CHAT_PRICE_INPUT_PER_1M', 'CHAT_PRICE_OUTPUT_PER_1M'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.GEMINI_MODEL = 'configured-new-chat-model';
    process.env.CHAT_PRICE_INPUT_PER_1M = '1.25';
    process.env.CHAT_PRICE_OUTPUT_PER_1M = '4.5';
    assert.deepEqual(priceFor('configured-new-chat-model'), {
      input: 1.25,
      output: 4.5,
      declared: true,
    });
    assert.equal(priceFor('unrelated-unknown-proposer'), null);
    assert.deepEqual(priceFor('gemini-3.1-flash-lite'), { input: 0.25, output: 1.5 });
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

await check('each emitted call is paired; expired later calls never start', async () => {
  let now = 0,
    calls = 0;
  globalThis.fetch = async () => success([fc('a'), fc('b'), fc('c')]);
  const out = await runTurn({
    ...opts,
    clock: () => now,
    callTool: async () => {
      calls++;
      now = 1001;
      return result;
    },
  });
  assert.equal(calls, 1);
  assert.equal(out.stopped, 'MAX_TURN_MS');
  assert.equal(out.calls.filter((c) => c.not_run).length, 2);
  assert.deepEqual(
    out.history.at(-1).parts.map((p) => p.functionResponse.id),
    ['a', 'b', 'c']
  );
  assert.equal(out.history[1].parts[2].thoughtSignature, 'signature-c');
  assert.match(out.history.at(-1).parts[1].functionResponse.response.error, /Not run/);
});

await check(
  'each completed tool has a signed-ready recovery transcript before the next starts',
  async () => {
    const checkpoints = [];
    let called = 0;
    globalThis.fetch = async () => success([fc('first'), fc('second')]);
    const out = await runTurn({
      ...opts,
      limits: { ...opts.limits, maxSteps: 1 },
      callTool: async () => {
        if (++called === 2) {
          assert.equal(checkpoints.length, 1);
          const parts = checkpoints[0].history.at(-1).parts;
          assert.equal(parts[0].functionResponse.response.text, 'completed');
          assert.match(parts[1].functionResponse.response.error, /Not run at this checkpoint/);
          assert.deepEqual(
            parts.map((p) => p.functionResponse.id),
            ['first', 'second']
          );
        }
        return result;
      },
      onCheckpoint: (checkpoint) => checkpoints.push(structuredClone(checkpoint)),
    });
    assert.equal(called, 2);
    assert.equal(out.history.at(-1).parts[1].functionResponse.response.text, 'completed');
    assert.equal(
      checkpoints.at(-1).history.at(-1).parts[1].functionResponse.response.text,
      'completed'
    );
  }
);

await check('model latency uses the same deadline as tool admission', async () => {
  let now = 0,
    calls = 0;
  globalThis.fetch = async () => {
    now = 1001;
    return success([fc('late')]);
  };
  const out = await runTurn({
    ...opts,
    clock: () => now,
    callTool: async () => {
      calls++;
      return result;
    },
  });
  assert.equal(calls, 0);
  assert.equal(out.stopped, 'MAX_TURN_MS');
  assert.equal(out.history.at(-1).parts[0].functionResponse.id, 'late');
});

for (const phase of ['fetch', 'body'])
  await check(`a stalled ${phase} ends without any tool call`, async () => {
    let suppliedSignal;
    globalThis.fetch = async (_url, request) => {
      suppliedSignal = request.signal;
      if (phase === 'fetch') return new Promise(() => {});
      return { ok: true, status: 200, json: () => new Promise(() => {}) };
    };
    const start = performance.now();
    const out = await runTurn({
      ...opts,
      limits: { ...opts.limits, maxTurnMs: 25 },
      callTool: async () => {
        throw new Error('must not run');
      },
    });
    assert.equal(out.stopped, 'MAX_TURN_MS');
    assert.equal(suppliedSignal.aborted, true);
    assert.ok(performance.now() - start < 1000);
    assert.equal(out.calls.length, 0);
  });

await check('large retry hints are clamped and waits cancel at the deadline', async () => {
  const retries = [];
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return {
      ok: false,
      status: 503,
      json: async () => ({
        error: { details: [{ '@type': 'google.rpc.RetryInfo', retryDelay: '7200s' }] },
      }),
    };
  };
  const out = await runTurn({
    ...opts,
    limits: { ...opts.limits, maxTurnMs: 25 },
    callTool: async () => result,
    retries: 3,
    retryStatuses: RETRY_TRANSIENT,
    onEvent: (e) => {
      if (e.type === 'retry') retries.push(e);
    },
  });
  assert.equal(out.stopped, 'MAX_TURN_MS');
  assert.equal(attempts, 1);
  assert.equal(retries[0].waitMs, 32000);
});

await check(
  'cancelled tools return their exact checkpoint before the paired result is recorded',
  async () => {
    const interrupted = {
      exit_code: -1,
      status: 'interrupted',
      checkpoint: '{"accepted":"journal"}',
      run_id: 'a'.repeat(64),
      replay_draft: ['original'],
      final_draft: ['accepted'],
      proposer_model: 'gemini-3.5-flash-lite',
      proposer_calls: 1,
      proposer_tokens_in: 10,
      proposer_tokens_out: 5,
      proposer_tokens_thoughts: 3,
    };
    globalThis.fetch = async () =>
      success([
        fc('checkpoint', 'lyric_revise', { seed: 16, draft: ['original'], form: 'couplet' }),
      ]);
    const out = await runTurn({
      ...opts,
      limits: { ...opts.limits, maxTurnMs: 100, cancelGraceMs: 200 },
      callTool: async (_name, _args, { signal }) => {
        await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
        await delay(10);
        return {
          content: [
            { type: 'text', text: 'interrupted' },
            { type: 'text', text: JSON.stringify(interrupted) },
          ],
        };
      },
    });
    assert.equal(out.stopped, 'MAX_TURN_MS');
    assert.equal(out.lyric.resumable, true);
    assert.deepEqual(out.lyric.final_draft, ['accepted']);
    assert.deepEqual(out.lyric.replay_draft, ['original']);
    assert.equal(out.lyric.run_id, interrupted.run_id);
    assert.equal(out.history.at(-1).parts[0].functionResponse.id, 'checkpoint');
    assert.equal(
      out.history.at(-1).parts[0].functionResponse.response.verdict.checkpoint,
      undefined
    );
    let resumed;
    globalThis.fetch = async () =>
      success([
        fc('resume', 'lyric_revise', { seed: 16, draft: ['model replaced'], form: 'sonnet' }),
      ]);
    await runTurn({
      ...opts,
      lyric: out.lyric,
      limits: { ...opts.limits, maxSteps: 1 },
      callTool: async (_name, args) => {
        resumed = args;
        return result;
      },
    });
    assert.deepEqual(resumed.draft, ['original']);
    assert.equal(resumed.checkpoint, interrupted.checkpoint);
    assert.equal(resumed.form, 'couplet');
    assert.equal(resumed.run_id, interrupted.run_id);
  }
);

await check(
  'an uncertain paid proposal stops automatic replay and preserves accepted work',
  async () => {
    let invoked = 0;
    const uncertain = {
      exit_code: -1,
      status: 'uncertain_proposal',
      checkpoint: '{"uncertain_proposal":true}',
      run_id: 'run_' + 'd'.repeat(64),
      replay_draft: ['original'],
      final_draft: ['accepted'],
    };
    globalThis.fetch = async () =>
      success([fc('uncertain', 'lyric_revise', { seed: 16, draft: ['original'] }), fc('later')]);
    const first = await runTurn({
      ...opts,
      callTool: async () => {
        invoked++;
        return { content: [{ type: 'text', text: JSON.stringify(uncertain) }] };
      },
    });
    assert.equal(invoked, 1);
    assert.equal(first.stopped, 'UNCERTAIN_PROPOSAL');
    assert.equal(first.lyric.uncertain_proposal, true);
    assert.deepEqual(first.lyric.final_draft, ['accepted']);
    assert.equal(first.calls[1].not_run, true);
    globalThis.fetch = async () => success([fc('automatic', 'lyric_revise', { seed: 16 })]);
    const automatic = await runTurn({
      ...opts,
      lyric: first.lyric,
      callTool: async () => {
        throw new Error('must not replay uncertain work');
      },
    });
    assert.equal(automatic.stopped, 'UNCERTAIN_PROPOSAL');
    let independent;
    globalThis.fetch = async () => success([fc('explicit-new', 'lyric_revise', { new_run: true })]);
    await runTurn({
      ...opts,
      lyric: first.lyric,
      limits: { ...opts.limits, maxSteps: 1 },
      callTool: async (_name, args) => {
        independent = args;
        return { content: [{ type: 'text', text: JSON.stringify({ exit_code: 0 }) }] };
      },
    });
    assert.equal(independent.new_run, true);
    assert.equal(independent.seed, 16);
    assert.equal(independent.checkpoint, undefined);
    assert.equal(independent.run_id, undefined);
    assert.deepEqual(independent.draft, ['accepted']);
  }
);

await check(
  'an explicit fresh run bypasses the old parked record without injecting its capability',
  async () => {
    const lyric = {
      key: 'seed:16',
      seed: 16,
      parked: true,
      draft: ['accepted'],
      run_id: 'run_' + 'f'.repeat(64),
      decl: { seed: 16, form: 'couplet' },
    };
    globalThis.fetch = async () =>
      success([
        fc('new-song', 'lyric_revise', {
          seed: 17,
          form: 'sonnet',
          draft: ['new input'],
          new_run: true,
        }),
      ]);
    let received;
    const out = await runTurn({
      ...opts,
      lyric,
      limits: { ...opts.limits, maxSteps: 1 },
      callTool: async (_name, args) => {
        received = args;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                exit_code: 3,
                final_draft: ['new accepted'],
                run_id: 'run_' + 'a'.repeat(64),
              }),
            },
          ],
        };
      },
    });
    assert.equal(received.seed, 17);
    assert.equal(received.form, 'sonnet');
    assert.equal(received.run_id, undefined);
    assert.equal(received.state, undefined);
    assert.equal(received.new_run, true);
    assert.equal(out.lyric.seed, 17);
    assert.equal(out.lyric.decl.new_run, undefined, 'fresh start is not a standing declaration');
  }
);

await check(
  'uncertified completion keeps the exact draft and coverage for continuation',
  async () => {
    globalThis.fetch = async () =>
      success([fc('uncertified', 'lyric_revise', { seed: 16, draft: ['original'] })]);
    const coverage = { pairs_mandated: 2, pairs_judged: 1, pairs_refused: 1, certified: false };
    const out = await runTurn({
      ...opts,
      limits: { ...opts.limits, maxSteps: 1 },
      callTool: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              exit_code: 2,
              status: 'uncertified',
              certified: false,
              final_draft: ['accepted'],
              replay_draft: ['original'],
              coverage,
              run_id: 'run_' + 'e'.repeat(64),
            }),
          },
        ],
      }),
    });
    assert.equal(out.lyric.uncertified, true);
    assert.deepEqual(out.lyric.draft, ['accepted']);
    assert.deepEqual(out.lyric.coverage, coverage);
    assert.equal(out.calls[0].certified, false);
  }
);

await check('reported kitchen thinking cost stops admission inside a multi-call hop', async () => {
  let calls = 0;
  globalThis.fetch = async () =>
    success([fc('paid', 'lyric_revise', { seed: 16 }), fc('not-paid')]);
  const out = await runTurn({
    ...opts,
    callTool: async () => {
      calls++;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              exit_code: 3,
              proposer_calls: 1,
              proposer_model: 'gemini-3.5-flash-lite',
              proposer_tokens_in: 1000000,
              proposer_tokens_out: 500000,
              proposer_tokens_thoughts: 500000,
            }),
          },
        ],
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(out.stopped, 'MAX_TURN_COST');
  assert.ok(out.cost >= 2.8);
  assert.equal(out.usage.kitchenUsd, 2.8);
  assert.equal(out.calls[1].not_run, true);
});

await check(
  'each model attempt reserves before dispatch and settles unknown cancellation',
  async () => {
    const events = [];
    const budget = {
      reserve: () => {
        events.push('reserve');
        return 'r';
      },
      settle: (_id, value) => events.push(value.status),
      snapshot: () => ({ usd: 0, reservedUsd: 0 }),
    };
    globalThis.fetch = async () => {
      events.push('fetch');
      return new Promise(() => {});
    };
    const out = await runTurn({
      ...opts,
      budget,
      limits: { ...opts.limits, maxTurnMs: 25 },
      callTool: async () => result,
    });
    assert.equal(out.stopped, 'MAX_TURN_MS');
    assert.deepEqual(events, ['reserve', 'fetch', 'unknown']);
  }
);

await check('a budget refusal before a model fetch yields a recoverable stopped turn', async () => {
  let dispatched = false;
  const budget = {
    reserve: () => {
      throw Object.assign(new Error('no room'), { code: 'MAX_TURN_COST' });
    },
    snapshot: () => ({ usd: 2.4, reservedUsd: 0 }),
  };
  globalThis.fetch = async () => {
    dispatched = true;
    return success([{ text: 'wrong' }]);
  };
  const out = await runTurn({ ...opts, budget, callTool: async () => result });
  assert.equal(dispatched, false);
  assert.equal(out.stopped, 'MAX_TURN_COST');
  assert.equal(out.history.length, 1);
});

await check('already-cancelled work is never dispatched, including inside admission', async () => {
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  let dispatches = 0;
  globalThis.fetch = async () => {
    dispatches++;
    return success([fc('must-not-run')]);
  };
  const out = await runTurn({
    ...opts,
    signal: controller.signal,
    callTool: async () => {
      dispatches++;
      return result;
    },
  });
  assert.equal(out.stopped, 'CANCELLED');
  assert.equal(dispatches, 0);

  let now = 0;
  const settlements = [];
  const budget = {
    reserve: () => {
      now = 1001;
      return 'unsent';
    },
    settle: (_id, event) => settlements.push(event.status),
    snapshot: () => ({ usd: 0, reservedUsd: 0 }),
  };
  const duringAdmission = await runTurn({
    ...opts,
    clock: () => now,
    budget,
    callTool: async () => result,
  });
  assert.equal(duringAdmission.stopped, 'MAX_TURN_MS');
  assert.equal(dispatches, 0);
  assert.deepEqual(settlements, ['rejected'], 'an unsent request releases its reservation');
});

await check(
  'rate limiting after completed work preserves the envelope and pacing hint',
  async () => {
    let requests = 0;
    globalThis.fetch = async () =>
      ++requests === 1
        ? success([fc('done')])
        : {
            ok: false,
            status: 429,
            headers: { get: () => '120' },
            json: async () => ({ error: { message: 'quota' } }),
          };
    const out = await runTurn({
      ...opts,
      callTool: async () => result,
      retryStatuses: RETRY_TRANSIENT,
      rateLimit: { retries: 0, maxTotalWaitMs: 0, backoffMs: [1] },
    });
    assert.equal(out.stopped, 'UPSTREAM_429');
    assert.equal(out.stoppedDetail.retry_after_ms, 120000);
    assert.equal(out.calls.length, 1);
    assert.equal(out.history[2].parts[0].functionResponse.id, 'done');
  }
);

await check('actual HTTP and SDK preserve signed continuation and stop on disconnect', async () => {
  const recordedArgs = [],
    modelBodies = [];
  let phase = 'park',
    releaseModel,
    afterDisconnectCalls = 0,
    modelSignal;
  const buildServer = () => {
    const server = new McpServer(
      { name: 'lifecycle-fixture', version: '1.0.0' },
      {
        instructions:
          '=== RECIPE TASK === Recording recipes only. === LYRICS TASK === Lyrics only.',
      }
    );
    server.registerTool(
      'lyric_revise',
      {
        inputSchema: {
          seed: z.number(),
          draft: z.array(z.string()).optional(),
          draft_text: z.string().optional(),
          form: z.string().optional(),
          state: z.string().optional(),
          writer: z.string().optional(),
          run_id: z.string().optional(),
          checkpoint: z.string().optional(),
        },
      },
      async (args) => {
        recordedArgs.push(args);
        if (phase === 'park') await delay(150);
        return {
          content: [
            { type: 'text', text: 'accepted lyric' },
            {
              type: 'text',
              text: JSON.stringify({
                exit_code: phase === 'park' ? 3 : 0,
                run_id: 'b'.repeat(64),
                final_draft: ['accepted A', 'original B'],
                replay_draft: ['original A', 'original B'],
              }),
            },
          ],
        };
      }
    );
    server.registerTool('lyric_types', { inputSchema: {} }, async () => {
      afterDisconnectCalls++;
      return result;
    });
    return server;
  };
  const store = new JobStore();
  const app = express();
  app.use(express.json());
  app.use(createJobRouter({ store, build: { commit: 'fixture' } }));
  app.use(
    await createChatRouter({
      buildServer,
      Client,
      InMemoryTransport,
      apiKey: 'offline',
      turnLimits: { ...LIMITS, maxTurnMs: 100, cancelGraceMs: 200, maxSteps: 1 },
      limits: { ...CHAT_LIMITS, perIpPerMinute: 1000, perIpPerHour: 1000 },
    })
  );
  const http = createServer(app);
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${http.address().port}`;
  const post = (body) =>
    new Promise((resolve, reject) => {
      const req = request(
        `${base}/chat`,
        { method: 'POST', headers: { 'content-type': 'application/json' } },
        (res) => {
          let bytes = '';
          res.on('data', (b) => (bytes += b));
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(bytes) }));
        }
      );
      req.on('error', reject);
      req.end(JSON.stringify(body));
    });
  globalThis.fetch = async (_url, options) => {
    modelBodies.push(JSON.parse(options.body));
    modelSignal = options.signal;
    if (phase === 'disconnect')
      return new Promise((resolve) => {
        releaseModel = () => resolve(success([fc('orphan')]));
      });
    return success([
      fc(
        phase,
        'lyric_revise',
        phase === 'park'
          ? { seed: 16, draft: ['original A', 'original B'], form: 'couplet' }
          : { seed: 16, draft_text: 'rewritten A\noriginal B', form: 'sonnet' }
      ),
    ]);
  };
  try {
    // An omitted phase is a new-song task. Its premature revise must be
    // refused before the delayed handler; it cannot establish a wall test.
    const creation = await post({ message: 'write', task: { domain: 'lyrics' } });
    assert.equal(creation.status, 200);
    assert.equal(creation.body.task.phase, 'create');
    assert.equal(creation.body.tools[0].not_run, true);
    assert.match(creation.body.tools[0].error, /^CREATION_ORDER:/);
    assert.equal(recordedArgs.length, 0);

    const firstModelBody = modelBodies.length;
    const first = await post({
      message: 'edit these existing lyrics',
      task: { domain: 'lyrics', phase: 'edit' },
    });
    assert.equal(first.status, 200);
    assert.equal(recordedArgs.length, 1, 'the delayed SDK handler actually ran');
    assert.equal(first.body.stopped, 'MAX_TURN_MS');
    assert.equal(first.body.stopped_detail.cap, 100);
    assert.ok(first.body.stopped_detail.ms >= 100);
    assert.deepEqual(first.body.lyric.draft, ['accepted A', 'original B']);
    assert.equal(first.body.lyric.run_id, 'b'.repeat(64));
    const { history, workspace, lyric, sig, task } = first.body;
    phase = 'continue';
    const second = await post({ message: 'continue', history, workspace, lyric, sig, task });
    assert.equal(second.status, 200);
    assert.equal(recordedArgs[1].form, 'couplet');
    assert.equal(recordedArgs[1].run_id, 'b'.repeat(64));
    assert.equal(
      modelBodies[firstModelBody + 1].contents[1].parts[0].thoughtSignature,
      'signature-park'
    );
    assert.equal(history.at(-1).parts[0].functionResponse.id, 'park');
    const tamper = await post({ message: 'continue', history: [], workspace, lyric, sig });
    assert.equal(tamper.status, 400);
    const malformedSig = await post({
      message: 'continue',
      history,
      workspace,
      lyric,
      sig: 'x'.repeat(64),
    });
    assert.equal(malformedSig.status, 400);
    phase = 'disconnect';
    const jobId = 'c'.repeat(64);
    const closed = new Promise((resolve) => {
      const req = request(`${base}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      req.on('error', () => {});
      req.on('close', resolve);
      req.end(JSON.stringify({ message: 'disconnect', request_id: jobId }));
      (async () => {
        while (!releaseModel) await delay(1);
        req.destroy();
      })();
    });
    await closed;
    await delay(20);
    assert.equal(modelSignal.aborted, true);
    releaseModel();
    await delay(20);
    assert.equal(afterDisconnectCalls, 0);
    const receipt = await nativeFetch(`${base}/chat/jobs/${jobId}`).then((r) => r.json());
    assert.equal(receipt.response.body.stopped, 'CANCELLED');
    assert.equal(typeof receipt.response.body.sig, 'string');
    assert.ok(receipt.response.body.accounting.unknownUsd > 0);
  } finally {
    http.closeAllConnections();
    await new Promise((resolve) => http.close(resolve));
  }
});

console.log(`${passed} turn lifecycle regressions passed`);
