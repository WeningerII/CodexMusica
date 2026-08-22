#!/usr/bin/env python3
"""The structure census — run 1: English.

Protocol: quality/STRUCTURE_CENSUS_PREREGISTRATION.md, committed WITH this
file and before any corpus-wide number. The census asks, for every
(corpus file, catalog structure, pair population) cell, what fraction of
pairs REALIZE the structure — the CHANCE-RATE table that is the null half
of every future laziness calibration. It makes no laziness claim: run 1's
cells are `incidental` everywhere except the end-rhyme family over
rhyme-constrained corpora, and a phase-2 calibration may draw signal only
from constrained cells and null only from incidental ones.

ONE JUDGE. Every pair goes through `quality.structures.judge` — the
identical call `grade()` routes declared structures through (doctrine 48:
no private re-implementation; doctrine 1: no second spelling of any rule).
57 rows: the comparator sentinel is excluded because its judge refuses by
design and its base rates are already held elsewhere.

THREE COUNTS, NEVER SUMMED (doctrine 79): n_true / n_false / n_refused,
asserted to sum to n_pairs (falsifier F1). The rate is judged-base only;
a cell with zero judged pairs reports no rate, not 0.0 (doctrine 20).

Run:  python3 quality/structure_census.py --pilot
      python3 quality/structure_census.py --full [--shard k/n]
      python3 quality/structure_census.py --merge OUT SHARD1 SHARD2...
      python3 quality/structure_census.py --dedup-verify FILE
"""

import argparse
import collections
import glob
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, ".."))

import lyric_harness as LH                              # noqa: E402
from quality import structures as ST                    # noqa: E402
from quality import phonology as PH                     # noqa: E402

#: The censused rows — every catalog row except the comparator sentinel
#: (registration: "57 rows, not 58").
ROWS = tuple(n for n, s in ST.STRUCTURES.items() if s.kind != "comparator")

#: The end-rhyme family: `constrained` over endword-cross in
#: rhyme-constrained corpora (the registration's declared tag list).
CONSTRAINED_FAMILY = frozenset({
    "masculine-rhyme", "feminine-rhyme", "dactylic-rhyme", "perfect-rhyme",
    "perfect-rhyme-(last-stressed-syllable)",
    "rime-riche-(last-stressed-syllable)"})

#: family -> (is its endword population rhyme-constrained by tradition?, why).
#:
#: THREE STATES, NOT TWO (`MISSING.md` M-23, doctrine 20). This was a
#: `frozenset` of two names, so `constrained_tag` answered a plain False for
#: every family outside it — and False is a CLAIM: *this corpus's end words
#: are not rhyme-constrained*. That is true of `whitman`, which is the
#: declared negative control and was chosen for it. It is FALSE of a ghazal,
#: whose radif is the constraint, and of a cywydd, whose cynghanedd is. Run 1
#: never noticed because run 1 is English: every row in
#: `data/structure_census_eng.tsv` is one of the three families below.
#:
#: A family with no row is `undeclared` — nobody has looked — and that is
#: reported as itself rather than as a measured negative. Run 2 owes a row per
#: tradition; what this table changes is that the owing is now VISIBLE in the
#: artifact instead of being spelled `no`.
RHYME_CONSTRAINED = {
    "eng_song": (True,
                 "the English song corpus: end rhyme is the tradition's own "
                 "organising constraint, and the registration names it."),
    "sonnets": (True,
                "152 Shakespeare sonnets, ABABCDCDEFEFGG declared. The "
                "endword population is constrained by the form itself."),
    "whitman": (False,
                "THE DECLARED NEGATIVE CONTROL, and the only row here whose "
                "False is a measurement rather than a default. Free verse: "
                "the registration requires it to be incidental on every row, "
                "and E1 is the comparison that reads it."),
}

#: Derived, for the readers that want membership rather than the reason. Never
#: typed beside the table (doctrine 1).
RHYME_CONSTRAINED_FAMILIES = frozenset(
    f for f, (v, _r) in RHYME_CONSTRAINED.items() if v)

