// Compare catalog requirements with measurements from the current candidate.
// Blueprint coordinates describe the declared arrangement, including its bar grid.
import { checkReaderForm, realizeForm } from './song-forms.mjs';
import {
  isVerseDivision,
  isWordlessWriterRole,
  projectSongFormCreation,
} from './song-form-creation.mjs';

function simpleSectionLayout(node) {
  if (['song', 'poem', 'cycle'].includes(node.unit)) {
    return node.children.length > 0 && node.children.every(simpleSectionLayout);
  }
  return (
    node.unit === 'section' &&
    node.children.every(
      (child) =>
        child.unit === 'line' &&
        !child.children.length &&
        !['role', 'rhyme', 'returns', 'endWord', 'syllables', 'stress', 'stresses', 'bars'].some(
          (field) => field in child
        )
    )
  );
}

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
  // Musical verse is only the carrier for a neutral stanza. Its boundary
  // can be compared with the catalog division without adding a role check.
  const addresses = new Map();
  const stanzas = [];
  function walk(node) {
    addresses.set(node.address, node);
    if (isVerseDivision(node.unit) && node.children.length) stanzas.push(node);
    node.children.forEach(walk);
  }
  plan.tree.forEach(walk);
  const extras = [];
  const spans = new Map();
  const hasInstrumental = plan.sections.some((section) => isWordlessWriterRole(section.role));
  const projection =
    stanzas.length || hasInstrumental ? projectSongFormCreation(plan, counts) : null;
  const arranged = projection?.arrangement;
  const nativeInstrumental = hasInstrumental && projection?.contract;
  const divisions = arranged
    ? stanzas.filter((node) => node.children.every((child) => child.unit === 'line'))
    : stanzas.filter((node) => node.unit === 'stanza');
  const completePartition =
    plan.coverage.lines === 'complete' &&
    divisions.length > 0 &&
    divisions.every((s, i) => s.span.lines[0] === (i ? divisions[i - 1].span.lines[1] : 0)) &&
    divisions.at(-1).span.lines[1] === plan.lines.length;
  if (completePartition && sections) {
    if (arranged)
      extras.push({
        kind: 'division-count',
        expected: divisions.length,
        actual: sections.length,
        outcome: divisions.length === sections.length ? 'pass' : 'fail',
      });
    if (divisions.length === sections.length) {
      input.units = Object.fromEntries(
        divisions.flatMap((stanza, i) => {
          const { lineSpan, bars } = sections[i];
          if (!lineSpan) return [];
          const aligned =
            lineSpan[0] === stanza.span.lines[0] && lineSpan[1] === stanza.span.lines[1];
          return [[stanza.address, { lineSpan, ...(aligned && bars !== undefined && { bars }) }]];
        })
      );
    }
  }
  // An empty section in the catalog leaves its length open. Explicit lines in
  // a different section still have an exact count in that section's coordinates.
  // Use this interpretation only for ordered section trees with plain line leaves.
  const mixedSections =
    plan.coverage.lines === 'partial' &&
    plan.coverage.sections === 'complete' &&
    plan.tree.every(simpleSectionLayout);
  if (mixedSections || nativeInstrumental) {
    const observedSpans = (sections ?? []).map((section) => section.lineSpan);
    const haveAllSpans =
      observedSpans.length > 0 && observedSpans.every((span) => span !== undefined);
    let previousEnd = 0,
      previousIndex = -1,
      consistent = true;
    for (const [i, span] of observedSpans.entries()) {
      if (span === undefined) continue;
      if (
        !Array.isArray(span) ||
        span.length !== 2 ||
        !span.every((n) => Number.isSafeInteger(n) && n >= 0) ||
        span[1] < span[0]
      ) {
        throw new TypeError('Invalid observed line span');
      }
      // Missing boundaries leave a gap of unknown length. The two known
      // ranges on either side still cannot overlap or exceed the supplied text.
      consistent &&=
        (i === previousIndex + 1 ? span[0] === previousEnd : span[0] >= previousEnd) &&
        (lines === undefined ||
          (span[1] <= lines.length &&
            (i !== observedSpans.length - 1 || span[1] === lines.length)));
      previousEnd = span[1];
      previousIndex = i;
    }
    if (haveAllSpans || !consistent) {
      extras.push({ kind: 'section-partition', outcome: consistent ? 'pass' : 'fail' });
    }
    if (mixedSections) {
      const actual = lines?.length ?? (haveAllSpans ? observedSpans.at(-1)[1] : undefined);
      const minimum = plan.minimum.lines;
      extras.push({
        kind: 'lines-count',
        exact: false,
        expected: minimum,
        actual,
        outcome: actual === undefined ? 'unknown' : actual >= minimum ? 'pass' : 'fail',
      });
    }
    plan.sections.forEach(({ address, role }, i) => {
      const span = observedSpans[i];
      if (span) spans.set(address, span);
      const wordless = nativeInstrumental && isWordlessWriterRole(role);
      const expected = wordless ? 0 : addresses.get(address).children.length;
      if (wordless || (mixedSections && expected)) {
        const length = span && span[1] - span[0];
        extras.push({
          kind: 'section-lines',
          address,
          expected,
          actual: length,
          outcome: length === undefined ? 'unknown' : length === expected ? 'pass' : 'fail',
        });
      }
    });
  }
  const result = checkReaderForm(catalog, id, input);
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
  const checks = result.checks
    .filter(
      (check) => !mixedSections || !['lines-count', 'position', 'line-span'].includes(check.kind)
    )
    .map(refine)
    .concat(extras)
    .map((check) => {
      const refs = check.addresses ?? (check.address ? [check.address] : []);
      const ranges = refs
        .map((k) => {
          if (mixedSections) return spans.get(k);
          const range = addresses.get(k)?.span.lines;
          if (!range || plan.coverage.lines === 'complete') return range;
          // A template index after an open-length unit is not a song line number.
          return plan.lines[range[0]]?.positionKnown && plan.lines[range[1] - 1]?.positionKnown
            ? range
            : undefined;
        })
        .filter(Boolean);
      const lineNumbers = [
        ...new Set(
          ranges.flatMap(([a, b]) =>
            Array.from(
              { length: Math.max(0, Math.min(b, lines?.length ?? plan.lines.length) - a) },
              (_, i) => a + i + 1
            )
          )
        ),
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
