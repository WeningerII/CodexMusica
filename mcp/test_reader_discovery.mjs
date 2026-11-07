// mcp/reader_discovery.js against its contract (mcp/DISCOVERY_V1.md) and the
// discovery_v1 wire fixtures (#656). The constants and tables are parsed out
// of the contract, so the module and the text can only move together; the
// codec is run over the fixture vectors the validator recomputes on its own.
// This file never imports the validator, and the validator never imports the
// module (checked below), so each stays the other's independent reading.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  DISCOVERY_CAUSES,
  DISCOVERY_LIMITS,
  DOMAINS,
  DiscoveryCodecError,
  F1_WHAT,
  LOGS,
  MEMBERSHIP_LOGS,
  RESETTABLE,
  RESOURCE_CAUSES,
  SEGMENT_FIELDS,
  STORE_CAUSES,
  TERMINAL_INPUTS,
  WORKER_CAUSES,
  buildSegment,
  causeMessage,
  checkEntry,
  cutComplete,
  digestStep,
  domainDigest,
  isDigest,
  requireInteger,
  segmentContent,
  wellFormedDeep,
} from './reader_discovery.js';
import {
  counterClock,
  deterministicRandomBytes,
  plantBefore,
  plantRecord,
  storeDirectory,
} from './reader_store_test_support.mjs';
import { ReaderJobStore } from './reader_job_store.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT = fs.readFileSync(path.join(HERE, 'DISCOVERY_V1.md'), 'utf8');
const FIXTURES = path.join(HERE, 'fixtures', 'discovery_v1');
const load = (rel) => JSON.parse(fs.readFileSync(path.join(FIXTURES, rel), 'utf8'));
const CODEC = load('good/codec_error_mapping.json');

