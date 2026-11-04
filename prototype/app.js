// The prototype shell (#670 slices P0 and P2): route switching between six
// panels, the persistent "Your recipe" region, an honest storage status, and
// the feature hosts. Feature content lives in prototype/features/<lane>/;
// the shell mounts it through host.js.
//
// The catalog comes only from the committed static JSON beside the site
// (../api/). There is no call to the connector, /chat or any model provider.

import { read, write, scope } from './storage.js';
import { createHost, announce } from './host.js';
import { loadItems } from './data.js';

const ROUTES = ['browse', 'genre', 'instrument', 'map', 'lyrics', 'library'];
const DEFAULT_ROUTE = 'browse';

const status = document.getElementById('proto-status');

function routeFromHash() {
  const id = decodeURIComponent(location.hash.replace(/^#/, ''));
  return ROUTES.includes(id) ? id : null;
}

// The lane registry: route → lane. Each import is a literal path, so the
// gate can check where feature code may come from. A lane's file not being
// in this build is a stated state, not an error (host.js).
const draft = scope('host');
let draftUnsaved = false;
const LANES = {
  browse: {
    id: 'browse',
    label: 'Browse',
    load: () => import('./features/browse-map/discovery.js'),
    unloaded: 'The catalog did not load, so Browse can’t show any traditions yet.',
    context: async () => ({ items: await loadItems() }),
  },
  lyrics: {
    id: 'lyrics',
    label: 'The Lyrics editor',
    load: () => import('./features/lyrics/editor.js'),
    unloaded: 'The Lyrics editor couldn’t start.',
    // The draft is the shell's to keep, under its own key, so the lane's
    // storage scope is the lane's alone. onChange is called with the exact
    // raw text after each committed edit (6639542176 §2).
    context: async () => {
      const saved = draft.read('lyrics-draft');
      return {
        text: saved.ok && typeof saved.value === 'string' ? saved.value : '',
        onChange(text) {
          const r = draft.write('lyrics-draft', String(text));
          if (r.ok === draftUnsaved) {
            draftUnsaved = !r.ok;
            announce(
              r.ok
                ? 'The draft is saved in this browser again.'
                : 'Not saved: this browser would not store the draft. It is still here in this tab.'
            );
          }
        },
      };
    },
  },
};
const hosts = {};
for (const [route, lane] of Object.entries(LANES)) {
  hosts[route] = createHost(lane, document.querySelector(`[data-panel="${route}"]`));
}

function show(route, { moveFocus }) {
  for (const panel of document.querySelectorAll('[data-panel]')) {
    panel.hidden = panel.dataset.panel !== route;
  }
  for (const link of document.querySelectorAll('[data-route]')) {
    if (link.dataset.route === route) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  document.title = `${route[0].toUpperCase()}${route.slice(1)} · Codex Musica prototype`;
  // A route change the user asked for moves focus to the new panel's heading,
  // so the next Tab lands inside it. The first paint does not take focus.
  if (moveFocus) document.querySelector(`[data-panel="${route}"] h1`).focus();
  if (hosts[route]) hosts[route].show();
  const saved = write('route', route);
  if (!saved.ok) {
    status.textContent =
      'Not saved: this browser would not store the prototype’s settings. It still works in this tab.';
  }
}

window.addEventListener('hashchange', () => {
  const route = routeFromHash();
  if (route) show(route, { moveFocus: true });
});

const stored = read('route');
const initial =
  routeFromHash() || (stored.ok && ROUTES.includes(stored.value) ? stored.value : DEFAULT_ROUTE);
show(initial, { moveFocus: false });

const catalog = document.getElementById('proto-catalog');
fetch('../api/index.json')
  .then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  })
  .then((idx) => {
    const c = idx.counts || {};
    catalog.textContent = `Catalog: ${c.traditions} traditions, ${c.instruments} instruments.`;
  })
  .catch(() => {
    catalog.textContent = 'The catalog did not load, so nothing can be added yet.';
  });
