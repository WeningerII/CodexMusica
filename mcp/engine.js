// engine.js — the connector's deterministic, editable-workspace engine.
//
// Tabula-rasa rewrite: the connector is a
// headless driver of the SAME deterministic workspace the browser app edits —
// NOT a hill-climb search. It seeds a tradition's default cards (== the app's
// "Current Recipe"), then edits them (preface re-derive, variant/room/chain
// overrides, add/remove instruments, add/remove traditions), rendering the Rich
// recipe at every step. No scoring search, no auto-stapling.
//
// State-passing: every recipe op takes a `workspace` ({ cards }) in and returns
// the new `workspace` + rendered recipe; the caller (the model) threads it. The
// heavy lifting lives in the shared SSOT modules (scripts/_workspace_ops.js →
// _seed_workspace.js / _recipe_stack.js / _inverse_configure.js), so the
// connector and the app cannot drift.
//
// ESM over CommonJS engine modules via createRequire (no interop guessing).

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const C = require('../scripts/_loader.js');
const W = require('../scripts/_workspace_ops.js');
const { tokensOf } = require('../scripts/_preface_match.js');
const { assignDedupedPrefaces } = require('../scripts/_recipe_stack.js');
const { seedTraditionCards, defaultParts } = require('../scripts/_seed_workspace.js');
// The product-defining hard recipe cap — single source of truth, re-exported so
// the tool schema (tools.js) derives its max_chars bound from the same constant.
const { RECIPE_CHAR_CEILING } = require('../scripts/_api_contract.js');

// Locale-invariant ordering: localeCompare with no locale argument collates by
// the machine's ICU locale, which made this ordering depend on where it ran.
// Mirrors `_cmp` in scripts/_recipe_stack.js.
const _cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// The chain stages, DERIVED from the catalog rather than written down.
//
// schemas.js enumerates these as named properties instead of accepting an open
// record, which is what keeps the published schema free of propertyNames. It
// needs the list to do that, and it may only depend on zod and this module (see
// its header), so the list is exported from here where the catalog is already
// loaded. Deriving it also means a new stage in the catalog cannot leave the
// connector's schema quietly describing the old set — a hardcoded copy would.
const CHAIN_STAGE_IDS = (C.CHAIN_SECTIONS || []).map((s) => s.id || s.stage);
// `fx` is the only multi-select stage today; _workspace_ops.js lifts a bare id
// into a one-element list for these, so the wire shape stays one plain string.
const CHAIN_MULTI_STAGE_IDS = (C.CHAIN_SECTIONS || [])
  .filter((s) => s.multiSelect)
  .map((s) => s.id || s.stage);
export { RECIPE_CHAR_CEILING, CHAIN_STAGE_IDS, CHAIN_MULTI_STAGE_IDS };

class EngineError extends Error {}

const tradById = (id) => (C.TRADITIONS || []).find((t) => t.id === id);
const instById = (id) => (C.INSTRUMENTS || []).find((i) => i.id === id);
const labelOf = (x) => (x && (x.name || x.label || x.title)) || (typeof x === 'string' ? x : null);

// ─────────────────────────── workspace plumbing ───────────────────────────

// Accept { cards: [...] } (canonical) or a bare cards array (tolerant). Throws a
// guiding error when an edit/render op is called with no workspace.
function normWorkspace(ws, opName) {
  if (ws == null) {
    throw new EngineError(
      `${opName} needs a "workspace" — call start_recipe first and pass its workspace back.`
    );
  }
  if (Array.isArray(ws)) return { cards: ws };
  if (!Array.isArray(ws.cards))
    throw new EngineError('"workspace" must be { cards: [...] } from a previous recipe call.');
  return { cards: ws.cards };
}

// What the model cannot otherwise see: which settings on a card are no longer
// the ones it was seeded with.
//
// A recipe response returns the rendered `recipe` and the full `workspace`, and
// neither answers "did my edit land?" cheaply. The recipe is capped at
// RECIPE_CHAR_CEILING and so is lossy by construction, and the workspace is a
// multi-kilobyte blob the model would have to diff against a baseline it does
// not have. So after set_variant or set_environment the only confirmation was
// prose that may have been truncated away.
//
// `changed` is that diff, computed here where the baseline is known. It is a
// pure function of (workspace, catalog) — no state is kept between calls, and
// the memo below is a catalog cache, not session state.
const _baselineCards = new Map(); // traditionId -> Map(instrumentId -> seeded card)

