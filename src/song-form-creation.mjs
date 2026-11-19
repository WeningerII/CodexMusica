// Translate only obligations that the native seeded writer can enforce.
// The writer still judges placement, recurrence, envelope and seed feasibility.
import { refrainAddresses, relativeLinePairs } from './song-form-line-roles.mjs';
import { endingWordDeclaration, printedPhraseSetting } from './song-form-mandate.mjs';
import { withFunctionCriteria } from './song-form-function-readings.mjs';
import { projectNestedDivisions } from './song-form-divisions.mjs';
import { printedSteps } from './song-form-printing.mjs';
import { sectionMelodyGroup, sectionMelodyLayout } from './song-form-section-melody.mjs';
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
  'closing-group',
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

// A descent here is a sequence of explicitly shorter measured lines. It has
// no separate musical section. Unknown or decorated groupings retain their
// original shape so the ordinary visitor can reject any unmeasured obligation.
export function isCountedDescent(node) {
  return (
    node.unit === 'descent' &&
    FEATURES.every((key) => node[key] === undefined) &&
    node.children.length >= 2 &&
    node.children.every(
      (line, index, rows) =>
        line.unit === 'line' &&
        Number.isSafeInteger(line.syllables) &&
        line.syllables > 0 &&
        (!index || line.syllables < rows[index - 1].syllables)
    )
  );
}