function section(heading) {
  const start = CONTRACT.indexOf(`\n## ${heading}`);
  assert.ok(start >= 0, `the contract has "${heading}"`);
  const end = CONTRACT.indexOf('\n## ', start + 4);
  return CONTRACT.slice(start, end < 0 ? undefined : end);
}
const subsection = (heading) => {
  const start = CONTRACT.indexOf(`\n### ${heading}`);
  assert.ok(start >= 0, `the contract has "${heading}"`);
  const end = CONTRACT.slice(start + 5).search(/\n##+ /);
  return CONTRACT.slice(start, end < 0 ? undefined : start + 5 + end);
};
const tableRows = (text) =>
  text
    .split('\n')
    .filter((l) => l.startsWith('| ') && !/^\| -/.test(l))
    .slice(1)
    .map((l) => l.slice(2, -2).split(' | '));
const ticks = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const flat = (t) => t.replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------ the tables

test('the constants equal §3 of the contract, row for row', () => {
  const s3 = section('3. Hard limits').split('### 3.1')[0];
  const table = s3.slice(s3.indexOf('| Constant |'));
  const found = {};
  for (const [name, value] of tableRows(table.slice(0, table.indexOf('\n\n')))) {
    const names = ticks(name);
    // Only rows that name constants: `tail`, cursor numbers and the frame do not.
    if (
      !names.length ||
      !names.every((n) => /^[A-Z_]+$/.test(n)) ||
      ticks(name).join(', ') !== name.replace(/`/g, '')
    )
      continue;
    const numbers = [...value.matchAll(/\b\d+\b/g)].map((m) => Number(m[0]));
    names.forEach((n, i) => (found[n] = numbers[i]));
  }
  assert.deepEqual(found, { ...DISCOVERY_LIMITS }, 'every §3 constant, and only those');
  assert.ok(Object.isFrozen(DISCOVERY_LIMITS));
  // ENTRY_DEPTH and MEMBERSHIP_BYTES are single-sourced here and provisional
  // together (§2.1, §12 item 31): the contract says so in the same row.
  const depthRow = flat(s3).slice(flat(s3).indexOf('| `ENTRY_DEPTH` |'));
  assert.match(depthRow.slice(0, 400), /provisional until the #721 author/);
  const bytesRow = flat(s3).slice(flat(s3).indexOf('| `MEMBERSHIP_BYTES` |'));
  assert.match(bytesRow.slice(0, 400), /provisional with `ENTRY_DEPTH`/);
});

test('the log sets, domains and segment fields equal §2', () => {
  const logs = tableRows(subsection('2.3 Logs'));
  assert.deepEqual(
    logs.map((r) => ticks(r[0])[0]),
    LOGS
  );
  assert.deepEqual(
    logs.filter((r) => r[3] === 'yes').map((r) => ticks(r[0])[0]),
    RESETTABLE
  );
  const s23 = flat(subsection('2.3 Logs'));
  const membership = /((?:`[a-z_]+`(?:, | and ))+`[a-z_]+`) are the membership logs/.exec(s23);
  assert.ok(membership, '§2.3 names the membership logs');
  assert.deepEqual(ticks(membership[1]), MEMBERSHIP_LOGS);
  const s28 = flat(subsection('2.8 Cursor v2'));
  const terminal =
    /holds none of the terminal inputs\*\* ((?:`[a-z_]+`(?:, | and ))+`[a-z_]+`)/.exec(s28);
  assert.ok(terminal, '§2.8 names the terminal inputs');
  assert.deepEqual(ticks(terminal[1]), TERMINAL_INPUTS);
  const s22 = subsection('2.2 Ordered digest');
  const quoted = (domain) => JSON.stringify(domain);
  assert.ok(s22.includes(`log L: \`${quoted(DOMAINS.log(''))} + L\``), 'the log domain');
  assert.ok(s22.includes(`\`${quoted(DOMAINS.inventory)}\``), 'the inventory domain');
  assert.ok(s22.includes(`\`${quoted(DOMAINS.witness(''))} + m\``), 'the witness domain');
  const schema = /```\s*\n\s*(\{"version"[\s\S]*?)\n\s*```/.exec(subsection('2.5 Segments'))[1];
  assert.deepEqual(
    [...schema.matchAll(/"([a-z_]+)":/g)].map((m) => m[1]),
    SEGMENT_FIELDS
  );
});

// §8's two cause tables, as the contract states them, with a message that
// refers to another cause's ("the `digest_mismatch` message") resolved.
function causeTables() {
  const s8 = section('8. Refusals');
  const du = tableRows(s8.split('The causes:')[1].split('The `RESOURCE_LIMIT` causes')[0]);
  const rl = tableRows(s8.split('The `RESOURCE_LIMIT` causes')[1].split('\n\nEvery')[0]);
  const resolve = (rows, at) => {
    const text = Object.fromEntries(rows.map((r) => [ticks(r[0])[0], r[at]]));
    return (m) => {
      const ref = /^the `([a-z_]+)` message$/.exec(m);
      return ref ? text[ref[1]] : m;
    };
  };
  const duMessage = resolve(du, 4);
  const rlMessage = resolve(rl, 3);
  return {
    du: Object.fromEntries(
      du.map((r) => [
        ticks(r[0])[0],
        { rule: r[1], raised: r[2], log: r[3], message: duMessage(r[4]) },
      ])
    ),
    rl: Object.fromEntries(
      rl.map((r) => [ticks(r[0])[0], { log: r[2], message: rlMessage(r[3]) }])
    ),
  };
}

test("the cause tables and messages equal §8's", () => {
  const { du, rl } = causeTables();
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(du).map(([k, v]) => [k, { rule: v.rule, log: v.log, message: v.message }])
    ),
    JSON.parse(JSON.stringify(DISCOVERY_CAUSES))
  );
  assert.deepEqual(rl, JSON.parse(JSON.stringify(RESOURCE_CAUSES)));
  // The store's causes are the ones a worker never names.
  assert.deepEqual(
    Object.entries(du)
      .filter(([, v]) => /never a worker/.test(v.raised))
      .map(([k]) => k),
    STORE_CAUSES
  );
  assert.deepEqual(
    WORKER_CAUSES,
    Object.keys(du).filter((c) => !STORE_CAUSES.includes(c))
  );
  // §3's limits each have the cause §3 names for them.
  const s3 = flat(section('3. Hard limits').split('### 3.1')[0]);
  for (const cause of [
    'discovery_entry_bytes',
    'discovery_frame_seals',
    'discovery_chain_segments',
  ])
    assert.ok(s3.includes(`cause \`${cause}\``), cause);
  // Every Log column value is one of the three.
  for (const v of [...Object.values(DISCOVERY_CAUSES), ...Object.values(RESOURCE_CAUSES)])
    assert.ok(['required', 'optional', 'none'].includes(v.log));
});

test('causeMessage renders §8 from a stored reason, and only from one of its causes', () => {
  for (const [cause, v] of Object.entries(DISCOVERY_CAUSES))
    assert.equal(causeMessage({ code: 'DISCOVERY_UNAVAILABLE', cause, log: 'seen' }), v.message);
  for (const [cause, v] of Object.entries(RESOURCE_CAUSES))
    assert.equal(causeMessage({ code: 'RESOURCE_LIMIT', cause }), v.message);
  assert.equal(
    causeMessage({ code: 'DISCOVERY_UNAVAILABLE', cause: 'cursor_disagrees' }),
    causeMessage({ code: 'DISCOVERY_UNAVAILABLE', cause: 'digest_mismatch' })
  );
  for (const reason of [
    null,
    {},
    { code: 'RESOURCE_LIMIT', cause: 'segment_missing' },
    { code: 'DISCOVERY_UNAVAILABLE', cause: 'discovery_seen' },
    { code: 'DISCOVERY_UNAVAILABLE', cause: 'constructor' },
    { code: 'STORAGE_CORRUPT', cause: 'segment_corrupt' },
    { code: 'RESOURCE_LIMIT' },
  ])
    assert.equal(causeMessage(reason), null, JSON.stringify(reason));
});

