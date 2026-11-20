// Connect the declared catalog pattern to the sung-line coordinates of the reader.
import { randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { checkReaderForm, describeForm, pindaricTriads, realizeForm } from '../src/song-forms.mjs';
import {
  CREATION_LIMITS,
  openCoupletEnding,
  projectSongFormCreation,
} from '../src/song-form-creation.mjs';
import { gradeObservations } from '../src/song-form-grade.mjs';
import { printedSteps, paragraphCount } from '../src/song-form-printing.mjs';
import { formMandate } from '../src/song-form-mandate.mjs';

import { usesFunctionReadings } from '../src/song-form-function-readings.mjs';

let catalog;
async function formCatalog() {
  return (catalog ??= JSON.parse(
    await readFile(new URL('../data/song-forms.json', import.meta.url), 'utf8')
  ));
}

function shuffled(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// THE AUTOMATIC DRAW'S SETTINGS (#902).
// Each count path of a variant takes its own value. A variant offers:
//   - the lockstep vectors: every path at min, at min+1, at min+2;
//   - each path stepped alone from the anchor, the others held there: at
//     each SPREAD offset above its min, at its cap, and at its highest ready
//     value (found by bisection below the first refused one).
// The anchor is the first lockstep vector that is ready. If none is, it is
// the first ready vector one path's SPREAD reaches from the all-min vector.
// A path's cap is the smallest of its max, min + CEILING, and the largest
// value whose realization holds at most maxLines lines and maxSections
// sections. A setting is kept only if it projects ready, inside
// CREATION_LIMITS, with no textual-function section.
// Bound: a variant of k paths keeps at most 3 + 12k settings and realizes at
// most 3 + 29k vectors. A stated length adds at most one setting (the length
// search below).
const SPREAD = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256];
const LENGTH_SEARCH = { counted: 4096, projected: 24 };
// No path goes more than this far above its min.
const CEILING = CREATION_LIMITS.maxLines;
const reach = ({ min, max }) => Math.min(max ?? Infinity, min + CEILING);

function repeats(node, path, counts) {
  if (Object.hasOwn(counts, path)) return counts[path];
  return node.times === undefined ? 1 : Array.isArray(node.times) ? node.times[0] : node.times;
}

// The lines and sections a realization of these counts holds, counted on the
// pattern without realizing it.
function extent(node, counts, path = '1') {
  const copies = repeats(node, path, counts);
  const one = { lines: node.unit === 'line' ? 1 : 0, sections: node.unit === 'section' ? 1 : 0 };
  if (copies && node.unit !== 'line')
    node.children?.forEach((child, i) => {
      const inner = extent(child, counts, `${path}.${i + 1}`);
      one.lines += inner.lines;
      one.sections += inner.sections;
    });
  return { lines: copies * one.lines, sections: copies * one.sections };
}

function withinExtent({ lines, sections }) {
  return lines <= CREATION_LIMITS.maxLines && sections <= CREATION_LIMITS.maxSections;
}

function knownLines(contract) {
  return contract.sections.reduce((sum, section) => sum + (section.lines ?? 0), 0);
}

function openLength(contract) {
  return contract.sections.some((section) => section.lines === null);
}

function withinLimits(contract) {
  const known = knownLines(contract);
  return (
    contract.sections.length <= CREATION_LIMITS.maxSections &&
    known <= CREATION_LIMITS.maxLines &&
    (openLength(contract) || known >= CREATION_LIMITS.minLines)
  );
}

function variantSettings(forms, id, root, { index, counts: paths }) {
  const projected = new Map();
  const kept = new Map();
  function project(selected) {
    const key = JSON.stringify(selected);
    if (!projected.has(key)) {
      let contract = null;
      if (withinExtent(extent(root, selected))) {
        try {
          const realization = realizeForm(forms, id, { variant: index, counts: selected });
          const result = projectSongFormCreation(realization, selected);
          if (
            result.status === 'ready' &&
            result.contract &&
            !result.contract.sections.some((section) => section.textualFunction) &&
            withinLimits(result.contract)
          )
            contract = result.contract;
        } catch (error) {
          if (!(error instanceof RangeError)) throw error;
        }
      }
      projected.set(key, contract);
    }
    return projected.get(key);
  }
  function keep(selected) {
    const contract = project(selected);
    if (contract) kept.set(JSON.stringify(selected), contract);
    return contract;
  }
  const lockstep = [0, 1, 2].map((offset) =>
    Object.fromEntries(
      paths.map((bound) => [bound.path, Math.min(bound.min + offset, reach(bound))])
    )
  );
  let anchor = lockstep.find(keep);
  lockstep.forEach(keep);
  anchor ??=
    paths
      .flatMap((bound) =>
        SPREAD.filter((offset) => bound.min + offset <= reach(bound)).map((offset) => ({
          ...lockstep[0],
          [bound.path]: bound.min + offset,
        }))
      )
      .find(project) ?? lockstep[0];
  const at = (path, value) => ({ ...anchor, [path]: value });
  for (const bound of paths) {
    const { path, min } = bound;
    let cap = reach(bound);
    if (!withinExtent(extent(root, at(path, cap)))) {
      let low = min;
      while (cap - low > 1) {
        const mid = Math.floor((low + cap) / 2);
        if (withinExtent(extent(root, at(path, mid)))) low = mid;
        else cap = mid;
      }
      cap = low;
    }
    const tried = [...new Set([...SPREAD.map((offset) => min + offset), cap])]
      .filter((value) => value <= cap)
      .sort((a, b) => a - b);
    let top = tried.filter((value) => keep(at(path, value))).at(-1);
    let refused = tried.find((value) => value > top);
    if (top === undefined || refused === undefined) continue;
    while (refused - top > 1) {
      const mid = Math.floor((top + refused) / 2);
      if (project(at(path, mid))) top = mid;
      else refused = mid;
    }
    keep(at(path, top));
  }
  return {
    id,
    variant: index,
    root,
    paths,
    project,
    settings: [...kept.values()],
    fits: new Map(),
  };
}

// The length model: a setting's known total as a function of one measure of
// its counts. The measure is the realization's line count, or one path's
// count. The model is the identity on line count when every kept setting
// fits it, else the first affine fit that every kept setting satisfies.
// Null when the kept settings fix none.
function lengthModel({ root, paths, settings }) {
  const fixed = settings
    .filter((contract) => !openLength(contract))
    .map((contract) => ({
      counts: contract.counts,
      size: extent(root, contract.counts),
      known: knownLines(contract),
    }));
  const lineCount = (counts, size) => size.lines;
  if (!fixed.length) return null;
  if (fixed.every(({ size, known }) => size.lines === known))
    return { measure: lineCount, r0: 0, k0: 0, dr: 1, dk: 1 };
  for (const measure of [
    lineCount,
    ...paths.map(
      ({ path }) =>
        (counts) =>
          counts[path]
    ),
  ]) {
    const points = fixed.map(({ counts, size, known }) => [measure(counts, size), known]);
    const [r0, k0] = points[0];
    const other = points.find(([value]) => value !== r0);
    if (!other) continue;
    const sign = other[0] > r0 ? 1 : -1;
    const [dr, dk] = [sign * (other[0] - r0), sign * (other[1] - k0)];
    if (dk > 0 && points.every(([value, known]) => (known - k0) * dr === dk * (value - r0)))
      return { measure, r0, k0, dr, dk };
  }
  return null;
}

// THE LENGTH SEARCH finds the first count vector inside the caps whose known
// total is `lines`. Paths go in catalog order from their min. The measure
// only grows with a count, so a subtree is skipped when its lowest vector is
// past the target or its highest falls short. On the last path, each value
// at the target is projected, lowest first. LENGTH_SEARCH bounds the work.
// Outcomes:
//   open        every kept setting leaves a length open; the filter decides.
//   kept        a kept setting already has this total.
//   found       the search adds the setting it found.
//   infeasible  no vector the model admits is ready at this total.
//   exhausted   the budget ran out first; the search says nothing.
//   unmodeled   no length model, so no search.
function fitLength(variant, lines) {
  if (!variant.fits.has(lines)) variant.fits.set(lines, searchLength(variant, lines));
  return variant.fits.get(lines);
}

function searchLength(variant, lines) {
  const fixed = variant.settings.filter((contract) => !openLength(contract));
  if (!fixed.length) return { outcome: 'open' };
  if (fixed.some((contract) => knownLines(contract) === lines)) return { outcome: 'kept' };
  variant.model ??= lengthModel(variant) ?? false;
  const { model, root, paths } = variant;
  if (!model) return { outcome: 'unmodeled' };
  const budget = { ...LENGTH_SEARCH };
  const work = () => ({
    counted: LENGTH_SEARCH.counted - budget.counted,
    projected: LENGTH_SEARCH.projected - budget.projected,
  });
  if (((lines - model.k0) * model.dr) % model.dk) return { outcome: 'infeasible', ...work() };
  const target = model.r0 + ((lines - model.k0) * model.dr) / model.dk;
  const spent = () => budget.counted <= 0 || budget.projected <= 0;
  const bottom = Object.fromEntries(paths.map(({ path, min }) => [path, min]));
  const top = Object.fromEntries(paths.map((bound) => [bound.path, reach(bound)]));
  const measured = (selected) => {
    budget.counted--;
    const size = extent(root, selected);
    return withinExtent(size) ? model.measure(selected, size) : Infinity;
  };
  function search(i, selected) {
    if (spent()) return null;
    if (measured({ ...bottom, ...selected }) > target) return null;
    if (measured({ ...top, ...selected }) < target) return null;
    const { path, min } = paths[i];
    const high = reach(paths[i]);
    if (i < paths.length - 1) {
      for (let value = min; value <= high; value++) {
        if (measured({ ...bottom, ...selected, [path]: value }) > target) break;
        const found = search(i + 1, { ...selected, [path]: value });
        if (found || spent()) return found;
      }
      return null;
    }
    let [low, up] = [min, high];
    while (low < up) {
      const mid = Math.floor((low + up) / 2);
      if (measured({ ...selected, [path]: mid }) >= target) up = mid;
      else low = mid + 1;
    }
    for (let value = low; value <= high && !spent(); value++) {
      const vector = { ...selected, [path]: value };
      if (measured(vector) !== target) break;
      budget.projected--;
      const contract = variant.project(vector);
      if (contract && !openLength(contract) && knownLines(contract) === lines) return contract;
    }
    return null;
  }
  const contract = search(0, {});
  if (contract) return { outcome: 'found', contract, ...work() };
  return { outcome: spent() ? 'exhausted' : 'infeasible', ...work() };
}

let automaticForms;
async function automaticTable() {
  const forms = await formCatalog();
  automaticForms ??= forms.map(({ id }) => {
    const { patterns, variants } = describeForm(forms, id);
    return variants.map((variant) => variantSettings(forms, id, patterns[variant.index], variant));
  });
  return automaticForms;
}

export async function automaticFormCandidates({ lines }) {
  const table = await automaticTable();
  // Each form gets one place in the draw, however many variants or settings
  // it has.
  return shuffled(table).flatMap((variants) =>
    shuffled(variants).flatMap((variant) => {
      const fitted = lines == null || !variant.paths.length ? null : fitLength(variant, lines);
      return shuffled(
        [...variant.settings, ...(fitted?.contract ? [fitted.contract] : [])].filter((contract) => {
          if (lines == null) return true;
          const known = knownLines(contract);
          return openLength(contract) ? known <= lines : known === lines;
        })
      );
    })
  );
}

// For tests: each variant with count paths, in catalog order, with its
// length-search outcome and the work it took.
export const _formInternals = {
  lengthSearch: async (lines) =>
    (await automaticTable())
      .flat()
      .filter((variant) => variant.paths.length)
      .map((variant) => {
        const { contract: _found, ...outcome } = fitLength(variant, lines);
        return { id: variant.id, variant: variant.variant, ...outcome };
      }),
  budget: { ...LENGTH_SEARCH },
};

export function catalogReadingFlag(plan) {
  if (plan?.status !== 'ready') return null;
  if (paragraphCount(plan)) return '--form-reading=paragraphs';
  if (printedSteps(plan)) return '--form-reading=printing';
  if (plan.id === 'alliterative-verse') return '--form-reading=alliteration';
  if (plan.id === 'rondo') return '--form-reading=rondo';
  function needsRimes(node) {
    return (node.unit === 'syllable' && node.rhyme !== undefined) || node.children.some(needsRimes);
  }
  return plan.tree.some(needsRimes) ? '--form-reading' : '--form-reading=lines';
}

export async function prepareFormReview(args) {
  if (args.catalog_form === undefined) {
    if (args.catalog_variant !== undefined || args.catalog_counts !== undefined)
      throw new RangeError('catalog_variant and catalog_counts require catalog_form');
    return null;
  }
  const counts = Object.create(null);
  for (const entry of args.catalog_counts ?? []) {
    if (Object.hasOwn(counts, entry.path)) throw new RangeError('Duplicate count at ' + entry.path);
    counts[entry.path] = entry.count;
  }
  const options = { variant: args.catalog_variant, counts };
  return { options, plan: realizeForm(await formCatalog(), args.catalog_form, options) };
}

// The source reader retains the complete printed header. The page places its
// line and rhythm declarations after a spaced em dash. Keep an exact catalog
// role ahead of stripping an occurrence number or folding a compound spelling.
function sectionObservations(sections, plan) {
  if (!sections?.length || !sections.every((section) => section.classified === true)) return;
  const roles = new Set(plan.sections.map((section) => section.role).filter(Boolean));
  if (plan.id === 'alliterative-verse') return '--form-reading=alliteration';
  if (plan.id === 'rondo') for (const role of [...roles]) roles.add(role.slice('part-'.length));
  const triads = pindaricTriads(plan);
  if (triads) {
    for (const triad of triads) {
      for (const stanza of triad.children) roles.add(stanza.role);
    }
  }
  // A printed grade stamp and the editor's setup rows carry no section role.
  // Preserve following sung rows in their preceding declared section.
  const marked = [];
  for (const section of sections) {
    if (/^(?:FINISHED|GRADED)\b|^SETUP\s+—\s+/i.test(section.name)) {
      if (section.lines && !marked.length) return;
      if (marked.length) marked.at(-1).lines += section.lines;
    } else {
      marked.push({ ...section });
    }
  }
  if (!marked.length) return;
  let nextLine = 0;
  return marked.map((section) => {
    const [name] = section.name.trim().split(/\s+—\s+/);
    const role = name.toLowerCase().replace(/[\s_]+/g, '-');
    const unnumbered = role.replace(/-?\d+$/, '');
    const candidates = [role, unnumbered];
    for (const value of [...candidates]) {
      if (/^(?:pre|post)-chorus$/.test(value)) candidates.push(value.replace('-', ''));
    }
    const observed = { role: candidates.find((value) => roles.has(value)) ?? role };
    if (plan.coverage.lines === 'complete' || triads || plan.id === 'rondo') {
      observed.lineSpan = [nextLine, nextLine + section.lines];
      nextLine += section.lines;
    }
    return observed;
  });
}

export function reviewRecoveredForm({ options, plan }, record) {
  const result = {
    id: plan.id,
    scope: plan.scope,
    status: plan.status,
    variant: plan.variant,
    needs: plan.needs,
  };
  if (plan.status !== 'ready') return { ...result, verdict: 'unknown' };
  const observations = record.lines.map((text, i) => ({
    text,
    sungWords: null,
    ...record.form_reading?.[i],
    ...(record.printed_lines && { printedText: record.printed_lines[i] }),
    ...(record.paragraph_starts && { paragraphStart: record.paragraph_starts[i] }),
  }));
  const sections = sectionObservations(record.sections, plan);
  // A printed header can locate a neutral stanza even though it has no song
  // function. Leave absent or incomplete markings unassigned.
  const root = plan.tree[0];
  const markedSequence =
    plan.tree.length === 1 &&
    (['verse-sequence', 'stanza-group'].includes(root.unit)
      ? sections?.length === root.children.length
      : openCoupletEnding(plan) && sections?.length === 2) &&
    sections.every(({ lineSpan }) => lineSpan && lineSpan[1] > lineSpan[0]) &&
    sections.at(-1).lineSpan[1] === observations.length &&
    projectSongFormCreation(plan, options.counts).arrangement?.divisions.length === sections.length;
  const check =
    markedSequence || plan.id === 'alliterative-verse' ? gradeObservations : checkReaderForm;
  const measurement = check(catalog, plan.id, {
    ...options,
    lines: observations,
    sections,
  });
  if (usesFunctionReadings(plan.id)) {
    // A printed section header can locate a function; it cannot attest its meaning.
    measurement.checks.push({
      kind: 'declared-textual-function',
      basis: 'no attributed reading',
      outcome: 'unknown',
    });
    if (measurement.verdict === 'pass') measurement.verdict = 'unknown';
  }
  return {
    ...result,
    verdict: measurement.verdict,
    checks: measurement.checks,
    ...(plan.id === 'rondo' && { lyricalReturns: record.rondo_text_returns ?? [] }),
    ...(paragraphCount(plan) && {
      scope: 'setting',
      catalogScope: plan.scope,
      basis: 'printed unwrapped, blank-separated paragraphs with sentence-final punctuation',
    }),
    coverage: plan.coverage,
    mandate: formMandate(plan),
    ...(printedSteps(plan) && {
      printedRowCount: printedSteps(plan).reduce((n, count) => n + count, 0),
    }),
    meter_basis:
      'coordinates shared by all listed readings of each fully aligned word; function-word demotion applied, primary and secondary stress merged; unread or guessed measurements withheld',
  };
}
