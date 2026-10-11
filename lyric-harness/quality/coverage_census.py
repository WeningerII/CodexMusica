#!/usr/bin/env python3
"""THE COVERAGE CENSUS: how much sung text the lexicon cannot read, by word,
by spelling and by WHOLE SONG.

    python3 quality/coverage_census.py --population song
    python3 quality/coverage_census.py --population song --lexicon-supplement=v2 --fallback=high
    python3 quality/coverage_census.py --population song --top 40 --out census.json

WHY THIS EXISTS. The dictionary lane's figures lived in comments: pasted
scripts, shorthand denominators, and a token share read as a type share
(PR #527, 3PO's correction 2026-10-11). This instrument is the committed,
re-runnable form, and it reports the three quantities that answer different
questions, never summed into one (doctrine 79):

  * WORDS   sung word occurrences, and how many have an unread piece;
  * TYPES   distinct folded spellings, and how many are ever unread;
  * ITEMS   whole songs (a corpus item: one `--- TITLE:`), and how many
            have NO unread word anywhere. A song is what a writer finishes;
            one rare word blocks it however small the token share is.
  * END WORDS, read by the TWO end-word readers the harness has, reported
            apart because they disagree:
      - `end_anchor`: the grader's own reader, `line_anchors` (an end word
            is unreadable exactly when it yields no anchor, the invariant
            `line_readability` states). It takes the last run with a letter
            (`raw_final_token`), so a trailing ` --` is skipped, and a
            compound reads when its LAST piece reads.
      - `end_grid`: the repeated-section check, `quality/grid.py`
            `_end_word` keyed by `rime_cmudict(lex)`, which refuses with
            END_WORD_UNREADABLE. It reads the last whitespace token WHOLE:
            `sixty-six` has no key until the lexicon carries it whole, and a
            line ending ` --` keys on `--`.

WHAT "UNREAD" MEANS HERE: a word any of whose pieces `Lexicon.transcribe`
reports as OOV, the same piece path the grader reads a line by. It is a
LOOKUP census. It is not a grade: a song that reads in full can still fail
its rhyme or meter, and that is not a dictionary gap.

THE COORDINATES ARE DECLARED, NEVER DEFAULTED SILENTLY: the population, the
supplement version (`none` or a manifest id, quality/lexicon_supplement.py)
and the fallback (`none`, `high`, `low`), all printed with the result.

COMPLETION POTENTIAL: for each unread type, the items in which it is the
SOLE lookup blocker (interior pieces and the grader's end anchor together),
and a fractional credit 1/k for each item it shares with k-1 other blockers.
Both are POTENTIAL: an unlock is claimed only after the reading lands and
this census is re-run. A queue ranks by marginal completion over jointly
completable sets, never by sole-blocker counts alone.

EVERY RECORD NAMES ITS INPUTS: the population's file digest
(`inputs_sha256`), the supplement version and its sha256, the fallback and
the census commit, so figures from different populations cannot be mixed.
"""
import argparse
import collections
import glob
import hashlib
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

#: Each population is a list of globs under the harness root, read item by
#: item. Declared here so a figure names the exact files it counts.
POPULATIONS = {
    "song": ["corpus/song/eng_*.txt"],
    "library": ["corpus/library/**/eng_*.txt"],
}


def items_of(path):
    """-> [(title, [sung line, ...])]: the corpus file's items, read the way
    `quality/audit_corpus.py` reads them (`--- TITLE:` opens an item; `#`
    comment and apparatus lines, `[SECTION]` and `--- ` markers are not
    sung). A file with no title line is one item."""
    from quality.audit_corpus import CorpusFile, _items
    cf = CorpusFile(path)
    items = _items(cf)
    if not items and cf.verse_lines:
        items = [(os.path.basename(path), [l.strip() for l in cf.verse_lines])]
    return items


def build_lexicon(supplement, fallback):
    import lyric_harness as LH
    fb = None if fallback == "none" else fallback
    if supplement == "none":
        return LH.Lexicon(fallback=fb)
    from quality import lexicon_supplement as S
    return S.SupplementedLexicon(fallback=fb, version=supplement)