// ------------------------------------------------------------ the codec

test('canonical form and ordered digest: the fixture vectors', () => {
  const fx = load('good/seal_sequence_two_logs.json');
  const canon = fx.canonical_vectors.map((v) => {
    const got = checkEntry(v.entry);
    assert.deepEqual(got, { canonical: v.canonical, bytes: v.bytes }, v.canonical);
    return got.canonical;
  });
  assert.equal(fx.vector_chain.domain, DOMAINS.log('variants'));
  let d = domainDigest(fx.vector_chain.domain);
  assert.equal(fx.vector_chain.digests[0], d, 'an empty sequence digests to d0');
  canon.forEach((c, i) => assert.equal(fx.vector_chain.digests[i + 1], (d = digestStep(d, c))));
  assert.throws(() => digestStep('ABC', '0'), TypeError);
  assert.throws(() => digestStep(d, 0), TypeError);
});

test("F1 and F2: each single-fault case's Node tag and <what>, and the controls", () => {
  for (const c of CODEC.single_fault) {
    const text = codecText(c);
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      assert.equal(c.node, 'JSON', `${c.name}: not one JSON value`);
      continue;
    }
    if (c.node === 'passes') {
      // `1.0` parses as the integer 1 in Node: it passes F1 and meets F5.
      assert.doesNotThrow(() => checkEntry(value), c.name);
      continue;
    }
    assert.throws(
      () => checkEntry(value),
      (e) => e instanceof DiscoveryCodecError && e.rule === c.node && e.what === (c.what ?? null),
      c.name
    );
  }
  for (const c of CODEC.controls) {
    const got = checkEntry(JSON.parse(codecText(c)));
    if (c.canonical !== undefined) assert.equal(got.canonical, c.canonical, c.name);
    if (c.canonical_bytes !== undefined) assert.equal(got.bytes, c.canonical_bytes, c.name);
  }
  assert.equal(
    checkEntry(JSON.parse(codecText(CODEC.controls[0]))).bytes,
    DISCOVERY_LIMITS.ENTRY_BYTES
  );
  // §3's other <what>s, which no JSON text can spell in Node.
  const cyclic = [];
  cyclic.push(cyclic);
  const cases = [
    [Number.NaN, F1_WHAT.nonfinite],
    [[Infinity], F1_WHAT.nonfinite],
    [[1.5], F1_WHAT.float],
    [[{}], F1_WHAT.object],
    [new Map(), F1_WHAT.object],
    [[cyclic], F1_WHAT.cyclic],
    [[undefined], F1_WHAT.other],
    [[1n], F1_WHAT.other],
    // eslint-disable-next-line no-sparse-arrays
    [[1, , 2], F1_WHAT.other],
    [['\udc00'], F1_WHAT.surrogate],
  ];
  for (const [v, what] of cases)
    assert.throws(
      () => checkEntry(v),
      (e) => e.rule === 'F1' && e.what === what,
      what
    );
  for (const what of Object.values(F1_WHAT))
    assert.ok(flat(section('3. Hard limits')).includes(`\`${what}\``), `§3 lists "${what}"`);
  // A multi-fault entry is refused; its tag is not pinned (§2.11 (d)).
  for (const c of CODEC.multi_fault.filter((m) => m.build))
    assert.throws(() => checkEntry(JSON.parse(codecText(c))), DiscoveryCodecError, c.name);
});

test('F2 is measured on the canonical form, however the entry was spaced', () => {
  const rt = CODEC.raw_transport;
  const padded = JSON.parse(codecText(rt.valid_padded));
  assert.equal(checkEntry(padded).bytes, rt.valid_padded.canonical_bytes);
  for (const c of rt.over_spaced) {
    assert.equal(Buffer.byteLength(codecText(c)), c.raw_bytes);
    assert.throws(
      () => checkEntry(JSON.parse(codecText(c))),
      (e) => e.rule === 'F2' && e.bytes === c.canonical_bytes
    );
  }
});

test('INTEGER_FIELD: the integer-only fields, never F1', () => {
  for (const c of CODEC.integer_fields)
    assert.throws(
      () => requireInteger(c.value, `${c.where}.${c.field}`),
      (e) => e.rule === c.tag && e.field === `${c.where}.${c.field}`,
      JSON.stringify(c)
    );
  for (const ok of [0, 1, 2 ** 53 - 1]) assert.equal(requireInteger(ok), ok);
  for (const bad of [-1, 2 ** 53, 0.5, '1', null, true, Number.NaN])
    assert.throws(
      () => requireInteger(bad),
      (e) => e.rule === 'INTEGER_FIELD'
    );
});

