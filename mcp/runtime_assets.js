import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeSourceFingerprint } from './build_identity.js';

const root = fileURLToPath(new URL('../lyric-harness/', import.meta.url));
const defaultProof = fileURLToPath(new URL('./capacity_verification.json', import.meta.url));
function stat(file) {
  try {
    const value = fs.statSync(file);
    return [file, value.size, value.mtimeMs, value.ctimeMs, value.ino];
  } catch {
    return [file, null];
  }
}
function directoryEpoch(directory, seen = new Set()) {
  try {
    const real = fs.realpathSync(directory);
    if (seen.has(real)) return [];
    seen.add(real);
    const result = [stat(directory)];
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const child = path.join(directory, entry.name);
      let directoryChild = entry.isDirectory();
      if (entry.isSymbolicLink()) {
        // A broken link must not prevent observing later sibling directories.
        try {
          directoryChild = fs.statSync(child).isDirectory();
        } catch {}
      }
      if (directoryChild) result.push(...directoryEpoch(child, seen));
    }
    return result;
  } catch {
    return [stat(directory)];
  }
}
function canonical(directory) {
  try {
    return fs.realpathSync(directory);
  } catch {
    return path.resolve(directory);
  }
}
function assetEpoch(env) {
  const manifest = path.join(root, 'data/runtime_assets.json');
  const staged = env.LYRIC_STAGED_DATA || path.join(root, 'data');
  const files = [manifest, path.join(root, 'data'), path.join(root, 'corpus'), staged];
  const catalogDirectories = new Set();
  try {
    for (const asset of JSON.parse(fs.readFileSync(manifest, 'utf8')).assets) {
      if (
        asset.base === 'root' &&
        (asset.id === 'library_catalog' || /^library_catalog_[a-f0-9]{64}$/.test(asset.id)) &&
        asset.directory
      )
        catalogDirectories.add(path.join(root, asset.directory));
      for (const item of asset.files) {
        const base = asset.base === 'root' ? root : staged;
        const file = path.join(base, item.path);
        files.push(file);
        // A root asset's directory is source (quality/ holds Python modules),
        // and Python caching bytecode there moves its metadata; the root's data
        // and corpus trees are walked whole below.
        if (asset.base === 'root') continue;
        for (
          let parent = path.dirname(file);
          parent.startsWith(base) && parent !== path.dirname(parent);
          parent = path.dirname(parent)
        )
          files.push(parent);
      }
    }
  } catch {}
  const catalogSeen = new Set();
  return [...new Set(files)].map(stat).concat(
    ...[path.join(root, 'data'), staged, path.join(root, 'corpus')].map((directory) =>
      directoryEpoch(directory)
    ),
    // Declared files are already statted above. Directory metadata detects
    // undeclared additions, including beneath a retained snapshot, without
    // making Python bytecode creation invalidate readiness.
    ...[...catalogDirectories].map((directory) => directoryEpoch(directory, catalogSeen))
  );
}

// The asynchronous twin of spawnSync's result: { status, signal, stdout,
// stderr, error }, with the same timeout and output bound. A timed-out child
// is reported as status null with an ETIMEDOUT error, as spawnSync reports
// it, and is stopped with its whole process group (grandchildren included):
// SIGTERM, then SIGKILL after `killGraceMs`. The result is delivered on time
// even if the child will not die, but its `exited` promise settles only once
// the child and everything holding its output have gone ('close'), so a
// caller can refuse to start another check until termination is confirmed.
export function spawnAsync(
  command,
  args,
  { timeout, maxBuffer, env, windowsHide, killGraceMs = 5_000 } = {}
) {
  const group = process.platform !== 'win32';
  let child;
  try {
    child = spawn(command, args, { env, windowsHide, detached: group });
  } catch (error) {
    return Promise.resolve({
      status: null,
      signal: null,
      stdout: '',
      stderr: '',
      error,
      exited: Promise.resolve(),
    });
  }
  const exited = new Promise((done) => {
    child.once('close', () => done());
    child.once('error', () => done());
  });
  return new Promise((resolve) => {
    let stdout = '',
      stderr = '',
      size = 0,
      error,
      stopping = false,
      settled = false;
    const timers = [];
    const finish = (result) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      resolve({ ...result, exited });
    };
    const signal = (name) => {
      try {
        if (group) process.kill(-child.pid, name);
        else child.kill(name);
      } catch {}
    };
    const stop = (code, message) => {
      error ||= Object.assign(new Error(message), { code });
      if (stopping) return;
      stopping = true;
      signal('SIGTERM');
      timers.push(
        setTimeout(() => {
          signal('SIGKILL');
          // Answer on time; `exited` still waits for the real end.
          timers.push(
            setTimeout(
              () =>
                finish({ status: null, signal: null, stdout, stderr, error, unconfirmed: true }),
              killGraceMs
            )
          );
        }, killGraceMs)
      );
    };
    if (timeout)
      timers.push(setTimeout(() => stop('ETIMEDOUT', `spawn ${command} ETIMEDOUT`), timeout));
    const take = (append) => (chunk) => {
      size += chunk.length;
      if (maxBuffer && size > maxBuffer) stop('ENOBUFS', `spawn ${command} ENOBUFS`);
      else append(chunk);
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on(
      'data',
      take((chunk) => (stdout += chunk))
    );
    child.stderr.on(
      'data',
      take((chunk) => (stderr += chunk))
    );
    child.once('error', (failure) =>
      finish({ status: null, signal: null, stdout, stderr, error: error || failure })
    );
    child.once('close', (code, closeSignal) =>
      finish({ status: error ? null : code, signal: closeSignal, stdout, stderr, error })
    );
  });
}

