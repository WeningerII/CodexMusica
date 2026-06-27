#!/usr/bin/env node
// build_variants.js — compose variant `match_tokens` deterministically from
// three dictionaries (`_shard_vocabulary.json`, `_instrument_base.json`, and
// per-instrument structural slot data). This is the original generator that
// populated `match_tokens` arrays across `01_family_parts.js` and
// `02_instruments.js`.
//
// CURRENT STATE — dormant by default. The reference files are now
// hand-authored: descriptors and match_tokens are edited by hand alongside
// new variants, and this generator is not part of `build.js`. Running it
// will OVERWRITE hand-edits to `match_tokens` arrays in both reference
// files (it makes a `.pre_systematic_enrichment` backup on first run, but
// any subsequent run can clobber legitimate hand-changes). Do not run
// without verifying that the dictionaries are up to date with the
// hand-authored state, and snapshot the reference files first.
//
// Two kinds of variants:
// - OWN (defined per-instrument in 02_instruments.js): full composition incl INSTRUMENT_BASE
// - FAMILY (defined once in 01_family_parts.js, shared): NO INSTRUMENT_BASE — variant is
//   shared across multiple instruments, so instrument-specific tokens can't apply uniformly.
//   Instrument character flows through other instrument-specific parts on the same card.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const C = require('./_loader.js');

const SHARD_VOCAB = (() => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'references', '_shard_vocabulary.json'), 'utf8')
  );
  const flat = {};
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('_doc')) continue;
    if (k.startsWith('_')) Object.assign(flat, v);
    else flat[k] = v;
  }
  return flat;
})();

const INSTRUMENT_BASE = (() => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'references', '_instrument_base.json'), 'utf8')
  );
  const flat = {};
  for (const [k, v] of Object.entries(data)) if (!k.startsWith('_')) flat[k] = v;
  return flat;
})();

const PART_TYPE = (() => {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'references', '_part_type.json'), 'utf8')
  );
  const flat = {};
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('_doc')) continue;
    if (k.startsWith('_')) Object.assign(flat, v);
    else flat[k] = v;
  }
  return flat;
})();

const STOP = new Set([
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'of',
  'the',
  'and',
  'or',
  'to',
  'with',
  'in',
  'on',
  'at',
  'is',
  'it',
  'as',
  'no',
]);
const TARGET_TOKENS = 6;

function parseShards(variantId, partId) {
  let core = variantId;
  if (partId && variantId.startsWith(partId + '_')) core = variantId.slice(partId.length + 1);
  return core.split('_').filter((w) => w.length > 0 && !STOP.has(w) && !/^\d+$/.test(w));
}

function composeOwn(instrument, part, variant) {
  const shards = parseShards(variant.id, part.id);
  const out = [];
  const seen = new Set();
  const push = (t) => {
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  // Variant-specific tokens first (shards + authored)
  for (const s of shards) if (SHARD_VOCAB[s]) for (const t of SHARD_VOCAB[s]) push(t);
  for (const t of variant.descriptors || []) push(t);
  // INSTRUMENT_BASE + PART_TYPE fill remaining slots. These end up in
  // match_tokens (matcher-only), so renderer doesn't surface them.
  for (const t of INSTRUMENT_BASE[instrument.id] || []) push(t);
  for (const t of PART_TYPE[part.id] || []) push(t);
  return out.slice(0, TARGET_TOKENS);
}

function composeFamily(part, variant) {
  const shards = parseShards(variant.id, part.id);
  const out = [];
  const seen = new Set();
  const push = (t) => {
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  for (const s of shards) if (SHARD_VOCAB[s]) for (const t of SHARD_VOCAB[s]) push(t);
  for (const t of variant.descriptors || []) push(t);
  for (const t of PART_TYPE[part.id] || []) push(t);
  return out.slice(0, TARGET_TOKENS);
}

function loadFamilyParts() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'references', '01_family_parts.js'),
    'utf8'
  );
  const ctx = { module: { exports: {} }, exports: {} };
  vm.createContext(ctx);
  vm.runInContext(src + '\nmodule.exports = INSTRUMENT_FAMILY_PARTS;\n', ctx);
  return ctx.module.exports;
}

