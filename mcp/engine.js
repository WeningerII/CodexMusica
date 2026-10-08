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
const {
  assignDedupedPrefaces,
  buildStackParts,
  envCardOf,
  _kebab,
} = require('../scripts/_recipe_stack.js');
const {
  seedTraditionCards,
  defaultParts,
  makeCard,
  traditionCardOpts,
} = require('../scripts/_seed_workspace.js');
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
// What set_environment's `clear` may name: room, tuning and every chain stage.
const ENV_FIELDS = ['room', 'tuning', ...CHAIN_STAGE_IDS];
// The widest part in the catalog, for get_instrument's description. Derived, so
// the published text cannot go on quoting a table size the catalog outgrew.
const WIDEST_PART_VARIANTS = Math.max(
  0,
  ...(C.INSTRUMENTS || []).flatMap((i) => (i.parts || []).map((p) => (p.variants || []).length))
);
// list_traditions pages through the catalog; one page is bounded so a single
// call cannot hand back the whole table.
const LIST_TRADITIONS_MAX = 100;
export {
  RECIPE_CHAR_CEILING,
  CHAIN_STAGE_IDS,
  CHAIN_MULTI_STAGE_IDS,
  ENV_FIELDS,
  WIDEST_PART_VARIANTS,
  LIST_TRADITIONS_MAX,
};

class EngineError extends Error {}

// A retired (merged) tradition id resolves to the tradition it was merged into
// (references/_tradition_aliases.json), everywhere a caller names a tradition.
const liveTradId = (id) => C.resolveTraditionId(typeof id === 'string' ? id.trim() : id);
const tradById = (id) => (C.TRADITIONS || []).find((t) => t.id === liveTradId(id));
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
  const cards = Array.isArray(ws) ? ws : ws.cards;
  if (!Array.isArray(cards))
    throw new EngineError('"workspace" must be { cards: [...] } from a previous recipe call.');
  // A workspace saved before a merge may carry a retired tradition id on its
  // cards; it is rewritten to the surviving id so headers, baselines and
  // remove_tradition all see one tradition.
  return {
    cards: cards.map((c) =>
      c && typeof c.traditionId === 'string' && liveTradId(c.traditionId) !== c.traditionId
        ? { ...c, traditionId: liveTradId(c.traditionId) }
        : c
    ),
  };
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
    // An instrument added into a tradition whose roster does not carry it: its
    // reference point is exactly what add_instrument {tradition} builds for it.
    // Without this a guest card read as a bare one, and reported the room,
    // tuning and chain it was born with as changes nobody made. Not cached: the
    // (tradition, instrument) pairs number in the millions, and building one is
    // a handful of lookups.
    const trad = tradById(card.traditionId);
    if (trad && instById(card.instrumentId))
      return makeCard(card.instrumentId, traditionCardOpts(trad, card.instrumentId));
  }
  // A card added by hand (add_instrument) has no tradition baseline; its
  // reference point is the instrument's own defaults.
  const inst = instById(card.instrumentId);
  return inst ? { parts: defaultParts(inst), room: null, tuning: null, chain: {} } : null;
}

// One environment field of a card, normalised so two cards can be compared: a
// room/tuning/single-select stage is an id or null, a multi-select stage is a
// list (an absent one reads as empty, which is how both renderers treat it).
function envValue(card, field) {
  if (field === 'room' || field === 'tuning') return (card && card[field]) || null;
  const v = ((card && card.chain) || {})[field];
  if (CHAIN_MULTI_STAGE_IDS.includes(field)) return Array.isArray(v) ? v : [];
  return v || null;
}
const sameValue = (a, b) =>
  Array.isArray(a) || Array.isArray(b)
    ? (a || []).join('\u0000') === (b || []).join('\u0000')
    : (a || null) === (b || null);

// The environment fields on which a card differs from its seeded baseline —
// what an edit put there. Used to decide which environment words a response has
// to account for; an untouched card has none.
function explicitEnv(card) {
  const base = baselineForCard(card);
  if (!base) return [];
  return ENV_FIELDS.filter((f) => !sameValue(envValue(card, f), envValue(base, f)));
}

// The card's whole environment as a caller would name it. Empty stages are left
// out so a response does not spell eight nulls to say "a room and a mic".
function envSettings(card) {
  if (!card) return null;
  const chain = {};
  for (const stage of CHAIN_STAGE_IDS) {
    const v = envValue(card, stage);
    if (Array.isArray(v) ? v.length : v) chain[stage] = v;
  }
  return { room: envValue(card, 'room'), tuning: envValue(card, 'tuning'), chain };
}

