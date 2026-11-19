// A bounded, literal unison setting measured from independently timed voice parts.
export function imitativeSetting(plan) {
  const root = plan.tree[0];
  if (plan.scope !== 'setting' || plan.tree.length !== 1 || root.unit !== 'staggered-voices')
    return null;
  const voices = root.children;
  if (voices.length < 2 || voices.length > 16) return null;
  const looping = plan.id === 'round';
  if (!looping && plan.id !== 'canon') return null;
  for (const [i, voice] of voices.entries()) {
    if (
      voice.unit !== 'voice' ||
      voice.role !== (i === 0 ? 'leader' : looping ? 'delayed-entry' : 'delayed-imitation')
    )
      return null;
    if (
      looping
        ? voice.children.length < 2 ||
          voice.children.length > 16 ||
          voice.children.some((v) => v.unit !== 'melody' || v.children.length)
        : voice.children.length
    )
      return null;
  }
  return voices.map((v) => (looping ? v.children.length : 1));
}

export function checkImitativeScore(repeats, lines, sections) {
  if (!Array.isArray(sections) || !sections.length) return 'unknown';
  if (sections.length !== 1) return 'fail';
  const section = sections[0];
  if (!section || section.voiceScore === undefined) return 'unknown';
  const { voiceScore, sectionMeter, bars, vocalRoster, lineSpan } = section;
  if (
    !sectionMeter ||
    !Number.isSafeInteger(bars) ||
    !Array.isArray(vocalRoster) ||
    !Array.isArray(lineSpan) ||
    !Array.isArray(lines) ||
    !lines.length
  )
    return 'unknown';
  if (section.slotsWithinSection === false || lineSpan[0] !== 0 || lineSpan[1] !== lines.length)
    return 'fail';
  if (!Number.isSafeInteger(sectionMeter.beats) || sectionMeter.beats < 1) return 'unknown';
  if (
    !voiceScore ||
    ![1, 2, 4].includes(voiceScore.subdivision) ||
    !Array.isArray(voiceScore.tracks) ||
    voiceScore.tracks.length !== repeats.length ||
    vocalRoster.length !== repeats.length ||
    new Set(vocalRoster).size !== repeats.length ||
    vocalRoster.some((p) => typeof p !== 'string' || !p.trim())
  )
    return 'fail';
  const limit = bars * sectionMeter.beats * voiceScore.subdivision;
  let phrase, previousStart, previousEnd, delay;
  const performers = new Set();
  // Track array order is immaterial; the actual first onset orders the voices.
  const tracks = [...voiceScore.tracks].sort((a, b) => a?.start - b?.start);
  for (const [index, track] of tracks.entries()) {
    if (
      !track ||
      !vocalRoster.includes(track.performer) ||
      performers.has(track.performer) ||
      !Number.isSafeInteger(track.start) ||
      track.start < 0 ||
      !Array.isArray(track.phrases) ||
      track.phrases.length !== repeats[index]
    )
      return 'fail';
    performers.add(track.performer);
    if (index) {
      const gap = track.start - previousStart;
      if (gap <= 0 || track.start >= previousEnd || (delay !== undefined && gap !== delay))
        return 'fail';
      delay = gap;
    }
    let end = track.start;
    for (const notes of track.phrases) {
      if (
        !Array.isArray(notes) ||
        notes.length < 2 ||
        notes.length > 64 ||
        notes.some(
          (n) =>
            !Array.isArray(n) ||
            n.length !== 2 ||
            !Number.isFinite(n[0]) ||
            n[0] <= 0 ||
            !Number.isSafeInteger(n[1]) ||
            n[1] <= 0
        ) ||
        new Set(notes.map((n) => n[0])).size < 2
      )
        return 'fail';
      if (
        phrase &&
        (notes.length !== phrase.length ||
          notes.some(([pitch, ticks], j) => pitch !== phrase[j][0] || ticks !== phrase[j][1]))
      )
        return 'fail';
      phrase = notes;
      end += notes.reduce((sum, note) => sum + note[1], 0);
      if (end > limit) return 'fail';
    }
    previousStart = track.start;
    previousEnd = end;
  }
  return 'pass';
}
