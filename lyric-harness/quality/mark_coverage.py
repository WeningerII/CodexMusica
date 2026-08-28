#!/usr/bin/env python3
"""Mark coverage: how much of the corpus the section vocabulary cannot type.

`grid.SECTION_FUNCTIONS` declares the section functions (22 since
2026-08-28, when `patter` entered on its printed witness — M-52; the
count is derived live below, never restated) and every one of them is a
word of Anglo-American popular-song analysis.  `MARK_FUNCTION`
maps the marks a printed source actually carries onto those functions
(six keys now).  Everything else a source prints is REFUSED --
correctly, and with a written reason in `MARK_REFUSED`: calling a bayt a
`verse` would be "this vocabulary claiming a form it does not describe"
(doctrine 43).

This module measures the size of that refusal, because the refusal is
honest and the SILENCE about how much it covers is not.  It answers the
three questions the owner asked -- how many blocks, in which languages,
and what would it cost to type them -- and it deliberately does NOT
answer the fourth (what the new rows should be called), because that is
a vocabulary decision and vocabulary decisions are the owner's.

FOUR COUNTS, NEVER SUMMED (doctrine 79).  A refusal is not a failure,
and two refusals with different reasons are not one number:

  typed       the mark reaches a declared function through MARK_FUNCTION
  decided     refused WITH a written reason (MARK_NOT_A_FUNCTION) -- the
              vocabulary has considered this mark and declined it
  undecided   refused because the mark is in NO table (MARK_UNRECOGNISED)
              -- nobody has considered it yet
  apparatus   a bare numeral (MARK_IS_A_NUMERAL): a footnote or stanza
              number, not a candidate for anything

`decided` and `undecided` are the pair that matters.  A decided refusal
is a position; an undecided one is a gap nobody has looked at.  Summing
them would report the second as though someone had already thought about
it.

THE SHAPE HALF, AND WHAT IT IS NOT.  For every refused mark this also
measures how the mark BEHAVES, using the repo's own primitives rather
than a second definition (doctrine 1): does it recur inside one song,
and when it recurs, where does `compare_returns` place it on the 15-way
`VARIATION_KINDS` ladder?  That says whether the machinery already
built could describe these sections.  It does NOT say they should be
called `verse` or `chorus`, and a reader who takes "bayt behaves like a
returning section with new words" as "bayt IS a verse" has made exactly
the error `MARK_REFUSED` was written to prevent.

`compare_returns` is called with NO rhyme key, on purpose.  Most of this
material is Persian, Sanskrit, Finnish or Malay, and handing it the
English phonology would be doctrine 45's error -- a checker silently
picking a phonology and making a claim it never states.  The rhyme
channel therefore reports CANNOT TELL throughout, which is the honest
answer and is visible in the output rather than hidden.

Run: python3 quality/mark_coverage.py [--root=DIR] [--json] [--check]
  default: the census.  --check: re-derive and compare against the
  pinned headline figures, exit 1 on drift.
"""

import collections
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
sys.path.insert(0, ROOT)

from quality import grid as GR  # noqa: E402

SONG_DIR = os.path.join(ROOT, "corpus", "song")

#: Refusal codes `ingest_mark` can attach, and the bucket each belongs to.
#: Written down rather than inferred from the code string, because the
#: BUCKETING is the claim this module makes and a claim belongs in a table.
CODE_BUCKET = {
    "MARK_NOT_A_FUNCTION": "decided",
    "MARK_UNRECOGNISED": "undecided",
    "MARK_IS_A_NUMERAL": "apparatus",
    # ADDED 2026-08-22 with the language coordinate (`MISSING.md` M-24). It is
    # UNDECIDED and not DECIDED, which is the whole point of the code: the
    # mark carries a written decision in ANOTHER tradition and none in this
    # one, so nobody has answered the question here. Bucketing it `decided`
    # would let one tradition's ruling be counted as coverage of every other
    # (doctrine 20). Zero occurrences today — every refused mark in this
    # corpus is single-language, measured — and the zero is the reason the
    # row is written rather than waited for.
    "MARK_REFUSED_ELSEWHERE": "undecided",
}


