// Serial harness execution with one deadline from admission to result. The
// transport streams control records so a killed Python process cannot erase
// its last accepted checkpoint or turn unknown provider usage into zero.
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const CHECKPOINT = '  lyric checkpoint: ';
const USAGE = '  proposer event: ';
const RESULT = '  lyric result: ';
const CONTROL_CAP = 8 * 1024 * 1024;

function interrupted(message, flags = {}) {
  return Object.assign(new Error(message), flags);
}

function capture(maxBytes, context = {}, controlToken) {
  const streams = { stdout: '', stderr: '' };
  const pending = { stdout: '', stderr: '' };
  const bytes = { stdout: 0, stderr: 0 };
  let checkpoint;
  let proposer_record;
  let lyric_result;
  let unjournalledDispatch = false;
  let unknownAtQuestionStart = 0;
  const keep = (stream, text) => {
    bytes[stream] += Buffer.byteLength(text);
    if (bytes[stream] > maxBytes)
      throw interrupted(`harness output exceeds ${maxBytes} bytes`, { overflowed: true });
    streams[stream] += text;
  };
  const line = (stream, text) => {
    if (
      stream === 'stdout' &&
      (text.startsWith(CHECKPOINT) || text.startsWith(USAGE) || text.startsWith(RESULT))
    ) {
      const prefix = text.startsWith(CHECKPOINT)
        ? CHECKPOINT
        : text.startsWith(RESULT)
          ? RESULT
          : USAGE;
      if (Buffer.byteLength(text) > CONTROL_CAP)
        throw interrupted('harness control record exceeds cap', { overflowed: true });
      let record;
      try {
        record = JSON.parse(text.slice(prefix.length));
      } catch {
        keep(stream, text);
        return;
      }
      // Lyrics and model output are untrusted text. Only a control record
      // carrying this invocation's private nonce may change runtime state.
      if (!record || record.transport_token !== controlToken) {
        keep(stream, text);
        return;
      }
      delete record.transport_token;
      if (prefix === CHECKPOINT) {
        checkpoint = record;
        unjournalledDispatch = false;
        unknownAtQuestionStart = proposer_record?.unknown_attempts || 0;
        context.onCheckpoint?.(record);
      } else if (prefix === RESULT) lyric_result = record;
      else {
        proposer_record = record;
        if (record.in_flight || ['response', 'ok', 'empty'].includes(record.status))
          unjournalledDispatch = true;
        if (
          record.status === 'rejected' &&
          (record.unknown_attempts || 0) <= unknownAtQuestionStart
        )
          unjournalledDispatch = false;
        context.onProposerUsage?.(record);
      }
    } else keep(stream, text);
  };
  return {
    append(stream, text) {
      pending[stream] += text;
      let end;
      while ((end = pending[stream].indexOf('\n')) !== -1) {
        const text = pending[stream].slice(0, end + 1);
        pending[stream] = pending[stream].slice(end + 1);
        line(stream, text);
      }
      const control =
        stream === 'stdout' &&
        (pending[stream].startsWith(CHECKPOINT) ||
          pending[stream].startsWith(USAGE) ||
          pending[stream].startsWith(RESULT));
      if (Buffer.byteLength(pending[stream]) > (control ? CONTROL_CAP : maxBytes))
        throw interrupted('harness output exceeds its record cap', { overflowed: true });
    },
    finish() {
      for (const stream of ['stdout', 'stderr']) {
        if (pending[stream]) {
          const text = pending[stream];
          pending[stream] = '';
          line(stream, text);
        }
      }
    },
    result() {
      return {
        ...streams,
        checkpoint,
        proposer_record,
        lyric_result,
        accounting_unknown: Boolean(proposer_record?.in_flight || proposer_record?.usage_unknown),
        uncertain_proposal: Boolean(checkpoint?.status === 'proposing' && unjournalledDispatch),
      };
    },
  };
}