#: structure row -> why a REGISTERED AMENDMENT struck its `constrained` tag.
#:
#: `quality/RESULTS_STRUCTURE_CENSUS.md` records E1 failing on
#: `dactylic-rhyme` and amends the expectation: the row leaves the
#: constrained-family expectation, E1 re-reads over the remaining five (PASS,
#: 5 of 5), and *"the artifact's `constrained=yes` tag on dactylic-rhyme cells
#: is VOID for consumers"*. That sentence lived in prose ONLY: the shipped
#: table still carries 144 `constrained=yes` dactylic rows and nothing a
#: consumer runs says they are struck. Doctrine 48 — a principle that lives
#: only in prose gets followed exactly as often as someone remembers it — and
#: doctrine 17, which is about not quoting a falsified check as live.
#:
#: THE TAG IS NOT REWRITTEN, DELIBERATELY. The artifact is a DATED SNAPSHOT
#: and the code that produced it must keep describing it; the amendment's own
#: text defers the drop to run 2's registration. So the row stays in
#: `CONSTRAINED_FAMILY`, the 144 cells keep their tag, and what changes is
#: that a consumer is TOLD — `void_reason` is the mechanism, and
#: `test_structure_census.py` §4b is what fails if the two ever disagree.
VOID_CONSTRAINED_ROWS = {
    "dactylic-rhyme":
        "STRUCK by E1's registered amendment (quality/"
        "RESULTS_STRUCTURE_CENSUS.md). The judge is sound — it answers "
        "glamorous/amorous TRUE and night/delight FALSE on constructed "
        "dactyls — and the zeros are the corpora's: the sonnets are iambic "
        "pentameter, so a line CANNOT end on a dactylic-stressed word "
        "(0 of 12,926 judged pairs is a metrical fact, not a failure), and "
        "the tradition's dactylic rhyme is characteristically MOSAIC, which "
        "an endword population of single words cannot hold. A phase-2 "
        "calibration may draw NEITHER SIGNAL NOR NULL from this row's tag.",
}


def void_reason(row):
    """-> the amendment that struck this row's `constrained` tag, or `""`.

    THE ENTRY POINT FOR A CONSUMER OF `data/structure_census_eng.tsv`. Reading
    the `constrained` column alone is not enough: 144 of its `yes` cells are
    struck, and the strike is a registered amendment rather than a fact about
    the cell. Ask this before quoting a tag.
    """
    return VOID_CONSTRAINED_ROWS.get(row, "")

OUT_DEFAULT = os.path.join(ROOT, "data", "structure_census_eng.tsv")


