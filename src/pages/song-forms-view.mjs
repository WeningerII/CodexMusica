import { relationshipsFor } from './song-form-relations.mjs';
import { layout } from './song-forms-layout.mjs';
import { projectSongFormCreation } from '../song-form-creation.mjs';
import { describeForm, realizeForm } from '../song-forms.mjs';
import {
  arc,
  structure,
  geometry,
  returnIds,
  detailsOf,
  title as chartTitle,
} from './song-form-structure.mjs';
import './vendor/d3.min.js';
/* global document, URL, fetch, Option, AbortController, MutationObserver, matchMedia, console, getComputedStyle, ResizeObserver, FormData, window, navigator, cancelAnimationFrame, requestAnimationFrame */

const display = (value) => String(value).replaceAll('-', ' ');
const title = (value) => value.charAt(0).toUpperCase() + value.slice(1);

function el(tag, text = '', className = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function rangeText(min, max) {
  return max === null ? min + ' or more' : min === max ? String(min) : min + '–' + max;
}

function unitName(node) {
  return display(node.unit) + (node.role ? ' · ' + display(node.role) : '');
}

function nodeText(node) {
  const parts = [title(unitName(node))];
  if (node.times !== undefined) {
    const times = Array.isArray(node.times) ? rangeText(...node.times) : node.times;
    parts.push('× ' + times);
  }
  for (const [key, label] of [
    ['rhyme', 'rhyme'],
    ['returns', 'refrain'],
    ['endWord', 'end word'],
    ['syllables', 'syllables'],
    ['stress', 'spoken stress pattern'],
    ['stresses', 'stressed syllables'],
    ['bars', 'bars'],
  ]) {
    if (node[key] !== undefined) parts.push(label + ' ' + node[key]);
  }
  return parts.join(' · ');
}

// Build each branch when opened. A long unbounded repetition stays navigable
// without mounting thousands of rows on the editor's main thread.
function branchList(nodes, depth = 0) {
  const list = el('ul');
  let next = 0;
  function page() {
    const end = Math.min(nodes.length, next + 64);
    for (; next < end; next++) {
      const node = nodes[next];
      const item = el('li');
      if (node.children?.length) {
        const details = el('details');
        details.append(el('summary', nodeText(node)));
        const openChildren = () => {
          if (details.open && details.childElementCount === 1) {
            details.append(branchList(node.children, depth + 1));
          }
        };
        details.addEventListener('toggle', openChildren);
        details.open = depth < 2;
        openChildren();
        item.append(details);
      } else {
        item.textContent = nodeText(node);
      }
      list.append(item);
    }
    if (next < nodes.length) {
      const more = el('li');
      const button = el(
        'button',
        'Show next ' + Math.min(64, nodes.length - next),
        'cm-btn cm-btn-outline'
      );
      button.type = 'button';
      button.addEventListener('click', () => {
        const previous = more.previousElementSibling;
        more.remove();
        page();
        const first = previous.nextElementSibling;
        first.tabIndex = -1;
        first.focus();
      });
      more.append(button);
      list.append(more);
    }
  }
  page();
  return list;
}

function writerDescription({ arrangement, contract, nestedDivisions }) {
  const statements = [];
  if (arrangement?.scansion === 'regular-anapestic-feet')
    statements.push('This setting uses complete weak–weak–strong feet.');
  if (contract.sections.some((section) => section.textualFunction))
    statements.push('The literary function requires an attributed reading of the submitted words.');
  if (nestedDivisions)
    statements.push(
      'The writer preserves the nested divisions and any participant assignments in the score.'
    );
  if (contract.sections.some((s) => s.divisionPath?.at(-1)?.unit === 'metrical-stanza'))
    statements.push(
      'This setting compares the syllable counts and stress patterns of corresponding stanza lines.'
    );
  if (contract.id === 'pindaric-ode')
    statements.push(
      'Each triad compares the first two stanzas line by line for syllables and stress. The closing stanza needs a contrasting syllable count.'
    );
  if (contract.sections.some((s) => s.vocalDuty))
    statements.push(
      'The vocal check compares the singers assigned to each section with the score’s roster.'
    );
  if (contract.sections.at(-1)?.vocalDuty === 'reprise')
    statements.push('The ensemble repeats the closing lines of the last solo verse.');
  if (contract.spokenClose)
    statements.push(
      'A timed guitar figure repeats under the verse. The score checks the final spoken line and any required rhyme. Comic effect and acoustic performance are outside this check.'
    );
  if (contract.closingChord)
    statements.push(
      'This setting closes with four voices sustaining a close-position major triad through the end of the final line.'
    );
  if (contract.imitationRepeats)
    statements.push(
      'This setting assigns each voice a timed entrance and a literal unison phrase. The score checks overlapping entries and the selected number of repetitions.'
    );
  if (contract.printedParagraphs)
    statements.push(
      'Write each paragraph as one unbroken row with sentence-final punctuation. Leave a blank line between paragraphs.'
    );
  if (contract.printedSteps)
    statements.push(
      'Each logical line is printed in successive, increasingly indented rows. The writer uses one verse for this setting.'
    );
  if (contract.phraseLines)
    statements.push('This arrangement prints each measured phrase on a separate line.');
  else if (arrangement) {
    const { divisions } = arrangement;
    statements.push(
      divisions.length === 1
        ? 'The writer uses one ' + divisions[0].lines + '-line verse for this pattern.'
        : 'The writer uses a verse for each division and keeps the displayed line counts.'
    );
  }
  const first = contract.sections[0];
  if (first?.sourceRole) {
    statements.push(
      first.role === 'chorus'
        ? 'Each labeled block is sung as a chorus. Repeat its lines verbatim.'
        : 'Each labeled sonnet occupies a separate 14-line verse.'
    );
  }
  if (contract.rhymeGroups.length === 1)
    statements.push('All line endings must rhyme with each other.');
  if (contract.rhymeGroups.length > 1) {
    const groups = contract.rhymeGroups.map((group) => group.join(', '));
    statements.push(
      'Use a distinct ending sound for each group of lines: ' + groups.join(' / ') + '.'
    );
  }
  if (contract.lineProfile === 'linked-couplet-echoes')
    statements.push(
      'Across each couplet boundary, change one word in a line of at least three words. Echo the opening in the final line. This setting checks wording.'
    );
  if (contract.lineProfile === 'english-short-long-five')
    statements.push(
      'One English setting uses up to 31 syllables total. Lines 1 and 3 are shorter than each of lines 2, 4 and 5.'
    );
  if (contract.lineProfile === 'single-phrase-lines')
    statements.push(
      'Write each line as a noun phrase with a determiner and up to two adjectives before the noun. This setting checks phrasing.'
    );
  if (['pivot-synonym', 'pivot-antonym'].includes(contract.lineProfile))
    statements.push(
      'Use adjectives on lines 2 and 6, and -ing verbs on 3 and 5. The middle four nouns move from the opening noun’s sense to the closing noun’s sense. The endpoints use the selected ' +
        contract.lineProfile.slice(6) +
        ' relation.'
    );
  if (contract.lineProfile === 'didactic-word-roles')
    statements.push(
      'Use a noun, two adjectives, three -ing verbs, a four-word noun phrase and a synonym of the opening. The measured phrase uses a determiner, two adjectives and a noun.'
    );
  if (contract.lineProfile === 'caesural-rhyme')
    statements.push(
      'Use this pattern on each line of the verse. Mark the pause with / or | so the word before it can be compared with the line ending.'
    );
  if (contract.endingWords) {
    const { groups, gathered } = contract.endingWords;
    statements.push(
      'Keep the same final word within each group and use a different word for each group: ' +
        groups.map((lines) => lines.join(', ')).join(' / ') +
        '.'
    );
    if (gathered?.length)
      statements.push(
        'Use all of those words in the closing passage on ' +
          (gathered.length === 1 ? 'line ' : 'lines ') +
          gathered.join(', ') +
          '.'
      );
  }
  for (const group of contract.returnGroups) {
    statements.push('Repeat line ' + group[0] + ' verbatim at ' + group.slice(1).join(', ') + '.');
  }
  const requirements = contract.lineRequirements || [];
  const measures = [
    ['words', 'word'],
    ['syllables', 'syllable'],
  ].filter(([key]) => requirements.some((line) => line[key] !== undefined));
  if (measures.length)
    statements.push(
      'It checks the indicated ' +
        measures.map(([, label]) => label).join(' and ') +
        ' counts per line.'
    );
  if (requirements.some((line) => line.stressEnding))
    statements.push('It checks the stress of the final syllables on the marked lines.');
  if (requirements.some((line) => line.wordLetters))
    statements.push('It checks the selected letter counts for each sung word.');
  if (requirements.some((line) => line.stresses !== undefined && line.syllables === undefined))
    statements.push(
      'Count the stressed syllables on each marked line. The number of unstressed syllables can vary.'
    );
  if (requirements.some((line) => line.stress !== undefined || line.stresses !== undefined))
    statements.push(
      'Stress marks follow spoken pronunciation. The beat grid controls musical timing.'
    );
  return statements.join(' ');
}

function writerChoice(doc, startConversation, state) {
  const generation = () => (state.sig || state.continuationId ? null : state.generation);
  let choice;
  let badge;
  function current() {
    return choice && choice.generation === generation() ? choice : null;
  }
  function sync() {
    if (!badge) return;
    const selected = current();
    badge.hidden = !selected || doc.getElementById('chat-domain')?.value !== 'lyrics';
    badge.firstElementChild.textContent = selected
      ? [
          selected.setting ? 'Song form setting' : 'Song form',
          selected.name,
          ...selected.settings,
          ...(selected.arranged ? ['Verse arrangement'] : []),
        ].join(' · ')
      : '';
  }
  function select(selection) {
    const onStart = () => {
      if (!badge) {
        badge = el('div');
        badge.id = 'ly-creation-form';
        const remove = el('button', 'Remove form', 'cm-btn ly-link-btn');
        remove.type = 'button';
        remove.addEventListener('click', () => {
          choice = null;
          sync();
          doc.getElementById('chat-input')?.focus();
        });
        badge.append(el('span'), ' ', remove);
        doc.getElementById('ly-composer-mode').after(badge);
      }
      choice = { ...selection, generation: generation() };
      sync();
    };
    startConversation('lyrics', '', { onStart });
  }
  return { select, sync, declarations: () => current()?.declarations };
}

export async function mountSongForms(root, startConversation, chatState) {
  const host = document.createElement('div');
  const surface = host.attachShadow({ mode: 'open' });
  const writer =
    startConversation && writerChoice(root.ownerDocument, startConversation, chatState);
  surface.innerHTML = layout;
  const lifetime = new AbortController();
  const removal = new MutationObserver(() => {
    if (host.isConnected) return;
    lifetime.abort();
    relationBinding?.disconnect();
    chartObserver.disconnect();
    removal.disconnect();
  });
  removal.observe(document.documentElement, { subtree: true, childList: true });
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = new URL('./song-forms.css', import.meta.url);
  surface.prepend(sheet);
  if (!document.getElementById('song-form-motion')) {
    const motion = document.createElement('link');
    motion.id = 'song-form-motion';
    motion.rel = 'stylesheet';
    motion.href = new URL('./song-forms-motion.css', import.meta.url).href;
    document.head.append(motion);
  }
  root.replaceChildren(host);
  const $ = (id) => surface.getElementById(id);
  const HTML = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const SVG = (tag, attrs, text) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };
  const colors = [
    ['#c8eddf', '#36745e'],
    ['#e5d9fa', '#706399'],
    ['#fae8b2', '#8b6b20'],
    ['#d7eafa', '#486c93'],
    ['#f7dce9', '#955570'],
    ['#cdeae9', '#417873'],
    ['#f0e0ce', '#846747'],
    ['#e1e5fc', '#535e99'],
  ];
  let catalog = [],
    links = [],
    forms = new Map(),
    form,
    variant = 0,
    counts = {},
    description,
    plan,
    model,
    selected = -1,
    results = [],
    active = -1;
  let relationBinding = null,
    resizeFrame = 0,
    renderedWidth = 0,
    returnNames = new Map(),
    loadFailedLinks = false;
  let chartView, formTransition;
  const maxZoom = 8;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Material 3 Standard easing: cubic-bezier(.2, 0, 0, 1), short4: 200ms.
  function standardEase(x) {
    if (x <= 0 || x >= 1) return x;
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 16; i++) {
      const t = (lo + hi) / 2,
        u = 1 - t;
      if (0.6 * u * u * t + t * t * t < x) lo = t;
      else hi = t;
    }
    const t = (lo + hi) / 2;
    return t * t * (3 - 2 * t);
  }
  const normalize = (s) =>
    s
      .normalize('NFD')
      .replace(/\p{Mark}/gu, '')
      .toLowerCase()
      .trim();
  const inkFor = (s) =>
    s
      ? colors[
          ((/^[A-Z]$/.test(s)
            ? s.charCodeAt(0) - 65
            : [...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 0)) >>>
            0) %
            colors.length
        ]
      : ['#e9edf4', '#62728e'];
  const swatch = (kind, label) => {
    const b = HTML('span', 'legend-item');
    const p = HTML('i', 'swatch ' + kind, kind === 'rhyme' ? 'A' : null);
    p.setAttribute('aria-hidden', 'true');
    b.append(p, document.createTextNode(label));
    return b;
  };
  function fetchJson(p) {
    return fetch(p).then((r) => {
      if (!r.ok) throw Error(r.status);
      return r.json();
    });
  }
  async function initialize() {
    $('load-error').hidden = true;
    $('loading').hidden = false;
    try {
      const result = await Promise.allSettled([
        fetchJson(new URL('../../api/song-forms.json', import.meta.url)),
        fetchJson(new URL('../../api/song-form-relationships.json', import.meta.url)),
      ]);
      if (result[0].status !== 'fulfilled') throw result[0].reason;
      catalog = result[0].value;
      loadFailedLinks = result[1].status !== 'fulfilled';
      links = result[1].value ?? [];
      forms = new Map(catalog.map((f) => [f.id, f]));
      buildBrowse();
      $('query').placeholder = 'Search ' + catalog.length + ' forms';
      $('query').disabled = false;
      $('browse').disabled = false;
      $('workspace').hidden = false;
      choose(forms.has('ballade') ? 'ballade' : catalog[0].id);
    } catch (e) {
      $('load-error').hidden = false;
      console.error(e);
    } finally {
      $('loading').hidden = true;
    }
  }
  // Latest intent wins; native snapshots keep old and new text from overlapping.
  let motionRequest = 0,
    fallbackEffects = [];
  function changeView(scope, apply, animate = true) {
    $('write-with-form').disabled = true;
    const request = ++motionRequest;
    formTransition?.skipTransition();
    for (const effect of fallbackEffects) effect.cancel();
    fallbackEffects = [];
    const update = () => {
      if (request === motionRequest) apply();
    };
    if (!animate || reduceMotion.matches || !document.startViewTransition) {
      host.removeAttribute('data-view-motion');
      document.documentElement.removeAttribute('data-song-form-transition');
      update();
      if (animate && !reduceMotion.matches && !document.startViewTransition) {
        const targets = scope === 'form' ? ['relations', 'chart-region'] : ['chart-region'];
        fallbackEffects = targets
          .map((id) =>
            $(id).animate?.([{ opacity: 0 }, { opacity: 1 }], {
              duration: 150,
              easing: 'cubic-bezier(0,0,0,1)',
            })
          )
          .filter(Boolean);
      }
      return;
    }
    host.dataset.viewMotion = scope;
    document.documentElement.dataset.songFormTransition = scope;
    const transition = document.startViewTransition(update);
    formTransition = transition;
    transition.ready.catch(() => {});
    const clear = () => {
      if (formTransition === transition) {
        formTransition = null;
        host.removeAttribute('data-view-motion');
        document.documentElement.removeAttribute('data-song-form-transition');
      }
    };
    transition.finished.then(clear, clear);
  }
  function choose(id, focus = false) {
    if (!forms.has(id)) return;
    changeView('form', () => showForm(id, focus), Boolean(form && form.id !== id));
  }
  reduceMotion.addEventListener(
    'change',
    () => {
      if (reduceMotion.matches) {
        formTransition?.skipTransition();
        chartView?.node.interrupt();
        for (const effect of fallbackEffects) effect.cancel();
      }
    },
    { signal: lifetime.signal }
  );
  // Hidden stays authoritative for keyboard navigation; inert takes effect before the visual exit.
  function setPanel(panel, open) {
    if (open === !panel.hidden) return;
    panel.inert = !open;
    panel.hidden = !open;
  }
  function showForm(id, focus) {
    if (form?.id === id) {
      setControls();
      updateWriter();
    }
    if (form?.id !== id) {
      form = forms.get(id);
      description = describeForm(catalog, id);
      variant = 0;
      counts = {};
      selected = -1;
      setControls();
      drawRelations();
      drawStructure();
      $('all-related').open = false;
    }
    for (const row of $('browse-list').querySelectorAll('[data-browse-form]')) {
      if (row.dataset.browseForm === id) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    }
    if (focus) $('selected-form')?.focus({ preventScroll: true });
  }
  function search() {
    const query = normalize($('query').value);
    if (!query) {
      closeSearch();
      return;
    }
    results = catalog
      .filter((f) => normalize(f.name).includes(query) || f.id.includes(query))
      .sort((a, b) => {
        function score(f) {
          const n = normalize(f.name);
          return n === query ? 0 : n.startsWith(query) ? 1 : 2;
        }
        return score(a) - score(b) || a.name.localeCompare(b.name, 'en');
      });
    active = -1;
    $('query').removeAttribute('aria-activedescendant');
    $('query').setAttribute('aria-expanded', 'true');
    $('results').replaceChildren(
      ...results.map((f, i) => {
        const n = HTML('div', 'option', f.name);
        n.id = 'option-' + i;
        n.setAttribute('role', 'option');
        n.setAttribute('aria-selected', 'false');
        n.onpointerdown = (e) => e.preventDefault();
        n.onclick = () => accept(f.id);
        return n;
      })
    );
    $('search-empty').hidden = results.length > 0;
    setPanel($('search-menu'), true);
    $('search-status').textContent = results.length
      ? results.length + ' matching forms'
      : 'No matching forms';
  }
  function closeSearch() {
    setPanel($('search-menu'), false);
    $('query').setAttribute('aria-expanded', 'false');
    $('query').removeAttribute('aria-activedescendant');
    active = -1;
  }
  function accept(id) {
    $('query').value = '';
    closeSearch();
    choose(id, true);
  }
  $('query').addEventListener('input', search);
  $('query').addEventListener('focus', () => {
    if ($('query').value) search();
  });
  $('query').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('search-menu').hidden) {
        e.preventDefault();
        closeSearch();
      }
      return;
    }
    if (e.key === 'Tab') {
      closeSearch();
      return;
    }
    if (e.key === 'Enter' && !$('search-menu').hidden && results.length) {
      e.preventDefault();
      accept(results[Math.max(0, active)].id);
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    if ($('search-menu').hidden && $('query').value) search();
    if ($('search-menu').hidden || !results.length) return;
    e.preventDefault();
    if (active >= 0) $('option-' + active)?.setAttribute('aria-selected', 'false');
    active =
      active < 0
        ? e.key === 'ArrowDown'
          ? 0
          : results.length - 1
        : (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
    const o = $('option-' + active);
    o.setAttribute('aria-selected', 'true');
    $('query').setAttribute('aria-activedescendant', o.id);
    o.scrollIntoView({ block: 'nearest' });
  });
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!e.composedPath().some((n) => n.matches?.('.search-frame'))) closeSearch();
    },
    { signal: lifetime.signal }
  );
  function buildBrowse() {
    const sorted = [...catalog].sort((a, b) => a.name.localeCompare(b.name, 'en'));
    const children = new Map(),
      variantIds = new Set(),
      placed = new Set();
    for (const { kind, source, target } of links) {
      if (kind !== 'variant' || !forms.has(source) || !forms.has(target) || source === target)
        continue;
      if (!children.has(target)) children.set(target, new Set());
      children.get(target).add(source);
      variantIds.add(source);
    }
    let group = 0;
    function branch(f, ancestors = new Set()) {
      placed.add(f.id);
      const li = HTML('li', 'browse-entry'),
        row = HTML('div', 'browse-row');
      const pick = HTML('button', 'browse-pick', f.name);
      pick.type = 'button';
      pick.dataset.browseForm = f.id;
      pick.onclick = () => {
        closeBrowse();
        choose(f.id, true);
      };
      row.append(pick);
      li.append(row);
      const path = new Set(ancestors).add(f.id);
      const variants = sorted.filter((v) => children.get(f.id)?.has(v.id) && !path.has(v.id));
      if (variants.length) {
        const toggle = HTML('button', 'browse-toggle');
        toggle.type = 'button';
        toggle.setAttribute('aria-label', 'Variants of ' + f.name);
        toggle.setAttribute('aria-expanded', 'false');
        toggle.append(HTML('span', 'browse-chevron'));
        toggle.firstChild.setAttribute('aria-hidden', 'true');
        const sub = HTML('ul', 'browse-variants');
        sub.id = 'browse-variants-' + ++group;
        sub.hidden = true;
        toggle.setAttribute('aria-controls', sub.id);
        toggle.onclick = () => {
          setPanel(sub, sub.hidden);
          toggle.setAttribute('aria-expanded', String(!sub.hidden));
        };
        row.append(toggle);
        sub.append(...variants.map((v) => branch(v, path)));
        li.append(sub);
      }
      return li;
    }
    const roots = sorted.filter((f) => !variantIds.has(f.id)).map((f) => branch(f));
    // A malformed future relation must not make a form unreachable in Browse.
    for (const f of sorted) if (!placed.has(f.id)) roots.push(branch(f));
    roots.sort((a, b) =>
      a.firstChild.firstChild.textContent.localeCompare(b.firstChild.firstChild.textContent, 'en')
    );
    $('browse-list').replaceChildren(...roots);
  }
  function closeBrowse(restore = false) {
    setPanel($('browse-list'), false);
    $('browse').setAttribute('aria-expanded', 'false');
    if (restore) $('browse').focus();
  }
  $('browse').onclick = () => {
    const list = $('browse-list');
    if (!list.hidden) {
      closeBrowse();
      return;
    }
    closeSearch();
    setPanel(list, true);
    $('browse').setAttribute('aria-expanded', 'true');
    list.querySelector('[data-browse-form]')?.focus();
  };
  $('browse-wrap').addEventListener('keydown', (e) => {
    if ($('browse-list').hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeBrowse(true);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const rows = [...$('browse-list').querySelectorAll('button')].filter(
      (b) => !b.closest('[hidden]')
    );
    const i = rows.indexOf(e.target);
    const n =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? rows.length - 1
          : e.key === 'ArrowDown'
            ? i + 1
            : i < 0
              ? rows.length - 1
              : i - 1;
    e.preventDefault();
    rows[Math.min(rows.length - 1, Math.max(0, n))]?.focus();
  });
  $('browse-wrap').addEventListener('focusout', (e) => {
    if (e.relatedTarget && !$('browse-wrap').contains(e.relatedTarget)) closeBrowse();
  });
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!e.composedPath().includes($('browse-wrap'))) closeBrowse();
    },
    { signal: lifetime.signal }
  );
  $('retry').onclick = initialize;

  function drawRelations() {
    relationBinding?.disconnect();
    const target = $('relations');
    target.replaceChildren();
    const { related, evidence } = relationshipsFor(links, forms, form.id);
    const order = [
      'Variant of',
      'Has variant',
      'Can contain',
      'Can occur within',
      'Shares a feature with',
      'Compare with',
      'Documented link to',
      'Documented link from',
    ];
    const ordered = [...related].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    const sortIds = (ids) =>
      [...ids].sort((a, b) => forms.get(a).name.localeCompare(forms.get(b).name, 'en'));
    const w = HTML('div', 'relation-map'),
      svg = SVG('svg', { 'aria-hidden': true, focusable: 'false' });
    const left = HTML('div', 'relation-column relation-variants'),
      right = HTML('div', 'relation-column relation-contains'),
      center = HTML('div', 'relation-center');
    const origin = HTML('span', 'form-chip', form.name);
    origin.id = 'selected-form';
    origin.tabIndex = -1;
    origin.setAttribute('aria-current', 'true');
    center.append(origin);
    const nodes = [];
    // Prefer child variants; use recorded parents when that column would be empty.
    const variantKind = related.has('Has variant') ? 'Has variant' : 'Variant of';
    const graphKinds = [variantKind, 'Can contain'];
    const button = (id, kind) => {
      const b = HTML('button', 'relation-choice', forms.get(id).name);
      b.type = 'button';
      b.setAttribute('aria-label', kind + ': ' + forms.get(id).name);
      b.onclick = () => choose(id, true);
      return b;
    };
    graphKinds.forEach((kind, i) => {
      const ids = related.get(kind);
      if (!ids?.size) return;
      const col = i === 0 ? left : right,
        choices = HTML('div', 'relation-choices');
      col.append(HTML('h3', 'relation-kind', kind), choices);
      for (const id of sortIds(ids)) {
        const b = button(id, kind);
        choices.append(b);
        nodes.push({ id: kind + ':' + id, b, side: i });
      }
    });
    w.append(svg, left, center, right);
    target.append(w);
    const total = [...new Set(ordered.flatMap(([, v]) => [...v]))].length;
    $('relation-count').textContent = total
      ? total + (total === 1 ? ' connection' : ' connections')
      : '';
    if (!total) {
      const p = HTML(
        'p',
        'empty',
        loadFailedLinks ? 'Could not load relationships.' : 'No recorded relationships'
      );
      if (loadFailedLinks) {
        const b = HTML('button', '', 'Retry');
        b.onclick = async () => {
          try {
            links = await fetchJson(
              new URL('../../api/song-form-relationships.json', import.meta.url)
            );
            loadFailedLinks = false;
            buildBrowse();
            drawRelations();
          } catch {
            /* Keep the retry action available. */
          }
        };
        p.append(' ', b);
      }
      target.append(p);
    }
    const all = $('all-related');
    all.hidden = !total;
    const list = $('relation-list');
    list.replaceChildren();
    for (const [kind, ids] of ordered) {
      const col = HTML('section');
      col.append(HTML('h3', 'relation-kind', kind));
      for (const id of sortIds(ids)) {
        const row = HTML('div');
        row.append(
          button(id, kind),
          ' ',
          HTML('small', 'meta', [...evidence.get(kind + '|' + id)].join(' / '))
        );
        col.append(row);
      }
      list.append(col);
    }
    function position() {
      if (getComputedStyle(svg).display === 'none') return;
      const r = w.getBoundingClientRect(),
        a = origin.getBoundingClientRect();
      svg.setAttribute('width', r.width);
      svg.setAttribute('height', r.height);
      const data = nodes.map((o) => {
        const b = o.b.getBoundingClientRect();
        const side = o.side === 0;
        return {
          id: o.id,
          source: [(side ? a.left : a.right) - r.left, a.top + a.height / 2 - r.top],
          target: [(side ? b.right : b.left) - r.left, b.top + b.height / 2 - r.top],
        };
      });
      {
        const horizontal = window.d3.linkHorizontal();
        window.d3
          .select(svg)
          .selectAll('path')
          .data(data, (d) => d.id)
          .join('path')
          .attr('d', horizontal)
          .attr('fill', 'none')
          .attr('stroke', '#899bd1')
          .attr('stroke-width', 1.45);
      }
    }
    relationBinding = new ResizeObserver(position);
    relationBinding.observe(w);
    position();
  }
  function patternName(p, i) {
    if (form.id === 'petrarchan-sonnet') return i === 0 ? 'CDE CDE' : 'CDC DCD';
    return 'Pattern ' + (i + 1);
  }
  function atPath(path) {
    return path
      .split('.')
      .slice(1)
      .reduce((node, k) => node?.children?.[Number(k) - 1], description.patterns[variant]);
  }
  function setControls() {
    $('pattern-label').hidden = description.variants.length < 2;
    $('patterns').replaceChildren(
      ...description.variants.map((v, i) => new Option(patternName(v, i), i))
    );
    $('patterns').value = String(variant);
    const specs = description.variants[variant]?.counts ?? [];
    for (const spec of specs) {
      const doubled =
        form.id === 'virelai-nouveau' &&
        variant === 0 &&
        ['1.2.1.1', '1.2.2.1'].includes(spec.path);
      counts[spec.path] ??= doubled ? 2 : spec.min;
    }
    $('repeat-panel').hidden = !specs.length;
    $('repeat-panel').open = false;
    const f = $('repeat-form');
    f.replaceChildren();
    f.oninput = () => {
      $('write-with-form').disabled = true;
      $('writing-note').textContent = 'Apply repeat counts to check Writer support.';
    };
    for (const c of specs) {
      const label = HTML(
        'label',
        '',
        chartTitle(atPath(c.path)?.role ?? atPath(c.path)?.unit ?? 'Repeat') + ' · ' + c.path
      );
      const i = HTML('input');
      i.type = 'number';
      i.name = c.path;
      i.required = true;
      i.min = c.min;
      i.max = c.max ?? Math.max(c.min, 120);
      i.value = counts[c.path];
      label.append(i);
      f.append(label);
    }
    if (specs.length) {
      const error = HTML('p', 'empty');
      error.id = 'repeat-error';
      error.hidden = true;
      error.setAttribute('role', 'alert');
      const b = HTML('button', '', 'Apply counts');
      b.type = 'submit';
      f.append(error, b);
      f.onsubmit = (e) => {
        e.preventDefault();
        const next = Object.fromEntries([...new FormData(f)].map(([k, v]) => [k, Number(v)]));
        try {
          realizeForm(catalog, form.id, { variant, counts: next });
          $('repeat-panel').open = false;
          $('repeat-panel').querySelector('summary').focus();
          changeView('structure', () => {
            counts = next;
            selected = -1;
            drawStructure();
          });
        } catch {
          error.textContent = 'These counts are too large to display.';
          error.hidden = false;
        }
      };
    }
  }
  $('patterns').onchange = () => {
    const next = Number($('patterns').value);
    changeView('structure', () => {
      variant = next;
      counts = {};
      selected = -1;
      setControls();
      drawStructure();
    });
  };
  function refreshLegend() {
    const rhymes = model.leaves.some((l) => l.n.rhyme || l.sub.some((s) => s.rhyme));
    const dotted = model.leaves.some((l) => returnIds(l).length);
    const striped = model.leaves.some((l) => l.closing);
    $('legend').replaceChildren(
      ...[
        rhymes && swatch('rhyme', 'Rhyme'),
        dotted && swatch('dot', 'Exact return'),
        striped && swatch('stripe', 'Closing passage'),
      ].filter(Boolean)
    );
  }
  const leafTitle = (l) => (model.axis ? chartTitle(model.axis) + ' ' + (l.first + 1) : l.label);
  function shortReturn(id) {
    return returnNames.get(id) ?? id;
  }
  function describeLeaf(l) {
    const parts = [leafTitle(l)];
    if (l.n.role) parts.push(chartTitle(l.n.role));
    if (l.n.rhyme) parts.push('Rhyme ' + l.n.rhyme);
    if (l.n.returns) parts.push('Exact return ' + shortReturn(l.n.returns));
    if (l.closing) parts.push('Closing passage');
    for (const s of l.sub) {
      if (s.rhyme) parts.push('Segment rhyme ' + s.rhyme);
      if (s.returns) parts.push('Exact phrase return ' + shortReturn(s.returns));
    }
    return parts.join(' · ');
  }
  function row(n) {
    const li = HTML('li');
    const line = n.children ? n.label : describeLeaf(n);
    const meta = detailsOf(n.n)
      .filter(([k]) => !['Role', 'Rhyme', 'Exact return'].includes(k))
      .map(([k, v]) => k + ' ' + v);
    li.append(HTML('span', '', line + (meta.length ? ' · ' + meta.join(' · ') : '')));
    const content = n.children ?? n.n.children;
    if (content.length) {
      const list = HTML('ol');
      for (const c of content) list.append(n.children ? row(c) : nativeRow(c));
      li.append(list);
    }
    return li;
  }
  function nativeRow(n) {
    const li = HTML(
      'li',
      '',
      [chartTitle(n.unit), ...detailsOf(n).map(([k, v]) => k + ' ' + v)].join(' · ')
    );
    if (n.children.length) {
      const list = HTML('ol');
      list.append(...n.children.map(nativeRow));
      li.append(list);
    }
    return li;
  }
  function updateWriter() {
    const projection = plan.status === 'ready' && projectSongFormCreation(plan, counts);
    const ready = Boolean(writer && projection?.status === 'ready');
    const action = $('write-with-form');
    action.disabled = !ready;
    const note = $('writing-note');
    note.textContent = ready
      ? writerDescription(projection)
      : 'This pattern is available for study only.';
    action.setAttribute('aria-describedby', 'writing-note');
    action.onclick = ready
      ? () => {
          const selections = Object.entries(counts).map(([path, count]) => ({ path, count }));
          writer.select({
            name: form.name,
            settings: [
              ...(description.variants.length > 1 ? ['Pattern ' + (variant + 1)] : []),
              ...selections.map(
                ({ path, count }) =>
                  chartTitle(atPath(path)?.role ?? atPath(path)?.unit ?? 'Repeat') +
                  ' ' +
                  path +
                  ' × ' +
                  count
              ),
            ],
            setting:
              projection.scope === 'setting' || Boolean(projection.contract.printedParagraphs),
            arranged: Boolean(projection.arrangement),
            declarations: {
              catalog_form: form.id,
              catalog_variant: variant,
              ...(selections.length && { catalog_counts: selections }),
            },
          });
        }
      : null;
  }
  function drawStructure() {
    plan = realizeForm(catalog, form.id, { variant, counts });
    updateWriter();
    const pattern = description.patterns?.[variant];
    const symbolic = $('symbolic');
    symbolic.open = false;
    symbolic.hidden = !pattern;
    $('symbolic-body').replaceChildren();
    symbolic.ontoggle = () => {
      if (symbolic.open && pattern && !$('symbolic-body').childElementCount)
        $('symbolic-body').append(branchList([pattern]));
    };
    model = structure(plan);
    returnNames = new Map([...model.returns.keys()].map((k, i) => [k, 'R' + (i + 1)]));
    $('measure').textContent =
      plan.status === 'deferred'
        ? 'Structure not modeled'
        : model.axis === null
          ? model.leaves.length
            ? 'Ordered catalog units'
            : 'No realized units'
          : model.leaves.length + ' ' + model.axis + (model.leaves.length === 1 ? '' : 's');
    const o = HTML('ol');
    for (const r of model.roots) o.append(row(r));
    $('outline-body').replaceChildren(o);
    $('outline').hidden = !model.roots.length;
    refreshLegend();
    drawChart(true);
    updateInspector();
  }
  function drawChart(force = false) {
    const region = $('chart-region'),
      target = $('diagram');
    const available = Math.max(200, region.clientWidth);
    if (!force && available === renderedWidth) return;
    renderedWidth = available;
    const previous = force ? null : chartView;
    const g = geometry(model, available);
    target.replaceChildren();
    chartView = null;
    $('chart-zoom').hidden = !g;
    if (!g) {
      target.append(
        HTML(
          'p',
          'empty',
          plan.status === 'deferred'
            ? 'This form has a catalog entry but no structure yet.'
            : 'There are no units at these repeat counts.'
        )
      );
      return;
    }
    const { width, baseline, cell, offset, scale, totalHeight } = g;
    const svg = SVG('svg', {
      width: Math.ceil(width),
      height: Math.ceil(totalHeight),
      viewBox: '0 0 ' + width + ' ' + totalHeight,
      'aria-label': form.name + ' structure',
      role: 'group',
    });
    const defs = SVG('defs', {});
    const dot = SVG('pattern', {
      id: 'p-dot',
      patternUnits: 'userSpaceOnUse',
      width: 9,
      height: 9,
    });
    dot.append(SVG('circle', { cx: 3, cy: 3, r: 1.85, fill: '#263a63' }));
    const stripe = SVG('pattern', {
      id: 'p-stripe',
      patternUnits: 'userSpaceOnUse',
      width: 8,
      height: 8,
      patternTransform: 'rotate(45)',
    });
    stripe.append(SVG('rect', { width: 3, height: 8, fill: '#425477' }));
    defs.append(dot, stripe);
    svg.append(defs);
    const content = SVG('g', {});
    svg.append(content);
    const span = (n) => [offset + cell * n.first, offset + cell * (n.last + 1)];
    function group(n, outer = false, i = 0) {
      const [a, b] = outer ? [offset, offset + cell * model.leaves.length] : span(n);
      const h = (outer ? g.outer : n.height) * scale;
      const primary = outer || n.level >= Math.max(...model.roots.map((k) => k.level));
      const color = primary
        ? ['#eef2fe', '#8196cf']
        : i % 2
          ? ['#f1edf9', '#a597c6']
          : ['#eaf6f2', '#7ca796'];
      content.append(
        SVG('path', {
          d: arc(a, b, baseline, h, true),
          fill: color[0],
          stroke: color[1],
          class: 'arc-group',
          'aria-hidden': 'true',
        })
      );
      if (!primary && h > 55 && b - a > n.label.length * 7 + 14)
        content.append(
          SVG(
            'text',
            {
              x: (a + b) / 2,
              y: baseline - h + 23,
              'text-anchor': 'middle',
              'font-size': 13,
              'font-weight': 650,
              fill: '#364663',
              'aria-hidden': 'true',
            },
            n.label
          )
        );
    }
    if (model.roots.length > 1) group(null, true);
    [...model.groups]
      .sort((a, b) => b.level - a.level || a.first - b.first)
      .forEach((n, i) => group(n, false, i));
    for (const l of model.leaves) {
      const [a, b] = span(l),
        h = 42 * scale,
        y = baseline,
        d = arc(a + 1.5, b - 1.5, y, h, true);
      const [fill, edge] = inkFor(l.n.rhyme);
      const el = SVG('g', {
        class: 'mark',
        role: 'button',
        'aria-label': describeLeaf(l),
        'aria-pressed': 'false',
        tabindex: l.first === (selected >= 0 ? selected : 0) ? 0 : -1,
        'data-index': l.first,
      });
      const clip = SVG('clipPath', { id: 'c-' + l.first });
      clip.append(SVG('path', { d }));
      defs.append(clip);
      el.append(SVG('path', { d, stroke: edge, fill, class: 'outline' }));
      const layer = SVG('g', { 'clip-path': 'url(#c-' + l.first + ')', 'aria-hidden': true });
      if (l.closing)
        layer.append(
          SVG('rect', {
            x: l.n.returns ? (a + b) / 2 : a,
            y: y - h,
            width: l.n.returns ? cell / 2 : cell,
            height: h,
            fill: 'url(#p-stripe)',
            opacity: 0.72,
          })
        );
      if (l.n.returns)
        layer.append(
          SVG('rect', {
            x: a,
            y: y - h,
            width: l.closing ? cell / 2 : cell,
            height: h,
            fill: 'url(#p-dot)',
          })
        );
      if (l.sub.length) {
        const unit = Math.min(17, (cell - 13) / l.sub.length),
          start = b - 4 - unit * l.sub.length;
        l.sub.forEach((n, i) => {
          const xx = start + i * unit,
            [color] = inkFor(n.rhyme);
          layer.append(
            SVG('rect', { x: xx, y: y - 18, width: unit - 2, height: 18, fill: color, rx: 3 })
          );
          if (n.returns)
            layer.append(
              SVG('rect', {
                x: xx,
                y: y - 18,
                width: unit - 2,
                height: 18,
                fill: 'url(#p-dot)',
                rx: 3,
              })
            );
          if (n.rhyme)
            layer.append(
              SVG(
                'text',
                {
                  x: xx + (unit - 2) / 2,
                  y: y - 5,
                  'text-anchor': 'middle',
                  'font-size': 12,
                  'font-weight': 750,
                  fill: '#15233c',
                },
                n.rhyme
              )
            );
        });
      }
      const label =
        l.n.rhyme ??
        (l.n.returns
          ? shortReturn(l.n.returns)
          : (l.n.endWord ?? (!model.axis ? l.n.role?.slice(0, 5) : '')));
      if (label)
        layer.append(
          SVG(
            'text',
            {
              x: (a + b) / 2,
              y: y - 10,
              'text-anchor': 'middle',
              'font-size': 15,
              'font-weight': 750,
              fill: '#14223a',
              'paint-order': 'stroke',
              'stroke-width': 4,
              stroke: fill,
            },
            label
          )
        );
      el.append(
        layer,
        SVG(
          'text',
          {
            x: (a + b) / 2,
            y: y + 22,
            'text-anchor': 'middle',
            'font-size': 13,
            'font-weight': 580,
            fill: '#425472',
            'aria-hidden': 'true',
          },
          l.first + 1
        )
      );
      el.onclick = () => selectLine(l.first);
      el.onkeydown = (e) => {
        const dir = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
        if (dir || e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          const i =
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? model.leaves.length - 1
                : Math.min(model.leaves.length - 1, Math.max(0, l.first + dir));
          selectLine(i);
          revealMark(i, offset, cell, baseline);
          svg.querySelector('[data-index="' + i + '"]').focus({ preventScroll: true });
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectLine(l.first);
        }
      };
      content.append(el);
    }
    target.append(svg);
    updateMarks();
    attachChartZoom(svg, content, width, totalHeight, previous);
  }
  function attachChartZoom(svg, content, width, height, previous) {
    const d3 = window.d3,
      node = d3.select(svg);
    const bounds = [
        [0, 0],
        [width, height],
      ],
      center = [width / 2, height / 2];
    let webkitPinch;
    const zoom = d3
      .zoom()
      .extent(bounds)
      .translateExtent(bounds)
      .scaleExtent([1, maxZoom])
      .clickDistance(5)
      // Interpolate the view directly rather than taking D3's default fly-to path.
      .interpolate(d3.interpolateNumberArray)
      .filter((e) =>
        e.type === 'wheel'
          ? e.ctrlKey && !webkitPinch
          : !e.button && !e.ctrlKey && (e.type !== 'mousedown' || d3.zoomTransform(svg).k > 1)
      )
      .on('zoom', ({ transform: t }) => {
        content.setAttribute('transform', t);
        svg.toggleAttribute('data-zoomed', t.k > 1.001);
        $('chart-out').setAttribute('aria-disabled', String(t.k <= 1.001));
        $('chart-in').setAttribute('aria-disabled', String(t.k >= maxZoom - 0.001));
      });
    node.call(zoom).on('dblclick.zoom', (e) => {
      if (e.button || e.ctrlKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      adjustChartZoom(e.shiftKey ? 0.5 : 2, d3.pointer(e.changedTouches?.[0] ?? e, svg));
    });
    // A trackpad pinch arrives as Ctrl+wheel in browsers that use wheel events.
    // At the diagram's limits D3 can leave the event uncanceled; don't zoom the page there.
    node.on(
      'wheel.chartpinch',
      (e) => {
        if (e.ctrlKey) e.preventDefault();
      },
      { passive: false }
    );
    // Desktop Safari reports trackpad magnification as a WebKit GestureEvent.
    // Touchscreens already go through D3's native two-finger handling.
    if ('GestureEvent' in window && navigator.maxTouchPoints === 0) {
      node
        .on(
          'gesturestart.chartpinch',
          (e) => {
            e.preventDefault();
            node.interrupt();
            const point = d3.pointer(e, svg);
            webkitPinch = {
              scale: d3.zoomTransform(svg).k,
              point: point.every(Number.isFinite) ? point : center,
            };
          },
          { passive: false }
        )
        .on(
          'gesturechange.chartpinch',
          (e) => {
            if (!webkitPinch) return;
            e.preventDefault();
            if (Number.isFinite(e.scale) && e.scale > 0)
              node.call(zoom.scaleTo, webkitPinch.scale * e.scale, webkitPinch.point);
          },
          { passive: false }
        )
        .on(
          'gestureend.chartpinch',
          (e) => {
            if (!webkitPinch) return;
            e.preventDefault();
            webkitPinch = undefined;
          },
          { passive: false }
        );
    }
    // Keep the standard D3 pinch and double tap; let one-finger swipes scroll the page.
    const touchMove = node.on('touchmove.zoom');
    if (touchMove)
      node.on(
        'touchmove.zoom',
        function (e, d) {
          if (e.touches.length > 1) touchMove.call(this, e, d);
        },
        { passive: false }
      );
    chartView = { svg, node, zoom, width, height };
    const t = previous ? d3.zoomTransform(previous.svg) : d3.zoomIdentity;
    if (t.k > 1) {
      const p = t.invert([previous.width / 2, previous.height / 2]);
      node
        .call(zoom.scaleTo, t.k, center)
        .call(
          zoom.translateTo,
          (p[0] * width) / previous.width,
          (p[1] * height) / previous.height,
          center
        );
    } else node.call(zoom.transform, d3.zoomIdentity);
  }
  function revealMark(i, offset, cell, baseline) {
    if (!chartView) return;
    const { svg, node, zoom, width, height } = chartView,
      t = window.d3.zoomTransform(svg);
    if (t.k <= 1) return;
    const x = offset + cell * (i + 0.5),
      y = baseline - 10,
      [left, top] = t.apply([x, y]);
    if (left < 10 || left > width - 10 || top < 10 || top > height - 10) {
      node.interrupt();
      if (reduceMotion.matches) node.call(zoom.translateTo, x, y);
      else node.transition().duration(200).ease(standardEase).call(zoom.translateTo, x, y);
    }
  }
  function adjustChartZoom(factor, point) {
    if (!chartView) return;
    const view = chartView,
      { svg, node, zoom } = view,
      d3 = window.d3;
    const current = d3.zoomTransform(svg).k;
    const goal =
      factor === null ? 1 : Math.max(1, Math.min(maxZoom, (view.goal ?? current) * factor));
    node.interrupt();
    if (!reduceMotion.matches && Math.abs(goal - current) > 0.00001) {
      view.goal = goal;
      const animated = node
        .transition()
        .duration(200)
        .ease(standardEase)
        .on('end.chartgoal interrupt.chartgoal cancel.chartgoal', () => {
          view.goal = undefined;
        });
      if (factor === null) animated.call(zoom.transform, d3.zoomIdentity);
      else animated.call(zoom.scaleTo, goal, point);
    } else if (factor === null) node.call(zoom.transform, d3.zoomIdentity);
    else node.call(zoom.scaleTo, goal, point);
  }
  $('chart-out').onclick = () => adjustChartZoom(1 / 1.5);
  $('chart-in').onclick = () => adjustChartZoom(1.5);
  $('chart-fit').onclick = () => adjustChartZoom(null);
  function selectLine(i) {
    selected = i;
    updateMarks();
    updateInspector();
  }
  function updateMarks() {
    const leaf = model.leaves[selected];
    const related = new Set(
      leaf ? returnIds(leaf).flatMap((id) => model.returns.get(id) ?? []) : []
    );
    for (const node of $('diagram').querySelectorAll('.mark')) {
      const n = Number(node.dataset.index);
      node.classList.toggle('active', n === selected);
      node.classList.toggle('match', n !== selected && related.has(n));
      node.setAttribute('aria-pressed', String(n === selected));
      node.setAttribute('tabindex', n === Math.max(0, selected) ? '0' : '-1');
    }
  }
  function updateInspector() {
    const l = model.leaves[selected],
      panel = $('inspect');
    panel.replaceChildren();
    if (!l) {
      panel.textContent =
        model.axis === 'line'
          ? 'Select a line to inspect it.'
          : model.leaves.length
            ? 'Select a unit to inspect it.'
            : '';
      return;
    }
    panel.append(HTML('strong', '', leafTitle(l)));
    const details = detailsOf(l.n)
      .filter(([k]) => k !== 'Exact return')
      .map(([k, v]) => k + ' ' + v);
    if (l.closing && !l.n.role) details.push('Closing passage');
    for (const s of l.sub) {
      if (s.rhyme) details.push(chartTitle(s.role ?? s.unit) + ' rhyme ' + s.rhyme);
    }
    for (const id of returnIds(l)) {
      const others = (model.returns.get(id) ?? []).filter((i) => i !== selected).map((i) => i + 1);
      const sub = l.sub.some((s) => s.returns === id);
      details.push(
        (sub ? 'Phrase return ' : 'Exact return ') +
          shortReturn(id) +
          (others.length
            ? ' · also ' +
              (model.axis ?? 'unit') +
              (others.length > 1 ? 's ' : ' ') +
              others.join(', ')
            : '')
      );
    }
    if (details.length) panel.append(' · ' + details.join(' · '));
  }
  const chartObserver = new ResizeObserver(() => {
    if (!model) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => drawChart());
  });
  chartObserver.observe($('chart-region'));
  await initialize();
  return writer;
}
