#!/usr/bin/env python3
"""THE RANKED REVIEW QUEUE: which unread spellings to review first, ranked by
the whole songs a reading would let the lexicon look up (#527 plan item C4).

    python3 quality/coverage_queue.py --top 500 --out queue.tsv
    python3 quality/coverage_queue.py --attested moby_headwords.txt --top 500

IT READS THE DEV SPLIT ONLY. The population is the song corpus restricted to
the dev side of the frozen split (quality/coverage_split.py); validation is
never read here, so nothing selected from this queue was selected by looking
at it. There is no flag to change that.

WHAT IT RANKS. An item's BLOCKERS are its unread spellings: every word with an
unread piece, plus an end word the grader's own reader cannot anchor, from
quality/coverage_census.item_lookup_blockers -- the census's own definition.
An item with a non-lexical blocker -- a line with no endpoint, or an end word
the tokenizer drops before any lookup -- is completable by no reading; it is
counted apart and never ranked. A queue
STEP adds the set of spellings that completes the most further items per
spelling added, choosing among single spellings and the whole remaining
blocker sets of items (up to three spellings), so a word that only ever
appears beside another unknown still earns its place. Ties break on token
frequency, then spelling. Each step's completions are POTENTIAL lookup
readiness, not a measured unlock and not pronunciation correctness: an
unlock is claimed only after reviewed readings land and the census re-runs.

--attested FILE (one lowercase headword per line) restricts every step to
spellings that source attests -- the queue a batch from that source can
actually work through. Without it, the queue ranks every spelling.

THE CLASS COLUMN IS A HEURISTIC SORTING AID, NOT A CURATION: numeral,
no-letters, elision (an apostrophe), hyphenated, non-ASCII spelling, name-like
(never seen lowercase or never seen except capitalized mid-line),
archaic-derivable (-est/-eth/-st on a CMUdict base), or plain. Review decides
what a spelling is.
"""
import argparse
import collections
import hashlib
import itertools
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

MAX_SET = 3


def blockers(lex):
    """-> (items, nonlexical_items, tokens, case) over the DEV side of the
    frozen split. `items` holds each completable item's set of lexical
    blockers, from quality/coverage_census.item_lookup_blockers -- the
    census's own definition. An item with a NON-LEXICAL blocker (a line with
    no endpoint, or an end word the tokenizer drops before lookup) can be
    completed by no reading: it is counted in `nonlexical_items` and never
    ranked. `tokens` counts UNREAD WORD OCCURRENCES only -- an anchor-only
    blocker (`sh`) is a blocker with zero of them -- and `case` records how
    each spelling was capitalised, for the name-like class."""
    import lyric_harness as LH
    from quality.coverage_census import item_lookup_blockers
    from quality.coverage_split import checked_assignment, units
    # Proven against the CURRENT corpus before any ordinal id is used: a
    # moved population raises SplitMoved instead of handing a former
    # validation item a stale dev id (3PO's C4 review, #539).
    assignment, _meta = checked_assignment()
    items, nonlexical_items, tokens = [], 0, collections.Counter()
    seen_lower, seen_mid_cap = set(), set()
    for uid, _rel, _title, lines, _at in units():
        if assignment.get(uid) != "dev":
            continue
        found, nonlexical = item_lookup_blockers(lex, lines)
        if nonlexical:
            # Never ranked, so it contributes no counts either: every figure
            # below describes the same completable dev items.
            nonlexical_items += 1
            continue
        for line in lines:
            _ph, toks, _oov = lex.transcribe(line)
            for i, t in enumerate(toks):
                key = LH.fold_apostrophes(t).lower()
                if key in found and any(
                        lex.transcribe_word(p)[1] for p in lex.word_pieces(t) if p):
                    tokens[key] += 1
                    if t[:1].islower():
                        seen_lower.add(key)
                    elif i > 0:
                        seen_mid_cap.add(key)
        items.append(found)
    case = {k: {"lower": k in seen_lower, "mid_cap": k in seen_mid_cap}
            for k in tokens}
    return items, nonlexical_items, tokens, case


def classify(t, case, cmu):
    if not re.search(r"[^\W\d_]", t):
        return "no-letters"
    if re.search(r"\d", t):
        return "numeral"
    if "'" in t:
        return "elision"
    if "-" in t:
        return "hyphenated"
    if re.search(r"[^\x00-\x7f]", t):
        return "non-ascii"
    c = case.get(t)
    if c and not c["lower"] and c["mid_cap"]:
        return "name-like"
    if re.fullmatch(r"[a-z]+(?:eth|est|st)", t):
        stems = {t[:-3], t[:-3] + "e", t[:-2], t[:-2] + "e", t[:-1]}
        if any(s in cmu for s in stems if s):
            return "archaic-derivable"
    return "plain"


