// Real public battery CLI, localhost HTTP, no model or production calls.
import assert from 'node:assert/strict';
import express from 'express';
import { JobStore, createJobRouter } from './job_store.js';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../scripts/flash_battery.mjs', import.meta.url));
const finished = {
  reply: 'finished',
  history: [],
  workspace: null,
  sig: 'signed-finish',
  tools: [{ name: 'lyric_revise', exit_code: 0 }],
};
const checkpoint = {
  history: [{ role: 'model', parts: [{ text: 'saved' }] }],
  workspace: null,
  lyric: { draft: 'saved draft' },
  sig: 'signed-checkpoint',
};
const json = (res, code, value, headers = {}) => {
  res.writeHead(code, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(value));
};
const rows = (path) =>
  readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const summary = (out) => JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
async function fixture(handler, fn) {
  const out = mkdtempSync(join(tmpdir(), 'battery-lifecycle-'));
  const server = createServer((req, res) => {
    let text = '';
    req.on('data', (part) => {
      text += part;
    });
    req.on('end', () => handler(req, res, text ? JSON.parse(text) : null));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const run = (args = [], onChild = () => {}) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        cli,
        `--out=${out}`,
        `--base=${base}`,
        '--songs=1',
        '--turns=2',
        '--pace=0',
        '--reask=0',
        ...args,
      ]);
      let stdout = '',
        stderr = '';
      child.stdout.on('data', (s) => {
        stdout += s;
      });
      child.stderr.on('data', (s) => {
        stderr += s;
      });
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`driver hung: ${stdout}\n${stderr}`));
      }, 8_000);
      child.on('error', reject);
      child.on('close', (status, signal) => {
        clearTimeout(timeout);
        resolve({ status, signal, stdout, stderr });
      });
      onChild(child);
    });
  try {
    await fn({ out, run });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(out, { recursive: true, force: true });
  }
}
let checked = 0;
async function test(name, fn) {
  await fn();
  checked++;
  console.log(`ok ${checked} - ${name}`);
}

