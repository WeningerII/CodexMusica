// #670 rows 210–211, supporting 219; standalone detail photos, NOT Browse cards.
// Production: main 10b42689f04db0f16a98425b3e22c9a5487b254c,
// src/workbench.js uiPhoto/uiPhotoSources/uiLightbox/uiTileCredit;
// src/pages/{instrument,genre}.js ipImageEntry/gpIndexImages/gpImage.
// ctx: { storage, announce, signal, photos, media, overlay }
// photos: frozen [{ id, name, kind: 'instrument'|'tradition',
//                   image: [thumb, licence, credit, sourcePage, full] }].
// Some committed instrument rows omit full; preserve those four-field tuples too.
// The tradition tuple's full=1 means thumb; there is no separate caption field.
// media.resolve(image): synchronous shell resolver of a source image URL string,
// returning a committed same-origin file URL or null. No blob/remote requests.
// Production remote images resolve null; unavailable photos retain their metadata.
// overlay.open({label,onClose}) -> {close()}: shell owns history and scroll lock.
// Back calls onClose once; close() does not. Local dismissal releases
// the handle once, including when the callback fires synchronously from close().
// Hooks and exact photos shape pinned in #668 comment 6643677838; integration pending.
// No storage is needed for transient photos.

let nextCaption = 0;

const clean = (x) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : '');
const https = (x) => typeof x === 'string' && /^https:\/\//i.test(x);

