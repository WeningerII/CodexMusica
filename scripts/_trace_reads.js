'use strict';
// _trace_reads.js — a --require preload that records every file a build reads.
//
// Ground truth for scripts/check_build_closure.js. The closure gate's whole
// value is that it is DERIVED rather than guessed, and a static require() graph
// alone is not a derivation: it misses everything a builder pulls in through
// fs at runtime (references/*.js data files, src/ fragments, inlined assets).
// So the closure is validated against what a real build actually touched.
//
// Loaded via NODE_OPTIONS/--require so it is installed before the builder's
// first line, and so it reaches worker_threads too — the api build fans out
// across scripts/_compile_worker.js, and a tracer that only saw the main thread
// would under-report exactly the files the heaviest builder reads.
//
// Appends one absolute path per line to CODEX_TRACE_OUT. Append-only and
// line-buffered on purpose: several processes write to it concurrently, and
// short appends to a file opened O_APPEND do not interleave on Linux. The
// reader dedupes, so a duplicate line costs nothing and a lost line would be a
// missing input — which is why nothing here buffers.

const fs = require('fs');
const path = require('path');
const Module = require('module');

const OUT = process.env.CODEX_TRACE_OUT;
if (OUT) {
  const ROOT = path.resolve(__dirname, '..');
  let fd = null;
  try {
    fd = fs.openSync(OUT, 'a');
  } catch {
    /* tracing is best-effort; never break the build being traced */
  }

  const note = (p) => {
    if (fd === null) return;
    try {
      // Builtins come back from _resolveFilename as bare names ('fs', 'node:os'),
      // and path.resolve would turn those into <repo>/fs — a file that does not
      // exist, recorded as an input. Drop them before resolving.
      if (!p.includes(path.sep) && (Module.isBuiltin ? Module.isBuiltin(p) : true)) return;
      const abs = path.resolve(p);
      // Only repo files matter, and node_modules is pinned by the lockfile
      // rather than by this closure — package-lock.json stands in for all of it.
      if (!abs.startsWith(ROOT + path.sep)) return;
      if (abs.includes(`${path.sep}node_modules${path.sep}`)) return;
      fs.writeSync(fd, abs + '\n');
    } catch {
      /* ignore */
    }
  };

  // Every fs entry point a builder could plausibly read source or data through.
  // Patched rather than sampled: a read this misses is an input the closure
  // would not know about, which is the one failure mode that matters.
  for (const name of ['readFileSync', 'openSync', 'createReadStream', 'readFile', 'open']) {
    const orig = fs[name];
    if (typeof orig !== 'function') continue;
    fs[name] = function (p, ...rest) {
      if (typeof p === 'string' || Buffer.isBuffer(p)) note(String(p));
      return orig.call(this, p, ...rest);
    };
  }
  if (fs.promises) {
    for (const name of ['readFile', 'open']) {
      const orig = fs.promises[name];
      if (typeof orig !== 'function') continue;
      fs.promises[name] = function (p, ...rest) {
        if (typeof p === 'string' || Buffer.isBuffer(p)) note(String(p));
        return orig.call(this, p, ...rest);
      };
    }
  }

  // require() resolution, so a module loaded from the compile cache (and
  // therefore never re-read through fs) is still recorded.
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (...args) {
    const resolved = origResolve.apply(this, args);
    if (typeof resolved === 'string') note(resolved);
    return resolved;
  };
}
