#!/usr/bin/env python3
"""RE-DERIVE EVERY BANKED SONG VERDICT AGAINST THIS TREE.

**THE GAP THIS CLOSES** (`MISSING.md` M-144). Two registers already bank what
the delivered songs are and how they were made, and NEITHER asks this
question:

  `quality/song_record.py --check` re-derives the ten pre-registered FEATURES
    over the committed bytes, keyed on the harness commit. A moved number
    means the TREE moved. Features only.
  `quality/song_log.py --verdicts` charges every process claim in
    `songs/README.md` — an exit code, a stop reason, a round count, an md5, a
    mandated/judged/refused triple — against a BANKED ROW. That asks *did the
    narrator report what the verb SAID*, which is the right question and is
    not this one. History.

**Nothing re-derived a banked VERDICT against the current tree**, and that is
how a 13.5% miscount sat inside a headline triple with every gate green: the
slot-refusal defect M-144 records moved `crooked_waltz` from `47/47/0` to
`47/25/22` and nothing could see it, because the banked row and the prose
agreed with each other and neither was re-run.

**WHY THIS IS ITS OWN MODULE AND NOT AN ARM OF `song_log.py`.** That module's
discipline is that it reaches every verdict through `subprocess` and **imports
no grader at all** — asserted BY ABSENCE in `quality/test_songs_log.py` §5,
which bans the strings `Reviser`, `discriminate`, `floor` and
`QualityFeatures` from its source. It is a RECORD and must not become a second
grader. This module grades on purpose, so it lives apart and that guard stays
true. (The first draft of this arm was written inside `song_log.py` and turned
§5 red, which is the check working.)

**THE MANDATE IS NOT RESTATED HERE.** `--returns=` does not ADD groups: both
spellings go into ONE cover with `returns=` naming which of its groups are the
return classes, exactly as `lyric_harness.py`'s `_mandate_arg` builds it. The
first draft of this module read `--returns=` as additional groups, so
`turn_the_wheel` came back 6 pairs against a banked 10 (6 rhyme groups + 4
return groups) and the arm reported a drift IT HAD INVENTED — on five songs at
once. A re-derivation that restates the mandate is a second mandate (doctrine
1), which is the very defect the sitting that built this was closing.

    python3 quality/regrade_verdicts.py        # HOLDS / MOVED / CANNOT RUN
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.dirname(HERE) not in sys.path:
    sys.path.insert(0, os.path.dirname(HERE))

import lyric_harness as LH                       # noqa: E402
from quality import schemes as SC                # noqa: E402
from quality.revise import Reviser               # noqa: E402

#: A banked block is `song BP DRAFT '--groups=…' […] --subdivision N` followed
#: within a few lines by its triple.
_CMD = re.compile(
    r"song\s+(\S+\.blueprint\.json)\s*\\?\s*\n?\s*(\S+\.txt)"
    r"(.*?)--subdivision\s+(\d+)", re.S)

#: WHITESPACE-TOLERANT THROUGHOUT, because the prose wraps wherever it wraps.
#: The first draft allowed a newline in exactly ONE of the four gaps and
#: silently skipped `wheat_mane.txt`, whose line breaks after the second
#: slash — a parser that misses a song reports CANNOT RUN, and that reads as a
#: DOCUMENT gap rather than as the parser's own brittleness (doctrine 20).
_TRIPLE = re.compile(r"(\d+)\s+pairs\s+mandated\s*/\s*(\d+)\s+judged"
                     r"\s*/\s*(\d+)\s+refused", re.S)
_GROUPS = re.compile(r"'--groups=(.*?)'", re.S)
_RETURNS = re.compile(r"'--returns=(.*?)'", re.S)

#: THE TRIPLES THE TREE HAS SINCE MOVED, AND WHY — adopted DELIBERATELY.
#:
#: TWO GATES, TWO QUESTIONS, AND THEY MUST NOT BE MADE TO FIGHT. The banked
#: figure in `songs/README.md` is left EXACTLY as written, because it is a
#: true record of a run at its own commit and `song_log.py --verdicts` reads
#: it that way (doctrine 17). This table is the other question. A song here
#: must measure its recorded NEW triple exactly; a song absent must still
#: measure its README triple. Either way a FRESH move is red.
REGRADE_MOVED = {
    "crooked_waltz.txt": (
        (47, 25, 22),
        "M-144, 2026-08-26: a declared slot resolving to NO ANCHOR is a "
        "REFUSAL and was counted as JUDGED. 12 of this song's 45 binding "
        "sites resolve to nothing the phonology can anchor (L1 `T5` is "
        "`by`) and 22 of its 47 mandated pairs touch one"),
    "the_frost_ledger.txt": (
        (71, 36, 35),
        "M-144, same cause and the larger share: 35 of 71 mandated pairs "
        "touch a binding site resolving to NO ANCHOR"),
}


def regrade(readme=None):
    """-> exit code. THREE VERDICTS, NEVER SUMMED (doctrine 79)."""
    root = os.path.dirname(HERE)
    path = readme or os.path.join(root, "songs", "README.md")
    text = open(path, encoding="utf-8").read()
    lex, decl = LH.Lexicon(), LH.Declaration()
    holds, moved, cannot = [], [], []
    for m in _CMD.finditer(text):
        draft, flags = m.group(2), m.group(3)
        name = os.path.basename(draft)
        t = _TRIPLE.search(text[m.end():m.end() + 400])
        g = _GROUPS.search(flags)
        if not t:
            cannot.append(f"{name}: the block states no triple")
            continue
        if not g:
            cannot.append(f"{name}: the block declares no `--groups=`")
            continue
        dpath = os.path.join(root, draft)
        if not os.path.exists(dpath):
            cannot.append(f"{name}: {draft} is absent from this checkout")
            continue
        lines = list(LH.load_lyric_lines(dpath))
        spec = [x.split(",") for x in g.group(1).split(";")]
        r = _RETURNS.search(flags)
        ret = ([x.split(",") for x in r.group(1).split(";")] if r else None)
        try:
            mand = (SC.mandate(spec + ret, n_lines=len(lines), returns=ret)
                    if ret else SC.mandate(spec, n_lines=len(lines)))
            got = Reviser(lex, decl).inspect(list(lines),
                                             mandate=mand)["grade"]
        except Exception as e:          # a refusal is an answer, not a crash
            cannot.append(f"{name}: {type(e).__name__}: {str(e)[:70]}")
            continue
        banked = tuple(int(x) for x in t.groups())
        now = (got["pairs_mandated"], got["pairs_judged"],
               got["pairs_refused"])
        want = REGRADE_MOVED[name][0] if name in REGRADE_MOVED else banked
        note = ("  [MOVED and adopted: %s]" % REGRADE_MOVED[name][1][:56]
                if name in REGRADE_MOVED else "")
        if now == want:
            holds.append(f"{name:<28} {now[0]}/{now[1]}/{now[2]}{note}")
        else:
            moved.append(f"{name:<28} expected {want[0]}/{want[1]}/{want[2]}"
                         f"   measured {now[0]}/{now[1]}/{now[2]}"
                         + ("" if name in REGRADE_MOVED
                            else "   (banked in songs/README.md)"))
    print("RE-DERIVED — every banked mandated/judged/refused triple in "
          "songs/README.md, against THIS tree")
    for label, rows in (("HOLDS", holds), ("MOVED", moved),
                        ("CANNOT RUN", cannot)):
        print(f"\n  {label} {len(rows)}")
        for row in rows:
            print(f"    {row}")
    print("\n  THREE VERDICTS, NEVER SUMMED (doctrine 79). A MOVED triple is "
          "an ANSWER and not a failure: the banked figure stays true AS A "
          "RECORD of a run at its own commit (doctrine 17), and a move is the "
          "tree having shifted under it. Adopt it in `REGRADE_MOVED` with its "
          "CAUSE, or repair the tree — never by editing the banked prose, "
          "which `song_log.py --verdicts` reads as history.")
    return 3 if moved else (2 if cannot else 0)


if __name__ == "__main__":
    raise SystemExit(regrade())
