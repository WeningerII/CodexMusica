#!/usr/bin/env node
// check_duplicates.js — the near-duplicate gate for catalog entities.
//
// @covers: no-duplicate-entities
//
// WHY THIS EXISTS
//
// validate.js catches id collisions. Nothing caught the ones that matter at
// this size: two records for the same real thing under different ids, and two
// different things whose display labels are indistinguishable. Both are already
// in the catalog when this gate was written: `tibetan_dungchen` / `dung_chen`
// were one Tibetan long horn entered twice (since merged), and `tar_persian` /
// `tar_azerbaijani` are two genuinely different instruments that both print as
// "tar".
//
// It matters most going forward: importing genres from an external list is a
// duplicate-generating operation by nature, because the same genre travels
// under several names (Afrobeats / Afrobeats (Naija)) and a subgenre reads like
// its parent (Emo / Midwest emo).
//
// TWO TIERS, BECAUSE THE SIGNALS HAVE VERY DIFFERENT PRECISION
//
//   BLOCK   Identity collision: two entities whose display label is the same
//           string once case, accents and punctuation are removed. Either one
//           record too many, or a label a user cannot tell apart. Precision is
//           effectively 1.0 — every hit is a defect of one kind or the other.
//           Fails the build unless the pair carries a ruling.
//
//   REVIEW  Evidence of possible duplication, reported and never auto-fatal
//           (use --strict to fail on it). For traditions the signal is shared
//           exemplar ARTISTS, which is strong: two entries citing the same
//           three artists are usually one genre twice. For instruments the
//           signal is name similarity within a family and class, which is
//           weak — organology is full of near-homographs that are genuinely
//           different instruments (mandola/mandolin, cornet/cornetto,
//           anglo/english concertina), so treat that list as a prompt to look,
//           not as an accusation.
//
// DELIBERATELY NOT normalised away: plural 's' and stopwords, in the identity
// check. `afrobeat` and `afrobeats` are a 1970s Fela Kuti genre and a 2010s
// Nigerian pop genre. Any normaliser aggressive enough to merge them is wrong.
//
// RULINGS. scripts/_duplicate_rulings.json records decisions a human has made
// about a pair: `distinct` drops it from the report for good, `duplicate` and
// `open` keep it visible as known debt without failing the build. A pair with
// no ruling BLOCKS, so a new collision cannot land quietly.
//
// USAGE
//   node scripts/check_duplicates.js                 audit the catalog
//   node scripts/check_duplicates.js --strict        also fail on REVIEW
//   node scripts/check_duplicates.js --json          machine-readable
//   node scripts/check_duplicates.js --candidates <file> --kind=tradition
//        screen proposed names (one per line, # comments ok) BEFORE adding them

'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./_loader.js');

const RULINGS_FILE = path.join(__dirname, '_duplicate_rulings.json');

// ─────────────────────────── text normalisation ───────────────────────────

// Identity form. Case, accents and punctuation only — nothing semantic.
function identity(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

// Loose form, for similarity scoring: keeps word boundaries.
function loose(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Head form: the name with its qualifier removed. 527 of 1145 tradition names
// carry one — `Trap (southern)`, `Zeuhl (French progressive Magma)` — while an
// imported list gives the bare name. Without this the scorer is defeated by the
// catalog's own naming convention and reports things we already have as new,
// which is the one failure direction that actually creates duplicates.
function headForm(s) {
  return String(s || '')
    .replace(/[([][^)\]]*[)\]]/g, ' ')
    .split(/—|–|\s\/\s|\s-\s/)[0]
    .trim();
}

const CONTENT_STOP = new Set([
  'music',
  'musical',
  'traditional',
  'trad',
  'style',
  'song',
  'songs',
  'genre',
  'the',
  'of',
  'and',
  'a',
]);
function contentTokens(s) {
  return new Set(
    loose(s)
      .split(' ')
      .filter((w) => w && !CONTENT_STOP.has(w))
  );
}
// Is every content word of `inner` present in `outer`? "sea shanty" inside
// "Newfoundland outport sea-shanty and work-song" is a match worth surfacing.
function covers(outer, inner) {
  const O = contentTokens(outer);
  const I = contentTokens(inner);
  if (!I.size || !O.size) return false;
  for (const w of I) if (!O.has(w)) return false;
  return true;
}

