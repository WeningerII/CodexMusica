#!/usr/bin/env python3
"""THE REVIEWED LEXICON SUPPLEMENT: pronunciations CMUdict lacks, added offline.

    python3 quality/lexicon_supplement.py --check            # the gate
    python3 quality/lexicon_supplement.py --numbers          # print the rule rows

WHY THIS EXISTS. The pinned CMUdict has no entry for many words songs use
(`streetlights`, `thirty-one`, `o'er`, Scots and Dorset spellings). An unread
end word REFUSES its pair, so a song stalls on a word nobody can sing for the
program. The owner's ruling (2026-10-10, PR #519): fill those gaps ONCE,
OFFLINE, from sources that carry no share-alike or attribution burden, review
every row before it ships, and never pause a song to ask for a pronunciation.

WHAT IT CHANGES, AND WHAT IT DOES NOT. Nothing, unless a caller asks for it.
`Lexicon` is untouched: every instrument, calibration, draw and test that
builds `Lexicon()` reads the same dictionary, in the same order, as before.
`SupplementedLexicon` is the declared coordinate that adds the rows -- the
same pattern as `Lexicon(fallback=...)`: a reading coordinate, off unless
declared, printed when on.

INSIDE A `SupplementedLexicon`:
  * `entries` is CMUdict's readings followed by the supplement's: a CMUdict
    word keeps its first reading, so no first-reading number moves; a word
    CMUdict lacks gains the supplement's readings; new words follow every
    CMUdict word, so an enumeration of `entries` sees them last.
  * `cmu_entries` is the original dictionary, the same object the g2p
    fallback holds. DERIVATION READS ONLY THIS: the fallback's morphology,
    elision and compound layers, `_KNOWN_WORDS` (the `shared_ending` stem
    test), and `transcribe_word`'s own plural, `'d` and `-in'` reductions.
    A reviewed row is a reading of ITS word, never evidence that a longer or
    shorter spelling exists.
  * A hyphenated word with a whole entry is read whole (`word_pieces`), so
    `twenty-first` is one word with one stress pattern, not two words. A
    hyphenated word with no whole entry splits exactly as before.
  * `reading_source(word, phones)` names where each reading came from, so a
    supplement reading on a CMUdict word never inherits a CMUdict origin.

THE FILE (`data/lexicon_supplement.tsv`): `#` provenance lines, then the
header `word phones source basis review` (tab-separated), then one row per
reading, sorted by word, readings of one word in their intended order.
  word    the token as the tokenizer keeps it, folded: lowercase, NFC, Latin
          letters (accented ones too: `feäce`), `'` anywhere including the
          edges (`wi'`, `'neath`, `thro'`), `-` only inside.
  phones  CMUdict's 39-phone ARPAbet, every vowel carrying a stress digit,
          at least one primary.
  source  a key of `SOURCES` below.
  basis   the evidence for this reading, in words a reviewer can check.
  review  `reviewed:<reviewer>:<YYYY-MM-DD>`, or `rule-validated:<rule>` for
          a row a checked-in rule regenerates byte for byte (`--check` does).
          There is no unreviewed state in this file: a candidate waiting for
          review lives in the queue, which does not ship.
"""
import argparse
import copy
import hashlib
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import lyric_harness as LH  # noqa: E402

SUPPLEMENT_PATH = os.path.join(ROOT, "data", "lexicon_supplement.tsv")
COLUMNS = ("word", "phones", "source", "basis", "review")

#: Where a row may come from. A new source is a new key here, with its licence
#: and its row in data/sources.tsv; a row naming anything else is refused.
SOURCES = {
    "rule:number-compound": (
        "CMUdict's own readings of the parts, joined the way CMUdict's attested "
        "compounds join them (see number_rows)"),
}

CMU_VOWELS = frozenset(
    "AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW".split())
CMU_CONSONANTS = frozenset(
    "B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH".split())
