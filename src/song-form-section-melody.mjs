// A letter in a form diagram locates a part. This comparison measures the
// notated monophonic phrase at that location, independently of its name.
const partRole = /^part-[abcd]$/;
const contentFeatures = ['rhyme', 'returns', 'endWord', 'syllables', 'stress', 'stresses'];

export function sectionMelodyLayout(plan) {
  if (plan.tree.length !== 1 || plan.coverage.sections !== 'complete') return false;
  const [song] = plan.tree;
  if (song.role || contentFeatures.some((k) => k in song)) return false;
  const roles = song.children.map((s) => s.role);
  if (
    song.children.some(
      (s) => s.unit !== 'section' || s.children.length || contentFeatures.some((k) => k in s)
    )
  )
    return false;
  if (song.unit === 'stanza' && !song.bars && roles.join(' ') === 'stollen stollen abgesang')
    return 'bar-form';
  if (song.unit !== 'song') return false;
  if (
    !song.bars &&
    roles.length >= 3 &&
    roles[0] === 'head' &&
    roles.at(-1) === 'head' &&
    roles.slice(1, -1).every((role) => role === 'solo')
  )
    return 'head-solos-head';
  if (
    !song.bars &&
    roles.includes('verse') &&
    roles.filter((r) => r === 'altered-verse').length === 1 &&
    roles.every((r) => r === 'verse' || r === 'altered-verse')
  )
    return 'modified-strophic';
  const groups = new Set();
  for (const section of song.children) {
    if (partRole.test(section.role)) groups.add(section.role);
    else if (!['tag', 'solo'].includes(section.role)) return false;
  }
  if (groups.size < 2) return false;
  if (!song.bars) return 'lettered';
  if (!roles.every((r) => partRole.test(r))) return false;
  const explicit = song.children.filter((s) => s.bars !== undefined);
  if (
    (explicit.length === song.children.length &&
      explicit.reduce((n, s) => n + s.bars, 0) === song.bars) ||
    (!explicit.length && Number.isInteger(song.bars / roles.length))
  )
    return 'fixed-total';
  return false;
}

export function sectionMelodyGroup(role, layout) {
  if (layout === 'modified-strophic') return { verse: 'part-a', 'altered-verse': 'part-b' }[role];
  if (layout === 'head-solos-head') return role === 'head' ? 'part-a' : undefined;
  if (layout === 'bar-form') return { stollen: 'part-a', abgesang: 'part-b' }[role];
  return partRole.test(role) ? role : undefined;
}

export function declaredPart(row) {
  const label = row?.sourceRole ?? row?.role;
  const matched = typeof label === 'string' && /^(?:part[\s_-]+)?([abcd])$/i.exec(label);
  return matched ? 'part-' + matched[1].toLowerCase() : row?.sourceRole;
}

const exactKeys = (obj, keys) =>
  obj !== null &&
  typeof obj === 'object' &&
  !Array.isArray(obj) &&
  Object.keys(obj).length === keys.length &&
  keys.every((key) => Object.hasOwn(obj, key));
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const groupsMatch = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((value, i) => value === b[i]);

