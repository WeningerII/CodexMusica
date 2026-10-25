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
//   - the same with no run_id: a moved-past state is refused, the latest
//     continues once, recover_only still reads the old one;
//   - the crash window (advanced, result never delivered): refused with the
//     way out named, and recover_only reads the held revision;
//   - an unreadable or unsavable ledger refuses every continuation (fails
//     closed); a kill's leftover temp file is swept;
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
import { LEDGER_CAP, RunLedger, RunStore } from './run_store.js';

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

  // ── Record lost, no state to send (BB8 N1) ─────────────────────────────
  // A run that stopped with open lines and carried no checkpoint leaves its
  // client with run_id, run_revision and the song: the kitchen drops state.
  // After a restart or the TTL the record is gone, and "pass `state` back"
  // was the only way on — one a /chat user cannot take. The ledger knows the
  // run, so the rewritten draft continues it, as a parked run is continued.
  const n1 = verdict(await start());
  const n2 = verdict(await call({ run_id: n1.run_id, run_revision: 1, answer: 'I hold you.' }));
  RUNS.del(n1.run_id);
  const rewritten = ['Copper cat', 'Azure cat'];
  const onward = await call({
    run_id: n1.run_id,
    run_revision: n2.run_revision,
    draft: rewritten,
    scheme: 'AA',
    relation: 'type:rime riche',
    writer: 'interview',
    max_rounds: 1,
    backtrack: 0,
  });
  check('record lost, no state: run_id + run_revision + a draft continues the run', () => {
    assert.doesNotMatch(text(onward), /names no run this tool remembers|pass `state` back/);
    const v = verdict(onward);
    assert.equal(v.run_id, n1.run_id, 'the same run');
    assert.equal(v.run_revision, n2.run_revision + 1, 'its revision goes on from the ledger');
  });
  const n1Stale = await call({
    run_id: n1.run_id,
    run_revision: n2.run_revision,
    draft: rewritten,
  });
  check('...and the revision it moved past is refused as stale (the record is back)', () => {
    assert.equal(n1Stale.isError, true, text(n1Stale).slice(0, 300));
    assert.match(text(n1Stale), /stale run revision \d+; current revision is \d+/);
  });
  RUNS.del(n1.run_id);
  const n1StaleLedger = await call({
    run_id: n1.run_id,
    run_revision: n2.run_revision,
    draft: rewritten,
  });
  check('...and with the record lost again, the ledger refuses it as stale', () => {
    assert.equal(n1StaleLedger.isError, true, text(n1StaleLedger).slice(0, 300));
    assert.match(
      text(n1StaleLedger),
      /stale run revision \d+; current revision is \d+\. Nothing was run/
    );
  });
  RUNS.del(n1.run_id);
  const noDraft = await call({ run_id: n1.run_id, run_revision: n2.run_revision + 1 });
  check('with neither state nor draft, the refusal names the call that works', () => {
    assert.equal(noDraft.isError, true, text(noDraft).slice(0, 300));
    assert.match(text(noDraft), /run_revision.*draft_text/);
    assert.doesNotMatch(text(noDraft), /pass `state` back/);
  });

  // ── The same, with no run_id (Jony's review) ─────────────────────────
  // A stale state alone used to run as a new run: the C1 shape on any path
  // that carries the state without the capability (the /chat checkpoint
  // recovery carries none).
  const s1 = verdict(await start());
  const s2 = verdict(await call({ run_id: s1.run_id, run_revision: 1, answer: 'I hold you.' }));
  RUNS.del(s1.run_id);
  const staleBare = await call({ state: s1.state, answer: 'I hold you.' });
  check('record lost: a moved-past state with no run_id is refused before any work', () => {
    assert.equal(staleBare.isError, true, text(staleBare).slice(0, 300));
    assert.match(text(staleBare), /already continued.*Nothing was run.*recover_only/);
  });
  const latestBare = await call({ state: s2.state, draft: ['Copper cat', 'Azure dog'] });
  check('the latest state with no run_id still continues', () =>
    assert.doesNotMatch(text(latestBare), /already continued|stale run revision/)
  );
  const againBare = await call({ state: s2.state, draft: ['Copper cat', 'Azure dog'] });
  check('and once it has been continued, sending it again is refused', () => {
    assert.equal(againBare.isError, true, text(againBare).slice(0, 300));
    assert.match(text(againBare), /already continued/);
  });
  const respaced = JSON.stringify(JSON.parse(s1.state), null, 1);
  const staleRespaced = await call({ state: respaced, answer: 'I hold you.' });
  check('a re-spaced copy of a moved-past state is the same state, refused (BB8 R2)', () => {
    assert.equal(staleRespaced.isError, true, text(staleRespaced).slice(0, 300));
    assert.match(text(staleRespaced), /already continued/);
  });
  const recovered = await call({ state: s1.state, recover_only: true });
  check('recover_only still reads a moved-past state', () =>
    assert.notEqual(recovered.isError, true, text(recovered).slice(0, 300))
  );

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

  // ── The crash window (Jony, 3PO) ──────────────────────────────────────
  // The run advanced (put) but its result never reached the caller, who
  // still holds revision 1. That cannot be told apart from a stale replay,
  // so it is refused, and the refusal names the way out: recover_only reads
  // the accepted lyrics from what the caller holds, new_run goes on.
  const w1 = verdict(await start());
  verdict(await call({ run_id: w1.run_id, run_revision: 1, answer: 'I hold you.' })); // "lost"
  RUNS.del(w1.run_id);
  const resumed = await call({
    run_id: w1.run_id,
    run_revision: 1,
    state: w1.state,
    answer: 'I hold you.',
  });
  check(
    'crash window: the undelivered revision is refused, naming recover_only and new_run',
    () => {
      assert.equal(resumed.isError, true);
      assert.match(text(resumed), /never reached you.*recover_only.*new_run: true/);
    }
  );
  const fromHeld = await call({ state: w1.state, recover_only: true });
  check('crash window: recover_only reads the accepted lyrics from the held revision', () => {
    assert.notEqual(fromHeld.isError, true, text(fromHeld).slice(0, 300));
    assert.match(text(fromHeld), /Copper cat/);
  });

  // ── Fails closed (3PO, BB8 N3) ────────────────────────────────────────
  const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'run-ledger-bad-'));
  const healthyLedger = RUNS.ledger;
  try {
    fs.writeFileSync(path.join(bad, 'run-ledger.json'), '{not json');
    fs.writeFileSync(path.join(bad, 'run-ledger.json.abc123.tmp'), 'orphan');
    const corrupt = new RunLedger(path.join(bad, 'run-ledger.json'), { log: () => {} });
    check('an unreadable ledger file marks the ledger unhealthy', () =>
      assert.equal(corrupt.healthy, false)
    );
    check('and a temp file a kill left behind is swept on load', () =>
      assert.equal(fs.existsSync(path.join(bad, 'run-ledger.json.abc123.tmp')), false)
    );
    RUNS.ledger = corrupt;
    const g1 = verdict(await start()); // a fresh run is unaffected
    const closed = await call({ run_id: g1.run_id, run_revision: 1, answer: 'I hold you.' });
    check('while unhealthy, a continuation is refused before any work', () => {
      assert.equal(closed.isError, true, text(closed).slice(0, 300));
      assert.match(text(closed), /RUN_LEDGER_UNAVAILABLE.*Nothing was run/);
    });
    const closedBare = await call({ state: g1.state, answer: 'I hold you.' });
    check('and so is a state with no run_id', () =>
      assert.match(text(closedBare), /RUN_LEDGER_UNAVAILABLE/)
    );
    corrupt.mark('run_new_song', 1);
    check('a file that failed to load is never written over (BB8 R1)', () =>
      assert.equal(fs.readFileSync(path.join(bad, 'run-ledger.json'), 'utf8'), '{not json')
    );
    check('so a restart still finds it unreadable, and still refuses', () =>
      assert.equal(
        new RunLedger(path.join(bad, 'run-ledger.json'), { log: () => {} }).healthy,
        false
      )
    );
    // 3PO (#519 6395131994): recovery by a durable write must not reach a
    // file that failed to load. Restarted on the same bad bytes, the fresh
    // run's continuation is still refused, and checking it writes nothing.
    const restarted = new RunLedger(path.join(bad, 'run-ledger.json'), { log: () => {} });
    RUNS.ledger = restarted;
    const replay = await call({ run_id: g1.run_id, run_revision: 1, answer: 'I hold you.' });
    check('restarted on an unreadable file, a replay is still refused (BB8 A2)', () => {
      assert.equal(replay.isError, true, text(replay).slice(0, 300));
      assert.match(text(replay), /RUN_LEDGER_UNAVAILABLE/);
      assert.equal(restarted.recover(), false);
      assert.equal(restarted.healthy, false);
    });
    check('and the original bad bytes are untouched', () =>
      assert.equal(fs.readFileSync(path.join(bad, 'run-ledger.json'), 'utf8'), '{not json')
    );
    const unsaved = new RunLedger(path.join(bad, 'run-ledger.json', 'not-a-dir', 'x.json'), {
      log: () => {},
    });
    unsaved.mark('run_y', 1);
    check('a save that fails marks the ledger unhealthy too', () =>
      assert.equal(unsaved.healthy, false)
    );
  } finally {
    RUNS.ledger = healthyLedger;
    fs.rmSync(bad, { recursive: true, force: true });
  }

  // ── A failed write recovers by a durable write (BB8 A2, #519) ──────────
  // One save fails (a full disk for a moment): the ledger is unhealthy. The
  // next check retries a durable save of the in-memory ledger, which now
  // succeeds, so the ledger is healthy again and still knows the revision
  // the failed save was for: a stale revision is refused as stale, before
  // and after a restart, not waved through and not refused wholesale.
  const flaky = fs.mkdtempSync(path.join(os.tmpdir(), 'run-ledger-flaky-'));
  const ledgerFile = path.join(flaky, 'run-ledger.json');
  try {
    RUNS.ledger = new RunLedger(ledgerFile, { log: () => {} });
    const f1 = verdict(await start());
    const realOpen = fs.openSync;
    let failNext = true;
    fs.openSync = (file, ...rest) => {
      if (failNext && String(file).startsWith(ledgerFile + '.')) {
        failNext = false;
        throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
      }
      return realOpen(file, ...rest);
    };
    let f2;
    try {
      f2 = verdict(await call({ run_id: f1.run_id, run_revision: 1, answer: 'I hold you.' }));
    } finally {
      fs.openSync = realOpen;
    }
    check('a save that fails once leaves the ledger unhealthy', () => {
      assert.equal(failNext, false, 'the injected failure was hit');
      assert.equal(RUNS.ledger.healthy, false);
      assert.equal(f2.run_revision, 2);
    });
    RUNS.del(f1.run_id); // the record is lost too: only the ledger can judge
    const stale = await call({
      run_id: f1.run_id,
      run_revision: 1,
      state: f1.state,
      answer: 'I hold you.',
    });
    check('meanwhile the stale revision is refused as stale (the ledger kept it in memory)', () =>
      assert.match(text(stale), /stale run revision 1; current revision is 2\. Nothing was run/)
    );
    // The latest revision, exactly as the record-lost case above continues it.
    const onwardAfterFailure = await call({
      run_id: f1.run_id,
      run_revision: 2,
      state: f2.state,
      scheme: 'AA',
      relation: 'type:rime riche',
      writer: 'interview',
      max_rounds: 1,
      backtrack: 0,
      draft: ['Copper cat', 'Azure dog'],
    });
    check('the latest revision continues: the check saved durably and recovered', () => {
      assert.doesNotMatch(
        text(onwardAfterFailure),
        /RUN_LEDGER_UNAVAILABLE|stale run revision|already finished/
      );
      assert.equal(RUNS.ledger.healthy, true);
    });
    check('the recovered file holds the revision the failed save was for, and no temp file', () => {
      assert.ok(new RunLedger(ledgerFile, { log: () => {} }).get(f1.run_id).revision >= 2);
      assert.deepEqual(
        fs.readdirSync(flaky).filter((n) => n.endsWith('.tmp')),
        []
      );
    });
    RUNS.ledger = new RunLedger(ledgerFile, { log: () => {} }); // a restart
    RUNS.del(f1.run_id);
    const staleAfter = await call({
      run_id: f1.run_id,
      run_revision: 1,
      state: f1.state,
      answer: 'I hold you.',
    });
    check('after a restart the stale revision is still refused as stale', () =>
      assert.match(text(staleAfter), /stale run revision 1; current revision is [2-9]/)
    );
  } finally {
    RUNS.ledger = healthyLedger;
    fs.rmSync(flaky, { recursive: true, force: true });
  }

  // ── Paid runs apart (BB8 R3) ──────────────────────────────────────────
  // Free calls cannot push a paid (website writer) run's wires out of the
  // cap, and paid entries do not age out.
  {
    let clock = 0;
    const ledger = new RunLedger(null, { now: () => clock });
    ledger.mark('run_paid', 2, false, ['paid-wire'], { paid: true });
    for (let i = 0; i < LEDGER_CAP + 10; i++) ledger.mark(`run_free_${i}`, 1, false, [`w${i}`]);
    clock += 40 * 24 * 60 * 60 * 1000; // past the 30-day retention
    ledger.mark('run_free_late', 1, false, ['late']);
    check('a paid wire survives a flood of free ones and the 30-day retention', () => {
      assert.equal(ledger.isUsed(['paid-wire']), true);
      assert.deepEqual(ledger.get('run_paid'), { revision: 2, finished: false });
    });
    ledger.mark('run_both', 1, false, [], { paid: true });
    ledger.mark('run_both', 3, false, []);
    check('a run in both partitions reads its larger revision (BB8 N4)', () =>
      assert.deepEqual(ledger.get('run_both'), { revision: 3, finished: false })
    );
    check('while the free entries stay within their own cap and age', () =>
      assert.ok(ledger.used.size <= LEDGER_CAP && !ledger.isUsed(['w0']))
    );
  }

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
