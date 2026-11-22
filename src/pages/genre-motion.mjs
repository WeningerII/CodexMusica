/* global document, window, matchMedia, getComputedStyle, innerHeight, innerWidth, $ui, uiFind */
// The Chrome same-document recipe: temporarily name the actual image on each
// side of a DOM update, then clear the name when the native transition finishes.
// Adapted from developer.chrome.com/docs/web-platform/view-transitions/same-document
// (Apache-2.0 code samples). See docs/genres-native-transition.md.
let gpTransitionState = null;
function gpFinishTransition(commit = true) {
  const state = gpTransitionState;
  if (!state || state.updating) return;
  state.transition?.skipTransition();
  if (commit) state.update();
  state.done = true;
  state.clean();
}
function gpTransitionImage(id, detail, opener, hitTest = false) {
  const container = detail
    ? $ui('genre-detail')
    : opener
      ? opener.closest('.cm-tile, .gp-row')
      : uiFind('#genre-list .cm-tile', 'id', id) || uiFind('#genre-list .gp-row', 'gpId', id);
  if (detail && container?.dataset.gpId !== id) return null;
  const img = container?.querySelector(
    detail ? '.gp-media .gp-img' : '.cm-tile-img, .gp-media .gp-img'
  );
  if (!img?.complete || !img.naturalWidth) return null;
  // Name the existing photo surface so the card's existing hover zoom stays
  // clipped exactly as it is painted. Never name Listen/Add independently.
  const media = img.closest('.cm-tile-shot, .gp-media');
  const rect = media.getBoundingClientRect();
  if (
    !rect.width ||
    !rect.height ||
    rect.top < 0 ||
    rect.left < 0 ||
    rect.bottom > innerHeight ||
    rect.right > innerWidth
  )
    return null;
  // The Rows viewport can clip a photo even when it is inside the window.
  for (let p = media.parentElement; p; p = p.parentElement) {
    const css = getComputedStyle(p),
      box = p.getBoundingClientRect();
    if (
      /(auto|scroll|hidden|clip)/.test(css.overflowX) &&
      (rect.left < box.left || rect.right > box.right)
    )
      return null;
    if (
      /(auto|scroll|hidden|clip)/.test(css.overflowY) &&
      (rect.top < box.top || rect.bottom > box.bottom)
    )
      return null;
  }
  // Sticky tabs can cover a photo without clipping its ancestor rectangle.
  if (hitTest)
    for (const y of [rect.top + 1, rect.top + rect.height / 2, rect.bottom - 1]) {
      if (!media.contains(document.elementFromPoint(rect.left + rect.width / 2, y))) return null;
    }
  return media;
}
function gpTransition(id, back, change, opener) {
  if (!back && !opener) return change();
  const from = gpTransitionImage(id, back, opener, true);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!from || reduced.matches || !document.startViewTransition) return change();
  let to;
  const source = from.querySelector('img').currentSrc;
  const state = {
    done: false,
    updating: false,
    update() {
      if (state.done) return;
      state.done = true;
      state.updating = true;
      from.style.viewTransitionName = '';
      change();
      state.updating = false;
      to = gpTransitionImage(id, !back);
      // Never wait for an image or scroll to manufacture a counterpart.
      if (!to || to.querySelector('img').currentSrc !== source) state.transition?.skipTransition();
      else to.style.viewTransitionName = 'genre-image';
    },
    clean() {
      if (state.cleaned) return;
      state.cleaned = true;
      from.style.viewTransitionName = '';
      if (to) to.style.viewTransitionName = '';
      if (gpTransitionState === state) {
        gpTransitionState = null;
        document.documentElement.classList.remove('gp-transition');
      }
      reduced.removeEventListener('change', interrupt);
      window.removeEventListener('resize', interrupt);
      document.removeEventListener('pointerdown', interrupt, true);
      document.removeEventListener('keydown', interrupt, true);
      document.removeEventListener('wheel', interrupt, true);
    },
  };
  // A new pointer target must survive until its click. Discard an update
  // that has not run yet; never replace that target underneath the pointer.
  // Keyboard defaults instead start from the committed focus (e.g. Tab).
  const interrupt = (event) => {
    if (gpTransitionState === state) gpFinishTransition(event.type !== 'pointerdown');
  };
  gpTransitionState = state;
  from.style.viewTransitionName = 'genre-image';
  document.documentElement.classList.add('gp-transition');
  reduced.addEventListener('change', interrupt);
  window.addEventListener('resize', interrupt);
  document.addEventListener('pointerdown', interrupt, true);
  document.addEventListener('keydown', interrupt, true);
  document.addEventListener('wheel', interrupt, { capture: true, passive: true });
  try {
    state.transition = document.startViewTransition(state.update);
    state.transition.ready.catch(() => {});
    state.transition.finished.then(state.clean, state.clean);
  } catch {
    state.update();
    state.clean();
  }
}

export { gpFinishTransition as finish, gpTransition as run };
