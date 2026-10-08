/* exported UI, UI_ICONS, uiEmptyState, uiFind, uiFocus, uiStart, uiReceiveReply, uiOpenSurface, uiSync, uiRegisterPage, uiAddGenre, uiAddInstrument, uiNewTask, uiSaveLyrics, uiExport, uiImport, uiRecipeGenres, uiCount, uiTabIndex, uiDownload */
/* global UILayout */
/* global lyricMetaOf, ChainItem, renderSidebar, Room, Tuning, compileRecipeStack, envCardOf, renderSidebarTraditions, _revealSelectedCard, Inst, Tradition, UITheme, _chatPersistedState, surpriseTradition, CHAT_BACKEND, CHAT_STORAGE_KEY, _CARD_TRANSIENTS, _addedInstrumentMessage, _chatRecover, _chatReset, _chatSetBusy, _chatSyncCount, addInstrumentFromPicker, app, chatState, esc, icon, importTraditionWithFeedback, isMobileLayout, normalizeWorkspaceCards, pushHistory, redo, renderAll, renderDetail, showToast, undo, uiInspectInstrument, uiLyricsWaiting, _engineLive, engineReady, storedSessionText */
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
// How a route presents Your recipe (docs/ui-foundation.md): a column on the
// left, a column on the right, or a strip under the page.
const UI_RECIPE_MODES = ['sidebar', 'sidebar-right', 'dock'];
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
  'recipe-env',
  'recipe-open-editor',
  'recipe-filter',
  'lightbox',
  'rows-scroll',
  'rows-jump',
  'tile-credit',
  'recipe-remove',
]);
// Page interface (docs/ui-foundation.md has the full contract):
//   id            one of UI_ROUTES
//   recipe?       'sidebar' (default, left), 'sidebar-right' or 'dock': how
//                 Your recipe is presented on this route (UI_RECIPE_MODES)
//   mount(surface)  build the page once inside <section id="surface-<id>">
//   render?()     show current state; called on every visit and refresh
//   layout?()     page-specific UILayout panes, called once after the shell's
//   resetLayout?()  extra work for Reset layout (the Map tells its iframe)
//   escape?()     close what this page opened (last in the Escape order)
//   actions?      { [data-ui name]: (id, button, event) => void | Promise }
function uiRegisterPage(page) {
  if (!UI_ROUTES.some(([id]) => id === page.id)) throw Error('Unknown route: ' + page.id);
  if (UI_PAGES[page.id]) throw Error('Route registered twice: ' + page.id);
  if (page.recipe !== undefined && !UI_RECIPE_MODES.includes(page.recipe))
    throw Error('Unknown recipe presentation: ' + page.recipe);
  for (const name of Object.keys(page.actions || {})) {
    if (UI_SHELL_ACTIONS.has(name) || UI_PAGE_ACTIONS[name])
      throw Error('Action already owned: ' + name);
    UI_PAGE_ACTIONS[name] = page.actions[name];
  }
  UI_PAGES[page.id] = page;
}
const $ui = (id) => document.getElementById(id);
// The genres in Your recipe, in first-card order.
const uiRecipeGenres = () => [...new Set(app.cards.map((c) => c.traditionId).filter(Boolean))];
// A count and its noun ("1 genre", "1,000 lines"): one plural rule for
// every page.
const uiCount = (n, one, many = one + 's') =>
  (typeof n === 'number' ? n.toLocaleString('en') : String(n)) + ' ' + (n === 1 ? one : many);
// WAI-ARIA tabs: Left/Right move (wrapping), Home/End jump. The index the key
// moves to among `count` tabs from `index`, or -1 for any other key.
const uiTabIndex = (key, index, count) =>
  key === 'Home'
    ? 0
    : key === 'End'
      ? count - 1
      : key === 'ArrowRight' || key === 'ArrowLeft'
        ? (index + (key === 'ArrowRight' ? 1 : -1) + count) % count
        : -1;