// The production reader is cached only while its source, consumed asset file
// identities, interpreter selection and exact proof bytes remain unchanged.
//
// A check that did not run to completion (a timeout, a child killed by a
// signal or one that could not be spawned) is not a verdict on the assets, so
// it is never cached as one: the 2026-10-16 release booted on a slow instance,
// the 30 s inventory timed out, and the cached failure held Lyrics down until
// the service was restarted. Its result says `incomplete: true` and, in
// `retry_at`, when it will be checked again. The first read after that time
// (or the timer set for it) starts one asynchronous check, and every read until
// it finishes returns the same incomplete result, so the retry neither blocks
// this thread nor runs twice at once. The first check, at boot, stays
// synchronous so a new instance answers only once it has a verdict. The
// backoff doubles from `retryMs` up to `maxRetryMs` while the epoch is
// unchanged. A check that completed, passing or failing, is cached exactly as
// before, and a read whose epoch differs from a passing verdict checks
// synchronously as before. While a check is in flight, or the last one did not
// finish, no read ever starts a synchronous one beside it: a changed epoch is
// checked in the background instead. The slot is freed only when every child
// the check started has exited; one that survives SIGKILL holds it, visibly
// (`in_flight` in /ready), and nothing is spawned again.
export function createRuntimeAssetReader({
  env = process.env,
  run = spawnSync,
  runAsync = spawnAsync,
  source = runtimeSourceFingerprint,
  now = Date.now,
  retryMs = 60_000,
  maxRetryMs = 30 * 60_000,
  // Starts the retry when it falls due, so recovery needs no traffic.
  schedule = (start, ms) => setTimeout(start, ms).unref(),
  // A background retry blocks nothing, so its bound is its own: 120 s, enough
  // for a cold check on one CPU (estimated 22-28 s on Render) several times
  // over. The boot check before listen keeps its 30 s.
  retryTimeoutMs = 120_000,
} = {}) {
  let cached, previous, failed, pending, inFlight;
  // Every check this process ran, newest last (at most 16): how it ran, when
  // it started, how long it took in total, how it ended, and each child it ran
  // (the inventory, then the capacity verification) with its own time against
  // its own limit; the limit is per child, not per attempt. Nobody has measured
  // a cold check on the service, because the boot limit killed it first; this
  // records the time of each, finished or not.
  const attempts = [];
  const STEPS = ['inventory', 'capacity'];
  function record(mode, started, children, verdict, kept = true) {
    const limit = mode === 'background' ? retryTimeoutMs : options.timeout;
    const outcome = !kept
      ? 'discarded'
      : children.some(({ child }) => child?.error?.code === 'ETIMEDOUT')
        ? 'timed_out'
        : verdict.incomplete
          ? 'incomplete'
          : verdict.ok
            ? 'passed'
            : 'failed';
    attempts.push(
      Object.freeze({
        mode,
        started_at: new Date(started).toISOString(),
        elapsed_ms: Math.max(0, now() - started),
        per_child_limit_ms: limit,
        outcome,
        children: children.map(({ child, elapsed }, index) =>
          Object.freeze({
            step: STEPS[index],
            elapsed_ms: elapsed,
            limit_ms: limit,
            outcome:
              child?.error?.code === 'ETIMEDOUT'
                ? 'timed_out'
                : child?.error
                  ? 'error'
                  : child?.status === null || child?.status === undefined
                    ? 'killed'
                    : `exit_${child.status}`,
          })
        ),
      })
    );
    if (attempts.length > 16) attempts.shift();
  }
  const options = {
    encoding: 'utf8',
    timeout: 30_000,
    // A boot check that ignores SIGTERM would hold the boot forever.
    killSignal: 'SIGKILL',
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
    env,
  };
  function context() {
    const required = env.LYRIC_RELEASE_ASSETS_REQUIRED === '1';
    // This must name the same interpreter as lyric_tools.js's worker bridge.
    const python = env.LYRIC_PYTHON || 'python3';
    const proofFile = env.LYRIC_CAPACITY_ATTESTATION || defaultProof;
    let proofBytes = null,
      proof = null;
    try {
      if (fs.statSync(proofFile).size <= 1024 * 1024) {
        proofBytes = fs.readFileSync(proofFile);
        proof = JSON.parse(proofBytes);
      }
    } catch {}
    const proofHash = proofBytes ? createHash('sha256').update(proofBytes).digest('hex') : null;
    const epoch = () =>
      JSON.stringify([
        required,
        python,
        env.NLTK_DATA,
        env.LYRIC_STAGED_DATA,
        proofFile,
        proofHash,
        source(),
        assetEpoch(env),
      ]);
    return { required, python, proofFile, proofBytes, proof, proofHash, epoch, key: epoch() };
  }
  // One validation, as the commands it runs (yielded) and the verdict they
  // give (returned); read() drives it synchronously, a retry asynchronously.
  function* validate({ required, python, proofFile, proofBytes, proof, proofHash, epoch, key }) {
    const result = yield [
      python,
      [path.join(root, 'quality/release_assets.py'), required ? '--check' : '--integrity'],
    ];
    let inventory;
    try {
      inventory = JSON.parse(result.stdout);
    } catch {
      inventory = null;
    }
    // Only a verdict is kept: the inventory's own JSON (ok true with exit 0, or
    // ok false), or verify_capacity's exit 0 or 2. A timeout, a signal, a
    // child that could not start, unparseable output or any other exit is a
    // check that did not finish, and it is retried.
    const ran = (child) => !child.error && child.status !== null;
    let incomplete = !(
      ran(result) &&
      typeof inventory?.ok === 'boolean' &&
      (inventory.ok === false || result.status === 0)
    );
    const inventoryOK = result.status === 0 && inventory?.ok === true;
    const approvedTagger = path.join(env.LYRIC_STAGED_DATA || path.join(root, 'data'), 'nltk');
    const taggerOK =
      !required || !env.NLTK_DATA || canonical(env.NLTK_DATA) === canonical(approvedTagger);
    const assetOK = inventoryOK && taggerOK;
    const errors = inventoryOK
      ? []
      : inventory?.errors?.length
        ? [...inventory.errors]
        : [result.error?.message || 'Asset inventory did not complete.'];
    if (!taggerOK)
      errors.push(
        'LYRIC_ASSETS_UNAVAILABLE: production NLTK_DATA must name the approved staged/nltk model.'
      );
    let capacityOK = !required;
    if (required && assetOK) {
      if (!proof)
        errors.push(
          'CAPACITY_UNVERIFIED: actual-runtime all-family receipt is missing or unreadable.'
        );
      else {
        const checked = yield [
          python,
          [path.join(root, 'quality/verify_capacity.py'), '--output', proofFile, '--check'],
        ];
        capacityOK = checked.status === 0;
        incomplete ||= !(ran(checked) && (checked.status === 0 || checked.status === 2));
        if (!capacityOK)
          errors.push(
            'CAPACITY_UNVERIFIED: ' +
              (checked.error?.message ||
                checked.stderr?.trim() ||
                'the current runtime/source/table proof was refused.')
          );
      }
    }
    // A verifier never creates a proof on this read-only path. Detect a receipt
    // swap during validation before caching a successful readiness result.
    if (required && capacityOK) {
      try {
        if (!proofBytes.equals(fs.readFileSync(proofFile))) capacityOK = false;
      } catch {
        capacityOK = false;
      }
      if (!capacityOK) errors.push('CAPACITY_UNVERIFIED: receipt changed during validation.');
    }
    if (required && capacityOK && epoch() !== key) {
      capacityOK = false;
      errors.push('CAPACITY_UNVERIFIED: source or assets changed during validation.');
    }
    return {
      incomplete,
      ok: assetOK && capacityOK,
      releaseRequired: required,
      errors,
      capacity: { required, ok: capacityOK, receipt_sha256: proofHash },
      manifest_sha256: inventory?.manifest_sha256 || null,
      assets_sha256: inventory?.assets
        ? createHash('sha256').update(JSON.stringify(inventory.assets)).digest('hex')
        : null,
      python: inventory?.python || null,
      nltk: inventory?.nltk || null,
      ...(inventory?.reader ? { reader: inventory.reader } : {}),
    };
  }
  function settle(key, { incomplete, ...verdict }) {
    if (!incomplete) {
      failed = undefined;
      previous = key;
      cached = Object.freeze(verdict);
      return cached;
    }
    const at = now();
    const delay = Math.min(
      failed?.key === key && failed.delay ? failed.delay * 2 : retryMs,
      maxRetryMs
    );
    const value = Object.freeze({
      ...verdict,
      incomplete: true,
      retry_at: new Date(at + delay).toISOString(),
    });
    failed = { key, delay, retryAt: at + delay, value };
    cached = previous = undefined;
    schedule(wake, delay);
    return value;
  }
  // The timer's start: a timer that fires early waits out the remainder, and
  // one that finds a check in flight leaves it to that check's end.
  function wake() {
    try {
      if (pending || !failed) return;
      if (now() < failed.retryAt) schedule(wake, failed.retryAt - now());
      else read();
    } catch {}
  }
  function unfinished(current, message) {
    return Object.freeze({
      ok: false,
      releaseRequired: current.required,
      errors: [message],
      capacity: { required: current.required, ok: false, receipt_sha256: current.proofHash },
      manifest_sha256: null,
      assets_sha256: null,
      python: null,
      nltk: null,
      incomplete: true,
      retry_at: new Date(now()).toISOString(),
    });
  }
  function retry(current) {
    const started = now();
    const children = [];
    inFlight = { started, awaiting_exit: false };
    pending = (async () => {
      const steps = validate(current);
      let step = steps.next();
      while (!step.done) {
        const at = now();
        const child = await runAsync(...step.value, { ...options, timeout: retryTimeoutMs });
        children.push({ child, elapsed: Math.max(0, now() - at) });
        step = steps.next(child);
      }
      return step.value;
    })()
      .catch((error) => ({
        incomplete: true,
        ...unfinished(current, error?.message || 'Asset inventory did not complete.'),
      }))
      .then((verdict) => {
        // Kept only if nothing moved while it ran: the same epoch (source,
        // assets, interpreter and receipt) at the start and at the end, and no
        // synchronous check by a read with a different epoch since.
        const kept = failed?.key === current.key && current.epoch() === current.key;
        record('background', started, children, verdict, kept);
        if (kept) settle(current.key, verdict);
        else if (failed?.key === current.key) failed = { ...failed, retryAt: 0 };
        // The slot is held until every child has exited, so a child that
        // outlives its result can never run beside the next one.
        inFlight.awaiting_exit = true;
        return Promise.all(children.map(({ child }) => child?.exited));
      })
      .finally(() => {
        pending = inFlight = undefined;
        if (failed && now() >= failed.retryAt) schedule(wake, 0);
      });
  }
  function read() {
    const current = context();
    if (cached && current.key === previous) return cached;
    if (failed || pending) {
      // A check is in flight or the last one did not finish: never start a
      // synchronous one beside it. A changed epoch is checked in the
      // background as soon as the slot is free, from the first delay.
      if (failed?.key !== current.key)
        failed = {
          key: current.key,
          delay: 0,
          retryAt: 0,
          value: failed?.value ?? unfinished(current, 'A changed asset check is in flight.'),
        };
      if (!pending && now() >= failed.retryAt) retry(current);
      return failed.value;
    }
    const started = now();
    const children = [];
    const steps = validate(current);
    let step = steps.next();
    while (!step.done) {
      const at = now();
      const child = run(...step.value, options);
      children.push({ child, elapsed: Math.max(0, now() - at) });
      step = steps.next(child);
    }
    record('sync', started, children, step.value);
    return settle(current.key, step.value);
  }
  // Resolves when the asynchronous retry in flight (if any) has settled.
  read.settled = () => pending || Promise.resolve();
  // The checks run so far, oldest first; timings and outcomes only.
  read.attempts = () => attempts.slice();
  // The background check holding the slot, if any; awaiting_exit means its
  // result is in but a child it started has not been seen to exit.
  read.inFlight = () =>
    inFlight && {
      started_at: new Date(inFlight.started).toISOString(),
      elapsed_ms: Math.max(0, now() - inFlight.started),
      awaiting_exit: inFlight.awaiting_exit,
    };
  return read;
}
export const runtimeAssets = createRuntimeAssetReader();
