#!/usr/bin/env python3
"""Adversary 7 — do the number, the label and the evidence agree?

`BACKLOG.md` §0 counts eight adversaries and lists this one as the last with no
instrument: "`best_score` prints a score beside end words that did not produce
it". `line_anchors` offers several candidate spans per line, `best_score` takes
the max over every pairing of them, and every consumer then printed the winning
number beside `endwords[i]/endwords[j]` — which is not in general what was
compared. The recorded instance is `go/receipt 0.579`, computed on `get to go`
against the last syllable of `receipt`.

Attaching the spans to the score (`lyric_harness.Scored`, `Attribution`) is the
fix. THIS FILE IS THE MEASUREMENT: it runs the fixed instrument backwards over
the work already recorded and asks how much of it named a pair that did not
produce its number. Three sweeps, three different records:

  `battery` — the 152-sonnet oracle, the only calibrated corpus in the project
      and the source of the headline `violations 82 (8.1%)` (was 81/8.0% at
      scalar coda_agreement; repinned 2026-08-11 when cell BA's
      coda-identity fix shipped). Every mandated pair is classified by what
      its winning spans actually were.
  `corpus`  — the 143 English song files, for the one span defect that is
      invisible to the sonnets because no sonnet end word is hyphenated: a
      compound whose pieces did not all reach the lexicon, where the label
      names a string the harness never read (`hill-zide` anchored on `hill`).
  `record`  — every word pair quoted with a number in this repo's own markdown.
      A recorded table is a report line that outlived its run.

Doctrine 45 is the general form: a checker that silently picks a coordinate is
making a claim it never states. The coordinate here is WHICH SPANS, and the
claim is made once per report line.

Doctrine 79 governs the arithmetic: refused, judged and mandated are three
separate counts and a refusal never enters a numerator. This file refuses in
two places — a pair whose end word is not in the lexicon, and a recorded number
that is not a pair total on any channel this instrument computes.

    python3 quality/audit_spans.py                 # all three sweeps
    python3 quality/audit_spans.py --only battery
    python3 quality/audit_spans.py --only corpus
    python3 quality/audit_spans.py --only record
"""

import glob
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

import lyric_harness as lh   # noqa: E402
import battery               # noqa: E402

SONNET_SCHEME = "ABABCDCDEFEFGG"

#: The five span kinds, worst first, with the sentence each one means for a
#: reader who was shown the end words. `exact` is the only one where the two
#: printed words ARE the evidence.
KIND_MEANS = {
    lh.SPAN_UNATTRIBUTED:
        "no provenance: the anchor was not built by line_anchors, so the "
        "claim cannot be checked at all (doctrine 28: 'cannot tell')",
    lh.SPAN_SUBSTITUTED:
        "the token did not all read: the label names a string the harness "
        "never transcribed",
    lh.SPAN_REACH:
        "the span reaches back PAST the end word: the printed word is one "
        "member of the evidence, not the evidence",
    lh.SPAN_PART:
        "the span is INSIDE the end word: the printed word claims evidence "
        "that was never compared (the declared anchor cut, made visible)",
    lh.SPAN_EXACT:
        "the span IS the end word, whole: the report line is true as printed",
}


def _bar(n, total, width=40):
    if not total:
        return ""
    k = int(round(width * n / total))
    return "#" * k + "." * (width - k)


# ---------------------------------------------------------------------------
# Sweep 1 — the sonnet oracle
# ---------------------------------------------------------------------------