// The catalog names of the items a field holds — the words a render carries.
function envItemNames(field, value) {
  const ids = Array.isArray(value) ? value : value ? [value] : [];
  const table =
    field === 'room'
      ? C.ROOMS
      : field === 'tuning'
        ? C.TUNINGS
        : ((C.CHAIN_SECTIONS || []).find((s) => (s.id || s.stage) === field) || {}).items;
  return ids.map((id) => {
    const it = (table || []).find((x) => x.id === id);
    return { field, id, name: (it && it.name) || id };
  });
}

// Does an environment item's label appear in the rendered recipe? A text-presence
// check, like the descriptor one beside it: rich, tags and prose print the label
// kebab-cased (tags behind its stage word), compact prints the catalog name, and
// prose may merge two environment labels that end in the same word
// ("analog-tape-15 tube-deck ips"), so the head and the shared tail both count.
function envLiteral(recipeLower, name) {
  const k = _kebab(name);
  if (!k) return true;
  if (recipeLower.includes(k) || recipeLower.includes(String(name).toLowerCase())) return true;
  const segs = k.split('-');
  if (segs.length < 2) return false;
  const tail = segs[segs.length - 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    recipeLower.includes(segs.slice(0, -1).join('-')) &&
    new RegExp(`(^|[^a-z0-9])${tail}([^a-z0-9]|$)`).test(recipeLower)
  );
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
//
// And it is answered for the preface the card DISPLAYS, never the stored field.
// On a card whose preface is still auto-derived the stored value is a cache the
// renderer ignores (it re-derives and dedups every auto card), and set_variant
// rewrites that cache on every edit — so diffing it reported a preface change on
// three edits in four whose recipe showed the same preface as before. A pinned
// card shows its own preface verbatim; it is reported only when that differs
// from what it would show if no card's preface were pinned (every pinned card
// back to its seeded self, the rest of the roster as it is). One extra dedup
// pass answers that for every card at once; a pass per pinned card would make a
// response quadratic in the roster.
function changedForCard(cards, i, shown, unpinnedShown) {
  const card = cards[i];
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
  if (card.prefaceAuto === false && (shown || null) !== (unpinnedShown || null))
    out.preface = shown || null;

  const chain = {};
  for (const stage of CHAIN_STAGE_IDS) {
    // fx and friends hold lists; compare by value, not by reference. An empty
    // list and an absent stage are the same thing to both renderers, so a bare
    // card's `fx: []` is not a change.
    const now = envValue(card, stage);
    if (!sameValue(now, envValue(base, stage))) chain[stage] = now;
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
  let unpinned = null;
  if (ws.cards.some((c) => c.prefaceAuto === false)) {
    unpinned = ws.cards.map((c) => {
      if (c.prefaceAuto !== false) return { ...c };
      const base = baselineForCard(c);
      return base ? { ...base, id: c.id, preface: null, prefaceAuto: true } : { ...c };
    });
    assignDedupedPrefaces(unpinned);
  }
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
    // knows that. The displayed preface rides along for the one field that has
    // to be judged by what shows.
    const changed = changedForCard(ws.cards, i, c.preface, unpinned && unpinned[i].preface);
    if (changed) row.changed = changed;
    return row;
  });
}