# --- THE TOKENISER IS A DECLARED COORDINATE (MISSING.md M-22) --------------
#
# `pair_counters` called `lyric_harness.line_tokens` directly until
# 2026-08-21.  That function is ASCII-only -- `re.findall(r"[A-Za-z'\-]+")` --
# and it is the RIGHT reader for English and a SHREDDER for everything else.
# Measured over real corpus lines at the time of the fix:
#
#     ltc   99.9% of lines yield ZERO tokens      fas  100.0%
#     san   96.6% of lines mis-tokenise           fin   41.6%
#     eng    0.0%                                 -- which is why nothing
#                                                    had ever gone red
#
#     'väinämöinen' -> ['v', 'in', 'm', 'inen']   vs fin._tokens -> whole word
#     'pää'         -> ['p']
#     'adyāpi tāṃ kanakacampakadāmagaurīṃ'
#                   -> ['ady','pi','t','kanakacampakad','magaur']
#
# THIS IS THE SUBSTITUTION THAT VOIDED KALEVALA ALLITERATION RUN 1 (CLAUDE.md:
# "the ASCII tokenizer had shredded ä/ö, and the fin phonology's `_tokens` was
# the one definition all along, doctrine 1").  It was LATENT here only because
# `corpus_files()` globs `eng_*`, so the census has never tokenised a
# non-Latin line and no recorded figure moves.  It would have bitten in run
# 2's first hour, which is the hour a registration promising world-shape is
# cashed.
#
# WHY A DECLARED TABLE AND NOT "ASK THE PHONOLOGY".  "Ask the phonology" is
# AMBIGUOUS FOR ENGLISH, which is the one language that matters for
# reproducing run 1.  `English._tokens` and `LH.line_tokens` are DIFFERENT
# FUNCTIONS: the second erases `(...)` spans first (`strip_parens=True`).
# MEASURED over the 283,515 eng sung lines, they disagree on **1,061 lines
# (0.374%) across 192 files** -- small, and not zero, so a naive swap would
# have moved `data/structure_census_eng.tsv` and its md5 while looking like a
# pure refactor.
#
# eng therefore keeps `LH.line_tokens`, and that is the right reading on the
# merits rather than a compatibility fudge: `line_tokens`' own docstring
# records that `corpus/song/`'s 196 parenthetical files use `(...)` the
# literary way -- an aside, not sung -- and that `data/song_endword_en.tsv`
# was built on that reading (doctrine 91: build the population the way the
# grader reads).  The parenthetical convention is a property of the ENGLISH
# PRINTED CORPUS, not of the English language.
#
# WHAT THE OTHER CORPORA DO WITH `(...)` IS NOT DECIDED HERE, and the load is
# recorded so the next session decides it with a number rather than a guess:
# cym 13 of 5,248 sung lines (0.25%), fin 58 of 41,805 (0.14%), fas 79 of
# 141,732 (0.06%), msa 3 of 513 (0.58%), ltc 0, san 0.  Each phonology's own
# `_tokens` keeps parentheticals.  Whether that is right is a per-corpus
# EDITORIAL-CONVENTION question, not a language question, and inventing an
# answer here would be the same error one layer over.

#: language -> the ONE site whose tokeniser the census reads that language's
#: lines with.  Spelled as an import path so the declaration is greppable and
#: so six phonology modules are not imported to run an English census.
TOKENISER_SITE = {
    "eng": "lyric_harness.line_tokens",
    "fin": "quality.phonology.fin._tokens",
    "san": "quality.phonology.san._tokens",
    "fas": "quality.phonology.fas.tokens",
    "non": "quality.phonology.non._tokens",
    "som": "quality.phonology.som._tokens",
}

#: language -> why no tokeniser is declared.  THREE DIFFERENT REASONS, kept
#: apart because doctrine 44 separates "hard to build" from "cannot obtain"
#: and the remedies differ.  A language in here REFUSES; it never silently
#: falls back to the ASCII reader, which is the whole defect.
NO_TOKENISER = {
    "ltc": ("PERMANENT. One character is one syllable, so WORD is not a unit "
            "of this language and no tokeniser can exist -- `ltc.py` declares "
            "none, and `line_tokens` yields 4 tokens from 3,833 lines, all 4 "
            "scraped out of `&KR1553;` entity markup. The `word-within-line` "
            "population has no definable members here. An ENDWORD population "
            "is still definable (a line's end is well defined even where a "
            "word is not) and is run 2's decision, not this table's."),
    "cym": ("BUILDABLE, and not built. `cym.py` CONSUMES tokens "
            "(`readability_census(phon, tokens, ...)`) and never produces "
            "them. The eight digraphs are already handled inside "
            "`syllabify`, so this is a tokeniser gap only -- circumflexed "
            "vowels (ŵ ŷ â î ô û) are what `line_tokens` shreds."),
    "msa": ("BUILDABLE, and not built. `msa.py` takes tokens as an argument "
            "and declares no `_tokens`. Note its known apostrophe defect "
            "(`s'ri` < seri) is live under the ASCII reader, so a tokeniser "
            "here has a correctness job and not only a coverage one."),
}


class NoTokeniser(Exception):
    """Raised rather than shredding. A census that cannot read a language's
    words REFUSES that language by name; it does not report rates over
    fragments (doctrine 79 -- a refusal is not a failure, and doctrine 20 --
    'cannot read' and 'read and found nothing' are different answers)."""


def language_of(path):
    """-> the corpus file's language prefix. The two English controls are
    NAMED rather than prefixed, so they are resolved by name."""
    base = os.path.basename(path)
    if base in ("sonnets.txt", "whitman.txt"):
        return "eng"
    return base.split("_", 1)[0] if "_" in base else ""


