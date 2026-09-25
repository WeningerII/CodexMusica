/* exported UI, UI_ICONS, uiEmptyState, uiFind, uiFocus, uiStart, uiReceiveReply, uiOpenSurface, uiSync, uiRegisterPage, uiAddGenre, uiAddInstrument, uiNewTask, uiSaveLyrics, uiExport, uiImport */
/* global UILayout */
/* global Inst, Tradition, UITheme, _chatPersistedState, surpriseTradition, CHAT_BACKEND, CHAT_STORAGE_KEY, _CARD_TRANSIENTS, _addedInstrumentMessage, _chatRecover, _chatReset, _chatSetBusy, _chatSyncCount, addInstrumentFromPicker, app, chatState, esc, icon, importTraditionWithFeedback, isMobileLayout, normalizeWorkspaceCards, pushHistory, redo, renderAll, renderDetail, showToast, undo, uiInspectInstrument, uiLyricsWaiting */
/* The shared application shell: one header, one navigation, one recipe
   workspace and session, one AI writer, one set of panels. Built alongside the
   canonical app (src/app.js) and catalog, which stay the only engine.

   OWNERSHIP. This file, src/theme.css, src/theme.js, src/layout.js/.css and
   src/index.template.html belong to the shell integration owner. The four
   pages live in src/pages/<page>.js (+ .css) and register themselves with
   uiRegisterPage(); see docs/ui-foundation.md for the page interface. */
'use strict';
const UI = {
  lyricRevision: 0,
  lyricRequest: null,
  lastSaved: null,
  storageConflict: false,
  saveFailed: false,
  view: 'genre',
  // Genre page state (owned by src/pages/genre.js).
  genreNode: '',
  genre: null,
  // Instrument page state (owned by src/pages/instrument.js).
  instrumentFamily: '',
  instrumentClass: '',
  // Catalog paging shared by the Genre and Instrument lists.
  limit: 50,
  busy: false,
  editor: false,
  ready: false,
  // What the autosave last did: '' (nothing yet), 'saved', 'conflict' or
  // 'failed'. Rendered by uiRenderAutosave; never claims a named save.
  autosave: '',
  // Focus return: what opened the AI writer, and the instrument preview.
  assistantOpener: null,
  instrumentPreview: null,
  // Set on the way down when a dialog owns this Escape (see uiEscape).
  escapeOwned: false,
};
// The four sections, in order. Navigation is a shell concern: pages register
// behaviour for a route; they never add, remove or reorder routes.
// Each icon keeps one meaning and one colour on every route and in both
// themes (--cm-route-* in src/theme.css); the word always travels with it.
const UI_ROUTES = [
  ['genre', 'Genre', 'tag'],
  ['instrument', 'Instrument', 'guitar'],
  ['map', 'Map', 'map-pin'],
  ['lyrics', 'Lyrics', 'file-text'],
];
const UI_PAGES = {};
const UI_PAGE_ACTIONS = {};
// Actions the shell's own click handler owns. A page that registers one of
// these names would silently never run, so registration refuses it.
const UI_SHELL_ACTIONS = new Set([
  'genre-add',
  'genre-nav',
  'instrument-nav',
  'instrument-add',
  'more',
  'undo',
  'redo',
  'close-editor',
  'save',
  'saved',
  'session',
  'close-session',
  'menu',
  'reset-layout',
  'surprise',
  'keep-session',
  'export',
  'import',
  'credits',
  'ai',
  'close-ai',
  'new-recipe',
  'theme',
  'recipe-collapse',
]);
// Page interface (docs/ui-foundation.md has the full contract):
//   id            one of UI_ROUTES
//   recipe?       'sidebar' (default) or 'dock': how Your recipe is presented
//   mount(surface)  build the page once inside <section id="surface-<id>">
//   render?()     show current state; called on every visit and refresh
//   layout?()     page-specific UILayout panes, called once after the shell's
//   resetLayout?()  extra work for Reset layout (the Map tells its iframe)
//   escape?()     close what this page opened (last in the Escape order)
//   actions?      { [data-ui name]: (id, button, event) => void | Promise }
function uiRegisterPage(page) {
  if (!UI_ROUTES.some(([id]) => id === page.id)) throw Error('Unknown route: ' + page.id);
  if (UI_PAGES[page.id]) throw Error('Route registered twice: ' + page.id);
  for (const name of Object.keys(page.actions || {})) {
    if (UI_SHELL_ACTIONS.has(name) || UI_PAGE_ACTIONS[name])
      throw Error('Action already owned: ' + name);
    UI_PAGE_ACTIONS[name] = page.actions[name];
  }
  UI_PAGES[page.id] = page;
}
const $ui = (id) => document.getElementById(id);
const uiButton = (act, label, ic = 'plus', extra = '') =>
  `<button type="button" data-ui="${act}" ${extra.includes('aria-label=') ? '' : `aria-label="${esc(label)}"`} ${extra}>${icon(ic, 18)}<span>${esc(label)}</span></button>`;
