// scripts/_engine_codec.js — how api/engine.json writes the two render tables,
// authored ONCE.
//
// TRADITION_SIGNATURES (references/_tradition_signatures.json) and DESCRIPTOR_DF
// (references/_descriptor_df.json .df) are read only from a card: the
// signature of a card's tradition, and how common each descriptor is when a
// recipe is ranked and compressed. The lazy page fetches them with the rest of
// the instrument engine, so each is written as one compact line rather than as
// plain JSON, which would be about 72 KB more of the file gzipped.
//
//   ["TRADITION_SIGNATURES", {"v": [tokens], "k": "ids", "l": "lists"}]
//     v  every token the table uses, the most used first (ties in code-unit
//        order). The table carries its own dictionary: tying it to the
//        engine's vocabulary (below) saves about 1 KB gzipped, not worth the
//        coupling.
//     k  the ids with a non-empty list, joined by ' '.
//     l  for each id in k, its tokens as base-36 indices into v joined by '.';
//        the lists joined by ' '.
//   An empty list is not written: the page strip drops it before this code
//   sees the table (nonEmptySignatures, scripts/_page_tables.js), and the
//   encoder refuses one.
//
//   ["DESCRIPTOR_DF", {"a": "counts", "r": {token: count}}]
//     a  for each entry of the engine vocabulary, in order, its count in
//        base 36, or '' when the table has no count for it; joined by ','.
//     r  the counts of the tokens the vocabulary does not hold.
//
// The engine vocabulary is the SET of every string in an array whose own key is
// `descriptors` or `tokens`, at any depth, in the other table lines of
// api/engine.json exactly as they are written (before the page fills the index
// fields back or merges the family parts; never the header, MERGE_PLAN or
// these two lines), sorted by code unit. The DF tokens are, nearly all of them,
// the engine's own descriptors, so the page already holds the words and the
// line need only say how often each occurs. Sorting makes the decode depend on
// which strings occur and never on the order the lines are walked in.
//
// Two contexts, one source, as with scripts/_merge.js:
//   - Node    : scripts/_page_tables.js encodes the lines (encodeDescriptorTables)
//               and the gates decode them (decodeEngineTables)
//   - Browser : scripts/build_html.js inlines the marked region into the lazy
//               page, whose Engine (src/app.js) walks each line it parses and
//               decodes the two tables in its idle slices
// codecSha() is the digest of that region. It is folded into the engine digest
// the page and the file both carry, so a page and an engine.json written by
// different codecs are refused as stale, never decoded wrongly.
'use strict';

/* @inline-start — the region between the markers is inlined verbatim into codex.html */
// The engine vocabulary: walk(value) adds the strings of every array whose own
// key is `descriptors` or `tokens` within value; order() is the set sorted by
// code unit, computed once.
function codexVocab() {
  const seen = new Set();
  let order = null;
  const walk = (value, key) => {
    if (Array.isArray(value)) {
      const words = key === 'descriptors' || key === 'tokens';
      for (const x of value)
        if (typeof x === 'string') {
          if (words && !seen.has(x)) {
            seen.add(x);
            order = null;
          }
        } else if (x !== null && typeof x === 'object') walk(x, null);
    } else if (value !== null && typeof value === 'object')
      for (const k of Object.keys(value)) walk(value[k], k);
  };
  return {
    walk(value) {
      walk(value, null);
    },
    order() {
      return order || (order = [...seen].sort());
    },
  };
}