#: The tokenizer's own letter repertoire (`lyric_harness._TOKEN_RUN`), lowercase.
_LETTER = "a-zß-ɏḀ-ỿ"
_WORD = re.compile(rf"'?[{_LETTER}](?:[{_LETTER}'-]*[{_LETTER}'])?")
_REVIEW = re.compile(r"(?:reviewed:[A-Za-z0-9._-]+:\d{4}-\d{2}-\d{2}"
                     r"|rule-validated:[a-z0-9-]+)")


class SupplementError(ValueError):
    """The supplement file breaks its contract; the message names the line."""


def _phones_error(phones):
    if not phones:
        return "no phones"
    primary = False
    for ph in phones:
        base, digit = ph[:-1], ph[-1:]
        if digit in ("0", "1", "2") and base in CMU_VOWELS:
            primary = primary or digit == "1"
        elif ph in CMU_CONSONANTS:
            continue
        else:
            return f"{ph!r} is not a CMUdict phone (a vowel needs its stress digit)"
    return None if primary else "no primary stress"


def load_rows(path=SUPPLEMENT_PATH):
    """-> [row dict], validated against the contract in this module's docstring.

    Raises `SupplementError` naming the first broken line. Checks that need
    CMUdict itself (a row repeating a CMUdict reading) are `check_rows`'s.
    """
    rows, seen, header, last_word = [], set(), None, None
    with open(path, encoding="utf-8") as fh:
        for n, line in enumerate(fh, 1):
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            cells = line.split("\t")
            if header is None:
                if tuple(cells) != COLUMNS:
                    raise SupplementError(
                        f"line {n}: header must be {chr(9).join(COLUMNS)!r}")
                header = cells
                continue
            if len(cells) != len(COLUMNS):
                raise SupplementError(
                    f"line {n}: {len(cells)} cells, the contract has {len(COLUMNS)}")
            row = dict(zip(COLUMNS, (c.strip() for c in cells)))
            row["line"] = n
            word, phones = row["word"], row["phones"].split()
            if (not _WORD.fullmatch(word) or "--" in word or "''" in word
                    or word != word.lower()
                    or word != unicodedata.normalize("NFC", word)):
                raise SupplementError(f"line {n}: {word!r} is not a folded token "
                                      "(lowercase NFC Latin letters, ' anywhere, "
                                      "- only inside)")
            bad = _phones_error(phones)
            if bad:
                raise SupplementError(f"line {n}: {word}: {bad}")
            if row["source"] not in SOURCES:
                raise SupplementError(f"line {n}: {word}: source {row['source']!r} "
                                      f"is not declared in SOURCES")
            if not row["basis"]:
                raise SupplementError(f"line {n}: {word}: empty basis")
            if not _REVIEW.fullmatch(row["review"]):
                raise SupplementError(
                    f"line {n}: {word}: review {row['review']!r} is not "
                    "reviewed:<who>:<date> or rule-validated:<rule> -- an "
                    "unreviewed candidate belongs in the queue, not this file")
            if last_word is not None and word < last_word:
                raise SupplementError(f"line {n}: {word!r} after {last_word!r}: "
                                      "rows are sorted by word")
            key = (word, tuple(phones))
            if key in seen:
                raise SupplementError(f"line {n}: {word}: duplicate reading")
            seen.add(key)
            last_word = word
            row["phones"] = phones
            rows.append(row)
    if header is None:
        raise SupplementError(f"{path}: no header row")
    return rows


def file_sha256(path=SUPPLEMENT_PATH):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


# ---------------------------------------------------------------------------
# Number compounds: the one rule-generated batch.
# ---------------------------------------------------------------------------

NUMBER_TENS = ("twenty", "thirty", "forty", "fifty", "sixty", "seventy",
               "eighty", "ninety")
NUMBER_UNITS = ("one", "two", "three", "four", "five", "six", "seven",
                "eight", "nine")
NUMBER_ORDINALS = ("first", "second", "third", "fourth", "fifth", "sixth",
                   "seventh", "eighth", "ninth")


