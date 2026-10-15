// Shared VM context: loads <root>/src/lyric-tokens.js and <root>/src/pages/lyrics.js
// exactly as scripts/check_lyrics_page.js unitBoundaries does.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
module.exports = function make(root) {
  const sel = { start: 0, end: 0, dir: 'none' };
  const draft = {
    value: '',
    get selectionStart() { return sel.start; },
    get selectionEnd() { return sel.end; },
    get selectionDirection() { return sel.dir; },
    setSelectionRange(a, b, d = 'none') { Object.assign(sel, { start: a, end: b, dir: d }); },
  };
  const toasts = [];
  const app = { lyricMeta: { version: 1, ui: {} }, history: [], historyIndex: -1, lyrics: '' };
  const snapshot = () => ({ lyrics: app.lyrics, lyricMeta: JSON.parse(JSON.stringify(app.lyricMeta)) });
  const ctx = vm.createContext({
    console, setTimeout: () => 0, clearTimeout: () => {},
    $ui: (id) => (id === 'lyrics-draft' ? draft : null),
    uiRegisterPage: () => {},
    uiCount: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`,
    chatState: { generation: 0, lyric: null, busy: false },
    UI: {}, app,
    lyricMetaOf: (v) => (v && v.version === 1 ? v : { version: 1, notes: {}, ui: {} }),
    uiAutosave: () => {},
    uiSaveLyrics: () => (app.lyrics = draft.value),
    sessionSnapshot: snapshot,
    pushHistory: () => {
      const snap = JSON.stringify(snapshot());
      const prev = app.history[app.historyIndex];
      if (prev && JSON.parse(prev).lyrics === app.lyrics) { app.history[app.historyIndex] = snap; return; }
      app.history = app.history.slice(0, app.historyIndex + 1);
      app.history.push(snap);
      app.historyIndex = app.history.length - 1;
    },
    showToast: (m, tone) => toasts.push([m, tone]),
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'src/lyric-tokens.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/pages/lyrics.js'), 'utf8'), ctx, { filename: 'lyrics.js' });
  ctx.lyRefresh = () => {};
  const run = (code, vars = {}) => { Object.assign(ctx, vars); return vm.runInContext(code, ctx); };
  return { ctx, run, draft, sel, app, toasts };
};
