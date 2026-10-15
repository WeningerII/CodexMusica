// Shared draft normalization for tool handlers and creation receipts.
// ONE reading for both spellings of a draft: a blank row, or a row that is
// only a bracketed [SECTION] marker, is not a sung line. The array spelling
// used to keep those rows, so the harness (which reads every nonblank row
// literally) counted a marker as a line in one spelling and not the other.
const sungRow = (line) => line && !/^\[[^\]]*\]$/.test(line);

export function draftFromText(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(sungRow);
}

// Non-string items are kept as they are, so the handler's own type check
// still refuses them by name.
export const normalizeDraftLines = (lines) =>
  lines
    .map((line) => (typeof line === 'string' ? line.trim() : line))
    .filter((line) => typeof line !== 'string' || sungRow(line));

// Ordinal source projection using exactly the tool's sung-row convention.
// Every full input row remains accounted for, including structural exclusions.
// Offsets are half-open UTF-16; no spelling search or lyric omission is allowed.
export function projectDraftText(text) {
  if (typeof text !== 'string') return null;
  let start = 0,
    sourceStart = 0;
  const lines = [];
  const rows = text.split('\n').map((raw, row) => {
    const trimmed = raw.trim();
    const kind = !trimmed ? 'blank' : sungRow(trimmed) ? 'sung' : 'section';
    const item = { row, kind, start, end: start + raw.length };
    if (kind === 'sung') {
      const textStart = start + raw.length - raw.trimStart().length;
      Object.assign(item, {
        source_start: sourceStart,
        source_end: sourceStart + trimmed.length,
        text_start: textStart,
        text_end: textStart + trimmed.length,
      });
      lines.push(trimmed);
      sourceStart += trimmed.length + 1;
    }
    start += raw.length + 1;
    return item;
  });
  return { version: 1, convention: 'lyric_text/sung-rows-v1', source_text: lines.join('\n'), rows };
}