await test('persistent paced429 cannot borrow ordinary retry budget', async () => {
  let posts = 0;
  await fixture(
    (req, res) => {
      posts++;
      json(res, 429, { error: 'quota' }, { 'retry-after': '1' });
    },
    async ({ out, run }) => {
      const result = await run(['--rate-paced-max=3', '--retry-after-cap=0']);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(posts, 4);
      assert.equal(summary(out).songs[0].exit_reason, 'rate_limited');
      assert.equal(rows(join(out, 'song0.jsonl')).filter((r) => r.paced).length, 3);
    }
  );
});
await test('paced wait sum never admits a retry exceeding its remaining budget', async () => {
  let posts = 0;
  await fixture(
    (req, res) => {
      posts++;
      json(res, 429, { error: 'quota' }, { 'retry-after': '1' });
    },
    async ({ out, run }) => {
      const result = await run([
        '--rate-paced-max=9',
        '--retry-after-cap=0.02',
        '--rate-wait-cap=0.03',
      ]);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(posts, 2);
      assert.equal(summary(out).songs[0].exit_reason, 'rate_limited');
      assert.equal(rows(join(out, 'song0.jsonl')).find((r) => r.paced).rate_wait_s, 0.02);
    }
  );
});
for (const mode of ['aborted', 'invalid-json', 'deadline']) {
  await test(`post-header ${mode} settles with durable transport outcome`, async () => {
    let posts = 0;
    await fixture(
      (req, res) => {
        if (req.method === 'GET') return json(res, 404, { error: 'unknown' });
        posts++;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.write('{"reply":"partial');
        if (mode === 'aborted') setTimeout(() => res.destroy(), 5);
        if (mode === 'invalid-json') res.end();
      },
      async ({ out, run }) => {
        const result = await run(['--turn-deadline-ms=80', '--delivery-reserve=0']);
        assert.equal(result.status, 1, result.stderr);
        assert.equal(posts, 1);
        assert.equal(summary(out).songs[0].exit_reason, 'transport');
        assert.match(rows(join(out, 'song0.jsonl'))[0].transport, /aborted|closed|JSON|deadline/);
        const attempts = rows(join(out, 'song0.attempts.jsonl'));
        assert.equal(attempts[0].event, 'request_started');
        assert.ok(attempts.some((a) => a.event === 'response_received'));
      }
    );
  });
}
await test('kill during first request leaves intent; resume retrieves completion without repeating POST', async () => {
  let child,
    posts = 0,
    requestId;
  await fixture(
    (req, res, body) => {
      if (req.method === 'GET') {
        assert.equal(req.url, `/chat/jobs/${requestId}`);
        return json(res, 200, { state: 'completed', response: { status: 200, body: finished } });
      }
      posts++;
      requestId = body.request_id;
      assert.match(requestId, /^[a-f0-9]{64}$/);
      child.kill('SIGKILL');
      res.destroy();
    },
    async ({ out, run }) => {
      const killed = await run([], (c) => {
        child = c;
      });
      assert.equal(killed.signal, 'SIGKILL');
      assert.ok(existsSync(join(out, 'summary.json')));
      assert.ok(existsSync(join(out, 'song0.checkpoint.json')));
      assert.equal(rows(join(out, 'song0.attempts.jsonl'))[0].request_id, requestId);
      const result = await run(['--resume']);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(posts, 1);
      assert.equal(summary(out).songs[0].exit_reason, 'finished');
    }
  );
});
await test('ambiguous missing job is never reissued on resume', async () => {
  let child,
    posts = 0;
  await fixture(
    (req, res) => {
      if (req.method === 'GET') return json(res, 404, { error: 'unknown' });
      posts++;
      child.kill('SIGKILL');
      res.destroy();
    },
    async ({ out, run }) => {
      await run([], (c) => {
        child = c;
      });
      const result = await run(['--resume']);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(posts, 1);
      assert.match(rows(join(out, 'song0.jsonl'))[0].transport, /refusing automatic replay/);
    }
  );
});
await test('wall canary saves exact signed envelope and resumes next turn', async () => {
  const seen = [];
  await fixture(
    (req, res, body) => {
      seen.push(body);
      json(
        res,
        200,
        seen.length === 1
          ? {
              ...checkpoint,
              reply: '',
              stopped: 'MAX_TURN_MS',
              tools: [{ name: 'lyric_revise', exit_code: 4 }],
            }
          : finished
      );
    },
    async ({ out, run }) => {
      const first = await run(['--expect=turn-wall']);
      assert.equal(first.status, 0, first.stderr);
      assert.equal(summary(out).songs[0].exit_reason, 'turn_wall_checkpoint');
      assert.deepEqual(
        JSON.parse(readFileSync(join(out, 'song0.checkpoint.json'))).state.env,
        checkpoint
      );
      const second = await run(['--resume', '--expect=finished']);
      assert.equal(second.status, 0, second.stderr);
      assert.equal(seen.length, 2);
      for (const key of ['history', 'workspace', 'lyric', 'sig'])
        assert.deepEqual(seen[1][key], checkpoint[key]);
      assert.equal(summary(out).songs[0].exit_reason, 'finished');
    }
  );
});
await test('explicit resume can continue interrupted signed checkpoint with a new request ID', async () => {
  const seen = [];
  await fixture(
    (req, res, body) => {
      if (req.method === 'GET') return json(res, 200, { state: 'interrupted', checkpoint });
      seen.push(body);
      if (seen.length === 1) return res.destroy();
      json(res, 200, finished);
    },
    async ({ out, run }) => {
      assert.equal((await run()).status, 1);
      const second = await run(['--resume']);
      assert.equal(second.status, 0, second.stderr);
      assert.equal(seen.length, 2);
      assert.notEqual(seen[0].request_id, seen[1].request_id);
      assert.equal(seen[1].sig, checkpoint.sig);
      assert.ok(
        rows(join(out, 'song0.attempts.jsonl')).some((a) => a.event === 'interrupted_resume')
      );
    }
  );
});
await test('aggregate admission refuses a request that cannot finish before delivery reserve', async () => {
  let posts = 0;
  await fixture(
    (req, res) => {
      posts++;
      json(res, 200, finished);
    },
    async ({ out, run }) => {
      const result = await run([
        '--max-runtime=0.02',
        '--turn-deadline-ms=40',
        '--delivery-reserve=0',
      ]);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(posts, 0);
      assert.equal(summary(out).songs[0].exit_reason, 'aggregate_deadline');
    }
  );
});
for (const expect of ['finished', 'survey']) {
  await test(`multi-song ${expect} policy has an explicit outcome`, async () => {
    await fixture(
      (req, res) =>
        json(res, 200, { ...checkpoint, tools: [{ name: 'lyric_plan', exit_code: 0 }] }),
      async ({ out, run }) => {
        const result = await run(['--songs=2', '--stop-on=none', `--expect=${expect}`]);
        assert.equal(result.status, expect === 'finished' ? 1 : 0, result.stderr);
        assert.equal(summary(out).songs.length, 2);
        assert.ok(summary(out).songs.every((s) => s.exit_reason === 'no_stop'));
      }
    );
  });
}
await test('wrong live SHA refuses paid request', async () => {
  let posts = 0;
  await fixture(
    (req, res) => {
      if (req.method === 'POST') posts++;
      json(res, req.url === '/health' ? 200 : 404, { commit: 'b'.repeat(40) });
    },
    async ({ out, run }) => {
      assert.equal((await run([`--commit=${'a'.repeat(40)}`])).status, 1);
      assert.equal(posts, 0);
      assert.match(rows(join(out, 'song0.jsonl'))[0].transport, /commit changed/);
    }
  );
});

