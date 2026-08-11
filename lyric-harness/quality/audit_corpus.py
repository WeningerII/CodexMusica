#!/usr/bin/env python3
"""Adversary 5 — the instrument that attacks THE CORPUS.

Six adversaries already exist in this repo and every one of them attacks
something downstream of the text.  The nulls attack our RESULTS,
`quality/revise.py` attacks the WRITING, `quality/redteam_band.py` attacks the
CODE's generosity, `quality/mutate.py` attacks the TESTS, `quality/
audit_register.py` attacks the RECORD, and `quality/relations.py`'s tradition
scoping attacks the TAXONOMY.  **Nothing attacked the CORPUS.**

Every corpus-level finding this project owns was made by hand, one file at a
time, and each cost a cell most of a run:

  doctrine 50   modernised Icelandic inserts epenthetic -ur and breaks the
                dróttkvætt syllable count; Irish `text_standard` destroys the
                orthographic rhymes; the 1900 Malay spelling is CLOSER to the
                rhyming sound than the modern standard (doctrine 70)
  doctrine 51   five hits in four repos were three copies of ONE file plus a
                fork.  Count DISTINCT BYTES, not distinct URLs
  doctrine 52   the 1848 Háttatal OCR reads fine and contains ZERO occurrences
                of any consonant a hending detector needs, with 3,474
                Greek-block characters standing in their place
  doctrine 53   one orthography, admissible for skothending and biased toward
                the positive for aðalhending
  doctrine 34   a corpus file with no `data/sources.tsv` row IS the defect, and
                it is the rule `verse.txt` was deleted for
  doctrine 79   a corpus file's declared population differing from its own
                header, and `-uk` being 0 on an extract and 2 on the file it
                was cut from

This module is those six passes made permanent and made cheap.

WHAT IT CHECKS, in the order the errors were actually found
-----------------------------------------------------------

  A · ROW          Doctrine 34.  Every file under the audited root reaches a
                   `data/sources.tsv` row by one of three declared routes, and
                   every row that names a corpus path names one that exists.
                   Reported in BOTH directions, because the two failures are
                   different defects: an undeclared file never passed the
                   provenance gate, and a row naming nothing is a claim about
                   a population that is not here.

  B · HEADER       The file's own `#` header carries md5s, editions, licences
                   and counts.  Where the header and the row disagree, one of
                   them is wrong and neither knows it.  Also: does the header's
                   own declared count survive counting?

  C · HASH         A staged file that has drifted from its recorded hash is
                   silent corruption.  A staged file with NO recorded hash
                   cannot drift detectably at all, which is the same exposure
                   one step earlier, so it is reported as its own class.

  D · LANGUAGE     Run the declared phonology over the file and report the
                   readable fraction.  **This check is much weaker than it
                   looks and the module says so** — see MEASURED BASELINE
                   below.  It catches misencoding and script mismatch; inside
                   one script it barely discriminates at all, and the honest
                   conclusion is that D is a SCRIPT test and F is the language
                   test.

  E · DISTINCT     Doctrine 51.  Two files with the same md5 are ONE source
                   wearing two names.  Two files with high line-level overlap
                   are one source and a cut of itself, which is doctrine 79's
                   population error arriving as a corpus-level fact.

  F · CHANNEL      Doctrine 52.  For each file, the count of the characters
                   ITS OWN tradition's constraint reads — the eight Welsh
                   digraphs for `cym`, `þ ð æ ǫ ø œ` and the accented vowels
                   for `non`, the vowel inventory for `fin`, the tone-bearing
                   characters for `ltc`.  A file with zero of them that still
                   "looks readable" is the Háttatal case.  Where the channel is
                   empty the module names the characters standing in its place,
                   because that is what made the Háttatal diagnosis certain.

  G · ORTHOGRAPHY  Doctrines 50 and 70, generalised.  For each declared
                   language, a pair of ALTERNANT SPELLING SETS that write the
                   same sound — one the constraint can read, one it cannot —
                   and the counts of each.  Malay's `-ung`/`-uk` against
                   `-ong`/`-ok` is one row of this table, not a special case.
                   Every probe also carries the POPULATION its counts were
                   measured over, because a zero measured on a one-seventh
                   extract is not a zero about the source.

THE MEASURED BASELINE THAT MAKES CHECK D WEAK, STATED UP FRONT
---------------------------------------------------------------

3,000 tokens of Shakespeare's sonnets, read under each declared phonology:

    cym 95.8%   fin 99.7%   non 78.9%   san 71.7%   msa 67.2%

English is 95.8% readable as Welsh.  So "the declared language is the language
the file reads as" cannot be answered by a readability rate among Latin-script
languages, and a module that reported 95.8% as confirmation would be laundering
its own input.  What the rate DOES answer is whether the bytes are the script
the phonology declares — a `cym` file at 2% is misencoded, mojibake, or the
wrong text.  The discriminating instrument is F, and that is doctrine 52 one
level up: check the specific channel, not the general legibility.

THE STANDARD THIS FILE IS HELD TO
----------------------------------

`quality/test_corpus_audit.py` is the same shape as `quality/
test_register_audit.py`: the calibration set is the errors this repo ALREADY
KNOWS ABOUT, and the test fails if the auditor stops rediscovering them.

  1. the Háttatal consonant wipe   (doctrine 52)
  2. the byte-identical cltk pair  (doctrine 51)
  3. the Malay extract-vs-source population difference (doctrine 79)

An auditor that cannot find the errors we already know about is not working.
Two of the three live outside the repository, in a scratch tree that does not
survive the session, so each calibration case runs TWICE: against a PLANTED
fixture that carries the mechanism and travels with the test, and — when the
real tree is reachable — against the real bytes and the recorded figure.  The
planted half is what CI runs; the real half is what proves the planted half is
the same defect.

RUN
    python3 quality/audit_corpus.py                    # every check, corpus/
    python3 quality/audit_corpus.py --check A,C        # selected checks
    python3 quality/audit_corpus.py --only 'msa*'      # one file
    python3 quality/audit_corpus.py --root DIR         # any tree
    python3 quality/audit_corpus.py --calibrate        # the three known cases
    python3 quality/audit_corpus.py --json

EXIT STATUS is meaningful, unlike `battery.py`'s: non-zero when any check
returns a FAIL, or when `--calibrate` fails to rediscover a known case.  WARN
and NOTE do not fail the run — a corpus is allowed to be incompletely recorded,
it is not allowed to contradict its own record.
"""

from __future__ import annotations

import argparse
import collections
import csv
import fnmatch
import hashlib
import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

SOURCES_TSV = os.path.join(ROOT, "data", "sources.tsv")
CORPUS_DIR = os.path.join(ROOT, "corpus")

FAIL = "FAIL"
WARN = "WARN"
NOTE = "NOTE"
OK = "ok"

_SEV_ORDER = {FAIL: 0, WARN: 1, NOTE: 2, OK: 3}


class Finding:
    """One defect, with the file, the mechanism and the doctrine it belongs to.

    `measured` is deliberately separate from `what`: doctrine 58 says a bare
    n-of-N is a coordinate of a setting nobody wrote down, so every number this
    module prints travels beside the rule that produced it.
    """

    def __init__(self, check, severity, path, what, measured="",
                 mechanism="", doctrine=""):
        self.check = check
        self.severity = severity
        self.path = path
        self.what = what
        self.measured = measured
        self.mechanism = mechanism
        self.doctrine = doctrine

    def asdict(self):
        return {"check": self.check, "severity": self.severity,
                "path": self.path, "what": self.what,
                "measured": self.measured, "mechanism": self.mechanism,
                "doctrine": self.doctrine}

    def __str__(self):
        head = "  [%s] %s  %s" % (self.severity, self.check, self.path)
        body = "         %s" % self.what
        out = [head, body]
        if self.measured:
            out.append("         measured:  %s" % self.measured)
        if self.mechanism:
            out.append("         mechanism: %s" % self.mechanism)
        if self.doctrine:
            out.append("         doctrine:  %s" % self.doctrine)
        return "\n".join(out)


# ---------------------------------------------------------------------------
# 0. Reading a corpus file
# ---------------------------------------------------------------------------

#: A verse line is a line that is not a `#` header line, not a `--- KEY:`
#: machine-readable marker and not a `[VERSE n]`/`[CHORUS]` structural tag.
#: Stated because doctrine 70's amendment cost a round to the fact that nobody
#: had written the tokenisation down.
_MARKER = re.compile(r"^(#|--- |\[)")

#: Tokens are maximal runs of letters, with an internal apostrophe or hyphen
#: kept inside the token.  This is doctrine 70's amended rule verbatim, and the
#: OTHER rule (apostrophe and hyphen as breaks) is reachable as
#: `tokens(letters_only=True)` because the two give different numbers and the
#: difference is the whole of M-3's disagreement.
_TOKEN = re.compile(r"[^\W\d_]+(?:['’`-][^\W\d_]+)*", re.UNICODE)
_TOKEN_LETTERS = re.compile(r"[^\W\d_]+", re.UNICODE)

_CJK = re.compile(r"[㐀-䶿一-鿿豈-﫿]")

#: `local:` rows name their file directly; everything else is reached through
#: the file's own header naming a parent `source_id`, or through a row's prose
#: naming the path.  Three routes, declared, and a file with none of them is
#: the doctrine 34 defect.
ROUTE_LOCAL = "local-row"
ROUTE_HEADER = "header-names-parent-row"
ROUTE_MENTION = "named-in-a-row"
ROUTE_NONE = "NONE"


def display_path(p):
    """Repo-relative inside the repo, absolute outside it.  A `--root` pointed
    at a scratch tree must not print `../../../../tmp/...` — a path that only
    resolves from the directory the auditor happened to run in is not evidence
    anybody can follow."""
    a = os.path.abspath(p)
    if a.startswith(ROOT + os.sep):
        return os.path.relpath(a, ROOT)
    return a


