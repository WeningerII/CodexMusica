/* exported renderInstrumentDiscovery, uiInspectInstrument */
/* global $ui, CODEX_IMAGE_MANIFEST, uiEmptyState, uiFind, uiFocus, uiAddInstrument, FamName, INSTRUMENT_FILTER_PILLS, Catalog, ChainItem, Inst, Room, Tradition, Tuning, UI, UILayout, Variant, app, applyPartEdit, buildStackParts, compileStack, copyToClipboard, entryRenderDescs, envCardOf, esc, familyImage, findSimilarInstruments, getMatchingInstrumentAxes, icon, image, inverseConfigureForPreface, listenLink, PREFACE_CAT_ORDER, loadPrefaceRecent, makeCard, normalizeSearch, prefaceCatGlyphHTML, prefaceGlyphsHTML, prefaceGroups, recordPrefaceRecent, passesInstrumentFilter, suggestPrefaceForCard, traditionCardOpts, uiButton, uiNavigate, uiRegisterPage */
/* Instrument page. Owned by the Instrument page worker; see docs/ui-foundation.md.

   Three columns over the Your recipe dock: the catalogue (families, classes,
   the 15 sound-property filters, search, sort, list/grid), the list, and an
   inspector that configures the instrument BEFORE it is added.

   Configure-before-add. The inspector works on a preview card built by the
   canonical engine (makeCard with the destination's traditionCardOpts, exactly
   what addInstrumentFromPicker seeds) and every choice runs through the
   engine's own functions (applyPartEdit for a variant, inverseConfigureForPreface
   for a character, plain field writes for environment and chain, as the editor
   does). The preview card never enters app.cards. "Add configured instrument"
   adds through the shell command uiAddInstrument (canonical picker path, same
   destination), then carries the preview's configuration onto that new card
   and records the whole addition as one history entry. Row "Add" buttons keep
   the quick path: catalog defaults, same destination. */
'use strict';

