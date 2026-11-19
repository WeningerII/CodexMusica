// A bounded voicing for a scored tag: one sustained close-position major triad.
export function heldTagLines(plan) {
  const root = plan.tree[0];
  if (
    plan.id !== 'barbershop-tag' ||
    plan.scope !== 'setting' ||
    plan.tree.length !== 1 ||
    root.unit !== 'section' ||
    root.role !== 'tag' ||
    root.children.length < 2 ||
    root.children.length > 4
  )
    return 0;
  const last = root.children.at(-1);
  return root.children
    .slice(0, -1)
    .every((c) => c.unit === 'line' && !c.role && !c.children.length) &&
    last.unit === 'line' &&
    last.role === 'closing-line' &&
    last.children.length === 1 &&
    last.children[0].unit === 'held-note' &&
    !last.children[0].children.length
    ? root.children.length
    : 0;
}

export function gradeHeldTag(expected, lines, sections) {
  if (!Array.isArray(lines) || !Array.isArray(sections)) return 'unknown';
  if (lines.length !== expected || sections.length !== 1) return 'fail';
  const part = sections[0],
    span = lines.at(-1)?.scoreTicks;
  if (
    !part ||
    part.closingChord === undefined ||
    !Array.isArray(span) ||
    !Array.isArray(part.vocalRoster) ||
    !Array.isArray(part.lineSpan)
  )
    return 'unknown';
  if (
    part.role !== 'tag' ||
    part.lineSpan[0] !== 0 ||
    part.lineSpan[1] !== expected ||
    part.slotsWithinSection === false ||
    span.length !== 2 ||
    !span.every(Number.isSafeInteger) ||
    span[0] < 0 ||
    span[1] <= span[0]
  )
    return 'fail';
  let previousEnd = 0;
  for (const line of lines) {
    if (!Array.isArray(line?.scoreTicks)) return 'unknown';
    const [start, end] = line.scoreTicks;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < previousEnd ||
      end <= start
    )
      return 'fail';
    previousEnd = end;
  }
  if (
    !Array.isArray(part.closingChord) ||
    part.closingChord.length !== 4 ||
    part.vocalRoster.length !== 4 ||
    new Set(part.vocalRoster).size !== 4 ||
    part.vocalRoster.some((id) => typeof id !== 'string' || !id.trim())
  )
    return 'fail';
  const seen = new Set(),
    pitches = [];
  for (const event of part.closingChord) {
    if (
      !event ||
      !part.vocalRoster.includes(event.performer) ||
      seen.has(event.performer) ||
      !Number.isFinite(event.pitch_hz) ||
      event.pitch_hz <= 0 ||
      !Number.isSafeInteger(event.start) ||
      !Number.isSafeInteger(event.ticks) ||
      event.ticks < 4 ||
      event.start < span[0] ||
      event.start + event.ticks !== span[1]
    )
      return 'fail';
    seen.add(event.performer);
    pitches.push(event.pitch_hz);
  }
  pitches.sort((a, b) => a - b);
  return [1, 5 / 4, 3 / 2, 2].every(
    (ratio, i) => Math.abs(Math.log2(pitches[i] / pitches[0] / ratio)) < 1e-6
  )
    ? 'pass'
    : 'fail';
}