class CorpusFile:

    def __init__(self, path, root=None):
        self.path = path
        self.rel = display_path(path)
        self.raw = open(path, "rb").read()
        self.md5 = hashlib.md5(self.raw).hexdigest()
        self.sha256 = hashlib.sha256(self.raw).hexdigest()
        self.text = self.raw.decode("utf-8", errors="replace")
        self._lines = self.text.split("\n")
        self.header_lines = [l for l in self._lines if l.startswith("#")]
        self.header = "\n".join(self.header_lines)
        self.verse_lines = [l for l in self._lines
                            if l.strip() and not _MARKER.match(l)]
        self.verse_text = "\n".join(self.verse_lines)
        self.titles = sum(1 for l in self._lines if l.startswith("--- TITLE:"))

    # -- header ------------------------------------------------------------

    def header_fields(self):
        """-> {key: value}.  A key is `# key:` at the head of a line; its value
        runs to the next key or the end of the header, continuation lines being
        indented under it.  Deliberately dumb, like `Entry.numbers` in
        `audit_register.py`: a field this misses is a field nobody audits."""
        out, key, buf = {}, None, []
        for l in self.header_lines:
            body = l[1:].rstrip()
            m = re.match(r"\s*([A-Za-z][A-Za-z0-9_ '’-]{0,60}?):\s?(.*)$",
                         body)
            if m and not body.startswith("    "):
                if key:
                    out[key] = " ".join(buf).strip()
                key = m.group(1).strip().lower()
                buf = [m.group(2)]
            elif key:
                buf.append(body.strip())
        if key:
            out[key] = " ".join(buf).strip()
        return out

    def header_md5s(self):
        return set(re.findall(r"md5\s+([0-9a-f]{32})", self.header))

    # -- tokens ------------------------------------------------------------

    def tokens(self, letters_only=False, lang=None):
        if lang == "ltc":
            return _CJK.findall(self.verse_text)
        pat = _TOKEN_LETTERS if letters_only else _TOKEN
        return [m.group(0).lower() for m in pat.finditer(self.verse_text)]


# ---------------------------------------------------------------------------
# 1. Reading data/sources.tsv
# ---------------------------------------------------------------------------


class Sources:

    _CORPUS_PATH = re.compile(r"corpus/[A-Za-z0-9_./‐-]+")

    def __init__(self, path=SOURCES_TSV):
        self.path = path
        self.rows = []
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                self.rows = list(csv.DictReader(fh, delimiter="\t"))
        self.by_id = {r["source_id"]: r for r in self.rows}
        self.blobs = {r["source_id"]: "\t".join((v or "") for v in r.values())
                      for r in self.rows}
        # source_ids that are not `local:` are the ones a derived file's header
        # can name as its parent.  Sorted longest-first so a prefix id cannot
        # shadow a longer one that also matches.
        self.parent_ids = sorted(
            (i for i in self.by_id if not i.startswith("local:")),
            key=len, reverse=True)

    def local(self, rel):
        return self.by_id.get("local:" + rel)

    def parent_of(self, cf):
        """Match longest-first so a prefix id cannot shadow a longer one.

        `#` is this table's sub-scope convention — `thabz/Kalliope#moore-irish-
        melodies` is the Moore SELECTION out of the Kalliope repo — and a
        file's header names the repo, not the selection.  Matching only the
        full id lost `eng_celtic_thomas_moore.txt` to route 3, where it then
        resolved to an unrelated Finnish row that happens to cite it as a
        methodological precedent.  So the stem is tried after the full id, and
        never before it.
        """
        for sid in self.parent_ids:
            if sid in cf.header:
                return sid
        for sid in self.parent_ids:
            stem = sid.split("#")[0]
            if stem and stem in cf.header:
                return sid
        return None

    def mentions(self, rel):
        """Sorted, so the answer does not depend on dict order (doctrine 66).
        `local:` rows first: a row that NAMES a file is a better witness than
        a row that happens to cite it in prose."""
        for sid in sorted(self.blobs, key=lambda s: (not s.startswith("local:"), s)):
            if rel in self.blobs[sid]:
                return sid
        return None

    def route(self, cf, rel):
        """-> (route, source_id).  Doctrine 34's question, answered."""
        if self.local(rel) is not None:
            return ROUTE_LOCAL, "local:" + rel
        sid = self.parent_of(cf)
        if sid:
            return ROUTE_HEADER, sid
        sid = self.mentions(rel)
        if sid:
            return ROUTE_MENTION, sid
        return ROUTE_NONE, None

    def named_paths(self):
        """-> {source_id: {corpus paths the row names}}.  Trailing `.` is a
        sentence full stop, not part of the path; a trailing `/` is a directory
        scope and a bare prefix (`corpus/song/ltc_siku_kr4j`) is a family, and
        neither is a claim that one file exists."""
        out = {}
        for sid, blob in self.blobs.items():
            hits = set()
            for m in self._CORPUS_PATH.findall(blob):
                m = m.rstrip(".")
                if m.endswith("/"):
                    continue
                hits.add(m)
            if hits:
                out[sid] = hits
        return out


# ---------------------------------------------------------------------------
# 2. The declared language of a file
# ---------------------------------------------------------------------------

#: Filename prefix -> the phonology the file is claiming.  This is the
#: declaration; nothing here sniffs.  A file whose prefix is not a declared
#: language has no declared language, and that is itself reported rather than
#: guessed at (doctrine 44: say what is missing).
LANG_PREFIX = {
    "cym": "cym", "fin": "fin", "ltc": "ltc", "msa": "msa", "san": "san",
    "fas": "fas", "non": "non", "eng": "eng", "som": "som",
}

#: The `note` column of `data/sources.tsv` opens with a language code on 108 of
#: 386 rows, and it is NOT the same namespace as the filename prefixes: the
#: table carries `en` beside `eng`, `fi` beside `fin`, `sa` beside `san` and
#: `lzh` beside `ltc`.  Mapped here so the two can be compared at all; the
#: divergence itself is a finding (check B).
ROW_LANG_ALIAS = {
    "en": "eng", "eng": "eng", "fi": "fin", "fin": "fin", "sa": "san",
    "san": "san", "lzh": "ltc", "ltc": "ltc", "cy": "cym", "cym": "cym",
    "ms": "msa", "msa": "msa", "fa": "fas", "fas": "fas", "non": "non",
    "so": "som", "som": "som",
}

_ROW_LANG = re.compile(r"^([a-z]{2,3})(?:-[A-Za-z]+)?;\s")


def declared_language(cf, rel):
    """-> (lang, how).  `how` is `filename-prefix`, `header`, `row` or None."""
    fields = cf.header_fields()
    for key in ("lang", "language"):
        v = fields.get(key)
        if v:
            code = v.split()[0].strip().lower().strip(".,;")
            if code in LANG_PREFIX or code in ROW_LANG_ALIAS:
                return ROW_LANG_ALIAS.get(code, code), "header"
    pre = os.path.basename(rel).split("_")[0].split(".")[0]
    if pre in LANG_PREFIX:
        return LANG_PREFIX[pre], "filename-prefix"
    return None, None


def row_language(row):
    if not row:
        return None
    m = _ROW_LANG.match(row.get("note") or "")
    if not m:
        return None
    return ROW_LANG_ALIAS.get(m.group(1))


# ---------------------------------------------------------------------------
# 3. THE CHANNEL TABLE — doctrine 52
#
# For each tradition: the characters ITS constraint reads, and the rate at
# which they occur in text that is known good.  The floors are set from
# measurement on this repo's own corpus (the `observed` field), at roughly a
# quarter of the lowest observed value, so a floor breach is a real collapse
# and not a stylistic wobble.  ZERO is reported separately from THIN because
# doctrine 52's case is zero and zero admits no other explanation.
# ---------------------------------------------------------------------------


class Channel:

    def __init__(self, name, items, unit, floor, observed, why, kind="char"):
        self.name = name
        self.items = tuple(items)
        self.unit = unit            # "chars" | "cjk"
        self.floor = floor          # per 1000 units
        self.observed = observed    # measured range on known-good text
        self.why = why
        self.kind = kind            # "char" | "digraph" | "callable"

    def count(self, cf):
        if self.kind == "callable":
            return self.items[0](cf)
        t = cf.verse_text.lower()
        if self.kind == "digraph":
            return sum(t.count(x) for x in self.items)
        s = set(self.items)
        return sum(1 for c in t if c in s)

    def denominator(self, cf):
        if self.unit == "cjk":
            return len(_CJK.findall(cf.verse_text))
        return len(cf.verse_text)


def _ltc_tone_bearing(cf):
    """Tone-bearing characters: the ones `data/qieyun_mc.tsv` gives a tone
    class.  For Middle Chinese the constraint is 平 vs 仄 and the rhyme
    category, both LEXICALISED in the rime book, so 'can the channel be read'
    is a table lookup and not a property of the glyphs."""
    try:
        from quality.phonology import ltc as _ltc
    except Exception:
        return 0
    m = _ltc.MiddleChinese()
    return sum(1 for c in _CJK.findall(cf.verse_text)
               if m.tone_class(c) is not None)


CHANNEL = {
    "cym": Channel(
        "the eight digraphs — the consonant skeleton cynghanedd counts",
        ("ch", "dd", "ff", "ng", "ll", "ph", "rh", "th"),
        "chars", 20.0, "48.8–65.0 over the 7 shipped cym files",
        "cynghanedd is a consonant-skeleton constraint and the eight digraphs "
        "are single consonants; a text that has lost them has lost the "
        "channel even if every word is still a Welsh word",
        kind="digraph"),
    "non": Channel(
        "þ ð æ ǫ ø œ and the accented vowels — what a hending detector reads",
        "þðæǫøœáéíóúý", "chars", 10.0,
        "74.7–100.5 over cltk/non_texts prose and the clean Háttatal",
        "doctrine 52 exactly: the 1848 OCR reads fine and is CONSONANTALLY "
        "destroyed, which is precisely the channel hending uses"),
    "fin": Channel(
        "the vowel inventory a e i o u y ä ö — vowel harmony and the "
        "Kalevala alliteration both read it",
        "aeiouyäö", "chars", 300.0, "770.6–792.5 over the 11 shipped fin files",
        "ä and ö carry the harmony class; a diacritic-stripped Finnish text "
        "still reads as Finnish and no longer distinguishes the harmonic sets"),
    "msa": Channel(
        "the vowel inventory a e i o u — the pantun rhymes on the final rime",
        "aeiou", "chars", 200.0, "652.9 on the one shipped msa file",
        "the pantun constraint is a rime identity and the rime is a vowel plus "
        "a coda"),
    "san": Channel(
        "the IAST diacritics — vowel LENGTH is the metre",
        "āīūṛṝḷḹṃḥṅñṭḍṇśṣ", "chars", 40.0,
        "166.7–252.1 over the 3 shipped san files",
        "Sanskrit metre is quantitative: an ASCII-fied text that writes `a` "
        "for both `a` and `ā` has destroyed the constraint while remaining "
        "perfectly legible"),
    "fas": Channel(
        "Perso-Arabic letters — the qafiya and the radif are orthographic",
        tuple(chr(c) for c in range(0x0600, 0x0700)) +
        tuple(chr(c) for c in range(0x0750, 0x0780)) +
        tuple(chr(c) for c in range(0xFB50, 0xFC00)),
        "chars", 300.0, "763.7 on fas_hafez_ganjoor.txt",
        "a transliterated Persian text cannot be matched against a "
        "Perso-Arabic radif at all"),
    "eng": Channel(
        "the vowel letters — CMUdict is keyed on spelling",
        "aeiou", "chars", 200.0, "434.3–623.2 over the 143 shipped eng files",
        "the English channel is the CMUdict lookup, and the lookup is keyed on "
        "the written word"),
    "ltc": Channel(
        "tone-bearing characters — 平/仄 and the rhyme group, both lexicalised",
        (_ltc_tone_bearing,), "cjk", 500.0,
        "807.7–833.5 per 1000 CJK over the shipped ltc files",
        "the rime book is the channel; a character the table cannot read has "
        "no tone class and no rhyme group, so it is mute to the constraint",
        kind="callable"),
    "som": Channel(
        "the 1972 Latin vowel inventory — Somali metre is quantitative",
        "aeiou", "chars", 200.0, "no shipped som file; floor by analogy to msa",
        "Somali scansion counts morae, which are vowel lengths"),
}


