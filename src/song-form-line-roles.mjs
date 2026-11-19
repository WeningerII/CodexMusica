// Objective English accentual realizations. Other uses of a role name can
// require literary or performance evidence beyond a printed lexical reading.
const endings = new Map([
  ['stressed-ending', '/'],
  ['unstressed-ending', '.'],
  ['masculine-ending', '/'],
  ['feminine-ending', '/.'],
]);

export function stressEndingFor(role) {
  return endings.get(role);
}

// An exact iambic hexameter offers one regular English alexandrine setting.
export const regularAlexandrine = './'.repeat(6);

// A catalog refrain role can be tested when the same whole line is prescribed
// at positions in two different divisions. Repetition inside one local passage
// alone does not establish its function as a structural refrain.
export function refrainAddresses(tree) {
  const groups = new Map();
  function visit(node, division) {
    if (node.unit === 'section' || node.unit === 'stanza') division = node.address;
    if (node.unit === 'line' && node.returns && division) {
      if (!groups.has(node.returns)) groups.set(node.returns, []);
      groups.get(node.returns).push({ division, address: node.address, role: node.role });
    }
    node.children.forEach((child) => visit(child, division));
  }
  tree.forEach((node) => visit(node));
  const result = new Set();
  for (const group of groups.values()) {
    if (new Set(group.map((item) => item.division)).size < 2) continue;
    for (const item of group) if (item.role === 'refrain') result.add(item.address);
  }
  return result;
}

// A two-line stanza can state a relative length without prescribing a meter.
// Compare only the two local marked lines, using their measured syllable totals.
export function relativeLinePairs(plan) {
  const pairs = new Map();
  const numbers = new Map(
    plan.lines.filter((line) => line.positionKnown).map((line) => [line.address, line.index])
  );
  function visit(node) {
    const [first, second] = node.children;
    if (
      node.unit === 'stanza' &&
      node.children.length === 2 &&
      first.unit === 'line' &&
      second.unit === 'line' &&
      first.role === 'long-line' &&
      second.role === 'short-line' &&
      first.returns === undefined &&
      second.returns === undefined
    ) {
      const long = numbers.get(first.address),
        short = numbers.get(second.address);
      if (long && short === long + 1) {
        pairs.set(first.address, { long, short });
        pairs.set(second.address, { long, short });
      }
    }
    node.children.forEach(visit);
  }
  plan.tree.forEach(visit);
  return pairs;
}

// Only the full positional grammar licenses these role names for a writer.
export function lexicalLineProfile(plan) {
  const root = plan.tree[0];
  if (plan.tree.length !== 1 || plan.coverage.lines !== 'complete') return;
  if (root.unit !== 'poem' || root.children.length !== 7) return;
  if (
    root.children.every(
      (stanza, pair) =>
        stanza.unit === 'stanza' &&
        stanza.children.length === 2 &&
        stanza.children.every(
          (line, i) =>
            line.unit === 'line' &&
            line.role ===
              (i
                ? pair === 6
                  ? 'echo-of-opening'
                  : 'echo-source'
                : pair
                  ? 'echo-of-previous-close'
                  : 'opening') &&
            line.children.length >= 9 &&
            line.children.length <= 11 &&
            line.children.every((c) => c.unit === 'syllable')
        )
    )
  )
    return 'linked-couplet-echoes';
}

// This bounded writing setting compares normalized sung tokens, excluding
// stage directions. Wider rewrites can be legitimate and remain unclassified.
export function measuredCoupletEcho(index, lines) {
  const atClose = index === 14;
  const target = atClose ? 14 : index === 1 ? 14 : index % 2 ? index : index + 1;
  const source = target === 14 ? 1 : target - 1;
  function tokens(position) {
    const row = lines?.[position - 1];
    if (
      typeof row?.text !== 'string' ||
      !row.text.trim() ||
      !Array.isArray(row.sungWords) ||
      !row.sungWords.length ||
      !row.sungWords.every(
        (word) => typeof word === 'string' && /^\p{L}[\p{L}\p{M}’'-]*$/u.test(word)
      )
    )
      return;
    return row.sungWords.map((word) => word.normalize('NFC').toLowerCase().replaceAll('’', "'"));
  }
  const before = tokens(source),
    after = tokens(target);
  let outcome = 'unknown';
  if (before && after && before.length === after.length) {
    const differences = before.filter((word, i) => word !== after[i]).length;
    if ((target === 14 && differences === 0) || (differences === 1 && before.length >= 3))
      outcome = 'pass';
  }
  return {
    outcome,
    comparedLines: [source, target],
    basis:
      'a single word substitution in an otherwise repeated sung line, or a verbatim closing echo',
  };
}
