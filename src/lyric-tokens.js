/* exported CMLyricTokens */
/* global module */
/* The English reader's one cut of a lyric line, mirrored from the harness
   (lyric-harness/lyric_harness.py `reader_line`, reader scheme v2), so a token
   number on this page is the token number a pronunciation declaration binds in
   the grader. No dependencies; bundled before library-import.js and the pages.

   readerLine(text, { stripParens }) -> { tokens, runs }. Each entry is
   { text, pieces, numeral, aside }: `text` is the lookup spelling (NFC, the
   eight apostrophes and U+2010/U+2011 folded, U+00AD removed, a spaced
   enclitic joined); `pieces` are half-open UTF-16 ranges into `text`'s source
   line, for slicing; `numeral` marks a General_Category N character; `aside`
   a token inside (...) when stripParens is false. `tokens` is the grader's
   line_tokens coordinate; `runs` is its raw_final_token population.

   Python's \w, \b and \s are not JavaScript's, so they are spelled out here:
   \w as [\p{L}\p{N}_], \b after a word character as a negative lookahead, and
   \s as the exact str.isspace() set (JavaScript's \s adds U+FEFF and lacks
   U+001C-U+001F and U+0085). No regex here takes the `i` flag: it case-folds
   a class (U+0345 becomes a word character). Enumerated over every codepoint
   both Unicode versions assign, these classes then match Python's exactly;
   the agreement fixture carries the codepoints where they once differed. scripts/test_lyric_tokens.js checks this file
   against the harness on a generated fixture.

   Residual, disclosed: \p{L}, \p{M} and \p{N} are the engine's Unicode
   tables and the grader's are Python's unicodedata. A character assigned in a
   newer Unicode than Python's (U+1CCF1 is Unicode 16.0; Python 3.13 carries
   15.1) is a letter or numeral here and nothing in the grader, so the token
   numbering of such a line can differ. */