function bigrams(s) {
  const t = loose(s).replace(/ /g, '');
  const out = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

// Sørensen–Dice on character bigrams — cheap, and tolerant of the word-order
// and spacing differences that catalog names actually vary by.
function dice(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const counts = new Map();
  A.forEach((g) => counts.set(g, (counts.get(g) || 0) + 1));
  let hits = 0;
  B.forEach((g) => {
    const c = counts.get(g) || 0;
    if (c > 0) {
      hits++;
      counts.set(g, c - 1);
    }
  });
  return (2 * hits) / (A.length + B.length);
}

// ─────────────────────────────── rulings ───────────────────────────────

function pairKey(kind, a, b) {
  return kind + ':' + [a, b].slice().sort().join('|');
}

function loadRulings() {
  if (!fs.existsSync(RULINGS_FILE)) return new Map();
  const raw = JSON.parse(fs.readFileSync(RULINGS_FILE, 'utf8'));
  const m = new Map();
  for (const r of raw.rulings || []) {
    if (!Array.isArray(r.pair) || r.pair.length !== 2) continue;
    m.set(pairKey(r.kind, r.pair[0], r.pair[1]), r);
  }
  return m;
}

// ─────────────────────────────── entities ───────────────────────────────

// Which fields of each kind are user-facing labels that must be tellable apart.
function entities() {
  const inst = (C.INSTRUMENTS || []).map((i) => ({
    kind: 'instrument',
    id: i.id,
    labels: [i.name, i.short].filter(Boolean),
    display: i.short || i.name,
    family: i.family,
    cls: i.class,
    axes: i.axes || null,
  }));
  const trad = (C.TRADITIONS || []).map((t) => ({
    kind: 'tradition',
    id: t.id,
    labels: [t.name].filter(Boolean),
    display: t.name,
  }));
  const room = (C.ROOMS || []).map((r) => ({
    kind: 'room',
    id: r.id,
    labels: [r.name].filter(Boolean),
    display: r.name,
  }));
  const tuning = (C.TUNINGS || []).map((t) => ({
    kind: 'tuning',
    id: t.id,
    labels: [t.name].filter(Boolean),
    display: t.name,
  }));
  const preface = (C.PREFACE_LEXICON || []).map((p) => ({
    kind: 'preface',
    id: p.id,
    labels: [p.id],
    display: p.id,
  }));
  return [...inst, ...trad, ...room, ...tuning, ...preface];
}

// Exemplar ARTISTS for a tradition. The exemplar strings are "Artist — Title";
// the artist is the duplicate signal, the title is not.
function exemplarArtists(id) {
  const ex = (C.TRADITION_EXTRAS || {})[id];
  if (!ex || !Array.isArray(ex.exemplars)) return new Set();
  return new Set(
    ex.exemplars
      .map((x) => loose(String(x).split(/[—–]|(?: - )/)[0]))
      .filter((x) => x && x.length > 2)
  );
}

const AXIS_KEYS = Object.keys(((C.INSTRUMENTS || [])[0] || {}).axes || {});
function axisDistance(a, b) {
  if (!a.axes || !b.axes) return Infinity;
  let sum = 0;
  let n = 0;
  for (const k of AXIS_KEYS) {
    const x = a.axes[k];
    const y = b.axes[k];
    if (typeof x === 'number' && typeof y === 'number') {
      sum += (x - y) ** 2;
      n++;
    }
  }
  return n ? Math.sqrt(sum / n) : Infinity;
}

// ─────────────────────────────── findings ───────────────────────────────

const REVIEW = {
  // Traditions: shared exemplar artists. Three is strong on its own; two plus a
  // similar name is the "same genre, qualified differently" shape.
  tradSharedStrong: 3,
  tradSharedWeak: 2,
  tradWeakDice: 0.6,
  // Instruments: only within one family AND class, and only when the axes agree.
  instDice: 0.6,
  instAxis: 0.5,
};

function findIdentityCollisions(all) {
  const byKind = new Map();
  for (const e of all) {
    if (!byKind.has(e.kind)) byKind.set(e.kind, new Map());
    const m = byKind.get(e.kind);
    for (const label of e.labels) {
      const k = identity(label);
      if (!k) continue;
      if (!m.has(k)) m.set(k, new Map());
      m.get(k).set(e.id, e);
    }
  }
  const out = [];
  for (const [kind, m] of byKind) {
    for (const [k, ents] of m) {
      if (ents.size < 2) continue;
      const list = [...ents.values()];
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          out.push({
            tier: 'BLOCK',
            kind,
            a: list[a].id,
            b: list[b].id,
            why: `both label as "${k}"`,
            detail: `${list[a].display}  ·  ${list[b].display}`,
          });
        }
      }
    }
  }
  return out;
}