export function sectionScore(section) {
  if (!section || !Object.hasOwn(section, 'sectionMelody')) return { outcome: 'unknown' };
  const phrase = section.sectionMelody;
  const meter = phrase?.meter;
  if (
    !exactKeys(phrase, ['meter', 'bars', 'subdivision', 'notes']) ||
    !exactKeys(meter, ['beats', 'unit', 'groups']) ||
    !positive(meter.beats) ||
    ![1, 2, 4, 8, 16, 32, 64].includes(meter.unit) ||
    !Array.isArray(meter.groups) ||
    !meter.groups.length ||
    !meter.groups.every((n) => n === 2 || n === 3) ||
    meter.groups.reduce((sum, n) => sum + n, 0) !== meter.beats ||
    !positive(phrase.bars) ||
    ![1, 2, 4].includes(phrase.subdivision) ||
    !Array.isArray(phrase.notes) ||
    !phrase.notes.length ||
    phrase.notes.length > 4096
  )
    return { outcome: 'fail' };
  const total = phrase.bars * meter.beats * phrase.subdivision;
  let ticks = 0;
  const events = [];
  let firstPitch;
  for (const event of phrase.notes) {
    if (
      !exactKeys(event, ['pitch_hz', 'ticks']) ||
      !positive(event.ticks) ||
      !(event.pitch_hz === null || (Number.isFinite(event.pitch_hz) && event.pitch_hz > 0))
    )
      return { outcome: 'fail' };
    ticks += event.ticks;
    firstPitch ??= event.pitch_hz;
    const length = event.ticks / (phrase.subdivision * meter.unit);
    if (event.pitch_hz === null && events.at(-1)?.pitch === null) events.at(-1).length += length;
    else events.push({ pitch: event.pitch_hz, length });
  }
  if (!positive(total) || ticks !== total || firstPitch == null) return { outcome: 'fail' };
  if (
    (section.bars !== undefined && section.bars !== phrase.bars) ||
    (section.sectionMeter &&
      (section.sectionMeter.beats !== meter.beats ||
        section.sectionMeter.unit !== meter.unit ||
        (section.sectionMeter.groups !== undefined &&
          !groupsMatch(section.sectionMeter.groups, meter.groups))))
  )
    return { outcome: 'fail' };
  if (section.bars === undefined || !section.sectionMeter) return { outcome: 'unknown' };
  return { outcome: 'pass', events, firstPitch };
}

export function literal(a, b) {
  return (
    a.events.length === b.events.length &&
    a.events.every(
      ({ pitch, length }, i) => pitch === b.events[i].pitch && length === b.events[i].length
    )
  );
}

// A uniform change of registration or duration preserves the pitch intervals
// and rhythmic proportions; by itself it leaves thematic contrast undecided.
function sameShape(a, b) {
  if (a.events.length !== b.events.length) return false;
  const offset = Math.log2(a.firstPitch) - Math.log2(b.firstPitch);
  return a.events.every(({ pitch, length }, i) => {
    const other = b.events[i];
    if ((pitch === null) !== (other.pitch === null)) return false;
    if (pitch !== null && Math.abs(Math.log2(pitch) - Math.log2(other.pitch) - offset) > 1e-9)
      return false;
    return length / a.events[0].length === other.length / b.events[0].length;
  });
}