// The standard recipe response: the deliverable string + the state to thread on.
// `meta.warnings` carries what only the edit sequence can know (an environment
// that moved or was overwritten mid-batch); everything else here is a pure
// function of the workspace and the render.
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
  // The renderer's own rule (envCardOf), not a restatement of it: the card named
  // here is the one every format takes the environment from, and the one a
  // set_environment without `card` writes to.
  const environment = envCardOf(ws.cards);
  out.render_scope = {
    environment_card: environment?.id || null,
    environment_settings: envSettings(environment),
    environment:
      'One shared room/tuning/signal chain, taken whole from environment_card (the first card that has any). ' +
      'set_environment without `card` writes there. Other cards do not create individual audio paths.',
    output:
      'Text recipe only; no recording, mix, stereo placement or listening test was performed.',
  };
  out.render_warnings = [];
  for (const card of ws.cards) {
    const parts = Object.fromEntries((card.pinnedParts || []).map((id) => [id, card.parts[id]]));
    const instrument = buildStackParts({ ...card, parts }).find((p) => p.kind === 'instrument');
    const missing = (instrument?.descriptors || []).filter((d) => !recipe.includes(d));
    if (missing.length)
      out.render_warnings.push({
        card: card.id,
        code: 'PINNED_DESCRIPTORS_NOT_LITERAL',
        descriptors: missing,
        meaning:
          'Explicit part descriptors are absent literally from this output; compression or subsumption may remove them. Do not claim they survived.',
      });
    if (card.prefaceAuto === false && card.preface && !recipe.includes(card.preface))
      out.render_warnings.push({
        card: card.id,
        code: 'EXPLICIT_PREFACE_NOT_LITERAL',
        preface: card.preface,
      });
  }
  // The environment words an edit put on the rendered environment card, checked
  // against the output like the part descriptors above. Compression drops the
  // environment chunks first under pressure (compact drops its whole line), so a
  // requested room or mic could fall out of a long blend while `changed` still
  // reported it — a confirmation of words the recipe did not contain.
  if (environment && recipe) {
    const lower = recipe.toLowerCase();
    const items = explicitEnv(environment)
      .flatMap((f) => envItemNames(f, envValue(environment, f)))
      .filter((it) => !envLiteral(lower, it.name));
    if (items.length)
      out.render_warnings.push({
        card: environment.id,
        code: 'ENVIRONMENT_NOT_LITERAL',
        items,
        meaning:
          'These environment settings are on the environment card but their names are absent from this output; compression removes environment chunks first. Do not claim they survived.',
      });
  }
  for (const w of meta.warnings || []) out.render_warnings.push(w);
  // Seed responses carry the edit affordance INSIDE the payload — it lands at
  // the exact moment a model decides whether to stop at the default or push it
  // toward the user's words. Deterministic (live catalog counts only).
  if (meta.seeded) {
    out.guidance =
      `Default scaffold — if the user gave any stylistic words, edit before presenting: ` +
      `set_preface per instrument (${(C.PREFACE_LEXICON || []).length} moods via search_prefaces), ` +
      `set_variant per part (see get_instrument), set_environment once for the whole recording (any of ` +
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
  const asked = (params.traditions || []).map((s) => String(s).trim()).filter(Boolean);
  const ids = asked.map(liveTradId);
  if (ids.length === 0) {
    throw new EngineError(
      'start_recipe needs at least one tradition id — resolve names with search_catalog first.'
    );
  }
  // A repeated id seeds every one of that tradition's cards twice — a doubled
  // roster the caller did not ask for and would have to remove card by card.
  const repeated = ids.find((id, i) => ids.indexOf(id) !== i);
  if (repeated) {
    const merged = asked.filter((a, i) => ids[i] === repeated && a !== repeated);
    throw new EngineError(
      `start_recipe lists "${repeated}" more than once` +
        (merged.length ? ` ("${merged.join('", "')}" was merged into "${repeated}")` : '') +
        ', which would seed each of its cards twice. List each tradition once.'
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
  'move_instrument',
];

// A missing `card` is not a typo, it is a misunderstanding of the model: every
// action that requires one targets ONE instrument, so "make it all sound bitter"
// is one edit per card and not one edit. Saying only that the field is required
// leaves a caller to conclude it passed the wrong TYPE and try again with a
// different value; naming the cards says what the field is for and which values
// are in range.
//
// set_environment is not among them: it takes an optional card and, without
// one, writes to the card the environment renders from (see setEnvironment in
// scripts/_workspace_ops.js). An earlier hint here steered callers to "the FIRST
// card", which stopped being the rule when the renderer moved to envCardOf.
function req(ws, e, k) {
  if (e[k] == null || e[k] === '') {
    const cards = ws && Array.isArray(ws.cards) ? ws.cards : null;
    let hint = '';
    if (k === 'card' && cards && cards.length) {
      const names = cards.map((c) => c.instrumentId || c.id);
      hint = ` Each edit targets one instrument — pass one edit per card. Cards: ${names.join(', ')}.`;
    }
    throw new EngineError(`edit "${e.action}" requires "${k}".${hint}`);
  }
  return e[k];
}

const traditionsIn = (ws) => [...new Set(ws.cards.map((c) => c.traditionId).filter(Boolean))];

// The fields a set_environment edit actually carries. The published edit object
// is not strict (additionalProperties is outside the schema subset restricted
// clients accept), so a misspelled field — `tunning`, `rooms`, a stage written
// beside `chain` instead of inside it — is dropped before it arrives, and what
// reaches here is an edit that sets nothing. That is refused by meaning rather
// than by schema: an environment edit with nothing to set is never what a
// caller meant.
function envPatch(e) {
  const chain = Object.fromEntries(
    Object.entries(e.chain || {}).filter(([, v]) => v !== undefined)
  );
  const clear = Array.isArray(e.clear) ? e.clear : e.clear != null ? [e.clear] : [];
  if (
    e.room === undefined &&
    e.tuning === undefined &&
    Object.keys(chain).length === 0 &&
    clear.length === 0
  )
    throw new EngineError(
      'set_environment sets nothing. It takes room, tuning, chain {<stage>: <id>} ' +
        `(stages: ${CHAIN_STAGE_IDS.join(', ')}) and clear [${ENV_FIELDS.join(', ')}]; any other ` +
        'field name is dropped before it arrives. A chain stage goes inside chain, e.g. chain: {"mic": "<id>"}.'
    );
  return { room: e.room, tuning: e.tuning, chain, clear };
}

function applyEdit(ws, e) {
  switch (e && e.action) {
    case 'add_tradition': {
      const tid = liveTradId(req(ws, e, 'tradition'));
      // Adding a tradition that is already here seeds every one of its cards a
      // second time. The app lets a person re-import, and sees the doubled
      // group; a caller only gets a longer recipe with every instrument twice.
      if (ws.cards.some((c) => c.traditionId === tid))
        throw new EngineError(
          `Tradition "${tid}" is already in this recipe; adding it again would duplicate each of its cards. ` +
            `To add one more of its instruments use add_instrument {instrument, tradition: "${tid}"}.`
        );
      return W.addTradition(ws, tid);
    }
    case 'remove_tradition': {
      const tid = liveTradId(req(ws, e, 'tradition'));
      if (tradById(tid) && !ws.cards.some((c) => c.traditionId === tid))
        throw new EngineError(
          `Tradition "${tid}" is not in this recipe, so there is nothing to remove. ` +
            `Traditions here: ${traditionsIn(ws).join(', ') || '(none)'}.`
        );
      return W.removeTradition(ws, tid);
    }
    case 'add_instrument':
      return W.addInstrument(ws, req(ws, e, 'instrument'), { tradition: e.tradition });
    case 'remove_instrument':
      return W.removeInstrument(ws, req(ws, e, 'card'));
    case 'set_variant':
      return W.setVariant(ws, req(ws, e, 'card'), req(ws, e, 'part'), req(ws, e, 'variant'));
    case 'set_environment':
      // An omitted `card` is passed through as omitted: the op resolves it to the
      // card the recipe renders its environment from, which is the one answer
      // "record it in a cathedral" can mean. set_preface and set_variant keep
      // requiring a card — each changes only the card it names, so an omitted
      // one there is a genuine ambiguity.
      return W.setEnvironment(ws, e.card === '' ? null : e.card, envPatch(e));
    case 'set_preface':
      return W.setPreface(ws, req(ws, e, 'card'), req(ws, e, 'preface'));
    case 'move_instrument':
      return W.moveInstrument(ws, req(ws, e, 'card'), e.before);
    default:
      throw new EngineError(
        `Unknown edit action "${e && e.action}". Valid: ${EDIT_ACTIONS.join(', ')}.`
      );
  }
}

// What one edit did to the rendered environment, which the workspace alone
// cannot say afterwards. The environment is stored on a card and rendered from
// one card (envCardOf), so two things can take an environment away without the
// caller touching it:
//
//   ENVIRONMENT_MOVED — the environment card changed (it was removed, moved, or
//     another card now comes first with an environment of its own) and settings
//     an edit had put on the old one are not what renders now. The app behaves
//     the same way — its recipe follows the same card — but a person watches the
//     Recording environment panel change; a caller only sees a shorter recipe.
//   ENVIRONMENT_OVERWRITTEN — set_preface re-derives the card's room, tuning and
//     chain toward the preface, as the app's preface pick does, and replaced
//     settings an edit had put on the environment card.
//
// "Put there by an edit" means differing from the card's seeded baseline — the
// same test `changed` uses — so a seeded environment changing hands is not
// reported: that is what move_instrument is for.
//
// One more way in: a set_environment that clears EVERY setting on the
// environment card leaves it with none, so the renderer moves on to the next
// card that has one — and in a seeded tradition that card carries the same
// environment, so the cleared settings render again. The app does the same;
// the response says so, and names the step that gets there.
function environmentTransition(before, after, i, e, target) {
  const a = envCardOf(before.cards);
  if (!a) return [];
  const b = envCardOf(after.cards);
  if (b && b.id !== a.id && e.action === 'set_environment' && target === a.id) {
    const back = {};
    for (const f of Array.isArray(e.clear) ? e.clear : []) {
      const now = envValue(b, f);
      if (Array.isArray(now) ? now.length : now) back[f] = { was: null, now };
    }
    if (Object.keys(back).length)
      return [
        {
          card: a.id,
          code: 'ENVIRONMENT_MOVED',
          edit: i,
          action: e.action,
          environment_card: b.id,
          settings: back,
          meaning:
            "Clearing left this card with no environment, so the recipe now renders environment_card's, which has these settings of its own. To render none, clear them on environment_card too (repeat the edit without `card`).",
        },
      ];
  }
  const explicit = explicitEnv(a);
  if (!explicit.length) return [];
  const lost = {};
  for (const f of explicit) {
    const now = b ? envValue(b, f) : null;
    if (!sameValue(envValue(a, f), now)) lost[f] = { was: envValue(a, f), now };
  }
  if (!Object.keys(lost).length) return [];
  if (!b || b.id !== a.id)
    return [
      {
        card: a.id,
        code: 'ENVIRONMENT_MOVED',
        edit: i,
        action: e.action,
        environment_card: b ? b.id : null,
        settings: lost,
        meaning:
          'The environment set on this card no longer renders: the recipe takes its environment from environment_card now (the first card that has one). Repeat set_environment without `card` to apply it there.',
      },
    ];
  if (e.action === 'set_environment') return [];
  return [
    {
      card: a.id,
      code: 'ENVIRONMENT_OVERWRITTEN',
      edit: i,
      action: e.action,
      settings: lost,
      meaning: `${e.action} re-derived this card's environment, replacing what was set before (set_preface re-derives room, tuning and chain toward the preface). Put set_environment after set_preface to keep both.`,
    },
  ];
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
  const warnings = [];
  const envTargets = [];
  for (let i = 0; i < edits.length; i++) {
    const before = ws;
    const e = edits[i];
    try {
      ws = applyEdit(ws, e);
    } catch (err) {
      const msg = (err && err.message) || String(err);
      throw new EngineError(`edit[${i}] (${(e && e.action) || '?'}): ${msg}`);
    }
    let target = null;
    if (e.action === 'set_environment') {
      const card = e.card ? W.findCard(before, e.card) : envCardOf(before.cards);
      target = card ? card.id : null;
      if (target) envTargets.push({ edit: i, card: target });
    }
    warnings.push(...environmentTransition(before, ws, i, e, target));
  }
  // A batch may pass through an empty roster (remove the only tradition, then add
  // its replacement); it may not END there. An empty workspace renders "" and
  // came back as an ordinary success — a recipe the caller would present.
  if (ws.cards.length === 0)
    throw new EngineError(
      'These edits leave the recipe with no cards. Keep at least one: add the replacement ' +
        '(add_tradition or add_instrument) in the same batch, or call start_recipe to begin again.'
    );
  // An explicit `card` that is not the environment card stores a room/tuning/
  // chain no format renders. Said per edit, because only this call knows the
  // write was an environment request rather than a preface cascade.
  const env = envCardOf(ws.cards);
  for (const t of envTargets) {
    if (!ws.cards.some((c) => c.id === t.card) || t.card === env.id) continue;
    warnings.push({
      card: t.card,
      code: 'ENVIRONMENT_NOT_RENDERED',
      edit: t.edit,
      environment_card: env.id,
      meaning:
        'This card is not the one the recipe renders its environment from, so the setting is stored but not rendered. Omit `card` to set the rendered environment.',
    });
  }
  return shape(ws, params, { warnings });
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
// It was wrong for the SERVER, because mergeFamilyParts copies the shared
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
            curatedOn: new Set(),
          };
          byId.set(v.id, e);
        }
        for (const d of v.descriptors || []) e.descriptors.add(d);
        e.parts.add(part.id);
        e.instruments.add(inst.id);
        // Where this material was actually AUTHORED, as opposed to offered.
        // The universal-materials merge lends every string material to every
        // string part, so `instruments` counts availability and says nothing
        // about provenance: `ernie_ball_slinky_bass` is offered on 300
        // instruments and belongs to a handful. Without the second number a
        // caller reads the first as popularity and picks bass strings for a
        // lyre thinking the catalog recommended them.
        if (!v.expanded) e.curatedOn.add(inst.id);
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
      curatedCount: e.curatedOn.size,
    });
  }
  return _variantIndex;
}