function baselineForCard(card) {
  if (card.traditionId) {
    let byInst = _baselineCards.get(card.traditionId);
    if (!byInst) {
      byInst = new Map();
      let known = false;
      try {
        for (const c of seedTraditionCards(card.traditionId) || []) {
          byInst.set(c.instrumentId, c);
          known = true;
        }
      } catch {
        // Unknown/removed tradition: fall through to the instrument default.
      }
      // Cache REAL traditions only.
      //
      // This line used to be unconditional, and `card.traditionId` is a string
      // off the wire — workspaceSchema types cards as z.any(), so a caller
      // chooses it. Every distinct value therefore minted a permanent entry in
      // a module-global Map that nothing ever evicted, including the empty Map
      // built for an id that resolves to no tradition. Measured: 400k made-up
      // ids retained ~315 MB after a forced GC, on a 512 MB instance, and the
      // memory was never returned. Roughly forty ordinary-sized requests could
      // OOM the process for everyone, and the restart that followed reset the
      // chat spend counter and the card-id sequence with it.
      //
      // The cache exists to avoid re-seeding the SAME tradition repeatedly, so
      // it only ever needed the ids that name one. There are 2,503 of those and
      // the catalog is immutable, so the bound is the catalog's own size — an
      // attacker-chosen id now costs one seeding attempt and nothing lasting.
      if (known) _baselineCards.set(card.traditionId, byInst);
    }
    const seeded = byInst.get(card.instrumentId);
    if (seeded) return seeded;
  }
  // A card added by hand (add_instrument) has no tradition baseline; its
  // reference point is the instrument's own defaults.
  const inst = instById(card.instrumentId);
  return inst ? { parts: defaultParts(inst), room: null, tuning: null, chain: {} } : null;
}

// Report every field an edit action can write — parts, room, tuning, each chain
// stage, and the preface. Covering parts alone would make the summary look
// authoritative while still hiding the result of set_environment, which is a
// worse contract than saying nothing. Omitted entirely for an untouched card, so
// an unedited workspace costs nothing.
//
// `preface` is here because leaving it out reproduced the exact defect this
// function exists to prevent, on the single most-used action. set_preface writes
// preface/prefaceAuto/prefaceLock; none was reported, so a preface that
// re-derived no parts returned NO `changed` key — "did my edit land?" answered
// with "nothing changed" on an edit that landed. It only looked covered because
// a preface usually moves parts too, and the parts diff stood in for it.
//
// The two flags stay out on purpose: prefaceAuto and prefaceLock are how the
// engine remembers the pick was explicit, not something the caller chose or can
// act on. The answerable question is "which preface is on this card now".
function changedForCard(card) {
  const base = baselineForCard(card);
  if (!base) return null;
  const out = {};

  const parts = {};
  for (const [partId, variantId] of Object.entries(card.parts || {})) {
    if ((base.parts || {})[partId] !== variantId) parts[partId] = variantId;
  }
  if (Object.keys(parts).length) out.parts = parts;

  if ((card.room || null) !== (base.room || null)) out.room = card.room || null;
  if ((card.tuning || null) !== (base.tuning || null)) out.tuning = card.tuning || null;
  if ((card.preface || null) !== (base.preface || null)) out.preface = card.preface || null;

  const chain = {};
  const stages = new Set([...Object.keys(card.chain || {}), ...Object.keys(base.chain || {})]);
  for (const stage of stages) {
    const now = (card.chain || {})[stage];
    const was = (base.chain || {})[stage];
    // fx and friends hold lists; compare by value, not by reference.
    const norm = (v) => (Array.isArray(v) ? v.join('\u0000') : v || null);
    if (norm(now) !== norm(was)) chain[stage] = now === undefined ? null : now;
  }
  if (Object.keys(chain).length) out.chain = chain;

  return Object.keys(out).length ? out : null;
}

