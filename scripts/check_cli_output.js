#!/usr/bin/env node
// Gate: a CLI writes the SAME bytes to a pipe as it does to a file.
//
// @covers: cli-output-complete
//
// WHY THIS EXISTS
//
// Node writes to a regular file synchronously and to a PIPE asynchronously.
// console.log queues; process.exit() tears the process down at once and drops
// whatever is still queued. A script that ends `console.log(...); …;
// process.exit(0)` therefore emits its full output when you run it, when you
// redirect it to a file, and when you watch it in a terminal — and truncates
// the moment someone pipes it.
//
// scripts/list.js did this on all 26 of its exit paths. `list.js --traditions |
// wc -l` answered 989 for a catalog of 2503, exit 0. It surfaced only because
// eval_capabilities S11 asserts ">= 1000 entries" and started flapping.
//
// THE PART THAT MAKES THIS GATE NON-VACUOUS
//
// The first version of this file just piped each command three times and
// compared byte counts. It PASSED with the defect reinjected — measured, not
// assumed. The bug is a race: it fires when the reader lags behind the writer,
// which is why it showed up while a heavy background job was running and hid
// once the machine went quiet. A gate that only pipes eagerly reproduces the
// quiet case and proves nothing.
//
// So the probe forces the condition instead of hoping for it. It spawns the
// command with stdout on a pipe and then does not read that pipe at all. With
// no reader, the OS pipe buffer (64KB) fills and the writer's remaining output
// backs up inside libuv. Two things can happen next, and they are exactly the
// two states worth distinguishing:
//
//   • the child calls process.exit() → it dies at once, its queued bytes are
//     discarded, and it EXITS WHILE WE ARE STILL NOT READING. We then drain and
//     get a truncated answer.
//   • the child does not → it stays blocked on the full pipe, alive, until the
//     hold expires and we start draining, at which point it finishes normally.
//
// "Was the child still alive when we started draining?" is therefore a direct
// witness, not an inference from sizes — and for any command whose output
// exceeds the pipe buffer it CANNOT be satisfied by accident: a child that has
// exited before anyone read a byte, having supposedly written more than the
// buffer holds, has by definition thrown some away. That witness is asserted
// for every case above PIPE_CERTAIN, and it is what fails when the defect
// returns. Verified both ways against a reinjected process.exit.
//
// Byte-for-byte equality against a file-redirected reference run is checked on
// every case regardless, since file writes never truncate.
'use strict';
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);

// How long to hold the pipe unread. Must comfortably exceed the time these
// scripts take to load the catalog and start writing — a hold that expires
// before the first byte is written would drain early and probe nothing. The
// catalog load is ~0.6s; 2.5s leaves margin on a loaded CI runner. Only paid by
// cases that reach the strict probe.
const HOLD_MS = 2500;
// Above this, a child that has exited before we read anything MUST have dropped
// output, whatever the platform's pipe capacity is (64KB on Linux and macOS).
// Comfortably clear of it so the witness never misfires on a small answer.
const PIPE_CERTAIN = 128 * 1024;

// Each case: argv after `node`, and the exit code it must end with.
const CASES = [
  // ── list.js: every mode. This is where the bug was found, and per-mode sizes
  // span 5KB to 4MB, so the modes differ in whether they can even reach the
  // failure. All are here so none can regress alone.
  ['scripts/list.js --traditions', 0],
  ['scripts/list.js --traditions --json', 0],
  ['scripts/list.js --traditions --ids', 0],
  ['scripts/list.js --instruments', 0],
  ['scripts/list.js --instruments --json', 0],
  ['scripts/list.js --instruments --ids', 0],
  ['scripts/list.js --variants --instrument=kithara', 0],
  ['scripts/list.js --variants --instrument=kithara --json', 0],
  ['scripts/list.js --rooms', 0],
  ['scripts/list.js --rooms --json', 0],
  ['scripts/list.js --archetypes', 0],
  ['scripts/list.js --aesthetics', 0],
  ['scripts/list.js --tunings', 0],
  ['scripts/list.js --tree', 0],
  ['scripts/list.js --axes', 0],
  ['scripts/list.js --inst-axes', 0],
  ['scripts/list.js --section mic', 0],
  // ...and its failure paths, which now run through process.exitCode instead of
  // process.exit and would otherwise be untested.
  ['scripts/list.js', 2],
  ['scripts/list.js --section=__nope__', 2],
  ['scripts/list.js --variants', 2],
  ['scripts/list.js --variants --instrument=__nope__', 2],

  // ── audit_coherence.js: --full emits 65KB, one kilobyte past the pipe buffer,
  // and lost 6–26KB per run before the fix. --strict pins the nonzero exit code
  // through the same rewrite.
  ['scripts/audit_coherence.js', 0],
  ['scripts/audit_coherence.js --full', 0],
  ['scripts/audit_coherence.js --json', 0],
  ['scripts/audit_coherence.js --strict --full', 1],

  // ── the other read-only CLIs, at their heaviest documented invocation. These
  // pass today because they either don't call process.exit after writing or
  // don't reach the buffer. Both are properties that change quietly — expand.js
  // already emits 1.5MB — so they are pinned rather than assumed.
  ['scripts/expand.js --tradition afrobeat', 0],
  ['scripts/expand.js --instrument kithara', 0],
  ['scripts/inspect.js --tradition=afrobeat', 0],
  ['scripts/recipe.js --tradition afrobeat', 0],
  ['scripts/compare.js --traditions afrobeat gamelan', 0],
  ['scripts/fingerprint.js --tradition afrobeat', 0],
  ['scripts/validate.js', 0],
  ['scripts/audit.js', 0],
];