test('F4: every cut vector is complete, its tail is not, and a premature seal is refused', () => {
  const { SEGMENT_ENTRIES, SEGMENT_BYTES } = DISCOVERY_LIMITS;
  for (const v of load('good/seal_sequence_two_logs.json').cut_vectors) {
    const lengths = v.runs.flatMap(([bytes, times]) => Array(times).fill(bytes));
    const sum = (a, b) => lengths.slice(a, b).reduce((n, x) => n + x, 0);
    for (const [a, b] of v.segments) {
      const next = b < lengths.length ? lengths[b] : null;
      assert.equal(cutComplete({ count: b - a, bytes: sum(a, b) }, next), null, `${a}-${b}`);
      // One entry short of its cut: the dropped entry is the next, and it
      // fits (the cut held it), so the shorter seal is premature.
      if (b - a > 1)
        assert.equal(
          cutComplete({ count: b - a - 1, bytes: sum(a, b - 1) }, lengths[b - 1])?.fault,
          'premature'
        );
    }
    const [a, b] = v.tail;
    if (b > a)
      assert.equal(cutComplete({ count: b - a, bytes: sum(a, b) }, null)?.fault, 'premature');
  }
  // good/seal_completeness.json: one seal complete only because the next entry
  // does not fit, and one complete by its bytes.
  const [first, second] = load('good/seal_completeness.json').frames[0].discovery.seals;
  const bytes = (s) => s.entries.reduce((n, e) => n + checkEntry(e).bytes, 0);
  const nextOf = (s) => checkEntry(s.entries[0]).bytes;
  assert.equal(
    cutComplete({ count: first.entries.length, bytes: bytes(first) }, nextOf(second)),
    null
  );
  assert.equal(
    cutComplete({ count: first.entries.length, bytes: bytes(first) }, null)?.fault,
    'premature'
  );
  assert.equal(cutComplete({ count: second.entries.length, bytes: bytes(second) }, null), null);
  for (const [seal, fault] of [
    [{ count: 0, bytes: 0 }, 'count'],
    [{ count: SEGMENT_ENTRIES + 1, bytes: 1 }, 'count'],
    [{ count: 1, bytes: SEGMENT_BYTES + 1 }, 'bytes'],
    [{ count: 1.5, bytes: 1 }, 'count'],
  ])
    assert.equal(cutComplete(seal, null)?.fault, fault, JSON.stringify(seal));
  assert.equal(cutComplete({ count: SEGMENT_ENTRIES, bytes: 2048 }, null), null);
});

// Every seal of a good write fixture, built as a segment: the address and the
// byte length the fixture expects, with the chain's state carried across.
test("buildSegment: every good write fixture's segments, by address and bytes", () => {
  const rels = fs
    .readdirSync(path.join(FIXTURES, 'good'))
    .map((f) => `good/${f}`)
    .filter((rel) => load(rel).frames?.some((f) => f.expect?.segments?.length));
  assert.ok(rels.includes('good/seal_sequence_two_logs.json'));
  let built = 0;
  for (const rel of rels) {
    const fx = load(rel);
    const record = { id: fx.job_id, identity_hash: fx.identity_hash };
    let logs = structuredClone(fx.record?.discovery?.logs ?? {});
    let epoch = fx.record?.discovery?.epoch ?? null;
    for (const frame of fx.frames) {
      const d = frame.discovery;
      if (epoch !== null && d.epoch > epoch) logs = {};
      epoch = d.epoch;
      for (const r of d.resets ?? []) delete logs[r];
      const got = d.seals.map((compact) => {
        // A compact seal names its entries as a range of integers.
        const s = compact.entries_range
          ? {
              ...compact,
              entries: Array.from(
                { length: compact.entries_range[1] - compact.entries_range[0] },
                (_, i) => compact.entries_range[0] + i
              ),
            }
          : compact;
        const st = logs[s.log] ?? {
          head: null,
          segments: 0,
          count: 0,
          bytes: 0,
          digest: domainDigest(DOMAINS.log(s.log)),
        };
        const canon = s.entries.map((e) => checkEntry(e));
        const after = canon.reduce((x, c) => digestStep(x, c.canonical), st.digest);
        assert.equal(after, s.digest_after, `${rel}: the seal's digest recomputes`);
        const seg = buildSegment(
          record,
          epoch,
          s.log,
          st.head,
          st.count,
          s.entries,
          st.digest,
          after
        );
        assert.deepEqual(Object.keys(seg.segment), SEGMENT_FIELDS);
        assert.deepEqual(
          segmentContent(JSON.parse(seg.raw.toString('utf8')), {
            ...{ job_id: record.id, identity_hash: record.identity_hash, epoch, log: s.log },
          }).faults,
          []
        );
        logs[s.log] = {
          head: seg.address,
          segments: st.segments + 1,
          count: st.count + s.entries.length,
          bytes: st.bytes + canon.reduce((n, c) => n + c.bytes, 0),
          digest: after,
        };
        built++;
        return { log: s.log, address: seg.address, bytes: seg.raw.length };
      });
      assert.deepEqual(got, frame.expect.segments, `${rel}: the frame's segments`);
    }
  }
  assert.ok(built >= 5, `built ${built} segments`);
});

