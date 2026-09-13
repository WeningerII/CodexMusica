/* exported UI, UI_ICONS, uiStart, uiReceiveReply, uiOpenSurface, uiSync */
/* global _chatPersistedState, surpriseTradition, CHAT_BACKEND, CHAT_STORAGE_KEY, Catalog, FamName, INSTRUMENT_FILTER_PILLS, Inst, Tradition, _CARD_TRANSIENTS, _addedInstrumentMessage, _chatRecover, _chatReset, _chatSetBusy, addInstrumentFromPicker, app, axisLabel, chatState, compileRecipeStack, copyToClipboard, countDescendantLeaves, esc, familyImage, findSimilar, findSimilarInstruments, getChildren, getMatchingAxes, getRoots, getTreeNode, icon, image, importTraditionWithFeedback, isMobileLayout, normalizeSearch, normalizeWorkspaceCards, passesInstrumentFilter, pushHistory, redo, renderAll, renderDetail, renderTradPicker, showToast, tradParent, traditionGlyphsHTML, undo */
/* Shared discovery and writing workspace. Built alongside the canonical app and catalog. */
'use strict';
const UI = {
  lyricRevision: 0,
  lyricRequest: null,
  lastSaved: null,
  storageConflict: false,
  saveFailed: false,
  view: 'genre',
  genreNode: '',
  genre: null,
  instrumentFamily: '',
  instrumentClass: '',
  limit: 50,
  busy: false,
  editor: false,
  ready: false,
};
const $ui = (id) => document.getElementById(id);
const uiButton = (act, label, ic = 'plus', extra = '') =>
  `<button type="button" data-ui="${act}" ${extra.includes('aria-label=') ? '' : `aria-label="${esc(label)}"`} ${extra}>${icon(ic, 18)}<span>${esc(label)}</span></button>`;
const listenLink = (name, instrument = false) =>
  `<a class="listen" href="https://www.youtube.com/results?search_query=${encodeURIComponent(name + (instrument ? ' musical instrument solo demonstration' : ' music'))}" target="_blank" rel="noopener noreferrer" aria-label="Listen to ${esc(name)} on YouTube">${icon('play', 16)}<span>Listen</span></a>`;