export function linesOfDivision(node) {
  return node.children.flatMap((child) => (isCountedDescent(child) ? child.children : [child]));
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
  const steps = printedSteps(plan);
  if (steps) {
    const rows = steps.reduce((total, count) => total + count, 0);
    if (rows > CREATION_LIMITS.maxLines)
      return { ...result, status: 'unsupported', reasons: [{ code: 'native-line-limit' }] };
    return {
      ...result,
      contract: {
        version: 1,
        id: plan.id,
        scope: plan.scope,
        variant: plan.variant,
        counts: { ...counts },
        printedSteps: steps,
        sections: [{ unit: 'section', role: 'verse', lines: rows }],
        rhymeGroups: [],
        returnGroups: [],
      },
    };
  }
  const printed = printedPhraseSetting(plan);
  if (printed) {
    const out = projectSongFormCreation(printed.plan);
    if (out.contract)
      Object.assign(out.contract, {
        variant: plan.variant,
        counts: { ...counts },
        phraseLines: true,
      });
    return { ...out, variant: plan.variant };
  }
  const reasons = result.reasons;
  const roleArrangement = sectionArrangement(plan);
  // The alternate letter diagram for verse/chorus/bridge does not specify
  // which letters carry those sung functions. Preserve its writing refusal.
  const melodic = sectionMelodyLayout(plan) && plan.id !== 'verse-chorus-bridge';
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
    plan.coverage.lines === 'complete' &&
    plan.lines.every((line) => line.positionKnown) &&
    returnGroups.length > 0 &&
    returnGroups.every(
      (group) =>
        group.length >= 2 &&
        (!rhymeGroups.length ||
          (endsRhyme && rhymeGroups.some((rhymes) => group.every((line) => rhymes.includes(line)))))
    ) &&
    rhymeGroups.every(
      (group) => group.length === 1 || group.filter((n) => !copies.has(n)).length >= 2
    );
  const refrains = fixedReturns ? refrainAddresses(plan.tree) : new Set();
  const lengthPairs = relativeLinePairs(plan);
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

  function visit(node, isStanzaPart = false) {
    for (const feature of FEATURES) {
      if (node[feature] === undefined || (isStanzaPart && node.unit === 'line')) continue;
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
    // A sequence of stanzas keeps each printed division and can close with
    // a single, separately positioned line referring back to a prior rhyme.
    if (
      node === plan.tree[0] &&
      plan.tree.length === 1 &&
      ['verse-sequence', 'stanza-group'].includes(node.unit) &&
      node.children.length &&
      node.children.every(
        (child, i) =>
          isVerseDivision(child.unit) ||
          (node.unit === 'verse-sequence' &&
            i > 0 &&
            i === node.children.length - 1 &&
            child.unit === 'line')
      )
    ) {
      if (node.bars !== undefined) return refuse('unsupported-unit-feature', node, 'bars');
      for (const child of node.children) visit(child, child.unit === 'line');
      return;
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
      for (const child of node.children) visit(child);
      return;
    }
    // A final single-line echo can occupy its own neutral writing section.
    // Retain both the stanza boundary and the exact return positions.
    if (
      fixedReturns &&
      node === plan.tree[0] &&
      plan.tree.length === 1 &&
      WRAPPERS.has(node.unit) &&
      node.children.length === 2 &&
      node.children[0].unit === 'stanza' &&
      node.children[1].unit === 'line' &&
      node.children[1].returns !== undefined &&
      node.children[0].children.at(-1)?.returns === node.children[1].returns
    ) {
      visit(node.children[0]);
      visit(node.children[1], true);
      return;
    }
    // A stanza can be divided into anonymous sections. Their separate observed
    // spans and shared rhyme classes already use native verse coordinates.
    if (
      node.unit === 'stanza' &&
      !FEATURES.some((key) => node[key] !== undefined) &&
      node.span.lines[0] === 0 &&
      node.span.lines[1] === plan.lines.length &&
      node.children.length &&
      node.children.every(
        (child) =>
          child.unit === 'section' &&
          child.role === undefined &&
          child.children.length &&
          child.children.every((part) => part.unit === 'line')
      )
    ) {
      for (const child of node.children) visit(child, true);
      return;
    }
    const counted =
      isStanzaPart ||
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
      for (const child of node.children) visit(child);
      return;
    }
    // A transition or division path locates a component in the score. It
    // cannot identify a selection's source or supply a movement's own form.
    if (!node.children.length && node.unit === 'movement')
      return refuse('independent-movement-form-required', node);
    if (!node.children.length && node.unit === 'selection')
      return refuse('source-song-identity-required', node);
    if (!counted && (node.unit !== 'section' || !node.role)) {
      return refuse('unsupported-division', node);
    }
    if (counted && !node.children.length && node.unit !== 'line')
      return refuse('unspecified-division', node);
    const melodyGroup = melodic && sectionMelodyGroup(node.role);
    const role =
      counted || melodyGroup ? 'verse' : (roleArrangement?.role ?? node.role.replaceAll('-', '_'));
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
    const lineNodes =
      node.unit === 'line' ? [node] : counted ? linesOfDivision(node) : node.children;
    for (const child of lineNodes) {
      // A binding on the terminal word must leave one further word free in
      // the native writing plan (WORDS_LEFT_FREE). One syllable cannot hold both.
      if (child.unit === 'line' && child.syllables === 1 && byRhyme.get(child.rhyme)?.length >= 2)
        refuse('native-free-word-reserve', child, 'rhyme');
      const requirement = projectLineRequirement(
        child,
        endsRhyme,
        fixedReturns || roleArrangement?.repeatText,
        refrains.has(child.address),
        lengthPairs.get(child.address)
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
    if (counted) divisions.push({ unit: node.unit, lines: lineNodes.length });
    sections.push({
      unit: 'section',
      role,
      lines: lineNodes.length || null,
      ...(roleArrangement && { sourceRole: node.role }),
      ...(melodyGroup && { sourceRole: node.role, melodyGroup }),
      ...(node.bars !== undefined && { bars: node.bars }),
    });
  }
  // A line template can be applied to each line of a chosen verse without
  // inventing a fixed stanza length or requiring one rhyme across lines.
  const [root] = plan.tree;
  const [left, pause, right] = root?.children ?? [];
  const caesuralRhyme =
    plan.tree.length === 1 &&
    root.unit === 'verse-line' &&
    root.children.length === 3 &&
    left.unit === 'half-line' &&
    right.unit === 'half-line' &&
    pause.unit === 'caesura' &&
    left.rhyme !== undefined &&
    left.rhyme === right.rhyme &&
    [root, left, pause, right].every((n) =>
      FEATURES.every(
        (key) => n[key] === undefined || (key === 'rhyme' && (n === left || n === right))
      )
    ) &&
    root.children.every((n) => !n.children.length);
  if (caesuralRhyme) sections.push({ unit: 'section', role: 'verse', lines: null });
  else for (const node of plan.tree) visit(node);
  // These arrangements preserve the full sequence of named divisions on the
  // score, including the participants in independently declared turns.
  let nestedDivisions = false;
  const endingWords = endingWordDeclaration(plan);
  if (reasons.length) {
    const layout = withFunctionCriteria(
      plan.id,
      projectNestedDivisions(plan, NATIVE_ROLES, { fixedReturns, endingWords })
    );
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
  if (fixedReturns && !rhymeGroups.length) {
    let offset = 0;
    const inspectable = sections.some((part) => {
      const start = offset;
      offset += part.lines ?? 0;
      return (
        Array.from({ length: part.lines || 0 }, (_, i) => start + i + 1).filter(
          (line) => !copies.has(line)
        ).length >= 2
      );
    });
    if (!inspectable) refuse('no-inspectable-native-pair');
  }
  if (fixedReturns) {
    const measures = new Map(
      lineRequirements.map(({ line, ...rest }) => [line, JSON.stringify(rest)])
    );
    if (
      (endsRhyme && sections[0]?.role !== 'verse') ||
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
  // A catalog setting may explicitly print its alternating verse/burden cycle
  // with a leading burden. Other placements retain the native rule.
  const printedBurden =
    plan.scope === 'setting' &&
    sections.length >= 5 &&
    sections.length % 2 === 1 &&
    sections.every((part, i) => part.role === (i % 2 ? 'verse' : 'burden'));
  if (
    sections.some(
      (part, i) =>
        part.role === 'burden' && sections[i - 1]?.role !== 'verse' && !(i === 0 && printedBurden)
    )
  ) {
    refuse('native-burden-placement');
  }
  const variableVerses = sections.every(
    (section) => section.role === 'verse' && section.lines !== null && section.bars === undefined
  );
  const fixedLengths = new Map();
  for (const { role, lines: count } of sections) {
    if (count === null) continue;
    if (!variableVerses && fixedLengths.has(role) && fixedLengths.get(role) !== count) {
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
      ...(caesuralRhyme && { lineProfile: 'caesural-rhyme' }),
      ...(lineRequirements.length && { lineRequirements }),
      ...(nestedDivisions && endingWords && { endingWords }),
      sections,
      rhymeGroups: endsRhyme ? rhymeGroups : [],
      returnGroups: fixedReturns || roleArrangement?.repeatText ? returnGroups : [],
    },
  };
}
