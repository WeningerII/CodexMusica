#!/usr/bin/env node
// check_engine_codec.js — the codec api/engine.json writes the two render
// tables with gives back exactly the references tables.
//
// scripts/_engine_codec.js writes TRADITION_SIGNATURES and DESCRIPTOR_DF as
// compact lines: the signatures against a dictionary of their own, the
// descriptor counts against the engine vocabulary (every word in the other
// engine lines' `descriptors` and `tokens` arrays, sorted). The encoder proves
// its own round trip before it returns, so a wrong line cannot be written; this
// gate holds the codec itself to the references files, independently of any
// build, and checks the properties the encoder's proof cannot see:
//
//   ROUND TRIP   the lines decoded give references/_descriptor_df.json .df
//                (the same tokens and counts) and
//                references/_tradition_signatures.json less its empty lists
//                (nonEmptySignatures, scripts/_page_tables.js), with no list
//                empty and every line one line of JSON
//   WALK ORDER   the vocabulary is the same whatever order the engine lines are
//                walked in (reversed, and shuffled with fixed seeds): the page
//                and Node must agree on it, and only the set may count
//   REGION       the inlined region, evaluated on its own as the page carries
//                it, decodes the same tables (it uses nothing outside itself)
//   REFUSALS     the encoder refuses `__proto__`, `constructor` and `prototype`
//                as an id or token, an empty list, a token the line format
//                cannot carry, and a count that is not a positive integer; the
//                decoder refuses a `__proto__` key in the DF remainder, a
//                signature line with fewer lists than ids, a count list whose
//                length is not the vocabulary's, and an index that names no
//                token
//
// Usage:  node scripts/check_engine_codec.js
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const P = require('./_page_tables.js');
const C = require('./_engine_codec.js');

const ROOT = path.join(__dirname, '..');
const REFS = path.join(ROOT, 'references');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(REFS, f), 'utf8'));

const failures = [];
const fail = (msg) => failures.push(msg);
// Whether fn throws an Error whose message matches re.
const refuses = (fn, re) => {
  try {
    fn();
  } catch (e) {
    return re.test(e.message);
  }
  return false;
};

const DF = readJson('_descriptor_df.json').df;
const SIGS = readJson('_tradition_signatures.json');
const NON_EMPTY = P.nonEmptySignatures(SIGS);

// The engine lines as api/engine.json splits them (the instruments in runs),
// less the two encoded tables: what the vocabulary is walked over.
const tables = P.engineTables(REFS);
const elements = [];
for (const n of P.ENGINE_TABLES) {
  if (n === 'TRADITION_SIGNATURES' || n === 'DESCRIPTOR_DF') continue;
  if (n !== 'INSTRUMENTS') elements.push([n, tables[n]]);
  else
    for (let i = 0; i < tables[n].length; i += P.ENGINE_RUN)
      elements.push([n, tables[n].slice(i, i + P.ENGINE_RUN)]);
}

// ── round trip ────────────────────────────────────────────────────────────────
const sameDf = (got, want) => {
  const gk = Object.keys(got),
    wk = Object.keys(want);
  if (gk.length !== wk.length) return `${gk.length} tokens against ${wk.length}`;
  const bad = wk.filter((k) => !Object.prototype.hasOwnProperty.call(got, k) || got[k] !== want[k]);
  return bad.length ? `${bad.length} counts differ (first: ${bad[0]})` : null;
};
const sameSigs = (got, want) => {
  const gk = Object.keys(got),
    wk = Object.keys(want);
  if (gk.length !== wk.length) return `${gk.length} ids against ${wk.length}`;
  const bad = wk.filter((k) => JSON.stringify(got[k]) !== JSON.stringify(want[k]));
  return bad.length ? `${bad.length} lists differ (first: ${bad[0]})` : null;
};

// The encoder checks its own round trip and throws when it fails; nothing
// below can run without its lines, so that is reported and the gate stops.
let encoded;
try {
  encoded = C.encodeDescriptorTables(elements, NON_EMPTY, DF);
} catch (e) {
  console.error(`✗ ROUND TRIP: the encoder refuses the references tables: ${e.message}`);
  process.exit(1);
}
const lines = encoded.map((e) => JSON.stringify(e));
for (const l of lines)
  if (/[\r\n]/.test(l)) fail(`ROUND TRIP: an encoded line spans lines: ${l.slice(0, 40)}…`);