def tokeniser_for(language):
    """-> the declared tokeniser for `language`, or raise `NoTokeniser`."""
    site = TOKENISER_SITE.get(language)
    if site is None:
        why = NO_TOKENISER.get(
            language,
            "no tokeniser site is declared for %r, and no reason is recorded "
            "either -- which means nobody has looked. Declare one or record "
            "why there cannot be one." % (language,))
        raise NoTokeniser("%s: %s" % (language, why))
    import importlib
    # WALK THE DOTTED PATH, longest importable prefix first, then getattr.
    # A site may name a MODULE attribute (`quality.phonology.fin._tokens`)
    # or a CLASS attribute (`quality.phonology.eng.English._tokens`), and
    # both have to be expressible: `English._tokens` is the reading this
    # table deliberately does NOT take for eng, and a table that cannot
    # SPELL the rejected alternative cannot be checked against it. Written
    # as a bare `rsplit(".", 1)` first, which made the alternative
    # unspellable and turned the control that guards it into a
    # ModuleNotFoundError three frames down.
    parts = site.split(".")
    obj, seen = None, 0
    for i in range(len(parts) - 1, 0, -1):
        try:
            obj = importlib.import_module(".".join(parts[:i]))
            seen = i
            break
        except ImportError:
            continue
    if obj is None:
        raise NoTokeniser(
            "%s: no importable module in the declared site %r" % (language, site))
    for attr in parts[seen:]:
        obj = getattr(obj, attr, None)
        if obj is None:
            raise NoTokeniser(
                "%s: the declared site %r does not resolve — %r is absent. A "
                "tokeniser site that has rotted REFUSES in this layer's words "
                "rather than raising somebody else's AttributeError."
                % (language, site, attr))
    if not callable(obj):
        raise NoTokeniser(
            "%s: the declared site %r resolves to a non-callable %r"
            % (language, site, type(obj).__name__))
    return obj
COLUMNS = ("language", "phonology", "corpus_file", "family", "structure",
           "kind", "population", "constrained", "n_pairs", "n_true",
           "n_false", "n_refused", "rate_judged")


def corpus_files(root=None):
    """The declared run-1 population: 143 eng_ song files + two controls."""
    root = root or os.path.join(ROOT, "corpus")
    files = sorted(glob.glob(os.path.join(root, "song", "eng_*.txt")))
    files.append(os.path.join(root, "sonnets.txt"))
    files.append(os.path.join(root, "whitman.txt"))
    return files


def family_of(path):
    base = os.path.basename(path)
    if base.startswith("eng_"):
        return "eng_song"
    return base.rsplit(".", 1)[0]


def items_of(path):
    """A file -> its items' lyric lines. Pairs never cross an item boundary
    (registration). THREE READERS, EACH THE EXISTING ONE for its corpus
    (doctrine 1 — no respelling of an item convention that already has a
    definition):

    - `eng_*` song files: the `--- TITLE:` boundary, exactly
      `quality/build_song_frequency.py`'s convention (its 4,930-item
      count is the check); other `--- `/apparatus lines are dropped but
      do NOT open a new item.
    - `sonnets.txt`: `battery.parse_sonnets` — the oracle's own reader,
      152 fourteen-line items, Gutenberg matter excluded by it.
    - `whitman.txt`: `battery.whitman_verse` — the 150-line negative-
      control slice every recorded Whitman figure is measured on, one
      item.
    """
    base = os.path.basename(path)
    if base == "sonnets.txt" or base == "whitman.txt":
        import battery
        if base == "sonnets.txt":
            return battery.parse_sonnets(path)
        return [battery.whitman_verse(path)]
    text = LH.read_lyric_text(path)
    items, cur = [], []
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("--- TITLE:"):
            if cur:
                items.append(cur)
            cur = []
            continue
        if not line or LH.is_apparatus_line(line):
            continue
        cur.append(line)
    if cur:
        items.append(cur)
    return items


