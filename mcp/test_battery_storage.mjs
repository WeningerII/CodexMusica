// Real battery CLI + actual journals/archive, accelerated localhost polling.
// No Gemini calls, production endpoints or real secrets are used.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sealArchive, openArchive } from '../scripts/battery_archive.mjs';

const cli = fileURLToPath(new URL('../scripts/flash_battery.mjs', import.meta.url));
const MIB = 1024 * 1024;
const json = (res, status, value) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
};
const readJSON = (file) => JSON.parse(readFileSync(file, 'utf8'));
function attemptRows(out) {
  const paths = [
    'song0.attempts.jsonl',
    ...readdirSync(out)
      .filter((name) => /^song0\.attempts\.\d{6}\.jsonl$/.test(name))
      .sort(),
  ];
  return paths
    .filter((name) => existsSync(join(out, name)))
    .flatMap((name) =>
      readFileSync(join(out, name), 'utf8').split('\n').filter(Boolean).map(JSON.parse)
    );
}
async function fixture(handler, fn) {
  const root = mkdtempSync(join(tmpdir(), 'battery-storage-'));
  const out = join(root, 'records');
  mkdirSync(out, { mode: 0o700 });
  const server = createServer((req, res) => {
    let text = '';
    req.on('data', (chunk) => {
      text += chunk;
    });
    req.on('end', () => handler(req, res, text ? JSON.parse(text) : null, out));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const run = (extra = []) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        cli,
        `--out=${out}`,
        `--base=${base}`,
        '--songs=1',
        '--turns=2',
        '--pace=0',
        '--reask=0',
        '--delivery-reserve=0',
        '--max-runtime=30',
        ...extra,
      ]);
      let stdout = '',
        stderr = '';
      child.stdout.on('data', (part) => {
        stdout += part;
      });
      child.stderr.on('data', (part) => {
        stderr += part;
      });
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('battery storage fixture exceeded its local test wall'));
      }, 25_000);
      child.on('error', reject);
      child.on('close', (status, signal) => {
        clearTimeout(timeout);
        resolve({ status, signal, stdout, stderr });
      });
    });
  try {
    await fn({ root, out, run });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(root, { recursive: true, force: true });
  }
}

const checkpoint = {
  history: [{ role: 'model', parts: [{ text: 'retained lyric history '.repeat(3300) }] }],
  workspace: null,
  lyric: { draft: ['The retained lyric'], replay_draft: ['The original lyric'] },
  sig: 'a'.repeat(64),
};
const finished = {
  reply: 'finished',
  history: checkpoint.history,
  workspace: null,
  lyric: checkpoint.lyric,
  sig: checkpoint.sig,
  tools: [{ name: 'lyric_revise', exit_code: 0 }],
};

test('480 identical recovery polls retain a full checkpoint without inflating the journal beyond archive limits', async () => {
  let posts = 0,
    polls = 0,
    requestId,
    intentBeforeDispatch = false;
  await fixture(
    (req, res, body, out) => {
      if (req.method === 'POST') {
        posts++;
        requestId = body.request_id;
        intentBeforeDispatch = attemptRows(out).some(
          (row) => row.event === 'request_started' && row.request_id === requestId
        );
        return json(res, 202, { request_id: requestId, state: 'pending' });
      }
      polls++;
      const complete = polls > 480;
      return json(res, 200, {
        request_id: requestId,
        state: complete ? 'completed' : 'pending',
        checkpoint,
        progress: { status: 'accepted', accepted_lines: ['The retained lyric'] },
        build: { commit: 'fixture' },
        response: complete ? { status: 200, body: finished } : null,
      });
    },
    async ({ root, out, run }) => {
      const result = await run(['--poll-ms=10', '--turn-deadline-ms=10000']);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.equal(posts, 1);
      assert.equal(polls, 481);
      assert.equal(intentBeforeDispatch, true);
      assert.equal(readJSON(join(out, 'summary.json')).songs[0].exit_reason, 'finished');
      const events = attemptRows(out);
      assert.equal(events.filter((row) => row.event === 'recovery_observed').length, 2);
      assert.ok(
        events.some((row) => row.event === 'request_started' && row.request_id === requestId)
      );
      const journalBytes = readdirSync(out)
        .filter((name) => name.includes('.attempts.'))
        .reduce((sum, name) => sum + statSync(join(out, name)).size, 0);
      assert.ok(journalBytes < MIB, `unchanged polling journal used ${journalBytes} bytes`);
      const latest = readJSON(join(out, 'song0.recovery.json'));
      assert.ok(JSON.stringify(latest).includes(checkpoint.history[0].parts[0].text));
      assert.ok(JSON.stringify(latest).includes(requestId));
      const archive = join(root, 'recovery.enc'),
        restored = join(root, 'restored');
      const key = randomBytes(32).toString('hex');
      sealArchive({ source: out, out: archive, key });
      openArchive({ archive, out: restored, key });
      assert.deepEqual(readJSON(join(restored, 'song0.recovery.json')), latest);
      assert.ok(
        attemptRows(restored).some(
          (row) => row.event === 'request_started' && row.request_id === requestId
        )
      );
    }
  );
});