export function sectionMelodyChecks(parts, observed, layout) {
  const checks = [];
  let nextBar = 1;
  let order = 'pass';
  for (const row of observed) {
    if (row?.slotsWithinSection === false) {
      checks.push({
        kind: 'lyric-slot-in-section',
        outcome: 'fail',
        basis: 'a submitted lyric slot falls outside its named section',
      });
    }
    if (!positive(row?.startBar) || !positive(row?.bars)) {
      if (order !== 'fail') order = 'unknown';
      continue;
    }
    if (row.startBar < nextBar) order = 'fail';
    else if (row.startBar !== nextBar && order !== 'fail') order = 'unknown';
    nextBar = Math.max(nextBar, row.startBar + row.bars);
    if (!Number.isSafeInteger(nextBar) && order !== 'fail') order = 'unknown';
  }
  checks.push({
    kind: 'section-score-order',
    outcome: order,
    basis: 'chronological whole-section bar spans in the submitted score',
  });
  if (layout === 'head-solos-head') {
    for (const [i, part] of parts.entries()) {
      if (part.role === 'solo') {
        checks.push({
          kind: 'instrumental-solo-score',
          sections: [i + 1],
          outcome: sectionScore(observed[i]).outcome,
          basis:
            'an independently notated instrumental phrase with pitched events filling the actual solo bars',
        });
      }
      const span = observed[i]?.lineSpan;
      const count =
        Array.isArray(span) &&
        span.length === 2 &&
        span.every(Number.isSafeInteger) &&
        span[0] >= 0 &&
        span[1] >= span[0]
          ? span[1] - span[0]
          : undefined;
      checks.push({
        kind: 'head-solo-lines',
        sections: [i + 1],
        actual: count,
        outcome:
          count === undefined
            ? 'unknown'
            : (part.role === 'solo' ? count === 0 : count > 0)
              ? 'pass'
              : 'fail',
        basis: 'sung head verses return around intervening instrumental solo sections',
      });
    }
  }
  const groups = new Map();
  for (const [i, part] of parts.entries()) {
    if (!sectionMelodyGroup(part.role, layout)) continue;
    const score = sectionScore(observed[i]);
    if (!groups.has(part.role)) groups.set(part.role, []);
    groups.get(part.role).push({ index: i + 1, score });
    if (score.outcome === 'fail')
      checks.push({
        kind: 'section-score',
        outcome: 'fail',
        sections: [i + 1],
        basis: 'invalid pitched phrase or conflict with the submitted section grid',
      });
  }
  const knownGroups = [];
  let incomplete = false;
  for (const [part, rows] of groups) {
    const known = rows.filter((r) => r.score.outcome === 'pass');
    incomplete ||= known.length < rows.length;
    if (rows.length > 1)
      checks.push({
        kind: 'musical-return',
        part,
        sections: rows.map((r) => r.index),
        outcome: known.some((r) => !literal(r.score, known[0].score))
          ? 'fail'
          : known.length < rows.length
            ? 'unknown'
            : 'pass',
        basis: 'exact notated pitches, attacks, rests and durations of the whole section',
      });
    if (known.length) knownGroups.push(known[0].score);
  }
  let uncertain = incomplete;
  let collision = false;
  for (let i = 0; i < knownGroups.length; i++) {
    for (const other of knownGroups.slice(0, i)) {
      collision ||= literal(knownGroups[i], other);
      if (layout !== 'modified-strophic') uncertain ||= sameShape(knownGroups[i], other);
    }
  }
  if (groups.size > 1)
    checks.push({
      kind: 'musical-contrast',
      parts: [...groups.keys()],
      outcome: collision ? 'fail' : uncertain ? 'unknown' : 'pass',
      basis:
        layout === 'modified-strophic'
          ? 'the altered verse changes the written pitches or rhythm, including transposition'
          : 'distinct written pitch-interval or rhythmic material; transposition or uniform scaling alone is inconclusive',
    });
  if (layout === 'bar-form') {
    const lengths = observed.map((s) => s?.bars);
    checks.push({
      kind: 'longer-abgesang',
      sections: [1, 2, 3],
      outcome: lengths.every(positive)
        ? lengths[2] > Math.max(lengths[0], lengths[1])
          ? 'pass'
          : 'fail'
        : 'unknown',
      basis: 'the closing section spans more bars than either opening section',
    });
  }
  return checks;
}

// The refrain is a parent span in this tree. In a played score its child
// sections occupy those bars; there is no extra section played for the parent.
export function nestedRefrain(plan) {
  const song = plan.tree.length === 1 && plan.tree[0];
  if (
    !song ||
    song.unit !== 'song' ||
    song.bars ||
    song.role ||
    contentFeatures.some((k) => k in song)
  )
    return null;
  const items = song.children;
  const refrain = items.at(-1);
  if (
    !refrain ||
    refrain.unit !== 'section' ||
    refrain.role !== 'refrain' ||
    !positive(refrain.bars) ||
    contentFeatures.some((k) => k in refrain) ||
    items.length > 2
  )
    return null;
  const intro = items.length === 2 ? items[0] : null;
  if (
    intro &&
    (intro.unit !== 'section' ||
      intro.role !== 'introductory-verse' ||
      intro.children.length ||
      intro.bars ||
      contentFeatures.some((k) => k in intro))
  )
    return null;
  const children = refrain.children;
  if (
    children.length < 2 ||
    children.some(
      (s) =>
        s.unit !== 'section' ||
        !partRole.test(s.role) ||
        s.children.length ||
        s.bars ||
        contentFeatures.some((k) => k in s)
    ) ||
    new Set(children.map((s) => s.role)).size < 2 ||
    refrain.bars % children.length
  )
    return null;
  const parts = intro ? [intro, ...children] : children;
  const sections = parts.map((s) => {
    const inside = s !== intro;
    const path = inside ? [song, refrain, s] : [song, s];
    return {
      unit: 'section',
      role: inside ? 'verse' : 'intro',
      sourceRole: s.role,
      lines: null,
      divisionPath: path.map(({ unit, role, address }) => ({
        unit,
        address,
        ...(role && { role }),
      })),
      ...(inside && { melodyGroup: s.role, bars: refrain.bars / children.length }),
    };
  });
  return { refrain, intro, parts, sections };
}

