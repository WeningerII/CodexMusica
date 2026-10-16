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
  // lyric_harness.LEADING_ELISIONS and _OPENING_QUOTES (the opening-quote rule).
  const OPENING_QUOTES = '\u2018\u201b';
  const LEADING_ELISIONS = new Set([
    "'bout",
    "'cause",
    "'course",
    "'cuse",
    "'em",
    "'frisco",
    "'gain",
    "'kay",
    "'round",
    "'til",
    "'tis",
    "'twas",
    "'gainst",
    "'mong",
    "'mongst",
    "'neath",
    "'twere",
    "'twixt",
    "'twould",
    "'d",
    "'ll",
    "'m",
    "'n",
    "'n'",
    "'re",
    "'s",
    "'t",
    "'ve",
  ]);
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
        else if (nfc.startsWith(cps[start].normalize('NFC'))) {
          // The starter composed with nothing (a space before reordered
          // marks, or a singleton NFC replaces on its own: U+2000 -> U+2002,
          // U+037E -> ';'): its own normal form keeps its own codepoint.
          const own = Array.from(cps[start].normalize('NFC'));
          for (const ch of own) out.push([ch, start, start + 1]);
          for (const ch of nfcCps.slice(own.length)) out.push([ch, start + 1, end]);
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
    // A symbol's own normal form is not word material: a mark that is one
    // output character of a single non-mark, non-letter, non-numeral
    // codepoint (U+2ADC, the musical note symbols) closes a run, as the
    // symbol does, so it never starts the next word's raw run.
    const glued = new Set();
    st.forEach(([c, a, b], i) => {
      if (
        b === a + 1 &&
        M_ONE.test(c) &&
        !M_ONE.test(cps[a]) &&
        !L_ONE.test(cps[a]) &&
        !N_ONE.test(cps[a])
      )
        glued.add(i);
    });

    const make = (idx) => {
      let lo = 0,
        hi = idx.length;
      while (lo < hi && st[idx[lo]][0] === SHY) lo++;
      while (hi > lo && st[idx[hi - 1]][0] === SHY) hi--;
      idx = idx.slice(lo, hi);
      // A mark openingQuotes judged an opening quotation leaves the token.
      let k = 0;
      while (k < idx.length && (drop.has(idx[k]) || st[idx[k]][0] === SHY)) k++;
      idx = idx.slice(k);
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

    const drop = new Set();
    const cut = (member, keep, groups) => {
      const out = [];
      let cur = [];
      const close = () => {
        if (cur.length) {
          if (groups) groups.push(cur.slice());
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
        if (member(ch) && !glued.has(i)) cur.push(i);
        else close();
        k++;
      }
      close();
      return out;
    };

    const tokenMember = (c) => LATIN_ONE.test(c) || c === "'" || c === SHY || N_ONE.test(c);
    const tokenKeep = (t) => LATIN_ANY.test(t.text) || t.numeral;
    // lyric_harness._opening_quotes: a token-initial ' whose raw character is
    // U+2018/U+201B, on a word that is not a listed leading elision.
    const groups = [];
    cut(tokenMember, tokenKeep, groups);
    for (const g0 of groups) {
      const g = g0.filter((i) => st[i][0] !== SHY);
      if (
        g.length >= 2 &&
        st[g[0]][0] === "'" &&
        st[g[1]][0] !== "'" &&
        OPENING_QUOTES.includes(cps[st[g[0]][1]]) &&
        !LEADING_ELISIONS.has(
          g
            .map((i) => st[i][0])
            .join('')
            .toLowerCase()
        )
      )
        drop.add(g[0]);
    }
    const tokens = cut(tokenMember, tokenKeep);
    const runs = cut(
      (c) => L_ONE.test(c) || c === "'" || c === SHY || M_ONE.test(c) || N_ONE.test(c),
      (t) => Array.from(t.text).some((c) => L_ONE.test(c)) || t.numeral
    );
    return { tokens, runs };
  }

  // The grader's line_tokens(text, strip_parens) under scheme v2.
  const lineTokens = (text, stripParens = true) =>
    readerLine(text, { stripParens }).tokens.map((t) => t.text);

  // ── MIGRATION ONLY: the grader's pre-release cut (reader scheme v1) ──────
  // Nothing reads a line with this but the rebinding of a word number saved
  // before this release. It is the harness's `_line_tokens_v1` located in the
  // raw line (`_v1_token_spans`): every typographic apostrophe folded one
  // character for one, a spaced enclitic joined by dropping the whitespace
  // between, a stripped (...) blanked to its own length, then runs of Latin
  // letters, apostrophes and hyphens that hold a Latin letter. No NFC, no
  // numerals: v1 dropped them, which is why its numbers move. This is the cut
  // the Library's saved pronunciation choices were numbered under (the
  // server's reading_choices); the Lyrics page's own pre-release cut, which
  // neither folded the six rarer apostrophes nor joined enclitics, is
  // lyV1MigrationSpans in src/pages/lyrics.js. -> [{ text, pieces }] with
  // UTF-16 pieces into the line, or null when the located cut is not exactly
  // the v1 token texts (the harness refuses the same way).
  const V1_TOKEN_RUN = /(?:[A-Za-zÀ-ɏḀ-ỿ]|['-])+/g;
  const V1_LATIN = /[A-Za-zÀ-ɏḀ-ỿ]/;
  const V1_PARENS = /\([^)]*\)/g;
  function v1GraderTokens(text, stripParens = true) {
    let t = Array.from(String(text))
      .map((c) => (APOSTROPHES.includes(c) ? "'" : c))
      .join('')
      .replace(ENCLITIC, '$1$3');
    if (stripParens) t = t.replace(V1_PARENS, ' ');
    return (t.match(V1_TOKEN_RUN) || []).filter((w) => V1_LATIN.test(w));
  }
  function v1GraderSpans(text, stripParens = true) {
    text = String(text);
    const cps = Array.from(text);
    const folded = cps.map((c) => (APOSTROPHES.includes(c) ? "'" : c));
    const fmap = utf16Index(folded);
    const removed = new Set();
    for (const m of folded.join('').matchAll(ENCLITIC)) {
      const s16 = m.index + m[1].length;
      for (let j = fmap[s16]; j < fmap[s16 + m[2].length]; j++) removed.add(j);
    }
    const mapping = [];
    for (let i = 0; i < cps.length; i++) if (!removed.has(i)) mapping.push(i);
    const norm = mapping.map((i) => folded[i]);
    const nmap = utf16Index(norm);
    if (stripParens)
      for (const m of norm.join('').matchAll(V1_PARENS))
        for (let k = nmap[m.index]; k < nmap[m.index + m[0].length]; k++) norm[k] = ' ';
    const off16 = [0];
    for (const c of cps) off16.push(off16[off16.length - 1] + c.length);
    const joined = norm.join('');
    const jmap = utf16Index(norm);
    const spans = [];
    for (const m of joined.matchAll(V1_TOKEN_RUN)) {
      if (!V1_LATIN.test(m[0])) continue;
      const pieces = [];
      for (let k = jmap[m.index]; k < jmap[m.index + m[0].length]; k++) {
        const i = mapping[k];
        const last = pieces[pieces.length - 1];
        if (last && last[1] === i) last[1] = i + 1;
        else pieces.push([i, i + 1]);
      }
      spans.push({ text: m[0], pieces: pieces.map(([a, b]) => [off16[a], off16[b]]) });
    }
    const want = v1GraderTokens(text, stripParens);
    return spans.length === want.length && spans.every((s, k) => s.text === want[k]) ? spans : null;
  }

  // MIGRATION ONLY: the words the grader's pre-release end anchor LOOKED UP
  // for a line (reader scheme v1's `line_anchors`), which are not always its
  // cut. It read the words before the last by re-cutting them joined with
  // single spaces (`lex.transcribe(" ".join(words[:-1]))`, the v1 body of
  // `Lexicon.transcribe`), and the end word alone. Re-cutting is not
  // idempotent: an enclitic the printed line sets apart from its host by
  // punctuation (`knap, 's`, `M.P.'s`, `U.’s`) is a word of its own in the
  // cut, and the space join made it a SPACED enclitic, so the re-cut joined
  // it to the word before (`knap's`, `P's`, `U's`). Scheme v2 reads every
  // token at its own position (`transcribe_tokens`), so its lookup words are
  // its cut. -> the v1 lookup words ([] for a line with no word).
  function v1GraderLookup(text, stripParens = true) {
    const cut = v1GraderTokens(text, stripParens);
    if (!cut.length) return cut;
    return [...v1GraderTokens(cut.slice(0, -1).join(' '), stripParens), cut[cut.length - 1]];
  }

  // MIGRATION ONLY: word `token` of `line` under an earlier cut -> the
  // current cut's { token, word } covering exactly the same characters, or
  // { blocked: reason }. `old` is that earlier cut located in the line
  // ([{ text, pieces }], UTF-16), or null; `word`, when given, is the word
  // the saved number named, and the rebinding refuses where the old number no
  // longer names it. Never re-attaches to a nearby or overlapping word.
  function rebindBySpan(line, token, word, old, stripParens = true) {
    const src = old && Number.isInteger(token) && token >= 1 ? old[token - 1] : null;
    if (!src || (word !== null && word !== undefined && src.text !== word))
      return {
        blocked:
          word === null || word === undefined
            ? `the earlier cut had no word ${token} in that line`
            : `its old number no longer names “${word}” in that line`,
      };
    const same = (p) =>
      p.length === src.pieces.length &&
      p.every(([a, b], k) => a === src.pieces[k][0] && b === src.pieces[k][1]);
    const hits = readerLine(String(line), { stripParens })
      .tokens.map((t, k) => ({ t, k }))
      .filter(({ t }) => same(t.pieces));
    if (hits.length !== 1 || hits[0].t.text !== src.text)
      return {
        blocked: `no word of the current cut covers exactly the characters “${src.text}” covered`,
      };
    return { token: hits[0].k + 1, word: hits[0].t.text };
  }

  const api = {
    SCHEME,
    LEADING_ELISIONS,
    OPENING_QUOTES,
    readerLine,
    lineTokens,
    v1GraderSpans,
    v1GraderTokens,
    v1GraderLookup,
    rebindBySpan,
  };
  root.CMLyricTokens = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
