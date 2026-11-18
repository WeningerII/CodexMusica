// Ordered divisions describe the arrangement printed in a score. A speaker
// assignment is a declaration; acoustic identity cannot be inferred from text.
import { pindaricTriads } from './song-forms.mjs';

const roots = new Set(['song', 'poem']);
const groups = new Set([
  'play',
  'act',
  'scene',
  'exchange',
  'continuous-exchange',
  'join',
  'next-verse',
]);
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
// These roles describe score assignments, independent of vocal timbre or recording.
const vocalRoles = new Map([
  ['solo-verse', 'solo'],
  ['ensemble-reprise', 'reprise'],
  ['full-choir', 'full'],
  ['choral-stanza', 'ensemble'],
  ['cantor-verse', 'cantor'],
]);
const turns = new Set([
  'solo-call',
  'crew-reply',
  'lead-call',
  'group-response',
  'call',
  'response',
  'echo',
  'leader',
  'congregation',
]);
const turnGroups = new Set(['exchange', 'line-pair']);
const soundFields = ['rhyme', 'returns', 'endWord', 'syllables', 'stress', 'stresses', 'bars'];
const plain = (node) => soundFields.every((field) => node[field] === undefined);

function mark(node) {
  return { address: node.address, unit: node.unit, ...(node.role && { role: node.role }) };
}

// One printed line has one deliberately narrow score assignment. Lexical,
// refrain and sound obligations never disappear into a speaker label.
function turnPaths(children, fixedReturns, ancestry = []) {
  const paths = [];
  for (const child of children) {
    const path = [...ancestry, mark(child)];
    if (child.unit === 'line' && turns.has(child.role) && !child.children.length) {
      if (
        soundFields.some(
          (field) => child[field] !== undefined && !(field === 'returns' && fixedReturns)
        )
      )
        return null;
      paths.push(path);
    } else if (turnGroups.has(child.unit) && plain(child) && !child.role && child.children.length) {
      const nested = turnPaths(child.children, fixedReturns, path);
      if (!nested) return null;
      paths.push(...nested);
    } else return null;
  }
  return paths.length ? paths : null;
}