export function checkNestedRefrain(layout, options) {
  const { refrain, intro, parts, sections } = layout;
  let input = options.sections;
  if (input !== undefined && !Array.isArray(input))
    throw new TypeError('Expected ordered score sections');
  const units = options.units ?? {};
  const named = new Set(sections.flatMap((s) => s.divisionPath.map((p) => p.address)));
  if (Object.keys(units).some((address) => !named.has(address)))
    throw new TypeError('Unknown unit observation address');
  // Raw catalog observations can include the explicit parent section as a
  // tree node. A filled physical score has only the separately played leaves.
  if (
    input?.length === parts.length + 1 &&
    units[refrain.address] &&
    input.every((row) => row && typeof row === 'object' && Object.keys(row).length === 0)
  )
    input = input.filter((_, i) => i !== (intro ? 1 : 0));
  const rows = parts.map((part, i) =>
    input?.[i] || units[part.address] ? { ...input?.[i], ...units[part.address] } : undefined
  );
  const checks = [
    {
      kind: 'sections-count',
      expected: parts.length,
      actual: input?.length,
      outcome: !input ? 'unknown' : parts.length === input.length ? 'pass' : 'fail',
    },
  ];
  for (const [i, part] of parts.entries()) {
    const row = rows[i],
      path = row?.divisionPath;
    const label =
      row?.sourceRole ??
      (part === intro && row?.role === 'intro' ? 'introductory-verse' : declaredPart(row));
    if (label !== undefined)
      checks.push({
        kind: 'role',
        address: part.address,
        expected: part.role,
        actual: label,
        outcome: label === part.role ? 'pass' : 'fail',
      });
    const want = sections[i].divisionPath;
    const correct =
      Array.isArray(path) &&
      path.length === want.length &&
      want.every(
        (p, k) =>
          path[k]?.address === p.address && path[k]?.unit === p.unit && path[k]?.role === p.role
      );
    checks.push({
      kind: 'refrain-boundary',
      address: part.address,
      outcome: path === undefined ? 'unknown' : correct ? 'pass' : 'fail',
    });
  }
  const inner = rows.slice(intro ? 1 : 0);
  const total = inner.every((s) => positive(s?.bars))
    ? inner.reduce((a, s) => a + s.bars, 0)
    : undefined;
  const parent = options.units?.[refrain.address]?.bars;
  checks.push({
    kind: 'bars',
    address: refrain.address,
    expected: refrain.bars,
    actual: total,
    outcome:
      parent !== undefined && parent !== refrain.bars
        ? 'fail'
        : total === undefined
          ? 'unknown'
          : total === refrain.bars
            ? 'pass'
            : 'fail',
  });
  checks.push(...sectionMelodyChecks(parts, rows, 'lettered'));
  return {
    checks,
    verdict: checks.some((c) => c.outcome === 'fail')
      ? 'fail'
      : checks.some((c) => c.outcome === 'unknown')
        ? 'unknown'
        : 'pass',
  };
}
