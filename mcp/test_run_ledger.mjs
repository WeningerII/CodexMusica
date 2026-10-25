// test_run_ledger.mjs — a stale continuation is refused before any work
// starts, even after the run record is gone (BB8, #519 6391205136).
//
// The run record (RunStore) is a cache: a clean finish deletes it and a
// restart loses it. A /chat client holding an older signed envelope could
// then send it with a fresh request_id and the tool, with nothing to compare,
// forked the run and the website writer was paid again for prompts the run
// had already answered. The ledger keeps each run's revision and a finished
// flag past the record. Here, with the interview writer (no provider):
//   - lines still open, record lost (a restart): the older revision is
//     refused by name, the latest still continues;
//   - run finished: any revision of it is refused, new_run still works;
//   - the ledger file survives a new store, and a revision never restarts
//     at 1 after the record is lost.
//
// Usage: node mcp/test_run_ledger.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { RUNS } from './lyric_tools.js';
import { RunLedger, RunStore } from './run_store.js';

const server = buildServer({ task: { domain: 'lyrics' } });
const client = new Client({ name: 'run-ledger', version: '1' }, { capabilities: {} });
const [a, b] = InMemoryTransport.createLinkedPair();
await Promise.all([client.connect(a), server.connect(b)]);
const call = (args) =>
  client.callTool({ name: 'lyric_revise', arguments: args }, undefined, { timeout: 120000 });
const verdict = (result) => {
  for (const block of result.content || []) {
    try {
      const v = JSON.parse(block.text);
      if (typeof v.exit_code === 'number') return v;
    } catch {}
  }
  throw Error(
    (result.content || [])
      .map((c) => c.text)
      .join('\n')
      .slice(0, 1500)
  );
};
const text = (result) => (result.content || []).map((c) => c.text).join('\n');
const start = () =>
  call({
    scheme: 'AA',
    relation: 'type:rime riche',
    draft: ['Copper cat', 'Azure dog'],
    writer: 'interview',
    max_rounds: 1,
    backtrack: 0,
  });

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL  ${name}\n        ${String(err.message).split('\n')[0]}`);
  }
};

try {
  // ── Lines open, record lost ────────────────────────────────────────────
  const r1 = verdict(await start());
  assert.equal(r1.exit_code, 4);
  assert.equal(r1.run_revision, 1);
  const r2 = verdict(await call({ run_id: r1.run_id, run_revision: 1, answer: 'I hold you.' }));
  assert.equal(r2.run_revision, 2, `the answered run is at revision 2 (exit ${r2.exit_code})`);
  RUNS.del(r1.run_id); // what a restart, an eviction or the TTL does to the record
  const staleOpen = await call({
    run_id: r1.run_id,
    run_revision: 1,
    state: r1.state,
    answer: 'I hold you.',
  });
  check('record lost, lines open: revision 1 is refused as stale before any work', () => {
    assert.equal(staleOpen.isError, true, text(staleOpen).slice(0, 300));
    assert.match(text(staleOpen), /stale run revision 1; current revision is 2\. Nothing was run/);
  });
  check('and the refusal left the ledger where it was', () =>
    assert.deepEqual(RUNS.mark(r1.run_id), { revision: 2, finished: false })
  );
  // The run stopped at exit 3 with open lines: its latest revision (state
  // and the original replay draft) still continues with the record lost.
  const latest = await call({
    run_id: r1.run_id,
    run_revision: 2,
    state: r2.state,
    scheme: 'AA',
    relation: 'type:rime riche',
    writer: 'interview',
    max_rounds: 1,
    backtrack: 0,
    draft: ['Copper cat', 'Azure dog'],
  });
  check('the latest revision still continues, and its revision goes on from the ledger', () => {
    assert.doesNotMatch(text(latest), /stale run revision|already finished/);
    const v = verdict(latest);
    if (v.run_revision != null) assert.equal(v.run_revision, 3);
  });

  // ── Run finished ──────────────────────────────────────────────────────
  const f1 = verdict(await start());
  verdict(await call({ run_id: f1.run_id, run_revision: 1, answer: 'I hold you.' }));
  RUNS.finish(f1.run_id); // the clean-finish path (exit 0)
  const staleDone = await call({
    run_id: f1.run_id,
    run_revision: 1,
    state: f1.state,
    answer: 'I hold you.',
  });
  check('a finished run refuses an older revision before any work', () => {
    assert.equal(staleDone.isError, true, text(staleDone).slice(0, 300));
    assert.match(text(staleDone), /already finished at revision 2; nothing was run/);
  });
  const latestDone = await call({ run_id: f1.run_id, run_revision: 2, state: f1.state });
  check('and its latest revision too: a finished run does not fork', () => {
    assert.equal(latestDone.isError, true);
    assert.match(text(latestDone), /already finished.*new_run: true/);
  });
  const fresh = await call({
    new_run: true,
    scheme: 'AA',
    relation: 'type:rime riche',
    draft: ['Copper cat', 'Azure dog'],
    writer: 'interview',
    max_rounds: 1,
    backtrack: 0,
  });
  check('new_run is still an explicit, separate run', () => {
    assert.notEqual(fresh.isError, true, text(fresh).slice(0, 300));
    assert.notEqual(verdict(fresh).run_id, f1.run_id);
  });

  // ── The ledger file ──────────────────────────────────────────────────
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'run-ledger-'));
  const file = path.join(dir, 'run-ledger.json');
  try {
    const before = new RunStore({ ledger: new RunLedger(file) });
    const rec = before.put('k', { run_id: 'run_x' });
    before.put('k', { run_id: 'run_x' });
    const restarted = new RunStore({ ledger: new RunLedger(file) });
    check('a new store (a restart) reads the revision back from disk', () =>
      assert.deepEqual(restarted.mark('run_x'), { revision: 2, finished: false })
    );
    check('a put after the restart continues the revision, never back to 1', () =>
      assert.equal(restarted.put('k', { run_id: rec.run_id }).revision, 3)
    );
    restarted.finish('run_x');
    check('a finish is durable too', () =>
      assert.deepEqual(new RunStore({ ledger: new RunLedger(file) }).mark('run_x'), {
        revision: 3,
        finished: true,
      })
    );
    check('the file holds digests, not run ids', () =>
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /run_x/)
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
} finally {
  await client.close();
}

if (failures) {
  console.error(`${failures} run-ledger check(s) failed`);
  process.exit(1);
}
console.log('all run-ledger checks pass');
process.exit(0);
