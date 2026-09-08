// Real public battery CLI, localhost HTTP, no model or production calls.
import assert from 'node:assert/strict';
import { sha256, wallCheckpoint, wallContinued } from '../scripts/battery_verdict.mjs';
import { gzipSync } from 'node:zlib';
import { completionTaskIdentity } from './task_contract.js';
import express from 'express';
import { JobStore, createJobRouter } from './job_store.js';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../scripts/flash_battery.mjs', import.meta.url));
const finished = {
  reply: 'finished',
  task: { domain: 'lyrics', brief: 'fixture', plan: {} },
  history: [{ role: 'model', parts: [{ text: 'finished' }] }],
  workspace: null,
  sig: 'signed-finish',
  tools: [
    {
      name: 'lyric_revise',
      exit_code: 0,
      certified: true,
      final_draft_sha256: sha256(JSON.stringify(['finished'])),
      draft_fp: sha256('finished'),
    },
  ],
  artifact: {
    text: 'finished',
    certified: true,
    final_draft_sha256: sha256(JSON.stringify(['finished'])),
    final_draft: ['finished'],
    draft_fp: sha256('finished'),
  },
  completion: {
    certified: true,
    task_sha256: sha256(JSON.stringify({ domain: 'lyrics', brief: 'fixture', plan: {} })),
    final_draft_sha256: sha256(JSON.stringify(['finished'])),
    draft_fp: sha256('finished'),
    delivery_sha256: sha256('finished'),
  },
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
        assert.equal(statSync(out).mode & 0o777, 0o700);
        for (const name of [
          'run.json',
          'summary.json',
          'song0.jsonl',
          'song0.attempts.jsonl',
          'song0.checkpoint.json',
        ]) {
          assert.equal(statSync(join(out, name)).mode & 0o777, 0o600, `${name} is private`);
        }
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
// The HTTP server owns these controlled native-shaped receipts. This tests the
// actual battery transport/oracle; Python's journal tests separately prove that
// replay/application counters originate in real proposer/verifier branches.
const wallBuild = {
  commit: 'a'.repeat(40),
  release_id: '123:456:1:lyrics-image',
  source_sha256: 'b'.repeat(64),
  config_sha256: 'c'.repeat(64),
  assets_sha256: 'd'.repeat(64),
  asset_manifest_sha256: 'e'.repeat(64),
};
function wallFixture() {
  const initial = ['saved draft'];
  const journal = {
    version: 1,
    journal_id: '1'.repeat(32),
    input_draft: initial,
    input_fingerprint: sha256('saved draft'),
    accepted_lines: initial,
    config_key: 'same-plan-and-loop-configuration',
    proposer: 'call:fixture:make',
    round: 1,
    status: 'proposal_completed',
    proposals: [{ kind: 'propose', question_sha256: '2'.repeat(64), answer: 'finished' }],
    answered: { propose: [{ line: 1, text: 'finished' }], propose_group: [] },
    verified_outcomes: [],
    connector_declarations: { seed: 1, writer: 'kitchen' },
    connector_semantic_identity: '3'.repeat(64),
  };
  const bytes = Buffer.from(JSON.stringify(journal));
  const wire = JSON.stringify({
    connector_contract: 1,
    codec: 1,
    encoding: 'gzip+base64',
    semantic_identity: journal.connector_semantic_identity,
    decoded_bytes: bytes.length,
    sha256: sha256(bytes),
    payload: gzipSync(bytes).toString('base64'),
  });
  const plan = { request: { seed: 1 } };
  const task = {
    version: 1,
    domain: 'lyrics',
    brief: 'fixture',
    instructions: 'Preserve the declared love song.',
    plan: { args: plan.request, result: plan, sha256: sha256(JSON.stringify(plan)) },
  };
  const pending = {
    ...checkpoint,
    task,
    reply: '',
    stopped: 'MAX_TURN_MS',
    lyric: {
      resumable: true,
      uncertain_proposal: false,
      run_id: 'run_' + '4'.repeat(64),
      checkpoint: wire,
      draft: initial,
      replay_draft: initial,
      final_draft: initial,
      decl: journal.connector_declarations,
    },
    tools: [
      {
        name: 'lyric_revise',
        writer: 'kitchen',
        status: 'interrupted',
        exit_code: 4,
        journal_id: journal.journal_id,
        final_draft: initial,
        verified_outcomes: [],
        verified_outcomes_error: null,
        verified_outcomes_draft_sha256: sha256(JSON.stringify(initial)),
      },
    ],
  };
  const after = structuredClone(finished);
  after.task = task;
  after.completion.task_sha256 = sha256(JSON.stringify(completionTaskIdentity(task)));
  const native = { ...journal };
  delete native.connector_declarations;
  delete native.connector_semantic_identity;
  const outcome = {
    outcome_id: '5'.repeat(64),
    kind: 'propose',
    proposal_index: 0,
    question_sha256: journal.proposals[0].question_sha256,
    round: 1,
    attempt: 0,
    members: [1],
    accepted: true,
    applied: true,
    before_draft_sha256: sha256(JSON.stringify(initial)),
    after_draft_sha256: sha256(JSON.stringify(['finished'])),
    applied_draft_sha256: sha256(JSON.stringify(['finished'])),
  };
  Object.assign(after.tools[0], {
    writer: 'kitchen',
    status: 'finished_clean',
    journal_id: journal.journal_id,
    // A process cache capability can rotate; the persisted journal cannot.
    run_id: 'run_' + '6'.repeat(64),
    final_draft: ['finished'],
    verified_outcomes: [outcome],
    verified_outcomes_error: null,
    verified_outcomes_draft_sha256: outcome.after_draft_sha256,
    resume_proof: {
      version: 1,
      journal_id: journal.journal_id,
      checkpoint_loaded: true,
      input_checkpoint_sha256: sha256(JSON.stringify(native) + '\n'),
      wire_checkpoint_sha256: sha256(wire),
      input_draft_sha256: sha256(JSON.stringify(initial)),
      accepted_draft_sha256_at_start: sha256(JSON.stringify(initial)),
      applied_outcome_ids_at_start: [],
      completed_proposals_at_start: 1,
      completed_proposals_replayed: 1,
      new_proposer_dispatches: 0,
      completed_proposal_redispatches: 0,
      replay_prefix_consumed: true,
    },
    resume_proof_error: null,
  });
  return { pending, after, journal };
}
const wallContext = { checkpointBuild: wallBuild, continuationBuild: wallBuild };
for (const mode of ['clean', 'parked'])
  await test(`wall canary replays the exact durable checkpoint into a ${mode} verified application`, async () => {
    const { pending, after } = wallFixture(),
      seen = [],
      receipts = new Map();
    if (mode === 'parked') {
      const tool = after.tools[0];
      tool.exit_code = 3;
      tool.status = 'stopped_with_open_lines';
      tool.certified = false;
      delete after.completion;
      delete after.artifact;
      after.stopped = 'LYRICS_UNFINISHED';
      after.lyric = {
        parked: true,
        exit_code: 3,
        draft: tool.final_draft,
        final_draft: tool.final_draft,
        decl: { ...pending.lyric.decl },
      };
    }
    await fixture(
      (req, res, body) => {
        if (req.url === '/health')
          return json(res, 200, {
            commit: wallBuild.commit,
            build: wallBuild,
            recovery: { durable: true, healthy: true },
          });
        if (req.method === 'GET')
          return json(res, 200, {
            state: 'completed',
            build: wallBuild,
            response: { status: 200, body: receipts.get(req.url.split('/').at(-1)) },
          });
        seen.push(body);
        const payload = seen.length === 1 ? pending : after;
        receipts.set(body.request_id, payload);
        json(res, 200, payload);
      },
      async ({ out, run }) => {
        const result = await run([
          '--expect=turn-wall',
          `--commit=${wallBuild.commit}`,
          '--require-recovery',
        ]);
        assert.equal(result.status, 0, result.stderr);
        assert.equal(summary(out).songs[0].exit_reason, 'turn_wall_continued');
        assert.equal(summary(out).songs[0].wall_continuation.verified, true);
        assert.equal(seen.length, 2);
        assert.equal(seen[1].continuation_id, seen[0].request_id);
        assert.deepEqual(Object.keys(seen[1]).sort(), ['continuation_id', 'message', 'request_id']);
        const attempts = rows(join(out, 'song0.attempts.jsonl'));
        assert.equal(attempts.filter((row) => row.event === 'identity_checked').length, 2);
        assert.equal(attempts.filter((row) => row.event === 'response_received').length, 2);
      }
    );
  });
await test('wall receipts refuse fabricated progress, changed identity, and incomplete replay', async () => {
  const { pending, after } = wallFixture();
  assert.equal(wallCheckpoint(pending, wallBuild), true);
  assert.equal(wallContinued(pending, after, 200, wallContext), true);
  const rejected = [
    [
      'unvisited',
      (p) => {
        p.tools[0].not_run = true;
      },
    ],
    [
      'refused',
      (p) => {
        p.tools[0].exit_code = 2;
        p.tools[0].refusal = 'cannot resume';
      },
    ],
    [
      'error',
      (p) => {
        p.tools[0].error = 'worker failed';
      },
    ],
    [
      'unrelated tool',
      (p) => {
        p.tools[0].name = 'lyric_plan';
      },
    ],
    [
      'changed task',
      (p) => {
        p.task.brief = 'another song';
      },
    ],
    [
      'changed plan',
      (p) => {
        p.task.plan.args.seed = 2;
      },
    ],
    [
      'changed journal',
      (p) => {
        p.tools[0].journal_id = '9'.repeat(32);
      },
    ],
    [
      'different checkpoint',
      (p) => {
        p.tools[0].resume_proof.wire_checkpoint_sha256 = '9'.repeat(64);
      },
    ],
    [
      'different input draft',
      (p) => {
        p.tools[0].resume_proof.input_draft_sha256 = '9'.repeat(64);
      },
    ],
    [
      'unacknowledged checkpoint',
      (p) => {
        p.tools[0].resume_proof.checkpoint_loaded = false;
      },
    ],
    [
      'unconsumed replay',
      (p) => {
        p.tools[0].resume_proof.completed_proposals_replayed = 0;
      },
    ],
    [
      'duplicate paid proposal',
      (p) => {
        p.tools[0].resume_proof.completed_proposal_redispatches = 1;
      },
    ],
    [
      'attempt without completion',
      (p) => {
        p.tools[0].resume_proof.new_proposer_dispatches = 1;
        p.tools[0].verified_outcomes = [];
      },
    ],
    [
      'declined answer',
      (p) => {
        p.tools[0].verified_outcomes[0].accepted = false;
        p.tools[0].verified_outcomes[0].applied = false;
      },
    ],
    [
      'not applied',
      (p) => {
        p.tools[0].verified_outcomes[0].applied = false;
      },
    ],
    [
      'changed accepted start',
      (p) => {
        p.tools[0].resume_proof.accepted_draft_sha256_at_start = '9'.repeat(64);
      },
    ],
    [
      'unmatched question',
      (p) => {
        p.tools[0].verified_outcomes[0].question_sha256 = '9'.repeat(64);
      },
    ],
    [
      'uncompleted proposal',
      (p) => {
        p.tools[0].verified_outcomes[0].proposal_index = 1;
      },
    ],
    [
      'unrelated final draft',
      (p) => {
        p.tools[0].final_draft = ['unverified'];
      },
    ],
    [
      'duplicate receipt',
      (p) => {
        p.tools[0].verified_outcomes.push(p.tools[0].verified_outcomes[0]);
      },
    ],
  ];
  rejected.push([
    'later refusal',
    (p) => {
      p.tools.push({
        name: 'lyric_revise',
        not_run: true,
        exit_code: 2,
        refusal: 'checkpoint cannot resume',
      });
    },
  ]);
  for (const [field, value] of [
    ['version', 2],
    ['instructions', 'Write a different song.'],
  ]) {
    rejected.push([
      `changed task ${field} despite new valid delivery hash`,
      (p) => {
        p.task[field] = value;
        p.completion.task_sha256 = sha256(JSON.stringify(completionTaskIdentity(p.task)));
      },
    ]);
  }
  for (const [name, mutate] of rejected) {
    const bad = structuredClone(after);
    mutate(bad);
    assert.equal(wallContinued(pending, bad, 200, wallContext), false, name);
  }
  assert.equal(wallContinued(pending, after, 500, wallContext), false);
  assert.equal(wallContinued(pending, after, 200), false, 'missing measured build');
  assert.equal(
    wallContinued(pending, after, 200, {
      ...wallContext,
      continuationBuild: { ...wallBuild, source_sha256: '9'.repeat(64) },
    }),
    false,
    'build drift'
  );
  for (const mutate of [
    (p) => {
      p.lyric = { seed: 1 };
    },
    (p) => {
      p.lyric.resumable = false;
    },
    (p) => {
      p.lyric.checkpoint = '{}';
    },
    (p) => {
      p.lyric.decl.seed = 2;
    },
    (p) => {
      p.lyric.final_draft = ['invented checkpoint'];
    },
  ]) {
    const bad = structuredClone(pending);
    mutate(bad);
    assert.equal(wallCheckpoint(bad, wallBuild), false);
  }
});
await test('wall progress compares the exact prior applied identity set independently of lexical ordering', async () => {
  const { pending, after, journal } = wallFixture();
  const oldIds = ['e'.repeat(64), 'd'.repeat(64)];
  const hashes = ['saved draft', 'older answer', 'saved draft'].map((line) =>
    sha256(JSON.stringify([line]))
  );
  journal.proposals = [
    { kind: 'propose', question_sha256: 'a'.repeat(64), answer: 'older answer' },
    { kind: 'propose', question_sha256: 'b'.repeat(64), answer: 'saved draft' },
    ...journal.proposals,
  ];
  journal.verified_outcomes = oldIds.map((outcome_id, i) => ({
    outcome_id,
    accepted: true,
    applied: true,
    kind: 'propose',
    proposal_index: i,
    question_sha256: journal.proposals[i].question_sha256,
    round: 1,
    attempt: i,
    members: [1],
    before_draft_sha256: hashes[i],
    after_draft_sha256: hashes[i + 1],
    applied_draft_sha256: hashes[i + 1],
  }));
  const bytes = Buffer.from(JSON.stringify(journal));
  const envelope = JSON.parse(pending.lyric.checkpoint);
  Object.assign(envelope, {
    decoded_bytes: bytes.length,
    sha256: sha256(bytes),
    payload: gzipSync(bytes).toString('base64'),
  });
  pending.lyric.checkpoint = JSON.stringify(envelope);
  const native = { ...journal };
  delete native.connector_declarations;
  delete native.connector_semantic_identity;
  const tool = after.tools[0];
  Object.assign(tool.resume_proof, {
    input_checkpoint_sha256: sha256(JSON.stringify(native) + '\n'),
    wire_checkpoint_sha256: sha256(pending.lyric.checkpoint),
    applied_outcome_ids_at_start: [...oldIds].sort(),
    completed_proposals_at_start: 3,
    completed_proposals_replayed: 3,
  });
  tool.verified_outcomes[0].proposal_index = 2;
  tool.verified_outcomes.unshift(...journal.verified_outcomes);
  assert.equal(wallContinued(pending, after, 200, wallContext), true);
  tool.resume_proof.applied_outcome_ids_at_start = [oldIds[0], oldIds[0]];
  assert.equal(
    wallContinued(pending, after, 200, wallContext),
    false,
    'duplicate is not a complete prior set'
  );
  tool.resume_proof.applied_outcome_ids_at_start = [...oldIds].sort();
  tool.verified_outcomes[2].outcome_id = oldIds[0];
  assert.equal(
    wallContinued(pending, after, 200, wallContext),
    false,
    'reverified old acceptance is no new progress'
  );
});
await test('actual native nested replay measures only advancement beyond the preserved accepted frontier', async () => {
  const native = JSON.parse(
    readFileSync(new URL('./fixtures/wall_nested_replay.json', import.meta.url), 'utf8')
  );
  assert.deepEqual(native.calls_after_original, [1, 2, 3]);
  assert.deepEqual(native.calls_after_partial, [1, 2, 3]);
  assert.deepEqual(native.calls_after_final, [1, 2, 3, 4]);
  assert.equal(native.partial.verified_outcomes.length, 1);
  assert.equal(native.final_record.verified_outcomes.length, 4);
  assert.equal(
    sha256(JSON.stringify(native.partial) + '\n'),
    native.final_record.resume_proof.input_checkpoint_sha256,
    'exact actual native input bytes'
  );
  const { pending, after } = wallFixture();
  const journal = {
    ...native.partial,
    connector_declarations: pending.lyric.decl,
    connector_semantic_identity: '3'.repeat(64),
  };
  const bytes = Buffer.from(JSON.stringify(journal));
  const envelope = JSON.parse(pending.lyric.checkpoint);
  Object.assign(envelope, {
    decoded_bytes: bytes.length,
    sha256: sha256(bytes),
    payload: gzipSync(bytes).toString('base64'),
  });
  pending.lyric.checkpoint = JSON.stringify(envelope);
  pending.lyric.draft = pending.lyric.replay_draft = native.partial.input_draft;
  pending.lyric.final_draft = native.partial.accepted_lines;
  const tool = after.tools[0];
  Object.assign(tool, {
    exit_code: 3,
    status: 'stopped_with_open_lines',
    certified: false,
    journal_id: journal.journal_id,
    final_draft: native.final_lines,
    final_draft_sha256: sha256(JSON.stringify(native.final_lines)),
    verified_outcomes: native.final_record.verified_outcomes,
    verified_outcomes_draft_sha256: sha256(JSON.stringify(native.final_lines)),
    resume_proof: {
      ...native.final_record.resume_proof,
      wire_checkpoint_sha256: sha256(pending.lyric.checkpoint),
    },
  });
  delete after.completion;
  delete after.artifact;
  after.lyric = {
    parked: true,
    exit_code: 3,
    draft: tool.final_draft,
    final_draft: tool.final_draft,
    decl: { ...pending.lyric.decl },
  };
  assert.equal(wallContinued(pending, after, 200, wallContext), true);
  const gap = structuredClone(after);
  gap.tools[0].verified_outcomes.splice(1, 1);
  assert.equal(
    wallContinued(pending, gap, 200, wallContext),
    false,
    'missing chain link cannot qualify'
  );
  const replayOnly = structuredClone(after);
  Object.assign(replayOnly.tools[0], {
    final_draft: native.partial.accepted_lines,
    final_draft_sha256: sha256(JSON.stringify(native.partial.accepted_lines)),
    verified_outcomes_draft_sha256: sha256(JSON.stringify(native.partial.accepted_lines)),
    verified_outcomes: native.original.verified_outcomes,
  });
  replayOnly.tools[0].resume_proof.new_proposer_dispatches = 0;
  replayOnly.lyric.draft = replayOnly.lyric.final_draft = native.partial.accepted_lines;
  assert.equal(
    wallContinued(pending, replayOnly, 200, wallContext),
    false,
    'reconstructed B/C receipts cannot turn old accepted C into new progress'
  );
});
await test('wall continuation retains the actual parked artifact and declarations', async () => {
  const { pending, after } = wallFixture();
  const tool = after.tools[0];
  tool.exit_code = 3;
  tool.status = 'stopped_with_open_lines';
  tool.certified = false;
  delete after.completion;
  delete after.artifact;
  after.lyric = {
    parked: true,
    exit_code: 3,
    draft: tool.final_draft,
    final_draft: tool.final_draft,
    decl: { ...pending.lyric.decl },
  };
  assert.equal(wallContinued(pending, after, 200, wallContext), true);
  for (const stopped of ['LYRICS_UNFINISHED', 'MAX_STEPS']) {
    after.stopped = stopped;
    assert.equal(wallContinued(pending, after, 200, wallContext), true, stopped);
  }
  for (const stopped of ['MAX_TURN_MS', 'CANCELLED', 'UNCERTAIN_PROPOSAL', 'UPSTREAM_ERROR']) {
    const bad = structuredClone(after);
    bad.stopped = stopped;
    assert.equal(wallContinued(pending, bad, 200, wallContext), false, stopped);
  }
  for (const mutate of [
    (p) => {
      delete p.lyric;
    },
    (p) => {
      p.lyric.final_draft = ['stale accepted draft'];
    },
    (p) => {
      p.lyric.draft = ['stale replay input'];
    },
    (p) => {
      p.lyric.decl.seed = 2;
    },
  ]) {
    const bad = structuredClone(after);
    mutate(bad);
    assert.equal(wallContinued(pending, bad, 200, wallContext), false);
  }
});
for (const mode of ['refused-not-run', 'missing-inventory'])
  await test(`actual wall HTTP ${mode} cannot pass the canary`, async () => {
    const { pending, after } = wallFixture(),
      seen = [],
      receipts = new Map();
    if (mode === 'refused-not-run') {
      after.tools[0].not_run = true;
      after.tools[0].exit_code = 2;
      after.tools[0].refusal = 'checkpoint cannot resume';
    } else {
      delete after.tools[0].verified_outcomes;
    }
    delete after.completion;
    delete after.artifact;
    await fixture(
      (req, res, body) => {
        if (req.url === '/health')
          return json(res, 200, {
            commit: wallBuild.commit,
            build: wallBuild,
            recovery: { durable: true, healthy: true },
          });
        if (req.method === 'GET')
          return json(res, 200, {
            state: 'completed',
            build: wallBuild,
            response: { status: 200, body: receipts.get(req.url.split('/').at(-1)) },
          });
        seen.push(body);
        const payload = seen.length === 1 ? pending : after;
        receipts.set(body.request_id, payload);
        json(res, 200, payload);
      },
      async ({ out, run }) => {
        const result = await run([
          '--expect=turn-wall',
          `--commit=${wallBuild.commit}`,
          '--require-recovery',
        ]);
        assert.equal(result.status, 1, result.stderr);
        assert.equal(seen.length, 2);
        assert.notEqual(summary(out).songs[0].wall_continuation?.verified, true);
        if (mode === 'missing-inventory') {
          assert.equal(summary(out).songs[0].exit_reason, 'repair_evidence_unavailable');
          assert.ok(
            rows(join(out, 'song0.jsonl')).some((row) =>
              row.tools?.some((tool) => tool.writer === 'kitchen')
            )
          );
        }
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
            release_id: '123:456:1:lyrics-image',
            source_sha256: 'b'.repeat(64),
            config_sha256: (health === 1 ? 'c' : 'd').repeat(64),
            assets_sha256: 'e'.repeat(64),
            asset_manifest_sha256: 'f'.repeat(64),
          },
        });
      }
      if (req.method === 'GET')
        return json(res, 200, {
          state: 'completed',
          build: {
            commit,
            release_id: '123:456:1:lyrics-image',
            source_sha256: 'b'.repeat(64),
            config_sha256: 'c'.repeat(64),
            assets_sha256: 'e'.repeat(64),
            asset_manifest_sha256: 'f'.repeat(64),
          },
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
  const oldBuild = {
    commit,
    release_id: '123:456:1:lyrics-image',
    source_sha256: 'b'.repeat(64),
    config_sha256: 'c'.repeat(64),
    assets_sha256: 'e'.repeat(64),
    asset_manifest_sha256: 'f'.repeat(64),
  };
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
for (const [name, bad] of [
  ['blank delivery', { ...finished, reply: '' }],
  [
    'earlier success followed by unfinished result',
    {
      ...finished,
      tools: [
        ...finished.tools,
        {
          name: 'lyric_revise',
          exit_code: 3,
          draft_fp: 'changed',
          final_draft_sha256: sha256('changed'),
        },
      ],
    },
  ],
  ['HTTP200 error after success', { ...finished, error: 'unfinished' }],
  [
    'changed final draft under old receipt',
    { ...finished, artifact: { ...finished.artifact, final_draft: ['different'] } },
  ],
]) {
  await test(`completion rejects ${name}`, async () => {
    await fixture(
      (_req, res) => json(res, 200, bad),
      async ({ out, run }) => {
        const result = await run(['--turns=1', '--stop-on=none']);
        assert.equal(result.status, 1, result.stderr);
        assert.notEqual(summary(out).songs[0].exit_reason, 'finished');
      }
    );
  });
}
await test('terminal checkpoint restores verdict lost before summary write without another request', async () => {
  let posts = 0;
  await fixture(
    (_req, res) => {
      posts++;
      json(res, 200, finished);
    },
    async ({ out, run }) => {
      assert.equal((await run()).status, 0);
      const value = summary(out);
      value.songs = [];
      writeFileSync(join(out, 'summary.json'), JSON.stringify(value));
      assert.equal((await run(['--resume'])).status, 0);
      assert.equal(summary(out).songs[0].completion.certified, true);
      assert.equal(posts, 1);
    }
  );
});
await test('multi-song resume restores a lost failed verdict instead of passing a sparse summary', async () => {
  let posts = 0;
  await fixture(
    (_req, res) => {
      posts++;
      json(res, posts === 1 ? 429 : 200, posts === 1 ? { error: 'quota' } : finished, {
        'retry-after': '1',
      });
    },
    async ({ out, run }) => {
      assert.equal(
        (await run(['--songs=2', '--rate-paced-max=0', '--retry-after-cap=0'])).status,
        1
      );
      const value = summary(out);
      delete value.songs[0];
      writeFileSync(join(out, 'summary.json'), JSON.stringify(value));
      assert.equal((await run(['--resume', '--songs=2'])).status, 1);
      assert.equal(summary(out).songs[0].exit_reason, 'rate_limited');
      assert.equal(summary(out).expected, false);
      assert.equal(posts, 2);
    }
  );
});
await test('a bare signed empty wall cannot satisfy the continuation canary', async () => {
  await fixture(
    (_req, res) => json(res, 200, { history: [], sig: 'fake', stopped: 'MAX_TURN_MS', tools: [] }),
    async ({ out, run }) => {
      assert.equal((await run(['--expect=turn-wall', '--turns=1'])).status, 1);
      assert.equal(summary(out).songs[0].wall_continuation, null);
    }
  );
});
await test('mandatory remote recovery refuses before any paid POST when unavailable', async () => {
  let posts = 0;
  await fixture(
    (_req, res) => {
      posts++;
      json(res, 200, finished);
    },
    async ({ run }) => {
      const result = await run(['--require-remote-recovery']);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /artifact service is unavailable/);
      assert.equal(posts, 0);
    }
  );
});
await test('verified receipt keeps complete request latency rather than the final lookup latency', async () => {
  const commit = 'a'.repeat(40);
  const build = {
    commit,
    release_id: '123:456:1:lyrics-image',
    source_sha256: 'b'.repeat(64),
    config_sha256: 'c'.repeat(64),
    assets_sha256: 'e'.repeat(64),
    asset_manifest_sha256: 'f'.repeat(64),
  };
  await fixture(
    (req, res) => {
      if (req.url === '/health')
        return json(res, 200, { commit, build, recovery: { durable: true, healthy: true } });
      if (req.method === 'GET')
        return json(res, 200, {
          state: 'completed',
          build,
          response: { status: 200, body: finished },
        });
      setTimeout(() => json(res, 200, finished), 125);
    },
    async ({ out, run }) => {
      const result = await run([`--commit=${commit}`, '--require-recovery']);
      assert.equal(result.status, 0, result.stderr);
      const row = rows(join(out, 'song0.jsonl')).find((row) => row.ms != null);
      assert.ok(row.ms >= 120, `whole request latency ${row.ms}`);
    }
  );
});
for (const shape of ['top-level', 'nested'])
  await test(`error checkpoint (${shape}) is retained and resumed without retrying the stale envelope`, async () => {
    const seen = [];
    await fixture(
      (_req, res, body) => {
        seen.push(body);
        json(
          res,
          seen.length === 1 ? 502 : 200,
          seen.length === 1
            ? {
                error: 'interrupted after work',
                ...(shape === 'top-level' ? checkpoint : { envelope: checkpoint }),
              }
            : finished
        );
      },
      async ({ out, run }) => {
        assert.equal((await run()).status, 1);
        assert.equal(seen.length, 1);
        assert.deepEqual(JSON.parse(readFileSync(join(out, 'song0.checkpoint.json'))).state.env, {
          ...checkpoint,
          receipt_id: seen[0].request_id,
        });
        assert.equal((await run(['--resume'])).status, 0);
        assert.equal(seen.length, 2);
        for (const key of ['history', 'workspace', 'lyric', 'sig'])
          assert.deepEqual(seen[1][key], checkpoint[key]);
      }
    );
  });

await test('durable continuation uses only the parent receipt, including large signed state', async () => {
  const commit = 'a'.repeat(40);
  const build = {
    commit,
    release_id: '123:456:1:lyrics-image',
    source_sha256: 'b'.repeat(64),
    config_sha256: 'c'.repeat(64),
    assets_sha256: 'e'.repeat(64),
    asset_manifest_sha256: 'f'.repeat(64),
  };
  const pending = {
    ...checkpoint,
    history: [{ role: 'model', parts: [{ text: 'x'.repeat(1_600_000) }] }],
    task: finished.task,
    tools: [{ name: 'lyric_plan', exit_code: 0 }],
    reply: 'planned',
  };
  const receipts = new Map(),
    seen = [];
  await fixture(
    (req, res, body) => {
      if (req.url === '/health')
        return json(res, 200, { commit, build, recovery: { durable: true, healthy: true } });
      if (req.method === 'GET')
        return json(res, 200, {
          state: 'completed',
          build,
          response: { status: 200, body: receipts.get(req.url.split('/').at(-1)) },
        });
      seen.push(body);
      const payload = seen.length === 1 ? pending : finished;
      receipts.set(body.request_id, payload);
      json(res, 200, payload);
    },
    async ({ run }) => {
      const result = await run([`--commit=${commit}`, '--require-recovery']);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(seen.length, 2);
      assert.equal(seen[0].task.domain, 'lyrics');
      assert.equal(seen[1].continuation_id, seen[0].request_id);
      assert.deepEqual(Object.keys(seen[1]).sort(), ['continuation_id', 'message', 'request_id']);
    }
  );
});

await test('stale continuation follows the existing successor without another paid branch', async () => {
  const commit = 'a'.repeat(40),
    successor = 'd'.repeat(64);
  const build = {
    commit,
    release_id: '123:456:1:lyrics-image',
    source_sha256: 'b'.repeat(64),
    config_sha256: 'c'.repeat(64),
    assets_sha256: 'e'.repeat(64),
    asset_manifest_sha256: 'f'.repeat(64),
  };
  const seen = [];
  await fixture(
    (req, res, body) => {
      if (req.url === '/health')
        return json(res, 200, { commit, build, recovery: { durable: true, healthy: true } });
      if (req.method === 'GET')
        return json(res, 200, {
          state: 'completed',
          build,
          response: {
            status: 200,
            body: req.url.endsWith(successor)
              ? finished
              : { ...checkpoint, tools: [{ name: 'lyric_plan', exit_code: 0 }], reply: 'planned' },
          },
        });
      seen.push(body);
      if (seen.length === 1)
        return json(res, 200, {
          ...checkpoint,
          tools: [{ name: 'lyric_plan', exit_code: 0 }],
          reply: 'planned',
        });
      json(res, 409, { code: 'STALE_CONTINUATION', successor_id: successor });
    },
    async ({ run, out }) => {
      const result = await run([`--commit=${commit}`, '--require-recovery']);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(seen.length, 2);
      assert.equal(seen[1].continuation_id, seen[0].request_id);
      const journal = rows(join(out, 'song0.attempts.jsonl'));
      assert(
        journal.some(
          (row) => row.event === 'continuation_successor' && row.successor_id === successor
        )
      );
      assert.equal(
        journal.filter((row) => row.event === 'response_received').at(-1).response.request_id,
        successor
      );
    }
  );
});

console.log(`${checked} battery lifecycle checks passed`);
