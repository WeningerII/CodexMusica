/* global UILayout */
'use strict';
UILayout.anchor(document.getElementById('results'), document.getElementById('search'));
for (const [id, title] of [
  ['card', 'tradition detail'],
  ['thread-card', 'guided thread'],
  ['stack', 'traditions at this location'],
  ['list', 'traditions in view'],
  ['legend-panel', 'map legend'],
  ['threads-panel', 'guided threads'],
]) {
  UILayout.floating(document.getElementById(id), { key: 'map-' + id, title });
}
const listToggle = document.createElement('button');
listToggle.className = 'map-extra';
listToggle.textContent = '☰ In view';
listToggle.setAttribute('aria-expanded', 'false');
listToggle.setAttribute('aria-controls', 'list');
listToggle.onclick = () => {
  const on = document.body.classList.toggle('list-open');
  listToggle.setAttribute('aria-expanded', String(on));
};
document.querySelector('.topbar-actions').append(listToggle);
const info = document.createElement('button');
info.className = 'map-extra';
info.textContent = 'ⓘ';
info.setAttribute('aria-label', 'Map information');
info.setAttribute('aria-expanded', 'false');
info.setAttribute('aria-controls', 'provenance');
info.onclick = () => {
  // The atlas fills provenance asynchronously; attach the action after that
  // content so the initial data load cannot overwrite it.
  document.querySelector('.provenance').append(resetLayout);
  info.setAttribute('aria-expanded', String(document.body.classList.toggle('show-provenance')));
};
document.querySelector('.topbar-actions').append(info);
const resetLayout = document.createElement('button');
resetLayout.className = 'map-extra';
resetLayout.textContent = 'Reset layout';
resetLayout.onclick = () => UILayout.reset();
document.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  const url = new URL(a.href, location.href);
  if (url.pathname.endsWith('codex.html') && url.searchParams.has('trad')) {
    if (parent === window) return;
    e.preventDefault();
    parent.postMessage({ type: 'add-genre', id: url.searchParams.get('trad') }, location.origin);
    a.dataset.adding = url.searchParams.get('trad');
    a.textContent = 'Adding…';
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.body.classList.remove('list-open', 'show-provenance');
    listToggle.setAttribute('aria-expanded', 'false');
    info.setAttribute('aria-expanded', 'false');
  }
});

window.addEventListener('message', (e) => {
  if (e.origin === location.origin && e.source === parent && e.data?.type === 'reset-layout')
    UILayout.reset();
  if (e.origin !== location.origin || e.source !== parent || e.data?.type !== 'genre-added') return;
  document.querySelectorAll('[data-adding]').forEach((a) => {
    if (a.dataset.adding === e.data.id) {
      delete a.dataset.adding;
      a.textContent = e.data.ok ? 'Added · Add again' : 'Retry adding genre';
    }
  });
});