def rank(items, tokens, allowed=None, top=500):
    """Greedy marginal completion. -> [step dict]."""
    remaining = [set(s) for s in items if s]
    done = sum(1 for s in items if not s)
    chosen, steps = set(), []
    while len(chosen) < top:
        counts = collections.Counter(frozenset(r) for r in remaining if r)
        candidates = set()
        for r in counts:
            if len(r) <= MAX_SET and (allowed is None or r <= allowed):
                candidates.add(r)
            for t in r:
                if allowed is None or t in allowed:
                    candidates.add(frozenset([t]))
        best, best_key = None, None
        for m in candidates:
            # Items completed by m are those whose remaining set is a subset
            # of m: at most 2^3 - 1 lookups, never a scan.
            gain = sum(counts.get(frozenset(c), 0)
                       for k in range(1, len(m) + 1)
                       for c in itertools.combinations(sorted(m), k))
            key = (gain / len(m), sum(tokens[t] for t in m), -len(m),
                   tuple(sorted(m)))
            if gain and (best_key is None or key > best_key):
                best, best_key = m, key
        if best is None:
            break
        completed = sum(counts.get(frozenset(c), 0)
                        for k in range(1, len(best) + 1)
                        for c in itertools.combinations(sorted(best), k))
        done += completed
        chosen |= best
        for r in remaining:
            r -= best
        remaining = [r for r in remaining if r]
        steps.append({"add": sorted(best), "completes": completed,
                      "items_lookup_ready": done, "types_chosen": len(chosen)})
    return steps


def attested_identity(path):
    """-> (headword set, identity): the file's bytes AND its headword
    population, so replacing the file at the same path changes the queue's
    recorded identity, not only its selections."""
    with open(path, "rb") as fh:
        raw = fh.read()
    allowed = {l.strip().lower() for l in raw.decode("utf-8").splitlines()
               if l.strip()}
    return allowed, {
        "path": path, "sha256": hashlib.sha256(raw).hexdigest(),
        "headwords": len(allowed),
        "headwords_sha256": hashlib.sha256(
            "".join(w + "\n" for w in sorted(allowed)).encode()).hexdigest()}


QUEUE_SOURCES = ("quality/coverage_queue.py", "quality/coverage_census.py",
                 "quality/coverage_split.py")


def _source_commit():
    """-> HEAD, suffixed `+dirty` when ANY source this queue's numbers come
    from -- the queue, the census definition it reuses, or the split guard
    -- differs from it (3PO's C4 review: checking only the census let changed
    queue code claim a clean commit)."""
    import subprocess

    def git(*args):
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                              text=True, check=True).stdout.strip()
    try:
        head = git("rev-parse", "HEAD")
        dirty = git("status", "--porcelain", "--", *QUEUE_SOURCES)
    except (OSError, subprocess.CalledProcessError):
        return None
    return head + ("+dirty" if dirty else "") if head else None


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--top", type=int, default=500,
                    help="stop once at least this many spellings are chosen "
                         "(a final set step may pass it by up to two)")
    ap.add_argument("--attested", help="restrict to these headwords (one per line)")
    ap.add_argument("--lexicon-supplement", default="none")
    ap.add_argument("--out", help="write the queue TSV here")
    a = ap.parse_args(argv)
    from quality.coverage_census import (build_lexicon, inputs_sha256,
                                         split_record)
    from quality.coverage_split import checked_assignment
    from quality import lexicon_supplement as S
    import lyric_harness as LH
    lex = build_lexicon(a.lexicon_supplement, "none")
    items, nonlexical_items, tokens, case = blockers(lex)
    allowed, attested = (attested_identity(a.attested) if a.attested
                         else (None, None))
    steps = rank(items, tokens, allowed, a.top)
    cmu = LH.Lexicon().entries
    assignment, meta = checked_assignment()
    keep = {u for u, side in assignment.items() if side == "dev"}
    files = sorted({os.path.join(ROOT, u.split("#")[0]) for u in assignment})
    blocker_types = set().union(*items) if items else set()
    summary = {
        "population": "song corpus, dev side only",
        "inputs_sha256": inputs_sha256(files),
        "split": split_record("dev", keep, meta),
        "lexicon": S.lexicon_identity(lex),
        "attested": attested,
        "source_commit": _source_commit(),
        "dev_items": len(items) + nonlexical_items,
        "dev_items_blocked_nonlexically": nonlexical_items,
        "dev_items_lookup_ready_before": sum(1 for s in items if not s),
        "dev_items_lookup_ready_after_queue": steps[-1]["items_lookup_ready"] if steps else None,
        "steps": len(steps), "types_chosen": steps[-1]["types_chosen"] if steps else 0,
        # Two populations over the same completable dev items, named apart
        # (3PO's C4 review): spellings with an unread word occurrence, and
        # every lexical lookup blocker, which also holds the anchor-only ones.
        "unread_word_types": len(tokens),
        "lookup_blocker_types": len(blocker_types),
        "anchor_only_blocker_types": len(blocker_types - set(tokens)),
        "potential_not_measured": True,
    }
    rows = ["step\tspelling\tclass\tunread_word_tokens\tcompletes_with_step\t"
            "ready_after_step"]
    for i, s in enumerate(steps, 1):
        for t in s["add"]:
            rows.append(f"{i}\t{t}\t{classify(t, case, cmu)}\t{tokens[t]}\t"
                        f"{s['completes']}\t{s['items_lookup_ready']}")
    text = "# " + json.dumps(summary, sort_keys=True) + "\n" + "\n".join(rows) + "\n"
    print(json.dumps(summary, indent=1, sort_keys=True))
    if a.out:
        with open(a.out, "w", encoding="utf-8") as fh:
            fh.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