def _first_element(phones):
    return [p[:-1] + "0" if p.endswith("2") else p for p in phones]


def _second_element(phones):
    return [p[:-1] + "2" if p.endswith("1") else p for p in phones]


def number_compound(tens, unit):
    """CMUdict's join for a tens-unit compound: the tens word keeps its primary
    and loses any secondary, the unit's primary becomes secondary.

    Read off CMUdict's own nine attested compounds (twenty-one ... twenty-five,
    twenty-first, thirty-five, forty-five, seventy-five): the rule reproduces
    eight of them exactly, and the ninth is CMUdict's `twenty-one` W AO2 N,
    whose unit vowel is not CMUdict's own `one` (W AH1 N). `number_rule_audit`
    re-measures this on every `--check`.
    """
    return _first_element(tens) + _second_element(unit)


def number_rows(cmu_entries):
    """-> [(word, phones)] for every tens-unit cardinal and ordinal CMUdict
    lacks, every combination of the parts' CMUdict readings, first reading
    first. A compound CMUdict already holds is left to CMUdict."""
    out = []
    for tens in NUMBER_TENS:
        for unit in NUMBER_UNITS + NUMBER_ORDINALS:
            word = f"{tens}-{unit}"
            if word in cmu_entries:
                continue
            for a in cmu_entries[tens]:
                for b in cmu_entries[unit]:
                    out.append((word, number_compound(a, b)))
    return sorted(out, key=lambda r: r[0])  # stable: reading order kept


def number_rule_audit(cmu_entries):
    """-> (matched, [(word, cmudict_first, rule_first)]) over the compounds
    CMUdict itself attests."""
    matched, differ = 0, []
    for tens in NUMBER_TENS:
        for unit in NUMBER_UNITS + NUMBER_ORDINALS:
            word = f"{tens}-{unit}"
            if word not in cmu_entries:
                continue
            rule = number_compound(cmu_entries[tens][0], cmu_entries[unit][0])
            if list(cmu_entries[word][0]) == rule:
                matched += 1
            else:
                differ.append((word, list(cmu_entries[word][0]), rule))
    return matched, differ


NUMBER_BASIS = ("tens-unit compound from CMUdict's readings of its parts, "
                "joined as CMUdict's attested compounds join them "
                "(tens keeps primary, drops secondary; unit primary -> secondary)")
NUMBER_REVIEW = "rule-validated:number-compound"


def check_rows(rows, cmu_entries):
    """-> [problem strings] for checks that need CMUdict: a row repeating a
    CMUdict reading, and rule rows that the rule no longer regenerates."""
    problems = []
    for row in rows:
        have = cmu_entries.get(row["word"], ())
        if any(list(p) == row["phones"] for p in have):
            problems.append(f"line {row['line']}: {row['word']}: repeats a "
                            "CMUdict reading")
    ruled = [(r["word"], r["phones"]) for r in rows
             if r["source"] == "rule:number-compound"]
    expected = number_rows(cmu_entries)
    if ruled != expected:
        problems.append(f"rule:number-compound rows differ from number_rows(): "
                        f"file has {len(ruled)}, rule gives {len(expected)}")
    for r in rows:
        if r["source"] == "rule:number-compound" and r["review"] != NUMBER_REVIEW:
            problems.append(f"line {r['line']}: rule row reviewed as {r['review']!r}")
    return problems


# ---------------------------------------------------------------------------
# The coordinate.
# ---------------------------------------------------------------------------

def _key(word):
    """The token as the file keys it: folded, lowercase, NFC, edge
    apostrophes KEPT (`wi'` is not `wi`)."""
    return unicodedata.normalize(
        "NFC", LH.fold_apostrophes(word).lower().replace("‑", "-")
    ).strip('"“”.,;:!?()[]')


def _bare(key):
    """The key `Lexicon` itself looks up: edge apostrophes stripped."""
    return key.strip("'")


