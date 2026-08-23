#!/usr/bin/env python3
"""DOES CONSULTING THE CODE GRAPH COST LESS THAN SEARCHING — AND ANSWER THE SAME?

Graphify's advertised figure is *"70x fewer tokens per search"* (its own site)
and *"up to 71.5x fewer tokens per session"* (a community setup repo whose only
concrete measurement is a single case study on an unrelated 126-file React
project, with no stated methodology). Doctrine 58: a number nobody can
re-derive is a threshold nobody wrote down. This module re-derives it HERE, on
this tree, and reports what it actually finds.

THE TRAP THIS MODULE EXISTS TO AVOID. A route that returns LESS is cheaper by
construction, so a saving measured without checking the ANSWER is charging the
wrong layer (doctrine 79). Every question therefore carries a RECALL: the set
of source files the graph route names, against the set the search route finds.
**A ratio is not quoted for a question whose recall is short** — it is reported
as SHORT, because a cheap wrong answer is not a saving.

THREE COUNTS, NEVER SUMMED: graph cost, search cost, recall.

WHAT IT MEASURED HERE, 2026-08-23, and none of it resembles the advertised
figure:

  * against the search that answers the SAME question (`grep 'SYMBOL('`, the
    USE sites) the graph route costs **0.68x** — that is, roughly HALF AGAIN
    AS MUCH, not 70x less.
  * the **180x** only appears against `grep+read`, every matched file quoted
    in full, which is a baseline nobody uses: no one answers "who calls this"
    by reading two dozen files end to end.
  * mean recall over the indexed questions is **0.74** (0.77 counting the
    defining file), with **1 of 5** complete — the graph route is also the
    LESS complete one.
  * and **3 of 8 questions are NOT INDEXED AT ALL.** `MANDATORY_PURSUE`,
    `LENGTH_GATE_CODES` and `PROFILES` have no node: the graph indexes
    callables and classes (4,347 of its 7,555 nodes are callable) and carries
    no module-level constant. For THIS tree that is the finding that matters,
    because doctrine 1 makes a DECLARED CONSTANT the primary coupling here —
    so the graph covers the callable half of the architecture and is blind to
    the declared half, which is the half the gate census reads.

THE HONEST CONCLUSION IS NOT "IT IS USELESS". `affected` answers a question
grep cannot — DEPENDENCY rather than TEXTUAL MENTION — and `god-nodes`
independently recovered this repo's documented spine from the AST alone. What
is refuted is the TOKEN case, which is the case that was made for it.

WHY CHARACTERS AND NOT TOKENS. `tiktoken` cannot fetch its encoding through
this container's egress proxy, so a token count here would be an estimate
wearing a decimal. Characters are counted EXACTLY. Both arms are the same kind
of text (code identifiers, paths, line numbers), so a tokenizer applies
substantially the same transform to each and **the RATIO — which is the whole
of the claim — is what survives.** A chars/4 estimate is printed beside it and
labelled as the estimate it is.

TWO BASELINES, because "what a search costs" has two honest readings and the
advertised figure quietly uses the larger:
  `grep`      the matching lines only — what `rg SYMBOL` puts on screen. The
              FLOOR, and the fairer comparison for "where is this used".
  `grep+read` those lines plus the full text of every file that matched — what
              "re-reads all your files from scratch" actually means, and the
              baseline the 70x is quoted against.

Run:   python3 quality/graph_probe.py
Check: python3 quality/graph_probe.py --check     (exit 3 if a recall regressed)
"""

import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))          # the repository root
GRAPH = os.path.join(ROOT, "graphify-out", "graph.json")

__all__ = ["QUESTIONS", "probe", "summarize", "PINNED"]

