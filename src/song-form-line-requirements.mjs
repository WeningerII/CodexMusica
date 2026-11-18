// Count sung words and, when selected, the letters at each word position.
const coordinates = new Set(['unit', 'path', 'address', 'span', 'children', 'lineIndex']);

const meterFields = new Set(['syllables', 'stress', 'stresses']);

export function projectLineRequirement(line, endsRhyme = false, fixedReturns = false) {
  if (
    line.unit !== 'line' ||
    Object.keys(line).some(
      (key) =>
        !coordinates.has(key) &&
        !meterFields.has(key) &&
        !(endsRhyme && key === 'rhyme') &&
        !(fixedReturns && key === 'returns')
    )
  )
    return null;
  const constraints = {};
  if (line.syllables !== undefined) {
    if (!Number.isSafeInteger(line.syllables) || line.syllables < 1) return null;
    constraints.syllables = line.syllables;
  }
  if (line.stress !== undefined) {
    if (typeof line.stress !== 'string' || !/^[./]+$/.test(line.stress)) return null;
    if (constraints.syllables !== undefined && constraints.syllables !== line.stress.length)
      return null;
    constraints.syllables = line.stress.length;
    constraints.stress = line.stress;
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
  if (line.children.length) {
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
  if (constraints.syllables && constraints.words > constraints.syllables) return null;
  return Object.keys(constraints).length ? constraints : undefined;
}
