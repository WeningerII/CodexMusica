/* exported renderGenreDiscovery, renderGenreWeb */
/* global $ui, Catalog, Inst, STARTER_TRADITIONS, Tradition, UI, UILayout, _addedInstrumentMessage, _determinePrimaryCard, addInstrumentFromPicker, app, axisLabel, esc, findSimilar, getMatchingAxes, getRoots, getTreeNode, icon, image, listenLink, normalizeSearch, renderAll, renderTradPicker, showToast, tradParent, traditionGlyphsHTML, uiButton, uiEmptyState, uiFind, uiFocus, uiNavigate, uiOpenEditor, uiRegisterPage */
/* Genre page. Owned by the Genre page worker; see docs/ui-foundation.md.
   Shared state, recipe commands (genre-add, instrument-add), navigation and
   theming belong to the shell in src/workbench.js and src/theme.css.

   Layout: a Browse column (the 25 taxonomy roots, the branch you are in, and
   Find a sound) beside the catalogue (Start exploring / All genres, List or
   Grid). A genre's details open in place — inside its row, or at the top when
   it is not in the list you are looking at — with five tabs: Overview, Sound
   profile, Instruments, Similar sounds and Background. Your recipe is the
   shell's sidebar. Everything shown is read from the catalog: names, counts,
   the 13 sound characteristics, rosters, cross-references, exemplars. */
'use strict';

// Page-private state. UI.genre (the open genre) and UI.genreNode (the branch)
// are the shell-visible part; everything else lives here.
const G = {
  tab: 'start', // 'start' | 'all'
  detailTab: 'overview',
  featureClosed: false, // the Start exploring feature has been closed
  targets: {}, // axis id -> -2..2, only the applied characteristics
  allAxes: false, // Find a sound shows all 13, not just the first three
  allRoots: false, // Browse shows all 25 roots, not just the first ten
  browseOpen: false, // below 900px the Browse column is a disclosure
  instDest: {}, // genre id -> destination for single instruments from its roster
  listScroll: null, // list position before a pinned detail opened
  origin: null, // the list row a chain of details was opened from
  view: null, // UILayout.remember('genre-view') — 'list' | 'grid'
  members: null, // taxonomy membership, computed once from the catalog
  sorted: null, // the catalog sorted by name, computed once
  geo: null, // data/atlas-geo.json coords, when it can be read
  images: null, // references/_image_manifest.json, when it exists
};
const GP_FEATURED_AXES = ['soundTech', 'density', 'voice'];
const GP_ROOTS_SHOWN = 10;
const GP_TABS = [
  ['overview', 'Overview'],
  ['sound', 'Sound profile'],
  ['instruments', 'Instruments'],
  ['similar', 'Similar sounds'],
  ['background', 'Background'],
];

// ── Catalog helpers ──────────────────────────────────────────────────────
function gpCatalogSize() {
  return Catalog.all().length;
}
// Every taxonomy node a tradition belongs to: its primary parent and that
// parent's ancestors, plus every cross-reference and its ancestors. Counts and
// branch filtering read the same sets, so a count always equals its list.
function gpMembership() {
  if (G.members) return G.members;
  const chains = new Map();
  const chain = (nid) => {
    if (!nid) return [];
    if (chains.has(nid)) return chains.get(nid);
    const out = [],
      seen = new Set();
    for (let p = nid; p && !seen.has(p); ) {
      seen.add(p);
      const node = getTreeNode(p);
      if (!node) break;
      out.push(p);
      p = node.parent;
    }
    chains.set(nid, out);
    return out;
  };
  const byTrad = new Map(),
    count = new Map(),
    cross = new Map();
  for (const t of Catalog.all()) {
    const primary = new Set(chain(tradParent(t.id)));
    const all = new Set(primary);
    for (const x of Catalog.ext(t.id)?.crossRefs || []) for (const n of chain(x)) all.add(n);
    byTrad.set(t.id, { primary, all });
    for (const n of all) {
      count.set(n, (count.get(n) || 0) + 1);
      if (!primary.has(n)) cross.set(n, (cross.get(n) || 0) + 1);
    }
  }
  const members = { byTrad, count, cross };
  if (Catalog.all().length) G.members = members;
  return members;
}
function gpSorted() {
  if (G.sorted && G.sorted.length === gpCatalogSize()) return G.sorted;
  G.sorted = Catalog.all()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return G.sorted;
}
// The classification path of a tradition: root … parent, as tree nodes.
function gpPath(id) {
  const out = [];
  const seen = new Set();
  for (let p = tradParent(id); p && !seen.has(p); ) {
    seen.add(p);
    const node = getTreeNode(p);
    if (!node) break;
    out.unshift(node);
    p = node.parent;
  }
  return out;
}
// One or two sentences of the catalog description, for rows and headers.
function gpLede(id, max = 170) {
  const text = (Catalog.ext(id)?.description || '').trim();
  if (!text) return '';
  const first = text.match(/^.+?[.!?](?=\s|$)/)?.[0] || text;
  if (first.length <= max) return first;
  return first.slice(0, first.lastIndexOf(' ', max - 1)).replace(/[,;:(]$/, '') + '…';
}
function gpRecipeCount(id) {
  return app.cards.filter((c) => c.traditionId === id).length;
}
function gpRecipeGenres() {
  return [...new Set(app.cards.map((c) => c.traditionId).filter(Boolean))];
}
// The strongest characteristics of a genre as words, strongest first.
function gpSoundWords(id, n = 4) {
  const axes = Catalog.ext(id)?.axes || {};
  return AXIS_DEFINITIONS.map((ax) => ({ ax, v: axes[ax.id] ?? 0 }))
    .filter((x) => x.v !== 0)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, n)
    .map((x) => axisLabel(x.ax, x.v));
}