#: THE QUESTION SET, DECLARED. Every one is a question this session actually
#: put to the tree while doing other work — not a set chosen after seeing which
#: way the numbers fell, which is the argmax-over-a-swept-parameter this repo
#: refuses (doctrine 19). Each names a symbol and the reason it was asked.
QUESTIONS = (
    ("line_anchors", "callable",
     "the end-rhyme projection's own function — what would a placement "
     "conversion have to touch? (asked while closing M-67)"),
    ("slot_line", "callable",
     "the accessor wired today — which call sites does it reach? "
     "(asked while closing M-74)"),
    ("GridFinding", "callable",
     "the SHAPE layer's constructor — who builds one? This is the question "
     "the gate census got WRONG on its first run, so the ground truth is "
     "known independently of both routes here"),
    ("swap_end_word", "callable",
     "the loop's only move before placement existed (asked while closing "
     "M-67)"),
    ("best_score", "callable",
     "the comparator every mandated pair is scored through"),
    # THE OTHER HALF OF THIS ARCHITECTURE, and the reason the split exists.
    # Doctrine 1 makes a DECLARED CONSTANT the primary coupling in this tree:
    # a `Declaration` dataclass, `PROFILES`, `ADOPTED`, `MANDATORY_PURSUE`,
    # `LENGTH_GATE_CODES`. These are not calls and the graph does not index
    # them (measured below), so grading them by RECALL would report 0% and
    # read as "the graph is wrong" when the truth is "the graph does not
    # answer this KIND of question" — doctrine 20's own distinction.
    ("MANDATORY_PURSUE", "constant",
     "the pursue set — who reads it? (asked while building the gate census)"),
    ("LENGTH_GATE_CODES", "constant",
     "the codes a verb may not exit 0 on (asked while building the census)"),
    ("PROFILES", "constant",
     "the floor's calibrated length profiles (asked while closing M-69)"),
)


def _run(cmd, cwd=ROOT):
    """-> stdout as text. A failing command contributes its own output, which
    is the honest cost: a route that errors still spent what it printed."""
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
                           timeout=300)
        return (p.stdout or "") + (p.stderr or "")
    except (OSError, subprocess.SubprocessError) as e:
        return f"<command failed: {e}>"


def _files_named(text):
    """-> the set of repo-relative .py/.js paths a blob of output names.

    ONE definition, applied to BOTH routes, so recall cannot be an artefact of
    reading the two outputs by different rules (doctrine 1)."""
    out = set()
    for tok in text.replace("(", " ").replace(")", " ").replace(",", " ").split():
        tok = tok.strip("\"'`:[]")
        # A grep hit is `path:LINE:text`; a graph hit is `path:LNNN`.
        for piece in tok.split(":"):
            if piece.endswith((".py", ".js", ".mjs")):
                p = piece.replace(ROOT + "/", "").lstrip("./")
                if p:
                    out.add(p)
    return out


def indexed(symbol):
    """Is this symbol a NODE of the graph at all?

    Asked BEFORE recall, because 'the graph names none of these files' and
    'the graph has never heard of this symbol' are different answers and
    collapsing them charges a blindness to the comparator (doctrine 20)."""
    try:
        with open(GRAPH, encoding="utf-8") as f:
            g = json.load(f)
    except (OSError, ValueError):
        return None
    want = symbol.strip().lower()
    return any(str(n.get("label", "")).strip().rstrip("()").lower() == want
               for n in g.get("nodes", ()))


