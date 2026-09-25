/* global $ui, UI, uiAddGenre, uiNavigate, uiRegisterPage */
/* Map page (the codex side). Owned by the Map page worker together with
   atlas.html, src/atlas.js, src/atlas-tiles.js, src/map-ui.js and src/map.css;
   see docs/ui-foundation.md. The atlas runs in a same-origin iframe and asks
   the shell to change the shared recipe only through postMessage. */
'use strict';
uiRegisterPage({
  id: 'map',
  // The map keeps the page; Your recipe docks under it (see the shell).
  recipe: 'dock',
  mount(surface) {
    surface.innerHTML =
      '<div id="map-status" class="cm-status map-status" role="status" hidden>Loading the map…</div><iframe id="map-frame" title="World music map"></iframe>';
    window.addEventListener('message', async (e) => {
      if (e.origin !== location.origin || e.source !== $ui('map-frame').contentWindow) return;
      if (e.data?.type === 'add-genre' && typeof e.data.id === 'string') {
        // The reply says how much of the ensemble arrived, so the atlas can
        // report a partial addition as partial rather than as done.
        const { added, expected } = await uiAddGenre(e.data.id);
        e.source.postMessage(
          { type: 'genre-added', id: e.data.id, ok: added > 0, added, expected },
          location.origin
        );
      }
      if (e.data?.type === 'genre-web' && typeof e.data.id === 'string') {
        UI.genre = e.data.id;
        uiNavigate('genre');
      }
    });
  },
  // The atlas is loaded on first visit only; it is the heaviest surface.
  render() {
    const frame = $ui('map-frame');
    if (frame.src) return;
    $ui('map-status').hidden = false;
    frame.addEventListener('load', () => ($ui('map-status').hidden = true), { once: true });
    frame.src = 'atlas.html?embedded=1';
  },
  resetLayout() {
    $ui('map-frame').contentWindow?.postMessage({ type: 'reset-layout' }, location.origin);
  },
});