# ---------------------------------------------------------------------------
# 4. THE ORTHOGRAPHY PROBES — doctrines 50 and 70, generalised
#
# Every probe is a pair of ALTERNANT SPELLING SETS that write the same sound,
# one of which the constraint can read and one of which it cannot.  Malay's
# `-ung`/`-uk` against `-ong`/`-ok` is ONE ROW of this table, not a special
# case, and it is the row whose numbers are already pinned by doctrine 70.
#
# The verdict is a RATIO and never a bare zero: doctrine 79's Malay lesson is
# that `-uk` is 0 on the 513-line extract and 2 on the 330 blocks it was cut
# from, so a probe reports its population in the same breath as its counts.
# ---------------------------------------------------------------------------


#: Two kinds of probe, and the difference decides whether a majority for the
#: destroying side is a DEFECT or only a habit.
#:
#:   "alternant"  the two sides write the SAME sound, so one of them is a
#:                modernisation and a majority for the destroying side means
#:                the constraint has been destroyed.  FAIL.
#:   "habit"      the destroying side is also a legitimate independent form in
#:                its own right (English `never` is not always a modernised
#:                `ne'er`), so the ratio is evidence about the EDITION's habit
#:                and never proof on its own.  NOTE, never FAIL.
#:
#: Stated because the alternative — quietly using one threshold for both — is
#: how an auditor manufactures findings, which is worse than missing them.
ALTERNANT = "alternant"
HABIT = "habit"


class Probe:

    def __init__(self, name, destroys, preserves, why, doctrine,
                 rule="word-final letter string", vowel_break=False,
                 mode=ALTERNANT, whole_token=False, token_pattern=None):
        self.name = name
        self.destroys = tuple(destroys)   # spellings the constraint cannot read
        self.preserves = tuple(preserves)  # spellings it can
        self.why = why
        self.doctrine = doctrine
        self.rule = rule
        self.mode = mode
        self.whole_token = whole_token
        #: THE TOKENISATION IS A COORDINATE OF THE COUNT, and doctrine 70's
        #: amendment cost a round to exactly that: three documents quoted three
        #: different `-ong` figures and the thing nobody had written down was
        #: the tokenisation.  So a probe may carry its own, and where the
        #: repo has ALREADY recorded a rule beside a number, the probe uses
        #: that rule and not the module's default.
        #:
        #: Measured cost of getting this wrong, on the one file it applies to:
        #: the module default reads `munchong-'kau` as `munchong` + `kau` and
        #: counts 39 `-ong`; doctrine 70's rule keeps the hyphen inside the
        #: token and counts 38.  One token, and it is the difference between
        #: reproducing the record and quietly disagreeing with it.
        self.token_pattern = token_pattern
        #: doctrine 70's load-bearing restriction: `gaung`, `lauk`, `bernaung`
        #: end in the bare letter string and have the diphthong /au/ as their
        #: nucleus, which is a different vowel and not what the probe is about.
        self.vowel_break = vowel_break

    def _final(self, toks, suffix):
        if self.whole_token:
            return [w for w in toks if w == suffix]
        hits = []
        for w in toks:
            if not w.endswith(suffix) or len(w) <= len(suffix):
                continue
            if self.vowel_break and w[-len(suffix) - 1] in "aeiou":
                continue
            hits.append(w)
        return hits

    def measure(self, toks):
        d = {s: self._final(toks, s) for s in self.destroys}
        p = {s: self._final(toks, s) for s in self.preserves}
        return {
            "destroys": {k: (len(v), len(set(v))) for k, v in d.items()},
            "preserves": {k: (len(v), len(set(v))) for k, v in p.items()},
            "destroys_total": sum(len(v) for v in d.values()),
            "preserves_total": sum(len(v) for v in p.values()),
            "destroys_types": sorted(set(w for v in d.values() for w in v))[:8],
        }


class CharProbe(Probe):
    """Same contract, counted over characters rather than word finals — for the
    probes whose alternants are single glyphs (`ö` for `ǫ`/`ø`, `ي` for `ی`)."""

    def _final(self, toks, s):
        joined = chr(32).join(toks)
        return [s] * joined.count(s)


class SubstringProbe(Probe):
    """Counted over word-internal substrings — for the transliteration schemes
    that write a diacritic as a DIGRAPH (`aa` for `ā`, `~n` for `ñ`), which is
    a property of the middle of a word and not of its end."""

    def _final(self, toks, s):
        return [w for w in toks if s in w]


PROBE = {
    "msa": Probe(
        "Ejaan Rumi Baharu -ung/-uk against 1900 Straits -ong/-ok",
        ("ung", "uk"), ("ong", "ok"),
        "Malay /u/ and /i/ LOWER to [o] and [e] in a final closed syllable, so "
        "the 1900 spelling writes the SURFACE form and the modern standard "
        "restored the underlying phoneme. Rhyme is a fact about surface "
        "sound, so the OLDER spelling is the better guide",
        "70", rule="final syllable nucleus o/u + coda ng/k, the vowel NOT "
                   "preceded by another vowel; tokens are maximal runs of "
                   "[A-Za-z'`’-], lowercased, over verse lines only "
                   "(doctrine 70's amended rule, verbatim)",
        vowel_break=True, token_pattern=re.compile(r"[A-Za-z'`’-]+")),
    "non": Probe(
        "Modern Icelandic epenthetic -ur against Old Norse -r",
        ("ur", "ir"), ("r",),
        "modernised Icelandic inserts an epenthetic vowel (Lætr -> Lætur), "
        "which adds a syllable and breaks the six-syllable dróttkvætt line, "
        "so the hending POSITIONS become unrecoverable",
        "50"),
    "cym": Probe(
        "pre-1588 / semi-phonetic Welsh against the standard digraphs",
        ("dh", "vh"), ("dd", "ff"),
        "cynghanedd reads the digraphs as single consonants; an edition that "
        "writes `dh` for `dd` is legible and unreadable to the constraint",
        "50"),
    "fin": Probe(
        "<w> for <v> — one phoneme, two glyphs, MIXED inside one book (M-5)",
        ("w",), ("v",),
        "Finnish alliteration is onset identity; a book that writes both `w` "
        "and `v` for /v/ makes two alliterating onsets look like one that "
        "does not",
        "50", rule="word-INITIAL glyph"),
    "san": SubstringProbe(
        "Harvard-Kyoto / Velthuis doubling against IAST macrons",
        ("aa", "ii", "uu", "~n", "\"n", ".r", ".t", ".d", "sh"),
        ("ā", "ī", "ū", "ṛ", "ṭ", "ḍ", "ś", "ṣ", "ñ"),
        "Sanskrit metre is quantitative and the diacritic IS the quantity. A "
        "transliteration that writes `aa` for `ā` keeps the quantity and is "
        "readable; one that writes plain `a` for both has destroyed it, and "
        "check F's channel count is what sees that case",
        "50", rule="substring anywhere in the token"),
    "fas": CharProbe(
        "Arabic ي ك against Persian ی ک",
        ("ي", "ك"), ("ی", "ک"),
        "the radif is matched as an orthographic string; a text normalised to "
        "Arabic letterforms will not match a Persian-form radif and the "
        "failure is silent",
        "50", rule="character count over the verse text"),
    "eng": Probe(
        "regularised full forms against the printed elisions",
        ("over", "ever", "never", "heaven", "power", "flower"),
        ("o'er", "e'er", "ne'er", "heav'n", "pow'r", "flow'r",
         "o’er", "e’er", "ne’er"),
        "the elision apostrophe IS the syllable count: `pour'd` and `o'er` are "
        "one syllable where `poured` and `over` are scanned as two, so "
        "regularising an 18th-century songbook silently adds a beat per line",
        "50", rule="whole-token match on a closed list of six pairs",
        mode=HABIT, whole_token=True),
}

#: `fin`'s probe is word-INITIAL, not word-final; declared here rather than
#: bolted into `Probe` so the exception is visible.
_INITIAL_PROBES = {"fin"}


def _measure_probe(probe, lang, toks):
    if lang in _INITIAL_PROBES:
        d = {s: [w for w in toks if w.startswith(s)] for s in probe.destroys}
        p = {s: [w for w in toks if w.startswith(s)] for s in probe.preserves}
        return {
            "destroys": {k: (len(v), len(set(v))) for k, v in d.items()},
            "preserves": {k: (len(v), len(set(v))) for k, v in p.items()},
            "destroys_total": sum(len(v) for v in d.values()),
            "preserves_total": sum(len(v) for v in p.values()),
            "destroys_types": sorted(set(w for v in d.values() for w in v))[:8],
        }
    return probe.measure(toks)


# ---------------------------------------------------------------------------
# 5. Script census — what stands in the channel's place
# ---------------------------------------------------------------------------

_BLOCKS = [
    (0x0041, 0x007A, "Basic Latin letters"),
    (0x00C0, 0x024F, "Latin-1/Extended"),
    (0x0370, 0x03FF, "Greek"),
    (0x1F00, 0x1FFF, "Greek Extended"),
    (0x0400, 0x04FF, "Cyrillic"),
    (0x0590, 0x05FF, "Hebrew"),
    (0x0600, 0x06FF, "Arabic"),
    (0x0900, 0x097F, "Devanagari"),
    (0x1E00, 0x1EFF, "Latin Extended Additional"),
    (0x3400, 0x9FFF, "CJK"),
    (0xFB50, 0xFDFF, "Arabic Presentation Forms"),
]


def script_census(text):
    out = collections.Counter()
    for c in text:
        if not c.isalpha():
            continue
        cp = ord(c)
        for lo, hi, name in _BLOCKS:
            if lo <= cp <= hi:
                out[name] += 1
                break
        else:
            out["other"] += 1
    return out


# ---------------------------------------------------------------------------
# 6. Readability under the declared phonology
# ---------------------------------------------------------------------------

#: The measured baseline that makes check D weak.  Recomputed by
#: `--baseline`; pinned here so a reader of the output knows what 95.8% means
#: before believing a 96% as confirmation.
CROSS_LANGUAGE_BASELINE = {
    "cym": 0.958, "fin": 0.997, "non": 0.789, "san": 0.717, "msa": 0.672,
}

