// Builders shared by the discovery_v1 fixture validator and the store's tests
// (#656), so neither imports the other: the largest cursor §3.1's inputs
// allow, padding past it to an exact size, and the named cursor cases of
// bad/cursor_over_bound.json. They import nothing from mcp/reader_*.js, so the
// validator stays an independent reading of the contract.
import crypto from 'node:crypto';

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const clone = (value) => JSON.parse(JSON.stringify(value));
// The store's canonical(): sorted keys, no whitespace (reader_job_store.js).
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
    .join(',')}}`;
}
const cbytes = (v) => Buffer.byteLength(canonical(v));

// The largest cursor outside discovery and continuation that §3.1's inputs
// allow: every integer at 2^53 - 1, every method at its fullest with a refusal
// of exactly REFUSAL_BYTES (inputs.refusal: search_stub_resolution's own text,
// the largest construction in the call closure, which the dispatch never
// builds, §3.2), an incomplete reason for every schema, every schema refused,
// and the widest witness.
export function largestCursor(inp) {
  const id = (i) => `shared_sound:${sha(`method ${i}`)}`.slice(0, inp.method_id_bytes);
  const name = (i) =>
    `schema_${i}_${'n'.repeat(inp.schema_name_bytes)}`.slice(0, inp.schema_name_bytes);
  const refusal = inp.refusal;
  const I = inp.integer;
  const entry = {
    candidates: I,
    coverage: 'answered',
    false: I,
    figure_counts: { false: I, true: I, undecided: I },
    first_reading_only: I,
    refusal,
    refused_questions: I,
    true: I,
    undecided: I,
    unreadable_tokens: I,
  };
  const names = Array.from({ length: inp.schemas }, (_, i) => name(i));
  return {
    contract_version: 2,
    identity_hash: 'f'.repeat(64),
    phase: inp.phase,
    method_index: I,
    candidate: I,
    emission: I,
    sequence: I,
    counters: { candidates: I, evidence_records: I, true: I, false: I, undecided: I },
    methods: Object.fromEntries(
      Array.from({ length: inp.methods }, (_, i) => [id(i), clone(entry)])
    ),
    done: false,
    incomplete: Object.fromEntries(names.map((n) => [n, inp.incomplete_reason])),
    refused_schemas: names,
    witness: {
      version: 1,
      epoch: I,
      method_id: id(0),
      fields: Array.from({ length: inp.witness_fields }, () => 'a'.repeat(inp.witness_field_bytes)),
      count: I,
      digest: 'f'.repeat(64),
    },
  };
}
// Padding past the largest cursor: methods the registry does not have,
// `pad:<k>` holding {candidates: 0}, then one whose name is cut to make the
// size exact.
export function padTo(cursor, target) {
  const c = clone(cursor);
  let k = 0;
  while (target - cbytes(c) >= 64) c.methods[`pad:${k++}`] = { candidates: 0 };
  const key = (n) => `pad:${'z'.repeat(n)}`;
  c.methods[key(0)] = { candidates: 0 };
  const n = target - cbytes(c);
  delete c.methods[key(0)];
  c.methods[key(n)] = { candidates: 0 };
  return c;
}
export function cursorCase(inp, name, cursorBytes) {
  const largest = largestCursor(inp);
  if (name === 'largest') return largest;
  if (name === 'at_the_bound') return padTo(largest, cursorBytes);
  if (name === 'one_byte_over') return padTo(largest, cursorBytes + 1);
  if (name === 'refusal_one_byte_over') {
    const c = clone(largest);
    c.methods[Object.keys(c.methods)[0]].refusal.detail += 'x';
    return c;
  }
  // A number W4 refuses (§2.8): past the safe range, below zero, not an integer.
  const numbers = {
    integer_past_the_safe_range: 2 ** 53,
    integer_below_zero: -1,
    number_not_an_integer: 0.5,
  };
  if (Object.hasOwn(numbers, name)) {
    const c = clone(largest);
    c.methods[Object.keys(c.methods)[0]].candidates = numbers[name];
    return c;
  }
  throw new Error(`unknown cursor case ${name}`);
}
