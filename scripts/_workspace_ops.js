'use strict';
// _workspace_ops.js — the connector's editable workspace (state-passing).
//
// The headless equivalent of the human app's canvas: a workspace is just
// { cards: [...] }, and every op takes a workspace in and returns a NEW workspace
// (no mutation of the input — the model threads the state). render() turns any
// workspace into the "Current Recipe" via the shared SSOT renderer.
//
// These mirror the human affordances, all
// deterministic — no search, no auto-staple:
//   seed / add_tradition / remove_tradition   — rosters (1..n traditions, explicit)
//   add_instrument / remove_instrument        — per-instrument cards
//   set_variant / set_environment             — direct overrides (a UI dropdown)
//   set_preface                               — inverseConfigure: re-derive a card's
//                                               settings toward a preface, then lock it
//
// set_preface is the load-bearing one: changing a preface deterministically
// rewrites that card's parts/tuning/room/chain to maximize the preface's token
// overlap (identical to the browser's commitPrefaceChange→inverseConfigureForPreface),
// then locks the preface so the renderer surfaces it verbatim and dedups the rest
// around it. Further edits layer on top.

const C = require('./_loader.js');
const { inverseConfigure, SIGS } = require('./_inverse_configure.js');
const { seedTraditionCards, renderWorkspace, makeCard } = require('./_seed_workspace.js');
const { cardDescriptors } = require('./_card_descriptors.js');
const { suggest } = require('./_preface_match.js');

class WorkspaceError extends Error {}

const instById = (id) => (C.INSTRUMENTS || []).find((i) => i.id === id);
const tradById = (id) => (C.TRADITIONS || []).find((t) => t.id === id);
const prefaceById = (id) => (C.PREFACE_LEXICON || []).find((p) => p.id === id);

function emptyWorkspace() {
  return { cards: [] };
}

// Deep-ish clone so an op never mutates the caller's workspace (state-passing).
function clone(ws) {
  return {
    cards: ((ws && ws.cards) || []).map((c) => ({
      ...c,
      parts: { ...(c.parts || {}) },
      chain: { ...(c.chain || {}), fx: [...((c.chain && c.chain.fx) || [])] },
    })),
  };
}

// Resolve a card reference: card id first, then instrument id (first match).
function findCard(ws, ref) {
  return ws.cards.find((x) => x.id === ref) || ws.cards.find((x) => x.instrumentId === ref) || null;
}

// ── rosters ─────────────────────────────────────────────────────────────────

// Start a workspace from one or more traditions (deterministic default cards).
function seed(traditionIds) {
  const ids = Array.isArray(traditionIds) ? traditionIds : [traditionIds];
  if (ids.length === 0) throw new WorkspaceError('seed needs at least one tradition id');
  const ws = emptyWorkspace();
  for (const id of ids) {
    const cards = seedTraditionCards(id);
    if (!cards) throw new WorkspaceError(`Unknown tradition: "${id}"`);
    ws.cards.push(...cards);
  }
  return ws;
}

function addTradition(ws, traditionId) {
  const cards = seedTraditionCards(traditionId);
  if (!cards) throw new WorkspaceError(`Unknown tradition: "${traditionId}"`);
  const next = clone(ws);
  next.cards.push(...cards);
  return next;
}

function removeTradition(ws, traditionId) {
  if (!tradById(traditionId)) throw new WorkspaceError(`Unknown tradition: "${traditionId}"`);
  const next = clone(ws);
  next.cards = next.cards.filter((c) => c.traditionId !== traditionId);
  return next;
}

// ── instruments ───────────────────────────────────────────────────────────────

// Add an instrument card. With { tradition } it inherits that tradition's env +
// part overrides (a roster instrument seeds identically to import; a guest gets
// the tradition's env + applicable overrides). Without context: bare defaults.
function addInstrument(ws, instrumentId, opts = {}) {
  if (!instById(instrumentId)) throw new WorkspaceError(`Unknown instrument: "${instrumentId}"`);
  const next = clone(ws);
  let card = null;
  if (opts.tradition) {
    const trad = tradById(opts.tradition);
    if (!trad) throw new WorkspaceError(`Unknown tradition context: "${opts.tradition}"`);
    const seeded = seedTraditionCards(opts.tradition) || [];
    const match = seeded.find((c) => c.instrumentId === instrumentId);
    card =
      match ||
      makeCard(instrumentId, { traditionId: opts.tradition, tuning: trad.tuning, room: trad.room });
  } else {
    card = makeCard(instrumentId, {});
  }
  if (!card) throw new WorkspaceError(`Could not build card for "${instrumentId}"`);
  next.cards.push(card);
  return next;
}

// "No card matching X" names the one card that is NOT there and withholds the
// ones that are, so a caller that guessed a name has nothing to correct toward
// and guesses again. The roster is right here in the workspace and is at most a
// couple of dozen short ids; listing it turns the retry into a lookup. Measured:
// a model that invented the card `cajita` burned its remaining step budget
// re-inventing it, against a recipe whose cards it could have been shown.
function noCard(ws, cardRef) {
  const refs = (ws.cards || []).map((c) => c.instrumentId || c.id);
  return new WorkspaceError(
    `No card matching "${cardRef}". Cards in this recipe: ${refs.join(', ') || '(none)'}.`
  );
}

