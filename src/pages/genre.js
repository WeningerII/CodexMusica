/* exported renderGenreDiscovery, renderGenreWeb */
/* global $ui, Catalog, uiEmptyState, uiFind, uiFocus, Inst, icon, Tradition, UI, app, axisLabel, countDescendantLeaves, esc, findSimilar, getChildren, getMatchingAxes, getRoots, getTreeNode, image, listenLink, normalizeSearch, renderTradPicker, tradParent, traditionGlyphsHTML, uiButton, uiRegisterPage */
/* Genre page. Owned by the Genre page worker; see docs/ui-foundation.md.
   Shared state, recipe commands (genre-add, instrument-add), navigation and
   theming belong to the shell in src/workbench.js and src/theme.css. */
'use strict';
function uiGenreRows(list) {
  return (
    list
      .slice(0, UI.limit)
      .map(
        (t) =>
          `<div class="catalog-row"><button class="catalog-name" data-ui="genre-select" data-id="${esc(t.id)}">${traditionGlyphsHTML(t.id, 30)}<span>${esc(t.name)}</span></button>${listenLink(t.name)}${uiButton('genre-add', 'Add', 'plus', `data-id="${esc(t.id)}" aria-label="Add ${esc(t.name)}"`)}</div>`
      )
      .join('') + (list.length > UI.limit ? uiButton('more', 'Show more', 'chevron-down') : '')
  );
}
function uiDetachTree() {
  const t = $ui('modal-trad');
  if (t && t.parentElement === $ui('genre-body')) {
    document.body.append(t);
    t.classList.remove('inline-tree');
  }
}
function renderGenreDiscovery() {
  uiDetachTree();
  if (!$ui('genre-body')) return;
  const q = normalizeSearch($ui('genre-search').value),
    roots = getRoots();
  const node = UI.genreNode ? getTreeNode(UI.genreNode) : null;
  let children = node ? getChildren(node.id) : roots;
  let all = Catalog.all();
  if (q)
    all = all
      .filter((t) =>
        normalizeSearch(
          t.name + ' ' + (t.lineage || '') + ' ' + (Catalog.ext(t.id)?.description || '')
        ).includes(q)
      )
      .sort((a, b) =>
        normalizeSearch(a.name) === q
          ? -1
          : normalizeSearch(b.name) === q
            ? 1
            : a.name.localeCompare(b.name, 'en')
      );
  else {
    if (node) {
      const under = (id) => {
        let p = tradParent(id);
        while (p) {
          if (p === node.id) return true;
          p = getTreeNode(p)?.parent;
        }
        return false;
      };
      all = all.filter(
        (t) => under(t.id) || (Catalog.ext(t.id)?.crossRefs || []).includes(node.id)
      );
    }
    // Catalog.all() is the catalog's declaration order — the order traditions
    // were researched and added, which reads as arbitrary in a flat list. Search
    // results and the instrument list are already alphabetical; the browse list
    // is too. Copy before sorting: the unfiltered path hands back the live array.
    all = all.slice().sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  }
  if (UI.genre) {
    renderGenreWeb(UI.genre);
    return;
  }
  const branches = children.filter((c) => TREE_NODES.some((n) => n.id === c.id));
  $ui('genre-body').innerHTML =
    `<div class="discovery-grid"><nav class="catalog-categories" aria-label="Genre categories">${node ? `<div class="category-heading">${uiButton('genre-back', 'Back to ' + (getTreeNode(node.parent)?.name || 'all genres'), 'arrow-left')}<strong>${esc(node.name)}</strong></div>` : ''}${!q && branches.length ? `<div class="branch-key">${branches.map((n) => `<button data-ui="genre-branch" data-id="${esc(n.id)}">${traditionGlyphsHTML(n.id, 22)}<span>${esc(n.name)}</span><span class="category-count">${countDescendantLeaves(n.id)}</span></button>`).join('')}</div>` : ''}</nav><div class="catalog-list"><div class="catalog-count">${all.length.toLocaleString()} genres</div>${uiGenreRows(all)}${
      !all.length
        ? uiEmptyState({
            title: `No genres match “${$ui('genre-search').value.trim()}”`,
            text: 'Search covers names, lineage and descriptions.',
            actions: uiButton('genre-clear-search', 'Clear search', 'x'),
          })
        : ''
    }</div></div>`;
}
function renderGenreWeb(id) {
  uiDetachTree();
  const t = Tradition(id);
  if (!t) return;
  const ext = Catalog.ext(id) || {},
    near = findSimilar(id, 8),
    added = app.cards.some((c) => c.traditionId === id);
  $ui('genre-body').innerHTML =
    `<div class="genre-selected"><div class="selected-head">${uiButton('genre-close', 'Back', 'arrow-left')}<h2>${traditionGlyphsHTML(id, 32)}${esc(t.name)}</h2>${listenLink(t.name)}${uiButton('genre-add', added ? 'Add again' : 'Add genre', 'plus', `data-id="${esc(id)}"`)}</div><div class="genre-facts"><details class="cm-accordion"><summary>About ${esc(t.name)}</summary><p>${esc(ext.description || t.lineage || '')}</p></details><details class="cm-accordion"><summary>Sound profile</summary>${AXIS_DEFINITIONS.map((ax) => `<div class="profile-row"><span>${esc(ax.name)}</span><span>${esc(axisLabel(ax, ext.axes?.[ax.id] || 0))}</span></div>`).join('')}</details><details class="cm-accordion" open><summary>Instruments</summary><div class="genre-instruments">${(t.instruments || []).map((i) => `<div>${image(i, 26)}<button data-ui="instrument-inspect" data-id="${esc(i)}">${esc(Inst(i)?.name || i)}</button>${listenLink(Inst(i)?.name || i, true)}${uiButton('instrument-add', 'Add', 'plus', `data-id="${esc(i)}"`)}</div>`).join('')}</div></details><details class="cm-accordion"><summary>Related genres · sound similarity</summary>${near
      .map((n) => {
        const other = Tradition(n.id);
        return `<div class="related-row"><button data-ui="genre-select" data-id="${esc(n.id)}">${traditionGlyphsHTML(n.id, 24)}${esc(other.name)}</button><span>${getMatchingAxes(
          id,
          n.id,
          3
        )
          .map((m) => esc(m.axis.name))
          .join(
            ' · '
          )}</span>${uiButton('genre-add', 'Add', 'plus', `data-id="${esc(n.id)}"`)}</div>`;
      })
      .join(
        ''
      )}</details>${(ext.crossRefs || []).length ? `<details class="cm-accordion"><summary>Also belongs to</summary>${ext.crossRefs.map((id) => uiButton('genre-branch', getTreeNode(id)?.name || id, 'layers', `data-id="${esc(id)}"`)).join('')}</details>` : ''}</div></div>`;
}
// Back from a genre's detail to the list, returning focus to its row.
function uiGenreBack() {
  const id = UI.genre;
  UI.genre = null;
  renderGenreDiscovery();
  uiFocus(uiFind('#genre-body [data-ui="genre-select"]', 'id', id)) || uiFocus($ui('genre-search'));
}
uiRegisterPage({
  id: 'genre',
  mount(surface) {
    surface.innerHTML = `<div class="discovery-toolbar"><label class="ui-search cm-search">${icon('search', 20)}<input id="genre-search" type="search" placeholder="Search genres" aria-label="Search genres"></label>${uiButton('genre-tree', 'Browse tree', 'list')}${uiButton('ai', 'AI recipe', 'message-circle')}</div><div id="genre-body"></div>`;
    $ui('genre-search').addEventListener('input', () => {
      UI.genre = null;
      UI.limit = 50;
      renderGenreDiscovery();
    });
  },
  render: renderGenreDiscovery,
  // Escape closes what this page opened: the inline tree, then a detail.
  escape() {
    const tree = $ui('modal-trad');
    if (tree?.classList.contains('inline-tree')) {
      tree.querySelector('[data-close]').click();
      uiFocus(document.querySelector('[data-ui="genre-tree"]'));
    } else if (UI.genre) uiGenreBack();
  },
  actions: {
    'genre-branch'(id) {
      UI.genre = null;
      UI.genreNode = id;
      UI.limit = 50;
      $ui('genre-search').value = '';
      renderGenreDiscovery();
    },
    'genre-back'() {
      UI.genreNode = getTreeNode(UI.genreNode)?.parent || '';
      renderGenreDiscovery();
    },
    'genre-select'(id) {
      UI.genre = id;
      renderGenreWeb(id);
      $ui('surface-genre').scrollTop = 0;
    },
    'genre-close'() {
      uiGenreBack();
    },
    'genre-clear-search'() {
      $ui('genre-search').value = '';
      UI.limit = 50;
      renderGenreDiscovery();
      $ui('genre-search').focus();
    },
    'genre-tree'() {
      const tree = $ui('modal-trad');
      if (tree.parentElement !== $ui('genre-body')) $ui('genre-body').replaceChildren(tree);
      tree.classList.add('inline-tree');
      tree.querySelector('.modal').removeAttribute('aria-modal');
      tree.querySelector('.modal').setAttribute('role', 'region');
      tree.querySelector('h2').textContent = 'Genres';
      tree.querySelector('[data-close]').onclick = () => {
        tree.classList.remove('inline-tree');
        document.body.append(tree);
        renderGenreDiscovery();
      };
      renderTradPicker();
    },
  },
});
