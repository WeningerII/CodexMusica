#!/usr/bin/env python3
"""English — the ninth phonology, and the one that was missing (MISSING F-1).

PRODUCTION READING POLICY (2026-09-08, H-07)

The registered adapter retains all CMUdict pronunciations. Agreeing channels
stay definite; differing channels are knowledge sets; incompatible syllable
counts refuse alignment. `English(readings="first")` is an explicit historical
policy for controlled comparisons, not the production default. ~~Scalar scheme
and revision graders separately require unanimous endpoint-reading verdicts.~~
Since 2026-10-01 (owner ruling, CLAUDE.md standing rule 5) the graders ask
whether ANY whole reading holds an obligation, and charge a prohibition only
when every reading triggers it; the measurement instruments keep unanimity.

WHY THIS FILE EXISTS AND WHY IT IS LATE

Eight languages had a declared phonology and English did not. English ran on
`lyric_harness.Lexicon` directly, which is a fine engine and is not a
*declaration*: it states no notation, no grid unit, no prominence rule and no
source, so nothing downstream could ask English what it was. The practical cost
was total. `quality/rhyme_types.py`, `quality/relations.py`, `quality/revise.py`
and `quality/readability.py` all take a `phon` argument, `quality.phonology.get`
had no `eng` to return, and every English test in the repo therefore built its
own CMUdict FIXTURE inline and said so. 11,540 lines of production code were
unreachable from the command line, and this was the reason: not plumbing, a
missing adapter.

WHAT THIS IS NOT

It is not a second English engine. Every phone comes from the same `Lexicon`
the harness has always used; this file adds no transcription and no rule the
engine did not already have. It is a DECLARATION over that engine, in the shape
the other eight declare themselves in, so English becomes a language the new
layer can be pointed at rather than a special case it is built around.

THE FALLBACK, ADDED 2026-08-11 — KNOWN GAP 1, AND IT IS OFF BY DEFAULT

`English(fallback="high")` routes an out-of-vocabulary word through
`quality.g2p.Fallback` before refusing. `English()` — which is what `register`
puts in the registry, and therefore what `quality.phonology.get('eng')` returns
— does NOT, so no number anywhere in the repo moves because this file changed.
Turning it on is a caller's declared decision, and `declaration()` reports which
way it is set, because "this rhyme rests on a derived pronunciation" is an
assumption and doctrine 1 is where assumptions live.

What the fallback is allowed to be is the whole point, and it is stated in
`quality/g2p.py`: a reading is admissible when EVERY PHONE CAME OUT OF A
CMUdict ENTRY and a declared rule supplied only the affix, the allomorph or the
spelling normalisation — `viewest` = `view` + `-est`, `o'er` from the headword
`oar`. That is the same licence the `Lexicon`'s own inherited reductions
already run under (see REFUSAL POLICY below); it is generalised, not widened.
The letter-to-sound layer, which invents phones no dictionary entry supplied,
is reachable at `fallback="low"` and is off, on measurement rather than
principle: of the sonnet pairs it alone makes judgeable, about half do not
rhyme, against 1 in 39 for the derived layers.

`read()` is the entry point that keeps the provenance; `syllabify()` is the
inherited interface and necessarily throws it away, so a caller that needs to
know which layer produced a pronunciation must call `read()` or `layer_of()`.

THE `__init__` DOCSTRING SAID "NO DEFAULTING TO ENGLISH", AND STILL MEANS IT

That commitment is about a language falling back to English when its own rules
run out -- a Middle Chinese character quietly scored as Mandarin. An explicitly
declared `eng`, returned only when a caller asks for `eng` by name, is the
opposite of a default. The registry is what enforces this: `get('cym')` cannot
reach this module. The `__init__` docstring is amended in the same commit
rather than silently contradicted.

REFUSAL POLICY, WHICH IS THE PART WITH TEETH

`syllabify` returns `[]` for a word CMUdict cannot read. It does NOT guess.
The `Lexicon`'s own fallbacks are kept, because every one of them derives from
a dictionary entry rather than inventing a pronunciation -- `crown'd` ->
`crowned`, `feelin'` -> `feeling` with NG realised as N, `cats` -> `cat` + Z.
Where the Lexicon raises its own OOV flag, this module refuses. That refusal is
the same 50 sonnet pairs the battery reports as `refused`, now visible to the
new layer too, and doctrine 79 applies: a refusal is not a failure and must not
land in a violation numerator.

**A word the fallback cannot read still refuses**, and its refusal is reported
SEPARATELY from the dictionary's: `three_counts()` returns
dictionary / fallback / refused as three numbers, never two, because a rate
computed over "read" without saying how much of it was DERIVED has hidden the
assumption it rests on. Measured on the 2,128 end words of the 152 sonnets the
battery parses: **2,056 / 0 / 72** with the fallback off and **2,065 / 51 / 12**
with it at `high`. The nine that move into the first column rather than the
second are hyphenated compounds (`to-day`, `Easter-day`) that the LINE path has
always read by splitting on the hyphen and a per-word path did not; that is a
tokenisation agreement, not a derivation, so it belongs in the dictionary
column.

`rhymes()` IS DELIBERATELY LEFT AS THE INHERITED STUB

Doctrine 84 says a phonology that DECLARES a relation and IMPLEMENTS the
predicate is asked, and its answer wins over the channel comparison. Middle
Chinese needs that, because 平水韻 authorises a 同用 grouping the raw rime book
does not. English does not: its rhyme relation IS the channel comparison, run
under a declared theta with a conjunctive band, and that machinery lives in
`Declaration` where a caller can see and move it. Implementing `rhymes()` here
would hard-code one threshold inside the phonology and hide it from the
declaration tuple, which is doctrine 1 broken. So the stub stands, the channels
decide, and `route` reports `channels` -- which is the correct answer and not
an omission.

Likewise `alliterates()`: the anchor axis (doctrine 83) expresses head
alliteration as a per-member locator, so a hard-coded English predicate here
would compete with a coordinate that can already say it.
"""

