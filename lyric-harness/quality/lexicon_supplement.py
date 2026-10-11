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
    "moby:3205:attested": (
        "Moby Pronunciator II, mpron.txt; public-domain grant by Grady Ward, "
        "January 2001, in https://www.gutenberg.org/files/3205/3205.txt. "
        "Direct attestation converted using its phone/stress legend; the "
        "bundled old CMUdict is excluded. See data/sources.tsv."),
    "reviewed:moby-3205:plural": (
        "Finite reviewed plural of the Moby-attested streetlight, supported "
        "by its light/lights pair; not a direct streetlights attestation "
        "and not a productive rule. Same public-domain source grant; "
        "data/sources.tsv states the derivation and source lines."),
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
# Versions: what a run declares, and what a saved run keeps.
# ---------------------------------------------------------------------------
#
# A VERSION IS A FROZEN FILE NAMED IN data/lexicon_supplement_versions.json.
# A run declares one by id (`--lexicon-supplement=v1`) or declares `none`
# (CMUdict alone), and its record keeps the id AND the file's sha256. A new
# batch is a new version with a new file; an old version's file is never
# edited, so a saved run reads tomorrow exactly what it read today. When the
# declared id is unknown, its file is missing, or its bytes are not the ones
# the manifest (or the saved run) names, the run is REFUSED: no version is
# ever substituted for another, the newest least of all.

VERSIONS_PATH = os.path.join(ROOT, "data", "lexicon_supplement_versions.json")
#: What the bare `--lexicon-supplement` flag (#522's spelling) names.
BARE_FLAG_VERSION = "v1"
#: The declared absence of a supplement: CMUdict alone, as `Lexicon()` reads.
NONE = "none"
UNAVAILABLE = "LEXICON_SUPPLEMENT_UNAVAILABLE"
_VERSION_ID = re.compile(r"v[1-9][0-9]*")
_SHA256 = re.compile(r"[0-9a-f]{64}")


class SupplementUnavailable(SupplementError):
    """A declared version this build cannot serve byte for byte."""


def load_versions(path=VERSIONS_PATH):
    """-> the validated manifest: {"default": id, "versions": [row, ...]}.

    Raises `SupplementError` naming the broken field. Checks the manifest
    only; `resolve_version` checks a version's file against it."""
    import json
    with open(path, encoding="utf-8") as fh:
        manifest = json.load(fh)
    if not isinstance(manifest, dict) or manifest.get("version") != 1:
        raise SupplementError(f"{path}: manifest version must be 1")
    rows = manifest.get("versions")
    if not isinstance(rows, list) or not rows:
        raise SupplementError(f"{path}: `versions` must be a non-empty list")
    ids, paths = set(), set()
    for row in rows:
        vid = row.get("id") if isinstance(row, dict) else None
        if not isinstance(vid, str) or not _VERSION_ID.fullmatch(vid):
            raise SupplementError(f"{path}: version id {vid!r} is not v<N>")
        rel = row.get("path")
        if (not isinstance(rel, str) or not rel.startswith("data/")
                or ".." in rel.split("/") or not rel.endswith(".tsv")):
            raise SupplementError(f"{path}: {vid}: path {rel!r} is not a data/*.tsv file")
        if not isinstance(row.get("sha256"), str) or not _SHA256.fullmatch(row["sha256"]):
            raise SupplementError(f"{path}: {vid}: sha256 is not 64 lowercase hex")
        if not isinstance(row.get("rows"), int) or row["rows"] < 1:
            raise SupplementError(f"{path}: {vid}: rows must be a positive count")
        if vid in ids or rel in paths:
            raise SupplementError(f"{path}: {vid}: id or path listed twice")
        ids.add(vid)
        paths.add(rel)
    if manifest.get("default") not in ids:
        raise SupplementError(f"{path}: default {manifest.get('default')!r} "
                              "is not a listed version")
    return manifest


def canonical_version(spec):
    """-> the declared version as the record keeps it: `none` for no
    supplement, `BARE_FLAG_VERSION` for the bare flag (True), else the id."""
    if spec is None or spec is False or spec == NONE:
        return NONE
    if spec is True:
        return BARE_FLAG_VERSION
    return spec