const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12);

// Reference: stdout to a real file. Node writes those synchronously, so this is
// the complete output by construction — the thing the piped runs must match,
// not merely agree with each other about.
function runToFile(argv, tmp) {
  const fd = fs.openSync(tmp, 'w');
  try {
    const r = spawnSync(process.execPath, argv, {
      cwd: ROOT,
      stdio: ['ignore', fd, 'ignore'],
      timeout: 300000,
    });
    return { code: r.status, buf: fs.readFileSync(tmp) };
  } finally {
    fs.closeSync(fd);
  }
}

// The probe. Hold stdout unread for HOLD_MS (or until the child gives up and
// exits, which is the failure), then drain.
function runHeldPipe(argv) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, argv, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const chunks = [];
    let exitedBeforeDrain = null;
    let draining = false;

    const drain = (fromExit) => {
      if (draining) return;
      draining = true;
      exitedBeforeDrain = fromExit;
      c.stdout.on('data', (d) => chunks.push(d));
      c.stdout.resume();
    };

    // Never touch c.stdout before this: a paused stream is never read from, so
    // the kernel pipe is the only sink and it fills at 64KB.
    const timer = setTimeout(() => drain(false), HOLD_MS);
    c.on('exit', () => drain(true));
    c.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, buf: Buffer.concat(chunks), exitedBeforeDrain });
    });
  });
}

(async () => {
  console.log('=== CLI output survives a pipe ===\n');
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-out-'));
  const tmp = path.join(tmpdir, 'ref.bin');
  let failures = 0;
  let witnessed = 0;
  const selected = CASES.filter(([cmd]) => !ONLY || cmd.includes(ONLY));

  try {
    for (const [cmd, wantCode] of selected) {
      const argv = cmd.split(' ');
      const ref = runToFile(argv, tmp);
      const held = await runHeldPipe(argv);

      const bytesDiffer = sha(held.buf) !== sha(ref.buf);
      const codeBad = ref.code !== wantCode || held.code !== wantCode;
      // The witness, for outputs too large to fit the pipe: the child must still
      // have been alive when draining began. If it exited first it discarded
      // what it could not write.
      const strict = ref.buf.length > PIPE_CERTAIN;
      const witnessBad = strict && held.exitedBeforeDrain === true;
      if (strict && !witnessBad) witnessed++;

      const ok = !bytesDiffer && !codeBad && !witnessBad;
      if (!ok) failures++;

      const notes = [];
      if (bytesDiffer)
        notes.push(
          `LOST ${ref.buf.length - held.buf.length}b of ${ref.buf.length}b through the pipe`
        );
      if (witnessBad)
        notes.push('child EXITED while its output was still unread — it dropped the rest');
      if (codeBad) notes.push(`exit want ${wantCode}, got file=${ref.code} pipe=${held.code}`);

      console.log(
        `  ${ok ? '✓' : '✗'} ${cmd}\n` +
          `      file=${ref.buf.length}b/${sha(ref.buf)}  held-pipe=${held.buf.length}b/${sha(held.buf)}` +
          (strict ? `  [held ${held.exitedBeforeDrain ? 'FAILED' : 'ok'}]` : '') +
          (notes.length ? `\n      → ${notes.join('; ')}` : '')
      );
    }
  } finally {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  }

  console.log('');
  // A run in which no case was large enough to exercise the held-pipe witness
  // proves nothing about the bug this gate exists for, so say so loudly rather
  // than reporting a green that is really an absence of evidence.
  if (!witnessed && !ONLY) {
    console.error(
      'CLI OUTPUT: FAIL — no invocation produced more than ' +
        `${PIPE_CERTAIN} bytes, so the held-pipe witness never ran and this check\n` +
        'is vacuous. Either the catalog shrank drastically or the CASES list was gutted.'
    );
    process.exitCode = 1;
    return;
  }
  if (failures) {
    console.error(
      `CLI OUTPUT: FAIL — ${failures} of ${selected.length} invocation(s) lost bytes or their\n` +
        'exit code when stdout was a pipe nobody was reading yet.\n\n' +
        'The cause is a process.exit() reached after writing to stdout. Node discards\n' +
        'the unflushed pipe queue on exit; set process.exitCode and return instead, and\n' +
        'the event loop drains before the process ends. See the header of scripts/list.js.'
    );
    process.exitCode = 1;
  } else {
    console.log(
      `CLI OUTPUT: PASS — all ${selected.length} invocations emit byte-identical output and the\n` +
        `same exit code through an unread pipe (${witnessed} of them large enough to prove it:\n` +
        'each stayed alive on a full pipe instead of exiting and dropping the remainder).'
    );
  }
})();
