// Ordered divisions describe the arrangement printed in a score. A speaker
// assignment is a declaration; acoustic identity cannot be inferred from text.
const roots = new Set(['song', 'poem']);
const groups = new Set(['play', 'act', 'scene', 'exchange', 'continuous-exchange', 'join']);
const containers = new Set(['speech', 'chapter', 'canto', 'book', 'stanza', 'section']);
const participants = new Set([
  'first-speaker',
  'second-speaker',
  'sole-speaker',
  'first-singer',
  'second-singer',
  'first-turn',
  'answering-turn',
  'call',
  'response',
]);
const soundFields = ['rhyme', 'returns', 'endWord', 'syllables', 'stress', 'stresses', 'bars'];
const plain = (node) => soundFields.every((field) => node[field] === undefined);

function mark(node) {
  return { address: node.address, unit: node.unit, ...(node.role && { role: node.role }) };
}

// Return a layout only if every node has a measurable interpretation below.
// In particular, multiple simultaneous voices cannot use sequential spans.
export function projectNestedDivisions(plan, nativeRoles) {
  const rows = [];
  let distinct = false;
  function walk(node, path, carrier) {
    if (!plain(node)) return false;
    const next = [...path, mark(node)];
    if (roots.has(node.unit) || groups.has(node.unit) || node.unit === 'cycle') {
      if (groups.has(node.unit)) distinct = true;
      if (!node.role && node.unit === 'cycle' && node.children.length === 2) {
        const [stanza, refrain] = node.children;
        if (
          stanza.unit === 'stanza' &&
          !stanza.role &&
          !stanza.children.length &&
          refrain.unit === 'section' &&
          refrain.role === 'refrain'
        ) {
          distinct = true;
          return walk(stanza, next, 'verse') && walk(refrain, next);
        }
      }
      if (!node.role && node.unit === 'poem' && node.children.at(-1)?.role === 'envoi') {
        const body = node.children.slice(0, -1);
        const envoi = node.children.at(-1);
        // The congedo must actually be shorter than the matched body stanzas.
        // The selected line counts are subsequently compared with the submitted spans.
        if (
          envoi.unit === 'stanza' &&
          envoi.children.length > 0 &&
          body.length &&
          body.every(
            (n) =>
              n.unit === 'stanza' &&
              !n.role &&
              n.children.length === body[0].children.length &&
              n.children.length > envoi.children.length
          )
        ) {
          distinct = true;
          return body.every((n) => walk(n, next)) && walk(envoi, next, 'outro');
        }
      }
      return !node.role && node.children.length > 0 && node.children.every((n) => walk(n, next));
    }
    if (!containers.has(node.unit)) return false;
    const native = node.unit === 'section' && nativeRoles.has(node.role?.replaceAll('-', '_'));
    if (node.role && !native && !participants.has(node.role) && !carrier) return false;
    if (native && ['solo', 'interlude'].includes(node.role)) return false;
    if (node.unit === 'stanza' && !node.role && !node.children.length && !carrier) return false;
    if (!native && !['section', 'stanza'].includes(node.unit)) distinct = true;
    if (node.role && participants.has(node.role)) distinct = true;
    let count = null;
    if (node.children.length) {
      if (
        node.children.every((n) => n.unit === 'line' && plain(n) && !n.role && !n.children.length)
      ) {
        count = node.children.length;
      } else if (node.children.length === 1 && node.children[0].unit === 'voice') {
        const voice = node.children[0];
        if (!plain(voice) || !participants.has(voice.role) || voice.children.length) return false;
        distinct = true;
        next.push(mark(voice));
      } else return false;
    }
    // Neutral musical verses carry divisions without equating a speaker or book with a verse.
    rows.push({
      unit: 'section',
      role: native ? node.role.replaceAll('-', '_') : (carrier ?? 'verse'),
      lines: count,
      divisionPath: next,
    });
    return true;
  }
  return plan.tree.every((n) => walk(n, [])) && distinct && rows.length ? rows : null;
}

export function gradeNestedDivisions(plan, rows, lines, sections) {
  const checks = [];
  function record(kind, expected, actual, compare, index) {
    checks.push({
      kind,
      ...(index === undefined ? {} : { section: index + 1 }),
      expected,
      ...(actual === undefined ? {} : { actual }),
      outcome: actual === undefined ? 'unknown' : compare ? 'pass' : 'fail',
    });
  }
  record('division-count', rows.length, sections?.length, rows.length === sections?.length);
  let cursor = 0;
  for (const [i, expected] of rows.entries()) {
    const observed = sections?.[i];
    const path = observed?.divisionPath;
    let agreement;
    if (Array.isArray(path)) {
      agreement = path.length === expected.divisionPath.length;
      if (agreement) {
        for (const [j, mark] of expected.divisionPath.entries()) {
          for (const key of Object.keys(mark)) {
            const supplied = path[j]?.[key];
            if (supplied !== undefined && supplied !== mark[key]) agreement = false;
            else if (supplied === undefined && agreement !== false) agreement = undefined;
          }
        }
      }
    } else if (path !== undefined) agreement = false;
    record('division-path', expected.divisionPath, agreement, agreement === true, i);
    record('section-role', expected.role, observed?.role, observed?.role === expected.role, i);
    const span = observed?.lineSpan;
    const valid =
      Array.isArray(span) &&
      span.length === 2 &&
      span.every(Number.isSafeInteger) &&
      span[0] >= 0 &&
      span[1] >= span[0] &&
      (cursor === undefined || span[0] === cursor) &&
      (lines === undefined || span[1] <= lines.length);
    record('ordered-division-span', 'contiguous', span, valid, i);
    const width = valid ? span[1] - span[0] : undefined;
    record(
      'division-lines',
      expected.lines ?? 'at least one',
      width,
      expected.lines === null ? width >= 1 : width === expected.lines,
      i
    );
    cursor = valid ? span[1] : undefined;
  }
  record(
    'division-coverage',
    lines?.length,
    cursor,
    lines === undefined ? false : cursor === lines.length
  );
  if (lines === undefined) checks.at(-1).outcome = 'unknown';
  const verdict = checks.some((c) => c.outcome === 'fail')
    ? 'fail'
    : checks.every((c) => c.outcome === 'pass')
      ? 'pass'
      : 'unknown';
  return {
    id: plan.id,
    variant: plan.variant,
    scope: plan.scope,
    basis: 'declared score divisions and participant assignments',
    verdict,
    checks,
  };
}