def _lang(path):
    """The language code is the filename prefix -- the corpus's own
    convention since doctrine 45, and the same three characters
    `test_song_function`'s census reads."""
    return os.path.basename(path)[:3]


def scan(root=SONG_DIR):
    """-> dict.  One pass, because a second sweep would derive the
    population from a second definition of what a block is."""
    marks = collections.defaultdict(lambda: {
        "blocks": 0, "lines": 0, "files": set(), "langs": collections.Counter(),
        "bucket": "", "function": "", "reason": "", "songs": 0,
    })
    buckets = collections.Counter()
    by_lang_bucket = collections.defaultdict(collections.Counter)
    # recurrence and the variation ladder, per refused mark
    recur = collections.defaultdict(lambda: {"songs": 0, "recurring": 0})
    ladder = collections.defaultdict(collections.Counter)
    rhyme_told = collections.Counter()
    #: THE ELABORATION POINTER, counted in the SAME pass for the reason this
    #: module already gives: a second sweep would derive the population from a
    #: second definition of what a block is (doctrine 1).
    elab = collections.Counter()
    elab_findings = []

    for path in sorted(glob.glob(os.path.join(root, "*.txt"))):
        lang = _lang(path)
        for song in GR.read_marked_songs(path, language=lang):
            _ef, _ec = GR.elaboration_findings(song)
            for _k, _v in _ec.items():
                elab[_k] += _v
            for _f in _ef:
                elab_findings.append((path.split("/")[-1], song.title, _f))
            seen = collections.defaultdict(list)
            for b in song.blocks:
                if not b.base:
                    base = "(numeral)"
                    bucket = "apparatus"
                elif b.function:
                    base, bucket = b.base, "typed"
                else:
                    base = b.base
                    code = b.refusal.code if b.refusal else "MARK_UNRECOGNISED"
                    bucket = CODE_BUCKET.get(code, "undecided")
                rec = marks[base]
                rec["blocks"] += 1
                rec["lines"] += len(b.lines)
                rec["files"].add(os.path.basename(path))
                rec["langs"][lang] += 1
                rec["bucket"] = bucket
                rec["function"] = b.function or ""
                if bucket == "decided":
                    # KEYED ON THE PAIR SINCE 2026-08-22. Read through
                    # the DERIVED index rather than re-deriving the language
                    # here, so this module cannot disagree with `grid` about
                    # which tradition a reason belongs to (doctrine 1).
                    _rows = GR._REFUSED_BY_BASE.get(base, {})
                    rec["reason"] = _rows.get(lang) or (
                        next(iter(_rows.values())) if _rows else "")
                buckets[bucket] += 1
                by_lang_bucket[lang][bucket] += 1
                seen[base].append(b)
            # RECURRENCE is a property of a MARK INSIDE ONE SONG, so it is
            # measured here, where the song is in hand.
            for base, blocks in seen.items():
                marks[base]["songs"] += 1
                recur[base]["songs"] += 1
                if len(blocks) > 1:
                    recur[base]["recurring"] += 1
                    for a, b2 in zip(blocks, blocks[1:]):
                        if not a.lines or not b2.lines:
                            continue
                        r = GR.compare_returns(a.lines, b2.lines)
                        ladder[base][r.kind] += 1
                        rhyme_told[
                            "told" if r.rhyme_scheme_preserved is not None
                            else "cannot_tell"] += 1

    out_marks = {}
    for base, rec in marks.items():
        out_marks[base] = {
            "blocks": rec["blocks"], "lines": rec["lines"],
            "files": len(rec["files"]), "songs": rec["songs"],
            "langs": dict(rec["langs"]), "bucket": rec["bucket"],
            "function": rec["function"], "reason": rec["reason"],
            "songs_with_recurrence": recur[base]["recurring"],
            "ladder": dict(ladder[base]),
        }
    witnessed = sorted({m["function"] for m in out_marks.values()
                        if m["function"]})
    return {
        "marks": out_marks,
        "buckets": dict(buckets),
        "by_language": {k: dict(v) for k, v in by_lang_bucket.items()},
        "declared_functions": len(GR.SECTION_FUNCTIONS),
        "witnessed_functions": witnessed,
        "unwitnessed_functions": sorted(
            set(GR.SECTION_FUNCTIONS) - set(witnessed)),
        "rhyme_channel": dict(rhyme_told),
        "elaboration": dict(elab),
        "elaboration_findings": [(f, t, x.code) for f, t, x in elab_findings],
    }


