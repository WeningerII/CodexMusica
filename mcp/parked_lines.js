// parked_lines.js — the lines a parked rewrite may change (#853, stage T),
// shared by the website chat (gemini_agent.js) and the connector's brief
// ledger (lyric_tools.js), so both read one rule. Moved here unchanged.
import { normalizeDraftLines } from './lyric_text.js';

export function declaredReturns(args, planReturns) {
  for (const r of [args?.returns, planReturns])
    if (typeof r === 'string' && r.trim()) return r.trim();
  return null;
}
// The run's rhyme groups as `N,N;N,N` (a member may name its place, N.PLACE):
// a pasted song's own `groups`, its letter `scheme` (one letter per line, X
// free), or the recorded plan's.
// The harness's rhyme partition of a scheme string (quality/schemes.py
// `parse`), as lists of 1-based lines. Whitespace is dropped and every other
// character is a line. A superscript, a `^` or mixed case selects the refrain
// reading (`parse_refrain`): a mark after a line is skipped, case is folded,
// and X, `.` and any non-letter are unrhymed. Otherwise (`parse`) a line is a
// character with its digits, keyed with them, case folded, X and `.` unrhymed.
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const isDigit = (c) => /\p{Nd}/u.test(c);
const isLetter = (c) => /\p{L}/u.test(c);
export function schemeGroups(text) {
  const t = [...String(text)].filter((c) => !/\s/u.test(c));
  const letters = t.filter(isLetter);
  const refrain =
    t.some((c) => c === '^' || SUPERSCRIPT.includes(c)) ||
    (letters.some((c) => c !== c.toLowerCase()) && letters.some((c) => c !== c.toUpperCase()));
  const by = new Map();
  let line = 0;
  for (let i = 0; i < t.length; ) {
    const c = t[i];
    let j = i + 1;
    if (refrain && t[j] === '^') j += 1;
    while (j < t.length && (isDigit(t[j]) || (refrain && SUPERSCRIPT.includes(t[j])))) j += 1;
    const tok = refrain ? c : t.slice(i, j).join('');
    i = j;
    line += 1;
    if (c.toUpperCase() === 'X' || c === '.' || (refrain && !isLetter(c))) continue;
    const key = tok.toUpperCase();
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(line);
  }
  return [...by.values()];
}
export function declaredGroups(args, planGroups) {
  if (typeof args?.groups === 'string' && args.groups.trim()) return args.groups.trim();
  if (typeof args?.scheme === 'string' && args.scheme.trim()) {
    const cells = schemeGroups(args.scheme).filter((c) => c.length > 1);
    return cells.length ? cells.map((c) => c.join(',')).join(';') : null;
  }
  return typeof planGroups === 'string' && planGroups.trim() ? planGroups.trim() : null;
}
export const linesOf = (spec) =>
  typeof spec === 'string'
    ? spec
        .split(';')
        .map((c) =>
          c
            .split(',')
            .map((m) => parseInt(String(m).trim(), 10))
            .filter(Number.isInteger)
        )
        .filter((c) => c.length > 1)
    : [];
// THE LINES A PARKED REWRITE MAY CHANGE (#853, stage T). What the revise
// loop's own repair may move (quality/loop.py, the group question): the open
// lines, every member of a declared rhyme group an open line is in (the loop
// rewrites the group jointly; Andrej on #866), and every line a verbatim
// return ties to any of those, all taken to closure. With no return
// declared, a line whose sung text is an open line's text counts as its
// return. A whole-draft flag opens every line, as the loop's whole-draft
// question does. null means every line may change.
export function parkedChangeable(lyr) {
  if (Array.isArray(lyr?.whole) && lyr.whole.length) return null;
  const open = (Array.isArray(lyr?.open) ? lyr.open : []).filter(Number.isInteger);
  if (!open.length) return null;
  const allowed = new Set(open);
  const groups = linesOf(lyr.groups);
  const returns = linesOf(lyr.returns);
  if (!returns.length && Array.isArray(lyr.draft)) {
    const sung = normalizeDraftLines(lyr.draft);
    const byText = new Map();
    sung.forEach((t, i) => {
      if (!byText.has(t)) byText.set(t, []);
      byText.get(t).push(i + 1);
    });
    returns.push(...[...byText.values()].filter((c) => c.length > 1));
  }
  // Each ORIGINAL open line's groups, as the loop selects them for its group
  // question, so the result does not depend on the order groups are written.
  const openSet = new Set(open);
  for (const c of groups) if (c.some((l) => openSet.has(l))) c.forEach((l) => allowed.add(l));
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of returns)
      if (c.some((l) => allowed.has(l)) && c.some((l) => !allowed.has(l))) {
        c.forEach((l) => allowed.add(l));
        grew = true;
      }
  }
  return [...allowed].sort((a, b) => a - b);
}