// The two tables from their encoded lines (enc: { DESCRIPTOR_DF, TRADITION_SIGNATURES },
// each the line's value) against the vocabulary of the other lines, written to
// t.DESCRIPTOR_DF and t.TRADITION_SIGNATURES. A generator, so the page decodes
// in slices. Throws on anything its encoder could not have written; t is
// written only at the end.
function* codexDecodeSteps(vocab, enc, t) {
  const fail = (what) => {
    throw new Error('engine codec: ' + what);
  };
  const unsafe = (k) => k === '__proto__' || k === 'constructor' || k === 'prototype';
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // A count is written in base 36 with no sign, point or padding, and read only
  // when it is whole: parseInt alone would take '1.5zz' as 1.
  const b36 = /^[1-9a-z][0-9a-z]*$/;
  const count = (n) => Number.isSafeInteger(n) && n > 0;
  const order = vocab.order();
  yield;
  const D = enc.DESCRIPTOR_DF,
    S = enc.TRADITION_SIGNATURES;
  if (!D || typeof D.a !== 'string' || !D.r || typeof D.r !== 'object')
    fail('the DESCRIPTOR_DF line is not {a, r}');
  if (!S || !Array.isArray(S.v) || typeof S.k !== 'string' || typeof S.l !== 'string')
    fail('the TRADITION_SIGNATURES line is not {v, k, l}');
  const a = order.length
    ? D.a.split(',')
    : D.a === ''
      ? []
      : fail('counts for an empty vocabulary');
  if (a.length !== order.length)
    fail(a.length + ' DESCRIPTOR_DF counts against a vocabulary of ' + order.length);
  const df = {};
  for (let i = 0; i < a.length; i += 2500) {
    for (let j = i; j < a.length && j < i + 2500; j++) {
      if (a[j] === '') continue;
      const n = b36.test(a[j]) ? parseInt(a[j], 36) : NaN;
      if (!count(n) || unsafe(order[j])) fail('DESCRIPTOR_DF count ' + j + ' is not usable');
      df[order[j]] = n;
    }
    yield;
  }
  for (const k of Object.keys(D.r)) {
    if (unsafe(k) || own(df, k) || !count(D.r[k]))
      fail('DESCRIPTOR_DF token ' + k + ' is not usable');
    df[k] = D.r[k];
  }
  const v = S.v,
    keys = S.k ? S.k.split(' ') : [],
    lists = S.l ? S.l.split(' ') : [];
  if (keys.length !== lists.length)
    fail(keys.length + ' TRADITION_SIGNATURES ids against ' + lists.length + ' lists');
  const sig = {};
  for (let i = 0; i < keys.length; i += 500) {
    for (let j = i; j < keys.length && j < i + 500; j++) {
      if (unsafe(keys[j]) || own(sig, keys[j]))
        fail('TRADITION_SIGNATURES id ' + keys[j] + ' is not usable');
      sig[keys[j]] = lists[j].split('.').map((n) => {
        const x = /^(0|[1-9a-z][0-9a-z]*)$/.test(n) ? v[parseInt(n, 36)] : undefined;
        return typeof x === 'string'
          ? x
          : fail('TRADITION_SIGNATURES ' + keys[j] + ' names no token at ' + n);
      });
    }
    yield;
  }
  t.DESCRIPTOR_DF = df;
  t.TRADITION_SIGNATURES = sig;
}
/* @inline-end */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TABLES = ['TRADITION_SIGNATURES', 'DESCRIPTOR_DF'];
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
// The elements whose words make the vocabulary: every [name, value] line but
// MERGE_PLAN and the two encoded tables (the header is not a [name, value]).
const vocabLine = (e) => Array.isArray(e) && e[0] !== 'MERGE_PLAN' && !TABLES.includes(e[0]);
function vocabOf(elements) {
  const vocab = codexVocab();
  for (const e of elements) if (vocabLine(e)) vocab.walk(e[1]);
  return vocab;
}
const drain = (steps) => {
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
};

// The two tables decoded from engine.json's elements (each line's parsed value,
// in any order), as the page decodes them. Throws when a line is missing or
// does not decode.
function decodeEngineTables(elements) {
  const enc = {};
  for (const e of elements) if (Array.isArray(e) && TABLES.includes(e[0])) enc[e[0]] = e[1];
  for (const n of TABLES) if (!(n in enc)) throw new Error(`engine codec: no ${n} line`);
  const t = {};
  drain(codexDecodeSteps(vocabOf(elements), enc, t));
  return t;
}

