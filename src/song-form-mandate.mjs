import { realizeForm } from './song-forms.mjs';
/** Map a realized form's declared line relations to the lyric harness.
 * The symbols are obligations. They supply no words, sound keys or observed results.
 * Unnumberable lines keep their diagram addresses and never enter a wire declaration.
 */
function classes(lines, key) {
  const grouped = new Map();
  for (const line of lines) {
    if (line[key] === undefined) continue;
    const symbol = line[key];
    if (!grouped.has(symbol)) grouped.set(symbol, []);
    grouped.get(symbol).push(line.index);
  }
  return [...grouped].map(([symbol, lines]) => ({ symbol, lines }));
}

// End-word rotation is a spelling identity across line endings. A gathering
// ending is a collective obligation over the entire closing passage: its
// words may occur in any order and at any position in those closing lines.
export function endingWordDeclaration(plan) {
  if (plan.coverage.lines !== 'complete' || !plan.lines.every((l) => l.positionKnown)) return null;
  const groups = classes(plan.lines, 'endWord').map((group) => group.lines);
  if (groups.length < 2 || groups.some((group) => group.length < 2)) return null;
  const gathered = plan.lines.filter((l) => l.role === 'gathered-end-words').map((l) => l.index);
  if (gathered.some((line, i) => line !== plan.lines.length - gathered.length + i + 1)) return null;
  return { groups, ...(gathered.length && { gathered }) };
}

function distinctEndings(identities) {
  // Whole-line identity implies terminal-word identity. The reverse implication
  // would turn a repeated word into an obligation to repeat an entire line.
  const parents = new Map();
  function root(index) {
    let current = index;
    while (parents.has(current)) current = parents.get(current);
    while (index !== current) {
      const previous = parents.get(index);
      parents.set(index, current);
      index = previous;
    }
    return current;
  }
  for (const { lines } of identities) {
    const first = root(lines[0]);
    for (const line of lines.slice(1)) {
      const linked = root(line);
      if (first !== linked) parents.set(linked, first);
    }
  }
  return root;
}

const repeated = (group) => group.lines.length > 1;

/** Format existing declared groups as the semicolon-separated wire strings.
 * Bare return members name whole lines; N.endword names the final lexical word.
 */
export function formMandateWire({ rhymeGroups, returnGroups, endWordGroups }) {
  const serialize = (groups, suffix) =>
    groups.map(({ lines }) => lines.map((n) => n + suffix).join(','));
  return {
    groups: serialize(rhymeGroups, '').join(';'),
    returns: [...serialize(returnGroups, ''), ...serialize(endWordGroups, '.endword')].join(';'),
  };
}

// The catalog describes one long line. A writer can repeat it for a verse;
// the generic draft and recovery routes must agree on that cardinality.
export function alliterativeLineTemplate(plan) {
  const [root] = plan.tree;
  const [left, pause, right] = root?.children ?? [];
  return (
    plan.id === 'alliterative-verse' &&
    plan.tree.length === 1 &&
    root.unit === 'line' &&
    root.children.length === 3 &&
    left.unit === 'half-line' &&
    right.unit === 'half-line' &&
    pause.unit === 'caesura' &&
    left.stresses === 2 &&
    right.stresses === 2 &&
    [root, left, pause, right].every((node) =>
      evidenceFields.every(
        (field) =>
          node[field] === undefined || (field === 'stresses' && (node === left || node === right))
      )
    ) &&
    root.children.every((node) => !node.children.length)
  );
}

/** Only a ready projection can impose requirements. Counts and indices are
 * different: later explicit lines can contribute to a minimum without having
 * a known absolute transcript position after an opaque passage.
 */
export function formMandate(plan) {
  if (!plan || !['ready', 'deferred', 'needs-input'].includes(plan.status)) {
    throw new TypeError('Expected a realized song form');
  }
  const result = {
    id: plan.id,
    name: plan.name,
    scope: plan.scope,
    status: plan.status,
    variant: plan.variant,
    needs: plan.needs,
    lineCount: null,
    minimumLines: null,
    rhymeGroups: [],
    returnGroups: [],
    endWordGroups: [],
    lineConstraints: [],
    unpositioned: [],
  };
  if (plan.status === 'ready') {
    const known = [];
    for (const line of plan.lines) {
      if (line.positionKnown) known.push(line);
      else result.unpositioned.push(line.address);
    }
    if (plan.coverage.lines !== 'none') result.minimumLines = plan.minimum.lines;
    if (plan.coverage.lines === 'complete' && !alliterativeLineTemplate(plan))
      result.lineCount = plan.lines.length;
    result.returnGroups = classes(known, 'returns').filter(repeated);
    result.endWordGroups = classes(known, 'endWord').filter(repeated);
    const terminalClass = distinctEndings([...result.returnGroups, ...result.endWordGroups]);
    for (const { symbol, lines } of classes(known, 'rhyme')) {
      const seen = new Set();
      const representatives = lines.filter((line) => {
        const id = terminalClass(line);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      if (representatives.length > 1) result.rhymeGroups.push({ symbol, lines: representatives });
    }
    for (const line of known) {
      const item = { line: line.index };
      for (const key of ['syllables', 'stress', 'stresses', 'role', 'bars']) {
        if (line[key] !== undefined) item[key] = line[key];
      }
      if (Object.keys(item).length > 1) result.lineConstraints.push(item);
    }
  }
  return { ...result, ...formMandateWire(result) };
}

// One optional printing places every explicitly measured phrase on a separate
// sung line. The source diagram continues to describe the phrases themselves.
const evidenceFields = [
  'role',
  'rhyme',
  'returns',
  'endWord',
  'syllables',
  'stress',
  'stresses',
  'bars',
];

export function printedPhraseSetting(plan) {
  if (plan.status !== 'ready' || plan.tree.length !== 1) return null;
  const [unit] = plan.tree;
  const plain = (node) => evidenceFields.every((key) => node[key] === undefined);
  if (!plain(unit)) return null;
  const spans =
    unit.unit === 'verse-unit'
      ? [unit]
      : unit.unit === 'stanza' &&
          unit.children.length &&
          unit.children.every((n) => n.unit === 'line' && plain(n))
        ? unit.children
        : [];
  if (!spans.length) return null;
  const stanzas = [];
  for (const span of spans) {
    if (span.children.length < 2) return null;
    const lines = [];
    for (const part of span.children) {
      if (
        part.unit !== 'phrase' ||
        part.children.length ||
        !Number.isSafeInteger(part.syllables) ||
        part.syllables <= 0 ||
        !part.rhyme ||
        evidenceFields.some(
          (key) => key !== 'syllables' && key !== 'rhyme' && part[key] !== undefined
        )
      )
        return null;
      lines.push({ unit: 'line', syllables: part.syllables, rhyme: part.rhyme });
    }
    stanzas.push({ unit: 'stanza', children: lines });
  }
  const catalog = [
    {
      id: plan.id,
      name: plan.name,
      scope: plan.scope,
      patterns: [{ unit: 'poem', children: stanzas }],
    },
  ];
  return { catalog, plan: realizeForm(catalog, plan.id) };
}
