// Translate only obligations that the native seeded writer can enforce.
// The writer still judges placement, recurrence, envelope and seed feasibility.
import { refrainAddresses } from './song-form-line-roles.mjs';
import { projectNestedDivisions } from './song-form-divisions.mjs';
import { sectionArrangement } from './song-form-section-arrangement.mjs';
import { projectLineRequirement } from './song-form-line-requirements.mjs';

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
const LINE_DIVISIONS = new Set([
  'stanza',
  'couplet',
  'tercet',
  'quatrain',
  'quintain',
  'sestet',
  'septet',
  'octave',
  'distich',
  'line-pair',
  'rhyme-run',
]);
// These role names describe a particular measurable setting. They never
// license inference of subject matter, poetic cuts, or Japanese sound units.
export function measuredStanzaRole(role, lines) {
  const milwr = role === 'milwr';
  if (!milwr && role !== 'english-counted-setting') return undefined;
  const counts = milwr ? [7, 7, 7] : [5, 7, 5];
  if (lines.length !== counts.length) return false;
  let unknown = false;
  const keys = new Set();
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    const syllables = row?.syllables ?? row?.stress?.length;
    if (syllables === undefined) unknown = true;
    else if (syllables !== counts[i]) return false;
    if (milwr) {
      if (row?.rhyme === undefined) unknown = true;
      else keys.add(row.rhyme);
    }
  }
  if (keys.size > 1) return false;
  return unknown ? undefined : true;
}
const UNMEASURED_STANZA_ROLES = new Map([
  ['english-imagistic-cut', 'unmeasured-imagistic-cut'],
  ['human-observation', 'unmeasured-subject-matter'],
  ['english-short-lines', 'unspecified-short-line-length'],
  ['deibhidhe', 'unmeasured-bardic-correspondences'],
  ['rannaigheacht-mhor', 'unmeasured-bardic-correspondences'],
  ['seadna', 'unmeasured-bardic-correspondences'],
  ['ae-freislighe', 'unmeasured-bardic-closure'],
]);

export function isWordlessWriterRole(role) {
  return role === 'solo' || role === 'interlude';
}

export function isVerseDivision(unit) {
  return LINE_DIVISIONS.has(unit);
}

