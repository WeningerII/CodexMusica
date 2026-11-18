// Compare catalog requirements with measurements from the current candidate.
// Blueprint coordinates describe the declared arrangement, including its bar grid.
import { checkForm, realizeForm } from './song-forms.mjs';

export function gradeObservations(catalog, id, { variant, counts, lines, sections }) {
  const plan = realizeForm(catalog, id, { variant, counts });
  if (plan.status !== 'ready')
    return {
      id,
      variant: plan.variant,
      verdict: 'unknown',
      checks: [{ kind: 'realization', outcome: 'unknown' }],
    };
  const input = { variant, counts };
  if (plan.coverage.lines !== 'none') input.lines = lines;
  if (plan.coverage.sections !== 'none' && sections)
    input.sections = sections.map(({ lineSpan, ...section }) =>
      plan.coverage.lines === 'complete' && lineSpan ? { ...section, lineSpan } : section
    );
  // A flat list of sung lines does not establish a stanza boundary. Use the
  // submitted partition only for a non-overlapping, exhaustive sequence of stanzas.
  const stanzas = [];
  const addresses = new Map();
  function walk(node) {
    addresses.set(node.address, node);
    if (node.unit === 'stanza') stanzas.push(node);
    node.children.forEach(walk);
  }
  plan.tree.forEach(walk);
  if (
    plan.coverage.lines === 'complete' &&
    sections?.length &&
    stanzas.length === sections.length &&
    stanzas.every((s, i) => s.span.lines[0] === (i ? stanzas[i - 1].span.lines[1] : 0)) &&
    stanzas.at(-1).span.lines[1] === plan.lines.length
  ) {
    input.units = Object.fromEntries(
      stanzas.flatMap((s, i) =>
        sections[i].lineSpan ? [[s.address, { lineSpan: sections[i].lineSpan }]] : []
      )
    );
  }
  const result = checkForm(catalog, id, input);
  // Variant pronunciations can still prove non-overlap even when a single
  // canonical rhyme key cannot be attributed to one or both lines.
  const choices = new Map(
    plan.lines
      .filter((row) => row.positionKnown)
      .map((row) => {
        const line = lines?.[row.index - 1];
        return [row.address, line?.rhymeOptions ?? (line?.rhyme ? [line.rhyme] : [])];
      })
  );
  const byClass = new Map();
  for (const row of plan.lines.filter((row) => row.rhyme)) {
    if (!byClass.has(row.rhyme)) byClass.set(row.rhyme, []);
    byClass.get(row.rhyme).push(choices.get(row.address) ?? []);
  }
  function refine(check) {
    if (check.outcome !== 'unknown') return check;
    if (check.kind === 'rhyme') {
      const known = check.addresses
        .map((address) => choices.get(address))
        .filter((items) => items?.length);
      if (known.length > 1 && !known[0].some((key) => known.every((keys) => keys.includes(key))))
        return { ...check, outcome: 'fail' };
    }
    if (check.kind === 'rhyme-distinct') {
      const groups = check.labels.map((label) => byClass.get(label));
      if (
        groups.every((group) => group?.length && group.every((keys) => keys.length)) &&
        groups.every((group, i) =>
          groups
            .slice(i + 1)
            .every((other) => !group.flat().some((key) => other.flat().includes(key)))
        )
      )
        return { ...check, outcome: 'pass' };
    }
    return check;
  }
  const checks = result.checks.map(refine).map((check) => {
    const refs = check.addresses ?? (check.address ? [check.address] : []);
    const spans = refs.map((k) => addresses.get(k)?.span.lines).filter(Boolean);
    const lineNumbers = [
      ...new Set(spans.flatMap(([a, b]) => Array.from({ length: b - a }, (_, i) => a + i + 1))),
    ];
    return lineNumbers.length ? { ...check, lines: lineNumbers } : check;
  });
  if (!checks.length) checks.push({ kind: 'observability', outcome: 'unknown' });
  return {
    id,
    variant: plan.variant,
    scope: plan.scope,
    verdict: checks.some((c) => c.outcome === 'fail')
      ? 'fail'
      : checks.every((c) => c.outcome === 'pass')
        ? 'pass'
        : 'unknown',
    checks,
  };
}