// Compact per-card view so the model can reference cards (by id) for the next
// edit and see each instrument's current (deduped) preface without re-reading
// the whole workspace.
function cardsSummary(ws) {
  // Resolve each card's DISPLAYED preface exactly as the renderer does (deduped),
  // on a shallow clone so the caller's workspace is never mutated. Reading
  // c.preface off the live cards would report null for auto cards, since render
  // assigns prefaces on its own clone.
  const view = ws.cards.map((c) => ({ ...c }));
  assignDedupedPrefaces(view);
  return view.map((c, i) => {
    const row = {
      card: c.id,
      instrument: c.instrumentId,
      name: labelOf(instById(c.instrumentId)) || c.instrumentId,
      tradition: c.traditionId || null,
      preface: c.preface || null,
      // Report what the RENDERER does, which is now the same question the app
      // answers: a pinned card (prefaceAuto === false) keeps its preface
      // verbatim and every other card dedups around it. Reading prefaceLock
      // here would say "false" for a card pinned by set_variant and then print
      // that card's preface verbatim anyway — describing the output as the
      // opposite of what it is.
      preface_locked: c.prefaceAuto === false,
    };
    // Diff the STORED card, not this display clone. `view` has had auto prefaces
    // assigned onto it, so diffing it would compare a rendered preface against a
    // stored one and report a change on every card of an untouched seed. What
    // `changed` answers is "what did my edit write", and only the stored card
    // knows that.
    const changed = changedForCard(ws.cards[i]);
    if (changed) row.changed = changed;
    return row;
  });
}

// The standard recipe response: the deliverable string + the state to thread on.
function shape(ws, params = {}, meta = {}) {
  const format = params.format || 'rich';
  // RECIPE_CHAR_CEILING is the canonical Current-Recipe cap; clamp defensively
  // so a direct engine call (bypassing the tool-schema max) can't exceed it.
  const ceiling = Math.min(params.max_chars || RECIPE_CHAR_CEILING, RECIPE_CHAR_CEILING);
  const recipe = W.render(ws, { format, ceiling });
  const out = {
    recipe,
    recipe_chars: recipe.length,
    cards: cardsSummary(ws),
    workspace: ws,
  };
  // Seed responses carry the edit affordance INSIDE the payload — it lands at
  // the exact moment a model decides whether to stop at the default or push it
  // toward the user's words. Deterministic (live catalog counts only).
  if (meta.seeded) {
    out.guidance =
      `Default scaffold — if the user gave any stylistic words, edit before presenting: ` +
      `set_preface per instrument (${(C.PREFACE_LEXICON || []).length} moods via search_prefaces), ` +
      `set_variant per part (see get_instrument), set_environment (any of ` +
      `${(C.ROOMS || []).length} rooms / ${(C.TUNINGS || []).length} tunings / any chain stage — ` +
      `no era or region fences), add/remove instruments and traditions. ` +
      `Batch edits in one edit_recipe call.`;
  }
  return out;
}

// Convert a WorkspaceError (bad id, etc.) into an actionable EngineError.
function wrap(fn) {
  try {
    return fn();
  } catch (e) {
    if (e instanceof W.WorkspaceError) throw new EngineError(e.message);
    throw e;
  }
}

// ─────────────────────────── recipe surface ───────────────────────────

// Seed a fresh workspace from one or more traditions (deterministic defaults =
// the app's Current Recipe). The first tradition is primary; the rest are
// explicit staples (no auto-staple).
export function startRecipe(params = {}) {
  const ids = (params.traditions || []).map((s) => String(s).trim()).filter(Boolean);
  if (ids.length === 0) {
    throw new EngineError(
      'start_recipe needs at least one tradition id — resolve names with search_catalog first.'
    );
  }
  const ws = wrap(() => W.seed(ids));
  return { mode: ids.length > 1 ? 'blend' : 'single', ...shape(ws, params, { seeded: true }) };
}

const EDIT_ACTIONS = [
  'add_tradition',
  'remove_tradition',
  'add_instrument',
  'remove_instrument',
  'set_variant',
  'set_environment',
  'set_preface',
];