function removeInstrument(ws, cardRef) {
  const next = clone(ws);
  const c = findCard(next, cardRef);
  if (!c) throw noCard(next, cardRef);
  next.cards = next.cards.filter((x) => x.id !== c.id);
  return next;
}

// ── per-card overrides ────────────────────────────────────────────────────────

function setVariant(ws, cardRef, partId, variantId) {
  const next = clone(ws);
  const card = findCard(next, cardRef);
  if (!card) throw noCard(next, cardRef);
  const inst = instById(card.instrumentId);
  const part = (inst.parts || []).find((p) => p.id === partId);
  if (!part) throw new WorkspaceError(`${card.instrumentId} has no part "${partId}"`);
  if (!(part.variants || []).some((v) => v.id === variantId)) {
    throw new WorkspaceError(`${card.instrumentId}.${partId} has no variant "${variantId}"`);
  }
  card.parts[partId] = variantId;

  // A material edit RESHAPES THE REST OF THE CARD, exactly as it does in the app.
  //
  // This is a port of src/app.js:reconfigureAfterPartEdit, which is what runs
  // when a human picks a variant in the browser: the same inverse cascade a
  // preface pick runs, but PINNING the edited part so the user's choice is never
  // reverted while everything else moves toward the preface the new sound
  // implies. Without it, `set_variant` was a bare field assignment — the two
  // surfaces produced different recipes from the same action, which contradicts
  // the connector's stated purpose ("the headless twin of the browser app").
  // _inverse_configure.js carried the discrepancy as a comment ("the connector/
  // CLI don't pin today"); check_app_parity.js never caught it because it gates
  // SEED + RENDER parity, and nothing gated EDIT parity.
  //
  // Auto vs locked, same rule as the app: a card whose preface is still
  // auto-derived (prefaceAuto !== false) re-derives its target from the NEW
  // descriptor set, so changing a material can legitimately change which preface
  // the card is heading toward. A card whose preface was chosen re-shapes toward
  // that one instead.
  //
  // `prefaceLock` is deliberately NOT set here, and that is now purely a
  // statement about the card's SHAPE rather than about how it renders. The app's
  // apply() writes preface + prefaceAuto and nothing else, so neither does this;
  // a variant edit is not an explicit preface choice, and prefaceLock is what
  // reports one (engine.js cardsSummary → `preface_locked`).
  //
  // This comment used to end "claiming the lock would make the connector render
  // something the app does not", which had the render backwards and cost the
  // repo its flagship parity promise for as long as it stood. The renderer keyed
  // on prefaceLock while the app keyed on prefaceAuto === false — the flag set
  // two lines below — so withholding prefaceLock did not keep the two surfaces
  // in step, it was the single thing driving them apart on every set_variant.
  // The renderer now keys on prefaceAuto === false like the app does
  // (_recipe_stack.js:assignDedupedPrefaces), which makes the line below
  // sufficient on its own and this omission harmless.
  const auto = card.prefaceAuto !== false;
  const target = auto ? suggest(cardDescriptors(card, C, SIGS), C.PREFACE_LEXICON) : card.preface;
  if (!target) return next; // no token signature to steer by; the bare edit stands

  const res = inverseConfigure(card, target, { pin: [partId] });
  if (!res) {
    // Free-form / no-token target: keep the re-derived label, no reshape
    // possible. Mirrors the app's null-result branch.
    if (auto) card.preface = target;
    return next;
  }
  card.parts = { ...res.config.parts };
  card.tuning = res.config.tuning;
  card.room = res.config.room;
  card.chain = { ...res.config.chain };
  card.preface = target;
  card.prefaceAuto = false;
  return next;
}