#: Sampling: every k-th token so the sample SPANS the file.  Taking the first N
#: would sample the first poems only, which for a staged anthology is one
#: author out of forty.
SAMPLE_CAP = 6000


def _sample(seq, cap=SAMPLE_CAP):
    if len(seq) <= cap:
        return seq, 1
    k = (len(seq) + cap - 1) // cap
    return seq[::k], k


def readability(cf, lang):
    """-> dict.  The rule is declared per language because the languages do not
    agree on what 'readable' means, and pretending they do is the monoculture
    error in miniature.

      default   `syllabify` returns a non-empty parse
      fas       `in_inventory` — a SCRIPT test.  Persian syllabification is
                genuinely indeterminate without the vowels and refuses on 2 of
                3 tokens by design, so `syllabify` here would measure the
                orthography's ambiguity and report it as illegibility
      ltc       the rime table answered, directly or through the 異體 map
    """
    try:
        from quality import phonology as P
    except Exception as e:                                   # pragma: no cover
        return {"rule": "unavailable", "error": str(e)}
    if lang not in ("cym", "fin", "non", "msa", "san", "fas", "eng", "ltc",
                    "som"):
        return {"rule": "no declared phonology", "read": None}
    toks = cf.tokens(lang=lang)
    if not toks:
        return {"rule": "no tokens", "read": None, "total": 0}
    sample, stride = _sample(toks)
    if lang == "fas":
        from quality.phonology import fas as _fas
        norm = _fas.tokens(" ".join(sample))
        ok = sum(1 for w in norm if _fas.in_inventory(w))
        return {"rule": "fas.in_inventory (script test)", "total": len(norm),
                "read": ok, "rate": ok / max(1, len(norm)), "stride": stride}
    if lang == "ltc":
        from quality.phonology import ltc as _ltc
        m = _ltc.MiddleChinese()
        ok = sum(1 for c in sample if m.refusal(c) is None)
        return {"rule": "ltc rime-table lookup", "total": len(sample),
                "read": ok, "rate": ok / max(1, len(sample)), "stride": stride}
    ph = P.get(lang)
    ok = 0
    for w in sample:
        try:
            if ph.syllabify(w):
                ok += 1
        except Exception:
            pass
    return {"rule": "%s.syllabify non-empty" % lang, "total": len(sample),
            "read": ok, "rate": ok / max(1, len(sample)), "stride": stride}


# ---------------------------------------------------------------------------
# 7. THE CHECKS
# ---------------------------------------------------------------------------


#: A row may name a corpus path DELIBERATELY without one existing: a refused
#: source (doctrine 85), a recorded failed search (doctrine 39), or a file
#: deleted for cause (verse.txt).  In all three the absence IS the record, and
#: an auditor that reports it as a defect is punishing the table for working.
_ABSENT_ON_PURPOSE = (
    ("REJECTED", "rejected"), ("REFUSED", "refused"), ("REMOVED", "removed"),
    ("DELETED", "deleted"), ("NOT FOUND", "not found"),
    ("NOT-FOUND", "not found"), ("UNREACHABLE", "unreachable"),
)


def _declared_absent(blob):
    up = blob.upper()
    for marker, word in _ABSENT_ON_PURPOSE:
        if marker in up:
            return word
    return None


def check_row(files, src):
    """A · doctrine 34, in both directions."""
    out = []
    for rel, cf in files:
        route, sid = src.route(cf, rel)
        if route == ROUTE_NONE:
            out.append(Finding(
                "A", FAIL, rel,
                "no data/sources.tsv row reaches this file by any of the three "
                "declared routes",
                "routes tried: local:%s | header names a parent source_id | "
                "any row's prose naming the path" % rel,
                "a file with no row never passed the provenance gate; this is "
                "the rule verse.txt was deleted for",
                "34"))
        elif route == ROUTE_MENTION:
            out.append(Finding(
                "A", NOTE, rel,
                "reached only by prose mention, not by a row of its own nor by "
                "a header naming a parent",
                "row: %s" % sid,
                "the weakest of the three routes: it survives only as long as "
                "somebody keeps writing the path into a note",
                "34"))
    # the other direction
    named = src.named_paths()
    have = {rel for rel, _ in files}
    for sid, paths in sorted(named.items()):
        absent = _declared_absent(src.blobs.get(sid, ""))
        for p in sorted(paths):
            if p in have:
                continue
            if any(h.startswith(p) for h in have):
                continue                      # a family prefix, not a claim
            if absent:
                out.append(Finding(
                    "A", NOTE, p,
                    "row names a corpus path that does not exist — and the row "
                    "says why (%s)" % absent,
                    "row: %s" % sid,
                    "doctrine 39: a search that found nothing, or a source "
                    "that was refused, is a FINDING about the world and its "
                    "row is supposed to name the path the material would have "
                    "occupied. This is the record working, not failing",
                    "39"))
                continue
            out.append(Finding(
                "A", WARN, p,
                "row names a corpus path that does not exist",
                "row: %s" % sid,
                "a row naming nothing is a claim about a population that is "
                "not in this tree",
                "34"))
    for sid in sorted(src.by_id):
        if not sid.startswith("local:"):
            continue
        p = sid[len("local:"):]
        if not p.startswith("corpus/"):
            continue
        if p not in have:
            out.append(Finding(
                "A", FAIL, p,
                "local: row declares a corpus file that is not on disk",
                "row: %s" % sid, "the row is the file's only declaration", "34"))
    return out


_LICENCE_WORDS = ("public domain", "cc0", "cc by", "cc-by", "mit", "gpl",
                  "bsd", "non-commercial", "model-generated", "synthetic")


def check_header(files, src):
    """B · the file's own header against its row, and against itself."""
    out = []
    for rel, cf in files:
        route, sid = src.route(cf, rel)
        row = src.by_id.get(sid) if sid else None
        fields = cf.header_fields()
        headless = not cf.header_lines
        if headless:
            out.append(Finding(
                "B", WARN, rel, "no `#` header at all",
                "%d bytes, %d verse lines" % (len(cf.raw), len(cf.verse_lines)),
                "the header is where the edition, the orthography and the "
                "extraction rule live; without it the row is the only witness",
                "34"))

        # -- licence -------------------------------------------------------
        if row is not None and not headless:
            hl = (fields.get("licence") or fields.get("license") or "").lower()
            rl = (row.get("licence") or "").lower()
            if hl and rl:
                hw = {w for w in _LICENCE_WORDS if w in hl}
                rw = {w for w in _LICENCE_WORDS if w in rl}
                if hw and rw and not (hw & rw):
                    out.append(Finding(
                        "B", FAIL, rel,
                        "header licence and row licence name different regimes",
                        "header %s | row %s (%s)" % (sorted(hw), sorted(rw), sid),
                        "doctrine 54: a licence name without a scope is not "
                        "evidence, and two names is worse than none",
                        "54"))
            elif rl and not hl:
                out.append(Finding(
                    "B", NOTE, rel, "row states a licence, header does not",
                    "row licence: %s" % (row.get("licence") or "")[:60],
                    "the file travels without its own terms", "54"))

        # -- upstream md5 --------------------------------------------------
        #
        # THE PARENT ROW, NOT THE FILE'S OWN ROW.  A `local:` row records the
        # md5 of the STAGED bytes; the header records the md5 of the UPSTREAM
        # bytes it was cut from.  Comparing the two is comparing an extract to
        # its source and calling the difference a defect — which is doctrine
        # 79's error committed by the instrument built to find it.  The first
        # version of this check did exactly that and reported 8 false FAILs.
        hm = cf.header_md5s()
        psid = src.parent_of(cf)
        if hm and psid:
            blob = src.blobs.get(psid, "")
            rm = set(re.findall(r"md5\s+([0-9a-f]{32})", blob))
            if rm and not (hm & rm):
                out.append(Finding(
                    "B", FAIL, rel,
                    "header names an upstream md5 its parent row does not",
                    "header %s | parent row %s: %s"
                    % (sorted(hm)[:3], psid, sorted(rm)[:3]),
                    "the file and the row for the source it came from "
                    "disagree about which bytes that source is; one of the "
                    "two has been edited without the other",
                    "34"))

        # -- language ------------------------------------------------------
        lang, how = declared_language(cf, rel)
        rlang = row_language(row)
        if lang and rlang and lang != rlang:
            out.append(Finding(
                "B", WARN, rel,
                "filename declares one language, the row's note another",
                "file %s (%s) | row %s" % (lang, how, rlang),
                "the two are not the same namespace: the table carries `en` "
                "beside `eng`, `fi` beside `fin`, `lzh` beside `ltc`",
                "34"))
        if lang is None:
            out.append(Finding(
                "B", NOTE, rel, "no declared language",
                "no `# lang:` header and the filename prefix %r is not a "
                "declared phonology" % os.path.basename(rel).split("_")[0],
                "checks D, F and G all key on the declared language, so an "
                "undeclared file is unaudited by three of seven checks",
                "44"))

        # -- the header's own counts ---------------------------------------
        out.extend(_check_declared_counts(rel, cf, fields))
    return out


#: A header FIELD — `# songs: 6` on its own line, nothing else — and the thing
#: it is counted against.  Restricted to fields on purpose, and the restriction
#: is the whole design of this check.
#:
#: THE FIRST VERSION OF THIS CHECK SCANNED THE WHOLE HEADER FOR `N songs` AND
#: PRODUCED 33 FAILURES OF WHICH 30 WERE ITS OWN.  `cym_song_alun.txt` says
#: "(3 hymns + 3 songs; the free-metre half of Gwaith Alun" — a description of
#: the volume, not a count of the file, whose `# songs:` field says 6 and is
#: right.  `fas_attar.txt` says "852 ghazals in the source; 284 staged" and the
#: 852 is the SOURCE's population, correctly labelled.  `ltc_huajianji.txt`
#: says "Its 50 songs are present" about one 卷 of twelve.
#:
#: An auditor that reads a prose sentence as a claim about the file is
#: manufacturing findings, and manufacturing findings is worse than missing
#: them, because a reader cannot tell the two apart from the output.  So this
#: check reads DECLARATIONS — a field, or the one prose form (`N staged`) that
#: names its population unambiguously — and everything else is left alone with
#: that decision written down here rather than silently taken.
_COUNT_FIELDS = {
    "songs": "titles", "ci": "titles", "ghazals": "titles",
    "quatrains": "titles", "poems": "titles", "sonnets": "titles",
    "lines": "verse",
}

_STAGED = re.compile(r"(\d[\d,]*)\s+staged\b")


