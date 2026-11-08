// #656: preparation for an explicitly selected worker. Deliberately not wired
// into the scheduler: C1 and empty record fields are not rollout eligibility.
import path from 'node:path';

const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const keys = (v, names) =>
  object(v) && Object.keys(v).sort().join(',') === [...names].sort().join(',');
const refuse = (message) => Object.assign(new Error(message), { code: 'STALE_READING' });
const mismatch = (message) =>
  Object.assign(new Error(message), {
    code: 'DISCOVERY_UNAVAILABLE',
    cause: 'cursor_disagrees',
    log: null,
  });

// `record` is the result of store.workerPayload(), not a caller checkpoint.
// null selection leaves the existing adapter untouched. The rollout owner must
// supply a verified selection; this helper does not determine one.
export function prepareReaderBootstrap({ selectedWorker = null, record }) {
  if (selectedWorker === null) return null;
  if (!['legacy', 'v2'].includes(selectedWorker))
    throw new TypeError('Unknown reader worker selection');
  if (!object(record)) throw new TypeError('A persisted reader payload is required');
  const cursor = record.cursor;
  const discovery = record.discovery;
  if (selectedWorker === 'legacy') {
    if (cursor?.contract_version === 2 || discovery != null)
      throw refuse('Discovery state cannot resume on the selected legacy worker.');
    return {};
  }
  if (typeof record.id !== 'string' || !record.id)
    throw refuse('The persisted job identity is missing.');
  if (cursor === null) {
    // A zero-record checkpoint is still durable work. Attempts and leases are
    // not evidence: a first lease or a retry before its first commit is fresh.
    if (
      discovery != null ||
      record.generation !== 0 ||
      record.page_count !== 0 ||
      record.evidence_count !== 0 ||
      record.page_index_hash !== null ||
      record.checkpoint_hash !== null ||
      record.manifest_hash !== null ||
      !Array.isArray(record.page_refs) ||
      record.page_refs.length !== 0 ||
      !Array.isArray(record.page_paths) ||
      record.page_paths.length !== 0
    )
      throw refuse('A missing cursor cannot bootstrap over prior durable work.');
    return {
      discovery: { version: 1, summary: { epoch: 0, logs: {} }, paths: {} },
      discovery_job_id: record.id,
    };
  }
  if (!object(cursor) || cursor.contract_version !== 2)
    throw refuse('The selected v2 worker requires a v2 cursor; no migration is permitted.');
  const cd = cursor.discovery;
  if (
    !keys(discovery, ['version', 'summary', 'paths']) ||
    discovery.version !== 1 ||
    !keys(discovery.summary, ['epoch', 'logs']) ||
    !object(discovery.paths) ||
    !object(cd) ||
    cd.version !== 1 ||
    !object(cd.logs) ||
    !object(discovery.summary.logs) ||
    cd.epoch !== discovery.summary.epoch
  )
    throw mismatch('The committed v2 cursor and discovery payload do not match.');
  const names = Object.keys(cd.logs).sort();
  if (
    names.join(',') !== Object.keys(discovery.summary.logs).sort().join(',') ||
    names.join(',') !== Object.keys(discovery.paths).sort().join(',')
  )
    throw mismatch('The committed v2 log names do not match.');
  for (const name of names) {
    const st = discovery.summary.logs[name],
      c = cd.logs[name],
      files = discovery.paths[name];
    if (
      !object(st) ||
      !object(c) ||
      c.sealed !== st.count ||
      c.sealed_digest !== st.digest ||
      !Array.isArray(files) ||
      files.length !== st.segments ||
      files.some((p) => typeof p !== 'string' || !path.isAbsolute(p)) ||
      (files.length ? path.basename(files.at(-1), '.json') : null) !== st.head
    )
      throw mismatch('The committed v2 log summary and ordered paths do not match.');
  }
  // Keep committed epochs, tails and path order unchanged. No empty-state
  // reconstruction here: internal epoch transitions are producer checkpoints.
  return { discovery, discovery_job_id: record.id };
}
