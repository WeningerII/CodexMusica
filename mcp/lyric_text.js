// Shared draft normalization for tool handlers and creation receipts.
// ONE reading for both spellings of a draft: a blank row, or a row that is
// only a bracketed [SECTION] marker, is not a sung line. The array spelling
// used to keep those rows, so the harness (which reads every nonblank row
// literally) counted a marker as a line in one spelling and not the other.
const sungRow = (line) => line && !/^\[[^\]]*\]$/.test(line);

// THE ROW BREAKS OF PASTED TEXT. A lone carriage return and the two Unicode
// line separators end a row, as a line feed does. The default form split on
// line feeds only, so text pasted with carriage-return breaks became ONE row
// and was refused as an array item holding several lines, in the text field
// the refusal tells the caller to use (bug hunt 2026-11-20, finding 35).
const ROW_BREAK = /\r\n|[\n\r\u2028\u2029]/u;
// The same breaks one character at a time, for the projection's offsets: a
// carriage return before a line feed stays in its row (and is trimmed off).
const ROW_BREAK_CHAR = /\n|\r(?!\n)|[\u2028\u2029]/u;

export function draftFromText(text, form) {
  if (form === 'prose-poem') {
    const rows = String(text).split(ROW_BREAK);
    let previous = false;
    for (const row of rows) {
      if (!row.trim()) {
        previous = false;
        continue;
      }
      if (!sungRow(row.trim())) continue;
      if (previous)
        throw new RangeError(
          'Prose paragraph text requires a blank line between unbroken paragraphs.'
        );
      previous = true;
    }
    return normalizeDraftLines(rows, form);
  }
  return normalizeDraftLines(
    String(text).split(form === 'triadic-line' ? /\r\n|\r|\n/ : ROW_BREAK),
    form
  );
}

// Non-string items are kept as they are, so the handler's own type check
// still refuses them by name.
export const normalizeDraftLines = (lines, form) =>
  lines
    .filter((line) => typeof line !== 'string' || sungRow(line.trim()))
    .map((line) =>
      typeof line !== 'string' ? line : form === 'triadic-line' ? line.trimEnd() : line.trim()
    );

// Ordinal source projection using exactly the tool's sung-row convention.
// Every full input row remains accounted for, including structural exclusions.
// Offsets are half-open UTF-16; no spelling search or lyric omission is allowed.
export function projectDraftText(text) {
  if (typeof text !== 'string') return null;
  let start = 0,
    sourceStart = 0;
  const lines = [];
  const rows = text.split(ROW_BREAK_CHAR).map((raw, row) => {
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

// In this writing setting each array item explicitly supplies one paragraph.
export function serializeWritingDraft(rows, form) {
  return rows.join(form === 'prose-poem' ? '\n\n' : '\n') + '\n';
}