function uiNavigate(view) {
  if (!['genre', 'instrument', 'map', 'lyrics'].includes(view)) return;
  UI.view = view;
  document.body.dataset.view = view;
  if (/^https?:$/.test(location.protocol) && location.hash !== '#' + view)
    history.replaceState(null, '', '#' + view);
  document.querySelectorAll('button[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
    b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
  });
  document.querySelectorAll('.ui-surface').forEach((el) => {
    el.hidden = el.id !== 'surface-' + view;
  });
  if (view === 'genre') renderGenreDiscovery();
  if (view === 'instrument') renderInstrumentDiscovery();
  if (view === 'map' && !$ui('map-frame').src) $ui('map-frame').src = 'atlas.html?embedded=1';
  const dock = $ui('chat-dock');
  if (view === 'lyrics') {
    if (uiSwitchChat('lyrics')) {
      $ui('lyrics-chat').append(dock);
      dock.hidden = false;
      $ui('chat-panel').hidden = false;
      $ui('lyrics-wait')?.remove();
    } else {
      $ui('assistant-slot').append(dock);
      uiLyricsWaiting();
    }
  } else {
    $ui('assistant-slot').append(dock);
    if (!chatState.busy) uiSwitchChat('recipe');
  }
  document.body.classList.remove('session-open');
  document.querySelector(`[data-view="${view}"]`)?.focus({ preventScroll: true });
}
function uiListen() {
  const c = app.cards.find((c) => c.id === app.selected);
  return c ? listenLink(Inst(c.instrumentId).name, true) : '';
}
function uiSync() {
  if (!UI.ready) return;
  document.body.classList.toggle(
    'editor-open',
    UI.editor && !!app.selected && app.cards.length > 0
  );
  $ui('ui-count').textContent = String(app.cards.length);
  const detail = $ui('detail-view');
  if (detail && !detail.querySelector('.ui-detail-tools')) {
    const bar = document.createElement('div');
    bar.className = 'ui-detail-tools';
    bar.innerHTML = uiListen() + uiButton('close-editor', 'Close', 'x');
    detail.prepend(bar);
  }
  $ui('btn-undo').disabled = app.historyIndex <= 0;
  $ui('btn-redo').disabled = app.historyIndex >= app.history.length - 1;
  uiAutosave();
}
function uiOpenEditor(id) {
  app.selected = id;
  UI.editor = true;
  renderDetail();
  uiSync();
  if (isMobileLayout()) document.body.classList.add('session-open');
}
async function uiAddGenre(id) {
  if (UI.busy) {
    showToast('An addition is already in progress.', 'error');
    return false;
  }
  UI.busy = true;
  try {
    const added = await importTraditionWithFeedback(id);
    UI.editor = false;
    uiSync();
    renderGenreDiscovery();
    return added.length > 0;
  } catch (e) {
    showToast(e.message || 'Could not add genre', 'error');
  } finally {
    UI.busy = false;
  }
}
async function uiAddInstrument(id) {
  if (UI.busy) return;
  UI.busy = true;
  try {
    const destination = $ui('instrument-destination')?.value;
    app._addToTradition = destination || null;
    const c = await addInstrumentFromPicker(id);
    if (!c) throw Error('Instrument unavailable');
    renderAll();
    uiOpenEditor(c.id);
    showToast(_addedInstrumentMessage(id, c), 'success');
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    UI.busy = false;
  }
}
function uiGenreRows(list) {
  return (
    list
      .slice(0, UI.limit)
      .map(
        (t) =>
          `<div class="catalog-row"><button class="catalog-name" data-ui="genre-select" data-id="${esc(t.id)}">${traditionGlyphsHTML(t.id, 30)}<span>${esc(t.name)}</span></button>${listenLink(t.name)}${uiButton('genre-add', 'Add', 'plus', `data-id="${esc(t.id)}" aria-label="Add ${esc(t.name)}"`)}</div>`
      )
      .join('') + (list.length > UI.limit ? uiButton('more', 'Show more', 'chevron-down') : '')
  );
}
function uiDetachTree() {
  const t = $ui('modal-trad');
  if (t && t.parentElement === $ui('genre-body')) {
    document.body.append(t);
    t.classList.remove('inline-tree');
  }
}
function renderGenreDiscovery() {
  uiDetachTree();
  if (!$ui('genre-body')) return;
  const q = normalizeSearch($ui('genre-search').value),
    roots = getRoots();
  const node = UI.genreNode ? getTreeNode(UI.genreNode) : null;
  let children = node ? getChildren(node.id) : roots;
  let all = Catalog.all();
  if (q)
    all = all
      .filter((t) =>
        normalizeSearch(
          t.name + ' ' + (t.lineage || '') + ' ' + (Catalog.ext(t.id)?.description || '')
        ).includes(q)
      )
      .sort((a, b) =>
        normalizeSearch(a.name) === q
          ? -1
          : normalizeSearch(b.name) === q
            ? 1
            : a.name.localeCompare(b.name, 'en')
      );
  else if (node) {
    const under = (id) => {
      let p = tradParent(id);
      while (p) {
        if (p === node.id) return true;
        p = getTreeNode(p)?.parent;
      }
      return false;
    };
    all = all.filter((t) => under(t.id) || (Catalog.ext(t.id)?.crossRefs || []).includes(node.id));
  }
  if (UI.genre) {
    renderGenreWeb(UI.genre);
    return;
  }
  const branches = children.filter((c) => TREE_NODES.some((n) => n.id === c.id));
  $ui('genre-body').innerHTML =
    `<div class="discovery-grid"><nav class="catalog-categories" aria-label="Genre categories">${node ? `<div class="category-heading">${uiButton('genre-back', 'Back to ' + (getTreeNode(node.parent)?.name || 'all genres'), 'arrow-left')}<strong>${esc(node.name)}</strong></div>` : ''}${!q && branches.length ? `<div class="branch-key">${branches.map((n) => `<button data-ui="genre-branch" data-id="${esc(n.id)}">${traditionGlyphsHTML(n.id, 22)}<span>${esc(n.name)}</span><span class="category-count">${countDescendantLeaves(n.id)}</span></button>`).join('')}</div>` : ''}</nav><div class="catalog-list"><div class="catalog-count">${all.length.toLocaleString()} genres</div>${uiGenreRows(all)}${!all.length ? '<p>No genres match your search.</p>' : ''}</div></div>`;
}
function renderGenreWeb(id) {
  uiDetachTree();
  const t = Tradition(id);
  if (!t) return;
  const ext = Catalog.ext(id) || {},
    near = findSimilar(id, 8),
    added = app.cards.some((c) => c.traditionId === id);
  $ui('genre-body').innerHTML =
    `<div class="genre-selected"><div class="selected-head">${uiButton('genre-close', 'Back', 'arrow-left')}<h2>${traditionGlyphsHTML(id, 32)}${esc(t.name)}</h2>${listenLink(t.name)}${uiButton('genre-add', added ? 'Add again' : 'Add genre', 'plus', `data-id="${esc(id)}"`)}</div><div class="genre-facts"><details><summary>About ${esc(t.name)}</summary><p>${esc(ext.description || t.lineage || '')}</p></details><details><summary>Sound profile</summary>${AXIS_DEFINITIONS.map((ax) => `<div class="profile-row"><span>${esc(ax.name)}</span><span>${esc(axisLabel(ax, ext.axes?.[ax.id] || 0))}</span></div>`).join('')}</details><details open><summary>Instruments</summary><div class="genre-instruments">${(t.instruments || []).map((i) => `<div>${image(i, 26)}<button data-ui="instrument-inspect" data-id="${esc(i)}">${esc(Inst(i)?.name || i)}</button>${listenLink(Inst(i)?.name || i, true)}${uiButton('instrument-add', 'Add', 'plus', `data-id="${esc(i)}"`)}</div>`).join('')}</div></details><details><summary>Related genres · sound similarity</summary>${near
      .map((n) => {
        const other = Tradition(n.id);
        return `<div class="related-row"><button data-ui="genre-select" data-id="${esc(n.id)}">${traditionGlyphsHTML(n.id, 24)}${esc(other.name)}</button><span>${getMatchingAxes(
          id,
          n.id,
          3
        )
          .map((m) => esc(m.axis.name))
          .join(
            ' · '
          )}</span>${uiButton('genre-add', 'Add', 'plus', `data-id="${esc(n.id)}"`)}</div>`;
      })
      .join(
        ''
      )}</details>${(ext.crossRefs || []).length ? `<details><summary>Also belongs to</summary>${ext.crossRefs.map((id) => uiButton('genre-branch', getTreeNode(id)?.name || id, 'layers', `data-id="${esc(id)}"`)).join('')}</details>` : ''}</div></div>`;
}
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
  );
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
function uiExport() {
  const p = {
    version: 3,
    name: app.workspaceName,
    cards: app.cards.map((c) => ({ ...c, ..._CARD_TRANSIENTS })),
    lyrics: $ui('lyrics-draft').value,
  };
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }),
    a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'codex-musica-session.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function uiImport(file) {
  try {
    const s = JSON.parse(await file.text()),
      cards = s.cards || s.workspace?.cards;
    if (!Array.isArray(cards)) throw Error('No workspace in this file');
    const validated = normalizeWorkspaceCards(cards, true);
    app.cards = validated;
    app.workspaceName = s.name || s.title || 'Imported session';
    // A legacy recipe-only file is a complete session with no lyrics. Never
    // attach the previous session's writing to the imported arrangement.
    app.lyrics = typeof s.lyrics === 'string' ? s.lyrics : '';
    $ui('lyrics-draft').value = app.lyrics;
    uiSaveLyrics();
    pushHistory();
    renderAll();
    showToast('Session imported', 'success');
  } catch (e) {
    showToast('Import failed: ' + e.message, 'error');
  }
}
function uiSaveLyrics() {
  app.lyrics = $ui('lyrics-draft').value;
  UI.lyricRevision++;
  uiAutosave();
}
const uiChatSessions = new Map();
function uiUpdatePrompt() {
  const input = $ui('chat-input'),
    domain = $ui('chat-domain');
  if (!input || !domain) return;
  const lyric = domain.value.startsWith('lyrics');
  input.placeholder = lyric
    ? 'Describe the song, or paste lyrics to edit…'
    : 'Describe the recording recipe you want…';
  input.setAttribute('aria-label', lyric ? 'Lyrics request' : 'Recipe request');
}
function uiSwitchChat(target) {
  const current =
    chatState.task?.domain ||
    ($ui('chat-domain')?.value.startsWith('lyrics') ? 'lyrics' : 'recipe');
  if (current === target) {
    if (!chatState.sig && !chatState.continuationId) $ui('chat-domain').value = target;
    uiUpdatePrompt();
    return true;
  }
  if (chatState.busy) {
    uiUpdatePrompt();
    return false;
  }
  const keys = [
    'history',
    'workspace',
    'lyric',
    'task',
    'sig',
    'continuationId',
    'pending',
    'archives',
    'retryAt',
  ];
  const stored = Object.fromEntries(keys.map((k) => [k, chatState[k]]));
  try {
    localStorage.setItem(CHAT_STORAGE_KEY + ':' + current, JSON.stringify(_chatPersistedState()));
  } catch {
    showToast('Conversation could not be saved. Free storage before switching writers.', 'error');
    return false;
  }
  let next = uiChatSessions.get(target);
  if (!next) {
    try {
      const state = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY + ':' + target) || 'null');
      if (state?.domain && !state.task) state.task = { domain: state.domain, phase: state.phase };
      if (state) next = { state };
    } catch {}
  }
  const nextState = Object.assign(
    {},
    {
      history: null,
      workspace: null,
      lyric: null,
      task: null,
      sig: null,
      continuationId: null,
      pending: null,
      archives: [],
      retryAt: 0,
    },
    next?.state || {}
  );
  nextState.generation = chatState.generation + 1;
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(_chatPersistedState(nextState)));
  } catch {
    showToast('Conversation could not be saved. Free storage before switching writers.', 'error');
    return false;
  }
  const log = document.createDocumentFragment();
  while ($ui('chat-log').firstChild) log.append($ui('chat-log').firstChild);
  uiChatSessions.set(current, { state: stored, log, input: $ui('chat-input').value });
  Object.assign(chatState, nextState);
  $ui('chat-domain').value = chatState.task?.domain
    ? chatState.task.domain +
      (chatState.task.phase === 'edit'
        ? '-edit'
        : chatState.task.phase === 'browse'
          ? '-browse'
          : '')
    : target;
  if (next?.log) $ui('chat-log').append(next.log);
  $ui('chat-input').value = next?.input || '';
  _chatSetBusy(false);
  uiUpdatePrompt();
  if (!next?.log && (chatState.pending || chatState.continuationId)) {
    chatState.pending = chatState.pending || {
      request_id: chatState.continuationId,
      message: '',
      domain: target,
    };
    _chatRecover();
  }
  return true;
}
function uiChatOpen() {
  if (!uiSwitchChat(UI.view === 'lyrics' ? 'lyrics' : 'recipe')) {
    showToast('A request is running in the other writer.', 'error');
    return false;
  }
  document.body.classList.add('assistant-open');
  $ui('chat-dock').hidden = false;
  $ui('chat-panel').hidden = false;
  $ui('chat-input').focus();
  return true;
}
function uiNewTask(domain) {
  if (chatState.busy) {
    showToast('A request is running. Its progress remains in the conversation.', 'error');
    uiChatOpen();
    return false;
  }
  if (domain.startsWith('lyrics')) uiNavigate('lyrics');
  else if (UI.view === 'lyrics') uiNavigate('genre');
  if (!uiSwitchChat(domain.startsWith('lyrics') ? 'lyrics' : 'recipe')) return false;
  _chatReset();
  $ui('chat-domain').value = domain;
  uiUpdatePrompt();
  uiChatOpen();
  return true;
}
function uiStart() {
  document.body.classList.add('workbench');
  const oldHeader = document.querySelector('.app-bar');
  oldHeader.classList.add('native-header');
  const header = document.createElement('header');
  header.className = 'app-bar ui-header';
  header.innerHTML = `<a class="ui-brand" href="codex.html">Codex Musica</a><nav aria-label="Main sections">${[
    ['genre', 'Genre', 'library'],
    ['instrument', 'Instrument', 'music'],
    ['map', 'Map', 'globe'],
    ['lyrics', 'Lyrics', 'edit-3'],
  ]
    .map(([v, l, i]) => `<button data-view="${v}">${icon(i, 20)}<span>${l}</span></button>`)
    .join(
      ''
    )}</nav><div class="ui-tools"><button id="ui-undo" data-ui="undo" aria-label="Undo">${icon('undo', 18)}</button><button id="ui-redo" data-ui="redo" aria-label="Redo">${icon('redo', 18)}</button>${uiButton('save', 'Save', 'save')}${uiButton('saved', 'Saved', 'folder')}${uiButton('session', 'Recipe', 'layers', 'aria-expanded="false" aria-controls="workspace-sidebar"')}<span id="ui-count">0</span>${uiButton('menu', 'More', 'more-horizontal')}</div>`;
  document.body.prepend(header);
  const more = document.createElement('div');
  more.id = 'ui-menu';
  more.hidden = true;
  more.innerHTML =
    uiButton('surprise', 'Surprise me', 'shuffle') +
    uiButton('saved', 'Saved sessions', 'folder') +
    uiButton('undo', 'Undo', 'undo') +
    uiButton('redo', 'Redo', 'redo') +
    uiButton('export', 'Export session', 'download') +
    uiButton('import', 'Import session', 'upload') +
    uiButton('credits', 'Credits', 'info') +
    '<input type="file" id="ui-file" accept="application/json" hidden>';
  header.append(more);
  const discovery = document.createElement('section');
  discovery.id = 'discovery';
  discovery.innerHTML = `<section class="ui-surface" id="surface-genre"><div class="discovery-toolbar"><label class="ui-search">${icon('search', 20)}<input id="genre-search" type="search" placeholder="Search genres" aria-label="Search genres"></label>${uiButton('genre-tree', 'Browse tree', 'list')}${uiButton('ai', 'AI recipe', 'message-circle')}</div><div id="genre-body"></div></section><section class="ui-surface" id="surface-instrument" hidden><div class="discovery-toolbar"><label class="ui-search">${icon('search', 20)}<input id="instrument-search" type="search" placeholder="Search instruments" aria-label="Search instruments"></label><label class="destination">Add to<select id="instrument-destination" aria-label="Add instrument to"></select></label></div><div id="instrument-preview" hidden></div><div id="instrument-body"></div></section><section class="ui-surface" id="surface-map" hidden><iframe id="map-frame" title="World music map"></iframe></section><section class="ui-surface" id="surface-lyrics" hidden><div class="lyrics-toolbar">${uiButton('new-lyrics', 'New lyrics', 'edit-3')}${uiButton('edit-lyrics', 'Edit lyrics', 'edit-3')}${uiButton('attach-recipe', 'Use current recipe', 'layers')}${uiButton('copy-lyrics', 'Copy lyrics', 'copy')}</div><div class="lyrics-workspace"><div class="lyrics-editor"><label for="lyrics-draft">Lyrics</label><textarea id="lyrics-draft" placeholder="Write here, or ask the lyrics writer." spellcheck="true"></textarea></div><div id="lyrics-chat"></div></div></section>`;
  const workspace = document.querySelector('main.workspace');
  workspace.insertBefore(discovery, $ui('workspace-detail'));
  const assistant = document.createElement('aside');
  assistant.id = 'assistant-slot';
  assistant.setAttribute('aria-label', 'AI recipe writer');
  assistant.innerHTML = `<div class="assistant-toolbar"><strong>AI recipe</strong>${uiButton('new-recipe', 'New recipe', 'plus')}${uiButton('close-ai', 'Close', 'x')}</div>`;
  assistant.append($ui('chat-dock'));
  document.body.append(assistant);
  const quick = document.createElement('div');
  quick.className = 'session-actions';
  quick.innerHTML =
    uiButton('ai', 'AI recipe', 'message-circle') +
    uiButton('genre-nav', 'Add genre', 'plus') +
    uiButton('instrument-nav', 'Add instrument', 'plus') +
    uiButton('close-session', 'Close recipe', 'x');
  $ui('workspace-sidebar').prepend(quick);
  // Keep native action nodes, so save, keyboard proxies and assistive labels share one implementation.
  for (const [id, target, label] of [
    ['btn-undo', '#ui-undo', 'Undo'],
    ['btn-redo', '#ui-redo', 'Redo'],
    ['btn-save', '[data-ui="save"]', 'Save'],
    ['btn-saved', '[data-ui="saved"]', 'Saved'],
    ['btn-add', '[data-ui="instrument-nav"]', 'Add instrument'],
    ['btn-traditions', '[data-ui="genre-nav"]', 'Add genre'],
    ['btn-attributions', '[data-ui="credits"]', 'Credits'],
  ]) {
    const node = $ui(id),
      placeholder = document.querySelector(target);
    node.className = '';
    node.removeAttribute('data-tooltip');
    node.setAttribute('aria-label', label);
    node.innerHTML = placeholder.innerHTML;
    placeholder.replaceWith(node);
  }
  oldHeader.remove();
  $ui('app-more-menu')?.remove();
  // Preserve the original browse tree, filters, editor and save controls. Browsing
  // opens in an inline surface rather than a modal with a focus trap.
  // A row selection opens the editor beside discovery (inside the recipe sheet on phones).
  $ui('workspace-sidebar').addEventListener('click', (e) => {
    if (e.target.closest('.sb-card')) {
      UI.editor = true;
      uiSync();
    }
  });
  document.addEventListener('click', async (e) => {
    const nav = e.target.closest('button[data-view]');
    if (nav) {
      uiNavigate(nav.dataset.view);
      return;
    }
    if (!e.target.closest('#ui-menu,[data-ui=menu]')) uiSetMenu(false);
    const b = e.target.closest('[data-ui]');
    if (!b) return;
    const a = b.dataset.ui,
      id = b.dataset.id;
    switch (a) {
      case 'genre-branch':
        UI.genre = null;
        UI.genreNode = id;
        UI.limit = 50;
        $ui('genre-search').value = '';
        renderGenreDiscovery();
        break;
      case 'genre-back':
        UI.genreNode = getTreeNode(UI.genreNode)?.parent || '';
        renderGenreDiscovery();
        break;
      case 'genre-select':
        UI.genre = id;
        renderGenreWeb(id);
        $ui('surface-genre').scrollTop = 0;
        break;
      case 'genre-close':
        UI.genre = null;
        renderGenreDiscovery();
        break;
      case 'genre-add':
        await uiAddGenre(id);
        break;
      case 'genre-nav':
        UI.genre = null;
        uiNavigate('genre');
        break;
      case 'instrument-nav':
        app._addToTradition = null;
        uiNavigate('instrument');
        break;
      case 'instrument-family':
        UI.instrumentFamily = id;
        UI.instrumentClass = '';
        UI.limit = 50;
        renderInstrumentDiscovery();
        break;
      case 'instrument-class':
        UI.instrumentClass = id;
        UI.limit = 50;
        renderInstrumentDiscovery();
        break;
      case 'instrument-back':
        if (UI.instrumentClass) UI.instrumentClass = '';
        else UI.instrumentFamily = '';
        renderInstrumentDiscovery();
        break;
      case 'instrument-filter':
        app.instrumentAxisFilters.has(id)
          ? app.instrumentAxisFilters.delete(id)
          : app.instrumentAxisFilters.add(id);
        renderInstrumentDiscovery();
        break;
      case 'clear-filters':
        app.instrumentAxisFilters.clear();
        renderInstrumentDiscovery();
        break;
      case 'instrument-add':
        await uiAddInstrument(id);
        break;
      case 'instrument-inspect':
        uiInspectInstrument(id);
        break;
      case 'close-preview':
        $ui('instrument-preview').hidden = true;
        break;
      case 'more':
        UI.limit += 50;
        UI.view === 'genre' ? renderGenreDiscovery() : renderInstrumentDiscovery();
        break;
      case 'genre-tree': {
        const tree = $ui('modal-trad');
        if (tree.parentElement !== $ui('genre-body')) $ui('genre-body').replaceChildren(tree);
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
        break;
      }
      case 'undo':
        undo();
        uiSync();
        break;
      case 'redo':
        redo();
        uiSync();
        break;
      case 'close-editor':
        UI.editor = false;
        uiSync();
        break;
      case 'save':
        $ui('btn-save').click();
        break;
      case 'saved':
        $ui('btn-saved').click();
        uiSetMenu(false);
        break;
      case 'session':
        document.body.classList.toggle('session-open');
        document
          .querySelector('[data-ui="session"]')
          .setAttribute('aria-expanded', String(document.body.classList.contains('session-open')));
        break;
      case 'close-session':
        document.body.classList.remove('session-open');
        document.querySelector('[data-ui="session"]').setAttribute('aria-expanded', 'false');
        document.querySelector('[data-ui="session"]').focus({ preventScroll: true });
        break;
      case 'menu':
        $ui('ui-menu').hidden = !$ui('ui-menu').hidden;
        b.setAttribute('aria-expanded', String(!$ui('ui-menu').hidden));
        if (!$ui('ui-menu').hidden) $ui('ui-menu').querySelector('button')?.focus();
        break;
      case 'surprise':
        surpriseTradition();
        uiSetMenu(false);
        break;
      case 'view-running':
        uiNavigate('genre');
        document.body.classList.add('assistant-open');
        break;
      case 'keep-session':
        UI.storageConflict = false;
        $ui('storage-conflict')?.remove();
        UI.lastSaved = null;
        uiAutosave();
        break;
      case 'export':
        uiExport();
        uiSetMenu(false);
        break;
      case 'import':
        $ui('ui-file').click();
        break;
      case 'credits':
        $ui('btn-attributions').click();
        uiSetMenu(false);
        break;
      case 'ai':
        uiChatOpen();
        break;
      case 'close-ai':
        document.body.classList.remove('assistant-open');
        break;
      case 'new-recipe':
        uiNewTask('recipe');
        break;
      case 'new-lyrics':
        uiNewTask('lyrics');
        break;
      case 'edit-lyrics':
        if (!uiNewTask('lyrics-edit')) break;
        $ui('chat-input').value = 'Edit these lyrics:\n' + $ui('lyrics-draft').value;
        break;
      case 'attach-recipe':
        if (!uiSwitchChat('lyrics')) {
          showToast('Wait for the active recipe request to finish.', 'error');
          break;
        }
        $ui('chat-input').value =
          'Write lyrics for this recording recipe:\n' +
          compileRecipeStack(app.cards, 'rich', { ceiling: 1000 });
        $ui('chat-input').focus();
        break;
      case 'copy-lyrics':
        copyToClipboard($ui('lyrics-draft').value, 'Lyrics copied', 'Could not copy');
        break;
    }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('svg [role="button"]')) {
      e.preventDefault();
      e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    if (e.key === 'Escape') {
      const wasSessionOpen = document.body.classList.contains('session-open');
      const wasMenuOpen = !$ui('ui-menu').hidden;
      document.body.classList.remove('session-open', 'assistant-open');
      UI.editor = false;
      uiSync();
      uiSetMenu(false);
      document.querySelector('[data-ui="session"]').setAttribute('aria-expanded', 'false');
      if (wasMenuOpen) document.querySelector('[data-ui="menu"]').focus({ preventScroll: true });
      else if (wasSessionOpen)
        document.querySelector('[data-ui="session"]').focus({ preventScroll: true });
    }
  });
  $ui('genre-search').addEventListener('input', () => {
    UI.genre = null;
    UI.limit = 50;
    renderGenreDiscovery();
  });
  $ui('instrument-search').addEventListener('input', () => {
    UI.limit = 50;
    renderInstrumentDiscovery();
  });
  $ui('ui-file').addEventListener('change', (e) => {
    if (e.target.files[0]) uiImport(e.target.files[0]);
    e.target.value = '';
  });
  $ui('lyrics-draft').addEventListener('input', uiSaveLyrics);
  $ui('lyrics-draft').addEventListener('blur', () => pushHistory());
  uiRestoreSession();
  window.addEventListener('storage', (e) => {
    if (e.key === 'codex-workbench-v1' && e.newValue !== UI.lastSaved) {
      UI.storageConflict = true;
      uiShowStorageConflict();
    }
  });
  // Never hide AI on an offline or unavailable status response.
  $ui('chat-dock').hidden = false;
  const status = document.createElement('div');
  status.id = 'ai-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Connecting…';
  $ui('chat-form').before(status);
  uiCheckAI();

  const domain = $ui('chat-domain');
  domain.addEventListener('change', uiUpdatePrompt);
  uiUpdatePrompt();
  window.addEventListener('message', async (e) => {
    if (e.origin !== location.origin || e.source !== $ui('map-frame').contentWindow) return;
    if (e.data?.type === 'add-genre' && typeof e.data.id === 'string') {
      const ok = await uiAddGenre(e.data.id);
      e.source.postMessage({ type: 'genre-added', id: e.data.id, ok: !!ok }, location.origin);
    }
    if (e.data?.type === 'genre-web' && typeof e.data.id === 'string') {
      UI.genre = e.data.id;
      uiNavigate('genre');
    }
  });
  UI.ready = true;
  renderAll();
  uiNavigate(location.hash.slice(1) || 'genre');
}

