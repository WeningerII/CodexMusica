/* exported renderInstrumentDiscovery, uiInspectInstrument */
/* global $ui, FamName, INSTRUMENT_FILTER_PILLS, Inst, Tradition, UI, app, esc, familyImage, findSimilarInstruments, icon, image, listenLink, normalizeSearch, passesInstrumentFilter, uiButton, uiNavigate, uiRegisterPage */
/* Instrument page. Owned by the Instrument page worker; see docs/ui-foundation.md.
   Adding to the recipe goes through the shell command uiAddInstrument
   (data-ui="instrument-add"); the editor and recipe panel are shared. */
'use strict';
function renderInstrumentDiscovery() {
  const host = $ui('instrument-body');
  if (!host) return;
  const q = normalizeSearch($ui('instrument-search').value),
    fam = INSTRUMENT_FAMILIES.find((f) => f.id === UI.instrumentFamily);
  const filtered = INSTRUMENTS.filter(
    (i) =>
      (!UI.instrumentFamily || i.family === UI.instrumentFamily) &&
      (!UI.instrumentClass || i.class === UI.instrumentClass) &&
      (!q || normalizeSearch(i.name + ' ' + i.short).includes(q)) &&
      passesInstrumentFilter(i, app.instrumentAxisFilters)
  )
    // INSTRUMENTS is sorted globally by family, then by the `short` label — but
    // this list shows `name`, so it read as scrambled. Sort the rows by what
    // the row displays; family and class navigation still group on the left.
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  const classes = fam
    ? [...new Set(INSTRUMENTS.filter((i) => i.family === fam.id).map((i) => i.class))]
    : [];
  const sectors = fam
    ? classes.map((c) => ({
        id: c,
        name: c.replaceAll('_', ' '),
      }))
    : INSTRUMENT_FAMILIES.map((f) => ({
        id: f.id,
        name: f.name,
      }));
  const dest = $ui('instrument-destination'),
    old = app._addToTradition || dest.value;
  dest.innerHTML =
    '<option value="">Independent instrument</option>' +
    [...new Set(app.cards.map((c) => c.traditionId).filter(Boolean))]
      .map((id) => `<option value="${esc(id)}">${esc(Tradition(id)?.name || id)}</option>`)
      .join('');
  dest.value = old || '';
  host.innerHTML = `<div class="axis-filter-pills">${INSTRUMENT_FILTER_PILLS.map((p) => `<button class="${app.instrumentAxisFilters.has(p.id) ? 'active' : ''}" data-ui="instrument-filter" data-id="${esc(p.id)}" aria-pressed="${app.instrumentAxisFilters.has(p.id)}">${esc(p.label)}</button>`).join('')}${app.instrumentAxisFilters.size ? uiButton('clear-filters', 'Clear filters', 'x') : ''}</div><div class="discovery-grid"><nav class="catalog-categories" aria-label="Instrument categories">${fam ? `<div class="category-heading">${uiButton('instrument-back', UI.instrumentClass ? 'Back to ' + fam.name : 'All instruments', 'arrow-left')}<strong>${esc(UI.instrumentClass ? UI.instrumentClass.replaceAll('_', ' ') : fam.name)}</strong></div>` : ''}<div class="branch-key">${sectors.map((s) => `<button data-ui="${fam ? 'instrument-class' : 'instrument-family'}" data-id="${esc(s.id)}"${fam ? ` aria-pressed="${UI.instrumentClass === s.id}"` : ''}>${!fam ? familyImage(s.id, 24) : ''}<span>${esc(s.name)}</span></button>`).join('')}</div></nav><div class="catalog-list"><div class="catalog-count">${filtered.length} instruments${UI.instrumentClass ? ' · ' + esc(UI.instrumentClass.replaceAll('_', ' ')) : ''}</div>${filtered
    .slice(0, UI.limit)
    .map(
      (i) =>
        `<div class="catalog-row"><button class="catalog-name" data-ui="instrument-inspect" data-id="${esc(i.id)}">${image(i.id, 30)}<span>${esc(i.name)}</span></button>${listenLink(i.name, true)}${uiButton('instrument-add', 'Add', 'plus', `data-id="${esc(i.id)}" aria-label="Add ${esc(i.name)}"`)}</div>`
    )
    .join(
      ''
    )}${filtered.length > UI.limit ? uiButton('more', 'Show more', 'chevron-down') : ''}${!filtered.length ? '<p>No instruments match these filters.</p>' : ''}</div></div>`;
}
function uiInspectInstrument(id) {
  const i = Inst(id);
  if (!i) return;
  $ui('instrument-preview').hidden = false;
  $ui('instrument-preview').innerHTML =
    `<div class="selected-head">${image(id, 36)}<h2>${esc(i.name)}</h2>${listenLink(i.name, true)}${uiButton('instrument-add', 'Add instrument', 'plus', `data-id="${esc(id)}"`)}${uiButton('close-preview', 'Close', 'x')}</div><p>${esc(FamName(i.family))} · ${(i.parts || []).length} customizable parts</p><div class="part-preview">${(
      i.parts || []
    )
      .map(
        (p) =>
          `<details><summary>${esc(p.name || p.id)} · ${p.variants.length} options</summary><p>${p.variants
            .slice(0, 20)
            .map((v) => esc(v.name || v.id))
            .join(' · ')}</p></details>`
      )
      .join('')}</div><h3>Similar instruments</h3>${findSimilarInstruments(id, 8)
      .map(
        (n) =>
          `<div class="catalog-row"><button data-ui="instrument-inspect" data-id="${esc(n.id)}">${image(n.id, 24)}${esc(n.name)}</button>${listenLink(n.name, true)}${uiButton('instrument-add', 'Add', 'plus', `data-id="${esc(n.id)}"`)}</div>`
      )
      .join('')}`;
  uiNavigate('instrument');
  $ui('instrument-preview').scrollIntoView({ block: 'start', behavior: 'smooth' });
}
uiRegisterPage({
  id: 'instrument',
  mount(surface) {
    surface.innerHTML = `<div class="discovery-toolbar"><label class="ui-search">${icon('search', 20)}<input id="instrument-search" type="search" placeholder="Search instruments" aria-label="Search instruments"></label><label class="destination">Add to<select id="instrument-destination" aria-label="Add instrument to"></select></label></div><div id="instrument-preview" hidden></div><div id="instrument-body"></div>`;
    $ui('instrument-search').addEventListener('input', () => {
      UI.limit = 50;
      renderInstrumentDiscovery();
    });
  },
  render: renderInstrumentDiscovery,
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
    'instrument-back'() {
      if (UI.instrumentClass) UI.instrumentClass = '';
      else UI.instrumentFamily = '';
      renderInstrumentDiscovery();
    },
    'instrument-filter'(id) {
      app.instrumentAxisFilters.has(id)
        ? app.instrumentAxisFilters.delete(id)
        : app.instrumentAxisFilters.add(id);
      renderInstrumentDiscovery();
    },
    'clear-filters'() {
      app.instrumentAxisFilters.clear();
      renderInstrumentDiscovery();
    },
    'instrument-inspect'(id) {
      uiInspectInstrument(id);
    },
    'close-preview'() {
      $ui('instrument-preview').hidden = true;
    },
  },
});