// The fixture's segment bytes for one entry text, as a Python writer would
// store them (the entry spliced in as its bytes).
function segmentBytes(entryBytes, fields = {}) {
  const head = {
    version: 1,
    kind: 'reader_discovery_segment',
    job_id: 'reader_codec',
    identity_hash: 'f'.repeat(64),
    epoch: 0,
    log: 'seen',
    previous_hash: null,
    first: 0,
    count: 1,
    digest_before: domainDigest(DOMAINS.log('seen')),
    ...fields,
  };
  const after = crypto
    .createHash('sha256')
    .update(Buffer.from(head.digest_before, 'hex'))
    .update(entryBytes)
    .digest('hex');
  const [pre, post] = JSON.stringify({ ...head, digest_after: after, entries: [] }).split(
    '"entries":[]'
  );
  return Buffer.concat([Buffer.from(`${pre}"entries":[`), entryBytes, Buffer.from(`]${post}`)]);
}
const fatal = (raw) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
const replacing = (raw) => JSON.parse(raw.toString('utf8'));
const EXPECT = { job_id: 'reader_codec', identity_hash: 'f'.repeat(64), epoch: 0, log: 'seen' };
const tags = (faults) => faults.map((f) => f.tag);

test("F3: a persisted segment's content faults, each tagged, in the order the scan meets them", () => {
  // Each single-fault entry Node detects, persisted: an F1 or F2 content fault.
  for (const c of CODEC.single_fault.filter((s) => ['F1', 'F2'].includes(s.node))) {
    const raw = segmentBytes(Buffer.from(codecText(c), 'utf8'));
    const { faults } = segmentContent(fatal(raw), EXPECT);
    assert.deepEqual(tags(faults), [c.node], c.name);
    assert.ok(faults.every((f) => f.rule === 'F3'));
  }
  assert.deepEqual(
    segmentContent(fatal(segmentBytes(Buffer.from('["control"]'))), EXPECT).faults,
    []
  );
  // The integer fields of a segment.
  for (const c of CODEC.integer_fields.filter((f) => f.where === 'segment')) {
    const { faults } = segmentContent(
      fatal(segmentBytes(Buffer.from('["x"]'), { [c.field]: c.value })),
      EXPECT
    );
    assert.ok(
      faults.some((f) => f.tag === 'INTEGER_FIELD' && f.field === c.field),
      c.field
    );
  }
  // A segment with two faults is refused; which comes first is not pinned.
  const two = CODEC.multi_fault.find((m) => m.where === 'segment');
  const raw = segmentBytes(Buffer.from(JSON.parse(JSON.stringify(two.text)), 'utf8'), {
    [two.field]: two.value,
  });
  assert.deepEqual(new Set(tags(segmentContent(fatal(raw), EXPECT).faults)), new Set(two.faults));
  // The schema: the record's own job, identity, epoch and log; the field order.
  const ok = fatal(segmentBytes(Buffer.from('["x"]')));
  for (const [field, value] of [
    ['job_id', 'reader_other'],
    ['identity_hash', 'e'.repeat(64)],
    ['epoch', 1],
    ['log', 'alt_seen'],
    ['version', 2],
    ['kind', 'reader_page'],
    ['previous_hash', 'X'],
    ['digest_before', null],
    ['count', 2],
  ])
    assert.ok(
      segmentContent({ ...ok, [field]: value }, EXPECT).faults.some((f) => f.field === field),
      field
    );
  const { entries, ...rest } = ok;
  assert.deepEqual(tags(segmentContent({ entries, ...rest }, EXPECT).faults), ['FIELDS']);
  assert.deepEqual(tags(segmentContent([], EXPECT).faults), ['JSON']);
  assert.deepEqual(tags(segmentContent(null, EXPECT).faults), ['JSON']);
  // The log is one of LOGS on its own, whether or not `expect` names one.
  const { log: _log, ...noLog } = EXPECT;
  assert.deepEqual(segmentContent(ok, noLog).faults, []);
  for (const expect of [noLog, EXPECT]) {
    const { faults } = segmentContent({ ...ok, log: 'not_a_log' }, expect);
    assert.deepEqual(
      faults.map((f) => [f.tag, f.field]),
      [['FIELD', 'log']]
    );
  }
});