def _check_declared_counts(rel, cf, fields):
    """Does the header's own DECLARED count survive counting?

    Two units are checkable without knowing the extraction rule: the number of
    ITEMS (`--- TITLE:` blocks, which every staged file writes) and the number
    of VERSE LINES.  Anything else the header claims is a coordinate of a rule
    this module does not have, and it is left alone rather than guessed at.
    """
    out = []
    claims = []
    for key, kind in _COUNT_FIELDS.items():
        v = fields.get(key)
        if v and re.fullmatch(r"[\d,]+", v.strip()):
            claims.append((int(v.replace(",", "")), "# %s:" % key, kind))
    m = _STAGED.search(cf.header)
    if m:
        claims.append((int(m.group(1).replace(",", "")), "`N staged`",
                       "titles"))
    for n, where, kind in claims:
        got = cf.titles if kind == "titles" else len(cf.verse_lines)
        if kind == "titles" and cf.titles == 0:
            continue
        if n != got:
            out.append(Finding(
                "B", FAIL, rel,
                "header declares %d (%s); the file contains %d" % (n, where, got),
                "counted: %s" % ("`--- TITLE:` blocks" if kind == "titles"
                                 else "non-header non-marker non-blank lines"),
                "a declared count that does not survive counting is the M-18 "
                "shape: the number was measured over a population that is not "
                "this file",
                "79"))
    return out


def check_hash(files, src):
    """C · has the file drifted from its recorded hash — and is there one?"""
    out = []
    for rel, cf in files:
        route, sid = src.route(cf, rel)
        blob = src.blobs.get(sid, "") if sid else ""
        md5s = set(re.findall(r"md5\s+([0-9a-f]{32})", blob))
        shas = set(re.findall(r"sha256\s+([0-9a-f]{16,64})", blob))
        if route != ROUTE_LOCAL:
            out.append(Finding(
                "C", WARN, rel,
                "no hash of THIS file is recorded anywhere",
                "md5 %s (measured now); the parent row %s records the "
                "UPSTREAM bytes, not the staged ones" % (cf.md5, sid),
                "a staged file with no recorded hash cannot drift detectably; "
                "the exposure is silent corruption one step before it happens",
                "34"))
            continue
        if md5s:
            if cf.md5 in md5s:
                continue
            out.append(Finding(
                "C", FAIL, rel, "md5 drift from the recorded value",
                "recorded %s | measured %s" % (sorted(md5s)[:2], cf.md5),
                "the staged bytes are not the bytes the row was written "
                "about; every number derived from this file is now about a "
                "population nobody declared",
                "79"))
        elif shas:
            if any(cf.sha256.startswith(s) for s in shas):
                continue
            out.append(Finding(
                "C", FAIL, rel, "sha256 drift from the recorded value",
                "recorded %s | measured %s" % (sorted(shas)[:1], cf.sha256),
                "as above", "79"))
        else:
            out.append(Finding(
                "C", WARN, rel,
                "local: row records no hash of any kind",
                "md5 %s (measured now)" % cf.md5,
                "the row declares the file and cannot detect its corruption",
                "34"))
    return out


def check_language(files, src):
    """D · the declared language against the readable fraction.

    The SCRIPT test.  Read the module docstring before reading the numbers:
    English is 95.8% readable as Welsh, so a high rate here is not evidence
    that the label is right — only a low one is evidence that it is wrong.
    """
    out = []
    for rel, cf in files:
        lang, how = declared_language(cf, rel)
        if not lang:
            continue
        r = readability(cf, lang)
        rate = r.get("rate")
        if rate is None:
            continue
        if rate < 0.20:
            sev, word = FAIL, "unreadable"
        elif rate < 0.60:
            sev, word = WARN, "barely readable"
        else:
            continue
        cen = script_census(cf.verse_text).most_common(4)
        out.append(Finding(
            "D", sev, rel,
            "declared %s and %s under it" % (lang, word),
            "%.1f%% of %d sampled tokens (rule: %s; stride %d)" % (
                100 * rate, r["total"], r["rule"], r.get("stride", 1)),
            "script census: %s" % ", ".join("%s %d" % (k, v) for k, v in cen),
            "50"))
    return out


#: An item shorter than this is a couplet or a refrain and will collide by
#: chance across a hymnal; four lines is the shortest stanza the corpus treats
#: as an item, and at four lines the census finds exactly ten collisions in
#: 25,142 items, none of them accidental.
ITEM_MIN_LINES = 4


def _items(cf):
    """-> [(title, [body lines])].  The `--- TITLE:` block is the unit every
    staged file in this corpus writes."""
    cur, body, out = None, [], []
    for l in cf._lines:
        s = l.rstrip()
        if s.startswith("--- TITLE:"):
            if cur is not None:
                out.append((cur, body))
            cur, body = s[10:].strip(), []
        elif cur is not None and s.strip() and not _MARKER.match(s):
            body.append(s.strip())
    if cur is not None:
        out.append((cur, body))
    return out


# ---------------------------------------------------------------------------
# E's second unit: the item that is in the corpus TWICE without being in it
# twice byte-for-byte.
# ---------------------------------------------------------------------------

_NOT_WORD = re.compile(r"[^a-z0-9 ']+")


def _norm_line(s):
    """Doctrine 26 first (U+2019 is an apostrophe), then everything an EDITION
    is free to change: case, punctuation, spacing.  What survives is the words,
    which is what makes the same poem in two printings one poem."""
    s = unicodedata.normalize("NFC", s).replace("’", "'")
    return " ".join(_NOT_WORD.sub(" ", s.lower()).split())


#: A line shorter than this collides by chance ("and so am I", "O Lord!").
ITEM_LINE_MIN_CHARS = 12
#: An item with fewer distinct long lines than this is too small to judge.
ITEM_SIG_MIN = 8
#: How many distinct long lines two items must SHARE before the pair is
#: reported at all.  Both this and the containment floor are cuts, so both are
#: swept in quality/test_corpus_audit.py rather than asserted.
ITEM_SHARED_MIN = 8

#: Containment of the SMALLER item's line set in the larger.  Containment and
#: not Jaccard, because a run-on item legitimately dwarfs the poem inside it.
#:
#: THE CUT IS DECLARED AND THE SERIES IS RECORDED, because 0.60 is an
#: uncalibrated threshold and doctrine 16 says one of those fails toward
#: whoever guessed.  Measured over the 143 `eng_*` files on 2026-08-11 BEFORE
#: this round's deletions, at ITEM_SHARED_MIN 8:
#:
#:      cut   pairs  within  cross
#:      0.30    103      99      4
#:      0.40    103      99      4
#:      0.50     99      95      4
#:      0.60     94      91      3
#:      0.70     76      74      2
#:      0.80     62      62      0
#:      0.90     29      29      0
#:      1.00      6       6      0
#:
#: The curve is FLAT from 0.30 to 0.60 and falls after: the population is real
#: duplication, not threshold-manufactured, and 0.60 is inside the plateau
#: rather than on its edge.  It is not free of consequences either — the fourth
#: CROSS-FILE pair lives between 0.50 and 0.60 (Eliza Cook's `The Old Arm-Chair`
#: also under the composer Henry Russell, at 0.50 because the Russell copy is a
#: RUN-ON with a second song glued to it), so the guessed cut hid one live
#: attribution error.  That is doctrine 16 with a name.
ITEM_OVERLAP_FLOOR = 0.60

#: A shared line that occurs in more than this many items is a formula
#: ("Glory be to the Father"), not evidence that two items are one poem.
ITEM_LINE_UBIQUITY = 40


def _item_signatures(files, prefix=None):
    """-> [(rel, index, title, body, {normalised long lines})]."""
    recs = []
    for rel, cf in files:
        if prefix and os.path.basename(rel).split("_")[0] not in prefix:
            continue
        for i, (title, body) in enumerate(_items(cf)):
            sig = {n for n in (_norm_line(l) for l in body)
                   if len(n) > ITEM_LINE_MIN_CHARS}
            if len(sig) >= ITEM_SIG_MIN:
                recs.append((rel, i, title, body, sig))
    return recs


def item_overlap_pairs(recs, floor=ITEM_OVERLAP_FLOOR,
                       shared_min=ITEM_SHARED_MIN):
    """Every pair of items above the cut, blocked on an inverted index so this
    is O(shared lines) rather than O(items^2) — 4,700 items would otherwise be
    11 million comparisons on every audit run."""
    inv = collections.defaultdict(list)
    for k, r in enumerate(recs):
        for l in r[4]:
            inv[l].append(k)
    cand = collections.Counter()
    for ks in inv.values():
        if len(ks) > ITEM_LINE_UBIQUITY:
            continue
        for a in range(len(ks)):
            for b in range(a + 1, len(ks)):
                cand[(ks[a], ks[b])] += 1
    out = []
    for (i, j), inter in cand.items():
        if inter < shared_min:
            continue
        a, b = recs[i], recs[j]
        small, big = (a, b) if len(a[4]) <= len(b[4]) else (b, a)
        cont = inter / len(small[4])
        if cont >= floor:
            out.append((cont, inter, small, big))
    out.sort(key=lambda t: (-t[0], -t[1]))
    return out


#: A body line at or before this position is the item's OPENING, so a match
#: there is the same poem titled two ways, not a second poem glued on.
TITLE_ECHO_HEAD = 3


def false_unit_items(files):
    """-> [(rel, index, title, n_body, shape, [(position, line, other title)])].

    A `--- TITLE:` item is a FALSE UNIT when it contains, as a body line, the
    TITLE of a DIFFERENT item in the same file.  One signal, three shapes:

      CONTENTS PAGE half or more of the body lines are other items' titles:
                    a table of contents staged as if it were verse.
      RUN-ON        a match past the item's opening with a poem's worth of
                    body still to come — the extractor missed a section break
                    and glued the next poem onto the end of this one.  The
                    item then misreports its own line count, its scheme and
                    the file's `# songs:`, and NO HASH SEES IT, which is why
                    this is here and not in a one-off script.
      TITLE ECHO    a match in the item's first lines: the same poem is staged
                    twice, once under its subject heading and once under its
                    first line.  Reported at NOTE because the near-duplicate
                    pair check above already carries it.

    The file's own titles are the reference, so the check calibrates itself
    against the extraction it is auditing rather than against a word list."""
    out = []
    for rel, cf in files:
        its = _items(cf)
        by_title = collections.defaultdict(list)
        for i, (title, _) in enumerate(its):
            n = _norm_line(title)
            if len(n) >= 12:
                by_title[n].append(i)
        for i, (title, body) in enumerate(its):
            hits = []
            for k, l in enumerate(body):
                if k == 0:
                    continue
                for j in by_title.get(_norm_line(l), ()):
                    if j != i:
                        hits.append((k, l, its[j][0]))
                        break
            if not hits:
                continue
            if len(hits) >= 0.5 * max(1, len(body)):
                shape = "CONTENTS PAGE staged as verse"
            elif any(k >= TITLE_ECHO_HEAD
                     and len(body) - k > ITEM_MIN_LINES for k, _, _ in hits):
                shape = "RUN-ON — a missed section break"
            else:
                shape = "TITLE ECHO — one poem staged under two titles"
            out.append((rel, i, title, len(body), shape, hits))
    return out