function setEnvironment(ws, cardRef, { room, tuning, chain } = {}) {
  const next = clone(ws);
  const card = findCard(next, cardRef);
  if (!card) throw noCard(next, cardRef);
  // Rooms and tunings are closed id spaces with a lookup that answers them, so
  // the refusal says which lookup. A bare "Unknown room" is a dead end: it tells
  // the caller the guess was wrong and nothing about where the right answer
  // lives, and a model that cannot see the space guesses a second synonym.
  if (room !== undefined) {
    if (room !== null && !(C.ROOMS || []).find((r) => r.id === room))
      throw new WorkspaceError(
        `Unknown room: "${room}" (search_catalog types=["room"], or list_options kind="rooms").`
      );
    card.room = room;
  }
  if (tuning !== undefined) {
    if (tuning !== null && !(C.TUNINGS || []).find((t) => t.id === tuning))
      throw new WorkspaceError(
        `Unknown tuning: "${tuning}" (search_catalog types=["tuning"], or list_options kind="tunings").`
      );
    card.tuning = tuning;
  }
  if (chain && typeof chain === 'object') {
    // Validate to the same standard as room and tuning above. Unvalidated, a
    // typo'd stage wrote a key nothing reads (silent no-op) and a typo'd item id
    // wrote a value nothing resolves — which does not fail, it DELETES: the
    // renderer drops the stage it can no longer resolve, so a bogus mic id
    // quietly removes the real mic from the recipe the user is handed.
    //
    // A multi-select stage needs the SHAPE checked too, not just the id, and for
    // exactly the same reason. `fx` holds an array; every other stage holds a
    // single id. Writing a bare string into fx used to type-check fine here and
    // corrupt the card one edit later, because clone() above spreads it:
    //
    //   seed tamil_filmi          -> chain.fx = ['plate_reverb']
    //   set_environment fx:'fuzz_germanium' -> chain.fx = 'fuzz_germanium'
    //   ...any further edit, via clone -> ['f','u','z','z','_','g','e', ...]
    //   render                    -> multiSelect loop resolves no character,
    //                                so the WHOLE fx section disappears
    //
    // The user loses the reverb they had AND the fuzz they asked for, silently.
    // Reachable straight through the shipped connector schema, so the shape is
    // validated here in the SSOT rather than at any one caller's boundary.
    for (const [stage, id] of Object.entries(chain)) {
      const sec = (C.CHAIN_SECTIONS || []).find((s) => s.stage === stage || s.id === stage);
      if (!sec) {
        const stages = (C.CHAIN_SECTIONS || []).map((s) => s.stage || s.id);
        throw new WorkspaceError(`Unknown chain stage: "${stage}". Valid: ${stages.join(', ')}`);
      }
      const known = (candidate) => (sec.items || []).find((it) => it.id === candidate);
      // A rejected id is one of two very different mistakes, and the caller
      // cannot tell them apart from "Unknown fx id". Either the id does not
      // exist, or — far more often, because search_catalog hands out real chain
      // ids — it exists in a DIFFERENT stage and was filed under the wrong one.
      // Naming the stage that would take it turns a dead end into a correction.
      const elsewhere = (candidate) => {
        for (const other of C.CHAIN_SECTIONS || []) {
          if (other === sec) continue;
          if ((other.items || []).some((it) => it.id === candidate)) return other.id || other.stage;
        }
        return null;
      };
      const rejectId = (candidate) => {
        const other = elsewhere(candidate);
        return new WorkspaceError(
          other
            ? `Unknown ${stage} id: "${candidate}" — that id belongs to the "${other}" stage. ` +
                `Pass it as chain: {"${other}": "${candidate}"}.`
            : `Unknown ${stage} id: "${candidate}" (search_catalog types=["chain"] returns each id with the stage that accepts it).`
        );
      };
      if (sec.multiSelect) {
        // null clears the stage, matching the single-select clear path below.
        if (id === null) {
          card.chain[stage] = [];
          continue;
        }
        // A bare string is a caller writing the single-select shape at a
        // multi-select stage. Lift it rather than rejecting it: it is
        // unambiguous, it is what every existing caller sends, and refusing it
        // would close functionality that appears to work today.
        const ids = typeof id === 'string' ? [id] : id;
        if (!Array.isArray(ids)) {
          throw new WorkspaceError(
            `Chain stage "${stage}" takes a list of ids (or one id), got ${typeof id}.`
          );
        }
        for (const one of ids) {
          if (typeof one !== 'string' || !known(one)) throw rejectId(one);
        }
        // Fresh copy: never alias the caller's array into the workspace.
        card.chain[stage] = ids.slice();
        continue;
      }
      if (id !== null && !known(id)) throw rejectId(id);
      card.chain[stage] = id;
    }
  }
  return next;
}

// set_preface — deterministic re-derive (the headline edit).
function setPreface(ws, cardRef, prefaceId) {
  if (!prefaceById(prefaceId)) throw new WorkspaceError(`Unknown preface: "${prefaceId}"`);
  const next = clone(ws);
  const card = findCard(next, cardRef);
  if (!card) throw noCard(next, cardRef);
  const res = inverseConfigure(card, prefaceId);
  if (!res)
    throw new WorkspaceError(`Cannot apply preface "${prefaceId}" to "${card.instrumentId}"`);
  card.parts = { ...res.config.parts };
  card.tuning = res.config.tuning;
  card.room = res.config.room;
  card.chain = { ...res.config.chain };
  card.preface = prefaceId;
  card.prefaceLock = true; // renderer surfaces it verbatim; others dedup around it
  card.prefaceAuto = false;
  return next;
}

// ── render ────────────────────────────────────────────────────────────────────

// Render any workspace to the recipe string. Clones first so assignDedupedPrefaces
// (which writes card.preface for auto cards) never mutates the caller's workspace.
function render(ws, opts) {
  return renderWorkspace(clone(ws).cards, opts);
}

// emptyWorkspace is not part of the op surface: seed() is the only entry point
// that mints a workspace, and it calls emptyWorkspace() itself. Exporting it
// advertised a second way in that no caller ever used.
module.exports = {
  seed,
  addTradition,
  removeTradition,
  addInstrument,
  removeInstrument,
  setVariant,
  setEnvironment,
  setPreface,
  render,
  findCard,
  WorkspaceError,
};