test('persisted bytes: invalid UTF-8 is F3 under the fatal decode, and a replacing decode meets F5', () => {
  for (const c of CODEC.persisted_bytes) {
    const raw = segmentBytes(Buffer.from(c.entry_hex, 'hex'));
    assert.throws(() => fatal(raw), TypeError, 'the fatal decode refuses: F3 (JSON)');
    assert.deepEqual(c.store_required, { rule: 'F3', tag: 'JSON' });
    // The read-back: an address-valid segment holding a lone 0xFF byte.
    const rb = Buffer.from(c.read_back.store.segments[0].hex, 'hex');
    const address = crypto.createHash('sha256').update(rb).digest('hex');
    assert.deepEqual(c.read_back.addresses.seen, [address], 'F6 passes');
    assert.throws(() => fatal(rb), TypeError);
    // A replacing decode passes the content and meets F5 instead.
    const seg = replacing(rb);
    const rec = c.read_back.record;
    const content = segmentContent(seg, {
      job_id: rec.id,
      identity_hash: rec.identity_hash,
      epoch: rec.discovery.epoch,
      log: 'seen',
    });
    assert.deepEqual(content.faults, [], "the replacing decode's content passes");
    const after = content.canonical.reduce((d, x) => digestStep(d, x), seg.digest_before);
    assert.notEqual(
      after,
      seg.digest_after,
      `the replacing decode meets ${c.replacing_decode.rule}`
    );
    assert.equal(c.replacing_decode.rule, 'F5');
  }
});

test('the integral float 1.0 and the entry past the depth (bad/float_entry.json, bad/entry_over_depth.json)', () => {
  // Node parses 1.0 as 1: F1 passes, and the digest a Python writer computed
  // over the bytes `1.0` does not recompute (F5).
  const x = CODEC.cross_language;
  const parsed = JSON.parse(x.text);
  assert.equal(JSON.stringify(parsed), x.node.parsed);
  assert.doesNotThrow(() => checkEntry(parsed));
  assert.equal(x.node.rule, 'F5');
  const seal = load('bad/float_entry.json').frames[0].discovery.seals[0];
  assert.equal(seal.entries[1], 1);
  const after = seal.entries.reduce(
    (d, e) => digestStep(d, checkEntry(e).canonical),
    seal.digest_before
  );
  assert.notEqual(after, seal.digest_after, 'F5');
  const deep = load('bad/entry_over_depth.json');
  assert.throws(
    () => checkEntry(deep.entry),
    (e) => e.rule === 'F1' && e.what === F1_WHAT.depth
  );
  assert.doesNotThrow(() => checkEntry(deep.control));
  const stored = deep.read_back.store.segments[0];
  assert.deepEqual(
    tags(
      segmentContent(stored, {
        job_id: stored.job_id,
        identity_hash: stored.identity_hash,
        epoch: 0,
        log: deep.log,
      }).faults
    ),
    ['F1']
  );
  // The depth is the count of nested arrays: ENTRY_DEPTH of them pass.
  let v = 0;
  for (let i = 0; i < DISCOVERY_LIMITS.ENTRY_DEPTH; i++) v = [v];
  assert.doesNotThrow(() => checkEntry(v));
  assert.throws(
    () => checkEntry([v]),
    (e) => e.what === F1_WHAT.depth
  );
});

// ------------------------------------------------------------ admission

test("wellFormedDeep: the fixture's admission cases, held to their outcomes", () => {
  const ad = CODEC.admission;
  for (const c of ad.refused)
    assert.equal(wellFormedDeep(JSON.parse(c.body).declaration_set), false, `${c.name}: refused`);
  for (const c of ad.admitted)
    assert.equal(wellFormedDeep(JSON.parse(c.body).declaration_set), true, `${c.name}: admitted`);
  assert.equal(wellFormedDeep(JSON.parse(ad.stored_request.request).declaration_set), false);
  assert.ok(ad.refused.length >= 2 && ad.admitted.length >= 1);
  // Strings and keys at any depth; numbers and the rest pass.
  assert.equal(wellFormedDeep({ a: [{ b: ['ok', { '\ud800': 1 }] }] }), false);
  assert.equal(wellFormedDeep([1, true, null, { a: 'ok' }]), true);
  // Deeper than any call stack: the walk is iterative.
  let deep = ['\ud800'];
  for (let i = 0; i < 200_000; i++) deep = [deep];
  assert.equal(wellFormedDeep(deep), false);
  // Parsed JSON cannot be cyclic, but a cyclic or shared value still ends.
  const cyclic = { a: ['ok'] };
  cyclic.a.push(cyclic);
  assert.equal(wellFormedDeep(cyclic), true);
  cyclic.b = '\udfff';
  assert.equal(wellFormedDeep(cyclic), false);
});

// ------------------------------------------------------------ independence

