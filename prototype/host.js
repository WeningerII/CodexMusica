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

// The last sentence said in this turn (until the next task runs). The same
// sentence again in the same turn, as when the shell and a lane each report
// one outcome, would be said twice for one thing, so it is said once; a
// later turn says it anew.
let saidNow = null;
export function announce(text) {
  const region = status();
  if (!region) return;
  const sentence = String(text);
  if (sentence === saidNow) return;
  saidNow = sentence;
  setTimeout(() => {
    if (saidNow === sentence) saidNow = null;
  });
  // Clearing first makes a repeat of the same sentence a new announcement.
  region.textContent = '';
  region.textContent = sentence;
}

// A subscribe whose listeners end with a mount: given the signal the host
// passed a lane's context(), each listener is removed when that signal
// aborts, or when its own unsubscribe runs, so a lane that keeps a listener
// past its unmount stops hearing at the abort. One added after the abort is
// never added.
export function untilAborted(subscribe, signal) {
  return (fn) => {
    if (typeof fn !== 'function') throw new TypeError('subscribe needs a function');
    if (signal.aborted) return () => {};
    const off = subscribe(fn);
    let on = true;
    const end = () => {
      if (!on) return;
      on = false;
      signal.removeEventListener('abort', end);
      off();
    };
    signal.addEventListener('abort', end, { once: true });
    return end;
  };
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
// then what to do. A lane whose data can fail for a reason other than the
// connection says what to do itself, in retryHint.
const RETRY_HINT = 'Check your connection, then try again.';

// lane: { id, label, load, context, unloaded, retryHint? }. load returns the
// lane module (app.js's registry, a literal dynamic import); context resolves
// the lane's own ctx fields; unloaded is the sentence shown if context fails,
// which the host follows with what to do (retryHint, or RETRY_HINT) and a
// Retry button.
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
  // into the lane when it mounts, or back to Retry when its data fails again
  // (or to the sentence when its mount() throws), which is said, unless they
  // moved focus on while it loaded (tell).
  // context({ signal }) gets this mount's signal before the lane has a ctx,
  // so what the shell hands the lane can end with the mount (untilAborted);
  // an attempt that fails, or is overtaken, mounts nothing and aborts it.
  async function attach(mod, again) {
    const node = host;
    const mine = new AbortController();
    let extra;
    try {
      extra = (await lane.context({ signal: mine.signal })) || {};
    } catch {
      mine.abort();
      if (host !== node) return;
      state = 'unavailable';
      const sentence = `${lane.unloaded} ${lane.retryHint || RETRY_HINT}`;
      explain(host, sentence, () => {
        state = 'loading';
        explain(host, `Loading ${lane.label}…`);
        host.querySelector('[data-host-note]').focus();
        pending = attach(mod, true);
      });
      if (again) tell(null); // a Retry asked for it
      return;
    }
    if (host !== node) {
      mine.abort();
      return; // unmounted while its ctx loaded
    }
    host.replaceChildren(); // the lane receives an empty host
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
      if (again) tell(null); // a Retry asked for it
      return;
    }
    state = 'mounted'; // the placeholder was hidden by the Loading sentence
    // A Retry puts focus in the lane unless the person moved it on: the
    // Loading sentence Retry focused has gone, so focus left there is nowhere.
    const active = document.activeElement;
    if (again && (!active || active === document.body) && typeof handle.focus === 'function')
      handle.focus();
  }

  // A lane that couldn't start, told: the sentence its host shows is said,
  // and focus goes to its Retry if it has one, else to the sentence, but only
  // while focus is still on `from` or nowhere. Focus the person moved
  // elsewhere stays there. While the panel is hidden (the person left its
  // route) nothing is said and focus isn't moved: the panel shows the
  // sentence when they come back. Returns whether it was said.
  function tell(from) {
    const note = state === 'unavailable' && host && host.querySelector('[data-host-note]');
    if (!note || panel.closest('[hidden]')) return false;
    const active = document.activeElement;
    if (!active || active === document.body || active === from)
      (host.querySelector('[data-host-retry]') || note).focus();
    announce(note.textContent);
    return true;
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
    // For an open that an action asked for (createOnDemand): if the lane
    // couldn't start, it is told (tell), with focus moved only from what
    // opened it (show()'s returnFocus, else what had focus then) or from
    // nowhere. A Retry is told the same way, from nowhere only (attach).
    tellUnavailable() {
      return tell(opener);
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
// A lane that can't start (its module doesn't load, its ctx fails or its
// mount() throws) is not an error of the open (#810, Don's reply to
// 6683384760). Its host shows its sentence in the panel, as for any lane,
// and open() goes on and resolves as before. An action asked for the first
// lane, so if that one can't start, its sentence is also said, once, through
// announce, after every lane is shown: a later lane that says something as
// it mounts can't replace it in the one status region. If focus is still on
// the opener (returnFocus, else what had focus when open() was called) or
// nowhere when it is said, focus moves to that lane's Retry if it has one,
// else to the sentence. Focus the person moved elsewhere, even while the
// lanes loaded, stays where it is. A later lane that can't start only shows
// its sentence: the first lane opened, with focus in it. Nothing is said, and
// no focus moves, while the panel is hidden (the person left its route), and
// once overtaken, an open says nothing more. Its Retry, if the person presses
// it, is the host's own (createHost).
//
// A held lane whose own unmount() throws doesn't stop either one, as it
// doesn't stop ctx.close() (#810 6675659005): that lane's host still ends (its
// signal aborts, its node goes, it is idle), every other held lane is
// unmounted too, and open() still mounts its lanes, focus included. The
// error then comes back: open() rejects with it once it has finished (or
// been overtaken), and close() throws it once every lane is gone. When
// several held lanes throw, none is lost (#810 6677708921): what comes back
// is one AggregateError whose errors are theirs, in the order they were
// thrown, the last lane's first.
export function createOnDemand(panel) {
  let held = [];
  let turn = 0;
  // Every held lane, last first; every error is kept, in the order thrown,
  // and returned, not thrown.
  const clear = () => {
    const errors = [];
    for (const h of held.slice().reverse()) {
      try {
        h.unmount();
      } catch (error) {
        errors.push(error);
      }
    }
    held = [];
    return errors;
  };
  // What a failed teardown hands back: one lane's error as it is, or several
  // lanes' together.
  const failure = (errors) =>
    errors.length === 1
      ? errors[0]
      : new AggregateError(errors, `${errors.length} lanes did not unmount cleanly.`);
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
      // The first lane is the one the open is for and puts focus in. If it
      // couldn't start, it is told once every lane is shown, so what a later
      // lane says as it mounts can't replace its sentence in the one status
      // region. A later lane that can't start only shows its sentence.
      if (mounted && hosts.length) hosts[0].tellUnavailable();
      if (failed.length) throw failure(failed); // the open went on regardless
      return mounted;
    },
    close() {
      turn++;
      const failed = clear(); // the shell's own close
      if (failed.length) throw failure(failed); // every lane went regardless
    },
  };
}
