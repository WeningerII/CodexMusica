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
    if (plan.coverage.lines === 'complete') result.lineCount = plan.lines.length;
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