// ── ranking, shared by search_catalog and search_prefaces ──────────────────
//
// Field-weighted, because counting hits does not rank. Every row used to score
// 1 per matched term with no regard for WHERE the term hit, so a single-term
// query left every result tied and the codepoint tiebreak became the ordering:
// "country" returned all 37 traditions in alphabetical order, putting the
// tradition actually named `country` ninth, behind `australian_didgeridoo_
// yidaki_extended`. A hit on an id or a name is evidence about the record; a
// hit in descriptor or lineage prose is a hint, and they were being counted the
// same.
//
// ONE scorer for both searches. The weighting was written into search_catalog
// alone, and search_prefaces — the tool the instructions route every mood word
// to — kept counting substrings: "keening" ranked demotic-keening above the
// preface named keening, and 71 of the 624 single-word preface ids were not the
// first hit for their own name, while search_catalog found all 624. A preface's
// `note` (its authored gloss, "the eerie register that raises the hair …")
// scores above its sonic tokens, which a mood word shares with dozens of
// prefaces; an inflected word ("haunted") reaches the record named for its
// root ("haunting") below a whole-word hit and above any prose.
const SCORE = { EXACT: 8, WORD: 3, PARTIAL: 2, GLOSS: 2, PROSE: 1 };
const _esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function _stem(t) {
  for (const suffix of ['ing', 'ed', 'es', 's', 'ly'])
    if (t.length - suffix.length >= 4 && t.endsWith(suffix)) return t.slice(0, -suffix.length);
  return null;
}
// One compiled matcher per TERM, not per term per row.
//
// The word-boundary RegExp used to be constructed inside the per-term loop, i.e.
// once for every (row, term) pair — tens of thousands of identical compilations
// per query, and the largest single cost in the profile after the variant
// blowup. The pattern depends only on the term.
function queryMatchers(query) {
  return String(query)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      const stem = _stem(t);
      return {
        t,
        re: new RegExp(`(^|[^a-z0-9])${_esc(t)}([^a-z0-9]|$)`),
        stemRe: stem ? new RegExp(`(^|[^a-z0-9])${_esc(stem)}`) : null,
      };
    });
}
function scoreRecord(matchers, id, name, prose, gloss = '') {
  const idL = String(id).toLowerCase();
  const nameL = String(name || '').toLowerCase();
  const glossL = String(gloss || '').toLowerCase();
  const proseL = String(prose || '').toLowerCase();
  const label = idL + ' ' + nameL;
  let score = 0;
  let hits = 0;
  for (const { t, re, stemRe } of matchers) {
    let best = 0;
    if (idL === t || nameL === t) best = SCORE.EXACT;
    else if (re.test(label)) best = SCORE.WORD;
    else if (label.includes(t) || (stemRe && stemRe.test(label))) best = SCORE.PARTIAL;
    else if (glossL.includes(t)) best = SCORE.GLOSS;
    else if (proseL.includes(t)) best = SCORE.PROSE;
    if (best > 0) hits++;
    score += best;
  }
  // Every query term matching somewhere beats a partial match, whatever the
  // fields: "delta blues" should not lose to a record that only says "blues".
  if (hits === matchers.length && matchers.length > 1) score += SCORE.EXACT;
  return score;
}

