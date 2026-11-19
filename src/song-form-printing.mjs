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

// Native paragraphs are explicit, unwrapped source blocks. This measures
// the chosen printed setting, without classifying prose as literary poetry.
export function paragraphCount(plan) {
  const root = plan.tree?.[0];
  const plain = (node) =>
    ['role', 'rhyme', 'returns', 'endWord', 'syllables', 'stresses', 'stress', 'bars'].every(
      (key) => node[key] === undefined
    );
  if (
    plan.status !== 'ready' ||
    plan.tree.length !== 1 ||
    root.unit !== 'poem' ||
    !plain(root) ||
    !root.children.length ||
    !root.children.every((p) => p.unit === 'paragraph' && plain(p) && !p.children.length)
  )
    return null;
  return root.children.length;
}

export function gradeParagraphs(count, rows) {
  const starts = rows?.map((r) => r?.paragraphStart);
  const known = Array.isArray(starts) && starts.every((b) => typeof b === 'boolean');
  const actual = known ? starts.filter(Boolean).length : null;
  const checks = [
    {
      kind: 'printed-paragraph-count',
      expected: count,
      actual,
      outcome: !known ? 'unknown' : actual === count ? 'pass' : 'fail',
    },
  ];
  for (const [i, row] of (rows ?? []).entries()) {
    const text = row?.text;
    checks.push({
      kind: 'unbroken-paragraph',
      lines: [i + 1],
      outcome:
        typeof row?.paragraphStart !== 'boolean'
          ? 'unknown'
          : row.paragraphStart &&
              typeof text === 'string' &&
              text.trim() &&
              !/[\r\n\u2028\u2029]/u.test(text)
            ? 'pass'
            : 'fail',
    });
    const punctuation = typeof text === 'string' && /[.!?…][”’"'»)\]]*$/u.test(text.trim());
    checks.push({
      kind: 'sentence-ending',
      lines: [i + 1],
      outcome:
        typeof text !== 'string' || !text.trim()
          ? 'unknown'
          : punctuation && /\p{L}/u.test(text)
            ? 'pass'
            : 'fail',
    });
  }
  return {
    basis: 'printed unwrapped, blank-separated paragraphs with sentence-final punctuation',
    checks,
    verdict: checks.some((c) => c.outcome === 'fail')
      ? 'fail'
      : checks.every((c) => c.outcome === 'pass')
        ? 'pass'
        : 'unknown',
  };
}