def census(paths, lex, top=0):
    """-> the census record for these files under this lexicon."""
    import lyric_harness as LH
    from quality import grid as G
    rhyme_key = G.rime_cmudict(lex)
    readers = ("end_anchor", "end_grid")
    E = {k: {"n": 0, "unread": 0, "seen": set(), "types": collections.Counter(),
             "clear": 0, "only": collections.Counter(),
             "blocking": collections.Counter()} for k in readers}
    ready_items = 0
    words = unread_words = 0
    type_seen, type_unread = set(), collections.Counter()
    items = clear_items = 0
    only_blocker = collections.Counter()
    blocking_items = collections.Counter()
    # Blockers of LOOKUP READINESS: interior pieces and the grader's anchor
    # together. A type's completion potential counts an item only when it is
    # the item's sole blocker across BOTH, and the fractional credit 1/k
    # shares each k-blocker item, so a word that only ever appears beside
    # another unknown is not scored zero forever (3PO, #527, point 5).
    sole_lookup, credit = collections.Counter(), collections.Counter()
    for path in paths:
        for _title, lines in items_of(path):
            if not lines:
                continue
            items += 1
            unread_here = set()
            here = {k: set() for k in readers}
            for line in lines:
                ends = {"end_anchor": LH.raw_final_token(line,
                                                         strip_parens=lex.strip_parens),
                        "end_grid": G._end_word(line) or None}
                for k, ew in ends.items():
                    if not ew:
                        continue
                    ekey = LH.fold_apostrophes(ew).lower()
                    e = E[k]
                    e["n"] += 1
                    e["seen"].add(ekey)
                    bad = (not LH.line_anchors(lex, line)[0] if k == "end_anchor"
                           else rhyme_key(ew) is None)
                    if bad:
                        e["unread"] += 1
                        e["types"][ekey] += 1
                        here[k].add(ekey)
                # The words `transcribe` itself reads (enclitics joined,
                # parentheticals stripped, Latin-script tokens only), then
                # each word's own pieces through `transcribe_word`: exactly
                # the loop `Lexicon.transcribe` runs, kept per word.
                _phones, toks, _oov = lex.transcribe(line)
                for t in toks:
                    key = LH.fold_apostrophes(t).lower()
                    words += 1
                    type_seen.add(key)
                    pieces = [p for p in lex.word_pieces(t) if p]
                    if any(lex.transcribe_word(p)[1] for p in pieces):
                        unread_words += 1
                        type_unread[key] += 1
                        unread_here.add(key)
            if unread_here:
                for k in unread_here:
                    blocking_items[k] += 1
                if len(unread_here) == 1:
                    only_blocker[next(iter(unread_here))] += 1
            else:
                clear_items += 1
            for k in readers:
                e = E[k]
                if here[k]:
                    for t in here[k]:
                        e["blocking"][t] += 1
                    if len(here[k]) == 1:
                        e["only"][next(iter(here[k]))] += 1
                else:
                    e["clear"] += 1
            blockers = unread_here | here["end_anchor"]
            if not blockers:
                ready_items += 1
            elif len(blockers) == 1:
                sole_lookup[next(iter(blockers))] += 1
            for t in blockers:
                credit[t] += 1 / len(blockers)
    rec = {
        "words": words, "unread_words": unread_words,
        "unread_word_share": round(unread_words / words, 6) if words else None,
        "types": len(type_seen), "unread_types": len(type_unread),
        "unread_type_share": (round(len(type_unread) / len(type_seen), 6)
                              if type_seen else None),
        "items": items, "items_fully_read": clear_items,
        "items_fully_read_share": round(clear_items / items, 6) if items else None,
        "items_blocked_by_exactly_one_type": sum(only_blocker.values()),
        # WORD-AND-ANCHOR LOOKUP READINESS: every word's pieces read AND every
        # line end anchored by the grader's own reader. It is not workflow
        # readiness (that also needs the return-grid obligations a declared
        # return carries, on its returns only), not pronunciation
        # correctness, and not a passing song. The grid reader is reported
        # apart, not folded in, because it judges repeated sections only.
        "items_lookup_ready": ready_items,
        "items_lookup_ready_share": (round(ready_items / items, 6)
                                     if items else None),
        "items_with_one_lookup_blocker": sum(sole_lookup.values()),
    }
    if top:
        rec["top_unread_types"] = [
            {"type": k, "unread_words": n, "items_blocked": blocking_items[k],
             # Potential, not a measured unlock: a claimed unlock is replayed
             # through this census after the reading lands.
             "word_lookup_completion_potential": sole_lookup[k],
             "fractional_item_credit": round(credit[k], 3)}
            for k, n in type_unread.most_common(top)]
    for k in readers:
        e = E[k]
        rec[k] = {
            "end_words": e["n"], "unread_end_words": e["unread"],
            "unread_end_word_share": (round(e["unread"] / e["n"], 6)
                                      if e["n"] else None),
            "end_types": len(e["seen"]), "unread_end_types": len(e["types"]),
            "items_end_words_all_read": e["clear"],
            "items_blocked_by_exactly_one_type": sum(e["only"].values()),
        }
        if top:
            rec[k]["top_unread_types"] = [
                {"type": t, "unread_end_words": n,
                 "items_blocked": e["blocking"][t],
                 "items_where_sole_unread_end_type": e["only"][t]}
                for t, n in e["types"].most_common(top)]
    return rec