// A missing `card` is not a typo, it is a misunderstanding of the model: every
// per-card action here targets ONE instrument, so "record it in a cathedral" or
// "make it all sound bitter" is one edit per card and not one edit. Saying only
// that the field is required leaves a caller to conclude it passed the wrong
// TYPE and try again with a different value; naming the cards says what the
// field is for and which values are in range.
//
// SET_ENVIRONMENT GETS ITS OWN SENTENCE, because the generic one was expensive.
//
// The rendered recipe takes its tuning, room and signal chain from the FIRST
// card and no other — every format does it (`buildStackParts(cards[0])` in
// _recipe_stack.js, mirrored in src/app.js), which is why the app calls that
// card primary. So "record it in a cathedral" is ONE edit on the first card, not
// one edit per instrument.
//
// A previous version of this hint said "each edit targets one instrument — pass
// one edit per card", which pushed a caller toward nineteen edits where one
// would do. Measured on the probe suite, that is what a nineteen-card roster
// then spent its step budget on. Setting the environment on a non-primary card
// is not merely wasteful, it is very nearly a no-op: it never reaches the
// environment line, and can only surface at all by nudging that one card's
// auto-derived preface label.
//
// The other card-taking actions really are per instrument, so they keep the
// generic sentence. An earlier revision used one sentence for all of them and
// misdescribed whichever call it was attached to; a hint read as authoritative
// has to be true of the call that raised it.
function req(ws, e, k) {
  if (e[k] == null || e[k] === '') {
    const cards = ws && Array.isArray(ws.cards) ? ws.cards : null;
    let hint = '';
    if (k === 'card' && cards && cards.length) {
      const names = cards.map((c) => c.instrumentId || c.id);
      hint =
        e.action === 'set_environment'
          ? ` The recipe's tuning, room and chain all come from the FIRST card, so set them there: card: "${names[0]}". Cards: ${names.join(', ')}.`
          : ` Each edit targets one instrument — pass one edit per card. Cards: ${names.join(', ')}.`;
    }
    throw new EngineError(`edit "${e.action}" requires "${k}".${hint}`);
  }
  return e[k];
}

function applyEdit(ws, e) {
  switch (e && e.action) {
    case 'add_tradition':
      return W.addTradition(ws, req(ws, e, 'tradition'));
    case 'remove_tradition':
      return W.removeTradition(ws, req(ws, e, 'tradition'));
    case 'add_instrument':
      return W.addInstrument(ws, req(ws, e, 'instrument'), { tradition: e.tradition });
    case 'remove_instrument':
      return W.removeInstrument(ws, req(ws, e, 'card'));
    case 'set_variant':
      return W.setVariant(ws, req(ws, e, 'card'), req(ws, e, 'part'), req(ws, e, 'variant'));
    case 'set_environment': {
      // AN OMITTED `card` MEANS THE PRIMARY CARD, because there is only one
      // answer it could sensibly mean.
      //
      // The rendered recipe takes its tuning, room and signal chain from
      // cards[0] and no other — every format, in both the connector renderer
      // (_recipe_stack.js) and the browser (src/app.js). So "record it in a
      // cathedral" has exactly one correct target, and requiring the caller to
      // name it bought nothing: it was the single most common recoverable error
      // in the probe suite, and the recovery a caller reached for was usually to
      // repeat the edit across every instrument — nineteen writes, eighteen of
      // which never reach the output.
      //
      // Deliberately NOT applied to the other card-taking actions. set_preface
      // and set_variant really are per-instrument: each one changes only the
      // card it names, so an omitted card there is a genuine ambiguity and still
      // raises (with the roster listed, see req()).
      const ref =
        e.card == null || e.card === ''
          ? ws.cards && ws.cards.length
            ? ws.cards[0].id
            : req(ws, e, 'card') // no cards at all — raise the guiding error
          : e.card;
      return W.setEnvironment(ws, ref, {
        room: e.room,
        tuning: e.tuning,
        chain: e.chain,
      });
    }
    case 'set_preface':
      return W.setPreface(ws, req(ws, e, 'card'), req(ws, e, 'preface'));
    default:
      throw new EngineError(
        `Unknown edit action "${e && e.action}". Valid: ${EDIT_ACTIONS.join(', ')}.`
      );
  }
}