def sweep_battery(lex, decl, verbose=True):
    """Every mandated sonnet pair, classified by what its spans actually were.

    The denominator is the JUDGED count, never the mandated one: 50 of the
    1064 mandated pairs have an end word absent from CMUdict and were never
    compared, so they have no spans to be right or wrong about. Doctrine 79.
    """
    sonnets = battery.parse_sonnets(battery.corpus_path("sonnets.txt"))
    mandated = judged = refused = 0
    pair_kinds, viol_kinds = {}, {}
    ties = viol_ties = 0
    claimed = viol_claimed = 0
    viol_rows = []
    endword_table = {}
    for si, sn in enumerate(sonnets, 1):
        res = lh.check_scheme(lex, sn, SONNET_SCHEME, decl)
        mandated += res["pairs_mandated"]
        judged += res["pairs_judged"]
        refused += res["pairs_refused"]
        by = {p["lines"]: p for p in res["pair_scores"]}
        refl = {r["lines"] for r in res["refusals"]}
        viol_at = {(v[0], v[1]): v for v in res["violations"]}
        for i in range(len(sn)):
            for j in range(i + 1, len(sn)):
                if not lh.same_scheme_class(SONNET_SCHEME[i],
                                            SONNET_SCHEME[j]):
                    continue
                key = (i + 1, j + 1)
                if key in refl:
                    continue
                p = by[key]
                k = tuple(sorted(p["spans_kinds"]))
                pair_kinds[k] = pair_kinds.get(k, 0) + 1
                if p["spans"].tied:
                    ties += 1
                if p["spans_claim"]:
                    claimed += 1
                if key in viol_at:
                    viol_kinds[k] = viol_kinds.get(k, 0) + 1
                    if p["spans"].tied:
                        viol_ties += 1
                    if p["spans_claim"]:
                        viol_claimed += 1
                    ew = tuple(w.lower() for w in p["endwords"])
                    cell = endword_table.setdefault(
                        ew, {"n": 0, "claimed": 0})
                    cell["n"] += 1
                    cell["claimed"] += 1 if p["spans_claim"] else 0
                    viol_rows.append({
                        "sonnet": si, "lines": key,
                        "endwords": p["endwords"], "score": p["score"],
                        "relation": p["relation"],
                        "claim": p["spans_claim"],
                        "kinds": p["spans_kinds"],
                        "note": p["spans_note"]})
    viol = len(viol_rows)
    if verbose:
        print("=" * 74)
        print("SWEEP 1 — the sonnet oracle, 152 sonnets, ABABCDCDEFEFGG")
        print("=" * 74)
        print(f"  mandated {mandated}   judged {judged}   refused {refused}"
              f"   (three counts, doctrine 79)")
        print(f"  violations {viol} ({viol / judged:.1%} of JUDGED)")
        print()
        print("  THE MEASUREMENT — of the pairs the harness JUDGED, how many "
              "named\n  the two words that produced their number?")
        print(f"    report line true as printed : {claimed:5d} / {judged}"
              f"   {_bar(claimed, judged)}")
        print(f"    named a pair that did NOT   : {judged - claimed:5d} / "
              f"{judged}")
        print("\n  by (kind of left span, kind of right span), sorted:")
        for k, v in sorted(pair_kinds.items(), key=lambda x: -x[1]):
            print(f"    {str(k):40s} {v:5d}")
        print(f"\n  and separately, the OTHER way a named span is not the "
              f"only one:\n    tied at the maximum        : {ties:5d} / "
              f"{judged}   the named span is one of several")
        print()
        print(f"  THE SAME MEASUREMENT OVER THE {viol} VIOLATIONS — this is "
              f"the number\n  that decides whether a triage lands on the "
              f"right layer:")
        print(f"    violation line true as printed : {viol_claimed:5d} / "
              f"{viol}")
        print(f"    named a pair that did NOT      : "
              f"{viol - viol_claimed:5d} / {viol}")
        for k, v in sorted(viol_kinds.items(), key=lambda x: -x[1]):
            print(f"    {str(k):40s} {v:5d}")
        print(f"    tied at the maximum            : {viol_ties:5d} / {viol}")
        # The severe half, called out on its own: `part` is the declared
        # anchor cut and a reader can reconstruct it; `reach` and
        # `substituted` cannot be reconstructed from the printed words at all.
        severe = [r for r in viol_rows
                  if any(k in (lh.SPAN_REACH, lh.SPAN_SUBSTITUTED,
                               lh.SPAN_UNATTRIBUTED) for k in r["kinds"])]
        print(f"\n  OF THOSE, the ones a reader could not reconstruct from "
              f"the printed\n  words even in principle "
              f"(reach / substituted / unattributed): "
              f"{len(severe)} / {viol}")
        for r in severe:
            print(f"    sonnet {r['sonnet']:3d} L{r['lines'][0]}-"
                  f"L{r['lines'][1]}  "
                  f"{r['endwords'][0]}/{r['endwords'][1]}  {r['score']}  "
                  f"{r['relation']}")
            print(f"        {r['note']}")
        print("\n  the battery's own `most frequent failing pairs` table, "
              "re-asked:")
        rows = sorted(endword_table.items(), key=lambda x: -x[1]["n"])[:12]
        for ew, cell in rows:
            bad = cell["n"] - cell["claimed"]
            mark = "" if not bad else f"   <- {bad} of {cell['n']} misnamed"
            print(f"    {cell['n']:3d}x  {ew[0]} / {ew[1]}{mark}")
    return {"mandated": mandated, "judged": judged, "refused": refused,
            "violations": viol, "claimed": claimed,
            "violations_claimed": viol_claimed,
            "pair_kinds": pair_kinds, "viol_kinds": viol_kinds,
            "ties": ties, "violation_ties": viol_ties,
            "violation_rows": viol_rows}