#: The headline figures, pinned so drift is a failing command rather than
#: something a later reader has to notice.  Repin WITH the reason, and
#: keep the superseded value visible (doctrine 17).
#: REPINNED 2026-08-20 (HBV safe subset + 23 twin merges): typed
#: 71,748 -> 76,944 and NOTHING ELSE MOVED. The Home Book of Verse marks
#: its blocks `[VERSE n]` throughout, so it adds 5,196 typed blocks and
#: not one new refused mark — decided, undecided, apparatus and the
#: witnessed-function count are all byte-identical across a load of
#: 1,049 items. The typed share rises 36.4% -> 38.0%, which is the
#: honest direction and a small one: the refusal is Persian, and no
#: amount of English anthology moves it.
PINNED = {
    #: REPINNED 2026-08-22: typed ~~76,944~~ **76,930**, decided ~~125,490~~
    #: **125,504**. EXACTLY -14 AND +14, and the sign of each is the finding.
    #: The 14 pìobaireachd movement headings (`URLAR`/`SIUBHAL`/`CRUNLUATH`,
    #: three `eng_celtic_msm_*` files) were `[VERSE n]` blocks whose whole
    #: lyric was the heading -- `MISSING.md` M-25(a) -- so this module counted
    #: them TYPED, reaching the `verse` function. Staged as marks and declared
    #: in `grid.MARK_REFUSED`, they are now DECIDED: refused WITH a written
    #: reason. That is the good direction across this module's own axis, and
    #: `undecided` is UNMOVED at 32, which is the half that matters --
    #: nothing new was added to the pile nobody has thought about.
    #:
    #: FOUND BY `quality/pin_sweep.py` on its first full run, not by a suite:
    #: this figure is re-DERIVED from the corpus, and the corpus edit that
    #: moved it landed in a commit whose gates were all green.
    #: REPINNED 2026-08-22 (second time today): typed ~~76,930~~ **77,090**,
    #: +160 and nothing else moved.  The K-4 Old Norse load added 160 songs,
    #: each carrying one `[VERSE 1]`, and `non` measures 160 typed / 0
    #: decided / 0 undecided — the whole drift, attributable to one prefix.
    #: `decided`, `undecided` and `apparatus` are UNMOVED, which is the half
    #: that matters: the load added nothing to the pile nobody has considered.
    #:
    #: FOUND BY AN AUDIT AGENT, NOT BY THE CLOSING SITTING.  This is the THIRD
    #: gate the Old Norse load left red that no `--check` in the standard set
    #: catches — after `test_corpus_taxonomy` §6 and `test_grid`'s air census.
    #: `CORPUS_LOADING_PROTOCOL.md` already requires `suite_sweep.py` in the
    #: closing sitting for exactly that reason; `mark_coverage --check` is not
    #: in it and re-derives from the corpus, so it drifts silently on any load.
    #: REPINNED 2026-08-28 (M-52's close): typed ~~77,090~~ **77,093**,
    #: decided ~~125,504~~ **125,501**, declared_functions ~~21~~ **22**,
    #: witnessed ~~4~~ **5** — EXACTLY +3/-3/+1/+1, and every unit of it
    #: is `patter` entering the vocabulary on its printed Ruddigore
    #: witness: the three `[PATTER]` blocks move from DECIDED (refused
    #: with the reason "a function this vocabulary does not declare",
    #: which stopped being true) to TYPED, and patter becomes the fifth
    #: function with a printed witness. `undecided` is UNMOVED at 32,
    #: which is still the half that matters — the vocabulary grew by
    #: considering a mark somebody HAD thought about, not by reaching
    #: into the pile nobody has.
    "typed": 77093, "decided": 125501, "undecided": 32, "apparatus": 59,
    "declared_functions": 22, "witnessed": 5,
}


