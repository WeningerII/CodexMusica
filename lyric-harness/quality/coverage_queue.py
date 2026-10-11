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
unread piece, plus an end word the grader's own reader cannot anchor -- the
same definition as quality/coverage_census.py's `items_lookup_ready`. A queue
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
    """-> (items: [set of spellings], tokens: Counter, case: {spelling: flags})
    over the DEV side of the frozen split."""
    import lyric_harness as LH
    from quality.coverage_split import read_split, units
    assignment, _meta = read_split()
    items, tokens = [], collections.Counter()
    seen_lower, seen_mid_cap = set(), set()
    for uid, rel, _title, lines, _at in units():
        if assignment.get(uid) != "dev":
            continue
        here = set()
        for line in lines:
            _ph, toks, _oov = lex.transcribe(line)
            for i, t in enumerate(toks):
                key = LH.fold_apostrophes(t).lower()
                if any(lex.transcribe_word(p)[1] for p in lex.word_pieces(t) if p):
                    here.add(key)
                    tokens[key] += 1
                    if t[:1].islower():
                        seen_lower.add(key)
                    elif i > 0:
                        seen_mid_cap.add(key)
            if not LH.line_anchors(lex, line)[0]:
                f = LH.raw_final_token(line, strip_parens=lex.strip_parens)
                if f:
                    here.add(LH.fold_apostrophes(f).lower())
        items.append(here)
    case = {k: {"lower": k in seen_lower, "mid_cap": k in seen_mid_cap}
            for k in tokens}
    return items, tokens, case


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
    from quality.coverage_census import build_lexicon, _commit
    from quality.coverage_split import read_split
    import lyric_harness as LH
    lex = build_lexicon(a.lexicon_supplement, "none")
    items, tokens, case = blockers(lex)
    allowed = None
    if a.attested:
        with open(a.attested, encoding="utf-8") as fh:
            allowed = {l.strip().lower() for l in fh if l.strip()}
    steps = rank(items, tokens, allowed, a.top)
    cmu = LH.Lexicon().entries
    _assignment, meta = read_split()
    summary = {
        "population": "song corpus, dev side only", "split_salt": meta["salt"],
        "split_inputs_sha256": meta["inputs_sha256"],
        "lexicon_supplement": a.lexicon_supplement, "census_commit": _commit(),
        "attested_file": a.attested, "dev_items": len(items),
        "dev_items_lookup_ready_before": sum(1 for s in items if not s),
        "dev_items_lookup_ready_after_queue": steps[-1]["items_lookup_ready"] if steps else None,
        "steps": len(steps), "types_chosen": steps[-1]["types_chosen"] if steps else 0,
        "unread_types": len(tokens), "potential_not_measured": True,
    }
    rows = ["step\tspelling\tclass\ttokens\tcompletes_with_step\tready_after_step"]
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
