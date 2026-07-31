// scripts/_split_data.js
// Splits `const NAME = [...]` or `const NAME = {...}` declarations into
// per-element chunks suitable for emission as separate <script> tags.
//
// Why: a single large <script> tag has its entire AST held in renderer
// memory during parse-then-execute. Splitting into chunks lets the browser
// free each AST before parsing the next, lowering peak memory.
//
// The walker tracks:
//   - String state (single, double, template)
//   - Comment state (line, block)
//   - Bracket depth ({} [] ())
//   - Backslash escapes inside strings
//
// Top-level element boundaries are commas (or the closing bracket) that
// occur at depth 1, outside strings and comments.

'use strict';

// Returns { name, kind ('array'|'object'), elements: string[], leading: string, trailing: string }
// where `elements` is each top-level entry as a source string (without the
// separating commas), and `leading` / `trailing` are the source before the
// opening bracket and after the closing one (for preserving comments, etc.).
function parseTopLevelDeclaration(source) {
  // Find the const/let/var declaration: scan past leading comments/whitespace
  // until we hit `const NAME = [` or `const NAME = {`.
  const decl = /(^|\n)\s*(?:const|let|var)\s+([A-Z_][A-Z_0-9]*)\s*=\s*([[{])/.exec(source);
  if (!decl) return null;

  const name = decl[2];
  const openChar = decl[3];
  const kind = openChar === '[' ? 'array' : 'object';
  const openIdx = decl.index + decl[0].length - 1; // index of `[` or `{`

  const leading = source.slice(0, openIdx);

  // Walk the source from openIdx forward, find matching close + element splits.
  // States: regular, in-line-comment, in-block-comment, in-single-string,
  //         in-double-string, in-template-string.
  // Depth counts unclosed open brackets/braces/parens (only outside strings/comments).
  let i = openIdx + 1;
  let depth = 1;
  let state = 'regular';
  let elementStart = i;
  const elements = [];
  let closeIdx = -1;

  // Skip leading whitespace/comments inside the bracket so the first element
  // starts cleanly.
  function skipWhitespaceFrom(p) {
    while (p < source.length) {
      const c = source[p];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        p++;
        continue;
      }
      if (c === '/' && source[p + 1] === '/') {
        const nl = source.indexOf('\n', p);
        if (nl === -1) return source.length;
        p = nl + 1;
        continue;
      }
      if (c === '/' && source[p + 1] === '*') {
        const end = source.indexOf('*/', p + 2);
        if (end === -1) return source.length;
        p = end + 2;
        continue;
      }
      break;
    }
    return p;
  }
  i = skipWhitespaceFrom(i);
  elementStart = i;

  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];

    if (state === 'line-comment') {
      if (c === '\n') state = 'regular';
      i++;
      continue;
    }
    if (state === 'block-comment') {
      if (c === '*' && next === '/') {
        state = 'regular';
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (state === 'single-string' || state === 'double-string') {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if ((state === 'single-string' && c === "'") || (state === 'double-string' && c === '"')) {
        state = 'regular';
      }
      i++;
      continue;
    }
    if (state === 'template-string') {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '`') {
        state = 'regular';
        i++;
        continue;
      }
      // Note: ignoring ${...} interpolation depth; data files don't use it.
      i++;
      continue;
    }

    // state === 'regular'
    if (c === '/' && next === '/') {
      state = 'line-comment';
      i += 2;
      continue;
    }
    if (c === '/' && next === '*') {
      state = 'block-comment';
      i += 2;
      continue;
    }
    if (c === "'") {
      state = 'single-string';
      i++;
      continue;
    }
    if (c === '"') {
      state = 'double-string';
      i++;
      continue;
    }
    if (c === '`') {
      state = 'template-string';
      i++;
      continue;
    }
    if (c === '[' || c === '{' || c === '(') {
      depth++;
      i++;
      continue;
    }
    if (c === ']' || c === '}' || c === ')') {
      depth--;
      if (depth === 0) {
        // Closing bracket of the outer container.
        // Capture the final element if any non-whitespace exists.
        const tail = source.slice(elementStart, i).trim();
        if (tail.length > 0) elements.push(source.slice(elementStart, i).replace(/\s+$/, ''));
        closeIdx = i;
        break;
      }
      i++;
      continue;
    }
    if (c === ',' && depth === 1) {
      const el = source.slice(elementStart, i).trim();
      if (el.length > 0) elements.push(source.slice(elementStart, i).replace(/^\s+|\s+$/g, ''));
      i++;
      // Skip whitespace + comments before next element starts
      i = skipWhitespaceFrom(i);
      elementStart = i;
      continue;
    }
    i++;
  }

  if (closeIdx === -1)
    throw new Error('parseTopLevelDeclaration: never found matching close for ' + name);
  const trailing = source.slice(closeIdx + 1);

  return { name, kind, elements, leading, trailing };
}