def _fmt(n):
    return f"{n:,}"


def report(root=SONG_DIR):
    s = scan(root)
    b = s["buckets"]
    total = sum(b.values())
    print("=" * 74)
    print("MARK COVERAGE — how much of the corpus the section vocabulary "
          "cannot type")
    print("=" * 74)
    print(f"\n{_fmt(total)} marked blocks over {len(s['marks'])} "
          f"distinct marks\n")
    print("  FOUR COUNTS, NEVER SUMMED (doctrine 79)")
    for k in ("typed", "decided", "undecided", "apparatus"):
        n = b.get(k, 0)
        print(f"    {k:<10} {_fmt(n):>9}  {n / total:6.2%}")
    print(f"\n  TYPED IS THE MINORITY: {b.get('typed', 0) / total:.1%} of "
          f"marked blocks reach a declared function.")

    print(f"\n  the vocabulary declares {s['declared_functions']} section "
          f"functions and the corpus witnesses "
          f"{len(s['witnessed_functions'])}:")
    print(f"    witnessed   {', '.join(s['witnessed_functions'])}")
    print(f"    unwitnessed {', '.join(s['unwitnessed_functions'])}")
    print("    (unwitnessed = declarable in a blueprint, attested by no "
          "printed block in this corpus)")

    print("\n  BY LANGUAGE (blocks)")
    print(f"    {'lang':<6}{'typed':>9}{'decided':>10}{'undecided':>11}"
          f"{'apparatus':>11}")
    for lang in sorted(s["by_language"], key=lambda k: -sum(
            s["by_language"][k].values())):
        v = s["by_language"][lang]
        print(f"    {lang:<6}{_fmt(v.get('typed', 0)):>9}"
              f"{_fmt(v.get('decided', 0)):>10}"
              f"{_fmt(v.get('undecided', 0)):>11}"
              f"{_fmt(v.get('apparatus', 0)):>11}")

    for bucket, title in (("decided", "REFUSED WITH A REASON — the "
                           "vocabulary considered these and declined"),
                          ("undecided", "REFUSED WITH NO ROW EITHER WAY — "
                           "nobody has considered these yet")):
        rows = sorted(((k, v) for k, v in s["marks"].items()
                       if v["bucket"] == bucket),
                      key=lambda kv: -kv[1]["blocks"])
        if not rows:
            continue
        print(f"\n  {title}")
        print(f"    {'mark':<14}{'blocks':>9}{'lines':>10}{'files':>7}"
              f"{'songs':>7}  languages")
        for k, v in rows:
            langs = ",".join(f"{a}:{n}" for a, n in
                             sorted(v["langs"].items(), key=lambda x: -x[1]))
            print(f"    {k:<14}{_fmt(v['blocks']):>9}{_fmt(v['lines']):>10}"
                  f"{v['files']:>7}{_fmt(v['songs']):>7}  {langs}")
        if bucket == "undecided":
            # THE MEASURED CHARACTER OF THIS BUCKET, because the bare
            # count invites the wrong reading. A section mark has verse
            # under it; a bracketed editorial note does not. Carrying
            # ZERO lines is therefore the signal, and it is reported as
            # a rate rather than asserted from the spellings.
            empty = sum(v["blocks"] for _, v in rows if v["lines"] == 0)
            tot = sum(v["blocks"] for _, v in rows)
            print(f"\n      {empty} of these {tot} blocks carry NO LINES "
                  f"AT ALL ({empty / tot:.0%}) — a section mark has verse "
                  f"under it and a bracketed")
            print("      editorial note does not. Inspected, they are "
                  "stage directions and provenance notes in CLOSED "
                  "brackets ('[Enter")
            print("      Mephistopheles.]', '[First published in "
                  "_Memoir_ ...]', '[FN#1]'), which `_MARK_RE` matches "
                  "and `ingest_mark`")
            print("      then refuses. SO THIS BUCKET IS NOT A "
                  "VOCABULARY GAP: it is apparatus with no refusal row "
                  "yet, and the")
            print("      musical gap is entirely in the DECIDED bucket "
                  "above.")

    print("\n  THE SHAPE HALF — does the machinery already built describe "
          "these sections?")
    print("  Recurrence is measured per SONG; the ladder is "
          "`compare_returns` on consecutive")
    print("  instances, with NO rhyme key (doctrine 45: the phonology for "
          "this material is not")
    print("  English, and picking one silently would be the error). NAMING "
          "IS NOT DECIDED HERE.")
    for k, v in sorted(s["marks"].items(), key=lambda kv: -kv[1]["blocks"]):
        if v["bucket"] not in ("decided", "undecided") or not v["ladder"]:
            continue
        rate = (v["songs_with_recurrence"] / v["songs"]) if v["songs"] else 0
        top = ", ".join(f"{a} {n:,}" for a, n in
                        sorted(v["ladder"].items(), key=lambda x: -x[1])[:4])
        print(f"\n    {k}: recurs in {v['songs_with_recurrence']:,} of "
              f"{v['songs']:,} songs ({rate:.0%})")
        print(f"      ladder: {top}")
    e = s["elaboration"]
    n_elab = sum(e.values())
    print("\n  THE ELABORATION POINTER (`grid.MARK_ELABORATES`), which is the "
          "half of")
    print("  `SECTION_ORDER_PREREGISTRATION.md` that SURVIVED its falsifier — "
          "`rank` was")
    print("  REFUSED because two of three staged pìobaireachds are not "
          "monotone and the")
    print("  ladder's top two rungs have zero attestation anywhere:")
    if not n_elab:
        print("    NO population — no staged mark points at another. That is "
              "an absence of")
        print("    population and not a rate of zero (doctrine 20).")
    else:
        print("    %s elaborating section(s), THREE COUNTS, NEVER SUMMED"
              % _fmt(n_elab))
        for k in ("grounded_before", "grounded_after", "ungrounded"):
            print("      %-16s %s" % (k, _fmt(e.get(k, 0))))
        print("    only `ungrounded` is a finding, and it is a NOTE: the "
              "ORDER of a")
        print("    variation and its ground is an editor's choice (doctrine "
              "6), while a")
        print("    ground that never appears is a factual claim and false.")
        for f, t, code in s["elaboration_findings"][:5]:
            print("      %s  %s — %s" % (code, f, t[:40]))
    rc = s["rhyme_channel"]
    print(f"\n    rhyme channel over every comparison: "
          f"cannot_tell {_fmt(rc.get('cannot_tell', 0))}, "
          f"told {_fmt(rc.get('told', 0))} — the refusal is the point, "
          f"not a gap")
    return s