def check_distinct(files, src, overlap_floor=0.60):
    """E · doctrine 51 — count DISTINCT BYTES, not distinct names."""
    out = []
    by_md5 = collections.defaultdict(list)
    for rel, cf in files:
        by_md5[cf.md5].append(rel)
    for h, names in sorted(by_md5.items()):
        if len(names) > 1:
            out.append(Finding(
                "E", FAIL, names[0],
                "%d files are byte-identical — ONE source wearing %d names"
                % (len(names), len(names)),
                "md5 %s: %s" % (h, ", ".join(sorted(names))),
                "doctrine 51: agreement between two copies of one file is not "
                "corroboration, and it is harder to see than agreement "
                "between two URLs because the paths really are different",
                "51"))

    # ITEM-level duplication — the sharpest form of doctrine 51 this corpus
    # admits, and the one that found both of its live instances.  Every staged
    # file writes `--- TITLE:` blocks, so an item body is a natural unit; two
    # files carrying the SAME body are two names for one text, and every
    # per-author statistic over them counts that text twice.
    #
    # Whole-file md5 identity (above) is the case doctrine 51 was written
    # about.  This is the case doctrine 51 does not cover and this corpus
    # actually has: files that are NOT byte-identical and share their contents
    # anyway, because the source volume was a JOINT one and the extraction
    # split a joint attribution into two authors.
    by_body = collections.defaultdict(list)
    for rel, cf in files:
        for title, body in _items(cf):
            if len(body) < ITEM_MIN_LINES:
                continue
            h = hashlib.md5("\n".join(body).encode("utf-8")).hexdigest()
            by_body[h].append((rel, title, len(body)))
    shared = collections.defaultdict(list)
    for h, where in by_body.items():
        names = sorted(set(w[0] for w in where))
        if len(names) > 1:
            shared[tuple(names)].append(where[0])
    for names, its in sorted(shared.items()):
        lines = sum(i[2] for i in its)
        out.append(Finding(
            "E", FAIL, names[0],
            "%d item bodies are byte-identical across %s"
            % (len(its), " and ".join(names)),
            "%d duplicated body lines. Items: %s"
            % (lines, "; ".join("%s (%d lines)" % (i[1][:44], i[2])
                                for i in its[:10])),
            "two names for one text. Doctrine 51 was written about two URLs "
            "serving one file; this is the harder case — the files are NOT "
            "byte-identical, they share their CONTENTS, and the usual cause "
            "is a joint or anonymous source volume whose attribution the "
            "extraction had to invent",
            "51"))

    # line-level overlap.  Cheap and one-sided: hash the verse lines of each
    # file, and report a pair whose SMALLER line set is mostly contained in the
    # larger.  Containment, not Jaccard, because the case this is looking for
    # is an EXTRACT and its SOURCE, whose sizes differ by a factor of seven.
    sig = []
    for rel, cf in files:
        lines = {hash(l.strip()) for l in cf.verse_lines if len(l.strip()) > 12}
        if len(lines) >= 8:
            sig.append((rel, lines))
    for i in range(len(sig)):
        for j in range(i + 1, len(sig)):
            a, sa = sig[i]
            b, sb = sig[j]
            small, big = (sa, sb) if len(sa) <= len(sb) else (sb, sa)
            sname, bname = (a, b) if len(sa) <= len(sb) else (b, a)
            inter = len(small & big)
            cont = inter / max(1, len(small))
            if cont >= overlap_floor and inter >= 8:
                out.append(Finding(
                    "E", WARN, sname,
                    "%.0f%% of this file's distinct verse lines also appear in "
                    "%s" % (100 * cont, bname),
                    "%d of %d lines shared; the larger file has %d"
                    % (inter, len(small), len(big)),
                    "an extract and the file it was cut from are one source, "
                    "and any statistic quoted over 'both' double-counts",
                    "51"))

    # ITEM-level NEAR duplication.  Everything above this line is a hash: two
    # files with one md5, two item bodies with one md5, or a line set compared
    # as a set of `hash(str)`.  That unit is the defect this block closes —
    # the SAME POEM IN TWO PRINTINGS is one poem counted twice, and no hash
    # sees it, because an editor's comma moved.
    #
    # Every rate this project has quoted over corpus/song/ was computed over
    # text that is in it more than once, and the bias does not cancel: cell W
    # removed 819 duplicated lines and the unreadable-end-word rate went UP,
    # 5.2677% -> 5.2873%, because only 6 of the 819 had an unreadable end word.
    # Duplicated material is not a random sample of the corpus.  Doctrine 13's
    # neighbourhood: an item counted twice is not independent of itself.
    recs = _item_signatures(files)
    pairs = item_overlap_pairs(recs)
    cross = collections.defaultdict(list)
    within = collections.defaultdict(list)
    for cont, inter, small, big in pairs:
        if small[0] == big[0]:
            within[small[0]].append((cont, inter, small, big))
        else:
            cross[tuple(sorted((small[0], big[0])))].append(
                (cont, inter, small, big))
    for names, ps in sorted(cross.items()):
        lines = sum(len(p[2][3]) for p in ps)
        out.append(Finding(
            "E", FAIL, names[0],
            "%d item%s appear%s in BOTH %s and %s at >=%.0f%% line containment"
            % (len(ps), "" if len(ps) == 1 else "s",
               "s" if len(ps) == 1 else "", names[0], names[1],
               100 * ITEM_OVERLAP_FLOOR),
            "%d duplicated body lines. %s"
            % (lines, "; ".join("%.0f%% %s | %s"
                                % (100 * c, s[2][:38], b[2][:38])
                                for c, _, s, b in ps[:8])),
            "THE SAME TEXT UNDER TWO AUTHORS IS AN ATTRIBUTION CLAIM, and one "
            "of the two is wrong. The item-body hash above catches this only "
            "when the two files quote the same EDITION; where they quote two "
            "printings the bytes differ and the claim survives unaudited. "
            "Decide it from the source, and where the source declines to "
            "decide say so in the file rather than attributing by elimination",
            "51"))
    for rel, ps in sorted(within.items()):
        lines = sum(len(p[2][3]) for p in ps)
        out.append(Finding(
            "E", WARN, rel,
            "%d pairs of items INSIDE this file are the same poem at >=%.0f%% "
            "line containment" % (len(ps), 100 * ITEM_OVERLAP_FLOOR),
            "%d duplicated body lines. %s"
            % (lines, "; ".join("%.0f%% %s | %s"
                                % (100 * c, s[2][:34], b[2][:34])
                                for c, _, s, b in ps[:6])),
            "A STAGING ERROR, not an attribution one: the extractor ran twice "
            "over one poem — under its first line and under its subject "
            "heading, or out of the poet's own volume and out of an anthology "
            "that reprints him. The file's `# songs:` count, every per-item "
            "scheme and every corpus-wide rate all count it twice",
            "51"))

    # RUN-ONS, CONTENTS PAGES and TITLE ECHOES — the item that is a FALSE UNIT.
    for rel, _i, title, nlines, shape, hits in false_unit_items(files):
        out.append(Finding(
            "E", NOTE if shape.startswith("TITLE ECHO") else WARN, rel,
            "item %r is a FALSE UNIT: %d of its %d body lines %s the title of "
            "another item in this file"
            % (title[:52], len(hits), nlines,
               "are" if len(hits) != 1 else "is"),
            "%s. At %s: %s"
            % (shape, ", ".join(str(h[0]) for h in hits[:6]),
               "; ".join("%r -> item %r" % (h[1][:40], h[2][:34])
                         for h in hits[:3])),
            "an item that is really two items misreports the item count, the "
            "per-item scheme and the file's `# songs:`, and NO HASH SEES IT. "
            "The file's own titles are the reference, so this calibrates "
            "against the extraction it audits rather than against a word list",
            "51"))
    return out


def check_channel(files, src):
    """F · doctrine 52 — the channel, not the general legibility."""
    out = []
    for rel, cf in files:
        lang, _ = declared_language(cf, rel)
        ch = CHANNEL.get(lang)
        if ch is None:
            continue
        n = ch.count(cf)
        d = ch.denominator(cf)
        if d == 0:
            continue
        rate = 1000.0 * n / d
        if n == 0:
            cen = script_census(cf.verse_text).most_common(5)
            out.append(Finding(
                "F", FAIL, rel,
                "ZERO occurrences of the %s channel" % lang,
                "0 of %d %s. Channel: %s" % (d, ch.unit, ch.name),
                "THE HÁTTATAL CASE. What stands in its place: %s. %s"
                % (", ".join("%s %d" % (k, v) for k, v in cen), ch.why),
                "52"))
        elif rate < ch.floor:
            out.append(Finding(
                "F", WARN, rel,
                "%s channel is thin: %.1f per 1000 %s, floor %.1f"
                % (lang, rate, ch.unit, ch.floor),
                "%d occurrences in %d %s (known good: %s)"
                % (n, d, ch.unit, ch.observed),
                ch.why, "52"))
    return out


def check_orthography(files, src):
    """G · doctrines 50 and 70 — the modernisation that destroys the channel."""
    out = []
    for rel, cf in files:
        lang, _ = declared_language(cf, rel)
        probe = PROBE.get(lang)
        if probe is None:
            continue
        if probe.token_pattern is not None:
            toks = [m.group(0).lower()
                    for m in probe.token_pattern.finditer(cf.verse_text)]
        else:
            toks = cf.tokens(lang=lang)
        if not toks:
            continue
        m = _measure_probe(probe, lang, toks)
        dt, pt = m["destroys_total"], m["preserves_total"]
        pop = "%d verse lines / %d tokens of %s" % (
            len(cf.verse_lines), len(toks), rel)
        if dt == 0 and pt == 0:
            continue
        if dt > pt:
            out.append(Finding(
                "G", FAIL if probe.mode == ALTERNANT else NOTE, rel,
                "%s: the constraint-DESTROYING spelling dominates%s"
                % (probe.name,
                   "" if probe.mode == ALTERNANT else
                   " — reported as a HABIT of the edition, not as proof: the "
                   "destroying side is also a legitimate form in its own "
                   "right"),
                "%d destroying vs %d preserving over %s | rule: %s | %s"
                % (dt, pt, pop, probe.rule, m["destroys"]),
                probe.why, probe.doctrine))
        elif dt > 0:
            out.append(Finding(
                "G", NOTE, rel,
                "%s: mixed orthography, ratio %.0f:1 in favour of the "
                "readable spelling" % (probe.name, pt / max(1, dt)),
                "%d destroying (%s) vs %d preserving over %s | rule: %s"
                % (dt, ", ".join(m["destroys_types"][:6]), pt, pop, probe.rule),
                probe.why + ". A ratio is the honest form of this claim; a "
                "flat zero would be a claim about the population, not the "
                "orthography",
                probe.doctrine))
        else:
            out.append(Finding(
                "G", NOTE, rel,
                "%s: ZERO destroying spellings — and the zero belongs to a "
                "POPULATION" % probe.name,
                "0 destroying vs %d preserving over %s | rule: %s"
                % (pt, pop, probe.rule),
                "doctrine 79: `-uk` is 0 on the 513-line Malay extract and 2 "
                "on the 330 blocks it was cut from. Say the population next "
                "to the zero, or the next reader inherits a zero that is true "
                "of a one-seventh extract",
                probe.doctrine))
    return out