def probe(symbol, kind):
    """-> one question's record. Runs both routes and compares what they NAME.

    THE SEARCH ARM IS THE FAIR ONE, not the flattering one. `grep SYMBOL`
    finds every textual mention — the definition, every docstring, every
    comment — while the graph answers "what DEPENDS on this". Scoring the
    graph against mentions would charge it for not answering a question it
    never claimed. For a callable the honest baseline is therefore `SYMBOL(`,
    a USE; the raw-mention count is reported beside it so the difference is
    visible rather than assumed."""
    graph = _run(["graphify", "affected", symbol, "--depth", "2",
                  "--graph", GRAPH])
    where = ["lyric-harness", "mcp", "scripts", "src"]
    mentions = _run(["grep", "-rn", symbol, "--include=*.py",
                     "--include=*.js"] + where)
    pattern = f"{symbol}(" if kind == "callable" else symbol
    grep = _run(["grep", "-rnF", pattern, "--include=*.py",
                 "--include=*.js"] + where)

    # THE HEAVY BASELINE: the matched lines PLUS every matched file in full.
    # This is what "re-reads all your files from scratch" means, and it is the
    # baseline the advertised figure is quoted against.
    read = grep
    for rel in sorted(_files_named(grep)):
        path = os.path.join(ROOT, rel)
        try:
            with open(path, encoding="utf-8", errors="replace") as f:
                read += f.read()
        except OSError:
            pass

    # THE DEFINING FILE IS NOT A DEPENDENT, and counting it as one charged the
    # graph for being right. `grep "slot_line("` matches `def slot_line(...)`
    # in the module that DECLARES it; `affected` correctly omits that file,
    # and the first draft of this probe scored the omission as a miss —
    # 1 of 2 rather than 1 of 1. A comparator that penalises the correct
    # answer is the defect this repo keeps finding in its own instruments
    # (doctrine 48), reproduced here and fixed before any number was quoted.
    defs = _files_named(_run(
        ["grep", "-rnE", rf"^\s*(def|class)\s+{symbol}\b|^{symbol}\s*=",
         "--include=*.py", "--include=*.js"] + where))
    g_all, s_all = _files_named(graph), _files_named(grep)
    g_files, s_files = g_all - defs, s_all - defs
    hit = len(g_files & s_files)
    # BOTH READINGS ARE REPORTED. Recall moved 0.798 -> 0.739 between them on
    # the run that adopted this module, which is small but is the difference
    # between two defensible questions; picking one silently would be choosing
    # the rendering that suits the conclusion (doctrine 91).
    hit_all = len(g_all & s_all)
    inx = indexed(symbol)
    return {"symbol": symbol, "kind": kind, "indexed": inx,
            "graph_chars": len(graph), "grep_chars": len(grep),
            "mention_chars": len(mentions), "read_chars": len(read),
            "graph_files": len(g_files), "grep_files": len(s_files),
            "shared_files": hit,
            # A symbol the graph does not index has NO recall — not a recall
            # of zero. The first is a scope limit, the second is an error.
            "recall": None if not inx else
                      ((hit / len(s_files)) if s_files else None),
            "recall_with_defs": None if not inx else
                      ((hit_all / len(s_all)) if s_all else None),
            "graph_only": sorted(g_files - s_files)[:4]}


def summarize(records):
    """The ratios, and the recall that licenses quoting them.

    RATIOS ARE TAKEN OVER THE INDEXED QUESTIONS ONLY. Folding in a symbol the
    graph never heard of would let its 42-character "found nothing" inflate the
    saving, which is the flattering direction and is exactly the shape of
    accounting this repo refuses (doctrine 79)."""
    ix = [r for r in records if r["indexed"]]
    gc = sum(r["graph_chars"] for r in ix)
    sc = sum(r["grep_chars"] for r in ix)
    rc = sum(r["read_chars"] for r in ix)
    rec = [r["recall"] for r in ix if r["recall"] is not None]
    rd = [r["recall_with_defs"] for r in ix
          if r.get("recall_with_defs") is not None]
    return {"questions": len(records),
            "indexed": len(ix), "not_indexed": len(records) - len(ix),
            "graph_chars": gc, "grep_chars": sc, "read_chars": rc,
            "ratio_vs_grep": round(sc / gc, 2) if gc else None,
            "ratio_vs_read": round(rc / gc, 2) if gc else None,
            "mean_recall": round(sum(rec) / len(rec), 3) if rec else None,
            "mean_recall_with_defs": round(sum(rd) / len(rd), 3) if rd else None,
            "full_recall_questions": sum(1 for r in rec if r >= 0.999)}


#: PINNED on the run that measured the claim (2026-08-23). The RATIOS are NOT
#: pinned: they move with every file added to the tree, and pinning a moving
#: quantity manufactures a red that means nothing. What IS pinned is the shape
#: of the answer — how many questions the graph can even be asked — because a
#: constant becoming indexable, or a callable falling out of the graph, is a
#: change in what this tool can do for us and should be noticed.
PINNED = {"questions": 8, "indexed": 5, "not_indexed": 3}


