'use strict';
// _recipe_stack.js — shared Node recipe-stack renderer (single source of truth).
//
// This is the Node mirror of the browser's src/app.js compileRecipeStack family
// (compressProse/Tags/Rich/CompactRecipe + the trim cascade). It is the renderer
// behind the app's "Current Recipe" / Rich view. Two Node callers render through
// it instead of each carrying a copy:
//   - mcp/engine.js  — the connector's recipe text (via renderRecipeFromConfig).
//   - scripts/smoke.js — the catalog-wide ≤ceiling budget assertion.
//
// It extends the former smoke.js-only port with the pieces the connector needs
// and the budget test never exercised:
//   - buildStackParts renders the SIGNAL CHAIN (the smoke port skipped it).
//   - _resolvePreface resolves to the lexicon `id` (the smoke port read a
//     non-existent `.word` field — dormant only because its cards carry none).
//   - assignDedupedPrefaces auto-assigns a deduped preface per card (the app's
//     _computeRecipeDedupedPrefaces + _matchSurvivors), using the shared
//     _preface_match + _card_descriptors SSOTs.
//   - cardsFromConfig adapts a search/engine config into cards (resolving the
//     archetype into a chain), and renderRecipeFromConfig adds the genre header.
//
// The ceiling rules are NOT reinvented here — they are the app's: trim
// low-information descriptor tokens first (by tier), then env chunks, then
// trailing instruments with a `[+N hidden]` notice. Prefaces are never trimmed.

const C = require('./_loader.js');
const { rank } = require('./_preface_match.js');
const { cardDescriptors } = require('./_card_descriptors.js');
const { SIGS } = require('./_inverse_configure.js');

// ─────────────────────────── catalog lookups ───────────────────────────
const Inst = (id) => (C.INSTRUMENTS || []).find((x) => x.id === id);
const Tuning = (id) => (C.TUNINGS || []).find((x) => x.id === id);
const Room = (id) => (C.ROOMS || []).find((x) => x.id === id);
function ChainItem(stage, itemId) {
  for (const sec of (C.CHAIN_SECTIONS || [])) {
    if (sec.stage === stage || sec.id === stage) {
      const it = (sec.items || []).find((x) => x.id === itemId);
      if (it) return it;
    }
  }
  return null;
}

