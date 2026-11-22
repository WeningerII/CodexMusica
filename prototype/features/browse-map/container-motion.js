// A decorative shared-container bridge. Capture a disappearing source before
// removal; capture a surviving source after layout/announcements commit. No
// state, focus or navigation waits on it.
export const CONTAINER_MOTION = Object.freeze({
  duration: 280,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
});

export function createContainerMotion(root, signal) {
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  const preference = view?.matchMedia?.('(prefers-reduced-motion: reduce)');
  let active = null;
  let disposed = false;
  function cancel() {
    const previous = active;
    active = null;
    if (previous) view.cancelAnimationFrame(previous.frame);
    previous?.animation?.cancel();
    previous?.node.remove();
  }
  function capture(element) {
    if (!element?.isConnected || !element.getClientRects().length) return null;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const style = view.getComputedStyle(element);
    return { rect, color: style.color, radius: style.borderRadius };
  }
  function connect(from, target, { settledScroll = null } = {}) {
    cancel();
    if (disposed || signal.aborted || !preference || preference.matches) return;
    const to = capture(target);
    if (!from || !to) return;
    const node = doc.createElement('div');
    if (typeof node.animate !== 'function') return;
    node.setAttribute('aria-hidden', 'true');
    node.className = 'discovery-container-motion';
    Object.assign(node.style, {
      position: 'fixed',
      pointerEvents: 'none',
      boxSizing: 'border-box',
      left: `${to.rect.left}px`,
      top: `${to.rect.top}px`,
      width: `${to.rect.width}px`,
      height: `${to.rect.height}px`,
      border: `2px solid ${to.color}`,
      borderRadius: to.radius,
      zIndex: '1',
    });
    root.append(node);
    const run = {
      node,
      animation: null,
      frame: 0,
      // The caller has already completed an instant reveal. Its queued event
      // is harmless only while the scroller is still at this measured position.
      settledScroll: settledScroll && {
        element: settledScroll,
        left: settledScroll.scrollLeft,
        top: settledScroll.scrollTop,
      },
    };
    active = run;
    try {
      // Size the empty, fixed-position cue instead of scaling its border.
      // This costs paint for one small decoration, but keeps a uniform 2px edge.
      const geometry = (rect, radius) => ({
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        borderRadius: radius,
      });
      run.animation = node.animate(
        [
          { ...geometry(from.rect, from.radius), opacity: 0.85, offset: 0 },
          { opacity: 0.85, offset: 0.75 },
          { ...geometry(to.rect, to.radius), opacity: 0, offset: 1 },
        ],
        CONTAINER_MOTION
      );
      const viewport = [view.innerWidth, view.innerHeight];
      function checkGeometry() {
        if (active !== run) return;
        const current = capture(target);
        if (
          !current ||
          preference.matches ||
          viewport[0] !== view.innerWidth ||
          viewport[1] !== view.innerHeight ||
          ['left', 'top', 'width', 'height'].some(
            (key) => Math.abs(current.rect[key] - to.rect[key]) > 1
          )
        ) {
          cancel();
          return;
        }
        run.frame = view.requestAnimationFrame(checkGeometry);
      }
      run.frame = view.requestAnimationFrame(checkGeometry);
      run.animation.finished.then(
        () => {
          if (active === run) cancel();
        },
        () => {
          if (active === run) cancel();
        }
      );
    } catch {
      cancel(); // Unsupported/failed animation leaves the committed UI intact.
    }
  }
  // Do not skip the first event or wait to arm cancellation: a genuine scroll
  // can happen before the first frame too. Compare positions instead, without
  // suppressing event delivery to the shelf or other listeners.
  function onScroll(event) {
    const settled = active?.settledScroll;
    if (
      settled &&
      event.target === settled.element &&
      settled.element.scrollLeft === settled.left &&
      settled.element.scrollTop === settled.top
    )
      return;
    cancel();
  }
  root.addEventListener('scroll', onScroll, true);
  preference?.addEventListener?.('change', cancel);
  function dispose() {
    disposed = true;
    cancel();
    root.removeEventListener('scroll', onScroll, true);
    preference?.removeEventListener?.('change', cancel);
    signal.removeEventListener('abort', dispose);
  }
  signal.addEventListener('abort', dispose, { once: true });
  return { capture, connect, cancel, dispose };
}