function photoOf(record) {
  const r = record.image;
  if (!Array.isArray(r) || typeof r[0] !== 'string') return null;
  const tradition = record.kind === 'tradition';
  if (record.kind !== 'instrument' && !tradition) return null;
  if (tradition) {
    if (
      !r[0].trim() ||
      (!https(r[0]) && (/^[a-z][a-z0-9+.-]*:/i.test(r[0]) || r[0].startsWith('//')))
    )
      return null;
  } else if (!/^https:\/\//.test(r[0])) return null;
  const author = tradition ? clean(r[2]) || 'Author not recorded' : r[2] || 'uncredited';
  const licence = tradition ? clean(r[1]) || 'licence not recorded' : r[1] || 'licence not stated';
  return Object.freeze({
    src: r[0],
    full: tradition && r[4] === 1 ? r[0] : typeof r[4] === 'string' ? r[4] : '',
    credit: `Photo: ${author} · ${licence}`,
    href: https(r[3]) ? r[3] : '',
  });
}

function largerSources(photo) {
  const out = [];
  const m =
    /^(https:\/\/[a-z]+\.wikimedia\.org\/.+\/thumb\/.+\/(?:[a-z0-9-]*-)?)\d+px-([^/]+)$/i.exec(
      photo.src
    );
  if (m) out.push(m[1] + '1280px-' + m[2]);
  if (https(photo.full) && photo.full !== photo.src) out.push(photo.full);
  return out;
}

export function mount(host, ctx) {
  if (ctx.signal.aborted) return { unmount() {}, focus() {} };
  const doc = host.ownerDocument;
  const life = new AbortController();
  const signal = life.signal;
  let disposed = false,
    active = null;
  const root = doc.createElement('section');
  root.className = 'media-photos';
  root.setAttribute('aria-label', 'Detail photos');
  root.tabIndex = -1;
  const style = doc.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./lightbox.css', import.meta.url).href;
  const dialog = doc.createElement('dialog');
  dialog.className = 'media-lightbox';
  dialog.tabIndex = -1;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const figure = doc.createElement('figure');
  dialog.append(figure);
  root.append(dialog);
  host.append(style, root);
  const on = (el, event, fn) => el.addEventListener(event, fn, { signal });
  const say = (text) => {
    if (!disposed) ctx.announce(text);
  };
  function localURL(source) {
    if (!source || typeof ctx.media?.resolve !== 'function') return '';
    try {
      const value = ctx.media.resolve(source);
      if (typeof value !== 'string' || !value) return '';
      const url = new URL(value, doc.baseURI);
      return url.origin === doc.location.origin &&
        (url.protocol === 'http:' || url.protocol === 'https:') &&
        !url.username &&
        !url.password
        ? url.href
        : '';
    } catch {
      return '';
    }
  }
  function creditNode(photo) {
    const node = doc.createElement(photo.href ? 'a' : 'span');
    node.textContent = photo.credit;
    if (photo.href) {
      node.href = photo.href;
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
    }
    return node;
  }
  function finish(box, returnFocus) {
    if (active !== box) return;
    active = null;
    box.controller.abort();
    for (const img of box.pending) img.removeAttribute('src');
    dialog.close();
    figure.replaceChildren();
    if (returnFocus && box.trigger.isConnected && !box.trigger.hidden)
      box.trigger.focus({ preventScroll: true });
  }
  function release(box) {
    if (box.shellClosed || box.released) return;
    if (!box.overlay) {
      box.releaseRequested = true;
      return;
    }
    box.released = true;
    try {
      box.overlay.close();
    } catch {
      say('Photo closed, but the shell overlay could not finish closing.');
    }
  }
  function close(returnFocus = true) {
    const box = active;
    if (!box) return;
    finish(box, returnFocus);
    release(box);
  }
  function open(trigger, thumb, photo, name) {
    if (disposed || active || (thumb.complete && !thumb.naturalWidth)) return;
    const box = {
      trigger,
      controller: new AbortController(),
      pending: new Set(),
    };
    active = box;
    try {
      const handle = ctx.overlay.open({
        label: 'Photo of ' + name,
        onClose: () => {
          box.shellClosed = true;
          finish(box, !disposed);
        },
      });
      if (!handle || typeof handle.close !== 'function') throw new Error('Missing overlay handle');
      box.overlay = handle;
    } catch {
      finish(box, !disposed);
      say('Photo enlargement is unavailable.');
      return;
    }
    // open() may synchronously cancel or trigger teardown before returning.
    if (box.releaseRequested) release(box);
    if (active !== box || disposed) return;
    const bs = box.controller.signal;
    const copies = largerSources(photo).map(localURL).filter(Boolean);
    const img = doc.createElement('img');
    const size = (el, w, h) => {
      el.style.setProperty('--photo-w', Math.round(w));
      el.style.setProperty('--photo-h', Math.round(h));
    };
    const thumbSize = () => {
      const w = copies.length ? 1280 : thumb.naturalWidth;
      size(
        img,
        w || 1280,
        thumb.naturalWidth ? (w * thumb.naturalHeight) / thumb.naturalWidth : 960
      );
    };
    img.alt = 'Photo of ' + name;
    thumbSize();
    img.addEventListener('load', thumbSize, { signal: bs });
    img.src = thumb.currentSrc || thumb.src;
    const caption = doc.createElement('figcaption');
    caption.id = `media-photo-caption-${++nextCaption}`;
    dialog.setAttribute('aria-describedby', caption.id);
    const hint = doc.createElement('span');
    hint.className = 'media-lightbox-hint';
    hint.textContent = 'Click anywhere to close';
    const tap = doc.createElement('span');
    tap.className = 'media-lightbox-touch-hint';
    tap.textContent = 'Tap anywhere to close';
    caption.append(creditNode(photo), hint, tap);
    figure.replaceChildren(img, caption);
    dialog.setAttribute('aria-label', 'Photo of ' + name);
    dialog.showModal();
    dialog.focus();
    function next(i) {
      if (active !== box || i >= copies.length) return;
      const probe = doc.createElement('img');
      box.pending.add(probe);
      probe.addEventListener(
        'load',
        () => {
          box.pending.delete(probe);
          if (active !== box) return;
          probe.alt = img.alt;
          size(probe, probe.naturalWidth, probe.naturalHeight);
          img.replaceWith(probe);
        },
        { signal: bs, once: true }
      );
      probe.addEventListener(
        'error',
        () => {
          box.pending.delete(probe);
          next(i + 1);
        },
        { signal: bs, once: true }
      );
      probe.src = copies[i];
    }
    next(0);
  }
  on(dialog, 'click', () => close());
  on(dialog, 'keydown', (event) => {
    const activate =
      (event.key === 'Enter' || event.key === ' ') && event.target === dialog && !event.repeat;
    if (event.key !== 'Escape' && !activate) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  on(dialog, 'cancel', (event) => {
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  const records = Array.isArray(ctx.photos) ? ctx.photos : [];
  for (const record of records) {
    if (!record || typeof record.name !== 'string') continue;
    const card = doc.createElement('figure');
    card.className = 'media-photo';
    const title = doc.createElement('figcaption');
    title.textContent = record.name;
    const fallback = doc.createElement('span');
    fallback.className = 'media-photo-fallback';
    fallback.textContent = 'Photo unavailable';
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', 'Photo unavailable for ' + record.name);
    card.append(fallback, title);
    root.append(card);
    const photo = photoOf(record);
    if (!photo) continue;
    const details = doc.createElement('div');
    details.className = 'media-photo-credit-details';
    details.append(creditNode(photo));
    card.append(details);
    const url = localURL(photo.src);
    if (!url) continue;
    const trigger = doc.createElement('button');
    trigger.type = 'button';
    trigger.className = 'media-photo-enlarge';
    trigger.setAttribute('aria-label', 'Enlarge photo of ' + record.name);
    const thumb = doc.createElement('img');
    thumb.alt = '';
    thumb.decoding = 'async';
    trigger.append(thumb);
    const credit = doc.createElement('button');
    credit.type = 'button';
    credit.className = 'media-photo-credit';
    credit.textContent = 'Photo credit';
    credit.title = photo.credit;
    credit.setAttribute('aria-expanded', 'false');
    details.hidden = true;
    card.prepend(trigger);
    card.append(credit, details);
    fallback.hidden = true;
    on(thumb, 'error', () => {
      if (active?.trigger === trigger) close(false);
      const focused = card.contains(doc.activeElement);
      trigger.hidden = credit.hidden = true;
      details.hidden = false;
      fallback.hidden = false;
      if (focused) {
        root.focus();
        say('Photo unavailable for ' + record.name);
      }
    });
    on(trigger, 'click', () => open(trigger, thumb, photo, record.name));
    on(credit, 'click', () => {
      details.hidden = !details.hidden;
      credit.setAttribute('aria-expanded', String(!details.hidden));
      if (!details.hidden) say(photo.credit);
    });
    on(details, 'keydown', (event) => {
      if (event.key !== 'Escape' || credit.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      details.hidden = true;
      credit.setAttribute('aria-expanded', 'false');
      credit.focus();
    });
    thumb.src = url;
  }
  if (!records.length) {
    const empty = doc.createElement('p');
    empty.textContent = 'No detail photos are available.';
    root.append(empty);
  }
  function unmount() {
    if (disposed) return;
    disposed = true;
    close(false);
    life.abort();
    ctx.signal.removeEventListener('abort', unmount);
    root.remove();
    style.remove();
  }
  ctx.signal.addEventListener('abort', unmount, { once: true, signal });
  if (ctx.signal.aborted) unmount();
  return {
    unmount,
    focus() {
      if (!disposed) (root.querySelector('button:not([hidden])') || root).focus();
    },
  };
}