// ── Optional data: the map's place names and licensed images ─────────────
// Both are read lazily and are never required: without them the page shows
// glyphs and leaves the place out. Nothing is invented to fill the gap.
function gpLoadOptional() {
  if (!/^https?:$/.test(location.protocol) || typeof fetch !== 'function') return;
  const get = (url) =>
    Promise.resolve()
      .then(() => fetch(url))
      .then((r) => (r.ok ? r.json() : null));
  if (G.geo === null) {
    G.geo = false;
    get('data/atlas-geo.json')
      .then((g) => {
        if (g?.coords) {
          G.geo = g.coords;
          gpRefreshDetail();
        }
      })
      .catch(() => {});
  }
  if (G.images === null) {
    // PR #389's manifest. Absent (404) or unreadable, the glyphs stay: one
    // request per page load, and no error is raised for a missing file.
    G.images = false;
    get('references/_image_manifest.json')
      .then((m) => {
        const images = gpIndexImages(m);
        if (!images) return;
        G.images = images;
        if (UI.view === 'genre') renderGenreDiscovery();
      })
      .catch(() => {});
  }
}
// { images: [{ id, kind, thumb_url, credit, license, license_raw, source_page }] }
// → the tradition entries by id, or null when there are none.
function gpIndexImages(m) {
  if (!m || !Array.isArray(m.images)) return null;
  const out = Object.create(null);
  let n = 0;
  for (const e of m.images)
    if (e && e.kind === 'tradition' && typeof e.id === 'string' && Tradition(e.id)) {
      out[e.id] = e;
      n++;
    }
  return n ? out : null;
}
function gpPlace(id) {
  const c = G.geo && G.geo[id];
  return c ? [c[2], c[3]].filter(Boolean).join(', ') : '';
}
// A manifest image for a tradition, or null. Only https or page-relative
// URLs; the credit and licence travel with every image shown.
function gpImage(id) {
  const e = G.images && G.images[id];
  if (!e) return null;
  const src = e.thumb_url;
  if (typeof src !== 'string' || !src.trim()) return null;
  if (!/^https:\/\//i.test(src) && (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')))
    return null;
  const text = (x) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '');
  const credit = text(e.credit) || 'Author not recorded';
  const licence = text(e.license_raw) || text(e.license) || 'licence not recorded';
  return {
    src,
    credit: `Photo: ${credit} · ${licence}`,
    href:
      typeof e.source_page === 'string' && /^https:\/\//i.test(e.source_page) ? e.source_page : '',
  };
}
function gpMedia(id, size) {
  const img = gpImage(id);
  const glyph = `<span class="gp-glyph">${traditionGlyphsHTML(id, size)}</span>`;
  if (!img)
    return {
      html: `<span class="gp-media gp-media-glyph" aria-hidden="true">${glyph}</span>`,
      credit: '',
    };
  return {
    html: `<span class="gp-media"><img class="gp-img" src="${esc(img.src)}" alt="" loading="lazy" decoding="async">${glyph}</span>`,
    credit: img.credit,
    href: img.href,
  };
}
// Inside a row's button the credit is text only (no link inside a button).
function gpCreditText(m) {
  return m.credit
    ? `<span class="gp-credit" title="${esc(m.credit)}">${icon('info', 12)}<span>${esc(m.credit)}</span></span>`
    : '';
}
function gpCredit(m) {
  if (!m.credit) return '';
  return `<span class="gp-credit">${icon('info', 12)}${m.href ? `<a href="${esc(m.href)}" target="_blank" rel="noopener noreferrer" title="The image's source page (opens in a new tab)">${esc(m.credit)}</a>` : `<span>${esc(m.credit)}</span>`}</span>`;
}

// ── Results: search, branch and sound targets, composed ─────────────────
function gpQuery() {
  return normalizeSearch($ui('genre-search')?.value || '');
}
function gpTargets() {
  return Object.entries(G.targets);
}
// The All genres list. Search ranks exact name, name prefix, name, then
// lineage/description (the tree picker's order); the branch keeps members,
// cross-listed ones included; sound targets keep genres within one step of
// every target and rank by total distance — the engine's --axis-target rule.
function gpResults() {
  const q = gpQuery();
  let rows;
  if (q) {
    rows = [];
    for (const e of Catalog.searchIndex()) {
      const rank =
        e.name === q
          ? 0
          : e.name.startsWith(q)
            ? 1
            : e.name.includes(q)
              ? 2
              : e.lineage.includes(q) || e.description.includes(q)
                ? 3
                : -1;
      if (rank >= 0) rows.push({ t: e.t, rank });
    }
  } else rows = gpSorted().map((t) => ({ t, rank: 0 }));
  if (UI.genreNode) {
    const m = gpMembership().byTrad;
    rows = rows.filter((r) => m.get(r.t.id)?.all.has(UI.genreNode));
  }
  const targets = gpTargets();
  if (targets.length) {
    rows = rows
      .map((r) => {
        const axes = Catalog.ext(r.t.id)?.axes || {};
        let dist = 0,
          exact = 0,
          within = true;
        for (const [k, v] of targets) {
          const d = Math.abs((axes[k] ?? 0) - v);
          dist += d;
          if (d === 0) exact++;
          if (d > 1) within = false;
        }
        return Object.assign(r, { dist, exact, within });
      })
      .filter((r) => r.within);
  }
  const byName = (a, b) => a.t.name.localeCompare(b.t.name, 'en', { sensitivity: 'base' });
  rows.sort(
    (a, b) =>
      (targets.length ? a.dist - b.dist : 0) ||
      a.rank - b.rank ||
      (q && a.rank > 0 ? a.t.name.length - b.t.name.length : 0) ||
      byName(a, b)
  );
  return rows;
}

// ── Rows and cards ───────────────────────────────────────────────────────
function gpRow(t, extra = '') {
  const id = t.id,
    n = gpRecipeCount(id),
    m = gpMedia(id, 30),
    branch = gpPath(id).slice(-1)[0]?.name || '',
    lede = gpLede(id);
  return `<div class="catalog-row gp-row" data-gp-id="${esc(id)}"><button type="button" class="catalog-name gp-open" data-ui="genre-select" data-id="${esc(id)}" aria-expanded="false" aria-label="${esc(t.name)} — show details">${m.html}<span class="gp-row-text"><span class="gp-row-name">${esc(t.name)}</span><span class="gp-row-meta">${esc(branch)}${n ? `<span class="gp-in-recipe">${icon('check', 12)}In recipe</span>` : ''}</span>${lede ? `<span class="gp-row-desc">${esc(lede)}</span>` : ''}${extra}${gpCreditText(m)}</span></button>${listenLink(t.name)}${uiButton('genre-add', n ? 'Add again' : 'Add to recipe', 'plus', `data-id="${esc(id)}" aria-label="Add ${esc(t.name)}"`)}<span class="gp-chevron" aria-hidden="true">${icon('chevron-right', 20)}</span></div>`;
}
// Why a row is in a sound-target result: how close it is on the targets.
function gpTargetReason(r) {
  const n = gpTargets().length;
  return `<span class="gp-row-reason">${icon('sliders-horizontal', 12)}${r.exact === n ? (n === 1 ? 'Matches the target' : `Matches all ${n} targets`) : `Exact on ${r.exact} of ${n} · within one step on the rest`}</span>`;
}
function gpLayout() {
  return G.view?.get() === 'grid' ? 'grid' : 'list';
}
function gpList(items, open, reason) {
  return `<div class="gp-items gp-${gpLayout()}" role="list">${items
    .map((r) => {
      const html = r.t.id === open ? gpDetail(r.t.id) : gpRow(r.t, reason ? reason(r) : '');
      return `<div role="listitem" class="gp-item${r.t.id === open ? ' gp-item-open' : ''}">${html}</div>`;
    })
    .join('')}</div>`;
}

