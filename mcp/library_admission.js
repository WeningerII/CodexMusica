// library_admission.js — the analysis admission rules, checked where a job
// actually enters the queue and shared by every path that can put one there.
//
// Two rules (owner decision 4, LIBRARY_LIMITS):
//   outstandingPerIp   at most this many queued, running or paused analyses
//                      from one network address (public routes only);
//   longReadingLines   at most one queued or running analysis of a reading
//                      longer than this, service-wide (public routes, and
//                      the private bridge, which serves the same reader).
//
// A create or resume awaits identity resolution (filesystem reads) before
// store.create / store.resume, so a check made before that await could be
// passed by two requests at once. reserve() therefore checks AND holds a
// reservation synchronously; the reservation counts against both rules until
// the caller commits it (the job now exists) or releases it (it does not).
// A resume excludes its own job from both counts.
import { LIBRARY_LIMITS } from './ratelimit.js';

const OUTSTANDING = ['queued', 'running', 'paused'];
const ACTIVE = ['queued', 'running'];

/**
 * @param {object} o
 * @param {import('./reader_job_store.js').ReaderJobStore} o.store
 * @param {(id: string) => ({lines: number} | null)} [o.unitOf] the snapshot's
 *   view of a unit; without one, no reading counts as long
 * @param {(code, message, status, extra) => Error} o.fail the caller's error
 * @param {() => number} [o.now]
 */
export function createAdmission({
  store,
  unitOf = () => null,
  fail,
  now = Date.now,
  limits = LIBRARY_LIMITS,
}) {
  const jobsByIp = new Map(); // ip -> Set(job id) of jobs admitted for that address
  const reservations = new Set(); // { ip, long } held across an await
  const state = (id) => {
    try {
      return store.inspect(id).state;
    } catch {
      return null;
    }
  };
  const isLong = (unitId) => {
    const unit = unitOf(unitId);
    return !!unit && unit.lines > limits.longReadingLines;
  };
  // Forget finished jobs and departed addresses, so the map holds only what
  // is still outstanding.
  const sweep = () => {
    for (const [ip, ids] of jobsByIp) {
      for (const id of ids) if (!OUTSTANDING.includes(state(id))) ids.delete(id);
      if (!ids.size) jobsByIp.delete(ip);
    }
  };
  const longBusy = (except) => {
    for (const r of reservations) if (r.long) return true;
    for (const record of store.records.values()) {
      if (record.id === except || !ACTIVE.includes(record.state)) continue;
      if (record.expires_at <= now()) continue;
      if (isLong(record.request?.reading_unit_id)) return true;
    }
    return false;
  };

  /**
   * Checks both rules and holds a reservation. ip null: the private bridge,
   * which has no per-address ceiling.
   * @returns {{ commit(jobId?: string): void, release(): void }}
   */
  function reserve({ ip = null, unitId, except = null }) {
    const long = isLong(unitId);
    if (ip !== null) {
      sweep();
      const mine = jobsByIp.get(ip);
      let count = (mine?.size ?? 0) - (except && mine?.has(except) ? 1 : 0);
      for (const r of reservations) if (r.ip === ip) count++;
      if (count >= limits.outstandingPerIp)
        throw fail(
          'RATE_LIMITED',
          'Too many analyses are running from this network address.',
          429,
          { retryAfter: 60_000 }
        );
    }
    if (long && longBusy(except))
      throw fail('LONG_READING_BUSY', 'Another long reading is being analysed.', 429, {
        retryAfter: 60_000,
      });
    const held = { ip, long };
    reservations.add(held);
    let open = true;
    return {
      commit(jobId) {
        if (!open) return;
        open = false;
        reservations.delete(held);
        if (ip !== null && jobId) {
          if (!jobsByIp.has(ip)) jobsByIp.set(ip, new Set());
          jobsByIp.get(ip).add(jobId);
        }
      },
      release() {
        if (!open) return;
        open = false;
        reservations.delete(held);
      },
    };
  }
  return { reserve, jobsByIp, reservations };
}