// ─────────────────────────── display helpers ───────────────────────────
function _kebab(label) {
  if (!label) return '';
  return String(label)
    .toLowerCase()
    .replace(/[\s/()[\]{},.;:]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Drop token A when its hyphen-segments are a contiguous subsequence of a more
// specific token B's segments (folk ⊂ folk-revival → drop folk).
function _suppressSubsumed(tokens) {
  const clean = (tokens || []).filter((t) => typeof t === 'string' && t.length > 0);
  const segs = clean.map((t) => t.toLowerCase().split('-'));
  const drop = new Set();
  for (let i = 0; i < clean.length; i++) {
    if (drop.has(i)) continue;
    for (let j = 0; j < clean.length; j++) {
      if (i === j || drop.has(j) || segs[i].length >= segs[j].length) continue;
      const a = segs[i]; const b = segs[j]; const m = a.length;
      for (let p = 0; p + m <= b.length; p++) {
        let match = true;
        for (let k = 0; k < m; k++) { if (a[k] !== b[p + k]) { match = false; break; } }
        if (match) { drop.add(i); break; }
      }
      if (drop.has(i)) break;
    }
  }
  return clean.filter((_, i) => !drop.has(i));
}

const _MATERIAL_SEGMENTS = new Set([
  'mahogany', 'spruce', 'cedar', 'maple', 'rosewood', 'walnut', 'oak', 'ash', 'alder',
  'basswood', 'koa', 'ebony', 'pine', 'fir', 'beech', 'willow', 'sycamore', 'poplar',
  'bamboo', 'teak', 'wood', 'tonewood', 'hardwood', 'softwood',
  'padauk', 'bubinga', 'wenge', 'cherry', 'sapele', 'paulownia', 'birch', 'cocobolo',
  'limba', 'korina',
  'nickel', 'brass', 'bronze', 'phosphor', 'copper', 'silver', 'gold', 'iron', 'tin',
  'steel', 'aluminum', 'aluminium', 'titanium', 'zinc', 'alnico', 'monel', 'tungsten',
  'gut', 'sinew', 'horsehair', 'ivory', 'bone', 'horn', 'pearl', 'abalone', 'hide',
  'rawhide', 'calfskin', 'goatskin', 'sheepskin', 'snakeskin', 'leather', 'wool', 'cotton', 'silk',
  'flax', 'cane',
  'nylon', 'plastic', 'lucite', 'fiberglass', 'kevlar', 'synthetic', 'polymer', 'carbon',
  'acrylic', 'phenolic', 'mylar', 'ebonite', 'fluorocarbon',
  'clay', 'ceramic', 'alabaster', 'marble', 'slate', 'stone', 'tile', 'concrete', 'brick',
  'terracotta',
  'gourd',
  'tape', 'vinyl', 'lacquer', 'shellac', 'wax',
]);

const _GEAR_SEGMENTS = new Set([
  'neumann', 'telefunken', 'akg', 'shure', 'royer', 'sennheiser', 'beyerdynamic', 'rca',
  'altec', 'sony', 'aiwa', 'tascam', 'portastudio', 'revox', 'studer', 'ampex', 'otari',
  'mci', 'neve', 'api', 'ssl', 'trident', 'helios', 'soundcraft', 'soundtracs', 'mackie',
  'tube-tech', 'manley', 'pultec', 'urei', 'dbx', 'fairchild', 'la-2a', 'la-3a', '1176',
  'distressor', 'behringer', 'focusrite', 'rupert-neve', 'dda', 'daking', 'toft',
  'dangerous', 'rnd', 'sphere',
]);

const _SCAFFOLD_TOKENS = new Set([
  'modern', 'traditional', 'classical', 'contemporary', 'vintage', 'standard',
  'regional', 'folk', 'popular', 'folk-tradition', 'sacred', 'secular', 'ceremonial',
  'concert', 'recital', 'accompaniment', 'lead', 'western', 'western-default',
  'eastern', 'equal-tempered', 'modern-music', 'classical-western', 'tonal',
  'monodic', 'polyphonic', 'art-music', 'vernacular',
]);

const _TEXTURE_TOKENS = new Set([
  'foundational', 'virtuoso', 'versatile', 'consistent', 'expressive', 'grounded',
  'connected', 'meditative', 'deep', 'soulful', 'tender', 'intimate', 'powerful',
  'evocative', 'emotive', 'sincere', 'heartfelt', 'rhythmic', 'melodic', 'articulate',
  'lyrical', 'warm', 'dark', 'bright', 'smooth', 'harsh', 'clean', 'dirty', 'gritty',
  'sweet', 'mellow', 'rich', 'full', 'open', 'tight', 'loose', 'airy', 'dense',
]);

function _descriptorTier(token) {
  if (typeof token !== 'string') return 2;
  const segs = token.toLowerCase().split('-');
  for (const seg of segs) {
    if (_MATERIAL_SEGMENTS.has(seg) || _GEAR_SEGMENTS.has(seg)) return 1;
  }
  if (/(?:^|-)(?:18|19|20)\d{2}s?(?:-|$)/.test(token)) return 1;
  if (/^\d{2,4}s$/.test(token)) return 1;
  if (token.includes('century') || token.includes('-era-') || token.includes('mid-century')) return 1;
  if (_SCAFFOLD_TOKENS.has(token)) return 3;
  if (_TEXTURE_TOKENS.has(token)) return 4;
  return 2;
}

let _DF = null;
function _ensureDF() {
  if (_DF !== null) return _DF;
  _DF = new Map();
  const bump = (d) => _DF.set(d, (_DF.get(d) || 0) + 1);
  for (const inst of (C.INSTRUMENTS || [])) {
    for (const part of (inst.parts || [])) {
      for (const v of (part.variants || [])) {
        for (const d of (v.descriptors || [])) bump(d);
      }
    }
  }
  for (const t of (C.TUNINGS || [])) for (const d of (t.descriptors || [])) bump(d);
  for (const r of (C.ROOMS || [])) for (const d of (r.descriptors || [])) bump(d);
  for (const sec of (C.CHAIN_SECTIONS || [])) for (const it of (sec.items || [])) for (const d of (it.descriptors || [])) bump(d);
  return _DF;
}

function _sortDescriptorsByPriority(descs) {
  const df = _ensureDF();
  return (descs || []).slice().sort((a, b) => {
    const ta = _descriptorTier(a);
    const tb = _descriptorTier(b);
    if (ta !== tb) return ta - tb;
    const da = df.get(a) || 999;
    const db = df.get(b) || 999;
    if (da !== db) return da - db;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });
}

const _FILLERS = new Set(['canonical', 'standard', 'default', 'unmarked', 'normal', 'plain', 'none', 'minimal']);
function _cleanDescriptors(descs) {
  const out = [];
  const seen = new Set();
  for (const raw of (descs || [])) {
    if (raw == null) continue;
    const stripped = String(raw).replace(/-canonical$/, '');
    if (!stripped) continue;
    if (_FILLERS.has(stripped.toLowerCase())) continue;
    const key = stripped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(stripped);
  }
  return out;
}
const _entryRenderDescs = (entry) => (entry ? _cleanDescriptors(entry.descriptors || []) : []);

// ─────────────────────────── per-card stack parts ───────────────────────────
// Mirror of src/app.js:buildStackParts — instrument descriptors, then tuning,
// room, and EACH signal-chain stage (the chain is what the smoke port omitted).
function buildStackParts(card) {
  const inst = Inst(card.instrumentId);
  if (!inst) return [];
  const out = [];
  const all = [];
  for (const part of (inst.parts || [])) {
    const v = (part.variants || []).find((x) => x.id === (card.parts || {})[part.id]);
    if (!v) continue;
    all.push(...(v.descriptors || []));
  }
  out.push({ kind: 'instrument', label: inst.short || inst.name, descriptors: _cleanDescriptors(all) });
  if (card.tuning) {
    const t = Tuning(card.tuning);
    if (t) out.push({ kind: 'tuning', label: t.name, descriptors: _entryRenderDescs(t) });
  }
  if (card.room) {
    const r = Room(card.room);
    if (r) out.push({ kind: 'room', label: r.name, descriptors: _entryRenderDescs(r) });
  }
  const chain = card.chain || {};
  for (const sec of (C.CHAIN_SECTIONS || [])) {
    if (sec.multiSelect) {
      for (const id of (chain[sec.id] || [])) {
        const it = ChainItem(sec.id, id);
        if (it) out.push({ kind: sec.id, label: `${sec.name.toLowerCase()}: ${it.name}`, descriptors: _entryRenderDescs(it) });
      }
    } else if (chain[sec.id]) {
      const it = ChainItem(sec.id, chain[sec.id]);
      if (it) out.push({ kind: sec.id, label: `${sec.name.toLowerCase()}: ${it.name}`, descriptors: _entryRenderDescs(it) });
    }
  }
  return out;
}

// ─────────────────────────── preface resolution + dedup ───────────────────────────
const _sanitizePreface = (raw) => (raw == null ? '' : String(raw).replace(/[,.]/g, '').trim());
function _resolvePreface(card) {
  if (!card) return null;
  const sanitized = _sanitizePreface(card.preface);
  if (!sanitized) return null;
  const lex = C.PREFACE_LEXICON || [];
  const lc = sanitized.toLowerCase();
  const entry = lex.find((e) => e.id.toLowerCase() === lc);
  return entry ? entry.id : sanitized;
}

// Auto-assign a deduped preface id onto each card (mutates card.preface).
// Port of src/app.js:_computeRecipeDedupedPrefaces + _matchSurvivors: rank each
// card's full descriptor set (signature included) against the lexicon via the
// shared _preface_match SSOT, then greedily resolve collisions so two cards
// don't both land on the same dominant (signature-anchored) preface.
function assignDedupedPrefaces(cards) {
  // Locked prefaces: a card whose preface was explicitly baked in (prefaceLock)
  // keeps it, and its id is excluded from every other card's pool — mirrors the
  // app's _computeRecipeDedupedPrefaces manual-lock behavior so a requested
  // preface (engine `prefaces` / apply_preface) surfaces verbatim instead of
  // being overridden by a higher-precision auto-match.
  const lockedIds = new Set();
  for (const c of (cards || [])) {
    if (c && c.prefaceLock && c.preface) lockedIds.add(_resolvePreface(c) || c.preface);
  }
  const slots = [];
  for (const card of (cards || [])) {
    if (card && card.prefaceLock && card.preface) { card.preface = _resolvePreface(card) || card.preface; continue; }
    let ranked = [];
    try { ranked = rank(cardDescriptors(card, C, SIGS), C.PREFACE_LEXICON); } catch { ranked = []; }
    let cursor = 0;
    while (cursor < ranked.length && lockedIds.has(ranked[cursor].entry.id)) cursor++;
    slots.push({ card, ranked, cursor, current: ranked[cursor] || null });
  }
  for (let iter = 0; iter < 100; iter++) {
    const claimants = new Map();
    for (const s of slots) {
      if (!s.current) continue;
      const id = s.current.entry.id;
      if (!claimants.has(id)) claimants.set(id, []);
      claimants.get(id).push(s);
    }
    let collision = false;
    for (const group of claimants.values()) {
      if (group.length <= 1) continue;
      collision = true;
      group.sort((a, b) => b.current.score - a.current.score);
      for (let k = 1; k < group.length; k++) {
        const loser = group[k];
        do { loser.cursor++; } while (loser.cursor < loser.ranked.length && lockedIds.has(loser.ranked[loser.cursor].entry.id));
        loser.current = loser.ranked[loser.cursor] || null;
      }
    }
    if (!collision) break;
  }
  for (const s of slots) s.card.preface = s.current ? s.current.entry.id : null;
  return cards;
}

// ─────────────────────────── prose (collapsed) ───────────────────────────
function compressProseRecipe(cards, ceiling) {
  const rawChunks = [];
  for (const card of cards) {
    const parts = buildStackParts(card);
    const inst = parts.find((p) => p.kind === 'instrument');
    if (!inst) continue;
    rawChunks.push({
      kind: 'inst',
      label: _kebab(inst.label),
      descriptors: _sortDescriptorsByPriority(_suppressSubsumed(inst.descriptors)),
      preface: _resolvePreface(card),
    });
  }
  if (cards.length > 0) {
    for (const p of buildStackParts(cards[0])) {
      if (p.kind === 'instrument') continue;
      let label = p.label;
      const colonIdx = label.indexOf(': ');
      if (colonIdx >= 0) label = label.slice(colonIdx + 2);
      rawChunks.push({
        kind: 'env',
        label: _kebab(label),
        descriptors: _sortDescriptorsByPriority(_suppressSubsumed(p.descriptors)),
        preface: null,
      });
    }
  }

  const mergedByLabel = new Map();
  const labelOrder = [];
  const labelKind = new Map();
  for (const c of rawChunks) {
    if (mergedByLabel.has(c.label)) {
      const existing = mergedByLabel.get(c.label);
      for (const d of c.descriptors) if (!existing.descriptors.includes(d)) existing.descriptors.push(d);
      if (c.preface && !existing.descriptors.includes(c.preface)) existing.descriptors.push(c.preface);
    } else {
      const cp = { kind: c.kind, label: c.label, descriptors: [...c.descriptors] };
      if (c.preface) cp.descriptors.push(c.preface);
      mergedByLabel.set(c.label, cp);
      labelOrder.push(c.label);
      labelKind.set(c.label, c.kind);
    }
  }

  const trailingGroups = new Map();
  for (const key of labelOrder) {
    const segs = key.split('-');
    const trailing = segs[segs.length - 1];
    if (!trailingGroups.has(trailing)) trailingGroups.set(trailing, []);
    trailingGroups.get(trailing).push(key);
  }
  const bareLabels = new Set(labelOrder);

  const finalChunks = [];
  const emitted = new Set();
  for (const key of labelOrder) {
    if (emitted.has(key)) continue;
    const c = mergedByLabel.get(key);
    const segs = c.label.split('-');
    const trailing = segs[segs.length - 1];
    const group = trailingGroups.get(trailing);
    if (group.length >= 2 && !bareLabels.has(trailing)) {
      const parts = [];
      let groupKind = 'inst';
      for (const groupKey of group) {
        const member = mergedByLabel.get(groupKey);
        const memberSegs = member.label.split('-');
        const innerLabel = memberSegs.slice(0, -1).join('-') || null;
        parts.push({ descriptors: member.descriptors.slice(), innerLabel });
        if (labelKind.get(groupKey) === 'env') groupKind = 'env';
        emitted.add(groupKey);
      }
      finalChunks.push({ kind: groupKind, trailingLabel: trailing, parts });
    } else {
      emitted.add(key);
      finalChunks.push({ kind: c.kind, trailingLabel: c.label, parts: [{ descriptors: c.descriptors.slice(), innerLabel: null }] });
    }
  }

  const renderChunk = (c) => {
    const tokens = [];
    for (const p of c.parts) {
      for (const d of p.descriptors) tokens.push(d);
      if (p.innerLabel) tokens.push(p.innerLabel);
    }
    return tokens.length > 0 ? `${tokens.join(' ')} ${c.trailingLabel}` : c.trailingLabel;
  };
  const renderAll = () => finalChunks.map(renderChunk).join(', ') + '.';

  let output = renderAll();
  if (output.length <= ceiling) return output;

  let guard = 5000;
  while (renderAll().length > ceiling && guard-- > 0) {
    let target = null; let targetTier = -Infinity; let targetLen = -1;
    for (const c of finalChunks) {
      for (const part of c.parts) {
        if (part.descriptors.length === 0) continue;
        const last = part.descriptors[part.descriptors.length - 1];
        const t = _descriptorTier(last);
        const better = (t > targetTier) || (t === targetTier && part.descriptors.length > targetLen);
        if (better) { target = part; targetTier = t; targetLen = part.descriptors.length; }
      }
    }
    if (!target) break;
    target.descriptors.pop();
  }
  output = renderAll();
  if (output.length <= ceiling) return output;

  while (renderAll().length > ceiling && finalChunks.some((c) => c.kind === 'env')) {
    for (let i = finalChunks.length - 1; i >= 0; i--) {
      if (finalChunks[i].kind === 'env') { finalChunks.splice(i, 1); break; }
    }
  }
  output = renderAll();
  if (output.length <= ceiling) return output;

  while (renderAll().length > ceiling) {
    let popped = false;
    for (let i = finalChunks.length - 1; i >= 0; i--) {
      const c = finalChunks[i];
      if (c.kind === 'inst' && c.parts.length > 1) { c.parts.pop(); popped = true; break; }
    }
    if (!popped) break;
  }
  output = renderAll();
  if (output.length <= ceiling) return output;

  const noticeFor = (n) => (n > 0 ? ` [+${n} hidden]` : '');
  let droppedChunks = 0;
  while (finalChunks.length > 1 && (renderAll() + noticeFor(droppedChunks + 1)).length > ceiling) {
    finalChunks.pop();
    droppedChunks++;
  }
  output = renderAll() + noticeFor(droppedChunks);
  if (output.length > ceiling) output = output.slice(0, ceiling - 16) + '… [truncated]';
  return output;
}

// ─────────────────────────── tags ───────────────────────────
function _tagsChunk(label, descs, preface) {
  const clean = _suppressSubsumed(descs).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const head = preface ? `${preface} ${_kebab(label)}` : _kebab(label);
  return clean.length === 0 ? head : `${head}: ${clean.join(' ')}`;
}

function compressTagsRecipe(cards, ceiling) {
  const chunks = [];
  for (const card of cards) {
    const parts = buildStackParts(card);
    const inst = parts.find((p) => p.kind === 'instrument');
    if (!inst) continue;
    chunks.push(_tagsChunk(inst.label, inst.descriptors, _resolvePreface(card)));
  }
  if (cards.length > 0) {
    for (const p of buildStackParts(cards[0])) {
      if (p.kind === 'instrument') continue;
      chunks.push(_tagsChunk(p.label, p.descriptors));
    }
  }
  let output = chunks.join(', ');
  const TRIM_TARGET = ceiling - 1;
  if (output.length <= TRIM_TARGET) return output + '.';

  const rebuilt = cards.map((card) => {
    const parts = buildStackParts(card);
    const inst = parts.find((p) => p.kind === 'instrument');
    return inst ? {
      kind: 'inst', label: inst.label, preface: _resolvePreface(card),
      descs: _suppressSubsumed(inst.descriptors).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    } : null;
  }).filter(Boolean);
  if (cards.length > 0) {
    for (const p of buildStackParts(cards[0])) {
      if (p.kind === 'instrument') continue;
      rebuilt.push({ kind: 'env', label: p.label, preface: null, descs: _suppressSubsumed(p.descriptors).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())) });
    }
  }
  const renderAll = () => rebuilt.map((c) => {
    const head = c.preface ? `${c.preface} ${_kebab(c.label)}` : _kebab(c.label);
    return c.descs.length ? `${head}: ${c.descs.join(' ')}` : head;
  }).join(', ');

  let guard = 5000;
  while (renderAll().length > TRIM_TARGET && guard-- > 0) {
    let target = -1; let targetMinLen = Infinity;
    for (let i = 0; i < rebuilt.length; i++) {
      if (rebuilt[i].descs.length === 0) continue;
      let minLen = Infinity;
      for (const d of rebuilt[i].descs) if (d.length < minLen) minLen = d.length;
      if (minLen < targetMinLen || (minLen === targetMinLen && rebuilt[i].descs.length > (rebuilt[target]?.descs.length || 0))) { target = i; targetMinLen = minLen; }
    }
    if (target < 0) break;
    const c = rebuilt[target];
    let shortIdx = 0;
    for (let i = 1; i < c.descs.length; i++) if (c.descs[i].length < c.descs[shortIdx].length) shortIdx = i;
    c.descs.splice(shortIdx, 1);
  }
  while (renderAll().length > TRIM_TARGET && rebuilt.some((c) => c.kind === 'env')) {
    for (let i = rebuilt.length - 1; i >= 0; i--) { if (rebuilt[i].kind === 'env') { rebuilt.splice(i, 1); break; } }
  }
  const noticeFor = (n) => (n > 0 ? ` [+${n} hidden]` : '');
  let droppedInst = 0;
  const finalLen = () => renderAll().length + 1 + noticeFor(droppedInst).length;
  while (rebuilt.length > 1 && finalLen() > ceiling) {
    let dropIdx = -1;
    for (let i = rebuilt.length - 1; i >= 0; i--) { if (rebuilt[i].kind === 'inst') { dropIdx = i; break; } }
    if (dropIdx < 0) break;
    rebuilt.splice(dropIdx, 1); droppedInst++;
  }
  let final = renderAll() + '.' + noticeFor(droppedInst);
  if (final.length > ceiling) final = final.slice(0, Math.max(0, ceiling - 16)) + '… [truncated]';
  return final;
}

