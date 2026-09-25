#!/usr/bin/env node
// check_signature_tokens.js — the attribution gate for tradition signatures.
//
// @covers: signature-attribution-ruled
//
// WHY THIS EXISTS
//
// references/_tradition_signatures.json gives a tradition a short list of
// sound-words. Some of those words are not about sound at all: they claim the
// tradition belongs to, descends from, or is shaped by a culture — `celtic`,
// `gagaku-foundational`, `sufi-mystical`, `samba-foundation`. Those claims are
// published. src/atlas.js indexes the table for search and ranks kin by it,
// and the connector and the app derive preface labels from it, so a wrong
// token reads to a user as the catalog's own statement. The first full pass
// found 235 such claims that the tradition's own prose contradicts or never
// makes: a Yolŋu didgeridoo tagged `celtic` and `Scottish-influenced`, powwow
// and Inuit katajjaq tagged `African-derived`, guqin and samul nori tagged
// with a Japanese court-music foundation. Nothing checked them, because the
// only thing that ever compared this table to anything was the app.js mirror
// parity check, and that compares the table with itself.
//
// Truth here is a property of the PAIR, not the token: `hindustani` is right on
// dhrupad and wrong on a Carnatic kriti. So nothing is deleted by token. Every
// (tradition, cultural token) pair carries a written verdict against that
// tradition's own catalog prose, and only the pairs ruled false are removed.
//
// WHAT IT READS
//   references/_tradition_signatures.json   the signature table (canonical)
//   references/_soundword_vocab.json        every token classed cultural | style | sonic
//   references/_signature_rulings.json      a verdict per (tradition, cultural token)
//   src/app.js                              the TRADITION_SIGNATURES mirror
//   codex.html                              the shipped page's (minified) copy of it
//   the catalog via scripts/_loader.js      which keys are real tradition ids, and
//                                           each record's prose for the quote check
//
// BLOCK — exit 1
//   UNCLASSED       a token on a real tradition id that the vocabulary does not class,
//                   so a new token cannot slip in without someone deciding what it is
//   UNRULED         a (tradition, cultural token) pair with no ruling
//   FALSE_SURVIVES  a pair ruled false still present in the table, in the src/app.js
//                   mirror, or in codex.html — every copy of the table the product
//                   publishes (the atlas and the connector read the JSON itself)
//   STALE_RULING    a ruling on an id that is no longer a tradition, or on a token the
//                   vocabulary does not class cultural (the two files disagree)
//   MALFORMED       a ruling or vocabulary row that breaks the file's own contract,
//                   or a mirror this gate cannot find and therefore cannot vouch for
//
// REVIEW — reported, never fatal unless --strict
//   a kept (attested / loose) ruling whose token is no longer on its tradition;
//   a contradicted ruling none of whose quotes is still in its record's prose;
//   a vocabulary row for a token no tradition carries and no ruling names;
//   signature keys that name no tradition (B10 in the August place production
//   plan: they reach no card, and reconciling them is separate work).
//
// Style tokens (genre and idiom words, Western art-music periods, generic
// function words, species-only materials) are classed but deliberately not
// ruled per pair; see _soundword_vocab.json's _doc for where the line sits.
//
// USAGE
//   node scripts/check_signature_tokens.js            gate
//   node scripts/check_signature_tokens.js --strict   also fail on REVIEW
//   node scripts/check_signature_tokens.js --json     machine-readable report

'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SIGS_FILE = 'references/_tradition_signatures.json';
const VOCAB_FILE = 'references/_soundword_vocab.json';
const RULINGS_FILE = 'references/_signature_rulings.json';
const APP_FILE = 'src/app.js';
const HTML_FILE = 'codex.html';

const CLASSES = new Set(['cultural', 'style', 'sonic']);
const VERDICTS = new Set(['attested', 'loose', 'false']);
const TIERS = new Set(['core', 'contradicted', 'boundary']);

