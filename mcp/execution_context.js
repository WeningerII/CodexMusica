// Request lifetime shared by HTTP, MCP handlers and the Python queue.
// deadlineAt uses the monotonic process clock. deadlineMs is a transport
// compatibility projection, never the clock used to measure elapsed work.
import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

const execution = new AsyncLocalStorage();

export function requestContext() {
  return execution.getStore() || {};
}

export function withExecutionContext(context, fn) {
  return execution.run(context, fn);
}

export function childExecutionContext(options = {}) {
  const parent = requestContext();
  const signals = [...new Set([parent.signal, options.signal].filter(Boolean))];
  const now = performance.now();
  const deadlines = [parent.deadlineAt, options.deadlineAt];
  if (Number.isFinite(options.deadlineMs)) deadlines.push(now + options.deadlineMs - Date.now());
  if (!Number.isFinite(parent.deadlineAt) && Number.isFinite(parent.deadlineMs)) {
    deadlines.push(now + parent.deadlineMs - Date.now());
  }
  const finite = deadlines.filter(Number.isFinite);
  const deadlineAt = finite.length ? Math.min(...finite) : undefined;
  return {
    ...parent,
    ...options,
    signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0],
    deadlineAt,
    deadlineMs: Number.isFinite(deadlineAt) ? Date.now() + deadlineAt - now : undefined,
  };
}

export function remainingExecutionMs(context = requestContext()) {
  if (context.signal?.aborted) return 0;
  if (Number.isFinite(context.deadlineAt))
    return Math.max(0, context.deadlineAt - performance.now());
  if (Number.isFinite(context.deadlineMs)) return Math.max(0, context.deadlineMs - Date.now());
  return Infinity;
}