// ── Detail ───────────────────────────────────────────────────────────────
function gpDetail(id) {
  const t = Tradition(id);
  if (!t) return '';
  const ext = Catalog.ext(id) || {},
    n = gpRecipeCount(id),
    insts = t.instruments || [],
    m = gpMedia(id, 44),
    place = gpPlace(id),
    path = gpPath(id),
    tab = GP_TABS.some(([k]) => k === G.detailTab) ? G.detailTab : 'overview';
  const crumbs = path
    .map(
      (node) =>
        `<button type="button" class="gp-link" data-ui="genre-branch" data-id="${esc(node.id)}">${esc(node.name)}</button>`
    )
    .join(`<span class="gp-sep" aria-hidden="true">${icon('chevron-right', 12)}</span>`);
  const add = n
    ? `<span class="cm-status gp-status" data-tone="success">${icon('check', 16)}<span>In recipe</span></span>${uiButton('genre-add', 'Add again', 'plus', `class="cm-btn cm-btn-outline" data-id="${esc(id)}" aria-label="Add ${esc(t.name)} again" data-tooltip="Adds the whole ensemble a second time. Undo removes it."`)}`
    : uiButton(
        'genre-add',
        'Add to recipe',
        'plus',
        `class="cm-btn cm-btn-primary" data-id="${esc(id)}" aria-label="Add ${esc(t.name)} to Your recipe"`
      );
  const summary = n
    ? `${n} instrument${n === 1 ? '' : 's'} from ${esc(t.name)} in Your recipe`
    : `Adds its ${insts.length}-instrument ensemble`;
  const panel = (key, html) =>
    `<div class="gp-panel" role="tabpanel" id="gp-panel-${key}" aria-labelledby="gp-tab-${key}"${key === tab ? '' : ' hidden'}>${html}</div>`;
  return `<article class="gp-detail" id="genre-detail" data-gp-id="${esc(id)}" aria-labelledby="gp-detail-title"><div class="gp-detail-head">${m.html}<div class="gp-detail-id"><h2 id="gp-detail-title" tabindex="-1">${esc(t.name)}</h2>${place ? `<div class="gp-detail-place">${icon('map-pin', 14)}<span>${esc(place)}</span></div>` : ''}${crumbs ? `<nav class="gp-crumbs" aria-label="Classification of ${esc(t.name)}">${crumbs}</nav>` : ''}${gpCredit(m)}</div><div class="gp-detail-actions">${listenLink(t.name)}${add}${uiButton('genre-close', 'Close', 'x', `class="cm-btn cm-btn-icon gp-close" aria-label="Close ${esc(t.name)} details" data-tooltip="Close details (Esc)"`)}</div><p class="gp-detail-count">${summary}</p>${gpLede(id, 260) ? `<p class="gp-lede">${esc(gpLede(id, 260))}</p>` : ''}</div><div class="gp-tabs" role="tablist" aria-label="${esc(t.name)} details">${GP_TABS.map(
    ([k, label]) =>
      `<button type="button" role="tab" class="cm-tab" id="gp-tab-${k}" data-ui="genre-tab" data-id="${k}" aria-controls="gp-panel-${k}" aria-selected="${k === tab}" tabindex="${k === tab ? 0 : -1}">${esc(label)}${k === 'instruments' ? `<span class="gp-tab-count">${insts.length}</span>` : ''}</button>`
  ).join(
    ''
  )}</div>${panel('overview', gpOverview(id, t, ext))}${panel('sound', gpSoundProfile(id, ext))}${panel('instruments', gpInstruments(id, t))}${panel('similar', gpSimilar(id))}${panel('background', gpBackground(id, t, ext))}</article>`;
}
function gpOverview(id, t, ext) {
  const insts = t.instruments || [];
  const shown = insts.slice(0, 6);
  const words = gpSoundWords(id);
  const cross = (ext.crossRefs || []).filter((x) => getTreeNode(x));
  return `<div class="gp-overview"><section><h3>Ensemble</h3><ul class="gp-ensemble">${shown
    .map((i) => `<li>${image(i, 28)}<span>${esc(Inst(i)?.name || i)}</span></li>`)
    .join(
      ''
    )}${insts.length > shown.length ? `<li class="gp-more">+${insts.length - shown.length} more</li>` : ''}</ul>${uiButton('genre-tab', 'Inspect instruments', 'arrow-right', `class="cm-btn gp-linkbtn" data-id="instruments"`)}</section><section><h3>Sound</h3>${words.length ? `<ul class="gp-words">${words.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p class="gp-note">The catalog places this genre in the middle of every characteristic.</p>'}${uiButton('genre-tab', 'Sound profile', 'arrow-right', `class="cm-btn gp-linkbtn" data-id="sound"`)}${cross.length ? `<p class="gp-also"><span>Also listed under:</span> ${cross.map((x) => `<button type="button" class="gp-link" data-ui="genre-branch" data-id="${esc(x)}">${esc(getTreeNode(x).name)}</button>`).join('<span aria-hidden="true"> · </span>')}</p>` : ''}${uiButton('genre-tab', 'Recordings & references', 'arrow-right', `class="cm-btn gp-linkbtn" data-id="background"`)}</section></div><div class="gp-detail-foot">${uiButton('genre-tab', 'Find similar sounds', 'search', `class="cm-btn gp-linkbtn" data-id="similar"`)}${uiButton('genre-map', 'View on map', 'map-pin', `class="cm-btn gp-linkbtn" data-id="${esc(id)}"`)}</div>`;
}
function gpSoundProfile(id, ext) {
  const axes = ext.axes || {};
  return `<p class="gp-note">Where the catalog places ${esc(Tradition(id).name)} on each of the 13 sound characteristics, from −2 to +2. The same values drive Similar sounds and Find a sound.</p><ul class="gp-profile">${AXIS_DEFINITIONS.map(
    (ax) => {
      const v = axes[ax.id] ?? 0;
      return `<li class="gp-axis-row"><span class="gp-axis-name">${esc(ax.name)}</span><span class="gp-scale" role="img" aria-label="${esc(ax.name)}: ${esc(axisLabel(ax, v))} (${v > 0 ? '+' : ''}${v} from −2 ${esc(ax.neg)} to +2 ${esc(ax.pos)})"><span class="gp-scale-end">${esc(ax.neg)}</span><span class="gp-dots">${[-2, -1, 0, 1, 2].map((s) => `<span class="gp-dot${s === v ? ' is-on' : ''}"></span>`).join('')}</span><span class="gp-scale-end">${esc(ax.pos)}</span></span><span class="gp-axis-value">${esc(axisLabel(ax, v))}</span></li>`;
    }
  ).join(
    ''
  )}</ul><div class="gp-detail-foot">${uiButton('genre-sound-from', 'Use as sound targets', 'sliders-horizontal', `class="cm-btn cm-btn-tonal" data-id="${esc(id)}" data-tooltip="Set all 13 Find a sound targets to this profile and list the genres within one step of it"`)}${uiButton('genre-tab', 'Similar sounds', 'arrow-right', `class="cm-btn gp-linkbtn" data-id="similar"`)}</div>`;
}
function gpInstruments(id, t) {
  const insts = t.instruments || [];
  const others = gpRecipeGenres().filter((g) => g !== id);
  const dest = G.instDest[id] ?? id;
  const opt = (value, label) =>
    `<option value="${esc(value)}"${value === dest ? ' selected' : ''}>${esc(label)}</option>`;
  return `<div class="gp-dest"><label for="gp-inst-dest">Add single instruments to</label><select id="gp-inst-dest" class="cm-select" data-genre="${esc(id)}">${opt(id, `${t.name} — set up as ${t.name} plays it`)}${others.map((g) => opt(g, `${Tradition(g)?.name || g} — set up as that genre plays it`)).join('')}${opt('', 'Independent instrument — default settings')}</select><span class="gp-note" id="gp-inst-dest-note">${dest ? `Joins the ${esc(Tradition(dest)?.name || dest)} group in Your recipe${gpRecipeCount(dest) ? '' : ' (the group is created)'}.` : 'Added on its own, outside any genre group.'}</span></div><ul class="gp-roster">${insts
    .map((i) => {
      const name = Inst(i)?.name || i;
      return `<li class="gp-roster-row">${image(i, 30)}<button type="button" class="gp-link gp-roster-name" data-ui="instrument-inspect" data-id="${esc(i)}" aria-label="Inspect ${esc(name)} on the Instrument page">${esc(name)}</button>${listenLink(name, true)}${uiButton('genre-inst-add', 'Add', 'plus', `class="cm-btn cm-btn-tonal" data-id="${esc(i)}" data-genre="${esc(id)}" aria-label="Add ${esc(name)} to the chosen destination"`)}</li>`;
    })
    .join(
      ''
    )}</ul><div class="gp-detail-foot">${uiButton('genre-add', gpRecipeCount(id) ? 'Add the whole ensemble again' : 'Add the whole ensemble', 'plus', `class="cm-btn cm-btn-outline" data-id="${esc(id)}" aria-label="Add the whole ${esc(t.name)} ensemble (${insts.length} instruments)"`)}</div>`;
}
function gpSimilar(id) {
  const near = findSimilar(id, 10);
  if (!near.length)
    return '<p class="gp-note">The catalog has no sound characteristics for this genre, so it has no neighbours.</p>';
  return `<p class="gp-note">Nearest genres across the 13 sound characteristics. Each row names the characteristics where the two agree most closely; it is a comparison of sound, not of history.</p><div class="gp-related">${near
    .map((s) => {
      const other = Tradition(s.id);
      const shared = getMatchingAxes(id, s.id, 3)
        .map((mm) => `${mm.axis.name}: ${axisLabel(mm.axis, mm.bv)}`)
        .join(' · ');
      return `<div class="related-row"><button type="button" data-ui="genre-select" data-id="${esc(s.id)}">${traditionGlyphsHTML(s.id, 24)}<span>${esc(other.name)}</span></button><span>${esc(shared)}</span>${listenLink(other.name)}${uiButton('genre-add', 'Add', 'plus', `data-id="${esc(s.id)}" aria-label="Add ${esc(other.name)} to Your recipe"`)}</div>`;
    })
    .join(
      ''
    )}</div><div class="gp-detail-foot">${uiButton('genre-sound-from', 'Find more like this', 'sliders-horizontal', `class="cm-btn cm-btn-tonal" data-id="${esc(id)}" data-tooltip="Set all 13 Find a sound targets to this profile and list the genres within one step of it"`)}</div>`;
}
function gpBackground(id, t, ext) {
  const path = gpPath(id);
  const cross = (ext.crossRefs || []).filter((x) => getTreeNode(x));
  const exemplars = (ext.exemplars || []).filter((x) => typeof x === 'string' && x.trim());
  return `<section><h3>About</h3><p class="gp-prose">${esc(ext.description || 'The catalog has no description for this genre.')}</p></section>${t.lineage ? `<section><h3>Lineage</h3><p class="gp-prose">${esc(t.lineage)}</p></section>` : ''}<section><h3>Classification</h3><p class="gp-note">Where the catalog files this genre by musical practice. Classification is not a claim of historical descent.</p>${path.length ? `<p class="gp-crumbs">${path.map((node) => `<button type="button" class="gp-link" data-ui="genre-branch" data-id="${esc(node.id)}">${esc(node.name)}</button>`).join(`<span class="gp-sep" aria-hidden="true">${icon('chevron-right', 12)}</span>`)}</p>` : ''}${cross.length ? `<p class="gp-also"><span>Also listed under:</span> ${cross.map((x) => `<button type="button" class="gp-link" data-ui="genre-branch" data-id="${esc(x)}">${esc(getTreeNode(x).name)}</button>`).join('<span aria-hidden="true"> · </span>')}</p>` : ''}</section><section><h3>Recordings &amp; references</h3>${exemplars.length ? `<p class="gp-note">Artists the catalog names as exemplars. Listen opens a YouTube search; the catalog does not cite individual recordings.</p><ul class="gp-exemplars">${exemplars.map((x) => `<li><span>${esc(x)}</span>${listenLink(x)}</li>`).join('')}</ul>` : '<p class="gp-note">The catalog names no exemplar artists for this genre. Listen opens a YouTube search for the genre itself.</p>'}${ext.status ? `<p class="gp-note">Catalog status: ${esc(ext.status)}.</p>` : ''}</section>`;
}
// Refresh only the detail's place line once the map's place names arrive.
function gpRefreshDetail() {
  const d = $ui('genre-detail');
  if (!d || d.querySelector('.gp-detail-place')) return;
  const place = gpPlace(d.dataset.gpId);
  if (!place) return;
  const line = document.createElement('div');
  line.className = 'gp-detail-place';
  line.innerHTML = `${icon('map-pin', 14)}<span>${esc(place)}</span>`;
  d.querySelector('#gp-detail-title')?.after(line);
}

// ── Browse column ────────────────────────────────────────────────────────
function gpBrowse() {
  const members = gpMembership();
  const node = UI.genreNode ? getTreeNode(UI.genreNode) : null;
  const total = gpCatalogSize();
  let nav;
  if (node) {
    const kids = TREE_NODES.filter((n) => n.parent === node.id);
    const parent = getTreeNode(node.parent);
    const cross = members.cross.get(node.id) || 0;
    nav = `${uiButton('genre-back', 'Back to ' + (parent?.name || 'all genres'), 'arrow-left', 'class="cm-btn gp-back"')}<div class="gp-node"><span class="gp-node-glyph">${traditionGlyphsHTML(node.id, 22)}</span><strong>${esc(node.name)}</strong><span class="gp-count">${(members.count.get(node.id) || 0).toLocaleString()}</span></div>${cross ? `<p class="gp-note">Includes ${cross.toLocaleString()} cross-listed from other branches.</p>` : ''}${kids.length ? `<ul class="gp-roots">${kids.map((k) => gpBranchItem(k, members)).join('')}</ul>` : ''}`;
  } else {
    const roots = getRoots();
    const shown = G.allRoots ? roots : roots.slice(0, GP_ROOTS_SHOWN);
    nav = `<button type="button" class="gp-all" data-ui="genre-all" aria-pressed="${G.tab === 'all' && !UI.genreNode}"><span>All genres</span><span class="gp-count">${total.toLocaleString()}</span></button><ul class="gp-roots">${shown.map((k) => gpBranchItem(k, members)).join('')}</ul>${roots.length > GP_ROOTS_SHOWN ? uiButton('genre-roots', G.allRoots ? 'Fewer categories' : `All ${roots.length} categories`, 'chevron-down', `class="cm-btn gp-linkbtn gp-roots-toggle" aria-expanded="${G.allRoots}"`) : ''}`;
  }
  // Below 900px everything after the heading row is behind one disclosure;
  // Browse tree stays in the heading row, reachable without opening it.
  const n = gpTargets().length;
  return `<div class="gp-sec-head"><h2 id="gp-browse-title">Browse</h2>${uiButton('genre-tree', 'Browse tree', 'network', 'class="cm-btn cm-btn-outline gp-tree-btn" data-tooltip="The full classification tree, every branch and genre"')}</div>${uiButton('genre-browse-toggle', node || n ? `Categories & find a sound (${[node ? node.name : '', n ? n + ' target' + (n === 1 ? '' : 's') : ''].filter(Boolean).join(', ')})` : 'Categories & find a sound', 'sliders-horizontal', `class="cm-btn cm-btn-outline gp-browse-toggle" aria-controls="gp-browse-more" aria-expanded="${G.browseOpen}"`)}<div class="gp-browse-more" id="gp-browse-more"><nav class="gp-browse-sec" aria-labelledby="gp-browse-title">${nav}</nav>${gpFindSound()}<div class="gp-browse-foot">${uiButton('genre-explore-map', 'Explore the map', 'map-pin', 'class="cm-btn gp-linkbtn"')}</div></div>`;
}
function gpBranchItem(n, members) {
  return `<li><button type="button" data-ui="genre-branch" data-id="${esc(n.id)}" aria-pressed="${UI.genreNode === n.id}">${traditionGlyphsHTML(n.id, 22)}<span class="gp-branch-name">${esc(n.name)}</span><span class="gp-count">${(members.count.get(n.id) || 0).toLocaleString()}</span></button></li>`;
}
function gpFindSound() {
  const applied = gpTargets().length;
  // The three featured characteristics first, then the catalog's order.
  const rank = (ax) => {
    const i = GP_FEATURED_AXES.indexOf(ax.id);
    return i < 0 ? GP_FEATURED_AXES.length : i;
  };
  const axes = AXIS_DEFINITIONS.filter(
    (ax) => G.allAxes || GP_FEATURED_AXES.includes(ax.id) || ax.id in G.targets
  ).sort((a, b) => rank(a) - rank(b));
  return `<section class="gp-sound" aria-labelledby="gp-sound-title"><div class="gp-sec-head"><h2 id="gp-sound-title">${icon('sliders-horizontal', 18)}Find a sound</h2>${uiButton('genre-sound-reset', 'Reset', 'x', `class="cm-btn gp-linkbtn" ${applied ? '' : 'disabled'} aria-label="Clear all sound targets"`)}</div><div class="gp-axes">${axes.map(gpAxisControl).join('')}</div><p class="gp-note" id="gp-sound-status" role="status">${gpSoundStatus()}</p>${uiButton('genre-axes', G.allAxes ? 'Fewer characteristics' : `All ${AXIS_DEFINITIONS.length} characteristics`, 'chevron-down', `class="cm-btn gp-linkbtn gp-axes-toggle" aria-expanded="${G.allAxes}"`)}${uiButton('genre-sound-match', 'Match a sound', 'search', `class="cm-btn cm-btn-tonal gp-match" ${applied ? '' : 'disabled'} data-tooltip="Open the genre closest to your targets"`)}</section>`;
}
function gpSoundStatus() {
  const n = gpTargets().length;
  if (!n) return 'Choose a target, then match.';
  return `${n} target${n === 1 ? '' : 's'} applied to All genres.`;
}
// One compact row per characteristic: its two ends either side of a slider
// (sparse ——o—— dense polyphonic), as in the reference. The name is the
// input's label (visually hidden; also its tooltip); the applied value is its
// value text, the bold end it leans to, the × that clears it, and the chip
// above the list.
function gpLean(v) {
  return v < 0 ? 'neg' : v > 0 ? 'pos' : 'mid';
}
function gpAxisControl(ax) {
  const on = ax.id in G.targets,
    v = on ? G.targets[ax.id] : 0,
    state = on ? axisLabel(ax, v) : 'Any';
  return `<div class="gp-axis${on ? ' is-applied' : ''}" data-axis="${ax.id}"${on ? ` data-lean="${gpLean(v)}"` : ''}><label class="gp-sr" for="gp-ax-${ax.id}">${esc(ax.name)}</label><span class="gp-axis-end" aria-hidden="true">${esc(ax.neg)}</span><input type="range" id="gp-ax-${ax.id}" data-axis="${ax.id}" min="-2" max="2" step="1" value="${v}" title="${esc(ax.name)}: ${esc(state)}" aria-describedby="gp-axv-${ax.id}" aria-valuetext="${on ? esc(state) : 'Any — not applied'}"><span class="gp-axis-end" aria-hidden="true">${esc(ax.pos)}</span><button type="button" class="gp-axis-clear" data-ui="genre-sound-clear" data-id="${ax.id}" aria-label="Clear the ${esc(ax.name)} target" title="Clear the ${esc(ax.name)} target"${on ? '' : ' hidden'}>${icon('x', 14)}</button><span class="gp-axis-state gp-sr" id="gp-axv-${ax.id}">${esc(state)}</span></div>`;
}
function gpApplyAxis(input) {
  const ax = AXIS_DEFINITIONS.find((a) => a.id === input.dataset.axis);
  if (!ax) return;
  const v = Number(input.value);
  G.targets[ax.id] = v;
  const row = input.closest('.gp-axis');
  const state = axisLabel(ax, v);
  row.classList.add('is-applied');
  row.dataset.lean = gpLean(v);
  row.querySelector('.gp-axis-state').textContent = state;
  row.querySelector('.gp-axis-clear').hidden = false;
  input.setAttribute('aria-valuetext', state);
  input.title = `${ax.name}: ${state}`;
  gpSyncSoundHead();
  G.tab = 'all';
  UI.limit = 50;
  gpScheduleList();
}
function gpSyncSoundHead() {
  const n = gpTargets().length;
  const status = $ui('gp-sound-status');
  if (status) status.textContent = gpSoundStatus();
  const reset = document.querySelector('#surface-genre [data-ui="genre-sound-reset"]');
  const match = document.querySelector('#surface-genre [data-ui="genre-sound-match"]');
  if (reset) reset.disabled = !n;
  if (match) match.disabled = !n;
}
let gpListFrame = 0;
function gpScheduleList() {
  if (gpListFrame) return;
  const run = () => {
    gpListFrame = 0;
    gpRenderMain();
  };
  gpListFrame =
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : setTimeout(run, 0);
}

// ── Main pane ────────────────────────────────────────────────────────────
function gpOpenId() {
  if (UI.genre) return UI.genre;
  if (G.tab === 'start' && !G.featureClosed && !gpQuery()) return STARTER_TRADITIONS[0];
  return null;
}
function gpStart(open) {
  const starters = STARTER_TRADITIONS.map((id) => Tradition(id))
    .filter(Boolean)
    .map((t) => ({ t }));
  const pinned = open && !starters.some((r) => r.t.id === open);
  let html = pinned ? `<div class="gp-pinned">${gpDetail(open)}</div>` : '';
  html += `<h2 class="gp-h">Six starter recipes</h2><p class="gp-note">Chosen to span the catalog: sparse and dense, acoustic and electronic, modal and functional, equal-tempered and not.</p>${gpList(starters, pinned ? null : open)}`;
  html += gpSuggestions();
  html += `<div class="gp-browse-all">${uiButton('genre-all', `Browse all ${gpCatalogSize().toLocaleString()} traditions`, 'arrow-right', 'class="cm-btn gp-linkbtn"')}</div>`;
  return html;
}
// Genres close to Your recipe's primary genre and not already in it — the
// same axis-distance neighbours the recipe panel suggests from.
function gpSuggestions() {
  const primaryCard =
    typeof _determinePrimaryCard === 'function'
      ? app.cards.find((c) => c.id === _determinePrimaryCard(app.cards))
      : null;
  const primary = primaryCard?.traditionId;
  if (!primary || !Tradition(primary)) return '';
  const inRecipe = new Set(gpRecipeGenres());
  const pool = findSimilar(primary, 16)
    .filter((s) => !inRecipe.has(s.id))
    .slice(0, 4);
  if (!pool.length) return '';
  const name = Tradition(primary).name;
  return `<h2 class="gp-h">${icon('lightbulb', 18)}Suggestions for this recipe</h2><p class="gp-note">Close to ${esc(name)}, the primary genre in Your recipe, across the 13 sound characteristics.</p>${gpList(
    pool.map((s) => ({ t: Tradition(s.id) })).filter((r) => r.t),
    null,
    (r) =>
      `<span class="gp-row-reason">${icon('sparkles', 12)}Shares ${esc(
        getMatchingAxes(primary, r.t.id, 2)
          .map((mm) => axisLabel(mm.axis, mm.bv))
          .join(' · ')
      )}</span>`
  )}`;
}
function gpAll(open) {
  const results = gpResults();
  const q = gpQuery();
  const node = UI.genreNode ? getTreeNode(UI.genreNode) : null;
  const targets = gpTargets();
  const shown = results.slice(0, UI.limit);
  const pinned = open && !shown.some((r) => r.t.id === open);
  const chips = [];
  if (q)
    chips.push(
      uiButton(
        'genre-clear-search',
        `Search: “${$ui('genre-search').value.trim()}”`,
        'x',
        `class="cm-chip" aria-label="Clear the search “${esc($ui('genre-search').value.trim())}”"`
      )
    );
  if (node)
    chips.push(
      uiButton(
        'genre-all',
        `In ${node.name}`,
        'x',
        `class="cm-chip" aria-label="Show all genres, not only ${esc(node.name)}"`
      )
    );
  for (const [k, v] of targets) {
    const ax = AXIS_DEFINITIONS.find((a) => a.id === k);
    chips.push(
      uiButton(
        'genre-sound-clear',
        `${ax.name}: ${axisLabel(ax, v)}`,
        'x',
        `class="cm-chip" data-id="${k}" aria-label="Clear the ${esc(ax.name)} target"`
      )
    );
  }
  const order = targets.length
    ? ' · closest to your sound targets first'
    : q
      ? ' · best name matches first'
      : ' · A to Z';
  let html = pinned ? `<div class="gp-pinned">${gpDetail(open)}</div>` : '';
  html += `<div class="catalog-count gp-count-line" id="gp-count" tabindex="-1">${results.length.toLocaleString()} genre${results.length === 1 ? '' : 's'}${node ? ' in ' + esc(node.name) : ''}${results.length ? order : ''}</div>${chips.length ? `<div class="gp-chips" aria-label="Constraints in force">${chips.join('')}</div>` : ''}`;
  if (!results.length) html += gpNoResults(q, node, targets);
  else
    html +=
      gpList(shown, pinned ? null : open, targets.length ? gpTargetReason : null) +
      (results.length > UI.limit
        ? uiButton(
            'more',
            `Show more (${(results.length - UI.limit).toLocaleString()} left)`,
            'chevron-down',
            'class="cm-btn cm-btn-outline gp-more-btn"'
          )
        : '');
  return html;
}
// No results says which constraints are in force and offers to lift each one.
function gpNoResults(q, node, targets) {
  const why = [];
  if (q) why.push('the search “' + $ui('genre-search').value.trim() + '”');
  if (node) why.push('the branch ' + node.name);
  if (targets.length)
    why.push(
      targets.length + ' sound target' + (targets.length === 1 ? '' : 's') + ' (within one step)'
    );
  return uiEmptyState({
    title: q
      ? `No genres match “${$ui('genre-search').value.trim()}”`
      : 'No genres match these constraints',
    text:
      (why.length > 1 ? 'Nothing satisfies ' + why.join(' and ') + ' together. ' : '') +
      (q ? 'Search covers names, lineage and descriptions.' : ''),
    actions:
      (q ? uiButton('genre-clear-search', 'Clear search', 'x') : '') +
      (node ? uiButton('genre-all', 'All genres', 'arrow-left') : '') +
      (targets.length ? uiButton('genre-sound-reset', 'Clear sound targets', 'x') : ''),
  });
}
function gpRenderMain() {
  const host = $ui('genre-list');
  if (!host) return;
  if (gpTreeOpen()) return;
  const focus = gpFocusKey();
  const open = gpOpenId();
  const layout = gpLayout();
  gpRecipeSig = gpRecipeSignature();
  $ui('genre-maintabs').innerHTML =
    `<div class="gp-viewtabs" role="tablist" aria-label="What to show">${[
      ['start', 'Start exploring'],
      ['all', 'All genres'],
    ]
      .map(
        ([k, l]) =>
          `<button type="button" role="tab" class="cm-tab" id="gp-view-${k}" data-ui="genre-view-tab" data-id="${k}" aria-controls="genre-list" aria-selected="${G.tab === k}" tabindex="${G.tab === k ? 0 : -1}">${l}</button>`
      )
      .join('')}</div><div class="cm-segmented gp-layout" role="group" aria-label="Layout">${[
      ['list', 'List', 'list'],
      ['grid', 'Grid', 'layout-grid'],
    ]
      .map(
        ([k, l, ic]) =>
          `<button type="button" data-ui="genre-layout" data-id="${k}" aria-pressed="${layout === k}">${icon(ic, 16)}<span>${l}</span></button>`
      )
      .join('')}</div>`;
  // A search always shows its results (All genres), however it was set.
  if (gpQuery()) G.tab = 'all';
  host.innerHTML = G.tab === 'all' ? gpAll(open) : gpStart(open);
  gpMarkOpen(open);
  gpRestoreFocus(focus);
  // Keep the Browse column's pressed states truthful without rebuilding it
  // (rebuilding would drop a slider mid-drag).
  document
    .querySelectorAll('#genre-browse [data-ui="genre-all"]')
    .forEach((b) => b.setAttribute('aria-pressed', String(G.tab === 'all' && !UI.genreNode)));
}
function gpMarkOpen(open) {
  document.querySelectorAll('#genre-list .gp-open').forEach((b) => {
    b.setAttribute('aria-expanded', String(b.dataset.id === open));
  });
}
function renderGenreDiscovery() {
  if (!$ui('genre-body')) return;
  if (!G.view) G.view = UILayout.remember('genre-view', 'list', () => gpRenderMain());
  gpLoadOptional();
  if (gpTreeOpen()) return;
  const focus = gpFocusKey();
  const total = gpCatalogSize();
  $ui('genre-total').textContent = total
    ? total.toLocaleString() + ' traditions'
    : 'Loading the catalog…';
  $ui('genre-browse').innerHTML = gpBrowse();
  $ui('genre-body').classList.toggle('gp-browse-open', G.browseOpen);
  gpRenderMain();
  gpRestoreFocus(focus);
}
// Kept for callers of the previous page API: a genre's details.
function renderGenreWeb(id) {
  if (!Tradition(id)) return;
  UI.genre = id;
  renderGenreDiscovery();
}

// ── Focus and position ───────────────────────────────────────────────────
function gpFocusKey() {
  const a = document.activeElement;
  if (!a || !a.closest?.('#surface-genre') || a.id === 'genre-search') return null;
  if (a.dataset.ui) return { ui: a.dataset.ui, id: a.dataset.id || '' };
  if (a.dataset.axis) return { axis: a.dataset.axis };
  return null;
}
function gpRestoreFocus(key) {
  if (!key || document.activeElement?.closest?.('#surface-genre')) return;
  const el = key.axis
    ? document.querySelector(`#surface-genre input[data-axis="${key.axis}"]`)
    : [...document.querySelectorAll(`#surface-genre [data-ui="${key.ui}"]`)].find(
        (b) => (b.dataset.id || '') === key.id
      );
  uiFocus(el);
}
function gpScrollers() {
  return [$ui('genre-main'), $ui('surface-genre'), document.scrollingElement].filter(Boolean);
}
function gpSaveScroll() {
  G.listScroll = gpScrollers().map((el) => el.scrollTop);
}
function gpRestoreScroll() {
  if (!G.listScroll) return;
  gpScrollers().forEach((el, i) => (el.scrollTop = G.listScroll[i] || 0));
  G.listScroll = null;
}
function gpShowDetail() {
  const d = $ui('genre-detail');
  if (!d) return;
  if (d.closest('.gp-pinned')) gpScrollers().forEach((el) => (el.scrollTop = 0));
  else d.scrollIntoView?.({ block: 'nearest' });
}

// ── Opening, closing, tabs ───────────────────────────────────────────────
function gpSelect(id) {
  if (!Tradition(id)) return;
  gpCloseTree();
  if (G.tab === 'start') G.featureClosed = true;
  // Remember the row the reader came from, and the list position, so that
  // closing a detail opened from Similar sounds (or a breadcrumb) returns there.
  const inList = !!uiFind('#genre-list .gp-open', 'id', id);
  const prev = gpOpenId();
  if (inList) G.origin = id;
  else if (prev && $ui('genre-detail')?.closest('.gp-items')) G.origin = prev;
  if (!inList && !G.listScroll) gpSaveScroll();
  UI.genre = id;
  G.detailTab = 'overview';
  gpRenderMain();
  gpShowDetail();
  uiFocus($ui('gp-detail-title'));
}
// Back from a genre's detail to the list, returning focus to its row.
function uiGenreBack() {
  const id = gpOpenId();
  if (!id) return;
  UI.genre = null;
  // Closing anything on Start exploring also retires its opening feature, so
  // closing never makes a different genre spring open.
  if (G.tab === 'start') G.featureClosed = true;
  gpRenderMain();
  gpRestoreScroll();
  const origin = G.origin;
  G.origin = null;
  const row =
    uiFind('#genre-list [data-ui="genre-select"]', 'id', id) ||
    uiFind('#genre-list [data-ui="genre-select"]', 'id', origin);
  // The row the reader came from is put back in view, then focused.
  if (row) row.scrollIntoView?.({ block: 'center' });
  uiFocus(row) || uiFocus($ui('genre-search'));
}
// A new list (another tab, branch or search) has no position to return to.
function gpForgetPosition() {
  G.listScroll = null;
  G.origin = null;
}
function gpTreeOpen() {
  const t = $ui('modal-trad');
  return !!(t && t.classList.contains('inline-tree') && t.closest('#genre-body'));
}
function gpCloseTree() {
  const t = $ui('modal-trad');
  if (t && t.closest('#genre-body')) {
    document.body.append(t);
    t.classList.remove('inline-tree');
  }
}
// Arrow keys, Home and End move between tabs (both tab lists on the page).
function gpTabKeys(e) {
  const tab = e.target.closest?.('#surface-genre [role="tab"]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const tabs = [...tab.parentElement.querySelectorAll('[role="tab"]')];
  let i = tabs.indexOf(tab);
  i =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? tabs.length - 1
        : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  e.preventDefault();
  const { ui, id } = tabs[i].dataset;
  tabs[i].click();
  uiFocus(uiFind(`#surface-genre [data-ui="${ui}"]`, 'id', id));
}
function gpSetTab(k) {
  G.detailTab = k;
  const d = $ui('genre-detail');
  if (!d) return;
  d.querySelectorAll('[role="tab"]').forEach((b) => {
    const on = b.dataset.id === k;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  d.querySelectorAll('[role="tabpanel"]').forEach((p) => (p.hidden = p.id !== 'gp-panel-' + k));
}

// ── Recipe changes made elsewhere (Undo, Surprise me, the recipe panel) ──
// The shell re-renders this page after its own genre additions; for every
// other change the in-recipe marks are refreshed here, without a rebuild.
let gpRecipeSig = '';
function gpRecipeSignature() {
  return app.cards.map((c) => c.traditionId || '').join('|');
}
function gpWatchRecipe() {
  const panel = $ui('workspace-sidebar');
  if (!panel || typeof MutationObserver !== 'function') return;
  let pending = 0;
  new MutationObserver(() => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = 0;
      if (gpRecipeSignature() === gpRecipeSig) return;
      if (
        UI.view === 'genre' &&
        !gpTreeOpen() &&
        !document.activeElement?.matches?.('#surface-genre input[type="range"]')
      )
        gpRenderMain();
    }, 120);
  }).observe(panel, { childList: true, subtree: true });
}

// ── Adding one instrument from a genre's roster ──────────────────────────
// The destination is chosen here, on the roster, not inherited from the
// Instrument page. The canonical picker path does the work: it configures the
// card as the destination genre plays it, places it in that group, and pushes
// one history entry.
async function gpAddInstrument(instId, genreId) {
  if (UI.busy) {
    showToast('An addition is already in progress.', 'error');
    return;
  }
  const select = $ui('gp-inst-dest');
  const dest =
    select && select.dataset.genre === genreId ? select.value : (G.instDest[genreId] ?? genreId);
  UI.busy = true;
  try {
    app._addToTradition = dest || null;
    const card = await addInstrumentFromPicker(instId);
    if (!card) throw Error('Instrument unavailable');
    renderAll();
    uiOpenEditor(card.id);
    showToast(_addedInstrumentMessage(instId, card), 'success');
  } catch (e) {
    app._addToTradition = null;
    showToast(e.message || 'Could not add the instrument', 'error');
  } finally {
    UI.busy = false;
  }
}

// ── View on map ──────────────────────────────────────────────────────────
// Opens the Map with this tradition selected (the atlas reads ?trad= on
// load) and offers the way back to the same genre. See the PR's shell
// requests: a message-based select would keep the atlas's own state.
function gpViewOnMap(id) {
  const t = Tradition(id);
  if (!t) return;
  UI.genre = id;
  uiNavigate('map', { push: true });
  const frame = $ui('map-frame');
  if (frame) {
    const want = 'atlas.html?embedded=1&trad=' + encodeURIComponent(id);
    if (!frame.getAttribute('src')?.endsWith(want)) frame.setAttribute('src', want);
  }
  showToast(`Showing ${t.name} on the map`, 'success', {
    label: 'Back to ' + t.name,
    run: () => {
      UI.genre = id;
      uiNavigate('genre', { push: true });
      gpShowDetail();
      uiFocus($ui('gp-detail-title'));
    },
  });
}

// ── Search placeholder ───────────────────────────────────────────────────
// The longest wording that fits the field as it is laid out, so a phone never
// shows a clipped "…descriptio". The accessible name stays "Search genres".
const GP_PLACEHOLDERS = [
  'Search genres, traditions, or descriptions…',
  'Search genres or descriptions…',
  'Search genres…',
];
let gpMeasure = null;
function gpFitPlaceholder() {
  const input = $ui('genre-search');
  if (!input) return;
  const cs = getComputedStyle(input);
  const room = input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4;
  if (!(room > 0)) return; // not laid out (another route)
  if (!gpMeasure) gpMeasure = document.createElement('canvas').getContext('2d');
  if (!gpMeasure) return;
  gpMeasure.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const fit =
    GP_PLACEHOLDERS.find((t) => gpMeasure.measureText(t).width <= room) || GP_PLACEHOLDERS.at(-1);
  if (input.placeholder !== fit) input.placeholder = fit;
}

uiRegisterPage({
  id: 'genre',
  recipe: 'sidebar-right',
  mount(surface) {
    surface.innerHTML = `<div class="gp-head"><div class="gp-title"><h1>Genres &amp; traditions</h1><span id="genre-total" class="gp-total"></span></div><label class="ui-search cm-search gp-search">${icon('search', 20)}<input id="genre-search" type="search" placeholder="Search genres, traditions, or descriptions…" aria-label="Search genres" autocomplete="off"></label><div class="gp-head-actions">${uiButton('surprise', 'Surprise me', 'shuffle', 'class="cm-btn cm-btn-tonal" data-tooltip="Add a random genre\'s whole ensemble to Your recipe (Undo removes it)"')}${uiButton('ai', 'AI recipe', 'sparkles', 'class="cm-btn cm-btn-tonal"')}</div></div><div id="genre-body"><aside id="genre-browse" class="gp-browse" aria-label="Browse and find a sound"></aside><div id="genre-main" class="gp-main"><div id="genre-maintabs" class="gp-maintabs"></div><div id="genre-list"></div></div></div>`;
    $ui('genre-search').addEventListener('input', () => {
      gpCloseTree();
      gpForgetPosition();
      UI.genre = null;
      UI.limit = 50;
      if (gpQuery()) G.tab = 'all';
      gpRenderMain();
    });
    if (typeof ResizeObserver === 'function')
      new ResizeObserver(() => gpFitPlaceholder()).observe($ui('genre-search'));
    // The rest of a row (its picture margin, the chevron) opens it too; the
    // name button is the keyboard route.
    surface.addEventListener('click', (e) => {
      const row = e.target.closest('.gp-row');
      if (row && !e.target.closest('button, a, input, select, label'))
        row.querySelector('.gp-open')?.click();
    });
    surface.addEventListener('input', (e) => {
      if (e.target.matches('input[type="range"][data-axis]')) gpApplyAxis(e.target);
    });
    // A click or Enter on a slider applies the value it shows, so the middle
    // position can be chosen without moving off it and back.
    surface.addEventListener('click', (e) => {
      if (
        e.target.matches('input[type="range"][data-axis]') &&
        !(e.target.dataset.axis in G.targets)
      )
        gpApplyAxis(e.target);
    });
    surface.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('input[type="range"][data-axis]'))
        gpApplyAxis(e.target);
      gpTabKeys(e);
    });
    surface.addEventListener('change', (e) => {
      if (e.target.id === 'gp-inst-dest') {
        const genre = e.target.dataset.genre;
        G.instDest[genre] = e.target.value;
        const note = $ui('gp-inst-dest-note');
        const dest = e.target.value;
        if (note)
          note.textContent = dest
            ? `Joins the ${Tradition(dest)?.name || dest} group in Your recipe${gpRecipeCount(dest) ? '' : ' (the group is created)'}.`
            : 'Added on its own, outside any genre group.';
      }
    });
    // A manifest image that fails to load falls back to the glyph beside it.
    surface.addEventListener(
      'error',
      (e) => {
        if (!e.target.classList?.contains('gp-img')) return;
        e.target.closest('.gp-media')?.classList.add('gp-media-glyph');
        // No picture, no credit for it.
        const credit = e.target.closest('.gp-row, .gp-detail-head')?.querySelector('.gp-credit');
        if (credit) credit.hidden = true;
      },
      true
    );
    gpWatchRecipe();
  },
  render: renderGenreDiscovery,
  // Escape closes what this page opened: the inline tree, then a detail.
  escape() {
    if (gpTreeOpen()) {
      $ui('modal-trad').querySelector('[data-close]').click();
      uiFocus(document.querySelector('#surface-genre [data-ui="genre-tree"]'));
    } else if (gpOpenId()) uiGenreBack();
    else if (G.browseOpen) {
      G.browseOpen = false;
      renderGenreDiscovery();
      uiFocus(document.querySelector('#surface-genre [data-ui="genre-browse-toggle"]'));
    }
  },
  actions: {
    'genre-branch'(id) {
      gpForgetPosition();
      gpCloseTree();
      UI.genre = null;
      UI.genreNode = id;
      UI.limit = 50;
      G.tab = 'all';
      $ui('genre-search').value = '';
      renderGenreDiscovery();
      uiFocus($ui('gp-count'));
    },
    'genre-back'() {
      UI.genreNode = getTreeNode(UI.genreNode)?.parent || '';
      UI.limit = 50;
      renderGenreDiscovery();
      uiFocus(document.querySelector('#genre-browse [data-ui="genre-back"]')) ||
        uiFocus(document.querySelector('#genre-browse [data-ui="genre-all"]'));
    },
    'genre-all'() {
      gpForgetPosition();
      gpCloseTree();
      UI.genreNode = '';
      UI.genre = null;
      UI.limit = 50;
      G.tab = 'all';
      renderGenreDiscovery();
    },
    'genre-roots'() {
      G.allRoots = !G.allRoots;
      renderGenreDiscovery();
    },
    'genre-select'(id) {
      gpSelect(id);
    },
    'genre-close'() {
      uiGenreBack();
    },
    'genre-tab'(id) {
      gpSetTab(id);
      uiFocus($ui('gp-tab-' + id));
    },
    'genre-view-tab'(id) {
      gpForgetPosition();
      gpCloseTree();
      G.tab = id === 'all' ? 'all' : 'start';
      UI.genre = null;
      UI.limit = 50;
      renderGenreDiscovery();
    },
    'genre-layout'(id) {
      G.view.set(id === 'grid' ? 'grid' : 'list');
      gpRenderMain();
    },
    'genre-browse-toggle'() {
      G.browseOpen = !G.browseOpen;
      $ui('genre-body').classList.toggle('gp-browse-open', G.browseOpen);
      document
        .querySelector('#surface-genre [data-ui="genre-browse-toggle"]')
        .setAttribute('aria-expanded', String(G.browseOpen));
    },
    'genre-clear-search'() {
      $ui('genre-search').value = '';
      UI.limit = 50;
      gpRenderMain();
      $ui('genre-search').focus();
    },
    'genre-tree'() {
      const tree = $ui('modal-trad');
      UI.genre = null;
      $ui('genre-list').replaceChildren(tree);
      tree.classList.add('inline-tree');
      tree.querySelector('.modal').removeAttribute('aria-modal');
      tree.querySelector('.modal').setAttribute('role', 'region');
      tree.querySelector('h2').textContent = 'Genres';
      tree.querySelector('[data-close]').onclick = () => {
        tree.classList.remove('inline-tree');
        document.body.append(tree);
        renderGenreDiscovery();
      };
      renderTradPicker();
    },
    'genre-axes'() {
      G.allAxes = !G.allAxes;
      renderGenreDiscovery();
      uiFocus(document.querySelector('#surface-genre [data-ui="genre-axes"]'));
    },
    'genre-sound-clear'(id) {
      delete G.targets[id];
      UI.limit = 50;
      renderGenreDiscovery();
    },
    'genre-sound-reset'() {
      G.targets = {};
      UI.limit = 50;
      renderGenreDiscovery();
      uiFocus(document.querySelector('#surface-genre input[type="range"][data-axis]'));
    },
    'genre-sound-from'(id) {
      const axes = Catalog.ext(id)?.axes;
      if (!axes) return;
      G.targets = {};
      for (const ax of AXIS_DEFINITIONS) G.targets[ax.id] = axes[ax.id] ?? 0;
      G.allAxes = true;
      G.tab = 'all';
      UI.genre = null;
      UI.genreNode = '';
      UI.limit = 50;
      $ui('genre-search').value = '';
      renderGenreDiscovery();
      showToast(`Sound targets set from ${Tradition(id).name}'s profile`, 'success');
      uiFocus($ui('gp-count'));
    },
    'genre-sound-match'() {
      const best = gpResults()[0];
      if (!best) {
        G.tab = 'all';
        renderGenreDiscovery();
        uiFocus($ui('gp-count'));
        return;
      }
      G.tab = 'all';
      gpSelect(best.t.id);
    },
    async 'genre-inst-add'(id, button) {
      await gpAddInstrument(id, button.dataset.genre);
    },
    'genre-map'(id) {
      gpViewOnMap(id);
    },
    'genre-explore-map'() {
      uiNavigate('map', { push: true });
    },
  },
});