// Free-text search across the catalog → ids to feed start_recipe / edit_recipe /
// get_instrument. Multi-term: records rank by how many query terms they match.
export function searchCatalog({ query, types, limit = 20 } = {}) {
  if (!query || !String(query).trim()) throw new EngineError('search_catalog needs a query.');
  const want = new Set(Array.isArray(types) && types.length ? types : ALL_TYPES);
  const matchers = queryMatchers(query);
  const rows = [];
  // `extra` carries fields that make a hit USABLE, not merely findable. Today
  // only chain rows need one — see the CHAIN_SECTIONS loop below.
  const add = (type, id, name, hay, extra, gloss) => {
    if (!want.has(type)) return;
    const score = scoreRecord(matchers, id, name, hay, gloss);
    if (score > 0) rows.push({ type, id, name: name || id, matched: score, ...extra });
  };
  for (const t of C.TRADITIONS || [])
    add('tradition', t.id, t.name, `${t.lineage || ''} ${t.family || ''}`);
  // A retired id or name still finds the tradition it was merged into: scored
  // as the alias, returned as the surviving id, and only where it beats that
  // tradition's own row.
  if (want.has('tradition')) {
    const live = new Map(rows.filter((r) => r.type === 'tradition').map((r) => [r.id, r]));
    for (const [aliasId, a] of Object.entries(C.TRADITION_ALIASES || {})) {
      const score = scoreRecord(matchers, aliasId, a.name, '');
      if (score <= 0) continue;
      const t = tradById(a.of);
      const row = live.get(a.of);
      if (row && row.matched >= score) continue;
      if (row) Object.assign(row, { matched: score, alias: aliasId });
      else {
        const r = {
          type: 'tradition',
          id: t.id,
          name: t.name || t.id,
          matched: score,
          alias: aliasId,
        };
        rows.push(r);
        live.set(t.id, r);
      }
    }
  }
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
        // `instruments` is availability, `curated_for` is provenance. They are
        // wildly different numbers for a shared material and identical for a
        // specific one, which is exactly the distinction a caller needs.
        instruments: v.instrumentCount,
        curated_for: v.curatedCount,
      });
    }
  }
  for (const r of C.ROOMS || []) add('room', r.id, r.name, (r.descriptors || []).join(' '));
  for (const t of C.TUNINGS || []) add('tuning', t.id, t.name, (t.descriptors || []).join(' '));
  for (const a of C.ARRANGEMENTS || []) add('arrangement', a.id, a.name, '');
  for (const a of C.PRODUCTION_AESTHETICS || []) add('aesthetic', a.id, a.name, '');
  for (const p of C.PREFACE_LEXICON || [])
    add('preface', p.id, p.name || p.id, tokensOf(p).join(' '), undefined, p.note);
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