const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const AS_JSON = argv.includes('--json');

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const pairKey = (trad, tok) => trad + '\u0000' + tok;

// ───────────────────────── the published mirrors ─────────────────────────
// Both copies are object literals assigned to `const TRADITION_SIGNATURES`:
// single-quoted and one tradition per line in src/app.js, double-quoted and
// minified in codex.html. Read each to its matching brace, string-aware, and
// evaluate it the way build_signatures.js does — never by a regex that
// assumes one of the two layouts.
function extractSignatureBlock(text) {
  const m = /const TRADITION_SIGNATURES\s*=\s*\{/.exec(text);
  if (!m) return null;
  const start = m.index + m[0].length - 1;
  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      return new Function('return ' + text.slice(start, i + 1))();
    }
  }
  return null;
}

function readMirror(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return { rel, error: `${rel} is missing` };
  try {
    const obj = extractSignatureBlock(fs.readFileSync(abs, 'utf8'));
    if (!obj || typeof obj !== 'object') return { rel, error: `no TRADITION_SIGNATURES in ${rel}` };
    return { rel, obj };
  } catch (e) {
    return { rel, error: `TRADITION_SIGNATURES in ${rel} does not evaluate: ${e.message}` };
  }
}

// ───────────────────────── a record's own prose ─────────────────────────
// What a ruling may quote: the tradition's name, lineage and description (as
// api/browse.json publishes them), its exemplars, and its parent chain in the
// tree. Used only for the advisory quote check.
const normProse = (s) =>
  String(s)
    .normalize('NFC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .toLowerCase();

function proseIndex(C) {
  const nodes = new Map((C.TREE_NODES || []).map((n) => [n.id, n]));
  const out = new Map();
  for (const t of C.TRADITIONS) {
    const ex = (C.TRADITION_EXTRAS || {})[t.id] || {};
    const parts = [t.name, t.lineage, ex.description, ...(ex.exemplars || t.exemplars || [])];
    let p = ex.parent || t.parent;
    while (p) {
      const n = nodes.get(p);
      if (n) parts.push(n.name, n.description);
      p = p.includes('.') ? p.slice(0, p.lastIndexOf('.')) : null;
    }
    out.set(t.id, normProse(parts.filter(Boolean).join('\n')));
  }
  return out;
}

function quotesIn(evidence) {
  const out = [];
  const re = /"([^"]{12,})"/g;
  let m;
  while ((m = re.exec(evidence)) !== null) out.push(m[1]);
  return out;
}

// ─────────────────────────────────── main ───────────────────────────────────