// Save text as a file the browser downloads.
function uiDownload(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const uiButton = (act, label, ic = 'plus', extra = '') =>
  `<button type="button" data-ui="${act}" ${extra.includes('aria-label=') ? '' : `aria-label="${esc(label)}"`} ${extra}>${icon(ic, 18)}<span>${esc(label)}</span></button>`;
// Empty, no-results, loading and failure states share one shape: what is
// true now, and the actions that move on from it. tone 'danger' = a failure.
const uiEmptyState = ({ title, text = '', actions = '', tone = '' }) =>
  `<div class="cm-empty"${tone ? ` data-tone="${tone}"` : ''} role="status"><strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ''}${actions ? `<div class="cm-empty-actions">${actions}</div>` : ''}</div>`;
const listenHref = (name, instrument = false) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(name + (instrument ? ' musical instrument solo demonstration' : ' music'))}`;
const listenLink = (name, instrument = false) =>
  `<a class="listen" href="${listenHref(name, instrument)}" target="_blank" rel="noopener noreferrer" aria-label="Listen to ${esc(name)} on YouTube">${icon('play', 16)}<span>Listen</span></a>`;
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
// 'sidebar' (a column on the left, the default), 'sidebar-right' (a column on
// the right) or 'dock' (a resizable strip under the page). Below 900px it is
// always the Recipe sheet. Collapsing is a remembered layout preference per
// presentation, cleared by Reset layout.
//
// The panel reads, top to bottom: Your recipe + Autosaved; the session name
// and "n genres · m instruments"; each genre with its instrument rows (Edit
// and a … menu per row, src/app.js renders them); Add another genre / Add
// independent instrument; Suggestions for this recipe; Recording environment
// (from the card the recipe's environment really comes from, envCardOf);
// Recipe preview with its format, count, Open full recipe and Copy recipe;
// and the AI recipe entry. The dock lays the same pieces side by side.
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
    const glyph = {
      dock: collapsed ? 'panel-bottom' : 'chevron-down',
      'sidebar-right': collapsed ? 'panel-right-open' : 'panel-right-close',
      sidebar: collapsed ? 'panel-left-open' : 'panel-left-close',
    }[mode];
    toggle.innerHTML = icon(glyph, 18);
  }
  uiPlaceRecipeParts();
  UILayout.refresh();
}
// Arranges the shell's own pieces of the panel for the current presentation.
// The same nodes move; nothing is copied, so every handler stays attached.
//   phone      Add genre / Add instrument ride the sheet's top toolbar, where
//              a thumb reaches them without scrolling the recipe.
//   dock       the session name, counts and AI recipe sit in the header row,
//              and Suggestions + Recording environment form the middle column.
//   otherwise  the name under the header; Add, Suggestions and Recording
//              environment follow the genres in the scrolling column.
function uiPlaceRecipeParts() {
  const panel = $ui('workspace-sidebar');
  if (!panel || !$ui('recipe-add-row')) return;
  const phone = isMobileLayout();
  const dock = !phone && uiRecipeMode() === 'dock';
  const actions = $ui('recipe-actions');
  const addHost = phone ? actions : $ui('recipe-add-row');
  const before = phone ? actions.querySelector('[data-ui="close-session"]') : null;
  for (const id of ['btn-traditions', 'btn-add']) {
    const node = $ui(id);
    if (node && (node.parentElement !== addHost || phone)) addHost.insertBefore(node, before);
  }
  uiLabelAddButtons(phone);
  const session = $ui('recipe-session');
  const header = $ui('sidebar-header'),
    meta = $ui('recipe-panel-meta');
  if (dock) {
    if (header.parentElement !== session) session.append(header, meta);
  } else if (header.parentElement === session) {
    panel.insertBefore(header, $ui('recipe-empty'));
    panel.insertBefore(meta, $ui('recipe-empty'));
  }
  // The dock is a compact strip (the map stays prominent): AI recipe rides
  // its header row; the full "Describe a change" field is the sidebar's.
  const ai = $ui('recipe-ai');
  if (dock) {
    if (ai.parentElement !== session.parentElement)
      session.parentElement.insertBefore(ai, document.querySelector('.recipe-open-editor'));
  } else if (ai.previousElementSibling !== $ui('sidebar-recipe-preview')) {
    $ui('sidebar-recipe-preview').after(ai);
  }
  const context = $ui('recipe-context');
  if (dock) {
    if (context.parentElement !== panel) panel.insertBefore(context, $ui('sidebar-recipe-preview'));
  } else if (context.parentElement !== $ui('sidebar-scroll')) {
    $ui('sidebar-scroll').append(context);
  }
}
// The two native add controls (#btn-traditions, #btn-add) keep their ids and
// handlers wherever they sit; only the words follow the place and the recipe.
function uiLabelAddButtons(phone = isMobileLayout()) {
  const genres = uiRecipeGenres().length;
  const set = (id, text, label) => {
    const node = $ui(id);
    if (!node) return;
    const html = `${icon('plus', 18)}<span>${esc(text)}</span>`;
    if (node.innerHTML !== html) node.innerHTML = html;
    node.setAttribute('aria-label', label);
  };
  set(
    'btn-traditions',
    phone ? 'Add genre' : genres ? 'Add another genre' : 'Add a genre',
    genres ? 'Add another genre' : 'Add a genre'
  );
  set(
    'btn-add',
    phone ? 'Add instrument' : 'Add independent instrument',
    'Add an independent instrument'
  );
}
function uiRecipePanelSetup() {
  const panel = $ui('workspace-sidebar');
  const head = document.createElement('div');
  head.className = 'recipe-panel-head';
  head.innerHTML =
    `<h2 class="recipe-panel-title"><span>Your recipe</span></h2>` +
    `<div class="recipe-session" id="recipe-session"></div>` +
    // A mirror of the header's autosave status (#ui-autosave stays the one
    // live region); src/workbench.css shows one of the two, never both.
    `<span id="recipe-autosave" class="cm-status recipe-autosave" hidden></span>` +
    `<button type="button" class="cm-btn cm-btn-outline recipe-open-editor" data-ui="recipe-open-editor">${icon('maximize-2', 16)}<span>Open full editor</span></button>` +
    // Filter instruments: the field under the header, shown on request (and
    // whenever a filter is in force, so a filtered tree always says so).
    `<button type="button" class="cm-btn cm-btn-icon recipe-filter-toggle" data-ui="recipe-filter" aria-controls="sidebar-filter" aria-expanded="false" aria-label="Filter instruments" data-tooltip="Filter instruments">${icon('search', 18)}</button>` +
    `<button type="button" class="cm-btn cm-btn-icon" data-ui="recipe-collapse" aria-controls="workspace-sidebar"></button>`;
  panel.prepend(head);
  const meta = document.createElement('p');
  meta.id = 'recipe-panel-meta';
  meta.className = 'recipe-panel-meta';
  $ui('sidebar-header').after(meta);
  const empty = document.createElement('div');
  empty.id = 'recipe-empty';
  empty.className = 'cm-empty';
  empty.hidden = true;
  empty.innerHTML = `<strong>No instruments yet</strong><span>Add a genre to bring in its whole ensemble, or add single instruments. Every addition can be undone.</span><div class="cm-empty-actions">${uiButton('genre-nav', 'Browse genres', 'tag')}${uiButton('surprise', 'Surprise me', 'shuffle')}</div>`;
  meta.after(empty);
  // After the genres: the two add controls (moved in by uiPlaceRecipeParts).
  const add = document.createElement('div');
  add.id = 'recipe-add-row';
  add.className = 'recipe-add-row';
  $ui('sidebar-traditions').after(add);
  // Suggestions (src/app.js renders #sidebar-staple) and Recording
  // environment travel together: after the genres, or the dock's middle column.
  const context = document.createElement('div');
  context.id = 'recipe-context';
  context.className = 'recipe-context';
  const env = document.createElement('section');
  env.id = 'recipe-env';
  env.className = 'recipe-env';
  env.setAttribute('aria-labelledby', 'recipe-env-title');
  context.append($ui('sidebar-staple'), env);
  add.after(context);
  // The AI recipe entry: the shared writer, started from this recipe.
  const ai = document.createElement('form');
  ai.id = 'recipe-ai';
  ai.className = 'recipe-ai';
  ai.setAttribute('aria-label', 'AI recipe');
  ai.innerHTML =
    `<button type="button" class="recipe-ai-open" data-ui="ai" aria-label="AI recipe" data-tooltip="Open the AI recipe writer">${icon('sparkles', 16)}<span>AI recipe</span></button>` +
    `<div class="recipe-ai-field"><input type="text" id="recipe-ai-input" class="cm-input" maxlength="4000" autocomplete="off" aria-label="Describe a change to this recipe" placeholder="Describe a change to this recipe…">` +
    `<button type="submit" class="cm-btn cm-btn-icon recipe-ai-send" aria-label="Send to the AI recipe writer" data-tooltip="Send to the AI recipe writer">${icon('send', 18)}</button></div>`;
  $ui('sidebar-recipe-preview').after(ai);
  ai.addEventListener('submit', (e) => {
    e.preventDefault();
    uiRecipeAskAI(e.submitter || ai.querySelector('.recipe-ai-send'));
  });
  for (const mode of UI_RECIPE_MODES)
    // The Lyrics page is the one 'sidebar' page; its recipe starts folded so
    // the song gets the width. A person's own choice is remembered as before.
    uiRecipeCollapsed[mode] = UILayout.remember(
      'recipe-collapsed-' + mode,
      mode === 'sidebar',
      () => uiApplyRecipeMode()
    );
  // Crossing 900px moves the add controls between the sheet and the panel.
  matchMedia('(max-width: 899px)').addEventListener?.('change', () => uiPlaceRecipeParts());
}
// Sends "Describe a change to this recipe…" to the one recipe writer. The
// writer keeps its own conversation, so the request carries the current
// recipe with it (as the Lyrics page's "Use current recipe" does); what comes
// back is offered with the writer's own "Use recipe", which Undo reverses.
function uiRecipeAskAI(opener) {
  const input = $ui('recipe-ai-input');
  const wish = input.value.trim();
  UI.assistantOpener = opener;
  if (!wish) {
    uiChatOpen();
    return;
  }
  if (chatState.busy) {
    showToast('A request is running. Its progress remains in the conversation.', 'error');
    uiChatOpen();
    return;
  }
  if (!uiChatOpen()) return;
  const domain = $ui('chat-domain');
  if (!chatState.task && domain.value === 'recipe-browse') domain.value = 'recipe';
  const current = app.cards.length ? compileRecipeStack(app.cards, 'rich', { ceiling: 1000 }) : '';
  $ui('chat-input').value = current
    ? `Change this recording recipe: ${wish}\n\nCurrent recipe:\n${current}`
    : wish;
  _chatSyncCount();
  input.value = '';
  $ui('chat-form').requestSubmit();
}
// "Recording environment": room, tuning and signal chain of the card the
// recipe's environment is rendered from — envCardOf, the same rule every
// output format uses — named with its instrument and genre.
const UI_ENV_ROWS = [
  ['room', 'Room', 'house', 'env'],
  ['tuning', 'Tuning', 'tuning-fork', 'env'],
  ['chain', 'Signal chain', 'settings', 'chain'],
];
function uiRecipeEnvHTML() {
  const card = envCardOf(app.cards);
  if (!card) return '';
  const inst = Inst(card.instrumentId),
    trad = card.traditionId ? Tradition(card.traditionId) : null;
  const who = esc((inst && (inst.name || inst.short)) || card.instrumentId);
  const has = !!(
    card.room ||
    card.tuning ||
    Object.values(card.chain || {}).some((v) => (Array.isArray(v) ? v.length : v))
  );
  // Every set stage, in chain order; the summary names each by its kind
  // ("Ribbon") or its name without the parenthesis, the tooltip in full.
  const stages = CHAIN_SECTIONS.flatMap((sec) =>
    (sec.multiSelect ? card.chain?.[sec.id] || [] : [card.chain?.[sec.id]].filter(Boolean))
      .map((id) => ChainItem(sec.id, id))
      .filter(Boolean)
  );
  const values = {
    room: card.room ? Room(card.room)?.name : '',
    tuning: card.tuning ? Tuning(card.tuning)?.name : '',
    chain: stages.map((it) => it.family || it.name.replace(/\s*\(.*\)\s*$/, '')).join(' · '),
  };
  const full = stages.map((it) => it.name).join(' · ');
  const rows = UI_ENV_ROWS.map(([id, label, ic, tab]) => {
    const value = values[id];
    const title = id === 'chain' && stages.length ? ` data-tooltip="${esc(full)}"` : '';
    return `<button type="button" class="recipe-env-row" data-ui="recipe-env" data-id="${id}" data-tab="${tab}" aria-label="${label}: ${esc((id === 'chain' ? full : value) || 'Not set')}. Edit in ${tab === 'chain' ? 'Signal chain' : 'Environment'}"${title}><span class="recipe-env-icon" data-kind="${id}">${icon(ic, 18)}</span><span class="recipe-env-label">${label}</span><span class="recipe-env-value${value ? '' : ' is-unset'}">${esc(value || 'Not set')}</span>${icon('chevron-right', 16)}</button>`;
  }).join('');
  const source = has
    ? `From ${who}${trad ? ` · ${esc(trad.name)}` : ' · independent'}`
    : `Not set on any instrument yet. Set it on ${who}.`;
  return (
    `<div class="recipe-env-head"><h3 id="recipe-env-title">Recording environment</h3>` +
    `<button type="button" class="cm-btn cm-btn-icon" data-ui="recipe-env" data-id="env" data-tab="env" aria-label="Edit the recording environment" data-tooltip="Edit the recording environment">${icon('pencil', 16)}</button></div>` +
    `<div class="recipe-env-rows">${rows}</div>` +
    `<p class="recipe-env-source" data-tooltip="Every recipe format renders the room, tuning and signal chain of this one card">${source}</p>`
  );
}
// Opens the shared editor on the environment's source card, at the tab (and,
// for Room and Tuning, the open picker) that the row names.
function uiOpenEnvironment(which) {
  const card = envCardOf(app.cards);
  if (!card) return;
  card._uiTab = which === 'chain' ? 'chain' : 'env';
  card.editingEnv = which === 'room' || which === 'tuning' ? which : null;
  uiOpenEditor(card.id);
  if (isMobileLayout()) {
    renderSidebarTraditions();
    _revealSelectedCard();
  } else if (card.editingEnv) {
    document
      .querySelector(`#detail-view [data-toggle-env="${card.editingEnv}"]`)
      ?.scrollIntoView({ block: 'start' });
  }
}
function uiSyncRecipeFilter() {
  const toggle = document.querySelector('[data-ui="recipe-filter"]');
  if (app.sidebarFilter) document.body.classList.add('recipe-filter-open');
  const open = document.body.classList.contains('recipe-filter-open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.hidden = app.cards.length === 0;
}
function uiRecipeSummary() {
  return `${uiCount(uiRecipeGenres().length, 'genre')} · ${uiCount(app.cards.length, 'instrument')}`;
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
  document.body.classList.toggle('recipe-is-empty', n === 0);
  $ui('recipe-panel-meta').textContent = n ? uiRecipeSummary() : '';
  uiSyncRecipeFilter();
  document.querySelector('[data-ui="recipe-open-editor"]').disabled = n === 0;
  $ui('recipe-empty').hidden = n > 0;
  $ui('recipe-context').hidden = n === 0;
  const env = uiRecipeEnvHTML();
  if ($ui('recipe-env')._html !== env) {
    $ui('recipe-env').innerHTML = env;
    $ui('recipe-env')._html = env;
  }
  $ui('recipe-ai-input').placeholder = n
    ? 'Describe a change to this recipe…'
    : 'Describe the recording you want…';
  uiLabelAddButtons();
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
// uiAddInstrument(id, { configure, message, destination }) resolves to the
// added card, or null when nothing was added (another addition running, or a
// failure, which it reports). destination is the genre the card joins ('' for
// none); left out, it is the Instrument page's #instrument-destination.
// configure(card) runs on the new card before its history entry, so a
// configured addition is one Undo; message(card) words the success toast.
async function uiAddInstrument(id, { configure, message, destination } = {}) {
  if (UI.busy) return null;
  UI.busy = true;
  try {
    const dest = destination !== undefined ? destination : $ui('instrument-destination')?.value;
    app._addToTradition = dest || null;
    const retry = {
      label: 'Retry',
      run: () => uiAddInstrument(id, { configure, message, destination: dest || '' }),
    };
    const c = await addInstrumentFromPicker(id, { configure, retry });
    // No card while the instrument data could not load: engineReady has said so.
    if (!c) {
      if (!_engineLive) return null;
      throw Error('Instrument unavailable');
    }
    renderAll();
    uiOpenEditor(c.id);
    showToast(message ? message(c) : _addedInstrumentMessage(id, c), 'success');
    return c;
  } catch (e) {
    showToast(e.message || 'Could not add the instrument', 'error');
    return null;
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
    lyricMeta: lyricMetaOf(app.lyricMeta),
  };
  uiDownload('codex-musica-session.json', JSON.stringify(p, null, 2), 'application/json');
}
async function uiImport(file) {
  if (!_engineLive && !(await engineReady({ label: 'Retry', run: () => uiImport(file) }))) return;
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
    app.lyricMeta = lyricMetaOf(s.lyricMeta);
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
  // The Recipe sheet's toolbar on a phone (hidden in the desktop panel, where
  // the AI entry and the add controls have their own places).
  const quick = document.createElement('div');
  quick.id = 'recipe-actions';
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
      case 'recipe-filter': {
        // Closing the field clears what it filtered, so no row stays hidden
        // behind a control that is no longer on screen.
        const open = !document.body.classList.contains('recipe-filter-open');
        document.body.classList.toggle('recipe-filter-open', open);
        if (!open && app.sidebarFilter) {
          app.sidebarFilter = '';
          renderSidebar();
        }
        uiSyncRecipeFilter();
        if (open) $ui('sidebar-filter-input')?.focus();
        break;
      }
      case 'recipe-env':
        uiOpenEnvironment(id);
        break;
      case 'recipe-open-editor': {
        const card = app.cards.find((c) => c.id === app.selected) || app.cards[0];
        if (card) uiOpenEditor(card.id);
        uiFocus(document.querySelector('#detail-view .detail-tab.is-active'));
        break;
      }
      case 'recipe-collapse': {
        const pref = uiRecipeCollapsed[uiRecipeMode()];
        pref.set(!pref.get());
        uiApplyRecipeMode();
        b.focus({ preventScroll: true });
        break;
      }
      case 'lightbox':
        uiLightbox(b);
        break;
      case 'rows-scroll': {
        const t = uiFind('.cm-rows-track', 'rows', id);
        t?.scrollBy({ left: Number(b.dataset.dir) * t.clientWidth * 0.85, behavior: uiMotion() });
        break;
      }
      case 'rows-jump':
        uiRowsJump(b);
        break;
      case 'tile-credit':
        uiTileCredit(b);
        break;
      case 'recipe-remove':
        uiRemoveFromRecipe(b.dataset.kind, id, b.dataset.scope);
        break;
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
      uiRenderAutosave('conflict');
    }
  });
  // Never hide AI on an offline or unavailable status response.
  $ui('chat-dock').hidden = false;
  const status = document.createElement('div');
  status.id = 'ai-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Connecting…';
  $ui('chat-form').before(status);
  // After the first paint: a cross-origin status check started during boot
  // competes with the genre page's first render for the network and is
  // counted on the path to the largest paint. 'Connecting…' stays until then.
  uiAfterPaint(uiCheckAI);

  const domain = $ui('chat-domain');
  domain.addEventListener('change', uiUpdatePrompt);
  uiUpdatePrompt();
  UI.ready = true;
  uiLayoutControls();
  uiMenuControls();
  uiRowsControls();
  renderAll();
  // codex.html?trad=<id> (the standalone atlas links here) opens that
  // tradition's Genre detail. It adds nothing by itself: Add stays explicit,
  // so a reload or a shared link can never duplicate an ensemble. An explicit
  // route hash wins, and the link is consumed: left in the URL it would
  // reopen that genre on every reload, whatever page the user had moved to.
  const query = new URLSearchParams(location.search);
  const deep = query.get('trad');
  const route = location.hash.slice(1);
  if (deep !== null && /^https?:$/.test(location.protocol)) {
    query.delete('trad');
    const rest = query.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  }
  if (deep && !UI_PAGES[route] && Tradition(deep)) {
    UI.genre = deep;
    uiNavigate('genre');
  } else uiNavigate(route || 'genre');
}

