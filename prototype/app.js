// The prototype shell (#670 slice P0): route switching between six empty
// panels, the persistent "Your recipe" region, and an honest storage status.
// No feature content lives here; feature slices add it.
//
// The catalog comes only from the committed static JSON beside the site
// (../api/). There is no call to the connector, /chat or any model provider.

import { read, write } from './storage.js';

const ROUTES = ['browse', 'genre', 'instrument', 'map', 'lyrics', 'library'];
const DEFAULT_ROUTE = 'browse';

const status = document.getElementById('proto-status');

function routeFromHash() {
  const id = decodeURIComponent(location.hash.replace(/^#/, ''));
  return ROUTES.includes(id) ? id : null;
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
