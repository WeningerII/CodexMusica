/* The saved session's head start: the lazy page only (scripts/build_html.js
   inlines it into <head>, right after the boot index's preload; the embedded
   build carries the instrument data and has no use for it).

   A saved session draws its cards at boot, and cards need the instrument data
   (api/engine.json), so with one stored the page cannot draw until that file
   is in. app.js asks for it as soon as it runs (ENGINE_AT_BOOT), but app.js is
   most of the way down a page that is still arriving; this asks from <head>,
   so the file travels with the page instead of after it. Without a saved
   session it does nothing, and the first view's download is the page and the
   boot index alone.

   The test is _bootNeedsEngine's in src/app.js, over storedSessionText's keys
   in the same order: the first stored session holds at least one card. Any
   failure (storage refused, a session that does not parse) asks for nothing,
   as _bootNeedsEngine answers false. check_lazy_app.js proves the two agree
   over every kind of stored state; app.js decides again when it runs, so a
   session another tab saves or clears meanwhile is still honoured.

   app.js's fetch() reuses the preloaded response: the URL is the one it asks
   for (`${CODEX_LAZY_API}engine.json?v=<the first 12 of CODEX_ENGINE_SHA>`,
   substituted for ENGINE_URL by the build), and crossorigin (anonymous) gives
   the mode and credentials of fetch()'s defaults; a mismatch would show as a
   second request. Attributes are set, not IDL properties, so every host reads
   the same element. build_html.js --check runs this script against stored
   states and refuses a page whose dynamic preload is anything else. */
(function () {
  try {
    var text =
      sessionStorage.getItem('codex-workbench-recovery') ||
      localStorage.getItem('codex-workbench-v1') ||
      localStorage.getItem('musica-workbench-v3') ||
      localStorage.getItem('musica-study-v1') ||
      null;
    var s = JSON.parse(text || 'null');
    var cards = s && (s.cards || (s.workspace && s.workspace.cards));
    if (!Array.isArray(cards) || !cards.length) return;
    var link = document.createElement('link');
    link.setAttribute('rel', 'preload');
    link.setAttribute('as', 'fetch');
    link.setAttribute('crossorigin', 'anonymous');
    link.setAttribute('href', 'ENGINE_URL');
    document.head.appendChild(link);
  } catch {
    /* Nothing is asked for early; app.js decides as it always has. */
  }
})();
