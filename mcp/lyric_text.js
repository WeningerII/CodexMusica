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