# ---------------------------------------------------------------------------
# Sweep 2 — the hyphen substitution, which the sonnets cannot see
# ---------------------------------------------------------------------------

def sweep_corpus(lex, verbose=True, pattern="corpus/song/eng_*.txt"):
    """Line ends whose token did not all reach the lexicon.

    Found by the G2P cell 2026-08-11 and folded in here because it is the same
    defect as `go/receipt` one level down: a number computed from one string
    and reported against another. The split by WHICH hyphen piece failed is
    the part that decides the layer, and it is not in the original report.

    THE ANCHOR HALF IS NOW A REFUSAL (2026-08-11, cell AG). When this sweep
    was first written both halves were still being scored, so it could ask
    `line_anchors` for an anchor and skip the line if there was none — that
    guard meant "already refused under the older token-level rule". It now
    also matches every row of the anchor half, so the classification is made
    from the TOKEN and the refusal is reported as an outcome instead of being
    filtered out. The sweep must be able to see the case it argued about, or
    the argument becomes uncheckable (doctrine 84).

    Per file as well as in total, because doctrine 67 is the live question
    here and it is not answered by a corpus-wide count: 48.7% of the anchor
    half is one Dorset file.
    """
    files = sorted(glob.glob(os.path.join(ROOT, pattern)))
    countable = loose = 0
    tail, head, gone = [], [], []
    tail_tok, head_tok = {}, {}
    per_file = {}
    for fp in files:
        base = os.path.basename(fp)
        cell = per_file.setdefault(base, {"n": 0, "token": 0, "piece": 0,
                                          "report": 0})
        for raw in open(fp, encoding="utf-8", errors="replace"):
            line = raw.rstrip("\n")
            s = line.strip()
            if s:
                loose += 1
            if not s or s[0] in "#[" or s.startswith("---"):
                continue
            toks = lh.line_tokens(line)
            if not toks:
                continue
            countable += 1
            cell["n"] += 1
            fin = toks[-1]
            read, unread = lh.token_pieces(lex, fin)
            row = {"file": base, "line": s, "token": fin,
                   "read": read, "unread": unread}
            if unread and not read:
                gone.append(row)          # nothing read: the OLDER refusal
                cell["token"] += 1
                continue
            if not unread or not lh.HYPHEN_SPLIT.search(fin):
                continue
            if lh.unread_final_piece(lex, fin)[0] is not None:
                tail.append(row)
                tail_tok[fin.lower()] = tail_tok.get(fin.lower(), 0) + 1
                cell["piece"] += 1
            else:
                head.append(row)
                head_tok[fin.lower()] = head_tok.get(fin.lower(), 0) + 1
                cell["report"] += 1
    if verbose:
        print("\n" + "=" * 74)
        print("SWEEP 2 — the substitution that survives INSIDE a word")
        print("=" * 74)
        print(f"  {len(files)} files, {countable} countable line ends "
              f"({loose} counting every non-blank line — doctrine 91, the "
              f"count is a\n  coordinate of the rendering and both are "
              f"printed rather than one chosen)")
        print(f"  line ends with an unread piece inside a readable end token: "
              f"{len(tail) + len(head)}")
        print()
        print(f"  ANCHOR LAYER, NOW REFUSED — the LAST piece is unread, so "
              f"any anchor would be\n  built from an earlier one and the "
              f"rhyme verdict would be on a string that is\n  not the rhyme "
              f"word: {len(tail)}   ({len(tail_tok)} distinct)")
        for t, c in sorted(tail_tok.items(), key=lambda x: -x[1])[:8]:
            print(f"      {c:3d}  {t}")
        print(f"\n  REPORT LAYER, still judged — an earlier piece is unread "
              f"and the last one\n  reads, so the anchor is on the right "
              f"piece and only the LABEL overstates:"
              f" {len(head)}   ({len(head_tok)} distinct)")
        for t, c in sorted(head_tok.items(), key=lambda x: -x[1])[:8]:
            print(f"      {c:3d}  {t}")
        print(f"\n  (and {len(gone)} line ends where NOTHING in the token "
              f"read, which the older\n  token-level rule already refused — "
              f"they are not new and are not counted above)")
        if tail:
            r = tail[0]
            print(f"\n  worked example, anchor layer:")
            print(f"    {r['file']}  {r['line']!r}")
            print(f"    token {r['token']!r}: read {r['read']}, "
                  f"unread {r['unread']}")
        # DOCTRINE 67. A refusal rate is not a tax; measure WHERE it falls.
        hit = sorted((c for c in per_file.values() if c["piece"]),
                     key=lambda c: -c["piece"])
        names = {id(v): k for k, v in per_file.items()}
        print(f"\n  WHERE THE REFUSALS FALL (doctrine 67) — {len(hit)} of "
              f"{len(files)} files carry one.\n  `was` is the file's "
              f"end-word refusal rate BEFORE this rule, on the same lines:")
        print(f"    {'new':>4} {'of':>7} {'rate+':>7} {'was':>7}  file")
        for c in hit[:12]:
            print(f"    {c['piece']:4d} {c['n']:7d} {c['piece']/c['n']:7.2%} "
                  f"{c['token']/c['n']:7.2%}  {names[id(c)]}")
        top2 = sum(c["piece"] for c in hit[:2])
        print(f"    top two files carry {top2} of {len(tail)} = "
              f"{top2/len(tail):.1%}. The refusal IS concentrated.")
        # Doctrine 67's actual test: concentrated is not the same as biased.
        # `fas.rhymes` refuses 60% of Hafez pairs and the amendment that
        # rescued it was the measurement that it refuses where the question is
        # HARD and answers where it is easy. The same question, asked here:
        # do the new refusals land on files the lexicon already could not
        # read, or on files it reads fine?
        miss = [c for c in per_file.values() if not c["piece"] and c["n"]]
        ht, hn = (sum(c["token"] for c in hit), sum(c["n"] for c in hit))
        mt, mn = (sum(c["token"] for c in miss), sum(c["n"] for c in miss))
        print(f"\n    AIMED OR BLUNT (doctrine 67, and it is a measurement "
              f"here rather than a\n    claim). Prior end-word refusal rate, "
              f"the {len(hit)} files this rule touches\n    against the "
              f"{len(miss)} it does not:")
        print(f"      touched  {ht:6d} / {hn:<7d} {ht/hn:7.2%}")
        print(f"      untouched{mt:6d} / {mn:<7d} {mt/mn:7.2%}"
              f"   ratio {(ht/hn)/(mt/mn):.1f}x")
        print(f"    The rule lands where CMUdict was ALREADY failing, not "
              f"across the corpus.\n    It does not open a new gap; it makes "
              f"an existing one visible at the token\n    level, where it had "
              f"been hidden inside a compound and scored anyway.")
    return {"files": len(files), "countable": countable, "loose": loose,
            "anchor_layer": len(tail), "report_layer": len(head),
            "token_refusals": len(gone),
            "anchor_tokens": tail_tok, "report_tokens": head_tok,
            "anchor_rows": tail, "report_rows": head, "per_file": per_file}