def pair_counters(path, language=None, tokens=None):
    """-> (endword_cross, word_within_line): Counter[(a, b)] per population,
    lowercased spellings, judged in the registration's declared order
    (line order / word order — matching grade()'s own call order).

    THE TOKENISER IS THE LANGUAGE'S OWN (M-22). `language` defaults to the
    file's prefix and `tokens` to that language's declared site; a language
    with no declared tokeniser raises `NoTokeniser` rather than falling back
    to the ASCII reader. Passing `tokens=` is how a caller declares a reading
    the table does not carry — it is not a way around the refusal, because
    the caller then owns the choice by name.
    """
    if tokens is None:
        tokens = tokeniser_for(language or language_of(path))
    ec = collections.Counter()
    wl = collections.Counter()
    for item in items_of(path):
        ends = []
        for line in item:
            toks = tokens(line)
            if not toks:
                continue
            ends.append(toks[-1].lower())
            for i in range(len(toks)):
                for j in range(i + 1, len(toks)):
                    a, b = toks[i].lower(), toks[j].lower()
                    if a and b:
                        wl[(a, b)] += 1
        for i in range(len(ends)):
            for j in range(i + 1, len(ends)):
                ec[(ends[i], ends[j])] += 1
    return ec, wl


class Memo:
    """verdict cache over (row, a, b) — sound because the judge is a
    deterministic pure function of the spellings and the phonology
    (registration's dedup rule; verified by --dedup-verify)."""

    def __init__(self, phon):
        self.phon = phon
        self.d = {}

    def judge(self, row, a, b):
        key = (row, a, b)
        if key not in self.d:
            self.d[key] = ST.judge(row, a, b, phon=self.phon)
        return self.d[key]


def census_file(path, memo, dedup=True, language=None):
    """-> {(structure, population): [n_pairs, n_true, n_false, n_refused]}"""
    ec, wl = pair_counters(path, language=language)
    out = {}
    for pop, counter in (("endword-cross", ec), ("word-within-line", wl)):
        for row in ROWS:
            cell = [0, 0, 0, 0]
            if dedup:
                for (a, b), mult in counter.items():
                    v = memo.judge(row, a, b)
                    cell[0] += mult
                    cell[1 if v else (3 if v is None else 2)] += mult
            else:
                # the pilot's no-dedup arm: every token pair judged live
                for (a, b), mult in counter.items():
                    for _ in range(mult):
                        v = ST.judge(row, a, b, phon=memo.phon)
                        cell[0] += 1
                        cell[1 if v else (3 if v is None else 2)] += 1
            # F1 — the three verdict counts sum to n_pairs, or the
            # instrument is broken and nothing is written.
            assert cell[0] == cell[1] + cell[2] + cell[3], (path, row, pop,
                                                           cell)
            out[(row, pop)] = cell
    return out


def constrained_tag(family, row, pop):
    """-> "yes" | "no" | "undeclared". The cell's `constrained` column.

    RETURNS A STRING AND NOT A BOOL, and the change is not cosmetic: under a
    two-state answer an undeclared family was reported `no`, which is a claim
    about a tradition nobody had examined (doctrine 20). `undeclared` is the
    third state and it is what every non-English family gets today.

    THE FIRST TWO CONDITIONS STAY BINARY ON PURPOSE. Whether the cell is an
    end-rhyme cell at all — the population and the structure row — is settled
    by two declared tables in this file, so a cell that is not one is `no` and
    not `undeclared`: that question WAS asked and the answer is no. Only the
    CORPUS half can be unexamined.

    CALLERS MUST NOT USE THIS IN A BOOLEAN CONTEXT — `"no"` is truthy, so a
    surviving `if constrained_tag(...)` would silently tag every cell `yes`.
    `test_structure_census.py` §4 asserts on the AST that no caller does.
    """
    if pop != "endword-cross" or row not in CONSTRAINED_FAMILY:
        return "no"
    declared = RHYME_CONSTRAINED.get(family)
    if declared is None:
        return "undeclared"
    return "yes" if declared[0] else "no"


