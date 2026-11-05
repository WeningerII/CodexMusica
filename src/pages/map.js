/* global $ui, UI, uiAddGenre, uiAnnounce, uiFocus, uiNavigate, uiRegisterPage */
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
      '<h1 class="cm-sr-only">World music map</h1><div id="map-status" class="cm-status map-status" role="status" hidden>Loading the map…</div><iframe id="map-frame" title="World music map"></iframe>';
    window.addEventListener('message', async (e) => {
      if (e.origin !== location.origin || e.source !== $ui('map-frame').contentWindow) return;
      if (e.data?.type === 'add-genre' && typeof e.data.id === 'string') {
        // The reply says how much of the ensemble arrived, so the atlas can
        // report a partial addition as partial rather than as done.
        let added = 0,
          expected = 0;
        try {
          ({ added, expected } = await uiAddGenre(e.data.id));
        } catch {
          /* Reported below as nothing added, never left at "Adding…". */
        }
        e.source.postMessage(
          { type: 'genre-added', id: e.data.id, ok: added > 0, added, expected },
          location.origin
        );
      }
      if (e.data?.type === 'genre-web' && typeof e.data.id === 'string') {
        UI.genre = e.data.id;
        uiNavigate('genre', { push: true });
        // Focus was in the map frame, now hidden: it lands on the genre's
        // heading on the Genre page (Jony #102).
        uiFocus($ui('gp-detail-title'));
      }
    });
  },
  // The atlas is loaded on first visit only; it is the heaviest surface.
  render() {
    const frame = $ui('map-frame');
    if (frame.src) return;
    const status = $ui('map-status');
    status.hidden = false;
    // Opened from disk the atlas cannot load its data, and a missing
    // atlas.html beside a standalone build leaves a blank frame whose load
    // event hides the status: say so instead of loading it (#660).
    if (location.protocol === 'file:') {
      frame.hidden = true;
      status.classList.add('map-status-file');
      status.innerHTML = 'Opened from a file, this page can’t load its data. Use codexmusica.com.';
      return;
    }
    let timer,
      observer,
      attempt = 0,
      departures = 0;
    this.mapLeft = () => departures++;
    const load = () => {
      clearTimeout(timer);
      observer?.disconnect();
      const current = ++attempt,
        route = departures;
      let complete = false;
      const failed = () => {
        if (current !== attempt || complete) return;
        clearTimeout(timer);
        frame.hidden = true;
        status.hidden = false;
        status.classList.add('map-status-file');
        if (!status.querySelector('button'))
          status.innerHTML = ' <button type="button">Try again</button>';
        status.firstChild.textContent = 'The map couldn’t load. ';
        status.querySelector('button').onclick = load;
      };
      frame.onload = () => {
        if (current !== attempt || complete) return;
        try {
          if (frame.contentDocument?.URL !== frame.src) return;
          if (!frame.contentDocument.getElementById('map-main')) return failed();
        } catch {
          return failed();
        }
        complete = true;
        clearTimeout(timer);
        const retry = status.querySelector('button');
        const focus =
          retry &&
          document.activeElement === retry &&
          route === departures &&
          UI.view === 'map' &&
          !$ui('surface-map').hidden;
        frame.hidden = false;
        // Capture ownership before our own removal can move focus to body.
        status.textContent = '';
        status.hidden = true;
        if (focus) frame.focus();
        // A loaded atlas document can still fail to fetch its catalog. Let its
        // existing error status speak; announce success only once it is ready.
        const loading = frame.contentDocument.getElementById('loading');
        let announced = false;
        const ready = () => {
          if (current !== attempt || announced) return;
          if (loading.classList.contains('sr-only')) {
            announced = true;
            observer?.disconnect();
            uiAnnounce('The map is ready.');
          }
        };
        if (loading) {
          observer = new MutationObserver(ready);
          observer.observe(loading, { attributes: true, childList: true, subtree: true });
          ready();
        }
      };
      status.hidden = false;
      // Keep the retry control mounted while loading so keyboard focus survives.
      status.firstChild.textContent = 'Loading the map… ';
      frame.hidden = true;
      timer = setTimeout(failed, 10000);
      frame.src = 'atlas.html?embedded=1&load=' + current;
    };
    load();
  },
  leave() {
    this.mapLeft?.();
  },
  resetLayout() {
    $ui('map-frame').contentWindow?.postMessage({ type: 'reset-layout' }, location.origin);
  },
});