// Search the prefaces (named aesthetic/technique/delivery signatures) by mood
// words → preface ids for set_preface. Ranked by the same scorer as
// search_catalog, over id/name, the preface's note, and its tokens; each row
// carries the note and tokens, which is what tells near-synonyms apart.
export function searchPrefaces({ query, limit = 15 } = {}) {
  if (!query || !String(query).trim())
    throw new EngineError('search_prefaces needs mood/feel words.');
  const matchers = queryMatchers(query);
  const rows = [];
  for (const p of C.PREFACE_LEXICON || []) {
    const toks = tokensOf(p);
    const score = scoreRecord(matchers, p.id, p.name || p.id, toks.join(' '), p.note);
    if (score > 0)
      rows.push({
        id: p.id,
        name: p.name || p.id,
        matched: score,
        ...(p.note ? { note: p.note } : {}),
        tokens: toks.slice(0, 12),
      });
  }
  rows.sort((a, b) => b.matched - a.matched || _cmp(a.id, b.id));
  return { query, total: rows.length, items: rows.slice(0, Math.min(limit, 50)) };
}

// The knob catalog for one instrument: every part + the variant ids valid for
// set_variant, with labels and which is the default.
// Per-part variant budget. A handful of parts inherit a universal materials
// table — string parts carry hundreds of variants each (WIDEST_PART_VARIANTS
// above is the current maximum) — so the honest "return the whole record" shape made
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
    // Curated ahead of borrowed, explicitly. It was already true incidentally —
    // _merge appends borrowed copies after the authored ones and this sort was
    // stable — but the hint below now tells the caller that curated variants are
    // listed first, and a claim in a response should not rest on the incidental
    // ordering of an upstream concat.
    matched.sort(
      (a, b) =>
        b.score - a.score ||
        (a.v.expanded ? 1 : 0) - (b.v.expanded ? 1 : 0) ||
        (b.v.default ? 1 : 0) - (a.v.default ? 1 : 0)
    );
    const shown = matched.slice(0, cap).map((x) => x.v);
    if (!shown.some((v) => v.default)) {
      const def = all.find((v) => v.default);
      if (def) shown.unshift(def);
    }
    // CURATED vs BORROWED, which the caller could not previously tell apart.
    //
    // mergeFamilyParts offers every string material on every string-material
    // part, and every tonewood on every soundbox — deliberately, because this
    // catalog synthesizes audio and is not bound by buildability (see the note
    // above augmentUniversalMaterial in scripts/_merge.js). Those borrowed
    // copies carry `expanded` and are never auto-seeded.
    //
    // This function dropped that flag. So `kithara` — an ancient Greek lyre
    // with exactly two authored string materials, gut and sinew — answered with
    // 803 variants in which `kithara_gut` and `ernie_ball_slinky_bass` looked
    // equally like answers, and nothing in the response said otherwise. The
    // freedom is the point; presenting it as if the catalog had researched 803
    // string types for a kithara is not. A caller that cannot see the
    // distinction cannot honour the period defaults OR knowingly override them,
    // which are the only two things it might reasonably want to do.
    //
    // Absence means curated, so the common case costs no bytes.
    const curatedCount = all.filter((v) => !v.expanded).length;
    const rec = {
      id: p.id,
      name: labelOf(p) || p.id,
      variant_count: all.length,
      curated_count: curatedCount,
      variants: shown.map((v) => ({
        id: v.id,
        name: labelOf(v) || v.id,
        default: !!v.default,
        ...(v.expanded ? { borrowed: true } : {}),
      })),
    };
    if (shown.length < all.length) {
      rec.truncated = true;
      // Say WHICH ones were cut. "803 variants; showing 5" reads as though the
      // instrument has 803 researched options and the caller is seeing a
      // fraction; "2 curated, the rest borrowed" says the two that were
      // authored for this instrument are both right there.
      const borrowedNote =
        curatedCount < all.length
          ? ` ${curatedCount} of these are curated for this instrument (listed first); the rest are borrowed from other instruments and marked \`borrowed\`.`
          : '';
      rec.hint = terms.length
        ? `${matched.length} of ${all.length} variants match "${query}"; showing ${shown.length}. Raise \`limit\` or refine \`query\`.${borrowedNote}`
        : `${all.length} variants; showing ${shown.length}. Pass \`query\` to filter (e.g. "mahogany"), \`part\` to focus one part, or raise \`limit\`.${borrowedNote}`;
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
  const ext = (C.TRADITION_EXTRAS || {})[t.id] || {};
  return {
    id: t.id,
    ...(t.id !== id ? { merged_from: id } : {}),
    name: labelOf(t) || t.id,
    family: t.family || null,
    lineage: t.lineage || null,
    axes: ext.axes || null,
    instruments: t.instruments || [],
    source: t,
  };
}

