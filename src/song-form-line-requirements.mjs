// Count sung words and, when selected, the letters at each word position.
import { regularAlexandrine, stressEndingFor } from './song-form-line-roles.mjs';

const coordinates = new Set(['unit', 'path', 'address', 'span', 'children', 'lineIndex']);

const meterFields = new Set(['syllables', 'stress', 'stresses']);

export function projectLineRequirement(
  line,
  endsRhyme = false,
  fixedReturns = false,
  refrain = false,
  lengthPair,
  lexicalProfile
) {
  if (
    line.unit !== 'line' ||
    Object.keys(line).some(
      (key) =>
        !coordinates.has(key) &&
        !meterFields.has(key) &&
        !(
          key === 'role' &&
          (lexicalProfile ||
            lengthPair ||
            stressEndingFor(line.role) ||
            line.role === 'alexandrine' ||
            (fixedReturns && refrain && line.role === 'refrain'))
        ) &&
        !(endsRhyme && key === 'rhyme') &&
        !(fixedReturns && key === 'returns')
    )
  )
    return null;
  const constraints = {};
  if (lengthPair && line.role === 'short-line') constraints.shorterThan = lengthPair.long;
  if (line.syllables !== undefined) {
    if (!Number.isSafeInteger(line.syllables) || line.syllables < 1) return null;
    constraints.syllables = line.syllables;
  }
  const stress = line.stress ?? (line.role === 'alexandrine' ? regularAlexandrine : undefined);
  if (line.role === 'alexandrine' && stress !== regularAlexandrine) return null;
  if (stress !== undefined) {
    if (typeof stress !== 'string' || !/^[./]+$/.test(stress)) return null;
    if (constraints.syllables !== undefined && constraints.syllables !== stress.length) return null;
    constraints.syllables = stress.length;
    constraints.stress = stress;
  }
  if (line.stresses !== undefined) {
    if (
      !Number.isSafeInteger(line.stresses) ||
      line.stresses < 0 ||
      (constraints.syllables !== undefined && line.stresses > constraints.syllables) ||
      (constraints.stress && constraints.stress.split('/').length - 1 !== line.stresses)
    )
      return null;
    constraints.stresses = line.stresses;
  }
  const ending = stressEndingFor(line.role);
  if (ending && stress && !stress.endsWith(ending)) return null;
  if (ending && !stress) constraints.stressEnding = ending;
  if (
    line.children.length &&
    line.children.every(
      (unit) =>
        unit.unit === 'syllable' &&
        !unit.children.length &&
        Object.keys(unit).every((key) => coordinates.has(key))
    )
  ) {
    if (constraints.syllables !== undefined && constraints.syllables !== line.children.length)
      return null;
    constraints.syllables = line.children.length;
    if (constraints.stresses > constraints.syllables) return null;
  } else if (line.children.length) {
    if (
      !line.children.every(
        (word) => word.unit === 'word' && Object.keys(word).every((key) => coordinates.has(key))
      )
    )
      return null;
    constraints.words = line.children.length;
    if (line.children.some((word) => word.children.length)) {
      // A position without a letter selection stays unconstrained.
      const widths = [];
      for (const word of line.children) {
        if (
          !word.children.every(
            (letter) =>
              letter.unit === 'letter' &&
              !letter.children.length &&
              Object.keys(letter).every((key) => coordinates.has(key))
          )
        ) {
          return null;
        }
        widths.push(word.children.length || null);
      }
      constraints.wordLetters = widths;
    }
  }
  if (ending) {
    const weak = ending.length - ending.replaceAll('.', '').length;
    const strong = ending.length - weak;
    if (constraints.syllables !== undefined && ending.length > constraints.syllables) return null;
    if (constraints.stresses !== undefined && constraints.stresses < strong) return null;
    if (constraints.syllables !== undefined && constraints.stresses > constraints.syllables - weak)
      return null;
  }
  if (constraints.syllables && constraints.words > constraints.syllables) return null;
  return Object.keys(constraints).length ? constraints : undefined;
}