// Page-private state. UI.instrumentFamily / UI.instrumentClass /
// UI.instrumentPreview are this page's shell-visible state.
const IP = {
  sort: 'name',
  view: null, // UILayout.remember preference: 'list' | 'grid'
  manifest: null, // CODEX_IMAGE_MANIFEST (see ipLoadManifest)
  failed: new Set(), // instrument ids whose photograph failed to load
  trail: [], // inspector history (Similar instruments → Back)
  tab: 'parts',
  card: null, // the preview card (never in app.cards)
  base: null, // the same seed, untouched: what "Your changes" is measured from
  edits: new Map(), // instrumentId → ordered list of choices, replayed on rebuild
  open: new Set(), // part ids expanded in the inspector
  more: new Set(), // part ids whose "More materials" disclosure is open
  filters: {}, // text typed into option filters, by key
  props: new Set(['behaviour', 'voicing', 'pitch']), // sound-property groups shown open
  catsOpen: false, // narrow layouts: categories and filters disclosed
  note: '', // what the last choice moved besides itself
  changesOpen: false,
  fmt: 'rich',
  prefQuery: '',
  pcats: new Set(), // character categories shown open (browsing, not searching)
  seq: 0,
};
// The engine's 15 filters (INSTRUMENT_FILTER_PILLS / INSTRUMENT_FILTER_PREDS)
// grouped for disclosure. Grouping only: every predicate is the engine's, and
// checked properties combine with AND exactly as passesInstrumentFilter does.
// A pill the engine adds later lands in "More properties" rather than vanishing.
const IP_FILTER_GROUPS = [
  ['behaviour', 'Behaviour', ['sustained', 'decay']],
  ['voicing', 'Voicing', ['polyphonic', 'monophonic']],
  ['pitch', 'Pitch', ['pitched', 'noise', 'fixed_pitch', 'continuous_pitch']],
  ['register', 'Register', ['low', 'high', 'wide_range']],
  ['source', 'Sound source', ['acoustic', 'electric', 'electronic']],
  ['expressive', 'Expressiveness', ['expressive']],
];
const IP_TABS = [
  ['preface', 'Character', 'sparkles'],
  ['parts', 'Parts', 'sliders-horizontal'],
  ['env', 'Environment', 'house'],
  ['chain', 'Signal chain', 'link'],
  ['stack', 'Output', 'eye'],
];
const IP_FORMATS = [
  ['rich', 'Rich'],
  ['tags', 'Tags'],
  ['prose', 'Prose'],
  ['compact', 'Compact'],
];
const ipHuman = (s) => {
  const t = String(s || '').replaceAll('_', ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const ipPill = (id) => INSTRUMENT_FILTER_PILLS.find((p) => p.id === id);
const ipCount = (n, one, many = one + 's') => n.toLocaleString('en') + ' ' + (n === 1 ? one : many);

// ── Images ── references/_image_manifest.json (openly licensed image links),
// inlined by the build as CODEX_IMAGE_MANIFEST. An id without an entry, no
// manifest, or an image that fails to load falls back to the catalog glyph.
// Wherever a photograph appears its credit and licence appear with it.
function ipImageEntry(id) {
  // [thumb, licence, credit, sourcePage], as scripts/build_html.js inlines it.
  if (IP.failed.has(id)) return null;
  const e = IP.manifest?.instruments?.[id];
  if (!Array.isArray(e) || typeof e[0] !== 'string' || !/^https:\/\//.test(e[0])) return null;
  return { src: e[0], licence: e[1] || '', credit: e[2] || '', source: e[3] || '' };
}
function ipImage(id, size) {
  const e = ipImageEntry(id);
  if (!e) return `<span class="ip-glyph">${image(id, size)}</span>`;
  return `<img class="ip-photo" src="${esc(e.src)}" alt="" loading="lazy" width="${size}" height="${size}" data-ip-fallback="${esc(id)}" data-ip-size="${size}">`;
}
// The credit and licence that travel with a photo. `link` makes the credit a
// link to the source page; inside a row (a <button>) it stays plain text.
function ipCredit(id, { link = false } = {}) {
  const e = ipImageEntry(id);
  if (!e) return '';
  const text =
    'Photo: ' + [e.credit || 'uncredited', e.licence || 'licence not stated'].join(' · ');
  return link && /^https:\/\//.test(e.source)
    ? `<a class="ip-credit" data-ip-for="${esc(id)}" href="${esc(e.source)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`
    : `<span class="ip-credit" data-ip-for="${esc(id)}">${esc(text)}</span>`;
}
function ipLoadManifest() {
  // Inlined at build time (null until the manifest exists): no request, and
  // the same on file:// as on the site.
  IP.manifest = typeof CODEX_IMAGE_MANIFEST !== 'undefined' ? CODEX_IMAGE_MANIFEST : null;
}

// ── Catalogue ──
function ipQuery() {
  return normalizeSearch($ui('instrument-search').value);
}
function ipMatches(i, { q, family = UI.instrumentFamily, cls = UI.instrumentClass, filters }) {
  return (
    (!family || i.family === family) &&
    (!cls || i.class === cls) &&
    (!q || normalizeSearch(i.name + ' ' + i.short).includes(q)) &&
    passesInstrumentFilter(i, filters)
  );
}
function ipSorted(list) {
  const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  if (IP.sort === 'name-desc') return list.sort((a, b) => byName(b, a));
  if (IP.sort === 'parts')
    return list.sort((a, b) => (b.parts || []).length - (a.parts || []).length || byName(a, b));
  return list.sort(byName);
}
function ipDestinations() {
  return [...new Set(app.cards.map((c) => c.traditionId).filter(Boolean))];
}
function ipDest() {
  return $ui('instrument-destination')?.value || '';
}
function ipDestName(dest = ipDest()) {
  return dest ? Tradition(dest)?.name || dest : 'Independent instrument';
}
// Both "Add to" selects show one value: the toolbar's (#instrument-destination,
// which uiAddInstrument reads) and the inspector's mirror.
function ipDestinationOptions(value) {
  return (
    `<option value="">Independent instrument</option>` +
    ipDestinations()
      .map(
        (id) =>
          `<option value="${esc(id)}"${id === value ? ' selected' : ''}>${esc(Tradition(id)?.name || id)}</option>`
      )
      .join('')
  );
}
function ipSyncDestination() {
  const dest = $ui('instrument-destination');
  if (!dest) return false;
  const before = dest.value,
    known = ipDestinations();
  // The recipe's per-genre "Add instrument" sets app._addToTradition and brings
  // the user here: that genre is offered even before it holds a card.
  const pending = app._addToTradition || '';
  const want = pending || (known.includes(before) ? before : '');
  dest.innerHTML =
    ipDestinationOptions(want) +
    (want && !known.includes(want)
      ? `<option value="${esc(want)}" selected>${esc(Tradition(want)?.name || want)}</option>`
      : '');
  dest.value = want;
  const mirror = $ui('ip-destination');
  if (mirror) {
    mirror.innerHTML = dest.innerHTML;
    mirror.value = dest.value;
  }
  return dest.value !== before;
}
function renderInstrumentDiscovery() {
  const host = $ui('instrument-body');
  if (!host) return;
  const changed = ipSyncDestination();
  const q = ipQuery(),
    filters = app.instrumentAxisFilters,
    fam = INSTRUMENT_FAMILIES.find((f) => f.id === UI.instrumentFamily);
  const filtered = ipSorted(INSTRUMENTS.filter((i) => ipMatches(i, { q, filters })));
  const scope = INSTRUMENTS.filter((i) => ipMatches(i, { q, family: '', cls: '', filters }));
  $ui('ip-total').textContent = ipCount(INSTRUMENTS.length, 'instrument');
  host.dataset.view = IP.view?.get() || 'list';
  host.classList.toggle('ip-cats-open', IP.catsOpen);
  host.innerHTML = ipRenderCategories(scope, q, filters) + ipRenderList(filtered, fam, q, filters);
  if (changed && UI.instrumentPreview) ipRebuild();
}
function ipRenderCategories(scope, q, filters) {
  const narrowed = !!q || filters.size > 0;
  const n = (fid) => scope.filter((i) => i.family === fid).length;
  const families = [
    `<button type="button" class="ip-cat" data-ui="instrument-all" aria-pressed="${!UI.instrumentFamily}"><span class="ip-cat-glyph">${icon('layout-grid', 18)}</span><span class="ip-cat-name">All instruments</span><span class="ip-cat-count">${scope.length.toLocaleString('en')}</span></button>`,
    ...INSTRUMENT_FAMILIES.map(
      (f) =>
        `<button type="button" class="ip-cat" data-ui="instrument-family" data-id="${esc(f.id)}" aria-pressed="${UI.instrumentFamily === f.id}"${n(f.id) ? '' : ' data-empty="true"'}><span class="ip-cat-glyph">${familyImage(f.id, 22)}</span><span class="ip-cat-name">${esc(f.name)}</span><span class="ip-cat-count">${n(f.id).toLocaleString('en')}</span></button>`
    ),
  ].join('');
  const grouped = new Set(IP_FILTER_GROUPS.flatMap((g) => g[2]));
  const groups = IP_FILTER_GROUPS.concat([
    [
      'other',
      'More properties',
      INSTRUMENT_FILTER_PILLS.map((p) => p.id).filter((id) => !grouped.has(id)),
    ],
  ]).filter((g) => g[2].some((id) => ipPill(id)));
  // Count: how many instruments in the current family/class/search scope
  // would match with this property added to the ones already checked.
  const local = INSTRUMENTS.filter((i) => ipMatches(i, { q, filters: new Set() }));
  const countWith = (id) => {
    const set = new Set(filters);
    set.add(id);
    return local.filter((i) => passesInstrumentFilter(i, set)).length;
  };
  const props = groups
    .map(([gid, label, ids]) => {
      const active = ids.filter((id) => filters.has(id)).length;
      const open = IP.props.has(gid) || active > 0;
      return `<details class="ip-prop" data-ip-prop="${gid}"${open ? ' open' : ''}><summary><span>${esc(label)}</span>${active ? `<span class="ip-prop-active">${active} on</span>` : ''}</summary><div class="ip-prop-body">${ids
        .filter((id) => ipPill(id))
        .map((id) => {
          const on = filters.has(id);
          return `<label class="ip-check"><input type="checkbox" data-ui="instrument-filter" data-id="${esc(id)}"${on ? ' checked' : ''}><span>${esc(ipPill(id).label)}</span><span class="ip-check-count" aria-label="${countWith(id)} matching">${countWith(id).toLocaleString('en')}</span></label>`;
        })
        .join('')}</div></details>`;
    })
    .join('');
  return `<button type="button" class="ip-cats-toggle cm-btn cm-btn-outline" data-ui="ip-cats" aria-expanded="${IP.catsOpen}" aria-controls="ip-cats">${icon('funnel', 18)}<span>Categories and sound properties${filters.size ? ' · ' + filters.size + ' on' : ''}</span></button><nav class="ip-cats" id="ip-cats" aria-label="Instrument categories and sound properties"><h2 class="ip-side-title">Categories${narrowed ? ' <span class="ip-side-note">matching</span>' : ''}</h2><div class="ip-cat-list">${families}</div><div class="ip-side-head"><h2 class="ip-side-title">Sound properties</h2>${filters.size ? uiButton('clear-filters', 'Clear', 'x', 'class="ip-link" aria-label="Clear sound properties"') : ''}</div><p class="ip-side-hint">An instrument must have every checked property. Numbers show how many would match.</p>${props}</nav>`;
}
function ipRenderList(filtered, fam, q, filters) {
  const classes = fam
    ? [...new Set(INSTRUMENTS.filter((i) => i.family === fam.id).map((i) => i.class))]
    : [];
  const inFamily = fam ? INSTRUMENTS.filter((i) => ipMatches(i, { q, cls: '', filters })) : [];
  const crumbs = fam
    ? `<nav class="ip-crumbs" aria-label="Catalogue position">${uiButton('instrument-back', UI.instrumentClass ? 'Back to ' + fam.name : 'All instruments', 'arrow-left', 'class="ip-back"')}<span>${esc(fam.name)}</span>${UI.instrumentClass ? `<span aria-hidden="true">›</span><span>${esc(ipHuman(UI.instrumentClass))}</span>` : ''}</nav>`
    : '';
  const title = UI.instrumentClass
    ? ipHuman(UI.instrumentClass)
    : fam
      ? fam.name
      : 'All instruments';
  const view = IP.view?.get() || 'list';
  const controls = `<div class="ip-controls"><label class="ip-field"><span>Sort</span><select id="ip-sort" class="cm-select" aria-label="Sort instruments"><option value="name"${IP.sort === 'name' ? ' selected' : ''}>Name A–Z</option><option value="name-desc"${IP.sort === 'name-desc' ? ' selected' : ''}>Name Z–A</option><option value="parts"${IP.sort === 'parts' ? ' selected' : ''}>Most customizable</option></select></label><div class="cm-segmented ip-view" role="group" aria-label="Catalogue layout"><button type="button" data-ui="ip-view" data-id="list" aria-pressed="${view === 'list'}">${icon('list', 16)}<span>List</span></button><button type="button" data-ui="ip-view" data-id="grid" aria-pressed="${view === 'grid'}">${icon('layout-grid', 16)}<span>Grid</span></button></div></div>`;
  const classChips = fam
    ? `<div class="ip-classes" role="group" aria-label="${esc(fam.name)} classes"><button type="button" class="cm-chip" data-ui="instrument-class-all" aria-pressed="${!UI.instrumentClass}">All · ${inFamily.length}</button>${classes
        .map(
          (c) =>
            `<button type="button" class="cm-chip" data-ui="instrument-class" data-id="${esc(c)}" aria-pressed="${UI.instrumentClass === c}">${esc(ipHuman(c))} · ${inFamily.filter((i) => i.class === c).length}</button>`
        )
        .join('')}</div>`
    : '';
  const active = filters.size
    ? `<div class="ip-active" aria-label="Sound properties in force">${[...filters]
        .map((id) =>
          uiButton(
            'instrument-filter',
            ipPill(id)?.label || id,
            'x',
            `class="cm-chip" aria-pressed="true" data-id="${esc(id)}" aria-label="Remove ${esc(ipPill(id)?.label || id)}"`
          )
        )
        .join('')}${uiButton('clear-filters', 'Clear all', 'x', 'class="ip-link"')}</div>`
    : '';
  const dest = ipDestName();
  const rows = filtered
    .slice(0, UI.limit)
    .map((i) => {
      const parts = (i.parts || []).length;
      const current = UI.instrumentPreview === i.id;
      return `<div class="ip-row"${current ? ' aria-current="true"' : ''}><button type="button" class="ip-row-main" data-ui="instrument-inspect" data-id="${esc(i.id)}" aria-label="${esc(i.name)}: configure before adding">${ipImage(i.id, 44)}<span class="ip-row-text"><span class="ip-row-name">${esc(i.name)}</span><span class="ip-row-meta">${esc(FamName(i.family))} · ${esc(ipHuman(i.class))} · ${ipCount(parts, 'customizable part')}</span>${ipCredit(i.id)}</span></button>${listenLink(i.name, true)}${uiButton('instrument-add', 'Add', 'plus', `data-id="${esc(i.id)}" aria-label="Add ${esc(i.name)} with catalog defaults to ${esc(dest)}" data-tooltip="Adds with catalog defaults to ${esc(dest)}"`)}</div>`;
    })
    .join('');
  const more =
    filtered.length > UI.limit
      ? `<div class="ip-more-row"><span>Showing ${Math.min(UI.limit, filtered.length).toLocaleString('en')} of ${filtered.length.toLocaleString('en')}</span>${uiButton('more', 'Show more', 'chevron-down', 'class="cm-btn cm-btn-outline"')}</div>`
      : '';
  return `<section class="ip-list" aria-labelledby="ip-list-title">${crumbs}<div class="ip-list-head"><h2 id="ip-list-title">${esc(title)}</h2><span class="ip-list-count" role="status">${ipCount(filtered.length, 'instrument')}</span>${controls}</div>${classChips}${active}<div class="ip-rows">${rows}</div>${more}${!filtered.length ? uiInstrumentNoResults(q, fam) : ''}</section>`;
}
// No results says which constraints are in force and offers to lift each one.
// Conflicting properties are named when the catalogue never has them together.
function uiInstrumentNoResults(q, fam) {
  const filters = app.instrumentAxisFilters;
  const why = [];
  if (q) why.push('the search “' + $ui('instrument-search').value.trim() + '”');
  if (fam)
    why.push(UI.instrumentClass ? ipHuman(UI.instrumentClass) : 'the ' + fam.name + ' family');
  if (filters.size) why.push(ipCount(filters.size, 'sound property', 'sound properties'));
  const on = [...filters];
  const clashes = [];
  for (let a = 0; a < on.length; a++)
    for (let b = a + 1; b < on.length; b++)
      if (!INSTRUMENTS.some((i) => passesInstrumentFilter(i, new Set([on[a], on[b]]))))
        clashes.push(`“${ipPill(on[a])?.label}” and “${ipPill(on[b])?.label}”`);
  return uiEmptyState({
    title: 'No instruments match',
    text:
      'Nothing satisfies ' +
      why.join(' and ') +
      ' together.' +
      (clashes.length
        ? ' No instrument in the catalogue is ' + clashes.join(', or ') + ' at once.'
        : ''),
    actions:
      (q ? uiButton('instrument-clear-search', 'Clear search', 'x') : '') +
      on
        .map((id) =>
          uiButton(
            'instrument-filter',
            'Remove ' + (ipPill(id)?.label || id),
            'x',
            `data-id="${esc(id)}"`
          )
        )
        .join('') +
      (filters.size > 1 ? uiButton('clear-filters', 'Clear filters', 'x') : '') +
      (fam ? uiButton('instrument-all', 'All instruments', 'arrow-left') : ''),
  });
}

// ── Inspector: the preview card ──
function ipEdits(id = UI.instrumentPreview) {
  if (!IP.edits.has(id)) IP.edits.set(id, []);
  return IP.edits.get(id);
}
// The preview is not in the recipe, so engine edits run quiet: no toast, no
// shifts-panel record. What moved is reported in the inspector instead.
function ipApply(card, e) {
  if (e.k === 'part') {
    card.parts[e.part] = e.v || null;
    applyPartEdit(card, e.part, { quiet: true });
  } else if (e.k === 'preface') {
    const r = inverseConfigureForPreface(card, e.id);
    if (r) {
      r.apply();
      card.pinnedParts = [];
    } else {
      card.preface = e.id;
      card.prefaceAuto = false;
    }
  } else if (e.k === 'auto') {
    card.prefaceAuto = true;
    card.preface = suggestPrefaceForCard(card);
  } else if (e.k === 'tuning' || e.k === 'room') {
    card[e.k] = e.v || null;
  } else if (e.k === 'chain') {
    card.chain[e.stage] = Array.isArray(e.v) ? e.v.slice() : e.v || null;
  }
}
// Build the preview from the destination exactly as the canonical add would
// seed it, then replay the user's choices. Async: a genre's full row may need
// fetching (Catalog.ensureFull), as addInstrumentFromPicker does.
async function ipRebuild() {
  const id = UI.instrumentPreview,
    dest = ipDest(),
    seq = ++IP.seq;
  if (!id || !Inst(id)) return;
  let opts;
  if (dest) {
    try {
      await Catalog.ensureFull(dest);
    } catch {
      /* the add falls back to an ungrouped card; so does the preview */
    }
    opts = traditionCardOpts(dest, id) || undefined;
  }
  if (seq !== IP.seq || id !== UI.instrumentPreview) return;
  IP.base = makeCard(id, opts);
  IP.card = makeCard(id, opts);
  for (const e of ipEdits(id)) ipApply(IP.card, e);
  ipRenderInspector();
}
function ipChoose(e, focusKey) {
  const card = IP.card;
  if (!card) return;
  const before = JSON.parse(JSON.stringify(card));
  ipEdits().push(e);
  ipApply(card, e);
  const own = (c) =>
    (e.k === 'part' && c.key === 'part:' + e.part) ||
    ((e.k === 'preface' || e.k === 'auto') && c.key === 'preface') ||
    (e.k === 'tuning' && c.key === 'tuning') ||
    (e.k === 'room' && c.key === 'room') ||
    (e.k === 'chain' && c.key === 'chain:' + e.stage);
  const moved = ipDiff(before, card).filter((c) => !own(c));
  IP.note = moved.length
    ? (e.k === 'preface'
        ? `Configured for “${card.preface}”: `
        : 'Also moved to match the new sound: ') +
      moved.map((c) => `${c.label} ${c.from} → ${c.to}`).join('; ')
    : '';
  ipRenderInspector(focusKey);
}
const ipVariantName = (inst, part, v) => (v ? Variant(inst, part, v)?.name || v : 'Not set');
const ipChainName = (stage, v) =>
  Array.isArray(v)
    ? v.length
      ? v.map((x) => ChainItem(stage, x)?.name || x).join(', ')
      : 'None'
    : v
      ? ChainItem(stage, v)?.name || v
      : 'Not set';
// What differs between two cards of the same instrument, in reading order.
function ipDiff(a, b) {
  const inst = Inst(b.instrumentId),
    out = [];
  for (const p of inst.parts || []) {
    const x = a.parts[p.id] || null,
      y = b.parts[p.id] || null;
    if (x !== y)
      out.push({
        key: 'part:' + p.id,
        label: p.name || ipHuman(p.id),
        from: ipVariantName(inst, p.id, x),
        to: ipVariantName(inst, p.id, y),
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
      from: a.tuning ? Tuning(a.tuning)?.name || a.tuning : 'Not set',
      to: b.tuning ? Tuning(b.tuning)?.name || b.tuning : 'Not set',
    });
  if (a.room !== b.room)
    out.push({
      key: 'room',
      label: 'Room',
      from: a.room ? Room(a.room)?.name || a.room : 'Not set',
      to: b.room ? Room(b.room)?.name || b.room : 'Not set',
    });
  for (const s of CHAIN_SECTIONS) {
    const x = a.chain?.[s.id] ?? (s.multiSelect ? [] : null),
      y = b.chain?.[s.id] ?? (s.multiSelect ? [] : null);
    if (JSON.stringify(x) !== JSON.stringify(y))
      out.push({
        key: 'chain:' + s.id,
        label: s.name,
        from: ipChainName(s.id, x),
        to: ipChainName(s.id, y),
      });
  }
  return out;
}
function ipDescriptors(card) {
  return new Set(buildStackParts(card).flatMap((p) => p.descriptors));
}
function ipOptionDescs(v, current) {
  const descs = v ? entryRenderDescs(v) : [];
  const now = new Set(current ? entryRenderDescs(current) : []);
  if (v === current) return descs.map((d) => `<span class="ip-d">${esc(d)}</span>`).join('');
  const cand = new Set(descs);
  return (
    descs
      .map((d) =>
        now.has(d)
          ? `<span class="ip-d">${esc(d)}</span>`
          : `<span class="ip-d ip-d-add" title="Added">+ ${esc(d)}</span>`
      )
      .join('') +
    [...now]
      .filter((d) => !cand.has(d))
      .map((d) => `<del class="ip-d ip-d-lost" title="Removed">${esc(d)}</del>`)
      .join('')
  );
}
function ipOption(inst, part, v, current, extra = '') {
  const vid = v ? v.id : '';
  const checked = (IP.card.parts[part.id] || '') === vid;
  const key = `opt:${part.id}:${vid}`;
  // The filter matches the option's own name and descriptors, never the
  // descriptors it would remove.
  const text = v ? [v.name || v.id, ...entryRenderDescs(v)].join(' ') : 'Not set';
  return `<label class="ip-opt${checked ? ' is-on' : ''}" data-ip-text="${esc(text)}"${extra}><input type="radio" name="ip-part-${esc(part.id)}" value="${esc(vid)}" data-ip-part="${esc(part.id)}" data-ip-key="${esc(key)}"${checked ? ' checked' : ''}><span class="ip-opt-name">${v ? esc(v.name || v.id) : 'Not set'}</span><span class="ip-opt-descs">${v || current ? ipOptionDescs(v, current) : ''}</span></label>`;
}
function ipFilterBox(key, label) {
  const value = IP.filters[key] || '';
  return `<label class="ip-filter cm-search">${icon('search', 16)}<input type="search" data-ip-filter="${esc(key)}" data-ip-key="filter:${esc(key)}" value="${esc(value)}" placeholder="${esc(label)}" aria-label="${esc(label)}"><span class="ip-filter-count" aria-live="polite"></span></label>`;
}
function ipRenderParts(inst) {
  const card = IP.card;
  if (!(inst.parts || []).length)
    return uiEmptyState({
      title: 'No customizable parts',
      text: 'This instrument has no parts to choose. Character, Environment and Signal chain still apply.',
    });
  return inst.parts
    .map((part) => {
      const cur = card.parts[part.id] ? Variant(inst, part.id, card.parts[part.id]) : null;
      const native = part.variants.filter((v) => !v.expanded),
        expanded = part.variants.filter((v) => v.expanded);
      const open = IP.open.has(part.id);
      const pinned = (card.pinnedParts || []).includes(part.id);
      const nativeKey = 'native:' + part.id;
      const body = open
        ? `<div class="ip-part-body">${native.length > 10 ? ipFilterBox(nativeKey, 'Filter ' + (part.name || '').toLowerCase() + ' options') : ''}<div class="ip-opts" role="radiogroup" aria-label="${esc(part.name || part.id)}" data-ip-list="${esc(nativeKey)}">${ipOption(inst, part, null, cur, ' data-ip-pin="1"')}${native.map((v) => ipOption(inst, part, v, cur)).join('')}</div>${
            expanded.length
              ? `<details class="ip-more" data-ip-more="${esc(part.id)}"${IP.more.has(part.id) ? ' open' : ''}><summary>More materials — any ${expanded[0].expanded === 'wood' ? 'wood' : 'string'} on any instrument (${expanded.length})</summary>${IP.more.has(part.id) ? ipRenderMore(inst, part, expanded, cur) : ''}</details>`
              : ''
          }</div>`
        : '';
      return `<section class="ip-part${open ? ' is-open' : ''}"><h3 class="ip-part-head"><button type="button" data-ui="ip-part" data-id="${esc(part.id)}" aria-expanded="${open}" data-ip-key="part:${esc(part.id)}"><span class="ip-part-name">${esc(part.name || ipHuman(part.id))}</span><span class="ip-part-value${cur ? '' : ' is-unset'}">${cur ? esc(cur.name) : 'Not set'}${pinned ? ' · your choice' : ''}</span><span class="ip-part-count">${ipCount(part.variants.length, 'option')}</span>${icon('chevron-down', 16)}</button></h3>${body}</section>`;
    })
    .join('');
}
function ipRenderMore(inst, part, expanded, cur) {
  const key = 'more:' + part.id;
  return `<div class="ip-more-body">${ipFilterBox(key, 'Search ' + expanded.length + ' materials')}<div class="ip-opts" role="radiogroup" aria-label="More materials for ${esc(part.name || part.id)}" data-ip-list="${esc(key)}">${expanded.map((v) => ipOption(inst, part, v, cur)).join('')}</div></div>`;
}
// The character browser is the editor's (renderPrefaceModalBody): the same
// lexicon, the same categories (prefaceGroups / PREFACE_CAT_ORDER), glyphs,
// search predicate and recently-used list. Only the target differs: a pick
// configures the preview card instead of a recipe card.
function ipPrefaceChip(e, grouped) {
  const g = typeof prefaceGlyphsHTML === 'function' ? prefaceGlyphsHTML(e, 15, grouped) : '';
  return `<button type="button" class="cm-chip ip-pchip" data-ui="ip-preface" data-id="${esc(e.id)}" aria-pressed="${IP.card.preface === e.id}"${e.note ? ` data-tooltip="${esc(e.note)}"` : ''}>${g}<span>${esc(e.id)}</span></button>`;
}
function ipPrefaceCategory(cat, list, open) {
  return `<details class="ip-pcat" data-ip-pcat="${esc(cat)}"${open ? ' open' : ''}><summary data-ip-key="pcat:${esc(cat)}">${typeof prefaceCatGlyphHTML === 'function' ? prefaceCatGlyphHTML(cat, 16) : ''}<span class="ip-pcat-name">${esc(cat)}</span><span class="ip-pcat-count">${list.length}</span></summary>${open ? `<div class="ip-pcat-items">${list.map((e) => ipPrefaceChip(e, true)).join('')}</div>` : ''}</details>`;
}
function ipRenderCharacter() {
  const card = IP.card;
  const suggested = suggestPrefaceForCard(card);
  const lex = typeof PREFACE_LEXICON !== 'undefined' ? PREFACE_LEXICON : [];
  const byId = (id) => lex.find((e) => e.id === id);
  const q = normalizeSearch(IP.prefQuery);
  const matches = (e) =>
    !q || normalizeSearch(e.id).includes(q) || normalizeSearch(e.note || '').includes(q);
  const groups = typeof prefaceGroups === 'function' ? prefaceGroups() : {};
  const order = typeof PREFACE_CAT_ORDER !== 'undefined' ? PREFACE_CAT_ORDER : Object.keys(groups);
  let total = 0;
  const cats = order
    .map((cat) => {
      const list = (groups[cat] || []).filter(matches);
      total += list.length;
      if (!list.length) return '';
      // While searching every category with a hit is open, as in the editor.
      if (q)
        return `<section class="ip-pcat ip-pcat-hit"><h4>${typeof prefaceCatGlyphHTML === 'function' ? prefaceCatGlyphHTML(cat, 16) : ''}<span class="ip-pcat-name">${esc(cat)}</span><span class="ip-pcat-count">${list.length}</span></h4><div class="ip-pcat-items">${list.map((e) => ipPrefaceChip(e, true)).join('')}</div></section>`;
      return ipPrefaceCategory(cat, list, IP.pcats.has(cat));
    })
    .join('');
  const recent =
    !q && typeof loadPrefaceRecent === 'function'
      ? loadPrefaceRecent().map(byId).filter(Boolean)
      : [];
  const sug = suggested && suggested !== card.preface ? byId(suggested) : null;
  return `<div class="ip-block"><p class="ip-current"><span class="ip-label">Character</span><strong>${esc(card.preface || 'None')}</strong><span class="ip-muted">${card.prefaceAuto === false ? 'chosen' : 'automatic, from the parts'}</span></p>${card.prefaceAuto === false ? uiButton('ip-auto', 'Back to automatic', 'refresh-cw', 'class="cm-btn cm-btn-outline"') : ''}<p class="ip-help">Picking a character re-derives the parts, tuning, room and chain toward it (the same cascade as the editor). What moved is listed under Your changes.</p>${sug ? `<div class="ip-suggest"><span class="ip-label">Suggested for this sound</span>${ipPrefaceChip(sug, false)}</div>` : ''}<label class="ip-filter cm-search">${icon('search', 16)}<input type="search" id="ip-pref-q" data-ip-key="pref-q" value="${esc(IP.prefQuery)}" placeholder="Search ${lex.length.toLocaleString('en')} characters (bitter, dreamy, haunted…)" aria-label="Search characters"></label><div class="ip-pref-browser" role="group" aria-label="Browse characters by category"><div class="ip-pref-bar"><span class="ip-muted" role="status">${q ? ipCount(total, 'match', 'matches') : `${lex.length.toLocaleString('en')} characters · ${order.length} categories`}</span>${q ? '' : uiButton('ip-pcat-all', 'Expand all', 'chevron-down', 'class="ip-link" data-id="all"') + uiButton('ip-pcat-all', 'Collapse all', 'chevron-right', 'class="ip-link" data-id="none"')}</div>${recent.length ? `<div class="ip-pref-recent"><span class="ip-label">Recently used</span><div class="ip-pcat-items">${recent.map((e) => ipPrefaceChip(e, false)).join('')}</div></div>` : ''}${cats}${q && !total ? `<p class="ip-muted">No character matches “${esc(IP.prefQuery)}”.</p>` : ''}</div></div>`;
}
function ipEnvSource() {
  // The recipe renders ONE environment: the first card that has one
  // (envCardOf, the canonical rule). Say which card that would be.
  const src = envCardOf(app.cards);
  const has = (c) =>
    !!c &&
    (c.tuning ||
      c.room ||
      Object.values(c.chain || {}).some((v) => (Array.isArray(v) ? v.length > 0 : !!v)));
  if (src && has(src))
    return `Your recipe renders one environment, from ${esc(Inst(src.instrumentId)?.name || 'its first instrument')}${src.traditionId ? ' (' + esc(Tradition(src.traditionId)?.name || '') + ')' : ''}. This instrument's settings here render only if it becomes that source.`;
  return 'Your recipe has no environment yet. If this instrument has one, it becomes the environment the recipe renders.';
}
function ipSelect(attr, label, options, value) {
  return `<label class="ip-field ip-field-wide"><span>${esc(label)}</span><select class="cm-select" ${attr} data-ip-key="${esc(attr)}"><option value="">Not set</option>${options
    .map(
      (o) =>
        `<option value="${esc(o.id)}"${o.id === value ? ' selected' : ''}>${esc(o.name)}</option>`
    )
    .join('')}</select></label>`;
}
function ipRenderEnv() {
  const card = IP.card;
  const t = card.tuning ? Tuning(card.tuning) : null,
    r = card.room ? Room(card.room) : null;
  return `<div class="ip-block"><p class="ip-help">${ipEnvSource()}</p>${ipSelect('data-ip-env="tuning"', 'Tuning · ' + TUNINGS.length + ' options', TUNINGS, card.tuning)}${
    t
      ? `<p class="ip-descs">${entryRenderDescs(t)
          .map((d) => `<span class="ip-d">${esc(d)}</span>`)
          .join('')}</p>`
      : ''
  }${ipSelect('data-ip-env="room"', 'Room · ' + ROOMS.length + ' options', ROOMS, card.room)}${
    r
      ? `<p class="ip-descs">${entryRenderDescs(r)
          .map((d) => `<span class="ip-d">${esc(d)}</span>`)
          .join('')}</p>`
      : ''
  }</div>`;
}
function ipRenderChain() {
  const card = IP.card;
  return `<div class="ip-block"><p class="ip-help">${CHAIN_SECTIONS.length} stages, recorded in this order. Effects take any number.</p>${CHAIN_SECTIONS.map(
    (s) => {
      if (!s.multiSelect)
        return ipSelect(`data-ip-chain="${esc(s.id)}"`, s.name, s.items, card.chain[s.id]);
      const on = card.chain[s.id] || [];
      return `<div class="ip-field ip-field-wide"><span>${esc(s.name)} · ${on.length ? on.length + ' chosen' : 'none'}</span><div class="ip-fx">${on
        .map((id) =>
          uiButton(
            'ip-fx-remove',
            ChainItem(s.id, id)?.name || id,
            'x',
            `class="cm-chip" data-id="${esc(id)}" data-stage="${esc(s.id)}" aria-label="Remove ${esc(ChainItem(s.id, id)?.name || id)}"`
          )
        )
        .join(
          ''
        )}</div><select class="cm-select" data-ip-fx="${esc(s.id)}" data-ip-key="fx-add" aria-label="Add an effect"><option value="">Add an effect…</option>${s.items
        .filter((it) => !on.includes(it.id))
        .map((it) => `<option value="${esc(it.id)}">${esc(it.name)}</option>`)
        .join('')}</select></div>`;
    }
  ).join('')}</div>`;
}
function ipRenderOutput() {
  const text = compileStack(IP.card, IP.fmt);
  return `<div class="ip-block"><div class="cm-segmented" role="group" aria-label="Output format">${IP_FORMATS.map(([id, label]) => `<button type="button" data-ui="ip-format" data-id="${id}" aria-pressed="${IP.fmt === id}">${label}</button>`).join('')}</div><p class="ip-help">This instrument on its own, as it would be added. The whole recipe's output is in Your recipe's preview.</p><pre class="ip-out" aria-label="${esc(IP.fmt)} output">${text ? esc(text) : 'Nothing configured yet.'}</pre><div class="ip-out-foot"><span class="ip-muted">${text.length.toLocaleString('en')} characters</span>${uiButton('ip-copy', 'Copy', 'copy', 'class="cm-btn cm-btn-outline"')}</div></div>`;
}
function ipEditKey(e) {
  return e.k === 'part'
    ? 'part:' + e.part
    : e.k === 'chain'
      ? 'chain:' + e.stage
      : e.k === 'auto'
        ? 'preface'
        : e.k;
}
function ipRenderChanges() {
  const changes = ipDiff(IP.base, IP.card);
  const chosen = new Set(ipEdits().map(ipEditKey));
  const mine = changes.filter((c) => chosen.has(c.key)).length;
  const a = ipDescriptors(IP.base),
    b = ipDescriptors(IP.card);
  const added = [...b].filter((d) => !a.has(d)),
    removed = [...a].filter((d) => !b.has(d)),
    kept = [...b].filter((d) => a.has(d));
  const list = (title, arr, cls) =>
    `<div class="ip-review-col"><h4>${title} · ${arr.length}</h4><p>${arr.length ? arr.map((d) => `<span class="ip-d ${cls}">${esc(d)}</span>`).join('') : '<span class="ip-muted">none</span>'}</p></div>`;
  const summary = changes.length
    ? `${mine} chosen${changes.length > mine ? ` · ${changes.length - mine} moved to match` : ''} — ${changes.map((c) => c.label + ': ' + c.to).join(' · ')}`
    : 'None — catalog defaults' + (ipDest() ? ' for ' + ipDestName() : '');
  if (!changes.length)
    return `<div class="ip-changes"><p class="ip-changes-sum"><span class="ip-label">Your changes</span> <span>${esc(summary)}</span></p></div>`;
  return `<details class="ip-changes" data-ip-changes${IP.changesOpen ? ' open' : ''}><summary class="ip-changes-sum"><span class="ip-label">Your changes</span> <span>${esc(summary)}</span></summary><div class="ip-changes-body">${IP.note ? `<p class="ip-note" role="status">${esc(IP.note)}</p>` : ''}<ul class="ip-changes-list">${changes.map((c) => `<li><strong>${esc(c.label)}</strong> ${esc(c.from)} → ${esc(c.to)} <span class="ip-muted">${chosen.has(c.key) ? 'your choice' : 'moved to match'}</span></li>`).join('')}</ul><details class="ip-review"><summary>Review descriptor changes</summary><div class="ip-review-grid">${list('Added', added, 'ip-d-add')}${list('Removed', removed, 'ip-d-lost')}${list('Kept', kept, '')}</div></details>${uiButton('ip-reset', 'Reset to catalog defaults', 'refresh-cw', 'class="ip-link"')}</div></details>`;
}
function ipRenderInspector(focusKey) {
  const host = $ui('instrument-preview');
  if (!host) return;
  const id = UI.instrumentPreview,
    inst = id && Inst(id);
  $ui('ip-root')?.classList.toggle('is-previewing', !!inst);
  if (!inst) {
    host.innerHTML = `<div class="ip-insp-empty">${uiEmptyState({
      title: 'Select an instrument',
      text: 'Choose its parts, character, environment and signal chain here, then add it as configured. “Add” in the list adds catalog defaults.',
    })}</div>`;
    return;
  }
  if (!IP.card || IP.card.instrumentId !== id) {
    host.innerHTML = `<div class="ip-insp-empty">${uiEmptyState({ title: 'Preparing ' + inst.name + '…' })}</div>`;
    return;
  }
  const scroller = host.querySelector('.ip-insp-scroll');
  const scroll = scroller ? scroller.scrollTop : 0;
  const active = focusKey || document.activeElement?.dataset?.ipKey;
  const prev = IP.trail.length > 1 ? Inst(IP.trail[IP.trail.length - 2]) : null;
  const similar = findSimilarInstruments(id, 6);
  const changes = ipDiff(IP.base, IP.card).length;
  const tab = IP.tab;
  // Every panel is rendered; the tabs show one. Hidden panels stay in the
  // document so each setting is addressable (and checked by the inventory).
  const panels = {
    preface: ipRenderCharacter,
    parts: () => ipRenderParts(inst),
    env: ipRenderEnv,
    chain: ipRenderChain,
    stack: ipRenderOutput,
  };
  host.innerHTML = `<div class="ip-insp-scroll"><div class="ip-insp-top">${prev ? uiButton('ip-trail-back', 'Back to ' + prev.name, 'arrow-left', 'class="ip-back"') : ''}<nav class="ip-crumbs" aria-label="Instrument family"><button type="button" class="ip-link" data-ui="instrument-family" data-id="${esc(inst.family)}">${esc(FamName(inst.family))}</button><span aria-hidden="true">›</span><button type="button" class="ip-link" data-ui="ip-class" data-id="${esc(inst.class)}" data-family="${esc(inst.family)}">${esc(ipHuman(inst.class))}</button></nav>${uiButton('close-preview', 'Close', 'x', 'class="cm-btn cm-btn-icon ip-close" aria-label="Close instrument preview" data-tooltip="Close (Esc)"')}</div><div class="ip-hero"><div class="ip-hero-text"><h2 id="ip-title" tabindex="-1">${esc(inst.name)}</h2><p class="ip-muted">${esc(inst.short || '')} · catalog id <code>${esc(inst.id)}</code></p><div class="ip-hero-actions">${listenLink(inst.name, true)}<a class="ip-link" href="#ip-similar" data-ui="ip-similar-jump">Similar instruments ${icon('arrow-right', 14)}</a></div></div><figure class="ip-media">${ipImage(id, 96)}</figure></div>${ipCredit(id) ? `<p class="ip-media-credit">${ipCredit(id, { link: true })}</p>` : ''}<div class="ip-tabs" role="tablist" aria-label="Instrument settings">${IP_TABS.map(([t, label, ic]) => `<button type="button" role="tab" class="cm-tab" id="ip-tab-${t}" data-ui="ip-tab" data-id="${t}" aria-selected="${tab === t}" aria-controls="ip-panel-${t}" tabindex="${tab === t ? 0 : -1}" data-ip-key="tab:${t}">${icon(ic, 16)}<span>${label}</span></button>`).join('')}</div>${IP_TABS.map(([t]) => `<div class="ip-panel" id="ip-panel-${t}" role="tabpanel" aria-labelledby="ip-tab-${t}"${t === tab ? '' : ' hidden'}>${panels[t]()}</div>`).join('')}<section class="ip-similar" id="ip-similar" aria-labelledby="ip-similar-title"><h3 id="ip-similar-title">Similar instruments</h3><p class="ip-help">Closest by sound axes; your recipe and the list stay as they are.</p>${similar
    .map((n) => {
      const shared = getMatchingInstrumentAxes(id, n.id, 2)
        .map((m) => m.axis.name.toLowerCase())
        .join(', ');
      return `<div class="ip-sim"><button type="button" class="ip-sim-main" data-ui="ip-similar" data-id="${esc(n.id)}">${ipImage(n.id, 28)}<span><span class="ip-row-name">${esc(n.name)}</span><span class="ip-row-meta">Closest on ${esc(shared)}</span>${ipCredit(n.id)}</span></button>${listenLink(n.name, true)}${uiButton('instrument-add', 'Add', 'plus', `data-id="${esc(n.id)}" aria-label="Add ${esc(n.name)} with catalog defaults"`)}</div>`;
    })
    .join(
      ''
    )}</section></div><footer class="ip-foot">${ipRenderChanges()}<div class="ip-add-row"><label class="ip-field ip-dest"><span>Add to</span><select id="ip-destination" class="cm-select" data-ip-key="dest" aria-label="Add configured instrument to">${$ui('instrument-destination').innerHTML}</select></label><button type="button" class="cm-btn cm-btn-primary ip-add" data-ui="ip-add-configured" data-ip-key="add">${icon('plus', 18)}<span>${changes ? 'Add configured instrument' : 'Add instrument'}</span></button></div></footer>`;
  $ui('ip-destination').value = ipDest();
  const scroll2 = host.querySelector('.ip-insp-scroll');
  scroll2.scrollTop = scroll;
  for (const input of host.querySelectorAll('[data-ip-filter]')) ipFilterList(input);
  if (active) {
    const el = uiFind('#instrument-preview [data-ip-key]', 'ipKey', active);
    if (el) {
      el.focus({ preventScroll: true });
      if (el.type === 'search') el.setSelectionRange?.(el.value.length, el.value.length);
    }
  }
}
function ipFilterList(input) {
  const key = input.dataset.ipFilter;
  IP.filters[key] = input.value;
  const list = uiFind('#instrument-preview [data-ip-list]', 'ipList', key);
  if (!list) return;
  const q = normalizeSearch(input.value);
  let shown = 0;
  for (const opt of list.children) {
    if (opt.dataset.ipPin) continue;
    const hit = !q || normalizeSearch(opt.dataset.ipText || opt.textContent).includes(q);
    opt.hidden = !hit;
    if (hit) shown++;
  }
  const count = input.parentElement.querySelector('.ip-filter-count');
  if (count) count.textContent = q ? ipCount(shown, 'match', 'matches') : '';
}
function ipOverlay() {
  // Narrow layouts show the inspector over the catalogue.
  const host = $ui('instrument-preview');
  return !!host && getComputedStyle(host).position === 'absolute';
}
function uiCloseInstrumentPreview() {
  const id = UI.instrumentPreview;
  UI.instrumentPreview = null;
  IP.trail = [];
  IP.card = IP.base = null;
  ipRenderInspector();
  renderInstrumentDiscovery();
  uiFocus(uiFind('#instrument-body [data-ui="instrument-inspect"]', 'id', id)) ||
    uiFocus($ui('instrument-search'));
}
function uiInspectInstrument(id, { fromTrail = false, similar = false } = {}) {
  const i = Inst(id);
  if (!i) return;
  if (UI.instrumentPreview !== id) {
    // The first part starts open, as in the reference; the rest on demand.
    IP.open = new Set(i.parts?.length ? [i.parts[0].id] : []);
    IP.more.clear();
    IP.filters = {};
    IP.note = '';
    IP.prefQuery = '';
  }
  // Similar instruments build a trail the inspector can step back through;
  // choosing from the list, a genre or a deep link starts a new one.
  if (similar) {
    if (IP.trail[IP.trail.length - 1] !== id) IP.trail.push(id);
  } else if (!fromTrail) IP.trail = [id];
  UI.instrumentPreview = id;
  IP.card = IP.base = null;
  if (UI.view !== 'instrument') uiNavigate('instrument', { push: true });
  renderInstrumentDiscovery();
  ipRenderInspector();
  ipRebuild().then(() => {
    if (UI.instrumentPreview === id) uiFocus($ui('ip-title'));
  });
}
async function ipAddConfigured() {
  const id = UI.instrumentPreview,
    card = IP.card;
  if (!id || !card) return;
  const configured = ipDiff(IP.base, card);
  const dest = ipDest();
  const name = Inst(id).short || Inst(id).name;
  // The canonical add (same destination, seeding, busy guard and editor
  // opening), with the preview's configuration applied to the new card before
  // its history entry: one addition, one Undo.
  const added = await uiAddInstrument(id, {
    configure: configured.length
      ? (c) => {
          c.parts = { ...card.parts };
          c.pinnedParts = [...(card.pinnedParts || [])];
          c.preface = card.preface;
          c.prefaceAuto = card.prefaceAuto;
          c.tuning = card.tuning;
          c.room = card.room;
          c.chain = JSON.parse(JSON.stringify(card.chain));
        }
      : undefined,
    message: (c) =>
      `Added ${name}${dest ? ' to ' + (Tradition(c.traditionId)?.name || ipDestName(dest)) : ''}` +
      (configured.length
        ? ` with ${ipCount(configured.length, 'changed setting')}. Undo removes it.`
        : ' with catalog defaults.'),
  });
  if (added) renderInstrumentDiscovery();
}

uiRegisterPage({
  id: 'instrument',
  recipe: 'dock',
  // Height-aware: the shell's compact 220px on short screens, growing with
  // the window to 320px, where the recipe rows have room to be read.
  dockHeight: 'clamp(220px, 24vh, 320px)',
  mount(surface) {
    IP.view = UILayout.remember('instrument-view', 'list', () => renderInstrumentDiscovery());
    surface.innerHTML = `<div class="ip" id="ip-root"><header class="ip-head"><h1 class="ip-title">Instruments <span id="ip-total" class="ip-total"></span></h1><label class="cm-search ip-search">${icon('search', 20)}<input id="instrument-search" type="search" placeholder="Search instruments" aria-label="Search instruments"></label><label class="ip-field destination"><span>Add to</span><select id="instrument-destination" class="cm-select" aria-label="Add instrument to"></select></label></header><div id="instrument-body" class="ip-body"></div><aside id="instrument-preview" class="ip-inspector" aria-label="Instrument preview"></aside></div>`;
    $ui('instrument-search').addEventListener('input', () => {
      UI.limit = 50;
      renderInstrumentDiscovery();
    });
    surface.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'ip-sort') {
        IP.sort = t.value;
        renderInstrumentDiscovery();
      } else if (t.id === 'instrument-destination' || t.id === 'ip-destination') {
        $ui('instrument-destination').value = t.value;
        app._addToTradition = null;
        if ($ui('ip-destination')) $ui('ip-destination').value = t.value;
        renderInstrumentDiscovery();
        if (UI.instrumentPreview) ipRebuild();
      } else if (t.dataset.ipPart != null) {
        ipChoose({ k: 'part', part: t.dataset.ipPart, v: t.value || null }, t.dataset.ipKey);
      } else if (t.dataset.ipEnv) {
        ipChoose({ k: t.dataset.ipEnv, v: t.value || null }, t.dataset.ipKey);
      } else if (t.dataset.ipChain) {
        ipChoose({ k: 'chain', stage: t.dataset.ipChain, v: t.value || null }, t.dataset.ipKey);
      } else if (t.dataset.ipFx && t.value) {
        const on = IP.card.chain[t.dataset.ipFx] || [];
        ipChoose({ k: 'chain', stage: t.dataset.ipFx, v: [...on, t.value] }, 'fx-add');
      }
    });
    surface.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.ipFilter) ipFilterList(t);
      else if (t.id === 'ip-pref-q') {
        IP.prefQuery = t.value;
        ipRenderInspector('pref-q');
      }
    });
    // Destinations follow the recipe: refresh them when a select is opened.
    surface.addEventListener('focusin', (e) => {
      if (e.target.id === 'instrument-destination' || e.target.id === 'ip-destination') {
        const value = e.target.value;
        if (ipSyncDestination() && UI.instrumentPreview) ipRebuild();
        e.target.value = $ui('instrument-destination').value || value;
      }
    });
    // <details> toggles do not bubble; listen in the capture phase.
    surface.addEventListener(
      'toggle',
      (e) => {
        const d = e.target;
        if (d.dataset?.ipChanges != null) IP.changesOpen = d.open;
        else if (d.dataset?.ipPcat) {
          const cat = d.dataset.ipPcat;
          if (d.open && !IP.pcats.has(cat)) {
            IP.pcats.add(cat);
            const list = prefaceGroups()[cat] || [];
            d.insertAdjacentHTML(
              'beforeend',
              `<div class="ip-pcat-items">${list.map((e) => ipPrefaceChip(e, true)).join('')}</div>`
            );
          } else if (!d.open) {
            IP.pcats.delete(cat);
            d.querySelector('.ip-pcat-items')?.remove();
          }
        } else if (d.dataset?.ipProp) {
          if (d.open) IP.props.add(d.dataset.ipProp);
          else IP.props.delete(d.dataset.ipProp);
        } else if (d.dataset?.ipMore) {
          const pid = d.dataset.ipMore;
          if (d.open && !IP.more.has(pid)) {
            IP.more.add(pid);
            const inst = Inst(UI.instrumentPreview),
              part = inst.parts.find((p) => p.id === pid);
            const cur = IP.card.parts[pid] ? Variant(inst, pid, IP.card.parts[pid]) : null;
            d.insertAdjacentHTML(
              'beforeend',
              ipRenderMore(
                inst,
                part,
                part.variants.filter((v) => v.expanded),
                cur
              )
            );
          } else if (!d.open) IP.more.delete(pid);
        }
      },
      true
    );
    // A photograph that fails to load becomes the catalog glyph, and its credit
    // goes with it; the id is remembered so a re-render does not bring either back.
    surface.addEventListener(
      'error',
      (e) => {
        const img = e.target;
        if (img.tagName !== 'IMG' || !img.dataset.ipFallback) return;
        const id = img.dataset.ipFallback;
        IP.failed.add(id);
        for (const el of surface.querySelectorAll('.ip-credit')) {
          if (el.dataset.ipFor === id) el.remove();
        }
        for (const el of surface.querySelectorAll('img.ip-photo')) {
          if (el.dataset.ipFallback === id)
            el.outerHTML = `<span class="ip-glyph">${image(id, +el.dataset.ipSize || 32)}</span>`;
        }
      },
      true
    );
    // Tabs: arrow keys move between them (WAI-ARIA tabs pattern).
    surface.addEventListener('keydown', (e) => {
      const tab = e.target.closest?.('[role="tab"][data-ui="ip-tab"]');
      if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const ids = IP_TABS.map((t) => t[0]);
      let i = ids.indexOf(tab.dataset.id);
      i =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? ids.length - 1
            : (i + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
      IP.tab = ids[i];
      ipRenderInspector('tab:' + ids[i]);
    });
    ipLoadManifest();
    ipRenderInspector();
  },
  render() {
    renderInstrumentDiscovery();
    if (UI.instrumentPreview && !IP.card) ipRebuild();
    else ipRenderInspector();
  },
  layout() {
    const root = $ui('ip-root');
    UILayout.splitter({
      container: root,
      panel: $ui('instrument-preview'),
      key: 'instrument-inspector',
      property: '--ip-inspector-width',
      title: 'Resize instrument preview',
      side: 'left',
      limits: () => [320, Math.max(320, Math.min(640, root.clientWidth * 0.5))],
      enabled: () => UI.view === 'instrument' && !ipOverlay(),
    });
  },
  escape() {
    if (UI.instrumentPreview) uiCloseInstrumentPreview();
  },
  actions: {
    'instrument-family'(id) {
      UI.instrumentFamily = id;
      UI.instrumentClass = '';
      UI.limit = 50;
      renderInstrumentDiscovery();
    },
    'instrument-class'(id) {
      UI.instrumentClass = id;
      UI.limit = 50;
      renderInstrumentDiscovery();
    },
    'instrument-class-all'() {
      UI.instrumentClass = '';
      UI.limit = 50;
      renderInstrumentDiscovery();
    },
    'ip-class'(id, button) {
      UI.instrumentFamily = button.dataset.family;
      UI.instrumentClass = id;
      UI.limit = 50;
      renderInstrumentDiscovery();
    },
    'instrument-back'() {
      if (UI.instrumentClass) UI.instrumentClass = '';
      else UI.instrumentFamily = '';
      renderInstrumentDiscovery();
    },
    'instrument-filter'(id, button, event) {
      // A checkbox has already toggled itself; the set is the state of record.
      if (button.type === 'checkbox') event.preventDefault?.();
      app.instrumentAxisFilters.has(id)
        ? app.instrumentAxisFilters.delete(id)
        : app.instrumentAxisFilters.add(id);
      UI.limit = 50;
      renderInstrumentDiscovery();
      uiFocus(uiFind('#instrument-body [data-ui="instrument-filter"][type="checkbox"]', 'id', id));
    },
    'clear-filters'() {
      app.instrumentAxisFilters.clear();
      renderInstrumentDiscovery();
      uiFocus($ui('instrument-search'));
    },
    'instrument-inspect'(id) {
      uiInspectInstrument(id);
    },
    'ip-similar'(id) {
      uiInspectInstrument(id, { similar: true });
    },
    'close-preview'() {
      uiCloseInstrumentPreview();
    },
    'instrument-clear-search'() {
      $ui('instrument-search').value = '';
      UI.limit = 50;
      renderInstrumentDiscovery();
      $ui('instrument-search').focus();
    },
    'instrument-all'() {
      UI.instrumentFamily = '';
      UI.instrumentClass = '';
      UI.limit = 50;
      renderInstrumentDiscovery();
    },
    'ip-cats'() {
      IP.catsOpen = !IP.catsOpen;
      renderInstrumentDiscovery();
      uiFocus(document.querySelector('[data-ui="ip-cats"]'));
    },
    'ip-view'(id) {
      IP.view.set(id);
      renderInstrumentDiscovery();
      uiFocus(uiFind('[data-ui="ip-view"]', 'id', id));
    },
    'ip-tab'(id) {
      IP.tab = id;
      ipRenderInspector('tab:' + id);
    },
    'ip-part'(id) {
      if (IP.open.has(id)) IP.open.delete(id);
      else IP.open.add(id);
      ipRenderInspector('part:' + id);
    },
    'ip-preface'(id) {
      if (typeof recordPrefaceRecent === 'function') recordPrefaceRecent(id);
      ipChoose({ k: 'preface', id }, 'pref-q');
    },
    'ip-pcat-all'(id) {
      IP.pcats = new Set(id === 'all' ? PREFACE_CAT_ORDER : []);
      ipRenderInspector();
      uiFocus(uiFind('#instrument-preview [data-ui="ip-pcat-all"]', 'id', id));
    },
    'ip-auto'() {
      ipChoose({ k: 'auto' }, 'pref-q');
    },
    'ip-fx-remove'(id, button) {
      const stage = button.dataset.stage;
      ipChoose(
        { k: 'chain', stage, v: (IP.card.chain[stage] || []).filter((x) => x !== id) },
        'fx-add'
      );
    },
    'ip-format'(id) {
      IP.fmt = id;
      ipRenderInspector();
      uiFocus(uiFind('[data-ui="ip-format"]', 'id', id));
    },
    'ip-copy'() {
      copyToClipboard(
        compileStack(IP.card, IP.fmt),
        'Copied',
        'Copy failed — select the text instead'
      );
    },
    'ip-reset'() {
      IP.edits.set(UI.instrumentPreview, []);
      IP.note = '';
      ipRebuild().then(() => uiFocus(document.querySelector('[data-ui="ip-add-configured"]')));
    },
    'ip-trail-back'() {
      IP.trail.pop();
      uiInspectInstrument(IP.trail[IP.trail.length - 1], { fromTrail: true });
    },
    'ip-similar-jump'(id, button, event) {
      event.preventDefault();
      const el = $ui('ip-similar');
      el?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      uiFocus(el?.querySelector('button'));
    },
    async 'ip-add-configured'() {
      await ipAddConfigured();
    },
  },
});
