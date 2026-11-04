// Headless binding for #670. There is no renderer or musical engine here.
// snapshot() and edit payloads are deliberately opaque until Don supplies P2.
// createBinding is lane-local preparation, not a new shell integration hook.
const REQUIRED = [
  'snapshot', 'apply', 'undo', 'redo', 'canUndo', 'canRedo', 'subscribe',
];

export function createBinding({ recipe, announce, signal }) {
  for (const name of REQUIRED) {
    if (typeof recipe?.[name] !== 'function') {
      throw new TypeError(`Recipe adapter requires ${name}()`);
    }
  }
  if (typeof announce !== 'function' || !signal || typeof signal.aborted !== 'boolean' ||
      typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function') {
    throw new TypeError('Recipe binding requires announce and an AbortSignal');
  }
  let disposed = false;
  let unsubscribe;
  const observers = new Set();
  function unmount() {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener('abort', unmount);
    observers.clear();
    const release = unsubscribe;
    unsubscribe = undefined;
    release?.();
  }
  function active() {
    if (signal.aborted) unmount();
    return !disposed;
  }
  function assertActive() {
    if (!active()) throw new Error('Recipe binding is unmounted');
  }
  function snapshot() {
    assertActive();
    return recipe.snapshot();
  }
  function history() {
    assertActive();
    return { canUndo: recipe.canUndo(), canRedo: recipe.canRedo() };
  }
  function notify() {
    if (!active()) return;
    // No snapshot cache: an Undo may replace every card object.
    for (const fn of [...observers]) {
      if (!active()) break;
      if (observers.has(fn)) fn();
    }
  }
  if (!signal.aborted) {
    // This observes the lifecycle signal itself, not a DOM control. Giving
    // it { signal } would remove this listener before abort can deliver it.
    // Explicit teardown removes it too; abort must release immediately.
    signal.addEventListener('abort', unmount, { once: true });
    try {
      unsubscribe = recipe.subscribe(notify);
      if (typeof unsubscribe !== 'function') {
        unsubscribe = undefined;
        throw new TypeError('Recipe subscribe() must return an unsubscribe function');
      }
    } catch (error) {
      unmount();
      throw error;
    }
    // A synchronous initial notification can observe an abort before
    // subscribe has returned its release function.
    if (disposed || signal.aborted) {
      const release = unsubscribe;
      unsubscribe = undefined;
      disposed = true;
      release();
    }
  } else {
    disposed = true;
  }
  function invoke(action) {
    assertActive();
    try {
      return action();
    } catch (error) {
      // An adapter exception has an uncertain outcome. Do not manufacture a
      // changed:false receipt or retry: the adapter may already have committed.
      if (active()) announce('Recipe action could not be confirmed.');
      throw error;
    }
  }
  return {
    snapshot,
    history,
    apply(edit) {
      return invoke(() => {
        const result = recipe.apply(edit);
        if (!result || typeof result.ok !== 'boolean' ||
            typeof result.changed !== 'boolean' || (!result.ok && result.changed)) {
          throw new TypeError('Recipe apply() returned an invalid receipt');
        }
        if (!result.ok && active()) {
          announce(typeof result.refusal === 'string' && result.refusal.trim()
            ? result.refusal : 'Recipe change was refused.');
        }
        return result;
      });
    },
    undo() {
      assertActive();
      if (recipe.canUndo()) return invoke(() => recipe.undo());
    },
    redo() {
      assertActive();
      if (recipe.canRedo()) return invoke(() => recipe.redo());
    },
    subscribe(fn) {
      assertActive();
      if (typeof fn !== 'function') throw new TypeError('Observer must be a function');
      observers.add(fn);
      return () => observers.delete(fn);
    },
    unmount,
  };
}

export function mount(host, ctx) {
  if (!host || typeof host.querySelector !== 'function') {
    throw new TypeError('Recipe mount requires a host element');
  }
  const binding = createBinding(ctx);
  let mounted = true;
  // Intentionally no controls, markup, event vocabulary or shared hooks.
  // P2 must provide the renderer before this mount becomes interactive.
  // No DOM listeners are installed. Abort or explicit unmount tears down.
  return {
    unmount() {
      mounted = false;
      binding.unmount();
    },
    focus() {
      if (!mounted || ctx.signal.aborted) return;
      // Do not make the host focusable or disturb the shell's h1 route focus.
      // There is no focus target until the owner integrates the renderer.
      const control = host.querySelector(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      );
      control?.focus({ preventScroll: true });
    },
  };
}