// ── Layers ── Escape closes the topmost open layer only and returns focus to
// whatever opened it: an enlarged photo (uiLightbox, below, owns its own
// Escape), a dialog (src/app.js handles those), then the More
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

// ── Photo lightbox ── A catalog photo is a uiPhoto button around the page's
// own <img>: a click, Enter or Space shows it large over the dimmed page with
// its credit and licence, linked to the source page. One click anywhere,
// Escape or Back closes it (it is the topmost layer and owns that Escape) and
// focus returns to the photo. The thumb shows at once, scaled up; a larger
// copy replaces it when it loads, and if none loads the thumb stays. Nothing
// larger is requested before the click.
/* exported uiPhoto */
const uiPhoto = (img, { name, full = '', credit = '', href = '' }) =>
  `<button type="button" class="cm-photo" data-ui="lightbox" aria-label="Enlarge photo of ${esc(name)}" data-name="${esc(name)}" data-full="${esc(full)}" data-credit="${esc(credit)}" data-href="${esc(href)}">${img}</button>`;
const UI_LIGHTBOX_WIDTH = 1280;
let uiLightboxOpen = null,
  uiLightboxLeaving = false; // our own history.back() is on its way
// Larger copies, best first: a Commons thumb's 1280px rendition (Commons
// refuses one wider than the original, so the full image follows it), then
// the full image.
function uiPhotoSources(thumb, full) {
  const out = [];
  const m =
    /^(https:\/\/[a-z]+\.wikimedia\.org\/.+\/thumb\/.+\/(?:[a-z0-9-]*-)?)\d+px-([^/]+)$/i.exec(
      thumb
    );
  if (m) out.push(m[1] + UI_LIGHTBOX_WIDTH + 'px-' + m[2]);
  if (/^https:\/\//i.test(full) && full !== thumb) out.push(full);
  return out;
}
function uiLightboxNode() {
  let dialog = $ui('ui-lightbox');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'ui-lightbox';
  dialog.className = 'cm-lightbox';
  dialog.tabIndex = -1;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-describedby', 'ui-lightbox-caption');
  dialog.innerHTML = `<figure><img alt="" decoding="async"><figcaption id="ui-lightbox-caption"><span class="cm-lightbox-credit"></span><span class="cm-lightbox-hint">Click anywhere to close</span></figcaption></figure>`;
  // Any click closes it — the photo, its frame, the dimmed page. The credit
  // link still opens the source page in a new tab.
  dialog.addEventListener('click', uiCloseLightbox);
  dialog.addEventListener('keydown', (e) => {
    const enter = (e.key === 'Enter' || e.key === ' ') && e.target === dialog && !e.repeat;
    if (e.key !== 'Escape' && !enter) return;
    e.preventDefault();
    e.stopPropagation();
    uiCloseLightbox();
  });
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    uiCloseLightbox();
  });
  window.addEventListener('popstate', () => {
    if (uiLightboxLeaving) {
      uiLightboxLeaving = false; // the Back it took itself when it closed
      return;
    }
    if (!uiLightboxOpen) return;
    uiLightboxOpen.pushed = false; // Back already took its history entry
    uiCloseLightbox();
  });
  document.body.append(dialog);
  return dialog;
}
function uiLightbox(trigger) {
  const thumb = trigger.querySelector('img');
  if (!thumb || uiLightboxOpen || (thumb.complete && !thumb.naturalWidth)) return;
  const dialog = uiLightboxNode();
  const img = dialog.querySelector('img');
  const { name, full, credit, href } = trigger.dataset;
  const src = thumb.currentSrc || thumb.src;
  const larger = uiPhotoSources(src, full);
  const box = { trigger, key: thumb.getAttribute('src'), pushed: false };
  // The width the photo is shown at (never past a copy's natural size) and
  // its proportions; CSS fits that inside the viewport, uncropped.
  const size = (el, w, h) => {
    el.style.setProperty('--lb-w', Math.round(w));
    el.style.setProperty('--lb-h', Math.round(h));
  };
  const thumbSize = (t) => {
    const w = larger.length ? UI_LIGHTBOX_WIDTH : t.naturalWidth;
    size(img, w, (w * t.naturalHeight) / t.naturalWidth);
  };
  if (thumb.naturalWidth) thumbSize(thumb);
  else size(img, UI_LIGHTBOX_WIDTH, UI_LIGHTBOX_WIDTH * 0.75);
  img.onload = () => uiLightboxOpen === box && !box.large && thumbSize(img);
  img.src = src;
  img.alt = 'Photo of ' + name;
  dialog.setAttribute('aria-label', 'Photo of ' + name);
  dialog.querySelector('.cm-lightbox-credit').innerHTML = !credit
    ? ''
    : /^https:\/\//i.test(href)
      ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(credit)}</a>`
      : esc(credit);
  dialog.querySelector('.cm-lightbox-hint').textContent =
    (matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click') + ' anywhere to close';
  uiLightboxOpen = box;
  document.documentElement.classList.add('cm-lightbox-open');
  dialog.showModal();
  dialog.focus();
  // Back (a phone's back gesture) closes the photo, not the section.
  if (/^https?:$/.test(location.protocol)) {
    history.pushState(history.state, '');
    box.pushed = true;
  }
  const next = (i) => {
    if (i >= larger.length || uiLightboxOpen !== box) return;
    const probe = new Image();
    // The loaded copy itself takes the thumb's place: nothing is fetched twice.
    probe.onload = () => {
      if (uiLightboxOpen !== box) return;
      box.large = true;
      probe.alt = img.alt;
      size(probe, probe.naturalWidth, probe.naturalHeight);
      img.replaceWith(probe);
    };
    probe.onerror = () => next(i + 1);
    probe.src = larger[i];
  };
  next(0);
}
function uiCloseLightbox() {
  const box = uiLightboxOpen;
  if (!box) return;
  uiLightboxOpen = null;
  const dialog = $ui('ui-lightbox');
  dialog.close();
  dialog.querySelector('img').removeAttribute('src');
  document.documentElement.classList.remove('cm-lightbox-open');
  if (box.pushed) {
    uiLightboxLeaving = true;
    history.back();
  }
  // The photo that opened it, or the same photo if its page repainted.
  uiFocus(box.trigger) ||
    uiFocus(
      [...document.querySelectorAll('[data-ui="lightbox"]')].find(
        (b) => b.querySelector('img')?.getAttribute('src') === box.key
      )
    );
}
// ── Browse rows ── The Genre and Instrument pages' default layout: one
// horizontally scrolling row of cards per group (a letter, a family, a class).
// A card is a photo (or the catalog glyph) with the name and one line under it.
// The photo and the name open the page's own details; on hover or keyboard
// focus — always, on a touch screen — Listen, Add and the photo credit show
// over the photo, and ⋮ opens the same commands as a menu. A row gets its
// cards only when it comes near the screen, UI_ROWS_CHUNK at a time, and more
// as it is scrolled toward its end: first paint costs the rows in view.
// Pages build rows with uiRowsHTML (and a jump bar with uiRowsJumpHTML), and
// bracket a repaint with uiRowsKeep / uiRowsRestore so each row keeps its
// place, its length and the focused card control.
/* exported uiRowsHTML, uiRowsJumpHTML, uiRowsKeep, uiRowsRestore, uiTile, uiTilesPhotos, listenHref */
const UI_ROWS_CHUNK = 30;
const UI_ROWS = new Map(); // row key → { items, tile, sig }
const UI_TILE_RATIO = new Map(); // photo src → its width / height, clamped
const UI_TILE_FAILED = new Set(); // photo srcs that did not load
const UI_TILE_GLYPH = new Map(); // kind → (id) → the catalog glyph, drawn only when there is no photo
const uiTileRatio = (w, h) => Math.min(2.05, Math.max(0.86, w / h));
// The cards a card's Add and ✓ are about: a genre's cards; for an instrument,
// its cards in the group its Add goes to (`scope`: a genre id, '' for
// independent instruments), never the same instrument elsewhere.
const uiTileCards = (kind, id, scope) =>
  app.cards.filter((c) =>
    kind === 'genre'
      ? c.traditionId === id
      : c.instrumentId === id && (c.traditionId || '') === (scope || '')
  );
const uiTileWhere = (kind, scope) =>
  kind === 'genre'
    ? 'Your recipe'
    : scope
      ? (Tradition(scope)?.name || scope) + ' in Your recipe'
      : 'the independent instruments in Your recipe';
// The card's Add: the page's own add action, or ✓ (in Your recipe) that removes it.
// t: { kind, id, name, add, addLabel, scope }
function uiTileAdd(t) {
  const on = uiTileCards(t.kind, t.id, t.scope).length > 0;
  const data = `data-kind="${t.kind}" data-id="${esc(t.id)}" data-add="${t.add}" data-add-label="${esc(t.addLabel)}"${t.scope === undefined ? '' : ` data-scope="${esc(t.scope)}"`}`;
  return on
    ? `<span class="cm-tile-badge">In recipe</span><button type="button" class="cm-tile-add is-on" data-ui="recipe-remove" ${data} aria-label="Remove ${esc(t.name)} from ${esc(uiTileWhere(t.kind, t.scope))}">${icon('check', 18)}</button>`
    : `<button type="button" class="cm-tile-add" data-ui="${t.add}" ${data} aria-label="${esc(t.addLabel)}">${icon('plus', 18)}</button>`;
}
// o: { kind: 'genre' | 'instrument', id, name, sub, photo: { src, credit, href } | null,
//      glyph: (id) → html, open (the page action that opens the details), add, addLabel,
//      scope (instruments: the genre id their Add goes to, '' for independent) }
function uiTile(o) {
  UI_TILE_GLYPH.set(o.kind, o.glyph);
  const src = o.photo?.src && !UI_TILE_FAILED.has(o.photo.src) ? o.photo.src : '';
  const ratio = src ? UI_TILE_RATIO.get(src) || 4 / 3 : 1;
  const id = esc(o.id),
    name = esc(o.name);
  return (
    `<div class="cm-tile" role="listitem" data-tile="${o.kind}" data-id="${id}" style="--ar:${ratio.toFixed(3)}"><div class="cm-tile-shot${src ? '' : ' is-glyph'}">` +
    (src
      ? uiTilePhotoHTML(src, o.photo, o.name)
      : `<span class="cm-tile-glyph" aria-hidden="true">${o.glyph(o.id)}</span>`) +
    `<a class="cm-tile-play" href="${listenHref(o.name, o.kind === 'instrument')}" target="_blank" rel="noopener noreferrer" aria-label="Listen to ${name} on YouTube">${icon('play', 16)}</a>` +
    uiTileAdd(o) +
    `</div><div class="cm-tile-cap"><button type="button" class="cm-tile-name" data-ui="${o.open}" data-id="${id}" title="${name}">${name}</button><span class="cm-tile-sub" title="${esc(o.sub)}">${esc(o.sub)}</span><button type="button" class="cm-tile-more" data-menu-toggle aria-controls="cm-tile-menu" aria-haspopup="menu" aria-expanded="false" aria-label="More for ${name}">${icon('ellipsis-vertical', 18)}</button></div></div>`
  );
}
// A card's photo and, when it has one, the button that shows its credit.
function uiTilePhotoHTML(src, photo, name) {
  return (
    `<img class="cm-tile-img" src="${esc(src)}" alt="" loading="lazy" decoding="async">` +
    (photo.credit
      ? `<button type="button" class="cm-tile-credit" data-ui="tile-credit" data-credit="${esc(photo.credit)}" data-href="${esc(photo.href || '')}" aria-label="Photo credit for ${esc(name)}" data-tooltip="${esc(photo.credit)}">${icon('info', 14)}</button>`
      : '')
  );
}
// Photos that arrive after the cards are drawn go into those cards in place:
// the glyph gives way to the photo and nothing else in the card is rebuilt.
// Redrawing the list instead would replace the button under a pointer that is
// mid-press, and on a slow phone the photos land seconds after the list.
// photo(id) → { src, credit, href } | null, as uiTile takes it.
function uiTilesPhotos(root, kind, photo) {
  for (const shot of root?.querySelectorAll(
    `.cm-tile[data-tile="${kind}"] > .cm-tile-shot.is-glyph`
  ) || []) {
    const tile = shot.parentElement,
      p = photo(tile.dataset.id),
      glyph = shot.querySelector('.cm-tile-glyph');
    if (!p?.src || UI_TILE_FAILED.has(p.src) || !glyph) continue;
    shot.classList.remove('is-glyph');
    tile.style.setProperty('--ar', (UI_TILE_RATIO.get(p.src) || 4 / 3).toFixed(3));
    glyph.outerHTML = uiTilePhotoHTML(p.src, p, tile.querySelector('.cm-tile-name').textContent);
  }
}
// groups: [{ key, label, items }] (items carry .id); tile(item) → uiTile(...).
// `prefix` names the list, so a row's key is unique on the page. A row with no
// items is left out; `label: ''` draws the row without a heading.
function uiRowsHTML(prefix, groups, { tile, noun }) {
  return groups
    .filter((g) => g.items.length)
    .map((g) => {
      const key = prefix + ':' + g.key,
        label = esc(g.label || '');
      UI_ROWS.set(key, { items: g.items, tile, sig: g.items.map((x) => x.id).join() });
      const arrows = [
        [-1, 'chevron-left', 'back'],
        [1, 'chevron-right', 'on'],
      ]
        .map(
          ([dir, ic, way]) =>
            `<button type="button" data-ui="rows-scroll" data-id="${esc(key)}" data-dir="${dir}" aria-label="Scroll ${label || 'the row'} ${way}"${dir < 0 ? ' disabled' : ''}>${icon(ic, 18)}</button>`
        )
        .join('');
      return `<section class="cm-rows-group" data-rows="${esc(key)}"${label ? ` aria-label="${label}"` : ''}><div class="cm-rows-head">${label ? `<h3 class="cm-rows-label" tabindex="-1">${label}</h3><span class="cm-rows-count">${uiCount(g.items.length, noun)}</span>` : ''}<div class="cm-rows-nav">${arrows}</div></div><div class="cm-rows-track" role="list" data-rows="${esc(key)}"${label ? ` aria-label="${label}"` : ''}></div></section>`;
    })
    .join('');
}
// Buttons that scroll the page to each row, the one in view marked current.
// `short` is the button's text when the label is long; empty rows are disabled.
function uiRowsJumpHTML(prefix, groups, { label, noun }) {
  return `<nav class="cm-rows-jump" aria-label="${esc(label)}">${groups
    .map(
      (g) =>
        `<button type="button" data-ui="rows-jump" data-id="${esc(prefix + ':' + g.key)}" title="${esc(g.label)} · ${uiCount(g.items.length, noun)}"${g.items.length ? '' : ' disabled'}>${esc(g.short || g.label)}</button>`
    )
    .join('')}</nav>`;
}
function uiRowsKeep(host) {
  const rows = new Map();
  for (const t of host?.querySelectorAll('.cm-rows-track') || [])
    rows.set(t.dataset.rows, {
      left: t.scrollLeft,
      shown: t.childElementCount,
      sig: UI_ROWS.get(t.dataset.rows)?.sig,
    });
  const a = document.activeElement,
    tile = a?.closest?.('.cm-tile');
  const focus =
    tile && host?.contains(tile)
      ? { id: tile.dataset.id, part: [...a.classList].find((c) => c.startsWith('cm-tile-')) }
      : null;
  return { rows, focus };
}
function uiRowsAppend(t, upTo) {
  const row = UI_ROWS.get(t.dataset.rows);
  const from = t.childElementCount;
  if (row && upTo > from)
    t.insertAdjacentHTML(
      'beforeend',
      row.items
        .slice(from, upTo)
        .map((x) => row.tile(x))
        .join('')
    );
}
// A row near the screen and near its end takes its next cards; its arrows
// say whether it can move.
function uiRowsFill(t) {
  const row = UI_ROWS.get(t.dataset.rows);
  if (!row || !t.isConnected) return;
  const r = t.getBoundingClientRect();
  if (!r.height || r.top > Math.max(2 * innerHeight, 1800) || r.bottom < -innerHeight) return;
  if (t.scrollLeft + 2 * t.clientWidth >= t.scrollWidth)
    uiRowsAppend(t, t.childElementCount + UI_ROWS_CHUNK);
  const [back, on] = t.parentElement.querySelectorAll('[data-ui="rows-scroll"]');
  if (back) back.disabled = t.scrollLeft <= 1;
  if (on)
    on.disabled =
      t.scrollLeft + t.clientWidth >= t.scrollWidth - 1 && t.childElementCount >= row.items.length;
}
function uiRowsRestore(host, keep) {
  for (const t of host.querySelectorAll('.cm-rows-track')) {
    const was = keep?.rows.get(t.dataset.rows);
    if (was?.shown && was.sig === UI_ROWS.get(t.dataset.rows)?.sig) {
      uiRowsAppend(t, was.shown);
      t.scrollLeft = was.left;
    }
    uiRowsFill(t);
  }
  document.querySelectorAll('.cm-rows-jump').forEach(uiRowsEdges);
  // A card menu whose card was just repainted has nothing left to act on.
  if (uiMenuOpen?.menu.id === 'cm-tile-menu' && !uiMenuOpen.trigger.isConnected) uiCloseMenu(false);
  const f = keep?.focus;
  if (f && !host.contains(document.activeElement)) {
    const tile = [...host.querySelectorAll('.cm-tile')].find((el) => el.dataset.id === f.id);
    uiFocus(tile?.querySelector('.' + f.part));
  }
  uiRowsSpy();
}
// A jump bar wider than its box fades at the edge it continues past.
function uiRowsEdges(nav) {
  const more = nav.scrollWidth > nav.clientWidth + 1;
  nav.classList.toggle('is-more-start', more && nav.scrollLeft > 1);
  nav.classList.toggle(
    'is-more-end',
    more && nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1
  );
}
// The jump bar marks the last row whose top has passed under it.
function uiRowsSpy() {
  for (const nav of document.querySelectorAll('.cm-rows-jump')) {
    if (!nav.getClientRects().length) continue;
    const line = nav.getBoundingClientRect().bottom + 16;
    const rows = new Map(
      [...document.querySelectorAll('.cm-rows-group')].map((s) => [s.dataset.rows, s])
    );
    let cur = null;
    for (const b of nav.querySelectorAll('button:not(:disabled)')) {
      const sec = rows.get(b.dataset.id);
      if (sec && (!cur || sec.getBoundingClientRect().top <= line)) cur = b;
    }
    if (!cur || cur.getAttribute('aria-current') === 'true') continue;
    for (const b of nav.children) b.setAttribute('aria-current', String(b === cur));
    // A new current row brings its button into the bar's view (and only then,
    // so a hand scrolling the bar is not pulled back).
    if (nav.scrollWidth > nav.clientWidth) {
      const l =
        cur.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
      if (l < nav.scrollLeft || l + cur.offsetWidth > nav.scrollLeft + nav.clientWidth)
        nav.scrollLeft = l - (nav.clientWidth - cur.offsetWidth) / 2;
    }
  }
}
const uiMotion = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
function uiScrollParent(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if ((y === 'auto' || y === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return document.scrollingElement;
}
// Scroll so the row's heading sits just under the jump bar (sticky, with
// whatever sticks with it), wherever the bar is when it is clicked. Until that
// scroll settles the bar keeps the row it was asked for (the last rows cannot
// reach the top, and the rows passed on the way are not the answer).
let uiRowsJumping = 0;
const uiRowsSettle = (ms) => {
  clearTimeout(uiRowsJumping);
  uiRowsJumping = setTimeout(() => (uiRowsJumping = 0), ms);
};
function uiRowsJump(b) {
  const sec = uiFind('.cm-rows-group', 'rows', b.dataset.id);
  if (!sec) return;
  const nav = b.closest('.cm-rows-jump'),
    scroller = uiScrollParent(sec);
  let sticky = nav;
  for (let p = nav; p && p !== scroller; p = p.parentElement)
    if (getComputedStyle(p).position === 'sticky') sticky = p;
  const top = scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top;
  const stuck =
    top +
    (parseFloat(getComputedStyle(sticky).top) || 0) +
    nav.getBoundingClientRect().bottom -
    sticky.getBoundingClientRect().top;
  for (const x of nav.children) x.setAttribute('aria-current', String(x === b));
  uiRowsSettle(400);
  scroller.scrollBy({ top: sec.getBoundingClientRect().top - stuck - 8, behavior: uiMotion() });
  // The next Tab goes on into that row.
  sec.querySelector('.cm-rows-label')?.focus({ preventScroll: true });
}
// ✓ removes what the card's Add would have added — every card of a genre, or
// the instrument's cards in its scope — as one Undo step. The toast's Undo
// takes back only this removal, and only while it is still the latest change
// (as an addition's Undo does).
function uiRemoveFromRecipe(kind, id, scope) {
  const cards = uiTileCards(kind, id, scope);
  if (!cards.length) return;
  const name = (kind === 'genre' ? Tradition(id) : Inst(id))?.name || id;
  app.cards = app.cards.filter((c) => !cards.includes(c));
  pushHistory();
  const at = app.historyIndex;
  renderAll();
  uiSync();
  showToast(
    `Removed ${name} from ${uiTileWhere(kind, scope)}` +
      (cards.length > 1 ? ` (${cards.length} cards)` : ''),
    'success',
    {
      label: 'Undo',
      run: () => {
        if (app.historyIndex !== at) {
          showToast(
            'Later changes followed this removal. Use Undo in the header to step back.',
            'error'
          );
          return;
        }
        undo();
        uiSync();
      },
    }
  );
}
// Cards follow Your recipe: ✓ where it holds what their Add adds, + elsewhere.
function uiTilesSync() {
  for (const b of document.querySelectorAll('.cm-tile-add')) {
    const tile = b.closest('.cm-tile'),
      { id } = tile.dataset,
      { kind, scope, add, addLabel } = b.dataset;
    const on = uiTileCards(kind, id, scope).length > 0;
    if (on === b.classList.contains('is-on')) continue;
    const focused = document.activeElement === b;
    const name = tile.querySelector('.cm-tile-name').textContent;
    tile.querySelector('.cm-tile-badge')?.remove();
    b.outerHTML = uiTileAdd({ kind, id, name, add, addLabel, scope });
    if (focused) uiFocus(tile.querySelector('.cm-tile-add'));
  }
}
// The ⋮ menu: one menu for every card, filled from the card it opens on.
function uiTileMenu(menu, trigger) {
  const tile = trigger.closest('.cm-tile'),
    add = tile.querySelector('.cm-tile-add'),
    name = tile.querySelector('.cm-tile-name'),
    credit = tile.querySelector('.cm-tile-credit');
  const on = add.classList.contains('is-on');
  const item = (ui, label, ic, data) =>
    `<button type="button" role="menuitem" data-ui="${ui}" ${data}>${icon(ic, 18)}<span>${label}</span></button>`;
  const id = `data-id="${esc(tile.dataset.id)}"`;
  menu.setAttribute('aria-label', name.textContent);
  menu.innerHTML =
    item(
      add.dataset.ui,
      on ? 'Remove from recipe' : 'Add to recipe',
      on ? 'x' : 'plus',
      `${id} data-kind="${add.dataset.kind}"${add.dataset.scope === undefined ? '' : ` data-scope="${esc(add.dataset.scope)}"`}`
    ) +
    `<a role="menuitem" href="${esc(tile.querySelector('.cm-tile-play').href)}" target="_blank" rel="noopener noreferrer">${icon('play', 18)}<span>Listen on YouTube</span></a>` +
    item(name.dataset.ui, 'Details', 'eye', id) +
    (credit
      ? item(
          'tile-credit',
          'Photo credit',
          'info',
          `data-credit="${esc(credit.dataset.credit)}" data-href="${esc(credit.dataset.href)}"`
        )
      : '');
}
function uiTileCredit(b) {
  const href = b.dataset.href;
  showToast(
    b.dataset.credit,
    undefined,
    /^https:\/\//i.test(href)
      ? { label: 'Source', run: () => window.open(href, '_blank', 'noopener,noreferrer') }
      : undefined
  );
}
function uiRowsControls() {
  const menu = document.createElement('div');
  menu.id = 'cm-tile-menu';
  menu.className = 'cm-menu sb-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  document.body.append(menu);
  let frame = 0;
  const touched = new Set();
  const run = () => {
    frame = 0;
    // The rows scrolled, and any row still empty that came near the screen.
    document.querySelectorAll('.cm-rows-track:empty').forEach((t) => touched.add(t));
    touched.forEach(uiRowsFill);
    touched.clear();
    document.querySelectorAll('.cm-rows-jump').forEach(uiRowsEdges);
    if (!uiRowsJumping) uiRowsSpy();
  };
  const later = () => {
    if (!frame) frame = requestAnimationFrame(run);
  };
  document.addEventListener(
    'scroll',
    (e) => {
      if (e.target.classList?.contains('cm-rows-track')) touched.add(e.target);
      else if (uiRowsJumping) uiRowsSettle(200);
      later();
    },
    true
  );
  window.addEventListener('resize', () => {
    document.querySelectorAll('.cm-rows-track').forEach((t) => touched.add(t));
    later();
  });
  // A photo sets its card's width from its own proportions; one that fails
  // gives way to the glyph, and its credit goes with it.
  document.addEventListener(
    'load',
    (e) => {
      const img = e.target;
      if (!img.classList?.contains('cm-tile-img') || !img.naturalWidth) return;
      const r = uiTileRatio(img.naturalWidth, img.naturalHeight);
      UI_TILE_RATIO.set(img.getAttribute('src'), r);
      img.closest('.cm-tile')?.style.setProperty('--ar', r.toFixed(3));
    },
    true
  );
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!img.classList?.contains('cm-tile-img')) return;
      UI_TILE_FAILED.add(img.getAttribute('src'));
      const shot = img.closest('.cm-tile-shot'),
        tile = shot.parentElement;
      shot.classList.add('is-glyph');
      shot.querySelector('.cm-tile-credit')?.remove();
      tile.style.setProperty('--ar', '1');
      img.outerHTML = `<span class="cm-tile-glyph" aria-hidden="true">${UI_TILE_GLYPH.get(tile.dataset.tile)?.(tile.dataset.id) || ''}</span>`;
    },
    true
  );
  // The photo opens the details, as the name does (the name is the keyboard route).
  document.addEventListener('click', (e) => {
    const shot = e.target.closest?.('.cm-tile-shot');
    if (shot && !e.target.closest('button, a'))
      shot.parentElement.querySelector('.cm-tile-name').click();
  });
  let pending = 0;
  new MutationObserver(() => {
    clearTimeout(pending);
    pending = setTimeout(uiTilesSync, 120);
  }).observe($ui('workspace-sidebar'), { childList: true, subtree: true });
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
  if (uiMenuOpen) {
    uiCloseMenu(true);
  } else if (!$ui('ui-menu').hidden) {
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
// ── Menus in Your recipe ── A [data-menu-toggle] button opens the menu its
// aria-controls names (a .cm-menu with role="menu", rendered hidden next to
// it by src/app.js): one open at a time, placed beside its trigger, Up/Down
// between items, closed by an item, a click elsewhere or Escape (which
// returns focus to the trigger).
let uiMenuOpen = null;
function uiCloseMenu(focusTrigger) {
  if (!uiMenuOpen) return;
  const { menu, trigger, stop } = uiMenuOpen;
  uiMenuOpen = null;
  stop();
  menu.hidden = true;
  menu.closest('.sb-tradition-header, .sb-card-row')?.classList.remove('has-open-menu');
  trigger.setAttribute('aria-expanded', 'false');
  if (focusTrigger) uiFocus(trigger);
}
function uiToggleMenu(trigger) {
  const menu = $ui(trigger.getAttribute('aria-controls'));
  // One menu can serve many triggers (a browse card's ⋮): the same trigger closes it.
  const same = uiMenuOpen?.menu === menu && uiMenuOpen.trigger === trigger;
  uiCloseMenu(false);
  if (same || !menu) return;
  if (trigger.classList.contains('cm-tile-more')) uiTileMenu(menu, trigger);
  menu.hidden = false;
  menu.closest('.sb-tradition-header, .sb-card-row')?.classList.add('has-open-menu');
  trigger.setAttribute('aria-expanded', 'true');
  uiMenuOpen = { menu, trigger, stop: UILayout.anchor(menu, trigger, { align: 'end' }) };
  menu.querySelector('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true });
}
function uiMenuControls() {
  document.addEventListener(
    'click',
    (e) => {
      const trigger = e.target.closest('[data-menu-toggle]');
      if (trigger) {
        // Captured here, so the genre header under it does not also toggle.
        e.stopPropagation();
        uiSetMenu(false);
        uiToggleMenu(trigger);
        return;
      }
      if (!uiMenuOpen) return;
      // An item runs its own handler (bound on the item) and then closes the
      // menu; a click anywhere else just closes it.
      const item = e.target.closest('[role="menuitem"]');
      if (item && uiMenuOpen.menu.contains(item)) setTimeout(() => uiCloseMenu(false));
      else if (!uiMenuOpen.menu.contains(e.target)) uiCloseMenu(false);
    },
    true
  );
  document.addEventListener('keydown', (e) => {
    if (!uiMenuOpen || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = [...uiMenuOpen.menu.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    if (!items.length || !uiMenuOpen.menu.contains(document.activeElement)) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  });
  // A menu whose tree was repainted under it has nothing left to close.
  new MutationObserver(() => {
    if (uiMenuOpen && !uiMenuOpen.menu.isConnected) uiCloseMenu(false);
  }).observe($ui('workspace-sidebar'), { childList: true, subtree: true });
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
  // The right-hand column resizes from its left edge; its width is its own
  // remembered preference, independent of the left-hand column's.
  UILayout.splitter({
    container: workspace,
    panel: sidebar,
    key: 'sidebar-right',
    property: '--sidebar-right-width',
    title: 'Resize recipe sidebar',
    side: 'left',
    limits: () => [280, Math.min(560, innerWidth * 0.4)],
    enabled: () =>
      innerWidth >= 900 &&
      uiRecipeMode() === 'sidebar-right' &&
      !uiRecipeCollapsed['sidebar-right']?.get(),
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
    limits: () => [220, Math.max(220, Math.round(workspace.clientHeight * 0.7))],
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
    if (['modal-trad', 'modal-confirm'].includes(panel.parentElement.id)) return;
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
    use.onclick = async () => {
      if (!_engineLive && !(await engineReady({ label: 'Retry', run: () => use.onclick() })))
        return;
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
  // The Lyrics page's inspector, tools and outline (Lucide).
  wrench: uiSvg(
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>'
  ),
  user: uiSvg(
    '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>'
  ),
  users: uiSvg(
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>'
  ),
  history: uiSvg(
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path>'
  ),
  'book-open': uiSvg(
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>'
  ),
  'file-check': uiSvg(
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="m9 15 2 2 4-4"></path>'
  ),
  'chevrons-left': uiSvg('<path d="m11 17-5-5 5-5"></path><path d="m18 17-5-5 5-5"></path>'),
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
  'panel-right-close': uiSvg(
    '<rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M15 3v18"></path><path d="m8 9 3 3-3 3"></path>'
  ),
  'panel-right-open': uiSvg(
    '<rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M15 3v18"></path><path d="m10 15-3-3 3-3"></path>'
  ),
  send: uiSvg(
    '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path>'
  ),
  // A tuning fork: two tines over a stem (drawn for the shell, Lucide style).
  'tuning-fork': uiSvg('<path d="M8 2v7a4 4 0 0 0 8 0V2"></path><path d="M12 13v9"></path>'),
  'chevron-left': uiSvg('<path d="m15 18-6-6 6-6"></path>'),
  'ellipsis-vertical': uiSvg(
    '<circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>'
  ),
  // Rows of cards of different widths (drawn for the shell, Lucide style).
  rows: uiSvg(
    '<rect x="3" y="4" width="7" height="6" rx="1"></rect><rect x="12" y="4" width="9" height="6" rx="1"></rect><rect x="3" y="14" width="9" height="6" rx="1"></rect><rect x="14" y="14" width="7" height="6" rx="1"></rect>'
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
    // The same session, in the same order, that the lazy shell's boot checks
    // for cards before it draws (storedSessionText in src/app.js).
    const saved = JSON.parse(storedSessionText() || 'null');
    app.lyrics =
      typeof saved?.lyrics === 'string'
        ? saved.lyrics
        : (localStorage.getItem('musica-lyrics-v3') ??
          JSON.parse(localStorage.getItem('musica-writing-v1') || '{}').lyrics ??
          '');
    app.lyricMeta = lyricMetaOf(saved?.lyricMeta);
    $ui('lyrics-draft').value = app.lyrics;
    if (saved && !app.cards.length) {
      app.cards = normalizeWorkspaceCards(saved.cards || saved.workspace?.cards);
      app.workspaceName = saved.name || saved.title || 'Untitled session';
    }
    app.history = [];
    app.historyIndex = -1;
    pushHistory();
  } catch (e) {
    // A restore that reached the instrument data before it loaded is a boot
    // bug, not a damaged session: let the boot error say so, and write nothing.
    if (e && e.name === 'EngineNotReadyError') throw e;
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
    lyricMeta: lyricMetaOf(app.lyricMeta),
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
  // The header status is the live region; Your recipe shows the same words.
  for (const node of [el, $ui('recipe-autosave')]) {
    if (!node) continue;
    node.hidden = false;
    node.dataset.state = state;
    node.dataset.tone = def[0];
    node.dataset.tooltip = def[3];
    node.innerHTML = `${icon(def[1], 16)}<span class="ui-autosave-text">${esc(def[2])}</span>`;
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
// Run fn once the first paint has been presented and the main thread is idle:
// two animation frames (the second runs after the frame the first one queued
// has been drawn), then an idle callback with a 2 s ceiling so it cannot be
// starved. Where either API is missing (jsdom harnesses, older Safari) it
// falls back to a timer. For work the first view does not need: optional
// fetches and status checks that would otherwise compete with it.
//
// A HIDDEN TAB DRAWS NO FRAMES, so waiting for them would hold fn until the tab
// is shown and then run it under the reader. A tab hidden when this is called,
// or hidden before its frames arrive, goes straight to the idle callback,
// which is what booting in a background tab did before: nothing is painting
// there to compete with. fn runs once either way.
function uiAfterPaint(fn) {
  let done = false;
  const run = () => {
    if (!done) {
      done = true;
      fn();
    }
  };
  const idle = () =>
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback(run, { timeout: 2000 })
      : setTimeout(run, 0);
  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  if (typeof requestAnimationFrame !== 'function' || hidden()) return void idle();
  requestAnimationFrame(() => requestAnimationFrame(idle));
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function')
    document.addEventListener('visibilitychange', () => hidden() && idle(), { once: true });
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
