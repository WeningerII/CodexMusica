/* global document, URL, fetch, Option */
import { projectSongFormCreation } from '../song-form-creation.mjs';
import { describeForm, realizeForm } from '../song-forms.mjs';

const catalogURL = new URL('../../api/song-forms.json', import.meta.url);
const display = (value) => String(value).replaceAll('-', ' ');
const title = (value) => value.charAt(0).toUpperCase() + value.slice(1);

function el(tag, text = '', className = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function labeled(text, control) {
  const label = el('label', text, 'ly-label');
  label.append(control);
  return label;
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

function variantView(description, index, catalog, target, startWriter) {
  target.replaceChildren(branchList([description.patterns[index]]));
  const controls = el('form', '', 'ly-form-fields');
  const fields = new Map();
  const output = el('div');
  const status = el('p', '', 'ly-help');
  status.setAttribute('role', 'status');
  for (const { path, min, max } of description.variants[index].counts) {
    let node = description.patterns[index];
    const route = [unitName(node)];
    for (const key of path.split('.').slice(1)) {
      node = node.children[Number(key) - 1];
      route.push(unitName(node) + ' [' + key + ']');
    }
    const field = el('input', '', 'cm-input');
    field.type = 'number';
    field.step = '1';
    field.min = min;
    if (max !== null) field.max = max;
    field.placeholder = rangeText(min, max);
    controls.append(
      labeled('Repeat count · ' + route.join(' › ') + ' · ' + rangeText(min, max), field)
    );
    fields.set(path, field);
  }
  function reset() {
    output.replaceChildren();
    status.textContent = '';
    for (const [path, field] of fields) {
      const parts = path.split('.');
      field.disabled = parts
        .slice(1)
        .some((_, i) => fields.get(parts.slice(0, i + 1).join('.'))?.valueAsNumber === 0);
    }
  }
  controls.addEventListener('input', reset);
  const submit = el('button', 'Show expanded structure', 'cm-btn cm-btn-outline');
  submit.type = 'submit';
  controls.append(submit);
  controls.addEventListener('submit', (event) => {
    event.preventDefault();
    output.replaceChildren();
    const counts = {};
    for (const [path, field] of fields) {
      if (!field.disabled && field.value !== '') counts[path] = field.valueAsNumber;
    }
    let plan;
    try {
      plan = realizeForm(catalog, description.id, { variant: index, counts });
    } catch (error) {
      status.textContent =
        error instanceof RangeError
          ? 'This structure is too large to expand. Choose a smaller repeat count.'
          : 'The structure could not be expanded with these values.';
      return;
    }
    if (plan.status !== 'ready') {
      status.textContent = 'Enter a repeat count for the highlighted part.';
      const field = fields.get(plan.needs.find((need) => need.kind === 'count')?.path);
      field?.focus();
      return;
    }
    status.textContent = 'Expanded structure';
    output.replaceChildren(
      plan.tree.length ? branchList(plan.tree) : el('p', 'No units at these counts.')
    );
    if (startWriter) {
      const projection = projectSongFormCreation(plan, counts);
      if (projection.status === 'ready') {
        const setting = projection.scope === 'setting';
        const arrangement = projection.arrangement;
        const write = el(
          'button',
          setting ? 'Write this setting' : 'Write with this form',
          'cm-btn cm-btn-primary'
        );
        const descriptionText = writerDescription(projection);
        if (descriptionText) {
          const note = el('p', descriptionText, 'ly-help');
          note.id = 'ly-form-writing-note';
          write.setAttribute('aria-describedby', note.id);
          output.prepend(note);
        }
        write.type = 'button';
        write.addEventListener('click', () => {
          const selections = Object.entries(counts).map(([path, count]) => ({ path, count }));
          startWriter({
            name: description.name,
            setting,
            arranged: Boolean(arrangement),
            declarations: {
              catalog_form: description.id,
              catalog_variant: index,
              ...(selections.length && { catalog_counts: selections }),
            },
          });
        });
        output.prepend(write);
      } else {
        output.prepend(el('p', 'This pattern is available for study only.', 'ly-help'));
      }
    }
  });
  target.append(controls, status, output);
}

function displayForm(catalog, id, body, startWriter) {
  body.replaceChildren();
  if (!id) return;
  const description = describeForm(catalog, id);
  if (description.scope === 'deferred') {
    body.append(el('p', 'A structural model is pending.', 'ly-help'));
    return;
  }
  body.append(
    el('h3', description.scope === 'setting' ? 'Documented setting' : 'Form structure', 'ly-h3')
  );
  const target = el('div');
  if (description.variants.length === 1) {
    variantView(description, 0, catalog, target, startWriter);
  } else {
    const picker = el('select', '', 'cm-select');
    picker.add(new Option('Choose a pattern', ''));
    for (const { index } of description.variants) {
      const detail = el('details');
      detail.append(
        el('summary', 'Pattern ' + (index + 1)),
        branchList([description.patterns[index]])
      );
      body.append(detail);
      picker.add(new Option('Pattern ' + (index + 1), String(index)));
    }
    picker.addEventListener('change', () => {
      if (picker.value === '') target.replaceChildren();
      else variantView(description, Number(picker.value), catalog, target, startWriter);
    });
    body.append(labeled('Pattern to expand', picker));
  }
  body.append(target);
}

const relationshipURL = new URL('../../api/song-form-relationships.json', import.meta.url);
const evidenceLabels = {
  catalog: 'Catalog evidence only',
  reference: 'Reference recorded, passage unverified',
  passage: 'Source passage checked',
};
const relationLabels = {
  variant: ['Variant of', 'Has variant'],
  contains: ['Can contain', 'Can occur within'],
  'shares-feature': ['Shares a feature with', 'Shares a feature with'],
  comparison: ['Compare with', 'Compare with'],
  other: ['Documented link to', 'Documented link from'],
};

function relatedForms(catalog, picker, select) {
  const names = new Map(catalog.map((form) => [form.id, form.name]));
  const panel = el('details');
  const summary = el('summary');
  const content = el('div');
  panel.append(summary, content);
  let graph;
  let loading = false;

  async function load() {
    if (loading) return;
    loading = true;
    content.replaceChildren();
    summary.textContent = 'Loading related forms…';
    try {
      const response = await fetch(relationshipURL);
      if (!response.ok) throw new Error('Could not load relationships');
      graph = await response.json();
      redraw();
    } catch {
      graph = undefined;
      summary.textContent = 'Related forms unavailable';
      const retry = el('button', 'Retry related forms', 'cm-btn cm-btn-outline');
      retry.type = 'button';
      retry.addEventListener('click', load);
      content.replaceChildren(retry);
    } finally {
      loading = false;
    }
  }

  function redraw() {
    const id = picker.value;
    panel.hidden = !id;
    if (!id) return;
    if (!graph) {
      load();
      return;
    }
    const neighbors = new Map();
    for (const edge of graph) {
      if (edge.source !== id && edge.target !== id) continue;
      const out = edge.source === id;
      const other = out ? edge.target : edge.source;
      if (!neighbors.has(other)) neighbors.set(other, new Set());
      neighbors
        .get(other)
        .add(relationLabels[edge.kind][out ? 0 : 1] + ' · ' + evidenceLabels[edge.confidence]);
    }
    const count = neighbors.size;
    summary.textContent = 'Related forms · ' + count;
    summary.setAttribute('aria-label', count + ' related forms for ' + names.get(id));
    if (!count) {
      content.replaceChildren(el('p', 'No reviewed connections for this form.', 'ly-help'));
      return;
    }
    const list = el('ul');
    const sorted = [...neighbors].sort(([a], [b]) =>
      names.get(a).localeCompare(names.get(b), 'en')
    );
    for (const [neighbor, facts] of sorted) {
      const row = el('li');
      const link = el('button', names.get(neighbor), 'cm-btn ly-link-btn');
      link.type = 'button';
      link.addEventListener('click', () => {
        select(neighbor);
        summary.focus();
      });
      row.append(link, ' ', el('small', [...facts].join(' / '), 'ly-help'));
      list.append(row);
    }
    content.replaceChildren(list);
  }
  panel.hidden = true;
  return { panel, redraw };
}

// The ordinary composer never loads or mounts catalog controls. Selecting a
// form attaches the choice to the new conversation only after its start gate.
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
  const doc = root.ownerDocument;
  if (!doc.getElementById('song-forms-style')) {
    const sheet = doc.createElement('link');
    sheet.id = 'song-forms-style';
    sheet.rel = 'stylesheet';
    sheet.href = new URL('./song-forms.css', import.meta.url).href;
    doc.head.append(sheet);
  }
  const response = await fetch(catalogURL);
  if (!response.ok) throw new Error('Could not load song forms');
  const catalog = await response.json();
  if (!Array.isArray(catalog) || !catalog.length) throw new Error('Missing song forms');
  const picker = el('select', '', 'cm-select');
  picker.add(new Option('Choose a form', ''));
  for (const form of [...catalog].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    picker.add(new Option(form.name, form.id));
  }
  const body = el('div');
  const writer = startConversation && writerChoice(doc, startConversation, chatState);
  function select(id) {
    picker.value = id;
    displayForm(catalog, id, body, writer?.select);
    relations.redraw();
  }
  const relations = relatedForms(catalog, picker, select);
  picker.addEventListener('change', () => select(picker.value));
  root.replaceChildren(labeled('Song form', picker), relations.panel, body);
  return writer;
}
