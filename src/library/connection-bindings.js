// ─── Library chunk: connection-bindings ────────────────────────────────────
// Wrapped by the build as CMLibraryDefine('connection-bindings', function () { … }).
// The thin DOM layer of the connection views' interaction model
// (src/connection-interaction.js, which owns every rule and every word): the
// live region, the keyboard, the URL with back and forward, the hidden-
// selection notice, the matrix "Cell shows" control and the phone bottom
// sheet. The views (src/library/connection-views.js) own layout and call
// these; nothing here decides a state, a label or a selection.
//
// Every function takes the interaction model as `ci`, so this chunk does not
// depend on how the page loads it.
'use strict';

// Visually hidden but read aloud: the standard clip pattern, inline so the
// chunk needs no stylesheet.
const HIDDEN =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0';

// A polite live region. Saying the same words twice still announces: the
// node is emptied first, then filled on the next frame.
function liveRegion(container) {
  const doc = container.ownerDocument;
  const el = doc.createElement('div');
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.className = 'lib-cb-live';
  el.style.cssText = HIDDEN;
  container.append(el);
  const win = doc.defaultView;
  const later =
    (win && win.requestAnimationFrame && win.requestAnimationFrame.bind(win)) ||
    ((f) => setTimeout(f, 0));
  // What one frame will say: the latest words replace earlier ones, and a
  // note (a poem that could not be laid out) is read after them.
  let pending = null;
  function flush() {
    if (pending) return;
    pending = { text: '', notes: [] };
    el.textContent = '';
    later(() => {
      el.textContent = [pending.text, ...pending.notes].filter(Boolean).join(' ');
      pending = null;
    });
  }
  return {
    el,
    say(text) {
      flush();
      pending.text = text;
    },
    note(text) {
      if (!text) return;
      flush();
      pending.notes.push(text);
    },
  };
}

// Keys on one view. Esc clears and Enter inspects anywhere in the view;
// arrows move only inside the matrix grid. Typing in a field is never taken.
// handlers: { clear(), inspect(), move(key) }. Returns the unbind function.
function bindKeys(root, ci, handlers, opts) {
  const grid = (opts && opts.grid) || null;
  function onKey(ev) {
    const t = ev.target;
    const tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) {
      if (ev.key !== 'Escape') return;
    }
    // Space activates a non-native role="button" (the poem's and network's
    // SVG marks), as it does a real button.
    const roleButton =
      t && t.getAttribute && t.getAttribute('role') === 'button' && tag !== 'BUTTON';
    const action = ev.key === ' ' && roleButton ? 'inspect' : ci.keyAction(ev.key);
    if (action === 'clear') {
      handlers.clear();
    } else if (action === 'inspect') {
      if (tag === 'BUTTON' || tag === 'A') return; // their own activation
      handlers.inspect();
    } else if (action === 'move') {
      if (!grid || !grid.contains(t)) return;
      handlers.move(ev.key);
    } else {
      return;
    }
    ev.preventDefault();
  }
  root.addEventListener('keydown', onKey);
  return () => root.removeEventListener('keydown', onKey);
}

// The selection in the address bar. Every change is a history entry, so Back
// and Forward walk the selection history. Other query parameters are kept.
// current: what decodeSelection needs (analysisIdentity, hasEntity, hasMethod,
// hasEvidence). onRestore(selection) and onRefused(result) are the view's.
function urlSync(win, ci, current, onRestore, onRefused) {
  const KEYS = ['cv', 'sel'];
  function read() {
    const result = ci.decodeSelection(win.location.search, current);
    if (result.ok) onRestore(result.selection);
    else if (result.reason !== 'none') onRefused(result);
    else onRestore(null);
    return result;
  }
  function write(sel) {
    const params = new URLSearchParams(win.location.search);
    const mine = new URLSearchParams(ci.encodeSelection(current.analysisIdentity, sel));
    for (const k of KEYS) {
      if (mine.has(k)) params.set(k, mine.get(k));
      else params.delete(k);
    }
    const qs = params.toString();
    const url = win.location.pathname + (qs ? '?' + qs : '') + win.location.hash;
    if (url !== win.location.pathname + win.location.search + win.location.hash) {
      win.history.pushState(null, '', url);
    }
  }
  const onPop = () => read();
  win.addEventListener('popstate', onPop);
  return { read, write, stop: () => win.removeEventListener('popstate', onPop) };
}