// Return a layout only if every node has a measurable interpretation below.
// In particular, multiple simultaneous voices cannot use sequential spans.
export function projectNestedDivisions(
  plan,
  nativeRoles,
  { fixedReturns = false, endingWords = null } = {}
) {
  const triads = pindaricTriads(plan);
  if (
    triads &&
    plan.scope === 'setting' &&
    plain(plan.tree[0]) &&
    !plan.tree[0].role &&
    triads.every(
      (triad) =>
        plain(triad) &&
        !triad.role &&
        triad.children.every((stanza) => plain(stanza) && !stanza.children.length)
    )
  ) {
    return triads.flatMap((triad) =>
      triad.children.map((stanza) => ({
        unit: 'section',
        role: 'verse',
        lines: null,
        divisionPath: [mark(plan.tree[0]), mark(triad), mark(stanza)],
      }))
    );
  }
  const rows = [];
  let distinct = false;
  function endWordLine(n) {
    return (
      endingWords &&
      n.unit === 'line' &&
      !n.children.length &&
      (!n.role || n.role === 'gathered-end-words') &&
      soundFields.every((field) => field === 'endWord' || n[field] === undefined)
    );
  }
  function walk(node, path, carrier) {
    if (!plain(node)) return false;
    const next = [...path, mark(node)];
    const assigned = turnPaths(node.children, fixedReturns);
    if (assigned && !node.role && ['cycle', 'exchange', 'line-pair'].includes(node.unit)) {
      distinct = true;
      rows.push({
        unit: 'section',
        role: 'verse',
        lines: assigned.length,
        divisionPath: next,
        linePaths: assigned,
      });
      return true;
    }
    if (roots.has(node.unit) || groups.has(node.unit) || node.unit === 'cycle') {
      if (groups.has(node.unit)) distinct = true;
      if (!node.role && node.unit === 'cycle' && node.children.length === 2) {
        const [stanza, refrain] = node.children;
        if (
          ['stanza', 'metrical-stanza'].includes(stanza.unit) &&
          !stanza.role &&
          !stanza.children.length &&
          refrain.unit === 'section' &&
          refrain.role === 'refrain'
        ) {
          distinct = true;
          return walk(stanza, next, 'verse') && walk(refrain, next);
        }
      }
      if (
        !node.role &&
        node.unit === 'poem' &&
        (node.children.at(-1)?.role === 'envoi' ||
          (endingWords && node.children.at(-1)?.role === 'gathered-end-words'))
      ) {
        const body = node.children.slice(0, -1);
        const envoi = node.children.at(-1);
        // The congedo must actually be shorter than the matched body stanzas.
        // The selected line counts are subsequently compared with the submitted spans.
        if (
          endWordLine(envoi) &&
          envoi.role === 'gathered-end-words' &&
          body.length &&
          body.every((n) => n.unit === 'stanza' && !n.role && n.children.length > 1)
        ) {
          if (!body.every((n) => walk(n, next))) return false;
          rows.push({
            unit: 'section',
            role: 'outro',
            lines: 1,
            divisionPath: [...next, mark(envoi)],
          });
          distinct = true;
          return true;
        }
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
    // A printed section may group multiple stanzas. Its address on each
    // constituent stanza records the boundary between successive sections.
    if (
      node.unit === 'section' &&
      !node.role &&
      node.children.length &&
      node.children.every((child) => child.unit === 'stanza')
    ) {
      distinct = true;
      return node.children.every((child) => walk(child, next));
    }
    const metrical =
      node.unit === 'metrical-stanza' && carrier === 'verse' && !node.role && !node.children.length;
    if (!containers.has(node.unit) && !metrical) return false;
    const refrain =
      node.unit === 'stanza' &&
      node.role === 'refrain' &&
      fixedReturns &&
      node.children.length > 0 &&
      node.children.every(
        (line) =>
          line.unit === 'line' &&
          !line.role &&
          !line.children.length &&
          line.returns !== undefined &&
          soundFields.every((field) => field === 'returns' || line[field] === undefined)
      );
    const native =
      refrain || (node.unit === 'section' && nativeRoles.has(node.role?.replaceAll('-', '_')));
    let vocalDuty =
      node.unit === 'section' && !node.children.length ? vocalRoles.get(node.role) : undefined;
    if (node.role && !native && !participants.has(node.role) && !carrier && !vocalDuty)
      return false;
    if (native && ['solo', 'interlude'].includes(node.role)) return false;
    if (node.unit === 'stanza' && !node.role && !node.children.length && !carrier) return false;
    if (!native && !['section', 'stanza'].includes(node.unit)) distinct = true;
    if (node.role && participants.has(node.role)) distinct = true;
    let count = null;
    if (node.children.length) {
      if (
        refrain ||
        node.children.every(
          (n) => endWordLine(n) || (n.unit === 'line' && plain(n) && !n.role && !n.children.length)
        )
      ) {
        count = node.children.length;
      } else if (assigned) {
        distinct = true;
        count = assigned.length;
      } else if (node.children.length === 1 && node.children[0].unit === 'voice') {
        const voice = node.children[0];
        if (!plain(voice) || voice.children.length) return false;
        if (node.role === 'verse' && voice.role === undefined) vocalDuty = 'distinct-solo';
        else if (!participants.has(voice.role)) return false;
        distinct = true;
        next.push(mark(voice));
      } else return false;
    }
    if (
      vocalDuty === 'reprise' &&
      (node !== plan.tree[0]?.children.at(-1) ||
        !rows.length ||
        rows.some((row) => row.vocalDuty !== 'solo'))
    )
      return false;
    if (vocalDuty) distinct = true;
    // Neutral musical verses carry divisions without equating a speaker or book with a verse.
    rows.push({
      unit: 'section',
      role:
        vocalDuty === 'reprise'
          ? 'outro'
          : native
            ? node.role.replaceAll('-', '_')
            : (carrier ?? 'verse'),
      lines: count,
      ...(vocalDuty && { vocalDuty }),
      divisionPath: next,
      ...(assigned && { linePaths: assigned }),
    });
    return true;
  }
  return plan.tree.every((n) => walk(n, [])) && distinct && rows.length ? rows : null;
}

function validParticipantIds(ids) {
  return (
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.every((id) => typeof id === 'string' && id.trim() === id && id.length > 0) &&
    new Set(ids).size === ids.length
  );
}

function pathAgreement(expected, path) {
  let agreement;
  if (Array.isArray(path)) {
    agreement = path.length === expected.length;
    if (agreement) {
      for (const [j, mark] of expected.entries()) {
        for (const key of Object.keys(mark)) {
          const supplied = path[j]?.[key];
          if (supplied !== undefined && supplied !== mark[key]) agreement = false;
          else if (supplied === undefined && agreement !== false) agreement = undefined;
        }
      }
    }
  } else if (path !== undefined) agreement = false;
  return agreement;
}

function recurringStanzaMeter(metrical, lines, sections) {
  const counts = [];
  const masks = [];
  let firstWidth;
  let missing = false;
  let incompatible = false;
  let uncertainStress = false;
  const positions = [];
  for (const i of metrical) {
    const span = sections?.[i]?.lineSpan;
    if (
      !lines ||
      !Array.isArray(span) ||
      span.length !== 2 ||
      !span.every(Number.isSafeInteger) ||
      span[0] < 0 ||
      span[1] <= span[0] ||
      span[1] > lines.length
    ) {
      missing = true;
      continue;
    }
    const width = span[1] - span[0];
    if (firstWidth !== undefined && firstWidth !== width) incompatible = true;
    firstWidth = width;
    for (let j = 0; j < width; j++) {
      const row = lines[span[0] + j];
      positions.push(span[0] + j + 1);
      if (typeof row?.text !== 'string' || !row.text.trim()) {
        missing = true;
        continue;
      }
      const mask = row.stress;
      const count = row.syllables ?? mask?.length;
      if (!Number.isSafeInteger(count) || count <= 0) missing = true;
      else if (counts[j] === undefined) counts[j] = count;
      else if (count !== counts[j]) incompatible = true;
      // Agreed stress is a sufficient witness for this regular setting.
      // A lexical substitution can still scan, so it is inconclusive.
      if (
        typeof mask !== 'string' ||
        !/^[./]+$/.test(mask) ||
        !mask.includes('/') ||
        mask.length !== count
      ) {
        uncertainStress = true;
      } else if (masks[j] === undefined) masks[j] = mask;
      else if (masks[j] !== mask) uncertainStress = true;
    }
  }
  return {
    kind: 'recurring-stanza-meter',
    basis: 'corresponding printed body lines and their agreed syllable and stress readings',
    lines: positions,
    outcome: incompatible
      ? 'fail'
      : missing || uncertainStress || metrical.length < 2
        ? 'unknown'
        : 'pass',
  };
}

export function gradeNestedDivisions(plan, rows, lines, sections, checks = []) {
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
  const soloists = new Set();
  let soloist;
  let scoreRoster;
  let scoreChoir;
  const soloSong = rows.at(-1)?.vocalDuty === 'reprise';
  for (const [i, expected] of rows.entries()) {
    const observed = sections?.[i];
    const path = observed?.divisionPath;
    const agreement = pathAgreement(expected.divisionPath, path);
    record('division-path', expected.divisionPath, agreement, agreement === true, i);
    record('section-role', expected.role, observed?.role, observed?.role === expected.role, i);
    if (expected.vocalDuty) {
      const duty = expected.vocalDuty;
      const roster = observed?.vocalRoster,
        members = observed?.performers;
      record('vocal-roster', 'distinct participant IDs', roster, validParticipantIds(roster), i);
      if (validParticipantIds(roster)) {
        scoreRoster ??= new Set(roster);
        record(
          'score-roster-membership',
          'one roster across sections',
          roster,
          roster.length === scoreRoster.size && roster.every((id) => scoreRoster.has(id)),
          i
        );
      }
      record(
        'vocal-assignment',
        duty,
        members,
        validParticipantIds(members) &&
          (['ensemble', 'full', 'reprise'].includes(duty)
            ? members.length >= 2
            : members.length === 1),
        i
      );
      if (validParticipantIds(roster) && validParticipantIds(members)) {
        record(
          'vocal-membership',
          duty === 'reprise' ? 'entire vocal roster' : 'vocal roster members',
          members,
          members.every((id) => roster.includes(id)) &&
            (duty !== 'reprise' || members.length === roster.length),
          i
        );
      }
      if (duty === 'full' || duty === 'ensemble') {
        const choir = observed?.choirRoster;
        record(
          'choir-roster',
          'declared choir members',
          choir,
          validParticipantIds(choir) && choir.length >= 2,
          i
        );
        if (validParticipantIds(choir)) {
          scoreChoir ??= new Set(choir);
          record(
            'choir-roster-membership',
            'one choir across sections',
            choir,
            choir.length === scoreChoir.size && choir.every((id) => scoreChoir.has(id)),
            i
          );
          if (validParticipantIds(roster)) {
            record(
              'choir-registration',
              'members of the vocal roster',
              choir,
              choir.every((id) => roster.includes(id)),
              i
            );
          }
          if (validParticipantIds(members)) {
            record(
              'choir-assignment',
              duty === 'full' ? 'entire choir' : 'choir members',
              members,
              members.every((id) => choir.includes(id)) &&
                (duty !== 'full' || members.length === choir.length),
              i
            );
          }
        }
      }
      if (validParticipantIds(members) && members.length === 1) {
        const [id] = members;
        if (duty === 'distinct-solo') {
          record('verse-owner', 'distinct from preceding verse owners', id, !soloists.has(id), i);
          soloists.add(id);
        } else if (duty === 'cantor' || (soloSong && duty === 'solo')) {
          soloist ??= id;
          record(
            duty === 'cantor' ? 'cantor-identity' : 'soloist-identity',
            soloist,
            id,
            id === soloist,
            i
          );
        }
      }
    }
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
    if (expected.vocalDuty === 'reprise' && valid) {
      const prior = sections?.[i - 1]?.lineSpan;
      if (
        Array.isArray(prior) &&
        prior.length === 2 &&
        prior[1] === span[0] &&
        prior.every(Number.isSafeInteger) &&
        prior[0] >= 0
      ) {
        const fits = width > 0 && width <= prior[1] - prior[0];
        record('reprise-width', 'suffix of preceding solo', width, fits, i);
        if (fits)
          for (let j = 0; j < width; j++) {
            const source = span[0] - width + j,
              copy = span[0] + j;
            const textAt = (n) => {
              const row = lines?.[n];
              const text = typeof row === 'string' ? row : row?.text;
              return typeof text === 'string' ? text.normalize('NFC').trim() : undefined;
            };
            const a = textAt(source),
              b = textAt(copy);
            record('reprise-line', true, a && b ? a === b : undefined, a === b, i);
            checks.at(-1).lines = [source + 1, copy + 1];
          }
      }
    }
    if (expected.linePaths) {
      for (const [offset, expectedPath] of expected.linePaths.entries()) {
        const index = valid && offset < width ? span[0] + offset : undefined;
        const found = index === undefined ? undefined : lines?.[index]?.divisionPath;
        const agreement = pathAgreement(expectedPath, found);
        record('line-turn', expectedPath, agreement, agreement === true, i);
        if (index !== undefined) checks.at(-1).lines = [index + 1];
      }
    }
    cursor = valid ? span[1] : undefined;
  }
  const triads = pindaricTriads(plan);
  if (triads) {
    const basis =
      'English line-aligned setting: corresponding printed lines, syllable counts and lexical stress';
    for (const [i] of triads.entries()) {
      const start = i * 3;
      const paired = recurringStanzaMeter([start, start + 1], lines, sections);
      checks.push({ ...paired, kind: 'english-strophe-antistrophe', basis });
      const epode = recurringStanzaMeter([start, start + 2], lines, sections);
      // A contradictory count establishes a different line profile. Stress
      // substitutions alone do not demonstrate a change of meter.
      const measured =
        epode.lines.length &&
        epode.lines.every((n) => {
          const row = lines?.[n - 1];
          return (
            typeof row?.text === 'string' &&
            row.text.trim() &&
            typeof row.stress === 'string' &&
            /^[./]+$/.test(row.stress) &&
            row.stress.includes('/') &&
            (row.syllables === undefined || row.syllables === row.stress.length)
          );
        });
      const outcome =
        !measured || epode.outcome === 'unknown'
          ? 'unknown'
          : epode.outcome === 'pass'
            ? 'fail'
            : 'pass';
      checks.push({ ...epode, kind: 'english-epode-contrast', basis, outcome });
    }
  }
  const metrical = rows.flatMap((row, i) =>
    row.divisionPath.at(-1)?.unit === 'metrical-stanza' ? [i] : []
  );
  if (metrical.length) checks.push(recurringStanzaMeter(metrical, lines, sections));
  const refrainParts = rows.flatMap((row, i) => (row.role === 'refrain' ? [i] : []));
  if (refrainParts.length > 1) {
    let complete = true,
      agrees = true,
      width;
    const printed = [];
    for (const i of refrainParts) {
      const span = sections?.[i]?.lineSpan;
      if (
        !lines ||
        !Array.isArray(span) ||
        span.length !== 2 ||
        !span.every(Number.isSafeInteger) ||
        span[0] < 0 ||
        span[1] <= span[0] ||
        span[1] > lines.length
      ) {
        complete = false;
        continue;
      }
      const length = span[1] - span[0];
      if (width !== undefined && width !== length) agrees = false;
      width = length;
      for (let j = 0; j < length; j++) {
        const line = lines[span[0] + j];
        const raw = typeof line === 'string' ? line : line?.text;
        const text = typeof raw === 'string' ? raw.normalize('NFC').trim() : '';
        if (!text) complete = false;
        else if (printed[j] === undefined) printed[j] = text;
        else if (printed[j] !== text) agrees = false;
      }
    }
    record('verbatim-refrain', true, !agrees || complete ? agrees : undefined, agrees);
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
    basis: triads
      ? 'declared English line-aligned stanza profiles'
      : 'declared score divisions and participant assignments',
    verdict,
    checks,
  };
}