// ─────────────────────────── compact ───────────────────────────
function compressCompactRecipe(cards, ceiling) {
  let out = cards.map((card) => {
    const preface = _resolvePreface(card);
    return buildStackParts(card).map((p) => (p.kind === 'instrument' && preface) ? `${preface} ${p.label}` : p.label).join(' · ');
  }).join('\n');
  if (out.length <= ceiling) return out;
  out = cards.map((card) => {
    const inst = buildStackParts(card).find((p) => p.kind === 'instrument');
    if (!inst) return '?';
    const preface = _resolvePreface(card);
    return preface ? `${preface} ${inst.label}` : inst.label;
  }).join('\n');
  if (out.length <= ceiling) return out;
  return out.slice(0, ceiling - 16) + '\n[truncated]';
}

// ─────────────────────────── rich ───────────────────────────
function compressRichRecipe(cards, ceiling) {
  const rawChunks = [];
  for (const card of cards) {
    const parts = buildStackParts(card);
    const inst = parts.find((p) => p.kind === 'instrument');
    if (!inst) continue;
    rawChunks.push({ kind: 'inst', label: _kebab(inst.label), preface: _resolvePreface(card) || null, descriptors: _suppressSubsumed(inst.descriptors).slice() });
  }
  if (cards.length > 0) {
    for (const p of buildStackParts(cards[0])) {
      if (p.kind === 'instrument') continue;
      let label = p.label;
      const colonIdx = label.indexOf(': ');
      if (colonIdx >= 0) label = label.slice(colonIdx + 2);
      rawChunks.push({ kind: 'env', label: _kebab(label), preface: null, descriptors: _suppressSubsumed(p.descriptors).slice() });
    }
  }

  const byLabel = new Map();
  const labelOrder = [];
  for (const c of rawChunks) {
    if (byLabel.has(c.label)) {
      const ex = byLabel.get(c.label);
      if (c.preface && !ex.prefaces.includes(c.preface)) ex.prefaces.push(c.preface);
      for (const d of c.descriptors) if (!ex.descriptors.includes(d)) ex.descriptors.push(d);
    } else {
      byLabel.set(c.label, { kind: c.kind, label: c.label, prefaces: c.preface ? [c.preface] : [], descriptors: c.descriptors.slice() });
      labelOrder.push(c.label);
    }
  }

  const trailingGroups = new Map();
  for (const key of labelOrder) {
    const segs = key.split('-');
    const trailing = segs[segs.length - 1];
    if (!trailingGroups.has(trailing)) trailingGroups.set(trailing, []);
    trailingGroups.get(trailing).push(key);
  }
  const bareLabels = new Set(labelOrder);

  const finalChunks = [];
  const emitted = new Set();
  for (const key of labelOrder) {
    if (emitted.has(key)) continue;
    const c = byLabel.get(key);
    const segs = c.label.split('-');
    const trailing = segs[segs.length - 1];
    const group = trailingGroups.get(trailing);
    if (group.length >= 2 && !bareLabels.has(trailing)) {
      const parts = [];
      const pooledDescriptors = [];
      let groupKind = 'inst';
      for (const groupKey of group) {
        const m = byLabel.get(groupKey);
        const memberSegs = m.label.split('-');
        const innerLabel = memberSegs.slice(0, -1).join('-') || null;
        parts.push({ prefaces: m.prefaces.slice(), innerLabel });
        for (const d of m.descriptors) if (!pooledDescriptors.includes(d)) pooledDescriptors.push(d);
        if (m.kind === 'env') groupKind = 'env';
        emitted.add(groupKey);
      }
      finalChunks.push({ kind: groupKind, trailingLabel: trailing, parts, descriptors: pooledDescriptors });
    } else {
      emitted.add(key);
      finalChunks.push({ kind: c.kind, trailingLabel: c.label, parts: [{ prefaces: c.prefaces.slice(), innerLabel: null }], descriptors: c.descriptors.slice() });
    }
  }

  for (const c of finalChunks) c.descriptors = _sortDescriptorsByPriority(c.descriptors);

  const renderChunk = (c) => {
    const tokens = [];
    for (const p of c.parts) {
      for (const pref of p.prefaces) tokens.push(pref);
      if (p.innerLabel) tokens.push(p.innerLabel);
    }
    const head = tokens.length > 0 ? `${tokens.join(' ')} ${c.trailingLabel}` : c.trailingLabel;
    return c.descriptors.length > 0 ? `${head}: ${c.descriptors.join(' ')}` : head;
  };
  const renderAll = () => finalChunks.map(renderChunk).join(', ');

  const TRIM_TARGET = ceiling - 1;
  if (renderAll().length <= TRIM_TARGET) return renderAll() + '.';

  let guard = 5000;
  while (renderAll().length > TRIM_TARGET && guard-- > 0) {
    let target = -1; let targetTier = -Infinity;
    for (let i = 0; i < finalChunks.length; i++) {
      if (finalChunks[i].descriptors.length === 0) continue;
      const last = finalChunks[i].descriptors[finalChunks[i].descriptors.length - 1];
      const t = _descriptorTier(last);
      const better = (t > targetTier) || (t === targetTier && finalChunks[i].descriptors.length > (target >= 0 ? finalChunks[target].descriptors.length : 0));
      if (better) { target = i; targetTier = t; }
    }
    if (target < 0) break;
    finalChunks[target].descriptors.pop();
  }
  while (renderAll().length > TRIM_TARGET && finalChunks.some((c) => c.kind === 'env')) {
    for (let i = finalChunks.length - 1; i >= 0; i--) { if (finalChunks[i].kind === 'env') { finalChunks.splice(i, 1); break; } }
  }
  const noticeFor = (n) => (n > 0 ? ` [+${n} hidden]` : '');
  let droppedInst = 0;
  const finalLen = () => renderAll().length + 1 + noticeFor(droppedInst).length;
  while (finalChunks.length > 1 && finalLen() > ceiling) {
    let dropIdx = -1;
    for (let i = finalChunks.length - 1; i >= 0; i--) { if (finalChunks[i].kind === 'inst') { dropIdx = i; break; } }
    if (dropIdx < 0) break;
    finalChunks.splice(dropIdx, 1); droppedInst++;
  }
  let final = renderAll() + '.' + noticeFor(droppedInst);
  if (final.length > ceiling) final = final.slice(0, Math.max(0, ceiling - 16)) + '… [truncated]';
  return final;
}