# ---------------------------------------------------------------------------
# Sweep 3 — the record: every pair this repo quotes with a number
# ---------------------------------------------------------------------------

PAIR_RE = re.compile(r"`([A-Za-z'’\-]+)`\s*[/~]\s*`([A-Za-z'’\-]+)`")
NUM_RE = re.compile(r"(?<![\w.+±−-])([01]\.\d{2,3})(?![\d])")
#: The SAME claim written without backticks, and the reason the pattern exists:
#: `go/receipt 0.579` is this project's own canonical bad report line and it is
#: recorded twice, in `BACKLOG.md` and `quality/RESULTS_REDTEAM.md`, in exactly
#: this form. A sweep of the record that could not see the row the record is
#: about would be an instrument aimed away from its own subject.
#: The lookbehind excludes only a word character, NOT a backtick: the recorded
#: line is `` `go/receipt 0.579 RHYME` ``, one backticked span containing the
#: whole claim, and a pattern that skipped backticked text would skip it. There
#: is no overlap with PAIR_RE, whose form backticks each word separately.
BARE_RE = re.compile(r"(?<!\w)([a-z][a-z'’]+)/([a-z][a-z'’]+)"
                     r"\s+([01]\.\d{2,3})(?![\d])")


#: THIS SWEEP'S OWN REPORT, excluded from it by name.
#: `quality/RESULTS_SPANS.md` quotes `go/receipt 0.579` and `die/memory 0.773`
#: as the DEFECTS THIS SWEEP FOUND, so sweeping it re-finds them and reports
#: the instrument's own output as fresh evidence — the count then grows every
#: time the report is edited, which is a number that measures its own prose.
#: The exclusion is by name and is PRINTED, because an instrument that quietly
#: skips a file is the same defect it exists to catch.
SELF_REPORT = "quality/RESULTS_SPANS.md"