// The hidden-selection notice: the model's text, and its Show action as a
// button. Returns null when the selection is visible.
function hiddenNotice(doc, notice, onShow) {
  if (!notice) return null;
  const p = doc.createElement('p');
  p.className = 'lib-cb-hidden';
  p.append(doc.createTextNode(notice.text + ' · '));
  const b = doc.createElement('button');
  b.type = 'button';
  b.textContent = notice.action.label;
  b.addEventListener('click', () => onShow(notice.action));
  p.append(b);
  return p;
}

// The matrix "Cell shows" control: a labelled select over the checked
// methods, worded by the model. A forced change is announced, not silent.
function cellShowsControl(doc, ci, checked, currentId, onChange, live) {
  const r = ci.cellShows(checked, currentId);
  const label = doc.createElement('label');
  label.className = 'lib-cb-cellshows';
  label.append(doc.createTextNode('Cell shows '));
  const select = doc.createElement('select');
  for (const o of r.options) {
    const opt = doc.createElement('option');
    opt.value = o.method_id;
    opt.textContent = o.label;
    select.append(opt);
  }
  select.disabled = !r.options.length;
  if (r.selected != null) select.value = r.selected;
  select.addEventListener('change', () => onChange(select.value));
  label.append(select);
  if (r.notice && live) live.say(r.notice);
  return { el: label, selected: r.selected, notice: r.notice };
}

// The phone bottom sheet around the inspector. Opening moves focus to its
// heading; closing (the handle, or Esc inside it) returns focus to where it
// came from. It is a non-modal region, so the poem stays reachable.
function bottomSheet(container, title) {
  const doc = container.ownerDocument;
  const sheet = doc.createElement('section');
  sheet.className = 'lib-cb-sheet';
  sheet.setAttribute('aria-label', title);
  const handle = doc.createElement('button');
  handle.type = 'button';
  handle.className = 'lib-cb-sheet-handle';
  handle.setAttribute('aria-expanded', 'false');
  handle.textContent = title;
  const heading = doc.createElement('h2');
  heading.tabIndex = -1;
  heading.textContent = title;
  const body = doc.createElement('div');
  body.className = 'lib-cb-sheet-body';
  body.hidden = true;
  body.append(heading);
  sheet.append(handle, body);
  container.append(sheet);
  let returnTo = null;
  function open(from) {
    returnTo = from || doc.activeElement;
    body.hidden = false;
    handle.setAttribute('aria-expanded', 'true');
    heading.focus();
  }
  function close() {
    body.hidden = true;
    handle.setAttribute('aria-expanded', 'false');
    if (returnTo && returnTo.isConnected) returnTo.focus();
    returnTo = null;
  }
  handle.addEventListener('click', () => (body.hidden ? open(handle) : close()));
  body.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      close();
      ev.stopPropagation();
      ev.preventDefault();
    }
  });
  return { el: sheet, body, open, close, isOpen: () => !body.hidden };
}

// What the live region says for a selection, from the model the views drew.
function announceFor(ci, model) {
  const sel = model.selection;
  if (!sel) return ci.announce(null, {});
  const occ = (id) => model.occurrences.find((o) => o.entity_id === id);
  const method = (id) => model.methods.find((m) => m.method_id === id);
  const cellOf = (s) => model.cells.find((c) => ci.sameSelection(c.selection, s));
  const hidden = ci.hiddenNotice(sel, {
    checkedMethods: new Set(model.checkedMethods),
    methodName: (id) => (method(id) || { name: id }).name,
    hiddenByFilter: () => model.hiddenByFilter || null,
  });
  const ctx = { occurrence: occ, method, hidden };
  if (sel.kind === 'pair' || sel.kind === 'binding') {
    const cell = cellOf(sel);
    if (!cell) {
      const who = ci.selectionOccurrences(sel).map((id) => {
        const o = occ(id);
        return `${o.text} L${o.line} w${o.token}`;
      });
      return `${who.join(sel.kind === 'pair' ? ' – ' : ' → ')}: not supplied`;
    }
    ctx.state = ci.cellState(cell);
  } else if (sel.kind === 'occurrence') {
    const counts = {};
    for (const c of model.cells) {
      if (!model.checkedMethods.includes(c.selection.method_id)) continue;
      if (!ci.selectionOccurrences(c.selection).includes(sel.entity_id)) continue;
      const st = ci.cellState(c).state;
      counts[st] = (counts[st] || 0) + 1;
    }
    ctx.counts = counts;
  }
  return ci.announce(sel, ctx);
}