CHECKS = collections.OrderedDict([
    ("A", ("ROW — every file has a sources.tsv row, every row a file", check_row)),
    ("B", ("HEADER — the file's own header against its row", check_header)),
    ("C", ("HASH — recorded bytes against present bytes", check_hash)),
    ("D", ("LANGUAGE — the declared phonology's readable fraction", check_language)),
    ("E", ("DISTINCT — doctrine 51, count distinct BYTES", check_distinct)),
    ("F", ("CHANNEL — doctrine 52, the channel not the legibility", check_channel)),
    ("G", ("ORTHOGRAPHY — doctrines 50/70, the destroying alternant", check_orthography)),
])


# ---------------------------------------------------------------------------
# 8. Loading a tree
# ---------------------------------------------------------------------------


def load(root=CORPUS_DIR, only=None, exts=(".txt", ".json")):
    files = []
    for dirpath, _, names in os.walk(root):
        for n in sorted(names):
            p = os.path.join(dirpath, n)
            if exts and not n.endswith(exts):
                continue
            rel = display_path(p)
            if only and not any(fnmatch.fnmatch(rel, o) or
                                fnmatch.fnmatch(n, o) for o in only):
                continue
            try:
                files.append((rel, CorpusFile(p)))
            except OSError:
                continue
    files.sort(key=lambda t: t[0])
    return files


def audit(root=CORPUS_DIR, checks=None, only=None, src=None):
    src = src or Sources()
    files = load(root, only=only)
    checks = checks or list(CHECKS)
    findings = []
    for c in checks:
        findings.extend(CHECKS[c][1](files, src))
    return files, findings


# ---------------------------------------------------------------------------
# 9. THE CALIBRATION SET — the errors we already know about
#
# Each case runs twice.  PLANTED is a fixture that carries the mechanism and
# travels with the test, so CI can run it with no network and no scratch tree.
# REAL is the actual bytes and the actual recorded figure, run only when the
# tree is reachable, and it is what proves the planted fixture is the same
# defect rather than a fixture built to pass.
# ---------------------------------------------------------------------------

#: Where the real trees were, in the session that found these.  A missing tree
#: is reported as UNREACHABLE, never as a pass (doctrine 49: a NOT-REACHABLE
#: row is a claim about the moment, not about the world).
SCRATCH = os.environ.get(
    "LYRIC_SCRATCH",
    "/tmp/claude-0/-home-user-CodexMusica/"
    "ecae3ae4-b12d-5692-b0fb-0857b53ab94f/scratchpad")

HATTATAL_OCR_DIR = os.path.join(SCRATCH, "eddasnorrasturlu01hafnuoft")
CLTK_A = os.path.join(SCRATCH, "non_texts", "Snorra-Edda", "haattatal.txtl")
CLTK_B = os.path.join(SCRATCH, "old_norse_texts_heimskringla", "Snorra-Edda",
                      "txt_files", "haattatal.txtl")
MALAY_SOURCE = os.path.join(SCRATCH, "src_msa", "raw_malay_magic.txt")

#: The recorded figures, quoted from the doctrines so the calibration is
#: against the RECORD and not against a fresh measurement of itself.
RECORDED = {
    "hattatal_pages": 121,
    "hattatal_greek": 3474,
    "cltk_md5": "c221b3761633838018e24ccf4e43e7fd",
    "malay_blocks": 705,
    "malay_block_lines": 5555,
    "malay_malay_blocks": 330,
    "malay_malay_lines": 3442,
    "malay_staged_uk": 0,
    "malay_source_uk": 2,
    "malay_staged_lines": 513,
    "malay_staged_ong": 38,
    "malay_staged_ok": 28,
}

_GREEK = [(0x0370, 0x03FF), (0x1F00, 0x1FFF)]


def _greek_count(text):
    return sum(1 for c in text
               if any(lo <= ord(c) <= hi for lo, hi in _GREEK))


def _plant(tmp):
    """Write the three fixtures.  Each one carries the MECHANISM of a known
    error, in the smallest text that still carries it."""
    os.makedirs(os.path.join(tmp, "corpus"), exist_ok=True)
    d = os.path.join(tmp, "corpus")

    # 1. the Háttatal consonant wipe.  Old Norse verse whose þ ð æ ǫ ø œ and
    #    accented vowels have all been replaced by Greek-block lookalikes,
    #    exactly as the 1848 OCR does: `jǫrð kann frelsa, fyrðum` prints as
    #    `jbrss kann frelsa, syrbum`, with Greek standing in.
    wiped = []
    for _ in range(40):
        wiped.append("jbrss kann srelsa, syrbum ω ῐ ΐ blri")
        wiped.append("Gbrla lit ek ίι Geitis garbi Ῑιρίι os sarbir")
    open(os.path.join(d, "non_hattatal_ocr1848.txt"), "w",
         encoding="utf-8").write(
        "# source: PLANTED CALIBRATION FIXTURE, not a corpus file\n"
        "# licence: n/a\n" + "\n".join(wiped) + "\n")

    # 2. the byte-identical cltk pair, under two names in two directories.
    body = ("# source: PLANTED CALIBRATION FIXTURE\n"
            "# licence: n/a\n"
            "Háttatal, er Snorri orti um Hákon konung ok Skúla hertoga\n"
            "Hvat eru hættir skáldskapar? Þrennt. Hverir?\n"
            "Setning, leyfi, fyrirboðning. Hvat er setning háttanna?\n") \
        + "\n".join("lætr sá er Hákun heitir hann rekkir lið bannat"
                    for _ in range(30)) + "\n"
    os.makedirs(os.path.join(d, "repo_a"), exist_ok=True)
    os.makedirs(os.path.join(d, "repo_b"), exist_ok=True)
    open(os.path.join(d, "repo_a", "non_haattatal.txt"), "w",
         encoding="utf-8").write(body)
    open(os.path.join(d, "repo_b", "non_haattatal_heimskringla.txt"), "w",
         encoding="utf-8").write(body)

    # 3. the Malay extract and the file it was cut from.  The extract has
    #    `-uk` 0; the source it was cut from has `-uk` 2, and the same source
    #    writes `telok` elsewhere.
    src_lines = []
    for i in range(60):
        src_lines.append("Chandrawasi burong sakti didalam awan %d" % i)
        src_lines.append("Sangat berkurong didalam telok anak elok")
    src_lines.append("Pergi ka teluk mandi di teluk")
    src_lines.append("Anak orang bertepuk tangan bertepuk")
    open(os.path.join(d, "msa_source_705blocks.txt"), "w",
         encoding="utf-8").write(
        "# source: PLANTED CALIBRATION FIXTURE\n# licence: n/a\n"
        + "\n".join(src_lines) + "\n")
    open(os.path.join(d, "msa_extract_staged.txt"), "w",
         encoding="utf-8").write(
        "# source: PLANTED CALIBRATION FIXTURE\n# licence: n/a\n"
        "# orthography: word-final -ung and -uk occur ZERO times\n"
        + "\n".join(src_lines[:40]) + "\n")
    return d


def _malay_blocks(path, min_indent=4):
    """Blocks are maximal runs of lines indented >= 4.  Skeat sets verse
    indented and his prose flush left.  Re-stated here rather than imported
    from the extraction script, because a calibration that shares code with
    the thing it calibrates proves nothing (doctrine 58's fresh-implementation
    rule)."""
    text = open(path, encoding="latin-1").read().replace("\r\n", "\n")
    out, cur = [], []
    for l in text.split("\n"):
        if l.strip() and (len(l) - len(l.lstrip(" "))) >= min_indent:
            cur.append(l.strip())
        else:
            if cur:
                out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


#: The two closed function-word lists that separate Skeat's Malay from his own
#: English translation, printed in the same indented style one after the other.
_MALAY_FW = set("""yang di ke dari dan itu ini aku engkau angkau kita kami saya
dia ia tidak tiada ta ada pada kapada kepada dengan dalam didalam atas bawah
akan sudah belum juga pun lah kah nya ku mu si sa se satu dua tiga orang raja
anak hati mata air bunga hendak datang pergi jangan maka kalau bila mana apa
siapa bukan bukannya sahaja saja sekali sangat besar kechil putih hitam merah
kuning sama lain balik turun naik duduk dudok berdiri makan minum tuan hamba
beta bapa ibu mak abang adek adik kakak burong burung ular harimau gajah padi
beras nasi rumah kampong kampung laut sungai gunung hutan pulau batu kayu daun
buah bulan matahari bintang langit bumi angin hujan api tanah jangan-lah hai
wahai sahabat kawan hulu hilir""".split())
_ENGLISH_FW = set("""the of and to a in is it that with for as was on by at from
his her he she they we you i be are were not but or if then when which who this
there their them my your our an all one two three up down out into shall will
may let thy thou thee o oh like have has had do does did would could should
come go know see make take give say said""".split())

_MSA_WORD = re.compile(r"[A-Za-z'`’-]+")


def _uk_ung(lines):
    toks = [w.lower() for l in lines for w in _MSA_WORD.findall(l)]
    out = {}
    for suf in ("ung", "uk", "ong", "ok"):
        hits = [w for w in toks
                if w.endswith(suf) and len(w) > len(suf)
                and w[-len(suf) - 1] not in "aeiou"]
        out[suf] = (len(hits), len(set(hits)), sorted(set(hits))[:4])
    return out, len(toks)