// The two encoded lines, [TRADITION_SIGNATURES, DESCRIPTOR_DF] as [name, value],
// for these signatures (no empty list) and these counts, against the vocabulary
// of `elements` (the other lines of the file). Refuses what the line format or
// a plain object cannot carry, and proves that decoding its own output gives
// back exactly what it was given, or throws and no file is written.
function encodeDescriptorTables(elements, sigs, df) {
  const fail = (what) => {
    throw new Error(`engine codec: ${what}`);
  };
  for (const [id, list] of Object.entries(sigs)) {
    if (!/^\S+$/.test(id) || id.includes('.') || UNSAFE.has(id))
      fail(`TRADITION_SIGNATURES id ${JSON.stringify(id)} cannot be written`);
    if (!Array.isArray(list) || !list.length)
      fail(
        `TRADITION_SIGNATURES ${id} is not a non-empty list (the page strip drops empty lists first)`
      );
    for (const x of list)
      if (typeof x !== 'string' || UNSAFE.has(x))
        fail(`TRADITION_SIGNATURES ${id} carries ${JSON.stringify(x)}, which cannot be written`);
  }
  for (const [tok, n] of Object.entries(df)) {
    if (!/^\S+$/.test(tok) || tok.includes(',') || UNSAFE.has(tok))
      fail(`DESCRIPTOR_DF token ${JSON.stringify(tok)} cannot be written`);
    if (!Number.isSafeInteger(n) || n < 1)
      fail(`DESCRIPTOR_DF ${tok} is ${n}, not a positive count`);
  }
  // The signatures' dictionary: the most used token first, ties in code-unit order.
  const uses = new Map();
  for (const list of Object.values(sigs)) for (const x of list) uses.set(x, (uses.get(x) || 0) + 1);
  const v = [...uses.keys()].sort(
    (a, b) => uses.get(b) - uses.get(a) || (a < b ? -1 : a > b ? 1 : 0)
  );
  const at = new Map(v.map((x, i) => [x, i.toString(36)]));
  const sigLine = {
    v,
    k: Object.keys(sigs).join(' '),
    l: Object.values(sigs)
      .map((list) => list.map((x) => at.get(x)).join('.'))
      .join(' '),
  };
  const order = vocabOf(elements).order();
  const inVocab = new Set(order);
  const r = {};
  for (const tok of Object.keys(df).sort()) if (!inVocab.has(tok)) r[tok] = df[tok];
  const dfLine = {
    a: order
      .map((tok) => (Object.prototype.hasOwnProperty.call(df, tok) ? df[tok].toString(36) : ''))
      .join(','),
    r,
  };
  const out = [
    ['TRADITION_SIGNATURES', sigLine],
    ['DESCRIPTOR_DF', dfLine],
  ];
  // The proof, through JSON as the file carries it.
  const back = decodeEngineTables([
    ...elements.filter(vocabLine),
    ...JSON.parse(JSON.stringify(out)),
  ]);
  if (JSON.stringify(back.TRADITION_SIGNATURES) !== JSON.stringify(sigs))
    fail('the TRADITION_SIGNATURES line does not decode to the table it was written from');
  const dfKeys = Object.keys(df);
  if (
    Object.keys(back.DESCRIPTOR_DF).length !== dfKeys.length ||
    dfKeys.some((tok) => back.DESCRIPTOR_DF[tok] !== df[tok])
  )
    fail('the DESCRIPTOR_DF line does not decode to the table it was written from');
  return out;
}

// The digest of the codec the page carries: the region build_html.js inlines.
function codecRegion() {
  const source = fs.readFileSync(path.join(__dirname, '_engine_codec.js'), 'utf8');
  const m = source.match(/\/\* @inline-start[^\n]*\*\/\n([\s\S]*?)\n\/\* @inline-end \*\//);
  if (!m) throw new Error('_engine_codec: no @inline region in scripts/_engine_codec.js');
  return m[1];
}
const codecSha = () => crypto.createHash('sha1').update(codecRegion()).digest('hex');

module.exports = {
  codexVocab,
  codexDecodeSteps,
  vocabOf,
  encodeDescriptorTables,
  decodeEngineTables,
  codecRegion,
  codecSha,
};
