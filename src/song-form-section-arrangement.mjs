// A repeated printed lyric block can use the native chorus carrier. This
// recognizes a complete selected topology, never a synonym for an isolated role.
export function sectionArrangement(plan) {
  const root = plan.tree[0];
  if (plan.tree.length !== 1 || !root || !['poem', 'song'].includes(root.unit)) return null;
  const sections = root.children;
  if (
    sections.length < 2 ||
    !sections.every(
      (s) =>
        s.unit === 'section' &&
        s.role === sections[0].role &&
        s.children.length === sections[0].children.length &&
        s.children.every((l) => l.unit === 'line')
    )
  )
    return null;
  const { role, children } = sections[0];
  if (
    plan.id === 'sonnet-sequence' &&
    role === 'sonnet' &&
    children.length === 14 &&
    sections.every((s) => s.children.every((l) => l.returns === undefined))
  ) {
    return { sourceRole: role, role: 'verse', repeatText: false };
  }
  if (!['chant', 'call'].includes(role) || children.length < 2) return null;
  const labels = children.map((l) => l.returns);
  // Exactly the same return groups at the same offsets. An equal endpoint
  // does not satisfy a full-line return, and a group cannot span two offsets.
  const declared =
    labels.every((label) => typeof label === 'string') &&
    new Set(labels).size === labels.length &&
    sections.every((s) => s.children.every((l, i) => l.returns === labels[i]));
  const terrace =
    plan.id === 'terrace-chant' &&
    role === 'chant' &&
    children.length <= 4 &&
    sections.every((s) => s.children.every((l) => l.returns === undefined));
  if (!declared && !terrace) return null;
  return { sourceRole: role, role: 'chorus', repeatText: true };
}

export function measureSectionArrangement(arrangement, plan, lines, sections) {
  if (!arrangement || !sections) return { sections, checks: [] };
  const checks = [];
  const mapped = sections.map((s) => {
    if (s.sourceRole === undefined) return s;
    if (s.role !== arrangement.role) return s;
    return { ...s, role: s.sourceRole };
  });
  if (arrangement.repeatText) {
    const width = plan.tree[0].children[0].children.length;
    for (let i = 1; i < plan.sections.length; i++) {
      const [start, end] = sections[i]?.lineSpan ?? [];
      const first = sections[0]?.lineSpan;
      const available =
        Array.isArray(lines) &&
        first?.[0] === 0 &&
        first[1] === width &&
        start === i * width &&
        end === start + width &&
        end <= lines.length;
      const text = (row) => (typeof row === 'string' ? row : row?.text);
      for (let j = 0; j < width; j++) {
        const a = available ? text(lines[j]) : undefined,
          b = available ? text(lines[start + j]) : undefined;
        checks.push({
          kind: 'section-text-return',
          lines: [j + 1, i * width + j + 1],
          outcome:
            typeof a !== 'string' || typeof b !== 'string' ? 'unknown' : a === b ? 'pass' : 'fail',
        });
      }
    }
  }
  return { sections: mapped, checks };
}
