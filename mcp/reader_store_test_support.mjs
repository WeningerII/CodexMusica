// Test support for the reader store's persisted-discovery tests (#656). Not a
// test file: the store tests import it, and nothing the server runs does.
//
// - plantRecord / plantBefore write a job record and its segment bytes into a
//   store directory the way the store itself lays them out, as a writer
//   other than this instance would (a foreign write: the generation moves),
//   so a test can hold the store to records `store.create` cannot produce.
// - deterministicRandomBytes, counterClock and FIXED_DATE make a run
//   reproducible: one counter per draw size, so a step that takes the lock
//   more often (more 12- and 16-byte draws) leaves every persisted 32-byte
//   draw where it was.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildSegment } from './reader_discovery.js';

const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
// The store's canonical(): sorted keys, no whitespace (reader_job_store.js).
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
}

const OBJECT_DIRS = ['records', 'pages', 'indexes', 'checkpoints', 'manifests', 'definitions'];
// The directory a ReaderJobStore constructed with `{ directory }` keeps its files in.
export const storeDirectory = (directory) => path.join(path.resolve(directory), 'reader-jobs-v1');

// A record as the store saves it: its body with `record_digest` over the
// store's canonical form. Returns the record written.
function writeRecord(root, record) {
  const { record_digest: _old, ...body } = record;
  const saved = { ...body, record_digest: sha(canonical(body)) };
  fs.writeFileSync(path.join(root, 'records', `${saved.id}.json`), JSON.stringify(saved), {
    mode: 0o600,
  });
  return saved;
}

// A page object (a discovery segment) by its plain bytes, stored at the
// sha256 of those bytes, gzipped as the store's pages rule would when `gzip`
// is set and the compressed form is smaller, with the format marker first.
function writePage(root, raw, gzip) {
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf8');
  const address = sha(bytes);
  let stored = bytes;
  if (gzip) {
    const compressed = zlib.gzipSync(bytes);
    if (compressed.length < bytes.length) stored = compressed;
  }
  if (stored !== bytes) {
    const marker = path.join(root, 'store-format.json');
    if (!fs.existsSync(marker))
      fs.writeFileSync(marker, JSON.stringify({ min_reader: 'A' }), { mode: 0o600 });
  }
  fs.writeFileSync(path.join(root, 'pages', `${address}.json`), stored, { mode: 0o600 });
  return { address, bytes: bytes.length, stored: stored.length };
}

// A foreign writer's mark: the next lock entry of any instance reloads.
function bumpGeneration(root) {
  const file = path.join(root, 'generation');
  let generation = 0;
  if (fs.existsSync(file)) generation = JSON.parse(fs.readFileSync(file, 'utf8')).generation;
  fs.writeFileSync(file, JSON.stringify({ generation: generation + 1 }), { mode: 0o600 });
  return generation + 1;
}

// Plants a record and its segments into a store that exists (an instance has
// been constructed on `directory`). `segments` are plain segment bytes
// (Buffers or strings), stored by their address; the returned `pages` list
// their addresses in order.
export function plantRecord(directory, record, segments = [], { gzip = false } = {}) {
  const root = storeDirectory(directory);
  if (!fs.existsSync(path.join(root, 'records')))
    throw new Error(`plantRecord: no reader store at ${root}; use plantBefore`);
  const pages = segments.map((raw) => writePage(root, raw, gzip));
  const saved = writeRecord(root, record);
  const generation = bumpGeneration(root);
  return { record: saved, pages, generation };
}

// The same, before any instance exists: it lays out the store's directories
// first, so the first constructor finds the record at its full read.
export function plantBefore(directory, record, segments = [], options = {}) {
  const root = storeDirectory(directory);
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  for (const dir of OBJECT_DIRS)
    fs.mkdirSync(path.join(root, dir), { recursive: true, mode: 0o700 });
  return plantRecord(directory, record, segments, options);
}

// A stand-in for crypto.randomBytes: for each size n, the first n bytes of
// sha256('inert' ‖ n ‖ k) for its k-th draw (blocks chained past 32 bytes).
// Install with `mock.method(crypto, 'randomBytes', deterministicRandomBytes())`.
export function deterministicRandomBytes(label = 'inert') {
  const counters = new Map();
  return (n) => {
    if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`randomBytes(${n})`);
    const k = counters.get(n) ?? 0;
    counters.set(n, k + 1);
    const blocks = [];
    for (let i = 0; blocks.length * 32 < n; i++)
      blocks.push(crypto.createHash('sha256').update(`${label}\0${n}\0${k}\0${i}`).digest());
    return Buffer.concat(blocks).subarray(0, n);
  };
}

// A counter clock for the store's injected `now` and `clock`: each call
// returns the next value, `step` ms apart.
export function counterClock(start = 0, step = 1000) {
  let t = start - step;
  return () => (t += step);
}

// The fixed wall-clock time both halves of the inertness golden run under
// (mock.timers with `apis: ['Date']`), never ticked.
export const FIXED_DATE = Date.UTC(2100, 0, 1);

// The segments a write fixture's frames seal (`fx`, the parsed fixture), as
// {address: plain bytes}: each log chained within its epoch, as the store's
// write path builds them (DISCOVERY_V1 §2.5).
export function sealedSegments(fx) {
  const owner = { id: fx.job_id, identity_hash: fx.identity_hash };
  const heads = new Map();
  const out = new Map();
  for (const frame of fx.frames) {
    const { epoch, seals } = frame.discovery;
    for (const seal of seals) {
      const key = `${epoch}/${seal.log}`;
      const built = buildSegment(
        owner,
        epoch,
        seal.log,
        heads.get(key) ?? null,
        seal.first,
        seal.entries,
        seal.digest_before,
        seal.digest_after
      );
      out.set(built.address, built.raw);
      heads.set(key, built.address);
    }
  }
  return out;
}