import contextlib
import re

from quality.phonology import Phonology, Syllable, merge_readings, register
from quality import quotients as _QUOTIENTS  # noqa: E402
from quality import morphology as _MORPH  # noqa: E402

_LEX = {}
#: `English.cut_lexicon`'s plain lexicons, keyed (reader scheme, strip_parens).
_CUT_LEX = {}
#: The open `_reading_scope()` memos, innermost last.
_READING_SCOPE = []


@contextlib.contextmanager
def _reading_scope():
    """While open, `English.syllabify` remembers each word it reads, for the
    phonology and lexicon that read it. Nested scopes share the outer memo;
    the memo is dropped when the outermost scope closes. Module-level, so it
    assumes serialized, synchronous callers, as the harness runs."""
    _READING_SCOPE.append(_READING_SCOPE[-1] if _READING_SCOPE else {})
    try:
        yield
    finally:
        _READING_SCOPE.pop()


def _lexicon():
    """Lazily built. `lyric_harness` imports `quality.phonology` inside a
    function to avoid a cycle; importing it at module scope here would close
    that cycle from the other side.

    One per reader scheme, keyed by this process's scheme at the call: a warm
    worker serves requests under both, and a single lexicon built under the
    first request's scheme would have cut every later request's lines that way.
    """
    import lyric_harness as _lh
    scheme = _lh.resolve_reader_scheme(None)
    if scheme not in _LEX:
        _LEX[scheme] = _lh.Lexicon(reader_scheme=scheme)
    return _LEX[scheme]


#: The values `fallback` takes, and what each one licenses. `None` is the
#: shipped default and is the behaviour this module had before 2026-08-11.
FALLBACK_MODES = {
    None: "no fallback: a word CMUdict cannot read REFUSES",
    "high": "dictionary-derived only -- every phone comes from a CMUdict entry "
            "and a declared rule supplies the affix, allomorph or spelling "
            "normalisation (quality/g2p.py morphology + elision layers)",
    "low": "the above PLUS letter-to-sound, which invents phones no dictionary "
           "entry supplied. Reachable so the defect is demonstrable; measured "
           "at roughly a coin flip on the sonnets' own mandated rhymes",
}