// Group element strings into chunks each ≤ maxChars (best effort — a single
// element larger than maxChars goes alone). Returns string[] (each is the
// joined source text for that chunk's elements, comma-separated).
function chunkElements(elements, maxChars) {
  const chunks = [];
  let current = [];
  let currentSize = 0;
  for (const el of elements) {
    const elSize = el.length + 2; // +2 for ", " separator overhead
    if (current.length > 0 && currentSize + elSize > maxChars) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(el);
    currentSize += elSize;
  }
  if (current.length > 0) chunks.push(current);
  return chunks.map((c) => c.join(',\n  '));
}

// Emit the script-tag wrappers for a chunked declaration.
//   kind 'array':  initial = `const NAME = [];`,  per-chunk = `NAME.push(...chunk);`
//   kind 'object': initial = `const NAME = {};`,  per-chunk = `Object.assign(NAME, { ...chunk });`
//
// Note: leadingComment (preamble before the declaration) is INTENTIONALLY
// not re-emitted as a chunk. The parser's `leading` field includes the
// `const NAME = ` keyword itself, which would create a dangling unterminated
// statement if emitted standalone. The runtime doesn't need the comments.
function emitChunkedDeclaration(name, kind, chunks) {
  const out = [];
  if (kind === 'array') {
    out.push(`const ${name} = [];`);
    for (const chunk of chunks) {
      out.push(`${name}.push(${chunk});`);
    }
  } else {
    out.push(`const ${name} = {};`);
    for (const chunk of chunks) {
      out.push(`Object.assign(${name}, {${chunk}});`);
    }
  }
  return out;
}

// High-level: take a JS source file content + a maxChars threshold,
// return an array of script-tag content strings ready to be wrapped in <script>.
// Each returned string is "small enough" by itself.
function splitFileIntoChunks(source, maxChars) {
  if (source.length <= maxChars) return [source];

  const parsed = parseTopLevelDeclaration(source);
  if (!parsed) return [source];
  const { name, kind, elements, leading, trailing } = parsed;

  // Reconstruct the source range covering the full declaration including its
  // trailing semicolon (the parser's `leading` ends at `[` or `{`; we need
  // through `];` or `};` plus any whitespace before the next statement).
  const declStart = leading.length;
  // The character at `closeIdx` (computed below) was the matching close;
  // include the semicolon that typically follows it.
  // Find the close + semicolon location by re-walking using the same depth
  // logic. Simpler: trailing starts right after closeChar, so:
  const closeAt = source.length - trailing.length; // index of `]` or `}` + 1
  // Include the trailing semicolon if present.
  let declEnd = closeAt;
  if (source[declEnd] === ';') declEnd++;
  const declSource = source.slice(declStart, declEnd); // `[...];` or `{...};`

  // If this single declaration fits within the threshold, return:
  //   - the leading (preamble + `const NAME = `) joined with the decl source
  //   - recurse on what remains after the declaration's trailing semicolon
  if (declSource.length <= maxChars) {
    const remainder = source.slice(declEnd);
    const head = leading + declSource;
    const restChunks = remainder.trim() ? splitFileIntoChunks(remainder, maxChars) : [];
    return [head, ...restChunks];
  }

  // Declaration is too big — chunk it.
  // The chunked path regenerates `const NAME = …` from scratch and CANNOT carry
  // the source preceding the declaration. Header comments are fine to drop, but
  // any real statement above an oversized declaration (e.g. `const VERSION = 7;`
  // sitting above a >600 KB table) would vanish silently — valid JS, lost
  // semantics. Convert that into a loud failure instead. (The fits-path above
  // keeps `leading` intact, so this only guards the chunked branch.)
  const preamble = leading.replace(
    /(?:^|\n)[ \t]*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*$/,
    ''
  );
  const preambleCode = preamble
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .trim();
  if (preambleCode) {
    throw new Error(
      `splitFileIntoChunks: "${name}" must be chunked, but non-comment source precedes its ` +
        `declaration and would be dropped: ${JSON.stringify(preambleCode.slice(0, 80))}… ` +
        `Move it after the declaration (or keep the declaration under the chunk threshold).`
    );
  }
  const chunks = chunkElements(elements, maxChars);
  const declLines = emitChunkedDeclaration(name, kind, chunks);

  const remainder = source.slice(declEnd);
  const restChunks = remainder.trim() ? splitFileIntoChunks(remainder, maxChars) : [];

  return [...declLines, ...restChunks];
}

// splitFileIntoChunks is the whole public surface — build_html.js is the only
// caller. The three stages it composes are internal and were exported unused.
module.exports = { splitFileIntoChunks };