def rows_for(path, cells, language=None):
    family = family_of(path)
    base = os.path.basename(path)
    # The `language`/`phonology` columns were emitted as the LITERAL "eng",
    # "eng" until 2026-08-21 (M-22) — two of the five hard-coded English
    # sites, and the two that would have mislabelled every run-2 row while
    # the table looked world-shaped. They are read off the file now. For the
    # run-1 population this is BYTE-IDENTICAL: every file in it is eng.
    lang = language or language_of(path)
    out = []
    for (row, pop), (n, t, f, r) in sorted(cells.items()):
        judged = t + f
        rate = f"{t / judged:.6f}" if judged else ""
        out.append((
            lang, lang, base, family, row, ST.get(row).kind, pop,
            constrained_tag(family, row, pop),
            str(n), str(t), str(f), str(r), rate))
    return out


def write_tsv(path, rows):
    rows = sorted(rows)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\t".join(COLUMNS) + "\n")
        for r in rows:
            fh.write("\t".join(r) + "\n")


def read_tsv(path):
    with open(path, encoding="utf-8") as fh:
        header = fh.readline().rstrip("\n").split("\t")
        assert tuple(header) == COLUMNS, header
        return [tuple(line.rstrip("\n").split("\t")) for line in fh]


def run(files, out_path, label, parts_dir=None):
    """PER-FILE CHECKPOINTING (run-2 amendment, from run 1's own
    operations): three shard processes were killed by a process cap
    before their table landed, and the recovery re-ran whole shards
    because nothing was written until the end. Each file's cells are now
    written to a part file the moment they are computed — atomically, via
    rename, so a killed process never leaves a half part — and a restart
    REUSES every finished part. The most any interruption can cost is one
    file. Parts live under TMPDIR keyed by the output's basename, never
    beside a repo artifact."""
    # THE JUDGE PHONOLOGY IS PER FILE (M-22, second half). This was
    # `PH.get("eng")` once for every file until 2026-08-21 -- a THIRD
    # hard-coded English site, and the one that would have made the
    # tokeniser fix DANGEROUS on its own: right words, wrong phonology,
    # and a run that looks like it worked. Resolving it per file is safe
    # because the memo below is already per file, and it has to be: the
    # memo is keyed on (row, a, b) with no phonology in the key, so one
    # memo shared across two phonologies would return the first
    # language's verdict for the second language's pair.
    parts = parts_dir or os.path.join(
        os.environ.get("TMPDIR", "/tmp"),
        os.path.basename(out_path) + ".parts")
    os.makedirs(parts, exist_ok=True)
    all_rows = []
    t0 = time.time()
    for i, path in enumerate(files, 1):
        base = os.path.basename(path)
        part = os.path.join(parts, base + ".part.tsv")
        if os.path.exists(part):
            all_rows.extend(read_tsv(part))
            print(f"  [{i}/{len(files)}] {base:44s} checkpointed — reused",
                  flush=True)
            continue
        tf = time.time()
        # A FRESH memo per file — the registration's own dedup rule is
        # "once per unique (structure, ordered spelling pair) PER FILE",
        # and the pilot measured a global memo at 6.05M entries over just
        # 7 files, which extrapolates to an unbounded-memory full run.
        # Word-level transcription caches live inside the phonology and
        # stay warm across files either way.
        lang = language_of(path)
        memo = Memo(PH.get(lang))
        cells = census_file(path, memo, dedup=True, language=lang)
        rows = rows_for(path, cells, language=lang)
        write_tsv(part + ".tmp", rows)
        os.replace(part + ".tmp", part)
        all_rows.extend(rows)
        print(f"  [{i}/{len(files)}] {base:44s} "
              f"{time.time() - tf:6.1f}s  memo {len(memo.d):>9,}",
              flush=True)
    write_tsv(out_path, all_rows)
    print(f"{label}: {len(files)} files, {len(all_rows)} cells, "
          f"{time.time() - t0:.0f}s total -> {out_path}")


