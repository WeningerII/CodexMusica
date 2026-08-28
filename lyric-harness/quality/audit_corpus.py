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
                   `data/sources.tsv` row by one of three declared routes;
                   EVERY `# source:` id the file's own header declares reaches
                   one too; and every row that names a corpus path names one
                   that exists.  Reported in all three directions, because the
                   failures are different defects: an undeclared file never
                   passed the provenance gate, and a row naming nothing is a
                   claim about a population that is not here.

                   THE MIDDLE ONE WAS MISSING UNTIL 2026-08-14, and it is the
                   difference between two questions this check had been
                   collapsing.  `route()` answers IS THIS FILE REACHABLE — it
                   stops at the first header id that hits a row.  Doctrine 34's
                   actual question is IS EVERYTHING IN THIS FILE DECLARED, and
                   a file assembled from one declared source and one undeclared
                   one answers yes to the first and no to the second.  Three
                   files did: `eng_american_ann_taylor.txt` and
                   `eng_american_jane_taylor.txt` each declared
                   `GITenberg/Little-Ann-and-Other-Poems_42947` LAST, behind a
                   Home-Book-of-Verse header that resolves, and
                   `eng_american_margaret_junkin_preston.txt` declared
                   `GITenberg/BeechenbrookA-Rhyme-of-the-War_16480` FIRST,
                   ahead of a Poems-of-American-History header that resolves.
                   Two real editions, named in a corpus header, in no row —
                   inside a corpus this check reported clean, at 0 FAIL, across
                   all 269 files.  Each unresolved id is its own FAIL: two
                   holes in one file are two holes.

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

  H · STAGING      Doctrine 93 read the other way round.  A `[VERSE n]` mark
                   declares a STANZA; this reports every `[VERSE]` block
                   holding exactly ONE non-blank line, split into the subset
                   whose line carries a declared apparatus shape (a numeral, a
                   printer's ornament, an ALL-CAPS short label, a printed
                   performance heading) and the RESIDUE, which is reported as
                   a count rather than as a pass.  It adjudicates nothing: the
                   ALL-CAPS class alone is a poem title, a speaker
                   attribution, a byline and a movement heading at once, and
                   telling those apart needs a reading of the printing.
                   `MISSING.md` M-25(a) is the census this makes into a
                   command.

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

# AFTER the path insert, because this file is RUN as a script as often as it is
# imported -- `python3 quality/audit_corpus.py` has no `quality` package on the
# path until the two lines above run. A module-header import here exits 1 on a
# traceback, and this file's ordinary exit code is ALSO 1 (it exits 1 when it
# has findings), so the crash was indistinguishable from a normal run until the
# outputs were diffed.
from quality.grid import split_named_air                       # noqa: E402

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

#: The FIRST token of a `# source:` line, which is where this corpus writes the
#: source_id.  Everything after it on the line is the upstream filename, the
#: md5 and the byte count, and check C is what reads those.
_SOURCE_DECL = re.compile(r"^#\s*sources?:\s*(\S+)")

#: `local:` rows name their file directly; everything else is reached through
#: the file's own header naming a parent `source_id`, or through a row's prose
#: naming the path.  Three routes, declared, and a file with none of them is
#: the doctrine 34 defect.
#:
#: REACHING A ROW AND DECLARING EVERY SOURCE ARE TWO QUESTIONS, and these
#: constants only answer the first.  `Sources.route` stops at the first header
#: id that hits a row, which is the right answer to "is this file reachable"
#: and the wrong answer to doctrine 34's "is everything in this file declared".
#: `Sources.resolve_declared` answers the second, once per declaration.
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

    def source_declarations(self):
        """-> [source_id, ...], in header order, one per `# source:` line that
        opens with an id.  Duplicates are kept: a file that names one source
        twice declared it twice.

        THE RESTRICTION IS THE DESIGN AND IS WRITTEN DOWN RATHER THAN TAKEN
        SILENTLY.  352 `# source:` lines ship in this corpus.  336 open with an
        id-shaped token — `GITenberg/Little-Ann-and-Other-Poems_42947`,
        `kanripo/KR4j0076`, `rsharifnasab/ganjoor_epub` — and those are the
        declarations this returns.  The other 16 open with a bare org and say
        the rest in prose: `# source: GITenberg PG 12907 -- file
        raw_12907-8.txt, ISO-8859-1`.  A prose line names no id, so nothing is
        invented for it; `Sources.route`'s whole-header match is what still
        answers for those 16 files, exactly as before.

        Reading an id out of prose is how an auditor manufactures findings, and
        manufacturing findings is worse than missing them because a reader
        cannot tell a manufactured one from a real one — see `_COUNT_FIELDS`,
        whose first version cost this module 30 FAILs of its own.  If the prose
        form is ever worth covering, the fix is to make those 16 headers write
        an id, not to make this regex guess at one.
        """
        out = []
        for l in self.header_lines:
            m = _SOURCE_DECL.match(l)
            if m and "/" in m.group(1):
                out.append(m.group(1))
        return out

    # -- tokens ------------------------------------------------------------

    def tokens(self, letters_only=False, lang=None):
        if lang == "ltc":
            return _CJK.findall(self.verse_text)
        pat = _TOKEN_LETTERS if letters_only else _TOKEN
        return [m.group(0).lower() for m in pat.finditer(self.verse_text)]


# ---------------------------------------------------------------------------
# 1. Reading data/sources.tsv
# ---------------------------------------------------------------------------