// Every module a file names: `import … from`, `export … from`, a bare
// side-effect `import '…'`, a dynamic `import(…)` and a `require(…)`.
const importsOf = (file) =>
  [
    ...fs
      .readFileSync(file, 'utf8')
      .matchAll(
        /^\s*(?:import|export)\b[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]|\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]/gm
      ),
  ].map((m) => m[1] ?? m[2] ?? m[3]);

test('the validator and the builders import nothing from mcp/reader_*.js, and the module nothing but node:', () => {
  const validator = path.join(HERE, 'test_discovery_v1_fixtures.mjs');
  const builders = path.join(FIXTURES, 'builders.mjs');
  for (const file of [validator, builders])
    for (const spec of importsOf(file))
      assert.ok(!/reader_[a-z_]+\.js$/.test(spec), `${path.basename(file)} imports ${spec}`);
  assert.ok(importsOf(validator).includes('./fixtures/discovery_v1/builders.mjs'));
  const module = path.join(HERE, 'reader_discovery.js');
  assert.deepEqual(importsOf(module), ['node:buffer', 'node:crypto']);
  // It names Buffer only by that import, never the global.
  assert.ok(!/\bglobalThis\b|\bprocess\b/.test(fs.readFileSync(module, 'utf8')));
  // Nor does any of them reach the others by a dynamic import or a require.
  for (const file of [validator, builders, module])
    assert.ok(
      !/\bimport\s*\(|\brequire\s*\(/.test(fs.readFileSync(file, 'utf8')),
      path.basename(file)
    );
  // The scan sees every form of import, so none can slip past it.
  const probe = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'imports-')), 'probe.mjs');
  fs.writeFileSync(
    probe,
    [
      "import 'node:fs';",
      "import a from './a.js';",
      "export { b } from './b.js';",
      "const c = await import('./c.js');",
      "const d = require('./d.js');",
    ].join('\n')
  );
  try {
    assert.deepEqual(importsOf(probe), ['node:fs', './a.js', './b.js', './c.js', './d.js']);
  } finally {
    fs.rmSync(path.dirname(probe), { recursive: true, force: true });
  }
});

// ------------------------------------------------------------ test support

test('test support: a planted record is one the store loads, and a plant on a live store is a foreign write', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-discovery-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const now = counterClock(1_000_000, 1000);
  const store = new ReaderJobStore({ directory, now });
  const job = store.create({
    viewer: 'viewer-a',
    idempotency_key: 'k',
    identity: { snapshot: 's', revision: 'r', engine: 'e', declarations: 'none' },
    request: { layers: ['sound'] },
  });
  const root = storeDirectory(directory);
  const record = JSON.parse(
    fs.readFileSync(path.join(root, 'records', `${job.record.id}.json`), 'utf8')
  );
  // Planted on the live store, a changed field is read by the next lock entry.
  const changed = { ...record, priority: 'planted' };
  const seg = buildSegment(
    record,
    0,
    'seen',
    null,
    0,
    [['x']],
    domainDigest(DOMAINS.log('seen')),
    digestStep(domainDigest(DOMAINS.log('seen')), '["x"]')
  );
  const planted = plantRecord(directory, changed, [seg.raw]);
  assert.deepEqual(
    planted.pages.map((p) => p.address),
    [seg.address]
  );
  assert.ok(fs.existsSync(path.join(root, 'pages', `${seg.address}.json`)));
  assert.equal(store.inspect(job.record.id).priority, 'planted', 'the next lock entry reloads');
  store.close?.();
  // Planted before any instance: the first constructor loads it.
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-discovery-'));
  t.after(() => fs.rmSync(fresh, { recursive: true, force: true }));
  const gz = plantBefore(fresh, record, [seg.raw], { gzip: true });
  assert.equal(gz.record.record_digest, record.record_digest, "the digest is the store's own");
  const second = new ReaderJobStore({ directory: fresh, now, gzip: true });
  assert.equal(second.inspect(job.record.id).id, job.record.id);
  second.close?.();
  assert.throws(() => plantRecord(path.join(fresh, 'nowhere'), record), /plantBefore/);
});

test('test support: one random counter per draw size, and a counter clock', () => {
  const a = deterministicRandomBytes();
  const b = deterministicRandomBytes();
  const first32 = a(32);
  a(12);
  a(16);
  a(16);
  assert.deepEqual(a(32), (b(32), b(32)), 'other sizes never move the 32-byte sequence');
  assert.notDeepEqual(first32, a(32));
  assert.equal(a(48).length, 48);
  assert.deepEqual(deterministicRandomBytes()(32), first32, 'reproducible');
  assert.throws(() => a(-1), RangeError);
  const tick = counterClock(5000, 1000);
  assert.deepEqual([tick(), tick(), tick()], [5000, 6000, 7000]);
});