def resolve_version(spec, expected_sha256=None, versions_path=VERSIONS_PATH):
    """-> None for `none` (CMUdict alone), else the manifest row of the
    declared version, with `abspath` added, once its file is proved to be
    the bytes the manifest -- and `expected_sha256`, a saved run's record,
    when given -- names. Anything else raises `SupplementUnavailable`."""
    vid = canonical_version(spec)
    if vid == NONE:
        if expected_sha256 is not None:
            raise SupplementUnavailable(
                f"{UNAVAILABLE}: a supplement sha256 was declared with no "
                "supplement version; declare the version it belongs to")
        return None
    manifest = load_versions(versions_path)
    shipped = [r["id"] for r in manifest["versions"]]
    row = next((r for r in manifest["versions"] if r["id"] == vid), None)
    if row is None:
        raise SupplementUnavailable(
            f"{UNAVAILABLE}: supplement version {vid!r} is not one this build "
            f"ships (it ships: {', '.join(shipped)}; or `{NONE}`). A saved run "
            "is never moved to another version: keep its draft and start a new "
            "run under a shipped one.")
    if expected_sha256 is not None and expected_sha256 != row["sha256"]:
        raise SupplementUnavailable(
            f"{UNAVAILABLE}: the run was graded under supplement {vid} with "
            f"sha256 {expected_sha256}, and this build's {vid} is "
            f"{row['sha256']}. The run's basis cannot be served; keep its draft "
            "and start a new run.")
    abspath = os.path.join(os.path.dirname(os.path.abspath(versions_path)), "..",
                           row["path"])
    abspath = os.path.normpath(abspath)
    try:
        actual = file_sha256(abspath)
    except OSError as error:
        raise SupplementUnavailable(
            f"{UNAVAILABLE}: supplement {vid}'s file {row['path']} cannot be "
            f"read ({error.strerror or error})") from error
    if actual != row["sha256"]:
        raise SupplementUnavailable(
            f"{UNAVAILABLE}: supplement {vid}'s file {row['path']} hashes to "
            f"{actual}, not the {row['sha256']} its manifest row names. A "
            "shipped version is frozen; an edit is a new version.")
    return dict(row, abspath=abspath)


def lexicon_identity(lex):
    """-> {"supplement_id", "sha256"}: the supplement a lexicon reads, or
    null/null for CMUdict alone. What every lyric result reports."""
    return {"supplement_id": getattr(lex, "supplement_id", None),
            "sha256": getattr(lex, "supplement_sha256", None)}


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


def _version_of(path, sha256):
    """-> the shipped version id whose file and bytes these are, or None."""
    try:
        manifest = load_versions()
    except (OSError, ValueError):
        return None
    here = os.path.normpath(os.path.abspath(path))
    for row in manifest["versions"]:
        if (row["sha256"] == sha256
                and os.path.normpath(os.path.join(ROOT, row["path"])) == here):
            return row["id"]
    return None


class SupplementedLexicon(LH.Lexicon):
    """`Lexicon` plus the reviewed supplement. See the module docstring."""

    def __init__(self, fallback=None, strip_parens=True, pronunciations=None,
                 supplement_path=None, version=None, expected_sha256=None):
        # A declared VERSION names its frozen file and is proved against the
        # manifest (and a saved run's sha256) before a row is read. A bare
        # path is the test seam; the shipped default path is version v1.
        if version is not None:
            if supplement_path is not None:
                raise TypeError("declare a supplement version or a path, not both")
            vrow = resolve_version(version, expected_sha256)
            if vrow is None:
                raise SupplementUnavailable(
                    f"{UNAVAILABLE}: version `{NONE}` reads no supplement; "
                    "build `Lexicon` instead")
            supplement_path = vrow["abspath"]
        elif supplement_path is None:
            supplement_path = SUPPLEMENT_PATH
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
        self.supplement_id = (vrow["id"] if version is not None
                              else _version_of(supplement_path, self.supplement_sha256))
        self._reading_sources = sources
        if pronunciations is not None:
            from quality.pronunciation import validate_choices
            self.pronunciations = validate_choices(pronunciations, self)

    def declaration_line(self):
        return (f"lexicon: cmudict + reviewed supplement "
                f"{self.supplement_id or 'unversioned'} "
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
    if a.path == SUPPLEMENT_PATH:
        problems += version_problems()
    for p in problems:
        print(f"PROBLEM: {p}")
    return 1 if problems else 0


def version_problems(versions_path=VERSIONS_PATH):
    """-> [problem strings]: every shipped version must resolve byte for byte,
    load under the row contract, and hold the row count its manifest names."""
    try:
        manifest = load_versions(versions_path)
    except (OSError, ValueError) as error:
        return [f"versions manifest: {error}"]
    problems = []
    for row in manifest["versions"]:
        try:
            got = resolve_version(row["id"], versions_path=versions_path)
            n = len(load_rows(got["abspath"]))
        except SupplementError as error:
            problems.append(str(error))
            continue
        if n != row["rows"]:
            problems.append(f"{row['id']}: manifest says {row['rows']} rows, "
                            f"its file holds {n}")
        print(f"version {row['id']}{' (default)' if row['id'] == manifest['default'] else ''}: "
              f"{row['path']} sha256 {row['sha256']} -- {n} readings")
    return problems


if __name__ == "__main__":
    sys.exit(main())
