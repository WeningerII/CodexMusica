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
//
// A lane that closes itself (a sheet's Close button or Escape, #665 B0) is
// registered with closable: true, and only that lane's ctx also carries
// close(). ctx.close() takes no arguments and closes through the host: the
// lane's own unmount() runs, ctx.signal aborts, the host node goes, and the
// host is idle again, so its next show() mounts the lane afresh with a new
// ctx and signal. If focus was in the lane (or nowhere), it returns to what
// opened it: show()'s returnFocus, else whatever had focus when show()
// mounted the lane, else, if that has gone or can't take focus, the panel's
// heading. It returns true when it closed this mount and false when this
// mount had already ended or not yet begun, so a stale ctx can't close a
// later mount. If the lane's own unmount() throws, the host still closes,
// focus included, and the error comes back to the lane from close().

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
  let opener = null; // what show() was opened from, for close()

  // Several lanes can share a panel. Each host goes after the panel's last
  // one, so the lanes appear in registry order.
  function place() {
    host = document.createElement('div');
    host.dataset.featureHost = lane.id;
    const hosts = panel.querySelectorAll('[data-feature-host]');
    (hosts.length ? hosts[hosts.length - 1] : panel.querySelector('h1')).after(host);
  }

  // A host unmounted while its lane loads (an on-demand lane opened again
  // before the first had arrived) stops at the next await: `node` is no
  // longer its node, so nothing is mounted or explained into a removed host.
  async function mountNow() {
    place();
    const node = host;
    explain(node, `Loading ${lane.label}…`);
    let mod;
    try {
      mod = await lane.load();
    } catch {
      if (host !== node) return;
      state = 'unavailable';
      explain(node, `${lane.label} isn’t part of this build of the prototype yet.`);
      return;
    }
    if (host !== node) return; // unmounted while the module loaded
    await attach(mod, false);
  }

  // The lane's ctx, then mount. `again` is a Retry: focus follows the person,
  // into the lane when it mounts, or back to Retry when it fails again.
  async function attach(mod, again) {
    const node = host;
    let extra;
    try {
      extra = (await lane.context()) || {};
    } catch {
      if (host !== node) return;
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
    if (host !== node) return; // unmounted while its ctx loaded
    host.replaceChildren(); // the lane receives an empty host
    const mine = new AbortController();
    controller = mine;
    // This mount's close, for a closable lane only: once, and never a later
    // mount's.
    const close = () => {
      if (controller !== mine || state !== 'mounted') return false;
      const node = host;
      const active = document.activeElement;
      const hadFocus = !active || active === document.body || node.contains(active);
      const back = opener;
      try {
        teardown();
      } finally {
        if (hadFocus) refocus(back); // even if the lane's unmount() threw
      }
      return true;
    };
    const ctx = Object.freeze({
      ...extra,
      ...(lane.closable === true ? { close } : {}),
      storage: scope(lane.id),
      announce,
      signal: mine.signal,
    });
    try {
      handle = mod.mount(host, ctx) || {};
    } catch {
      mine.abort();
      state = 'unavailable';
      explain(host, `${lane.label} couldn’t start. The rest of the prototype still works.`);
      return;
    }
    state = 'mounted'; // the placeholder was hidden by the Loading sentence
    if (again && typeof handle.focus === 'function') handle.focus();
  }

  // unmount() and ctx.close(): the lane's own unmount(), then its signal and
  // its node. The fields are cleared first, so a lane whose unmount() calls
  // close() again finds nothing left to close. The placeholder comes back
  // only if no other lane is left in the panel.
  function teardown() {
    const h = handle;
    const c = controller;
    const node = host;
    handle = controller = host = pending = opener = null;
    state = 'idle'; // the next show() mounts the lane afresh
    try {
      if (h && typeof h.unmount === 'function') h.unmount();
    } finally {
      if (c) c.abort();
      if (node) node.remove();
      const placeholder = panel.querySelector('[data-placeholder]');
      if (placeholder && !panel.querySelector('[data-feature-host]')) placeholder.hidden = false;
    }
  }

  // Focus back to what opened the lane, if it is still on the page, isn't
  // the page itself and takes focus (a disabled, hidden or inert one
  // doesn't); otherwise to the panel's heading.
  function refocus(to) {
    const ok = to && to !== document.body && to.isConnected && typeof to.focus === 'function';
    if (ok) to.focus();
    if (!ok || document.activeElement !== to) panel.querySelector('h1')?.focus();
  }

  return {
    get state() {
      return state;
    },
    // Called each time the route is shown; mounts when idle: the first call,
    // and the first after a close. returnFocus is where close() puts focus.
    show({ returnFocus } = {}) {
      if (state === 'idle') {
        opener = returnFocus || document.activeElement;
        state = 'loading';
        pending = mountNow();
      }
      return pending;
    },
    focus() {
      if (handle && typeof handle.focus === 'function') handle.focus();
    },
    unmount() {
      teardown();
    },
  };
}

// On-demand lanes (#665 B0-3): a lane no tab shows (a dialog, a sheet, an
// overlay, the reader), which an action opens in a panel. Generalised from
// app.js's openReader:
//
//   const slot = createOnDemand(panel);
//   await slot.open(lanes, { returnFocus }) → true, or false if overtaken
//   slot.close()
//
// open() takes one lane or several, in order, as the registry describes
// them (closable: true for one that closes itself). It unmounts whatever the
// slot holds, mounts each lane in turn after the panel's last lane, and puts
// focus in the first once it is mounted. A closable lane's ctx.close() then
// returns focus to returnFocus, else to what had focus when open() was
// called. An open() overtaken by a later open() or close() stops where it
// is: it mounts nothing more, moves no focus and resolves false. close() is
// the shell's own: it unmounts every lane the slot holds.
//
// A held lane whose own unmount() throws doesn't stop either one, as it
// doesn't stop ctx.close() (#810 6675659005): that lane's host still ends (its
// signal aborts, its node goes, it is idle), every other held lane is
// unmounted too, and open() still mounts its lanes, focus included. The first
// error then comes back: open() rejects with it once it has finished (or
// been overtaken), and close() throws it once every lane is gone.
export function createOnDemand(panel) {
  let held = [];
  let turn = 0;
  // Every held lane, last first; the first error is returned, not thrown.
  const clear = () => {
    let failed = null;
    for (const h of held.slice().reverse()) {
      try {
        h.unmount();
      } catch (error) {
        failed = failed || { error };
      }
    }
    held = [];
    return failed;
  };
  return {
    async open(lanes, { returnFocus } = {}) {
      const back = returnFocus || document.activeElement;
      const mine = ++turn;
      const failed = clear(); // what was open goes first
      const list = [].concat(lanes);
      const hosts = list.map((l) => createHost(l, panel));
      held = hosts;
      let mounted = true;
      for (const [i, h] of hosts.entries()) {
        await h.show({ returnFocus: back });
        if (mine !== turn) {
          mounted = false; // overtaken
          break;
        }
        if (i === 0) h.focus();
      }
      if (failed) throw failed.error; // the open went on regardless
      return mounted;
    },
    close() {
      turn++;
      const failed = clear(); // the shell's own close
      if (failed) throw failed.error; // every lane went regardless
    },
  };
}