class SupplementedLexicon(LH.Lexicon):
    """`Lexicon` plus the reviewed supplement. See the module docstring."""

    def __init__(self, fallback=None, strip_parens=True, pronunciations=None,
                 supplement_path=SUPPLEMENT_PATH):
        # Declared readings are validated AFTER the supplement joins, so a
        # `basis: dictionary` reading of a supplement word is recognised.
        super().__init__(fallback=fallback, strip_parens=strip_parens,
                         pronunciations=None)
        rows = load_rows(supplement_path)
        cmu = self.entries
        problems = check_rows(rows, cmu)
        if problems:
            raise SupplementError("; ".join(problems[:5]))
        merged = dict(cmu)
        sources = {}
        for row in rows:
            word = row["word"]
            if word in cmu and merged[word] is cmu[word]:
                merged[word] = list(cmu[word])      # never append into CMUdict's list
            merged.setdefault(word, []).append(list(row["phones"]))
            sources[(word, tuple(row["phones"]))] = row["source"]
        self.cmu_entries = cmu
        self.entries = merged
        self.supplement_path = supplement_path
        self.supplement_sha256 = file_sha256(supplement_path)
        self.supplement_rows = len(rows)
        self._reading_sources = sources
        if pronunciations is not None:
            from quality.pronunciation import validate_choices
            self.pronunciations = validate_choices(pronunciations, self)

    def declaration_line(self):
        return (f"lexicon: cmudict + reviewed supplement "
                f"({self.supplement_rows} readings, sha256 "
                f"{self.supplement_sha256[:12]})")

    def reading_source(self, word, phones):
        """-> 'cmudict', a `SOURCES` key, or None if neither holds this reading."""
        key, phones = _key(word), tuple(phones)
        keys = tuple(dict.fromkeys((key, _bare(key))))
        for k in keys:
            if (k, phones) in self._reading_sources:
                return self._reading_sources[(k, phones)]
        if any(tuple(p) == phones for k in keys for p in self.cmu_entries.get(k, ())):
            return "cmudict"
        return None

    def cmu_lexicon(self):
        """-> a plain `Lexicon` over CMUdict alone, sharing this one's frequency
        ranks, `strip_parens`, fallback and declared readings. What a
        derivation layer that takes a whole lexicon (the g2p `Fallback` an
        `English` phonology builds) must be handed, so a supplement row is
        never its stem."""
        view = copy.copy(self)
        view.__class__ = LH.Lexicon
        view.entries = self.cmu_entries
        return view

    def without_fallback(self):
        """-> this lexicon with its g2p fallback removed: supplement and
        CMUdict lookups and reductions, nothing derived beyond them. The
        `dictionary` column `g2p._NoFallbackView` draws."""
        view = copy.copy(self)
        view.g2p_fallback = None
        return view

    def dictionary_readings(self, word):
        """-> every whole-entry reading this lexicon would consider for the
        token, in its order: the apostrophe form's own reviewed rows, then the
        bare word's readings (CMUdict's, then the supplement's), then any
        further CMUdict reading filed under the apostrophe spelling. What a
        reading menu lists and a `basis: dictionary` choice may name
        (`quality.pronunciation.dictionary_readings`)."""
        key = _key(word)
        bare = _bare(key)
        out = []
        groups = ([p for p in self.entries.get(key, ())
                   if (key, tuple(p)) in self._reading_sources] if key != bare else [],
                  self.entries.get(bare, ()),
                  self.cmu_entries.get(key, ()) if key != bare else ())
        for group in groups:
            for p in group:
                if list(p) not in out:
                    out.append(list(p))
        return out

    def whole_reading(self, word):
        """-> (phones, source) for the word's first whole-entry reading
        (CMUdict's or the supplement's, the exact apostrophe form first), or
        None. No reduction from a supplement row, no fallback."""
        variants = self.pronunciation_variants(word)
        if not variants:
            return None
        phones = list(variants[0])
        return phones, (self.reading_source(word, phones) or "cmudict")

    def _cmu_view(self):
        lex = self

        class _View:
            def __enter__(self):
                self.saved = lex.entries
                lex.entries = lex.cmu_entries
                return lex

            def __exit__(self, *exc):
                lex.entries = self.saved
                return False
        return _View()

    def pronunciation_variants(self, word):
        """CMUdict's readings and reductions first, then this word's own
        supplement readings. A reduction (`-in'`) never starts from a
        supplement row: it runs against `cmu_entries`."""
        choice = getattr(self, "_pronunciation_choice", None)
        if choice:
            return LH.Lexicon.pronunciation_variants(self, word)
        with self._cmu_view():
            base = LH.Lexicon.pronunciation_variants(self, word)
        # ONE EXCEPTION, AND IT IS THE TOKEN'S OWN SPELLING: `Lexicon` strips a
        # token's edge apostrophes before looking it up, so `wi'` (Scots
        # *with*) would read as whatever `wi` is. A reviewed row for the
        # apostrophe-bearing form is about exactly this token, so it leads.
        key = _key(word)
        bare = _bare(key)
        exact = ([list(p) for p in self.entries.get(key, ())
                  if (key, tuple(p)) in self._reading_sources]
                 if key != bare else [])
        out = exact + [p for p in base if p not in exact]
        for phones in self.entries.get(bare, ()):
            if phones not in out:
                out.append(list(phones))
        return out

    def transcribe_word(self, word):
        variants = self.pronunciation_variants(word)
        if variants:
            return list(variants[0]), False
        # Plural, 'd and -in' reductions, and the g2p fallback, against
        # CMUdict alone: a supplement row is evidence for its own word only.
        with self._cmu_view():
            return LH.Lexicon.transcribe_word(self, word)

    def word_pieces(self, word):
        """Whole before piece: a hyphenated word the dictionary holds whole is
        one word. Otherwise the pieces, exactly as `Lexicon` cuts them."""
        if not getattr(self, "_pronunciation_choice", None):
            key = _key(word)
            if "-" in key and (key in self.entries or _bare(key) in self.entries):
                return [word]
        return LH.Lexicon.word_pieces(self, word)


