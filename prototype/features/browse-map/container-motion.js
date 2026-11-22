// A decorative shared-container bridge. Call capture before changing layout,
// then connect after committing state. No state, focus or navigation waits on it.
export const CONTAINER_MOTION = Object.freeze({
  duration: 280,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
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
  function connect(from, target) {
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
      transformOrigin: 'top left',
      zIndex: '1',
    });
    root.append(node);
    const run = { node, animation: null, frame: 0 };
    active = run;
    try {
      run.animation = node.animate(
        [
          {
            transform: `translate(${from.rect.left - to.rect.left}px, ${from.rect.top - to.rect.top}px) scale(${from.rect.width / to.rect.width}, ${from.rect.height / to.rect.height})`,
            opacity: 0.7,
            borderRadius: from.radius,
          },
          { transform: 'none', opacity: 0, borderRadius: to.radius },
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
  // Capturing scroll catches the shelf as well as any lane-owned scroller.
  root.addEventListener('scroll', cancel, true);
  preference?.addEventListener?.('change', cancel);
  function dispose() {
    disposed = true;
    cancel();
    root.removeEventListener('scroll', cancel, true);
    preference?.removeEventListener?.('change', cancel);
    signal.removeEventListener('abort', dispose);
  }
  signal.addEventListener('abort', dispose, { once: true });
  return { capture, connect, cancel, dispose };
}