function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const isApply = process.argv.includes('--apply');
  if (!isDryRun && !isApply) {
    console.error('Usage: --dry-run|--apply');
    process.exit(1);
  }

  const FAMILY = loadFamilyParts();
  const ownUpdates = [];
  for (const inst of C.INSTRUMENTS) {
    for (const op of inst._ownParts || []) {
      if (!Array.isArray(op.variants)) continue;
      for (const v of op.variants) {
        ownUpdates.push({
          instId: inst.id,
          partId: op.id,
          variantId: v.id,
          oldTokens: v.descriptors || [],
          newTokens: composeOwn(inst, op, v),
          shards: parseShards(v.id, op.id),
        });
      }
    }
  }
  const familyUpdates = [];
  for (const [familyId, parts] of Object.entries(FAMILY)) {
    for (const part of parts) {
      for (const v of part.variants || []) {
        familyUpdates.push({
          familyId,
          partId: part.id,
          variantId: v.id,
          oldTokens: v.descriptors || [],
          newTokens: composeFamily(part, v),
          shards: parseShards(v.id, part.id),
        });
      }
    }
  }
  const all = [...ownUpdates, ...familyUpdates];

  if (isDryRun) {
    const dist = {};
    let under = 0,
      ownUnder = 0,
      famUnder = 0;
    for (const u of all) {
      dist[u.newTokens.length] = (dist[u.newTokens.length] || 0) + 1;
      if (u.newTokens.length < TARGET_TOKENS) under++;
    }
    for (const u of ownUpdates) if (u.newTokens.length < 6) ownUnder++;
    for (const u of familyUpdates) if (u.newTokens.length < 6) famUnder++;

    console.log('# DRY RUN v2');
    console.log('OWN updates:    ' + ownUpdates.length);
    console.log('FAMILY updates: ' + familyUpdates.length);
    console.log('Total:          ' + all.length);
    console.log();
    console.log(
      'Underfilled (<6 tokens): ' + under + ' (' + ((100 * under) / all.length).toFixed(1) + '%)'
    );
    console.log(
      '  OWN:    ' +
        ownUnder +
        '/' +
        ownUpdates.length +
        ' (' +
        ((100 * ownUnder) / ownUpdates.length).toFixed(1) +
        '%)'
    );
    console.log(
      '  FAMILY: ' +
        famUnder +
        '/' +
        familyUpdates.length +
        ' (' +
        ((100 * famUnder) / familyUpdates.length).toFixed(1) +
        '%)'
    );
    console.log();
    console.log('Token count distribution:');
    for (const n of Object.keys(dist).sort((a, b) => a - b)) console.log('  ' + n + ': ' + dist[n]);
    console.log();
    const vocab = new Set();
    for (const u of all) for (const t of u.newTokens) vocab.add(t);
    console.log('Vocabulary in new descriptors: ' + vocab.size + ' unique tokens');

    console.log();
    console.log('# SAMPLE OWN DIFFS');
    for (let i = 0; i < ownUpdates.length; i += Math.floor(ownUpdates.length / 15)) {
      const u = ownUpdates[i];
      if (!u) continue;
      console.log();
      console.log('## ' + u.instId + '/' + u.partId + '/' + u.variantId);
      console.log('OLD: ' + u.oldTokens.join(', '));
      console.log('NEW: ' + u.newTokens.join(', '));
    }
    console.log();
    console.log('# SAMPLE FAMILY DIFFS');
    for (let i = 0; i < familyUpdates.length; i += Math.floor(familyUpdates.length / 15)) {
      const u = familyUpdates[i];
      if (!u) continue;
      console.log();
      console.log('## [' + u.familyId + '] ' + u.partId + '/' + u.variantId);
      console.log('OLD: ' + u.oldTokens.join(', '));
      console.log('NEW: ' + u.newTokens.join(', '));
    }
    return;
  }

  if (isApply) {
    // For each variant: compute new dictionary-derived tokens NOT already in
    // its `descriptors`. Write those into a `match_tokens` field added to the
    // variant object. The `descriptors` field is untouched — so the renderer's
    // recipe-surface output is unchanged. The matcher pools both descriptors
    // and match_tokens (see cardDescriptors in _matcher.js).

    function tokensForVariantMatchOnly(newTokens, oldTokens) {
      const old = new Set(oldTokens || []);
      return newTokens.filter((t) => !old.has(t));
    }

    function writeVariantMatchTokens(srcText, variantId, matchTokens) {
      const idEsc = variantId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Find the variant block { id: 'X', ... descriptors: [...] ... }
      // Look for `descriptors: [...]` after the id, within the variant's `{ ... }`.
      // Within-block bound enforced by capping the gap.
      const pat = new RegExp(
        `(\\{\\s*id\\s*:\\s*['"]${idEsc}['"][\\s\\S]{0,800}?descriptors\\s*:\\s*\\[[^\\]]*\\])(\\s*,\\s*match_tokens\\s*:\\s*\\[[^\\]]*\\])?`
      );
      const m = srcText.match(pat);
      if (!m) return { src: srcText, changed: false };
      const matchTokensStr =
        matchTokens.length > 0
          ? `, match_tokens: [${matchTokens.map((t) => `'${t}'`).join(', ')}]`
          : '';
      // Build replacement: keep the descriptors part, replace any existing
      // match_tokens with new, or insert new if absent.
      const replacement = m[1] + matchTokensStr;
      return { src: srcText.replace(pat, replacement), changed: true };
    }

    const ownSrc = path.join(__dirname, '..', 'references', '02_instruments.js');
    const ownBackup = ownSrc + '.pre_systematic_enrichment';
    if (!fs.existsSync(ownBackup)) fs.copyFileSync(ownSrc, ownBackup);
    let src = fs.readFileSync(ownSrc, 'utf8');
    let ownReplaced = 0;
    for (const u of ownUpdates) {
      const matchOnly = tokensForVariantMatchOnly(u.newTokens, u.oldTokens);
      const { src: nextSrc, changed } = writeVariantMatchTokens(src, u.variantId, matchOnly);
      if (changed) {
        src = nextSrc;
        ownReplaced++;
      }
    }
    fs.writeFileSync(ownSrc, src);
    console.error(
      'OWN: ' + ownReplaced + '/' + ownUpdates.length + ' match_tokens written to 02_instruments.js'
    );

    const famSrc = path.join(__dirname, '..', 'references', '01_family_parts.js');
    const famBackup = famSrc + '.pre_systematic_enrichment';
    if (!fs.existsSync(famBackup)) fs.copyFileSync(famSrc, famBackup);
    let famText = fs.readFileSync(famSrc, 'utf8');
    let famReplaced = 0;
    for (const u of familyUpdates) {
      const matchOnly = tokensForVariantMatchOnly(u.newTokens, u.oldTokens);
      const { src: nextSrc, changed } = writeVariantMatchTokens(famText, u.variantId, matchOnly);
      if (changed) {
        famText = nextSrc;
        famReplaced++;
      }
    }
    fs.writeFileSync(famSrc, famText);
    console.error(
      'FAMILY: ' +
        famReplaced +
        '/' +
        familyUpdates.length +
        ' match_tokens written to 01_family_parts.js'
    );
  }
}

main();