// The codec fixture's input forms (its README): a text, or a build.
function codecText(input) {
  if (typeof input.text === 'string') return input.text;
  const b = input.build;
  const a = (n) => 'a'.repeat(n);
  if (Object.hasOwn(b, 'string')) return JSON.stringify(a(b.string));
  if (Object.hasOwn(b, 'object_string')) return `[{"a":"${a(b.object_string)}"}]`;
  if (Object.hasOwn(b, 'surrogate_string')) return `["\\ud800${a(b.surrogate_string)}"]`;
  const ws = ' \t\r\n';
  const pad = Array.from({ length: b.pad }, (_, i) => ws[i % 4]).join('');
  const tokens = [...(b.lead === null ? [] : [String(b.lead)]), ...Array(b.zeros).fill('0')];
  return `[${pad}${tokens.join(`${pad},${pad}`)}${pad}]`;
}

// BB8 6701778607, items 4-8: the mutants of the module this suite let live.
// Each test below fails under its mutant.

test('F1: a sub-array shared by two places is a DAG, not a cycle (item 4)', () => {
  const a = ['x', [1]];
  assert.deepEqual(checkEntry([a, a]), { canonical: '[["x",[1]],["x",[1]]]', bytes: 21 });
  const b = [a];
  assert.equal(checkEntry([b, [b, a]]).canonical, '[[["x",[1]]],[[["x",[1]]],["x",[1]]]]');
  // A real cycle is still one.
  const c = [1];
  c.push(c);
  assert.throws(() => checkEntry([c]), { rule: 'F1', what: F1_WHAT.cyclic });
});

test('F1: an Array subclass or a null-prototype array is a value of another type (§3(d), item 5)', () => {
  class Sub extends Array {}
  const sub = Sub.from([1, 2]);
  const bare = Object.setPrototypeOf([1, 2], null);
  assert.ok(Array.isArray(sub) && Array.isArray(bare));
  for (const v of [sub, bare]) {
    assert.throws(() => checkEntry(v), { rule: 'F1', what: F1_WHAT.other });
    assert.throws(() => checkEntry(['ok', [v]]), { rule: 'F1', what: F1_WHAT.other });
  }
});

test('F5: a digest is lowercase hex; an uppercase one is refused (§2.2, item 6)', () => {
  const lower = domainDigest('codexmusica.reader.discovery.v1\nseen');
  const upper = lower.toUpperCase();
  assert.ok(lower !== upper && isDigest(lower));
  assert.equal(isDigest(upper), false);
  assert.throws(() => digestStep(upper, '1'), TypeError);
  const ok = fatal(segmentBytes(Buffer.from('["x"]')));
  for (const field of ['digest_before', 'digest_after', 'previous_hash'])
    assert.deepEqual(
      segmentContent({ ...ok, [field]: upper }, EXPECT).faults.map((f) => [f.tag, f.field]),
      [['FIELD', field]],
      field
    );
});

test('a negative epoch, first, count or byte count is refused as that field (item 7)', () => {
  const ok = fatal(segmentBytes(Buffer.from('["x"]')));
  const { epoch: _epoch, ...anyEpoch } = EXPECT;
  const faults = (field) =>
    segmentContent({ ...ok, [field]: -1 }, anyEpoch).faults.map((f) => [f.tag, f.field]);
  assert.deepEqual(faults('epoch'), [['INTEGER_FIELD', 'epoch']]);
  assert.deepEqual(faults('first'), [['INTEGER_FIELD', 'first']]);
  assert.deepEqual(faults('count'), [
    ['INTEGER_FIELD', 'count'],
    ['FIELD', 'count'],
  ]);
  // cutComplete: a negative byte count is a bytes fault, never a premature
  // seal, and never complete, even at a full count.
  const { SEGMENT_ENTRIES } = DISCOVERY_LIMITS;
  for (const count of [5, SEGMENT_ENTRIES]) {
    const error = cutComplete({ count, bytes: -1 });
    assert.ok(error instanceof DiscoveryCodecError, `count ${count}: refused`);
    assert.deepEqual([error.rule, error.fault], ['F4', 'bytes'], `count ${count}`);
  }
  assert.equal(cutComplete({ count: SEGMENT_ENTRIES, bytes: 0 }), null);
});

test("F3: each entry fault carries the entry's index (item 8)", () => {
  const ok = fatal(segmentBytes(Buffer.from('["x"]')));
  const { faults } = segmentContent({ ...ok, count: 4, entries: ['x', 1.5, 'y', {}] }, EXPECT);
  assert.deepEqual(
    faults.map((f) => [f.rule, f.tag, f.what, f.index]),
    [
      ['F3', 'F1', F1_WHAT.float, 1],
      ['F3', 'F1', F1_WHAT.object, 3],
    ]
  );
});
