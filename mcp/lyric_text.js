// Shared draft normalization for tool handlers and creation receipts.
export function draftFromText(text) {
  return String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^\[[^\]]*\]$/.test(l));
}

export const normalizeDraftLines = (lines) =>
  lines.map((line) => (typeof line === 'string' ? line.trim() : line));