export function createPythonBridge({
  python,
  harnessDir,
  workerPath,
  harnessEnv,
  timeoutMs,
  maxOutputBytes,
  workerEnabled = true,
  getContext = () => ({}),
  openKitchenBudget,
  onLifecycle = () => {},
}) {
  let tail = Promise.resolve();
  let worker = null;
  let protocol = '';
  let nextId = 1;
  let waiter = null;
  let reaping = Promise.resolve();
  let reapingChild = null;
  const children = new WeakMap();
  const terminate = (child) => {
    if (!child) return;
    try {
      // A grading verb can fork helpers. Killing only its leader leaves
      // those helpers alive and their inherited stdout pipe open.
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
      else child.kill('SIGKILL');
    } catch (error) {
      if (error.code !== 'ESRCH') child.kill('SIGKILL');
    }
  };
  const kill = (why = interrupted('worker died')) => {
    const old = worker;
    const pending = waiter;
    worker = null;
    waiter = null;
    protocol = '';
    const lifecycle = old && children.get(old);
    if (old && !lifecycle?.closed) {
      reapingChild = old;
      // Idle workers are unref'd so they do not own application lifetime.
      // Once cleanup has been requested, its promised 'close' must keep
      // Node alive even when no HTTP server or test runner is holding it.
      old.ref();
      old.stdin?.ref?.();
      old.stdout?.ref?.();
      terminate(old);
    }
    const closed = lifecycle?.promise || reaping;
    reaping = closed;
    if (pending) {
      // SIGKILL is a request to the kernel, not proof that memory and pipes
      // are gone. Only 'close' permits recovery, fallback or another job.
      let timer;
      Promise.race([
        closed.then(() => true),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve(false), 750);
        }),
      ]).then((reaped) => {
        clearTimeout(timer);
        if (!reaped) why.terminationPending = true;
        pending.reject(why);
      });
    }
    return closed;
  };
  const spawnWorker = () => {
    const child = spawn(python, [workerPath], {
      cwd: harnessDir,
      stdio: ['pipe', 'pipe', 'ignore'],
      env: harnessEnv(),
      detached: process.platform !== 'win32',
    });
    let resolveClose;
    const lifecycle = {
      closed: false,
      promise: new Promise((resolve) => {
        resolveClose = resolve;
      }),
    };
    children.set(child, lifecycle);
    child.once('close', () => {
      lifecycle.closed = true;
      if (reapingChild === child) reapingChild = null;
      onLifecycle({ event: 'close', pid: child.pid, path: 'warm' });
      resolveClose();
    });
    onLifecycle({ event: 'spawn', pid: child.pid, path: 'warm' });
    worker = child;
    child.unref();
    child.stdin.unref?.();
    child.stdout.unref?.();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (worker !== child) return;
      protocol += chunk;
      let end;
      while ((end = protocol.indexOf('\n')) !== -1) {
        const line = protocol.slice(0, end);
        protocol = protocol.slice(end + 1);
        if (!line.trim()) continue;
        try {
          const reply = JSON.parse(line);
          if (!waiter || reply.id !== waiter.id) continue;
          if (reply.event === 'output') waiter.capture.append(reply.stream, reply.data);
          else if (typeof reply.code === 'number') {
            // Accept the old final-frame shape as well during rollout.
            if (reply.stdout) waiter.capture.append('stdout', reply.stdout);
            if (reply.stderr) waiter.capture.append('stderr', reply.stderr);
            waiter.capture.finish();
            const current = waiter;
            waiter = null;
            current.resolve({ code: reply.code, ...current.capture.result() });
          } else throw interrupted('unreadable worker reply', { protocolError: true });
        } catch (error) {
          kill(error);
          return;
        }
      }
      // Frames are <= 16 KiB code points, including JSON escaping. This cap
      // protects framing only; decoded stdout and stderr have identical caps
      // on both execution paths.
      if (Buffer.byteLength(protocol) > 1024 * 1024)
        kill(interrupted('worker protocol frame exceeds cap', { protocolError: true }));
    });
    child.stdin.on('error', (error) => {
      if (worker === child) kill(error);
    });
    child.on('error', (error) => {
      if (worker === child) {
        console.error(
          '[lyric] warm worker unavailable',
          JSON.stringify({
            event: 'worker_spawn_error',
            code: /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'UNKNOWN',
          })
        );
        kill(error);
      }
    });
    child.on('close', (code, signal) => {
      if (worker === child) {
        console.error(
          '[lyric] warm worker exited',
          JSON.stringify({
            event: 'worker_exit',
            code,
            signal,
            active: Boolean(waiter),
          })
        );
        kill();
      }
    });
    return child;
  };
  const limits = (options) => {
    const context = options?.context || getContext() || {};
    const now = Date.now();
    const at = performance.now();
    const epochExternal = Math.min(options?.deadlineMs ?? Infinity, context.deadlineMs ?? Infinity);
    const external = Math.min(epochExternal, now + (context.deadlineAt ?? Infinity) - at);
    // Leave response serialization/SDK delivery headroom when an upstream
    // deadline exists. A short test or caller deadline gets proportional room.
    const reserve = Number.isFinite(external)
      ? Math.min(1000, Math.max(0, (external - now) * 0.05))
      : 0;
    return {
      ...options,
      context,
      controlToken: randomBytes(16).toString('hex'),
      signal: options?.signal || context.signal,
      deadlineMs: Math.min(now + timeoutMs, external - reserve),
      deadlineAt: at + Math.min(timeoutMs, external - reserve - now),
    };
  };
  const requestEnv = (options) => ({
    ...options.budgetEnv,
    LYRIC_CONTROL_TOKEN: options.controlToken,
    LYRIC_REQUEST_DEADLINE_MS: String(Date.now() + options.deadlineAt - performance.now()),
    ...(options.checkpointPath ? { LYRIC_CHECKPOINT_PATH: options.checkpointPath } : {}),
    ...(options.context.kitchenBudgetUsd != null
      ? { LYRIC_PROPOSER_BUDGET_USD: String(options.context.kitchenBudgetUsd) }
      : {}),
  });
  const warm = (args, options = limits({})) =>
    new Promise((resolve, reject) => {
      const captured = capture(maxOutputBytes, options.context, options.controlToken);
      if (options.signal?.aborted || performance.now() >= options.deadlineAt)
        return reject(
          Object.assign(
            interrupted('harness request expired before execution', { timedOut: true }),
            captured.result()
          )
        );
      const child = worker || spawnWorker();
      const id = nextId++;
      let timer;
      const abort = () => kill(interrupted('harness request cancelled', { cancelled: true }));
      const cleanup = () => {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
      };
      waiter = {
        id,
        capture: captured,
        resolve: (result) => {
          cleanup();
          resolve(result);
        },
        reject: (error) => {
          cleanup();
          reject(Object.assign(error, captured.result()));
        },
      };
      timer = setTimeout(
        () => kill(interrupted('verb killed at the shared tool deadline', { timedOut: true })),
        Math.max(1, options.deadlineAt - performance.now())
      );
      options.signal?.addEventListener('abort', abort, { once: true });
      child.stdin.write(JSON.stringify({ id, argv: args, env: requestEnv(options) }) + '\n');
    });
  const cold = (args, options = limits({})) =>
    new Promise((resolve) => {
      const captured = capture(maxOutputBytes, options.context, options.controlToken);
      if (options.signal?.aborted || performance.now() >= options.deadlineAt)
        return resolve({
          code: -1,
          ...captured.result(),
          stderr: 'harness request expired before execution',
        });
      const child = spawn(python, ['-u', 'lyric_harness.py', ...args], {
        cwd: harnessDir,
        env: { ...harnessEnv(), ...requestEnv(options) },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      });
      onLifecycle({
        event: 'spawn',
        pid: child.pid,
        path: 'cold',
        remaining_ms: Math.max(0, options.deadlineAt - performance.now()),
      });
      let reason;
      let timer;
      const stop = (error) => {
        reason ||= error;
        terminate(child);
      };
      const abort = () => stop(interrupted('harness request cancelled', { cancelled: true }));
      for (const stream of ['stdout', 'stderr']) {
        const decoder = new StringDecoder('utf8');
        child[stream].on('data', (chunk) => {
          try {
            captured.append(stream, decoder.write(chunk));
          } catch (error) {
            stop(error);
          }
        });
        child[stream].on('end', () => {
          try {
            captured.append(stream, decoder.end());
          } catch (error) {
            stop(error);
          }
        });
      }
      timer = setTimeout(
        () => stop(interrupted('verb killed at the shared tool deadline', { timedOut: true })),
        Math.max(1, options.deadlineAt - performance.now())
      );
      options.signal?.addEventListener('abort', abort, { once: true });
      child.on('error', (error) => {
        reason ||= error;
      });
      child.on('close', (code) => {
        onLifecycle({ event: 'close', pid: child.pid, path: 'cold' });
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        try {
          captured.finish();
        } catch (error) {
          reason ||= error;
        }
        const result = captured.result();
        resolve(
          reason ? failure(args, Object.assign(reason, result)) : { code: code ?? -1, ...result }
        );
      });
    });
  const failure = (args, error) => {
    const result = {
      code: -1,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      checkpoint: error.checkpoint,
      proposer_record: error.proposer_record,
      lyric_result: error.lyric_result,
      accounting_unknown: Boolean(error.accounting_unknown),
      uncertain_proposal: Boolean(error.uncertain_proposal),
      timed_out: Boolean(error.timedOut),
      cancelled: Boolean(error.cancelled),
      termination_pending: Boolean(error.terminationPending),
    };
    result.stderr += `${result.stderr ? '\n' : ''}${error.message}`;
    if (error.overflowed) {
      result.code = 2;
      // Only control records survive: no prefix of a truncated grade is an answer.
      result.stdout = `  REFUSED — ${args[0]} printed more than this connector can carry: its report ran past the ${(maxOutputBytes / 1048576).toFixed(0)} MiB output cap. The latest checkpoint and usage record remain available.\n`;
    }
    return result;
  };
  const runVerb = (args, supplied = {}) => {
    const t0 = performance.now();
    const options = limits(supplied);
    const stamp = (result, path) => ({ ...result, path, ms: Math.round(performance.now() - t0) });
    let expired = false;
    let finishEarly;
    const early = new Promise((resolve) => {
      finishEarly = resolve;
    });
    const expire = (cancelled) => {
      expired = true;
      finishEarly(
        stamp(
          failure(
            args,
            interrupted(
              cancelled
                ? 'harness request cancelled before dequeue'
                : 'harness request expired in queue',
              { cancelled, timedOut: !cancelled }
            )
          ),
          'killed'
        )
      );
    };
    const abort = () => expire(true);
    const timer = setTimeout(
      () => expire(false),
      Math.max(1, options.deadlineAt - performance.now())
    );
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) expire(true);
    const execute = async () => {
      await reaping;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      if (expired || options.signal?.aborted || performance.now() >= options.deadlineAt)
        return stamp(
          failure(args, interrupted('harness request expired before dequeue', { timedOut: true })),
          'killed'
        );
      const kitchen = args.some((arg) => arg.startsWith('--propose=call:'));
      let broker;
      let result;
      try {
        if (kitchen && openKitchenBudget) {
          broker = await openKitchenBudget(options.context);
          options.budgetEnv = broker.env;
        }
        if (!workerEnabled) result = stamp(await cold(args, options), 'cold');
        else {
          try {
            result = stamp(await warm(args, options), 'warm');
          } catch (error) {
            if (
              kitchen ||
              error.timedOut ||
              error.cancelled ||
              error.overflowed ||
              error.terminationPending ||
              performance.now() >= options.deadlineAt
            )
              result = stamp(failure(args, error), 'killed');
            else {
              console.error(
                '[lyric] warm worker unavailable; deterministic cold fallback',
                JSON.stringify({
                  event: 'worker_cold_fallback',
                  remaining_ms: Math.max(0, Math.round(options.deadlineAt - performance.now())),
                })
              );
              result = stamp(await cold(args, options), 'cold-fallback');
            }
          }
        }
      } catch (error) {
        result = stamp(failure(args, error), 'killed');
      }
      // An atomic checkpoint can reach disk just before SIGKILL, with its
      // stdout frame still in the pipe. Read the trusted per-call file before
      // temporary-file cleanup; it is the newer source of accepted state.
      if (!result.termination_pending && result.code !== 0 && options.checkpointPath) {
        try {
          if ((await stat(options.checkpointPath)).size > CONTROL_CAP)
            throw new Error('checkpoint file exceeds cap');
          result.checkpoint = JSON.parse(await readFile(options.checkpointPath, 'utf8'));
          if (result.checkpoint.status !== 'proposing') result.uncertain_proposal = false;
          options.context.onCheckpoint?.(result.checkpoint);
        } catch (error) {
          if (error.code !== 'ENOENT') result.checkpoint_error = error.message;
        }
      }
      if (result.termination_pending) {
        result.stderr +=
          '\nWorker termination is not yet confirmed; the serial queue remains blocked and no newer checkpoint file was read.';
        // Reservation remains held until the process is confirmed dead.
        reaping = reaping.then(async () => {
          try {
            await broker?.close();
          } catch (error) {
            console.error(`[lyric] accounting cleanup after delayed reap failed: ${error.message}`);
          }
        });
        return result;
      }
      try {
        await broker?.close();
      } catch (error) {
        // Accounting persistence failure must refuse further work, but it
        // must not erase the accepted song or known usage already recovered.
        result.code = -1;
        result.accounting_unknown = true;
        result.stderr += `${result.stderr ? '\n' : ''}kitchen accounting close failed: ${error.message}`;
      }
      return result;
    };
    const run = tail.then(execute, execute);
    tail = run.then(
      () => reaping,
      () => reaping
    );
    return Promise.race([run, early]);
  };
  return {
    runVerb,
    cleanup(fn) {
      if (!reapingChild) return fn();
      // An exceptionally slow SIGKILL acknowledgement must not cause a
      // temporary input/checkpoint directory to disappear under its writer.
      // Schedule deletion after confirmed close while returning the explicit
      // termination_pending response within its cleanup grace.
      reaping.then(fn).catch(() => {
        console.error(
          '[lyric] deferred temporary-directory cleanup failed',
          JSON.stringify({ event: 'worker_cleanup_error' })
        );
      });
      return undefined;
    },
    internals: {
      runWarm: async (a, o) => {
        const options = limits(o);
        await reaping;
        return warm(a, options);
      },
      runCold: (a, o) => cold(a, limits(o)),
      runVerb,
      kill,
      pid: () => worker?.pid || null,
      enabled: workerEnabled,
    },
  };
}