// ─────────────────────────── dispatch (no header) ───────────────────────────
function compileStack(cards, format, ceiling) {
  if (!cards || cards.length === 0) return '';
  if (format === 'tags') return compressTagsRecipe(cards, ceiling);
  if (format === 'compact') return compressCompactRecipe(cards, ceiling);
  if (format === 'rich') return compressRichRecipe(cards, ceiling);
  return compressProseRecipe(cards, ceiling);
}

// ─────────────────────────── config → cards adapter ───────────────────────────
// Resolve the recipe's signal chain: archetype components first (period-curated),
// then any inline_chain overrides, then fx_extras appended to fx. Mirrors how
// translate.js / the app resolve the chain for rendering.
function _resolveChainComponents(config) {
  let comp = {};
  if (config.archetype) {
    const arch = (C.CHAIN_ARCHETYPES || []).find((a) => a.id === config.archetype);
    if (arch && arch.components) comp = { ...arch.components };
  }
  if (config.inline_chain) {
    for (const [k, v] of Object.entries(config.inline_chain)) if (v != null) comp[k] = v;
  }
  if (Array.isArray(config.fx_extras) && config.fx_extras.length) {
    const fx = new Set(Array.isArray(comp.fx) ? comp.fx : (comp.fx ? [comp.fx] : []));
    for (const f of config.fx_extras) fx.add(f);
    comp.fx = [...fx];
  }
  return comp;
}