(function (root) {
  const SCHEME = 'v2';
  const APOSTROPHES = '’‘ʼʻ՚＇`´';
  const SHY = '­';
  const WS =
    '\\t-\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
  const WS_ONE = new RegExp(`^[${WS}]$`);
  const LATIN_ONE = /^[A-Za-zÀ-ɏḀ-ỿ]$/;
  const LATIN_ANY = /[A-Za-zÀ-ɏḀ-ỿ]/;
  const M_ONE = /^\p{M}$/u;
  const N_ONE = /^\p{N}$/u;
  const L_ONE = /^\p{L}$/u;
  // NO `i` FLAG: under /iu a character class matches whatever case-folds
  // into it, so U+0345 (a combining mark that folds to Greek iota) would be
  // a word character here and not in the grader. Python's re.I folds only
  // the enclitic letters, so they are spelled out, U+017F (long s, which
  // re.I matches for `s`) included.
  const ENCLITIC = new RegExp(
    `([\\p{L}\\p{N}_])([${WS}]+)('[sS\u017f]|'[lL][lL]|'[rR][eE]|'[vV][eE]|'[dD]|'[mM])(?![\\p{L}\\p{N}_])`,
    'gu'
  );
  const ASIDE = /\([^)]*\)/g;

  const isHangul = (c) => {
    const o = c.codePointAt(0);
    return (
      (o >= 0x1100 && o <= 0x11ff) ||
      (o >= 0xa960 && o <= 0xa97f) ||
      (o >= 0xd7b0 && o <= 0xd7ff) ||
      (o >= 0xac00 && o <= 0xd7a3)
    );
  };
  const fold = (c) => (APOSTROPHES.includes(c) ? "'" : c === '‐' || c === '‑' ? '-' : c);
  const isNumeralText = (s) => Array.from(s).some((c) => N_ONE.test(c));

  // [char, a, b] per output character, a/b codepoint offsets into the line.
  function stream(text, cps) {
    let out = [];
    if (text.normalize('NFC') === text) {
      out = cps.map((c, i) => [c, i, i + 1]);
    } else {
      // A segment is a starter and its marks, or a run of Hangul (which NFC
      // composes across starters) and its marks.
      let start = 0;
      while (start < cps.length) {
        let end = start + 1;
        const hangul = isHangul(cps[start]);
        while (end < cps.length && (M_ONE.test(cps[end]) || (hangul && isHangul(cps[end])))) end++;
        const seg = cps.slice(start, end).join('');
        const nfc = seg.normalize('NFC');
        const nfcCps = Array.from(nfc);
        if (nfc === seg) for (let k = start; k < end; k++) out.push([cps[k], k, k + 1]);
        else if (nfcCps[0] === cps[start]) {
          // The starter composed with nothing (a space before reordered
          // marks): it keeps its own codepoint.
          out.push([nfcCps[0], start, start + 1]);
          for (const ch of nfcCps.slice(1)) out.push([ch, start + 1, end]);
        } else for (const ch of nfcCps) out.push([ch, start, end]);
        start = end;
      }
      if (out.map((x) => x[0]).join('') !== text.normalize('NFC')) {
        out = [];
        let i = 0;
        while (i < cps.length) {
          const ws = WS_ONE.test(cps[i]);
          let j = i;
          while (j < cps.length && WS_ONE.test(cps[j]) === ws) j++;
          for (const ch of Array.from(cps.slice(i, j).join('').normalize('NFC')))
            out.push([ch, i, j]);
          i = j;
        }
      }
    }
    return out.map(([c, a, b]) => [fold(c), a, b]);
  }

  // UTF-16 offset -> stream index, for regex matches over the joined string.
  function utf16Index(chars) {
    const map = [];
    chars.forEach((c, i) => {
      for (let k = 0; k < c.length; k++) map.push(i);
    });
    map.push(chars.length);
    return map;
  }

  function readerLine(text, options) {
    const stripParens = !options || options.stripParens !== false;
    text = String(text);
    const cps = Array.from(text);
    const st = stream(text, cps);
    // The enclitic join reads the stream with U+00AD left out, so a soft
    // hyphen can neither make nor break a join.
    const visible = [];
    for (let i = 0; i < st.length; i++) if (st[i][0] !== SHY) visible.push(i);
    const normChars = visible.map((i) => st[i][0]);
    const nmap = utf16Index(normChars);
    const removed = new Set();
    for (const m of normChars.join('').matchAll(ENCLITIC)) {
      const s16 = m.index + m[1].length;
      for (let j = nmap[s16]; j < nmap[s16 + m[2].length]; j++) removed.add(visible[j]);
    }
    const seq = [];
    for (let i = 0; i < st.length; i++) if (!removed.has(i)) seq.push(i);
    const joinedChars = seq.map((i) => st[i][0]);
    const jmap = utf16Index(joinedChars);
    const aside = new Set();
    for (const m of joinedChars.join('').matchAll(ASIDE)) {
      for (let k = jmap[m.index]; k < jmap[m.index + m[0].length]; k++) aside.add(seq[k]);
    }
    const off16 = [0];
    for (const c of cps) off16.push(off16[off16.length - 1] + c.length);

    const make = (idx) => {
      let lo = 0,
        hi = idx.length;
      while (lo < hi && st[idx[lo]][0] === SHY) lo++;
      while (hi > lo && st[idx[hi - 1]][0] === SHY) hi--;
      idx = idx.slice(lo, hi);
      if (!idx.length) return null;
      const chars = idx
        .map((i) => st[i][0])
        .filter((c) => c !== SHY)
        .join('');
      const pieces = [];
      for (const i of idx) {
        const [, a, b] = st[i];
        const last = pieces[pieces.length - 1];
        if (last && last[1] >= a) last[1] = Math.max(last[1], b);
        else if (last && cps.slice(last[1], a).every((c) => c === SHY)) last[1] = b;
        else pieces.push([a, b]);
      }
      return {
        text: chars,
        pieces: pieces.map(([a, b]) => [off16[a], off16[b]]),
        numeral: isNumeralText(chars),
        aside: idx.some((i) => aside.has(i)),
      };
    };

    const cut = (member, keep) => {
      const out = [];
      let cur = [];
      const close = () => {
        if (cur.length) {
          const tok = make(cur);
          if (tok && keep(tok)) out.push(tok);
          cur = [];
        }
      };
      let k = 0;
      while (k < seq.length) {
        const i = seq[k];
        const ch = st[i][0];
        if (stripParens && aside.has(i)) {
          close();
          k++;
          continue;
        }
        if (ch === '-') {
          // Two or more hyphens (U+00AD between them ignored) are punctuation.
          let j = k,
            dashes = 0,
            last = k;
          while (j < seq.length && !(stripParens && aside.has(seq[j]))) {
            const c = st[seq[j]][0];
            if (c === '-') {
              dashes++;
              last = j;
            } else if (c !== SHY) break;
            j++;
          }
          if (dashes >= 2) {
            close();
            k = last + 1;
            continue;
          }
          cur.push(i);
          k++;
          continue;
        }
        if (member(ch)) cur.push(i);
        else close();
        k++;
      }
      close();
      return out;
    };

    const tokens = cut(
      (c) => LATIN_ONE.test(c) || c === "'" || c === SHY || N_ONE.test(c),
      (t) => LATIN_ANY.test(t.text) || t.numeral
    );
    const runs = cut(
      (c) => L_ONE.test(c) || c === "'" || c === SHY || M_ONE.test(c) || N_ONE.test(c),
      (t) => Array.from(t.text).some((c) => L_ONE.test(c)) || t.numeral
    );
    return { tokens, runs };
  }

  // The grader's line_tokens(text, strip_parens) under scheme v2.
  const lineTokens = (text, stripParens = true) =>
    readerLine(text, { stripParens }).tokens.map((t) => t.text);

  const api = { SCHEME, readerLine, lineTokens };
  root.CMLyricTokens = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