// Two entries whose names are the same once the qualifier is stripped —
// `Amapiano` and `Amapiano (South African 2010s)`. Sometimes one genre entered
// twice, sometimes a real parent/subgenre pair (`Trap` / `Trap (southern)`),
// so it is evidence to look at rather than a verdict.
function findHeadFormReview(all) {
  const byKind = new Map();
  for (const e of all) {
    if (!byKind.has(e.kind)) byKind.set(e.kind, new Map());
    const m = byKind.get(e.kind);
    for (const label of e.labels) {
      const full = identity(label);
      const head = identity(headForm(label));
      if (!head || head === full) continue; // only entries that HAVE a qualifier
      if (!m.has(head)) m.set(head, new Map());
      m.get(head).set(e.id, e);
    }
    // also index the bare label so a qualified name can meet an unqualified one
    for (const label of e.labels) {
      const full = identity(label);
      if (!full) continue;
      if (!m.has(full)) m.set(full, new Map());
      m.get(full).set(e.id, e);
    }
  }
  const out = [];
  const seen = new Set();
  for (const [kind, m] of byKind) {
    for (const [, ents] of m) {
      if (ents.size < 2) continue;
      const list = [...ents.values()];
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          const key = pairKey(kind, list[a].id, list[b].id);
          if (seen.has(key)) continue;
          seen.add(key);
          if (identity(list[a].display) === identity(list[b].display)) continue; // already BLOCK
          out.push({
            tier: 'REVIEW',
            kind,
            a: list[a].id,
            b: list[b].id,
            score: 0.99,
            why: 'same name once the qualifier is stripped',
            detail: `${list[a].display}  ·  ${list[b].display}`,
          });
        }
      }
    }
  }
  return out;
}