// Apply an ordered list of edits to a workspace, re-render. Each edit is a
// deterministic mutation mirroring a human canvas action; set_preface re-derives
// the card's settings toward the preface (verbatim label) before further edits.
export function editRecipe(params = {}) {
  let ws = normWorkspace(params.workspace, 'edit_recipe');
  const edits = params.edits;
  if (!Array.isArray(edits) || edits.length === 0) {
    throw new EngineError(
      `edit_recipe needs a non-empty "edits" array. Actions: ${EDIT_ACTIONS.join(', ')}.`
    );
  }
  for (let i = 0; i < edits.length; i++) {
    try {
      ws = applyEdit(ws, edits[i]);
    } catch (e) {
      const msg = (e && e.message) || String(e);
      throw new EngineError(`edit[${i}] (${(edits[i] && edits[i].action) || '?'}): ${msg}`);
    }
  }
  return shape(ws, params);
}

// Re-render an existing workspace (e.g. a different format or max_chars) without
// editing it.
export function renderRecipe(params = {}) {
  const ws = normWorkspace(params.workspace, 'render_recipe');
  return shape(ws, params);
}

// ─────────────────────────── discovery ───────────────────────────

const ALL_TYPES = [
  'tradition',
  'instrument',
  'variant',
  'room',
  'tuning',
  'arrangement',
  'aesthetic',
  'preface',
  'chain',
];

// The variant index: one entry per DISTINCT variant id, built once.
//
// Variants used to be walked in place — every (instrument, part, variant) tuple
// scored and pushed as its own row — and that was wrong twice over.
//
// It was wrong for the CALLER, because the row carried no owner. A variant id
// is only usable as (card, part, variant): set_variant needs the part, and the
// row did not say which part accepts it. That is the identical failure the
// chain-stage fix below was written for — a resolved lookup handing back an id
// the caller still cannot spend — and variants are the target of the single
// most common edit. Worse, the same id was pushed once per owning tuple, so
// searching "mahogany" returned 5,354 rows of which the top ten held two
// distinct ids: a page of duplicates where the answer should have been.
//
// It was wrong for the SERVER, because mergeFamilyParts copies the 655-variant
// materials table into every string instrument, so those tuples number 323,709
// against 10,950 distinct ids — a 30x multiplier on the hottest tool in the
// connector, on a single-process instance, where the work is synchronous and
// blocks every other caller.
//
// So: distinct ids, each carrying the parts that accept it. Built lazily and
// memoised because it is a pure function of an immutable catalog. Ordering is
// catalog order throughout, with part lists sorted, so results stay
// deterministic.
let _variantIndex = null;
function variantIndex() {
  if (_variantIndex) return _variantIndex;
  const byId = new Map();
  for (const inst of C.INSTRUMENTS || []) {
    for (const part of inst.parts || []) {
      for (const v of part.variants || []) {
        let e = byId.get(v.id);
        if (!e) {
          e = {
            id: v.id,
            name: v.name || v.id,
            descriptors: new Set(),
            parts: new Set(),
            instruments: new Set(),
          };
          byId.set(v.id, e);
        }
        for (const d of v.descriptors || []) e.descriptors.add(d);
        e.parts.add(part.id);
        e.instruments.add(inst.id);
      }
    }
  }
  _variantIndex = [];
  for (const e of byId.values()) {
    _variantIndex.push({
      id: e.id,
      name: e.name,
      hay: [...e.descriptors].join(' '),
      parts: [...e.parts].sort(_cmp),
      instrumentCount: e.instruments.size,
    });
  }
  return _variantIndex;
}

