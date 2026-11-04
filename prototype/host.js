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
// panel doesn't say the same thing twice. The shell keeps working.
function explain(host, text) {
  const p = document.createElement('p');
  p.className = 'host-note';
  p.dataset.hostNote = '';
  p.textContent = text;
  host.replaceChildren(p);
  const placeholder = host.parentElement && host.parentElement.querySelector('[data-placeholder]');
  if (placeholder) placeholder.hidden = true;
}

// lane: { id, label, load, context, unloaded }. load returns the lane module
// (app.js's registry, a literal dynamic import); context resolves the lane's
// own ctx fields; unloaded is the sentence shown if context fails.
export function createHost(lane, panel) {
  let state = 'idle'; // idle | loading | mounted | unavailable
  let handle = null;
  let controller = null;
  let host = null;
  let pending = null;

  function place() {
    host = document.createElement('div');
    host.dataset.featureHost = lane.id;
    panel.querySelector('h1').after(host);
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
    let extra;
    try {
      extra = (await lane.context()) || {};
    } catch {
      state = 'unavailable';
      explain(host, lane.unloaded);
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