class English(Phonology):
    language = "eng"
    name = "English (General American)"
    notation = ("ARPAbet, cmusphinx/cmudict master working copy (post-0.7b); "
                "stress digits 0/1/2 on vowel phones")
    grid_unit = "syllable"
    prominence_rule = (
        "lexical stress from CMUdict (1 or 2 -> prominent, 0 -> not), with the "
        "harness's WEAK_ALWAYS / WEAK_NONFINAL function-word demotion applied "
        "at the phrase level -- doctrine 46: a function-word list is part of a "
        "phonology, not an optimisation")
    relation = (
        "none declared. An English pair is judged in every relation it stands "
        "in -- each coarse relation (score()) and every registry schema "
        "(quality/relations.py REGISTRY) -- so `rhymes()` stays the inherited "
        "stub and the channels decide -- see this module's docstring")
    # CORRECTED 2026-08-13. This read `cmudict-0.7b (public domain)` and both
    # halves were false. `cmudict-0.7b` 404s at cmusphinx/cmudict master --
    # what ships is the master working copy, which carries no release version
    # of its own -- and the licence is BSD-2-clause, a REDISTRIBUTION GRANT,
    # not a public-domain dedication. The pointer at `data/sources.tsv` was
    # false too, in the way doctrine 34 is about: there was no row there to
    # point at until the same date, so the citation resolved to nothing.
    # No non-commercial restriction anywhere in the chain -- checked, not
    # assumed: `noncommercial_marker()` returns None on the fetched licence
    # text, so doctrine 85 does not fire.
    source = ("cmusphinx/cmudict master working copy, md5 "
              "5837aa6e49fd070d482b8ca0525f28ef; BSD-2-clause (Carnegie "
              "Mellon University), NOT public domain; see data/sources.tsv")

    def __init__(self, fallback=None, readings="all", lexicon=None,
                 reader_scheme=None, strip_parens=None):
        """`fallback` is a DECLARED coordinate, defaulting to the refusal.

        It is not a boolean, because "did you guess" has three answers here and
        two of them are different kinds of derivation. See `FALLBACK_MODES`.

        `reader_scheme` (`lyric_harness.READER_SCHEMES`) is how this phonology
        cuts a line into words; None reads the lexicon's, or with no lexicon
        this process's (`v2` unless declared otherwise).

        `strip_parens` (`lyric_harness.line_tokens`) is the aside rule the
        stream's English words are cut under; None reads the lexicon's (the
        shared lexicon's `True` when there is none). A judge handed a plain
        `--voices` lexicon passes `False` without the lexicon itself
        (`quality.revise.relation_phonology_for`), so the relation stream
        reads the same end word as `line_anchors`. Scheme `v1` ignores it.
        """
        self._strip_parens = strip_parens
        if reader_scheme is not None:
            import lyric_harness as _lh
            reader_scheme = _lh.resolve_reader_scheme(reader_scheme)
        self._reader_scheme = reader_scheme
        if fallback not in FALLBACK_MODES:
            raise ValueError(
                f"fallback={fallback!r} is not declared; the modes are "
                f"{sorted(k for k in FALLBACK_MODES if k)} or None")
        if readings not in ("all", "first"):
            raise ValueError("readings must be 'all' or explicitly 'first'")
        self.lexicon = lexicon
        self.readings = readings
        self.fallback = fallback
        self._fb = None
        # THE DECLARED QUOTIENTS THIS PHONOLOGY SUPPLIES (2026-08-22).
        # `relations._quotient_of` looks in `declaration['quotients']` first
        # and `phon.quotients` second — the seam `ltc` has used since it was
        # written to hand its 平水韻 同用 grouping to the 同用 schema without
        # `relations.py` importing a phonology or hard-coding a table.
        # English had none, so `ClassEqual(resource='manner')` found nothing
        # and `family rhyme` and `multisyllabic rhyme` REFUSED on every pair
        # — correctly, because the identity is not a quotient (defect P14),
        # and uselessly, because the partition they want is ordinary
        # articulatory phonetics. It is declared in `quality/quotients.py`,
        # asserted total against the inventory derived from this same
        # dictionary, and adopted here.
        self.quotients = dict(_QUOTIENTS.ENG_QUOTIENTS)
        # THE DECLARED MORPHOLOGY / LEXEME RESOURCES, on the same seam
        # (2026-08-22). `homoioteleuton` and `polyptoton` are DEFINED on
        # root and affix and refused without them; `holorhyme` and
        # `rhyming slang` are defined on lexemes. `quality/morphology.py`
        # builds all of them from `g2p.SUFFIXES` — the closed suffix set this
        # repo already ships and pre-registered — with a tie-break argued for
        # morphology rather than for pronunciation, and it prints where the
        # two disagree instead of leaving that to be discovered.
        self.resources = dict(_MORPH.ENG_RESOURCES)

    def declaration(self):
        """-> dict. The tuple this phonology is asking to be judged under.

        `fallback` is in it because doctrine 1 says assumptions live in the
        declaration, and "this pronunciation was derived rather than looked up"
        is an assumption a reader of any downstream verdict needs.
        """
        d = super().declaration()
        d["readings"] = self.readings
        if self.lexicon is not None and self.lexicon.pronunciations:
            from quality.pronunciation import fingerprint
            d['pronunciations_sha256'] = fingerprint(self.lexicon.pronunciations)
            d['pronunciation_scope_sha256'] = fingerprint({
                'tokens': getattr(self.lexicon, '_pronunciation_tokens', {}),
                'choice': getattr(self.lexicon, '_pronunciation_choice', None)})
        # THE REVIEWED SUPPLEMENT is a reading coordinate when the lexicon
        # carries one (quality/lexicon_supplement.py): every memo keyed by
        # this declaration must tell its versions apart. Absent, unchanged.
        if getattr(self.lexicon, "supplement_sha256", None):
            d["lexicon_supplement_sha256"] = self.lexicon.supplement_sha256
        # THE READER SCHEME, on the supplement's rule: a memo keyed by this
        # declaration must tell the token schemes apart, and the pre-batch
        # scheme (`v1`) is the declaration that carried no such key.
        if self.reader_scheme != "v1":
            d["reader_scheme"] = self.reader_scheme
            # Under v2 the aside rule cuts the stream's words, so a reader
            # keeping `(...)` as sung is a different declaration (v1's stream
            # read no aside rule without a lexicon, and declared none).
            if not self._aside_rule():
                d["strip_parens"] = False
        d["fallback"] = self.fallback
        d["fallback_licenses"] = FALLBACK_MODES[self.fallback]
        return d

    def _lexicon(self):
        return self.lexicon if self.lexicon is not None else _lexicon()

    def cut_lexicon(self):
        """-> a lexicon that cuts lines as this phonology's stream does: its
        own lexicon, or the shared one, or -- where this phonology declares a
        `v2` cut the shared lexicon does not make (a plain `--voices`
        lexicon's `strip_parens=False`, another scheme than this process's)
        -- a plain lexicon of that cut, one per (scheme, aside rule). Under
        `v1` the stream reads no aside rule, so the cut is the pre-batch
        shared lexicon's: scheme `v1`, asides stripped."""
        lx = self._lexicon()
        if self.lexicon is not None:
            return lx
        scheme = self.reader_scheme
        aside = self._aside_rule() if scheme == "v2" else True
        if lx.reader_scheme == scheme and lx.strip_parens == aside:
            return lx
        key = (scheme, aside)
        if key not in _CUT_LEX:
            import lyric_harness as _lh
            _CUT_LEX[key] = _lh.Lexicon(reader_scheme=scheme, strip_parens=aside)
        return _CUT_LEX[key]

    def _aside_rule(self):
        """-> the `strip_parens` this phonology's stream cuts under."""
        if self._strip_parens is not None:
            return self._strip_parens
        return self._lexicon().strip_parens

    @property
    def reader_scheme(self):
        import lyric_harness as lh
        if self._reader_scheme is not None:
            return self._reader_scheme
        if self.lexicon is not None:
            return lh._scheme_of(self.lexicon)
        return lh.resolve_reader_scheme(None)

    def for_line(self, text):
        if self.lexicon is None or not self.lexicon.pronunciations:
            return self
        return English(fallback=self.fallback, readings=self.readings,
                       lexicon=self.lexicon.for_line(text),
                       reader_scheme=self._reader_scheme,
                       strip_parens=self._strip_parens)

    def for_token(self, index):
        if self.lexicon is None or not self.lexicon.pronunciations:
            return self
        return English(fallback=self.fallback, readings=self.readings,
                       lexicon=self.lexicon.for_token(index),
                       reader_scheme=self._reader_scheme,
                       strip_parens=self._strip_parens)

    def tokens_for_line(self, text):
        """-> the line's `line_tokens`, the relations stream's English words.

        Under scheme `v2` this answers with or without a lexicon, so the
        stream never falls back to `relations.tokenise` for English (which
        dropped digits, stripped edge apostrophes, joined no enclitic and
        stripped no parenthetical, unlike every other English surface).
        Under `v1` it keeps the pre-batch answer: None without a lexicon.

        THE PRINTED ENDPOINT STAYS THE BOUNDARY. When the line's last raw run
        (`raw_final_token`) is not its last English token -- `cat 我`, or a
        letter run with a mark NFC could not compose -- that run is appended
        as one more, unreadable, token. The stream's boundary is lexical
        (`relations.build_stream`), so without it `cat 我 / hat` would be
        judged on `cat`; every `line_tokens` index is unchanged.

        The appended run is ALWAYS UNREADABLE (D14), whatever its letters:
        `printed_boundary` names its index and the stream refuses it without
        reading it. It is not a word of the line's token cut -- in `×night`
        the token is `×night` and the run only `night` -- so reading it
        would judge a readable fragment where `line_anchors` refuses the line.
        """
        import lyric_harness as lh
        if self.reader_scheme == "v1":
            if self.lexicon is None:
                return None
            return lh.line_tokens(text, strip_parens=self.lexicon.strip_parens,
                                  scheme="v1")
        rl = lh.reader_line(text, strip_parens=self._aside_rule(),
                            scheme="v2")
        words = [t.text for t in rl.tokens]
        endpoint = lh.printed_endpoint(rl)
        if endpoint is not None:
            words.append(endpoint.text)
        return words

    def printed_boundary(self, text):
        """-> the index in `tokens_for_line(text)` of the appended printed
        endpoint, or None when nothing was appended (and always under `v1`).
        `relations.build_stream` records that token unreadable without
        reading it: a boundary, never a word the stream judges."""
        import lyric_harness as lh
        if self.reader_scheme == "v1":
            return None
        rl = lh.reader_line(text, strip_parens=self._aside_rule(), scheme="v2")
        return len(rl.tokens) if lh.printed_endpoint(rl) is not None else None

    #: A word broken across the line end: a letter or apostrophe, then one
    #: hyphen, then only whitespace (`relations.build_stream`'s split flag).
    _SPLIT_FINAL = re.compile(r"[\w’'](-)\s*$")

    def split_final(self, text):
        """-> True when the line ends on a word broken by a hyphen. Under `v2`
        it is asked of the reader's normalised line, the spelling its token
        cut reads (D13): `king-` spelled with U+2010 or U+2011, or with a
        U+00AD beside the hyphen, is the one token `king-` and gets the one
        answer. `v1` asks the raw line, as the pre-batch stream did."""
        import lyric_harness as lh
        if self.reader_scheme != "v1":
            text = lh.normalise_word(text)
        return bool(self._SPLIT_FINAL.search(text))

    def split_final_stem(self, word):
        """-> the spelling the relation stream reads for a line's LAST token
        when that token ends in a hyphen after a letter or apostrophe
        (`king-`), or None.

        Under `v2` the token cut keeps the hyphen of `king-` inside the token
        (D3), and a hyphenated word reads only whole (`read`), so the
        canonical token `king-` -- every hyphen spelling folds to it -- read
        as no word, while `line_anchors` reads the printed part before the
        hyphen at the line's end: a declared `broken rhyme` or `perfect rhyme`
        on that line went from judged to refused (BB8 #527, 3PO 6163315071).
        That holds whether the line is split (`king-`, the hyphen then only
        whitespace: `split_final`) or the hyphen is followed by closing
        punctuation (`king-,`, `king-.`: BB8's earlier packet, 3PO #519
        6166749777) or a closing quote (`king-'`), because `line_anchors`
        reads each of those endpoints as `king`.
        The stream asks this only for the line-final token, and only after
        the token itself read nothing (a declared reading of `king-` answers
        first); the stem is then read by this same phonology, with its own
        fallback policy and every guard (`2-` stays a refused numeral, a
        stem that is itself hyphenated reads whole or not at all). Whether
        the line is SPLIT stays `split_final`'s answer alone: punctuation
        after the hyphen never makes the word continue on the next line, so
        `king-,` is read as `king` and is not a broken word. No other token,
        and no bare-word reading, changes. `v1` answers None: its stream cut
        `king` without the hyphen already."""
        import lyric_harness as lh
        if self.reader_scheme == "v1":
            return None
        # A closing quote set after the hyphen (`king-'`) is part of the
        # token, as an apostrophe is; `line_anchors` reads that endpoint as
        # `king` too.
        w = lh.normalise_word(word).rstrip("'’")
        if not w.endswith("-") or not re.search(r"[\w’']-$", w):
            return None
        return w[:-1]

    def _fallback(self):
        """-> the G2P fallback over the lexicon this phonology reads through
        NOW. Without its own lexicon a phonology reads through the shared one
        of the process's scheme at the call, so the fallback is cached per
        that lexicon: built once under a `v1` scope (a pinned instrument such
        as `meter_bands.measure_line`), it must not answer a later `v2` read."""
        if self.fallback is None:
            return None
        base = self._lexicon()
        if self._fb is None or self._fb[0] is not base:
            from quality.g2p import Fallback
            lex = base
            # A supplemented lexicon hands derivation CMUdict alone: a
            # reviewed row is a reading of its word, never a stem or a piece.
            # `read` consults the whole entries before this fallback.
            if hasattr(lex, "cmu_lexicon"):
                lex = lex.cmu_lexicon()
            self._fb = (base, Fallback(lex, min_confidence=self.fallback))
        return self._fb[1]

    # ---------------------------------------------------------------- reads
    def read(self, word):
        """-> `quality.g2p.Reading`, or None for a REFUSAL.

        The entry point that KEEPS THE PROVENANCE. `syllabify` cannot: its
        return type is a list of `Syllable` and there is nowhere in it to say
        which layer produced the phones, so a caller that needs to know — and a
        caller reporting a rhyme verdict does need to know — calls this.

        With `fallback=None` this returns a `dictionary` reading or None, so the
        provenance question has an answer either way and the shape does not
        change when the mode does.
        """
        from quality.g2p import Reading
        import lyric_harness as lh
        choice = getattr(self.lexicon, '_pronunciation_choice', None)
        if choice and choice['word'] == word:
            return Reading(tuple(choice['phones']), 'declared', choice['source'], (word.lower(),))
        # THE NUMERAL GUARD (M1): a numeral-bearing token without a declared
        # reading (answered just above) is refused before any fallback.
        # Scheme v1 reads a bare word as before the batch.
        if lh.has_numeral(word) and self.reader_scheme == "v2":
            return None
        lex = self._lexicon()
        # Inside the supplement coordinate a whole entry -- CMUdict's or a
        # reviewed row -- is read whole before any fallback splits it, and
        # its source is the row's own (quality/lexicon_supplement.py).
        if hasattr(lex, "whole_reading"):
            whole = lex.whole_reading(word)
            if whole is not None:
                phones, source = whole
                return Reading(tuple(phones), "dictionary",
                               "CMUdict" if source == "cmudict" else source,
                               (word.lower(),))
        fb = self._fallback()
        if fb is not None:
            return fb.read(word)
        if getattr(lex, "g2p_fallback", None) is not None:
            from quality.g2p import _NoFallbackView
            lex = _NoFallbackView(lex)
        phones, oov = lex.transcribe_word(word)
        if oov or not phones:
            return None
        return Reading(tuple(phones), "dictionary", "CMUdict", (word.lower(),))

    def layer_of(self, word):
        """-> 'dictionary' | 'morphology' | 'elision' | 'letter' | None.

        None IS the refusal, and it is a value in the same range as the others
        so a caller tabulating layers cannot accidentally drop it (doctrine 28:
        distinguish 'none' from 'cannot tell', mechanically).
        """
        r = self.read(word)
        return None if r is None else r.layer

    def three_counts(self, words):
        """-> {'dictionary', 'fallback', 'refused', 'by_layer', 'total'}.

        Doctrine 79 asks for three counts and this returns three counts. A
        caller computing a rate divides by `dictionary + fallback` and prints
        `refused` beside it; it never divides by `total`.
        """
        from collections import Counter
        out, by = Counter(), Counter()
        for w in words:
            lay = self.layer_of(w)
            if lay is None:
                out["refused"] += 1
            elif lay == "dictionary":
                out["dictionary"] += 1
            else:
                out["fallback"] += 1
                by[lay] += 1
        return {"dictionary": out["dictionary"], "fallback": out["fallback"],
                "refused": out["refused"], "by_layer": dict(by),
                "total": len(words)}

    def _syllabify_single(self, word):
        """-> [Syllable]. EMPTY when the declared layers cannot read the word.

        Empty is a refusal and callers must treat it as one. It is not a
        zero-syllable word and it is not a rhyme failure.

        THE PROVENANCE IS LOST HERE, DELIBERATELY AND VISIBLY. `Syllable` is
        the shared interface all nine phonologies return and it has no field
        for a layer; adding one would change a type eight other modules build.
        So this reads through the same `read()` the provenance path uses and
        then drops the label, and the docstring says so rather than letting a
        caller assume a syllable list is dictionary-derived. `read()` and
        `layer_of()` are one call away.
        """
        import lyric_harness as _lh
        r = self.read(word)
        if r is None or not r.phones:
            return []
        phones = list(r.phones)
        out = []
        for s in _lh.syllabify(phones):
            out.append(Syllable(
                text=word,
                onset=tuple(s["onset"]),
                nucleus=s["nucleus"],
                coda=tuple(s["coda"]),
                prominence=1 if s["stress"] in (1, 2) else 0,
                # English is stress-timed, so the mora is not its grid unit.
                # 1 everywhere is a placeholder a quantitative metre must not
                # read; `grid_unit` already says the grid is the syllable.
                moras=1))
        return out

    def parses(self, word):
        """Every CMU pronunciation unless the caller explicitly chose first.

        Readings that disagree are not resolved by dictionary ordering. The
        inherited fallback remains a single sourced reading when no entry is
        present; it must never recurse through the merged adapter.
        """
        import lyric_harness as lh
        key = lh.fold_apostrophes(word).lower()
        lex = self._lexicon()
        prons = (lex.pronunciation_variants(word) if hasattr(lex, "pronunciation_variants")
                 else lex.entries.get(key))
        if self.readings == "first" or not prons:
            return [self._syllabify_single(word)]
        return [[Syllable(word, tuple(s["onset"]), s["nucleus"],
                          tuple(s["coda"]),
                          1 if s["stress"] in (1, 2) else 0, 1)
                 for s in lh.syllabify(p)] for p in prons]

    def syllabify(self, word):
        # MEMOISED INSIDE A READING SCOPE ONLY (2026-10-15). The revise field
        # builds a two-line stream per candidate pair and read the same
        # carrier words ~80,000 times on one request. Within one
        # `_reading_scope()` the answer is a function of this phonology, the
        # word and the lexicon `_lexicon()` returns; outside a scope nothing
        # is remembered, so a reading changed between two calls (a patched
        # transcriber, `test_relations.py`) is always read afresh. Every call
        # returns fresh Syllable objects, because Syllable is mutable.
        memo = _READING_SCOPE[-1] if _READING_SCOPE else None
        if memo is None:
            return merge_readings(self.parses(word))[0]
        lex = self._lexicon()
        key = (id(self), id(lex), word, self.readings, self.fallback)
        hit = memo.get(key)
        if hit is None:
            hit = memo[key] = merge_readings(self.parses(word))[0]
            # The scope holds both objects, so neither id can be reused
            # while their answers are remembered.
            memo.setdefault(("held", id(self), id(lex)), (self, lex))
        return [Syllable(s.text, s.onset, s.nucleus, s.coda, s.prominence,
                         s.moras) for s in hit]

    def readable(self, word):
        """-> bool. Separates 'no syllables' from 'could not read', which
        `syllabify` alone cannot express (doctrine 79, one layer down)."""
        return bool(self.syllabify(word))

    def unreadable(self, text):
        """-> [str] the tokens in `text` this phonology refuses.

        The battery reports 50 refused sonnet pairs; this is the same fact
        made available to any caller before it computes a rate.
        """
        return [t for t in self._tokens(text, self.reader_scheme,
                                        self._aside_rule())
                if not self.syllabify(t)]

    def derived(self, text):
        """-> [(token, layer)] the tokens read by something OTHER than the
        dictionary. Empty whenever `fallback` is None, by construction.

        The companion to `unreadable`: that one lists what was refused, this
        one lists what was ANSWERED ON AN ASSUMPTION, and a caller reporting a
        verdict over `text` needs both lists or neither.
        """
        out = []
        for t in self._tokens(text, self.reader_scheme, self._aside_rule()):
            lay = self.layer_of(t)
            if lay is not None and lay != "dictionary":
                out.append((t, lay))
        return out

    @staticmethod
    def _tokens(text, scheme=None, strip_parens=True):
        """-> the words `unreadable`/`derived` read: `line_tokens` under
        reader scheme `v2`; under `v1` the pre-batch cutter below, verbatim
        (no enclitic join, no paren strip, two of the eight apostrophes).
        `scheme` None is this process's, so the unbound spelling
        `English._tokens(text)` stays callable."""
        import lyric_harness as lh
        if lh.resolve_reader_scheme(scheme) != "v1":
            return lh.line_tokens(text, strip_parens=strip_parens, scheme="v2")
        return English._tokens_v1(text)

    @staticmethod
    def _tokens_v1(text):
        # U+2019 is folded before the split, not after (doctrine 26): the
        # apostrophe is INSIDE the tokens this phonology cares most about
        # (`grow'st`, `o'er`), so a split that treats it as punctuation
        # manufactures the very refusals the fallback exists to remove.
        # AND THE LETTER REPERTOIRE IS THE HARNESS'S DECLARED ONE, 2026-08-21.
        # `A-Za-z` cannot spell the English this repository stages -- Barnes's
        # `jaÿ`, Hemans's accents, Welsh printed in `eng_` files -- so a
        # phonology tokenising that way disagrees with `line_tokens` about
        # what a word is, which is the disagreement that had `line_anchors`
        # reporting a Welsh line readable on a spelling-out of its own rhyme
        # word. See `lyric_harness.LATIN_SCRIPT`.
        text = text.replace("’", "'").replace("‘", "'")
        return [t for t in re.findall(r"(?:[A-Za-zÀ-ɏḀ-ỿ]|['\-])+", text)
                if re.search(r"[A-Za-zÀ-ɏḀ-ỿ]", t)]


#: The REGISTERED instance has no fallback. `quality.phonology.get('eng')`
#: therefore behaves exactly as it did before 2026-08-11, and every recorded
#: number that went through the registry is unmoved. A caller who wants the
#: fallback constructs `English(fallback="high")` and, by doing so, says in its
#: own code that it wanted it.
register(English())