def _repo_markdown():
    out = []
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", "__pycache__")]
        for f in files:
            if not f.endswith(".md"):
                continue
            p = os.path.join(root, f)
            if os.path.relpath(p, ROOT) == SELF_REPORT:
                continue
            out.append(p)
    return sorted(out)


def sweep_record(lex, decl, verbose=True):
    """Re-score every `a`/`b` quoted with a number in the repo's markdown.

    A recorded table is a report line that outlived its run, and it is the
    only artefact a reader of this project ever sees. Three outcomes, and the
    middle one is the reason this is not just a diff:

      REPRODUCES   the number is the pair's total -> then, and only then, ask
                   whether the two quoted words are the spans that produced it;
      REFUSED      the number is not a total on any channel this instrument
                   computes. It is a bits figure, a nucleus similarity, a
                   coherence, a rate — a different quantity, and adjudicating
                   it here would be inventing a claim to check. Doctrine 79:
                   the refusals are counted and named, never charged;
      DISAGREES    the number IS in the total's range and is not the total.
                   That is a stale record and it is reported as one.
    """
    rows = []
    quoted_without_number = 0
    for path in _repo_markdown():
        rel = os.path.relpath(path, ROOT)
        for n, line in enumerate(open(path, encoding="utf-8",
                                      errors="replace"), 1):
            # A NUMBER BELONGS TO THE LAST PAIR NAMED BEFORE IT, and until
            # 2026-08-13 nothing here said so. The tail scan below looks 90
            # characters past a pair for its number; that window runs clean
            # past a SECOND pair named later on the same line, and the number
            # it then finds is the second pair's. ADJUDICATED, not guessed --
            # `quality/RESULTS_REVISION_LOOP.md:323` reads
            #     The `ear`/`clear` row is the one to read. `ear` ~ `will`
            #     scores **0.996** and is typed **RHYME**.
            # and this sweep charged `ear`/`clear` with `will`'s 0.996, then
            # reported it as a DISAGREES against its true 1.0. The document is
            # correct and the instrument was not: adversary 7 was making, on
            # its own record, the exact error it exists to find -- printing a
            # number beside a pair that did not produce it (doctrine 45, the
            # coordinate being WHICH PAIR the number is a claim about).
            # Cutting the window at the next pair mention is the whole fix.
            starts = sorted({m.start() for m in PAIR_RE.finditer(line)} |
                            {m.start() for m in BARE_RE.finditer(line)})
            for m in PAIR_RE.finditer(line):
                later = [s for s in starts if s >= m.end()]
                stop = min(m.end() + 90, later[0]) if later else m.end() + 90
                tailtext = line[m.end():stop]
                if "bit" in tailtext[:40]:
                    continue
                nm = NUM_RE.search(tailtext)
                if not nm:
                    quoted_without_number += 1
                    continue
                rows.append({"file": rel, "n": n,
                             "a": m.group(1), "b": m.group(2),
                             "recorded": float(nm.group(1)),
                             "text": line.strip()[:110]})
            for m in BARE_RE.finditer(line):
                rows.append({"file": rel, "n": n,
                             "a": m.group(1), "b": m.group(2),
                             "recorded": float(m.group(3)),
                             "text": line.strip()[:110]})
    found = len(rows)
    reproduces, disagrees, refused_rows = [], [], []
    for r in rows:
        aa, _, _ = lh.line_anchors(lex, r["a"])
        bb, _, _ = lh.line_anchors(lex, r["b"])
        if not aa or not bb:
            r["why"] = "one of the two words is not in the lexicon"
            refused_rows.append(r)
            continue
        s = lh.best_score(aa, bb, decl, r["a"], r["b"])
        r["total"] = s["total"]
        r["relation"] = s["relation"]
        r["claim"] = s.claims(r["a"], r["b"])
        r["kinds"] = s.spans.kinds
        r["note"] = lh.spans_note(s)
        if abs(s["total"] - r["recorded"]) < 5e-4:
            reproduces.append(r)
            continue
        chans = set()
        for syl in s["syllables"]:
            chans.update(round(v, 3) for v in syl.values()
                         if isinstance(v, float))
        if round(r["recorded"], 3) in chans:
            r["why"] = ("the recorded number is a CHANNEL value on this "
                        "pair, not its total")
            refused_rows.append(r)
        else:
            disagrees.append(r)
    if verbose:
        print("\n" + "=" * 74)
        print("SWEEP 3 — the record: pairs this repo quotes beside a number")
        print("=" * 74)
        print(f"  markdown files scanned          {len(_repo_markdown())}"
              f"      ({SELF_REPORT} excluded:\n"
              f"{' ' * 34}it quotes this sweep's own findings, so sweeping "
              f"it would\n{' ' * 34}report the instrument's output as fresh "
              f"evidence)")
        print(f"  pairs quoted WITH a number      {found}"
              f"      (adjudicable rows)")
        print(f"  pairs quoted with no number     {quoted_without_number}"
              f"      (not a claim about a score)")
        print(f"    reproduces as the pair total  {len(reproduces)}")
        print(f"    REFUSED, a different quantity {len(refused_rows)}")
        print(f"    DISAGREES with the total      {len(disagrees)}")
        print()
        print("  of the rows that REPRODUCE, how many name the spans that "
              "produced them?")
        ok = [r for r in reproduces if r["claim"]]
        print(f"    true as printed  {len(ok)} / {len(reproduces)}")
        for r in reproduces:
            if not r["claim"]:
                print(f"    {r['file']}:{r['n']}  `{r['a']}`/`{r['b']}` "
                      f"{r['recorded']}  kinds {r['kinds']}")
                print(f"        {r['note']}")
        if disagrees:
            print("\n  DISAGREES — a recorded number in the total's range "
                  "that is not the total:")
            for r in disagrees:
                print(f"    {r['file']}:{r['n']}  `{r['a']}`/`{r['b']}` "
                      f"recorded {r['recorded']}, measured {r['total']} "
                      f"{r['relation']}")
                print(f"        {r['text']}")
        if refused_rows:
            print("\n  REFUSED — named, never charged (doctrine 79):")
            for r in refused_rows:
                print(f"    {r['file']}:{r['n']}  `{r['a']}`/`{r['b']}` "
                      f"{r['recorded']}  — {r['why']}")
        print("\n  WHAT THIS SWEEP DOES NOT DECIDE. `DISAGREES` means the "
              "number does not\n  reproduce from the pair it names. It does "
              "NOT mean the document is wrong:\n  a document QUOTING a bad "
              "report line in order to criticise it looks exactly\n  like one "
              "that inherited it, and only a reader can tell them apart. "
              "Both\n  `go/receipt 0.579` rows are of the first kind. Scope: "
              "markdown only —\n  numbers recorded in .py docstrings and in "
              "test assertions are not swept.")
    return {"found": found, "no_number": quoted_without_number,
            "reproduces": reproduces, "refused": refused_rows,
            "disagrees": disagrees}


