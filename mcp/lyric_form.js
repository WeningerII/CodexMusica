// Connect the declared catalog pattern to the sung-line coordinates of the reader.
import { readFile } from 'node:fs/promises';
import { checkReaderForm, pindaricTriads, realizeForm } from '../src/song-forms.mjs';
import { openCoupletEnding, projectSongFormCreation } from '../src/song-form-creation.mjs';
import { gradeObservations } from '../src/song-form-grade.mjs';
import { printedSteps, paragraphCount } from '../src/song-form-printing.mjs';
import { formMandate } from '../src/song-form-mandate.mjs';

let catalog;
export function catalogReadingFlag(plan) {
  if (plan?.status !== 'ready') return null;
  if (paragraphCount(plan)) return '--form-reading=paragraphs';
  if (printedSteps(plan)) return '--form-reading=printing';
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
  catalog ??= JSON.parse(
    await readFile(new URL('../data/song-forms.json', import.meta.url), 'utf8')
  );
  const options = { variant: args.catalog_variant, counts };
  return { options, plan: realizeForm(catalog, args.catalog_form, options) };
}

// The source reader retains the complete printed header. The page places its
// line and rhythm declarations after a spaced em dash. Keep an exact catalog
// role ahead of stripping an occurrence number or folding a compound spelling.
function sectionObservations(sections, plan) {
  if (!sections?.length || !sections.every((section) => section.classified === true)) return;
  const roles = new Set(plan.sections.map((section) => section.role).filter(Boolean));
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
  const check = markedSequence ? gradeObservations : checkReaderForm;
  const { verdict, checks } = check(catalog, plan.id, {
    ...options,
    lines: observations,
    sections,
  });
  return {
    ...result,
    verdict,
    checks,
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
