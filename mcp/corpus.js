// corpus.js — unified full-text search index over the ENTIRE catalog.
//
// Built once at module load from the read-only catalog (no engine mutation).
// Covers traditions (name/lineage/family/description), instruments (name/short),
// every part-variant (id/name/descriptors), rooms, tunings, arrangements,
// aesthetics, and the 649 prefaces (id/tokens). ~7.3k records. This is the fix
// for "the connector exposed a keyhole": list_traditions only matched one
// surface's id+name; this matches the whole corpus, including lineages where
// words like "ballad"/"outlaw"/"midnight" actually live.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../scripts/_loader.js');
const { tokensOf } = require('../scripts/_preface_match.js');

const labelOf = (x) => (x && (x.name || x.label || x.title || x.short)) || (typeof x === 'string' ? x : null);

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'with', 'at', 'by', 'from', 'as', 'is']);
function terms(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t));
}

// One searchable record per catalog entity.
const records = [];
function add(type, id, name, fields) {
  const text = Object.values(fields).filter(Boolean).join('  ').toLowerCase();
  records.push({ type, id, name: name || id, text, fields });
}

for (const t of C.TRADITIONS || []) {
  const ext = (C.TRADITION_EXTRAS || {})[t.id] || {};
  add('tradition', t.id, labelOf(t) || t.id, { name: labelOf(t), family: t.family, lineage: t.lineage, description: ext.description });
}
for (const i of C.INSTRUMENTS || []) {
  add('instrument', i.id, labelOf(i) || i.id, { name: labelOf(i), short: i.short, family: i.family });
  for (const p of i.parts || []) {
    for (const v of p.variants || []) {
      // id is the colon-form ready to paste into generate_recipe's swap_variants.
      add('variant', `${i.id}:${p.id}:${v.id}`, labelOf(v) || v.id, {
        variant: v.id, name: labelOf(v), descriptors: (v.descriptors || []).join(' '), part: p.id, instrument: i.id,
      });
    }
  }
}
for (const r of C.ROOMS || []) add('room', r.id, labelOf(r) || r.id, { name: labelOf(r), descriptors: (r.descriptors || []).join(' '), cluster: r.cluster });
for (const t of C.TUNINGS || []) add('tuning', t.id, labelOf(t) || t.id, { name: labelOf(t), sub: t.sub, descriptors: (t.descriptors || []).join(' ') });
for (const a of C.ARRANGEMENTS || []) add('arrangement', a.id, labelOf(a) || a.id, { name: labelOf(a), description: a.description, techniques: (a.characteristic_techniques || []).join(' ') });
for (const a of C.PRODUCTION_AESTHETICS || []) add('aesthetic', a.id, labelOf(a) || a.id, { name: labelOf(a), description: a.description, techniques: (a.characteristic_techniques || []).join(' ') });
for (const e of C.PREFACE_LEXICON || []) add('preface', e.id, e.id, { id: e.id, tokens: (tokensOf(e) || []).join(' '), note: e.note });
for (const sec of C.CHAIN_SECTIONS || []) {
  for (const it of sec.items || []) {
    add('chain', it.id, `${labelOf(it) || it.id} [${sec.id}]`, { item: it.id, stage: sec.id, name: labelOf(it), descriptors: (it.descriptors || []).join(' ') });
  }
}

// Document frequency over tokens → idf, so rare query terms ("gothic", "outlaw")
// outweigh ubiquitous ones ("string", "country") when ranking multi-word queries.
const N = records.length;
const DF = new Map();
for (const rec of records) {
  for (const t of new Set(terms(rec.text))) DF.set(t, (DF.get(t) || 0) + 1);
}
const idf = (t) => Math.log(1 + N / ((DF.get(t) || 0) + 1));

export const TYPES = ['tradition', 'instrument', 'variant', 'room', 'tuning', 'arrangement', 'aesthetic', 'preface', 'chain'];
const TYPE_PRIORITY = { tradition: 0, instrument: 1, preface: 2, variant: 3, arrangement: 4, aesthetic: 5, room: 6, tuning: 7, chain: 8 };

function matchedField(rec, qTerms, qRaw) {
  for (const [f, val] of Object.entries(rec.fields)) {
    const v = String(val || '').toLowerCase();
    if (!v) continue;
    if (qRaw && v.includes(qRaw)) return f;
    for (const qt of qTerms) if (v.includes(qt)) return f;
  }
  return 'text';
}

// Rank a record: idf-weighted term score (rare terms dominate) then field-match
// quality against the raw query (exact/prefix/substring on id|name).
function rankRecord(rec, qTerms, qRaw) {
  let termScore = 0, hits = 0;
  for (const qt of qTerms) if (rec.text.includes(qt)) { termScore += idf(qt); hits++; }
  const rawHit = qRaw ? rec.text.includes(qRaw) : false;
  if (hits === 0 && !rawHit) return null;
  let fieldRank = 3;
  const idl = rec.id.toLowerCase();
  const naml = (rec.name || '').toLowerCase();
  if (idl === qRaw || naml === qRaw) fieldRank = 0;
  else if (idl.startsWith(qRaw) || naml.startsWith(qRaw)) fieldRank = 1;
  else if (idl.includes(qRaw) || naml.includes(qRaw)) fieldRank = 2;
  return { termScore, fieldRank };
}

export function searchCorpus({ query, types, limit = 20, offset = 0 } = {}) {
  const qRaw = String(query || '').trim().toLowerCase();
  if (!qRaw) return { query: query || '', total: 0, count: 0, offset: 0, results: [] };
  const qTerms = terms(query);
  const typeSet = Array.isArray(types) && types.length ? new Set(types) : null;

  const scored = [];
  for (const rec of records) {
    if (typeSet && !typeSet.has(rec.type)) continue;
    const r = rankRecord(rec, qTerms, qRaw);
    if (!r) continue;
    scored.push({ rec, termScore: r.termScore, fieldRank: r.fieldRank });
  }
  scored.sort((a, b) =>
    b.termScore - a.termScore ||
    a.fieldRank - b.fieldRank ||
    (TYPE_PRIORITY[a.rec.type] - TYPE_PRIORITY[b.rec.type]) ||
    a.rec.name.length - b.rec.name.length ||
    a.rec.id.localeCompare(b.rec.id));

  const total = scored.length;
  const page = scored.slice(offset, offset + limit).map((s) => ({
    type: s.rec.type,
    id: s.rec.id,
    name: s.rec.name,
    matched_on: matchedField(s.rec, qTerms, qRaw),
  }));
  const nextOffset = offset + limit;
  return {
    query: query || '',
    total,
    count: page.length,
    offset,
    results: page,
    nextCursor: nextOffset < total ? Buffer.from(String(nextOffset)).toString('base64') : undefined,
  };
}

export const recordCount = records.length;