_SUPPLEMENTED = {}


def supplemented_lexicon(strip_parens=True, fallback=None,
                         supplement_path=SUPPLEMENT_PATH):
    """A cached `SupplementedLexicon`, keyed by its coordinates and the file's
    digest -- the supplemented twin of `fit._english_lexicon`, for readers
    that build their own lexicon (the meter-band reader)."""
    key = (strip_parens, fallback, supplement_path, file_sha256(supplement_path))
    if key not in _SUPPLEMENTED:
        _SUPPLEMENTED[key] = SupplementedLexicon(
            fallback=fallback, strip_parens=strip_parens,
            supplement_path=supplement_path)
    return _SUPPLEMENTED[key]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true",
                    help="validate the supplement against its contract and CMUdict")
    ap.add_argument("--numbers", action="store_true",
                    help="print the rule rows for number compounds")
    ap.add_argument("--path", default=SUPPLEMENT_PATH)
    a = ap.parse_args(argv)
    lex = LH.Lexicon()
    if a.numbers:
        for word, phones in number_rows(lex.entries):
            print("\t".join((word, " ".join(phones), "rule:number-compound",
                             NUMBER_BASIS, NUMBER_REVIEW)))
        return 0
    try:
        rows = load_rows(a.path)
    except SupplementError as error:
        print(f"REFUSED: {error}")
        return 1
    problems = check_rows(rows, lex.entries)
    matched, differ = number_rule_audit(lex.entries)
    print(f"{len(rows)} readings, {len({r['word'] for r in rows})} words, "
          f"sha256 {file_sha256(a.path)}")
    print(f"number rule against CMUdict's attested compounds: {matched} match, "
          f"{len(differ)} differ")
    for word, cmu, rule in differ:
        print(f"  {word}: CMUdict {' '.join(cmu)} | rule {' '.join(rule)}")
    for p in problems:
        print(f"PROBLEM: {p}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
