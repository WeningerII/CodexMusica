/* exported uiLyricsWaiting */
/* global $ui, UILayout, _chatSyncCount, app, compileRecipeStack, copyToClipboard, pushHistory, showToast, uiButton, uiNavigate, uiNewTask, uiRegisterPage, uiSaveLyrics, uiSwitchChat */
/* Lyrics page. Owned by the Lyrics page worker; see docs/ui-foundation.md.
   The draft text is session state (app.lyrics, written through the shell's
   uiSaveLyrics) and the writer conversation is the shell's shared chat dock,
   which this page hosts in #lyrics-chat. Lyric workflows talk to the harness
   only through the existing chat contracts in src/app.js. */
'use strict';
function uiLyricsWaiting() {
  if ($ui('lyrics-wait')) return;
  const note = document.createElement('div');
  note.id = 'lyrics-wait';
  note.innerHTML =
    '<p>Your recipe request is still running.</p>' +
    uiButton('view-running', 'View request', 'message-circle');
  $ui('lyrics-chat').append(note);
}
uiRegisterPage({
  id: 'lyrics',
  mount(surface) {
    surface.innerHTML = `<div class="lyrics-toolbar">${uiButton('new-lyrics', 'New lyrics', 'edit-3')}${uiButton('edit-lyrics', 'Edit lyrics', 'edit-3')}${uiButton('attach-recipe', 'Use current recipe', 'layers')}${uiButton('copy-lyrics', 'Copy lyrics', 'copy')}</div><div class="lyrics-workspace"><div class="lyrics-editor"><label for="lyrics-draft">Lyrics</label><textarea id="lyrics-draft" placeholder="Write here, or ask the lyrics writer." spellcheck="true"></textarea></div><div id="lyrics-chat"></div></div>`;
    $ui('lyrics-draft').addEventListener('input', uiSaveLyrics);
    $ui('lyrics-draft').addEventListener('blur', () => pushHistory());
  },
  // Page-specific geometry. The shell calls this once, after its own panes.
  layout() {
    const lyrics = document.querySelector('.lyrics-workspace');
    const editor = document.querySelector('.lyrics-editor');
    editor.id = 'lyrics-editor';
    UILayout.splitter({
      container: lyrics,
      panel: editor,
      key: 'lyrics',
      property: '--lyrics-width',
      title: 'Resize lyrics editor',
      limits: () => [260, Math.max(260, lyrics.clientWidth - 300)],
      enabled: () => innerWidth >= 900 && lyrics.clientWidth > 680,
    });
  },
  actions: {
    'view-running'() {
      uiNavigate('genre');
      document.body.classList.add('assistant-open');
    },
    'new-lyrics'() {
      uiNewTask('lyrics');
    },
    'edit-lyrics'() {
      if (!uiNewTask('lyrics-edit')) return;
      $ui('chat-input').value = 'Edit these lyrics:\n' + $ui('lyrics-draft').value;
      // maxlength does not bind a script write, so a long draft lands PAST
      // the wall; the counter is what says so before the server refuses it.
      _chatSyncCount();
    },
    'attach-recipe'() {
      if (!uiSwitchChat('lyrics')) {
        showToast('Wait for the active recipe request to finish.', 'error');
        return;
      }
      $ui('chat-input').value =
        'Write lyrics for this recording recipe:\n' +
        compileRecipeStack(app.cards, 'rich', { ceiling: 1000 });
      _chatSyncCount();
      $ui('chat-input').focus();
    },
    'copy-lyrics'() {
      copyToClipboard($ui('lyrics-draft').value, 'Lyrics copied', 'Could not copy');
    },
  },
});