test('recording capacity stops before POST and leaves a sealed resumable checkpoint', async () => {
  let posts = 0;
  await fixture(
    (req, res) => {
      if (req.method === 'POST') posts++;
      json(res, 200, finished);
    },
    async ({ root, out, run }) => {
      writeFileSync(join(out, 'existing-records-a.txt'), Buffer.alloc(9 * MIB, 0x20), {
        mode: 0o600,
      });
      writeFileSync(join(out, 'existing-records-b.txt'), Buffer.alloc(8 * MIB, 0x20), {
        mode: 0o600,
      });
      const result = await run(['--turn-deadline-ms=10000', `--recording-limit-bytes=${80 * MIB}`]);
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.equal(posts, 0, 'no paid request may be sent without recording headroom');
      assert.equal(readJSON(join(out, 'summary.json')).songs[0].exit_reason, 'storage_budget');
      assert.equal(readJSON(join(out, 'song0.checkpoint.json')).terminal, false);
      assert.equal(attemptRows(out).filter((row) => row.event === 'request_dispatched').length, 0);
      const archive = join(root, 'recovery.enc'),
        restored = join(root, 'restored');
      const key = randomBytes(32).toString('hex');
      sealArchive({ source: out, out: archive, key });
      openArchive({ archive, out: restored, key });
      assert.deepEqual(
        readJSON(join(restored, 'song0.checkpoint.json')),
        readJSON(join(out, 'song0.checkpoint.json'))
      );
    }
  );
});

test('per-file recording headroom stops before a permitted archive file can overflow', async () => {
  let posts = 0;
  await fixture(
    (req, res) => {
      if (req.method === 'POST') posts++;
      json(res, 200, finished);
    },
    async ({ root, out, run }) => {
      writeFileSync(join(out, 'prior-transcript.txt'), Buffer.alloc(25 * MIB, 0x20), {
        mode: 0o600,
      });
      const result = await run(['--turn-deadline-ms=10000']);
      assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
      assert.equal(posts, 0);
      assert.equal(readJSON(join(out, 'summary.json')).songs[0].exit_reason, 'storage_budget');
      assert.equal(readJSON(join(out, 'song0.checkpoint.json')).terminal, false);
      const archive = join(root, 'recovery.enc'),
        key = randomBytes(32).toString('hex');
      sealArchive({ source: out, out: archive, key });
      assert.ok(statSync(archive).size > 0);
    }
  );
});

test('resume refuses a missing historical journal segment before any new POST', async () => {
  let posts = 0;
  await fixture(
    (req, res) => {
      if (req.method === 'POST') posts++;
      json(res, 200, { ...finished, tools: [], stopped: 'MAX_TURN_MS' });
    },
    async ({ out, run }) => {
      const first = await run(['--turn-deadline-ms=10000', '--expect=turn-wall']);
      assert.equal(first.status, 0, `${first.stdout}\n${first.stderr}`);
      assert.equal(posts, 1);
      assert.equal(readJSON(join(out, 'song0.checkpoint.json')).terminal, false);
      writeFileSync(
        join(out, 'song0.attempts.000002.jsonl'),
        JSON.stringify({ event: 'fixture_after_missing_segment' }) + '\n',
        { mode: 0o600 }
      );
      const resumed = await run(['--turn-deadline-ms=10000', '--expect=turn-wall', '--resume']);
      assert.equal(resumed.status, 1);
      assert.match(resumed.stderr, /segment|contiguous/);
      assert.equal(posts, 1, 'missing history cannot authorize another request');
    }
  );
});

test('rolled attempt segments replay a durable response after a lagging checkpoint without repeating POST', async () => {
  let posts = 0,
    checkpointBeforeSecondResponse;
  const response = {
    reply: 'R'.repeat(3 * MIB),
    history: [],
    workspace: null,
    sig: 'b'.repeat(64),
    tools: [{ name: 'lyric_plan', exit_code: 0 }],
    stopped: 'MAX_STEPS',
  };
  await fixture(
    (req, res, _body, out) => {
      if (req.method === 'POST') {
        posts++;
        if (posts === 2)
          checkpointBeforeSecondResponse = readFileSync(join(out, 'song0.checkpoint.json'));
      }
      json(res, 200, response);
    },
    async ({ root, out, run }) => {
      const first = await run(['--turn-deadline-ms=10000']);
      assert.equal(first.status, 1, first.stderr); // two unfinished fixture turns
      assert.equal(posts, 2);
      assert.equal(readJSON(join(out, 'summary.json')).songs[0].exit_reason, 'no_stop');
      const segments = readdirSync(out).filter((name) =>
        /^song0\.attempts(?:\.\d{6})?\.jsonl$/.test(name)
      );
      assert.ok(segments.length > 1, 'actual attempt journal must roll at its 8 MiB threshold');
      for (const name of segments) assert.ok(statSync(join(out, name)).size <= 8 * MIB);
      assert.equal(attemptRows(out).filter((row) => row.event === 'request_dispatched').length, 2);
      // This is the crash window after a response receipt was fsynced but before
      // the song checkpoint advanced. Restore that genuine prior checkpoint.
      assert.equal(JSON.parse(checkpointBeforeSecondResponse).next_turn, 1);
      writeFileSync(join(out, 'song0.checkpoint.json'), checkpointBeforeSecondResponse);
      const resumed = await run(['--turn-deadline-ms=10000', '--resume']);
      assert.equal(resumed.status, 1, resumed.stderr);
      assert.equal(posts, 2, 'the recorded second response must replay from its later segment');
      assert.equal(readJSON(join(out, 'song0.checkpoint.json')).next_turn, 2);
      assert.equal(attemptRows(out).filter((row) => row.event === 'request_dispatched').length, 2);
      sealArchive({
        source: out,
        out: join(root, 'recovery.enc'),
        key: randomBytes(32).toString('hex'),
      });
    }
  );
});
