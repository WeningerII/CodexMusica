// The shared recipe store (#670 P2 step 5): the one "Your recipe" every lane
// reads and changes, and the one instrument preview the Instrument page's
// tabs configure. Lanes get frozen views of it (ctx.recipe and the five
// preview views), each with only the methods its contract names; the store
// itself never enters a ctx.
//
// It owns the page engine's one workspace (prototype/engine/load.js
// pageEngine): E.app.cards, E.app.history and E.app.historyIndex. It claims
// the engine once, it is the only code that writes those fields, and it keeps
// no list of its own beside them. Every recipe edit is main's own function
// (importTradition, addInstrumentFromPicker, rmCard, applyPartEdit,
// commitPrefaceChange), and history is the engine's own pushHistory, undo
// and redo, so one command is one history entry, as on codex.html.
//
// The preview is one card held outside app.cards, as production's IP.card
// (src/pages/instrument.js): seeded as Add would seed it, then every choice
// for that instrument replayed. Its rules (ipApply, ipChoose, ipDiff) are
// page code, not engine, so they are restated below over engine functions
// only; scripts/check_prototype_hosts.js holds each to codex.html's own.
//
// Contracts: #668 6647387849 (genre instruments, environment), 6647636873
// (instrument actions), 6646846068 and 6647373109 (configuration,
// character, chain, output), 6647783903 (instrument similar).

const SVG_NS = 'http://www.w3.org/2000/svg';
const claimed = new WeakSet(); // page engines a store holds

const fail = (code, message) => Object.assign(new Error(message), { code });

function freeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const x of Object.values(v)) freeze(x);
  }
  return v;
}
const clone = (v) => JSON.parse(JSON.stringify(v));
// production's ipHuman: underscores to spaces, first letter capitalised.
const human = (s) => {
  const t = String(s || '').replaceAll('_', ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};
// workbench.js uiCount.
const countOf = (n, one, many = one + 's') => n.toLocaleString('en') + ' ' + (n === 1 ? one : many);
// The one <svg> in a glyph's HTML, as an <img> source (discovery.js does the
// same for the genre glyphs).
const svgUrl = (html) => {
  const m = /<svg[\s\S]*?<\/svg>/.exec(html || '');
  return m
    ? `data:image/svg+xml,${encodeURIComponent(m[0].replace('<svg ', `<svg xmlns="${SVG_NS}" `))}`
    : null;
};

// What the store says. Production's text wherever production has it.
export const RECIPE_MESSAGES = Object.freeze({
  LOADING: 'Your recipe is still loading. Try again in a moment.',
  LOAD_FAILED: 'Your recipe couldn’t load. Try again.',
  CLAIMED: 'Your recipe is already held by another store on this page.',
  STALE_ADD: (name) =>
    `Your recipe changed before ${name} was added. Nothing was added; try again.`,
  BUSY_ADD: (name) => `Another addition is still running. ${name} was not added; try again.`,
  BUSY_GENRE: 'An addition is already in progress.',
  GENRE_FAILED: (genre) => `${genre} couldn’t be loaded, so nothing was added. Try again.`,
  ADD_FAILED: (name) => `${name} couldn’t be added. Nothing was changed. Try again.`,
  NO_GENRE: 'That genre isn’t in the catalog.',
  NO_INSTRUMENT_ID: 'That instrument isn’t in the catalog.',
  STALE_ACTION: 'The instrument changed before that ran. Nothing was changed.',
  BUSY_ACTION: 'The instrument’s settings are still being prepared. Try again in a moment.',
  BAD_DESTINATION: 'That destination isn’t in Your recipe.',
  NOT_OPEN: 'No instrument is open.',
  // apply(), undo() and redo() refusals (#740 announces them).
  STALE_EDIT: 'Your recipe changed before that edit. Nothing was changed.',
  BUSY_EDIT: 'Another change to Your recipe is still running. Nothing was changed.',
  NOT_FOUND_EDIT: 'That card is no longer in Your recipe.',
  INVALID_EDIT: 'That edit isn’t one Your recipe can make.',
  NOT_IN_BUILD: 'That change isn’t part of this build of the prototype yet.',
  ASYNC: 'Adding goes through Add, which may need to load the genre first.',
  NOTHING_TO_UNDO: 'There’s nothing to undo.',
  NOTHING_TO_REDO: 'There’s nothing to redo.',
  UNDO_FAILED: 'That step couldn’t be undone. Nothing was changed.',
  REDO_FAILED: 'That step couldn’t be redone. Nothing was changed.',
  // The preview's own.
  PREVIEW_FAILED: 'This instrument’s settings couldn’t be prepared.',
  STALE_CHOICE: 'The instrument changed before that choice was applied. Choose again.',
  BUSY_CHOICE: 'The instrument’s settings are still being prepared. Choose again in a moment.',
  INVALID_CHOICE: 'That choice isn’t one this instrument offers.',
  COPIED: 'Copied',
  COPY_FAILED: 'Copy failed — select the text instead',
});
const M = RECIPE_MESSAGES;

// Each view carries exactly these methods (check_prototype_hosts.js holds
// them to the lanes' contracts).
const PORT_METHODS = [
  'snapshot',
  'subscribe',
  'apply',
  'undo',
  'redo',
  'canUndo',
  'canRedo',
  'addInstrument',
  'addEnsemble',
  'setInstrumentDestination',
  'addConfiguredInstrument',
  'resetInstrumentPreview',
];
const VIEWS = ['recipe', 'configuration', 'character', 'environment', 'chain', 'output'];
const PREVIEW_VIEWS = VIEWS.slice(1);
// apply()'s vocabulary, with the fields each op takes.
const OPS = {
  set_variant: ['card', 'part', 'variant'],
  set_preface: ['card', 'preface'],
  set_environment: ['card', 'tuning', 'room', 'chain', 'clear'],
  remove_instrument: ['card'],
  remove_tradition: ['tradition'],
};
// Reserved for step 6 (row 209), each with its production route: dupCard,
// dropCardOnTradition and dropTraditionOnTradition.
const LATER_OPS = ['duplicate_instrument', 'move_to_tradition', 'make_primary'];
const ADD_OPS = ['add_instrument', 'add_tradition'];

// load: prototype/engine/load.js loadEngine. selection: selection.js's
// instrument (the instrument the person opened). announce: host.js announce.
// ceiling: the Compact limit sourceMessage measures against (the engine's
// RECIPE_CHAR_CEILING unless the shell's gate says otherwise).
export function recipeStore({ load, selection, announce, ceiling } = {}) {
  let E = null;
  let status = 'loading';
  let error = null;
  let starting = null;
  let revision = 0;
  let busy = false;
  let destination = null; // genreId | null (Independent), shared (6647636873)
  let routedTo = null; // production's _addToTradition routing context
  let format = 'rich';
  let envSource = null; // uiEnvHandoverText's record
  let held = null; // the engine this store claimed
  const edits = new Map(); // instrumentId → ordered choices (production's IP.edits)
  const pv = {
    instrumentId: null,
    state: 'none', // none | loading | ready | error
    error: null,
    base: null,
    card: null,
    note: null,
    revision: 0,
    seq: 0,
    waiting: [],
  };
  // Tables built once at start and shared by every snapshot.
  const T = {};
  const variantsOf = new Map();

  // ── Snapshots and notification (every view) ──
  const listeners = Object.fromEntries(VIEWS.map((v) => [v, new Set()]));
  const snaps = {};
  const keys = {};
  const dirty = new Set(VIEWS);
  const unsent = new Set(); // views whose snapshot changed since they were told
  const queue = [];
  let delivering = false;
  const report = (e) => {
    if (typeof reportError === 'function') reportError(e);
    else
      setTimeout(() => {
        throw e;
      });
  };
  const touch = (...views) => {
    for (const v of views) dirty.add(v);
  };
  const touchPreview = () => touch(...VIEWS);
  function build(view) {
    const [key, make] = BUILD[view]();
    if (snaps[view] && key === keys[view]) return false;
    keys[view] = key;
    snaps[view] = freeze(make());
    unsent.add(view);
    return true;
  }
  function snapshotOf(view) {
    if (dirty.has(view) || !snaps[view]) {
      dirty.delete(view);
      build(view);
    }
    return snaps[view];
  }
  // The end of a commit: rebuild what changed and has listeners, then tell
  // each view's listeners, in view order. A view nobody listens to stays
  // dirty until it is read, so a change costs nothing there (a Compact
  // sourceMessage renders the whole recipe). A command a listener starts
  // runs at once, and its notifications wait for this pass to end, so no
  // pass nests.
  function flush() {
    for (const v of VIEWS) if (listeners[v].size && dirty.delete(v)) build(v);
    const changed = VIEWS.filter((v) => unsent.delete(v));
    if (!changed.length) return;
    queue.push(changed.map((v) => [v, [...listeners[v]]]));
    if (delivering) return;
    delivering = true;
    try {
      while (queue.length) {
        for (const [v, fns] of queue.shift()) {
          for (const fn of fns) {
            if (!listeners[v].has(fn)) continue; // removed during this pass
            try {
              fn();
            } catch (e) {
              report(e);
            }
          }
        }
      }
    } finally {
      delivering = false;
    }
  }
  const subscriber = (view) => (fn) => {
    if (typeof fn !== 'function') throw new TypeError('subscribe needs a function');
    listeners[view].add(fn);
    return () => {
      listeners[view].delete(fn);
    };
  };

  // ── The recipe ──
  const keyOf = () => E.musicalWorkspaceKey(E.app.cards);
  const genreName = (id) => (E && E.Catalog.get(id)?.name) || id;
  const instrumentName = (id) => {
    const i = E && E.Inst(id);
    return (i && (i.name || i.short)) || id;
  };
  const groups = () => {
    const out = new Map();
    for (const c of E.app.cards)
      if (c.traditionId) out.set(c.traditionId, (out.get(c.traditionId) || 0) + 1);
    return [...out].map(([genreId, count]) => ({ genreId, name: genreName(genreId), count }));
  };
  const destinations = () => {
    const out = [{ genreId: null, name: 'Independent instrument' }];
    if (status !== 'ready') return out;
    for (const g of groups()) out.push({ genreId: g.genreId, name: g.name });
    if (routedTo && !out.some((d) => d.genreId === routedTo))
      out.push({ genreId: routedTo, name: genreName(routedTo) });
    return out;
  };
  const previewActions = () => {
    const ready = status === 'ready';
    const diff = ready && pv.state === 'ready' ? ipDiff(pv.base, pv.card).length : 0;
    return {
      status: !ready ? status : pv.state === 'none' ? 'ready' : pv.state,
      error: !ready ? error : pv.state === 'error' ? pv.error : null,
      instrumentId: ready ? pv.instrumentId : null,
      previewRevision: pv.revision,
      destination,
      destinations: destinations(),
      changedCount: diff,
      canReset: diff > 0,
    };
  };
  function recipeSnapshot() {
    const ready = status === 'ready';
    const src = ready ? E.envCardOf(E.app.cards) : null;
    return {
      status,
      error,
      busy,
      revision,
      groups: ready ? groups() : [],
      cards: ready
        ? E.app.cards.map((c) => ({
            id: c.id,
            instrumentId: c.instrumentId,
            name: instrumentName(c.instrumentId),
            genreId: c.traditionId || null,
            preface: c.preface || null,
            prefaceAuto: c.prefaceAuto !== false,
          }))
        : [],
      environmentCard: src && E.hasEnvironment(src) ? src.id : null,
      instrumentActions: previewActions(),
    };
  }

  // The preview's common envelope (#668 6646846068), for the five views.
  const envelope = () => {
    const ready = status === 'ready';
    const state = !ready ? status : pv.state === 'none' ? 'error' : pv.state;
    const err = !ready
      ? error
      : pv.state === 'none'
        ? { code: 'NO_INSTRUMENT', message: M.NOT_OPEN }
        : pv.state === 'error'
          ? pv.error
          : null;
    return { status: state, error: err, instrumentId: pv.instrumentId, revision: pv.revision };
  };
  const live = () => status === 'ready' && pv.state === 'ready';

  const BUILD = {
    recipe() {
      const s = recipeSnapshot();
      return [JSON.stringify(s), () => s];
    },
    configuration() {
      const head = envelope();
      if (!live()) return [JSON.stringify(head), () => ({ ...head, parts: [], note: null })];
      const card = pv.card;
      const inst = E.Inst(card.instrumentId);
      const values = (inst.parts || []).map((p) => [
        card.parts[p.id] || null,
        (card.pinnedParts || []).includes(p.id),
      ]);
      return [
        JSON.stringify([head, values, pv.note]),
        () => ({
          ...head,
          parts: (inst.parts || []).map((p, i) => ({
            id: p.id,
            name: p.name || human(p.id),
            value: values[i][0],
            pinned: values[i][1],
            variants: variantList(inst, p),
          })),
          note: pv.note,
        }),
      ];
    },
    character() {
      const head = envelope();
      if (!live())
        return [
          JSON.stringify(head),
          () => ({
            ...head,
            categories: T.categories || [],
            current: null,
            automatic: true,
            suggestion: null,
          }),
        ];
      const card = pv.card;
      const suggested = E.suggestPrefaceForCard(card);
      const v = {
        current: card.preface || null,
        automatic: card.prefaceAuto !== false,
        suggestion: suggested && suggested !== card.preface ? suggested : null,
      };
      return [JSON.stringify([head, v]), () => ({ ...head, categories: T.categories, ...v })];
    },
    environment() {
      const head = envelope();
      if (!live())
        return [JSON.stringify(head), () => ({ ...head, fields: [], sourceMessage: '' })];
      const card = pv.card;
      const message = sourceMessage();
      return [
        JSON.stringify([head, card.tuning || null, card.room || null, message]),
        () => ({
          ...head,
          fields: [
            {
              key: 'tuning',
              value: card.tuning || null,
              options: T.tunings,
              descriptors: card.tuning ? E.entryRenderDescs(E.Tuning(card.tuning)) : [],
            },
            {
              key: 'room',
              value: card.room || null,
              options: T.rooms,
              descriptors: card.room ? E.entryRenderDescs(E.Room(card.room)) : [],
            },
          ],
          sourceMessage: message,
        }),
      ];
    },
    chain() {
      const head = envelope();
      if (!live()) return [JSON.stringify(head), () => ({ ...head, stages: [] })];
      const chain = pv.card.chain || {};
      const stages = T.stages.map((s) => ({
        ...s,
        value: s.multi ? [...(chain[s.stage] || [])] : chain[s.stage] || null,
      }));
      return [JSON.stringify([head, stages.map((s) => s.value)]), () => ({ ...head, stages })];
    },
    output() {
      const head = envelope();
      const text = live() ? E.compileStack(pv.card, format) : '';
      return [JSON.stringify([head, format, text]), () => ({ ...head, format, text })];
    },
  };

  // A part's variants, every one in catalog order, built once per instrument.
  function variantList(inst, part) {
    let byPart = variantsOf.get(inst.id);
    if (!byPart) variantsOf.set(inst.id, (byPart = new Map()));
    if (!byPart.has(part.id))
      byPart.set(
        part.id,
        freeze(
          (part.variants || []).map((v) => ({
            id: v.id,
            name: v.name,
            descriptors: E.entryRenderDescs(v),
            expanded: v.expanded || false,
            alias_of: v.alias_of || null,
          }))
        )
      );
    return byPart.get(part.id);
  }

  // ── The preview's rules, restated from src/pages/instrument.js ──
  const variantName = (inst, part, v) => (v ? E.Variant(inst, part, v)?.name || v : 'Not set');
  const chainName = (stage, v) =>
    Array.isArray(v)
      ? v.length
        ? v.map((x) => E.ChainItem(stage, x)?.name || x).join(', ')
        : 'None'
      : v
        ? E.ChainItem(stage, v)?.name || v
        : 'Not set';
  // ipDiff: what differs between two cards of one instrument, reading order.
  function ipDiff(a, b) {
    const inst = E.Inst(b.instrumentId);
    const out = [];
    for (const p of inst.parts || []) {
      const x = a.parts[p.id] || null;
      const y = b.parts[p.id] || null;
      if (x !== y)
        out.push({
          key: 'part:' + p.id,
          label: p.name || human(p.id),
          from: variantName(inst, p.id, x),
          to: variantName(inst, p.id, y),
        });
    }
    if ((a.preface || '') !== (b.preface || ''))
      out.push({
        key: 'preface',
        label: 'Character',
        from: a.preface || 'none',
        to: b.preface || 'none',
      });
    if (a.tuning !== b.tuning)
      out.push({
        key: 'tuning',
        label: 'Tuning',
        from: a.tuning ? E.Tuning(a.tuning)?.name || a.tuning : 'Not set',
        to: b.tuning ? E.Tuning(b.tuning)?.name || b.tuning : 'Not set',
      });
    if (a.room !== b.room)
      out.push({
        key: 'room',
        label: 'Room',
        from: a.room ? E.Room(a.room)?.name || a.room : 'Not set',
        to: b.room ? E.Room(b.room)?.name || b.room : 'Not set',
      });
    for (const s of E.CHAIN_SECTIONS) {
      const x = a.chain?.[s.id] ?? (s.multiSelect ? [] : null);
      const y = b.chain?.[s.id] ?? (s.multiSelect ? [] : null);
      if (JSON.stringify(x) !== JSON.stringify(y))
        out.push({
          key: 'chain:' + s.id,
          label: s.name,
          from: chainName(s.id, x),
          to: chainName(s.id, y),
        });
    }
    return out;
  }
  // ipApply: one choice on a card that isn't in the recipe (engine edits run
  // quiet: no toast, no shifts record).
  function applyEdit(card, e) {
    if (e.k === 'part') {
      card.parts[e.part] = e.v || null;
      E.applyPartEdit(card, e.part, { quiet: true });
    } else if (e.k === 'preface') {
      const r = E.inverseConfigureForPreface(card, e.id);
      if (r) {
        r.apply();
        card.pinnedParts = [];
      } else {
        card.preface = e.id;
        card.prefaceAuto = false;
      }
    } else if (e.k === 'auto') {
      card.prefaceAuto = true;
      card.preface = E.suggestPrefaceForCard(card);
    } else if (e.k === 'tuning' || e.k === 'room') {
      card[e.k] = e.v || null;
    } else if (e.k === 'chain') {
      card.chain[e.stage] = Array.isArray(e.v) ? e.v.slice() : e.v || null;
    }
  }
  const editsOf = (id) => {
    if (!edits.has(id)) edits.set(id, []);
    return edits.get(id);
  };
  // ipChoose: apply, remember, and say what else moved.
  function choose(e) {
    const card = pv.card;
    const before = clone(card);
    editsOf(pv.instrumentId).push(e);
    applyEdit(card, e);
    const own = (c) =>
      (e.k === 'part' && c.key === 'part:' + e.part) ||
      ((e.k === 'preface' || e.k === 'auto') && c.key === 'preface') ||
      (e.k === 'tuning' && c.key === 'tuning') ||
      (e.k === 'room' && c.key === 'room') ||
      (e.k === 'chain' && c.key === 'chain:' + e.stage);
    const moved = ipDiff(before, card).filter((c) => !own(c));
    pv.note = moved.length
      ? (e.k === 'preface'
          ? `Configured for “${card.preface}”: `
          : 'Also moved to match the new sound: ') +
        moved.map((c) => `${c.label} ${c.from} → ${c.to}`).join('; ')
      : null;
    pv.revision++;
    touchPreview();
    flush();
  }

  // Rebuild the preview for the open instrument and the destination, as
  // production's ipRebuild, with the baseline seeded apart from the card so
  // the two never share a chain (6646600222).
  function rebuild() {
    const id = selection.current();
    const seq = ++pv.seq;
    pv.note = null;
    pv.base = pv.card = null;
    if (!id) {
      if (pv.state !== 'none' || pv.instrumentId !== null) pv.revision++;
      pv.instrumentId = null;
      pv.state = 'none';
      pv.error = null;
      touchPreview();
      flush();
      settle();
      return;
    }
    pv.instrumentId = id;
    pv.state = 'loading';
    pv.error = null;
    pv.revision++;
    touchPreview();
    flush();
    void seed(seq, id, destination);
  }
  async function seed(seq, id, dest) {
    const end = (state, err) => {
      pv.state = state;
      pv.error = err;
      pv.revision++;
      touchPreview();
      flush();
      settle();
    };
    try {
      if (!E.Inst(id)) return end('error', { code: 'NOT_FOUND', message: M.NO_INSTRUMENT_ID });
      let a;
      let b;
      if (dest) {
        try {
          await E.Catalog.ensureFull(dest);
        } catch {
          // The add falls back to an independent card; so does the preview.
        }
        if (seq !== pv.seq) return;
        a = E.traditionCardOpts(dest, id) || undefined;
        b = E.traditionCardOpts(dest, id) || undefined;
      }
      if (seq !== pv.seq) return;
      pv.base = E.makeCard(id, a);
      pv.card = E.makeCard(id, b);
      for (const e of editsOf(id)) applyEdit(pv.card, e);
      end('ready', null);
    } catch {
      if (seq !== pv.seq) return;
      pv.base = pv.card = null;
      end('error', { code: 'LOAD_FAILED', message: M.PREVIEW_FAILED });
    }
  }
  // The pending setInstrumentDestination and resetInstrumentPreview calls
  // settle at the latest rebuild's end, whichever it is.
  function settle() {
    const list = pv.waiting.splice(0);
    if (!list.length) return;
    if (pv.state === 'error') {
      announce(pv.error.message);
      for (const w of list) w.reject(fail(pv.error.code, pv.error.message));
    } else for (const w of list) w.resolve({ snapshot: snapshotOf('recipe') });
  }

  // ── sourceMessage (#668 6647387849): the recipe as it would be with this
  // instrument added where Add would put it ──
  const placed = () => {
    const copy = { ...clone(pv.card), id: '__preview__' };
    const saved = E.app.cards;
    let after;
    try {
      E.app.cards = [...saved, copy];
      if (copy.traditionId) E._placeCardAfterTraditionRun(copy, copy.traditionId);
      after = E.app.cards;
    } finally {
      E.app.cards = saved;
    }
    return { after, copy };
  };
  function sourceMessage() {
    const { after, copy } = placed();
    const src = E.envCardOf(after);
    if (!src || !E.hasEnvironment(src))
      return 'Your recipe has no environment yet, and neither does this instrument.';
    const lead =
      src === copy
        ? 'Added now, this instrument would set your recipe’s environment: its tuning, room and chain are the ones the recipe renders.'
        : `Your recipe renders one environment, from ${instrumentName(src.instrumentId)} (${
            src.traditionId ? genreName(src.traditionId) : 'independent'
          }). This instrument’s tuning, room and chain are kept on its card, but render only if it becomes that source.`;
    if (format !== 'compact') return lead;
    // Whether Compact writes the environment, read from the render itself,
    // against compressCompactRecipe's shapes rebuilt from the same parts
    // (buildStackParts, the render's deduplicated prefaces as _resolvePreface
    // reads them, envCardOf's card). Counting the render's lines can't tell:
    // a label may hold a line break, and a card may be named as the
    // environment's room (#810 6687911089). A label found anywhere in the
    // text can't either: a room or tuning named like part of a card's own
    // line is found in that line when the environment line is dropped (#810
    // 6682309672). Clearing the environment and comparing renders can't
    // tell, because the automatic characters re-derive without it.
    const limit = ceiling || E.RECIPE_CHAR_CEILING;
    const text = E.compileRecipeStack(after, 'compact', { ceiling: limit });
    const deduped = E._computeRecipeDedupedPrefaces(after);
    const named = (card, label) => {
      const preface = deduped.has(card) ? deduped.get(card) || null : E._resolvePreface(card);
      return preface ? `${preface} ${label}` : label;
    };
    const header = E._recipeHeader(after);
    const envLine = E.buildStackParts(src)
      .filter((part) => part.kind !== 'instrument')
      .map((part) => part.label)
      .join(' · ');
    const instLines = after.map((card) => {
      const inst = E.buildStackParts(card).find((part) => part.kind === 'instrument');
      return inst ? `${named(card, inst.label)},` : '?,';
    });
    const roster = header + instLines.concat(`${envLine},`).join('\n');
    const single =
      after.length === 1 &&
      `${header}${E.buildStackParts(after[0])
        .map((part) => (part.kind === 'instrument' ? named(after[0], part.label) : part.label))
        .join(' · ')},`;
    // Why this can't misjudge: compressCompactRecipe (scripts/_recipe_stack.js)
    // writes the environment in exactly two renders. A roster is the genre
    // header, then one `preface label,` line per card, then the environment
    // line once: instLines.concat(envLine + ',').join('\n'). One card alone
    // may instead be its one full-stack line, which ends with its
    // environment parts. Each is rebuilt here as the render builds it and
    // compared with the render exactly, so a line break in a label, or a
    // label named like the environment, changes both alike. A render that
    // is cut ends in [truncated] (or …), and one that drops the environment
    // line is the cards' lines alone, so neither equals either shape, and
    // the sentence says it is dropped.
    const written = (!!envLine && text === roster) || text === single;
    return written
      ? `${lead} In Compact it is written once, after the instruments.`
      : `${lead} In Compact the environment line is dropped to fit the ${limit}-character limit.`;
  }

  // ── After every committed recipe change ──
  // uiEnvHandoverText (src/workbench.js), restated over the store's record.
  function handover() {
    const card = E.envCardOf(E.app.cards);
    const prev = envSource;
    envSource = card
      ? {
          id: card.id,
          ids: new Set(E.app.cards.map((c) => c.id)),
          has: E.hasEnvironment(card),
          card,
        }
      : null;
    if (!prev || !card || prev.id === card.id || !prev.has || !prev.ids.has(card.id)) return '';
    const from = `${instrumentName(card.instrumentId)} (${
      card.traditionId ? genreName(card.traditionId) : 'independent'
    })`;
    if (!E.hasEnvironment(card))
      return `No recording environment is set now. It was on ${instrumentName(prev.card.instrumentId)}.`;
    const leads =
      card.traditionId && E.app.cards[0] === card && card.traditionId !== prev.card.traditionId
        ? `${genreName(card.traditionId)} now leads. `
        : '';
    return `${leads}The recording environment now comes from ${from}.`;
  }
  // A destination that left the recipe falls back to Independent.
  function fallback() {
    if (destination && !groups().some((g) => g.genreId === destination)) {
      destination = null;
      if (pv.instrumentId) rebuild();
    }
  }
  function commit(before) {
    const changed = keyOf() !== before;
    if (changed) revision++;
    const said = handover();
    fallback();
    touch('recipe', 'environment');
    flush();
    if (said) announce(said);
    return changed;
  }

  // ── Recipe commands ──
  const notReady = () =>
    status === 'error' && error
      ? fail(error.code === 'CLAIMED' ? 'CLAIMED' : 'LOAD_FAILED', error.message)
      : fail('BUSY', M.LOADING);
  const refuse = (e, say = true) => {
    if (say) announce(e.message);
    return Promise.reject(e);
  };
  function setBusy(on) {
    busy = on;
    touch('recipe');
    flush();
  }
  // An add whose engine call throws part-way (an instrument whose data can't
  // be read) leaves the recipe as its last history entry has it: the cards
  // the call had made have no entry yet, so they go, and nothing was added.
  // Taken before the add; called if it throws. If the call got as far as its
  // history entry, the recipe is that entry's and stays.
  function partial() {
    const cards = E.app.cards.slice();
    const at = [E.app.history.length, E.app.historyIndex, E.app.history[E.app.historyIndex]];
    return () => {
      const now = [E.app.history.length, E.app.historyIndex, E.app.history[E.app.historyIndex]];
      if (now.every((x, i) => x === at[i])) E.app.cards = cards;
    };
  }
  // The end of an add that threw: the store free again and the recipe
  // committed as it is, which partial() has put back.
  function failed(before, undo) {
    undo();
    busy = false;
    commit(before);
  }
  // addInstrumentFromPicker with the destination it asked for; one history
  // entry, and where the card really went. An engine throw is refused
  // LOAD_FAILED and said once, and changes nothing.
  async function addCard(id, dest, configure) {
    const before = keyOf();
    const undo = partial();
    setBusy(true);
    let card;
    try {
      E.app._addToTradition = dest || null;
      card = await E.addInstrumentFromPicker(id, configure ? { configure } : undefined);
    } catch {
      E.app._addToTradition = null;
      failed(before, undo);
      const e = fail('LOAD_FAILED', M.ADD_FAILED(instrumentName(id)));
      announce(e.message);
      throw e;
    }
    E.app._addToTradition = null;
    busy = false;
    if (dest && dest === routedTo) routedTo = null;
    commit(before);
    return card;
  }
  const placedOf = (card) => (card && card.traditionId ? 'grouped' : 'independent');

  function addInstrument({ instrumentId, destination: dest, revision: rev } = {}) {
    if (status !== 'ready') return refuse(notReady());
    const name = instrumentName(instrumentId);
    if (rev !== revision) return refuse(fail('STALE', M.STALE_ADD(name)));
    if (busy) return refuse(fail('BUSY', M.BUSY_ADD(name)));
    if (typeof instrumentId !== 'string' || !E.Inst(instrumentId))
      return refuse(fail('NOT_FOUND', M.NO_INSTRUMENT_ID));
    // A genre not yet in the recipe is accepted (its group is created); one
    // that can't be loaded, or isn't a genre, adds an independent card, as
    // production's add does.
    if (dest != null && typeof dest !== 'string') return refuse(fail('INVALID', M.BAD_DESTINATION));
    return addCard(instrumentId, dest || null, null).then((card) => {
      if (!card) return refuse(fail('NOT_FOUND', M.NO_INSTRUMENT_ID));
      // production's _addedInstrumentMessage, with ipAddConfigured's clause
      // when the genre asked for couldn't be loaded.
      announce(
        card.traditionId || !dest
          ? E._addedInstrumentMessage(instrumentId, card)
          : `Added ${name} as an independent instrument (${genreName(dest)} couldn’t be loaded)`
      );
      return { snapshot: snapshotOf('recipe'), placed: placedOf(card) };
    });
  }

  // importTraditionWithFeedback: the genre's whole ensemble, one entry.
  function ensemble(genreId) {
    const id = E.Catalog.resolve(genreId);
    const trad = typeof genreId === 'string' && id ? E.Catalog.get(id) : null;
    if (!trad) return refuse(fail('NOT_FOUND', M.NO_GENRE));
    const before = keyOf();
    const undo = partial();
    setBusy(true);
    return E.Catalog.ensureFull(id).then(
      () => {
        let created;
        try {
          created = E.importTradition(id);
        } catch {
          failed(before, undo);
          return refuse(fail('LOAD_FAILED', M.GENRE_FAILED(trad.name)));
        }
        busy = false;
        commit(before);
        const expected = (trad.instruments || []).length;
        announce(
          created.length === 0
            ? `"${trad.name}" has no recognised instruments`
            : created.length < expected
              ? `Imported ${created.length}/${expected} instruments from "${trad.name}"`
              : `Imported ${trad.name}`
        );
        return { snapshot: snapshotOf('recipe'), added: created.length, placed: 'grouped' };
      },
      () => {
        setBusy(false);
        return refuse(fail('LOAD_FAILED', M.GENRE_FAILED(trad.name)));
      }
    );
  }
  function addEnsemble({ genreId, revision: rev } = {}) {
    if (status !== 'ready') return refuse(notReady());
    if (rev !== revision)
      return refuse(fail('STALE', M.STALE_ADD(`${genreName(genreId)}’s ensemble`)));
    if (busy) return refuse(fail('BUSY', M.BUSY_GENRE));
    return ensemble(genreId);
  }
  // #774's Add genre: no revision; it starts the store itself.
  function addGenre(id) {
    start().then(
      () => {
        if (busy) return announce(M.BUSY_GENRE);
        ensemble(id).catch(() => {}); // announced already
      },
      () => announce(M.LOAD_FAILED)
    );
  }

  // The three instrument-action commands (6647636873): STALE, then BUSY.
  function actionGuard(args) {
    if (status !== 'ready') return notReady();
    const { instrumentId, revision: rev, previewRevision } = args || {};
    if (rev !== revision || previewRevision !== pv.revision || instrumentId !== pv.instrumentId)
      return fail('STALE', M.STALE_ACTION);
    if (!pv.instrumentId) return fail('INVALID', M.NOT_OPEN);
    if (busy || pv.state === 'loading') return fail('BUSY', M.BUSY_ACTION);
    return null;
  }
  const waitRebuild = () => new Promise((resolve, reject) => pv.waiting.push({ resolve, reject }));
  function setInstrumentDestination(args) {
    const e = actionGuard(args);
    if (e) return refuse(e);
    const dest = args.destination === undefined ? null : args.destination;
    if (!destinations().some((d) => d.genreId === dest))
      return refuse(fail('INVALID', M.BAD_DESTINATION));
    if (dest === destination && !routedTo)
      return Promise.resolve({ snapshot: snapshotOf('recipe') });
    destination = dest;
    routedTo = null;
    const p = waitRebuild();
    rebuild();
    return p;
  }
  function resetInstrumentPreview(args) {
    const e = actionGuard(args);
    if (e) return refuse(e);
    edits.set(pv.instrumentId, []);
    const p = waitRebuild();
    rebuild();
    return p;
  }
  function addConfiguredInstrument(args) {
    const e = actionGuard(args);
    if (e)
      return refuse(
        e.code === 'BUSY' && busy ? fail('BUSY', M.BUSY_ADD(instrumentName(pv.instrumentId))) : e
      );
    if (pv.state === 'error') return refuse(fail(pv.error.code, pv.error.message));
    if (pv.state !== 'ready') return refuse(fail('BUSY', M.BUSY_ACTION));
    if ((args.destination === undefined ? null : args.destination) !== destination)
      return refuse(fail('INVALID', M.BAD_DESTINATION));
    // One synchronous step: what is added is the preview as it is now.
    const id = pv.instrumentId;
    const card = pv.card;
    const changed = ipDiff(pv.base, card).length;
    const captured = changed
      ? clone({
          parts: card.parts,
          pinnedParts: card.pinnedParts || [],
          preface: card.preface,
          prefaceAuto: card.prefaceAuto,
          tuning: card.tuning,
          room: card.room,
          chain: card.chain,
        })
      : null;
    const configure = captured ? (c) => Object.assign(c, clone(captured)) : null;
    const dest = destination;
    const name = instrumentName(id);
    return addCard(id, dest, configure).then((added) => {
      if (!added) return refuse(fail('NOT_FOUND', M.NO_INSTRUMENT_ID));
      // ipAddConfigured's message, worded from where the card landed.
      announce(
        `Added ${name}` +
          (added.traditionId
            ? ' to ' + genreName(added.traditionId)
            : dest
              ? ` as an independent instrument (${genreName(dest)} couldn’t be loaded)`
              : '') +
          (changed
            ? ` with ${countOf(changed, 'changed setting')}. Undo removes it.`
            : ' with catalog defaults.')
      );
      return { snapshot: snapshotOf('recipe'), placed: placedOf(added) };
    });
  }

  // ── apply(edit): synchronous edits to cards already in the recipe ──
  function apply(edit) {
    const no = (code) => ({
      ok: false,
      changed: false,
      code,
      refusal: {
        BUSY: status === 'ready' ? M.BUSY_EDIT : M.LOADING,
        LOAD_FAILED: M.LOAD_FAILED,
        CLAIMED: M.CLAIMED,
        STALE: M.STALE_EDIT,
        NOT_FOUND: M.NOT_FOUND_EDIT,
        INVALID: M.INVALID_EDIT,
        NOT_IN_BUILD: M.NOT_IN_BUILD,
        ASYNC: M.ASYNC,
      }[code],
    });
    if (status !== 'ready') return no(notReady().code);
    if (!edit || typeof edit !== 'object' || typeof edit.op !== 'string') return no('INVALID');
    if ('revision' in edit && edit.revision !== revision) return no('STALE');
    if (busy) return no('BUSY');
    if (ADD_OPS.includes(edit.op)) return no('ASYNC');
    if (LATER_OPS.includes(edit.op) || !Object.hasOwn(OPS, edit.op)) return no('NOT_IN_BUILD');
    for (const k of Object.keys(edit))
      if (k !== 'op' && k !== 'revision' && !OPS[edit.op].includes(k)) return no('INVALID');
    const cardOf = (id) => E.app.cards.find((c) => c.id === id) || null;
    const before = keyOf();
    if (edit.op === 'set_variant') {
      const c = cardOf(edit.card);
      if (!c) return no('NOT_FOUND');
      const inst = E.Inst(c.instrumentId);
      const part = (inst.parts || []).find((p) => p.id === edit.part);
      const v = edit.variant === undefined ? null : edit.variant;
      if (!part || (v !== null && !E.Variant(inst, part.id, v))) return no('INVALID');
      c.parts[part.id] = v || null;
      E.applyPartEdit(c, part.id);
      E.pushHistory();
    } else if (edit.op === 'set_preface') {
      const c = cardOf(edit.card);
      if (!c) return no('NOT_FOUND');
      if (edit.preface === null) {
        c.prefaceAuto = true;
        c.preface = E.suggestPrefaceForCard(c);
        E.pushHistory();
      } else if (E.PREFACE_LEXICON.some((p) => p.id === edit.preface)) {
        E.commitPrefaceChange(c, edit.preface);
      } else return no('INVALID');
    } else if (edit.op === 'set_environment') {
      const c = 'card' in edit ? cardOf(edit.card) : E.envCardOf(E.app.cards);
      if (!c) return no('NOT_FOUND');
      const writes = [];
      if ('tuning' in edit) {
        if (edit.tuning !== null && !E.Tuning(edit.tuning)) return no('INVALID');
        writes.push(() => (c.tuning = edit.tuning));
      }
      if ('room' in edit) {
        if (edit.room !== null && !E.Room(edit.room)) return no('INVALID');
        writes.push(() => (c.room = edit.room));
      }
      const stageOf = (id) => E.CHAIN_SECTIONS.find((s) => s.id === id);
      if ('chain' in edit) {
        if (!edit.chain || typeof edit.chain !== 'object' || Array.isArray(edit.chain))
          return no('INVALID');
        for (const [stage, v] of Object.entries(edit.chain)) {
          const s = stageOf(stage);
          if (!s) return no('INVALID');
          if (s.multiSelect) {
            if (!Array.isArray(v) || !v.every((x) => E.ChainItem(stage, x))) return no('INVALID');
            writes.push(() => (c.chain[stage] = v.slice()));
          } else {
            if (v !== null && !E.ChainItem(stage, v)) return no('INVALID');
            writes.push(() => (c.chain[stage] = v));
          }
        }
      }
      if ('clear' in edit) {
        if (!Array.isArray(edit.clear) || !edit.clear.every(stageOf)) return no('INVALID');
        for (const stage of edit.clear)
          writes.push(() => (c.chain[stage] = stageOf(stage).multiSelect ? [] : null));
      }
      if (!writes.length) return no('INVALID');
      for (const w of writes) w();
      E.pushHistory();
    } else if (edit.op === 'remove_instrument') {
      if (!cardOf(edit.card)) return no('NOT_FOUND');
      E.rmCard(edit.card);
    } else if (edit.op === 'remove_tradition') {
      // A genre is named by its id: a card with no genre has null there, so
      // anything else would match the independent cards.
      if (typeof edit.tradition !== 'string') return no('INVALID');
      const ids = E.app.cards.filter((c) => c.traditionId === edit.tradition).map((c) => c.id);
      if (!ids.length) return no('NOT_FOUND');
      for (const id of ids) E.rmCard(id, { skipHistory: true });
      E.pushHistory();
    }
    return { ok: true, changed: commit(before) };
  }

  // ── Undo and redo: the engine's own history ──
  const canUndo = () => status === 'ready' && !busy && E.app.historyIndex > 0;
  const canRedo = () =>
    status === 'ready' && !busy && E.app.historyIndex < E.app.history.length - 1;
  function step(back) {
    const no = (code) => ({ ok: false, changed: false, code, refusal: M[code] || M.BUSY_EDIT });
    if (status !== 'ready') {
      const e = notReady();
      return { ok: false, changed: false, code: e.code, refusal: e.message };
    }
    if (busy) return no('BUSY');
    if (!(back ? canUndo() : canRedo())) return no(back ? 'NOTHING_TO_UNDO' : 'NOTHING_TO_REDO');
    const at = E.app.historyIndex;
    if (back) E.undo();
    else E.redo();
    // The engine refused the entry (production toasts it): said once, as
    // #740 says only apply's refusals.
    if (E.app.historyIndex === at) {
      const r = no(back ? 'UNDO_FAILED' : 'REDO_FAILED');
      announce(r.refusal);
      return r;
    }
    revision++;
    const said = handover();
    fallback();
    touch('recipe', 'environment');
    flush();
    if (said) announce(said);
    return { ok: true, changed: true };
  }

  // ── Boot ──
  function tables() {
    const groupsOf = E.prefaceGroups();
    T.categories = freeze(
      E.PREFACE_CAT_ORDER.map((cat) => {
        const category = svgUrl(E.prefaceCatGlyphHTML(cat, 16));
        return {
          id: cat,
          name: cat,
          prefaces: (groupsOf[cat] || []).map((e) => ({
            id: e.id,
            note: e.note || null,
            glyph: { category, entry: svgUrl(E.prefaceGlyphsHTML(e, 15, true)) },
          })),
        };
      })
    );
    T.tunings = freeze(E.TUNINGS.map((t) => ({ id: t.id, name: t.name })));
    T.rooms = freeze(E.ROOMS.map((r) => ({ id: r.id, name: r.name })));
    T.stages = freeze(
      E.CHAIN_SECTIONS.map((s) => ({
        stage: s.id,
        name: s.name,
        multi: !!s.multiSelect,
        options: s.items.map((it) => ({ id: it.id, name: it.name })),
      }))
    );
    T.formats = freeze(E.RECIPE_FORMATS.map(([id]) => id));
  }
  async function boot() {
    const engine = await load();
    if (claimed.has(engine) && engine !== held) throw fail('CLAIMED', M.CLAIMED);
    claimed.add(engine);
    held = engine;
    await engine.loadNavGlyphArt();
    E = engine;
    // The workspace is the store's from here: empty, with one baseline
    // entry, as workbench.js uiRestoreSession leaves a new session.
    E.app.cards = [];
    E.app.history = [];
    E.app.historyIndex = -1;
    E.app._addToTradition = null;
    E.pushHistory();
    tables();
    // Only now does a selection change reach the store.
    selection.subscribe(() => {
      try {
        if (selection.current() !== pv.instrumentId) rebuild();
      } catch (e) {
        report(e);
      }
    });
    status = 'ready';
    error = null;
    revision = 1;
    envSource = null;
    handover();
    rebuild();
  }
  function start() {
    if (status === 'ready') return Promise.resolve();
    if (!starting) {
      if (status === 'error') {
        status = 'loading';
        error = null;
        touchPreview();
        flush();
      }
      starting = boot().catch((e) => {
        starting = null;
        status = 'error';
        error =
          e && e.code === 'CLAIMED'
            ? { code: 'CLAIMED', message: M.CLAIMED }
            : { code: 'LOAD_FAILED', message: M.LOAD_FAILED };
        touchPreview();
        flush();
        throw fail(error.code, error.message);
      });
    }
    return starting;
  }

  // ── The views ──
  const preview = (fn) => (args) => {
    const a = args || {};
    if (status !== 'ready') return Promise.reject(notReady());
    if (a.revision !== pv.revision) return Promise.reject(fail('STALE', M.STALE_CHOICE));
    if (pv.state === 'none') return Promise.reject(fail('NO_INSTRUMENT', M.NOT_OPEN));
    if (pv.state !== 'ready') return Promise.reject(fail('BUSY', M.BUSY_CHOICE));
    const e = fn(a, pv.card);
    if (e === false) return Promise.reject(fail('INVALID', M.INVALID_CHOICE));
    if (e) choose(e);
    return null;
  };
  const viewAction = (view, fn) => {
    const run = preview(fn);
    return (args) => run(args) || Promise.resolve(snapshotOf(view));
  };
  const inList = (list, id) => list.some((o) => o.id === id);
  const views = {
    configuration: {
      choosePart: viewAction('configuration', ({ partId, variantId }, card) => {
        const inst = E.Inst(card.instrumentId);
        const part = (inst.parts || []).find((p) => p.id === partId);
        const v = variantId === undefined ? null : variantId;
        if (!part || (v !== null && !(part.variants || []).some((x) => x.id === v))) return false;
        return { k: 'part', part: part.id, v };
      }),
    },
    character: {
      normalize: (text) => (E ? E.normalizeSearch(text) : String(text ?? '')),
      choose: viewAction('character', ({ prefaceId }) =>
        typeof prefaceId === 'string' && E.PREFACE_LEXICON.some((p) => p.id === prefaceId)
          ? { k: 'preface', id: prefaceId }
          : false
      ),
      automatic: viewAction('character', () => ({ k: 'auto' })),
    },
    environment: {
      choose: viewAction('environment', ({ field, id }) => {
        if (field !== 'tuning' && field !== 'room') return false;
        const v = id === undefined ? null : id;
        if (v !== null && !inList(field === 'tuning' ? T.tunings : T.rooms, v)) return false;
        return { k: field, v };
      }),
    },
    chain: {
      choose: viewAction('chain', ({ stage, id, on }, card) => {
        const s = T.stages.find((x) => x.stage === stage);
        if (!s) return false;
        if (!s.multi) {
          const v = id === undefined ? null : id;
          if (v !== null && !inList(s.options, v)) return false;
          return { k: 'chain', stage, v };
        }
        if (!inList(s.options, id)) return false;
        const now = card.chain[stage] || [];
        if (on === false)
          return now.includes(id) ? { k: 'chain', stage, v: now.filter((x) => x !== id) } : null;
        return now.includes(id) ? null : { k: 'chain', stage, v: [...now, id] };
      }),
    },
    output: {
      setFormat(f) {
        if (!T.formats || !T.formats.includes(f))
          throw new TypeError(`Unknown output format: ${f}`);
        if (f === format) return undefined;
        format = f;
        touch('output', 'environment');
        flush();
        return undefined;
      },
      // production's copyToClipboard, called from the click itself so the
      // write has its user activation; it says the outcome exactly once.
      copy() {
        const text = snapshotOf('output').text || '';
        return new Promise((resolve) => {
          let done = false;
          const finish = (ok) => {
            if (done) return;
            done = true;
            announce(ok ? M.COPIED : M.COPY_FAILED);
            resolve({ ok });
          };
          const fallbackCopy = () => {
            const had = document.activeElement;
            try {
              const ta = document.createElement('textarea');
              ta.value = text;
              ta.style.position = 'fixed';
              ta.style.top = '0';
              ta.style.left = '0';
              ta.style.opacity = '0';
              ta.style.pointerEvents = 'none';
              ta.setAttribute('readonly', '');
              document.body.appendChild(ta);
              ta.select();
              ta.setSelectionRange(0, text.length);
              const ok = document.execCommand('copy');
              ta.remove();
              finish(!!ok);
            } catch {
              finish(false);
            } finally {
              if (had && had !== document.activeElement && typeof had.focus === 'function')
                had.focus();
            }
          };
          try {
            if (navigator.clipboard && globalThis.isSecureContext)
              navigator.clipboard.writeText(text).then(() => finish(true), fallbackCopy);
            else fallbackCopy();
          } catch {
            fallbackCopy();
          }
        });
      },
    },
  };
  const previewViews = Object.freeze(
    Object.fromEntries(
      PREVIEW_VIEWS.map((v) => [
        v,
        Object.freeze({ snapshot: () => snapshotOf(v), subscribe: subscriber(v), ...views[v] }),
      ])
    )
  );

  const recipe = {
    snapshot: () => snapshotOf('recipe'),
    subscribe: subscriber('recipe'),
    apply,
    undo: () => step(true),
    redo: () => step(false),
    canUndo,
    canRedo,
    addInstrument,
    addEnsemble,
    setInstrumentDestination,
    addConfiguredInstrument,
    resetInstrumentPreview,
  };
  // A frozen recipe view with exactly the methods a lane's contract names.
  function port(methods) {
    const out = {};
    for (const m of methods) {
      if (!PORT_METHODS.includes(m)) throw new TypeError(`The recipe has no ${m}`);
      out[m] = recipe[m];
    }
    return Object.freeze(out);
  }

  // The shell's openInstrument on the instrument already open: production's
  // uiInspectInstrument rebuilds the preview every time it is asked, which
  // is how a preview that failed is tried again (a selection set to the
  // value it has tells no one). True when it rebuilt.
  function reopen(instrumentId) {
    if (status !== 'ready' || typeof instrumentId !== 'string') return false;
    if (instrumentId !== selection.current() || instrumentId !== pv.instrumentId) return false;
    rebuild();
    return true;
  }

  return Object.freeze({
    start,
    status: () => status,
    port,
    preview: previewViews,
    addGenre,
    reopen,
    // The shell's own STALE check for openInstrument (#780, 6647783903).
    previewIs: (instrumentId, previewRevision) =>
      pv.instrumentId === instrumentId && pv.revision === previewRevision,
  });
}