await test('pending job is polled to its actual completion without a second paid POST', async () => {
  let posts = 0,
    polls = 0;
  await fixture(
    (req, res) => {
      if (req.method === 'POST') {
        posts++;
        return json(res, 202, { state: 'pending' });
      }
      polls++;
      json(
        res,
        200,
        polls === 1
          ? { state: 'pending', checkpoint }
          : { state: 'completed', response: { status: 200, body: finished } }
      );
    },
    async ({ run }) => {
      const result = await run(['--poll-ms=10', '--turn-deadline-ms=1000', '--delivery-reserve=0']);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(posts, 1);
      assert.equal(polls, 2);
    }
  );
});
await test('measurement requires durable recovery before spending', async () => {
  let posts = 0;
  const commit = 'a'.repeat(40);
  await fixture(
    (req, res) => {
      if (req.method === 'POST') posts++;
      json(res, req.url === '/health' ? 200 : 404, {
        commit,
        recovery: { durable: false },
        build: { source_sha256: 'source', config_sha256: 'config' },
      });
    },
    async ({ out, run }) => {
      const result = await run([`--commit=${commit}`, '--require-recovery']);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(posts, 0);
      assert.match(rows(join(out, 'song0.jsonl'))[0].transport, /durable server recovery/);
    }
  );
});
await test('same commit with changed configuration stops before the next paid turn', async () => {
  let posts = 0,
    health = 0;
  const commit = 'a'.repeat(40);
  await fixture(
    (req, res) => {
      if (req.url === '/health') {
        health++;
        return json(res, 200, {
          commit,
          recovery: { durable: true, healthy: true },
          build: {
            commit,
            source_sha256: 'b'.repeat(64),
            config_sha256: (health === 1 ? 'c' : 'd').repeat(64),
          },
        });
      }
      if (req.method === 'GET')
        return json(res, 200, {
          state: 'completed',
          build: { commit, source_sha256: 'b'.repeat(64), config_sha256: 'c'.repeat(64) },
          response: {
            status: 200,
            body: { ...checkpoint, tools: [{ name: 'lyric_plan', exit_code: 0 }] },
          },
        });
      posts++;
      json(res, 200, { ...checkpoint, tools: [{ name: 'lyric_plan', exit_code: 0 }] });
    },
    async ({ out, run }) => {
      const result = await run([`--commit=${commit}`, '--require-recovery', '--stop-on=none']);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(posts, 1);
      assert.match(summary(out).songs[0].flags.at(-1).detail, /configuration changed/);
    }
  );
});
await test('partial upstream429 preserves the envelope and honors its pacing hint', async () => {
  const times = [],
    seen = [];
  await fixture(
    (req, res, body) => {
      times.push(Date.now());
      seen.push(body);
      json(
        res,
        200,
        seen.length === 1
          ? {
              ...checkpoint,
              stopped: 'UPSTREAM_429',
              stopped_detail: { retry_after_ms: 60 },
              tools: [{ name: 'lyric_plan', exit_code: 0 }],
            }
          : finished
      );
    },
    async ({ out, run }) => {
      const result = await run();
      assert.equal(result.status, 0, result.stderr);
      assert.equal(seen[1].sig, checkpoint.sig);
      assert.ok(times[1] - times[0] >= 55, `only ${times[1] - times[0]}ms waited`);
      assert.equal(rows(join(out, 'song0.jsonl')).find((row) => row.partial_pacing).waited_s, 0.06);
    }
  );
});