def main(argv):
    root, as_json, check = SONG_DIR, False, False
    for a in argv:
        if a.startswith("--root="):
            root = os.path.join(ROOT, a.split("=", 1)[1])
        elif a == "--json":
            as_json = True
        elif a == "--check":
            check = True
        else:
            print(f"REFUSED — unknown argument {a!r}; mark_coverage takes "
                  f"[--root=DIR] [--json] [--check]")
            return 2
    if as_json:
        print(json.dumps(scan(root), indent=2, sort_keys=True))
        return 0
    s = report(root) if not check else scan(root)
    if check:
        b = s["buckets"]
        fresh = {"typed": b.get("typed", 0), "decided": b.get("decided", 0),
                 "undecided": b.get("undecided", 0),
                 "apparatus": b.get("apparatus", 0),
                 "declared_functions": s["declared_functions"],
                 "witnessed": len(s["witnessed_functions"])}
        moved = {k: (PINNED[k], fresh[k]) for k in PINNED
                 if PINNED[k] != fresh[k]}
        for k in sorted(PINNED):
            flag = "ok  " if k not in moved else "DRIFT"
            print(f"  [{flag}] {k:<20} pinned {PINNED[k]:>8}  "
                  f"measured {fresh[k]:>8}")
        if moved:
            print("\n  RESULTS_MARK_COVERAGE.md no longer describes this "
                  "corpus. Repin with the date and keep the superseded "
                  "value visible (doctrine 17).")
            return 1
        print("\nRESULT: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