# ---------------------------------------------------------------------------

#: THE COMMITTED FIGURES, pinned so `--check` can go red. These are
#: `RESULTS_SPANS.md`'s headline, and until 2026-08-13 nothing could fail on
#: them: `main` returned a literal 0 whatever the sweep found, so the process
#: exited 0 while printing that 382 of 1014 report lines name a pair that did
#: not produce their number. A check that cannot fail is decoration
#: (doctrine 48) -- the same defect found in `verify_doctrines.py`'s
#: contiguity check the same day, and this instrument is the one CLAUDE.md
#: calls adversary 7, so it is the worst place in the layer to have it.
#: Doctrine 58: these are thresholds nobody wrote down until now. Argue them
#: and repin; do not tune anything to meet them.
PINNED = {
    "mandated": 1064, "judged": 1014, "refused": 50,
    "violations": 82,
    #: report lines that name the two words that actually produced the number
    "claimed": 632,
    #: the same question asked of the violations alone
    "violations_claimed": 36,
}


def check(fresh):
    """-> exit code. FAILS LOUDLY; it does not report and continue."""
    print()
    print("=" * 74)
    print("CHECK -- RESULTS_SPANS.md's committed headline against this run")
    print("=" * 74)
    bad = 0
    for key, want in sorted(PINNED.items()):
        got = fresh.get(key)
        ok = got == want
        bad += not ok
        print(f"  [{'ok  ' if ok else 'FAIL'}] {key:20s} "
              f"committed {want}" + ("" if ok else f", measured {got}"))
    if bad:
        print()
        print(f"  {bad} figure(s) moved. RESULTS_SPANS.md's headline no "
              f"longer reproduces.")
        print("  Repin it with the date and keep the superseded value "
              "visible (doctrine 17); do not adjust the sweep to match.")
    print()
    print("RESULT:", "PASS" if not bad else "FAIL")
    return 0 if not bad else 1


def main(argv):
    only = None
    for a in argv:
        if a.startswith("--only"):
            only = (a.split("=", 1)[1] if "=" in a
                    else argv[argv.index(a) + 1])
    want_check = "--check" in argv
    if want_check and only is None:
        # The pinned figures all come from sweep 1, and sweeps 2 and 3 add
        # about two minutes for nothing this mode reads.
        only = "battery"
    lex = lh.Lexicon()
    decl = lh.Declaration()
    print(__doc__.strip().splitlines()[0])
    print(f"declaration: dialect {decl.dialect}, theta_rhyme "
          f"{decl.theta_rhyme}, band on, fitted {decl.fitted}")
    battery = None
    if only in (None, "battery"):
        battery = sweep_battery(lex, decl)
    if only in (None, "corpus"):
        sweep_corpus(lex)
    if only in (None, "record"):
        sweep_record(lex, decl)
    if want_check:
        if battery is None:
            print("REFUSED — --check needs sweep 1; do not pass "
                  "--only=corpus/record with it")
            return 2
        return check(battery)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