// Build cards from a search/engine config, then auto-assign deduped prefaces.
// The shared chain/tuning/room live on every card (the renderers read env from
// card[0] under the shared-env assumption).
function cardsFromConfig(config) {
  const primary = (config.traditions || [])[0] || null;
  const chain = _resolveChainComponents(config);
  const cards = (config.instruments || []).map((inst) => ({
    instrumentId: inst.id,
    traditionId: primary,
    parts: { ...(inst.slots || {}) },
    tuning: config.tuning || null,
    room: config.room || null,
    chain,
    // A baked-in preface (engine `prefaces` / apply_preface) rides on the config
    // instrument as `preface_lock`; carry it through as a locked card preface so
    // assignDedupedPrefaces surfaces it verbatim instead of auto-matching.
    preface: inst.preface_lock || null,
    prefaceLock: !!inst.preface_lock,
  }));
  assignDedupedPrefaces(cards);
  return cards;
}

function recipeHeaderFromConfig(config) {
  const names = (config.traditions || [])
    .map((tid) => { const t = (C.TRADITIONS || []).find((x) => x.id === tid); return t && t.name; })
    .filter(Boolean);
  return names.length ? names.join(' + ') + ', ' : '';
}

// The connector entrypoint: config → deduped-preface cards → header + body,
// total within `ceiling`. Default format 'rich' (the app's "Current Recipe").
function renderRecipeFromConfig(config, format = 'rich', ceiling = 1000) {
  const cards = cardsFromConfig(config);
  if (cards.length === 0) return '';
  const header = recipeHeaderFromConfig(config);
  const body = compileStack(cards, format, Math.max(1, ceiling - header.length));
  return header + body;
}

module.exports = {
  buildStackParts,
  assignDedupedPrefaces,
  cardsFromConfig,
  compileStack,
  compressProseRecipe,
  compressTagsRecipe,
  compressRichRecipe,
  compressCompactRecipe,
  recipeHeaderFromConfig,
  renderRecipeFromConfig,
  // shared helpers (exported for reuse / tests)
  _kebab,
  _suppressSubsumed,
  _descriptorTier,
  _sortDescriptorsByPriority,
  _resolvePreface,
};