function uiReceiveReply(payload, request) {
  if (!UI.ready) return;
  const node = $ui('chat-log').lastElementChild;
  if (!node) return;
  if (payload.artifact) {
    const artifact = payload.artifact;
    const text =
      typeof artifact.text === 'string'
        ? artifact.text
        : Array.isArray(artifact.final_draft)
          ? artifact.final_draft.join('\n')
          : null;
    if (text !== null) {
      const apply = () => {
        app.lyrics = text;
        $ui('lyrics-draft').value = text;
        uiSaveLyrics();
        pushHistory();
        showToast('Lyrics loaded. Undo restores your draft.', 'success');
      };
      if (
        request?.request_id === UI.lyricRequest?.id &&
        UI.lyricRequest?.revision === UI.lyricRevision &&
        UI.lyricRequest?.text === (app.lyrics || '')
      ) {
        apply();
      } else {
        const use = document.createElement('button');
        use.className = 'btn btn-primary';
        use.textContent = 'Use these lyrics';
        use.onclick = apply;
        node.append(use);
      }
    }
  }
  if (payload.recipe && payload.workspace?.cards) {
    const source = JSON.parse(JSON.stringify(payload.workspace.cards));
    const use = document.createElement('button');
    use.className = 'btn btn-primary';
    use.innerHTML = icon('plus', 16) + ' Use recipe';
    use.onclick = () => {
      try {
        app.cards = normalizeWorkspaceCards(source, true);
        pushHistory();
        renderAll();
        showToast('Recipe loaded. Undo restores your previous recipe.', 'success');
      } catch (e) {
        showToast(e.message, 'error');
      }
    };
    node.append(use);
  }
}