def inputs_sha256(paths):
    """One digest naming the exact population: each file's path relative to
    the harness root and its own sha256, in sorted order. Two figures with
    different digests were measured on different texts."""
    h = hashlib.sha256()
    for p in sorted(paths):
        with open(p, "rb") as fh:
            h.update(f"{os.path.relpath(p, ROOT)}\t"
                     f"{hashlib.sha256(fh.read()).hexdigest()}\n".encode())
    return h.hexdigest()


def _lexicon_sha256(lex):
    from quality import lexicon_supplement as S
    return S.lexicon_identity(lex)["sha256"]


def _commit():
    """-> the HEAD commit, suffixed `+dirty` when this census's own source
    differs from it (a figure from an uncommitted census names no commit)."""
    def git(*args):
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                              text=True, check=True).stdout.strip()
    try:
        head = git("rev-parse", "HEAD")
        dirty = git("status", "--porcelain", "--", os.path.relpath(__file__, ROOT))
    except (OSError, subprocess.CalledProcessError):
        return None
    return head + ("+dirty" if dirty else "") if head else None


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--population", required=True, choices=sorted(POPULATIONS))
    ap.add_argument("--lexicon-supplement", default="none",
                    help="`none` or a manifest version id (v1, v2, ...)")
    ap.add_argument("--fallback", default="none", choices=("none", "high", "low"))
    ap.add_argument("--top", type=int, default=0,
                    help="list the N most frequent unread types")
    ap.add_argument("--out", help="write the JSON record here as well")
    a = ap.parse_args(argv)
    paths = sorted({p for g in POPULATIONS[a.population]
                    for p in glob.glob(os.path.join(ROOT, g), recursive=True)})
    if not paths:
        print(f"CANNOT TELL: population {a.population!r} matched no files")
        return 2
    lex = build_lexicon(a.lexicon_supplement, a.fallback)
    rec = {"population": a.population, "globs": POPULATIONS[a.population],
           "files": len(paths), "inputs_sha256": inputs_sha256(paths),
           "lexicon_supplement": a.lexicon_supplement,
           "lexicon_supplement_sha256": _lexicon_sha256(lex),
           "fallback": a.fallback, "census_commit": _commit()}
    rec.update(census(paths, lex, a.top))
    text = json.dumps(rec, indent=1, ensure_ascii=False)
    print(text)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as fh:
            fh.write(text + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
