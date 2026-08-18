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

#: Corpora whose endword population is rhyme-constrained by tradition.
RHYME_CONSTRAINED_FAMILIES = frozenset({"eng_song", "sonnets"})

OUT_DEFAULT = os.path.join(ROOT, "data", "structure_census_eng.tsv")
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


def pair_counters(path):
    """-> (endword_cross, word_within_line): Counter[(a, b)] per population,
    lowercased spellings, judged in the registration's declared order
    (line order / word order — matching grade()'s own call order)."""
    ec = collections.Counter()
    wl = collections.Counter()
    for item in items_of(path):
        ends = []
        for line in item:
            toks = LH.line_tokens(line)
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


def census_file(path, memo, dedup=True):
    """-> {(structure, population): [n_pairs, n_true, n_false, n_refused]}"""
    ec, wl = pair_counters(path)
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
    return (pop == "endword-cross" and row in CONSTRAINED_FAMILY
            and family in RHYME_CONSTRAINED_FAMILIES)


def rows_for(path, cells):
    family = family_of(path)
    base = os.path.basename(path)
    out = []
    for (row, pop), (n, t, f, r) in sorted(cells.items()):
        judged = t + f
        rate = f"{t / judged:.6f}" if judged else ""
        out.append((
            "eng", "eng", base, family, row, ST.get(row).kind, pop,
            "yes" if constrained_tag(family, row, pop) else "no",
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


def run(files, out_path, label):
    phon = PH.get("eng")
    memo = Memo(phon)
    all_rows = []
    t0 = time.time()
    for i, path in enumerate(files, 1):
        tf = time.time()
        cells = census_file(path, memo, dedup=True)
        all_rows.extend(rows_for(path, cells))
        print(f"  [{i}/{len(files)}] {os.path.basename(path):44s} "
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