// Free-text search across the catalog → ids to feed start_recipe / edit_recipe /
// get_instrument. Multi-term: records rank by how many query terms they match.
export function searchCatalog({ query, types, limit = 20 } = {}) {
  if (!query || !String(query).trim()) throw new EngineError('search_catalog needs a query.');
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const want = new Set(Array.isArray(types) && types.length ? types : ALL_TYPES);
  // One compiled matcher per TERM, not per term per row.
  //
  // The word-boundary RegExp used to be constructed inside the per-term loop
  // inside add(), i.e. once for every (row, term) pair — tens of thousands of
  // identical compilations per query, and the largest single cost in the
  // profile after the variant blowup. The pattern depends only on the term.
  const matchers = terms.map((t) => ({
    t,
    re: new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`),
  }));
  // Field-weighted, because counting hits does not rank. Every row used to score
  // 1 per matched term with no regard for WHERE the term hit, so a single-term
  // query left every result tied and the codepoint tiebreak became the ordering:
  // "country" returned all 37 traditions in alphabetical order, putting the
  // tradition actually named `country` ninth, behind `australian_didgeridoo_
  // yidaki_extended`. A hit on an id or a name is evidence about the record; a
  // hit in descriptor or lineage prose is a hint, and they were being counted the
  // same. Weighting them apart is also what lets one query serve moods and nouns
  // alike — the reason search_prefaces had to exist as a separate view was that
  // prose hits on tape and bamboo outranked exact preface names.
  const EXACT = 8;
  const WORD = 3;
  const PROSE = 1;
  const rows = [];
  // `extra` carries fields that make a hit USABLE, not merely findable. Today
  // only chain rows need one — see the CHAIN_SECTIONS loop below.
  const add = (type, id, name, hay, extra) => {
    if (!want.has(type)) return;
    const idL = String(id).toLowerCase();
    const nameL = String(name || '').toLowerCase();
    const proseL = String(hay || '').toLowerCase();
    const label = idL + ' ' + nameL;
    let score = 0;
    let hits = 0;
    for (const { t, re } of matchers) {
      let best = 0;
      if (idL === t || nameL === t) best = EXACT;
      else if (re.test(label)) best = WORD;
      else if (label.includes(t)) best = WORD - 1;
      else if (proseL.includes(t)) best = PROSE;
      if (best > 0) hits++;
      score += best;
    }
    // Every query term matching somewhere beats a partial match, whatever the
    // fields: "delta blues" should not lose to a record that only says "blues".
    if (hits === terms.length && terms.length > 1) score += EXACT;
    if (score > 0) rows.push({ type, id, name: name || id, matched: score, ...extra });
  };
  for (const t of C.TRADITIONS || [])
    add('tradition', t.id, t.name, `${t.lineage || ''} ${t.family || ''}`);
  for (const i of C.INSTRUMENTS || []) add('instrument', i.id, i.name, i.family || '');
  // One row per distinct variant, carrying the parts that accept it — the fact
  // set_variant needs and the old per-tuple rows withheld.
  //
  // `parts` is listed only when the list is COMPLETE. A narrowly-scoped variant
  // is the case where the caller genuinely cannot guess the part, and there the
  // full list makes the next call possible. A shared material like `mahogany`
  // sits on 153 parts across 140 instruments, and printing the first six of
  // those in id order would be six parts belonging to whatever instruments sort
  // first — `ajaeng_body_wood` for someone holding a guitar. That is not a
  // truncated answer, it is a wrong one, and it invites exactly the misdirected
  // set_variant this row exists to prevent. So when the list does not fit, the
  // row says how big it is and the caller reads the parts off their own card
  // with get_instrument.
  const PARTS_SHOWN = 6;
  if (want.has('variant')) {
    for (const v of variantIndex()) {
      const complete = v.parts.length <= PARTS_SHOWN;
      add('variant', v.id, v.name, v.hay, {
        ...(complete ? { parts: v.parts } : {}),
        part_count: v.parts.length,
        instruments: v.instrumentCount,
      });
    }
  }
  for (const r of C.ROOMS || []) add('room', r.id, r.name, (r.descriptors || []).join(' '));
  for (const t of C.TUNINGS || []) add('tuning', t.id, t.name, (t.descriptors || []).join(' '));
  for (const a of C.ARRANGEMENTS || []) add('arrangement', a.id, a.name, '');
  for (const a of C.PRODUCTION_AESTHETICS || []) add('aesthetic', a.id, a.name, '');
  for (const p of C.PREFACE_LEXICON || [])
    add('preface', p.id, p.name || p.id, tokensOf(p).join(' '));
  // Chain hits carry the STAGE that accepts them. Every other type in this index
  // is addressed by id alone — `set_preface` takes a preface id and that is the
  // whole of it — but a chain id is only usable as `chain: {<stage>: <id>}`, and
  // there are eight stages. Returning the id without the stage therefore handed
  // the caller a one-in-eight guess on the last step of an otherwise resolved
  // lookup, and this loop had `sec.id` in hand the entire time.
  //
  // Measured, not hypothesised: searching "underwater" returns exactly one row,
  // `hydrophone_piezo`, and a hydrophone is a MICROPHONE. Gemini 3.1 Flash-Lite
  // searched correctly, got that row, guessed `fx`, and was refused — then spent
  // four more calls and 60k tokens re-guessing, because nothing it could reach
  // held the missing fact. `list_options` does not either: `chain_sections`
  // enumerates the eight stage names, not their items. The model was not wrong
  // about the catalog; the catalog was not telling it.
  for (const sec of C.CHAIN_SECTIONS || [])
    for (const it of sec.items || [])
      add('chain', it.id, it.name, (it.descriptors || []).join(' '), {
        stage: sec.id || sec.stage,
      });
  rows.sort((a, b) => b.matched - a.matched || _cmp(a.id, b.id));
  return { query, total: rows.length, items: rows.slice(0, Math.min(limit, 50)) };
}

// Search the 741 prefaces (named aesthetic/technique/delivery signatures) by
// mood words → preface ids for set_preface. Substring-ranked over id/name/tokens.
export function searchPrefaces({ query, limit = 15 } = {}) {
  if (!query || !String(query).trim())
    throw new EngineError('search_prefaces needs mood/feel words.');
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const rows = [];
  for (const p of C.PREFACE_LEXICON || []) {
    const toks = tokensOf(p);
    const hay = `${p.id} ${p.name || ''} ${toks.join(' ')}`.toLowerCase();
    let score = 0;
    for (const t of terms) if (hay.includes(t)) score++;
    if (score > 0)
      rows.push({ id: p.id, name: p.name || p.id, matched: score, tokens: toks.slice(0, 12) });
  }
  rows.sort((a, b) => b.matched - a.matched || _cmp(a.id, b.id));
  return { query, total: rows.length, items: rows.slice(0, Math.min(limit, 50)) };
}

// The knob catalog for one instrument: every part + the variant ids valid for
// set_variant, with labels and which is the default.
// Per-part variant budget. A handful of parts inherit a universal materials
// table — string_acoustic, orch_strings, guitarron_strings and pedal_steel_strings
// all carry 655 variants — so the honest "return the whole record" shape made
// this the most expensive call in the connector by two orders of magnitude:
// acoustic_guitar_dread serialised to 208,883 bytes (~52k tokens, roughly fifty
// times the entire tool menu) and 91 of 870 instruments cleared 100 KB, against a
// median of 2,156. The caller wants the knobs it can turn, not the catalog.
// Budget is TOTAL, not per-part, or the cap simply moves: `voice` has 16 parts,
// so a flat 40-per-part still returned 312 variants and got no smaller. The
// per-part share is derived from how many parts there are, with a floor so a
// wide instrument still shows something real under each heading.
const VARIANT_BUDGET = 120;
const MIN_PER_PART = 4;

export function getInstrument({ id, part, query, limit } = {}) {
  const i = instById(id);
  if (!i)
    throw new EngineError(
      `Unknown instrument id: "${id}" (use search_catalog types=["instrument"]).`
    );
  const partCount = part ? 1 : (i.parts || []).length || 1;
  const cap = limit
    ? Math.max(1, Math.min(limit, 200))
    : Math.max(MIN_PER_PART, Math.floor(VARIANT_BUDGET / partCount));
  const terms = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  let parts = i.parts || [];
  if (part) {
    const only = parts.find((p) => p.id === part);
    if (!only) {
      throw new EngineError(
        `Instrument "${i.id}" has no part "${part}". Parts: ${parts.map((p) => p.id).join(', ')}`
      );
    }
    parts = [only];
  }

  const out = parts.map((p) => {
    const all = p.variants || [];
    // The default always survives filtering and truncation — it is the one
    // variant the caller needs to know in order to decide whether to change it.
    const scored = all.map((v) => {
      const hay = (
        v.id +
        ' ' +
        (labelOf(v) || '') +
        ' ' +
        (v.descriptors || []).join(' ')
      ).toLowerCase();
      let score = 0;
      for (const t of terms) if (hay.includes(t)) score++;
      return { v, score };
    });
    const matched = terms.length ? scored.filter((x) => x.score > 0) : scored;
    matched.sort((a, b) => b.score - a.score || (b.v.default ? 1 : 0) - (a.v.default ? 1 : 0));
    const shown = matched.slice(0, cap).map((x) => x.v);
    if (!shown.some((v) => v.default)) {
      const def = all.find((v) => v.default);
      if (def) shown.unshift(def);
    }
    const rec = {
      id: p.id,
      name: labelOf(p) || p.id,
      variant_count: all.length,
      variants: shown.map((v) => ({
        id: v.id,
        name: labelOf(v) || v.id,
        default: !!v.default,
      })),
    };
    if (shown.length < all.length) {
      rec.truncated = true;
      rec.hint = terms.length
        ? `${matched.length} of ${all.length} variants match "${query}"; showing ${shown.length}. Raise \`limit\` or refine \`query\`.`
        : `${all.length} variants; showing ${shown.length}. Pass \`query\` to filter (e.g. "mahogany"), \`part\` to focus one part, or raise \`limit\`.`;
    }
    return rec;
  });

  return { id: i.id, name: labelOf(i) || i.id, family: i.family || null, parts: out };
}

export function getTradition({ id } = {}) {
  const t = tradById(id);
  if (!t)
    throw new EngineError(
      `Unknown tradition id: "${id}" (use search_catalog types=["tradition"]).`
    );
  const ext = (C.TRADITION_EXTRAS || {})[id] || {};
  return {
    id: t.id,
    name: labelOf(t) || t.id,
    family: t.family || null,
    lineage: t.lineage || null,
    axes: ext.axes || null,
    instruments: t.instruments || [],
    source: t,
  };
}

export function listTraditions({ query, family, limit = 50, offset = 0 } = {}) {
  let items = C.TRADITIONS || [];
  if (family) items = items.filter((t) => t.family === family);
  if (query) {
    const q = String(query).toLowerCase();
    items = items.filter((t) => t.id.includes(q) || (labelOf(t) || '').toLowerCase().includes(q));
  }
  const total = items.length;
  const page = items
    .slice(offset, offset + limit)
    .map((t) => ({ id: t.id, name: labelOf(t) || t.id, family: t.family || null }));
  return { total, count: page.length, offset, items: page };
}

export function listOptions({ kind } = {}) {
  const tables = {
    rooms: C.ROOMS,
    tunings: C.TUNINGS,
    chain_sections: C.CHAIN_SECTIONS,
    archetypes: C.CHAIN_ARCHETYPES,
    aesthetics: C.PRODUCTION_AESTHETICS,
    arrangements: C.ARRANGEMENTS,
    instrument_families: C.INSTRUMENT_FAMILIES,
    axes: C.AXIS_DEFINITIONS,
  };
  if (kind === 'tradition_families') {
    const fams = [...new Set((C.TRADITIONS || []).map((t) => t.family).filter(Boolean))].sort();
    return { kind, count: fams.length, items: fams.map((f) => ({ id: f, name: f })) };
  }
  const table = tables[kind];
  if (table === undefined) {
    throw new EngineError(
      `Unknown options kind: "${kind}". Valid: ${[...Object.keys(tables), 'tradition_families'].join(', ')}`
    );
  }
  const items = Array.isArray(table)
    ? table.map((x) => ({ id: x.id ?? x, name: labelOf(x) || x.id || String(x) }))
    : Object.keys(table || {}).map((k) => ({ id: k, name: labelOf(table[k]) || k }));
  return { kind, count: items.length, items };
}

export const counts = {
  traditions: (C.TRADITIONS || []).length,
  instruments: (C.INSTRUMENTS || []).length,
  prefaces: (C.PREFACE_LEXICON || []).length,
};

export { EngineError };