// The owner of one mounted set of views: it holds the model, draws it with
// the views, and wires every interaction above to it. The views stay pure
// renderers; the selection, the URL and the announcements live here.
// opts: { ci, marks, createViews, model, current, view, win, narrow }
//   current  what decodeSelection needs (analysisIdentity, hasEntity, ...)
//   narrow   () => boolean, true at phone width (the inspector goes in a sheet)
// What a poem that could not be fully laid out says, once. Views report
// ready, partial or unavailable per poem (layoutPoem); ready says nothing.
const LAYOUT_RANK = { ready: 0, partial: 1, unavailable: 2 };
function layoutWords(report) {
  let worst = 0,
    placed = 0,
    missing = 0;
  for (const p of (report && report.poems) || []) {
    worst = Math.max(worst, LAYOUT_RANK[p.status] || 0);
    placed += p.measured.length + p.fixture.length;
    missing += p.issues.length;
  }
  const words =
    worst === 2
      ? 'Poem: word positions could not be measured, so no connections are drawn on it. They are listed in the inspector.'
      : worst === 1
        ? `Poem: ${missing} of ${placed + missing} words could not be placed, so their connections are not drawn. They are listed in the inspector.`
        : '';
  return { rank: worst, words };
}

function mount(host, opts) {
  const { ci, current } = opts;
  const doc = host.ownerDocument;
  const win = opts.win || doc.defaultView;
  const narrow =
    opts.narrow || (() => !!(win.matchMedia && win.matchMedia('(max-width: 600px)').matches));
  let model = opts.model;
  let view = opts.view || 'poem';
  const live = liveRegion(host);
  const stage = doc.createElement('div');
  host.append(stage);
  let sheet = null;
  const actions = {
    cellMethod: (id) => update({ cellMethod: id }),
    show: (action) => {
      if (action.type === 'check_method') {
        update({ checkedMethods: model.checkedMethods.concat(action.method_id) });
      } else if (action.type === 'clear_filter') update({ hiddenByFilter: null });
    },
  };
  const views = opts.createViews({
    interaction: ci,
    marks: opts.marks,
    bindings: api,
    actions,
    live,
  });

  // Poem geometry (views.layoutPoem) is measured from the rendered text, so
  // it runs once the fonts are in, on the tree that is still mounted, and
  // before focus is restored: it replaces the poem's marks. Each render takes
  // a new generation; a newer render or destroy() cancels an older one's
  // pending layout. A later font load lays the current tree out again.
  let gen = 0;
  let announced = 0;
  // The selection the latest render asked to focus: before layout the poem
  // has no marks to take it, so layout() gives it to the mark it draws.
  let wanted = '';
  const fonts = doc.fonts;
  function focusKeyIn(root, key) {
    if (!key) return false;
    for (const node of root.querySelectorAll('[data-selection]')) {
      if (node.dataset.selection === key) {
        node.focus();
        return true;
      }
    }
    return false;
  }
  function layout(root, g) {
    if (g !== gen || !root.isConnected || typeof views.layoutPoem !== 'function') return;
    // A focused mark is put back after layout replaces it. A focus the render
    // asked for and could not give yet goes to the mark layout draws, unless
    // the reader has since moved focus somewhere of their own.
    const a = doc.activeElement;
    const held = a && stage.contains(a) && a.closest('[data-selection]');
    const key = held ? held.dataset.selection : !a || a === doc.body ? wanted : '';
    const { rank, words } = layoutWords(views.layoutPoem(root));
    if (key && !(doc.activeElement && stage.contains(doc.activeElement))) focusKeyIn(root, key);
    // Said when it gets worse, not on every redraw; a clean layout resets it.
    if (rank > announced) live.note(words);
    announced = rank;
  }
  function draw(focusKey) {
    const root = views.render(model, { view });
    const g = ++gen;
    wanted = focusKey || '';
    stage.replaceChildren(root);
    if (sheet) sheet.el.remove();
    sheet = null;
    const pane = root.querySelector('.cv-inspector');
    if (pane && narrow()) {
      sheet = bottomSheet(root, 'Pair inspector');
      sheet.body.append(pane);
    }
    if (!fonts || fonts.status === 'loaded') {
      layout(root, g);
      focusKeyIn(root, focusKey);
    } else {
      // Focus now, so a keyboard reader is never left waiting on a font;
      // layout() keeps that focus when it replaces the marks.
      focusKeyIn(root, focusKey);
      fonts.ready.then(() => layout(root, g));
    }
    return root;
  }
  let relayout = 0;
  const later =
    (win.requestAnimationFrame && win.requestAnimationFrame.bind(win)) || ((f) => setTimeout(f, 0));
  const cancel = (win.cancelAnimationFrame && win.cancelAnimationFrame.bind(win)) || clearTimeout;
  function onFonts() {
    if (relayout) return;
    relayout = later(() => {
      relayout = 0;
      const root = stage.firstElementChild;
      if (root) layout(root, gen);
    });
  }
  if (fonts && fonts.addEventListener) fonts.addEventListener('loadingdone', onFonts);
  function update(patch, focusKey) {
    model = { ...model, ...patch };
    draw(focusKey);
  }
  function select(sel, { fromUrl, inspect } = {}) {
    // Back to an address with nothing selected, while nothing is, changes
    // nothing and says nothing.
    if (fromUrl && !sel && !model.selection) return;
    const key = sel ? ci.selectionKey(sel) : '';
    const rowOccurrence =
      sel && sel.kind === 'occurrence' ? sel.entity_id : sel ? model.rowOccurrence : null;
    update({ selection: sel, rowOccurrence, notice: null }, key);
    if (!fromUrl) url.write(sel);
    // The address read at mount sets the selection without a word: nobody
    // has done anything yet.
    if (!booting) live.say(announceFor(ci, model));
    if (inspect && sheet) sheet.open(doc.activeElement);
  }

  const url = urlSync(
    win,
    ci,
    current,
    (sel) => select(sel, { fromUrl: true }),
    (refused) => update({ selection: null, notice: refused.message })
  );

  stage.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-selection],[data-view]');
    if (!t || !stage.contains(t)) return;
    if (t.dataset.view) {
      view = t.dataset.view;
      draw();
      const tab = stage.querySelector(`[data-view="${t.dataset.view}"]`);
      if (tab) tab.focus();
      return;
    }
    // A click (or Enter or Space on a button, which the browser turns into a
    // click) selects; at phone width it also opens the inspector sheet.
    const sel = ci.selectionFromKey(t.dataset.selection);
    if (sel) select(sel, { inspect: true });
  });
  stage.addEventListener('change', (ev) => {
    const box = ev.target;
    if (!box.dataset || !box.dataset.method) return;
    const id = box.dataset.method;
    const rest = model.checkedMethods.filter((m) => m !== id);
    update({ checkedMethods: box.checked ? rest.concat(id) : rest });
  });
  const unbind = bindKeys(
    stage,
    ci,
    {
      clear: () => select(null),
      inspect: () => {
        const t = doc.activeElement && doc.activeElement.closest('[data-selection]');
        const sel = t && ci.selectionFromKey(t.dataset.selection);
        if (sel) select(sel, { inspect: true });
      },
      move: (key) => {
        const t = doc.activeElement;
        const grid = t.closest('table');
        const n = grid ? grid.querySelectorAll('tr').length - 1 : 0;
        const pos = ci.matrixMove({ row: +t.dataset.row, col: +t.dataset.col }, key, n);
        const next = grid && grid.querySelector(`[data-row="${pos.row}"][data-col="${pos.col}"]`);
        if (next) next.focus();
      },
    },
    { grid: stage }
  );

  let booting = true;
  draw();
  url.read();
  booting = false;
  return {
    model: () => model,
    view: () => view,
    select,
    destroy() {
      gen++;
      if (relayout) cancel(relayout);
      if (fonts && fonts.removeEventListener) fonts.removeEventListener('loadingdone', onFonts);
      unbind();
      url.stop();
      stage.remove();
      live.el.remove();
    },
  };
}

const api = {
  liveRegion,
  bindKeys,
  urlSync,
  hiddenNotice,
  cellShowsControl,
  bottomSheet,
  announceFor,
  mount,
};
return api;
