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

WHAT "UNREAD" MEANS HERE: a word any of whose pieces `Lexicon.transcribe`
reports as OOV, the same piece path the grader reads a line by. It is a
LOOKUP census. It is not a grade: a song that reads in full can still fail
its rhyme or meter, and that is not a dictionary gap.

THE COORDINATES ARE DECLARED, NEVER DEFAULTED SILENTLY: the population, the
supplement version (`none` or a manifest id, quality/lexicon_supplement.py)
and the fallback (`none`, `high`, `low`), all printed with the result.

"SONGS UNLOCKED": for each unread type, the number of items in which it is
the ONLY unread type -- the songs that adding that one reading would finish.
It is the ranking a review queue should read beside raw frequency.
"""
import argparse
import collections
import glob
import json
import os
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
    words = unread_words = 0
    type_seen, type_unread = set(), collections.Counter()
    items = clear_items = 0
    only_blocker = collections.Counter()
    blocking_items = collections.Counter()
    for path in paths:
        for _title, lines in items_of(path):
            if not lines:
                continue
            items += 1
            unread_here = set()
            for line in lines:
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
    rec = {
        "words": words, "unread_words": unread_words,
        "unread_word_share": round(unread_words / words, 6) if words else None,
        "types": len(type_seen), "unread_types": len(type_unread),
        "unread_type_share": (round(len(type_unread) / len(type_seen), 6)
                              if type_seen else None),
        "items": items, "items_fully_read": clear_items,
        "items_fully_read_share": round(clear_items / items, 6) if items else None,
        "items_blocked_by_exactly_one_type": sum(only_blocker.values()),
    }
    if top:
        rec["top_unread_types"] = [
            {"type": k, "unread_words": n, "items_blocked": blocking_items[k],
             "items_unlocked_alone": only_blocker[k]}
            for k, n in type_unread.most_common(top)]
    return rec


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
           "files": len(paths), "lexicon_supplement": a.lexicon_supplement,
           "fallback": a.fallback}
    rec.update(census(paths, lex, a.top))
    text = json.dumps(rec, indent=1, ensure_ascii=False)
    print(text)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as fh:
            fh.write(text + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