#: A GITenberg / Project Gutenberg source_id ends in `_<ebook number>`, and THAT
#: is the identity of the edition — the slug in front of it is a title, and the
#: table and the corpus headers do not always slug it to the same length.
_PG_ID = re.compile(r"^([^/]+)/.*_(\d+)$")


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

    def resolve_declared(self, declared):
        """-> the source_id ONE declared header id reaches, or None.

        `parent_of` asks the header as a whole and stops at the first hit, so
        it can only ever answer "this file is reachable".  This asks ONE
        declaration, which is what doctrine 34 is actually about: a file
        assembled from a declared source and an undeclared one is a file with
        an undeclared source in it, and the declared half must not answer for
        the other.

        Three stages, and the counts are what this corpus measures over its 336
        id-shaped declarations:

          1. a row id contained in the declaration                        (326)
          2. a row id's `#` stem contained in it — `#` is this table's
             sub-scope convention, so a header naming `thabz/Kalliope`
             resolves to the row `thabz/Kalliope#moore-irish-melodies`     (4)
          3. same org AND same Project Gutenberg ebook number             (3)

        STAGE 3 IS NOT A LOOSENING, IT IS THE IDENTITY OF A GITENBERG ID, and
        without it this check would have manufactured three findings on its
        first run.  The corpus header writes the full repo slug and the table
        sometimes writes an abbreviated one for the same repo:

            header  GITenberg/Kanteletar--Suomen-kansan-wanhoja-lauluja-ja-wirsi-_7078
            row     GITenberg/Kanteletar_7078
            header  GITenberg/Malay-Magic-Being-an-introduction-to-the-folklore-...-Peninsula_47873
            row     GITenberg/Malay-Magic_47873

        The trailing number is the PG ebook id, so those are one source, not
        two.  Measured: stage 3 resolves 3 declarations and never to a row with
        a different ebook number — it cannot reach past the number it matched.
        The three ids this check DOES fail on are failing on the number too:
        42947 and 16480 appear nowhere in `data/sources.tsv` at all.
        """
        for sid in self.parent_ids:
            if sid in declared:
                return sid
        for sid in self.parent_ids:
            stem = sid.split("#")[0]
            if stem and stem in declared:
                return sid
        m = _PG_ID.match(declared)
        if m:
            org, num = m.group(1), m.group(2)
            for sid in self.parent_ids:
                m2 = _PG_ID.match(sid.split("#")[0])
                if m2 and m2.group(1) == org and m2.group(2) == num:
                    return sid
        return None

    def undeclared_sources(self, cf):
        """-> [(declared_id, position, total)] for every `# source:` id in this
        file's header that reaches no row.  Empty is the ordinary answer."""
        decls = cf.source_declarations()
        return [(d, i + 1, len(decls)) for i, d in enumerate(decls)
                if self.resolve_declared(d) is None]

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
#:
#: `FAILED SOURCE SEARCH` ADDED 2026-08-16, and it is the docstring rule above
#: catching this list not meeting it.  Three rows write a recorded failed
#: search that way -- `SEARCH:gitagovinda-raga-tala-headings` spells it
#: `n/a - failed source search, recorded as a row (doctrine 39)`, CITING THE
#: DOCTRINE IN THE CELL -- and none of the seven markers here matched any of
#: them, so `SEARCH:non-hattatal-third-edition-2026-08-11` was charged as a
#: doctrine 34 WARN for having done exactly what doctrine 39 asks.  The
#: auditor was punishing the table for working, in the one file whose comment
#: says not to.
#:
#: THE RESIDUAL IS NAMED RATHER THAN CLAIMED CLOSED.  This is still an
#: ENUMERATION OF PHRASINGS and the phrasings live in a TSV this file does not
#: own, so a fourth spelling produces a silent WARN again -- the failure mode
#: is unchanged in kind, only one instance narrower.  The structural
#: alternative -- treat every `SEARCH:`-prefixed source_id as declared-absent
#: -- was MEASURED AND REJECTED: `SEARCH:welsh-cynghanedd-corpus` reads
#: `OVERTURNED -- source located via GITenberg` and another reads `ROUTE FOUND
#: AND BLOCKED`, so the prefix marks *a search was run*, NOT *it found
#: nothing*, and a row that DID locate its material and then names a missing
#: path is a real defect this would silence.  A cheap marker list that
#: under-matches beats a structural rule that over-matches, because the first
#: fails loudly (a WARN nobody asked for) and the second fails silently.
_ABSENT_ON_PURPOSE = (
    ("REJECTED", "rejected"), ("REFUSED", "refused"), ("REMOVED", "removed"),
    ("DELETED", "deleted"), ("NOT FOUND", "not found"),
    ("NOT-FOUND", "not found"), ("UNREACHABLE", "unreachable"),
    ("FAILED SOURCE SEARCH", "failed source search"),
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

        # -- EVERY declared source, not just the first one that resolved -----
        #
        # `route()` above stops at the first header id that hits a row.  That
        # is the right answer to "is this file reachable" and the wrong answer
        # to doctrine 34's question, and the gap between the two is a file
        # assembled from a declared source and an undeclared one.  Reported per
        # UNRESOLVED ID rather than per file: two holes in one file are two
        # holes, and a count that merges them is doctrine 79's error one layer
        # down.
        for d, pos, total in src.undeclared_sources(cf):
            others = [x for x in cf.source_declarations() if x != d]
            resolved = sorted({r for r in (src.resolve_declared(o)
                                           for o in others) if r})
            out.append(Finding(
                "A", FAIL, rel,
                "the header declares a source that reaches no "
                "data/sources.tsv row: %s" % d,
                "`# source:` declaration %d of %d in this header; %d of the "
                "other %d resolve (%s)"
                % (pos, total, len(resolved), len(others),
                   ", ".join(resolved) if resolved else "none"),
                "doctrine 34 asks whether everything in this file is DECLARED, "
                "not whether the file is reachable. A file whose other header "
                "id resolves passes `route()` on its declared half while this "
                "one names an edition that never passed the provenance gate — "
                "which is the rule verse.txt was deleted for, surviving inside "
                "a corpus the check reported clean",
                "34"))
    # the other direction
    # THE POPULATION THIS CHECK WAS NEVER GIVEN. `load` walks two
    # extensions; anything else under `corpus/` reaches no check at all,
    # so doctrine 34's question is not answered NO for it — it is not
    # asked. Reported per file, and silent when there are none, which is
    # the honest shape: the finding is about a real excluded file, and
    # today there are zero (all 269 are `.txt`/`.json`).
    for p in LAST_UNWALKED:
        out.append(Finding(
            "A", NOTE, p,
            "under corpus/ and NOT WALKED — the audit never asked "
            "doctrine 34 of this file",
            "load() reads %s; this file matches none of them"
            % ", ".join(EXTS),
            "a file the walk skips is not a file that passed. Widening "
            "`EXTS` would hand it to every check including the byte and "
            "language ones, which is a decision about what a CORPUS FILE "
            "is and belongs to whoever adds the first one",
            "34"))
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
                "undeclared file is unaudited by three of eight checks",
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
    staged file in this corpus writes.

    THE TITLE IS SPLIT FROM ITS AIR, 2026-08-21. The stagers write the tune
    into the title value as `[air: Paddy's Wedding]`, and reading the whole
    string as the title made `false_unit_items` compare body lines against a
    title with metadata glued to it. Two real duplicate stagings were hidden
    by exactly that: Hogg's `LOVE IS LIKE A DIZZINESS` and Rodger's
    `BEHAVE YOURSEL' BEFORE FOLK` each appear TWICE in their own file, once
    with the air and once without, and only the un-aired copy could ever
    match. Splitting gains 2 findings and loses none (19 -> 21 over the whole
    corpus, RUN-ON 9 -> 11 over `eng_`).
    """
    cur, body, out = None, [], []
    for l in cf._lines:
        s = l.rstrip()
        if s.startswith("--- TITLE:"):
            if cur is not None:
                out.append((cur, body))
            cur, body = split_named_air(s[10:])[0], []
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


#: THE SUNG-TEXT QUESTION, AND IT IS ASKED OF ONE SHAPE ONLY — a `[VERSE]`
#: block holding exactly one non-blank line.
#:
#: `[VERSE n]` declares a STANZA.  A one-line stanza exists, so the shape is
#: a CANDIDATE and never a verdict; what makes it worth raising is that in
#: this corpus the shape is overwhelmingly a printer's apparatus line that the
#: staging typed as sung words — a poem title, a stanza numeral, a byline, a
#: speaker attribution, an editorial footnote, a printer's ornament.  Every
#: one of those enters MATTR, the function-word ratio, the rhyme graph, the
#: endword population and every per-line rate in this repository.
#:
#: RESTRICTED TO `[VERSE`, DELIBERATELY.  A one-line `[CHORUS]`/`[REFRAIN]`/
#: `[BURDEN]` block is the ordinary shape of a one-line refrain and carries no
#: contradiction at all; asking the question of those marks would manufacture
#: a thousand findings about the thing the marks are for.
#:
#: THREE COUNTS AND THEY ARE NEVER SUMMED (doctrine 79/20).  The candidate
#: population is every one-line `[VERSE]` block.  MATCHED is the subset whose
#: line carries a shape declared below.  The RESIDUE is the rest, and it is
#: reported as UNADJUDICATED rather than as clean: sampled at n=50 (seed
#: 20260821) roughly a quarter of it is real text — single lines of dramatic
#: dialogue, which is a DIFFERENT staging defect and not this one — and the
#: other three quarters are apparatus in shapes this table does not spell
#: (Watts's scripture arguments, Lovelace's editorial footnotes, Burns's
#: `Tune--` lines, place-and-date colophons).  A residue reported as zero
#: findings would read as a pass on a population nobody has looked at.
#:
#: THE TABLE IS TIGHT ON PURPOSE.  `_COUNT_FIELDS` cost this module 30 FAILs
#: of its own by reading prose as a claim, and the rule that came out of it
#: holds here: manufacturing findings is worse than missing them, because a
#: reader cannot tell a manufactured one from a real one.  So a shape enters
#: this table only when a false positive is close to impossible, and the
#: shapes that would need a judgement stay in the residue where they can be
#: counted without being charged.
#:
#: MEASURED 2026-08-21 over `corpus/song/`: 72,803 `[VERSE]` blocks, 2,551 of
#: them one-line, 1,067 matched across 107 files, 1,484 residue.  `MISSING.md`
#: M-25(a) records 940 across 67 files, which is THIS QUESTION asked by a
#: session script whose shape rules were never written down — no `D`/`M` in
#: the roman class, no comma in the arabic one, a strict character class that
#: dropped every dash-joined range, and no ornament class at all.  Doctrine 58
#: exactly: the recorded count was a threshold nobody wrote down, and the
#: repair is that the rule now lives here and the number is whatever this
#: table produces.
_ONE_LINE_NUMERAL = re.compile(
    r"^[\(\[]?(?:[IVXLCDM]+|\d[\d,]*)"
    r"(?:[.)\]]?\s*[-–—]\s*[\(\[]?(?:[IVXLCDM]+|\d[\d,]*))*"
    r"[.)\]]?$")

_ONE_LINE_ORNAMENT = re.compile(r"^[*·•\-–—.\s]{3,}$")

#: The printed performance headings a score sets over a movement.  A CLOSED
#: list, and the reason it is closed rather than a pattern is doctrine 24's:
#: `Air` is also an ordinary English word, so anything wider would charge a
#: line of sung text for containing it.
_ONE_LINE_HEADING = re.compile(
    r"^(Recitativo|Recitative|Air|Duetto|Duet|Trio|Solo|Finale|Chorus|"
    r"Da capo|Aria|Overture|Prelude)\b[.,]?$", re.I)

def _has_cased_letter(t):
    """Does this string contain a letter in a script that HAS case?"""
    return any(c.isupper() or c.islower() for c in t)


def _has_lower(t):
    return any(c.islower() for c in t)

#: THE CASE TEST IS PYTHON'S OWN AND IT IS UNICODE, BECAUSE THE FIRST TWO
#: RUNS OF THIS CHECK MANUFACTURED A FINDING EACH — the same defect, one
#: script apart, and neither was visible by reading the rule.
#:   RUN 1 charged `ltc_siku_kr4j0074.txt`'s `欲寄逺憑誰是。`, a sung line of a
#:   詞: it is one whitespace token and no character in it is lowercase,
#:   because Chinese HAS NO CASE.  9 blocks over two `ltc_siku` files.  "No
#:   lowercase letter" says nothing about a line until the script has case at
#:   all, so `_has_cased_letter` is the gate and the whole `ltc` corpus leaves
#:   this shape BY CONSTRUCTION rather than by a language exclusion somebody
#:   has to remember.
#:   RUN 2 charged `eng_british_lord_byron.txt`'s `Ζωή μου, σᾶς ἀγαπῶ.` —
#:   *Maid of Athens*'s Greek refrain, the most sung line in the poem — because
#:   the lowercase test was the LATIN-1 class `[a-zà-öø-ÿ]` and Greek `ωή` is
#:   not in it.  A hand-written character class is a claim about which
#:   alphabets exist; `str.islower()` is the same question asked of Unicode.
#: Doctrine 45 twice over: an ORTHOGRAPHIC rule that silently picks a script
#: is making a claim it never states, and the claim was wrong in both
#: directions — case-less read as ALL-CAPS, and cased-but-not-Latin read as
#: ALL-CAPS.
#:
#: The ALL-CAPS class is FOUR OBJECTS and this check does not separate them —
#: separating them is what needs a reading of the printing, which is why
#: `M-25(a)` is a census and not yet a repair list.  A poem title wants an
#: item split, a speaker attribution wants a mark, a byline wants an author
#: field and a movement heading wants a section function.  The `<= 4 words`
#: bound is what keeps a shouted line of real sung text out of it, and it is
#: a bound rather than a calibration: nothing measured it, and a line of five
#: capitalised words is left in the residue rather than guessed at.
_ALLCAPS_MAX_WORDS = 4


def apparatus_shape(line):
    """-> the declared shape name, or None.

    None means UNADJUDICATED, never CLEAN — see the table above.
    """
    t = line.strip()
    if _ONE_LINE_NUMERAL.match(t):
        return "numeral"
    if _ONE_LINE_ORNAMENT.match(t):
        return "ornament"
    if (_has_cased_letter(t) and not _has_lower(t)
            and len(t.split()) <= _ALLCAPS_MAX_WORDS):
        return "allcaps-label"
    if _ONE_LINE_HEADING.match(t):
        return "heading-word"
    return None


def one_line_verse_blocks(cf):
    """-> [(mark, line), ...] for every `[VERSE` block holding exactly one
    non-blank line.

    A block runs from its own mark to the next apparatus line of any kind
    (`[`, `--- `, `#`), which is `_MARKER`'s own rule read one level up.  The
    final block is flushed at end of file: a session script that forgot to do
    that is how a corpus's last item goes unaudited in silence.
    """
    out, mark, buf = [], None, []

    def flush():
        if mark is not None and len(buf) == 1:
            out.append((mark, buf[0]))

    for raw in cf._lines:
        s = raw.strip()
        if _MARKER.match(s):
            flush()
            mark = s if s.upper().startswith("[VERSE") else None
            del buf[:]
            continue
        if s and mark is not None:
            buf.append(s)
    flush()
    return out


def check_staging(files, src):
    """H · a `[VERSE]` mark used for something that is not a sung stanza."""
    out = []
    for rel, cf in files:
        blocks = one_line_verse_blocks(cf)
        if not blocks:
            continue
        shapes = collections.Counter()
        examples = collections.defaultdict(list)
        residue = []
        for _, line in blocks:
            k = apparatus_shape(line)
            if k is None:
                residue.append(line)
            else:
                shapes[k] += 1
                if len(examples[k]) < 3:
                    examples[k].append(line)
        matched = sum(shapes.values())
        pop = ("%d one-line of %d `[VERSE]` blocks | matched %d | "
               "residue %d (UNADJUDICATED, not clean)"
               % (len(blocks), sum(1 for l in cf._lines
                                   if l.strip().upper().startswith("[VERSE")),
                  matched, len(residue)))
        if matched:
            out.append(Finding(
                "H", WARN, rel,
                "%d one-line `[VERSE]` block(s) carry a declared apparatus "
                "shape and are scored as sung words" % matched,
                "%s | %s" % (
                    pop,
                    " · ".join("%s %d (%s)"
                               % (k, n, ", ".join(repr(e) for e
                                                  in examples[k][:2]))
                               for k, n in shapes.most_common())),
                "a `[VERSE n]` mark declares a STANZA. These lines are a "
                "printer's apparatus — a numeral, a byline, a title, a "
                "speaker name, an ornament — and every one of them enters "
                "MATTR, the function-word ratio, the rhyme graph and the "
                "endword population. The four shapes are AT LEAST THREE "
                "DIFFERENT OBJECTS wanting three different repairs, so this "
                "check RAISES the population and adjudicates none of it "
                "(`MISSING.md` M-25(a))",
                "93"))
        else:
            out.append(Finding(
                "H", NOTE, rel,
                "%d one-line `[VERSE]` block(s), none in a declared "
                "apparatus shape" % len(residue),
                "%s | e.g. %s" % (pop,
                                  " · ".join(repr(l) for l in residue[:3])),
                "reported so the residue is a COUNT rather than a silence "
                "(doctrine 20): a population nobody has looked at must not "
                "render as a population that passed",
                "20"))
    return out


#: THE PRINTED INDENT AS A WITNESS, and it is REPORTED rather than judged.
#:
#: `lyric_harness.line_indent` carries the compositor's indent through
#: ingestion for the first time (`MISSING.md` M-28). This check is what READS
#: it, because a coordinate that is declared and never read is the defect this
#: repository keeps rediscovering, one layer at a time.
#:
#: THE STATISTIC, per file: over every block of >=4 lines carrying >=2 indent
#: depths, the share of end-word pairs that share a `spelled_rime` at the SAME
#: printed depth, against the share at DIFFERENT depths. Corpus-wide over
#: `eng_*` that is 11.83% against 1.91%, a ratio of 6.19, against a
#: within-block permutation null whose 20-draw excess range is -2.71 to -2.49
#: pp -- so the printing is a real and independent witness to the rhyme
#: partition, which is the thing `--cliques` is NOT (doctrine 14).
#:
#: NO THRESHOLD, AND THE REASON IS A FILE. It is tempting to WARN on a ratio
#: below 1 -- same-depth lines rhyming LESS than different-depth ones -- as an
#: extraction that destroyed the ladder. MEASURED: 8 files of 546 run that
#: way, and the strongest of them is not damaged at all.
#: `eng_pah_francis_lieber.txt` (1.45% against 24.64%, ratio 0.06) prints
#: ABCB stanzas in which ONLY THE RHYMING FOURTH LINE IS INDENTED, so its
#: same-depth pairs are by construction the lines that do not rhyme:
#:
#:     Rend America asunder
#:     And unite the Binding Sea
#:     That emboldens man and tempers--
#:         Make the ocean free.
#:
#: An indent can mark the rhyme GROUP (a ballad's b-lines) or the rhyme
#: BEARER (Lieber's fourth line), and those are opposite conventions with the
#: same typography. A rule that charged one of them would be manufacturing
#: findings, which this module has already paid 30 FAILs to learn
#: (`_COUNT_FIELDS`). So the check states the number and the reader decides.
#:
#: AND IT CORRECTS THIS PROJECT'S OWN HEADLINE: because the two conventions
#: pull in opposite directions, the corpus-wide 6.19x is an average ACROSS
#: them and UNDERSTATES how much the printing knows.
_INDENT_MIN_LINES = 4
_INDENT_MIN_PAIRS = 40


def indent_rhyme_witness(cf, rel):
    """-> (same_pairs, same_share, diff_pairs, diff_share) or None.

    None when the file has no block that both carries an indent ladder and
    reaches `_INDENT_MIN_PAIRS` judgeable pairs -- an ABSENCE OF POPULATION,
    which is not a rate of zero (doctrine 20).
    """
    import itertools
    import lyric_harness as LH
    from quality.grid import indent_partition, read_marked_songs
    s_y = s_n = d_y = d_n = 0
    blocks = 0
    for song in read_marked_songs(cf.path):
        for b in song.blocks:
            part = indent_partition(b)
            if len(part) < _INDENT_MIN_LINES or len(set(part)) < 2:
                continue
            blocks += 1
            keys = []
            for l in b.lines:
                w = LH.raw_final_token(l)
                keys.append(LH.spelled_rime(w) if w else None)
            for i, j in itertools.combinations(range(len(part)), 2):
                if keys[i] is None or keys[j] is None:
                    continue
                hit = keys[i] == keys[j]
                if part[i] == part[j]:
                    s_y += hit
                    s_n += not hit
                else:
                    d_y += hit
                    d_n += not hit
    ns, nd = s_y + s_n, d_y + d_n
    if ns < _INDENT_MIN_PAIRS or nd < _INDENT_MIN_PAIRS:
        return None
    return blocks, ns, s_y / ns, nd, d_y / nd


#: THE PER-FILE GATE IS THE MEASURED NULL AND NOT A GUESS (doctrine 22). The
#: within-block permutation null's excess spans -2.71 to -2.49 pp over 20
#: draws, so a per-file excess whose MAGNITUDE is inside +-2.71 pp is not
#: distinguishable from chance and earns no per-file note; outside it, in
#: EITHER direction, it is a witness worth naming.
_INDENT_NULL_PP = 0.0271


def check_indent(files, src):
    """I · the printed indent against the measured rhyme partition.

    THREE COUNTS, NEVER SUMMED, and the reason the two SMALL ones get the
    per-file notes is proportion rather than significance. 517 English files
    of 545 have an indent that agrees with their rhyme partition, which is
    the corpus-wide result and is reported ONCE -- 517 notes each saying "as
    expected" would bury the 28 that do not, and the population is not
    silent because the summary counts it (doctrine 20/79).
    """
    out = []
    agrees, opposite, inside = 0, [], []
    for rel, cf in files:
        lang, _ = declared_language(cf, rel)
        if lang != "eng":
            continue
        # NO `try/except` HERE, AND THAT IS DELIBERATE. Swallowing an
        # exception would make a file that FAILED TO PARSE indistinguishable
        # from a file with no indent ladder — doctrine 20 inside the check
        # written to enforce doctrine 20. MEASURED before the guard was
        # removed: 0 of 1,297 `eng_` files raise. If one ever does, this
        # check crashes loudly, which is the correct behaviour for an
        # auditor whose generous failure mode is silence.
        m = indent_rhyme_witness(cf, rel)
        if m is None:
            continue
        blocks, ns, sa, nd, da = m
        excess = sa - da
        row = (rel, blocks, ns, sa, nd, da, excess)
        if abs(excess) <= _INDENT_NULL_PP:
            inside.append(row)
        elif excess > 0:
            agrees += 1
        else:
            opposite.append(row)
    if not (agrees or opposite or inside):
        return out
    out.append(Finding(
        "I", NOTE, "corpus/song/ (every eng_ file with an indent ladder)",
        "the printed indent is an independent witness to the rhyme "
        "partition on %d of %d files" % (agrees, agrees + len(opposite)
                                         + len(inside)),
        "AGREES %d | runs OPPOSITE %d | inside the null %d — three counts, "
        "never summed. Corpus-wide the same-depth pair rate is 11.83%% "
        "against 1.91%% at different depths (ratio 6.19) over 528,370 pairs "
        "in 15,685 blocks, with identical end words excluded (doctrine 3); "
        "the matched null permutes the indent depths WITHIN each block and "
        "its 20-draw excess is -2.71 to -2.49 pp, so the observation sits "
        "12.6 pp above the null's MAXIMUM"
        % (agrees, len(opposite), len(inside)),
        "this is the control `--cliques` cannot be: a cover derived from the "
        "grader's own rhyme graph is not independent of the grader (doctrine "
        "14), and the compositor's indent is. It is a WITNESS and not a "
        "mandate — nothing here derives a scheme from whitespace",
        "14"))
    for rel, blocks, ns, sa, nd, da, excess in opposite:
        out.append(Finding(
            "I", NOTE, rel,
            "the printed indent runs OPPOSITE to the rhyme partition "
            "(%.2f%% same-depth against %.2f%% different)"
            % (100.0 * sa, 100.0 * da),
            "%d laddered block(s), %d same-depth and %d different-depth "
            "pairs, excess %+.2f pp — outside the null's +-%.2f pp"
            % (blocks, ns, nd, 100.0 * excess, 100.0 * _INDENT_NULL_PP),
            "NOT a defect and NOT charged: an indent can mark the rhyme "
            "GROUP or the rhyme BEARER, and those are opposite conventions "
            "in the same typography. `eng_pah_francis_lieber.txt` prints "
            "ABCB stanzas indenting ONLY the rhyming fourth line, so its "
            "same-depth pairs are by construction the lines that do not "
            "rhyme. Named because the corpus-wide ratio averages ACROSS the "
            "two conventions and therefore UNDERSTATES what the printing "
            "knows", "14"))
    for rel, blocks, ns, sa, nd, da, excess in inside:
        out.append(Finding(
            "I", NOTE, rel,
            "the printed indent tells us NOTHING about this file's rhyme "
            "partition",
            "%d laddered block(s) | %.2f%% same-depth against %.2f%% "
            "different, excess %+.2f pp — INSIDE the null's +-%.2f pp"
            % (blocks, 100.0 * sa, 100.0 * da, 100.0 * excess,
               100.0 * _INDENT_NULL_PP),
            "an indistinguishable-from-chance result is reported rather than "
            "dropped: a file whose printing carries a ladder that answers "
            "nothing is either a form the ladder does not encode or an "
            "extraction that re-indented, and only a reader can tell which "
            "(doctrine 20 — this is inconclusive, not null)", "14"))
    return out


def check_enclitic_convention(files, src):
    """J · which enclitic-setting convention each English edition uses
    (`MISSING.md` F-5).

    Rogers's 1855 Modern Scottish Minstrel sets a SPACE before enclitics
    (`There 's high and low`) 189 times in Nairne against 13 in all of
    Burns — same language, opposite tokenisation, decided by the
    compositor. `join_spaced_enclitics` NORMALISES the spaced form at
    read time; what nothing did was SAY which convention an edition uses,
    so a corpus mixing both was silently inconsistent and any per-edition
    rate was unstratifiable. This check answers it per file, reading the
    SAME closed set the joiner reads (`lyric_harness.ENCLITICS` via
    `_SPACED_ENCLITIC` — one definition, doctrine 1), and it charges
    NOTHING: a convention is the printer's, not a defect (doctrine 6's
    shape one layer down). Dominance is a COMPARISON between the file's
    own two counts, never a declared threshold (doctrine 58): a file is
    noted per-file only when the spaced spellings OUTNUMBER the attached
    ones, which names the Rogers-convention editions without burying them
    under every file that carries a stray compositor's slip.
    """
    import lyric_harness as LH
    out = []
    attached_re = re.compile(r"\w('(?:s|ll|re|ve|d|m|t|n))\b", re.I)
    spaced_only, attached_only, both, dominant = 0, 0, 0, []
    for rel, cf in files:
        lang, _ = declared_language(cf, rel)
        if lang != "eng":
            continue
        text = LH.fold_apostrophes(cf.text)
        spaced = len(LH._SPACED_ENCLITIC.findall(text))
        attached = len(attached_re.findall(text)) - spaced
        if not spaced and not attached:
            continue
        if spaced and attached:
            both += 1
        elif spaced:
            spaced_only += 1
        else:
            attached_only += 1
        if spaced > attached:
            dominant.append((rel, spaced, attached))
    if not (spaced_only or attached_only or both):
        return out
    out.append(Finding(
        "J", NOTE, "corpus/song/ (every eng_ file with enclitic evidence)",
        "which enclitic convention each edition sets — attached-only %d, "
        "spaced-only %d, both %d file(s); three counts, never summed"
        % (attached_only, spaced_only, both),
        "the SPACED convention (`There 's`) is the edition's, not the "
        "language's; `join_spaced_enclitics` normalises it at read time "
        "and this check makes the convention SAYABLE per file so a "
        "per-edition rate can be stratified. %d file(s) are "
        "spaced-DOMINANT (spaced > attached) and are named below"
        % len(dominant),
        "a convention is not a defect and nothing here charges one; what "
        "was silent is WHICH convention a file carries, and silence there "
        "made every mixed-corpus rate partly a measure of the compositor",
        "1"))
    for rel, spaced, attached in sorted(dominant):
        out.append(Finding(
            "J", NOTE, rel,
            "this edition sets enclitics SPACED — %d spaced against %d "
            "attached" % (spaced, attached),
            "the file's dominant convention is the compositor's spaced "
            "setting; `join_spaced_enclitics` re-attaches the closed set "
            "at read time, so no measurement counts the split tokens",
            "named so a reader computing a per-edition rate knows this "
            "file's tokenisation was set by its printer, not its poet",
            "1"))
    return out


def check_encoding(files, src):
    """K · a declared transcription's letter must survive in the bytes
    (`MISSING.md` F-4, doctrine 50).

    Barnes exists on Gutenberg twice: the Latin-1 transcription keeps his
    a-diaeresis and the ASCII sibling flattens `ä` to the two-letter
    sequence `ae`, INVENTING A LETTER in every affected word. The staged
    file's own `# orthography:` header says which transcription it is and
    why the other must not be used — and nothing READ that declaration,
    so a re-stage from the ASCII transcription that repinned its own md5
    would have passed every existing check (the English vowel count
    RISES under the flattening, so Check F points the wrong way here).

    THE PREDICATE IS THE FILE'S OWN DECLARATION, not an encoding sniff: a
    `# orthography:` header line naming LATIN-1 / ISO-8859 is a claim
    that a non-ASCII letter is load-bearing in these bytes, and a file
    making that claim with ZERO non-ASCII letters in its verse has been
    flattened — FAIL. Healthy files are SILENT (Check F's own shape:
    silence means the declared channel is populated), so the corpus
    shape does not move when nothing is wrong. Files that merely record
    an ISO-8859-1 SOURCE in a `# file:` line make no such claim — 260
    Modern Scottish Minstrel files name one and many are honestly pure
    ASCII — and are deliberately out of scope.
    """
    out = []
    for rel, cf in files:
        decl = [l for l in cf.text.split("\n")
                if l.startswith("#") and "orthography" in l.lower()
                and ("latin-1" in l.lower() or "iso-8859" in l.lower())]
        if not decl:
            continue
        n = sum(1 for ch in cf.verse_text
                if ch.isalpha() and ord(ch) > 127)
        if n == 0:
            out.append(Finding(
                "K", FAIL, rel,
                "the header declares a LATIN-1 transcription and the "
                "verse carries ZERO non-ASCII letters — the flattening "
                "the declaration exists to forbid has recurred",
                "declaration: %r; non-ASCII letters in verse: 0"
                % decl[0].strip()[:100],
                "the ASCII sibling transcription invents a letter in "
                "every affected word (`Greaeve`, `Feaeir`) and must not "
                "be staged; re-stage from the transcription the header "
                "names, or correct the header if the orthography claim "
                "is no longer true", "50"))
    return out


def check_bracket_declarations(files, src):
    """L · a bracket in a sung line is read by a DECLARATION or named here
    (`MISSING.md` M-47/M-27).

    Two questions of every file, and both exist because the repair for the
    93 sized markers was DECLARED tables rather than a guessed rule — and a
    declared table protects only what is in it. A newly staged file whose
    footnote anchors leak into end words would otherwise read exactly like
    a clean one, which is how Byron came to rhyme on the letters `a b c d`
    in every table built before 2026-08-28.

      1. a TOKEN-YIELDING bracketed span in a kept line that no declared
         class resolves (`normalise_bracket_spans` returns it unchanged) —
         the file needs a `BRACKET_SUPPLIED` / `BRACKET_ANCHOR_FILES` row
         or the span is a new convention worth its own class. Numeric
         spans (`[10]`) yield no token and are measured harmless, so they
         do not fire.
      2. an UNCLOSED `[`-opening apparatus row covered by NO declaration —
         neither the wrapped-note convention (`WRAPPED_APPARATUS_FOLLOW`)
         nor an M-152 bracketed-verse rule (`bracket_block_rule`, the
         reader's own matcher, so this census cannot drift from what the
         reader actually covers) — its continuation may be leaking as
         verse, or the block may be bracketed VERSE; either way a person
         has to look, which is what a NOTE is for. The six files this
         question named on its first run are DECLARED since M-152's close
         (2026-08-28) and are silent here now.

      3. an ORPHAN CLOSE — a KEPT sung line ending on a `]` that
         outnumbers its own `[`s, with no declaration touching the line
         (M-152's adjudicated population: Emmett's lost note tail,
         Lovelace's printer marks, a mid-line wrapped gloss). All six
         measured lines are declared in `BRACKET_LINE_EDITS` or closed by
         a block rule, so this question is 0 today and guards new
         staging: it is the sweep that found the Hemans leak M-47's scan
         had been closing on a balanced footnote anchor.

    NOTES, never FAIL: the population is a staging question, not a broken
    byte.

    SCOPED TO `corpus/song/`, the population M-47/M-27 sized and the one
    the declared tables key on. The legacy top-level files (`sonnets.txt`,
    `whitman.txt`, the Hafez licence/json) carry Gutenberg boilerplate
    brackets from before the header conventions existed — a different
    staging question this check would only bury under standing notes.
    """
    import lyric_harness as LH_
    out = []
    for rel, cf in files:
        if "corpus/song/" not in rel.replace(os.sep, "/"):
            continue
        base = os.path.basename(cf.path)
        undeclared, unclosed, orphan = 0, 0, 0
        sample, osample = "", ""
        wdrops = LH_.wrapped_apparatus_drops(cf._lines, base)
        vdrops, vedits = LH_.bracketed_verse_edits(cf._lines, base)
        for i, l in enumerate(cf._lines):
            s = l.strip()
            if not s or "[" not in s and "]" not in s:
                continue
            if i in wdrops or i in vdrops or i in vedits:
                continue
            if LH_.is_apparatus_line(s):
                if (s.startswith("[") and s.count("[") > s.count("]")
                        and base not in LH_.WRAPPED_APPARATUS_FOLLOW
                        and LH_.bracket_block_rule(base, s) is None):
                    unclosed += 1
                continue
            if s.endswith("]") and s.count("]") > s.count("["):
                orphan += 1
                osample = osample or s[:80]
            if "[" not in s:
                continue
            resolved = LH_.normalise_bracket_spans(s, base)
            for m in LH_._BRACKET_SPAN.finditer(resolved):
                if LH_.line_tokens(m.group(1)):
                    undeclared += 1
                    sample = sample or s[:80]
        if undeclared:
            out.append(Finding(
                "L", NOTE, rel,
                "%d token-yielding bracketed span(s) in sung lines are "
                "covered by NO declared class" % undeclared,
                "first: %r" % sample,
                "classify each span (anchor / ligature / supplied / "
                "diacritic markup) and declare it in lyric_harness's "
                "bracket tables — an undeclared span tokenises, and 68 of "
                "the 93 sized markers were END WORDS", "20"))
        if unclosed:
            out.append(Finding(
                "L", NOTE, rel,
                "%d unclosed `[`-opening apparatus row(s) covered by NO "
                "declaration" % unclosed,
                "the continuation lines after each such row are read as "
                "verse today",
                "inspect every unclosed block: all-apparatus files join "
                "WRAPPED_APPARATUS_FOLLOW; bracketed VERSE takes an "
                "M-152 rule (BRACKETED_VERSE_FILES / BRACKET_BLOCK_ROWS) "
                "— every block read before its file is declared", "20"))
        if orphan:
            out.append(Finding(
                "L", NOTE, rel,
                "%d kept sung line(s) end on an orphan `]` no declaration "
                "touches" % orphan,
                "first: %r" % osample,
                "adjudicate the line: a lost note tail or printer's mark "
                "joins BRACKET_LINE_EDITS; a block close means the opener "
                "needs its rule (M-152's population was six such lines, "
                "all declared at its close)", "20"))
    return out


CHECKS = collections.OrderedDict([
    ("A", ("ROW — every file has a sources.tsv row, every row a file", check_row)),
    ("B", ("HEADER — the file's own header against its row", check_header)),
    ("C", ("HASH — recorded bytes against present bytes", check_hash)),
    ("D", ("LANGUAGE — the declared phonology's readable fraction", check_language)),
    ("E", ("DISTINCT — doctrine 51, count distinct BYTES", check_distinct)),
    ("F", ("CHANNEL — doctrine 52, the channel not the legibility", check_channel)),
    ("G", ("ORTHOGRAPHY — doctrines 50/70, the destroying alternant", check_orthography)),
    ("H", ("STAGING — a `[VERSE]` mark on something that is not a stanza", check_staging)),
    ("I", ("INDENT — doctrine 14, the printing as an independent witness", check_indent)),
    ("J", ("ENCLITIC — F-5, which convention the edition sets", check_enclitic_convention)),
    ("K", ("ENCODING — F-4, the declared letter survives in the bytes", check_encoding)),
    ("L", ("BRACKET — M-47/M-27, a bracket is declared or named", check_bracket_declarations)),
])


# ---------------------------------------------------------------------------
# 8. Loading a tree
# ---------------------------------------------------------------------------


#: THE EXTENSIONS THE WALK READS, named because it is an EXCLUSION and an
#: exclusion nobody wrote down is a threshold nobody wrote down (doctrine
#: 58). Doctrine 34 says a corpus file with no `data/sources.tsv` row IS
#: the defect — and check A can only say that about a file the walk
#: HANDED IT. A `.csv` or `.tsv` under `corpus/` was invisible to the
#: question entirely, so the audit would report the tree clean without
#: ever having looked at it. MEASURED 2026-08-16: all 269 files under
#: `corpus/` are `.txt` or `.json`, so the hole is LATENT and not live —
#: which is exactly why it survived, and exactly why it is reported as a
#: count rather than left to the next reader to rediscover.
EXTS = (".txt", ".json")


def unwalked(root=CORPUS_DIR, exts=EXTS):
    """-> sorted paths under `root` that `load` SKIPS on extension.

    The population check A is blind to. Separate from `load` rather than
    folded into its return, because two callers already take that return
    and a census is a different question from a corpus.
    """
    out = []
    for dirpath, _d, names in os.walk(root):
        for n in sorted(names):
            if exts and not n.endswith(exts):
                out.append(display_path(os.path.join(dirpath, n)))
    return sorted(out)


#: What the LAST `load()` skipped on extension. Module state, and the
#: coupling is stated rather than hidden: `audit()` calls `load()` and
#: then the checks, in that order, so check A reports the tree it is
#: actually auditing. `unwalked(root)` recomputes it for any other
#: caller. THE FIRST DRAFT OF THIS CALLED `unwalked()` INSIDE check A
#: WITH NO ROOT, so auditing a temp tree reported the SHIPPED corpus's
#: skipped files — the wrong population, silently, on every non-default
#: root.
LAST_UNWALKED = []


def load(root=CORPUS_DIR, only=None, exts=EXTS):
    LAST_UNWALKED[:] = unwalked(root, exts)
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
    #: CI's question, which is not a human's. See PINNED_SHAPE.
    ap.add_argument("--verify-shape", action="store_true",
                    help="compare the finding counts against the "
                         "committed shape and exit 1 on drift")
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

    if "--verify-shape" in sys.argv:
        return _verify_shape(files, findings)
    return 1 if any(f.severity == FAIL for f in findings) else 0


#: THE COMMITTED SHAPE, so `--check` can go red on DRIFT rather than on the
#: standing FAIL. Measured 2026-08-13 and repinned in RESULTS_CORPUS_AUDIT.md
#: the same day from 423/3/227/193 -- two of the three FAILs had been fixed and
#: this file's record was never told, because NOTHING RUNS THIS AUDIT. An audit
#: of all eight adversaries found this one (adversary 5, "the CORPUS") had zero
#: automated callers: no CI step, no test, no caller, only a `__main__`. Its
#: committed output drifted for as long as nobody typed the command.
#:
#: WHY A PIN AND NOT A PLAIN GATE. `main()` already exits 1 on any FAIL, which
#: is the right default for a human running it. But one FAIL is STANDING and
#: TRUE -- `corpus/fas_hafez.LICENSE.txt` is an English licence document under
#: `corpus/`, so the D check is correct to call it declared `fas` and
#: unreadable. Gating CI on that would paint the job permanently red on a
#: finding nobody intends to "fix", and a permanently red gate is one nobody
#: reads. So `--verify-shape` asks the question CI can actually answer: has anything
#: MOVED since the record was written?
#:
#: Doctrine 58: these are counts nobody wrote down until now. Argue them and
#: repin; do not quiet a finding to meet them. A FAIL count that FALLS is still
#: drift and still fails here -- a record that is only corrected when it gets
#: worse is a record nobody checks in the good direction.
#:
#: REPINNED 2026-08-16 from ~~{"files": 269, "FAIL": 1, "WARN": 230,
#: "NOTE": 198}~~ -- ONE finding changed SEVERITY, none appeared or vanished.
#: `_ABSENT_ON_PURPOSE` gained the `FAILED SOURCE SEARCH` phrasing, so
#: `SEARCH:non-hattatal-third-edition-2026-08-11` stopped being a doctrine 34
#: WARN and became the doctrine 39 NOTE it always was. WARN 230 -> 229 and
#: NOTE 198 -> 199 in one move, and the two numbers are the SAME finding seen
#: twice: their sum is unchanged at 428, which is what a reclassification
#: looks like and what an appearing or disappearing finding does NOT look
#: like. That invariant is the argument for this repin -- it is not offered as
#: a rule the file enforces, because two independent moves could cancel.
#: THE PARAGRAPH ABOVE IS WHY THIS IS WRITTEN OUT: the counts were re-derived
#: by running the command and reading its output, NOT by editing 230 down to
#: 229 to make a red gate green.
#:
#: REPINNED 2026-08-19 from ~~{"files": 269, "FAIL": 1, "WARN": 229,
#: "NOTE": 199}~~ -- Pass-1 same-gate top-ups appended 49 new hymns to
#: eleven eng_hymn_ files from already-cited editions, real content growth.
#: Five findings moved: check E gained 2 WARN + 2 NOTE on
#: eng_hymn_watts.txt (pre-existing run-ons/title-echoes made newly visible
#: by the batch's own added titles) and check G gained 1 NOTE on
#: eng_hymn_cennick.txt (an elision-ratio disclosure, population-triggered).
#: See quality/RESULTS_CORPUS_AUDIT.md's own 2026-08-19 repin for the full
#: account, including a first (reverted, never-committed) extraction
#: attempt that staged a source's own trailing licence text as verse.
#: `python3 quality/audit_corpus.py` prints
#: `269 files, 434 findings: 1 FAIL, 231 WARN, 202 NOTE`.
#:
#: REPINNED 2026-08-20 from ~~{"files": 269, "FAIL": 1, "WARN": 231,
#: "NOTE": 202}~~ -- the owner-directed mass load staged 245 new
#: eng_celtic_msm_* files (812 songs) from the already-ADMITted Modern
#: Scottish Minstrel (PG22515). The load's FIRST cut (238 files, 790
#: songs, briefly on disk in this same sitting, never committed) was
#: fully restaged by a rev-2 parser after a contents cross-check found
#: three pseudo-author files named after song titles, ~26 silently
#: dropped songs, and several misattributions -- see
#: quality/RESULTS_CORPUS_AUDIT.md's 2026-08-20 repin for the account.
#: WARN is UNCHANGED at 231: every new file carries its own local: row
#: with the staged md5, so check C gained nothing. The +227 NOTEs are
#: check G's per-file elision-orthography disclosures, which Scots files
#: trigger by their nature (the ratio is the honest form of that claim,
#: per the check's own text). FAIL is the same one pre-existing
#: fas_hafez.LICENSE.txt mislabel.
#: REPINNED 2026-08-20 (second sitting, superseded values kept per
#: doctrine 17): ~~{"files": 514, "FAIL": 1, "WARN": 231, "NOTE": 429}~~
#: -- the Tier-1 concurrent load staged 234 new per-author files (514
#: items) and topped up 18 existing ones (46 items) from five
#: already-ADMITted song anthologies (PG37538, PG54211, PG15553,
#: PG27129, PG26715), each extraction reconciled against its edition's
#: own contents/index by a parallel agent, then landed by a single
#: writer behind the containment dedup (114 cross-source reprints
#: dropped). WARN is UNCHANGED at 231: every new file carries its own
#: local: row with the staged md5, so check C gained nothing. The +172
#: NOTEs are all check G's per-file elision-orthography disclosures
#: (582 of the 601), which 19th-century song verse triggers by its
#: nature ('tis, o'er). FAIL is the same one pre-existing
#: fas_hafez.LICENSE.txt mislabel.
#: REPINNED same sitting: 748 -> 742 files, 601 -> 598 NOTE -- six
#: cross-book spelling-variant twin files (Boker, Macarthy, Flash,
#: Sinclair, Falligant, Willson) merged after a systematic near-name
#: scan, each pair identified by the editions' own indexes (the
#: Falligant pair by the edition tying both credits to Savannah).
#: REPINNED 2026-08-20 (Phase-1): 742 -> 1194 files, 598 -> 917 NOTE.
#: Oxford (PG66619) and Poems of American History (PG47476) landed as
#: 452 new per-author files + 314 items topped into 84 existing ones;
#: the Home Book of Verse is HELD on a licence question its own text
#: raised. WARN is UNCHANGED at 231 -- every new file carries its own
#: local: row with the staged md5. THE APPEND BROKE 57 THINGS AND ALL
#: WERE SELF-DESCRIBING METADATA ON THE FILES TOPPED UP: 55 check-C md5
#: drifts (a row records the bytes it was written about, and appending
#: changed them) and 2 check-B `# lines:` headers (Coleridge 598->726,
#: Wordsworth 1751->2306). Both are repaired at the source rather than
#: pinned around -- the rows are repinned in the table's own
#: superseded-md5 convention, the headers recomputed through the
#: audit's OWN CorpusFile.verse_lines so the count cannot drift from
#: the definition that checks it. The 1 FAIL is the same pre-existing
#: fas_hafez.LICENSE.txt mislabel.
#: REPINNED same sitting: 1194 -> 1175 files, 917 -> 902 NOTE —
#: a near-name scan merged 19 spelling-variant twin files the
#: exact-name routing had created (a fuller form in one edition
#: against a shorter one already staged). Each pair's identity is
#: confirmed by the editions' OWN PRINTED DATES agreeing, and the
#: same dates keep Sir Aubrey de Vere (1788-1846) apart from his
#: son Aubrey Thomas (1814-1902), whom Oxford prints beside him.
#: REPINNED 2026-08-20: 1175 -> 1174 files, 902 -> 901 NOTE — the
#: Montgomery twin. `eng_celtic_msm_james_montgomery.txt` (6 items)
#: and `eng_hymn_montgomery.txt` (45) were one man, and the Minstrel's
#: OWN memoir proves it end to end: Irvine 1771, a Moravian father out
#: of Ireland, Fulneck, the Sheffield Iris, two imprisonments in the
#: Castle of York (the subject of one merged item), death at Sheffield
#: 1854. Merged into the larger holding. The ITEM count does not move
#: (7,618 either way) because no item was dropped -- only the file
#: holding them changed, which is why `songs` is absent from this pin
#: and `files` is not.
#: REPINNED 2026-08-20 (HBV safe subset): 1174 -> 1446 files, WARN
#: 231 -> 236, NOTE 901 -> 1097. The Home Book of Verse landed under the
#: owner's safe-subset ruling -- 272 new files and 615 items topped up
#: into 191 existing ones, 1,049 items of the 1,938 extracted. 400
#: (20.6%) were REFUSED by the gate because their admissibility would
#: have rested on an edition date nobody can name, and 489 more were
#: cross-source duplicates the dedup rail already held. The NOTE rise is
#: check G's orthography notes over 272 new files; the WARN rise is
#: check C on the 36 topped-up files that carry no local row of their
#: own and route through their header's parent row instead.
#: REPINNED same sitting: 1446 -> 1423 files, WARN 236 -> 233, NOTE
#: 1097 -> 1085 — a near-name twin scan over the WHOLE corpus merged 23
#: pairs the exact-name router could not see (a fuller form in one
#: edition against a shorter one already staged: `Alfred Tennyson` and
#: `Alfred Tennyson, Lord Tennyson`; `Carolina Nairne` and `Carolina
#: Oliphant, Lady Nairne`). Identity is the editions' OWN PRINTED DEATH
#: YEARS agreeing inside the corpus's existing DEATH_SLACK of 2 — which
#: is what admits Nairne, printed 1763-1845 in one book and 1766-1845 in
#: the other. A SURNAME GUARD rejected the one false positive the death
#: year alone would have merged: Frederick William Faber (1814-1863) and
#: Frederick William Thomas (1811-1864) share two given names and a
#: death year to within a year, and are two men.
#: REPINNED 2026-08-21: WARN ~~233~~ **235**, and it is a READER change rather
#: than a load — `files`, `FAIL` and `NOTE` are all unmoved, which is the
#: signature of one. `_items` used to read `--- TITLE: X  [air: Y]` whole, so
#: check E could never match a body line against a title carrying an air. The
#: two new WARNs are REAL and are filed as `MISSING.md` M-20: Hogg's `LOVE IS
#: LIKE A DIZZINESS` and Rodger's `BEHAVE YOURSEL' BEFORE FOLK` are each staged
#: TWICE in their own file, once with the air and once without. Nothing was
#: silenced to meet this pin and nothing was lost: gained 2, lost 0.
#: REPINNED 2026-08-21: WARN ~~235~~ **340**, NOTE ~~1085~~ **1133**, and it
#: is a NEW CHECK rather than a load or a reader change — `files` and `FAIL`
#: are both unmoved, which is that signature. Check H (STAGING) is `M-25(a)`'s
#: discriminator made mechanical: +105 WARN (a file holding one-line `[VERSE]`
#: blocks in a declared apparatus shape) and +48 NOTE (a file holding one-line
#: `[VERSE]` blocks in NO declared shape — the residue, reported as a count so
#: it cannot read as a pass, doctrine 20). Nothing was silenced to meet this
#: pin; the two findings the check manufactured on its first two runs were
#: REMOVED BY FIXING THE RULE and are written up at `apparatus_shape`.
#: REPINNED 2026-08-21, same sitting: NOTE ~~1133~~ **1162**, `files`, `FAIL`
#: and `WARN` all unmoved — the new-check signature again. Check I (INDENT) is
#: `M-28`'s discriminator: 1 corpus-wide note carrying the three counts (517
#: agree / 6 opposite / 22 inside the null) plus 28 per-file notes for the two
#: SMALL populations. The 517 that agree get no per-file note ON PURPOSE, and
#: the summary is what keeps them from being silent — 517 notes each saying
#: "as expected" would bury the 28 that do not (doctrine 20/79).
#: REPINNED 2026-08-22 on the K-4 STAGING: `files` ~~1423~~ **1430** and NOTE
#: ~~1162~~ **1168**; `FAIL` and `WARN` unmoved. Seven `corpus/song/non_*.txt`
#: entered on the owner's ruling admitting `sveinbjornt/sagadb.org` — 160
#: vísur, 1,228 verse lines, the first Old Norse text this corpus has ever
#: held (`MISSING.md` K-4, `quality/stage_sagadb.py`). Six of the seven earn a
#: check-G note and that is the check WORKING, not a defect: G screens for the
#: epenthetic `-ur` that modernised Icelandic inserts, which is the exact
#: property the 42 `*.is.xml` siblings were REFUSED for. Its hits here are
#: legitimate classical forms that merely end in `-ir`/`-ur` (`fylkir`,
#: `hilmir`, `bróður`, `faðir`), and the direct probe settles it: the staged
#: verse carries **114 classical `-r` nominatives and ZERO modernised `-ur`
#: ones** (`maðr` 6, `sonr` 2, `konungr` 2, `Þórólfr` 1, `Egill` 103), against
#: 1,534/0 in the prose it was cut from. The channel the hending measurement
#: needs is intact, measured rather than hoped.
#: REPINNED 2026-08-28 (~~NOTE 1168~~): Check J shipped (F-5's enclitic
#: convention detector) and its 60 notes — one corpus-wide partition and 59
#: spaced-DOMINANT editions named per file — are the whole delta; files,
#: FAIL and WARN are unmoved. Measured by re-running `--verify-shape`,
#: never by editing a number to meet the gate.
#: REPINNED AGAIN 2026-08-28 (~~NOTE 1228~~): Check L shipped (M-47/M-27's
#: bracket-declaration gate) and its 6 notes are the whole delta — the six
#: `corpus/song/` files whose unclosed `[` blocks are NOT the wrapped-note
#: convention (Watts's bracketed hymn stanzas, Drake's bracketed quatrain,
#: Carroll's later-editions block, Durfey's and Gay's never-closing stage
#: directions, one Skeat orphan) — M-152's population, carried as notes ON
#: PURPOSE until that entry is ruled. 0 undeclared token-yielding spans:
#: the declared tables cover every one measured, so that half of the check
#: guards new staging and is silent today.
#: REPINNED AGAIN 2026-08-28 (~~NOTE 1234~~): M-152 CLOSED — the six files
#: above are DECLARED in the bracketed-verse tables now, check L's second
#: question consults the reader's own matcher (`bracket_block_rule`) and
#: the six notes leave by declaration; its NEW third question (orphan `]`
#: closes in the kept stream) measures 0, so the whole delta is -6 and
#: both new-staging guards are silent today.
PINNED_SHAPE = {"files": 1430, "FAIL": 1, "WARN": 340, "NOTE": 1228}


def _verify_shape(files, findings):
    """-> exit code. FAILS LOUDLY; it does not report and continue."""
    fresh = {"files": len(files),
             FAIL: sum(1 for f in findings if f.severity == FAIL),
             WARN: sum(1 for f in findings if f.severity == WARN),
             NOTE: sum(1 for f in findings if f.severity == NOTE)}
    fresh = {"files": fresh["files"], "FAIL": fresh[FAIL],
             "WARN": fresh[WARN], "NOTE": fresh[NOTE]}
    print()
    print("=" * 78)
    print("CHECK -- RESULTS_CORPUS_AUDIT.md's committed shape against this run")
    print("=" * 78)
    bad = 0
    for k in ("files", "FAIL", "WARN", "NOTE"):
        ok = fresh[k] == PINNED_SHAPE[k]
        bad += not ok
        print("  [%s] %-6s committed %d%s"
              % ("ok  " if ok else "FAIL", k, PINNED_SHAPE[k],
                 "" if ok else ", measured %d" % fresh[k]))
    if bad:
        print()
        print("  %d figure(s) moved. RESULTS_CORPUS_AUDIT.md no longer "
              "describes this corpus." % bad)
        print("  Repin it with the date, keep the superseded value visible "
              "(doctrine 17), and do NOT silence a finding to meet the pin.")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


if __name__ == "__main__":
    sys.exit(main())