def dedup_verify(path):
    """The registration's pilot check (a): dedup and no-dedup runs of one
    file must agree byte-for-byte on every cell."""
    phon = PH.get("eng")
    a = census_file(path, Memo(phon), dedup=True)
    b = census_file(path, Memo(phon), dedup=False)
    same = a == b
    print(f"dedup-verify {os.path.basename(path)}: "
          f"{'IDENTICAL' if same else '*** DIVERGED ***'} "
          f"({len(a)} cells)")
    return 0 if same else 1


def d1_diagnostic():
    """Registration D1 — recorded, NOT a falsifier. 1,000 seeded
    endword-cross pairs from eng_song; the masculine-rhyme judge tabulated
    against the engine's admits() verdict (RHYME/RIME_RICHE at theta). A
    cell compilation and a scalar band are different questions, so
    agreement is MEASURED and disagreements exemplified; no threshold was
    preregistered, and registering the tabulation now is what stops the
    number being cherry-picked later."""
    import random
    pool = sorted({p
                   for f in corpus_files()
                   if os.path.basename(f).startswith("eng_")
                   for p in pair_counters(f)[0]})
    rng = random.Random(20260818)
    sample = rng.sample(pool, 1000)
    lex = LH.Lexicon()
    decl = LH.Declaration()
    phon = PH.get("eng")
    tab = collections.Counter()
    examples = {}
    for a, b in sample:
        sv = ST.judge("masculine-rhyme", a, b, phon=phon)
        ancs1, _, _ = LH.line_anchors(lex, a)
        ancs2, _, _ = LH.line_anchors(lex, b)
        s = LH.best_score(ancs1, ancs2, decl, a, b)
        av = LH.admits(s, decl.theta_rhyme)
        key = (("true" if sv else "refused" if sv is None else "false"),
               "admits" if av else "rejects")
        tab[key] += 1
        examples.setdefault(key, (a, b))
    print(f"D1: {len(pool):,} unique eng_song endword-cross pairs, "
          f"1,000 sampled at seed 20260818")
    for key in sorted(tab):
        a, b = examples[key]
        print(f"  masculine-rhyme={key[0]:>7}  admits()={key[1]:>7}  "
              f"{tab[key]:>4}  e.g. {a!r}/{b!r}")
    agree = tab[("true", "admits")] + tab[("false", "rejects")]
    judged = sum(n for (svk, _), n in tab.items() if svk != "refused")
    if judged:
        print(f"  agreement over judged: {agree}/{judged} "
              f"({agree / judged:.1%}); refusals apart (doctrine 79)")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pilot", action="store_true")
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--d1", action="store_true")
    ap.add_argument("--shard", default=None,
                    help="k/n over the sorted file list (--full only)")
    ap.add_argument("--out", default=None)
    ap.add_argument("--merge", nargs="+", default=None,
                    help="OUT SHARD1 SHARD2... (concatenate cell rows)")
    ap.add_argument("--dedup-verify", default=None, metavar="FILE")
    a = ap.parse_args()

    if a.d1:
        return d1_diagnostic()
    if a.dedup_verify:
        return dedup_verify(a.dedup_verify)
    if a.merge:
        out, shards = a.merge[0], a.merge[1:]
        rows = []
        for s in shards:
            rows.extend(read_tsv(s))
        write_tsv(out, rows)
        print(f"merged {len(shards)} shard(s), {len(rows)} cells -> {out}")
        return 0

    files = corpus_files()
    if a.pilot:
        eng = [f for f in files if os.path.basename(f).startswith("eng_")]
        files = eng[:5] + files[-2:]
        # working notes, never a repo artifact — the registration's pilot
        # clause: pilot numbers are not results
        out = a.out or os.path.join(
            os.environ.get("TMPDIR", "/tmp"), "census_pilot.tsv")
        run(files, out, "pilot")
        return 0
    if a.full:
        if a.shard:
            k, n = (int(x) for x in a.shard.split("/"))
            if not 1 <= k <= n:
                print(f"REFUSED — shard {a.shard} is out of range")
                return 2
            files = [f for i, f in enumerate(files) if i % n == k - 1]
        out = a.out or OUT_DEFAULT
        run(files, out, f"full{' shard ' + a.shard if a.shard else ''}")
        return 0
    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