await test('actual job-router persistence503 recovers and never enters ordinary retry', async () => {
  let posts = 0;
  const store = new JobStore();
  const app = express();
  app.use(createJobRouter({ store }));
  app.post('/chat', (req, res) => {
    if (!req.chatJob.begin()) return;
    posts++;
    req.chatJob.checkpoint(checkpoint);
    store.complete = () => {
      throw new Error('injected full receipt disk');
    };
    res.json(finished);
  });
  await fixture(
    (req, res, body) => {
      req.body = body;
      app(req, res);
    },
    async ({ out, run }) => {
      const first = await run();
      assert.equal(first.status, 1, first.stderr);
      assert.equal(posts, 1);
      assert.match(rows(join(out, 'song0.jsonl'))[0].transport, /persistence failed/);
      const second = await run(['--resume']);
      assert.equal(second.status, 1, second.stderr);
      assert.equal(posts, 1, 'explicit resume also waits for persistence repair');
    }
  );
});
await test('actual retired receipt refuses replay after its full response was evicted', async () => {
  let posts = 0;
  const store = new JobStore(null, { maxPayloadRecords: 1 });
  const app = express();
  app.use(createJobRouter({ store }));
  app.post('/chat', (req, res) => {
    if (!req.chatJob.begin()) return;
    posts++;
    store.complete(req.body.request_id, 200, finished);
    store.begin('f'.repeat(64), { request_id: 'f'.repeat(64) });
    assert.equal(store.get(req.body.request_id).state, 'retired');
    res.destroy();
  });
  await fixture(
    (req, res, body) => {
      req.body = body;
      app(req, res);
    },
    async ({ out, run }) => {
      assert.equal((await run()).status, 1);
      assert.match(rows(join(out, 'song0.jsonl'))[0].transport, /retired/);
      assert.equal((await run(['--resume'])).status, 1);
      assert.equal(posts, 1);
    }
  );
});
await test('uncertain proposal stops automatic continuation and plain resume', async () => {
  let posts = 0;
  await fixture(
    (req, res) => {
      posts++;
      json(res, 200, {
        ...checkpoint,
        stopped: 'UNCERTAIN_PROPOSAL',
        tools: [{ name: 'lyric_revise', exit_code: 4 }],
      });
    },
    async ({ out, run }) => {
      assert.equal((await run()).status, 1);
      assert.equal(summary(out).songs[0].exit_reason, 'uncertain_proposal');
      assert.equal((await run(['--resume'])).status, 1);
      assert.equal(posts, 1);
    }
  );
});
await test('measurement refuses incomplete fingerprint identity even with durable recovery', async () => {
  let posts = 0;
  const commit = 'a'.repeat(40);
  await fixture(
    (req, res) => {
      if (req.method === 'POST') posts++;
      json(res, req.url === '/health' ? 200 : 404, {
        commit,
        recovery: { durable: true, healthy: true },
      });
    },
    async ({ out, run }) => {
      assert.equal((await run([`--commit=${commit}`, '--require-recovery'])).status, 1);
      assert.match(rows(join(out, 'song0.jsonl'))[0].transport, /identity is required/);
      assert.equal(posts, 0);
    }
  );
});

await test('interrupted proposal uncertainty is terminal even when its signed checkpoint survives', async () => {
  let posts = 0;
  await fixture(
    (req, res) => {
      if (req.method === 'GET')
        return json(res, 200, {
          state: 'interrupted',
          checkpoint,
          uncertain_proposal: true,
          progress: {
            uncertain_proposal: true,
            accepted_lines: ['accepted before the pending proposal'],
          },
        });
      posts++;
      res.destroy();
    },
    async ({ out, run }) => {
      assert.equal((await run()).status, 1);
      assert.equal(summary(out).songs[0].exit_reason, 'uncertain_proposal');
      assert.equal((await run(['--resume'])).status, 1);
      assert.equal(posts, 1);
    }
  );
});
await test('job receipt detects a deployment between health probe and paid request', async () => {
  let posts = 0;
  const commit = 'a'.repeat(40);
  const oldBuild = { commit, source_sha256: 'b'.repeat(64), config_sha256: 'c'.repeat(64) };
  await fixture(
    (req, res) => {
      if (req.url === '/health')
        return json(res, 200, {
          commit,
          build: oldBuild,
          recovery: { durable: true, healthy: true },
        });
      if (req.method === 'GET')
        return json(res, 200, {
          state: 'completed',
          build: { ...oldBuild, commit: 'd'.repeat(40) },
          response: { status: 200, body: finished },
        });
      posts++;
      json(res, 200, finished);
    },
    async ({ out, run }) => {
      assert.equal((await run([`--commit=${commit}`, '--require-recovery'])).status, 1);
      assert.equal(posts, 1);
      assert.match(rows(join(out, 'song0.jsonl'))[0].transport, /different build or configuration/);
      assert.ok(
        rows(join(out, 'song0.attempts.jsonl')).some(
          (a) => a.event === 'http_response_received' && a.response.payload.sig === finished.sig
        )
      );
    }
  );
});
console.log(`${checked} battery lifecycle checks passed`);
