// Translate only obligations that the native seeded writer can enforce.
// The writer still judges placement, recurrence, envelope and seed feasibility.
const NATIVE_ROLES = new Set([
  'intro',
  'verse',
  'prechorus',
  'chorus',
  'postchorus',
  'refrain',
  'burden',
  'bridge',
  'breakdown',
  'build',
  'drop',
  'vamp',
  'patter',
  'turnaround',
  'interlude',
  'solo',
  'tag',
  'hook',
  'coda',
  'outro',
  'false_ending',
  'reprise',
]);
const FEATURES = ['role', 'rhyme', 'returns', 'endWord', 'syllables', 'stress', 'stresses', 'bars'];
const WRAPPERS = new Set(['song', 'poem', 'cycle']);

/**
 * Project a result from realizeForm and its validated count selections.
 * A setting keeps its bounded scope. A ready result is a native planner input,
 * not a promise that any particular seed, or any submitted draft, will pass.
 */
export function projectSongFormCreation(plan, counts = {}) {
  if (!plan || !['ready', 'needs-input', 'deferred'].includes(plan.status)) {
    throw new TypeError('Expected a realized catalog form.');
  }
  const result = {
    id: plan.id,
    variant: plan.variant,
    scope: plan.scope,
    needs: plan.needs,
    status: plan.status,
    reasons: [],
    contract: null,
  };
  if (plan.status !== 'ready') return result;
  const reasons = result.reasons;
  const sections = [];
  const reasonKeys = new Set();
  function refuse(code, node, field) {
    const path = node?.path;
    const key = JSON.stringify([code, path, field]);
    if (!reasonKeys.has(key)) {
      reasonKeys.add(key);
      reasons.push({ code, ...(path && { path }), ...(field && { field }) });
    }
  }

  function visit(node) {
    for (const feature of FEATURES) {
      if (node[feature] !== undefined && !(node.unit === 'section' && feature === 'role')) {
        refuse('unsupported-unit-feature', node, feature);
      }
    }
    if (WRAPPERS.has(node.unit)) {
      if (!node.children.length) return refuse('empty-structure', node);
      node.children.forEach(visit);
      return;
    }
    if (node.unit !== 'section' || !node.role) return refuse('requires-named-sections', node);
    const role = node.role.replaceAll('-', '_');
    if (!NATIVE_ROLES.has(role)) return refuse('unsupported-section-role', node, node.role);
    for (const child of node.children) {
      if (child.unit !== 'line' || child.children.length) return refuse('nested-division', child);
      for (const feature of FEATURES) {
        if (child[feature] !== undefined) refuse('unsupported-line-feature', child, feature);
      }
    }
    if (node.children.length && ['solo', 'interlude'].includes(role)) {
      return refuse('lines-on-wordless-role', node, role);
    }
    sections.push({ unit: 'section', role, lines: node.children.length || null });
  }
  plan.tree.forEach(visit);
  if (!sections.length && !reasons.length) refuse('empty-structure');
  // Native grid placement accepts a burden immediately after a verse.
  // Opening burdens remain valid catalog reading structures.
  if (sections.some((part, i) => part.role === 'burden' && sections[i - 1]?.role !== 'verse')) {
    refuse('native-burden-placement');
  }
  const fixedLengths = new Map();
  for (const { role, lines: count } of sections) {
    if (count === null) continue;
    if (fixedLengths.has(role) && fixedLengths.get(role) !== count) {
      refuse('inconsistent-recurring-section-length', null, role);
    }
    fixedLengths.set(role, count);
  }

  if (reasons.length) return { ...result, status: 'unsupported' };
  return {
    ...result,
    contract: {
      version: 1,
      scope: plan.scope,
      id: plan.id,
      variant: plan.variant,
      counts: { ...counts },
      sections,
      rhymeGroups: [],
      returnGroups: [],
    },
  };
}
