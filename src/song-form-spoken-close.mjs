// Score evidence for a repeated instrumental figure and a spoken closing line.
export function spokenCloseSetting(plan) {
  const stanza = plan.tree[0];
  if (
    plan.id !== 'talking-blues' ||
    plan.scope !== 'setting' ||
    plan.tree.length !== 1 ||
    stanza.unit !== 'stanza' ||
    ![2, 4].includes(stanza.children.length)
  )
    return 0;
  const voices = stanza.children;
  return voices.every(
    (n, i) =>
      n.unit === 'line' &&
      !n.children.length &&
      (i === voices.length - 1 ? n.role === 'spoken-close' : !n.role) &&
      (voices.length === 2 ? n.rhyme === 'A' : n.rhyme === undefined)
  )
    ? voices.length
    : 0;
}

export function measureSpokenClose(n, lines, sections) {
  if (!Array.isArray(lines) || !Array.isArray(sections)) return 'unknown';
  if (lines.length !== n || sections.length !== 1) return 'fail';
  const section = sections[0],
    score = section?.accompaniment,
    last = lines.at(-1);
  if (!score || last?.speechEvent === undefined || lines.some((l) => !Array.isArray(l?.scoreTicks)))
    return 'unknown';
  if (
    section.slotsWithinSection === false ||
    score.instrument !== 'guitar' ||
    !Array.isArray(score.figures) ||
    score.figures.length < 2 ||
    score.figures.length > 64
  )
    return 'fail';
  let cursor = 0,
    cell = null;
  for (const phrase of score.figures) {
    if (!Array.isArray(phrase) || phrase.length < 2 || phrase.length > 32) return 'fail';
    if (cell && cell.length !== phrase.length) return 'fail';
    for (const [i, e] of phrase.entries()) {
      if (
        !e ||
        !Number.isSafeInteger(e.start) ||
        e.start !== cursor ||
        !Number.isSafeInteger(e.ticks) ||
        e.ticks < 1 ||
        !Number.isFinite(e.pitch_hz) ||
        e.pitch_hz <= 0 ||
        (cell && (cell[i].pitch_hz !== e.pitch_hz || cell[i].ticks !== e.ticks))
      )
        return 'fail';
      cursor += e.ticks;
    }
    if (new Set(phrase.map((e) => e.pitch_hz)).size < 2) return 'fail';
    cell = phrase;
  }
  if (!Number.isSafeInteger(section.bars) || !Number.isSafeInteger(section.sectionMeter?.beats))
    return 'unknown';
  if (cursor !== section.bars * section.sectionMeter.beats * 4) return 'fail';
  let previousEnd = 0;
  for (const {
    scoreTicks: [start, end],
  } of lines) {
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < previousEnd ||
      end <= start ||
      end > cursor
    )
      return 'fail';
    previousEnd = end;
  }
  const [start, end] = last.scoreTicks,
    event = last.speechEvent;
  return event?.articulation === 'speech' &&
    event.pitch_hz === undefined &&
    event.start === start &&
    event.ticks === end - start
    ? 'pass'
    : 'fail';
}
