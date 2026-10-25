/* global lyInspectionSession, lyInspectionRenderDock, lyInspectionRefresh, lyInspectionReceive, lyInspectionAction, lyInspectionWire, lyInspectionEscape */
/* exported uiLyricsWaiting, lyDraftForWriter, uiLyricsOpened, lyPrepareRangeMarks, lyCaptureWritingOrigin, lyRestoreWritingOrigin, lyGoToRangeParts, lyWritingLineActions, lySetWritingRangeMarks */
/* global $ui, UI, UILayout, CHAT_BACKEND, CHAT_STORAGE_KEY, CMLibraryImport, CMLyricTokens, _chatPersistedState, _chatPollStop, _chatSave, _chatRecover, _chatReset, _chatSend, _chatSyncCount, app, chatState, compileRecipeStack, esc, execCopyFallback, icon, lyricMetaOf, pushHistory, showToast, uiAutosave, uiButton, uiChatOpen, uiChatSessions, uiCount, uiDownload, uiEmptyState, uiExport, uiFocus, uiNavigate, uiRegisterPage, uiSaveLyrics, uiSwitchChat, uiUpdatePrompt, sessionSnapshot */
/* Lyrics page. Owned by the Lyrics page worker; see docs/ui-foundation.md.

   THE DRAFT IS THE ONE SOURCE OF TRUTH. Everything this page shows is read
   from the text in #lyrics-draft (session state, written through the shell's
   uiSaveLyrics) or from the lyric writer's own replies (chatState, src/app.js).
   Nothing here grades a song: the page reports exact text facts (lines,
   sections, verbatim returns, declared headers) and relays what a writer run
   reported, labelled as such and marked stale once the draft moves on.

   The text conventions are the harness's own:
   - a sung line is a nonblank line that is not a whole-line [bracket]
     (mcp/lyric_text.js draftFromText), numbered from 1 in that order;
   - a section header is a bracket, optionally carrying its declared size and
     rhythm the way quality/plan.py builds it:
       [CHORUS — 5 lines — 5 bars of 7/8, one-beat pickup]
   - [FINISHED — seed N — exit E — …] and [GRADED — …] are run stamps;
   - sung tokens follow lyric_harness.line_tokens (parentheses unsung unless
     voices are declared), so a pronunciation binds the same token position
     the harness reads.
   Setup the writer should honour is declared in the text as [SETUP — …]
   lines. Like headers they are not sung (the harness drops whole-line
   brackets), and they travel with the draft through saves, exports and Undo.

   Lyric writing stays separate from recipe generation: the only recipe input
   is the explicit "Use current recipe" prefill, and nothing here writes the
   recipe. Writer work goes through the one AI writer (uiNewTask/uiChatOpen). */
'use strict';

// ── Text model ──────────────────────────────────────────────────────────────
const LY_DASH = ' — ';
const LY_STAMP = /^\[(FINISHED|GRADED)\b/i;
const LY_SETUP = /^\[SETUP\s+—\s+/i;
const LY_BRACKET = /^\[[^\]]*\]$/;
const LY_ARPABET_VOWELS = 'AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW'.split(' ');
const LY_ARPABET_CONSONANTS = 'B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH'.split(' ');
// The harness's placement vocabulary for a rhyme-group member (quality/slots.py).
const LY_PLACES = {
  end: 'last rhyme',
  endword: 'last word',
  head: 'first word',
  headrime: 'first rhyme',
  line: 'whole line',
};
const LY_SECTION_NAMES = [
  'Verse',
  'Pre-chorus',
  'Chorus',
  'Bridge',
  'Intro',
  'Outro',
  'Hook',
  'Refrain',
];

// The grader's line_tokens, read through the shared mirror of its one reader
// (src/lyric-tokens.js, reader scheme v2): a declaration's token number here is
// the one the harness binds. `voices` keeps (...) as sung words.
function lyTokens(text, voices = false) {
  return CMLyricTokens.readerLine(String(text), { stripParens: !voices }).tokens.map((t) => t.text);
}
// Word-by-word spans of a line for display, from the same reader's raw pieces:
// each token is numbered as lyTokens numbers it (an aside only under voices),
// every piece of a token joined across a spaced enclitic carries its number,
// and everything between pieces is shown as printed, once.
function lyWordSpans(text, voices) {
  text = String(text);
  const out = [];
  let last = 0,
    index = 0;
  for (const tok of CMLyricTokens.readerLine(text, { stripParens: false }).tokens) {
    const sung = voices || !tok.aside;
    const token = sung ? ++index : null;
    for (const [from, b] of tok.pieces) {
      // A piece can overlap the previous token's only where the reader had to
      // map a whole printed chunk (a composition across characters, such as
      // Hangul jamo); the shared characters are shown once, under the first.
      const a = Math.max(from, last);
      if (a >= b) continue;
      if (a > last) out.push({ gap: text.slice(last, a) });
      out.push({ word: text.slice(a, b), token, aside: !sung });
      last = b;
    }
  }
  if (last < text.length) out.push({ gap: text.slice(last) });
  return out;
}
// ── Saved readings across the reader's v2 cut ──────────────────────────────
// A [SETUP — reading — token N …] row names a word by its number, and the
// word cut changed in this release (reader scheme v2: dash runs split words,
// numerals are words). Every row this page writes carries the cut it was
// numbered under, in the row itself (`— cut v2`), so the mark travels with
// the text wherever the text goes: a downloaded .txt, a paste, an import, a
// Library working copy, Undo/Redo. A row WITHOUT the mark is legacy by
// compatibility policy -- which says nothing certain about when it was
// written, since hand-typed or imported text can be unmarked too -- and is
// read as numbered under the earlier cut. It is rebound by span identity:
// the old cut's occurrence becomes the current token covering exactly the
// same characters. A row whose number that changes is rewritten (only the
// number) and gains the mark; a row whose binding it leaves exactly as it was
// keeps every byte and gains NO mark (lyMigrateSavedReadings says why, and
// what that costs). A row with no such
// token, or whose old number no longer names its own word, is never dropped
// and never rebound to another occurrence: it is flagged in the text as
// needing the writer's decision, shown as an input, and the draft is not sent
// to the writer until it is decided. A reading whose number the migration
// changes is reported, never moved in silence. A row marked with a cut this
// page does not read (`— cut v3`) is never rewritten as if it were the
// current cut's: it binds nothing and stops every send, and the message
// names the accepted value.
//
// [SETUP — rhyme groups — …] and [SETUP — returns — …] rows name a word two
// ways, and the two are treated differently (team policy A):
// - `N.Tk` (the "Word N" pickers) is a COUNT, numbered under the page's
//   earlier cut: rebound by the same span identity, or kept under its old
//   number as `N.Tk (numbered under the earlier cut)`, which binds no word and
//   stops every send until the writer removes it and declares it again.
// - A bare `N` and the named places (end, endword, head, headrime, line) are
//   DEFINITIONS the grader applies to the line as it reads it, and they DO
//   move with the cut: the grader's earlier cut and the current one disagree
//   on such places on thousands of corpus lines (end 178 re-cut plus 539
//   numeral ends only the earlier cut skipped; endword 229 re-cut and 1
//   different word; head 288; headrime 284 plus 53 leading dashes only the
//   current cut keeps; T<k> 10,553 positions on 3,099 lines). They are
//   never converted to a number. On a line whose two cuts differ ANYWHERE
//   (the whole line, since a rhyme can start in an earlier word than the one
//   named), the member is kept named and written
//   `N.place (carried across the word-cut change)`: it is still sent and
//   judged, and Review shows one notice per member naming the line, the
//   place and the words the page shows there under each cut -- the page's
//   display, not the grader's evidence; the grader decides what the place
//   binds -- with Keep the link / Remove it. The member keeps that state until
//   the writer chooses; the row's `— cut v2` never stands in for "meaning
//   preserved". On a line whose cut did not change the member is carried
//   silently. A member the grader cannot judge under the current cut (a
//   numeral end, say) stays a visible refusal in the grader's own verdict.
// - In a RETURNS row bare `N` uses the harness's whole-line returns_check;
//   explicit `N.line` uses placed_returns_check with place `line`. Their
//   grading semantics differ, but neither needs word-offset migration.
//   Other placed returns (`N.end`, `N.endword`, `N.head`, `N.headrime`,
//   `N.T<k>`) name a word.
//   "Differ" means the token texts, their characters, their number -- or
//   the words the grader LOOKS UP for the line (lyLineCutChanged): the
//   earlier cut's end anchor re-cut its own tokens joined by spaces, so an
//   enclitic the printed line sets apart (`knap, 's`, `M.P.'s`) was looked
//   up joined to the word before it (`knap's`, `P's`) on a line whose cut
//   is otherwise identical.
// Every rhyme groups / returns row this page writes carries `— cut v2`, after
// its members; lyParseSetup keeps the mark and the member states out of the
// value the tools receive.
const LY_TOKEN_SCHEME = CMLyricTokens.SCHEME;
const lyNumbering = (voices = false) => `v2${voices ? '+voices' : ''}`;
const LY_NUMBERINGS = ['v1', 'v1+voices', 'v2', 'v2+voices'];
// A saved coordinate must still name the identical raw occurrence. Equal
// spelling alone cannot establish that after a reader or voices change.
function lyNumberingTarget(line, token, word, numbering, voices) {
  if (!LY_NUMBERINGS.includes(numbering)) return null;
  const strip = !numbering.endsWith('+voices');
  const old = numbering.startsWith('v1')
    ? CMLyricTokens.v1GraderSpans(line, strip)
    : CMLyricTokens.readerLine(line, { stripParens: strip }).tokens;
  const current = CMLyricTokens.readerLine(line, { stripParens: !voices }).tokens;
  const a = old?.[token - 1];
  if (!a || (word !== null && a.text !== word)) return null;
  const matches = current
    .map((b, i) =>
      b.text === a.text && JSON.stringify(a.pieces) === JSON.stringify(b.pieces) ? i + 1 : null
    )
    .filter(Boolean);
  return matches.length === 1 ? matches[0] : null;
}
// A number saved under the current reader cut with no voices setting recorded
// -> its token now, or null. Each setting is a plausible basis unless it
// cannot have produced the row: the line has no such token under it, or --
// for a reading -- the saved word is not the token there. The row binds
// only when every plausible basis names the SAME characters (identity by
// raw pieces, never spelling), and is null when they part or none remains.
function lyBasisFreeTarget(line, token, word, voices) {
  const targets = [];
  for (const sung of [false, true]) {
    const at = CMLyricTokens.readerLine(line, { stripParens: !sung }).tokens[token - 1];
    if (!at || (word !== null && at.text !== word)) continue;
    targets.push(lyNumberingTarget(line, token, word, lyNumbering(sung), voices));
  }
  return targets.length && targets.every((t) => t && t === targets[0]) ? targets[0] : null;
}
// A rhyme groups / returns value with each `N.Tk` member moved to
// `target(line, k)`, or kept under its old number and flagged undecided when
// that is null. Separators, spacing and other members are untouched.
function lyRetargetMembers(value, model, target, marker = LY_MEMBER_UNDECIDED) {
  return value
    .split(/([;,])/)
    .map((part, i) => {
      if (i % 2) return part;
      const m = lyParseGroups(part)[0]?.[0];
      if (!m || m.bad || m.undecided || !lyNumberedMember(m)) return part;
      const line = model.sung[m.line - 1]?.text;
      const to = line == null ? null : target(line, Number(m.place.slice(1)));
      return to ? part.replace(/\.T\d+/i, `.T${to}`) : `${part} ${marker}`;
    })
    .join('');
}
const LY_READING_CUT = `cut ${LY_TOKEN_SCHEME}`;
const LY_READING_UNDECIDED = 'needs a decision: numbered under the earlier word cut';
const LY_MEMBER_UNDECIDED = '(numbered under the earlier cut)';
// Why a saved number binds no word, kept in the row so the refusal and the
// Review card can say the real reason (3PO #519 6196846873, Don 6196836953):
// - 'earlier': read as the earlier cut's, and no current word is exactly it;
// - 'voices': no sung-asides setting was saved, and the number names
//   different words with parenthesized words sung and not sung;
// - 'setting': counted under a saved setting, and no word under the page's
//   setting now covers exactly those characters.
const LY_READING_NO_VOICES = 'needs a decision: no saved setting for sung asides';
const LY_MEMBER_NO_VOICES = '(no saved setting for sung asides)';
const LY_MEMBER_NO_VOICES_EARLIER =
  '(numbered under the earlier cut with no saved setting for sung asides)';
const LY_MEMBER_SETTING = '(names no word under the current sung-asides setting)';
// Markers sit inside one member, so none may hold `,` `;` or ` — `.
const LY_MEMBER_MARKERS = [
  [LY_MEMBER_UNDECIDED, 'earlier'],
  [LY_MEMBER_NO_VOICES, 'voices'],
  [LY_MEMBER_NO_VOICES_EARLIER, 'voices'],
  [LY_MEMBER_SETTING, 'setting'],
];
const LY_MEMBER_CARRIED = '(carried across the word-cut change)';
const LY_GROUP_KEYS = ['rhyme groups', 'returns'];
// MIGRATION ONLY: the page's pre-release word cut, verbatim (its LY_TOKEN and
// lyTokens before reader scheme v2). Nothing but the rebinding reads it.
const LY_V1_MIGRATION_LETTER = /[A-Za-zÀ-ɏḀ-ỿ]/;
const LY_V1_MIGRATION_TOKEN = /(?:[A-Za-zÀ-ɏḀ-ỿ]|['-])+/g;
function lyV1MigrationTokens(text, voices = false) {
  let t = String(text).replace(/[’‘]/g, "'");
  if (!voices) t = t.replace(/\([^)]*\)/g, ' ');
  return (t.match(LY_V1_MIGRATION_TOKEN) || []).filter((w) => LY_V1_MIGRATION_LETTER.test(w));
}
// The same cut located in the line: [{ text, from, to }] in UTF-16 offsets,
// with a stripped aside blanked to its own length, or null when that does not
// reproduce lyV1MigrationTokens exactly.
function lyV1MigrationSpans(text, voices = false) {
  let t = String(text).replace(/[’‘]/g, "'");
  if (!voices) t = t.replace(/\([^)]*\)/g, (m) => ' '.repeat(m.length));
  const out = [];
  for (const m of t.matchAll(LY_V1_MIGRATION_TOKEN))
    if (LY_V1_MIGRATION_LETTER.test(m[0]))
      out.push({ text: m[0], from: m.index, to: m.index + m[0].length });
  const want = lyV1MigrationTokens(text, voices);
  return out.length === want.length && out.every((x, k) => x.text === want[k]) ? out : null;
}
// Word `token` of `line` under the earlier cut -> { token, word } under the
// current cut, or { blocked }. `word`, when given, is the word the saved
// number named; the rebinding refuses where the old number no longer names it.
function lyRebindSpan(line, token, voices, word = null) {
  const old = lyV1MigrationSpans(line, voices);
  return CMLyricTokens.rebindBySpan(
    line,
    token,
    word,
    old && old.map((s) => ({ text: s.text, pieces: [[s.from, s.to]] })),
    !voices
  );
}
// A number saved under the page's earlier cut, which recorded no voices
// setting -> { token, word } under the current cut, or { blocked }. Each
// setting that could have produced it (asides read or not, and -- for a
// reading -- holding the saved word there) is a plausible basis; it rebinds
// only when every plausible basis names the same characters, and otherwise
// is an open decision for the writer, never a guess from the page's voices
// setting of the moment (P-A, 2026-10-15).
function lyRebindSpanAgreed(line, token, voices, word = null) {
  const bases = [false, true]
    .map((v) => lyV1MigrationSpans(line, v))
    .filter(
      (spans) => spans && spans[token - 1] && (word === null || spans[token - 1].text === word)
    );
  if (!bases.length) return lyRebindSpan(line, token, voices, word);
  const at = bases[0][token - 1];
  if (bases.some((spans) => spans[token - 1].from !== at.from || spans[token - 1].to !== at.to))
    return {
      blocked:
        'its number names different words with asides read and without, and the row does not say which was meant',
      voices: true,
    };
  return CMLyricTokens.rebindBySpan(
    line,
    token,
    word,
    bases[0].map((s) => ({ text: s.text, pieces: [[s.from, s.to]] })),
    !voices
  );
}
// One saved reading -> { token, word } under the current cut, or { blocked }.
const lyRebindReading = (r, voices) => lyRebindSpanAgreed(r.line, r.token, voices, r.word);
// The grader's earlier cut of a line (CMLyricTokens.v1GraderSpans, scheme v1)
// and the current one, as the named places read them.
function lyLineCuts(text, voices) {
  const old = CMLyricTokens.v1GraderSpans(String(text), !voices);
  const cur = CMLyricTokens.readerLine(String(text), { stripParens: !voices }).tokens;
  return { old, cur };
}
// Whether the grader's earlier and current readings of a line differ
// anywhere: texts or characters of any word, the number of words (a line the
// earlier cut cannot be located in counts as changed), or -- on a line whose
// cut is identical -- the words the grader looks up there. The earlier end
// anchor looked up the words before the last re-cut from their space-joined
// text (CMLyricTokens.v1GraderLookup), which joins an enclitic the printed
// line sets apart (`Below the knap, 's a runnèn still;` looked up `knap's`;
// `When in that house M.P.'s divide,` looked up `P's`, P IY1 Z, where the
// current reader reads `'s` alone), so the rhyme's start moved on a line
// whose words did not. The current reader looks up its own tokens, so its
// lookup words are its cut.
function lyLineCutChanged(text, voices) {
  const { old, cur } = lyLineCuts(text, voices);
  if (
    !old ||
    old.length !== cur.length ||
    old.some(
      (o, k) => o.text !== cur[k].text || JSON.stringify(o.pieces) !== JSON.stringify(cur[k].pieces)
    )
  )
    return true;
  const looked = CMLyricTokens.v1GraderLookup(String(text), !voices);
  return looked.length !== cur.length || looked.some((w, k) => w !== cur[k].text);
}
// The words the page shows at a named place under each cut: { before, now }.
// Display only: the grader decides what the place binds.
function lyPlaceWords(text, voices, place) {
  const { old, cur } = lyLineCuts(text, voices);
  const pick = (toks) =>
    !toks.length
      ? '(no word)'
      : place === 'line'
        ? toks.join(' ')
        : place === 'head' || place === 'headrime'
          ? toks[0]
          : toks[toks.length - 1];
  return {
    before: old ? pick(old.map((t) => t.text)) : '(not readable)',
    now: pick(cur.map((t) => t.text)),
  };
}
// The characters an undecided saved reading could have named: [{ text,
// pieces }] in its line. A row with no saved sung-asides setting could mean
// the occurrence under either setting -- exactly the ones its Review card
// offers (lyVoicesCandidates) -- and a row counted under another setting
// names the token under that setting; any other is read under the earlier
// cut with the page's setting. Each must hold the saved word, as binding
// requires (lyBasisFreeTarget, lyRebindSpanAgreed): one that does not is no
// basis, so choosing it never settles an unrelated reading (3PO #519
// 6197775783).
function lyUndecidedSpans(r, voices) {
  const line = String(r.line);
  if (r.undecidedReason === 'voices')
    return lyVoicesCandidates(line, r.token, !r.cut, r.word).map((c) => ({
      text: c.word,
      pieces: c.pieces,
    }));
  if (r.undecidedReason === 'setting') {
    if (!LY_NUMBERINGS.includes(r.numbering)) return [];
    const strip = !r.numbering.endsWith('+voices');
    const toks = r.numbering.startsWith('v1')
      ? CMLyricTokens.v1GraderSpans(line, strip)
      : CMLyricTokens.readerLine(line, { stripParens: strip }).tokens;
    const at = toks?.[r.token - 1];
    return at && at.text === r.word ? [{ text: at.text, pieces: at.pieces }] : [];
  }
  const src = lyV1MigrationSpans(line, voices)?.[r.token - 1];
  return src && src.text === r.word ? [{ text: src.text, pieces: [[src.from, src.to]] }] : [];
}
// Whether a reading chosen for word `token` of `line` (current cut) settles
// the undecided saved reading `r`: same line, and that word's characters
// overlap one the saved number could have named (lyUndecidedSpans), so either
// occurrence a Review card offers settles it; or -- where no such occurrence
// is left -- the word it saved is that word.
function lyReadingSuperseded(r, line, token, voices) {
  if (!r.undecided || r.line !== line) return false;
  const tok = CMLyricTokens.readerLine(String(line), { stripParens: !voices }).tokens[token - 1];
  if (!tok) return false;
  const spans = lyUndecidedSpans(r, voices);
  if (spans.length)
    return spans.some((s) =>
      s.pieces.some(([c, d]) => tok.pieces.some(([a, b]) => a < d && c < b))
    );
  return lyTokens(String(r.word), true).some((w) => w.toLowerCase() === tok.text.toLowerCase());
}
// Whether a group member is a word place numbered under the current cut.
const lyNumberedMember = (m) => !m.bad && !m.undecided && /^T\d+$/.test(m.place || '');
// Members exempt from word-offset migration: bare `N` and explicit `N.line`
// in returns rows. The harness grades these with distinct return judges.
const lyWholeLineReturn = (key, m) =>
  key === 'returns' && !m.bad && (!m.explicit || m.place === 'line');
// A text's unmarked (legacy by compatibility policy) readings and word places
// rebound or flagged: -> { text, rebound, blocked: [{ i, word, line, reason }],
// moved: [{ kind, word, line, n, from, to }], carried: [{ key, n, place }] }
// (moved: a number the rebinding changed -- kind 'reading' with its exact
// line, or 'rhyme groups' / 'returns' with n, the sung line; carried: a named
// place kept named on a line whose cut changed). Pure. A marked row -- the
// current cut's, or one naming a cut this page does not read -- is left
// exactly as it is.
//
// WHAT IS REWRITTEN, AND WHAT KEEPS ITS BYTES. The page's text contract is
// that a [SETUP] row is part of the version a review answers for, byte for
// byte (lyCanonical: every row's raw text is hashed into lyIdentity, so a
// changed byte reads "Edited since review" and ends a certification), and
// that rows travel with the draft unchanged through saves, exports and Undo
// (this file's header). So the migration changes only what it must:
// - a reading row whose number moves is rewritten in its number alone and
//   gains `— cut v2`; one whose number names the same characters under both
//   cuts is left byte for byte, unmarked;
// - a rhyme groups / returns row is rewritten only where a member moved, was
//   flagged or was carried across a changed cut; then exactly those members
//   are respelled, every other member keeps the writer's own spelling
//   (`2.end` stays `2.end`) and separators and order, and the row gains
//   `— cut v2`. A row none of whose members changes keeps every byte.
// THE COST, stated (an owner decision may change it; it is not decided here):
// an unchanged row stays unmarked, so it stays legacy by compatibility
// policy. If the writer later edits its line so that the two cuts part, the
// next boundary (lyEnsureTokenScheme) reads that row under the earlier cut
// again and renumbers it -- right for a row saved under the earlier cut,
// wrong for one typed today without the mark -- and says so.
//
// RETURNS HAVE TWO CLASSES: bare `N` is a whole-line return handled by
// returns_check; explicit `N.line` is a placed return handled by
// placed_returns_check. These have distinct grading semantics. Both are
// exempt from word-offset migration. Other placed returns (`N.end`,
// `N.endword`, `N.head`, `N.headrime`, `N.T<k>`) follow the word-place rules.
// In a rhyme groups row a bare `N` is the default end -- a word place.
//
// `keys`, when given, limits the pass to the rhyme groups / returns rows of
// those keys (a form writer applying the policy to the rows it rewrites,
// lyFormBase); readings are then left alone.
function lyMigrateSavedReadings(text, keys = null) {
  const model = lyParse(text);
  const rows = model.text.split('\n');
  const out = { text: model.text, rebound: 0, blocked: [], moved: [], carried: [] };
  for (const r of keys ? [] : lySetupOf(model, 'reading')) {
    if (r.malformed || r.undecided || r.numbering || r.cut === LY_TOKEN_SCHEME) continue;
    const got = lyRebindReading(r, model.voices);
    if (got.blocked) {
      rows[r.i] = r.raw.replace(
        /\]$/,
        `${LY_DASH}${got.voices ? LY_READING_NO_VOICES : LY_READING_UNDECIDED}]`
      );
      out.blocked.push({ i: r.i, word: r.word, line: r.line, reason: got.blocked });
    } else if (got.token !== r.token || got.word !== r.word) {
      out.moved.push({ kind: 'reading', word: r.word, line: r.line, from: r.token, to: got.token });
      rows[r.i] = r.raw
        .replace(
          /^(\[SETUP\s+—\s+reading\s+—\s+)token \d+ "(?:[^"\\]|\\.)*"/i,
          (_, head) => `${head}token ${got.token} ${lyQuote(got.word)}`
        )
        .replace(
          /\]$/,
          `${LY_DASH}numbering ${lyNumbering(model.voices)}${LY_DASH}${LY_READING_CUT}]`
        );
      out.rebound++;
    }
  }
  for (const key of keys || LY_GROUP_KEYS)
    for (const d of lySetupOf(model, key)) {
      if (d.cut || d.numbering) continue;
      // The members in the order lyParseGroups reads them, each with its new
      // spelling where it changes.
      const respelled = new Map();
      let k = -1;
      for (const m of lyParseGroups(d.value).flat()) {
        k++;
        if (m.bad || m.undecided || m.unknownCut) continue;
        // A whole-line return names no word: nothing to rebind or carry.
        if (lyWholeLineReturn(key, m)) continue;
        const row = model.sung[m.line - 1];
        if (!lyNumberedMember(m)) {
          // A named place is a definition: kept named, and flagged where the
          // line's reading changed anywhere; left as written where it did not.
          if (!m.carried && row && lyLineCutChanged(row.text, model.voices)) {
            respelled.set(k, `${m.raw} ${LY_MEMBER_CARRIED}`);
            out.carried.push({ key, n: m.line, place: m.place });
          }
          continue;
        }
        const from = Number(m.place.slice(1));
        const got = row
          ? lyRebindSpanAgreed(row.text, from, model.voices)
          : { blocked: `line ${m.line} is not in the draft` };
        if (got.blocked) {
          respelled.set(
            k,
            `${m.line}.${m.place} ${got.voices ? LY_MEMBER_NO_VOICES_EARLIER : LY_MEMBER_UNDECIDED}`
          );
          out.blocked.push({ i: d.i, word: m.raw, line: row ? row.text : '', reason: got.blocked });
        } else if (got.token !== from) {
          respelled.set(k, `${m.line}.T${got.token}`);
          out.moved.push({ kind: key, word: got.word, n: m.line, from, to: got.token });
          out.rebound++;
        }
      }
      if (respelled.size)
        rows[d.i] = lyRespellGroupRow(rows[d.i], d.value, respelled, model.voices);
    }
  out.text = rows.join('\n');
  return out;
}
// One rhyme groups / returns row with the members `respelled` names (member
// index, in lyParseGroups' order -> new spelling) replaced in place: every
// other member, separator and space as the writer wrote it, then the mark.
function lyRespellGroupRow(row, value, respelled, voices = false) {
  let k = -1;
  const members = value
    .split(/([;,])/)
    .map((part, j) => {
      if (j % 2 || !part.trim()) return part;
      k++;
      if (!respelled.has(k)) return part;
      const lead = /^\s*/.exec(part)[0];
      const trail = /\s*$/.exec(part)[0];
      return lead + respelled.get(k) + trail;
    })
    .join('');
  const end = row.lastIndexOf(']');
  const at = row.lastIndexOf(value, end);
  // The row records the voices setting its word numbers were counted under
  // (P-A, 2026-10-15), exactly as a form-written row does (lyGroupRow):
  // `— cut v2` alone says which reader cut, not whether asides were read.
  return `${row.slice(0, at)}${members}${lyGroupNumberingMark(members, voices)}${LY_DASH}${LY_READING_CUT}${row.slice(at + value.length)}`;
}
// A writer offset in `before` -> the same character in `after`, for a
// rewrite that replaced whole rows in place (the migration never adds or
// removes a row). A rewritten row is aligned MEMBER BY MEMBER (3PO #519
// 6164274432, BB8 66cef416): both spellings are cut into units at the
// separators the rows use (`;`, `,`, ` — `, `]`), the longest common run of
// units is kept (lyAlignUnits), and every character of a unit present in
// both maps onto itself, so a selection inside an unchanged member -- the
// `2.end` after a renumbered `1.T2`, before an appended `— cut v2` -- keeps
// its exact characters. Inside a changed stretch the shared start and end
// of that stretch keep theirs; an offset in its replaced middle goes to the
// stretch's end. An offset between two kept characters that the rewrite
// pulled apart follows its side of the selection: a selection's END stays
// with the character before it (one ending on `2.end` does not grow over
// the inserted mark) and its START with the character after it (one
// starting at `,4` does not grow over a note appended to the member before);
// a caret is an end.
function lyMapOffset(before, after, pos, side = 'end') {
  const a = before.split('\n'),
    b = after.split('\n');
  if (a.length !== b.length) return Math.min(pos, after.length);
  let oa = 0,
    ob = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i],
      y = b[i];
    if (pos <= oa + x.length) return ob + (x === y ? pos - oa : lyMapInRow(x, y, pos - oa, side));
    oa += x.length + 1;
    ob += y.length + 1;
  }
  return after.length;
}
const LY_UNIT_CUT = /([;,\]]| — )/;
// The units of a row, with their offsets: [{ text, at }].
function lyRowUnits(row) {
  const out = [];
  let at = 0;
  for (const text of row.split(LY_UNIT_CUT)) {
    if (text) out.push({ text, at });
    at += text.length;
  }
  return out;
}
// Match members independently when the migration preserves their comma/semicolon
// boundaries. This keeps repeated members anchored and makes long declaration
// lists linear in the number of members, rather than allocating a row-wide matrix.
// Other large stretches use a linear-space LCS, never a lossy head/tail fallback.
function lyAlignUnits(u, v) {
  const n = u.length,
    m = v.length;
  const pairs = [];
  if (n === 1) {
    const q = v.findIndex((x) => x.text === u[0].text);
    return q < 0 ? [] : [[0, q]];
  }
  if (n * m > 250000) {
    const cuts = (units) => units.flatMap((x, i) => (/^[;,]$/.test(x.text) ? [i] : []));
    const a = cuts(u),
      b = cuts(v);
    if (a.length && a.length === b.length && a.every((p, i) => u[p].text === v[b[i]].text)) {
      let p = 0,
        q = 0;
      for (let i = 0; i <= a.length; i++) {
        const pe = a[i] ?? n,
          qe = b[i] ?? m;
        for (const [x, y] of lyAlignUnits(u.slice(p, pe), v.slice(q, qe)))
          pairs.push([p + x, q + y]);
        if (i < a.length) pairs.push([pe, qe]);
        p = pe + 1;
        q = qe + 1;
      }
      return pairs;
    }
    // Hirschberg's split: only two score rows are resident at a time.
    const scores = (left, right) => {
      let prev = new Int32Array(right.length + 1);
      for (const x of left) {
        const next = new Int32Array(right.length + 1);
        for (let j = 0; j < right.length; j++)
          next[j + 1] = x.text === right[j].text ? prev[j] + 1 : Math.max(prev[j + 1], next[j]);
        prev = next;
      }
      return prev;
    };
    const mid = Math.floor(n / 2);
    const left = scores(u.slice(0, mid), v);
    const right = scores(u.slice(mid).reverse(), v.slice().reverse());
    let split = 0;
    for (let j = 1; j <= m; j++)
      if (left[j] + right[m - j] > left[split] + right[m - split]) split = j;
    return lyAlignUnits(u.slice(0, mid), v.slice(0, split)).concat(
      lyAlignUnits(u.slice(mid), v.slice(split)).map(([p, q]) => [p + mid, q + split])
    );
  }
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let p = n - 1; p >= 0; p--)
    for (let q = m - 1; q >= 0; q--)
      L[p][q] = u[p].text === v[q].text ? L[p + 1][q + 1] + 1 : Math.max(L[p + 1][q], L[p][q + 1]);
  let p = 0,
    q = 0;
  while (p < n && q < m) {
    if (u[p].text === v[q].text && L[p][q] === L[p + 1][q + 1] + 1) pairs.push([p++, q++]);
    else if (L[p + 1][q] >= L[p][q + 1]) p++;
    else q++;
  }
  return pairs;
}
// One rewritten row: offset `col` in `x` -> offset in `y`.
function lyMapInRow(x, y, col, side = 'end') {
  const u = lyRowUnits(x),
    v = lyRowUnits(y);
  // Kept characters: where[c] = the offset in y of x's character c, or -1.
  const where = new Int32Array(x.length).fill(-1);
  // Each stretch between kept units is aligned by its own shared start and
  // end; `ends` records, for each character in a replaced middle, where its
  // stretch ends in y.
  const ends = new Int32Array(x.length).fill(-1);
  const gap = (xa, xb, ya, yb) => {
    let s = 0;
    while (xa + s < xb && ya + s < yb && x[xa + s] === y[ya + s]) {
      where[xa + s] = ya + s;
      s++;
    }
    let e = 0;
    while (xb - 1 - e >= xa + s && yb - 1 - e >= ya + s && x[xb - 1 - e] === y[yb - 1 - e]) {
      where[xb - 1 - e] = yb - 1 - e;
      e++;
    }
    for (let c = xa + s; c < xb - e; c++) ends[c] = yb - e;
    return yb - e;
  };
  let xa = 0,
    ya = 0;
  const stretchEnd = [];
  for (const [p, q] of [...lyAlignUnits(u, v), [u.length, v.length]]) {
    const xb = p < u.length ? u[p].at : x.length,
      yb = q < v.length ? v[q].at : y.length;
    stretchEnd.push([xa, xb, gap(xa, xb, ya, yb)]);
    if (p < u.length) {
      for (let c = 0; c < u[p].text.length; c++) where[u[p].at + c] = v[q].at + c;
      xa = u[p].at + u[p].text.length;
      ya = v[q].at + v[q].text.length;
    }
  }
  const left = col > 0 && where[col - 1] >= 0 ? where[col - 1] + 1 : -1;
  const right = col < x.length && where[col] >= 0 ? where[col] : -1;
  if (left >= 0 && (side !== 'start' || right < 0)) return left;
  if (right >= 0) return right;
  if (col < x.length && ends[col] >= 0) return ends[col];
  // Between two replaced characters at the very end of a stretch.
  for (const [s0, s1, end] of stretchEnd) if (col >= s0 && col <= s1) return end;
  return y.length;
}
// THE MIGRATION RUNS AT A BOUNDARY, NEVER WHILE THE WRITER TYPES. The typing
// refresh (lyRefresh, 120 ms after a keystroke) reads the draft and never
// rewrites it: rewriting the textarea under a writer moved the caret, so the
// next keystrokes landed elsewhere -- after `]` of a [SETUP] row, which then
// stopped being a declaration. The boundaries are where text arrives whole
// or leaves the page:
// - OPEN: a session restored at start, a saved session loaded or copied, a
//   session file imported (src/workbench.js, src/app.js call uiLyricsOpened
//   before they record the history step), the Lyrics page mounted;
// - IMPORT: a .txt file and a Library working copy (lyImportText,
//   lyLibraryActivate);
// - SEND: before anything is sent to the writer (lySubmitLyricsAction,
//   uiLyricContext), so no unmarked row is ever sent as if it were numbered
//   under the current cut.
// Undo and Redo are not boundaries, and neither is a writer's reply.
// UNDO, EXACTLY (the existing contract, unchanged: no step of its own). At an
// open or import the migrated text IS the text that step records, so Undo
// returns to the draft from before the open or import -- never to the
// unmarked rows -- and Redo returns to the migrated text. At an in-page
// boundary (`how` 'page': mount, send) the writer's own text is recorded
// first exactly as leaving the editor records it (pushHistory, which merges
// an identical step), and the migrated text then replaces that same step:
// Undo goes to the step before the writer's text, not to a step that holds
// the unmarked rows. Undo and Redo restore a step exactly and never run the
// migration; a step that still holds an unmarked row (text typed or pasted
// in by hand since the last boundary) is migrated at the next boundary.
// THE WRITER'S STATE: the selection (start, end and direction) is mapped
// through the rewrite onto the same characters (lyMapOffset); every
// declaration is kept (rebound, flagged or carried, never dropped); tool
// drafts and the page context are not touched. -> true when it rewrote.
function lyEnsureTokenScheme(how = 'page') {
  const draft = lyDraft();
  if (!draft) return false;
  const before = draft.value;
  const done = lyMigrateSavedReadings(before);
  if (done.text === before) return false;
  if (how === 'page' && typeof pushHistory === 'function') {
    uiSaveLyrics();
    pushHistory();
  }
  const sel = [draft.selectionStart, draft.selectionEnd, draft.selectionDirection];
  draft.value = done.text;
  if (Number.isInteger(sel[0]) && Number.isInteger(sel[1]) && draft.setSelectionRange)
    draft.setSelectionRange(
      lyMapOffset(before, done.text, sel[0], sel[0] === sel[1] ? 'end' : 'start'),
      lyMapOffset(before, done.text, sel[1], 'end'),
      sel[2] || 'none'
    );
  if (LY.songCaret) {
    const [start, end, scroll] = LY.songCaret;
    LY.songCaretMapped = true;
    LY.songCaret = [
      lyMapOffset(before, done.text, start, start === end ? 'end' : 'start'),
      lyMapOffset(before, done.text, end, 'end'),
      scroll,
    ];
  }
  lyRecordRenumbered(done);
  uiSaveLyrics();
  if (how === 'page' && Array.isArray(app.history) && app.history[app.historyIndex] !== undefined)
    app.history[app.historyIndex] = JSON.stringify(sessionSnapshot());
  lyMigrationToast(done);
  return true;
}
// The shell's open boundary (see lyEnsureTokenScheme): the caller records the
// history step after this returns, so the step holds the migrated text.
function uiLyricsOpened() {
  return lyEnsureTokenScheme('open');
}
// A .txt import: migrated before it is committed, so its one Undo step holds
// the migrated text and Undo restores the draft from before the import.
function lyImportText(text, message) {
  const done = lyMigrateSavedReadings(text);
  lyRecordRenumbered(done);
  lyCommit(done.text, message);
  if (done.text !== text) lyMigrationToast(done);
}
// What a migration did, said twice: a toast now (lyMigrationToast), and --
// for every number it changed -- the Review card listing each one, which
// stays until the writer dismisses it (lyRenumberedCheck).
//
// EVERY MOVED NUMBER STAYS REVIEWABLE (3PO #519 6164274432). The record keeps
// each entry whole -- the word as saved, every sung line it names, the old
// and new number -- with no cap on words, lines or entries: the list is no
// longer than the draft's own [SETUP] rows make it, and nothing is evicted.
// The card shows the first LY_RENUMBERED_PAGE entries and a "Show all" that
// lists every one; Dismiss is the only thing that removes them.
//
// THE RECORD BELONGS TO ITS DRAFT. It is kept in the page context
// (app.lyricMeta.renumbered: { draftId, items }), never in the song or its
// identity, and travels with that draft: in each Undo/Redo step
// (src/app.js lyricMetaHistory restores the step's own record with its
// text and draftId, so Undo never shows one draft's evidence over another),
// in the session's saves and exports, and in the draft's Library record
// (lyLibraryCapture saves it only under the draftId it was recorded for).
// A later import of ANOTHER draft (a Library working copy, a saved draft
// opened from History) shows that draft's own record instead: this draft's
// stays with this draft -- reachable through Undo and by reopening it --
// and is never carried into, or saved under, the other one. A .txt import
// replaces the text of the same draft, so its entries join the same list.
const LY_RENUMBERED_PAGE = 20;
function lyRenumbered(meta = lyMeta()) {
  const r = meta.renumbered;
  return r && Array.isArray(r.items) ? r : null;
}
function lyRecordRenumbered(done) {
  if (!done.moved.length) return;
  const meta = lyMeta();
  const model = lyParse(done.text);
  const draftId = meta.draftId || null;
  const prior = lyRenumbered(meta);
  // Another draft's record is never extended into this one (a record made
  // before this draft had an id is this draft's).
  const sameDraft = prior && (!prior.draftId || prior.draftId === draftId);
  const kept = sameDraft ? prior.items : [];
  const items = [
    ...kept,
    ...done.moved.map((m) => ({
      kind: m.kind,
      word: String(m.word),
      // A reading names its line by text; the card names the sung lines.
      n: m.kind === 'reading' ? model.sung.filter((x) => x.text === m.line).map((x) => x.n) : [m.n],
      from: m.from,
      to: m.to,
    })),
  ];
  meta.renumbered = {
    ...(draftId ? { draftId } : {}),
    items,
    ...(sameDraft && prior.more ? { more: prior.more } : {}),
  };
}
// The migration's summary in words, for a toast or a commit message:
// -> { text, blocked } ('' when it moved, carried and blocked nothing).
function lyMigrationText(done) {
  const moved = done.moved.length
    ? ` ${uiCount(done.moved.length, 'saved word number')} without the current cut mark ${done.moved.length === 1 ? 'was' : 'were'} renumbered to the current word cut, on the same characters: ${done.moved
        .slice(0, 3)
        .map((m) => `“${m.word}” word ${m.from} → ${m.to}`)
        .join(
          ', '
        )}${done.moved.length > 3 ? ', …' : ''}. Review lists ${done.moved.length === 1 ? 'it' : 'each one'} until you dismiss it.`
    : '';
  // A named place on a line whose reading changed is kept, and said.
  const carried = done.carried.length
    ? ` ${uiCount(done.carried.length, 'rhyme or return place')} ${done.carried.length === 1 ? 'sits' : 'sit'} on a line whose word cut changed and ${done.carried.length === 1 ? 'was' : 'were'} kept as declared: check ${done.carried.length === 1 ? 'it' : 'each'} in Review.`
    : '';
  if (done.blocked.length)
    return {
      text: `${uiCount(done.blocked.length, 'saved word number')} without the current cut mark ${done.blocked.length === 1 ? 'needs' : 'need'} your decision before the writer can be asked.${moved}${carried}`,
      blocked: true,
    };
  return { text: (moved + carried).trim(), blocked: false };
}
function lyMigrationToast(done) {
  const said = lyMigrationText(done);
  if (said.text) showToast(said.text, said.blocked ? 'error' : undefined);
}
// The Review card listing every renumbered word number, or null: the first
// page of entries, or every one after "Show all" (LY.renumberedAll).
function lyRenumberedCheck() {
  const r = lyRenumbered();
  const items = r ? r.items : [];
  const lost = Number(r?.more) || 0; // counted by an earlier version of this page
  if (!items.length && !lost) return null;
  const at = (m) => (Array.isArray(m.n) && m.n.length ? `, ${lyLineRef(m.n)}` : '');
  const what = (m) =>
    `${m.kind === 'reading' ? 'the reading for' : m.kind === 'returns' ? 'a declared return on' : 'a rhyme link on'} “${m.word}”${at(m)}: word ${m.from} → ${m.to}`;
  const all = !!LY.renumberedAll || items.length <= LY_RENUMBERED_PAGE;
  const shown = all ? items : items.slice(0, LY_RENUMBERED_PAGE);
  const rest = items.length - shown.length;
  return {
    id: 'renumbered',
    tone: 'note',
    category: 'Pronunciation',
    title: `${uiCount(items.length + lost, 'saved word number')} renumbered to the current word cut`,
    where: 'Setup',
    lines: [],
    text: `Each was saved without the current cut mark, so it was read as numbered under the earlier word cut and moved to the word of the current cut on exactly the same characters: ${shown.map(what).join('; ')}${rest ? `; and ${rest} more (Show all lists every one)` : ''}${lost ? `. ${lost} earlier ${lost === 1 ? 'entry was' : 'entries were'} dropped by an earlier version of this page before this list kept every entry` : ''}. Nothing else about them changed. Dismiss this when you have checked them.`,
    actions: [
      ...(items.length > LY_RENUMBERED_PAGE
        ? [
            [
              'ly-renumbered-all',
              all ? 'Show fewer' : `Show all ${items.length}`,
              all ? 'chevron-up' : 'chevron-down',
              '',
            ],
          ]
        : []),
      ['ly-renumbered-dismiss', 'Dismiss', 'x', ''],
    ],
  };
}
// THE FORM WRITERS APPLY THE SAME POLICY BEFORE THEY MARK (BB8 66cef416,
// 3PO #519 6166169619). The rhymes and repeats forms (link, remove link,
// placed return, declare exact repeat, remove undecided links) and Keep /
// Remove on a carried member rewrite a rhyme groups / returns row and write
// it back marked `— cut v2` (lyGroupRow, lySetSetup). An unmarked row is
// legacy by compatibility policy and is read under the earlier cut at every
// boundary; marking it without that reading made the binding depend on
// whether a form or a send came first (`1.T4` -> `my` against `1.T5` ->
// `love`). So a writer reads `key`'s rows through this: every unmarked row of
// that key rebound by span or kept undecided, and its named places carried,
// exactly as lyMigrateSavedReadings does at a boundary -- and only then are
// the groups taken and the row marked. The typing refresh still never
// rewrites the draft; this runs only inside a form's own commit, which is
// already one Undo step. -> { text, groups, done }; `done` is recorded on the
// Review card by the caller when it commits (lyFormMigrated).
function lyFormBase(key, text = lyDraft().value) {
  const done = lyMigrateSavedReadings(text, [key]);
  const groups = lySetupOf(lyParse(done.text), key).flatMap((d) => lyRowGroups(d));
  return { text: done.text, groups, done };
}
// A form's commit message with what its policy pass did, recorded first on
// the Review card (so the history step the commit records holds it).
function lyFormMigrated(done, message) {
  if (!done || done.text === undefined) return message;
  lyRecordRenumbered(done);
  const said = lyMigrationText(done).text;
  return said ? `${message} ${said}` : message;
}
const lyUndecidedReadings = (model) => lySetupOf(model, 'reading').filter((r) => r.undecided);
// The occurrences a saved number could name under each sung-asides setting,
// each shown marked in its line: [{ sung, word, pieces, shown }], one per setting
// that has such a token -- and, given `word` (a reading's saved word), that
// token is that word. `earlier`: the number is the earlier cut's. Shown
// side by side; the page never picks one for the writer.
function lyVoicesCandidates(line, token, earlier, word = null) {
  const out = [];
  for (const sung of [false, true]) {
    let at = null;
    if (earlier) {
      const sp = lyV1MigrationSpans(line, sung)?.[token - 1];
      if (sp) at = { word: sp.text, from: sp.from, to: sp.to, pieces: [[sp.from, sp.to]] };
    } else {
      const t = CMLyricTokens.readerLine(line, { stripParens: !sung }).tokens[token - 1];
      if (t)
        at = {
          word: t.text,
          from: t.pieces[0][0],
          to: t.pieces[t.pieces.length - 1][1],
          pieces: t.pieces,
        };
    }
    if (at && (word === null || at.word === word))
      out.push({
        sung,
        word: at.word,
        pieces: at.pieces,
        shown: `${line.slice(0, at.from)}[${line.slice(at.from, at.to)}]${line.slice(at.to)}`,
      });
  }
  return out;
}
// What a reading with no saved sung-asides setting could have named, for its
// Review card: the occurrences of its saved word, or that there is none.
function lyReadingCandidatesText(r) {
  const cands = lyVoicesCandidates(r.line, r.token, !r.cut, r.word);
  return cands.length
    ? `its number names different occurrences under each (${lyCandidatesText(cands)}). It was not moved to either`
    : `its number names “${r.word}” under neither setting. It was not moved to another word`;
}
const lyCandidatesText = (cands) =>
  cands
    .map((c) => `with parenthesized words ${c.sung ? 'sung' : 'not sung'}: “${c.shown}”`)
    .join('; ');
// Where a saved row sits, for the writer: its document line.
const lySetupRowRef = (i, cap = false) =>
  `${cap ? 'The' : 'the'} [SETUP] row on document line ${i + 1}`;
// Word places in rhyme links and declared returns kept under their earlier
// number, or in a row marked with a cut this page does not read:
// -> [{ key, i, raw, unknownCut }].
const lyUndecidedMembers = (model) =>
  LY_GROUP_KEYS.flatMap((key) =>
    lySetupOf(model, key).flatMap((d) =>
      lyRowGroups(d)
        .flat()
        .filter((m) => m.undecided)
        .map((m) => ({
          key,
          i: d.i,
          raw: lyMemberSpelling(m),
          unknownCut: m.unknownCut,
          reason: m.undecidedReason || 'earlier',
          line: m.line,
          place: m.place,
        }))
    )
  );
// The message every send path stops on while a saved word number is undecided.
function lyUndecidedRefusal(model) {
  const all = lyUndecidedReadings(model);
  const unset = all.filter((r) => !r.unknownCut && r.undecidedReason === 'voices');
  const moved = all.filter((r) => !r.unknownCut && r.undecidedReason === 'setting');
  const open = all.filter(
    (r) => !r.unknownCut && r.undecidedReason !== 'voices' && r.undecidedReason !== 'setting'
  );
  const foreign = all.filter((r) => r.unknownCut);
  const members = lyUndecidedMembers(model);
  const unsetM = members.filter((m) => !m.unknownCut && m.reason === 'voices');
  const movedM = members.filter((m) => !m.unknownCut && m.reason === 'setting');
  const lost = members.filter(
    (m) => !m.unknownCut && m.reason !== 'voices' && m.reason !== 'setting'
  );
  const alien = members.filter((m) => m.unknownCut);
  if (!all.length && !members.length) return '';
  const parts = [];
  // No sung-asides setting was saved, and the number names different words
  // with parenthesized words sung and not sung (P-A).
  for (const r of unset)
    parts.push(
      `${lySetupRowRef(r.i, true)}, token ${r.token} “${r.word}”, has no saved setting for whether parenthesized words were sung. Its number can refer to different occurrences.`
    );
  for (const m of unsetM)
    parts.push(
      `${lySetupRowRef(m.i, true)}, ${m.line}.${m.place}, has no saved setting for whether parenthesized words were sung. Its number can refer to different occurrences.`
    );
  if (unset.length || unsetM.length)
    parts.push('In Review, choose the occurrence you intended, or remove this declaration.');
  for (const r of moved)
    parts.push(
      `${lySetupRowRef(r.i, true)}, token ${r.token} “${r.word}”, was counted under another setting for sung parenthesized words, and no word now covers exactly the characters it named. Choose it again, or remove it, in Review.`
    );
  for (const m of movedM)
    parts.push(
      `${lySetupRowRef(m.i, true)}, ${m.line}.${m.place}, was counted under another setting for sung parenthesized words, and no word now covers exactly the characters it named. Remove that link and declare it again, in Review.`
    );
  if (open.length)
    parts.push(
      `${uiCount(open.length, 'reading')} saved without the current cut mark (${open.map((r) => `“${r.word}”`).join(', ')}) could not be matched to a word of the current text. Choose each reading again for the word you meant, or remove it, in Review.`
    );
  if (foreign.length)
    parts.push(
      `${uiCount(foreign.length, 'reading')} (${foreign.map((r) => `“${r.word}” marked cut ${r.unknownCut}`).join(', ')}) ${foreign.length === 1 ? 'is' : 'are'} marked with a word cut this page does not read; it accepts only “${LY_READING_CUT}”. Choose each reading again, or remove it, in Review.`
    );
  if (lost.length)
    parts.push(
      `${uiCount(lost.length, 'word place')} in a rhyme link or declared return saved without the current cut mark (${lost.map((m) => m.raw).join(', ')}) could not be matched to a word of the current text. Remove that link and declare it again, in Review.`
    );
  if (alien.length)
    parts.push(
      `${uiCount(alien.length, 'word place')} in a rhyme link or declared return (${alien.map((m) => `${m.raw} marked cut ${m.unknownCut}`).join(', ')}) ${alien.length === 1 ? 'is' : 'are'} marked with a word cut this page does not read; it accepts only “${LY_READING_CUT}”. Remove that link and declare it again, in Review.`
    );
  return `Nothing was sent. ${parts.join(' ')}`;
}
const lyNorm = (s) => lyTokens(s, true).map((w) => w.toLowerCase().replace(/’/g, "'"));
const lyCap = (s) => (s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s);
const lyQuote = (s) => JSON.stringify(String(s));
const lyUnquote = (s) => {
  try {
    const v = JSON.parse(s);
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
};

// [NAME — n lines — m bars of X/Y, pickup] → its declared parts. Anything the
// page does not recognise is kept verbatim in `extra`, never dropped, and
// `order` remembers where each part stood so a rewrite puts it back there.
//
// THE RHYTHM PART, EVERY SHAPE THE PAGE WRITES (2026-09-30). The rhythm form
// saves a meter with no bar count, so the serializer writes
// [CHORUS — 4 lines — 6/8]; this parser used to read that as an unknown
// extra (meter null), so a saved 6/8 stopped being the declared meter the
// moment it was saved. Every combination the form accepts reads back:
//   6/8 · 6/8, pickup 1 beat · 4 bars · 4 bars of 6/8 · 4 bars of 6/8, pickup
// A pickup is kept verbatim. A zero count, meter or unit is not a declaration
// (nothing is 0 bars or 0/8) and stays an extra, as written.
const LY_METER = /^([1-9]\d?)\/([1-9]\d?)$/;
function lyParseRhythm(p) {
  let m;
  const bars = (n) => Number(n) >= 1 && Number(n) <= 999;
  if ((m = /^(\d{1,3}) bars? of (\d+\/\d+)(?:,\s*(.+))?$/i.exec(p)))
    return bars(m[1]) && LY_METER.test(m[2])
      ? { bars: Number(m[1]), meter: m[2], pickup: m[3] ? m[3].trim() : null }
      : null;
  if ((m = /^(\d+\/\d+)(?:,\s*(.+))?$/.exec(p)))
    return LY_METER.test(m[1])
      ? { bars: null, meter: m[1], pickup: m[2] ? m[2].trim() : null }
      : null;
  if ((m = /^(\d{1,3}) bars?(?:,\s*(.+))?$/i.exec(p)))
    return bars(m[1])
      ? { bars: Number(m[1]), meter: null, pickup: m[2] ? m[2].trim() : null }
      : null;
  return null;
}
function lyParseHeader(raw) {
  const parts = raw.slice(1, -1).split(/\s+—\s+/);
  const head = {
    name: parts[0].trim(),
    lines: null,
    bars: null,
    meter: null,
    pickup: null,
    extra: [],
    order: [],
  };
  for (const part of parts.slice(1)) {
    const p = part.trim();
    let m, r;
    if (!head.order.includes('lines') && (m = /^(\d{1,3}) lines?$/i.exec(p))) {
      head.lines = Number(m[1]);
      head.order.push('lines');
    } else if (!head.order.includes('rhythm') && (r = lyParseRhythm(p))) {
      Object.assign(head, r);
      head.order.push('rhythm');
    } else {
      head.order.push(head.extra.length);
      head.extra.push(p);
    }
  }
  return head;
}
function lyRhythmText(h) {
  if (h.bars == null && !h.meter) return '';
  return (
    (h.bars != null ? uiCount(h.bars, 'bar') : '') +
    (h.meter ? `${h.bars != null ? ' of ' : ''}${h.meter}` : '') +
    (h.pickup ? `, ${h.pickup}` : '')
  );
}
function lyHeaderText(h) {
  // Parts in the order the header had them; a part it did not have goes where
  // the harness writes it (size after the name, rhythm after the size).
  const order = (h.order || []).filter((k) => typeof k !== 'number' || k < (h.extra || []).length);
  if (h.lines != null && !order.includes('lines')) order.unshift('lines');
  if ((h.bars != null || h.meter) && !order.includes('rhythm'))
    order.splice(order.includes('lines') ? order.indexOf('lines') + 1 : 0, 0, 'rhythm');
  (h.extra || []).forEach((_, k) => order.includes(k) || order.push(k));
  const parts = [h.name || 'SECTION'];
  for (const k of order) {
    if (k === 'lines') h.lines != null && parts.push(uiCount(h.lines, 'line'));
    else if (k === 'rhythm') lyRhythmText(h) && parts.push(lyRhythmText(h));
    else parts.push(h.extra[k]);
  }
  return `[${parts.join(LY_DASH)}]`;
}
function lyParseSetup(raw) {
  const body = raw.slice(1, -1).replace(/^SETUP\s+—\s+/i, '');
  const cut = body.indexOf(LY_DASH);
  const key = (cut < 0 ? body : body.slice(0, cut)).trim().toLowerCase();
  const value = cut < 0 ? '' : body.slice(cut + LY_DASH.length).trim();
  const item = { key, value, raw };
  if (key === 'reading') {
    const m = /^token (\d+) ("(?:[^"\\]|\\.)*") in ("(?:[^"\\]|\\.)*")(?:\s+—\s+(.*))?$/.exec(
      value
    );
    if (m) {
      item.token = Number(m[1]);
      item.word = lyUnquote(m[2]);
      item.line = lyUnquote(m[3]);
      const rest = (m[4] || '').split(/\s+—\s+/).map((s) => s.trim());
      item.state = 'choice';
      for (const r of rest) {
        if (r.toLowerCase() === LY_READING_UNDECIDED)
          Object.assign(item, { undecided: true, undecidedReason: 'earlier' });
        else if (r.toLowerCase() === LY_READING_NO_VOICES)
          Object.assign(item, { undecided: true, undecidedReason: 'voices' });
        else if (/^numbering \S+$/i.test(r)) item.numbering = r.slice(10).toLowerCase();
        else if (/^cut \S+$/i.test(r)) item.cut = r.slice(4).toLowerCase();
        else if (/^needs a (dictionary )?choice$/i.test(r)) item.state = 'choice';
        else if (/^uncertain$/i.test(r)) item.state = 'uncertain';
        else if (/^(dictionary|declared)$/i.test(r)) item.basis = r.toLowerCase();
        else if (/^source:\s*/i.test(r)) item.source = r.replace(/^source:\s*/i, '');
        else if (/^[A-Z]{1,2}[012]?(\s+[A-Z]{1,2}[012]?)*$/.test(r)) item.phones = r.split(/\s+/);
      }
      if (item.phones && item.basis && item.source) item.state = 'declared';
      // A cut this page does not read binds nothing and is never rewritten.
      if (item.cut && item.cut !== LY_TOKEN_SCHEME) {
        item.undecided = true;
        item.unknownCut = item.cut;
      }
    } else item.malformed = true;
  }
  if (LY_GROUP_KEYS.includes(key)) {
    // The cut a row's word places are numbered under follows its members;
    // the tools receive the members alone.
    const m = /^(.*?)\s+—\s+cut (\S+)$/i.exec(value);
    if (m) {
      item.value = m[1].trim();
      item.cut = m[2].toLowerCase();
      if (item.cut !== LY_TOKEN_SCHEME) item.unknownCut = item.cut;
    }
  }
  if (LY_GROUP_KEYS.includes(key)) {
    const m = /^(.*?)\s+—\s+numbering (\S+)$/i.exec(item.value);
    if (m) {
      item.value = m[1].trim();
      item.numbering = m[2].toLowerCase();
      if (!LY_NUMBERINGS.includes(item.numbering)) item.unknownCut = item.numbering;
    }
  }
  if (key === 'hook') item.line = lyUnquote(value);
  return item;
}

// The whole draft, read once per change.
function lyParse(text) {
  const rows = String(text || '').split('\n');
  const model = {
    text: String(text || ''),
    rows: [],
    sung: [],
    sections: [],
    setup: [],
    stamps: [],
    voices: false,
  };
  const hasHeaders = rows.some((r) => {
    const t = r.trim();
    return LY_BRACKET.test(t) && !LY_STAMP.test(t) && !LY_SETUP.test(t);
  });
  let section = null;
  const open = (header, row) => {
    section = { index: model.sections.length, header, headerRow: row, rows: [], sung: [] };
    model.sections.push(section);
    return section;
  };
  rows.forEach((raw, i) => {
    const t = raw.trim();
    const row = { i, raw, text: t, kind: 'sung' };
    model.rows.push(row);
    if (!t) {
      row.kind = 'blank';
      // Without headers a blank line ends a stanza.
      if (!hasHeaders && section && section.sung.length) section = null;
      if (section) section.rows.push(row);
      return;
    }
    if (LY_BRACKET.test(t)) {
      if (LY_STAMP.test(t)) {
        row.kind = 'stamp';
        const m = /seed (\d+)/i.exec(t),
          e = /exit (\d+)/i.exec(t);
        model.stamps.push({
          i,
          raw: t,
          kind: LY_STAMP.exec(t)[1].toUpperCase(),
          seed: m ? Number(m[1]) : null,
          exit: e ? Number(e[1]) : null,
        });
      } else if (LY_SETUP.test(t)) {
        row.kind = 'setup';
        const item = lyParseSetup(t);
        item.i = i;
        model.setup.push(item);
      } else {
        row.kind = 'section';
        row.section = open(lyParseHeader(t), row);
      }
      return;
    }
    if (!section) open(null, null);
    row.n = model.sung.length + 1;
    row.section = section;
    section.rows.push(row);
    section.sung.push(row);
    model.sung.push(row);
  });
  model.sections = model.sections.filter((s) => s.header || s.sung.length);
  model.sections.forEach((s, k) => (s.index = k));
  model.voices = model.setup.some(
    (s) => s.key === 'voices' && /sung/i.test(s.value) && !/unsung/i.test(s.value)
  );
  // A `— cut v2` row that records no voices setting (as this page's
  // migration wrote rows before 2026-10-15, P-A) names a number nobody can
  // say was counted with asides read or not. Its bytes are kept. It binds
  // where BOTH settings name the same characters of the line -- then which
  // one was meant cannot matter -- and is otherwise an open decision for the
  // writer: never read under the voices setting the page happens to have
  // now, which silently bound `my` for `love` after a toggle.
  for (const r of model.setup.filter(
    (s) => s.key === 'reading' && s.cut === LY_TOKEN_SCHEME && !s.numbering && !s.undecided
  )) {
    const target = lyBasisFreeTarget(r.line, r.token, r.word, model.voices);
    if (!target) Object.assign(r, { undecided: true, undecidedReason: 'voices' });
    else {
      r.token = target;
      r.numbering = lyNumbering(model.voices);
    }
  }
  for (const d of model.setup.filter(
    (s) => LY_GROUP_KEYS.includes(s.key) && s.cut === LY_TOKEN_SCHEME && !s.numbering
  )) {
    if (!/\b\d+\.T\d+\b/i.test(d.value)) continue;
    d.value = lyRetargetMembers(
      d.value,
      model,
      (line, token) => lyBasisFreeTarget(line, token, null, model.voices),
      LY_MEMBER_NO_VOICES
    );
    d.numbering = lyNumbering(model.voices);
    d.basisFree = true;
  }
  for (const r of model.setup.filter((s) => s.key === 'reading' && s.numbering)) {
    const target = lyNumberingTarget(r.line, r.token, r.word, r.numbering, model.voices);
    if (!target) Object.assign(r, { undecided: true, undecidedReason: 'setting' });
    else {
      r.numberingToken = r.token;
      r.token = target;
    }
  }
  // Read each marked row into the current page coordinate before forms or
  // send combine rows. Raw saved text retains its original source marker.
  for (const d of model.setup.filter(
    (s) => LY_GROUP_KEYS.includes(s.key) && s.numbering && !s.basisFree
  )) {
    d.value = lyRetargetMembers(
      d.value,
      model,
      (line, token) => lyNumberingTarget(line, token, null, d.numbering, model.voices),
      LY_MEMBER_SETTING
    );
  }
  // Names: a bare repeated name is numbered (Verse 1, Verse 2) as it reads.
  const seen = {},
    totals = {};
  for (const s of model.sections) {
    const base = s.header ? lyCap(s.header.name) : 'Stanza';
    s.base = base;
    totals[base] = (totals[base] || 0) + 1;
  }
  for (const s of model.sections) {
    seen[s.base] = (seen[s.base] || 0) + 1;
    s.title = !s.header
      ? `${hasHeaders ? 'Untitled' : 'Stanza'} ${hasHeaders ? '' : seen[s.base]}`.trim()
      : /\d/.test(s.base) || totals[s.base] === 1
        ? s.base
        : `${s.base} ${seen[s.base]}`;
    s.key = s.sung.map((r) => r.text).join('\n');
  }
  // Exact returns: a section whose sung lines equal an earlier one's.
  const firstByKey = new Map();
  for (const s of model.sections) {
    if (!s.sung.length) continue;
    const first = firstByKey.get(s.key);
    if (first) {
      s.returnOf = first;
      first.uses = (first.uses || 1) + 1;
    } else firstByKey.set(s.key, s);
  }
  // Repeated lines, anywhere.
  const byText = new Map();
  for (const r of model.sung) byText.set(r.text, [...(byText.get(r.text) || []), r.n]);
  model.repeats = [...byText]
    .filter(([, ns]) => ns.length > 1)
    .map(([text, ns]) => ({ text, lines: ns }));
  return model;
}

// ── Page state (private to this file) ─────────────────────────────────────
const LY = {
  model: null,
  text: null,
  // The inspector's tab and the selected tool ('' is the Tools index).
  tab: 'tools',
  tool: '',
  // Below 960px one view at a time: 'song' | 'tools' | 'writer' | 'review'.
  mobile: 'song',
  // The Lyrics container's width class: 'wide' (>=1280), 'compact'
  // (960-1279), 'narrow' (<960). Set from the container, not the window.
  size: 'wide',
  outline: true,
  railOpen: false,
  // The sung line the caret or selection is on (0: none).
  activeLine: 0,
  caretRow: 0,
  menu: '',
  find: { q: '', at: 0, open: false },
  // The latest lyric reply this page saw, and what the draft was when it was asked.
  run: null,
  // Per-decision results: id → { state: 'applied'|'failed'|'kept', message }.
  outcomes: {},
  own: {}, // decision id → the user's own line while writing it
  picks: { readingLine: 0, readingToken: 0, linkMembers: [] },
  prefs: null,
  titleEdit: false,
  briefEdit: false,
  // Run review waiting on pending tool changes; a live run blocking new work.
  gate: null,
  conflict: null,
  // The latest review this page started: its request and the version it asked about.
  analysis: null,
  // The latest read-only progress record for a running request.
  progress: null,
  // Tool result cards from a named request: rhymes and pronunciation options.
  results: {},
  // Persistence as the page last observed it (shell autosave).
  notice: '',
};
const LY_TONES = {
  issue: { label: 'Issues', one: 'Issue', icon: 'circle-alert' },
  input: { label: 'Needs input', one: 'Needs input', icon: 'circle-question-mark' },
  note: { label: 'Notes', one: 'Note', icon: 'info' },
};
// The inspector's tabs and the Tools index, in their fixed order.
const LY_TABS = [
  ['tools', 'Tools', 'wrench'],
  ['writer', 'Writer', 'user'],
  ['review', 'Review', 'file-check'],
  ['history', 'History', 'history'],
];
const LY_TOOLS = [
  ['form-story', 'Form & story', 'Section order and story jobs', 'book-open'],
  ['rhymes', 'Rhymes', 'Declared rhyme links', 'link'],
  ['rhythm', 'Rhythm', 'Meter and line placement', 'music'],
  ['pronunciation', 'Pronunciation', 'Sung-word readings', 'message-circle'],
  ['repeats-voices', 'Repeats & voices', 'Exact repeats and sung asides', 'users'],
  ['word-rules', 'Word rules', 'Required and avoided phrases', 'list'],
];
// Friendly story vocabulary → the harness's own atoms and junctions.
const LY_ATOM_LABELS = {
  ESTABLISH: 'Set the scene',
  COMPLICATE: 'Introduce a complication',
  TURN: 'Change direction',
  DWELL: 'Stay with a moment',
  ANCHOR: 'Return to the central idea',
  JUDGE: 'Take a position',
  RESOLVE: 'Resolve',
  DEPART: 'Depart',
};
const LY_JUNCTION_LABELS = {
  THEREFORE: 'Because',
  BUT: 'But',
  AND_THEN: 'Then',
  MEANWHILE: 'Meanwhile',
  ELABORATE: 'Expand',
  JUXTAPOSE: 'Contrast',
};
// Rhyme relation: the friendly choice → the exact declared relation.
const LY_RELATIONS = [
  ['', 'Any'],
  ['class:RHYME', 'Rhyme'],
  ['class:ASSONANCE', 'Assonance'],
  ['class:CONSONANCE', 'Consonance'],
];

const lyDraft = () => $ui('lyrics-draft');
const lySungTexts = (model) => model.sung.map((r) => r.text);
const lySame = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const lySetupOf = (model, key) => model.setup.filter((s) => s.key === key);
const lyLineRef = (ns) =>
  ns.length === 1
    ? `line ${ns[0]}`
    : ns.length === 2
      ? `lines ${ns[0]} and ${ns[1]}`
      : `lines ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`;
const lySectionOfLine = (model, n) => model.sung[n - 1]?.section || null;

// A rhyme-group or returns spelling ('1,3.head;2,4') → groups of members.
// Each member remembers whether its place was WRITTEN (`explicit`): `2.end`
// names the end explicitly, a bare `2` names none. They are different
// declarations, and they do not always bind alike: in a rhyme groups row
// the grader reads a bare `2` at the default end, as it reads `2.end`; in a
// returns row a bare `2` is a WHOLE-LINE return (the line returns, no word
// named) while `2.end` is a PLACED return (the word at the end returns), and
// the harness refuses one class holding both (lyWholeLineReturn). So every
// path that writes a member back (the row text, the wire, Keep, the forms,
// section reorder and assembly) keeps the one the writer used.
function lyParseGroups(value) {
  return String(value || '')
    .split(';')
    .map((g) =>
      g
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
        .map((m) => {
          const mm = /^(\d+)(?:\.(end|endword|head|headrime|line|T\d{1,3}))?$/.exec(m);
          if (mm) return { line: Number(mm[1]), place: mm[2] || 'end', explicit: !!mm[2], raw: m };
          // A word place that binds no word, with the reason it was kept
          // under its number (lyMigrateSavedReadings, lyParse).
          for (const [marker, reason] of LY_MEMBER_MARKERS) {
            const at = m.lastIndexOf(` ${marker}`);
            const old =
              at > 0 && at + marker.length + 1 === m.length
                ? /^(\d+)\.(T\d{1,3})$/.exec(m.slice(0, at).trim())
                : null;
            if (old)
              return {
                line: Number(old[1]),
                place: old[2],
                explicit: true,
                raw: m,
                undecided: true,
                marker,
                undecidedReason: reason,
              };
          }
          // A named place kept across the word-cut change, until the writer
          // keeps or removes it.
          const kept =
            /^(\d+)(?:\.(end|endword|head|headrime|line))?\s+\(carried across the word-cut change\)$/.exec(
              m
            );
          if (kept)
            return {
              line: Number(kept[1]),
              place: kept[2] || 'end',
              explicit: !!kept[2],
              raw: m.replace(/\s+\(.*$/, ''),
              carried: true,
            };
          // A member of a row marked with a cut this page does not read.
          const alien =
            /^(\d+)(?:\.(end|endword|head|headrime|line|T\d{1,3}))?\s+\(marked cut (\S+?): not read here\)$/.exec(
              m
            );
          if (alien)
            return {
              line: Number(alien[1]),
              place: alien[2] || 'end',
              explicit: !!alien[2],
              raw: m,
              undecided: true,
              unknownCut: alien[3].toLowerCase(),
            };
          return { raw: m, bad: true };
        })
    )
    .filter((g) => g.length);
}
// A member as the writer spelled its place (`2.end` stays `2.end`, `2` stays
// `2`), on the line it is on now. A member the page made has no written
// place where it is the end (`explicit` unset): the page's own spelling is
// the bare line. Members are never respelled for show, and `.end` is never
// added to a bare member or dropped from an explicit one.
const lyMemberSpelling = (m) =>
  m.place && (m.place !== 'end' || m.explicit) ? `${m.line}.${m.place}` : `${m.line}`;
// Groups -> the row's text, each member's state included.
const lyGroupsText = (groups) =>
  groups
    .map((g) =>
      g
        .map((m) =>
          m.bad
            ? m.raw
            : m.unknownCut
              ? `${lyMemberSpelling(m)} (marked cut ${m.unknownCut}: not read here)`
              : m.undecided
                ? `${m.line}.${m.place} ${m.marker || LY_MEMBER_UNDECIDED}`
                : m.carried
                  ? `${lyMemberSpelling(m)} ${LY_MEMBER_CARRIED}`
                  : lyMemberSpelling(m)
        )
        .join(',')
    )
    .join(';');
// Groups -> what the tools receive: members alone, no page state.
const lyGroupsWire = (groups) =>
  groups.map((g) => g.map((m) => (m.bad ? m.raw : lyMemberSpelling(m))).join(',')).join(';');
// One rhyme groups / returns row as this page writes it: always marked.
const lyGroupNumberingMark = (value, voices) =>
  /\b\d+\.T\d+\b/i.test(value) ? `${LY_DASH}numbering ${lyNumbering(voices)}` : '';
const lyGroupRow = (key, groups, voices = false) =>
  `[SETUP${LY_DASH}${key}${LY_DASH}${lyGroupsText(groups)}${lyGroupNumberingMark(lyGroupsText(groups), voices)}${LY_DASH}${LY_READING_CUT}]`;
// A row's groups; a row marked with a cut this page does not read holds
// members that bind nothing (each says the cut it was marked with), so a
// form that merges rows never launders them into the current cut.
function lyRowGroups(d) {
  const groups = lyParseGroups(d.value);
  if (d.unknownCut)
    for (const m of groups.flat())
      if (!m.bad && !m.unknownCut) Object.assign(m, { undecided: true, unknownCut: d.unknownCut });
  return groups;
}
function lyMemberWord(model, m) {
  // A word place kept under its earlier number binds no word of this text.
  if (m.undecided) return null;
  const row = model.sung[m.line - 1];
  if (!row) return null;
  const toks = lyTokens(row.text, model.voices);
  if (/^T\d+$/.test(m.place)) return toks[Number(m.place.slice(1)) - 1] || null;
  if (m.place === 'head' || m.place === 'headrime') return toks[0] || null;
  if (m.place === 'line') return row.text;
  return toks[toks.length - 1] || null;
}
// A member's place in words. In a returns row a bare `N` is a whole-line
// return, never "last rhyme" (lyWholeLineReturn).
const lyMemberLabel = (m, key = 'rhyme groups') =>
  lyWholeLineReturn(key, m)
    ? LY_PLACES.line
    : /^T\d+$/.test(m.place)
      ? `word ${m.place.slice(1)}`
      : LY_PLACES[m.place] || m.place;

// A declared melody (lyric-harness/MELODY.md), written in the draft without
// brackets inside the line: '4/4 — groups 2+2 — 2 bars — subdivision 2 —
// 432.5:3 rest:1 487.2:4'. Returns the harness JSON shape, or an error that
// names the rule it breaks; nothing is simplified or filled in.
function lyParseMelody(value) {
  const parts = String(value || '')
    .split(/\s+—\s+/)
    .map((p) => p.trim());
  const out = { meter: null, bars: null, subdivision: null, notes: [] };
  for (const p of parts) {
    let m;
    if ((m = /^(\d{1,2})\/(\d{1,2})$/.exec(p)))
      out.meter = { beats: Number(m[1]), unit: Number(m[2]), groups: null };
    else if ((m = /^groups? ([\d+]+)$/i.exec(p))) out.groups = m[1].split('+').map(Number);
    else if ((m = /^(\d+) bars?$/i.exec(p))) out.bars = Number(m[1]);
    else if ((m = /^subdivision (\d+)$/i.exec(p))) out.subdivision = Number(m[1]);
    else if (p)
      out.notes = p.split(/\s+/).map((tok) => {
        const n = /^(rest|[\d.]+):(\d+)$/i.exec(tok);
        return n
          ? { pitch_hz: /^rest$/i.test(n[1]) ? null : Number(n[1]), ticks: Number(n[2]) }
          : { bad: tok };
      });
  }
  const fail = (error) => ({ error });
  if (!out.meter) return fail('Declare the meter as beats/unit, e.g. 4/4.');
  const groups =
    out.groups || (out.meter.beats % 3 === 0 ? Array(out.meter.beats / 3).fill(3) : null);
  if (
    !groups ||
    groups.some((g) => g !== 2 && g !== 3) ||
    groups.reduce((t, g) => t + g, 0) !== out.meter.beats
  )
    return fail(`Beat groups must be 2s and 3s that sum to ${out.meter.beats} (e.g. groups 2+2).`);
  out.meter.groups = groups;
  if (!Number.isInteger(out.bars) || out.bars < 1)
    return fail('Bars per line must be a whole number of at least 1.');
  if (![1, 2, 4].includes(out.subdivision)) return fail('Subdivision is 1, 2 or 4 ticks per beat.');
  const bad = out.notes.find(
    (n) =>
      n.bad ||
      !(n.pitch_hz === null || (Number.isFinite(n.pitch_hz) && n.pitch_hz > 0)) ||
      !Number.isInteger(n.ticks) ||
      n.ticks < 1
  );
  if (!out.notes.length || bad)
    return fail(
      `Write each event as hertz:ticks or rest:ticks${bad?.bad ? ` (“${bad.bad}” is not one)` : ''}.`
    );
  if (!out.notes.some((n) => n.pitch_hz !== null))
    return fail('A phrase needs at least one pitched note.');
  const want = out.bars * out.meter.beats * out.subdivision;
  const got = out.notes.reduce((t, n) => t + n.ticks, 0);
  if (got !== want)
    return fail(
      `The events last ${got} ticks; ${out.bars} × ${out.meter.beats} × ${out.subdivision} = ${want} are needed.`
    );
  delete out.groups;
  return { melody: out };
}
const lyMelodyText = (m) =>
  [
    `${m.meter.beats}/${m.meter.unit}`,
    `groups ${m.meter.groups.join('+')}`,
    uiCount(m.bars, 'bar'),
    `subdivision ${m.subdivision}`,
    m.notes.map((n) => `${n.pitch_hz === null ? 'rest' : n.pitch_hz}:${n.ticks}`).join(' '),
  ].join(LY_DASH);
// The story plan (the harness's `narrative`): one atom per sung section, a
// junction before every atom after the first. A record, not a gate.
const LY_ATOMS = [
  'ESTABLISH',
  'COMPLICATE',
  'TURN',
  'DWELL',
  'ANCHOR',
  'JUDGE',
  'RESOLVE',
  'DEPART',
];
const LY_JUNCTIONS = ['THEREFORE', 'BUT', 'AND_THEN', 'MEANWHILE', 'ELABORATE', 'JUXTAPOSE'];
function lyParseNarrative(value) {
  const v = String(value || '').trim();
  if (/^off$/i.test(v)) return { off: true, steps: [] };
  const steps = v.split(',').map((p, k) => {
    const [atom, junction] = p.trim().split('/');
    return {
      atom,
      junction: junction || null,
      ok: LY_ATOMS.includes(atom) && (k === 0 ? !junction : LY_JUNCTIONS.includes(junction)),
    };
  });
  return { steps, ok: steps.every((x) => x.ok) };
}

// Declared line placement: 'line:bar:beat:duration' rows, ';'-separated
// (bar and line whole numbers; beat and duration in beats, decimals allowed).
function lyParsePlacement(value) {
  return String(value || '')
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const m = /^(\d+):(\d+):(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(r);
      return m && Number(m[4]) > 0 && Number(m[3]) > 0
        ? { line: Number(m[1]), bar: Number(m[2]), beat: Number(m[3]), duration: Number(m[4]) }
        : { raw: r, bad: true };
    });
}
const lyPlacementText = (rows) =>
  rows
    .slice()
    .sort((a, b) => a.line - b.line)
    .map((r) => `${r.line}:${r.bar}:${r.beat}:${r.duration}`)
    .join(';');
// Each section's bar span, only when every section before it declares bars.
function lyBarSpans(model) {
  const spans = new Map();
  let cursor = 1;
  for (const s of model.sections) {
    if (s.header?.bars == null) break;
    spans.set(s.index, [cursor, cursor + s.header.bars - 1]);
    cursor += s.header.bars;
  }
  return spans;
}

// Everything declared on this page, as the exact values the lyric tools take,
// so the writer never has to reinterpret a [SETUP] line.
function lyDeclarationsOf(model) {
  const one = (key) => lySetupOf(model, key)[0]?.value;
  const d = {};
  if (one('title')) d.title = lyTitleOf(model);
  const hook = lySetupOf(model, 'hook')[0];
  if (hook?.line) d.hook_line = hook.line;
  if (one('narrative')) d.narrative = one('narrative');
  const mel = one('melody') && lyParseMelody(one('melody'));
  if (mel?.melody) d.melody = mel.melody; // the tools take this object as a JSON string
  if (one('relation')) d.relation = one('relation');
  // A link holding a word place kept under its earlier number, or marked
  // with a cut this page does not read, is never sent as if it bound a word:
  // it travels as needing a decision (and the send paths stop). A named place
  // carried across the word-cut change is sent as declared, without the
  // page's note.
  for (const [key, field] of [
    ['rhyme groups', 'groups'],
    ['returns', 'returns'],
  ]) {
    const row = lySetupOf(model, key)[0];
    const value = row?.value;
    if (!value) continue;
    const groups = lyRowGroups(row);
    const open = groups.filter((g) => g.some((m) => m.undecided));
    if (!open.length && !groups.some((g) => g.some((m) => m.carried))) d[field] = value;
    else {
      const kept = groups.filter((g) => !g.some((m) => m.undecided));
      if (kept.length) d[field] = lyGroupsWire(kept);
      if (open.length) d[`${field}_need_decision`] = open.map((g) => lyGroupsText([g]));
    }
  }
  if ([d.groups, d.returns].some((value) => /\b\d+\.T\d+\b/i.test(value || '')))
    d.numbering = lyNumbering(model.voices);
  if (model.voices) d.voices = true;
  const placed = lySetupOf(model, 'placement')
    .flatMap((x) => lyParsePlacement(x.value))
    .filter((r) => !r.bad);
  if (placed.length) d.line_placement = placed; // declared blueprint lines: bar, beat, duration in beats
  const all = lySetupOf(model, 'reading').filter((r) => !r.malformed);
  const readings = all.filter((r) => !r.undecided);
  // A reading saved before this release that could not be rebound is never
  // left out as if absent: it travels as undecided (and the send paths stop).
  const undecided = all
    .filter((r) => r.undecided)
    .map((r) => ({ line: r.line, saved_token: r.token, word: r.word }));
  if (undecided.length) d.readings_need_decision = undecided;
  const chosen = readings
    .filter((r) => r.state === 'declared')
    .map((r) => ({
      line: r.line,
      token: r.numberingToken || r.token,
      word: r.word,
      phones: r.phones,
      basis: r.basis,
      source: r.source,
      // A cut-v2 row with no recorded voices setting reaches here only when
      // both settings name the same characters (lyParse); it never borrows
      // the page's current setting for a number counted under another.
      ...(r.numbering ? { numbering: r.numbering } : {}),
    }));
  if (chosen.length) d.pronunciations = chosen;
  const open = readings
    .filter((r) => r.state !== 'declared')
    .map((r) => ({
      line: r.line,
      token: r.token,
      word: r.word,
      state: r.state === 'uncertain' ? 'uncertain' : 'needs a choice',
    }));
  if (open.length) d.readings_not_chosen = open;
  const req = lySetupOf(model, 'require').map((x) => x.value),
    avoid = lySetupOf(model, 'avoid').map((x) => x.value);
  if (req.length) d.must_include = req;
  if (avoid.length) d.avoid = avoid;
  return d;
}
function lyWriterDeclarations(model) {
  const d = lyDeclarationsOf(model);
  return Object.keys(d).length
    ? `\n\nDeclared on the Lyrics page (exact values for the lyric tools; never guess a reading that is not chosen):\n${JSON.stringify(d)}`
    : '';
}

// Title in a line: the harness's normalised word-subsequence test, either way.
function lyContainsRun(hay, needle) {
  if (!needle.length || needle.length > hay.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++)
    if (needle.every((w, k) => hay[i + k] === w)) return true;
  return false;
}

// ── Local checks: exact facts about the current text ───────────────────────
function lyLocalChecks(model) {
  const items = [];
  const add = (item) => items.push({ source: 'page', ...item });
  // Word numbers a migration renumbered, until the writer dismisses the card.
  const renumbered = lyRenumberedCheck();
  if (renumbered) add(renumbered);
  for (const s of model.sections) {
    if (s.header && s.header.lines != null && s.header.lines !== s.sung.length)
      add({
        id: `count:${s.index}`,
        tone: 'issue',
        category: 'Structure',
        title: `${s.title} declares ${uiCount(s.header.lines, 'line')} but has ${s.sung.length}`,
        where: s.title,
        lines: s.sung.map((r) => r.n),
        text: 'The header states the section size the writer plans against. Change the header or the lines so they agree.',
        actions: [
          [
            'ly-fix-count',
            `Set the header to ${uiCount(s.sung.length, 'line')}`,
            'pencil',
            s.index,
          ],
        ],
      });
  }
  // Near returns: a section named like an earlier one whose words differ.
  for (const s of model.sections) {
    if (!s.header || s.returnOf || !s.sung.length) continue;
    const first = model.sections.find(
      (o) =>
        o.index < s.index &&
        o.base.toLowerCase() === s.base.toLowerCase() &&
        o.sung.length &&
        !o.returnOf
    );
    if (!first || first.key === s.key) continue;
    const diff = s.sung.filter((r, k) => first.sung[k]?.text !== r.text).map((r) => r.n);
    const sameSize = first.sung.length === s.sung.length;
    // Only a mostly repeated section reads as a return that changed; two
    // verses with different words are simply two verses.
    if (diff.length * 2 > Math.max(first.sung.length, s.sung.length)) continue;
    add({
      id: `near:${s.index}`,
      tone: 'note',
      category: 'Return',
      title: `${s.title} differs from ${first.title}`,
      where: s.title,
      lines: diff.length ? diff : s.sung.map((r) => r.n),
      text: sameSize
        ? `${uiCount(diff.length, 'line')} differ (${lyLineRef(diff)}). Only identical sections count as an exact return; a changed line may be intentional.`
        : `${first.title} has ${uiCount(first.sung.length, 'line')}; this one has ${s.sung.length}. Only identical sections count as an exact return.`,
      actions: [
        ['ly-make-return', `Make it match ${first.title}`, 'repeat', `${s.index}:${first.index}`],
      ],
    });
  }
  // Readings bound to exact line text.
  for (const r of lySetupOf(model, 'reading')) {
    if (r.undecided) {
      const lines = model.sung.filter((x) => x.text === r.line).map((x) => x.n);
      add({
        id: `reading:${r.i}`,
        tone: 'input',
        category: 'Pronunciation',
        title: r.unknownCut
          ? `The reading for “${r.word}” is marked with a word cut this page does not read`
          : r.undecidedReason === 'voices'
            ? `The reading for “${r.word}”, token ${r.token} in “${r.line}”, has no saved sung-asides setting`
            : `The reading for “${r.word}”, token ${r.token} in “${r.line}”, needs your decision`,
        where: lines.length ? lyLineRef(lines) : 'No matching line',
        lines,
        text: r.unknownCut
          ? `It is marked “cut ${r.unknownCut}”; this page reads only “${LY_READING_CUT}”, so its number binds no word. Choose the reading again for the word you meant, or remove it. Until then nothing is sent to the writer.`
          : r.undecidedReason === 'voices'
            ? `${lySetupRowRef(r.i, true)} saved token ${r.token} for “${r.word}” in the line “${r.line}”, with no setting for whether parenthesized words were sung, and ${lyReadingCandidatesText(r)}. Choose the reading again on the occurrence you intended, or remove this declaration. Until then nothing is sent to the writer.`
            : r.undecidedReason === 'setting'
              ? `${lySetupRowRef(r.i, true)} saved token ${r.token} for “${r.word}” in the line “${r.line}”, counted under another setting for sung parenthesized words, and no word under the current setting covers exactly the characters it named, so it was not moved to another one. Choose the reading again for the word you meant, or remove it. Until then nothing is sent to the writer.`
              : `${lySetupRowRef(r.i, true)} saved token ${r.token} for “${r.word}” in the line “${r.line}”. It was read as numbered under the earlier word cut, and no word of the current cut is exactly the occurrence it named, so it was not moved to another one. Choose the reading again for the word you meant, or remove it. Until then nothing is sent to the writer.`,
        actions: [
          ['ly-tool', 'Choose again', 'message-circle', 'pronunciation'],
          ['ly-remove-setup', 'Remove it', 'trash-2', r.i],
        ],
      });
      continue;
    }
    if (r.malformed) {
      add({
        id: `reading:${r.i}`,
        tone: 'input',
        category: 'Pronunciation',
        title: 'A reading declaration cannot be read',
        where: `Setup line ${r.i + 1}`,
        lines: [],
        text: r.raw,
        actions: [['ly-remove-setup', 'Remove it', 'trash-2', r.i]],
      });
      continue;
    }
    const lines = model.sung.filter((x) => x.text === r.line).map((x) => x.n);
    const toks = lyTokens(r.line, model.voices);
    if (!lines.length || toks[r.token - 1] !== r.word)
      add({
        id: `reading:${r.i}`,
        tone: 'input',
        category: 'Pronunciation',
        title: `The reading for “${r.word}” no longer matches the draft`,
        where: lines.length ? lyLineRef(lines) : 'No matching line',
        lines,
        text: !lines.length
          ? 'Its exact line is no longer in the draft. A changed line never inherits an old reading: choose again for the new text, or remove it.'
          : `Word ${r.token} of that line is now “${toks[r.token - 1] || 'missing'}”.`,
        actions: [
          ['ly-tool', 'Choose again', 'message-circle', 'pronunciation'],
          ['ly-remove-setup', 'Remove it', 'trash-2', r.i],
        ],
      });
    else if (r.state === 'choice')
      add({
        id: `reading:${r.i}`,
        tone: 'input',
        category: 'Pronunciation',
        title: `Choose how “${r.word}” is read`,
        where: lyLineRef(lines),
        lines,
        text: 'A reading is required here and none is chosen. Supply one with its source, or ask the writer for the dictionary options.',
        actions: [['ly-tool', 'Choose a reading', 'message-circle', 'pronunciation']],
      });
    else if (r.state === 'uncertain')
      add({
        id: `reading:${r.i}`,
        tone: 'note',
        category: 'Pronunciation',
        title: `“${r.word}” is marked uncertain`,
        where: lyLineRef(lines),
        lines,
        text: 'Kept as an explicit uncertainty; nothing assumes a reading for it.',
        actions: [['ly-tool', 'Open pronunciation', 'message-circle', 'pronunciation']],
      });
  }
  // Rhyme links and declared returns that point outside the draft.
  for (const key of LY_GROUP_KEYS)
    for (const d of lySetupOf(model, key)) {
      const what = key === 'returns' ? 'A declared return' : 'A rhyme link';
      const tool = [
        'ly-tool',
        key === 'returns' ? 'Open repeats' : 'Open rhymes',
        key === 'returns' ? 'repeat' : 'link',
        key === 'returns' ? 'repeats-voices' : 'rhymes',
      ];
      const groups = lyRowGroups(d);
      // Named places kept across the word-cut change: one notice each, until
      // the writer keeps or removes it. Non-blocking: the member is sent.
      groups.forEach((g, gi) =>
        g.forEach((m, mi) => {
          if (!m.carried) return;
          const row = model.sung[m.line - 1];
          const ids = `${key}|${d.i}|${gi}|${mi}`;
          if (lyWholeLineReturn(key, m)) {
            // A whole-line return names no word, so the word cut cannot move
            // what it names; the note was written by an earlier version of
            // this page. No word is shown and no place is claimed for it.
            add({
              id: `${key}:${d.i}:carried:${gi}:${mi}`,
              tone: 'note',
              category: 'Return',
              title: `${what} member, line ${m.line} · whole line, carries a word-cut note it does not need`,
              where: `Line ${m.line}`,
              lines: row ? [m.line] : [],
              text: `Line ${m.line} is declared to return as a whole line. A whole-line return names no word, so the word-cut change does not move what it names. Keep the link to drop the note, or remove it.`,
              actions: [
                ['ly-carried-keep', 'Keep the link', 'check', ids],
                ['ly-carried-remove', 'Remove it', 'trash-2', ids],
              ],
            });
            return;
          }
          const shown = row ? lyPlaceWords(row.text, model.voices, m.place) : null;
          const place = lyMemberLabel(m, key);
          add({
            id: `${key}:${d.i}:carried:${gi}:${mi}`,
            tone: 'note',
            category: key === 'returns' ? 'Return' : 'Rhyme',
            title: `${what} member, line ${m.line} · ${place}, was carried across the word-cut change`,
            where: `Line ${m.line}`,
            lines: row ? [m.line] : [],
            text: shown
              ? `Line ${m.line}'s word cut changed in this release, so what its ${place} reads may have changed, even where the word shown is the same (a rhyme can start in an earlier word). On this page it shows “${shown.before}” under the earlier cut and “${shown.now}” under the current one. That is the page's display, not the grader's evidence: the grader decides what the place binds. Keep the link if it still means what you declared, or remove it.`
              : `Line ${m.line} is not in the draft.`,
            actions: [
              ['ly-carried-keep', 'Keep the link', 'check', ids],
              ['ly-carried-remove', 'Remove it', 'trash-2', ids],
            ],
          });
        })
      );
      const alien = groups.flat().filter((m) => m.unknownCut);
      if (alien.length)
        add({
          id: `${key}:${d.i}:unknown-cut`,
          tone: 'input',
          category: key === 'returns' ? 'Return' : 'Rhyme',
          title: `${what} is marked with a word cut this page does not read`,
          where: lyLineRef([...new Set(alien.map((m) => m.line))]),
          lines: [...new Set(alien.map((m) => m.line))].filter((n) => model.sung[n - 1]),
          text: `${alien.map(lyMemberSpelling).join(', ')} ${alien.length === 1 ? 'is' : 'are'} marked “cut ${[...new Set(alien.map((m) => m.unknownCut))].join('”, “cut ')}”; this page reads only “${LY_READING_CUT}”, so ${alien.length === 1 ? 'it binds' : 'they bind'} no word. Remove the link and declare it again. Until then nothing is sent to the writer.`,
          actions: [['ly-drop-undecided', 'Remove the link', 'trash-2', key], tool],
        });
      // One card per undecided group, each naming its own reason and
      // removing only its own group (3PO #519 6196846873).
      groups.forEach((g, gi) => {
        const kept = g.filter((m) => m.undecided && !m.unknownCut);
        if (!kept.length) return;
        const shown = g.map((m) => (m.undecided ? `${m.line}.${m.place}` : lyMemberSpelling(m)));
        const why = (m) => {
          const line = model.sung[m.line - 1]?.text;
          const k = Number(String(m.place).slice(1));
          if (m.undecidedReason === 'voices')
            return `${m.line}.${m.place} has no saved setting for whether parenthesized words were sung, and its number names different occurrences under each${line ? ` (${lyCandidatesText(lyVoicesCandidates(line, k, m.marker !== LY_MEMBER_NO_VOICES))})` : ''}`;
          if (m.undecidedReason === 'setting')
            return `${m.line}.${m.place} was counted under another setting for sung parenthesized words, and no word under the current setting covers exactly the characters it named`;
          return `${m.line}.${m.place} was numbered under the earlier word cut, and no word of the current cut is exactly the word it named`;
        };
        add({
          id: `${key}:${d.i}:undecided:${gi}`,
          tone: 'input',
          category: key === 'returns' ? 'Return' : 'Rhyme',
          title: `${what} ${shown.join(', ')} needs your decision`,
          where: lyLineRef([...new Set(kept.map((m) => m.line))]),
          lines: [...new Set(kept.map((m) => m.line))].filter((n) => model.sung[n - 1]),
          text: `${lySetupRowRef(d.i, true)} links ${shown.join(', ')}. ${kept.map(why).join('; ')}. ${kept.length === 1 ? 'It was' : 'They were'} not moved to another word. Remove this link and declare it again on the word you meant. Until then nothing is sent to the writer.`,
          actions: [
            ['ly-drop-undecided', 'Remove this link', 'trash-2', `${key}|${lyGroupsText([g])}`],
            [
              'ly-tool',
              key === 'returns' ? 'Open repeats' : 'Open rhymes',
              key === 'returns' ? 'repeat' : 'link',
              key === 'returns' ? 'repeats-voices' : 'rhymes',
            ],
          ],
        });
      });
      const bad = groups
        .flat()
        .filter(
          (m) => !m.undecided && (m.bad || !model.sung[m.line - 1] || !lyMemberWord(model, m))
        );
      if (bad.length)
        add({
          id: `${key}:${d.i}`,
          tone: 'input',
          category: key === 'returns' ? 'Return' : 'Rhyme',
          title: `${key === 'returns' ? 'A declared return' : 'A rhyme link'} points at ${bad.map((m) => m.raw).join(', ')}, which the draft does not have`,
          where: `Declared as ${d.value}`,
          lines: [],
          text: 'Line numbers are the harness’s own spelling; they no longer match the text. Choose the members again.',
          actions: [
            [
              'ly-tool',
              key === 'returns' ? 'Open repeats' : 'Open rhymes',
              key === 'returns' ? 'repeat' : 'link',
              key === 'returns' ? 'repeats-voices' : 'rhymes',
            ],
          ],
        });
    }
  // Word rules: exact word checks this page can make on its own.
  const words = model.sung.map((r) => ({ n: r.n, toks: lyNorm(r.text) }));
  for (const d of lySetupOf(model, 'require')) {
    const w = lyNorm(d.value);
    if (w.length && !words.some((x) => lyContainsRun(x.toks, w)))
      add({
        id: `require:${d.i}`,
        tone: 'issue',
        category: 'Word rule',
        title: `Required “${d.value}” does not appear`,
        where: 'Whole draft',
        lines: [],
        text: 'Checked on this page by exact word match.',
        actions: [['ly-tool', 'Open word rules', 'list', 'word-rules']],
      });
  }
  for (const d of lySetupOf(model, 'avoid')) {
    const w = lyNorm(d.value);
    const hits = words.filter((x) => lyContainsRun(x.toks, w)).map((x) => x.n);
    if (w.length && hits.length)
      add({
        id: `avoid:${d.i}`,
        tone: 'issue',
        category: 'Word rule',
        title: `“${d.value}” is set to avoid but appears`,
        where: lyLineRef(hits),
        lines: hits,
        text: 'Checked on this page by exact word match.',
        actions: [['ly-tool', 'Open word rules', 'list', 'word-rules']],
      });
  }
  const hook = lySetupOf(model, 'hook')[0];
  const hookLines = hook ? model.sung.filter((r) => r.text === hook.line).map((r) => r.n) : [];
  if (hook && !hookLines.length)
    add({
      id: 'hook',
      tone: 'input',
      category: 'Hook',
      title: 'The declared hook line is not in the draft',
      where: hook.line || hook.value,
      lines: [],
      text: 'The hook binds an exact line. Choose it again from the current lines.',
      actions: [['ly-brief-edit', 'Choose the hook', 'pencil', '']],
    });
  const title = lySetupOf(model, 'title')[0];
  if (title && hook && hookLines.length) {
    const t = lyNorm(title.value),
      h = lyNorm(hook.line);
    if (!lyContainsRun(h, t) && !lyContainsRun(t, h))
      add({
        id: 'title-hook',
        tone: 'note',
        category: 'Hook',
        title: 'The title is not a run of words in the hook',
        where: lyLineRef(hookLines),
        lines: hookLines,
        text: 'A declared title is expected inside the hook line (or the hook inside the title). The harness decides this when it grades; this is the same word test, made here as a note.',
        actions: [],
      });
  }
  // Rhythm: declared only. A mixed song is noted, never filled in.
  const sized = model.sections.filter((s) => s.header);
  const metered = sized.filter((s) => s.header.meter);
  if (metered.length && metered.length < sized.length)
    add({
      id: 'rhythm-mixed',
      tone: 'note',
      category: 'Rhythm',
      title: `Rhythm is declared for ${metered.length} of ${sized.length} sections`,
      where: 'Rhythm & placement',
      lines: [],
      text: 'Undeclared sections stay undeclared: no tempo or meter is assumed for them.',
      actions: [['ly-tool', 'Open rhythm', 'music', 'rhythm']],
    });
  const melody = lySetupOf(model, 'melody')[0];
  if (melody) {
    const m = lyParseMelody(melody.value);
    if (m.error)
      add({
        id: 'melody',
        tone: 'input',
        category: 'Melody',
        title: 'The declared melody cannot be used',
        where: 'Rhythm & placement',
        lines: [],
        text: m.error,
        actions: [['ly-tool', 'Open rhythm', 'music', 'rhythm']],
      });
    else {
      const clash = model.sections.filter(
        (s) =>
          s.header?.meter && s.header.meter !== `${m.melody.meter.beats}/${m.melody.meter.unit}`
      );
      if (clash.length)
        add({
          id: 'melody-meter',
          tone: 'note',
          category: 'Melody',
          title: `The melody is in ${m.melody.meter.beats}/${m.melody.meter.unit}; ${uiCount(clash.length, 'section header')} declare another meter`,
          where: clash.map((s) => s.title).join(', '),
          lines: [],
          text: 'The harness takes the meter from a declared melody, which repeats for every line. Both are kept as written.',
          actions: [['ly-tool', 'Open rhythm', 'music', 'rhythm']],
        });
    }
  }
  const spans = lyBarSpans(model);
  for (const d of lySetupOf(model, 'placement'))
    for (const r of lyParsePlacement(d.value)) {
      const row = !r.bad && model.sung[r.line - 1];
      if (!row) {
        add({
          id: `place:${r.raw || r.line}`,
          tone: 'input',
          category: 'Placement',
          title: r.bad
            ? `A line placement cannot be read (“${r.raw}”)`
            : `A placement names line ${r.line}, which the draft does not have`,
          where: 'Rhythm & placement',
          lines: [],
          text: 'Declare it again for the current lines.',
          actions: [['ly-tool', 'Open rhythm', 'music', 'rhythm']],
        });
        continue;
      }
      const span = spans.get(row.section.index);
      if (span && (r.bar < span[0] || r.bar > span[1]))
        add({
          id: `place-bar:${r.line}`,
          tone: 'issue',
          category: 'Placement',
          title: `Line ${r.line} is placed at bar ${r.bar}, outside ${row.section.title} (bars ${span[0]}–${span[1]})`,
          where: row.section.title,
          lines: [r.line],
          text: 'Compared with the bars the section headers declare, counted from bar 1. Change the placement or the section sizes.',
          actions: [['ly-tool', 'Open rhythm', 'music', 'rhythm']],
        });
    }
  const story = lySetupOf(model, 'narrative')[0];
  if (story) {
    const n = lyParseNarrative(story.value);
    const sung = model.sections.filter((s) => s.sung.length).length;
    if (!n.off && (!n.ok || n.steps.length !== sung))
      add({
        id: 'narrative',
        tone: 'input',
        category: 'Story',
        title: !n.ok
          ? 'The story plan cannot be read'
          : `The story plan names ${uiCount(n.steps.length, 'section')}; the song has ${sung}`,
        where: 'Form & story',
        lines: [],
        text: 'One story job per sung section, with a junction before every job after the first. Change the plan or the sections so they agree.',
        actions: [['ly-tool', 'Open form & story', 'book-open', 'form-story']],
      });
  }
  for (const st of model.stamps)
    add({
      id: `stamp:${st.i}`,
      tone: 'note',
      category: 'Run stamp',
      title: `The draft carries a ${st.kind} stamp${st.exit != null ? ` (exit ${st.exit})` : ''}`,
      where: `Text line ${st.i + 1}`,
      lines: [],
      text: `${st.raw} — it describes the run that wrote it${st.seed != null ? ` (seed ${st.seed})` : ''}. This page has not checked it, and edits since then are not covered by it.`,
      actions: [],
    });
  return items;
}

// ── The document's identity ────────────────────────────────────────────────
// WHAT A REVIEW IS OF (2026-09-30). A review, a certification or a suggestion
// answers for one version of the song, and that version is more than its sung
// lines and [SETUP] rows: a header carries the section's name, declared size,
// bars, meter and pickup, and which lines a section holds is itself declared.
// Comparing sung lines and setup rows only kept "Finished · certified" on a
// song whose header went from 2 bars of 4/4 to 8 bars of 7/8. The identity
// below is every declared fact the writer is given: the ordered sung text,
// each section with its header parts and its members, every setup row
// (duplicates kept, order-free) and voices. Run stamps and display
// preferences are not the song. Canonical JSON, version 1, hashed SHA-256.
function lyCanonical(model) {
  return {
    v: 1,
    sung: model.sung.map((r) => r.text),
    sections: model.sections.map((s) => ({
      name: s.header ? s.header.name : null,
      lines: s.header?.lines ?? null,
      bars: s.header?.bars ?? null,
      meter: s.header?.meter ?? null,
      pickup: s.header?.pickup ?? null,
      extra: s.header ? s.header.extra : [],
      members: s.sung.map((r) => r.n),
    })),
    setup: model.setup.map((s) => s.raw.trim()).sort(),
    voices: !!model.voices,
  };
}
// SHA-256 of a string's UTF-8 bytes, synchronously: the page compares
// identities while it renders, and crypto.subtle only answers in a promise.
const LY_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
function lySha256(text) {
  const bytes = [];
  for (const ch of String(text)) {
    let c = ch.codePointAt(0);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else
      bytes.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 63),
        0x80 | ((c >> 6) & 63),
        0x80 | (c & 63)
      );
  }
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (bitLen >>> (i * 8)) & 255);
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const w = new Array(64);
  const rot = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++)
      w[i] =
        (bytes[off + 4 * i] << 24) |
        (bytes[off + 4 * i + 1] << 16) |
        (bytes[off + 4 * i + 2] << 8) |
        bytes[off + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, k] = h;
    for (let i = 0; i < 64; i++) {
      const t1 =
        (k + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + LY_K[i] + w[i]) | 0;
      const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      k = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + k) | 0;
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
const lyIdentity = (model) => lySha256(JSON.stringify(lyCanonical(model)));
// What differs between two versions, in words, for a refusal that names it.
function lyIdentityDiff(before, after) {
  const a = lyCanonical(before),
    b = lyCanonical(after);
  const out = [];
  if (!lySame(a.sung, b.sung)) out.push('sung lines');
  const heads = (c) => JSON.stringify(c.sections.map(({ members: _members, ...h }) => h));
  const members = (c) => JSON.stringify(c.sections.map((s) => s.members));
  if (heads(a) !== heads(b)) out.push('section headers');
  else if (members(a) !== members(b)) out.push('section boundaries');
  if (a.setup.join('\n') !== b.setup.join('\n')) out.push('[SETUP] declarations');
  if (a.voices !== b.voices) out.push('voices');
  return out;
}

// ── What the writer's last reply reported ──────────────────────────────────
// Read from the reply the shell hands to uiReceiveReply (see lyReceive) and
// from chatState. `base` is the draft when the request was sent: only a
// suggestion made against a known base can be checked line by line.
// A declared title as the song reads it: a setup row may hold it quoted.
function lyTitleOf(model) {
  const v = lySetupOf(model, 'title')[0]?.value;
  if (!v) return '';
  return lyUnquote(v) ?? v;
}
// The title a writer's artifact declares, as a setup value: no bracket, no
// newline (either would end or split the setup row), at most 160 characters.
function lyArtifactTitle(artifact) {
  const t = typeof artifact?.title === 'string' ? artifact.title : '';
  const v = t
    .replace(/[\]\n\r]/g, ' ')
    .trim()
    .slice(0, 160);
  return v || null;
}
function lyRunLines(artifact) {
  if (!artifact) return null;
  if (Array.isArray(artifact.final_draft)) return artifact.final_draft.map((l) => String(l).trim());
  if (typeof artifact.text === 'string') return lyParse(artifact.text).sung.map((r) => r.text);
  return null;
}
// The [SETUP] rows of a draft, order-free: the declarations a run was given.
const lySetupKey = (model) =>
  model.setup
    .map((s) => s.raw.trim())
    .sort()
    .join('\n');
// Rows in one setup key and not the other, for a refusal that names them.
function lySetupDiff(before, after) {
  const a = before ? before.split('\n') : [],
    b = after ? after.split('\n') : [];
  return {
    added: b.filter((r) => !a.includes(r)),
    removed: a.filter((r) => !b.includes(r)),
  };
}
// Is the writer conversation this run came from still the live one? A page
// helper that starts new work resets it (uiNewTask → _chatReset clears
// chatState.lyric); switching writers and back restores the same record.
function lyRunLive(run) {
  if (!run) return false;
  if (run.generation === chatState.generation) return true;
  return !!run.lyric && JSON.stringify(run.lyric) === JSON.stringify(chatState.lyric);
}
// Waiting, parked and uncertain are read only from the live conversation.
const lyLiveWaiting = (lyric = chatState.lyric) => !!lyric?.state && lyric.resumable !== false;
// Certified means the run certified THIS version: the whole document now in
// the editor has the identity of the version the run accepted — its sung
// lines inside the request's own sections, headers and declarations. With no
// request on record (a recovered reply), that version is unknown here.
function lyRunCurrent(run, model = LY.model) {
  const sung = !!run?.final && !!model && lySame(lySungTexts(model), run.final);
  const known = run?.resultId != null;
  const now = model ? lyIdentity(model) : null;
  return { sung, known, setup: known && now === run.resultId, now };
}
// The version a run's accepted draft becomes on this page: the request's own
// document with the accepted sung lines in place when the counts agree (the
// page keeps the headers and setup; see lyRefresh), otherwise the writer's
// text with the request's setup rows kept.
function lyResultText(asked, final, wholeText, title = null) {
  if (!asked || !final) return null;
  const kept = asked.setup.length || asked.sections.some((s) => s.header);
  let text = !kept
    ? wholeText
    : asked.sung.length === final.length
      ? lyReplaceSung(asked, final, '')
      : typeof wholeText === 'string'
        ? lyKeepSetup(asked, wholeText)
        : null;
  if (typeof text !== 'string') return null;
  // A title the run declared is the song's title here too (the rendered song
  // carries headers and lines only), unless this draft already declares one.
  if (title && !lyParse(text).setup.some((s) => s.key === 'title'))
    text = lySetSetup('title', [title], text);
  return text;
}
function lyResultModel(asked, final, wholeText, title = null) {
  const text = lyResultText(asked, final, wholeText, title);
  return text === null ? null : lyParse(text);
}
// What the reply itself reported, with no reference to the current draft.
function lyRunOutcome(run) {
  if (!run) return null;
  const a = run.artifact;
  if (run.recoveryExport) return { tone: 'warning', word: 'Recovered export · not graded' };
  if (a?.certified === true && run.completion?.certified === true)
    return { tone: 'success', word: 'Finished · certified', certified: true };
  if (a) {
    const why = String(a.status || run.stopped || '')
      .replace(/_/g, ' ')
      .trim()
      .toLowerCase();
    return {
      tone: 'warning',
      word:
        !why || /^(lyrics )?(unfinished|not certified)$/.test(why)
          ? 'Unfinished'
          : why === 'finished'
            ? 'Finished · not certified'
            : `Unfinished · ${why}`,
    };
  }
  if (run.error) return { tone: 'danger', word: 'Stopped with an error' };
  if (lyRunLive(run) && lyLiveWaiting()) return { tone: 'info', word: 'Waiting for your answer' };
  if (run.lyric?.state && run.lyric.resumable !== false)
    return { tone: '', word: 'Earlier question archived' };
  return { tone: '', word: 'Reply without a draft' };
}
// The run's status as it bears on the draft now in the editor.
function lyRunStatus(run, model = LY.model) {
  const out = lyRunOutcome(run);
  if (!out?.certified) return out;
  const cur = lyRunCurrent(run, model);
  if (cur.setup) return out;
  if (!cur.known) return { tone: 'warning', word: 'Earlier result · declarations unknown' };
  return { tone: 'warning', word: 'Last run certified an earlier draft' };
}
function lyRunChecks(model) {
  const run = LY.run;
  const items = [];
  if (!run) return items;
  const current = lySungTexts(model);
  // Stale: the document is neither the version the run accepted nor the one
  // it was asked about. Without a request on record only the sung lines can
  // be compared.
  const now = lyIdentity(model);
  const stale =
    run.resultId != null || run.baseId != null
      ? now !== run.resultId && now !== run.baseId
      : !!run.final && !lySame(current, run.final);
  const add = (item) => items.push({ source: 'run', stale, ...item });
  // Findings the reply reported stay; what is live (open lines, a waiting
  // question) is read only while its conversation is still the live one.
  const live = lyRunLive(run);
  const lyric = run.lyric || {};
  const standing = Array.isArray(lyric.standing) ? lyric.standing : [];
  const reasonsFor = (n) => standing.filter((s) => new RegExp(`\\bL${n}\\b`).test(String(s)));
  // Suggestions: the writer's accepted lines against the draft it was given.
  if (run.final && run.base && run.final.length === run.base.length) {
    run.final.forEach((line, k) => {
      if (line === run.base[k]) return;
      const n = k + 1;
      const id = `p:${run.id}:${n}`;
      const out = LY.outcomes[id];
      if (out?.state === 'kept') return;
      // Already in the draft (applied here or by the shell). After Undo the
      // line differs again, so the suggestion comes back.
      if (current[k] === line) return;
      if (out?.state === 'applied') {
        if (!lySame(current, out.before || [])) return; // your own line went in
        delete LY.outcomes[id];
      }
      add({
        id,
        tone: 'issue',
        category: 'Suggested change',
        title: `The writer suggests a new line ${n}`,
        where: `${lySectionOfLine(model, n)?.title || 'Line'} · line ${n}`,
        lines: [n],
        text:
          reasonsFor(n).join(' ') ||
          `From the writer’s run (it reported: ${lyRunOutcome(run).word}, for its own draft). Check & apply first confirms your line, the line numbering and your [SETUP] declarations are unchanged, and that this page’s exact checks find no new issue.`,
        original: run.base[k],
        proposal: line,
        decision: { run: run.id, n },
        stale: false,
      });
    });
  } else if (
    run.final &&
    !(run.base && lySame(run.final, run.base)) &&
    !lySame(run.final, current)
  ) {
    const id = `w:${run.id}`;
    const out = LY.outcomes[id];
    if (out?.state === 'applied' && lySame(current, out.before || [])) delete LY.outcomes[id];
    if (!['kept', 'applied'].includes(LY.outcomes[id]?.state))
      add({
        id,
        tone: 'issue',
        category: 'Writer draft',
        title: `The writer returned a ${uiCount(run.final.length, 'line')} draft`,
        where: 'Whole draft',
        lines: [],
        text: run.base
          ? `Your draft had ${uiCount(run.base.length, 'sung line')} when you asked; the lines do not correspond one to one, so this can only be taken whole.`
          : 'This reply was recovered without the draft it was asked about, so it cannot be compared line by line. It can only be taken whole.',
        whole: run.final,
        decision: { run: run.id, whole: true },
        stale: false,
      });
  }
  // Lines the run left open, and its standing findings.
  const open = live && Array.isArray(lyric.open) ? lyric.open : [];
  for (const n of open)
    add({
      id: `open:${n}`,
      tone: 'issue',
      category: 'Open line',
      title: `Line ${n} is still open in the writer's run`,
      where: lySectionOfLine(model, n)?.title || `Line ${n}`,
      lines: [n],
      text: reasonsFor(n).join(' ') || 'The run stopped with this line unresolved.',
      actions: [['ly-tab', 'Open the writer', 'user', 'writer']],
    });
  const tied = new Set(open.flatMap((n) => reasonsFor(n)));
  standing
    .filter((s) => !tied.has(s))
    .slice(0, 12)
    .forEach((s, k) => {
      const ns = [...String(s).matchAll(/\bL(\d+)\b/g)].map((m) => Number(m[1]));
      add({
        id: `standing:${k}`,
        tone: 'issue',
        category: 'Finding',
        title: String(s).slice(0, 140),
        where: ns.length ? lyLineRef(ns) : 'Whole draft',
        lines: ns,
        text: 'A finding standing when the run stopped.',
        actions: [],
      });
    });
  for (const code of Array.isArray(lyric.whole) ? lyric.whole : [])
    add({
      id: `whole:${code}`,
      tone: 'issue',
      category: 'Whole draft',
      title: `Whole-draft flag: ${code}`,
      where: 'Whole draft',
      lines: [],
      text: 'Reported by the writer’s run for the draft as a whole.',
      actions: [],
    });
  for (const t of run.tools || []) {
    if (typeof t.banned_pairs === 'number' && t.banned_pairs > 0)
      add({
        id: `banned:${t.name}`,
        tone: 'note',
        category: 'Banned pairs',
        title: uiCount(t.banned_pairs, 'banned pair'),
        where: t.name,
        lines: [],
        // Was 'The two-tier ban is unskippable: this song is not finished while they
        // stand.' — report-only since 2026-10-04 (owner's ruling).
        text: 'Reported as notes. They do not stop the song finishing.',
        actions: [],
      });
    if (t.error)
      add({
        id: `error:${t.name}`,
        tone: 'issue',
        category: 'Writer error',
        title: `${t.name} failed`,
        where: 'Writer run',
        lines: [],
        text: String(t.error).slice(0, 300),
        actions: [],
      });
    if (t.refusal)
      add({
        id: `refusal:${t.name}`,
        tone: 'input',
        category: 'Refused',
        title: `${t.name} refused`,
        where: 'Writer run',
        lines: [],
        text: String(t.refusal).slice(0, 300),
        actions: [['ly-tab', 'Open the writer', 'user', 'writer']],
      });
  }
  // Coverage: what the run could not judge is missing input, not a defect.
  const coverage = run.coverage;
  if (coverage && Array.isArray(coverage.obligations)) {
    const refused = coverage.obligations.filter((o) => o.status === 'refused');
    refused.slice(0, 12).forEach((o) => {
      const pron = /^pronunciation:/.test(o.id) || o.layer === 'pronunciation';
      add({
        id: `cov:${o.id}`,
        tone: 'input',
        category: pron ? 'Pronunciation' : 'Coverage',
        title: pron
          ? `A reading is needed${o.word ? ` for “${o.word}”` : ''}`
          : `Not judged: ${o.id}`,
        where:
          Array.isArray(o.matching_lines) && o.matching_lines.length
            ? lyLineRef(o.matching_lines)
            : 'Writer run',
        lines: Array.isArray(o.matching_lines) ? o.matching_lines : [],
        text:
          o.detail ||
          o.reason ||
          'The run could not judge this obligation, so its coverage is incomplete. That is missing input, not a pass or a failure.',
        actions: pron
          ? [['ly-tool', 'Open pronunciation', 'message-circle', 'pronunciation']]
          : [['ly-tab', 'Open review', 'file-check', 'review']],
      });
    });
    if (refused.length > 12)
      add({
        id: 'cov:more',
        tone: 'input',
        category: 'Coverage',
        title: `${refused.length - 12} more obligations were not judged`,
        where: 'Writer run',
        lines: [],
        text: 'All of them are listed under All checks.',
        actions: [['ly-tab', 'Open review', 'file-check', 'review']],
      });
    const unasked = coverage.obligations.filter((o) => o.status === 'not_requested');
    if (unasked.length)
      add({
        id: 'cov:unasked',
        tone: 'note',
        category: 'Coverage',
        title: `${uiCount(unasked.length, 'check')} not requested`,
        where: 'Writer run',
        lines: [],
        text: 'Disclosed by the run and not asked of this song; they are neither passed nor failed.',
        actions: [['ly-tab', 'Open review', 'file-check', 'review']],
      });
  }
  for (const t of run.tools || [])
    for (const f of [].concat(t.folded || []))
      if (f && f.verdict === 'rejected') {
        const ns = [f.line, ...(f.members || [])].filter((x) => typeof x === 'number');
        add({
          id: `folded:${t.name}:${ns.join(',')}:${f.round ?? ''}`,
          tone: 'issue',
          category: 'Rejected answer',
          title: `The writer's answer for ${ns.length ? lyLineRef(ns) : 'a line'} was rejected`,
          where: 'Writer run',
          lines: ns,
          text:
            [f.answer ? `It answered “${f.answer}”.` : '', ...(f.reasons || [])]
              .filter(Boolean)
              .join(' ') || 'Rejected by the run’s verification.',
          actions: [['ly-tab', 'Open the writer', 'user', 'writer']],
        });
      }
  const asked = [...(run.tools || [])].reverse().find((t) => t.asked)?.asked;
  const askedLines = asked
    ? [asked.line, ...(asked.lines || []), ...(asked.members || [])].filter(
        (x) => typeof x === 'number'
      )
    : [];
  if (live && lyLiveWaiting(chatState.lyric) && !chatState.busy)
    add({
      id: 'waiting',
      tone: 'input',
      category: 'Writer',
      title: askedLines.length
        ? `The writer is waiting for an answer about ${lyLineRef(askedLines)}`
        : 'The writer is waiting for an answer',
      where: 'Writer run',
      lines: askedLines,
      text: 'The run asked a question and is paused until it gets an answer. Nothing continues on its own.',
      question: run.reply || null,
      answer: askedLines.length ? askedLines : [0],
      actions: [['ly-tab', 'Open the writer', 'user', 'writer']],
    });
  if (run.stopped && !run.recoveryExport)
    add({
      id: 'stopped',
      tone: 'note',
      category: 'Writer',
      title:
        run.stopped === 'MAX_STEPS'
          ? 'The writer stopped after its maximum number of steps'
          : `The writer stopped early (${run.stopped})`,
      where: 'Writer run',
      lines: [],
      text: 'The reply is incomplete for that reason, not finished.',
      actions: [['ly-tab', 'Open the writer', 'user', 'writer']],
    });
  const cur = lyRunCurrent(run, model);
  if (lyRunOutcome(run)?.certified && cur.setup)
    add({
      id: 'certified',
      tone: 'note',
      category: 'Writer',
      title: 'The writer’s run finished with its requested checks passed',
      where: 'Writer run',
      lines: [],
      text: 'It passed the checks it was asked, under its declared readings, for exactly this version: the same sung lines, section headers and [SETUP] declarations. It is not a quality score or a performed-rhythm guarantee.',
      actions: [],
    });
  else if (lyRunOutcome(run)?.certified) {
    const changed = run.resultModel ? lyIdentityDiff(run.resultModel, model) : [];
    add({
      id: 'certified-earlier',
      tone: 'note',
      category: 'Writer',
      title: cur.known
        ? 'The last run certified an earlier draft'
        : 'An earlier result · its declarations are unknown',
      where: 'Writer run',
      lines: [],
      text: !cur.known
        ? 'This reply came without the request it answered, so the version it certified is unknown here and it does not cover this draft.'
        : `Your ${changed.length ? changed.join(', ') : 'draft'} changed since that run, so its certification does not cover this version. Ask the writer to review the current draft.`,
      actions: [['ly-tab', 'Open Review', 'clipboard-check', 'review']],
    });
  }
  return items;
}

function lyItems() {
  const model = LY.model;
  const items = [...lyRunChecks(model), ...lyLocalChecks(model)];
  const order = { issue: 0, input: 1, note: 2 };
  return items.sort((a, b) => order[a.tone] - order[b.tone]);
}

// ── Check & apply ─────────────────────────────────────────────────────────
// Verifies the exact suggestion against the CURRENT draft before one undoable
// write: the line and the numbering are the ones the writer was given, the
// [SETUP] declarations are the ones it was given, and this page's exact local
// checks find no issue the change would add. Otherwise it keeps the original
// and says why. Nothing is cached between the check and the write. It does
// not re-grade rhyme or meter; only a writer run judges those.
const lyIssueKey = (i) => `${i.id}|${i.title}|${i.where}`;
// Issue items `text` would add over `model`, by this page's exact checks.
function lyNewIssues(model, text) {
  const before = new Set(
    lyLocalChecks(model)
      .filter((i) => i.tone === 'issue')
      .map(lyIssueKey)
  );
  return lyLocalChecks(lyParse(text)).filter(
    (i) => i.tone === 'issue' && !before.has(lyIssueKey(i))
  );
}
// A suggestion answers for the version it was made against: the whole
// document the writer was asked about, headers and declarations included.
function lyDeclarationRefusal(run, model) {
  if (run.baseId == null)
    return 'The request this reply answered is not known here, so the declarations it was checked against are unknown. Nothing was changed. Ask the writer to review the current draft.';
  if (lyIdentity(model) === run.baseId) return '';
  const now = lySetupKey(model);
  if (now === run.baseSetup) {
    const what = lyIdentityDiff(run.baseModel, model).filter((w) => w !== 'sung lines');
    return `Your ${what.length ? what.join(' and ') : 'draft'} changed after you asked the writer, so this suggestion was never checked against this version. Nothing was changed. Recheck it against the current draft.`;
  }
  const { added, removed } = lySetupDiff(run.baseSetup, now);
  const list = (rows) =>
    rows
      .slice(0, 3)
      .map((r) => r.replace(/^\[SETUP\s+—\s+/i, '').replace(/\]$/, ''))
      .join('; ') + (rows.length > 3 ? ` and ${rows.length - 3} more` : '');
  const what = [
    added.length ? `added ${list(added)}` : '',
    removed.length ? `removed ${list(removed)}` : '',
  ]
    .filter(Boolean)
    .join('; ');
  return `Your [SETUP] declarations changed after you asked the writer (${what}), so this suggestion was never checked against them. Nothing was changed. Ask the writer to review the current draft.`;
}
function lyIssueRefusal(issues, kept) {
  return `Applying it would add ${uiCount(issues.length, 'issue')} this page checks: ${issues
    .slice(0, 3)
    .map((i) => i.title)
    .join('; ')}${issues.length > 3 ? '; …' : ''}. ${kept}`;
}
function lyCheckApply(item) {
  const run = LY.run;
  const fail = (message) => {
    LY.outcomes[item.id] = { state: 'failed', message };
    lyRenderReview();
    return false;
  };
  if (!run || item.decision?.run !== run.id)
    return fail('This suggestion belongs to an earlier writer reply. Nothing was changed.');
  const model = lyParse(lyDraft().value);
  const current = lySungTexts(model);
  if (item.decision.whole) {
    const next = lyReplaceSung(
      model,
      item.whole,
      lyKeepSetup(model, run.wholeText || item.whole.join('\n'))
    );
    // With no request on record there is nothing to compare against: the
    // action is labelled a replacement, and says it was not checked.
    if (run.base) {
      if (!lySame(current, run.base))
        return fail(
          'Your draft changed after you asked the writer, so its draft would overwrite those edits. Your draft was kept. Ask the writer to review the current draft, or copy what you need from Compare.'
        );
      const decl = lyDeclarationRefusal(run, model);
      if (decl) return fail(decl);
      const issues = lyNewIssues(model, next);
      if (issues.length) return fail(lyIssueRefusal(issues, 'Your draft was kept.'));
    }
    lyCommit(next, 'The writer’s draft is in place. Undo restores yours.');
    LY.outcomes[item.id] = {
      state: 'applied',
      message: 'Applied as one change. Undo restores your draft.',
      before: current,
    };
    lyRenderReview();
    return true;
  }
  const n = item.decision.n,
    k = n - 1;
  if (current.length !== run.base.length)
    return fail(
      `Your draft now has ${uiCount(current.length, 'sung line')}; the suggestion was made for ${run.base.length}. Line numbers no longer line up, so nothing was changed.`
    );
  if (current[k] !== run.base[k])
    return fail(
      `Line ${n} changed after the writer suggested this (it now reads “${current[k]}”). Your line was kept.`
    );
  const text = String(item.proposal);
  if (!text.trim() || /[\r\n]/.test(text) || LY_BRACKET.test(text.trim()))
    return fail('The suggestion is not a single sung line. Nothing was changed.');
  const row = model.sung[k];
  const rows = model.text.split('\n');
  rows[row.i] = rows[row.i].replace(row.text, () => text.trim());
  const next = rows.join('\n');
  // A line of your own is an ordinary, unchecked edit (it says so); only the
  // writer's suggestion is held to the declarations and the local checks.
  if (!item.own) {
    const decl = lyDeclarationRefusal(run, model);
    if (decl) return fail(decl.replace('Nothing was changed.', 'Your line was kept.'));
    const issues = lyNewIssues(model, next);
    if (issues.length) return fail(lyIssueRefusal(issues, 'Your line was kept.'));
  }
  // Declarations bound to the old text stop applying once it changes.
  const notes = [];
  const others = current.filter((t, j) => j !== k && t === run.base[k]).length;
  if (!others) {
    for (const r of lySetupOf(model, 'reading'))
      if (r.line === run.base[k])
        notes.push(
          `The reading for “${r.word}” no longer applies to this line; choose again if it is needed.`
        );
    const hook = lySetupOf(model, 'hook')[0];
    if (hook && hook.line === run.base[k])
      notes.push('This was the hook line; choose the hook again.');
  }
  lyCommit(next, `Line ${n} updated. Undo restores it.`);
  LY.outcomes[item.id] = {
    state: 'applied',
    message: ['Applied. Undo restores the original.', ...notes].join(' '),
    before: current,
  };
  LY.activeLine = n;
  lyRenderReview();
  return true;
}
// Replace the sung lines of a draft with `lines` while keeping its headers and
// setup where the counts allow; otherwise the writer's text replaces it whole.
function lyReplaceSung(model, lines, whole) {
  if (model.sung.length !== lines.length) return whole;
  const rows = model.text.split('\n');
  model.sung.forEach((r, k) => (rows[r.i] = lines[k]));
  return rows.join('\n');
}
// A writer's text does not carry this page's [SETUP] lines; keep them.
function lyKeepSetup(model, text) {
  if (!model.setup.length || lyParse(text).setup.length) return text;
  return model.setup.map((d) => d.raw).join('\n') + '\n\n' + text;
}
function lyCommit(text, message) {
  const draft = lyDraft();
  draft.value = text;
  uiSaveLyrics();
  pushHistory();
  lyRefresh(true);
  if (message)
    showToast(message, 'success', { label: 'Undo', run: () => $ui('btn-undo')?.click() });
}

// ── Editing the text ──────────────────────────────────────────────────────
// Every structural edit rebuilds the text from rows that remember their old
// sung number, so line-number declarations (rhyme groups, returns — the
// harness's own spelling) follow their lines; members whose line is removed
// are dropped and reported, never silently re-pointed.
function lyBlocks(model) {
  const rows = model.rows.map((r) => ({ raw: r.raw, n: r.n || null, kind: r.kind }));
  const starts = model.sections.map((s) => (s.headerRow ? s.headerRow.i : s.rows[0].i));
  if (!starts.length) return { prefix: rows, blocks: [], suffix: [] };
  let lastContent = starts[starts.length - 1];
  for (let i = lastContent; i < rows.length; i++)
    if (rows[i].kind === 'sung' || rows[i].kind === 'section') lastContent = i;
  const trim = (block) => {
    while (block.length && !block[block.length - 1].raw.trim()) block.pop();
    return block;
  };
  const blocks = starts.map((start, k) =>
    trim(rows.slice(start, k + 1 < starts.length ? starts[k + 1] : lastContent + 1))
  );
  return { prefix: trim(rows.slice(0, starts[0])), blocks, suffix: rows.slice(lastContent + 1) };
}
function lyAssemble({ prefix, blocks, suffix }) {
  const out = [...prefix];
  for (const b of blocks) {
    if (out.length && out[out.length - 1].raw.trim()) out.push({ raw: '' });
    out.push(...b);
  }
  const first = suffix.findIndex((r) => r.raw.trim());
  if (first >= 0) {
    if (out.length) out.push({ raw: '' });
    out.push(...suffix.slice(first));
  }
  // Renumber: old sung n → new sung n.
  const map = new Map();
  let n = 0;
  for (const r of out) {
    const t = r.raw.trim();
    if (!t || LY_BRACKET.test(t)) continue;
    n++;
    if (r.n && !map.has(r.n)) map.set(r.n, n);
  }
  let dropped = 0;
  const rows = out.map((r) => {
    const t = r.raw.trim();
    if (!LY_SETUP.test(t)) return r.raw;
    const item = lyParseSetup(t);
    if (item.key === 'placement') {
      const rows = lyParsePlacement(item.value).filter((x) => {
        if (x.bad) return true;
        if (!map.has(x.line)) {
          dropped++;
          return false;
        }
        x.line = map.get(x.line);
        return true;
      });
      const good = rows.filter((x) => !x.bad);
      return good.length ? `[SETUP${LY_DASH}placement${LY_DASH}${lyPlacementText(good)}]` : null;
    }
    if (item.key !== 'rhyme groups' && item.key !== 'returns') return r.raw;
    const groups = lyParseGroups(item.value)
      .map((g) =>
        g.filter((m) => {
          if (m.bad) return true;
          if (!map.has(m.line)) {
            dropped++;
            return false;
          }
          m.line = map.get(m.line);
          return true;
        })
      )
      .filter((g) => g.length > 1);
    // The row keeps the cut it was numbered under (renumbering lines moves no
    // word place); an unmarked row is left for the migration to read.
    return groups.length
      ? `[SETUP${LY_DASH}${item.key}${LY_DASH}${lyGroupsText(groups)}${item.numbering ? `${LY_DASH}numbering ${item.numbering}` : ''}${item.cut ? `${LY_DASH}cut ${item.cut}` : ''}]`
      : null;
  });
  return { text: rows.filter((r) => r !== null).join('\n'), dropped };
}
function lyCarriedDecide(id, keep) {
  const [key, i, gi, mi] = String(id).split('|');
  if (!LY_GROUP_KEYS.includes(key)) return;
  const base = lyFormBase(key);
  const model = lyParse(base.text);
  const d = lySetupOf(model, key).find((x) => x.i === Number(i));
  if (!d) return;
  const groups = lyRowGroups(d);
  const g = groups[Number(gi)];
  const m = g && g[Number(mi)];
  if (!m || !m.carried) return;
  if (keep) m.carried = false;
  else {
    g.splice(Number(mi), 1);
    if (g.length < 2) groups.splice(Number(gi), 1);
  }
  const rows = model.text.split('\n');
  if (groups.length) rows[d.i] = lyGroupRow(key, groups, model.voices);
  else rows.splice(d.i, 1);
  const what = key === 'returns' ? 'declared return' : 'rhyme link';
  lyCommit(
    rows.join('\n'),
    lyFormMigrated(
      base.done,
      keep
        ? `The ${what} on line ${m.line} is kept as declared. Undo restores the notice.`
        : `Line ${m.line} was removed from the ${what}. Undo restores it.`
    )
  );
}
function lyEditSections(mutate, message) {
  const model = lyParse(lyDraft().value);
  const parts = lyBlocks(model);
  if (mutate(parts, model) === false) return;
  const { text, dropped } = lyAssemble(parts);
  lyCommit(
    text,
    message +
      (dropped
        ? ` ${uiCount(dropped, 'declared link member')} pointed at removed lines and ${dropped === 1 ? 'was' : 'were'} removed.`
        : '')
  );
}
// Replace every [SETUP — key — …] row with `values` (in order), placed with
// the other setup rows (or at the top, before the song).
function lySetSetup(key, values, text = lyDraft().value) {
  const model = lyParse(text);
  const rows = model.text ? model.text.split('\n') : [];
  const own = model.setup.filter((s) => s.key === key).map((s) => s.i);
  const anchor = own.length
    ? own[0]
    : model.setup.length
      ? model.setup[model.setup.length - 1].i + 1
      : 0;
  // Every rhyme groups / returns row this page writes carries the cut it is
  // read under (lyMigrateSavedReadings): an unmarked one is legacy by policy.
  const mark = (value) =>
    LY_GROUP_KEYS.includes(key)
      ? `${lyGroupNumberingMark(value, model.voices)}${LY_DASH}${LY_READING_CUT}`
      : '';
  const fresh = values.map(
    (v) => `[SETUP${LY_DASH}${key}${v === '' ? '' : LY_DASH + v + mark(v)}]`
  );
  const kept = rows.filter((_, i) => !own.includes(i));
  const at = anchor - own.filter((i) => i < anchor).length;
  kept.splice(at, 0, ...fresh);
  // Keep one blank line between the setup block and the song.
  const lastSetup = at + fresh.length - 1;
  if (
    !model.setup.length &&
    fresh.length &&
    kept[lastSetup + 1] !== undefined &&
    kept[lastSetup + 1].trim()
  )
    kept.splice(lastSetup + 1, 0, '');
  if (!fresh.length && at === 0) while (kept.length && !kept[0].trim()) kept.shift();
  return kept.join('\n');
}
function lySetupCommit(key, values, message, text = lyDraft().value) {
  lyCommit(lySetSetup(key, values, text), message);
}
function lyRewriteHeader(sectionIndex, change, message) {
  const model = lyParse(lyDraft().value);
  const s = model.sections[sectionIndex];
  if (!s) return;
  const rows = model.text.split('\n');
  const header = s.header
    ? { ...s.header, extra: [...s.header.extra], order: [...s.header.order] }
    : {
        name: 'SECTION',
        lines: null,
        bars: null,
        meter: null,
        pickup: null,
        extra: [],
        order: [],
      };
  change(header, s);
  const text = lyHeaderText(header);
  if (s.headerRow) rows[s.headerRow.i] = text;
  else rows.splice(s.rows[0].i, 0, text);
  lyCommit(rows.join('\n'), message);
}

// ── Rendering helpers ─────────────────────────────────────────────────────
const lyBtn = (act, label, ic, { id = '', cls = 'cm-btn', extra = '', hideLabel = false } = {}) =>
  `<button type="button" class="${cls}" data-ui="${act}"${id !== '' ? ` data-id="${esc(String(id))}"` : ''} ${hideLabel ? `aria-label="${esc(label)}" title="${esc(label)}"` : ''} ${extra}>${ic ? icon(ic, 18) : ''}${hideLabel ? '' : `<span>${esc(label)}</span>`}</button>`;
const lyMenu = (
  id,
  label,
  ic,
  items,
  { cls = 'cm-btn', align = 'start', hideLabel = false, chevron = true } = {}
) =>
  `<div class="ly-menu-wrap"><button type="button" class="${cls}" data-ui="ly-menu" data-id="${id}" aria-haspopup="true" aria-expanded="false" aria-controls="ly-menu-${id}"${hideLabel ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}>${ic ? icon(ic, 18) : ''}${hideLabel ? '' : `<span>${esc(label)}</span>${chevron ? icon('chevron-down', 16) : ''}`}</button><div class="cm-menu ly-menu" data-align="${align}" id="ly-menu-${id}" role="menu" hidden>${items}</div></div>`;
const lyMenuItem = (act, label, ic, id = '', extra = '') =>
  lyBtn(act, label, ic, { id, cls: 'ly-menu-item', extra: `role="menuitem" ${extra}` });
const lyStatus = (tone, word, ic) =>
  `<span class="cm-status" data-tone="${tone}">${icon(ic || (tone === 'success' ? 'circle-check' : tone === 'danger' ? 'circle-alert' : tone === 'warning' ? 'triangle-alert' : 'info'), 14)}<span>${esc(word)}</span></span>`;
// A state pill: a dot and a word; colour never carries the meaning alone.
const lyPill = (tone, word, extra = '') =>
  `<span class="ly-pill" data-tone="${tone}" ${extra}><span class="ly-dot" aria-hidden="true"></span><span>${esc(word)}</span></span>`;

// ── Page context: versioned lyric UI metadata ─────────────────────────────
// The creative brief, a note per section, the pending tool entries and this
// page's layout choices live in app.lyricMeta (src/app.js lyricMetaOf), which
// autosave, saved copies, session export/import and Undo carry. Engine
// declarations and sung text stay in the document.
function lyMeta() {
  if (!app.lyricMeta || app.lyricMeta !== LY.metaRef) {
    app.lyricMeta = lyricMetaOf(app.lyricMeta);
    LY.metaRef = app.lyricMeta;
    // An earlier version of this page kept the renumbering record in the
    // display state (ui.renumbered, with a count of entries it evicted);
    // it moves to the draft's own record, its count still said.
    const old = app.lyricMeta.ui?.renumbered;
    if (old && !app.lyricMeta.renumbered && Array.isArray(old.items))
      app.lyricMeta.renumbered = {
        ...(app.lyricMeta.draftId ? { draftId: app.lyricMeta.draftId } : {}),
        items: old.items,
        ...(Number(old.more) > 0 ? { more: Number(old.more) } : {}),
      };
    if (old) delete app.lyricMeta.ui.renumbered;
  }
  return app.lyricMeta;
}
let lyMetaTimer = 0;
function lyMetaSaved() {
  clearTimeout(lyMetaTimer);
  lyMetaTimer = setTimeout(() => uiAutosave(), 250);
}
// Imported Library readings are separate draft records. Preserve the exact
// singleton and its private continuation before activating another record.
let lyLibraryReceiver = null;
let lyLibraryPush = false;
let lyLibraryStore = null;
let lyLibrarySaveTimer = 0;
let lyLibraryRecord = null;
let lyLibraryLoadingId = '';
let lyLibraryDrafts = [];
let lyLibraryLock = null;
const lyLibraryCopy = (value) => JSON.parse(JSON.stringify(value));
function lyLibraryCapture() {
  const meta = lyricMetaOf(app.lyricMeta);
  const draftId = meta.draftId || 'draft:' + crypto.randomUUID();
  // The renumbering record is saved only under the draft it was recorded
  // for (one recorded before this draft had an id is this draft's): never
  // another draft's record under this draftId.
  if (meta.renumbered) {
    if (meta.renumbered.draftId && meta.renumbered.draftId !== draftId) delete meta.renumbered;
    else meta.renumbered = { ...meta.renumbered, draftId };
  }
  const currentDomain =
    chatState.task?.domain ||
    ($ui('chat-domain')?.value.startsWith('lyrics') ? 'lyrics' : 'recipe');
  const writer =
    currentDomain === 'lyrics'
      ? _chatPersistedState()
      : uiChatSessions.get('lyrics')?.state || null;
  return {
    draftId,
    text: lyDraft().value,
    title: lyTitleOf(lyParse(lyDraft().value)) || 'Untitled song',
    meta: { ...meta, draftId },
    writer: lyLibraryCopy(writer),
    writerInput:
      currentDomain === 'lyrics'
        ? $ui('chat-input')?.value || ''
        : uiChatSessions.get('lyrics')?.input || '',
    savedAt: Date.now(),
    pageReview: lyLibraryCopy({
      run: LY.run,
      past: LY.past || [],
      analysis: LY.analysis,
      outcomes: LY.outcomes,
      results: LY.results,
    }),
    originalText: lyLibraryRecord?.draftId === draftId ? lyLibraryRecord.originalText : null,
  };
}
function lyLibraryAcquire() {
  if (lyLibraryLock) throw new Error('Another draft is being opened. Retry when it finishes.');
  const surface = $ui('surface-lyrics'),
    draft = lyDraft();
  lyLibraryLock = { inert: surface?.inert || false, readOnly: draft.readOnly };
  if (surface) surface.inert = true;
  draft.readOnly = true;
  // A writer reply delivered during the commit cannot overwrite an edit
  // being preserved. Its request/continuation remains retrievable in History.
  UI.lyricRevision++;
  return lyLibraryLock;
}
function lyLibraryRelease(owner) {
  if (!owner || lyLibraryLock !== owner) return;
  const surface = $ui('surface-lyrics');
  if (surface) surface.inert = lyLibraryLock.inert;
  lyDraft().readOnly = lyLibraryLock.readOnly;
  lyLibraryLock = null;
}
function lyLibraryDetachWriter() {
  const neutral = {
    history: null,
    workspace: null,
    lyric: null,
    task: null,
    sig: null,
    continuationId: null,
    pending: null,
    archives: [],
    retryAt: 0,
  };
  const currentDomain =
    chatState.task?.domain ||
    ($ui('chat-domain')?.value.startsWith('lyrics') ? 'lyrics' : 'recipe');
  // The archived continuation remains intact in IndexedDB. Increasing only
  // the local delivery generation prevents an old reply replacing this copy.
  // Do not abort its request or reset the backend writer run.
  if (currentDomain === 'lyrics') {
    _chatPollStop();
    Object.assign(chatState, neutral, {
      generation: chatState.generation + 1,
      busy: false,
      controller: null,
      progress: null,
      disconnected: null,
    });
    _chatSave();
    if ($ui('chat-log')) $ui('chat-log').innerHTML = '';
  }
  uiChatSessions.set('lyrics', { state: neutral, input: '' });
  localStorage.setItem(CHAT_STORAGE_KEY + ':lyrics', JSON.stringify(neutral));
}
async function lyLibraryActivate(record, { restored = false, preservedDraftId } = {}) {
  lyLibraryDetachWriter();
  if (preservedDraftId) {
    const kept = lyricMetaOf(app.lyricMeta);
    app.lyricMeta = { ...kept, draftId: preservedDraftId };
    // The step recorded next is this draft's: its renumbering record (made
    // before it had an id) is named for it.
    if (kept.renumbered && !kept.renumbered.draftId)
      app.lyricMeta.renumbered = { ...kept.renumbered, draftId: preservedDraftId };
  }
  pushHistory();
  app.lyrics = record.text;
  app.lyricMeta = lyricMetaOf(record.meta);
  lyLibraryRecord = lyLibraryCopy(record);
  LY.metaRef = null;
  Object.assign(LY, {
    run: null,
    past: [],
    analysis: null,
    progress: null,
    outcomes: {},
    results: {},
    gate: null,
    conflict: null,
    text: null,
    tab: 'tools',
    tool: '',
    renumberedAll: false,
  });
  if (restored && record.writer) {
    // Restoring a saved draft restores its private continuation, never sends
    // a request. Interrupted work is recovered only by an explicit action.
    const state = lyLibraryCopy(record.writer);
    if (state.domain && !state.task) state.task = { domain: state.domain, phase: state.phase };
    uiChatSessions.set('lyrics', {
      state,
      input: record.writerInput || '',
      log: document.createDocumentFragment(),
    });
    localStorage.setItem(CHAT_STORAGE_KEY + ':lyrics', JSON.stringify(state));
    if (chatState.task?.domain !== 'recipe') {
      Object.assign(chatState, state, {
        busy: false,
        controller: null,
        generation: chatState.generation + 1,
        progress: null,
        disconnected: state.pending?.request_id || null,
      });
      _chatSave();
    }
    Object.assign(LY, record.pageReview || {});
  }
  lyDraft().value = record.text;
  // An import boundary: the step recorded next holds the migrated text.
  lyEnsureTokenScheme('open');
  UI.lyricRevision++;
  UI.lyricRequest = null;
  pushHistory();
  uiAutosave();
  // An in-page handoff (uiOpenInLyrics) pushes, so Back returns to the reading.
  uiNavigate('lyrics', { push: lyLibraryPush });
  if (restored && record.writerInput && $ui('chat-input')) {
    $ui('chat-input').value = record.writerInput;
    _chatSyncCount();
  }
  lyRefresh(true);
  lyLibraryDrafts = await lyLibraryStore.listDrafts();
  showToast(
    restored
      ? 'Saved draft restored. No writing request was sent.'
      : 'Library working copy imported. Your previous draft is under History.',
    'success'
  );
  return { persisted: !UI.saveFailed && !UI.storageConflict };
}
// One Library envelope through the receiver's no-binding path: validated,
// committed as a durable draft with its receipt, then activated. The JSON file
// import and the in-page handoff (imports.library below) both come here.
async function lyLibraryImport(envelope, { push = false } = {}) {
  if (!lyLibraryReceiver) await lyLibraryStart();
  if (!lyLibraryReceiver) throw new Error('The Library import receiver is unavailable.');
  lyLibraryPush = push;
  try {
    return await lyLibraryReceiver.importEnvelope(envelope);
  } finally {
    lyLibraryPush = false;
  }
}
async function lyLibraryStart() {
  if (lyLibraryReceiver || typeof CMLibraryImport === 'undefined') return;
  lyLibraryStore = CMLibraryImport.createIndexedDBStore();
  let importLock = null;
  lyLibraryReceiver = CMLibraryImport.createReceiver({
    window,
    store: lyLibraryStore,
    captureCurrent: async () => {
      importLock = lyLibraryAcquire();
      const previous = lyLibraryCapture();
      if (previous.meta.libraryOrigin && previous.originalText === null) {
        const stored = await lyLibraryStore.getDraft(previous.draftId);
        if (stored) previous.originalText = stored.originalText;
      }
      return previous;
    },
    releaseCurrent: () => {
      lyLibraryRelease(importLock);
      importLock = null;
    },
    activate: lyLibraryActivate,
    devOrigin: window.CODEX_LIBRARY_DEV_ORIGIN,
    onError: (error) => showToast('Library import failed: ' + error.message, 'error'),
  });
  try {
    await lyLibraryReceiver.start();
    lyLibraryDrafts = await lyLibraryStore.listDrafts();
    const id = lyMeta().draftId;
    if (id) lyLibraryRecord = await lyLibraryStore.getDraft(id);
    if (LY.tab === 'history') lyRenderHistory();
  } catch (error) {
    const requested = new URL(location.href).searchParams.has('cm_library_nonce');
    if (requested) showToast('Library import unavailable: ' + error.message, 'error');
  }
}
function lyLibraryPersist() {
  if (!UI.ready || !lyLibraryStore || !lyMeta().draftId) return;
  if (lyLibraryRecord?.draftId !== lyMeta().draftId && lyLibraryLoadingId !== lyMeta().draftId) {
    const id = lyMeta().draftId;
    lyLibraryLoadingId = id;
    lyLibraryStore
      .getDraft(id)
      .then((record) => {
        if (lyMeta().draftId === id && record) {
          lyLibraryRecord = record;
          lyRefresh(true);
        }
      })
      .catch(() =>
        showToast(
          'Saved source details could not be read. Export this session before closing it.',
          'error'
        )
      );
    return;
  }
  clearTimeout(lyLibrarySaveTimer);
  const origin = lyMeta().libraryOrigin;
  if (origin && lyLibraryRecord?.draftId === lyMeta().draftId) {
    const adapted = lyDraft().value !== lyLibraryRecord.originalText;
    if (origin.adapted !== adapted) {
      origin.adapted = adapted;
      uiAutosave();
    }
  }
  lyLibrarySaveTimer = setTimeout(async () => {
    try {
      await lyLibraryStore.saveDraft(lyLibraryCapture());
      lyLibraryDrafts = await lyLibraryStore.listDrafts();
    } catch {
      showToast(
        'The Library working copy could not be saved. Export this session to keep its text and credits.',
        'error'
      );
    }
  }, 300);
}
function lyLibrarySourceMarkup() {
  const origin = lyMeta().libraryOrigin;
  if (!origin) return '';
  const eligibility = CMLibraryImport.eligibleForWriter(lyDraft().value, origin.language || 'eng');
  return `<section class="ly-card" aria-label="Library source"><p>${icon('book-open', 16)} <strong>${esc(origin.title || 'Library working copy')}</strong> · ${origin.scope === 'excerpt' ? 'Excerpt' : 'Complete reading'}${origin.adapted ? ' · Adapted' : ''}</p><p class="ly-help">Source credits and coordinate lineage are preserved separately from sung lines.</p>${eligibility.reasons.map((reason) => `<p class="ly-help">${esc(reason)}</p>`).join('')}<div class="ly-actions">${lyBtn('ly-library-provenance', 'Export source details', 'download', { cls: 'cm-btn cm-btn-outline ly-sm' })}</div></section>`;
}
const lyNoteOf = (s) => lyMeta().notes[s.title] || '';
function lyBriefLine() {
  const b = lyMeta().brief.trim();
  return b ? b.split('\n')[0] : '';
}
const lyHookOf = (model) => lySetupOf(model, 'hook')[0]?.line || '';

// ── Tool drafts ───────────────────────────────────────────────────────────
// Every tool form reads its values from a controlled draft keyed by tool and
// target, never from committed setup while an entry is pending. Each entry
// holds the committed fingerprint it began from, its values, the fields that
// differ and their errors. Apply validates every pending field first; any
// error keeps every value and commits nothing; a valid Apply is one undo
// step. A target whose committed values moved underneath a pending entry is
// "changed": the entry is kept and Apply waits until the target is chosen
// again. Pending values never reach a provider.
const lyDraftKey = (tool, target) => `${tool}|${target}`;
function lyDrafts(tool) {
  const all = lyMeta().drafts;
  return Object.keys(all)
    .filter((k) => k.split('|')[0] === tool)
    .map((k) => all[k]);
}
function lyDraftOf(tool, target) {
  return lyMeta().drafts[lyDraftKey(tool, target)] || null;
}
// A pending value, else the committed one.
function lyVal(tool, target, field, committed) {
  const d = lyDraftOf(tool, target);
  return d && d.dirty.includes(field) ? d.values[field] : committed;
}
function lyDraftSet(tool, target, field, value) {
  const spec = LY_FORMS[tool];
  const model = LY.model;
  const drafts = lyMeta().drafts;
  const key = lyDraftKey(tool, target);
  const committed = spec.committed(model, target);
  let d = drafts[key];
  if (!d)
    d = drafts[key] = {
      tool,
      target,
      base: spec.fp(model, target),
      values: {},
      dirty: [],
      errors: {},
    };
  d.values[field] = value;
  const same = JSON.stringify(committed[field] ?? '') === JSON.stringify(value ?? '');
  d.dirty = d.dirty.filter((f) => f !== field);
  if (!same) d.dirty.push(field);
  delete d.errors[field];
  if (!d.dirty.length) delete drafts[key];
  lyMetaSaved();
}
function lyDraftStale(d, model = LY.model) {
  return !!d && LY_FORMS[d.tool].fp(model, d.target) !== d.base;
}
function lyPending(tool) {
  return lyDrafts(tool).reduce((t, d) => t + d.dirty.length, 0);
}
const lyDraftTools = (tool) => (tool === 'rhythm' ? ['rhythm', 'placement', 'melody'] : [tool]);
const lyToolPending = (tool) => lyDraftTools(tool).reduce((n, id) => n + lyPending(id), 0);
const lyPendingAll = () => LY_TOOLS.reduce((n, [id]) => n + lyToolPending(id), 0);
function lyDraftDiscard(tool, target = null) {
  const drafts = lyMeta().drafts;
  for (const k of Object.keys(drafts))
    if (k.split('|')[0] === tool && (target === null || drafts[k].target === target))
      delete drafts[k];
  lyMetaSaved();
}
// Rebind a changed target's entry to what is committed there now.
function lyDraftRebase(tool, target) {
  const d = lyDraftOf(tool, target);
  if (!d) return;
  d.base = LY_FORMS[tool].fp(LY.model, target);
  lyMetaSaved();
}
// Apply every pending entry of `tool` (or only `target`) as one change.
function lyDraftApply(tool, target = null, { reportFailure = true } = {}) {
  const spec = LY_FORMS[tool];
  const model = lyParse(lyDraft().value);
  const entries = lyDrafts(tool).filter((d) => target === null || d.target === target);
  if (!entries.length) return false;
  if (entries.some((d) => lyDraftStale(d, model))) {
    if (reportFailure) showToast('Target changed. Review these entries before applying.', 'error');
    return false;
  }
  let text = model.text;
  let bad = false;
  const messages = [];
  const migrated = [];
  const meta = lyMeta();
  const notes = { ...meta.notes };
  for (const d of entries) {
    const values = { ...spec.committed(lyParse(text), d.target) };
    for (const f of d.dirty) values[f] = d.values[f];
    const out = spec.apply(lyParse(text), d.target, values, d.dirty, notes);
    if (out.errors && Object.keys(out.errors).length) {
      d.errors = out.errors;
      bad = true;
      continue;
    }
    text = out.text ?? text;
    if (out.message) messages.push(out.message);
    if (out.migrated) migrated.push(out.migrated);
  }
  if (bad) {
    lyMetaSaved();
    // The errors must show even where a field still has focus.
    if (document.activeElement?.closest?.('#surface-lyrics')) document.activeElement.blur();
    lyRefresh(true);
    uiFocus(document.querySelector('#surface-lyrics [aria-invalid="true"]'));
    if (reportFailure) showToast('Nothing was applied. Correct the marked fields.', 'error');
    return false;
  }
  // A successful rhythm commit supersedes Save rhythm's receipt for that
  // section, including commits made through the shared Apply strip or gate.
  if (tool === 'rhythm' && entries.some((d) => Number(d.target) === LY.picks.rhythmSaved?.k))
    delete LY.picks.rhythmSaved;
  for (const d of entries) delete meta.drafts[lyDraftKey(d.tool, d.target)];
  meta.notes = notes;
  lyCommit(
    text,
    migrated.reduce(
      (msg, done) => lyFormMigrated(done, msg),
      messages.join(' ') || 'Changes applied. Undo reverses them.'
    )
  );
  return true;
}
// Each form keeps its own validation and Undo boundary. Report the combined
// outcome without hiding an earlier commit behind a later validation failure.
function lyDraftApplyTools(tools, { stopOnFailure = false } = {}) {
  let applied = false,
    failed = false;
  for (const tool of tools) {
    if (!lyPending(tool)) continue;
    if (lyDraftApply(tool, null, { reportFailure: false })) applied = true;
    else {
      failed = true;
      if (stopOnFailure) break;
    }
  }
  if (failed)
    showToast(
      `${applied ? 'Some changes were applied.' : 'Nothing was applied.'} Remaining changes are still pending. Review their fields and targets.${applied ? ' Use Undo to reverse applied changes one form at a time.' : ''}`,
      'error'
    );
  return { applied, failed };
}
const lyErr = (d, field) =>
  d?.errors?.[field]
    ? ` aria-invalid="true" aria-describedby="ly-err-${esc(field.replace(/\W/g, '-'))}"`
    : '';
const lyErrText = (d, field) =>
  d?.errors?.[field]
    ? `<p class="ly-field-error" id="ly-err-${esc(field.replace(/\W/g, '-'))}">${esc(d.errors[field])}</p>`
    : '';

// Section header rewrite on a text (not the live draft): one section's header.
function lyHeaderIn(text, sectionIndex, change) {
  const model = lyParse(text);
  const s = model.sections[sectionIndex];
  if (!s) return text;
  const rows = model.text.split('\n');
  const header = s.header
    ? { ...s.header, extra: [...s.header.extra], order: [...s.header.order] }
    : { name: 'SECTION', lines: null, bars: null, meter: null, pickup: null, extra: [], order: [] };
  change(header, s);
  const out = lyHeaderText(header);
  if (s.headerRow) rows[s.headerRow.i] = out;
  else rows.splice(s.rows[0].i, 0, out);
  return rows.join('\n');
}
const lySungSections = (model) => model.sections.filter((s) => s.sung.length);
function lyStorySteps(model) {
  const d = lySetupOf(model, 'narrative')[0];
  const plan = d ? lyParseNarrative(d.value) : null;
  const steps = new Map();
  if (plan && !plan.off)
    lySungSections(model).forEach((s, k) => plan.steps[k] && steps.set(s.index, plan.steps[k]));
  return { steps, off: !!plan?.off, declared: !!d };
}
const LY_NAME_BAD = /[[\]\n—]/;

// Each form: committed values for a target, its fingerprint, and how pending
// values become one text change (or field errors).
const LY_FORMS = {
  'form-story': {
    committed(model) {
      const v = {};
      const story = lyStorySteps(model);
      for (const s of model.sections) {
        v[`name.${s.index}`] = s.header ? s.header.name : '';
        v[`lines.${s.index}`] = s.header?.lines != null ? String(s.header.lines) : '';
        v[`atom.${s.index}`] = story.steps.get(s.index)?.atom || '';
        v[`junction.${s.index}`] = story.steps.get(s.index)?.junction || '';
        v[`note.${s.index}`] = lyNoteOf(s);
      }
      return v;
    },
    fp(model) {
      return (
        JSON.stringify(
          model.sections.map((s) => [s.title, s.header?.name ?? null, s.header?.lines ?? null])
        ) + JSON.stringify(lySetupOf(model, 'narrative').map((d) => d.value))
      );
    },
    apply(model, _target, v, dirty, notes) {
      const errors = {};
      for (const f of dirty) {
        const [kind] = f.split('.');
        const val = v[f] ?? '';
        if (kind === 'name' && (!val.trim() || val.length > 80 || LY_NAME_BAD.test(val)))
          errors[f] = 'A name of 1 to 80 characters, without brackets, dashes or line breaks.';
        if (kind === 'lines' && val !== '' && !/^\d{1,3}$/.test(String(val).trim()))
          errors[f] = 'Leave blank, or a whole number from 0 to 999.';
        if (kind === 'note' && val.length > 400) errors[f] = 'At most 400 characters.';
      }
      const sung = lySungSections(model);
      const storyDirty = dirty.some((f) => /^(atom|junction)\./.test(f));
      let narrative = null;
      if (storyDirty) {
        const rows = sung.map((s) => ({
          s,
          atom: v[`atom.${s.index}`],
          junction: v[`junction.${s.index}`],
        }));
        if (rows.every((r) => !r.atom && !r.junction)) narrative = [];
        else {
          rows.forEach((r, k) => {
            if (!r.atom) errors[`atom.${r.s.index}`] = 'Choose a story job for every sung section.';
            if (k && !r.junction)
              errors[`junction.${r.s.index}`] = 'Choose how this section follows.';
          });
          narrative = [rows.map((r, k) => (k ? `${r.atom}/${r.junction}` : r.atom)).join(',')];
        }
      }
      if (Object.keys(errors).length) return { errors };
      let text = model.text;
      const titles = model.sections.map((s) => s.title);
      for (const s of model.sections) {
        const nd = dirty.includes(`name.${s.index}`),
          ld = dirty.includes(`lines.${s.index}`);
        if (!nd && !ld) continue;
        text = lyHeaderIn(text, s.index, (h) => {
          if (nd) h.name = v[`name.${s.index}`].trim();
          if (ld) h.lines = v[`lines.${s.index}`] === '' ? null : Number(v[`lines.${s.index}`]);
        });
      }
      if (narrative) text = lySetSetup('narrative', narrative, text);
      // Notes follow their section to its (possibly new) title.
      const after = lyParse(text);
      for (const s of model.sections) {
        const note = dirty.includes(`note.${s.index}`)
          ? v[`note.${s.index}`]
          : notes[titles[s.index]];
        const t = after.sections[s.index]?.title;
        if (titles[s.index] !== t || dirty.includes(`note.${s.index}`)) {
          delete notes[titles[s.index]];
          if (t && note && note.trim()) notes[t] = note.trim().slice(0, 400);
        }
      }
      return { text, message: 'Form & story applied. Undo reverses it.' };
    },
  },
  rhythm: {
    committed(model, target) {
      const s = model.sections[Number(target)];
      const h = s?.header || {};
      return {
        meter: h.meter || '',
        bars: h.bars != null ? String(h.bars) : '',
        pickup: h.pickup || '',
      };
    },
    fp(model, target) {
      const s = model.sections[Number(target)];
      return s
        ? JSON.stringify([
            s.title,
            s.header?.meter ?? null,
            s.header?.bars ?? null,
            s.header?.pickup ?? null,
          ])
        : 'none';
    },
    apply(model, target, v) {
      const errors = {};
      const meter = String(v.meter || '').trim(),
        bars = String(v.bars || '').trim();
      if (meter && !LY_METER.test(meter))
        errors.meter = 'Write the meter as beats/unit, each from 1 to 99, e.g. 6/8.';
      if (bars && (!/^\d{1,3}$/.test(bars) || Number(bars) < 1))
        errors.bars = 'Leave blank, or a whole number from 1 to 999.';
      if (v.pickup && !meter) errors.pickup = 'A pickup needs a meter.';
      if (Object.keys(errors).length) return { errors };
      const k = Number(target);
      const s = model.sections[k];
      if (!s) return { errors: { meter: 'This section no longer exists.' } };
      const text = lyHeaderIn(model.text, k, (h) => {
        h.meter = meter || null;
        h.bars = bars ? Number(bars) : null;
        h.pickup = v.pickup || null;
      });
      return {
        text,
        message: `${meter || 'No meter'} saved · ${bars ? uiCount(Number(bars), 'bar') : 'bars not set'}.`,
      };
    },
  },
  placement: {
    committed(model, target) {
      const s = model.sections[Number(target)];
      const have = new Map(
        lySetupOf(model, 'placement')
          .flatMap((d) => lyParsePlacement(d.value))
          .filter((r) => !r.bad)
          .map((r) => [r.line, r])
      );
      const v = {};
      for (const r of s?.sung || []) {
        const p = have.get(r.n) || {};
        v[`bar.${r.n}`] = p.bar != null ? String(p.bar) : '';
        v[`beat.${r.n}`] = p.beat != null ? String(p.beat) : '';
        v[`duration.${r.n}`] = p.duration != null ? String(p.duration) : '';
      }
      return v;
    },
    fp(model, target) {
      const s = model.sections[Number(target)];
      return s ? JSON.stringify([s.title, s.sung.map((r) => r.n)]) : 'none';
    },
    apply(model, target, v) {
      const errors = {};
      const sec = model.sections[Number(target)];
      if (!sec) return { errors: {} };
      const next = [];
      const num = (x) => /^\d+(\.\d+)?$/.test(x) && Number(x) > 0;
      for (const r of sec.sung) {
        const bar = String(v[`bar.${r.n}`] ?? '').trim(),
          beat = String(v[`beat.${r.n}`] ?? '').trim(),
          duration = String(v[`duration.${r.n}`] ?? '').trim();
        const filled = [bar, beat, duration].filter(Boolean).length;
        if (!filled) continue;
        if (filled < 3 || !/^\d+$/.test(bar) || Number(bar) < 1 || !num(beat) || !num(duration)) {
          errors[`bar.${r.n}`] =
            `Line ${r.n}: a whole bar number, a start beat and a duration in beats (all above zero), or all three blank.`;
          continue;
        }
        next.push({ line: r.n, bar: Number(bar), beat: Number(beat), duration: Number(duration) });
      }
      if (Object.keys(errors).length) return { errors };
      const inSection = new Set(sec.sung.map((r) => r.n));
      const others = lySetupOf(model, 'placement')
        .flatMap((d) => lyParsePlacement(d.value))
        .filter((r) => !r.bad && !inSection.has(r.line));
      const all = [...others, ...next];
      return {
        text: lySetSetup('placement', all.length ? [lyPlacementText(all)] : [], model.text),
        message: next.length
          ? `Placement declared for ${sec.title}.`
          : `Placement cleared for ${sec.title}.`,
      };
    },
  },
  melody: {
    committed(model) {
      const d = lySetupOf(model, 'melody')[0];
      const m = d ? lyParseMelody(d.value).melody : null;
      return m
        ? {
            meter: `${m.meter.beats}/${m.meter.unit}`,
            groups: m.meter.groups.join('+'),
            bars: String(m.bars),
            subdivision: String(m.subdivision),
            events: m.notes
              .map((n) => `${n.pitch_hz === null ? 'rest' : n.pitch_hz}:${n.ticks}`)
              .join(' '),
          }
        : { meter: '', groups: '', bars: '', subdivision: '2', events: '' };
    },
    fp(model) {
      return JSON.stringify(lySetupOf(model, 'melody').map((d) => d.value));
    },
    apply(model, _t, v) {
      if (!v.meter && !v.events && !v.bars)
        return { text: lySetSetup('melody', [], model.text), message: 'Melody removed.' };
      const text = [
        v.meter,
        v.groups && `groups ${v.groups}`,
        v.bars && `${v.bars} bars`,
        `subdivision ${v.subdivision || 2}`,
        v.events,
      ]
        .filter(Boolean)
        .join(LY_DASH);
      const m = lyParseMelody(text);
      if (m.error) return { errors: { events: m.error } };
      return {
        text: lySetSetup('melody', [lyMelodyText(m.melody)], model.text),
        message: 'Melody declared.',
      };
    },
  },
  rhymes: {
    committed(model) {
      return { relation: lySetupOf(model, 'relation')[0]?.value || '', members: [] };
    },
    fp(model) {
      return JSON.stringify([
        lySetupOf(model, 'relation').map((d) => d.value),
        lySetupOf(model, 'rhyme groups').map((d) => d.value),
      ]);
    },
    apply(model, _t, v, dirty) {
      const errors = {};
      let text = model.text;
      const rel = String(v.relation || '').trim();
      if (dirty.includes('relation') && rel && !/^(type|class|schema):\S/.test(rel))
        errors.relation = 'Name the relation with its namespace: type:, class: or schema:.';
      const members = Array.isArray(v.members) ? v.members : [];
      if (dirty.includes('members')) {
        const seen = new Set();
        for (const m of members) {
          const k = `${m.line}.${m.place}`;
          if (seen.has(k)) errors.members = 'A member appears twice.';
          seen.add(k);
          if (!model.sung[m.line - 1]) errors.members = `Line ${m.line} is not in the draft.`;
        }
        if (members.length < 2) errors.members = 'A link needs at least two members.';
      }
      if (Object.keys(errors).length) return { errors };
      const out = [];
      if (dirty.includes('relation')) {
        text = lySetSetup('relation', rel ? [rel] : [], text);
        out.push(rel ? `Relation declared: ${rel}.` : 'Relation no longer declared.');
      }
      let migrated = null;
      if (dirty.includes('members')) {
        // The existing rows read under the unmarked-row policy first
        // (lyFormBase), then marked.
        const base = lyFormBase('rhyme groups', text);
        const groups = base.groups;
        groups.push(members.map((m) => ({ line: m.line, place: m.place })));
        text = lySetSetup('rhyme groups', [lyGroupsText(groups)], base.text);
        migrated = base.done;
        out.push('Rhyme link saved.');
      }
      return { text, message: out.join(' '), migrated };
    },
  },
  pronunciation: {
    committed() {
      return { kind: '', phones: '', source: '', option: '' };
    },
    // Target: "line text|token|word"; it stands while that exact word does.
    fp(model, target) {
      const [line, token, word] = lyReadingTarget(target);
      const ok =
        model.sung.some((r) => r.text === line) && lyTokens(line, model.voices)[token - 1] === word;
      return ok ? 'ok' : 'gone';
    },
    apply(model, target, v) {
      const [line, token, word] = lyReadingTarget(target);
      const errors = {};
      const kind = v.kind;
      if (!['dictionary', 'declared', 'uncertain', 'choice'].includes(kind))
        errors.kind = 'Choose a reading, declare your own, or mark it uncertain.';
      const data = {
        token,
        word,
        line,
        kind: kind === 'dictionary' ? 'declared' : kind,
        numbering: kind === 'dictionary' ? v.numbering : lyNumbering(model.voices),
      };
      if (kind === 'dictionary') data.token = v.numberingToken || token;
      if (
        kind === 'dictionary' &&
        lyNumberingTarget(line, data.token, word, data.numbering, model.voices) !== token
      )
        errors.kind =
          'Fetch dictionary options for the current word numbering before choosing a reading.';
      if (kind === 'dictionary' || kind === 'declared') {
        data.phones = String(v.phones || '')
          .trim()
          .toUpperCase()
          .split(/\s+/)
          .filter(Boolean);
        data.basis = kind === 'dictionary' ? 'dictionary' : 'declared';
        data.source = String(v.source || '').trim() || (kind === 'dictionary' ? 'CMUdict' : '');
        const bad = lyValidPhones(data.phones);
        if (bad) errors.phones = bad;
        if (!data.source) errors.source = 'Say who chose this reading and why, or its source.';
      }
      if (line.includes(']'))
        errors.kind = 'This line contains “]”, which a setup line cannot hold.';
      if (Object.keys(errors).length) return { errors };
      // A reading chosen again replaces the one it supersedes: the same
      // current word, or an undecided saved reading of the word this one is
      // (lyReadingSuperseded), so following Review's "choose it again" clears
      // the block. Any other undecided reading stays, and still blocks.
      const others = lySetupOf(model, 'reading')
        .filter((r) =>
          r.undecided
            ? !lyReadingSuperseded(r, line, token, model.voices)
            : !(r.line === line && r.token === token)
        )
        .map((r) => r.value);
      const lines = model.sung.filter((r) => r.text === line).map((r) => r.n);
      return {
        text: lySetSetup('reading', [...others, lyReadingValue(data)], model.text),
        message: `Reading for “${word}” saved for ${lyLineRef(lines)}.`,
      };
    },
  },
  'repeats-voices': {
    committed(model) {
      return { voices: model.voices ? 'sung' : 'unsung', placed: [] };
    },
    fp(model) {
      return JSON.stringify([model.voices, lySetupOf(model, 'returns').map((d) => d.value)]);
    },
    apply(model, _t, v, dirty) {
      let text = model.text;
      const out = [];
      if (dirty.includes('voices')) {
        text = lySetSetup('voices', v.voices === 'sung' ? ['parentheses are sung'] : [], text);
        out.push(
          v.voices === 'sung'
            ? 'Parentheses are a sung second voice.'
            : 'Parentheses are unsung asides.'
        );
      }
      let migrated = null;
      if (dirty.includes('placed')) {
        const members = v.placed || [];
        if (members.length < 2)
          return { errors: { placed: 'A placed return needs at least two members.' } };
        const base = lyFormBase('returns', text);
        const groups = base.groups;
        groups.push(members.map((m) => ({ line: m.line, place: m.place })));
        text = lySetSetup('returns', [lyGroupsText(groups)], base.text);
        migrated = base.done;
        out.push('Placed return declared.');
      }
      return { text, message: out.join(' '), migrated };
    },
  },
  'word-rules': {
    committed(model) {
      return {
        require: lySetupOf(model, 'require').map((d) => d.value),
        avoid: lySetupOf(model, 'avoid').map((d) => d.value),
      };
    },
    fp(model) {
      return JSON.stringify([
        lySetupOf(model, 'require').map((d) => d.value),
        lySetupOf(model, 'avoid').map((d) => d.value),
      ]);
    },
    apply(model, _t, v, dirty) {
      let text = model.text;
      const notes = [];
      for (const key of ['require', 'avoid']) {
        if (!dirty.includes(key)) continue;
        const seen = new Set();
        const list = [];
        for (const raw of v[key] || []) {
          const w = String(raw)
            .replace(/[\]\n]/g, ' ')
            .trim();
          if (!w) continue;
          const k = lyNorm(w).join(' ') || w.toLowerCase();
          if (seen.has(k)) {
            notes.push(`“${w}” was listed twice and is kept once.`);
            continue;
          }
          seen.add(k);
          list.push(w);
        }
        text = lySetSetup(key, list, text);
      }
      return { text, message: ['Word rules applied.', ...notes].join(' ') };
    },
  },
};
const lyReadingTarget = (t) => {
  const [line, token, word] = JSON.parse(t);
  return [line, Number(token), word];
};
const lyReadingKey = (line, token, word) => JSON.stringify([line, token, word]);

// ── The current document's analysis ───────────────────────────────────────
// Three records never derived from one another: persistence (the shell's
// autosave), this analysis, and the latest writer attempt (LY.run / chatState).
const LY_ANALYSIS = {
  none: ['Not reviewed', 'warning'],
  running: ['Reviewing this version', 'info'],
  assessed_clear: ['Reviewed for this version', 'info'],
  assessed_findings: ['Reviewed · issues found', 'warning'],
  input: ['Review needs input', 'warning'],
  stale: ['Edited since review', 'warning'],
  failed: ['Review incomplete', 'danger'],
};
const lyLyricChat = () =>
  (chatState.task?.domain || chatState.pending?.domain) === 'lyrics' || !!chatState.lyric;
function lyAnalysis(model = LY.model) {
  const now = lyIdentity(model);
  const a = LY.analysis;
  const out = (state, more = {}) => ({
    state,
    label: LY_ANALYSIS[state][0],
    tone: LY_ANALYSIS[state][1],
    ...more,
  });
  if (chatState.busy && lyLyricChat() && a && a.requestId === chatState.pending?.request_id)
    return out('running', { earlier: now !== a.baseId });
  const run = LY.run;
  if (!run || (run.baseId == null && run.resultId == null)) return out('none', { legacy: !!run });
  if (now !== run.resultId && now !== run.baseId) return out('stale');
  const lyric = run.lyric || {};
  if (
    run.error ||
    (run.stopped && !run.recoveryExport) ||
    run.artifact?.status === 'interrupted' ||
    lyric.uncertain_proposal
  )
    return out('failed');
  const refused = (run.coverage?.obligations || []).some((o) => o.status === 'refused');
  if (refused || (lyRunLive(run) && lyLiveWaiting())) return out('input');
  const findings = lyRunChecks(model).filter((i) => i.tone === 'issue' && !i.stale).length;
  if (findings) return out('assessed_findings');
  // Only the server's artifact and completion, both certifying this exact
  // version, add Certified; anything short of a complete inventory is not clear.
  const certified = !!lyRunOutcome(run)?.certified && now === run.resultId;
  if (certified) return out('assessed_clear', { certified });
  if (!run.coverage) return out('failed');
  return out('assessed_clear', { certified: false });
}
// Which layer an obligation belongs to, for the coverage rows.
function lyLayerOf(o) {
  const id = String(o.layer || o.id || '').toLowerCase();
  if (/pronunc|reading/.test(id)) return 'Pronunciation';
  if (/meter|rhythm|bar|placement|melody|stress|beat|syllab/.test(id)) return 'Rhythm';
  if (/pair|rhyme|group|relation|assonance|consonance/.test(id)) return 'Rhymes';
  return 'Form';
}

// ── Mount ─────────────────────────────────────────────────────────────────
function lyMountMarkup() {
  const sectionItems =
    LY_SECTION_NAMES.map((name) => lyMenuItem('ly-add-section', name, 'plus', name)).join('') +
    '<div class="cm-menu-sep"></div>' +
    lyMenuItem('ly-add-section', 'Custom…', 'pencil', '');
  const tabs = LY_TABS.map(
    ([id, label, ic]) =>
      `<button type="button" class="ly-itab" role="tab" id="ly-tab-${id}" data-ui="ly-tab" data-id="${id}" aria-controls="ly-panel-${id}" aria-selected="false" tabindex="-1">${icon(ic, 20)}<span>${label}</span></button>`
  ).join('');
  const panels = LY_TABS.map(
    ([id]) =>
      `<div class="ly-ipanel" id="ly-panel-${id}" role="tabpanel" aria-labelledby="ly-tab-${id}" tabindex="0" hidden>${
        id === 'writer'
          ? '<section class="ly-convo" aria-labelledby="ly-convo-h"><h3 class="ly-h3" id="ly-convo-h">Writer request</h3><p class="ly-help" id="ly-composer-mode"></p><div id="lyrics-chat"></div></section><div id="ly-writer-status"></div>'
          : ''
      }</div>`
  ).join('');
  const mobileTabs = [
    ['song', 'Song', 'file-text'],
    ['tools', 'Tools', 'wrench'],
    ['writer', 'Writer', 'user'],
    ['review', 'Review', 'file-check'],
  ]
    .map(
      ([id, label, ic]) =>
        `<button type="button" class="ly-mtab" role="tab" id="ly-mtab-${id}" data-ui="ly-mobile" data-id="${id}" aria-controls="ly-body" aria-selected="false" tabindex="-1">${icon(ic, 20)}<span>${label}</span></button>`
    )
    .join('');
  return `<div class="ly-page" id="ly-page">
<header class="ly-head" id="ly-head">
  <div class="ly-head-main">
    <div class="ly-title-wrap" id="ly-title-wrap"></div>
    <p class="ly-workspace" id="ly-workspace"></p>
  </div>
  <div class="ly-head-actions">
    <span id="ly-badge" class="ly-badge-wrap" role="status" aria-live="polite"></span>
    ${lyBtn('ly-tab', 'Review', 'file-check', { id: 'review', cls: 'cm-btn cm-btn-outline' })}
    ${lyMenu(
      'song-actions',
      'Song actions',
      'ellipsis',
      lyMenuItem('new-lyrics', 'Write a new song', 'file-plus') +
        lyMenuItem('edit-lyrics', 'Edit this draft', 'pencil') +
        lyMenuItem('attach-recipe', 'Use current recipe', 'layers') +
        '<div class="cm-menu-sep"></div>' +
        lyMenuItem('ly-blank', 'New document', 'file') +
        lyMenuItem('ly-import', 'Import lyrics', 'upload') +
        lyMenuItem('ly-tab', 'History', 'history', 'history') +
        '<div class="cm-menu-sep"></div>' +
        lyMenuItem('copy-lyrics', 'Copy with headers', 'copy') +
        lyMenuItem('ly-copy-sung', 'Copy sung lines', 'clipboard') +
        lyMenuItem('ly-download', 'Download text', 'download') +
        lyMenuItem('ly-export-session', 'Export session', 'upload'),
      { cls: 'cm-btn cm-btn-outline', align: 'end' }
    )}
  </div>
  <div class="ly-head-note" id="ly-gate" hidden></div>
</header>
<div class="ly-body" id="ly-body">
  <aside class="ly-outline" id="ly-outline" aria-labelledby="ly-outline-h">
    <button type="button" class="ly-rail-btn" data-ui="ly-outline-toggle" aria-expanded="false" aria-controls="ly-outline-panel" aria-label="Sections" title="Sections">${icon('list', 20)}<span>Sections</span></button>
    <div class="ly-outline-panel" id="ly-outline-panel">
      <div class="ly-pane-head"><h2 class="ly-h2" id="ly-outline-h">Sections</h2>${lyBtn('ly-outline-toggle', 'Collapse sections', 'chevrons-left', { cls: 'cm-btn cm-btn-icon ly-outline-close', hideLabel: true, extra: 'aria-expanded="true" aria-controls="ly-outline-panel"' })}</div>
      <ol class="ly-sections" id="ly-sections"></ol>
      <p class="ly-totals" id="ly-totals"></p>
      <div class="ly-outline-foot">
        ${lyMenu('add', 'Add section', 'plus', sectionItems, { cls: 'cm-btn cm-btn-outline ly-add', chevron: false })}
        <div class="ly-foot-row">${lyBtn('ly-blank', 'New', 'file', { cls: 'cm-btn cm-btn-outline' })}${lyBtn('ly-import', 'Import', 'upload', { cls: 'cm-btn cm-btn-outline' })}</div>
      </div>
    </div>
  </aside>
  <main class="ly-main" id="ly-main" aria-label="Song">
    <div class="ly-brief" id="ly-brief"></div>
    <div id="ly-library-source" hidden></div>
    <div id="ly-relation-inspector" class="ly-relation-inspector" hidden></div>
    <div class="ly-main-scroll" id="ly-main-scroll">
      <div class="ly-section-nav" id="ly-section-nav"></div>
      <div class="ly-toolbar" role="toolbar" aria-label="Document" id="ly-toolbar">
        ${lyBtn('ly-find-open', 'Find', 'search', { cls: 'cm-btn cm-btn-outline', extra: 'aria-controls="ly-find" aria-expanded="false"' })}
        ${lyBtn('ly-undo', 'Undo', 'undo-2', { cls: 'cm-btn cm-btn-outline' })}
        ${lyBtn('ly-redo', 'Redo', 'redo-2', { cls: 'cm-btn cm-btn-outline' })}
        ${lyMenu('display', 'Display', 'monitor', '<div class="cm-menu-label">Text size</div>' + ['Normal', 'Large', 'Larger'].map((l, k) => lyMenuItem('ly-text-size', l, '', String(k), 'aria-pressed="false"')).join('') + '<div class="cm-menu-sep"></div>' + lyMenuItem('ly-numbers', 'Line numbers', '', '', 'aria-pressed="true"'), { cls: 'cm-btn cm-btn-outline' })}
      </div>
      <div class="ly-find" id="ly-find" hidden role="search"><input id="ly-find-input" class="cm-input" type="search" placeholder="Find in lyrics" aria-label="Find in lyrics" autocomplete="off"><span id="ly-find-count" class="ly-find-count" role="status" aria-live="polite"></span>${lyBtn('ly-find-step', 'Previous match', 'arrow-up', { id: '-1', cls: 'cm-btn cm-btn-icon', hideLabel: true })}${lyBtn('ly-find-step', 'Next match', 'arrow-down', { id: '1', cls: 'cm-btn cm-btn-icon', hideLabel: true })}${lyBtn('ly-find-close', 'Close find', 'x', { cls: 'cm-btn cm-btn-icon', hideLabel: true })}</div>
      <div class="ly-doc-note" id="ly-doc-note" hidden></div>
      <div class="ly-tool-main" id="ly-tool-main" hidden></div>
      <div class="ly-doc-wrap" id="ly-doc-wrap">
        <div class="ly-empty-doc" id="ly-empty-doc" hidden></div>
        <div class="ly-editor" id="ly-editor">
          <div class="ly-overlay" id="ly-overlay" aria-hidden="true"></div>
          <label for="lyrics-draft" class="ly-sr">Lyrics document. A line in [brackets] starts a section.</label>
          <textarea id="lyrics-draft" class="ly-input" spellcheck="true" autocapitalize="sentences" placeholder="Write here. A line in [brackets] starts a section, e.g. [Verse 1] or [CHORUS — 4 lines — 4 bars of 4/4]."></textarea>
          <div class="ly-linebar" id="ly-linebar" role="toolbar" hidden></div>
        </div>
      </div>
    </div>
    <div class="ly-linedock" id="ly-linedock" role="toolbar" hidden></div>
  </main>
  <aside class="ly-inspector" id="ly-inspector" aria-label="Tools, writer, review and history">
    <div class="ly-itabs" role="tablist" aria-label="Inspector">${tabs}</div>
    ${panels}
  </aside>
</div>
<dialog id="ly-relations-dialog" class="ly-relations-dialog" aria-label="Relations"></dialog>
<nav class="ly-mnav" id="ly-mnav" aria-label="Lyrics views"><div role="tablist" aria-label="Lyrics views">${mobileTabs}</div></nav>
<div class="ly-sheet-scrim" id="ly-scrim" hidden data-ui="ly-outline-toggle"></div>
<input type="file" id="ly-file" accept=".txt,.md,.json,text/plain,application/json" hidden>
<div id="ly-live" class="ly-sr" role="status" aria-live="polite"></div>
</div>`;
}

// ── Header and song brief ─────────────────────────────────────────────────
function lyRenderHead() {
  const model = LY.model;
  const title = lyTitleOf(model);
  const wrap = $ui('ly-title-wrap');
  if (LY.titleEdit) {
    if (!wrap.querySelector('input'))
      wrap.innerHTML = `<label class="ly-sr" for="ly-title-input">Song title</label><input id="ly-title-input" class="cm-input ly-title-input" maxlength="160" value="${esc(title)}" placeholder="Untitled song" autocomplete="off">`;
  } else
    wrap.innerHTML = `<h2 class="ly-title"><button type="button" class="ly-title-btn" data-ui="ly-title-edit" aria-label="Song title: ${esc(title || 'Untitled song')}. Edit title"><span>${esc(title || 'Untitled song')}</span>${icon('pencil', 18)}</button></h2>`;
  const ws =
    app.workspaceName && app.workspaceName !== 'Untitled session'
      ? app.workspaceName
      : 'Untitled workspace';
  $ui('ly-workspace').textContent = `Workspace: ${ws}`;
  $ui('ly-menu-song-actions').setAttribute('aria-label', `Song actions · Workspace: ${ws}`);
  document
    .querySelector('[aria-controls="ly-menu-song-actions"]')
    ?.setAttribute('aria-describedby', 'ly-workspace');
  const a = lyAnalysis(model);
  LY.state = a;
  $ui('ly-badge').innerHTML =
    lyPill(a.tone, a.label) + (a.certified ? lyPill('success', 'Certified for this version') : '');
  const gate = $ui('ly-gate');
  if (LY.gate && lyPendingAll()) {
    gate.hidden = false;
    gate.innerHTML = `<div class="ly-inline" data-tone="warning" role="alert">${icon('triangle-alert', 18)}<span><strong>Apply pending changes before review</strong> ${esc(uiCount(lyPendingAll(), 'pending change'))} are not in the document. Review saved version sends only what is committed.</span><div class="ly-actions">${lyBtn('ly-gate-apply', 'Apply all', 'check', { cls: 'cm-btn cm-btn-tonal' })}${lyBtn('ly-gate-saved', 'Review saved version', 'play', { cls: 'cm-btn cm-btn-outline' })}${lyBtn('ly-gate-close', 'Cancel', '', { cls: 'cm-btn' })}</div></div>`;
  } else {
    LY.gate = null;
    gate.hidden = true;
    gate.innerHTML = '';
  }
}
function lyRenderBrief() {
  const box = $ui('ly-brief');
  const meta = lyMeta();
  const model = LY.model;
  const hook = lyHookOf(model);
  if (LY.briefEdit) {
    if (box.querySelector('form')) return;
    const hookN = model.sung.find((r) => r.text === hook)?.n || 0;
    box.innerHTML = `<form class="ly-brief-form" id="ly-brief-form" aria-labelledby="ly-brief-h"><h3 class="ly-h3" id="ly-brief-h">Song brief</h3><label class="ly-label" for="ly-brief-text">Creative brief</label><textarea id="ly-brief-text" class="cm-input ly-brief-text" maxlength="4000" rows="3" aria-describedby="ly-brief-help">${esc(meta.brief)}</textarea><p class="ly-help" id="ly-brief-help">Creative context for the writer: what the song is for. It is not graded.</p><label class="ly-label" for="ly-hook-in">Exact hook line</label><select id="ly-hook-in" class="cm-select"><option value="">Hook not declared</option>${lyLineOptions(model, hookN, { distinct: true })}</select><div class="ly-actions">${lyBtn('ly-brief-save', 'Save brief', 'check', { cls: 'cm-btn cm-btn-primary' })}${lyBtn('ly-brief-cancel', 'Cancel', '', { cls: 'cm-btn cm-btn-outline' })}</div></form>`;
    return;
  }
  const line = lyBriefLine();
  box.innerHTML = `<div class="ly-brief-strip"><span class="ly-brief-label">${icon('file-text', 18)}<strong>Song brief</strong></span><span class="ly-brief-text${line ? '' : ' is-empty'}" title="${esc(meta.brief)}">${esc(line || 'No brief yet')}</span><span class="ly-brief-hook${hook ? '' : ' is-empty'}" title="${esc(hook)}">${esc(hook ? `Hook: ${hook}` : 'Hook not declared')}</span>${lyBtn('ly-brief-edit', 'Edit brief', 'pencil', { cls: 'cm-btn ly-link-btn' })}</div>`;
}
const lyLineOptions = (model, selected, { distinct = false } = {}) => {
  const seen = new Set();
  return model.sung
    .filter((r) => (distinct ? !seen.has(r.text) && seen.add(r.text) : true))
    .map(
      (r) =>
        `<option value="${r.n}"${r.n === selected ? ' selected' : ''}>${r.n} · ${esc(r.text.slice(0, 60))}</option>`
    )
    .join('');
};

// ── Section outline ───────────────────────────────────────────────────────
function lyRenderOutline() {
  const model = LY.model;
  const active = lySectionOfLine(model, LY.activeLine) || lySectionAtRow(model, LY.caretRow);
  $ui('ly-sections').innerHTML = model.sections.length
    ? model.sections
        .map(
          (s) =>
            `<li><button type="button" class="ly-sec${active === s ? ' is-active' : ''}" data-ui="ly-goto" data-id="${s.index}"${active === s ? ' aria-current="true"' : ''}>${icon('file-text', 18)}<span class="ly-sec-name">${esc(s.title)}</span><span class="ly-sec-count" aria-label="${esc(uiCount(s.sung.length, 'line'))}">${s.sung.length}</span></button></li>`
        )
        .join('')
    : `<li class="ly-help ly-pad">No sections yet. A line in [brackets] starts one.</li>`;
  $ui('ly-totals').textContent =
    `${uiCount(model.sung.length, 'line')} · ${uiCount(model.sections.length, 'section')}`;
  const page = $ui('ly-page');
  const railed = LY.size === 'compact' || (LY.size === 'wide' && !LY.outline);
  page.dataset.outline =
    LY.size === 'narrow'
      ? LY.railOpen
        ? 'sheet'
        : 'closed'
      : railed
        ? LY.railOpen
          ? 'overlay'
          : 'rail'
        : 'open';
  document
    .querySelectorAll('[data-ui="ly-outline-toggle"][aria-controls]')
    .forEach((b) =>
      b.setAttribute('aria-expanded', String(page.dataset.outline === 'open' || LY.railOpen))
    );
  $ui('ly-scrim').hidden = !(LY.railOpen && (LY.size === 'narrow' || railed));
  lySheetModal(page.dataset.outline === 'sheet');
  // Song view on a phone: previous/next section and where the reader is.
  const nav = $ui('ly-section-nav');
  if (LY.size === 'narrow' && model.sections.length) {
    const k = active ? active.index : 0;
    const s = model.sections[k];
    nav.innerHTML = `${lyBtn('ly-sec-step', 'Previous section', 'chevron-left', { id: '-1', cls: 'cm-btn cm-btn-icon', hideLabel: true, extra: k === 0 ? 'disabled' : '' })}<button type="button" class="ly-sec-pos" data-ui="ly-outline-toggle" aria-controls="ly-outline-panel" aria-expanded="${LY.railOpen}">${icon('file-text', 18)}<strong>${esc(s.title)}</strong><span>· ${k + 1} of ${model.sections.length}</span></button>${lyBtn('ly-sec-step', 'Next section', 'chevron-right', { id: '1', cls: 'cm-btn cm-btn-icon', hideLabel: true, extra: k >= model.sections.length - 1 ? 'disabled' : '' })}`;
    nav.hidden = false;
  } else {
    nav.hidden = true;
    nav.innerHTML = '';
  }
}
function lySectionAtRow(model, i) {
  let found = null;
  for (const s of model.sections) {
    const start = s.headerRow ? s.headerRow.i : (s.rows[0]?.i ?? Infinity);
    if (start <= i) found = s;
  }
  return found;
}

// ── The document: one textarea, one read layer ────────────────────────────
// The whole-document textarea stays the authoritative input: caret,
// selection, typing, paste, IME, spellcheck, find and undo are the browser's
// own. Its text is transparent; the read layer underneath draws the same rows
// in the same font and wrapping, so every glyph sits exactly where the
// textarea's caret expects it. Headers, setup rows and stamps are drawn as
// labels over their (invisible) raw text; the row holding the caret shows its
// raw text so it can be edited in place.
// Exact raw-document consumers for the tools lane's validated evidence adapter.
// These are NOT evidence validators: source, reader, voices, freshness and pair
// identity must already have been checked by the caller. No word-search fallback.
function lyValidateRangeParts(text, parts) {
  const fail = (reason) => ({ ok: false, reason });
  if (typeof text !== 'string' || !Array.isArray(parts) || !parts.length)
    return fail('missing-parts');
  if (typeof Intl.Segmenter !== 'function') return fail('grapheme-boundaries-unavailable');
  const boundaries = new Set([text.length]);
  for (const segment of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text))
    boundaries.add(segment.index);
  let previous = 0;
  for (const part of parts) {
    if (
      !part ||
      !Number.isInteger(part.start) ||
      !Number.isInteger(part.end) ||
      part.start < previous ||
      part.end <= part.start ||
      part.end > text.length
    )
      return fail('invalid-range');
    if (!boundaries.has(part.start) || !boundaries.has(part.end)) return fail('split-grapheme');
    if (typeof part.text !== 'string' || text.slice(part.start, part.end) !== part.text)
      return fail('text-mismatch');
    previous = part.end;
  }
  return { ok: true, parts: parts.map(({ start, end, text }) => ({ start, end, text })) };
}
// Split overlaps without losing occurrence IDs or painting the gaps between a
// discontinuous endpoint's parts. Unplaceable occurrences remain caller-owned.
function lyPrepareRangeMarks(currentText, view) {
  if (!view || view.text !== currentText || !Array.isArray(view.occurrences))
    return { ok: false, reason: 'document-mismatch', segments: [] };
  const edges = new Map(),
    rejected = [],
    seen = new Set();
  for (const occurrence of view.occurrences) {
    const id = occurrence?.id;
    if (typeof id !== 'string' || !id || seen.has(id))
      return { ok: false, reason: 'invalid-occurrence-id', segments: [] };
    seen.add(id);
    const checked =
      occurrence.canPaint === true
        ? lyValidateRangeParts(currentText, occurrence.parts)
        : { ok: false, reason: 'painting-not-authorized' };
    if (!checked.ok) {
      rejected.push({ id, reason: checked.reason });
      continue;
    }
    for (const { start, end } of checked.parts) {
      if (!edges.has(start)) edges.set(start, { add: [], remove: [] });
      if (!edges.has(end)) edges.set(end, { add: [], remove: [] });
      edges.get(start).add.push(id);
      edges.get(end).remove.push(id);
    }
  }
  const segments = [],
    active = new Set();
  let start = 0;
  for (const end of [...edges.keys()].sort((a, b) => a - b)) {
    if (active.size && end > start) segments.push({ start, end, ids: [...active] });
    const edge = edges.get(end);
    edge.remove.forEach((id) => active.delete(id));
    edge.add.forEach((id) => active.add(id));
    start = end;
  }
  return { ok: true, segments, rejected };
}
// Explicit adapter calls alone install marks. Typing never starts inspection;
// a changed raw document stops displaying these offsets on the next render.
function lySetWritingRangeMarks(view) {
  if (view == null) {
    LY.rangeMarks = null;
    lyRenderEditor();
    return { ok: true };
  }
  const checked = lyPrepareRangeMarks(lyDraft()?.value, view);
  LY.rangeMarks = checked.ok ? { text: view.text, segments: checked.segments } : null;
  lyRenderEditor();
  return checked;
}
function lyRangeTextHtml(raw, offset, segments) {
  let cursor = 0,
    html = '';
  for (const segment of segments) {
    const start = Math.max(0, segment.start - offset);
    const end = Math.min(raw.length, segment.end - offset);
    if (end <= start) continue;
    html += esc(raw.slice(cursor, start));
    html += `<span class="ly-relation-mark" data-occurrences="${esc(JSON.stringify(segment.ids))}">${esc(raw.slice(start, end))}</span>`;
    cursor = end;
  }
  return html + esc(raw.slice(cursor));
}
function lyWritingFocusReady() {
  const draft = lyDraft();
  if (!draft || !draft.getClientRects().length || draft.closest('[inert]')) return false;
  return ![...document.querySelectorAll('[aria-modal="true"], dialog[open]')].some(
    (modal) => modal.getClientRects().length
  );
}
function lyCaptureWritingOrigin() {
  const draft = lyDraft();
  if (!draft) return null;
  const scroll = [];
  for (let node = draft; node; node = node.parentElement)
    scroll.push({ node, left: node.scrollLeft, top: node.scrollTop });
  return {
    text: draft.value,
    start: draft.selectionStart,
    end: draft.selectionEnd,
    direction: draft.selectionDirection,
    scroll,
    windowLeft: window.scrollX,
    windowTop: window.scrollY,
  };
}
// The navigation owner reveals Song and closes its modal BEFORE calling either
// focus hook. Close/Back do not call Return. A changed draft never restores an
// old offset, even if its semantic song identity happened to remain unchanged.
function lyRestoreWritingOrigin(origin) {
  const draft = lyDraft();
  if (!origin || !draft || origin.text !== draft.value)
    return { ok: false, reason: 'document-mismatch' };
  if (
    !Number.isInteger(origin.start) ||
    !Number.isInteger(origin.end) ||
    origin.start < 0 ||
    origin.end < origin.start ||
    origin.end > draft.value.length ||
    !['forward', 'backward', 'none'].includes(origin.direction) ||
    !Array.isArray(origin.scroll)
  )
    return { ok: false, reason: 'invalid-origin' };
  if (!lyWritingFocusReady()) return { ok: false, reason: 'editor-not-available' };
  draft.setSelectionRange(origin.start, origin.end, origin.direction);
  draft.focus({ preventScroll: true });
  lySyncCaret();
  for (const { node, left, top } of origin.scroll)
    if (node?.isConnected) {
      node.scrollLeft = left;
      node.scrollTop = top;
    }
  window.scrollTo(origin.windowLeft, origin.windowTop);
  return { ok: true };
}
function lyGoToRangeParts(target, partIndex) {
  const draft = lyDraft();
  if (!target || !draft || target.text !== draft.value)
    return { ok: false, reason: 'document-mismatch' };
  if (target.canGo !== true) return { ok: false, reason: 'navigation-not-authorized' };
  const checked = lyValidateRangeParts(draft.value, target.parts);
  if (!checked.ok) return checked;
  // A textarea cannot select disjoint parts. Never select the union (and gaps).
  if (partIndex === undefined && checked.parts.length > 1)
    return { ok: false, reason: 'choose-part', partCount: checked.parts.length };
  const index = partIndex === undefined ? 0 : partIndex;
  if (!Number.isInteger(index) || index < 0 || index >= checked.parts.length)
    return { ok: false, reason: 'invalid-part-index' };
  if (!lyWritingFocusReady()) return { ok: false, reason: 'editor-not-available' };
  const part = checked.parts[index];
  draft.setSelectionRange(part.start, part.end, 'forward');
  draft.focus({ preventScroll: true });
  lySyncCaret();
  lyRevealCaretAfterResize();
  return { ok: true, partIndex: index, partCount: checked.parts.length };
}
function lyFamilyLabel(index) {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  return label;
}
function lyRowHtml(row, model, ctx) {
  const raw = row.raw;
  const caret = ctx.caretRow === row.i;
  if (row.kind === 'blank') return `<div class="ly-r" data-i="${row.i}"><br></div>`;
  if (row.kind === 'sung') {
    const tone = ctx.marks.get(row.n);
    let offset = ctx.rowStarts?.[row.i] || 0;
    const rangeText = (text) => {
      const html = lyRangeTextHtml(text, offset, ctx.rangeSegments || []);
      offset += text.length;
      return html;
    };
    // Find marks every word a match on this line spans, so a phrase ("the
    // rain") marks both words, not only a query inside a single word.
    const hits = [];
    const lower = ctx.find ? raw.toLowerCase() : '';
    for (let at = ctx.find ? lower.indexOf(ctx.find) : -1; at >= 0; ) {
      hits.push([at, at + ctx.find.length]);
      at = lower.indexOf(ctx.find, at + ctx.find.length);
    }
    let pos = 0;
    const spans = lyWordSpans(raw, model.voices)
      .map((p) => {
        if (p.gap !== undefined) {
          pos += p.gap.length;
          return rangeText(p.gap);
        }
        const from = pos;
        pos += p.word.length;
        const cls = [];
        if (p.aside) cls.push('ly-aside');
        if (hits.some(([a, b]) => a < pos && b > from))
          cls.push('ly-hit', ...(row.n === ctx.findLine ? ['ly-hit-current'] : []));
        const groups = (p.token && ctx.ends.get(`${row.n}:${p.token}`)) || [];
        const g = groups[0];
        if (g) cls.push('ly-end');
        if (p.token && ctx.reading === `${row.text}|${p.token}`) cls.push('ly-reading');
        return cls.length
          ? `<span class="${cls.join(' ')}"${g ? ` data-g="${g.k % 2}" data-groups="${groups.map((item) => item.letter).join(' ')}" title="${groups.map((item) => `${item.pending ? 'Proposed' : 'Declared'} rhyme ${item.letter}`).join(', ')} (not measured)"` : ''}>${rangeText(p.word)}</span>`
          : rangeText(p.word);
      })
      .join('');
    const letters = ctx.letters.get(row.n) || [];
    return `<div class="ly-r ly-r-sung${LY.activeLine === row.n ? ' is-active' : ''}${ctx.focus.has(row.n) ? ' is-focus' : ''}" data-i="${row.i}" data-n="${row.n}"${tone ? ` data-tone="${tone}"` : ''}><span class="ly-gut">${letters.map((g) => `<span class="ly-letter" title="${g.pending ? 'Proposed' : 'Declared'} rhyme ${g.letter} (not measured)">${g.letter}</span>`).join('')}<span class="ly-num">${row.n}</span></span><span class="ly-t">${spans || '<br>'}</span></div>`;
  }
  let label = '',
    kind = row.kind;
  if (row.kind === 'section') {
    const s = row.section;
    const meta = [uiCount(s.sung.length, 'line')];
    const r = s.header && lyRhythmText(s.header);
    if (r) meta.push(r);
    if (s.header?.lines != null && s.header.lines !== s.sung.length)
      meta.push(`declares ${s.header.lines}`);
    label = `<span class="ly-h">${esc(s.title)}</span><span class="ly-hmeta">${esc(meta.join(' · '))}</span>`;
  } else if (row.kind === 'setup') {
    const item = lyParseSetup(row.text);
    label = `<span class="ly-setup-key">${esc(lyCap(item.key))}</span><span class="ly-setup-val">${esc(item.value)}</span>`;
  } else if (row.kind === 'stamp')
    label = `<span class="ly-setup-key">Run stamp</span><span class="ly-setup-val">${esc(row.text)}</span>`;
  else kind = 'other';
  return `<div class="ly-r ly-r-${kind}${caret ? ' is-caret' : ''}" data-i="${row.i}"><span class="ly-raw">${esc(raw)}</span>${label ? `<span class="ly-lab" aria-hidden="true">${label}</span>` : ''}</div>`;
}
// Declared scheme: letters carry identity (including overlaps); two existing
// palette tints aid scanning. A declaration is never a measured verdict.
function lyRhymeMarks(model) {
  const ends = new Map(),
    letters = new Map();
  const groups = lySetupOf(model, 'rhyme groups').flatMap((d) => lyRowGroups(d));
  const pending = LY.tool === 'rhymes' ? lyVal('rhymes', 'song', 'members', []) || [] : [];
  const all = [
    ...groups.map((g) => ({ g })),
    ...(pending.length ? [{ g: pending, pending: true }] : []),
  ];
  all.forEach(({ g, pending = false }, k) => {
    const letter = lyFamilyLabel(k);
    for (const m of g) {
      // A word place kept under its earlier number marks no word.
      if (m.bad || m.undecided) continue;
      const row = model.sung[m.line - 1];
      if (!row) continue;
      const toks = lyTokens(row.text, model.voices);
      let t = toks.length;
      if (/^T\d+$/.test(m.place)) t = Number(m.place.slice(1));
      else if (m.place === 'head' || m.place === 'headrime') t = 1;
      if (m.place !== 'line') {
        if (!Number.isInteger(t) || t < 1 || t > toks.length) continue;
        const key = `${m.line}:${t}`;
        const memberships = ends.get(key) || [];
        if (!memberships.some((item) => item.k === k)) memberships.push({ k, letter, pending });
        ends.set(key, memberships);
      }
      const list = letters.get(m.line) || [];
      if (!list.some((x) => x.letter === letter)) list.push({ k, letter, pending });
      letters.set(m.line, list);
    }
  });
  return { ends, letters };
}
function lyRenderEditor() {
  const model = LY.model;
  const draft = lyDraft();
  const overlay = $ui('ly-overlay');
  if (!overlay || !draft) return;
  const marks = new Map();
  for (const it of LY.items || [])
    if (!it.stale)
      for (const n of it.lines || [])
        if (!marks.has(n) || it.tone === 'issue') marks.set(n, it.tone);
  const { ends, letters } = lyRhymeMarks(model);
  const readingTarget =
    LY.tool === 'pronunciation' && LY.picks.reading ? lyReadingTarget(LY.picks.reading) : null;
  let rowOffset = 0;
  const rowStarts = model.rows.map((row) => {
    const start = rowOffset;
    rowOffset += row.raw.length + 1;
    return start;
  });
  const ctx = {
    rowStarts,
    rangeSegments: LY.rangeMarks?.text === model.text ? LY.rangeMarks.segments : [],
    caretRow: document.activeElement === draft ? LY.caretRow : -1,
    marks,
    ends,
    letters,
    focus: new Set(LY.focusLines || []),
    find: LY.find.open && LY.find.q ? LY.find.q.toLowerCase() : '',
    findLine: LY.find.open && LY.find.q ? lyFindMatches()[LY.find.at] || 0 : 0,
    reading: readingTarget ? `${readingTarget[0]}|${readingTarget[1]}` : '',
  };
  overlay.innerHTML =
    model.rows.map((r) => lyRowHtml(r, model, ctx)).join('') || '<div class="ly-r"><br></div>';
  const editor = $ui('ly-editor');
  editor.dataset.size = LY.prefs.size.get();
  editor.classList.toggle('no-numbers', !LY.prefs.numbers.get());
  editor.classList.toggle('has-letters', letters.size > 0);
  draft.scrollTop = 0;
  const empty = !model.text.trim();
  const box = $ui('ly-empty-doc');
  box.hidden = !empty || document.activeElement === draft;
  if (!box.hidden)
    box.innerHTML = uiEmptyState({
      title: 'Start your lyrics',
      text: 'Write here, bring in a text file, or work with the writer. Add headers such as [Verse 1] to organize sections.',
      actions:
        lyBtn('ly-focus-doc', 'Write myself', 'pencil', { cls: 'cm-btn cm-btn-outline' }) +
        lyBtn('new-lyrics', 'Write with the writer', 'sparkles', {
          cls: 'cm-btn cm-btn-outline',
        }) +
        lyBtn('ly-import', 'Import lyrics', 'upload', { cls: 'cm-btn cm-btn-outline' }),
    });
  lyPlaceLineBar();
}
// Where the caret is: its raw row, and the sung line on it.
function lySyncCaret() {
  const draft = lyDraft();
  if (!draft || !LY.model) return;
  const row = draft.value.slice(0, draft.selectionStart).split('\n').length - 1;
  const endRow = draft.value.slice(0, draft.selectionEnd).split('\n').length - 1;
  const was = [LY.caretRow, LY.activeLine];
  LY.caretRow = row;
  const r = LY.model.rows[row];
  // A selection across rows keeps the first sung line it touches.
  let n = r?.kind === 'sung' ? r.n : 0;
  if (!n && endRow > row)
    for (let i = row; i <= endRow; i++)
      if (LY.model.rows[i]?.kind === 'sung') ((n = LY.model.rows[i].n), (i = endRow));
  const setupOnly = r && ['setup', 'stamp'].includes(r.kind);
  LY.activeLine = setupOnly
    ? 0
    : n || (r?.kind === 'section' ? 0 : LY.activeLine && r?.kind === 'blank' ? 0 : n);
  if (was[0] !== LY.caretRow || was[1] !== LY.activeLine) {
    const overlay = $ui('ly-overlay');
    overlay?.querySelector('.ly-r.is-caret')?.classList.remove('is-caret');
    overlay?.querySelector('.ly-r.is-active')?.classList.remove('is-active');
    const caretEl = overlay?.querySelector(`.ly-r[data-i="${row}"]`);
    if (caretEl && document.activeElement === draft && !caretEl.classList.contains('ly-r-sung'))
      caretEl.classList.add('is-caret');
    if (LY.activeLine)
      overlay?.querySelector(`.ly-r[data-n="${LY.activeLine}"]`)?.classList.add('is-active');
    lyPlaceLineBar();
    lyRenderOutlineActive();
  }
}
// The phone's Sections sheet is a modal dialog while open: the page behind
// the scrim is inert and Tab wraps inside the sheet; all of it comes back on
// close.
let lySheetInert = [];
function lySheetTab(e) {
  if (e.key !== 'Tab') return;
  const list = [
    ...this.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => !el.disabled && el.getClientRects().length);
  if (list.length && document.activeElement === (e.shiftKey ? list[0] : list.at(-1))) {
    e.preventDefault();
    (e.shiftKey ? list.at(-1) : list[0]).focus();
  }
}
function lySheetModal(on) {
  const panel = $ui('ly-outline-panel');
  if (!panel || on === panel.hasAttribute('aria-modal')) return;
  lySheetInert.forEach((el) => (el.inert = false));
  lySheetInert = [];
  panel[on ? 'addEventListener' : 'removeEventListener']('keydown', lySheetTab);
  if (!on)
    return ['role', 'aria-modal', 'aria-labelledby'].forEach((a) => panel.removeAttribute(a));
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'ly-outline-h');
  for (let el = panel; el.parentElement && el.id !== 'ly-page'; el = el.parentElement)
    for (const sib of el.parentElement.children)
      if (sib !== el && !sib.inert && !['ly-scrim', 'ly-live'].includes(sib.id)) {
        sib.inert = true;
        lySheetInert.push(sib);
      }
}
// The Sections opener a person can see: the rail button, or on a phone the
// position button in the song view.
const lySectionsOpener = () =>
  [...document.querySelectorAll('.ly-rail-btn, .ly-sec-pos')].find(
    (b) => b.getClientRects().length
  );
function lyRenderOutlineActive() {
  const model = LY.model;
  const active = lySectionOfLine(model, LY.activeLine) || lySectionAtRow(model, LY.caretRow);
  document.querySelectorAll('#ly-sections .ly-sec').forEach((b) => {
    const on = active && Number(b.dataset.id) === active.index;
    b.classList.toggle('is-active', !!on);
    if (on) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  });
  const nav = $ui('ly-section-nav');
  if (LY.size === 'narrow' && model.sections.length && nav && !nav.hidden) {
    const k = active ? active.index : 0;
    // Update in place: caret navigation must not replace focused controls.
    nav.querySelector('.ly-sec-pos strong').textContent = model.sections[k].title;
    nav.querySelector('.ly-sec-pos > span').textContent = `· ${k + 1} of ${model.sections.length}`;
    nav.querySelector('[data-ui="ly-sec-step"][data-id="-1"]').disabled = k === 0;
    nav.querySelector('[data-ui="ly-sec-step"][data-id="1"]').disabled =
      k >= model.sections.length - 1;
  }
}
// The selected line's tools: beside the line when it fits, otherwise in the
// dock under the document, so they never cover a word of the lyrics.
// Keyboard viewport changes must keep the focused caret above the phone controls.
function lyViewportScroller() {
  const body = $ui('ly-body');
  // H1 lets the entire page scroll at short heights.
  return LY.size === 'narrow'
    ? body && getComputedStyle(body).overflowY !== 'visible'
      ? body
      : $ui('ly-page')
    : $ui('ly-main-scroll');
}
function lyViewportCaretRow() {
  const draft = lyDraft();
  if (!draft) return null;
  const caret = draft.selectionDirection === 'forward' ? draft.selectionEnd : draft.selectionStart;
  const index = draft.value.slice(0, caret).split('\n').length - 1;
  return document.querySelector(`#ly-overlay .ly-r[data-i="${index}"]`);
}
function lyViewportBand(scroller) {
  const viewport = window.visualViewport;
  const bounds = scroller.getBoundingClientRect();
  let top = Math.max(bounds.top, viewport ? viewport.offsetTop : 0);
  let bottom = Math.min(
    bounds.bottom,
    viewport ? viewport.offsetTop + viewport.height : innerHeight
  );
  const midpoint = (top + bottom) / 2;
  for (const id of ['ly-linedock', 'ly-mnav']) {
    const control = $ui(id);
    if (!control || control.hidden) continue;
    const obstruction = control.getBoundingClientRect();
    if (!obstruction.height || obstruction.bottom <= top || obstruction.top >= bottom) continue;
    if (obstruction.top > midpoint) bottom = Math.min(bottom, obstruction.top);
    else top = Math.max(top, obstruction.bottom);
  }
  return { top, bottom };
}
function lyRevealCaretAfterResize({ keepLineMenuFocus = false } = {}) {
  const draft = lyDraft();
  const viewport = window.visualViewport;
  const lineMenu = $ui('ly-menu-line-actions');
  const menuFocused =
    keepLineMenuFocus && lineMenu && !lineMenu.hidden && lineMenu.contains(document.activeElement);
  if (
    !draft ||
    (document.activeElement !== draft && !menuFocused) ||
    (viewport && viewport.scale !== 1)
  )
    return;
  const row = lyViewportCaretRow(),
    scroller = lyViewportScroller();
  if (!row || !scroller) return;
  const { top, bottom } = lyViewportBand(scroller);
  const rect = row.getBoundingClientRect();
  if (bottom <= top || (rect.top >= top && rect.bottom <= bottom)) return;
  scroller.scrollTop += rect.top - (top + Math.max(0, (bottom - top - rect.height) / 2));
}
// Reused by the integration owner's single contextual dock. Existing actions
// keep history, rhythm and pronunciation on their canonical paths.
function lyWritingLineActions(n) {
  const line = Number.isInteger(n) && n > 0 && !!LY.model?.sung[n - 1];
  const disabled = line ? '' : 'disabled';
  return lyMenu(
    'line-actions',
    'Line actions',
    'ellipsis',
    lyMenuItem('ly-line-tool', 'Rhyme', 'link', line ? `rhymes:${n}` : '', disabled) +
      lyMenuItem('ly-line-tool', 'Rhythm', 'music', line ? `rhythm:${n}` : '', disabled) +
      lyMenuItem(
        'ly-line-tool',
        'Pronunciation',
        'message-circle',
        line ? `pronunciation:${n}` : '',
        disabled
      ) +
      '<div class="cm-menu-sep"></div>' +
      lyMenuItem('ly-undo', 'Undo', 'undo-2', '', app.historyIndex > 0 ? '' : 'disabled') +
      lyMenuItem(
        'ly-redo',
        'Redo',
        'redo-2',
        '',
        app.historyIndex < app.history.length - 1 ? '' : 'disabled'
      ),
    { cls: 'cm-btn ly-lt', align: 'end', chevron: false }
  );
}
function lyPlaceLineBar() {
  const bar = $ui('ly-linebar'),
    dock = $ui('ly-linedock');
  if (!bar || !dock) return;
  bar.hidden = true;
  if ($ui('ly-doc-wrap').hidden) {
    dock.hidden = true;
    return;
  }
  const n = LY.activeLine;
  const row = n && LY.model.sung[n - 1];
  const wideButtons = () =>
    `${lyBtn('ly-line-tool', 'Rhyme', 'link', { id: `rhymes:${n}`, cls: 'cm-btn ly-lt' })}${lyBtn('ly-line-tool', 'Rhythm', 'music', { id: `rhythm:${n}`, cls: 'cm-btn ly-lt' })}${lyBtn('ly-line-tool', 'Pronunciation', 'message-circle', { id: `pronunciation:${n}`, cls: 'cm-btn ly-lt' })}`;
  const inspecting = !!lyInspectionSession()?.armed;
  let inline = false;
  if (row && LY.size !== 'narrow' && !inspecting) {
    const element = $ui('ly-overlay')?.querySelector(`.ly-r[data-n="${n}"]`);
    const text = element?.querySelector('.ly-t');
    if (element && text) {
      bar.innerHTML = wideButtons();
      bar.setAttribute('aria-label', `Line ${n} tools`);
      bar.hidden = false;
      const editor = $ui('ly-editor').getBoundingClientRect();
      const bounds = text.getBoundingClientRect();
      if (editor.right - bounds.right - 24 >= bar.offsetWidth) {
        bar.style.top = `${element.offsetTop + Math.max(0, element.offsetHeight - 40)}px`;
        bar.style.left = `${bounds.right - editor.left + 16}px`;
        inline = true;
      }
      if (!inline) bar.hidden = true;
    }
  }
  // Keep the open menu and its focus while selection events settle.
  const key = `${LY.size}:${row ? n : 0}:${app.historyIndex}:${app.history.length}:${inspecting}:${inline}`;
  if (dock.dataset.writingActions !== key) {
    dock.innerHTML = `${inspecting ? '' : `<span class="ly-dock-label">${row ? `Line ${n}` : 'Song'}</span>`}<span id="ly-relation-dock" class="ly-relation-dock"></span>${inspecting || inline ? '' : row && LY.size !== 'narrow' ? wideButtons() : lyWritingLineActions(row ? n : 0)}`;
    dock.dataset.writingActions = key;
  }
  dock.setAttribute('aria-label', row ? `Line ${n} actions` : 'Song actions');
  dock.hidden = false;
  lyInspectionRenderDock();
  const menu = $ui('ly-menu-line-actions');
  const opener = dock.querySelector('[aria-controls="ly-menu-line-actions"]');
  if (menu && !menu.hidden && opener) lyPositionLineMenu(menu, opener);
}

// ── Inspector ─────────────────────────────────────────────────────────────
const LY_MAIN_TOOLS = ['form-story', 'rhythm'];
function lyRenderTabs() {
  document.querySelectorAll('.ly-itab').forEach((b) => {
    const on = b.dataset.id === LY.tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  // A panel out of view keeps nothing stale: it is drawn again when shown.
  for (const [id] of LY_TABS) {
    const panel = $ui(`ly-panel-${id}`);
    panel.hidden = id !== LY.tab;
    if (panel.hidden) {
      if (id === 'writer') lyClock(false);
      const box = id === 'writer' ? $ui('ly-writer-status') : panel;
      box.innerHTML = '';
      box.dataset.view = '';
    }
  }
  document.querySelectorAll('.ly-mtab').forEach((b) => {
    const on = b.dataset.id === LY.mobile;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  const page = $ui('ly-page');
  const writerWasVisible =
    page.dataset.tab === 'writer' && (LY.size !== 'narrow' || page.dataset.mobile === 'writer');
  page.dataset.mobile = LY.mobile;
  page.dataset.tab = LY.tab;
  if (
    !LY.inspectionRestoringPanel &&
    !writerWasVisible &&
    LY.tab === 'writer' &&
    (LY.size !== 'narrow' || LY.mobile === 'writer')
  ) {
    requestAnimationFrame(() => {
      if (LY.tab !== 'writer' || (LY.size === 'narrow' && LY.mobile !== 'writer')) return;
      // Reveal the existing composer as a unit; keep keyboard focus and unsent text intact.
      const form = $ui('chat-form');
      if ($ui('ly-panel-writer')?.contains(form)) form.scrollIntoView({ block: 'center' });
    });
  }
}
// Keep what someone is typing: re-drawing the same view never replaces a
// focused field inside `box`; a different view (another tool) always draws.
function lySetHtml(box, html, view = '') {
  const a = document.activeElement;
  if (
    box.dataset.view === view &&
    a &&
    box.contains(a) &&
    a.matches('input:not([type=radio]):not([type=checkbox]), textarea, select')
  )
    return false;
  box.dataset.view = view;
  box.innerHTML = html;
  return true;
}
const lyToolMeta = (id) => LY_TOOLS.find((t) => t[0] === id);
function lyToolRow(id, { selected = false, expanded = null } = {}) {
  const [, label, help, ic] = lyToolMeta(id);
  const n = lyToolPending(id);
  return `<button type="button" class="ly-toolrow${selected ? ' is-selected' : ''}" data-ui="ly-tool" data-id="${id}"${expanded === null ? '' : ` aria-expanded="${expanded}"`}${selected ? ' aria-current="true"' : ''}>${icon(ic, 22)}<span class="ly-toolrow-text"><strong>${esc(label)}</strong><small>${esc(help)}</small></span><span class="ly-count"${n ? '' : ' hidden'} aria-label="${esc(uiCount(n, 'pending change'))}">${n || ''}</span>${icon(expanded ? 'chevron-down' : 'chevron-right', 18)}</button>`;
}
function lyPendingStrip(tool, { applyLabel = 'Apply' } = {}) {
  const drafts = [
    ...lyDrafts(tool),
    ...(tool === 'rhythm' ? [...lyDrafts('placement'), ...lyDrafts('melody')] : []),
  ];
  const n = drafts.reduce((t, d) => t + d.dirty.length, 0);
  const stale = drafts.filter((d) => lyDraftStale(d));
  if (!n) return `<div class="ly-pending" id="ly-pending-${tool}" hidden></div>`;
  return `<div class="ly-pending" id="ly-pending-${tool}" data-tone="${stale.length ? 'warning' : 'info'}" role="status">${
    stale.length
      ? `<p class="ly-pending-warn">${icon('triangle-alert', 16)}<span>Target changed. Review these entries before applying.</span>${lyBtn('ly-draft-rebase', 'Use current target', 'refresh-cw', { id: tool, cls: 'cm-btn ly-link-btn' })}</p>`
      : ''
  }<span class="ly-pending-count">${lyPill('warning', `${n} pending change${n === 1 ? '' : 's'}`)}<small>Not applied to lyrics. Entries are kept when you switch tools.</small></span><span class="ly-actions">${lyBtn('ly-draft-apply', applyLabel, 'check', { id: tool, cls: 'cm-btn cm-btn-primary', extra: stale.length ? 'disabled aria-disabled="true"' : '' })}${lyBtn('ly-draft-discard', 'Discard', '', { id: tool, cls: 'cm-btn cm-btn-outline' })}</span></div>`;
}
function lyRenderTools() {
  const box = $ui('ly-panel-tools');
  const model = LY.model;
  const narrow = LY.size === 'narrow';
  let html = '';
  if (!LY.tool) {
    html = `<h3 class="ly-h3 ly-sr">Tools</h3><div class="ly-toolrows">${LY_TOOLS.map(([id]) => lyToolRow(id, { expanded: narrow ? false : null })).join('')}</div>`;
    const a = LY.state || lyAnalysis(model);
    if (a.state === 'none' && model.sung.length)
      html += `<div class="ly-callout" data-tone="warning">${lyPill('warning', 'This version has not been reviewed')}<p>Run a review to check form, rhymes, rhythm and pronunciation.</p>${lyBtn('ly-tab', 'Open Review', 'clipboard-check', { id: 'review', cls: 'cm-btn cm-btn-primary ly-block' })}</div>`;
    else if (a.state === 'stale')
      html += `<div class="ly-callout" data-tone="warning">${lyPill('warning', 'Edited since review')}<p>The document changed after the last review. Review this version again.</p>${lyBtn('ly-tab', 'Open Review', 'clipboard-check', { id: 'review', cls: 'cm-btn cm-btn-primary ly-block' })}</div>`;
    lySetHtml(box, html, `tools:${LY.tool}:${LY.size}`);
    return;
  }
  const [, label, help, ic] = lyToolMeta(LY.tool);
  const head = `<div class="ly-tool-nav">${lyBtn('ly-tool', 'Back to tools', 'arrow-left', { id: '', cls: 'cm-btn ly-link-btn' })}<nav class="ly-crumbs" aria-label="Breadcrumb"><span>Tools</span>${icon('chevron-right', 14)}<strong aria-current="page">${esc(label)}</strong></nav></div>`;
  if (narrow) {
    // One list: every tool, the selected one expanded under its row.
    html = `<h3 class="ly-h3">Tools</h3><div class="ly-toolrows">${LY_TOOLS.map(([id]) => lyToolRow(id, { expanded: id === LY.tool, selected: id === LY.tool }) + (id === LY.tool ? `<div class="ly-tool-inline" role="region" aria-label="${esc(label)}">${lyToolBody(id, model)}</div>` : '')).join('')}</div><p class="ly-help ly-pad-t">${icon('info', 14)} Entries are kept when you switch tools.</p>`;
    lySetHtml(box, html, `tools:${LY.tool}:${LY.size}`);
    return;
  }
  if (LY_MAIN_TOOLS.includes(LY.tool)) {
    // The form lives in the main area; the inspector keeps the index.
    let extra = '';
    if (LY.tool === 'rhythm') {
      const s = model.sections[lyRhythmSec(model)];
      if (s)
        extra = `<div class="ly-card ly-sec-card"><p><strong>${esc(s.title)}</strong> · ${esc([uiCount(s.sung.length, 'line'), s.header?.meter].filter(Boolean).join(' · '))}</p>${s.sung[0] ? `<p class="ly-muted"><span class="ly-num-inline">${s.sung[0].n}</span> ${esc(s.sung[0].text)}</p>` : ''}</div>`;
    }
    html = `${head}<div class="ly-toolrows">${lyToolRow(LY.tool, { selected: true })}${extra}${LY_TOOLS.filter(
      ([id]) => id !== LY.tool
    )
      .map(([id]) => lyToolRow(id))
      .join('')}</div>`;
    lySetHtml(box, html, `tools:${LY.tool}:${LY.size}`);
    return;
  }
  html = `${head}<div class="ly-tool-head">${icon(ic, 22)}<div><h3 class="ly-h3">${esc(label)}</h3><p class="ly-help">${esc(help)}</p></div></div>${lyToolBody(LY.tool, model)}`;
  lySetHtml(box, html, `tools:${LY.tool}:${LY.size}`);
}
// Rendering a request affordance does not bypass the existing dispatch guards.
// Unknown outcomes make retrieval the primary action in every tool entry point.
function lyToolRequestAction(action, label, glyph) {
  if (lyWriterState().unknown)
    return `${lyBtn('ly-retrieve', 'Retrieve saved result', 'refresh-cw', { cls: 'cm-btn cm-btn-primary ly-block' })}<p class="ly-help">The previous request's outcome is unknown. Retrieve it before asking for options.</p>`;
  return lyBtn(action, label, glyph, {
    cls: 'cm-btn cm-btn-outline ly-block',
    extra: chatState.busy ? 'disabled' : '',
  });
}
function lyToolBody(id, model) {
  return {
    'form-story': () => lyToolFormStory(model),
    rhymes: () => lyToolRhymes(model),
    rhythm: () => lyToolRhythm(model),
    pronunciation: () => lyToolPronunciation(model),
    'repeats-voices': () => lyToolRepeats(model),
    'word-rules': () => lyToolWordRules(model),
  }[id]();
}
function lyRenderMainTool() {
  const main = $ui('ly-tool-main');
  const docWrap = $ui('ly-doc-wrap');
  const inMain = LY.size !== 'narrow' && LY_MAIN_TOOLS.includes(LY.tool);
  main.hidden = !inMain;
  docWrap.hidden = inMain;
  $ui('ly-toolbar').hidden = inMain;
  if (inMain) lySetHtml(main, lyToolBody(LY.tool, LY.model), LY.tool);
  else {
    main.innerHTML = '';
    main.dataset.view = '';
  }
}

// ── Form & story ──────────────────────────────────────────────────────────
const lyOpts = (pairs, value, blank) =>
  (blank !== null ? `<option value="">${esc(blank)}</option>` : '') +
  pairs
    .map(
      ([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`
    )
    .join('');
function lyToolFormStory(model) {
  const T = 'form-story',
    G = 'song';
  const d = lyDraftOf(T, G);
  const c = LY_FORMS[T].committed(model);
  const v = (f) => lyVal(T, G, f, c[f]);
  const sel = model.sections[LY.picks.formSec] ? LY.picks.formSec : 0;
  const sung = lySungSections(model);
  const story = lyStorySteps(model);
  const rows = model.sections
    .map((s) => {
      const atom = v(`atom.${s.index}`);
      const note = v(`note.${s.index}`);
      return `<tr class="${s.index === sel ? 'is-selected' : ''}" data-sec="${s.index}" draggable="true"><td class="ly-handle" aria-hidden="true">${icon('grip-vertical', 16)}</td><th scope="row"><button type="button" class="ly-rowpick" data-ui="ly-form-pick" data-id="${s.index}" aria-pressed="${s.index === sel}">${esc(d?.dirty.includes(`name.${s.index}`) ? lyCap(v(`name.${s.index}`)) : s.title)}</button></th><td>${s.sung.length}</td><td>${esc(v(`lines.${s.index}`) || '—')}</td><td>${esc(note || (atom ? LY_ATOM_LABELS[atom] : '') || '—')}</td><td class="ly-row-actions">${lyBtn('ly-sec-move', 'Move up', 'arrow-up', { id: `${s.index}:-1`, cls: 'cm-btn cm-btn-outline ly-sm', extra: s.index === 0 ? 'disabled' : '' })}${lyBtn('ly-sec-move', 'Move down', 'arrow-down', { id: `${s.index}:1`, cls: 'cm-btn cm-btn-outline ly-sm', extra: s.index === model.sections.length - 1 ? 'disabled' : '' })}${lyBtn('ly-sec-dup', 'Duplicate section', 'copy', { id: s.index, cls: 'cm-btn cm-btn-outline ly-sm' })}${lyBtn('ly-sec-remove', 'Remove', 'trash-2', { id: s.index, cls: 'cm-btn cm-btn-outline ly-sm', hideLabel: true })}</td></tr>`;
    })
    .join('');
  // Creative guidance: the declared jobs and notes, in order, with the
  // junction that joins each to the one before. Nothing invented between them.
  const flow = sung
    .map((s, k) => {
      const atom = v(`atom.${s.index}`),
        junction = v(`junction.${s.index}`),
        note = v(`note.${s.index}`);
      if (!atom && !note) return '';
      return `${k && junction ? `<span class="ly-flow-join">${esc(LY_JUNCTION_LABELS[junction] || junction)}${icon('arrow-right', 14)}</span>` : ''}<span class="ly-flow-node${s.index === sel ? ' is-selected' : ''}"><small>${esc(s.title)}</small>${esc(note || LY_ATOM_LABELS[atom] || atom)}${note && atom ? `<small>${esc(LY_ATOM_LABELS[atom])}</small>` : ''}</span>`;
    })
    .filter(Boolean)
    .join('');
  const s = model.sections[sel];
  const k = sung.indexOf(s);
  const f = (name) => `${name}.${sel}`;
  const form = s
    ? `<div class="ly-form-grid"><div class="ly-field"><label class="ly-label" for="ly-f-name">Section name</label><input id="ly-f-name" class="cm-input" maxlength="80" data-draft="${T}" data-target="${G}" data-field="${f('name')}" value="${esc(v(f('name')))}" placeholder="${esc(s.title)}"${lyErr(d, f('name'))}>${lyErrText(d, f('name'))}</div><div class="ly-field ly-field-sm"><label class="ly-label" for="ly-f-lines">Target (lines)</label><input id="ly-f-lines" class="cm-input" inputmode="numeric" data-draft="${T}" data-target="${G}" data-field="${f('lines')}" value="${esc(v(f('lines')))}" placeholder="Not set" aria-describedby="ly-f-lines-help"${lyErr(d, f('lines'))}><small class="ly-help" id="ly-f-lines-help">Actual: ${s.sung.length}</small>${lyErrText(d, f('lines'))}</div>${
        k >= 0
          ? `<div class="ly-field"><label class="ly-label" for="ly-f-atom">Story job</label><select id="ly-f-atom" class="cm-select" data-draft="${T}" data-target="${G}" data-field="${f('atom')}"${lyErr(d, f('atom'))}>${lyOpts(Object.entries(LY_ATOM_LABELS), v(f('atom')), 'Not declared')}</select>${lyErrText(d, f('atom'))}</div>${
              k > 0
                ? `<div class="ly-field"><label class="ly-label" for="ly-f-junction">Follows the section before by</label><select id="ly-f-junction" class="cm-select" data-draft="${T}" data-target="${G}" data-field="${f('junction')}"${lyErr(d, f('junction'))}>${lyOpts(Object.entries(LY_JUNCTION_LABELS), v(f('junction')), 'Not declared')}</select>${lyErrText(d, f('junction'))}</div>`
                : ''
            }`
          : ''
      }<div class="ly-field ly-field-wide"><label class="ly-label" for="ly-f-note">Section note</label><textarea id="ly-f-note" class="cm-input" rows="2" maxlength="400" data-draft="${T}" data-target="${G}" data-field="${f('note')}" placeholder="This section’s creative job, e.g. Arrival and kindness"${lyErr(d, f('note'))}>${esc(v(f('note')))}</textarea>${lyErrText(d, f('note'))}</div></div>`
    : '';
  const headerless = model.sections.length && model.sections.every((x) => !x.header);
  return `<div class="ly-tool-view"><div class="ly-view-head">${icon('book-open', 22)}<div><h3 class="ly-h3">Form & story</h3><p class="ly-help">Section order and story jobs</p></div></div>${headerless ? `<p class="ly-help">These stanzas have no headers. ${lyBtn('ly-label-stanzas', 'Add a header to each stanza', 'plus', { cls: 'cm-btn ly-link-btn' })}</p>` : ''}${
    model.sections.length
      ? `<div class="ly-table-wrap"><table class="ly-table ly-form-table"><thead><tr><th><span class="ly-sr">Move</span></th><th>Section</th><th>Lines</th><th>Target</th><th>Story job</th><th><span class="ly-sr">Actions</span></th></tr></thead><tbody id="ly-form-rows">${rows}</tbody></table></div>`
      : '<p class="ly-help">No sections yet. Add one from the Sections list.</p>'
  }<h4 class="ly-h4">Creative guidance</h4>${flow ? `<div class="ly-flow">${flow}</div>` : '<p class="ly-help">No story jobs or section notes yet.</p>'}<p class="ly-help">Story jobs and notes guide the writer. They are not graded, and nothing here judges the plot.${story.off ? ' The story layer is declared off.' : ''}</p>${s ? `<h4 class="ly-h4">Edit selected section</h4>${form}` : ''}<div class="ly-actions">${story.declared && !story.off ? lyBtn('ly-story-off', 'Turn the story layer off', '', { cls: 'cm-btn cm-btn-outline' }) : ''}${story.declared ? lyBtn('ly-story-clear', 'Clear story plan', '', { cls: 'cm-btn' }) : ''}</div>${lyPendingStrip(T)}</div>`;
}

// ── Rhythm and melody ─────────────────────────────────────────────────────
const LY_COMMON_METERS = ['2/4', '3/4', '4/4', '6/8', '7/8', '9/8', '12/8'];
const LY_PICKUPS = [
  'quarter-beat pickup',
  'half-beat pickup',
  'one-beat pickup',
  'two-beat pickup',
];
function lyRhythmSec(model) {
  const k = LY.picks.rhythmSec;
  if (model.sections[k]) return k;
  return lySectionOfLine(model, LY.activeLine)?.index ?? 0;
}
// Scientific pitch for a frequency on the 12-TET grid (A4 = 440 Hz), or the
// exact hertz when it is not on it. Display only; the stored value is kept.
function lyPitchName(hz) {
  if (hz === null) return 'Rest';
  const midi = 69 + 12 * Math.log2(hz / 440);
  const r = Math.round(midi);
  if (Math.abs(midi - r) > 0.02) return `${hz} Hz`;
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return `${names[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`;
}
function lyToolRhythm(model) {
  const k = lyRhythmSec(model);
  const s = model.sections[k];
  if (!s)
    return `<div class="ly-tool-view"><div class="ly-view-head">${icon('music', 22)}<div><h3 class="ly-h3">Rhythm</h3><p class="ly-help">Meter and line placement</p></div></div><p class="ly-help">Add a section first; rhythm is declared per section header.</p></div>`;
  const T = 'rhythm',
    G = String(k);
  const d = lyDraftOf(T, G);
  const c = LY_FORMS[T].committed(model, G);
  const v = (f) => lyVal(T, G, f, c[f]);
  const saved =
    LY.picks.rhythmSaved && LY.picks.rhythmSaved.k === k ? LY.picks.rhythmSaved.text : '';
  const pickups = [
    ...new Set([...LY_PICKUPS, ...model.sections.map((x) => x.header?.pickup).filter(Boolean)]),
  ];
  const table = model.sections
    .map(
      (x) =>
        `<tr class="${x.index === k ? 'is-selected' : ''}"><th scope="row"><button type="button" class="ly-rowpick" data-ui="ly-rhythm-pick" data-id="${x.index}" aria-pressed="${x.index === k}">${esc(x.title)}</button></th><td>${esc(x.header?.meter || 'Not set')}</td><td>${esc(x.header?.bars != null ? String(x.header.bars) : 'Not set')}</td><td>${esc(x.header?.pickup || 'None')}</td></tr>`
    )
    .join('');
  const copy = LY.picks.rhythmCopy
    ? `<fieldset class="ly-fieldset ly-copy"><legend>Copy ${esc(s.title)}’s meter, bars and pickup to</legend>${model.sections
        .filter((x) => x.index !== k)
        .map(
          (x) =>
            `<label class="ly-check"><input type="checkbox" data-copy="${x.index}"> ${esc(x.title)}</label>`
        )
        .join(
          ''
        )}<div class="ly-actions">${lyBtn('ly-rhythm-copy-apply', 'Apply', 'check', { cls: 'cm-btn cm-btn-primary' })}${lyBtn('ly-rhythm-copy', 'Cancel', '', { cls: 'cm-btn cm-btn-outline' })}</div></fieldset>`
    : '';
  // Line placement for this section.
  const P = 'placement';
  const pd = lyDraftOf(P, G);
  const pc = LY_FORMS[P].committed(model, G);
  const pv = (f) => lyVal(P, G, f, pc[f]);
  const beats = s.header?.meter ? Number(s.header.meter.split('/')[0]) : 0;
  const unit = beats && LY.picks.durUnit === 'bars' ? 'bars' : 'beats';
  const prow = s.sung
    .map((r) => {
      const dur = pv(`duration.${r.n}`);
      const shown =
        unit === 'bars' && dur !== '' && Number.isFinite(Number(dur))
          ? String(Number(dur) / beats)
          : dur;
      return `<tr><th scope="row">${r.n}</th><td class="ly-cell-text">${esc(r.text)}</td><td><input class="cm-input ly-num-in" inputmode="numeric" data-draft="${P}" data-target="${G}" data-field="bar.${r.n}" value="${esc(pv(`bar.${r.n}`))}" placeholder="—" aria-label="Line ${r.n} bar"${lyErr(pd, `bar.${r.n}`)}></td><td><input class="cm-input ly-num-in" inputmode="decimal" data-draft="${P}" data-target="${G}" data-field="beat.${r.n}" value="${esc(pv(`beat.${r.n}`))}" placeholder="—" aria-label="Line ${r.n} start beat"></td><td><input class="cm-input ly-num-in" inputmode="decimal" data-draft="${P}" data-target="${G}" data-field="duration.${r.n}" data-unit="${unit}" data-beats="${beats}" value="${esc(shown)}" placeholder="—" aria-label="Line ${r.n} duration in ${unit}">${unit === 'bars' && dur ? `<small class="ly-help">${esc(dur)} beats</small>` : ''}</td></tr>${pd?.errors?.[`bar.${r.n}`] ? `<tr><td colspan="5">${lyErrText(pd, `bar.${r.n}`)}</td></tr>` : ''}`;
    })
    .join('');
  // Declared melody (song-wide).
  const M = 'melody';
  const md = lyDraftOf(M, 'song');
  const mc = LY_FORMS[M].committed(model);
  const mv = (f) => lyVal(M, 'song', f, mc[f]);
  const mdecl = lySetupOf(model, 'melody')[0];
  const mm = mdecl ? lyParseMelody(mdecl.value).melody : null;
  const chips = mm
    ? mm.notes
        .map(
          (n) =>
            `<span class="ly-note-chip"><strong>${esc(lyPitchName(n.pitch_hz))}</strong><small>${esc(`${n.ticks / mm.subdivision} beat${n.ticks / mm.subdivision === 1 ? '' : 's'}`)}</small></span>`
        )
        .join('')
    : '';
  return `<div class="ly-tool-view"><div class="ly-view-head">${icon('music', 22)}<div><h3 class="ly-h3">Rhythm</h3><p class="ly-help">Set meter, bars and line placement for each section.</p></div>${saved ? `<span class="ly-view-status">${lyStatus('success', saved)}</span>` : ''}</div>
<div class="ly-form-grid"><div class="ly-field"><label class="ly-label" for="ly-r-meter">Meter <small>(${esc(s.title)})</small></label><input id="ly-r-meter" class="cm-input" list="ly-meters" data-draft="${T}" data-target="${G}" data-field="meter" value="${esc(v('meter'))}" placeholder="Not set" autocomplete="off"${lyErr(d, 'meter')}><datalist id="ly-meters">${LY_COMMON_METERS.map((m) => `<option value="${m}">`).join('')}</datalist>${lyErrText(d, 'meter')}</div><div class="ly-field"><label class="ly-label" for="ly-r-bars">Section bars <small>(optional)</small></label><input id="ly-r-bars" class="cm-input" inputmode="numeric" data-draft="${T}" data-target="${G}" data-field="bars" value="${esc(v('bars'))}" placeholder="Not set"${lyErr(d, 'bars')}>${lyErrText(d, 'bars')}</div><div class="ly-field"><label class="ly-label" for="ly-r-pickup">Pickup</label><select id="ly-r-pickup" class="cm-select" data-draft="${T}" data-target="${G}" data-field="pickup"${lyErr(d, 'pickup')}>${lyOpts(
    pickups.map((p) => [p, p]),
    v('pickup'),
    'None'
  )}</select>${lyErrText(d, 'pickup')}</div></div>
<div class="ly-table-wrap"><table class="ly-table"><thead><tr><th>Section</th><th>Meter</th><th>Bars (optional)</th><th>Pickup</th></tr></thead><tbody>${table}</tbody></table></div>
<div class="ly-actions">${lyBtn('ly-rhythm-save', 'Save rhythm', 'check', { id: k, cls: 'cm-btn cm-btn-primary', extra: lyDraftStale(d) ? 'disabled' : '' })}${lyBtn('ly-rhythm-copy', 'Copy to other sections', 'copy', { cls: 'cm-btn cm-btn-outline', extra: `aria-expanded="${!!LY.picks.rhythmCopy}"` })}</div>${copy}
<h4 class="ly-h4">Line placement <small>(optional)</small></h4><p class="ly-help">Where each line starts within the song’s bars and how long it lasts. All three blank is undeclared. No tempo is assumed.</p>${
    beats
      ? `<div class="ly-inline-field"><label class="ly-label" for="ly-dur-unit">Duration unit</label><select id="ly-dur-unit" class="cm-select">${lyOpts(
          [
            ['beats', 'Beats'],
            ['bars', `Bars (× ${beats} beats)`],
          ],
          unit,
          null
        )}</select></div>`
      : ''
  }<div class="ly-table-wrap"><table class="ly-table"><thead><tr><th>Line</th><th>Text</th><th>Bar</th><th>Start beat</th><th>Duration (${unit})</th></tr></thead><tbody>${prow}</tbody></table></div>
<h4 class="ly-h4">Declared melody · whole song <small>(optional)</small></h4><p class="ly-help">One repeating phrase per line, in scientific pitch (A4 = 440 Hz); durations in beats of the meter’s unit.</p>${chips ? `<div class="ly-note-chips">${chips}</div>` : '<p class="ly-help">No melody declared.</p>'}<details class="cm-accordion"${md ? ' open' : ''}><summary>Advanced input</summary><div class="ly-form-grid"><div class="ly-field ly-field-sm"><label class="ly-label" for="ly-m-meter">Meter</label><input id="ly-m-meter" class="cm-input" data-draft="${M}" data-target="song" data-field="meter" value="${esc(mv('meter'))}" placeholder="6/8"></div><div class="ly-field ly-field-sm"><label class="ly-label" for="ly-m-groups">Beat groups</label><input id="ly-m-groups" class="cm-input" data-draft="${M}" data-target="song" data-field="groups" value="${esc(mv('groups'))}" placeholder="3+3"></div><div class="ly-field ly-field-sm"><label class="ly-label" for="ly-m-bars">Bars per line</label><input id="ly-m-bars" class="cm-input" inputmode="numeric" data-draft="${M}" data-target="song" data-field="bars" value="${esc(mv('bars'))}" placeholder="1"></div><div class="ly-field ly-field-sm"><label class="ly-label" for="ly-m-sub">Subdivision</label><select id="ly-m-sub" class="cm-select" data-draft="${M}" data-target="song" data-field="subdivision">${lyOpts(
    [
      ['1', '1'],
      ['2', '2'],
      ['4', '4'],
    ],
    mv('subdivision'),
    null
  )}</select></div><div class="ly-field ly-field-wide"><label class="ly-label" for="ly-m-events">Events: hertz:ticks or rest:ticks</label><input id="ly-m-events" class="cm-input" data-draft="${M}" data-target="song" data-field="events" value="${esc(mv('events'))}" placeholder="261.63:1 329.63:1 392:2 rest:2"${lyErr(md, 'events')}>${lyErrText(md, 'events')}</div></div></details><p class="ly-help">${icon('info', 14)} Declaration only · Run review to check this version.</p>${lyPendingStrip(T)}</div>`;
}

// ── Rhymes ────────────────────────────────────────────────────────────────
function lyToolRhymes(model) {
  const T = 'rhymes',
    G = 'song';
  const d = lyDraftOf(T, G);
  const c = LY_FORMS[T].committed(model);
  const rel = lyVal(T, G, 'relation', c.relation);
  const members = lyVal(T, G, 'members', []) || [];
  const known = LY_RELATIONS.map((r) => r[0]);
  const custom = rel && !known.includes(rel);
  const relName = (r) => LY_RELATIONS.find((x) => x[0] === r)?.[1] || r || 'any relation';
  const seg = LY_RELATIONS.map(
    ([val, label]) =>
      `<button type="button" data-ui="ly-relation" data-id="${esc(val)}" aria-pressed="${!custom && rel === val}">${esc(label)}</button>`
  ).join('');
  const line =
    LY.picks.linkLine && model.sung[LY.picks.linkLine - 1]
      ? LY.picks.linkLine
      : LY.activeLine || model.sung[0]?.n || 0;
  const toks = line ? lyTokens(model.sung[line - 1].text, model.voices) : [];
  const place = LY.picks.linkPlace || 'end';
  const places = [
    ['end', 'End of line'],
    ['endword', 'Last word'],
    ['head', 'First word'],
    ['headrime', 'First rhyme'],
    ['line', 'Whole line'],
    ...toks.map((t, i) => [`T${i + 1}`, `Word ${i + 1} · ${t}`]),
  ];
  const groups = lySetupOf(model, 'rhyme groups').flatMap((dd) => lyRowGroups(dd));
  const selGroup = groups[LY.picks.linkGroup] ? LY.picks.linkGroup : -1;
  const committedList = groups.length
    ? `<ul class="ly-links">${groups
        .map((g, k) => {
          const letter = lyFamilyLabel(k);
          return `<li><label class="ly-check"><input type="radio" name="ly-link-group" value="${k}"${k === selGroup ? ' checked' : ''}><span class="ly-letter" data-g="${k % 6}">${letter}</span><span><strong>${letter} · declared ${esc(relName(c.relation))}</strong><small>${g.map((m) => (m.bad || m.undecided ? esc(m.raw) : `Line ${m.line} · ${esc(String(lyMemberWord(model, m) ?? 'missing').slice(0, 30))}`)).join(' ~ ')}</small></span></label></li>`;
        })
        .join('')}</ul>`
    : '<p class="ly-help">No rhyme links declared.</p>';
  const memberList = members.length
    ? `<ul class="ly-members">${members.map((m, i) => `<li><span>Line ${m.line}</span><span>${esc(lyMemberLabel(m))}</span><strong>“${esc(String(lyMemberWord(model, m) ?? '').slice(0, 40))}”</strong>${lyBtn('ly-member-remove', `Remove line ${m.line}`, 'x', { id: i, cls: 'cm-btn cm-btn-icon', hideLabel: true })}</li>`).join('')}</ul>`
    : '<p class="ly-help">Select a line in the document, then add it.</p>';
  const busy = chatState.busy;
  const status = groups.length
    ? lyPill(
        'warning',
        `Links declared · ${LY.state?.state === 'assessed_clear' || LY.state?.state === 'assessed_findings' ? 'reviewed' : 'not reviewed'}`
      )
    : '';
  return `<div class="ly-tool-view"><h4 class="ly-label">Relation</h4><div class="cm-segmented ly-seg" role="group" aria-label="Relation">${seg}</div><details class="ly-adv"${custom ? ' open' : ''}><summary>Advanced: custom relation</summary><div class="ly-inline-field"><input class="cm-input" id="ly-rel-custom" data-draft="${T}" data-target="${G}" data-field="relation" value="${esc(custom ? rel : '')}" placeholder="type:…, class:… or schema:…" aria-label="Custom relation"${lyErr(d, 'relation')}></div>${lyErrText(d, 'relation')}</details><p class="ly-help">The relation applies to every link in the song.</p>
<div class="ly-inline-field"><label class="ly-label" for="ly-link-place">Placement</label><select id="ly-link-place" class="cm-select">${lyOpts(places, place, null)}</select></div>
<div class="ly-inline-field"><label class="ly-label" for="ly-link-line">Line</label><select id="ly-link-line" class="cm-select">${lyLineOptions(model, line)}</select>${lyBtn('ly-link-add', 'Add', 'plus', { cls: 'cm-btn cm-btn-outline', extra: line ? '' : 'disabled' })}</div>
<h4 class="ly-label">Selected members</h4>${memberList}${lyErrText(d, 'members')}
<div class="ly-actions">${lyBtn('ly-draft-apply', 'Link endings', 'link', { id: T, cls: 'cm-btn cm-btn-primary', extra: members.length >= 2 && !lyDraftStale(d) ? '' : 'disabled' })}${lyBtn('ly-link-remove', 'Remove link', 'link', { cls: 'cm-btn cm-btn-outline', extra: selGroup >= 0 ? '' : 'disabled' })}</div>
<h4 class="ly-label">Declared links</h4>${committedList}
${lyToolRequestAction('ly-rhyme-options', 'Ask writer for rhyme options', 'pencil')}${busy ? '<p class="ly-help" id="ly-busy-note">Writer is working. You can keep editing.</p>' : ''}${lyRhymeResults()}${status ? `<p class="ly-status-line">${status}</p>` : ''}${lyPendingStrip(T)}</div>`;
}
// A screen's pair verdicts as options; nothing is inserted or declared.
function lyRhymeResults() {
  const r = LY.results.rhymes;
  if (!r) return '';
  // Compare at render time so edits after the reply (and restoring its version) count.
  const stale = !!r.baseId && r.baseId !== lyIdentity(LY.model);
  const rows = r.pairs
    .map((p) => {
      const kind = p.refused ? 'refused' : p.codes.length ? 'partial' : 'matched';
      const word = kind === 'matched' ? 'Matched' : kind === 'partial' ? 'Partial' : 'Refused';
      return `<li data-kind="${kind}">${lyPill(kind === 'matched' ? 'success' : kind === 'partial' ? 'warning' : 'danger', word)}<span><strong>${esc(p.a)} ~ ${esc(p.b)}</strong><small>${esc(p.refused ? p.reason || 'Not judged' : p.codes.length ? `Banned: ${p.codes.join(', ')}` : p.relations.join(', ') || 'no relation')}</small></span></li>`;
    })
    .join('');
  return `<section class="ly-result" aria-labelledby="ly-rr-h"><h4 class="ly-h4" id="ly-rr-h">Rhyme options</h4><p class="ly-help">From the writer’s screen of ${esc(uiCount(r.pairs.length, 'pair'))}${stale ? ' · asked about an earlier version' : ''}. Nothing was inserted or declared.</p><ul class="ly-options">${rows || '<li>No pairs returned.</li>'}</ul></section>`;
}

// ── Pronunciation ─────────────────────────────────────────────────────────
function lyToolPronunciation(model) {
  // An undecided saved reading binds no word until it is chosen again.
  const readings = lySetupOf(model, 'reading').filter((r) => !r.undecided);
  const line = LY.activeLine || LY.picks.readingLine || model.sung[0]?.n || 0;
  const row = model.sung[line - 1];
  const toks = row ? lyTokens(row.text, model.voices) : [];
  const key = LY.picks.reading;
  const target = key ? lyReadingTarget(key) : null;
  const chips = toks
    .map((t, i) => {
      const k = lyReadingKey(row.text, i + 1, t);
      return `<button type="button" class="cm-chip" data-ui="ly-reading-pick" data-id="${esc(k)}" aria-pressed="${k === key}">${esc(t)}</button>`;
    })
    .join('');
  let card = '';
  if (target) {
    const [tl, tt, tw] = target;
    const T = 'pronunciation';
    const d = lyDraftOf(T, key);
    const stale = lyDraftStale(d) || LY_FORMS[T].fp(model, key) === 'gone';
    const kind = lyVal(T, key, 'kind', '');
    const committed = readings.find((r) => r.line === tl && r.token === tt);
    const options = (LY.results.pronunciation?.items || []).filter(
      (o) =>
        o.line === tl &&
        o.word === tw &&
        lyNumberingTarget(
          tl,
          o.token,
          tw,
          o.numbering || LY.results.pronunciation.numbering,
          model.voices
        ) === tt
    );
    const readingOf = (phones) => {
      const syl = phones.filter((p) => /\d$/.test(p));
      const stress = syl.findIndex((p) => p.endsWith('1'));
      return `${uiCount(syl.length, 'syllable')}${stress >= 0 ? ` · stress on ${['first', 'second', 'third', 'fourth', 'fifth'][stress] || `syllable ${stress + 1}`}` : ''}`;
    };
    const optHtml = options.length
      ? `<ul class="ly-options">${options
          .flatMap((o) => o.dictionary_readings)
          .map(
            (r, i) =>
              `<li><span><strong>${esc(r.phones.join(' '))}</strong><small>${esc(`${uiCount(r.syllables ?? 0, 'syllable')} · stress ${r.stress.join('-')}`)} · Dictionary reading (CMUdict)</small></span>${lyBtn('ly-reading-use', 'Use reading', 'check', { id: i, cls: 'cm-btn cm-btn-primary ly-sm' })}</li>`
          )
          .join('')}</ul>`
      : `<p class="ly-help">${LY.results.pronunciation ? 'The dictionary returned no alternative readings for this word.' : 'No dictionary options fetched for this word.'}</p>`;
    const current = committed
      ? committed.malformed
        ? 'This reading cannot be read.'
        : committed.state === 'declared'
          ? `${committed.phones.join(' ')} · ${readingOf(committed.phones)} · ${committed.basis === 'dictionary' ? 'Dictionary reading' : 'Declared'} · source: ${committed.source || 'Source unavailable'}`
          : committed.state === 'uncertain'
            ? 'Marked uncertain'
            : 'Needs a choice'
      : 'No reading declared.';
    const own = kind === 'declared';
    card = `<div class="ly-word-card"><p class="ly-word">${esc(tw)}</p><p class="ly-help">Word ${tt} of ${esc(lyLineRef(model.sung.filter((r) => r.text === tl).map((r) => r.n)) || 'no current line')}</p><p>${esc(current)}</p>${stale ? `<p class="ly-inline" data-tone="warning">${icon('triangle-alert', 16)}<span><strong>Text changed · choose again</strong> The word has been edited. Choose a word from the current line.</span></p>` : ''}${optHtml}<div class="ly-actions">${lyBtn('ly-reading-kind', 'Declare my own', 'pencil', { id: 'declared', cls: `cm-btn cm-btn-outline${own ? ' is-on' : ''}`, extra: `aria-pressed="${own}"` })}${lyBtn('ly-reading-kind', 'Mark uncertain', 'circle-question-mark', { id: 'uncertain', cls: 'cm-btn cm-btn-outline', extra: `aria-pressed="${kind === 'uncertain'}"` })}</div>${
      own
        ? `<div class="ly-field"><label class="ly-label" for="ly-phones">Phones (stressed ARPABET)</label><input id="ly-phones" class="cm-input" data-draft="${T}" data-target="${esc(key)}" data-field="phones" value="${esc(lyVal(T, key, 'phones', ''))}" placeholder="G R OW1 S ER0" autocapitalize="characters"${lyErr(d, 'phones')}>${lyErrText(d, 'phones')}</div><div class="ly-field"><label class="ly-label" for="ly-source">Source (required)</label><input id="ly-source" class="cm-input" data-draft="${T}" data-target="${esc(key)}" data-field="source" value="${esc(lyVal(T, key, 'source', ''))}" placeholder="Who chose it and why"${lyErr(d, 'source')}>${lyErrText(d, 'source')}</div>`
        : ''
    }${lyErrText(d, 'kind')}${lyToolRequestAction('ly-pron-options', 'Get dictionary options', 'search')}${chatState.busy ? '<p class="ly-help">Writer is working. You can keep editing.</p>' : ''}${committed ? lyBtn('ly-remove-setup', 'Remove reading', 'trash-2', { id: committed.i, cls: 'cm-btn ly-link-btn' }) : ''}</div>`;
  }
  const list = readings.length
    ? `<ul class="ly-readings">${readings
        .map((r) => {
          const lines = r.malformed
            ? []
            : model.sung.filter((x) => x.text === r.line).map((x) => x.n);
          const ok = lines.length && lyTokens(r.line, model.voices)[r.token - 1] === r.word;
          const what = r.malformed
            ? 'Cannot be read'
            : r.state === 'declared'
              ? `${r.phones.join(' ')} · ${r.source || 'Source unavailable'}`
              : r.state === 'uncertain'
                ? 'Marked uncertain'
                : 'Needs a choice';
          return `<li><button type="button" class="ly-link-btn" data-ui="ly-reading-pick" data-id="${esc(lyReadingKey(r.line, r.token, r.word))}"><strong>“${esc(r.word || '?')}”</strong></button><small>${ok ? esc(lyLineRef(lines)) : ''} · ${esc(what)}</small>${ok ? '' : lyStatus('warning', 'Text changed · choose again')}</li>`;
        })
        .join('')}</ul>`
    : '<p class="ly-help">No readings declared.</p>';
  return `<div class="ly-tool-view">${row ? `<p class="ly-help">Line ${line}: choose a sung word.</p><div class="ly-chips" role="group" aria-label="Sung words on line ${line}">${chips}</div>` : '<p class="ly-help">Write some lines first.</p>'}${card}<details class="ly-adv"><summary>Declared readings (${readings.length})</summary>${list}</details><p class="ly-help">A reading binds an exact line and word position; identical lines share it.</p>${lyPendingStrip('pronunciation')}</div>`;
}

// ── Repeats & voices ──────────────────────────────────────────────────────
function lyToolRepeats(model) {
  const T = 'repeats-voices',
    G = 'song';
  const voices = lyVal(T, G, 'voices', model.voices ? 'sung' : 'unsung');
  const d = lyDraftOf(T, G);
  const placed = lyVal(T, G, 'placed', []) || [];
  const declared = lySetupOf(model, 'returns').flatMap((dd) => lyRowGroups(dd));
  const secs = model.sections.filter((s) => s.returnOf);
  const cards = secs
    .map(
      (s) =>
        `<div class="ly-card"><p><strong>${esc(s.title)} repeats ${esc(s.returnOf.title)}</strong></p><p class="ly-help">${esc(`${s.title} (${uiCount(s.sung.length, 'line')}) is an exact repeat of ${s.returnOf.title} (${uiCount(s.returnOf.sung.length, 'line')}).`)}</p><div class="ly-actions">${lyBtn('ly-view-both', 'View both', 'eye', { id: `${s.returnOf.index}:${s.index}`, cls: 'cm-btn cm-btn-outline' })}${lyBtn('ly-declare-repeat', 'Declare exact repeat', 'repeat', { id: `${s.returnOf.index}:${s.index}`, cls: 'cm-btn cm-btn-primary' })}</div></div>`
    )
    .join('');
  const lines = model.repeats
    .map((r) => `<li>“${esc(r.text.slice(0, 80))}” — ${esc(lyLineRef(r.lines))}</li>`)
    .join('');
  const parens = model.sung.filter((r) => /\(/.test(r.text));
  const line = LY.activeLine || model.sung[0]?.n || 0;
  const toks = line ? lyTokens(model.sung[line - 1].text, model.voices) : [];
  const places = [
    ['head', 'First word'],
    ['line', 'Whole line'],
    ['endword', 'Last word'],
    ...toks.map((t, i) => [`T${i + 1}`, `Word ${i + 1} · ${t}`]),
  ];
  return `<div class="ly-tool-view"><h4 class="ly-h4">Detected repeats</h4>${cards || '<p class="ly-help">No section returns word for word.</p>'}${lines ? `<ul class="ly-plain">${lines}</ul>` : '<p class="ly-help">No line repeats word for word.</p>'}<p class="ly-help">Found on this page by exact text. A changed final chorus is not an exact return.</p>
<h4 class="ly-h4">Declared returns</h4>${declared.length ? `<ul class="ly-plain">${declared.map((g) => `<li>${g.map((m) => (m.bad || m.undecided ? esc(m.raw) : `Line ${m.line}${m.explicit ? ` · ${esc(lyMemberLabel(m, 'returns'))}` : ''}`)).join(' = ')}</li>`).join('')}</ul>${lyBtn('ly-returns-clear', 'Clear declared returns', '', { cls: 'cm-btn ly-link-btn' })}<p class="ly-help">Clearing a return never deletes lyrics.</p>` : '<p class="ly-help">None declared.</p>'}
<details class="ly-adv"${placed.length || d?.errors?.placed ? ' open' : ''}><summary>Placed returns</summary><p class="ly-help">The same words at a place in different lines, e.g. a head that returns while the tail changes.</p><div class="ly-inline-field"><label class="ly-label" for="ly-placed-place">Place in line ${line}</label><select id="ly-placed-place" class="cm-select"${lyErr(d, 'placed')}>${lyOpts(places, LY.picks.placedPlace || 'head', null)}</select>${lyBtn('ly-placed-add', 'Add', 'plus', { cls: 'cm-btn cm-btn-outline', extra: line ? '' : 'disabled' })}</div>${lyErrText(d, 'placed')}${placed.length ? `<ul class="ly-members">${placed.map((m, i) => `<li><span>Line ${m.line}</span><span>${esc(lyMemberLabel(m))}</span><strong>“${esc(String(lyMemberWord(model, m) ?? '').slice(0, 40))}”</strong>${lyBtn('ly-placed-remove', `Remove line ${m.line}`, 'x', { id: i, cls: 'cm-btn cm-btn-icon', hideLabel: true })}</li>`).join('')}</ul>` : ''}</details>
<h4 class="ly-h4">Parenthesised text</h4><div class="cm-segmented ly-seg" role="group" aria-label="Parenthesised text">${lyBtn('ly-voices', 'Unsung aside', '', { id: 'unsung', cls: '', extra: `aria-pressed="${voices !== 'sung'}"` })}${lyBtn('ly-voices', 'Sung second voice', '', { id: 'sung', cls: '', extra: `aria-pressed="${voices === 'sung'}"` })}</div><p class="ly-help">Applies to the whole document. Changing it changes which words are sung, so readings and review may need renewing.</p>${parens.length ? `<ul class="ly-plain">${parens.map((r) => `<li>Line ${r.n}: ${esc(r.text.slice(0, 80))}</li>`).join('')}</ul>` : '<p class="ly-help">No line in this document has parentheses.</p>'}${lyPendingStrip(T)}</div>`;
}

// ── Word rules ────────────────────────────────────────────────────────────
function lyToolWordRules(model) {
  const T = 'word-rules',
    G = 'song';
  const d = lyDraftOf(T, G);
  const c = LY_FORMS[T].committed(model);
  const list = (key, label, hint) => {
    const values = lyVal(T, G, key, c[key]) || [];
    return `<div class="ly-field"><h4 class="ly-label">${label}</h4>${values.map((w, i) => `<div class="ly-inline-field"><input class="cm-input" data-list="${key}" data-idx="${i}" value="${esc(w)}" aria-label="${label} ${i + 1}">${lyBtn('ly-word-remove', `Remove ${w || 'phrase'}`, 'x', { id: `${key}:${i}`, cls: 'cm-btn cm-btn-icon', hideLabel: true })}</div>`).join('')}<div class="ly-inline-field"><input class="cm-input" id="ly-${key}-new" placeholder="${hint}" aria-label="Add a ${label.toLowerCase().replace(/s$/, '')}">${lyBtn('ly-word-add', 'Add phrase', 'plus', { id: key, cls: 'cm-btn cm-btn-outline' })}</div></div>`;
  };
  return `<div class="ly-tool-view">${list('require', 'Required phrases', 'Add phrase…')}${list('avoid', 'Avoid phrases', 'Add phrase…')}${lyErrText(d, 'require')}<p class="ly-help">Checked on this page by exact wording. Blank entries are ignored; repeated entries are kept once. Title and hook are set in the Song brief.</p>${lyPendingStrip(T)}</div>`;
}

// ── Review ────────────────────────────────────────────────────────────────
const lyShortId = (id) => (id ? id.slice(0, 7) : 'unknown');
function lyCoverageRows(a) {
  const run = LY.run;
  const layers = ['Form', 'Rhymes', 'Rhythm', 'Pronunciation'];
  const status = {};
  const measured = ['assessed_clear', 'assessed_findings', 'input', 'failed'].includes(a.state);
  for (const l of layers) {
    if (a.state === 'running') status[l] = ['info', 'Pending'];
    else if (!measured) status[l] = ['', 'Not reviewed'];
    else {
      const obs = (run?.coverage?.obligations || []).filter((o) => lyLayerOf(o) === l);
      if (!run?.coverage) status[l] = ['warning', 'Unknown'];
      else if (!obs.length) status[l] = ['', 'Not requested'];
      else if (obs.some((o) => o.status === 'refused')) status[l] = ['warning', 'Needs input'];
      else if (obs.every((o) => o.status === 'not_requested')) status[l] = ['', 'Not requested'];
      else status[l] = ['info', 'Executed'];
    }
  }
  const rows = layers
    .map((l) => `<li><span>${l}</span>${lyPill(status[l][0], status[l][1])}</li>`)
    .join('');
  return `<ul class="ly-coverage">${rows}<li><span>Story</span>${lyPill('', 'Creative guidance')}</li><li><span>Performance</span>${lyPill('', 'Not assessed')}</li></ul>`;
}
function lySuggestionHtml(item) {
  const run = LY.run;
  const out = LY.outcomes[item.id];
  const own = LY.own[item.id];
  const model = LY.model;
  // Current only when the run, the whole document binding and the target
  // still match; otherwise Apply becomes Recheck.
  let stale = !run || item.decision?.run !== run.id;
  if (!stale && run.base)
    stale = !!lyDeclarationRefusal(run, model) && lyIdentity(model) !== run.baseId;
  if (!stale && !item.decision.whole && run.base) {
    const k = item.decision.n - 1;
    stale = lySungTexts(model)[k] !== run.base[k] || model.sung.length !== run.base.length;
  }
  const base = `Based on ${lyShortId(run?.baseId)}${stale ? ' · stale' : ''}`;
  let html = `<article class="ly-card ly-sugg" aria-labelledby="ly-s-${esc(item.id)}"><div class="ly-sugg-head"><h4 class="ly-h4" id="ly-s-${esc(item.id)}">${esc(item.decision.whole ? 'Writer result ready · compare with your current draft' : 'Suggestion')}</h4>${lyPill(stale ? 'warning' : '', base)}</div><p class="ly-help">${esc(item.where)}${item.lines?.length ? ` · ${lyBtn('ly-show-lines', 'Show in draft', '', { id: item.lines[0], cls: 'cm-btn ly-link-btn' })}` : ''}</p>`;
  if (item.decision.whole)
    html += `<details class="ly-whole"><summary>Compare</summary><div class="ly-compare"><div><span class="ly-label">Your draft</span><pre>${esc(lySungTexts(model).join('\n'))}</pre></div><div><span class="ly-label">Writer’s draft</span><pre>${esc(item.whole.join('\n'))}</pre></div></div></details>`;
  else
    html += `<div class="ly-field"><span class="ly-label">Original</span><p class="ly-quote">${esc(item.original)}</p></div><div class="ly-field"><span class="ly-label">Proposed</span><p class="ly-quote ly-quote-new">${esc(item.proposal)}</p></div>`;
  if (item.text && !item.decision.whole) html += `<p class="ly-help">${esc(item.text)}</p>`;
  if (out?.state === 'failed')
    html += `<div class="ly-inline" data-tone="danger" role="alert">${icon('circle-alert', 16)}<span><strong>Not applied.</strong> ${esc(out.message)}</span></div>`;
  if (own !== undefined)
    html += `<div class="ly-field"><label class="ly-label" for="ly-own-input">Your line ${item.decision.n}</label><input id="ly-own-input" class="cm-input" data-id="${esc(item.id)}" value="${esc(own)}"><div class="ly-actions">${lyBtn('ly-own-put', 'Put in draft (unchecked)', 'pencil', { id: item.id, cls: 'cm-btn cm-btn-outline' })}${lyBtn('ly-own-cancel', 'Cancel', '', { id: item.id, cls: 'cm-btn' })}</div><p class="ly-help">An ordinary edit that nothing has checked; it cannot carry any certification.</p></div>`;
  else
    html += `<div class="ly-actions">${lyBtn('ly-keep', 'Keep mine', 'bookmark', { id: item.id, cls: 'cm-btn cm-btn-outline' })}${
      stale
        ? `<button type="button" class="cm-btn cm-btn-primary" disabled aria-disabled="true">Recheck before applying</button>${lyBtn('ly-recheck', 'Recheck suggestion', 'refresh-cw', { id: item.id, cls: 'cm-btn cm-btn-outline', extra: chatState.busy ? 'disabled' : '' })}`
        : lyBtn(
            'ly-apply',
            item.decision.whole && !run?.base
              ? 'Replace with writer’s draft (unchecked)'
              : 'Apply change',
            'check',
            { id: item.id, cls: 'cm-btn cm-btn-primary' }
          )
    }${item.decision.whole ? '' : lyBtn('ly-own', 'Write my own', 'pencil', { id: item.id, cls: 'cm-btn cm-btn-outline' })}</div>`;
  if (out?.state === 'applied')
    html += `<div class="ly-inline" data-tone="success" role="status">${icon('circle-check', 16)}<span>${esc(out.message)}</span></div>`;
  return html + '</article>';
}
function lyItemRow(item) {
  const tone = LY_TONES[item.tone];
  return `<li class="ly-item" data-tone="${item.tone}">${icon(tone.icon, 16)}<span><strong>${esc(item.title)}</strong><small>${esc(item.where)}${item.stale ? ' · from an earlier version' : ''}</small>${item.text ? `<small>${esc(item.text)}</small>` : ''}${item.actions?.length ? `<span class="ly-actions">${item.actions.map(([act, label, ic, id]) => lyBtn(act, label, ic, { id, cls: 'cm-btn ly-link-btn' })).join('')}</span>` : ''}${item.lines?.length ? lyBtn('ly-show-lines', 'Show in draft', '', { id: item.lines[0], cls: 'cm-btn ly-link-btn' }) : ''}</span></li>`;
}
function lyRenderReview() {
  const box = $ui('ly-panel-review');
  if (!box) return;
  const model = LY.model;
  const a = LY.state || lyAnalysis(model);
  const items = LY.items || lyItems();
  const run = items.filter((i) => i.source === 'run');
  const local = items.filter((i) => i.source === 'page');
  const suggestions = run.filter((i) => i.decision && !i.stale);
  const others = run.filter((i) => !i.decision);
  const w = lyWriterState();
  let html = `<section class="ly-card" aria-labelledby="ly-cur-h"><div class="ly-rev-head"><h3 class="ly-h3" id="ly-cur-h">Current version · ${esc(lyShortId(lyIdentity(model)))}</h3>${lyPill(a.tone, a.label)}</div>${a.certified ? `<p>${lyPill('success', 'Certified for this version')}</p>` : ''}${a.earlier ? `<p class="ly-inline" data-tone="warning">${icon('triangle-alert', 16)}<span>Review running for earlier version. Its results will arrive as history.</span></p>` : ''}${a.state === 'stale' && LY.run?.resultModel ? `<p class="ly-help">${esc(lyIdentityDiff(LY.run.resultModel, model).join(', ') || 'The document')} changed since the review.</p>` : ''}${w.unknown ? `<p class="ly-help">Outcome unknown. Retrieve the saved result before starting another request.</p>${lyBtn('ly-retrieve', 'Retrieve saved result', 'refresh-cw', { cls: 'cm-btn cm-btn-primary ly-block' })}` : ''}${
    model.sung.length
      ? lyBtn('ly-run-review', 'Run review', 'play', {
          cls: 'cm-btn cm-btn-primary ly-block',
          extra: chatState.busy || w.unknown ? 'disabled' : '',
        })
      : '<p class="ly-help">Add lyrics in Song before running a review.</p>'
  }</section>`;
  if (LY.run && (LY.run.baseId || LY.run.resultId) && a.state !== 'stale' && a.state !== 'none')
    html += '';
  else if (LY.run)
    html += `<button type="button" class="ly-card ly-row" data-ui="ly-tab" data-id="history"><span><strong>Earlier result · ${esc(LY.run.baseId ? lyShortId(LY.run.baseId) : 'declarations unknown')}</strong><small>${esc(lyRunStatus(LY.run)?.word || '')}</small></span>${icon('chevron-right', 18)}</button>`;
  html += suggestions.map(lySuggestionHtml).join('');
  if (others.length)
    html += `<section class="ly-card" aria-labelledby="ly-find-h"><h4 class="ly-h4" id="ly-find-h">From the review</h4><ul class="ly-items">${others.map(lyItemRow).join('')}</ul></section>`;
  html += `<details class="ly-card ly-review-coverage"><summary><strong>Coverage details</strong></summary>${lyCoverageRows(a)}</details>`;
  html += `<details class="ly-card ly-local"${local.length && !run.length ? ' open' : ''}><summary><strong>Local checks</strong> <span class="ly-count">${local.length}</span></summary><p class="ly-help">Exact text facts found on this page: declared sizes, returns, readings, links and word rules. Not a review result.</p>${local.length ? `<ul class="ly-items">${local.map(lyItemRow).join('')}</ul>` : '<p class="ly-help">Nothing found.</p>'}</details><p class="ly-help">${icon('info', 14)} Changes to text, form or rhythm require a new review.</p>`;
  lySetHtml(box, html, 'review');
}

// ── Writer ────────────────────────────────────────────────────────────────
const LY_STAGES = ['Planning', 'Drafting', 'Checking', 'Revising', 'Finished'];
// The receipt's stage (lower case, from the server or the shell) as a word;
// anything else, or none, is just Working.
const lyStageName = (stage) =>
  LY_STAGES.find((s) => s.toLowerCase() === String(stage || '').toLowerCase()) || 'Working';
function lyElapsed(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function lyWriterState() {
  const lyric = chatState.lyric || null;
  const lyricChat = lyLyricChat();
  const run = LY.run;
  const live = run && lyRunLive(run);
  return {
    busy: chatState.busy && lyricChat,
    unknown: lyricChat && !!chatState.pending && !chatState.busy,
    lyric,
    waiting: lyricChat && lyLiveWaiting(lyric) && !chatState.busy,
    parked: lyricChat && !!lyric?.parked,
    uncertain: !!lyric?.uncertain_proposal,
    capacity: !!lyric?.new_run_required,
    interrupted:
      !!(live && (run.artifact?.status === 'interrupted' || run.error)) || !!chatState.disconnected,
    disconnected: !!chatState.disconnected,
  };
}
function lyRenderWriter() {
  const box = $ui('ly-writer-status');
  if (!box) return;
  uiUpdatePrompt();
  const w = lyWriterState();
  const run = LY.run;
  const model = LY.model;
  let html = `<div class="ly-writer-head"><h3 class="ly-h3">Writer</h3>${lyBtn('ly-tab', 'History', 'history', { id: 'history', cls: 'cm-btn ly-link-btn' })}</div>`;
  if (LY.conflict) {
    const what = w.unknown
      ? 'A saved request’s outcome is unknown.'
      : w.waiting
        ? 'The writer is waiting for your answer.'
        : w.parked
          ? `The writer’s run is parked with ${uiCount((w.lyric?.open || []).length, 'open line')}.`
          : 'The writer has unfinished work.';
    html += `<div class="ly-card" data-tone="warning" role="alert"><p><strong>${esc(what)}</strong> Starting this now would set it aside.</p><div class="ly-actions">${lyBtn('ly-conflict-resume', 'Resume current work', 'play', { cls: 'cm-btn cm-btn-primary' })}${lyBtn('ly-conflict-new', 'Start independent work', 'file-plus', { cls: 'cm-btn cm-btn-outline', extra: w.unknown ? 'disabled' : '' })}${lyBtn('ly-conflict-cancel', 'Cancel', '', { cls: 'cm-btn' })}</div><p class="ly-help">Starts a separate writer run. The current one stays under History${w.unknown ? ' — retrieve its saved result first' : ''}.</p></div>`;
  }
  if (w.busy) {
    const p = LY.progress || chatState.progress || null;
    const stage = lyStageName(p?.stage);
    const started = p?.created_at
      ? Date.parse(p.created_at) || p.created_at
      : chatState.pending?.created_at;
    const updated = p?.updated_at ? Date.parse(p.updated_at) || p.updated_at : null;
    html += `<section class="ly-card" aria-labelledby="ly-prog-h"><h4 class="ly-h4" id="ly-prog-h">${esc(stage)}${p?.round != null ? ` · cycle ${esc(String(p.round))}` : ''}</h4><ol class="ly-stages">${LY_STAGES.map((s) => `<li${s === stage ? ' aria-current="step" class="is-current"' : ''}>${icon(s === stage ? 'loader' : 'circle', 16)}<span>${s}</span></li>`).join('')}</ol><dl class="ly-dl"><dt>Elapsed</dt><dd id="ly-elapsed" aria-live="off">${started ? lyElapsed(Date.now() - started) : '—'}</dd><dt>Last update</dt><dd id="ly-updated">${updated ? `${lyElapsed(Date.now() - updated)} ago` : '—'}</dd>${p?.accepted_lines != null ? `<dt>Accepted lines</dt><dd>${esc(String(p.accepted_lines))}</dd>` : ''}</dl><p class="ly-help">You can keep editing. The result is compared with your draft when it arrives.</p></section>`;
  } else if (w.unknown)
    html += `<section class="ly-card" data-tone="warning" role="status"><p>${lyPill('warning', 'Interrupted')}</p><p><strong>Outcome unknown. Retrieve the saved result before starting another request.</strong></p>${lyBtn('ly-retrieve', 'Retrieve saved result', 'refresh-cw', { cls: 'cm-btn cm-btn-primary ly-block' })}</section>`;
  else if (w.interrupted || w.uncertain || w.capacity) {
    const safe = !!(
      w.lyric?.state &&
      w.lyric.resumable !== false &&
      !w.uncertain &&
      !w.capacity &&
      chatState.continuationId
    );
    const accepted = run?.final;
    const differs = accepted && !lySame(accepted, lySungTexts(model));
    html += `<section class="ly-card" data-tone="warning" aria-labelledby="ly-int-h"><p>${lyPill('warning', 'Interrupted')}</p><h4 class="ly-h4" id="ly-int-h">${w.disconnected ? 'The connection ended before the writer finished.' : 'The writer stopped before finishing.'}</h4>${accepted ? `<p>${lyStatus('success', 'Your accepted draft is saved.')} <small>${esc(uiCount(accepted.length, 'line'))}</small></p>` : ''}<p>${lyPill('warning', 'Review incomplete')}</p>${safe ? `<p>${lyStatus('success', 'Saved checkpoint available')}</p>` : ''}${w.uncertain ? '<p class="ly-help">The interrupted proposal may already have been charged. It will not be repeated automatically.</p>' : ''}${w.capacity ? '<p class="ly-help">This run reached its journal capacity; continuing needs new work.</p>' : ''}<div class="ly-actions ly-stack">${safe ? lyBtn('ly-resume', 'Resume from saved draft', 'play', { cls: 'cm-btn cm-btn-primary', extra: differs ? 'disabled aria-describedby="ly-resume-why"' : '' }) : ''}${safe && differs ? `<p class="ly-help" id="ly-resume-why">Your draft differs from the checkpoint.</p>${lyBtn('ly-restore-checkpoint', 'Restore checkpoint draft', 'refresh-cw', { cls: 'cm-btn cm-btn-outline' })}` : ''}${lyBtn('ly-retrieve', 'Retrieve saved result', 'refresh-cw', { cls: 'cm-btn cm-btn-outline', extra: chatState.pending ? '' : 'disabled' })}${lyBtn('ly-new-work', differs ? 'Start new work from current draft' : 'Start new work', 'file-plus', { cls: 'cm-btn cm-btn-outline' })}</div><p class="ly-help">Starts a separate writer run.</p><details class="ly-adv"><summary>Technical details</summary><dl class="ly-dl">${
      [
        ['Code', run?.error?.code || run?.stopped || run?.artifact?.status || ''],
        [
          'Reason',
          typeof run?.error === 'string'
            ? run.error
            : run?.error?.message || run?.artifact?.last_attempt?.error || '',
        ],
        ['Request', chatState.continuationId || chatState.disconnected || ''],
        ['Stage', LY.progress?.stage || ''],
      ]
        .filter(([, x]) => x)
        .map(([k, x]) => `<dt>${k}</dt><dd>${esc(String(x).slice(0, 300))}</dd>`)
        .join('') || '<dt>Details</dt><dd>None supplied.</dd>'
    }</dl></details></section>`;
  } else if (w.waiting) {
    const item = (LY.items || []).find((i) => i.id === 'waiting');
    const lines = item?.answer || [0];
    html += `<section class="ly-card" aria-labelledby="ly-ask-h"><h4 class="ly-h4" id="ly-ask-h">${esc(item?.title || 'The writer is waiting for an answer')}</h4>${item?.question ? `<p class="ly-quote">${esc(item.question)}</p>` : ''}${lines.map((n) => `<div class="ly-field"><label class="ly-label" for="ly-answer-${n}">${n ? `Your line ${n}` : 'Your answer'}</label><textarea id="ly-answer-${n}" class="cm-input" rows="2" data-answer="${n}">${esc(n ? lySungTexts(model)[n - 1] || '' : '')}</textarea></div>`).join('')}${lyBtn('ly-answer', 'Submit answer', 'send', { cls: 'cm-btn cm-btn-primary' })}<p class="ly-help">Sent to the same, still-waiting run.</p></section>`;
  } else if (w.parked)
    html += `<section class="ly-card" data-tone="warning"><p><strong>Parked with ${esc(uiCount((w.lyric.open || []).length, 'open line'))}</strong></p><p class="ly-help">The run stopped with lines unresolved. Answer in the conversation below, or start new work.</p></section>`;
  else if (!run)
    html += `<section class="ly-card"><p>The writer is idle. Nothing is sent until you choose an action.</p><div class="ly-actions ly-stack">${lyBtn('new-lyrics', 'New song', 'file-plus', { cls: 'cm-btn cm-btn-outline' })}${lyBtn('edit-lyrics', 'Edit this draft', 'pencil', { cls: 'cm-btn cm-btn-outline' })}${lyBtn('attach-recipe', 'Use current recipe', 'layers', { cls: 'cm-btn cm-btn-outline' })}</div></section>`;
  else {
    const st = lyRunStatus(run);
    html += `<section class="ly-card"><p>${lyPill(st.tone || '', `Last reply: ${st.word}`)}</p><p class="ly-help">${esc(new Date(run.at).toLocaleTimeString())} · ${run.final ? esc(uiCount(run.final.length, 'line')) : 'no draft in this reply'}</p></section>`;
  }
  html += `<p class="ly-sr" id="ly-stage-live" aria-live="polite">${esc(LY.stageSaid || '')}</p>`;
  lySetHtml(box, html, 'writer');
  lyClock(w.busy);
}
// The clock ticks without re-rendering or announcing, and only while a
// request runs with the Writer showing it: an idle page holds no timer.
let lyClockTimer = 0;
function lyClock(on) {
  if (on && !lyClockTimer) lyClockTimer = setInterval(lyClockTick, 1000);
  if (!on && lyClockTimer) {
    clearInterval(lyClockTimer);
    lyClockTimer = 0;
  }
}
function lyClockTick() {
  const el = document.getElementById('ly-elapsed');
  if (!el || !chatState.busy) return lyClock(false);
  const p = LY.progress;
  const started = p?.created_at
    ? Date.parse(p.created_at) || p.created_at
    : chatState.pending?.created_at;
  if (started) el.textContent = lyElapsed(Date.now() - started);
  const up = document.getElementById('ly-updated');
  const updated = p?.updated_at ? Date.parse(p.updated_at) : null;
  if (up && updated) up.textContent = `${lyElapsed(Date.now() - updated)} ago`;
}

// ── History ───────────────────────────────────────────────────────────────
function lyRenderHistory() {
  const box = $ui('ly-panel-history');
  if (!box) return;
  const model = LY.model;
  let html = `<h3 class="ly-h3">History</h3>`;
  if (LY.run)
    html += lyBtn('ly-relations', 'Relations from latest result', 'link', {
      cls: 'cm-btn cm-btn-outline',
      extra: 'id="ly-history-relations"',
    });
  html += lyLibrarySourceMarkup();
  if (lyLibraryDrafts.length)
    html += `<h4 class="ly-h4">Saved Lyrics drafts on this device</h4><ul class="ly-hist">${lyLibraryDrafts
      .slice()
      .sort((a, b) => b.savedAt - a.savedAt)
      .map(
        (draft) =>
          `<li><span><strong>${esc(draft.meta?.libraryOrigin?.title || draft.title || 'Untitled song')}</strong><small>${esc(new Date(draft.savedAt).toLocaleString())}${draft.draftId === lyMeta().draftId ? ' · Current draft' : ''}${draft.writer ? ' · Writer continuation preserved' : ''}</small></span>${draft.draftId !== lyMeta().draftId ? lyBtn('ly-library-restore', 'Open draft', 'file', { id: draft.draftId, cls: 'cm-btn cm-btn-outline ly-sm' }) : ''}</li>`
      )
      .join('')}</ul>`;
  const runs = [...(LY.past || [])].reverse();
  if (LY.run) runs.unshift(LY.run);
  html += runs.length
    ? `<ul class="ly-hist">${runs
        .map((r) => {
          const st = lyRunStatus(r, model);
          return `<li><span><strong>${esc(new Date(r.at).toLocaleString())}</strong><small>${esc(st?.word || '')} · ${r.baseId ? `version ${esc(lyShortId(r.resultId || r.baseId))}` : 'declarations unknown'}${r.final ? ` · ${esc(uiCount(r.final.length, 'line'))}` : ''}</small></span>${r === LY.run ? lyBtn('ly-tab', 'View result', '', { id: 'review', cls: 'cm-btn cm-btn-outline ly-sm' }) : ''}</li>`;
        })
        .join('')}</ul>`
    : '<p class="ly-help">No writer results in this tab yet.</p>';
  const archives = (chatState.archives || []).filter(
    (a) => a && (a.domain === 'lyrics' || !a.domain)
  );
  html += `<h4 class="ly-h4">Saved runs</h4>${
    archives.length
      ? `<ul class="ly-hist">${archives
          .slice()
          .reverse()
          .map(
            (a) =>
              `<li><span><strong>${esc((a.message || 'Saved conversation').slice(0, 80))}</strong><small>${a.created_at ? esc(new Date(a.created_at).toLocaleString()) : 'Saved conversation'}</small></span>${lyBtn('ly-retrieve-id', 'Retrieve saved result', '', { id: a.request_id, cls: 'cm-btn cm-btn-outline ly-sm' })}</li>`
          )
          .join('')}</ul>`
      : '<p class="ly-help">No saved lyric runs in this browser. Starting new work keeps the previous run here.</p>'
  }`;
  const got = LY.retrieved;
  if (got)
    html += `<section class="ly-card" aria-labelledby="ly-got-h"><h4 class="ly-h4" id="ly-got-h">Saved result · ${esc(got.state)}</h4>${got.text ? `<pre class="ly-pre">${esc(got.text)}</pre>` : `<p class="ly-help">${esc(got.note || 'No song in this record.')}</p>`}<p class="ly-help">Shown as saved. Nothing was sent, resumed or graded.</p></section>`;
  html += `<h4 class="ly-h4">Draft history</h4><p class="ly-help">Undo and Redo step through every change, including changes applied from this page.</p>`;
  if (model.stamps.length)
    html += `<h4 class="ly-h4">Stamps in the draft</h4><ul class="ly-hist">${model.stamps.map((st) => `<li><span><strong>${esc(st.kind)}${st.exit != null ? ` · exit ${st.exit}` : ''}</strong><small>${esc(st.raw)}</small></span></li>`).join('')}</ul>`;
  lySetHtml(box, html, 'history');
}

// ── Refresh ───────────────────────────────────────────────────────────────
let lyTimer = 0;
function lyRefresh(now = false) {
  if (!now) {
    clearTimeout(lyTimer);
    lyTimer = setTimeout(() => lyRefresh(true), 120);
    return;
  }
  clearTimeout(lyTimer);
  const draft = lyDraft();
  if (!draft) return;
  // This refresh follows the writer's keystrokes: it reads the draft and
  // never rewrites it (the migration runs at a boundary, lyEnsureTokenScheme).
  if (draft.value !== LY.text) {
    const prev = LY.model;
    const next = lyParse(draft.value);
    // A writer's lyrics put in place whole by the shell keep this draft's
    // headers and setup where the line counts match (see lyResultText).
    const run = LY.run;
    if (
      prev &&
      run?.final &&
      !run.restored &&
      draft.value === run.wholeText &&
      next.sung.length &&
      lySame(lySungTexts(next), run.final)
    ) {
      run.restored = true;
      const kept = prev.setup.length || prev.sections.some((sec) => sec.header);
      const restored = lyResultText(prev, run.final, draft.value, run.title) ?? draft.value;
      LY.text = draft.value;
      LY.model = next;
      if (restored !== draft.value) {
        lyCommit(
          restored,
          !kept
            ? 'The writer’s lyrics are in, with the title it declared.'
            : prev.sung.length === run.final.length
              ? 'The writer’s lines are in; your headers and setup lines were kept.'
              : 'The writer’s lyrics are in; your setup lines were kept.'
        );
        return;
      }
    }
    LY.text = draft.value;
    LY.model = next;
    for (const [id, out] of Object.entries(LY.outcomes))
      if (out.state === 'failed') delete LY.outcomes[id];
  }
  if (!LY.model) LY.model = lyParse(draft.value);
  lyLibraryPersist();
  if (LY.activeLine > LY.model.sung.length) LY.activeLine = 0;
  LY.items = lyItems();
  lyRenderHead();
  lyRenderBrief();
  const source = $ui('ly-library-source');
  if (source) {
    source.innerHTML = lyLibrarySourceMarkup();
    source.hidden = !lyMeta().libraryOrigin;
  }
  const download = document.querySelector('[data-ui="ly-download"]');
  if (download)
    download.innerHTML =
      icon('download', 16) +
      '<span>' +
      (lyMeta().libraryOrigin ? 'Download text and sources' : 'Download text') +
      '</span>';
  lyRenderOutline();
  lyRenderMainTool();
  lyRenderEditor();
  lyRenderTabs();
  if (LY.tab === 'tools') lyRenderTools();
  if (LY.tab === 'writer') lyRenderWriter();
  if (LY.tab === 'review') lyRenderReview();
  if (LY.tab === 'history') lyRenderHistory();
  lyRenderHistoryButtons();
  lyFindUpdate();
  lyInspectionRefresh();
  const ui = lyMeta().ui;
  if (ui.tab !== LY.tab || ui.tool !== LY.tool || ui.outline !== LY.outline) {
    Object.assign(ui, { tab: LY.tab, tool: LY.tool, outline: LY.outline });
    lyMetaSaved();
  }
}
function lyRenderHistoryButtons() {
  document.querySelectorAll('[data-ui="ly-undo"]').forEach((button) => {
    button.disabled = app.historyIndex <= 0;
  });
  document.querySelectorAll('[data-ui="ly-redo"]').forEach((button) => {
    button.disabled = app.historyIndex >= app.history.length - 1;
  });
}
function lyShowTab(tab, { focus = false } = {}) {
  LY.tab = tab;
  if (LY.size === 'narrow') LY.mobile = tab === 'history' ? 'writer' : tab;
  lyRefresh(true);
  if (focus) uiFocus($ui(`ly-tab-${tab}`));
}
function lyAnnounce(text) {
  const live = $ui('ly-live');
  if (!live) return;
  live.textContent = '';
  if (text) setTimeout(() => (live.textContent = text), 50);
}
// focus: false moves the caret and the view but leaves focus where it is
// (the section stepper keeps it, so a second Enter is not typed into the song).
function lyScrollToLine(n, { select = true, focus = true } = {}) {
  const model = LY.model;
  const row = model.sung[n - 1];
  if (!row) return;
  if (LY.size === 'narrow' && LY.mobile !== 'song') LY.mobile = 'song';
  if (LY_MAIN_TOOLS.includes(LY.tool) && LY.size !== 'narrow') LY.tool = '';
  lyRefresh(true);
  const draft = lyDraft();
  if (select) {
    const rows = draft.value.split('\n');
    const start = rows.slice(0, row.i).reduce((t, r) => t + r.length + 1, 0);
    const caret = start + rows[row.i].length;
    if (focus) draft.focus({ preventScroll: true });
    draft.setSelectionRange(caret, caret);
    lySyncCaret();
    // A click that took focus off the draft lets the browser put its old
    // selection back after the click returns: place the caret again then.
    if (!focus)
      requestAnimationFrame(() => {
        if (document.activeElement === draft || draft.selectionStart === caret) return;
        if (draft.value.length < caret) return;
        draft.setSelectionRange(caret, caret);
        lySyncCaret();
      });
  }
  $ui('ly-overlay')?.querySelector(`.ly-r[data-n="${n}"]`)?.scrollIntoView?.({ block: 'center' });
}
function lyGotoSection(id, { focus = true } = {}) {
  const s = LY.model.sections[Number(id)];
  if (!s) return;
  LY.railOpen = false;
  if (s.sung.length) lyScrollToLine(s.sung[0].n, { focus });
  else {
    LY.mobile = 'song';
    lyRefresh(true);
    $ui('ly-overlay')
      ?.querySelector(`.ly-r[data-i="${s.headerRow?.i ?? 0}"]`)
      ?.scrollIntoView?.({ block: 'start' });
  }
}

// ── The writer's replies ──────────────────────────────────────────────────
// The shell forwards each reply to uiReceiveReply; this page reads the same
// payload afterwards. Only lyric replies are kept.
let lyRunSeq = 0;
function lyReceive(payload, request) {
  if (!payload || typeof payload !== 'object') return;
  const task = payload.task || chatState.task;
  const isLyric =
    !!payload.artifact ||
    !!payload.lyric ||
    task?.domain === 'lyrics' ||
    (Array.isArray(payload.tools) && payload.tools.some((t) => /^lyric_/.test(t?.name || '')));
  if (!isLyric) return;
  const final =
    lyRunLines(payload.artifact) ||
    (payload.stopped === 'RECOVERY_EXPORTED' && typeof payload.reply === 'string'
      ? lyParse(payload.reply).sung.map((r) => r.text)
      : null);
  const matches = request?.request_id && UI.lyricRequest?.id === request.request_id;
  const tools = Array.isArray(payload.tools) ? payload.tools : [];
  const asked = matches ? lyParse(UI.lyricRequest.text || '') : null;
  const coverageTool = [...tools]
    .reverse()
    .find((t) => t?.coverage && typeof t.coverage === 'object');
  const wholeText =
    typeof payload.artifact?.text === 'string'
      ? payload.artifact.text
      : final
        ? final.join('\n')
        : null;
  const title = lyArtifactTitle(payload.artifact);
  const resultModel = lyResultModel(asked, final, wholeText, title);
  if (LY.run) LY.past = [...(LY.past || []), LY.run].slice(-12);
  LY.run = {
    id: ++lyRunSeq,
    at: Date.now(),
    generation: chatState.generation,
    artifact: payload.artifact || null,
    completion: payload.completion || null,
    lyric: payload.lyric || chatState.lyric || null,
    task: task || null,
    tools,
    coverage: coverageTool?.coverage || payload.lyric?.coverage || null,
    stopped: payload.stopped || null,
    reply:
      typeof payload.reply === 'string' && !payload.artifact ? payload.reply.slice(0, 1200) : null,
    error: payload.error || null,
    recoveryExport: payload.stopped === 'RECOVERY_EXPORTED',
    final,
    wholeText,
    base: asked ? lySungTexts(asked) : null,
    baseSetup: asked ? lySetupKey(asked) : null,
    baseModel: asked,
    baseId: asked ? lyIdentity(asked) : null,
    resultModel,
    resultId: resultModel ? lyIdentity(resultModel) : null,
    title,
  };
  // Options a named request asked for, kept as tool results; nothing is applied.
  const screen = [...tools].reverse().find((t) => Array.isArray(t?.pairs));
  if (screen) LY.results.rhymes = { pairs: screen.pairs, baseId: LY.run.baseId };
  const pron = [...tools].reverse().find((t) => t?.pronunciation_options?.items);
  if (pron)
    LY.results.pronunciation = {
      ...pron.pronunciation_options,
      // Old servers omitted the marker: only a matched request supplies the
      // historical voices mode; an unattached reply cannot establish it.
      numbering:
        pron.pronunciation_options.numbering || (asked ? `v1${asked.voices ? '+voices' : ''}` : ''),
      baseId: LY.run.baseId,
    };
  lyInspectionReceive(LY.run, {
    tools,
    request,
    matches,
    asked,
    resultModel,
    submittedContext: matches ? UI.lyricRequest.submittedContext : null,
  });
  LY.progress = null;
  lyRefresh(true);
}

// What the writer is given as the document. [SETUP] rows stay in the stored
// draft only: the harness reads every whole-line bracket as a section mark
// (lyric_recover → quality/recover.py _sections_from_marks), so a [SETUP] row
// would open a section. Their values travel as exact declarations instead.
function lyWriterText(text) {
  const rows = String(text || '')
    .split('\n')
    .filter((r) => !LY_SETUP.test(r.trim()));
  while (rows.length && !rows[0].trim()) rows.shift();
  return rows.join('\n');
}
const lyDraftForWriter = (text = lyDraft().value) =>
  lyWriterText(text) + lyWriterDeclarations(lyParse(text));

// ── Direct actions: submitLyricsAction ────────────────────────────────────
// One adapter for the named actions (review, edit, rhyme-options,
// pronunciation-options, resume, answer). It uses the shell's own send path
// (_chatSend: request id, persisted receipt, signed continuation, polling),
// never a synthetic click on the conversation form. A waiting, parked or
// unknown-outcome run is never reset behind the person's back: the Writer
// tab offers Resume current work / Start independent work instead.
function lyContext(model, { document = true } = {}) {
  const meta = lyMeta();
  const notes = model.sections
    .filter((s) => (meta.notes[s.title] || '').trim())
    .slice(0, 120)
    .map((s) => ({ section: s.title.slice(0, 80), note: meta.notes[s.title].slice(0, 400) }));
  const decl = lyDeclarationsOf(model);
  return {
    version: 1,
    document: document ? lyWriterText(model.text) : '',
    declarations: document ? decl : {},
    brief: meta.brief.slice(0, 4000),
    notes,
    binding: {
      document_sha256: lyIdentity(model),
      context_sha256: lySha256(JSON.stringify({ brief: meta.brief, notes })),
    },
  };
}
const LY_ACTION_TEXT = {
  review: () =>
    'Review the committed document in the page context against its section headers and exact declarations: recover it, check it, and report every finding, what could not be judged and what input is missing. Do not rewrite anything.',
  'rhyme-options': ({ word, n, relation }) =>
    `Suggest rhyme options for “${word}” (line ${n}) that fit this song, then screen them with lyric_screen together with “${word}”${relation ? ` under the relation ${relation}` : ''}. Report each pair as matched, partial or refused. Do not change the draft and do not declare anything.`,
  'pronunciation-options': ({ word, token, n }) =>
    `Check the committed document in the page context and list the dictionary pronunciation options (pronunciation_options) for “${word}”, word ${token} of line ${n}. Do not choose a reading and do not rewrite anything.`,
  recheck: ({ n, proposal }) =>
    `Check this replacement for line ${n} against the committed document in the page context and its declarations. If it fails, keep the original line and say why.\nReplacement: ${proposal}`,
  'recheck-whole': ({ proposal }) =>
    `Check this proposed whole-draft replacement against the committed document in the page context and its declarations. If it fails, keep the current draft and say why.\nProposed replacement:\n${proposal}`,
  lines: ({ ns }) =>
    `Rewrite ${lyLineRef(ns)} of the committed document in the page context together, so they keep their rhyme link and every other declaration. Change no other line.`,
};
function lyLiveWork() {
  const w = lyWriterState();
  return w.unknown || w.waiting || w.parked;
}
async function lySubmitLyricsAction(kind, args = {}, { force = false } = {}) {
  lyCloseMenus();
  const origin = lyMeta().libraryOrigin;
  if (origin) {
    const eligibility = CMLibraryImport.eligibleForWriter(
      lyDraft().value,
      origin.language || 'eng'
    );
    if (!eligibility.eligible) {
      showToast(eligibility.reasons[0], 'error');
      return false;
    }
  }
  if (chatState.busy) {
    showToast('Writer is working. You can keep editing.', 'error');
    return false;
  }
  lyEnsureTokenScheme();
  const model = (LY.model = lyParse(lyDraft().value));
  const undecided = kind === 'answer' || kind === 'resume' ? '' : lyUndecidedRefusal(model);
  if (undecided) {
    showToast(undecided, 'error');
    lyShowTab('review');
    return false;
  }
  if (kind === 'answer' || kind === 'resume') {
    if (!uiSwitchChat('lyrics')) return false;
    const r = await _chatSend(
      args.message || 'Resume from the saved checkpoint and continue the run.',
      {
        choice: 'lyrics-edit',
      }
    );
    lyRefresh(true);
    return r.ok;
  }
  if (lyLiveWork() && !force) {
    LY.conflict = { kind, args };
    lyShowTab('writer');
    return false;
  }
  if (chatState.pending) {
    showToast('Retrieve the saved result before starting another request.', 'error');
    lyShowTab('writer');
    return false;
  }
  const message = LY_ACTION_TEXT[kind](args);
  // Named actions bypass the composer, but keep its server-pinned message
  // ceiling. Validate before resetting the existing conversation.
  const max = $ui('chat-input')?.maxLength;
  if (max > 0 && message.trim().length > max) {
    showToast(
      `Nothing was sent: this request exceeds the ${max}-character message limit. Use Edit this draft with a shorter instruction.`,
      'error'
    );
    return false;
  }
  if (!uiSwitchChat('lyrics')) {
    showToast('Wait for the active recipe request to finish.', 'error');
    return false;
  }
  LY.conflict = null;
  _chatReset();
  $ui('chat-domain').value = 'lyrics-edit';
  uiUpdatePrompt();
  const context = lyContext(model);
  const previousRun = LY.run;
  const sent = _chatSend(message, { choice: 'lyrics-edit', context });
  // _chatSend records the request synchronously before it awaits the POST.
  const requestId = chatState.pending?.request_id || null;
  if (kind === 'review') LY.analysis = { requestId, baseId: lyIdentity(model), at: Date.now() };
  LY.lastAction = kind;
  LY.tab = kind === 'review' ? 'review' : LY.tab;
  lyRefresh(true);
  const r = await sent;
  if (!r.ok && r.reason) showToast('Nothing was sent.', 'error');
  // Send's ok also covers recovery/errors; only announce an actual new reply.
  if (
    kind === 'recheck-whole' &&
    r.ok &&
    !chatState.pending &&
    LY.run !== previousRun &&
    LY.run?.generation === chatState.generation &&
    !LY.run.error
  )
    showToast('Recheck reply is in Writer.');
  lyRefresh(true);
  return r.ok;
}
// A new conversation the person will type into: the same conflict rule.
async function lyStartConversation(choice, prefill = '', { force = false } = {}) {
  lyCloseMenus();
  if (chatState.busy) {
    showToast('Writer is working. You can keep editing.', 'error');
    return false;
  }
  if (lyLiveWork() && !force) {
    LY.conflict = { kind: 'conversation', args: { choice, prefill } };
    lyShowTab('writer');
    return false;
  }
  // Explicit independent work may set aside a known run, never an unknown outcome.
  if (chatState.pending) {
    showToast('Retrieve the saved result before starting another request.', 'error');
    lyShowTab('writer');
    return false;
  }
  if (!uiSwitchChat('lyrics')) {
    showToast('Wait for the active recipe request to finish.', 'error');
    return false;
  }
  LY.conflict = null;
  _chatReset();
  lyShowTab('writer');
  uiChatOpen();
  // Opening the shared dock selects the lyrics domain; retain the requested phase.
  $ui('chat-domain').value = choice;
  uiUpdatePrompt();
  $ui('chat-input').value = prefill;
  _chatSyncCount();
  $ui('chat-input')?.focus();
  return true;
}
// The page context every new lyrics task typed in the conversation carries:
// the committed document for an edit, the brief and notes for a new song.
if (typeof window !== 'undefined')
  window.uiLyricContext = (choice) => {
    if (!LY.model) return null;
    lyEnsureTokenScheme();
    const model = lyParse(lyDraft().value);
    // The draft goes with an edit; a saved reading still undecided stops it.
    const undecided = choice === 'lyrics-edit' ? lyUndecidedRefusal(model) : '';
    if (undecided) return { blocked: undecided };
    return lyContext(model, { document: choice === 'lyrics-edit' });
  };
let lyRetrieveGeneration = 0;
async function lyRetrieve(id) {
  if (!/^[a-f0-9]{64}$/.test(id || ''))
    return showToast('This saved run has no retrievable record.', 'error');
  const generation = ++lyRetrieveGeneration;
  lyShowTab('history');
  try {
    const res = await fetch(`${CHAT_BACKEND}/chat/jobs/${id}`, { cache: 'no-store' });
    const record = await res.json();
    if (generation !== lyRetrieveGeneration) return;
    if (!res.ok) throw Error(record.error || 'The saved result could not be read.');
    const body = record.response?.body;
    const text =
      typeof body?.artifact?.text === 'string'
        ? body.artifact.text
        : Array.isArray(body?.artifact?.final_draft)
          ? body.artifact.final_draft.join('\n')
          : typeof body?.reply === 'string'
            ? body.reply
            : '';
    LY.retrieved = {
      id,
      state: record.state || 'unknown',
      text: text.slice(0, 20000),
      note: record.error || '',
    };
  } catch (err) {
    if (generation !== lyRetrieveGeneration) return;
    LY.retrieved = { id, state: 'unavailable', text: '', note: err.message };
  }
  if (LY.tab === 'history') lyRenderHistory();
}

// ── Menus ─────────────────────────────────────────────────────────────────
function lyCloseMenus(except = '') {
  document.querySelectorAll('#surface-lyrics .ly-menu').forEach((m) => {
    if (m.id === 'ly-menu-' + except) return;
    m.hidden = true;
    document
      .querySelector(`#surface-lyrics [aria-controls="${m.id}"]`)
      ?.setAttribute('aria-expanded', 'false');
  });
  if (!except) LY.menu = '';
}
function lyPositionLineMenu(menu, button) {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0;
  const top =
    Math.max(
      viewport?.offsetTop || 0,
      document.querySelector('.app-bar')?.getBoundingClientRect().bottom || 0
    ) + 8;
  let width = Math.min(360, (viewport?.width || innerWidth) - 24);
  const dock = $ui('ly-linedock').getBoundingClientRect();
  const bottom = Math.min(
    (viewport?.offsetTop || 0) + (viewport?.height || innerHeight) - 8,
    dock.top - 4
  );
  const target = lyViewportCaretRow()?.getBoundingClientRect();
  menu.classList.add('ly-line-menu-positioned');
  menu.style.width = `${width}px`;
  menu.style.left = `${Math.max(left + 12, Math.min(button.getBoundingClientRect().right - width, left + (viewport?.width || innerWidth) - width - 12))}px`;
  menu.style.maxHeight = 'none';
  menu.querySelector('.ly-line-menu-note')?.remove();
  const height = menu.getBoundingClientRect().height;
  const above = target ? Math.max(0, Math.min(bottom, target.top - 8) - top) : bottom - top;
  const belowTop = target ? Math.max(top, target.bottom + 8) : top;
  const below = Math.max(0, bottom - belowTop);
  let available = Math.max(above, below);
  let y = above >= height || above >= below ? top + above - Math.min(height, above) : belowTop;
  // If the target leaves no usable action area, explain the temporary cover.
  // The opener stays outside this scrollable menu and Escape still closes it.
  if (available < 88) {
    available = Math.max(0, bottom - top);
    y = top;
    // Landscape can fit the existing actions and notice without shrinking targets.
    width = Math.min(560, (viewport?.width || innerWidth) - 24);
    menu.style.width = `${width}px`;
    menu.style.left = `${Math.max(left + 12, Math.min(button.getBoundingClientRect().right - width, left + (viewport?.width || innerWidth) - width - 12))}px`;
    menu.insertAdjacentHTML(
      'afterbegin',
      '<p class="ly-line-menu-note ly-help" role="status">Short view: close Line actions or press Escape to uncover the line.</p>'
    );
  }
  menu.style.top = `${Math.max(top, y)}px`;
  menu.style.maxHeight = `${available}px`;
}
function lyPositionSongMenu(menu, button) {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0;
  const top =
    Math.max(
      viewport?.offsetTop || 0,
      document.querySelector('.app-bar')?.getBoundingClientRect().bottom || 0
    ) + 8;
  const nav = $ui('ly-mnav')?.getBoundingClientRect();
  const bottom = Math.min(
    (viewport?.offsetTop || 0) + (viewport?.height || innerHeight) - 8,
    nav?.height ? nav.top - 8 : Infinity
  );
  const width = Math.min(320, (viewport?.width || innerWidth) - 24);
  const opener = button.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.bottom = 'auto';
  menu.style.right = 'auto';
  menu.style.width = `${width}px`;
  menu.style.left = `${Math.max(left + 12, Math.min(opener.right - width, left + (viewport?.width || innerWidth) - width - 12))}px`;
  menu.style.maxHeight = `${Math.max(0, bottom - top)}px`;
  menu.style.overflowY = 'auto';
  const height = menu.getBoundingClientRect().height;
  menu.style.top = `${Math.max(top, Math.min(opener.bottom + 4, bottom - height))}px`;
}
function lyToggleMenu(id, button) {
  const menu = $ui('ly-menu-' + id);
  if (!menu) return;
  const open = menu.hidden;
  lyCloseMenus(open ? id : '');
  menu.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  LY.menu = open ? id : '';
  if (open) {
    LY.menuOpener = button;
    if (id === 'line-actions') lyPositionLineMenu(menu, button);
    else if (id === 'song-actions') lyPositionSongMenu(menu, button);
    menu.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
  }
}
function lySyncDisplayMenu() {
  document
    .querySelectorAll('[data-ui="ly-text-size"]')
    .forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.id === String(LY.prefs.size.get())))
    );
  document
    .querySelector('[data-ui="ly-numbers"]')
    ?.setAttribute('aria-pressed', String(!!LY.prefs.numbers.get()));
}

// ── Actions ───────────────────────────────────────────────────────────────
const lyItem = (id) => (LY.items || []).find((i) => i.id === id);
// Every reading row names the cut its number was read under (see
// lyEnsureTokenScheme), so the text alone says how to read it.
const lyReadingValue = ({ token, word, line, kind, phones, basis, source, numbering }) =>
  `token ${token} ${lyQuote(word)} in ${lyQuote(line)}${LY_DASH}${kind === 'declared' ? `${phones.join(' ')}${LY_DASH}${basis}${LY_DASH}source: ${source.replace(/[\]\n—]/g, ' ')}` : kind === 'uncertain' ? 'uncertain' : 'needs a choice'}${numbering ? `${LY_DASH}numbering ${numbering}` : ''}${LY_DASH}${LY_READING_CUT}`;
function lyValidPhones(phones) {
  if (!phones.length || phones.length > 128) return 'Enter at least one ARPABET phone.';
  const bad = phones.find(
    (p) =>
      !(
        LY_ARPABET_CONSONANTS.includes(p) ||
        (p.length > 1 && '012'.includes(p.slice(-1)) && LY_ARPABET_VOWELS.includes(p.slice(0, -1)))
      )
  );
  if (bad)
    return `“${bad}” is not an ARPABET phone. Vowels carry a stress digit (EH1); consonants carry none (K).`;
  if (!phones.some((p) => LY_ARPABET_VOWELS.includes(p.slice(0, -1))))
    return 'A reading needs at least one vowel (a syllable nucleus).';
  return '';
}
function lyInsertSection(name) {
  const model = lyParse(lyDraft().value);
  const after = lySectionOfLine(model, LY.activeLine) || lySectionAtRow(model, LY.caretRow);
  const parts = lyBlocks(model);
  const block = [{ raw: `[${name}]` }];
  if (after) parts.blocks.splice(after.index + 1, 0, block);
  else parts.blocks.push(block);
  const { text } = lyAssemble(parts);
  lyCommit(text, `Added ${lyCap(name)}. Write its lines under its header.`);
  return after ? after.index + 1 : lyParse(text).sections.length - 1;
}
function lyCommitTitle(value) {
  const v = Array.from(
    String(value)
      .replace(/[\]\n\r]/g, ' ')
      .trim()
  )
    .slice(0, 160)
    .join('');
  LY.titleEdit = false;
  if (v === lyTitleOf(LY.model)) return lyRefresh(true);
  lySetupCommit(
    'title',
    v ? [v] : [],
    v ? 'Title saved.' : 'Title removed. The song reads Untitled song.'
  );
}
function lyToolOpen(id) {
  const wasMain = LY_MAIN_TOOLS.includes(LY.tool);
  LY.tool = id;
  LY.tab = 'tools';
  if (LY.size === 'narrow') LY.mobile = 'tools';
  lyRefresh(true);
  // A form that replaces the document starts at its top; leaving it returns
  // to the document where the caret is.
  if (LY.size !== 'narrow' && (LY_MAIN_TOOLS.includes(id) || wasMain)) {
    $ui('ly-main-scroll').scrollTop = 0;
    if (!LY_MAIN_TOOLS.includes(id) && LY.activeLine)
      $ui('ly-overlay')
        ?.querySelector(`.ly-r[data-n="${LY.activeLine}"]`)
        ?.scrollIntoView?.({ block: 'center' });
  }
}
function lyDraftList(tool, key) {
  const c = LY_FORMS[tool].committed(LY.model)[key] || [];
  return [...(lyVal(tool, 'song', key, c) || [])];
}
const LY_ACTIONS = {
  'ly-relations'(id, button) {
    return lyInspectionAction('ly-relations', id, button);
  },
  'ly-relation-source'(id, button) {
    return lyInspectionAction('ly-relation-source', id, button);
  },
  'ly-relation-go'(id, button) {
    return lyInspectionAction('ly-relation-go', id, button);
  },
  'ly-relation-expand'(id, button) {
    return lyInspectionAction('ly-relation-expand', id, button);
  },
  'ly-relation-close'(id, button) {
    return lyInspectionAction('ly-relation-close', id, button);
  },
  'ly-relation-reopen'(id, button) {
    return lyInspectionAction('ly-relation-reopen', id, button);
  },
  'ly-relation-return'(id, button) {
    return lyInspectionAction('ly-relation-return', id, button);
  },
  'ly-relation-stay'(id, button) {
    return lyInspectionAction('ly-relation-stay', id, button);
  },
  'ly-relation-back'(id, button) {
    return lyInspectionAction('ly-relation-back', id, button);
  },

  'view-running'() {
    uiNavigate('genre');
    document.body.classList.add('assistant-open');
  },
  'new-lyrics'() {
    return lyStartConversation('lyrics');
  },
  'edit-lyrics'() {
    return lyStartConversation('lyrics-edit', 'Edit this draft: ');
  },
  'attach-recipe'() {
    return lyStartConversation(
      'lyrics',
      'Write lyrics for this recording recipe:\n' +
        compileRecipeStack(app.cards, 'rich', { ceiling: 1000 })
    );
  },
  'copy-lyrics'() {
    lyCloseMenus();
    lyCopy(lyDraft().value, 'Copied with headers');
  },
  'ly-copy-sung'() {
    lyCloseMenus();
    lyCopy(lySungTexts(LY.model).join('\n'), 'Sung lines copied');
  },
  'ly-copy-close'() {
    $ui('ly-doc-note').hidden = true;
    $ui('ly-doc-note').innerHTML = '';
  },
  async 'ly-download'() {
    lyCloseMenus();
    const name =
      (
        lyTitleOf(LY.model) ||
        (app.workspaceName !== 'Untitled session' && app.workspaceName) ||
        'lyrics'
      )
        .replace(/[^\w\- ]+/g, '')
        .trim() || 'lyrics';
    if (lyMeta().libraryOrigin) {
      try {
        const envelope = await CMLibraryImport.makeWorkingCopyEnvelope(lyDraft().value, lyMeta());
        uiDownload(
          name + '.library-working-copy.json',
          JSON.stringify(envelope, null, 2),
          'application/json'
        );
        showToast('Text and mandatory source details downloaded together.', 'success');
      } catch (error) {
        showToast('Download failed: ' + error.message, 'error');
      }
    } else {
      uiDownload(name + '.txt', lyDraft().value, 'text/plain;charset=utf-8');
      showToast('Text download started', 'success');
    }
  },
  'ly-export-session'() {
    lyCloseMenus();
    uiExport();
  },
  'ly-import'() {
    lyCloseMenus();
    $ui('ly-file').click();
  },
  'ly-library-provenance'() {
    uiDownload(
      'codex-musica-library-source.json',
      JSON.stringify(
        { version: 1, draftId: lyMeta().draftId, libraryOrigin: lyMeta().libraryOrigin },
        null,
        2
      ),
      'application/json'
    );
  },
  async 'ly-library-restore'(draftId) {
    let owner;
    try {
      owner = lyLibraryAcquire();
      const record = await lyLibraryStore.getDraft(draftId);
      if (!record) throw new Error('That saved draft is unavailable.');
      const previous = lyLibraryCapture();
      await lyLibraryStore.saveDraft(previous);
      await lyLibraryActivate(record, { restored: true, preservedDraftId: previous.draftId });
    } catch (error) {
      showToast('Draft could not be opened: ' + error.message, 'error');
    } finally {
      lyLibraryRelease(owner);
    }
  },
  'ly-blank'() {
    lyCloseMenus();
    if (!lyDraft().value) return showToast('The draft is already blank', 'success');
    lyCommit('', 'Started a blank draft. Undo restores the previous one.');
  },
  'ly-menu'(id, b) {
    lyToggleMenu(id, b);
    if (id === 'display') lySyncDisplayMenu();
  },
  'ly-tab'(id) {
    lyCloseMenus();
    lyShowTab(id, { focus: true });
  },
  'ly-mobile'(id) {
    if (LY.mobile === 'song') {
      const d = lyDraft();
      LY.songCaret = [d.selectionStart, d.selectionEnd, $ui('ly-main-scroll').scrollTop];
      LY.songCaretMapped = false;
    }
    LY.mobile = id;
    if (id !== 'song') LY.tab = id;
    lyRefresh(true);
    if (id === 'song' && LY.songCaret) {
      const draft = lyDraft();
      draft.setSelectionRange(LY.songCaret[0], LY.songCaret[1]);
      $ui('ly-main-scroll').scrollTop = LY.songCaret[2];
    }
    const tab = $ui(`ly-mtab-${id}`);
    uiFocus(tab);
    if (id === 'song' && LY.songCaretMapped) {
      // Showing the textarea can make the browser clear its selection after
      // this click returns. Reapply only this migration's cached offsets once
      // that native update has finished, without overriding a new user focus.
      const caret = LY.songCaret,
        text = lyDraft().value;
      LY.songCaretMapped = false;
      requestAnimationFrame(() => {
        if (
          LY.mobile === 'song' &&
          LY.songCaret === caret &&
          document.activeElement === tab &&
          lyDraft().value === text
        )
          lyDraft().setSelectionRange(caret[0], caret[1]);
      });
    }
  },
  'ly-run-review'(_id, button) {
    lyCloseMenus();
    if (lyPendingAll()) {
      LY.gateOpener = button;
      LY.gate = true;
      lyRefresh(true);
      $ui('ly-gate')?.scrollIntoView({ block: 'center' });
      uiFocus(document.querySelector('[data-ui="ly-gate-apply"]'));
      return;
    }
    return lySubmitLyricsAction('review');
  },
  'ly-gate-apply'() {
    const tools = LY_TOOLS.flatMap(([id]) => lyDraftTools(id));
    if (lyDraftApplyTools(tools, { stopOnFailure: true }).failed) return;
    LY.gate = null;
    return lySubmitLyricsAction('review');
  },
  'ly-gate-saved'() {
    LY.gate = null;
    return lySubmitLyricsAction('review');
  },
  'ly-gate-close'() {
    LY.gate = null;
    lyRefresh(true);
    const visible = (el) => el?.isConnected && el.getClientRects().length;
    // The panel is rebuilt by refresh; the header opener survives it. Mouse
    // review deliberately preserves editor focus, so remember the clicked button.
    const opener = visible(LY.gateOpener)
      ? LY.gateOpener
      : [
          document.querySelector('#ly-panel-review [data-ui="ly-run-review"]'),
          ...document.querySelectorAll('[data-ui="ly-run-review"]'),
        ].find(visible);
    LY.gateOpener = null;
    opener?.scrollIntoView({ block: 'center' });
    uiFocus(opener);
  },
  'ly-title-edit'() {
    LY.titleEdit = true;
    lyRenderHead();
    const input = $ui('ly-title-input');
    input?.focus();
    input?.select();
  },
  'ly-brief-edit'() {
    LY.briefEdit = true;
    if (LY.size === 'narrow') LY.mobile = 'song';
    lyRefresh(true);
    $ui('ly-brief-text')?.focus();
  },
  'ly-brief-cancel'() {
    LY.briefEdit = false;
    lyRefresh(true);
    uiFocus(document.querySelector('[data-ui="ly-brief-edit"]'));
  },
  'ly-brief-save'() {
    const brief = $ui('ly-brief-text').value.slice(0, 4000);
    const n = Number($ui('ly-hook-in').value);
    const text = LY.model.sung[n - 1]?.text || '';
    if (text.includes(']'))
      return showToast('This line contains “]”, which a setup line cannot hold.', 'error');
    const meta = lyMeta();
    meta.brief = brief;
    LY.briefEdit = false;
    const next = lySetSetup('hook', text ? [lyQuote(text)] : []);
    if (next !== lyDraft().value) lyCommit(next, 'Brief saved.');
    else {
      pushHistory();
      uiAutosave();
      showToast('Brief saved.', 'success');
      lyRefresh(true);
    }
    uiFocus(document.querySelector('[data-ui="ly-brief-edit"]'));
  },
  'ly-outline-toggle'() {
    if (LY.size === 'wide' && !LY.railOpen) LY.outline = !LY.outline;
    else LY.railOpen = !LY.railOpen;
    lyRefresh(true);
    UILayout.refresh?.();
    if (LY.railOpen || (LY.size === 'wide' && LY.outline))
      uiFocus(
        document.querySelector('#ly-sections .ly-sec') ||
          document.querySelector('.ly-outline-close')
      );
    else uiFocus(lySectionsOpener());
  },
  'ly-goto'(id) {
    lyGotoSection(id);
  },
  'ly-sec-step'(id) {
    const model = LY.model;
    const cur =
      lySectionOfLine(model, LY.activeLine) ||
      lySectionAtRow(model, LY.caretRow) ||
      model.sections[0];
    const k = Math.max(0, Math.min(model.sections.length - 1, (cur?.index ?? 0) + Number(id)));
    lyGotoSection(k, { focus: false });
    // The stepper was re-rendered: focus its replacement (or, at the first or
    // last section, the position button) and say where the song now is.
    const nav = $ui('ly-section-nav');
    uiFocus(
      nav?.querySelector(`[data-ui="ly-sec-step"][data-id="${id}"]:not(:disabled)`) ||
        nav?.querySelector('.ly-sec-pos')
    );
    lyAnnounce(`${model.sections[k].title}, ${k + 1} of ${model.sections.length}`);
  },
  'ly-add-section'(name) {
    lyCloseMenus();
    const k = lyInsertSection(name ? name.toUpperCase() : 'SECTION');
    if (name) return;
    LY.picks.formSec = k;
    lyToolOpen('form-story');
    const input = $ui('ly-f-name');
    input?.focus();
    input?.select();
  },
  'ly-sec-move'(id) {
    const [k, d] = id.split(':').map(Number);
    lyEditSections(
      ({ blocks }) => {
        const j = k + d;
        if (j < 0 || j >= blocks.length) return false;
        [blocks[k], blocks[j]] = [blocks[j], blocks[k]];
      },
      `Moved section ${d < 0 ? 'up' : 'down'}.`
    );
    if (LY.picks.formSec === k) LY.picks.formSec = k + d;
  },
  'ly-sec-dup'(id) {
    const k = Number(id);
    lyEditSections(({ blocks }) => {
      blocks.splice(
        k + 1,
        0,
        blocks[k].map((r) => ({ raw: r.raw, n: r.n }))
      );
    }, 'Duplicated the section after the original.');
  },
  'ly-sec-remove'(id) {
    const k = Number(id);
    const title = LY.model.sections[k]?.title || 'section';
    lyEditSections(({ blocks }) => {
      blocks.splice(k, 1);
    }, `Removed ${title}. Undo restores it.`);
  },
  'ly-label-stanzas'() {
    lyEditSections(({ blocks }) => {
      blocks.forEach((b, k) => b.unshift({ raw: `[Stanza ${k + 1}]` }));
    }, 'Each stanza now has a header. Rename them in Form & story.');
  },
  'ly-form-pick'(id) {
    LY.picks.formSec = Number(id);
    lyRefresh(true);
    uiFocus(document.querySelector(`[data-ui="ly-form-pick"][data-id="${id}"]`));
  },
  'ly-tool'(id) {
    lyCloseMenus();
    if (LY.size === 'narrow' && id && id === LY.tool) id = '';
    lyToolOpen(id);
    if (!id) uiFocus(document.querySelector('.ly-toolrow'));
    else if (LY.size !== 'narrow')
      uiFocus(document.querySelector('.ly-tool-nav [data-ui="ly-tool"]'));
  },
  'ly-line-tool'(id) {
    const [tool, n] = [id.split(':')[0], Number(id.split(':')[1])];
    const model = LY.model;
    if (tool === 'rhymes') LY.picks.linkLine = n;
    if (tool === 'rhythm') LY.picks.rhythmSec = lySectionOfLine(model, n)?.index;
    if (tool === 'pronunciation') {
      LY.picks.readingLine = n;
      const toks = lyTokens(model.sung[n - 1]?.text || '', model.voices);
      LY.picks.reading = toks.length
        ? lyReadingKey(model.sung[n - 1].text, toks.length, toks[toks.length - 1])
        : null;
    }
    lyToolOpen(tool);
  },
  'ly-draft-apply'(tool) {
    const { applied } = lyDraftApplyTools(lyDraftTools(tool));
    if (applied && tool === 'rhymes') LY.picks.linkGroup = -1;
  },
  'ly-draft-discard'(tool) {
    for (const t of tool === 'rhythm' ? ['rhythm', 'placement', 'melody'] : [tool])
      lyDraftDiscard(t);
    lyRefresh(true);
    showToast('Pending changes discarded.', 'success');
  },
  'ly-draft-rebase'(tool) {
    for (const t of tool === 'rhythm' ? ['rhythm', 'placement', 'melody'] : [tool])
      for (const d of lyDrafts(t)) if (lyDraftStale(d)) lyDraftRebase(t, d.target);
    lyRefresh(true);
  },
  'ly-rhythm-pick'(id) {
    LY.picks.rhythmSec = Number(id);
    LY.picks.rhythmCopy = false;
    lyRefresh(true);
    uiFocus(document.querySelector(`[data-ui="ly-rhythm-pick"][data-id="${id}"]`));
  },
  'ly-rhythm-save'(id) {
    const k = String(id);
    if (!lyDraftOf('rhythm', k))
      return showToast('Nothing to save: the rhythm form matches the section.', 'success');
    const before = lyDraftOf('rhythm', k);
    const meter = before.values.meter ?? LY_FORMS.rhythm.committed(LY.model, k).meter;
    const bars = before.values.bars ?? LY_FORMS.rhythm.committed(LY.model, k).bars;
    if (lyDraftApply('rhythm', k))
      LY.picks.rhythmSaved = {
        k: Number(k),
        text: `${meter || 'No meter'} saved · ${bars ? uiCount(Number(bars), 'bar') : 'bars not set'}`,
      };
    lyRefresh(true);
  },
  'ly-rhythm-copy'() {
    LY.picks.rhythmCopy = !LY.picks.rhythmCopy;
    lyRefresh(true);
  },
  'ly-rhythm-copy-apply'() {
    const k = lyRhythmSec(LY.model);
    const src = LY.model.sections[k]?.header || {};
    const targets = [...document.querySelectorAll('#surface-lyrics [data-copy]:checked')].map((c) =>
      Number(c.dataset.copy)
    );
    if (!targets.length) return showToast('Choose at least one section.', 'error');
    let text = lyDraft().value;
    for (const t of targets)
      text = lyHeaderIn(text, t, (h) => {
        h.meter = src.meter || null;
        h.bars = src.bars ?? null;
        h.pickup = src.pickup || null;
      });
    LY.picks.rhythmCopy = false;
    lyCommit(text, `Copied meter, bars and pickup to ${uiCount(targets.length, 'section')}.`);
  },
  'ly-relation'(id) {
    lyDraftSet('rhymes', 'song', 'relation', id);
    lyRefresh(true);
  },
  'ly-link-add'() {
    const line = Number($ui('ly-link-line')?.value) || LY.activeLine;
    const place = $ui('ly-link-place')?.value || 'end';
    if (!line) return;
    const members = lyDraftList('rhymes', 'members');
    if (members.some((m) => m.line === line && m.place === place))
      return showToast('That member is already selected.', 'error');
    members.push({ line, place });
    lyDraftSet('rhymes', 'song', 'members', members);
    lyRefresh(true);
    uiFocus(document.querySelector('[data-ui="ly-link-add"]'));
  },
  'ly-member-remove'(i) {
    const members = lyDraftList('rhymes', 'members');
    members.splice(Number(i), 1);
    lyDraftSet('rhymes', 'song', 'members', members);
    lyRefresh(true);
  },
  'ly-link-remove'() {
    // The policy pass respells members in place and never adds or removes
    // one, so the picked index names the same link.
    const base = lyFormBase('rhyme groups');
    const groups = base.groups;
    const k = LY.picks.linkGroup;
    if (!groups[k]) return;
    groups.splice(k, 1);
    LY.picks.linkGroup = -1;
    lySetupCommit(
      'rhyme groups',
      groups.length ? [lyGroupsText(groups)] : [],
      lyFormMigrated(base.done, 'Rhyme link removed. Undo restores it.'),
      base.text
    );
  },
  'ly-rhyme-options'() {
    const model = LY.model;
    const members = lyDraftList('rhymes', 'members');
    const m = members[0] || (LY.activeLine ? { line: LY.activeLine, place: 'end' } : null);
    const word = m && lyMemberWord(model, m);
    if (!word) return showToast('Select a line in the document first.', 'error');
    return lySubmitLyricsAction('rhyme-options', {
      word,
      n: m.line,
      relation: lySetupOf(model, 'relation')[0]?.value || '',
    });
  },
  'ly-reading-pick'(id) {
    LY.picks.reading = id;
    const [line] = lyReadingTarget(id);
    LY.picks.readingLine = LY.model.sung.find((r) => r.text === line)?.n || LY.picks.readingLine;
    lyRefresh(true);
  },
  'ly-reading-use'(i) {
    const key = LY.picks.reading;
    if (!key) return;
    const [line, token, word] = lyReadingTarget(key);
    const opts = (LY.results.pronunciation?.items || [])
      .filter(
        (o) =>
          o.line === line &&
          o.word === word &&
          lyNumberingTarget(
            line,
            o.token,
            word,
            o.numbering || LY.results.pronunciation.numbering,
            LY.model.voices
          ) === token
      )
      .flatMap((o) =>
        o.dictionary_readings.map((r) => ({
          ...r,
          numberingToken: o.token,
          numbering: o.numbering || LY.results.pronunciation.numbering,
        }))
      );
    const r = opts[Number(i)];
    if (!r) return;
    lyDraftSet('pronunciation', key, 'numbering', r.numbering);
    lyDraftSet('pronunciation', key, 'numberingToken', r.numberingToken);
    lyDraftSet('pronunciation', key, 'kind', 'dictionary');
    lyDraftSet('pronunciation', key, 'phones', r.phones.join(' '));
    lyDraftSet('pronunciation', key, 'source', 'CMUdict (dictionary option)');
    lyDraftApply('pronunciation', key);
  },
  'ly-reading-kind'(id) {
    const key = LY.picks.reading;
    if (!key) return;
    lyDraftSet('pronunciation', key, 'kind', id);
    if (id === 'uncertain') return lyDraftApply('pronunciation', key);
    lyRefresh(true);
    $ui('ly-phones')?.focus();
  },
  'ly-pron-options'() {
    const key = LY.picks.reading;
    if (!key) return showToast('Choose a word first.', 'error');
    const [line, token, word] = lyReadingTarget(key);
    const n = LY.model.sung.find((r) => r.text === line)?.n;
    if (!n) return showToast('Text changed · choose again', 'error');
    return lySubmitLyricsAction('pronunciation-options', { word, token, n });
  },
  'ly-voices'(id) {
    lyDraftSet('repeats-voices', 'song', 'voices', id);
    lyRefresh(true);
  },
  'ly-placed-add'() {
    const line = LY.activeLine || LY.model.sung[0]?.n;
    const place = $ui('ly-placed-place')?.value || 'head';
    if (!line) return;
    const list = lyDraftList('repeats-voices', 'placed');
    if (!list.some((m) => m.line === line && m.place === place)) list.push({ line, place });
    lyDraftSet('repeats-voices', 'song', 'placed', list);
    lyRefresh(true);
  },
  'ly-placed-remove'(i) {
    const list = lyDraftList('repeats-voices', 'placed');
    list.splice(Number(i), 1);
    lyDraftSet('repeats-voices', 'song', 'placed', list);
    lyRefresh(true);
  },
  'ly-view-both'(id) {
    const [a, b] = id.split(':').map(Number);
    const model = LY.model;
    LY.focusLines = [...model.sections[a].sung, ...model.sections[b].sung].map((r) => r.n);
    lyRenderEditor();
    $ui('ly-overlay')
      ?.querySelector(`.ly-r[data-n="${model.sections[a].sung[0].n}"]`)
      ?.scrollIntoView?.({ block: 'start' });
  },
  'ly-declare-repeat'(id) {
    const [a, b] = id.split(':').map(Number);
    const model = LY.model;
    const A = model.sections[a],
      B = model.sections[b];
    if (!A || !B || A.sung.length !== B.sung.length) return;
    const base = lyFormBase('returns');
    const groups = base.groups;
    const have = new Set(groups.map((g) => lyGroupsText([g])));
    A.sung.forEach((r, j) => {
      const g = [
        { line: r.n, place: 'end' },
        { line: B.sung[j].n, place: 'end' },
      ];
      if (!have.has(lyGroupsText([g]))) groups.push(g);
    });
    lySetupCommit(
      'returns',
      [lyGroupsText(groups)],
      lyFormMigrated(base.done, `${B.title} is declared an exact repeat of ${A.title}.`),
      base.text
    );
  },
  'ly-returns-clear'() {
    lySetupCommit('returns', [], 'Declared returns cleared. The lyrics are unchanged.');
  },
  'ly-word-add'(key) {
    const input = $ui(`ly-${key}-new`);
    const v = input.value.replace(/[\]\n]/g, ' ').trim();
    if (!v) return input.focus();
    const list = lyDraftList('word-rules', key);
    list.push(v);
    lyDraftSet('word-rules', 'song', key, list);
    lyRefresh(true);
    $ui(`ly-${key}-new`)?.focus();
  },
  'ly-word-remove'(id) {
    const [key, i] = id.split(':');
    const list = lyDraftList('word-rules', key);
    list.splice(Number(i), 1);
    lyDraftSet('word-rules', 'song', key, list);
    lyRefresh(true);
  },
  'ly-story-off'() {
    lySetupCommit('narrative', ['off'], 'The story layer is declared off.');
  },
  'ly-story-clear'() {
    lySetupCommit('narrative', [], 'Story plan no longer declared.');
  },
  'ly-fix-count'(id) {
    lyRewriteHeader(Number(id), (h, s) => (h.lines = s.sung.length), 'Header updated.');
  },
  'ly-make-return'(id) {
    const [k, first] = id.split(':').map(Number);
    lyEditSections(({ blocks }) => {
      const src = blocks[first],
        dst = blocks[k];
      if (!src || !dst) return false;
      const header = dst[0] && LY_BRACKET.test(dst[0].raw.trim()) ? [dst[0]] : [];
      const body = src
        .filter((r, i) => !(i === 0 && LY_BRACKET.test(r.raw.trim())))
        .map((r) => ({ raw: r.raw }));
      blocks[k] = [...header, ...body];
    }, 'The section now returns word for word.');
  },
  // Every link of `key` holding a word place that binds no word: one kept
  // under its earlier number, or one marked with a cut this page does not
  // read. The message says which, never when the row was written: an
  // unmarked row is legacy by compatibility policy, whatever its age.
  // `key|<group text>` (a Review card's own group) removes that one group;
  // a bare key removes every such group of the key, and says how many.
  'ly-drop-undecided'(arg) {
    const [key, only] = String(arg).split(/\|(.*)/s);
    if (!LY_GROUP_KEYS.includes(key)) return;
    const base = lyFormBase(key);
    const all = base.groups;
    let pick = -1;
    if (only !== undefined) {
      pick = all.findIndex((g) => g.some((m) => m.undecided) && lyGroupsText([g]) === only);
      if (pick < 0) return;
    }
    const drop = (g, k) => (pick < 0 ? g.some((m) => m.undecided) : k === pick);
    const groups = all.filter((g, k) => !drop(g, k));
    const gone = all.filter((g, k) => drop(g, k));
    const alien = [
      ...new Set(gone.flatMap((g) => g.filter((m) => m.unknownCut).map((m) => m.unknownCut))),
    ];
    const why = [
      ...(gone.some((g) =>
        g.some((m) => m.undecided && !m.unknownCut && m.undecidedReason === 'voices')
      )
        ? [
            'a number saved with no setting for sung parenthesized words, which names different words under each',
          ]
        : []),
      ...(gone.some((g) =>
        g.some((m) => m.undecided && !m.unknownCut && m.undecidedReason === 'setting')
      )
        ? [
            'a number counted under another setting for sung parenthesized words that names no word now',
          ]
        : []),
      ...(gone.some((g) =>
        g.some(
          (m) =>
            m.undecided &&
            !m.unknownCut &&
            m.undecidedReason !== 'voices' &&
            m.undecidedReason !== 'setting'
        )
      )
        ? [
            'a number read under the earlier word cut (as every row without the cut mark is, by compatibility policy) that names no word of the current text',
          ]
        : []),
      ...(alien.length
        ? [`a mark for a word cut this page does not read (cut ${alien.join(', cut ')})`]
        : []),
    ];
    const noun = key === 'returns' ? 'declared return' : 'rhyme link';
    lySetupCommit(
      key,
      groups.length ? [lyGroupsText(groups)] : [],
      lyFormMigrated(
        base.done,
        `Removed ${uiCount(gone.length, noun)} whose word place binds no word: ${why.join('; and ')}. Undo restores ${gone.length === 1 ? 'it' : 'them'}.`
      ),
      base.text
    );
  },
  // The renumbering card is a record for the writer: dismissing it changes
  // nothing in the song.
  // Dismissing is recorded in the current history step (pushHistory merges
  // a step whose text did not change), so Undo/Redo of a LATER step never
  // brings the dismissed card back; Undo past this step restores that
  // step's own record, as it was.
  'ly-renumbered-dismiss'() {
    delete lyMeta().renumbered;
    LY.renumberedAll = false;
    uiSaveLyrics();
    pushHistory();
    lyMetaSaved();
    lyRefresh(true);
  },
  'ly-renumbered-all'() {
    LY.renumberedAll = !LY.renumberedAll;
    lyRefresh(true);
  },
  // A named place carried across the word-cut change: the writer keeps the
  // link as declared, or removes that member (a link left with one member is
  // removed whole). One Undo step either way.
  'ly-carried-keep'(id) {
    lyCarriedDecide(id, true);
  },
  'ly-carried-remove'(id) {
    lyCarriedDecide(id, false);
  },
  'ly-remove-setup'(id) {
    const rows = lyDraft().value.split('\n');
    const i = Number(id);
    if (!LY_SETUP.test((rows[i] || '').trim())) return;
    rows.splice(i, 1);
    lyCommit(rows.join('\n'), 'Declaration removed.');
  },
  'ly-show-lines'(id) {
    lyScrollToLine(Number(id));
  },
  'ly-apply'(id) {
    const item = lyItem(id);
    if (!item) return;
    lyCheckApply(item);
  },
  'ly-own'(id) {
    const item = lyItem(id);
    if (!item) return;
    LY.own[id] = item.proposal;
    lyRenderReview();
    $ui('ly-own-input')?.focus();
  },
  'ly-own-cancel'(id) {
    delete LY.own[id];
    lyRenderReview();
  },
  'ly-own-put'(id) {
    const item = lyItem(id);
    const text = ($ui('ly-own-input')?.value || '').trim();
    if (!item || !text) return;
    if (lyCheckApply({ ...item, proposal: text, own: true })) {
      LY.outcomes[id].message =
        'Your own line is in the draft. Nothing has checked it; Undo restores the original.';
      delete LY.own[id];
      lyRenderReview();
    }
  },
  'ly-keep'(id) {
    LY.outcomes[id] = { state: 'kept', message: 'Kept your line.' };
    showToast('Kept your line', 'success');
    lyRefresh(true);
  },
  'ly-recheck'(id) {
    const item = lyItem(id);
    if (item?.decision?.whole)
      return lySubmitLyricsAction('recheck-whole', {
        proposal: lyWriterText(LY.run.wholeText || item.whole.join('\n')),
      });
    if (!item?.decision?.n) return;
    return lySubmitLyricsAction('recheck', { n: item.decision.n, proposal: item.proposal });
  },
  'ly-conflict-resume'() {
    const w = lyWriterState();
    LY.conflict = null;
    if (w.unknown) return _chatRecover();
    lyShowTab('writer');
    (document.querySelector('#ly-writer-status [data-answer]') || $ui('chat-input'))?.focus();
  },
  'ly-conflict-new'() {
    const c = LY.conflict;
    LY.conflict = null;
    if (!c) return;
    if (c.kind === 'conversation')
      return lyStartConversation(c.args.choice, c.args.prefill, { force: true });
    return lySubmitLyricsAction(c.kind, c.args, { force: true });
  },
  'ly-conflict-cancel'() {
    LY.conflict = null;
    lyRefresh(true);
  },
  'ly-retrieve'() {
    if (chatState.pending) return _chatRecover();
    showToast('No saved request is waiting to be retrieved.', 'error');
  },
  'ly-retrieve-id'(id) {
    return lyRetrieve(id);
  },
  'ly-resume'() {
    return lySubmitLyricsAction('resume');
  },
  'ly-restore-checkpoint'() {
    const run = LY.run;
    if (!run?.final) return;
    const text =
      lyResultText(run.baseModel || LY.model, run.final, run.wholeText, run.title) ||
      run.final.join('\n');
    lyCommit(text, 'Checkpoint draft restored. Undo returns to yours.');
  },
  'ly-new-work'() {
    return lyStartConversation('lyrics-edit', 'Continue from the current draft: ', { force: true });
  },
  'ly-answer'() {
    const rows = [...document.querySelectorAll('#ly-writer-status [data-answer]')].map((i) => ({
      n: Number(i.dataset.answer),
      text: i.value.trim(),
    }));
    if (!rows.length || rows.some((r) => !r.text))
      return showToast('Write an answer for every line the writer asked about', 'error');
    const message =
      rows.length === 1 && !rows[0].n
        ? rows[0].text
        : rows.map((r) => `L${r.n}: ${r.text}`).join('\n');
    return lySubmitLyricsAction('answer', { message });
  },
  'ly-find-open'() {
    LY.find.open = true;
    $ui('ly-find').hidden = false;
    document.querySelector('[data-ui="ly-find-open"]')?.setAttribute('aria-expanded', 'true');
    $ui('ly-find-input').focus();
    $ui('ly-find-input').select();
  },
  'ly-find-step'(id) {
    lyFindStep(Number(id));
  },
  'ly-find-close'() {
    lyFindClose();
  },
  'ly-undo'() {
    ($ui('ui-undo') || $ui('btn-undo'))?.click();
  },
  'ly-redo'() {
    ($ui('ui-redo') || $ui('btn-redo'))?.click();
  },
  'ly-text-size'(id) {
    LY.prefs.size.set(id);
    lySyncDisplayMenu();
    lyRefresh(true);
  },
  'ly-numbers'() {
    LY.prefs.numbers.set(!LY.prefs.numbers.get());
    lySyncDisplayMenu();
    lyRefresh(true);
  },
  'ly-focus-doc'() {
    lyDraft().focus();
    lyRefresh(true);
  },
};

// Copy: a fulfilled browser write confirms; a failure leaves the exact text
// selected on the page so it can still be copied by hand.
function lyCopy(text, ok) {
  const done = () => showToast(ok, 'success');
  const fail = () => {
    const box = $ui('ly-doc-note');
    box.innerHTML = `<div class="ly-inline" data-tone="danger" role="alert">${icon('circle-alert', 16)}<span><strong>Copy failed</strong> Select the text below and copy it.</span><textarea class="cm-input ly-copy-text" readonly rows="6" aria-label="Text to copy">${esc(text)}</textarea><span class="ly-actions">${lyBtn('ly-copy-close', 'Close', 'x', { cls: 'cm-btn cm-btn-outline' })}</span></div>`;
    box.hidden = false;
    const ta = box.querySelector('textarea');
    ta.focus();
    ta.select();
    showToast('Copy failed', 'error');
  };
  if (navigator.clipboard && window.isSecureContext)
    navigator.clipboard.writeText(text).then(done, () => execCopyFallback(text, done, fail));
  else execCopyFallback(text, done, fail);
}

// ── Find ──────────────────────────────────────────────────────────────────
function lyFindMatches() {
  const q = LY.find.q.toLowerCase();
  return q ? LY.model.sung.filter((r) => r.text.toLowerCase().includes(q)).map((r) => r.n) : [];
}
function lyFindUpdate() {
  const hits = lyFindMatches();
  if (LY.find.at >= hits.length) LY.find.at = 0;
  const el = $ui('ly-find-count');
  if (el)
    el.textContent = LY.find.q
      ? hits.length
        ? `${LY.find.at + 1} of ${uiCount(hits.length, 'line')}`
        : 'No matches'
      : '';
  return hits;
}
function lyFindStep(d) {
  const hits = lyFindMatches();
  if (!hits.length) return lyFindUpdate();
  LY.find.at = (LY.find.at + d + hits.length) % hits.length;
  lyFindUpdate();
  const row = LY.model.sung[hits[LY.find.at] - 1];
  const draft = lyDraft();
  const rows = draft.value.split('\n');
  const start = rows.slice(0, row.i).reduce((t, r) => t + r.length + 1, 0);
  const at = rows[row.i].toLowerCase().indexOf(LY.find.q.toLowerCase());
  draft.setSelectionRange(start + at, start + at + LY.find.q.length);
  LY.caretRow = row.i;
  LY.activeLine = row.n;
  lyRenderEditor();
  $ui('ly-overlay')
    ?.querySelector(`.ly-r[data-n="${row.n}"]`)
    ?.scrollIntoView?.({ block: 'center' });
  $ui('ly-find-input').focus();
}
function lyFindClose() {
  LY.find = { q: '', at: 0, open: false };
  $ui('ly-find-input').value = '';
  $ui('ly-find').hidden = true;
  document.querySelector('[data-ui="ly-find-open"]')?.setAttribute('aria-expanded', 'false');
  lyFindUpdate();
  lyRenderEditor();
  uiFocus(document.querySelector('[data-ui="ly-find-open"]'));
}

// ── Page ──────────────────────────────────────────────────────────────────
function uiLyricsWaiting() {
  if ($ui('lyrics-wait')) return;
  const note = document.createElement('div');
  note.id = 'lyrics-wait';
  note.innerHTML =
    '<p>Your recipe request is still running.</p>' +
    uiButton('view-running', 'View request', 'message-circle');
  $ui('lyrics-chat').append(note);
}
// The inspector and mobile tab sets: arrows, Home and End move and select.
function lyTabKeys(e) {
  const tab = e.target.closest('[role="tab"]');
  if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  const list = [...tab.parentElement.querySelectorAll('[role="tab"]')];
  const i = list.indexOf(tab);
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? list.length - 1
        : (i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
  e.preventDefault();
  list[next].click();
  list[next].focus();
}
function lySizeOf(width) {
  return width >= 1280 ? 'wide' : width >= 960 ? 'compact' : 'narrow';
}
function lyWire(surface) {
  lyInspectionWire(surface);
  const draft = lyDraft();
  // Every script write to the draft (Undo, a restored or imported session, a
  // writer's lyrics) must reach this view; none of them fires `input`.
  const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  Object.defineProperty(draft, 'value', {
    configurable: true,
    get() {
      return proto.get.call(this);
    },
    set(v) {
      proto.set.call(this, v);
      lyRefresh();
    },
  });
  draft.addEventListener('input', () => {
    uiSaveLyrics();
    // The read layer must follow every keystroke: the textarea's own text is
    // transparent. The rest of the page follows on the next tick.
    LY.text = draft.value;
    LY.model = lyParse(draft.value);
    lySyncCaret();
    lyRenderEditor();
    lyRefresh();
  });
  // Keep an editor selection attached to its textarea on a mouse review,
  // including a collapsed caret retained after Tab has moved focus elsewhere.
  // Disabling the clicked Run button during send otherwise lets the browser
  // reset the just-mapped selection after the click handler returns.
  // Keyboard activation still follows its normal focus path.
  surface.addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target.closest('[data-ui="ly-run-review"]')) {
      e.preventDefault();
      if (document.activeElement === draft)
        pushHistory(); // replace the prevented blur boundary
      else {
        // Tab may already have focused Run review. Move focus off the button
        // before send disables it, preserving the selection across focus.
        const selection = [draft.selectionStart, draft.selectionEnd, draft.selectionDirection];
        draft.focus({ preventScroll: true });
        draft.setSelectionRange(...selection);
      }
    }
  });
  draft.addEventListener('blur', () => {
    pushHistory();
    lyRenderEditor();
  });
  let pointerFocusingDraft = false;
  document.addEventListener(
    'pointerdown',
    (event) => {
      pointerFocusingDraft = event.target === draft;
    },
    true
  );
  // Touch compatibility focus can arrive after pointerup but before click.
  // Keep the guard for that sequence; keyboard entry starts a different intent.
  for (const event of ['click', 'pointercancel', 'keydown'])
    document.addEventListener(
      event,
      () => {
        pointerFocusingDraft = false;
      },
      true
    );
  draft.addEventListener('focus', () => {
    $ui('ly-empty-doc').hidden = true;
    lySyncCaret();
    lyRenderEditor();
    // Native textarea focus does not account for the fixed phone controls.
    // Keep this synchronous so explicit origin restoration can restore scroll afterwards.
    // Pointer focus precedes native caret placement: never reveal the old selection then.
    if (!pointerFocusingDraft) lyRevealCaretAfterResize();
  });
  draft.addEventListener('scroll', () => (draft.scrollTop = 0));
  for (const ev of ['keyup', 'click', 'select']) draft.addEventListener(ev, () => lySyncCaret());
  document.addEventListener('selectionchange', () => {
    if (document.activeElement === draft) lySyncCaret();
  });
  $ui('ly-find-input').addEventListener('input', (e) => {
    LY.find = { q: e.target.value, at: 0, open: true };
    // Typing lands on the first match, so the first Enter goes to the second.
    if (lyFindMatches().length) return lyFindStep(0);
    lyFindUpdate();
    lyRenderEditor();
  });
  $ui('ly-find-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lyFindStep(e.shiftKey ? -1 : 1);
    }
  });
  $ui('ly-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const raw = await file.text();
      if (/\.json$/i.test(file.name) || file.type === 'application/json') {
        await lyLibraryImport(JSON.parse(raw));
        return;
      }
      const text = raw.replace(/\r\n?/g, '\n');
      lyImportText(text, `Imported ${file.name}. Undo restores the previous draft.`);
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
  });
  // Tool fields write only to their draft; the pending strip follows.
  surface.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.draft) {
      let value = t.value;
      if (t.dataset.unit === 'bars' && value.trim() !== '' && Number.isFinite(Number(value)))
        value = String(Number(value) * Number(t.dataset.beats));
      lyDraftSet(t.dataset.draft, t.dataset.target, t.dataset.field, value);
      t.removeAttribute('aria-invalid');
      lyRenderPendingOnly(t.dataset.draft);
    } else if (t.dataset.list) {
      const list = lyDraftList('word-rules', t.dataset.list);
      list[Number(t.dataset.idx)] = t.value;
      lyDraftSet('word-rules', 'song', t.dataset.list, list);
      lyRenderPendingOnly('word-rules');
    }
  });
  surface.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'ly-link-place') LY.picks.linkPlace = t.value;
    else if (t.id === 'ly-link-line') {
      LY.picks.linkLine = Number(t.value);
      lyRefresh(true);
      uiFocus($ui('ly-link-line'));
    } else if (t.id === 'ly-placed-place') LY.picks.placedPlace = t.value;
    else if (t.id === 'ly-dur-unit') {
      LY.picks.durUnit = t.value;
      lyRefresh(true);
      uiFocus($ui('ly-dur-unit'));
    } else if (t.name === 'ly-link-group') {
      LY.picks.linkGroup = Number(t.value);
      lyRefresh(true);
    } else if (t.dataset.draft && t.tagName === 'SELECT') {
      const id = t.id;
      t.blur();
      lyRefresh(true);
      uiFocus($ui(id));
    }
  });
  surface.addEventListener('keydown', (e) => {
    if (e.target.id === 'ly-title-input') {
      if (e.key === 'Enter') {
        e.preventDefault();
        lyCommitTitle(e.target.value);
        uiFocus(document.querySelector('[data-ui="ly-title-edit"]'));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        LY.titleEdit = false;
        lyRenderHead();
        uiFocus(document.querySelector('[data-ui="ly-title-edit"]'));
      }
      return;
    }
    if (e.target.closest('.ly-itabs, .ly-mnav')) return lyTabKeys(e);
    const menu = e.target.closest('.ly-menu');
    if (!menu || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = [...menu.querySelectorAll('button:not([disabled])')];
    const i = items.indexOf(e.target);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
    e.preventDefault();
  });
  surface.addEventListener(
    'blur',
    (e) => {
      if (e.target.id === 'ly-title-input' && LY.titleEdit) lyCommitTitle(e.target.value);
    },
    true
  );
  surface.addEventListener('submit', (e) => e.preventDefault());
  // Drag a Form & story row by its handle to move the section.
  surface.addEventListener('dragstart', (e) => {
    const tr = e.target.closest?.('#ly-form-rows tr[data-sec]');
    if (!tr) return;
    LY.dragFrom = Number(tr.dataset.sec);
    e.dataTransfer.effectAllowed = 'move';
  });
  surface.addEventListener('dragover', (e) => {
    if (LY.dragFrom != null && e.target.closest?.('#ly-form-rows tr[data-sec]')) e.preventDefault();
  });
  surface.addEventListener('drop', (e) => {
    const tr = e.target.closest?.('#ly-form-rows tr[data-sec]');
    const from = LY.dragFrom;
    LY.dragFrom = null;
    if (!tr || from == null) return;
    e.preventDefault();
    const to = Number(tr.dataset.sec);
    if (to === from) return;
    lyEditSections(({ blocks }) => {
      const [b] = blocks.splice(from, 1);
      blocks.splice(to, 0, b);
    }, 'Moved the section.');
    LY.picks.formSec = to;
  });
  document.addEventListener('click', (e) => {
    if (LY.menu && !e.target.closest('.ly-menu-wrap')) lyCloseMenus();
  });
  // Read-only progress while a request runs (src/app.js _chatPollStart).
  document.addEventListener('chat-progress', (e) => {
    const p = e.detail || null;
    const was = LY.progress?.stage;
    LY.progress = p;
    if (p?.stage && p.stage !== was) LY.stageSaid = `Writer: ${lyStageName(p.stage)}`;
    if (LY.tab === 'writer' && !$ui('surface-lyrics')?.hidden) lyRenderWriter();
  });
  // New conversation clears the writer's state without a busy flip.
  document.addEventListener('chat-reset', () => {
    if (LY.model) lyRefresh(true);
  });
  // The shell's busy state flips around a reply; re-render when it does.
  const dock = $ui('chat-dock');
  let busy = chatState.busy;
  if (dock)
    new MutationObserver(() => {
      if (chatState.busy === busy) return;
      busy = chatState.busy;
      if (LY.model) lyRefresh();
    }).observe(dock, { attributes: true, attributeFilter: ['class'] });
  // The layout follows the Lyrics container's own width.
  if (typeof ResizeObserver === 'function')
    new ResizeObserver(() => {
      const size = lySizeOf(surface.clientWidth || innerWidth);
      if (size !== LY.size) {
        LY.size = size;
        LY.railOpen = false;
        $ui('ly-page').dataset.size = size;
        if (LY.model) lyRefresh(true);
      } else lyPlaceLineBar();
    }).observe(surface);
  let revealPending = false,
    viewportPosition = null,
    positionIntent = 0;
  for (const event of ['wheel', 'touchmove', 'pointerdown'])
    surface.addEventListener(
      event,
      () => {
        positionIntent++;
      },
      { passive: true, capture: true }
    );
  // Input and same-row horizontal caret movement still need keyboard reveal.
  // Selections and movement to another row retain ownership of their position.
  const selection = () =>
    JSON.stringify([
      draft.value,
      draft.selectionStart,
      draft.selectionEnd,
      draft.selectionDirection,
    ]);
  const caretRow = () => draft.value.slice(0, draft.selectionStart).split('\n').length;
  let arrowSequence = 0,
    arrow = null;
  const sameArrowRow = () =>
    arrow &&
    draft.value === arrow.text &&
    draft.selectionStart === draft.selectionEnd &&
    caretRow() === arrow.row;
  const finishArrow = () => {
    if (arrow && !sameArrowRow()) positionIntent++;
    arrow = null;
  };
  draft.addEventListener('keydown', (event) => {
    finishArrow();
    if (
      ['ArrowLeft', 'ArrowRight'].includes(event.key) &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      draft.selectionStart === draft.selectionEnd
    ) {
      arrowSequence++;
      arrow = { text: draft.value, row: caretRow() };
    } else if (
      /^(Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown|Tab)$/.test(event.key) ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a')
    )
      positionIntent++;
  });
  draft.addEventListener('beforeinput', finishArrow);
  let inputSequence = 0,
    inputSelection = null;
  draft.addEventListener('input', () => {
    inputSequence++;
    inputSelection = selection();
  });
  const viewportGeometry = () =>
    [innerWidth, innerHeight, window.visualViewport?.width, window.visualViewport?.height].join(
      ':'
    );
  const rememberViewportPosition = (settled = false) => {
    if (window.visualViewport && window.visualViewport.scale !== 1) return;
    const scroller = lyViewportScroller();
    if (!scroller || revealPending) return;
    const geometry = viewportGeometry();
    // Layout can emit scroll/selection events before resize. Keep the old reading position.
    if (
      !settled &&
      viewportPosition &&
      (viewportPosition.geometry !== geometry || viewportPosition.scroller !== scroller)
    )
      return;
    const { top, bottom } = lyViewportBand(scroller);
    const row = [...document.querySelectorAll('#ly-overlay .ly-r[data-n]')].find((el) => {
      const rect = el.getBoundingClientRect();
      return Number(el.dataset.n) > 0 && rect.bottom > top && rect.top < bottom;
    });
    const caret = lyViewportCaretRow()?.getBoundingClientRect();
    viewportPosition = {
      geometry,
      scroller,
      text: lyDraft()?.value,
      row: row?.dataset.i,
      y: row?.getBoundingClientRect().top,
      caretVisible: !!caret && caret.bottom > top && caret.top < bottom,
    };
  };
  surface.addEventListener(
    'scroll',
    (event) => {
      if (['ly-body', 'ly-page', 'ly-main-scroll'].includes(event.target.id))
        rememberViewportPosition();
    },
    true
  );
  document.addEventListener('selectionchange', () => rememberViewportPosition());
  const viewportResize = () => {
    if (window.visualViewport && window.visualViewport.scale !== 1) return;
    if (revealPending) return;
    finishArrow(); // Earlier navigation is part of the starting position, not queued intent.
    const before = viewportPosition;
    const selected = selection();
    const inputAtResize = inputSequence;
    const arrowAtResize = arrowSequence;
    const intendedScroll = positionIntent;
    revealPending = true;
    requestAnimationFrame(() => {
      const firstScroller = lyViewportScroller();
      const firstScrollTop = firstScroller?.scrollTop;
      requestAnimationFrame(() => {
        revealPending = false;
        if (window.visualViewport && window.visualViewport.scale !== 1) return;
        lyPlaceLineBar();
        const scroller = lyViewportScroller();
        const inputMatches = inputSequence > inputAtResize && selection() === inputSelection;
        const arrowMatches = arrowSequence > arrowAtResize && sameArrowRow();
        // Native caret scrolling can follow input and precede this frame. Accepted writing
        // may finish that reveal, but explicit navigation/scroll intent always takes priority.
        if (
          positionIntent !== intendedScroll ||
          (selection() !== selected && !inputMatches && !arrowMatches) ||
          (scroller === firstScroller &&
            scroller?.scrollTop !== firstScrollTop &&
            !inputMatches &&
            !arrowMatches)
        ) {
          rememberViewportPosition(true);
          return;
        }
        if (
          before &&
          scroller &&
          before.scroller !== scroller &&
          before.text === lyDraft()?.value
        ) {
          const row =
            before.row != null &&
            document.querySelector(`#ly-overlay .ly-r[data-i="${before.row}"]`);
          if (row) {
            // Keep the document's screen offset across H1's scroller switch.
            // Clamping to the new header would move every later reading row.
            scroller.scrollTop += row.getBoundingClientRect().top - before.y;
          }
        }
        if (before?.caretVisible) {
          lyRevealCaretAfterResize({ keepLineMenuFocus: true });
          lyPlaceLineBar();
        }
        rememberViewportPosition(true);
      });
    });
  };
  window.addEventListener('resize', viewportResize);
  window.visualViewport?.addEventListener('resize', viewportResize);
  rememberViewportPosition(true);
  const shellReceive = window.uiReceiveReply;
  if (!shellReceive.lyWrapped) {
    const wrapped = function (payload, request) {
      const result = shellReceive.apply(this, arguments);
      try {
        lyReceive(payload, request);
      } catch (err) {
        console.error('Lyrics page could not read the reply:', err);
      }
      return result;
    };
    wrapped.lyWrapped = true;
    window.uiReceiveReply = wrapped;
  }
}
// After a tool field changes, only its pending strip and the tool row counts
// move; the field someone is typing in is never replaced.
function lyRenderPendingOnly(tool) {
  const t = tool === 'placement' || tool === 'melody' ? 'rhythm' : tool;
  const el = $ui(`ly-pending-${t}`);
  if (el) el.outerHTML = lyPendingStrip(t);
  document.querySelectorAll(`.ly-toolrow[data-id="${t}"] .ly-count`).forEach((c) => {
    const n = lyToolPending(t);
    c.textContent = n || '';
    c.hidden = !n;
    c.setAttribute('aria-label', uiCount(n, 'pending change'));
  });
  if (t === 'rhymes') {
    const link = document.querySelector(
      '[data-ui="ly-draft-apply"][data-id="rhymes"]:not(.cm-btn-primary)'
    );
    link?.toggleAttribute('disabled', false);
  }
}
uiRegisterPage({
  id: 'lyrics',
  // The Library's in-page handoff (uiOpenInLyrics): text only, no binding.
  imports: { library: (envelope) => lyLibraryImport(envelope, { push: true }) },
  mount(surface) {
    LY.prefs = {
      size: UILayout.remember('lyrics-text-size', '0'),
      numbers: UILayout.remember('lyrics-line-numbers', true),
    };
    const ui = lyMeta().ui;
    if (LY_TABS.some((t) => t[0] === ui.tab)) LY.tab = ui.tab;
    if (!ui.tool || LY_TOOLS.some((t) => t[0] === ui.tool)) LY.tool = ui.tool || '';
    if (typeof ui.outline === 'boolean') LY.outline = ui.outline;
    surface.innerHTML = lyMountMarkup();
    LY.size = lySizeOf(surface.clientWidth || innerWidth);
    $ui('ly-page').dataset.size = LY.size;
    lyWire(surface);
    // Opening the page is a boundary (the shell's own opens have already
    // migrated what they put in the draft; this covers any other way in).
    lyEnsureTokenScheme();
    LY.model = lyParse(lyDraft().value);
    LY.text = lyDraft().value;
    lyRefresh(true);
    setTimeout(lyLibraryStart, 0);
  },
  render() {
    // Replies recovered on load are the writer's latest state, shown without
    // a base draft: never as a current review.
    if (!LY.run && chatState.task?.domain === 'lyrics' && chatState.task.artifact)
      lyReceive(
        { artifact: chatState.task.artifact, lyric: chatState.lyric, task: chatState.task },
        null
      );
    const surface = $ui('surface-lyrics');
    if (surface?.clientWidth) {
      LY.size = lySizeOf(surface.clientWidth);
      $ui('ly-page').dataset.size = LY.size;
    }
    lyRefresh(true);
    setTimeout(() => LY.model && lyRefresh(true), 0);
  },
  // Splitters: the outline (200–300 px) and the inspector (320–420 px), each
  // stopping before the document would fall below 560 px.
  layout() {
    const body = $ui('ly-body');
    const width = (id, fallback) => $ui(id)?.getBoundingClientRect().width || fallback;
    UILayout.splitter({
      container: body,
      panel: $ui('ly-outline'),
      key: 'lyrics-outline',
      property: '--ly-outline-width',
      title: 'Resize sections',
      limits: () => [
        200,
        Math.max(200, Math.min(300, body.clientWidth - width('ly-inspector', 344) - 560 - 40)),
      ],
      enabled: () => LY.size === 'wide' && LY.outline,
    });
    UILayout.splitter({
      container: body,
      panel: $ui('ly-inspector'),
      key: 'lyrics-inspector',
      property: '--ly-inspector-width',
      title: 'Resize inspector',
      side: 'left',
      limits: () => [
        320,
        Math.max(
          320,
          Math.min(420, body.clientWidth - (LY.outline ? width('ly-outline', 240) : 48) - 560 - 40)
        ),
      ],
      enabled: () => LY.size !== 'narrow',
    });
  },
  resetLayout() {
    LY.outline = true;
    LY.railOpen = false;
    lyRefresh(true);
  },
  escape() {
    if (lyInspectionEscape()) return;
    if (LY.menu) {
      const opener = LY.menuOpener;
      lyCloseMenus();
      return uiFocus(opener);
    }
    if (LY.find.open) return lyFindClose();
    if (LY.briefEdit) return LY_ACTIONS['ly-brief-cancel']();
    if (LY.railOpen) {
      LY.railOpen = false;
      lyRefresh(true);
      return uiFocus(lySectionsOpener());
    }
    if (LY.gate) return LY_ACTIONS['ly-gate-close']();
    if (LY.tool && LY.size !== 'narrow') {
      LY.tool = '';
      lyRefresh(true);
      return uiFocus(document.querySelector('.ly-toolrow'));
    }
  },
  actions: LY_ACTIONS,
});