const decoded = C.decodeEngineTables([...elements, ...lines.map((l) => JSON.parse(l))]);
{
  const d = sameDf(decoded.DESCRIPTOR_DF, DF);
  if (d) fail(`ROUND TRIP: DESCRIPTOR_DF decodes unlike references/_descriptor_df.json: ${d}`);
  const s = sameSigs(decoded.TRADITION_SIGNATURES, NON_EMPTY);
  if (s)
    fail(
      `ROUND TRIP: TRADITION_SIGNATURES decodes unlike references/_tradition_signatures.json less its empty lists: ${s}`
    );
  const empty = Object.keys(decoded.TRADITION_SIGNATURES).filter(
    (k) => !decoded.TRADITION_SIGNATURES[k].length
  );
  if (empty.length)
    fail(`ROUND TRIP: ${empty.length} decoded signature lists are empty (first: ${empty[0]})`);
}

// ── walk order ────────────────────────────────────────────────────────────────
const order = C.vocabOf(elements).order();
const sortedCopy = [...order].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
if (order.some((x, i) => x !== sortedCopy[i]))
  fail('WALK ORDER: the vocabulary is not in code-unit order');
// A fixed-seed shuffle (mulberry32), so a failure reproduces.
const shuffled = (list, seed) => {
  const out = list.slice();
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const orders = [
  ['reversed', elements.slice().reverse()],
  ...[1, 2, 3].map((seed) => [`shuffled (seed ${seed})`, shuffled(elements, seed)]),
];
for (const [how, els] of orders) {
  const o = C.vocabOf(els).order();
  if (o.length !== order.length || o.some((x, i) => x !== order[i]))
    fail(`WALK ORDER: the lines ${how} give another vocabulary`);
  const back = C.decodeEngineTables([...els, ...lines.map((l) => JSON.parse(l))]);
  if (sameDf(back.DESCRIPTOR_DF, DF))
    fail(`WALK ORDER: the lines ${how} decode another DESCRIPTOR_DF`);
}

// ── region ────────────────────────────────────────────────────────────────────
{
  const ctx = vm.createContext({});
  vm.runInContext(
    C.codecRegion() + '\nthis.codexVocab = codexVocab; this.codexDecodeSteps = codexDecodeSteps;',
    ctx,
    {
      filename: 'scripts/_engine_codec.js@inline',
    }
  );
  const vocab = ctx.codexVocab();
  for (const e of elements) vocab.walk(e[1]);
  const enc = {};
  for (const l of lines) {
    const [name, value] = JSON.parse(l);
    enc[name] = value;
  }
  const t = {};
  const steps = ctx.codexDecodeSteps(vocab, enc, t);
  let slices = 0;
  for (let r = steps.next(); !r.done; r = steps.next()) slices++;
  const d = sameDf(t.DESCRIPTOR_DF, DF),
    s = sameSigs(t.TRADITION_SIGNATURES, NON_EMPTY);
  if (d || s) fail(`REGION: the inlined region alone decodes differently: ${d || s}`);
  if (slices < 3) fail(`REGION: the decode yields ${slices} times; the page needs it in slices`);
  if (!/^[0-9a-f]{40}$/.test(C.codecSha())) fail('REGION: codecSha() is not a sha1');
}

// ── refusals ──────────────────────────────────────────────────────────────────
const firstSig = Object.keys(NON_EMPTY)[0];
const ENCODER = [
  [
    'an id __proto__',
    () => C.encodeDescriptorTables(elements, JSON.parse('{"__proto__": ["warm"]}'), DF),
    /__proto__/,
  ],
  [
    'an id constructor',
    () => C.encodeDescriptorTables(elements, { constructor: ['warm'] }, DF),
    /constructor/,
  ],
  [
    'a token prototype',
    () => C.encodeDescriptorTables(elements, { [firstSig]: ['prototype'] }, DF),
    /prototype/,
  ],
  [
    'a DF token __proto__',
    () => C.encodeDescriptorTables(elements, NON_EMPTY, JSON.parse('{"__proto__": 3}')),
    /__proto__/,
  ],
  [
    'a DF token constructor',
    () => C.encodeDescriptorTables(elements, NON_EMPTY, { constructor: 3 }),
    /constructor/,
  ],
  [
    'an empty list',
    () => C.encodeDescriptorTables(elements, { ...NON_EMPTY, [firstSig]: [] }, DF),
    /non-empty list/,
  ],
  [
    'an id with a dot',
    () => C.encodeDescriptorTables(elements, { 'a.b': ['warm'] }, DF),
    /cannot be written/,
  ],
  [
    'an id with a space',
    () => C.encodeDescriptorTables(elements, { 'a b': ['warm'] }, DF),
    /cannot be written/,
  ],
  [
    'a DF token with a comma',
    () => C.encodeDescriptorTables(elements, NON_EMPTY, { 'a,b': 3 }),
    /cannot be written/,
  ],
  [
    'a zero count',
    () => C.encodeDescriptorTables(elements, NON_EMPTY, { warm: 0 }),
    /not a positive count/,
  ],
  [
    'a fractional count',
    () => C.encodeDescriptorTables(elements, NON_EMPTY, { warm: 1.5 }),
    /not a positive count/,
  ],
];
for (const [what, fn, re] of ENCODER)
  if (!refuses(fn, re)) fail(`REFUSALS: the encoder accepts ${what}`);

const withLine = (name, edit) => {
  const els = lines.map((l) => JSON.parse(l));
  for (const e of els) if (e[0] === name) edit(e[1]);
  return [...elements, ...els];
};
const DECODER = [
  [
    'a DF remainder keyed __proto__',
    withLine('DESCRIPTOR_DF', (v) => (v.r = JSON.parse('{"__proto__": 3}'))),
    /__proto__/,
  ],
  [
    'a DF remainder token the vocabulary holds',
    withLine('DESCRIPTOR_DF', (v) => (v.r[order.find((k) => k in DF)] = 3)),
    /not usable/,
  ],
  [
    'one fewer signature list than ids',
    withLine('TRADITION_SIGNATURES', (v) => (v.l = v.l.split(' ').slice(0, -1).join(' '))),
    /ids against/,
  ],
  [
    'one fewer DF count than the vocabulary',
    withLine('DESCRIPTOR_DF', (v) => (v.a = v.a.split(',').slice(0, -1).join(','))),
    /against a vocabulary of/,
  ],
  [
    'an index past the dictionary',
    withLine(
      'TRADITION_SIGNATURES',
      (v) => (v.l = v.v.length.toString(36) + v.l.slice(v.l.indexOf(' ')))
    ),
    /names no token/,
  ],
  [
    'a zero count',
    withLine('DESCRIPTOR_DF', (v) => (v.a = v.a.replace(/^[^,]*/, '0'))),
    /not usable/,
  ],
  ['a missing line', [...elements, JSON.parse(lines[0])], /no DESCRIPTOR_DF line/],
];
for (const [what, els, re] of DECODER)
  if (!refuses(() => C.decodeEngineTables(els), re)) fail(`REFUSALS: the decoder accepts ${what}`);

// ── report ────────────────────────────────────────────────────────────────────
const gz = (s) => zlib.gzipSync(s, { level: 6 }).length;
const covered = Object.keys(DF).filter((k) => new Set(order).has(k)).length;
console.log(
  `engine codec: vocabulary ${order.length} words, covering ${covered} of ${Object.keys(DF).length} DF tokens ` +
    `(${Object.keys(encoded[1][1].r).length} in the remainder); ${Object.keys(NON_EMPTY).length} non-empty signature lists ` +
    `of ${Object.keys(SIGS).length}, ${encoded[0][1].v.length} tokens`
);
console.log(
  `  lines gzipped alone: TRADITION_SIGNATURES ${gz(lines[0])} B, DESCRIPTOR_DF ${gz(lines[1])} B; codec ${C.codecSha().slice(0, 12)}`
);
if (failures.length) {
  for (const f of failures) console.error('✗ ' + f);
  console.error(`check_engine_codec: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(
  `✓ round trip exact; vocabulary the same over ${orders.length} other walk orders; ` +
    `region decodes alone; ${ENCODER.length} encoder and ${DECODER.length} decoder refusals hold`
);