// Empty, no-results, loading and failure states share one shape: what is
// true now, and the actions that move on from it. tone 'danger' = a failure.
const uiEmptyState = ({ title, text = '', actions = '', tone = '' }) =>
  `<div class="cm-empty"${tone ? ` data-tone="${tone}"` : ''} role="status"><strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ''}${actions ? `<div class="cm-empty-actions">${actions}</div>` : ''}</div>`;
const listenLink = (name, instrument = false) =>
  `<a class="listen" href="https://www.youtube.com/results?search_query=${encodeURIComponent(name + (instrument ? ' musical instrument solo demonstration' : ' music'))}" target="_blank" rel="noopener noreferrer" aria-label="Listen to ${esc(name)} on YouTube">${icon('play', 16)}<span>Listen</span></a>`;
// `push` is set only for a user's own navigation, so Back and Forward step
// between sections; boot and deep links replace the entry instead.
function uiNavigate(view, { push = false } = {}) {
  if (!UI_PAGES[view]) return;
  UI.view = view;
  document.body.dataset.view = view;
  if (/^https?:$/.test(location.protocol) && location.hash !== '#' + view) {
    if (push) history.pushState(null, '', '#' + view);
    else history.replaceState(null, '', '#' + view);
  }
  uiApplyRecipeMode();
  document.querySelectorAll('button[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
    b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
  });
  document.querySelectorAll('.ui-surface').forEach((el) => {
    el.hidden = el.id !== 'surface-' + view;
  });
  UI_PAGES[view].render?.();
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
  UILayout.refresh();
  document.querySelector(`[data-view="${view}"]`)?.focus({ preventScroll: true });
}
// ── Recipe panel ── #workspace-sidebar is the one recipe workspace on every
// route: the same cards, the same editor (#workspace-detail) and the same
// commands. A page only chooses how it is presented: page.recipe is
// 'sidebar' (the default) or 'dock' (a resizable strip under the page).
// Below 900px it is always the Recipe sheet. Collapsing is a remembered
// layout preference per presentation, cleared by Reset layout.
const uiRecipeCollapsed = {};
function uiRecipeMode() {
  return UI_PAGES[UI.view]?.recipe || 'sidebar';
}
function uiApplyRecipeMode() {
  const mode = uiRecipeMode();
  const collapsed = !!uiRecipeCollapsed[mode]?.get();
  document.body.dataset.recipe = mode;
  document.body.classList.toggle('recipe-collapsed', collapsed);
  const toggle = document.querySelector('[data-ui="recipe-collapse"]');
  if (toggle) {
    const label = (collapsed ? 'Expand' : 'Collapse') + ' Your recipe';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', label);
    toggle.dataset.tooltip = label;
    toggle.innerHTML = icon(
      mode === 'dock'
        ? collapsed
          ? 'panel-bottom'
          : 'chevron-down'
        : collapsed
          ? 'panel-left-open'
          : 'panel-left-close',
      18
    );
  }
  UILayout.refresh();
}
function uiRecipePanelSetup() {
  const panel = $ui('workspace-sidebar');
  const head = document.createElement('div');
  head.className = 'recipe-panel-head';
  head.innerHTML = `<h2 class="recipe-panel-title">${icon('layers', 18)}<span>Your recipe</span></h2><span class="recipe-panel-meta" id="recipe-panel-meta"></span><button type="button" class="cm-btn cm-btn-icon" data-ui="recipe-collapse" aria-controls="workspace-sidebar"></button>`;
  panel.prepend(head);
  const empty = document.createElement('div');
  empty.id = 'recipe-empty';
  empty.className = 'cm-empty';
  empty.hidden = true;
  empty.innerHTML = `<strong>No instruments yet</strong><span>Add a genre to bring in its whole ensemble, or add single instruments. Every addition can be undone.</span><div class="cm-empty-actions">${uiButton('genre-nav', 'Browse genres', 'tag')}${uiButton('surprise', 'Surprise me', 'shuffle')}</div>`;
  $ui('sidebar-header').after(empty);
  for (const mode of ['sidebar', 'dock'])
    uiRecipeCollapsed[mode] = UILayout.remember('recipe-collapsed-' + mode, false, () =>
      uiApplyRecipeMode()
    );
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
  const n = app.cards.length;
  $ui('recipe-panel-meta').textContent = n + (n === 1 ? ' instrument' : ' instruments');
  $ui('recipe-empty').hidden = n > 0;
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
  UILayout.refresh();
}
function uiOpenEditor(id) {
  app.selected = id;
  UI.editor = true;
  renderDetail();
  uiSync();
  if (isMobileLayout()) document.body.classList.add('session-open');
}
// ── Recipe commands ── The only ways a page adds to the shared recipe. Both
// run the canonical engine (importTraditionWithFeedback / addInstrumentFromPicker)
// and refuse a second concurrent addition rather than interleaving two.
// uiAddGenre resolves to { added, expected }: how many instruments were added
// and how many the genre's configured ensemble has (added 0 = nothing added).
async function uiAddGenre(id) {
  const expected = (Tradition(id)?.instruments || []).length;
  if (UI.busy) {
    showToast('An addition is already in progress.', 'error');
    return { added: 0, expected };
  }
  UI.busy = true;
  try {
    const added = await importTraditionWithFeedback(id);
    UI.editor = false;
    uiSync();
    UI_PAGES.genre?.render?.();
    return { added: added.length, expected };
  } catch (e) {
    showToast(e.message || 'Could not add genre', 'error');
    return { added: 0, expected };
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
// ── Session ── One session: cards, name and lyrics, in the formats below.
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
// ── AI writer ── One conversation dock shared by the recipe and lyrics writers.
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
  // A script write fires no `input` event; see _chatSyncCount in src/app.js.
  _chatSyncCount();
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
  // One brand asset: the approved mark (assets/icon-192.png, pinned by
  // scripts/build_favicon.js) beside the wordmark, in both themes.
  header.innerHTML = `<a class="ui-brand" href="codex.html" aria-label="Codex Musica"><img class="ui-brand-mark" src="assets/icon-192.png" alt="" width="28" height="28"><span class="ui-brand-name">Codex Musica</span></a><nav aria-label="Main sections">${UI_ROUTES.map(
    ([v, l, i]) =>
      `<button class="cm-tab" data-view="${v}">${icon(i, 20)}<span>${l}</span></button>`
  ).join(
    ''
  )}</nav><div class="ui-tools"><button id="ui-undo" data-ui="undo" aria-label="Undo">${icon('undo', 18)}</button><button id="ui-redo" data-ui="redo" aria-label="Redo">${icon('redo', 18)}</button><span id="ui-autosave" class="cm-status" role="status" aria-live="polite"></span>${uiButton('save', 'Save', 'save')}${uiButton('saved', 'Saved sessions', 'folder')}${uiButton('session', 'Recipe', 'layers', 'aria-expanded="false" aria-controls="workspace-sidebar"')}<span id="ui-count">0</span>${uiButton('menu', 'More', 'more-horizontal')}</div>`;
  document.body.prepend(header);
  const more = document.createElement('div');
  more.id = 'ui-menu';
  more.className = 'cm-menu';
  more.hidden = true;
  more.innerHTML =
    uiButton('surprise', 'Surprise me', 'shuffle') +
    uiButton('saved', 'Saved sessions', 'folder') +
    uiButton('undo', 'Undo', 'undo') +
    uiButton('redo', 'Redo', 'redo') +
    uiButton('export', 'Export session', 'download') +
    uiButton('import', 'Import session', 'upload') +
    uiButton('credits', 'Credits', 'info') +
    uiButton('reset-layout', 'Reset layout', 'refresh-cw') +
    '<div class="cm-menu-sep" role="separator"></div>' +
    uiThemeControl() +
    '<input type="file" id="ui-file" accept="application/json" hidden>';
  header.append(more);
  const discovery = document.createElement('section');
  discovery.id = 'discovery';
  for (const [id] of UI_ROUTES) {
    const surface = document.createElement('section');
    surface.className = 'ui-surface';
    surface.id = 'surface-' + id;
    surface.hidden = id !== 'genre';
    discovery.append(surface);
  }
  const workspace = document.querySelector('main.workspace');
  workspace.insertBefore(discovery, $ui('workspace-detail'));
  for (const [id] of UI_ROUTES) UI_PAGES[id]?.mount($ui('surface-' + id));
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
  uiRecipePanelSetup();
  // Keep native action nodes, so save, keyboard proxies and assistive labels share one implementation.
  for (const [id, target, label] of [
    ['btn-undo', '#ui-undo', 'Undo'],
    ['btn-redo', '#ui-redo', 'Redo'],
    ['btn-save', '[data-ui="save"]', 'Save'],
    ['btn-saved', '[data-ui="saved"]', 'Saved sessions'],
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
  // Undo/Redo step through this session (recipe, name, lyrics). Text fields
  // keep their own Ctrl/Cmd+Z; the shortcut reaches the session only outside them.
  $ui('btn-undo').dataset.tooltip = 'Undo the last session change (Ctrl/Cmd+Z)';
  $ui('btn-redo').dataset.tooltip = 'Redo (Ctrl/Cmd+Shift+Z)';
  $ui('btn-save').dataset.tooltip = 'Save a named copy of this session';
  oldHeader.remove();
  $ui('app-more-menu')?.remove();
  UITheme.onChange(uiSyncThemeControl);
  uiSyncThemeControl();
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
      uiNavigate(nav.dataset.view, { push: true });
      return;
    }
    if (!e.target.closest('#ui-menu,[data-ui=menu]')) uiSetMenu(false);
    const b = e.target.closest('[data-ui]');
    if (!b) return;
    const a = b.dataset.ui,
      id = b.dataset.id;
    switch (a) {
      case 'genre-add':
        await uiAddGenre(id);
        break;
      case 'genre-nav':
        UI.genre = null;
        uiNavigate('genre', { push: true });
        break;
      case 'instrument-nav':
        app._addToTradition = null;
        uiNavigate('instrument', { push: true });
        break;
      case 'instrument-add':
        await uiAddInstrument(id);
        break;
      case 'more':
        UI.limit += 50;
        UI_PAGES[UI.view]?.render?.();
        break;
      case 'undo':
        undo();
        uiSync();
        break;
      case 'redo':
        redo();
        uiSync();
        break;
      case 'close-editor':
        uiCloseEditor();
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
        UILayout.refresh();
        if (!$ui('ui-menu').hidden) $ui('ui-menu').querySelector('button')?.focus();
        break;
      case 'reset-layout':
        UILayout.reset();
        for (const [route] of UI_ROUTES) UI_PAGES[route]?.resetLayout?.();
        uiSetMenu(false);
        showToast('Layout reset', 'success');
        break;
      case 'surprise':
        surpriseTradition();
        uiSetMenu(false);
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
        UI.assistantOpener = b;
        uiChatOpen();
        break;
      case 'close-ai':
        document.body.classList.remove('assistant-open');
        uiFocus(UI.assistantOpener) || uiFocus(document.querySelector(`[data-view="${UI.view}"]`));
        break;
      case 'new-recipe':
        uiNewTask('recipe');
        break;
      case 'theme':
        UITheme.set(id);
        uiSyncThemeControl();
        break;
      case 'recipe-collapse': {
        const pref = uiRecipeCollapsed[uiRecipeMode()];
        pref.set(!pref.get());
        uiApplyRecipeMode();
        b.focus({ preventScroll: true });
        break;
      }
      default:
        await UI_PAGE_ACTIONS[a]?.(id, b, e);
    }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('svg [role="button"]')) {
      e.preventDefault();
      e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    if (e.key === 'Escape') uiEscape(e);
  });
  // Dialogs (src/app.js) close on the same Escape before this handler runs, so
  // whether one was open is read on the way down, before they react.
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape')
        UI.escapeOwned = !!document.querySelector(
          '.modal-bg.open:not(.inline-tree), .confirm-dialog-bg'
        );
    },
    true
  );
  window.addEventListener('hashchange', () => {
    const view = location.hash.slice(1);
    if (UI_PAGES[view] && view !== UI.view) uiNavigate(view);
  });
  $ui('ui-file').addEventListener('change', (e) => {
    if (e.target.files[0]) uiImport(e.target.files[0]);
    e.target.value = '';
  });
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
  UI.ready = true;
  uiLayoutControls();
  renderAll();
  // codex.html?trad=<id> (the standalone atlas links here) opens that
  // tradition's Genre detail. It adds nothing by itself: Add stays explicit,
  // so a reload or a shared link can never duplicate an ensemble.
  const deep = new URLSearchParams(location.search).get('trad');
  if (deep && Tradition(deep)) {
    UI.genre = deep;
    uiNavigate('genre');
  } else uiNavigate(location.hash.slice(1) || 'genre');
}