// `family` is an exact family id (list_options kind="tradition_families"),
// compared case-insensitively; `query` is a substring of the id or name. A page
// is at most LIST_TRADITIONS_MAX rows — the schema bounds it, and this clamps
// for a direct engine call — so no single call returns the whole catalog.
export function listTraditions({ query, family, limit = 50, offset = 0 } = {}) {
  limit = Math.max(1, Math.min(Number(limit) || 50, LIST_TRADITIONS_MAX));
  offset = Math.max(0, Number(offset) || 0);
  let items = C.TRADITIONS || [];
  if (family) {
    const f = String(family).trim().toLowerCase();
    items = items.filter((t) => String(t.family || '').toLowerCase() === f);
  }
  if (query) {
    const q = String(query).toLowerCase();
    items = items.filter((t) => t.id.includes(q) || (labelOf(t) || '').toLowerCase().includes(q));
  }
  const total = items.length;
  const page = items
    .slice(offset, offset + limit)
    .map((t) => ({ id: t.id, name: labelOf(t) || t.id, family: t.family || null }));
  const out = { total, count: page.length, offset, items: page };
  if (offset + page.length < total) out.next_offset = offset + page.length;
  return out;
}

// Which edit (if any) takes the ids a list_options kind returns. The kinds were
// all presented as "override spaces", and most of them are not: no edit accepts
// an archetype, aesthetic, arrangement, instrument family or axis id, and
// chain_sections lists the eight stage NAMES, not the chain ids a stage takes.
const OPTION_USE = {
  rooms: 'set_environment room',
  tunings: 'set_environment tuning',
  chain_sections:
    'the stage keys of set_environment chain (and clear). The ids a stage takes come from search_catalog types=["chain"], which returns each with its stage.',
  archetypes: 'reference only; no edit takes these ids',
  aesthetics: 'reference only; no edit takes these ids',
  arrangements: 'reference only; no edit takes these ids',
  instrument_families: 'reference only; no edit takes these ids',
  tradition_families: 'list_traditions family',
  axes: 'reference only (get_tradition reports a tradition on these axes); no edit takes these ids',
};
export const OPTION_KINDS = Object.keys(OPTION_USE);

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
    return {
      kind,
      accepted_by: OPTION_USE[kind],
      count: fams.length,
      items: fams.map((f) => ({ id: f, name: f })),
    };
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
  return { kind, accepted_by: OPTION_USE[kind], count: items.length, items };
}

export const counts = {
  traditions: (C.TRADITIONS || []).length,
  instruments: (C.INSTRUMENTS || []).length,
  prefaces: (C.PREFACE_LEXICON || []).length,
};

export { EngineError };
