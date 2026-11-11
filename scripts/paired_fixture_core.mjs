// Synthetic capacity fixtures only. No production identity override or recovery.
import { randomBytes, createHash } from 'node:crypto';

export const PROTOCOL = 'paired-decoded-fixtures-v2';
export const json = (value) => JSON.stringify(value);
export const bytes = (value) => Buffer.byteLength(json(value));
export const sha = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => {
  throw new Error(message);
};
function maximum(accepts) {
  let lo = 1,
    hi = 2;
  if (!accepts(lo)) fail('invalid schema lower bound');
  while (accepts(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > 65536) fail('unbounded fixture schema');
  }
  while (lo + 1 < hi) {
    const n = Math.floor((lo + hi) / 2);
    if (accepts(n)) lo = n;
    else hi = n;
  }
  return lo;
}
export function limits(d) {
  return {
    count: d.count,
    maxLines: maximum((n) => d.schema.safeParse(Array(n).fill('x')).success),
    maxChars: maximum((n) => d.schema.safeParse(['x'.repeat(n)]).success),
    worker: d.worker,
    declaration: d.declaration,
    decoded: d.decoded,
    wire: d.wire,
  };
}
export function generate(d) {
  const bounds = limits(d);
  const noise = (n) => {
    if (n < 0) fail('negative padding');
    return randomBytes(Math.ceil(n * 0.75))
      .toString('base64')
      .slice(0, n);
  };
  const records = [];
  const created = Date.now();
  for (let i = 0; i < bounds.count; i++) {
    const draft = Array.from(
      { length: bounds.maxLines },
      () => noise(bounds.maxChars - 1) + '\u0100'
    );
    const replay = Array.from(
      { length: bounds.maxLines },
      () => noise(bounds.maxChars - 1) + '\u0100'
    );
    const decl = { writer: 'interview', title: `capacity cache ${i}`, capacity_padding: '' };
    decl.capacity_padding = noise(bounds.declaration - bytes(decl) - 1);
    const journal = (lines) => {
      const worker = {
        version: 1,
        input_draft: replay,
        accepted_lines: lines,
        answered: { propose: [], propose_group: [] },
        pending: null,
        capacity_padding: '',
      };
      worker.capacity_padding = noise(bounds.worker - bytes(worker) - 1);
      return { ...worker, connector_declarations: decl };
    };
    records.push({
      key: `capacity:${i}`,
      run_id: 'run_' + randomBytes(32).toString('hex'),
      revision: 1,
      updated_at: created,
      status: 'journal_capacity',
      draft,
      replay_draft: replay,
      state: journal(draft),
      checkpoint: journal(replay),
      decl,
      capacity_fixture: true,
    });
  }
  const common = { protocol: PROTOCOL, bounds, records };
  validateCommon(common, d);
  return common;
}
export function validateCommon(common, d) {
  if (common.protocol !== PROTOCOL || json(common.bounds) !== json(limits(d)))
    fail('fixture schema/limits differ');
  if (!Array.isArray(common.records) || common.records.length !== d.count)
    fail('fixture count differs');
  const ids = new Set();
  for (const [i, row] of common.records.entries()) {
    if (
      row.key !== `capacity:${i}` ||
      !/^run_[a-f0-9]{64}$/.test(row.run_id) ||
      ids.has(row.run_id) ||
      row.revision !== 1 ||
      !Number.isSafeInteger(row.updated_at) ||
      row.status !== 'journal_capacity' ||
      row.capacity_fixture !== true
    )
      fail('fixture record identity differs');
    ids.add(row.run_id);
    for (const lines of [row.draft, row.replay_draft]) {
      d.schema.parse(lines);
      if (
        lines.length !== common.bounds.maxLines ||
        lines.some((s) => s.length !== common.bounds.maxChars)
      )
        fail('undersized draft fixture');
    }
    if (bytes(row.decl) < 0.99 * d.declaration || bytes(row.decl) > d.declaration)
      fail('declaration capacity differs');
    for (const [field, lines] of [
      ['state', row.draft],
      ['checkpoint', row.replay_draft],
    ]) {
      const state = row[field];
      if ('connector_semantic_identity' in state) fail('decoded fixture carries source identity');
      if (
        json(state.connector_declarations) !== json(row.decl) ||
        json(state.accepted_lines) !== json(lines) ||
        json(state.input_draft) !== json(row.replay_draft)
      )
        fail('decoded fixture contents differ');
      d.capacity(state);
      const { connector_declarations: _declarations, ...worker } = state;
      if (bytes(worker) < 0.99 * d.worker || bytes(worker) > d.worker || bytes(state) > d.decoded)
        fail('worker capacity differs');
    }
  }
}
export function encode(common, d) {
  validateCommon(common, d);
  const semantic = d.identity();
  if (!/^[a-f0-9]{64}$/.test(semantic)) fail('missing genuine semantic identity');
  let workerMin = Infinity,
    workerMax = 0,
    declarationMin = Infinity;
  const evidence = [];
  const records = common.records.map((row) => {
    const out = { ...row };
    declarationMin = Math.min(declarationMin, bytes(row.decl));
    for (const field of ['state', 'checkpoint']) {
      const state = row[field];
      const wire = d.encode(state);
      const decoded = d.decode(wire);
      if (json(decoded) !== json(state)) fail('genuine codec changed decoded JSON bytes');
      const envelope = JSON.parse(wire);
      if (envelope.semantic_identity !== semantic || d.identity() !== semantic)
        fail('semantic identity changed');
      if (bytes(wire) > d.wire || bytes(state) > d.decoded) fail('encoded capacity differs');
      const { connector_declarations: _declarations, ...worker } = state;
      workerMin = Math.min(workerMin, bytes(worker));
      workerMax = Math.max(workerMax, bytes(worker));
      evidence.push({
        key: row.key,
        field,
        decoded_sha256: sha(json(decoded)),
        wire_sha256: sha(wire),
        wire_bytes: Buffer.byteLength(wire),
        serialized_wire_bytes: bytes(wire),
      });
      out[field] = wire;
    }
    return out;
  });
  return {
    prepared: {
      version: 1,
      maxLines: common.bounds.maxLines,
      maxChars: common.bounds.maxChars,
      workerMin,
      workerMax,
      declarationMin,
      records,
    },
    proof: {
      protocol: PROTOCOL,
      semantic_identity: semantic,
      common_sha256: sha(json(common)),
      evidence,
    },
  };
}
export function compareEncoded(a, b) {
  if (
    a.proof.common_sha256 !== b.proof.common_sha256 ||
    a.prepared.records.length !== b.prepared.records.length
  )
    fail('different common corpus');
  const mask = (result) => ({
    ...result.prepared,
    records: result.prepared.records.map((row) => {
      const out = { ...row };
      delete out.state;
      delete out.checkpoint;
      return out;
    }),
  });
  if (json(mask(a)) !== json(mask(b))) fail('prepared metadata differs');
  for (let i = 0; i < a.prepared.records.length; i++) {
    for (const field of ['state', 'checkpoint']) {
      const left = a.prepared.records[i][field],
        right = b.prepared.records[i][field];
      const x = JSON.parse(left),
        y = JSON.parse(right);
      if (
        x.semantic_identity !== a.proof.semantic_identity ||
        y.semantic_identity !== b.proof.semantic_identity
      )
        fail('unbound semantic identity');
      delete x.semantic_identity;
      delete y.semantic_identity;
      if (
        json(x) !== json(y) ||
        Buffer.byteLength(left) !== Buffer.byteLength(right) ||
        bytes(left) !== bytes(right)
      )
        fail('unexpected envelope or wire-length difference');
    }
  }
}