// Browser-side mirror of the native writer's corpus-derived envelope, checked
// against quality.plan in the catalog-wide tests.
export const CREATION_LIMITS = Object.freeze({
  minLines: 2,
  maxLines: 463,
  maxSections: 115,
});

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
  const roleArrangement = sectionArrangement(plan);
  const sections = [];
  const divisions = [];
  const lineRequirements = [];
  const byReturn = new Map();
  const byRhyme = new Map();
  for (const line of plan.lines) {
    if (line.returns !== undefined) {
      if (!byReturn.has(line.returns)) byReturn.set(line.returns, []);
      byReturn.get(line.returns).push(line.index);
    }
    if (line.rhyme === undefined) continue;
    if (!byRhyme.has(line.rhyme)) byRhyme.set(line.rhyme, []);
    byRhyme.get(line.rhyme).push(line.index);
  }
  const rhymeGroups = [...byRhyme.values()];
  const endsRhyme =
    plan.coverage.lines === 'complete' &&
    rhymeGroups.some((group) => group.length >= 2) &&
    plan.lines.every((line) => line.positionKnown && line.rhyme !== undefined);
  const returnGroups = [...byReturn.values()];
  const copies = new Set(returnGroups.flatMap((group) => group.slice(1)));
  const fixedReturns =
    endsRhyme &&
    returnGroups.length > 0 &&
    returnGroups.every(
      (group) =>
        group.length >= 2 &&
        rhymeGroups.some((rhymes) => group.every((line) => rhymes.includes(line)))
    ) &&
    rhymeGroups.every(
      (group) => group.length === 1 || group.filter((n) => !copies.has(n)).length >= 2
    );
  const refrains = fixedReturns ? refrainAddresses(plan.tree) : new Set();
  const positions = new Map(plan.lines.map((line) => [line.address, line]));
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
      if (node[feature] === undefined) continue;
      if (node.unit === 'section' && feature === 'role') continue;
      if (
        node.unit === 'stanza' &&
        feature === 'role' &&
        node.children.every((child) => child.unit === 'line') &&
        measuredStanzaRole(node.role, node.children) === true
      )
        continue;
      if (feature === 'bars' && (node.unit === 'section' || isVerseDivision(node.unit))) {
        if (!Number.isSafeInteger(node.bars) || node.bars < 1) refuse('invalid-section-bars', node);
        continue;
      }
      const specific =
        feature === 'role' && node.unit === 'stanza' && UNMEASURED_STANZA_ROLES.get(node.role);
      refuse(specific || 'unsupported-unit-feature', node, specific ? node.role : feature);
    }
    // The root can group neutral divisions. Each inner boundary remains a
    // native section boundary, and together they span the whole selection.
    if (
      plan.tree.length === 1 &&
      node === plan.tree[0] &&
      (isVerseDivision(node.unit) || node.unit === 'double-stanza') &&
      node.children.length > 0 &&
      node.children.every((child) => isVerseDivision(child.unit))
    ) {
      if (
        node.unit === 'double-stanza' &&
        (node.children.length !== 2 || node.children.some((child) => child.unit !== 'stanza'))
      ) {
        return refuse('invalid-double-stanza', node);
      }
      if (node.bars !== undefined) return refuse('unsupported-unit-feature', node, 'bars');
      node.children.forEach(visit);
      return;
    }
    const counted =
      isVerseDivision(node.unit) ||
      (['poem', 'song'].includes(node.unit) &&
        node.children.some((child) => child.unit === 'line'));
    if (WRAPPERS.has(node.unit) && !counted) {
      if (!node.children.length)
        return refuse(
          node.unit === 'song' && node !== plan.tree[0]
            ? 'independent-song-required'
            : 'empty-structure',
          node
        );
      node.children.forEach(visit);
      return;
    }
    if (!counted && (node.unit !== 'section' || !node.role)) {
      return refuse('unsupported-division', node);
    }
    if (counted && !node.children.length) return refuse('unspecified-division', node);
    const role = counted ? 'verse' : (roleArrangement?.role ?? node.role.replaceAll('-', '_'));
    if (!NATIVE_ROLES.has(role)) {
      const moraPhrases =
        node.children.length &&
        node.children.every(
          (phrase) =>
            phrase.unit === 'phrase' &&
            phrase.children.length &&
            phrase.children.every((child) => child.unit === 'mora')
        );
      return refuse(
        moraPhrases ? 'unmeasured-mora-count' : 'unsupported-section-role',
        node,
        node.role
      );
    }
    for (const child of node.children) {
      const requirement = projectLineRequirement(
        child,
        endsRhyme,
        fixedReturns || roleArrangement?.repeatText,
        refrains.has(child.address)
      );
      if (requirement === null) {
        refuse('unsupported-line-structure', child);
      } else if (requirement) {
        const position = positions.get(child.address);
        if (position?.positionKnown)
          lineRequirements.push({ line: position.index, ...requirement });
        else refuse('unknown-line-position', child);
      }
    }
    if (node.children.length && isWordlessWriterRole(role)) {
      return refuse('lines-on-wordless-role', node, role);
    }
    if (counted) divisions.push({ unit: node.unit, lines: node.children.length });
    sections.push({
      unit: 'section',
      role,
      lines: node.children.length || null,
      ...(roleArrangement && { sourceRole: node.role }),
      ...(node.bars !== undefined && { bars: node.bars }),
    });
  }
  plan.tree.forEach(visit);
  // These arrangements preserve the full sequence of named divisions on the
  // score, including the participants in independently declared turns.
  let nestedDivisions = false;
  if (reasons.length) {
    const layout = projectNestedDivisions(plan, NATIVE_ROLES);
    if (layout) {
      sections.splice(0, sections.length, ...layout);
      reasons.length = divisions.length = lineRequirements.length = 0;
      nestedDivisions = true;
    }
  }
  if (!sections.length && !reasons.length) refuse('empty-structure');
  if (
    endsRhyme &&
    (sections.some((part) => part.lines === null) ||
      (sections.length > 1 && sections.some((part) => part.role !== 'verse')) ||
      sections.reduce((total, part) => total + part.lines, 0) !== plan.lines.length)
  )
    refuse('unsupported-rhyme-layout');
  if (fixedReturns) {
    const measures = new Map(
      lineRequirements.map(({ line, ...rest }) => [line, JSON.stringify(rest)])
    );
    if (
      sections[0]?.role !== 'verse' ||
      returnGroups.some((group) =>
        group.some((line) => measures.get(line) !== measures.get(group[0]))
      )
    )
      refuse('unsupported-return-layout');
  }
  if (sections.length > CREATION_LIMITS.maxSections) refuse('native-section-limit');
  if (lineRequirements.length && sections.some((part) => part.lines === null)) {
    refuse('incomplete-line-positions');
  }
  if (nestedDivisions) {
    const known = sections.reduce((n, part) => n + (part.lines ?? 1), 0);
    if (known > CREATION_LIMITS.maxLines) refuse('native-line-limit');
    if (sections.every((part) => part.lines === 1)) refuse('no-inspectable-native-pair');
  }
  if (divisions.length) {
    if (sections.length !== divisions.length) refuse('mixed-declared-and-arranged-roles');
    const total = plan.lines.length;
    if (plan.coverage.lines !== 'complete' || !plan.lines.every((line) => line.positionKnown)) {
      refuse('incomplete-line-positions');
    }
    if (total < CREATION_LIMITS.minLines || total > CREATION_LIMITS.maxLines) {
      refuse('native-line-limit');
    }
    if (divisions.every((part) => part.lines < 2)) refuse('no-inspectable-native-pair');
  }
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

  // The native grid uses one whole number of bars per sung line. Check known
  // contradictions here; feasible allocations for open lengths belong to the planner.
  let barsPerLine;
  const barsByRole = new Map();
  for (const part of sections) {
    if (part.bars === undefined) continue;
    if (barsByRole.has(part.role) && barsByRole.get(part.role) !== part.bars) {
      refuse('inconsistent-recurring-section-bars', null, part.role);
    }
    barsByRole.set(part.role, part.bars);
    const count = fixedLengths.get(part.role);
    if (count === undefined) continue;
    const ratio = part.bars / count;
    if (!Number.isInteger(ratio) || (barsPerLine !== undefined && ratio !== barsPerLine)) {
      refuse('incompatible-bars-per-line');
    }
    barsPerLine = ratio;
  }
  if (
    barsPerLine !== undefined &&
    [...barsByRole.values()].some((bars) => bars % barsPerLine !== 0)
  ) {
    refuse('incompatible-bars-per-line');
  }

  if (reasons.length) return { ...result, status: 'unsupported' };
  return {
    ...result,
    ...(nestedDivisions && { nestedDivisions: true }),
    ...(divisions.length && { arrangement: { role: 'verse', divisions } }),
    contract: {
      version: 1,
      scope: plan.scope,
      id: plan.id,
      variant: plan.variant,
      counts: { ...counts },
      ...(lineRequirements.length && { lineRequirements }),
      sections,
      rhymeGroups: endsRhyme ? rhymeGroups : [],
      returnGroups: fixedReturns || roleArrangement?.repeatText ? returnGroups : [],
    },
  };
}