function main() {
  const C = require('./_loader.js');
  const realIds = new Set(C.TRADITIONS.map((t) => t.id));
  const sigs = readJson(SIGS_FILE);
  const vocabDoc = readJson(VOCAB_FILE);
  const rulingsDoc = readJson(RULINGS_FILE);
  const vocab = (vocabDoc && vocabDoc.tokens) || {};
  const rulings = (rulingsDoc && rulingsDoc.rulings) || [];

  const block = {
    UNCLASSED: [],
    UNRULED: [],
    FALSE_SURVIVES: [],
    STALE_RULING: [],
    MALFORMED: [],
  };
  const review = [];

  // ── the vocabulary's own contract ──
  if (!vocabDoc || typeof vocabDoc.tokens !== 'object')
    block.MALFORMED.push(`${VOCAB_FILE}: no "tokens" object`);
  for (const [tok, row] of Object.entries(vocab)) {
    if (!row || !CLASSES.has(row.class))
      block.MALFORMED.push(
        `${VOCAB_FILE}: "${tok}" has class ${JSON.stringify(row && row.class)} (want cultural | style | sonic)`
      );
  }

  // ── the rulings' own contract ──
  if (!rulingsDoc || !Array.isArray(rulingsDoc.rulings))
    block.MALFORMED.push(`${RULINGS_FILE}: no "rulings" array`);
  const ruled = new Map();
  for (const [i, r] of rulings.entries()) {
    const where = `${RULINGS_FILE} #${i} ${r && r.tradition} / ${r && r.token}`;
    if (!r || typeof r.tradition !== 'string' || typeof r.token !== 'string') {
      block.MALFORMED.push(`${where}: needs a string tradition and token`);
      continue;
    }
    if (!VERDICTS.has(r.verdict))
      block.MALFORMED.push(
        `${where}: verdict ${JSON.stringify(r.verdict)} (want attested | loose | false)`
      );
    if (r.verdict === 'false' && !TIERS.has(r.tier))
      block.MALFORMED.push(`${where}: a false ruling needs tier core | contradicted | boundary`);
    if (r.verdict !== 'false' && r.tier !== undefined)
      block.MALFORMED.push(`${where}: only a false ruling carries a tier`);
    if (typeof r.evidence !== 'string' || r.evidence.trim().length < 20)
      block.MALFORMED.push(`${where}: no evidence — every ruling cites the prose it rests on`);
    else if (r.tier === 'contradicted' && !quotesIn(r.evidence).length)
      block.MALFORMED.push(`${where}: a contradicted ruling quotes the prose that contradicts it`);
    const k = pairKey(r.tradition, r.token);
    if (ruled.has(k)) block.MALFORMED.push(`${where}: ruled twice`);
    ruled.set(k, r);
    if (!realIds.has(r.tradition))
      block.STALE_RULING.push(
        `${r.tradition} / ${r.token}: "${r.tradition}" is not a tradition id`
      );
    else if (!vocab[r.token] || vocab[r.token].class !== 'cultural')
      block.STALE_RULING.push(
        `${r.tradition} / ${r.token}: the vocabulary classes "${r.token}" ` +
          (vocab[r.token] ? vocab[r.token].class : 'nowhere') +
          ', so it is not ruled per pair'
      );
  }

  // ── every token on a real tradition: classed, and every cultural pair ruled ──
  const orphanKeys = [];
  const carried = new Set();
  let pairsCultural = 0;
  let pairsStyle = 0;
  let pairsSonic = 0;
  for (const [trad, toks] of Object.entries(sigs)) {
    if (!realIds.has(trad)) {
      orphanKeys.push(trad);
      continue;
    }
    for (const tok of new Set(toks)) {
      carried.add(tok);
      const row = vocab[tok];
      if (!row || !CLASSES.has(row.class)) {
        block.UNCLASSED.push(`${trad} / ${tok}: "${tok}" has no class in ${VOCAB_FILE}`);
        continue;
      }
      if (row.class === 'style') pairsStyle++;
      else if (row.class === 'sonic') pairsSonic++;
      else {
        pairsCultural++;
        const r = ruled.get(pairKey(trad, tok));
        if (!r) block.UNRULED.push(`${trad} / ${tok}: cultural token with no ruling`);
      }
    }
  }

  // ── no false pair in the table or in either published copy of it ──
  const falsePairs = rulings.filter((r) => r && r.verdict === 'false');
  const mirrors = [{ rel: SIGS_FILE, obj: sigs }, readMirror(APP_FILE), readMirror(HTML_FILE)];
  for (const m of mirrors) {
    if (m.error) {
      block.MALFORMED.push(`${m.error} — this gate cannot vouch for what it cannot read`);
      continue;
    }
    for (const r of falsePairs) {
      const toks = m.obj[r.tradition];
      if (Array.isArray(toks) && toks.includes(r.token))
        block.FALSE_SURVIVES.push(
          `${r.tradition} / ${r.token} (ruled false:${r.tier}) is still in ${m.rel}`
        );
    }
  }

  // ── housekeeping (REVIEW) ──
  const prose = proseIndex(C);
  for (const r of rulings) {
    if (!r || !realIds.has(r.tradition)) continue;
    const toks = sigs[r.tradition] || [];
    if (r.verdict !== 'false' && !toks.includes(r.token))
      review.push(
        `${r.tradition} / ${r.token}: ruled ${r.verdict} but no longer on the tradition (drop the ruling)`
      );
    if (r.tier === 'contradicted') {
      const text = prose.get(r.tradition) || '';
      const found = quotesIn(r.evidence || '').some((q) =>
        q
          .split(/\s*(?:\.\.\.|…)\s*/)
          .filter((s) => s.trim())
          .every((s) => text.includes(normProse(s).replace(/^[\s.,;]+|[\s.,;]+$/g, '')))
      );
      if (!found)
        review.push(
          `${r.tradition} / ${r.token}: none of the contradicting quotes is in the record's prose any more (re-rule it)`
        );
    }
  }
  // A token whose every pair was ruled false keeps its row: the rulings that
  // removed it still name it, and the row is what says it was cultural.
  const namedByRuling = new Set(rulings.map((r) => r && r.token));
  for (const tok of Object.keys(vocab))
    if (!carried.has(tok) && !namedByRuling.has(tok))
      review.push(`vocabulary row "${tok}" is carried by no tradition and named by no ruling`);
  if (orphanKeys.length)
    review.push(
      `${orphanKeys.length} signature key(s) name no tradition and reach no card: ${orphanKeys.join(', ')}`
    );

  const blocking = Object.values(block).reduce((n, a) => n + a.length, 0);
  const verdicts = { attested: 0, loose: 0, false: 0 };
  const tiers = { core: 0, contradicted: 0, boundary: 0 };
  for (const r of rulings) {
    if (r && r.verdict in verdicts) verdicts[r.verdict]++;
    if (r && r.verdict === 'false' && r.tier in tiers) tiers[r.tier]++;
  }
  const summary = {
    traditions: Object.keys(sigs).length - orphanKeys.length,
    tokens: carried.size,
    pairs: { cultural: pairsCultural, style: pairsStyle, sonic: pairsSonic },
    rulings: rulings.length,
    verdicts,
    tiers,
  };

  if (AS_JSON) {
    console.log(JSON.stringify({ summary, block, review }, null, 2));
    process.exit(blocking || (STRICT && review.length) ? 1 : 0);
  }

  console.log('=== signature attribution gate ===');
  console.log(
    `  ${summary.traditions} signed traditions, ${summary.tokens} distinct tokens; ` +
      `pairs: ${pairsCultural} cultural (ruled), ${pairsStyle} style, ${pairsSonic} sonic`
  );
  console.log(
    `  ${rulings.length} rulings: ${verdicts.attested} attested, ${verdicts.loose} loose, ` +
      `${verdicts.false} false (${tiers.core} core, ${tiers.contradicted} contradicted, ${tiers.boundary} boundary)`
  );
  for (const [name, list] of Object.entries(block)) {
    if (!list.length) continue;
    console.log(`\nBLOCK ${name} — ${list.length}:`);
    list.forEach((l) => console.log(`  ✗ ${l}`));
  }
  if (review.length) {
    console.log(`\nREVIEW — ${review.length} (advisory):`);
    review.forEach((l) => console.log(`  · ${l}`));
  }

  console.log('');
  if (blocking) {
    console.log(`SIGNATURE GATE: FAIL — ${blocking} blocking finding(s).`);
    console.log(
      `  A cultural token needs a ruling in ${RULINGS_FILE}; a token needs a class in ${VOCAB_FILE};`
    );
    console.log(
      `  a pair ruled false is deleted from ${SIGS_FILE}, then node scripts/build_signatures.js and the html build.`
    );
    process.exit(1);
  }
  if (STRICT && review.length) {
    console.log(`SIGNATURE GATE: FAIL (--strict) — ${review.length} review finding(s).`);
    process.exit(1);
  }
  console.log(
    `SIGNATURE GATE: PASS — every cultural pair ruled, 0 false pairs in the table, ` +
      `src/app.js or codex.html, every token classed` +
      (review.length ? `; ${review.length} advisory` : '') +
      '.'
  );
}

main();
