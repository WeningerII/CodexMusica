// ─── Library chunk: core ───────────────────────────────────────────────────
// Wrapped by the build as CMLibraryDefine('core', function () { … }). PR 3
// carries only the contract (show(main, sub)); the Explore shelves, Works,
// Sources & rights and the static data client arrive in PR 4.
/* global uiEmptyState */
'use strict';
const SECTIONS = { '': 'Explore', '/works': 'Works', '/rights': 'Sources & rights' };
return {
  show(main, sub) {
    const section = SECTIONS[sub.split('?')[0]] || 'Explore';
    main.innerHTML = uiEmptyState({
      title: section,
      text: 'The native Library is being built behind a flag.',
    });
    main.dataset.libraryChunk = 'core';
  },
};
