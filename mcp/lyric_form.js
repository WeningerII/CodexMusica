// Connect the declared catalog pattern to the sung-line coordinates of the reader.
import { readFile } from 'node:fs/promises';
import { checkReaderForm, realizeForm } from '../src/song-forms.mjs';
import { formMandate } from '../src/song-form-mandate.mjs';

let catalog;
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
    if (plan.coverage.lines === 'complete') {
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
  const observations = record.lines.map((text, i) => ({ text, ...record.form_reading?.[i] }));
  const sections = sectionObservations(record.sections, plan);
  const { verdict, checks } = checkReaderForm(catalog, plan.id, {
    ...options,
    lines: observations,
    sections,
  });
  return {
    ...result,
    verdict,
    checks,
    coverage: plan.coverage,
    mandate: formMandate(plan),
    meter_basis:
      'coordinates shared by all listed readings of each fully aligned word; function-word demotion applied, primary and secondary stress merged; unread or guessed measurements withheld',
  };
}
