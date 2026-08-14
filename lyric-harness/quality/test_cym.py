#!/usr/bin/env python3
"""Regressions for `cym.readability_census` — the Welsh three-count census.

WHY THIS FILE EXISTS. `cym.readability_census` was invocation-reachable but not
CHECK-reachable. It is called once, at `quality/cym_rhyme_rate.py` §6, which
`print()`s the row and returns; the script has no `--check`, asserts nothing,
and exits 0 whatever the census says. Its two rows are published in
`quality/RESULTS_CYM_RHYME.md` §6 and nothing re-derived them. That is doctrine
48's decoration: import reachability is not invocation reachability, and
invocation reachability is not FAILURE reachability. A function whose answer
can change without turning anything red is unpinned no matter how often it runs.

WHAT IS PINNED, AND WHY EACH ONE IS THE KIND OF THING THAT ROTS

The two published rows.  Not transcribed here — PARSED OUT OF
  `RESULTS_CYM_RHYME.md` §6 and compared to the live census. Pinning a literal
  would let the document and the module drift apart in the one direction that
  matters: the doc is what a reader quotes. Either side moving now fails.

The `refused` bucket.  Under the SHIPPED reading `refused` is 0 in both
  published rows, and it is 0 under `depth=2`, `diacritics=keep`,
  `glide=vocalic` and `glide=consonantal` as well. So a check built only from
  the published table would pass with the `refused` branch deleted outright —
  the third count would be decoration inside the check that was supposed to
  pin it. `rule="prominent"` is the ONE reading on this corpus that loads it
  (126 line-final, 8173 of all tokens, all `no_prominent_syllable`), so that
  row is pinned too even though `RESULTS_CYM_RHYME.md` does not carry it. This
  is the difference between the three counts BEING three and being SAID to be
  three; doctrine 79 asks for the former.

`out_of_inventory` is zero, and the zero is a MEASUREMENT.  §6's prose reads
  the zero as corroborating that `cym.py` reads 100% of the staged tokens.
  That reading is only available if the branch can fire at all — an
  unreachable branch reports zero too, and reports it forever. Pinned with a
  positive control: real English tokens from the staged `eng_*` song corpus
  carrying `k`, `q` and `x`, three letters the declared Welsh inventory does
  not have. They must land in `refused` under layer `notation`, never in
  `defective`, which is the whole point of doctrine 88's split.

The routing table is the census's only real logic.  `readability_census`
  decides `refused` vs `defective` by looking up `UNREADABLE_REASONS[code][1]`.
  Pinned: every code the census emits routes to the layer and the defect bit
  that table declares, and `sum(by_code) == refused + defective` — so a code
  cannot be counted in one place and dropped from the other.

Every Welsh fixture is the staged corpus itself, read with the same tokenizer
`cym_rhyme_rate.py` §6 uses; every out-of-inventory fixture is a real English
word from `corpus/song/eng_*`. Doctrine 37: a test built from invented words
proves self-consistency, not correctness.

Run: python3 quality/test_cym.py
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.phonology import cym, get  # noqa: E402

C = get("cym")
ROOT = os.path.join(HERE, "..")
SONG = os.path.join(ROOT, "corpus", "song")
RESULTS = os.path.join(HERE, "RESULTS_CYM_RHYME.md")

#: The staged Welsh files, exactly the population `cym_rhyme_rate.py` §6 reads:
#: the cywydd plus every `cym_song_*` file in `corpus/song/`.
CYWYDD = "cym_cynghanedd_llywelyn_goch_cywydd.txt"

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# ---------------------------------------------------------------- material

_POPS = []


def _welsh_populations():
    """-> (all tokens, line-final tokens), lowercased. Read once, cached.

    The tokenizer is `cym_rhyme_rate.py` §6's, character for character: `#`,
    `--- ` and `[MARKER]` lines are the corpus's own notation and are skipped,
    `cym.WORD_RE` over `cym.normalise(line)` supplies the tokens, and a token
    that is nothing but apostrophes and hyphens is not a token. It is repeated
    rather than imported because §6 builds it inline inside the print, so there
    is no callable to share -- and the two totals below are exactly the check
    that the repetition has not drifted.
    """
    if _POPS:
        return _POPS[0]
    toks, ends = [], []
    for f in [CYWYDD] + sorted(x for x in os.listdir(SONG)
                               if x.startswith("cym_") and x != CYWYDD):
        for raw in open(os.path.join(SONG, f), encoding="utf-8"):
            t = raw.strip()
            if not t or t.startswith("#") or t.startswith("--- ") or (
                    t.startswith("[") and t.endswith("]")):
                continue
            ws = [w for w in cym.WORD_RE.findall(cym.normalise(t))
                  if w.strip("'-")]
            toks.extend(x.lower() for x in ws)
            if ws:
                ends.append(ws[-1].lower())
    _POPS.append((toks, ends))
    return toks, ends


_ROW = re.compile(r"^\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*"
                  r"\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*$")


def published_word_level_rows():
    """-> {population label: (total, read, refused, defective, {code: n})}

    Parsed out of `RESULTS_CYM_RHYME.md` §6's `**Word level**` table. Doctrine
    58 one layer out: the published figure is a coordinate of the run that
    produced it, so the run has to be able to contradict the publication.
    Returns {} only if the heading is gone, which the caller treats as a
    FAILURE rather than as an empty pass -- a pin that silently pins nothing
    is the decoration this file exists to remove.
    """
    rows, seen_heading = {}, False
    for line in open(RESULTS, encoding="utf-8"):
        if "**Word level**" in line and "readability_census" in line:
            seen_heading = True
            continue
        if not seen_heading:
            continue
        if line.startswith("|"):
            m = _ROW.match(line.rstrip("\n"))
            if m:
                codes = {c: int(n) for c, n in
                         re.findall(r"`(\w+)`\s+(\d+)", m.group(6))}
                rows[m.group(1)] = (int(m.group(2)), int(m.group(3)),
                                    int(m.group(4)), int(m.group(5)), codes)
        elif rows:
            break
    return rows


# ---------------------------------------------------------------- the tests

def test_the_published_rows_re_derive():
    print("\n1. Welsh: RESULTS_CYM_RHYME.md §6's two rows re-derive from the "
          "census")
    pub = published_word_level_rows()
    check("the §6 word-level table is still there and has BOTH rows",
          set(pub) == {"ALL tokens, 5 files", "line-final tokens"},
          str(sorted(pub)))
    if not pub:
        return
    toks, ends = _welsh_populations()
    for label, pop in (("ALL tokens, 5 files", toks),
                       ("line-final tokens", ends)):
        if label not in pub:
            continue
        total, read, refused, defective, codes = pub[label]
        c = cym.readability_census(C, pop)
        got = (c["total"], c["read"], c["refused"], c["defective"],
               dict(c["by_code"]))
        check(f"{label}: {total}/{read}/{refused}/{defective} "
              f"{codes} — as published",
              got == (total, read, refused, defective, codes),
              f"census gives {got}")


def test_the_refused_bucket_is_load_bearing():
    print("\n2. Welsh: the third count is THREE, not a bucket that is always "
          "empty")
    _, ends = _welsh_populations()
    quiet = []
    for label, kw in (("depth 1 (SHIPPED)", {}), ("depth 2", dict(depth=2)),
                      ("diacritics=keep", dict(diacritics="keep")),
                      ("glide=vocalic", dict(glide="vocalic")),
                      ("glide=consonantal", dict(glide="consonantal"))):
        c = cym.readability_census(C, ends, **kw)
        quiet.append((label, c["refused"]))
    check("under every reading the published table covers, `refused` is 0 — "
          "so the published table ALONE cannot pin the bucket",
          all(n == 0 for _, n in quiet), str(quiet))
    c = cym.readability_census(C, ends, rule="prominent")
    check("rule='prominent' is the reading that LOADS it: 126 line-final "
          "tokens refused, all `no_prominent_syllable`",
          (c["refused"], dict(c["by_code"])) ==
          (126, {"no_prominent_syllable": 126, "vowelless_token": 48}),
          f"refused {c['refused']} {dict(c['by_code'])}")
    check("  and the refusal is PHONOLOGY's, while the 48 defective stay "
          "INGESTION's — doctrine 88, the two are not pooled",
          dict(c["by_layer"]) == {"phonology": 126, "ingestion": 48},
          str(dict(c["by_layer"])))
    toks, _ = _welsh_populations()
    a = cym.readability_census(C, toks, rule="prominent")
    check("over ALL tokens the same reading refuses 8173 and still calls only "
          "126 defective",
          (a["refused"], a["defective"], a["read"]) == (8173, 126, 21270),
          f"refused {a['refused']} defective {a['defective']} "
          f"read {a['read']}")


def test_out_of_inventory_zero_is_a_measurement():
    print("\n3. Welsh: §6's zero `out_of_inventory` is measured, not a dead "
          "branch")
    _, ends = _welsh_populations()
    c = cym.readability_census(C, ends)
    check("the staged Welsh corpus really does emit no `out_of_inventory`",
          "out_of_inventory" not in c["by_code"], str(dict(c["by_code"])))
    # Real tokens, from `corpus/song/eng_*`: `k`, `q` and `x` are the three
    # letters the declared Welsh inventory does not carry.
    foreign = ["king", "know", "queen", "next", "fox"]
    welsh = ["cariad", "melys", "calon"]
    p = cym.readability_census(C, foreign + welsh)
    check("but real English tokens carrying k/q/x DO fire it, so the zero "
          "above is a count and not an unreachable branch",
          p["by_code"].get("out_of_inventory") == 5,
          str(dict(p["by_code"])))
    check("  and a notation refusal is REFUSED, never DEFECTIVE — the "
          "distinction doctrine 88 asks the census to keep",
          (p["refused"], p["defective"], p["read"]) == (5, 0, 3),
          f"refused {p['refused']} defective {p['defective']} "
          f"read {p['read']}")
    check("  `k`, `q` and `x` are genuinely outside the declared inventory",
          not ({"k", "q", "x"} & (set(cym.VOWELS) | set(cym.CONSONANTS))))


def test_the_routing_table_is_what_splits_the_counts():
    print("\n4. Welsh: refused vs defective is UNREADABLE_REASONS' decision, "
          "and it is checked")
    toks, ends = _welsh_populations()
    readings = (("depth 1", {}), ("depth 2", dict(depth=2)),
                ("prominent", dict(rule="prominent")),
                ("diacritics=keep", dict(diacritics="keep")),
                ("glide=vocalic", dict(glide="vocalic")),
                ("glide=consonantal", dict(glide="consonantal")))
    # Every reading over the line-final population, and the 29,569-token
    # population over the two readings whose CODE COMPOSITION differs
    # (`depth 1` emits `vowelless_token` only, `prominent` adds
    # `no_prominent_syllable`). The other four are code-identical to `depth 1`
    # on both populations, so running them over the 29,569-token one buys no
    # branch this file does not already cover and roughly doubles its runtime.
    cases = [(f"line-final/{r}", ends, kw) for r, kw in readings]
    cases += [("ALL tokens/depth 1", toks, {}),
              ("ALL tokens/prominent", toks, dict(rule="prominent"))]
    bad_sum, bad_codes, bad_route = [], [], []
    for tag, pop, kw in cases:
        c = cym.readability_census(C, pop, **kw)
        if c["read"] + c["refused"] + c["defective"] != c["total"]:
            bad_sum.append(tag)
        if sum(c["by_code"].values()) != c["refused"] + c["defective"]:
            bad_codes.append(tag)
        want_def = sum(n for code, n in c["by_code"].items()
                       if cym.UNREADABLE_REASONS[code][1])
        want_lay = {}
        for code, n in c["by_code"].items():
            lay = cym.UNREADABLE_REASONS[code][0]
            want_lay[lay] = want_lay.get(lay, 0) + n
        if want_def != c["defective"] or want_lay != dict(c["by_layer"]):
            bad_route.append(tag)
    check(f"read + refused + defective == total, on all {len(cases)} "
          f"population x reading cases", not bad_sum, str(bad_sum))
    check("sum(by_code) == refused + defective, so no code is counted in one "
          "place and dropped from the other",
          not bad_codes, str(bad_codes))
    check("and every code's defect bit and layer are the ones "
          "UNREADABLE_REASONS declares",
          not bad_route, str(bad_route))
    check("`undecided_glide` is declared but is NOT a word-level code — it "
          "takes a pair, and `pair_census` is where it can appear",
          "undecided_glide" in cym.UNREADABLE_REASONS
          and not any("undecided_glide" in
                      cym.readability_census(C, pop, **kw)["by_code"]
                      for _tag, pop, kw in cases))


if __name__ == "__main__":
    print("quality/test_cym.py — cym.readability_census, pinned")
    for fn in (test_the_published_rows_re_derive,
               test_the_refused_bucket_is_load_bearing,
               test_out_of_inventory_zero_is_a_measurement,
               test_the_routing_table_is_what_splits_the_counts):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("cym.readability_census regressions pass")