function findTraditionReview() {
  const T = C.TRADITIONS || [];
  const arts = T.map((t) => ({ t, a: exemplarArtists(t.id) }));
  const out = [];
  for (let i = 0; i < arts.length; i++) {
    if (arts[i].a.size < REVIEW.tradSharedWeak) continue;
    for (let j = i + 1; j < arts.length; j++) {
      if (arts[j].a.size < REVIEW.tradSharedWeak) continue;
      let shared = 0;
      for (const x of arts[i].a) if (arts[j].a.has(x)) shared++;
      if (shared < REVIEW.tradSharedWeak) continue;
      const d = dice(arts[i].t.name, arts[j].t.name);
      if (shared < REVIEW.tradSharedStrong && d < REVIEW.tradWeakDice) continue;
      out.push({
        tier: 'REVIEW',
        kind: 'tradition',
        a: arts[i].t.id,
        b: arts[j].t.id,
        score: shared,
        why: `${shared} shared exemplar artists, name similarity ${d.toFixed(2)}`,
        detail: `${arts[i].t.name}  ·  ${arts[j].t.name}`,
      });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

function findInstrumentReview(all) {
  const I = all.filter((e) => e.kind === 'instrument');
  const out = [];
  for (let i = 0; i < I.length; i++) {
    for (let j = i + 1; j < I.length; j++) {
      if (I[i].family !== I[j].family || I[i].cls !== I[j].cls) continue;
      const d = dice(I[i].display, I[j].display);
      if (d < REVIEW.instDice) continue;
      const ax = axisDistance(I[i], I[j]);
      if (ax > REVIEW.instAxis) continue;
      out.push({
        tier: 'REVIEW',
        kind: 'instrument',
        a: I[i].id,
        b: I[j].id,
        score: d,
        why: `same family and class, name similarity ${d.toFixed(2)}, axis distance ${ax.toFixed(2)}`,
        detail: `${I[i].display}  ·  ${I[j].display}`,
      });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

// ───────────────────── candidate screening (pre-add) ─────────────────────

function screenCandidates(file, kind, all, asJson) {
  const pool = all.filter((e) => e.kind === kind);
  if (!pool.length) {
    console.error(`check_duplicates: unknown --kind=${kind}`);
    process.exit(2);
  }
  const names = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);

  const results = names.map((name) => {
    const idKey = identity(name);
    const headKey = identity(headForm(name));
    // A candidate matches an entry if either side's head form agrees — the
    // catalog says `Zeuhl (French progressive Magma)`, the import says `Zeuhl`.
    const exact = pool.filter((e) =>
      e.labels.some((l) => {
        const f = identity(l);
        const h = identity(headForm(l));
        return f === idKey || h === idKey || f === headKey || h === headKey;
      })
    );
    const exactIds = new Set(exact.map((e) => e.id));
    const near = pool
      .filter((e) => !exactIds.has(e.id))
      .map((e) => {
        const d = Math.max(dice(name, e.display), dice(headForm(name), headForm(e.display)));
        // One direction only: the CATALOG entry containing every word of the
        // candidate ("Sea shanty" inside "Newfoundland outport sea-shanty and
        // work-song") means we may already cover it. The reverse — a candidate
        // containing a short catalog name — is noise, since "Synth Pop" would
        // then match "Pop".
        const contained = covers(e.display, name);
        return { e, d, contained };
      })
      .filter((x) => x.d >= 0.62 || x.contained)
      .sort((x, y) => (y.contained ? 1 : 0) - (x.contained ? 1 : 0) || y.d - x.d)
      .slice(0, 4);
    return {
      candidate: name,
      verdict: exact.length ? 'HAVE' : near.length ? 'REVIEW' : 'NEW',
      exact: exact.map((e) => ({ id: e.id, display: e.display })),
      near: near.map((x) => ({
        id: x.e.id,
        display: x.e.display,
        score: +x.d.toFixed(2),
        contained: x.contained,
      })),
    };
  });

  if (asJson) {
    console.log(JSON.stringify({ kind, count: results.length, results }, null, 2));
    return 0;
  }

  const tally = { HAVE: 0, REVIEW: 0, NEW: 0 };
  results.forEach((r) => tally[r.verdict]++);
  console.log(`=== candidate screening (${kind}) — ${results.length} candidates ===`);
  console.log(
    `  already in catalog: ${tally.HAVE}   needs a look: ${tally.REVIEW}   new: ${tally.NEW}\n`
  );
  for (const r of results) {
    if (r.verdict === 'NEW') continue;
    console.log(`  [${r.verdict}] ${r.candidate}`);
    r.exact.forEach((e) => console.log(`         is: ${e.display}  (${e.id})`));
    r.near.forEach((n) =>
      console.log(`         ${n.contained ? 'covers' : '~' + n.score}  ${n.display}  (${n.id})`)
    );
  }
  console.log('\n  NEW candidates:');
  results.filter((r) => r.verdict === 'NEW').forEach((r) => console.log('    ' + r.candidate));
  return 0;
}

// ─────────────────────────────────── main ───────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const strict = argv.includes('--strict');
  const candFlag = argv.findIndex((a) => a === '--candidates' || a.startsWith('--candidates='));
  const all = entities();

  if (candFlag >= 0) {
    const arg = argv[candFlag];
    const file = arg.includes('=') ? arg.split('=')[1] : argv[candFlag + 1];
    const kindArg = (argv.find((a) => a.startsWith('--kind')) || '').split('=')[1] || 'tradition';
    if (!file || !fs.existsSync(file)) {
      console.error('check_duplicates: --candidates needs a readable file');
      process.exit(2);
    }
    process.exit(screenCandidates(file, kindArg, all, asJson));
  }

  const rulings = loadRulings();
  const raw = [
    ...findIdentityCollisions(all),
    ...findHeadFormReview(all),
    ...findTraditionReview(),
    ...findInstrumentReview(all),
  ];

  const findings = [];
  for (const f of raw) {
    const r = rulings.get(pairKey(f.kind, f.a, f.b));
    if (r && r.verdict === 'distinct') continue; // adjudicated as different things
    findings.push({ ...f, ruling: r ? r.verdict : null, rulingNote: r ? r.note : null });
  }

  const blocking = findings.filter((f) => f.tier === 'BLOCK' && !f.ruling);
  const knownDebt = findings.filter((f) => f.tier === 'BLOCK' && f.ruling);
  const review = findings.filter((f) => f.tier === 'REVIEW');

  if (asJson) {
    console.log(JSON.stringify({ blocking, knownDebt, review }, null, 2));
    process.exit(blocking.length || (strict && review.length) ? 1 : 0);
  }

  const show = (f) => {
    console.log(`  ${f.kind.padEnd(10)} ${f.a}  <>  ${f.b}`);
    console.log(`             ${f.detail}`);
    console.log(`             ${f.why}${f.rulingNote ? ' — ' + f.rulingNote : ''}`);
  };

  console.log('=== duplicate gate ===');
  if (blocking.length) {
    console.log(`\nBLOCK — ${blocking.length} unruled identity collision(s):`);
    blocking.forEach(show);
  }
  if (knownDebt.length) {
    console.log(`\nknown, ruled but unresolved — ${knownDebt.length}:`);
    knownDebt.forEach(show);
  }
  if (review.length) {
    console.log(`\nREVIEW — ${review.length} pair(s) worth a look (advisory):`);
    review.forEach(show);
  }

  console.log('');
  if (blocking.length) {
    console.log(`DUPLICATE GATE: FAIL — ${blocking.length} unruled identity collision(s).`);
    console.log('  Fix the data, or record a ruling in scripts/_duplicate_rulings.json.');
    process.exit(1);
  }
  if (strict && review.length) {
    console.log(`DUPLICATE GATE: FAIL (--strict) — ${review.length} unresolved review pair(s).`);
    process.exit(1);
  }
  console.log(
    `DUPLICATE GATE: PASS — ${all.length} entities, 0 unruled identity collisions` +
      (knownDebt.length ? `, ${knownDebt.length} known unresolved` : '') +
      (review.length ? `, ${review.length} advisory review pair(s)` : '') +
      '.'
  );
}

main();
