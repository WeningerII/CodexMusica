import { sectionScore, literal, sectionMelodyChecks } from './song-form-section-melody.mjs';
const contentFeatures = ['rhyme', 'returns', 'endWord', 'syllables', 'stress', 'stresses'];

export function scoredEnsemble(plan) {
  const song = plan.tree.length === 1 && plan.tree[0];
  if (
    !song ||
    song.unit !== 'song' ||
    song.role ||
    song.bars ||
    contentFeatures.some((k) => k in song)
  )
    return null;
  const plain = (n) => !n.bars && !contentFeatures.some((k) => k in n);
  const isPart = (s, role) =>
    s.unit === 'section' && s.role === role && plain(s) && !s.children.length;
  const strophes = song.children;
  const repeated =
    strophes.length >= 2 &&
    strophes.every(
      (strophe) =>
        strophe.unit === 'strophe' &&
        !strophe.role &&
        plain(strophe) &&
        strophe.children.length >= 2 &&
        strophe.children.every((s) => isPart(s, 'repeated-section'))
    );
  if (
    !repeated &&
    !(song.children.length >= 2 && song.children.every((s) => isPart(s, 'contrasting-part')))
  )
    return null;
  const paths = repeated
    ? strophes.flatMap((strophe) => strophe.children.map((s) => [song, strophe, s]))
    : song.children.map((s) => [song, s]);
  const sections = paths.map((nodes, i) => ({
    unit: 'section',
    role: 'verse',
    lines: null,
    sourceRole: nodes.at(-1).role,
    melodyGroup: repeated ? 'part-a' : 'section-' + (i + 1),
    vocalDuty: 'ensemble',
    divisionPath: nodes.map(({ unit, address, role }) => ({
      unit,
      address,
      ...(role && { role }),
    })),
  }));
  return { repeated, sections };
}

export function checkScoredEnsemble(layout, options) {
  const input = options.sections;
  if (input !== undefined && !Array.isArray(input))
    throw new TypeError('Expected ordered score sections');
  const checks = [
    {
      kind: 'sections-count',
      expected: layout.sections.length,
      actual: input?.length,
      outcome: !input ? 'unknown' : input.length === layout.sections.length ? 'pass' : 'fail',
    },
  ];
  const voices = [];
  const rowAt = layout.sections.map(
    (s, i) => input?.[i] ?? options.units?.[s.divisionPath.at(-1).address]
  );
  for (const [i, expected] of layout.sections.entries()) {
    const row = rowAt[i],
      path = row?.divisionPath,
      want = expected.divisionPath;
    const same =
      Array.isArray(path) &&
      path.length === want.length &&
      want.every(
        (p, k) =>
          path[k]?.unit === p.unit && path[k]?.address === p.address && path[k]?.role === p.role
      );
    checks.push({
      kind: 'division-path',
      sections: [i + 1],
      outcome: path === undefined ? 'unknown' : same ? 'pass' : 'fail',
    });
    const parts = row?.sectionParts;
    const roster = row?.vocalRoster,
      performers = row?.performers;
    const annotated = Array.isArray(parts) && parts.length <= 64;
    const submitted = new Map();
    let error = false,
      missing = false;
    if (annotated)
      for (const p of parts) {
        if (
          !p ||
          typeof p !== 'object' ||
          Object.keys(p).length !== 3 ||
          !Object.hasOwn(p, 'melody') ||
          typeof p.performer !== 'string' ||
          !p.performer ||
          !['voice', 'instrument'].includes(p.kind) ||
          submitted.has(p.performer)
        ) {
          error = true;
          continue;
        }
        const score = sectionScore({ ...row, sectionMelody: p.melody });
        if (score.outcome === 'fail') error = true;
        else if (score.outcome === 'unknown') missing = true;
        submitted.set(p.performer, { kind: p.kind, score });
      }
    const active = [...submitted].filter(([, p]) => p.kind === 'voice').map(([id]) => id);
    if (
      annotated &&
      (active.length < (layout.repeated ? 2 : 3) || (layout.repeated && active.length > 3))
    )
      error = true;
    if (annotated && !layout.repeated && active.length !== submitted.size) error = true;
    const matches = (a, b) =>
      Array.isArray(a) &&
      a.length === b.length &&
      new Set(a).size === a.length &&
      b.every((id) => a.includes(id));
    if (annotated && roster !== undefined && !matches(roster, active)) error = true;
    if (annotated && performers !== undefined && !matches(performers, active)) error = true;
    if (row?.sectionMelody !== undefined && annotated) {
      const lead = sectionScore(row);
      if (lead.outcome === 'fail') error = true;
      else if (lead.outcome === 'unknown') missing = true;
      else if (
        !active.some(
          (id) =>
            submitted.get(id).score.outcome === 'pass' && literal(lead, submitted.get(id).score)
        )
      )
        error = true;
    }
    const sounding = active.map((k) => submitted.get(k).score);
    if (
      sounding.every((p) => p.outcome === 'pass') &&
      sounding.length > 1 &&
      sounding.every((p) => literal(p, sounding[0]))
    )
      error = true;
    checks.push({
      kind: layout.repeated ? 'two-or-three-voice-score' : 'unaccompanied-ensemble-score',
      sections: [i + 1],
      outcome:
        error || (parts !== undefined && !annotated)
          ? 'fail'
          : !annotated || missing || !Array.isArray(roster) || !Array.isArray(performers)
            ? 'unknown'
            : 'pass',
      basis:
        'complete submitted section parts, actual pitched voice notation and performing roster',
    });
    voices.push(submitted);
  }
  const ids = [...new Set(voices.flatMap((m) => [...m.keys()]))].sort();
  let incomplete = voices.some(
    (m) => !m.size || ids.some((id) => m.get(id)?.score.outcome !== 'pass')
  );
  let wrong = false;
  const firstByVoice = new Map(),
    exact = new Set(),
    shapes = new Set();
  for (const section of voices) {
    if (layout.repeated) {
      for (const [id, { score }] of section) {
        if (score.outcome !== 'pass') continue;
        if (firstByVoice.has(id)) wrong ||= !literal(firstByVoice.get(id), score);
        else firstByVoice.set(id, score);
      }
    } else if (ids.length && ids.every((id) => section.get(id)?.score.outcome === 'pass')) {
      const scores = ids.map((id) => section.get(id).score);
      const expression = JSON.stringify(scores.map((s) => s.events));
      // Relative contours intentionally leave transposed or uniformly
      // augmented material inconclusive even if every frequency changed.
      const contour = JSON.stringify(
        scores.map((s) =>
          s.events.map(({ pitch, length }) => [
            pitch === null ? null : (Math.log2(pitch) - Math.log2(s.firstPitch)).toFixed(8),
            length / s.events[0].length,
          ])
        )
      );
      wrong ||= exact.has(expression);
      incomplete ||= shapes.has(contour);
      exact.add(expression);
      shapes.add(contour);
    }
  }
  checks.push({
    kind: layout.repeated ? 'ensemble-section-return' : 'ensemble-section-contrast',
    outcome: wrong ? 'fail' : incomplete ? 'unknown' : 'pass',
    basis: 'corresponding scored parts compared across sections',
  });
  checks.push(
    ...sectionMelodyChecks([], rowAt, 'ensemble').filter((c) => c.kind !== 'musical-contrast')
  );
  return {
    checks,
    verdict: checks.some((c) => c.outcome === 'fail')
      ? 'fail'
      : checks.some((c) => c.outcome === 'unknown')
        ? 'unknown'
        : 'pass',
  };
}