// ── Layers ── Escape closes the topmost open layer only and returns focus to
// whatever opened it: a dialog (src/app.js handles those), then the More
// menu, the AI writer, the Recipe sheet (below 900px), the editor, and last
// whatever the current page opened (page.escape()).
function uiFocus(el) {
  if (!el || !el.isConnected || !el.getClientRects().length) return false;
  el.focus({ preventScroll: true });
  return true;
}
// The first element matching `selector` whose dataset[key] is `value`.
function uiFind(selector, key, value) {
  if (!value) return null;
  return [...document.querySelectorAll(selector)].find((el) => el.dataset[key] === value) || null;
}
function uiFocusCard(id) {
  return uiFocus(uiFind('.sb-card', 'cardId', id));
}
function uiCloseEditor() {
  const id = app.selected;
  UI.editor = false;
  uiSync();
  uiFocusCard(id);
}
function uiEscape(e) {
  if (e.defaultPrevented || UI.escapeOwned) return;
  if (document.documentElement.classList.contains('layout-dragging')) return;
  const body = document.body;
  if (!$ui('ui-menu').hidden) {
    uiSetMenu(false);
    uiFocus(document.querySelector('[data-ui="menu"]'));
  } else if (body.classList.contains('assistant-open')) {
    body.classList.remove('assistant-open');
    uiFocus(UI.assistantOpener) || uiFocus(document.querySelector(`[data-view="${UI.view}"]`));
  } else if (body.classList.contains('session-open')) {
    body.classList.remove('session-open');
    UI.editor = false;
    uiSync();
    document.querySelector('[data-ui="session"]').setAttribute('aria-expanded', 'false');
    uiFocus(document.querySelector('[data-ui="session"]'));
  } else if (body.classList.contains('editor-open')) {
    uiCloseEditor();
  } else {
    UI_PAGES[UI.view]?.escape?.();
  }
}
function uiLayoutControls() {
  UILayout.tooltips();
  const workspace = document.querySelector('.workspace');
  const sidebar = $ui('workspace-sidebar'),
    detail = $ui('workspace-detail');
  UILayout.anchor($ui('ui-menu'), document.querySelector('[data-ui="menu"]'), { align: 'end' });
  UILayout.splitter({
    container: workspace,
    panel: sidebar,
    key: 'sidebar',
    property: '--sidebar-width',
    title: 'Resize recipe sidebar',
    limits: () => [220, Math.min(520, innerWidth * 0.35)],
    enabled: () =>
      innerWidth >= 900 && uiRecipeMode() === 'sidebar' && !uiRecipeCollapsed.sidebar?.get(),
  });
  UILayout.splitter({
    container: workspace,
    panel: detail,
    key: 'detail',
    property: '--detail-width',
    title: 'Resize instrument editor',
    side: 'left',
    limits: () => [320, Math.min(700, innerWidth * 0.45)],
    enabled: () => innerWidth >= 900 && document.body.classList.contains('editor-open'),
  });
  // The docked presentation (the Map) resizes from its top edge.
  UILayout.splitter({
    container: workspace,
    panel: sidebar,
    key: 'dock',
    property: '--dock-height',
    title: 'Resize Your recipe',
    side: 'top',
    limits: () => [300, Math.max(300, Math.round(workspace.clientHeight * 0.7))],
    enabled: () => innerWidth >= 900 && uiRecipeMode() === 'dock' && !uiRecipeCollapsed.dock?.get(),
  });
  for (const [route] of UI_ROUTES) UI_PAGES[route]?.layout?.();
  UILayout.floating($ui('assistant-slot'), {
    key: 'assistant',
    title: 'AI recipe panel',
    header: '.assistant-toolbar',
    onChange: (floating) => document.body.classList.toggle('assistant-floating', floating),
  });
  document.querySelectorAll('.modal-bg > .modal').forEach((panel) => {
    if (['modal-add', 'modal-trad', 'modal-confirm'].includes(panel.parentElement.id)) return;
    UILayout.floating(panel, {
      key: panel.parentElement.id,
      title: panel.querySelector('h2')?.textContent || 'dialog',
      header: '.modal-head',
    });
  });
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

// Shell icons not in the vendored Lucide subset (references/08_asset_manifest.js).
// Lucide, ISC licence, as credited in the Credits dialog. icon() resizes them.
const uiSvg = (paths) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
const UI_ICONS = {
  tag: uiSvg(
    '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"></path><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"></circle>'
  ),
  'map-pin': uiSvg(
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle>'
  ),
  'file-text': uiSvg(
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path>'
  ),
  // width="20.0", not "20": icon() rewrites every width="20" to the requested size.
  monitor: uiSvg(
    '<rect width="20.0" height="14" x="2" y="3" rx="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path>'
  ),
  sun: uiSvg(
    '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>'
  ),
  moon: uiSvg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>'),
  'circle-check': uiSvg('<circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path>'),
  'panel-left-close': uiSvg(
    '<rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path><path d="m16 15-3-3 3-3"></path>'
  ),
  'panel-left-open': uiSvg(
    '<rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path><path d="m14 9 3 3-3 3"></path>'
  ),
  'panel-bottom': uiSvg(
    '<rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M3 15h18"></path>'
  ),
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
      uiRenderAutosave('conflict');
      return;
    }
    localStorage.setItem('codex-workbench-v1', data);
    UI.lastSaved = data;
    UI.saveFailed = false;
    uiRenderAutosave('saved');
  } catch {
    UI.saveFailed = true;
    uiRenderAutosave('failed');
    showToast('Autosave failed. Export your session to keep it.', 'error');
  }
}
// Autosave, Save and Saved sessions are three different things: this status
// reports only the automatic copy of the open session in this browser.
const UI_AUTOSAVE_STATES = {
  saved: [
    'success',
    'circle-check',
    'Autosaved',
    'This session is saved automatically in this browser. Save makes a named copy.',
  ],
  conflict: [
    'warning',
    'triangle-alert',
    'Not autosaved',
    'Another tab changed the autosaved session. This tab keeps a recovery copy: keep this session or export it.',
  ],
  failed: [
    'danger',
    'circle-alert',
    'Autosave failed',
    'The browser refused to store this session. Export it to keep it.',
  ],
};
function uiRenderAutosave(state) {
  UI.autosave = state;
  const el = $ui('ui-autosave'),
    def = UI_AUTOSAVE_STATES[state];
  if (!el || !def || el.dataset.state === state) return;
  el.dataset.state = state;
  el.dataset.tone = def[0];
  el.dataset.tooltip = def[3];
  el.innerHTML = `${icon(def[1], 16)}<span class="ui-autosave-text">${esc(def[2])}</span>`;
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

// ── Theme ── One setting (Light, Dark or System), stored by src/theme.js and
// shared with the atlas. It lives in the More menu on every route.
const UI_THEME_CHOICES = [
  ['system', 'System', 'monitor'],
  ['light', 'Light', 'sun'],
  ['dark', 'Dark', 'moon'],
];
function uiThemeControl() {
  return `<div class="cm-menu-label" id="ui-theme-label">Theme</div><div class="cm-segmented ui-theme" role="group" aria-labelledby="ui-theme-label">${UI_THEME_CHOICES.map(
    ([id, label, ic]) =>
      `<button type="button" data-ui="theme" data-id="${id}" aria-pressed="false">${icon(ic, 16)}<span>${label}</span></button>`
  ).join('')}</div>`;
}
function uiSyncThemeControl() {
  const current = UITheme.preference();
  document.querySelectorAll('[data-ui="theme"]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.id === current));
  });
}
function uiSetMenu(open) {
  const menu = $ui('ui-menu'),
    trigger = document.querySelector('[data-ui="menu"]');
  if (menu) menu.hidden = !open;
  if (trigger) trigger.setAttribute('aria-expanded', String(open));
}
