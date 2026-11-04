// #670 checklist 235–236 / Library 15–16. Standalone, not registered by this slice.
// Production: src/library/rights.js at 10b42689f04db0f16a98425b3e22c9a5487b254c.
// Accepted data/action contract: #668 comment 6641909843.
// ctx.catalog = immutable catalog.json object; ctx.artwork = immutable artwork.json
// object, NOT a new record schema. The host loads these; this module never does.
// Accepted image contract: #668 comment 6642118480. ctx.artworkUrls is a frozen
// plain object keyed by artwork ID. The host includes only committed renditions
// with values '../assets/library/art/<id>-480.webp'; missing key means no image.
// Credit records remain unchanged; the lane never constructs a rendition path.
// Production's credits use 240px WebP renditions displayed at 72px; this prototype
// displays the host-supplied 480px rendition at 72px, matching the shelf URL rule.
// ctx.inspectAll() owns production's /works?availability=all
// intent. It may return a promise; rejection is shown and announced. It must not
// hide a Render request. Without the callback the action is visibly unavailable.
// Common ctx: { storage, announce, signal }. storage has read/write/remove result
// objects {ok,value?,reason?}; this read-only view has no persistent state and
// deliberately calls none of them. The host loads census-credits.css.
// Proposed improvements over production: distinct link accessible names, safe
// URL rejection, visible missing-image/action feedback and callback error feedback.
// Counts, their ordering, snapshot and attribution text retain production semantics.

const METRICS = Object.freeze([
  'source_files',
  'collections',
  'works',
  'editions',
  'reading_units',
  'readable_collections',
  'readable_works',
  'readable_editions',
  'readable_reading_units',
]);

export function mount(host, ctx) {
  const doc = host.ownerDocument;
  let alive = !ctx.signal?.aborted;
  let busy = false;
  const cleanup = [];
  const root = doc.createElement('section');
  root.className = 'pcc';
  root.setAttribute('aria-label', 'Sources & rights');
  const node = (tag, text, parent = root, className) => {
    const el = doc.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    parent.append(el);
    return el;
  };
  const listen = (el, event, fn) => {
    el.addEventListener(event, fn);
    cleanup.push(() => el.removeEventListener(event, fn));
  };
  function unmount() {
    alive = false;
    cleanup.splice(0).forEach((fn) => fn());
    root.remove();
  }
  const heading = node('h2', 'Sources & rights');
  heading.tabIndex = -1;
  const handle = Object.freeze({
    unmount,
    focus: () => {
      if (alive) heading.focus();
    },
  });
  if (!alive) return handle;
  if (ctx.signal) listen(ctx.signal, 'abort', unmount);
  node(
    'p',
    'Text, editions, transcriptions and artwork retain their own records.',
    root,
    'pcc-note'
  );
  const census = node('section', undefined, root, 'pcc-card');
  node('h3', 'Catalog census', census);
  if (ctx.catalog && typeof ctx.catalog === 'object') {
    const c = Object.freeze({ ...ctx.catalog.census });
    const availability = Object.freeze({ ...c.availability });
    const list = node('dl', undefined, census, 'pcc-census');
    const metric = (label, value) => {
      const row = node('div', undefined, list);
      node('dt', label, row);
      node('dd', Number(value).toLocaleString(), row);
    };
    for (const key of METRICS) metric(key.replace(/_/g, ' '), c[key] ?? 0);
    for (const [key, value] of Object.entries(availability)) {
      metric(key.replace(/_/g, ' ') + ' units', value);
    }
    const snapshot = ctx.catalog.projected_from?.snapshot_id;
    if (snapshot) node('p', 'Readings: snapshot ' + snapshot.slice(0, 8), census, 'pcc-note');
    node(
      'p',
      'Held and research records remain searchable as metadata. Their source bodies are excluded from readable exports.',
      census,
      'pcc-note'
    );
    const inspect = node('button', 'Inspect all recorded availability', census);
    inspect.type = 'button';
    const status = node('p', '', census, 'pcc-note');
    if (typeof ctx.inspectAll !== 'function') {
      inspect.disabled = true;
      status.textContent = 'Availability inspection is not connected in this prototype.';
    } else {
      listen(inspect, 'click', async () => {
        if (!alive || busy) return;
        busy = true;
        inspect.setAttribute('aria-disabled', 'true');
        status.textContent = '';
        try {
          await ctx.inspectAll();
        } catch (error) {
          if (alive) {
            status.textContent =
              typeof error?.message === 'string' && error.message
                ? error.message
                : 'Availability inspection could not be opened.';
            ctx.announce?.(status.textContent);
          }
        } finally {
          if (alive) {
            busy = false;
            inspect.removeAttribute('aria-disabled');
          }
        }
      });
    }
  } else {
    node('p', 'The catalog census could not be loaded', census, 'pcc-note');
  }

  const credits = node('section', undefined, root, 'pcc-card');
  node('h3', 'Artwork credits', credits);
  node(
    'p',
    'Collection artwork is historical and credited here; it is in no export package.',
    credits,
    'pcc-note'
  );
  if (!Array.isArray(ctx.artwork?.artwork)) {
    node('p', 'Artwork credits could not be loaded', credits, 'pcc-note');
  } else {
    const records = Object.freeze(
      ctx.artwork.artwork.map((record) => Object.freeze({ ...record }))
    );
    for (const art of records) {
      const row = node('article', undefined, credits, 'pcc-art');
      const preview = node('div', undefined, row, 'pcc-preview');
      let imageURL;
      const supplied = ctx.artworkUrls?.[art.id];
      if (typeof supplied === 'string' && supplied) {
        try {
          const url = new URL(supplied, doc.baseURI);
          const base = new URL(doc.baseURI);
          if (url.origin === base.origin && ['http:', 'https:'].includes(url.protocol))
            imageURL = url.href;
        } catch {
          /* Missing/invalid previews never remove attribution. */
        }
      }
      if (imageURL) {
        const img = node('img', undefined, preview);
        img.alt = art.title;
        img.width = 72;
        img.height = 72;
        img.loading = 'lazy';
        listen(img, 'error', () => {
          if (!alive) return;
          img.remove();
          if (!preview.textContent)
            node('span', 'Artwork preview unavailable.', preview, 'pcc-note');
        });
        img.src = imageURL;
      } else {
        node('span', 'Artwork preview unavailable.', preview, 'pcc-note');
      }
      const text = node('div', undefined, row);
      node('h4', art.title, text);
      node('p', art.author, text);
      node('p', art.credit, text);
      node('small', art.note || '', text, 'pcc-note');
      let safe = false;
      try {
        safe = ['http:', 'https:'].includes(new URL(art.source).protocol);
      } catch {
        /* Render plain source text. */
      }
      if (safe) {
        const link = node('a', 'Source', text);
        link.href = art.source;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', 'Source for ' + art.title + ' (opens in a new tab)');
      } else if (art.source) {
        node('p', art.source, text, 'pcc-note');
      }
    }
  }
  if (alive) host.append(root);
  return handle;
}
