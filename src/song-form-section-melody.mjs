// A letter in a form diagram locates a part. This comparison measures the
// notated monophonic phrase at that location, independently of its name.
const partRole = /^part-[abcd]$/;
const contentFeatures = ['rhyme', 'returns', 'endWord', 'syllables', 'stress', 'stresses'];

export function sectionMelodyLayout(plan) {
  if (plan.tree.length !== 1 || plan.coverage.sections !== 'complete') return false;
  const [song] = plan.tree;
  if (song.unit !== 'song' || song.role || song.bars || contentFeatures.some((k) => k in song))
    return false;
  const groups = new Set();
  for (const section of song.children) {
    if (
      section.unit !== 'section' ||
      section.children.length ||
      contentFeatures.some((k) => k in section)
    )
      return false;
    if (partRole.test(section.role)) groups.add(section.role);
    else if (!['tag', 'solo'].includes(section.role)) return false;
  }
  return groups.size >= 2;
}

export function sectionMelodyGroup(role) {
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

function sectionScore(section) {
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

function literal(a, b) {
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

export function sectionMelodyChecks(parts, observed) {
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
  const groups = new Map();
  for (const [i, part] of parts.entries()) {
    if (!sectionMelodyGroup(part.role)) continue;
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
      uncertain ||= sameShape(knownGroups[i], other);
    }
  }
  checks.push({
    kind: 'musical-contrast',
    parts: [...groups.keys()],
    outcome: collision ? 'fail' : uncertain ? 'unknown' : 'pass',
    basis:
      'distinct written pitch-interval or rhythmic material; transposition or uniform scaling alone is inconclusive',
  });
  return checks;
}
