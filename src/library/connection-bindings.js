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
  return {
    el,
    say(text) {
      el.textContent = '';
      later(() => {
        el.textContent = text;
      });
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
    const action = ci.keyAction(ev.key);
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

return { liveRegion, bindKeys, urlSync, hiddenNotice, cellShowsControl, bottomSheet };