const UI_ICONS = {
  globe:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-earth" aria-hidden="true"><path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"></path><path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"></path><path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"></path><circle cx="12" cy="12" r="10"></circle></svg>',
  layers:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layers" aria-hidden="true"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"></path><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"></path><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"></path></svg>',
  'message-circle':
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path></svg>',
  'edit-3':
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pen-line" aria-hidden="true"><path d="M13 21h8"></path><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path></svg>',
  library:
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-library-big" aria-hidden="true"><rect width="8" height="18" x="3" y="3" rx="1"></rect><path d="M7 3v18"></path><path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z"></path></svg>',
};

function uiOpenSurface(id) {
  if (id === 'modal-add') {
    if (app.similarInstFor) {
      const target = app.similarInstFor;
      app.similarInstFor = null;
      uiInspectInstrument(target);
      return true;
    }
    UI.instrumentFamily = '';
    UI.instrumentClass = '';
    $ui('instrument-search').value = '';
    uiNavigate('instrument');
    $ui('instrument-search').focus();
    return true;
  }
  if (id === 'modal-trad') {
    UI.genre = app.similarFor || null;
    app.similarFor = null;
    uiNavigate('genre');
    return true;
  }
  return false;
}

function uiRestoreSession() {
  try {
    const shared = localStorage.getItem('codex-workbench-v1');
    const recovery = sessionStorage.getItem('codex-workbench-recovery');
    if (recovery && shared && recovery !== shared) UI.storageConflict = true;
    const saved = JSON.parse(
      recovery ||
        shared ||
        localStorage.getItem('musica-workbench-v3') ||
        localStorage.getItem('musica-study-v1') ||
        'null'
    );
    app.lyrics =
      typeof saved?.lyrics === 'string'
        ? saved.lyrics
        : (localStorage.getItem('musica-lyrics-v3') ??
          JSON.parse(localStorage.getItem('musica-writing-v1') || '{}').lyrics ??
          '');
    $ui('lyrics-draft').value = app.lyrics;
    if (saved && !app.cards.length) {
      app.cards = normalizeWorkspaceCards(saved.cards || saved.workspace?.cards);
      app.workspaceName = saved.name || saved.title || 'Untitled session';
    }
    app.history = [];
    app.historyIndex = -1;
    pushHistory();
  } catch {
    UI.storageConflict = true;
    showToast('Saved session needs recovery. Export this session before replacing it.', 'error');
  }
}
function uiAutosave() {
  if (!UI.ready) return;
  const data = JSON.stringify({
    version: 1,
    name: app.workspaceName,
    cards: app.cards.map((c) => ({ ...c, ..._CARD_TRANSIENTS })),
    lyrics: app.lyrics || '',
  });
  if (data === UI.lastSaved) return;
  try {
    sessionStorage.setItem('codex-workbench-recovery', data);
    if (UI.storageConflict) {
      uiShowStorageConflict();
      return;
    }
    localStorage.setItem('codex-workbench-v1', data);
    UI.lastSaved = data;
    UI.saveFailed = false;
  } catch {
    UI.saveFailed = true;
    showToast('Autosave failed. Export your session to keep it.', 'error');
  }
}
function uiShowStorageConflict() {
  if ($ui('storage-conflict')) return;
  const note = document.createElement('div');
  note.id = 'storage-conflict';
  note.setAttribute('role', 'status');
  note.innerHTML =
    '<span>A newer session is open in another tab.</span>' +
    uiButton('keep-session', 'Keep this session', 'save') +
    uiButton('export', 'Export this session', 'download');
  document.querySelector('.ui-header').after(note);
}
function uiLyricsWaiting() {
  if ($ui('lyrics-wait')) return;
  const note = document.createElement('div');
  note.id = 'lyrics-wait';
  note.innerHTML =
    '<p>Your recipe request is still running.</p>' +
    uiButton('view-running', 'View request', 'message-circle');
  $ui('lyrics-chat').append(note);
}
async function uiCheckAI() {
  const status = $ui('ai-status');
  if (!status) return;
  status.textContent = 'Connecting…';
  try {
    const response = await fetch(CHAT_BACKEND + '/chat/status', {
      signal: AbortSignal.timeout(15000),
    });
    const info = await response.json();
    if (!response.ok)
      throw Error(
        response.status === 403
          ? 'This address is not enabled by the AI service.'
          : 'The AI service is temporarily unavailable.'
      );
    if (!info.ok || info.enabled === false)
      throw Error('The AI service is temporarily unavailable.');
    status.textContent = '';
  } catch (e) {
    status.textContent =
      e.name === 'TypeError'
        ? 'Cannot connect to the AI service. Check your connection.'
        : e.message;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.onclick = uiCheckAI;
    status.append(retry);
  }
}

function uiSetMenu(open) {
  const menu = $ui('ui-menu'),
    trigger = document.querySelector('[data-ui="menu"]');
  if (menu) menu.hidden = !open;
  if (trigger) trigger.setAttribute('aria-expanded', String(open));
}