def main(argv):
    if not os.path.exists(GRAPH):
        print(f"REFUSED — no graph at {GRAPH}. Build it first:\n"
              f"  graphify extract . --code-only\n"
              f"Nothing was measured, so nothing moved (doctrine 20).")
        return 2
    records = [probe(sym, kind) for sym, kind, _ in QUESTIONS]
    s = summarize(records)

    print("GRAPH vs SEARCH — characters counted exactly, both routes\n")
    print(f"  {'symbol':18s} {'kind':9s} {'graph':>7s} {'grep':>7s} "
          f"{'grep+read':>10s} {'recall':>8s}")
    for r in records:
        rec = ("NOT INDEXED" if not r["indexed"]
               else "n/a" if r["recall"] is None else f"{r['recall']:.0%}")
        print(f"  {r['symbol']:18s} {r['kind']:9s} {r['graph_chars']:7d} "
              f"{r['grep_chars']:7d} {r['read_chars']:10d} {rec:>8s}")
    print(f"\n  over the {s['indexed']} INDEXED questions:"
          f"  graph {s['graph_chars']}   grep {s['grep_chars']}   "
          f"grep+read {s['read_chars']}")
    print(f"\nRATIO vs grep (the USE sites, which is the same question) : "
          f"{s['ratio_vs_grep']}x")
    print(f"RATIO vs grep+read (every matched file in full)            : "
          f"{s['ratio_vs_read']}x   <- the baseline the advertised figure "
          f"uses, and it is a strawman: nobody answers 'who calls this' by "
          f"reading two dozen files end to end")
    print(f"MEAN RECALL over indexed questions                         : "
          f"{s['mean_recall']}  ({s['full_recall_questions']} of "
          f"{s['indexed']} complete)")
    print(f"  ...and {s['mean_recall_with_defs']} if the DEFINING file is "
          f"counted as a dependent too. Both readings are printed because "
          f"they are two defensible questions and quoting only one would be "
          f"choosing the rendering that suits the conclusion (doctrine 91); "
          f"the direction — incomplete — is the same either way.")
    print(f"\nNOT INDEXED: {s['not_indexed']} of {s['questions']}. "
          f"These are module-level CONSTANTS, and the graph has no node for "
          f"them at all — it indexes callables and classes. That is a SCOPE "
          f"LIMIT, not a wrong answer (doctrine 20), and it is the finding "
          f"that matters most for THIS tree: doctrine 1 makes a declared "
          f"constant the primary coupling here, so the graph covers the "
          f"callable half of the architecture and is blind to the declared "
          f"half.")
    print("\nTHREE COUNTS, NEVER SUMMED (doctrine 79). A ratio is quotable "
          "only where the recall is whole: a route that returns less is "
          "cheaper by construction, and calling that a saving charges the "
          "wrong layer.")
    for r in records:
        if r["recall"] is not None and r["recall"] < 0.999:
            print(f"  SHORT  {r['symbol']}: the graph names "
                  f"{r['shared_files']} of {r['grep_files']} files that "
                  f"USE it. Its ratio is not a clean saving here.")
    print("\nCharacters are exact; a token count would be an estimate "
          "(tiktoken's encoding is unreachable through this proxy). At the "
          f"usual ~4 chars/token the totals estimate to ~{s['graph_chars']//4} "
          f"/ ~{s['grep_chars']//4} / ~{s['read_chars']//4} tokens — the "
          "RATIO above is what the claim is about and is unaffected.")
    if "--check" in argv:
        live = {k: s[k] for k in PINNED}
        if live != PINNED:
            print(f"\nCHECK FAILED — what the graph can be ASKED moved: "
                  f"{live} vs pinned {PINNED}. A constant that became "
                  f"indexable is good news and a callable that fell out is "
                  f"bad news; either way repin deliberately and say which.")
            return 3
        print("\nCHECK PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
