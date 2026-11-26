/* The span enclosure rule and shared baseline come from the Codex Musica
   nesting audit diagram.js (d2ed46943d8363b4a0afbc762373f65fe39c94fb).
   Leaves represent units in native realization order, not sorted positions. */
const format = (s) => String(s).replaceAll('-', ' ');
const cap = (s) => s[0]?.toUpperCase() + s.slice(1);
export const title = (s) => cap(format(s));
const closeRoles = new Set(['envoi', 'closing-refrain', 'coda', 'outro']);
const internal = new Set(['address', 'path', 'children', 'span', 'unit', 'lineIndex']);
export const detailsOf = (n) =>
  Object.entries(n)
    .filter(([k]) => !internal.has(k))
    .map(([key, value]) => [
      {
        returns: 'Exact return',
        rhyme: 'Rhyme',
        endWord: 'End-word group',
        stress: 'Stress pattern',
        stresses: 'Stresses',
        syllables: 'Syllables',
      }[key] ?? title(key),
      String(value),
    ]);
export function structure(plan) {
  const leaves = [],
    groups = [];
  const axis =
    plan.coverage.lines === 'complete'
      ? 'line'
      : plan.coverage.sections === 'complete'
        ? 'section'
        : null;
  function visit(n, inClose = false, ordinal = 1, total = 1) {
    const closing = inClose || closeRoles.has(n.role);
    const label = n.role ? title(n.role) : title(n.unit) + (total > 1 ? ' ' + ordinal : '');
    const at = leaves.length;
    if (n.unit === axis || !n.children.length) {
      const sub = parseSegments(n);
      const node = { n, label, level: 0, first: at, last: at, closing, sub, children: null };
      leaves.push(node);
      return node;
    }
    const siblingCounts = new Map(),
      seen = new Map();
    for (const c of n.children) {
      const k = c.role ?? c.unit;
      siblingCounts.set(k, (siblingCounts.get(k) ?? 0) + 1);
    }
    const children = n.children.map((c) => {
      const k = c.role ?? c.unit;
      const i = (seen.get(k) ?? 0) + 1;
      seen.set(k, i);
      return visit(c, closing, i, siblingCounts.get(k));
    });
    const node = {
      n,
      label,
      level: 1 + Math.max(...children.map((c) => c.level)),
      first: children[0].first,
      last: children.at(-1).last,
      children,
      closing,
    };
    groups.push(node);
    return node;
  }
  const roots = plan.tree.map((n, i) => visit(n, false, i + 1, plan.tree.length));
  const returns = new Map();
  for (const l of leaves)
    for (const id of returnIds(l)) {
      if (!returns.has(id)) returns.set(id, []);
      returns.get(id).push(l.first);
    }
  return { leaves, groups, roots, axis, returns };
}
function parseSegments(n) {
  const found = [];
  function walk(segments) {
    for (const s of segments) {
      if (s.rhyme || s.returns) found.push(s);
      else walk(s.children);
    }
  }
  walk(n.children);
  return found;
}
export const returnIds = (l) => [
  ...new Set([l.n.returns, ...l.sub.map((s) => s.returns)].filter(Boolean)),
];
const count = (n) => n.last - n.first + 1;
export const spanHeight = (span, children) =>
  Math.max(
    ...children.map((c) => Math.max(c.height + 44, c.height * Math.sqrt(span / count(c)) + 10))
  );
export function geometry(model, available) {
  const { groups, roots, leaves } = model;
  if (!leaves.length) return null;
  const compactRhymeMarks =
    model.axis === 'line' &&
    leaves.every((l) => !l.sub.length && /^[A-Za-z]$/.test(l.n.rhyme ?? ''));
  const gutter = 18,
    maxCell = 92,
    minCell = leaves.some((l) => l.sub.length > 1)
      ? 75
      : available >= 900
        ? compactRhymeMarks
          ? 30
          : 39
        : 46;
  const cell = Math.min(maxCell, Math.max(minCell, (available - 2 * gutter) / leaves.length));
  const width = Math.max(available, cell * leaves.length + 2 * gutter),
    offset = (width - cell * leaves.length) / 2;
  leaves.forEach((n) => {
    n.height = 42;
  });
  groups.forEach((n) => {
    n.height = spanHeight(count(n), n.children);
  });
  const outer = roots.length > 1 ? spanHeight(leaves.length, roots) : roots[0].height;
  const scale = Math.min(1, 218 / outer);
  const baseline = outer * scale + 23;
  return { cell, width, offset, scale, baseline, totalHeight: baseline + 35, outer };
}
export const arc = (a, b, y, h, close = false) =>
  'M ' +
  a +
  ' ' +
  y +
  ' A ' +
  (b - a) / 2 +
  ' ' +
  h +
  ' 0 0 1 ' +
  b +
  ' ' +
  y +
  (close ? ' Z' : '');
