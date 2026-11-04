// Feature hosts (#670 slice P2): the shell side of the mount contract in
// #670 6639542176 §1.
//
//   export function mount(host, ctx) → { unmount(), focus() }
//
// host is an empty <div data-feature-host="<lane>"> after the route panel's
// <h1>; the lane owns its children only. ctx always carries { storage,
// announce, signal } (storage scoped to the lane, announce into the shell's
// one role="status" region, signal aborted on unmount) plus the lane's own
// fields. A lane is imported the first time its route is shown and mounted
// once: switching routes hides the panel and keeps the lane, so its state and
// nodes survive. unmount() is for tests and teardown.

import { scope } from './storage.js';

const status = () => document.getElementById('proto-status');

export function announce(text) {
  const region = status();
  if (!region) return;
  // Clearing first makes a repeat of the same sentence a new announcement.
  region.textContent = '';
  region.textContent = String(text);
}

// What the person sees in the panel while a lane loads, or instead of it when
// it can't be shown: one sentence, standing in for the placeholder so the
// panel doesn't say the same thing twice. The shell keeps working. With
// `retry`, a Retry button follows the sentence (#668 6645267823): the lane's
// data is the shell's to load, so trying again is the shell's too.
function explain(host, text, retry) {
  const p = document.createElement('p');
  p.className = 'host-note';
  p.dataset.hostNote = '';
  p.tabIndex = -1;
  p.textContent = text;
  host.replaceChildren(p);
  if (retry) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'host-retry';
    b.dataset.hostRetry = '';
    b.textContent = 'Retry';
    b.addEventListener('click', retry, { once: true });
    host.append(b);
  }
  const placeholder = host.parentElement && host.parentElement.querySelector('[data-placeholder]');
  if (placeholder) placeholder.hidden = true;
}

// A lane's data that didn't load: what happened (the lane's own sentence),
// then what to do.
const RETRY_HINT = 'Check your connection, then try again.';

// lane: { id, label, load, context, unloaded }. load returns the lane module
// (app.js's registry, a literal dynamic import); context resolves the lane's
// own ctx fields; unloaded is the sentence shown if context fails, which the
// host follows with what to do and a Retry button.
export function createHost(lane, panel) {
  let state = 'idle'; // idle | loading | mounted | unavailable
  let handle = null;
  let controller = null;
  let host = null;
  let pending = null;

  // Several lanes can share a panel. Each host goes after the panel's last
  // one, so the lanes appear in registry order.
  function place() {
    host = document.createElement('div');
    host.dataset.featureHost = lane.id;
    const hosts = panel.querySelectorAll('[data-feature-host]');
    (hosts.length ? hosts[hosts.length - 1] : panel.querySelector('h1')).after(host);
  }

  async function mountNow() {
    place();
    explain(host, `Loading ${lane.label}…`);
    let mod;
    try {
      mod = await lane.load();
    } catch {
      state = 'unavailable';
      explain(host, `${lane.label} isn’t part of this build of the prototype yet.`);
      return;
    }
    await attach(mod, false);
  }

  // The lane's ctx, then mount. `again` is a Retry: focus follows the person,
  // into the lane when it mounts, or back to Retry when it fails again.
  async function attach(mod, again) {
    let extra;
    try {
      extra = (await lane.context()) || {};
    } catch {
      state = 'unavailable';
      const sentence = `${lane.unloaded} ${RETRY_HINT}`;
      explain(host, sentence, () => {
        state = 'loading';
        explain(host, `Loading ${lane.label}…`);
        host.querySelector('[data-host-note]').focus();
        pending = attach(mod, true);
      });
      if (again) {
        host.querySelector('[data-host-retry]').focus();
        announce(sentence);
      }
      return;
    }
    host.replaceChildren(); // the lane receives an empty host
    controller = new AbortController();
    const ctx = Object.freeze({
      ...extra,
      storage: scope(lane.id),
      announce,
      signal: controller.signal,
    });
    try {
      handle = mod.mount(host, ctx) || {};
    } catch {
      controller.abort();
      state = 'unavailable';
      explain(host, `${lane.label} couldn’t start. The rest of the prototype still works.`);
      return;
    }
    state = 'mounted'; // the placeholder was hidden by the Loading sentence
    if (again && typeof handle.focus === 'function') handle.focus();
  }

  return {
    get state() {
      return state;
    },
    // Called each time the route is shown; mounts on the first call only.
    show() {
      if (state === 'idle') {
        state = 'loading';
        pending = mountNow();
      }
      return pending;
    },
    focus() {
      if (handle && typeof handle.focus === 'function') handle.focus();
    },
    unmount() {
      if (handle && typeof handle.unmount === 'function') handle.unmount();
      if (controller) controller.abort();
      if (host) host.remove();
      const placeholder = panel.querySelector('[data-placeholder]');
      if (placeholder) placeholder.hidden = false;
      handle = controller = host = pending = null;
      state = 'idle';
    },
  };
}