def calibrate(verbose=True):
    """-> list of case dicts.  Each has `planted` and `real` verdicts.

    REDISCOVERED   the auditor found the defect
    MISSED         the auditor did not — and that is a finding about the
                   auditor, which is the whole point of the calibration
    UNREACHABLE    the real tree is not here; the planted half still ran
    """
    import shutil
    import tempfile
    cases = []
    tmp = tempfile.mkdtemp(prefix="audit_corpus_cal_")
    try:
        d = _plant(tmp)
        src = Sources()
        files = load(d, exts=(".txt",))
        f_findings = check_channel(files, src)
        e_findings = check_distinct(files, src)
        g_findings = check_orthography(files, src)

        # ---- case 1 : the Háttatal consonant wipe -----------------------
        hit = [f for f in f_findings
               if "non_hattatal_ocr1848" in f.path and f.severity == FAIL
               and "ZERO" in f.what]
        real = {"verdict": "UNREACHABLE", "detail": HATTATAL_OCR_DIR}
        if os.path.isdir(HATTATAL_OCR_DIR):
            pages = sorted(f for f in os.listdir(HATTATAL_OCR_DIR)
                           if f.endswith(".txt"))
            texts = [open(os.path.join(HATTATAL_OCR_DIR, p), encoding="utf-8",
                          errors="replace").read() for p in pages]
            chan = set(CHANNEL["non"].items)
            ch_tot = sum(sum(1 for c in t if c.lower() in chan) for t in texts)
            gk = [_greek_count(t) for t in texts]
            W = RECORDED["hattatal_pages"]
            pre = [0]
            for x in gk:
                pre.append(pre[-1] + x)
            best = min(range(0, max(1, len(pages) - W + 1)),
                       key=lambda i: abs((pre[i + W] - pre[i])
                                         - RECORDED["hattatal_greek"]))
            win = pre[best + W] - pre[best]
            real = {
                "verdict": ("REDISCOVERED" if ch_tot == 0
                            and win == RECORDED["hattatal_greek"] else "MISSED"),
                "detail": "%d pages, %d channel characters in the whole book; "
                          "the %d-page window at %s..%s carries %d Greek-block "
                          "characters (recorded: %d)"
                          % (len(pages), ch_tot, W, pages[best],
                             pages[best + W - 1], win,
                             RECORDED["hattatal_greek"]),
            }
        cases.append({
            "case": "1 · Háttatal consonant wipe",
            "doctrine": "52",
            "planted": {"verdict": "REDISCOVERED" if hit else "MISSED",
                        "detail": hit[0].measured if hit else
                                  "check F returned nothing on the fixture"},
            "real": real,
        })

        # ---- case 2 : the byte-identical cltk pair ----------------------
        hit = [f for f in e_findings
               if f.severity == FAIL and "byte-identical" in f.what]
        real = {"verdict": "UNREACHABLE", "detail": CLTK_A}
        if os.path.exists(CLTK_A) and os.path.exists(CLTK_B):
            ha = hashlib.md5(open(CLTK_A, "rb").read()).hexdigest()
            hb = hashlib.md5(open(CLTK_B, "rb").read()).hexdigest()
            good = ha == hb == RECORDED["cltk_md5"]
            real = {"verdict": "REDISCOVERED" if good else "MISSED",
                    "detail": "cltk/non_texts %s | "
                              "cltk/old_norse_texts_heimskringla %s | "
                              "recorded %s" % (ha, hb, RECORDED["cltk_md5"])}
        cases.append({
            "case": "2 · byte-identical cltk pair",
            "doctrine": "51",
            "planted": {"verdict": "REDISCOVERED" if hit else "MISSED",
                        "detail": hit[0].measured if hit else
                                  "check E returned nothing on the fixture"},
            "real": real,
        })

        # ---- case 3 : Malay extract vs source ---------------------------
        # The planted half asks two things of the auditor at once: E must see
        # that the extract is contained in its source, and G must refuse to
        # print the extract's zero without its population.
        cont = [f for f in e_findings if "msa_extract" in f.path]
        zero = [f for f in g_findings
                if "msa_extract" in f.path and "POPULATION" in f.what]
        srcp = [f for f in g_findings if "msa_source" in f.path]
        planted_ok = bool(cont) and bool(zero) and bool(srcp) and \
            srcp[0].severity == NOTE and "ZERO" not in srcp[0].what
        real = {"verdict": "UNREACHABLE", "detail": MALAY_SOURCE}
        staged = os.path.join(ROOT, "corpus", "song", "msa_skeat_pantun.txt")
        if os.path.exists(MALAY_SOURCE) and os.path.exists(staged):
            blocks = _malay_blocks(MALAY_SOURCE)
            mal = []
            for b in blocks:
                ws = [w.lower() for l in b for w in _MSA_WORD.findall(l)]
                if sum(1 for w in ws if w in _MALAY_FW) > \
                        sum(1 for w in ws if w in _ENGLISH_FW):
                    mal.append(b)
            src_counts, src_toks = _uk_ung([l for b in mal for l in b])
            cf = CorpusFile(staged)
            st_counts, st_toks = _uk_ung(cf.verse_lines)
            good = (
                len(blocks) == RECORDED["malay_blocks"]
                and sum(len(b) for b in blocks) == RECORDED["malay_block_lines"]
                and len(mal) == RECORDED["malay_malay_blocks"]
                and sum(len(b) for b in mal) == RECORDED["malay_malay_lines"]
                and st_counts["uk"][0] == RECORDED["malay_staged_uk"]
                and src_counts["uk"][0] == RECORDED["malay_source_uk"]
                and len(cf.verse_lines) == RECORDED["malay_staged_lines"]
                and st_counts["ong"][0] == RECORDED["malay_staged_ong"]
                and st_counts["ok"][0] == RECORDED["malay_staged_ok"])
            real = {
                "verdict": "REDISCOVERED" if good else "MISSED",
                "detail": "source: %d blocks / %d lines, %d Malay blocks / %d "
                          "lines, -uk %d %s, -ung %d, -ong %d, -ok %d || "
                          "staged: %d verse lines / %d tokens, -uk %d, -ung "
                          "%d, -ong %d, -ok %d"
                          % (len(blocks), sum(len(b) for b in blocks),
                             len(mal), sum(len(b) for b in mal),
                             src_counts["uk"][0], src_counts["uk"][2],
                             src_counts["ung"][0], src_counts["ong"][0],
                             src_counts["ok"][0],
                             len(cf.verse_lines), st_toks,
                             st_counts["uk"][0], st_counts["ung"][0],
                             st_counts["ong"][0], st_counts["ok"][0]),
            }
        cases.append({
            "case": "3 · Malay extract-vs-source population",
            "doctrine": "79 / 70",
            "planted": {"verdict": "REDISCOVERED" if planted_ok else "MISSED",
                        "detail": "containment: %s | zero-with-population: %s "
                                  "| source not claimed zero: %s"
                                  % (bool(cont), bool(zero), bool(srcp))},
            "real": real,
        })
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if verbose:
        for c in cases:
            print("\n  %s   (doctrine %s)" % (c["case"], c["doctrine"]))
            for half in ("planted", "real"):
                print("     %-8s %-14s %s" % (half, c[half]["verdict"],
                                              c[half]["detail"]))
    return cases


def calibration_failed(cases):
    """A case fails when the PLANTED half was missed, or when the real tree was
    reachable and the real half was missed.  UNREACHABLE does not fail the run
    — doctrine 49 — but it is never silent."""
    for c in cases:
        if c["planted"]["verdict"] != "REDISCOVERED":
            return True
        if c["real"]["verdict"] == "MISSED":
            return True
    return False


# ---------------------------------------------------------------------------
# 10. Baseline — the number that makes check D weak, recomputed on demand
# ---------------------------------------------------------------------------


def cross_language_baseline(path=None, n=3000):
    from quality import phonology as P
    path = path or os.path.join(ROOT, "corpus", "sonnets.txt")
    cf = CorpusFile(path)
    toks = cf.tokens()[:n]
    out = {}
    for lang in ("cym", "fin", "non", "san", "msa"):
        ph = P.get(lang)
        ok = 0
        for w in toks:
            try:
                if ph.syllabify(w):
                    ok += 1
            except Exception:
                pass
        out[lang] = round(ok / max(1, len(toks)), 3)
    return {"population": "%s, first %d tokens" % (path, len(toks)),
            "rates": out}


# ---------------------------------------------------------------------------
# 11. __main__
# ---------------------------------------------------------------------------


def _hr(t=""):
    print("\n" + "=" * 78)
    if t:
        print(t)
        print("=" * 78)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--root", default=CORPUS_DIR, help="tree to audit")
    ap.add_argument("--check", default=None,
                    help="comma-separated subset of %s" % ",".join(CHECKS))
    ap.add_argument("--only", action="append",
                    help="glob restricting which files are audited")
    ap.add_argument("--calibrate", action="store_true",
                    help="run the three known cases and nothing else")
    ap.add_argument("--baseline", action="store_true",
                    help="recompute the cross-language readability baseline")
    ap.add_argument("--severity", default="NOTE",
                    choices=[FAIL, WARN, NOTE],
                    help="print findings at this severity and above")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)

    if a.baseline:
        b = cross_language_baseline()
        print(json.dumps(b, indent=2) if a.json else
              "  %s\n  %s" % (b["population"], b["rates"]))
        return 0

    if a.calibrate:
        _hr("CALIBRATION — the errors we already know about")
        cases = calibrate(verbose=not a.json)
        if a.json:
            print(json.dumps(cases, indent=2))
        bad = calibration_failed(cases)
        print("\n  %s" % ("CALIBRATION FAILED — the auditor did not "
                          "rediscover a known case" if bad else
                          "all three known cases rediscovered"))
        return 1 if bad else 0

    checks = [c.strip().upper() for c in a.check.split(",")] if a.check \
        else list(CHECKS)
    for c in checks:
        if c not in CHECKS:
            ap.error("unknown check %r; have %s" % (c, ",".join(CHECKS)))

    files, findings = audit(a.root, checks=checks, only=a.only)
    floor = _SEV_ORDER[a.severity]
    shown = [f for f in findings if _SEV_ORDER[f.severity] <= floor]

    if a.json:
        print(json.dumps({
            "root": a.root, "files": len(files),
            "findings": [f.asdict() for f in findings],
        }, indent=2))
    else:
        _hr("CORPUS AUDIT — %d files under %s" % (len(files), a.root))
        by_check = collections.defaultdict(list)
        for f in findings:
            by_check[f.check].append(f)
        for c in checks:
            title, _ = CHECKS[c]
            fs = by_check.get(c, [])
            n_fail = sum(1 for f in fs if f.severity == FAIL)
            n_warn = sum(1 for f in fs if f.severity == WARN)
            n_note = sum(1 for f in fs if f.severity == NOTE)
            print("\n%s · %s" % (c, title))
            print("     %d files checked, %d FAIL, %d WARN, %d NOTE"
                  % (len(files), n_fail, n_warn, n_note))
            for f in fs:
                if _SEV_ORDER[f.severity] <= floor:
                    print(f)
        print("\n" + "-" * 78)
        print("  %d files, %d findings: %d FAIL, %d WARN, %d NOTE"
              % (len(files), len(findings),
                 sum(1 for f in findings if f.severity == FAIL),
                 sum(1 for f in findings if f.severity == WARN),
                 sum(1 for f in findings if f.severity == NOTE)))

    return 1 if any(f.severity == FAIL for f in findings) else 0


if __name__ == "__main__":
    sys.exit(main())
