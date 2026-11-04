// Shell adapters a lane receives instead of reaching for the page itself
// (#670, #668 6641909843): media for images, overlay for anything that takes
// over the page. A lane adds no window or document listener and no root
// style (check_prototype_isolation.js rule 6); these hold that on its behalf.

// media.resolve(image) → a committed, same-origin file URL, or null. The
// prototype makes no off-origin request (R2's limit 1), so production's remote
// images resolve to null and the lane shows its image-unavailable state.
const LOCAL = /^\.\.\/assets\/[\w-]+(?:\/[\w.-]+)+\.(?:webp|avif|png|jpe?g|svg)$/;
export const media = Object.freeze({
  resolve(image) {
    return typeof image === 'string' && LOCAL.test(image) && !image.includes('..', 3)
      ? image
      : null;
  },
});

// overlay.open({ label, onClose }) → { close() }. While one is open the shell
// holds one history entry and locks page scroll. Back closes it and calls
// onClose once; close() releases it without calling onClose. Opening another
// while one is open closes the first through its onClose.
let current = null;
let skipPop = false;
const root = () => document.documentElement;

function release(entry) {
  if (current !== entry) return false;
  current = null;
  root().style.overflow = entry.overflow;
  return true;
}

window.addEventListener('popstate', () => {
  if (skipPop) {
    skipPop = false;
    return;
  }
  const entry = current;
  if (entry && release(entry)) entry.onClose();
});

export const overlay = Object.freeze({
  open({ label, onClose } = {}) {
    if (typeof onClose !== 'function') throw new TypeError('overlay.open needs onClose');
    // A second overlay takes over the first one's history entry and scroll
    // lock (no back-then-push, which would race), and closes it.
    const previous = current;
    const entry = { onClose, overflow: previous ? previous.overflow : root().style.overflow };
    current = entry;
    if (previous) previous.onClose();
    else {
      history.pushState({ protoOverlay: String(label || '') }, '');
      root().style.overflow = 'hidden';
    }
    return Object.freeze({
      close() {
        if (!release(entry)) return;
        skipPop = true;
        history.back();
      },
    });
  },
});
