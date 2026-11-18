// A logical line may be printed as several successive rows. Their relative
// offsets are observable without choosing an absolute margin or tab width.
export function printedSteps(plan) {
  const [poem] = plan.tree ?? [];
  // This projection is complete only for a pure layout setting. Keep any
  // other declared feature in the general checker.
  const plain = (node) =>
    !['rhyme', 'returns', 'endWord', 'syllables', 'stress', 'stresses', 'bars'].some(
      (key) => node[key] !== undefined
    );
  if (
    plan.status !== 'ready' ||
    plan.tree.length !== 1 ||
    poem.unit !== 'poem' ||
    !plain(poem) ||
    poem.role !== undefined ||
    !poem.children.length ||
    !poem.children.every(
      (line) =>
        line.unit === 'line' &&
        plain(line) &&
        line.role === undefined &&
        line.children.length > 1 &&
        line.children.every(
          (step) =>
            plain(step) &&
            step.unit === 'segment' &&
            step.role === 'indent-step' &&
            !step.children.length
        )
    )
  )
    return null;
  return poem.children.map((line) => line.children.length);
}

function compareIndent(left, right) {
  if (left == null || right == null) return 'unknown';
  if (left === right || left.startsWith(right)) return 'fail';
  if (right.startsWith(left)) return 'pass';
  // Incomparable combinations of tabs and spaces depend on the display.
  return 'unknown';
}

export function gradePrintedSteps(sizes, rows) {
  const expected = sizes.reduce((total, size) => total + size, 0);
  const printed = rows?.map((row) => {
    const text = row.printedText;
    return typeof text === 'string' &&
      text.trim() &&
      !/[\r\n\u2028\u2029]/u.test(text) &&
      text.trim() === row.text?.trim()
      ? text
      : null;
  });
  const complete = printed && printed.every((text) => text !== null);
  const checks = [
    {
      kind: 'printed-row-count',
      expected,
      actual: complete ? rows.length : null,
      outcome: !complete ? 'unknown' : rows.length === expected ? 'pass' : 'fail',
    },
  ];
  let start = 0;
  for (const size of sizes) {
    const prefixes = Array.from({ length: size }, (_, i) => {
      const text = printed?.[start + i];
      if (text == null) return null;
      const prefix = text.match(/^\s*/u)[0];
      return /^[ \t]*$/u.test(prefix) ? prefix : null;
    });
    const edges = prefixes.slice(1).map((prefix, i) => compareIndent(prefixes[i], prefix));
    checks.push({
      kind: 'stepped-indentation',
      lines: prefixes.map((_, i) => start + i + 1),
      outcome: edges.includes('fail') ? 'fail' : edges.includes('unknown') ? 'unknown' : 'pass',
    });
    start += size;
  }
  const verdict = checks.some((c) => c.outcome === 'fail')
    ? 'fail'
    : checks.some((c) => c.outcome === 'unknown')
      ? 'unknown'
      : 'pass';
  return { verdict, checks };
}
