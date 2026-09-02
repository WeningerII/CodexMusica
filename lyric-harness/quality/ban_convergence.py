#!/usr/bin/env python3
"""The two-tier ban, measured against the bank (C18 / M-168, 2026-09-02).

    python3 quality/ban_convergence.py            # per song and over the bank
    python3 quality/ban_convergence.py --check    # pin the bank-wide totals

THE QUESTION. The two-tier ban (HOMEOTELEUTON, then MODAL_RHYME over the
differently-spelled remainder — `quality/revise.py`, the owner's rule of
2026-08-18) closes every common true-rhyme family, and the loop pursues
both codes mandatorily, so a writer reaching for `night/light` cannot
converge until it leaves the family. The register (M-168) said the ban's
effect on convergence and on end-word rarity was measured nowhere. This
file measures what the bank can answer.

WHAT THE BANK CANNOT ANSWER, AND WHY THIS FILE DOES NOT PRETEND TO. The
measurement the triage asked for — the sixteen songs' FIRST drafts screened
against their exit-0 versions — is not constructible: no verb banks draft
bytes. The logs carry an md5 per `song`/`revise` step (`song_log.py`), so a
draft that differed from its final is PROVABLE (crooked_waltz step 19,
matinee steps 54/55, the_long_way_back step 2 all graded md5s the bank does
not hold) but not READABLE; git holds a distinct earlier version for two
songs only (carry_it_over @35f3e8af, the_long_way_back @8d7b3f18), and both
were already screened, exit-0 drafts, not pre-ban first drafts. Every
banked `revise` row has md5_in == md5_out: the loop never rewrote a banked
line, so the ban did its work BEFORE writing, at the screen. That is where
the bank can be read, and this file reads it there.

THREE INSTRUMENTS, ONE GRADER. Per song:

  (1) THE SCREENED POOL — every `pair:a~b` row the `screen` verb banked in
      the song's log, i.e. the candidate pairs the writer asked about before
      writing: banned HOMEOTELEUTON / banned MODAL_RHYME / clean / refused /
      other, five counts, never summed (doctrine 79).
  (2) THE FINAL SONG — the banked bytes graded by `Reviser.inspect` under the
      song's own mandate (the `song` command in its `songs/README.md`
      section, else the newest `plan` row's `groups`/`returns` facts, else
      REFUSED by name — the mandate is not invented). The harness's own
      three counts (mandated / judged / refused) and the ban's own two codes
      read off `per_line`; nothing here re-implements a tier.
  (3) END-WORD RARITY — for every ban-eligible rhyming pair (the same
      eligibility `inspect` uses: a satisfied, non-REPEAT verdict under the
      default structure), the partner's position in the call word's OWN
      field, `Reviser.modal_field(call)` -> (offered, forbidden). Rank is
      the index in `forbidden + offered`, taken in BOTH directions and the
      smaller kept, because the ban checks both. Three buckets, never
      summed: HEAD (in `forbidden` — the words the ban refuses), TAIL (in
      `offered` — the loop's own menu) and OUTSIDE (in neither: deeper than
      `ReviseDeclaration.offered` or not in the field at all — not a rank,
      a refusal to rank; doctrine 20).

A song at exit 0 has, by construction, zero ban findings and zero HEAD
partners; the instrument states that as a measured zero rather than assumes
it, and the mutation in `test_ban_convergence.py` shows the counts move when
a partner is pulled back to the modal head.
"""

import glob
import os
import re
import shlex
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SONGS = os.path.join(ROOT, "songs")
README = os.path.join(SONGS, "README.md")
sys.path.insert(0, ROOT)

BAN_CODES = ("HOMEOTELEUTON", "MODAL_RHYME")

# PINNED 2026-09-02 at the bank's sixteen songs. Two kinds of number live
# here and they are kept apart (doctrine 79): the ones read off the LOGS and
# the README (population, mandate sources, the screened pool) cost nothing
# and are pinned; the ones read off the GRADER (the harness's three counts,
# ban findings, the rank buckets) cost a full `inspect` plus two
# `modal_field` calls per eligible pair — the whole bank exceeded a 600 s
# budget on a shared 4-CPU box on 2026-09-02 — and are pinned `None`, which
# `--check` reports BY NAME as unpinned rather than as passing (doctrine 20:
# absent is not zero). ~~To pin them: run without --check, read the `BANK:`
# block, copy its numbers here WITH the date.~~ THEY ARE PINNED 2026-09-02:
# the whole bank ran in one process on a quiet box in under an hour, which
# the shared box could not afford. A pin that moved without a register line
# is a defect report (MISSING.md M-168 addendum).
PINNED = {
    "songs": 16,
    "mandate_readme": 11, "mandate_log": 4, "mandate_refused": 1,
    "screen_homeo": 366, "screen_modal": 395, "screen_clean": 792,
    "screen_refused": 11, "screen_other": 1,
    # PINNED 2026-09-02 on a quiet box, the whole bank in one process (the
    # `Reviser`'s caches warm across songs, which is what brought the run
    # inside its budget where a shared box could not). Read off the `BANK:`
    # block of `python3 quality/ban_convergence.py`.
    "pairs_mandated": 719, "pairs_judged": 549, "pairs_refused": 170,
    "eligible": 487, "banned_in_final": 7,
    "rank_head": 7, "rank_tail": 155, "rank_outside": 325,
}


# ---------------------------------------------------------------- the bank

def songs():
    """The same population `song_record.py` banks: a lyric with a blueprint."""
    from quality.song_record import songs as _songs
    return [os.path.basename(p) for p in _songs()]


def _readme_sections():
    from quality.song_log import _sections
    return dict(_sections())


def _split_groups(raw):
    # The CLI's own two-line spelling (`lyric_harness.py` `_groups`): members
    # stay STRINGS so `schemes.mandate` is the one parser of `3.T2`.
    return [[x.strip() for x in g.split(",") if x.strip()]
            for g in raw.split(";") if g.strip()]


def mandate_spec(song):
    """-> (source, groups, returns, relations, structures) or (None, reason).

    Source is `readme` (the `song` command the README section records —
    the command that graded the banked bytes), `log` (the newest `plan`
    row's `groups`/`returns` facts — the mandate as planned, which the
    README's command outranks where both exist because two songs' commands
    were edited after planning), or None with the reason (doctrine 20: a
    song whose mandate is banked nowhere is REFUSED, not graded free)."""
    sec = _readme_sections().get(song)
    if sec:
        # Continuation lines are joined; the command is the first `song`
        # invocation naming this song's lyric file.
        joined = re.sub(r"\\\n\s*", " ", sec)
        for ln in joined.splitlines():
            if "lyric_harness.py song" not in ln or song not in ln:
                continue
            try:
                argv = shlex.split(ln.strip())
            except ValueError:
                continue
            by = {}
            for a in argv:
                for flag in ("--groups=", "--returns=", "--relations=",
                             "--structures="):
                    if a.startswith(flag):
                        by[flag] = a[len(flag):]
            if "--groups=" in by:
                return ("readme", _split_groups(by["--groups="]),
                        _split_groups(by.get("--returns=", "")),
                        by.get("--relations="), by.get("--structures="))
    from quality.song_log import read_log
    rows = [r for r in read_log(song)
            if r["verb"] == "plan" and r["fact"] in ("groups", "returns")]
    if rows:
        last = max(int(r["step"]) for r in rows)
        facts = {r["fact"]: r["value"] for r in rows if int(r["step"]) == last}
        g = facts.get("groups", "")
        r = facts.get("returns", "")
        if g and g != "(none)":
            return ("log", _split_groups(g),
                    _split_groups("" if r == "(none)" else r), None, None)
    return (None, "no `song` command in songs/README.md and no `plan` row "
                  "with a `groups` fact in the log")


def build_mandate(spec, n_lines):
    from quality import schemes as SC
    _, g, r, rel, st = spec
    kw = {}
    if rel:
        kw["relations"] = _rels(rel)
    if st:
        kw["structures"] = _structs(st)
    if r:
        return SC.mandate(g + r, n_lines=n_lines, returns=r, **kw)
    if kw:
        return SC.mandate(g, n_lines=n_lines, **kw)
    return SC.mandate(g, n_lines=n_lines)


def _rels(raw):
    # `A:schema:anaphora,B:type:…` — label, colon, catalog name (which may
    # itself carry colons and commas inside a name are not used in the bank).
    out = {}
    for part in raw.split(","):
        if ":" not in part:
            continue
        lab, name = part.split(":", 1)
        out[lab.strip()] = name.strip()
    return out


def _structs(raw):
    return _rels(raw)


# ------------------------------------------------------------ the screen

def screened_pool(song):
    """The `screen` rows the writer banked before writing: five counts."""
    from quality.song_log import read_log
    c = {"screen_homeo": 0, "screen_modal": 0, "screen_clean": 0,
         "screen_refused": 0, "screen_other": 0}
    for r in read_log(song):
        if r["verb"] != "screen" or not r["fact"].startswith("pair:"):
            continue
        v = r["value"]
        if v == "BANNED: HOMEOTELEUTON":
            c["screen_homeo"] += 1
        elif v == "BANNED: MODAL_RHYME":
            c["screen_modal"] += 1
        elif v == "CLEAN":
            c["screen_clean"] += 1
        elif v.startswith("REFUSED"):
            c["screen_refused"] += 1
        else:
            c["screen_other"] += 1
    return c


# ------------------------------------------------------------- the final

def measure_lines(rv, lines, mandate):
    """-> the final-song counts for one graded text under one mandate.

    `rv` is a shared `Reviser` so the lexicon is built once for the bank.
    Everything read here is the grader's own: `inspect`'s per-line findings
    for the two ban codes, its grade's three counts, and `modal_field` for
    the rank buckets."""
    from quality import structures as _ST
    found = rv.inspect(lines, mandate)
    rep = found["grade"]
    out = {"pairs_mandated": rep["pairs_mandated"],
           "pairs_judged": rep["pairs_judged"],
           "pairs_refused": rep["pairs_refused"],
           "banned_in_final": sum(1 for fs in found["per_line"].values()
                                  for f in fs if f.code in BAN_CODES),
           # Per-line FLAGS under the recovered mandate. Disclosed, not
           # pinned: a banked exit-0 song that shows flags here is a song
           # whose recovered mandate is NOT the one that graded it (the
           # `log` source is the mandate as PLANNED), and the number says so
           # rather than the counts above pretending to be about the bank's
           # own grade (doctrine 20). Measured 2026-09-02: the_long_way_back
           # under its plan-log mandate shows 5 SCHEME_VIOLATION flags and
           # one HOMEOTELEUTON note the re-bank's own grade (exit 0, 0 flags)
           # did not — its graded command is banked nowhere readable.
           "flags": sum(1 for fs in found["per_line"].values()
                        for f in fs if f.severity == "flag"),
           "eligible": 0, "rank_head": 0, "rank_tail": 0, "rank_outside": 0,
           "ranks": [], "pairs": []}
    for v in rep["verdicts"]:
        if v["why"] or v["relation"] == "REPEAT":
            continue
        st = v.get("structure")
        if st is not None and st != _ST.DEFAULT:
            continue
        wi, wj = (w.lower() for w in v["endwords"])
        out["eligible"] += 1
        best = None
        for call, partner in ((wi, wj), (wj, wi)):
            offered, forbidden = rv.modal_field(call)
            if partner in forbidden:
                pos = ("head", forbidden.index(partner))
            elif partner in offered:
                pos = ("tail", len(forbidden) + offered.index(partner))
            else:
                pos = ("outside", None)
            if best is None or _pos_key(pos) < _pos_key(best):
                best = pos
        out["rank_" + best[0]] += 1
        if best[1] is not None:
            out["ranks"].append(best[1])
        out["pairs"].append((v["lines"], wi, wj, best[0], best[1]))
    return out


def _pos_key(pos):
    return (0, pos[1]) if pos[1] is not None else (1, 0)


def measure_song(rv, song):
    import lyric_harness as LH
    row = {"song": song}
    row.update(screened_pool(song))
    spec = mandate_spec(song)
    if spec[0] is None:
        row["mandate_source"] = "REFUSED"
        row["refusal"] = spec[1]
        return row
    row["mandate_source"] = spec[0]
    lines = LH.load_lyric_lines(os.path.join(SONGS, song))
    row.update(measure_lines(rv, lines, build_mandate(spec, len(lines))))
    return row


def measure_bank(rv=None):
    if rv is None:
        from quality.revise import Reviser
        rv = Reviser()
    return [measure_song(rv, s) for s in songs()]


def totals(rows):
    t = {k: 0 for k in PINNED}
    t["songs"] = len(rows)
    for r in rows:
        src = r["mandate_source"]
        t["mandate_" + ("refused" if src == "REFUSED" else src)] += 1
        for k in PINNED:
            if k.startswith("screen_") or (k in r and not k.startswith("mandate")
                                           and k not in ("songs", "flags")):
                t[k] += r.get(k, 0)
    return t


def _median(xs):
    xs = sorted(xs)
    if not xs:
        return None
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


def report(rows, stream=sys.stdout):
    p = lambda s="": print(s, file=stream)   # noqa: E731
    p("BAN CONVERGENCE — the two-tier ban against the bank (C18 / M-168)")
    p("  per song: screened pool (homeo/modal/clean/refused/other, from the "
      "log's `screen` rows) | final (mandated/judged/refused; ban findings;"
      " eligible pairs; HEAD/TAIL/OUTSIDE partner ranks)")
    for r in rows:
        pool = (f"screen {r['screen_homeo']}H/{r['screen_modal']}M/"
                f"{r['screen_clean']}C/{r['screen_refused']}R/"
                f"{r['screen_other']}?")
        if r["mandate_source"] == "REFUSED":
            p(f"  {r['song']:<32} {pool:<28} REFUSED — {r['refusal']}")
            continue
        med = _median(r["ranks"])
        p(f"  {r['song']:<32} {pool:<28} [{r['mandate_source']}] "
          f"{r['pairs_mandated']}/{r['pairs_judged']}/{r['pairs_refused']} "
          f"flags={r['flags']} ban={r['banned_in_final']} "
          f"elig={r['eligible']} "
          f"head={r['rank_head']} tail={r['rank_tail']} "
          f"outside={r['rank_outside']}"
          + (f" tail-rank median {med} min {min(r['ranks'])} "
             f"max {max(r['ranks'])}" if r["ranks"] else ""))
    t = totals(rows)
    all_ranks = [x for r in rows for x in r.get("ranks", [])]
    p("BANK:")
    for k in PINNED:
        p(f"  {k:<18} {t[k]}")
    if all_ranks:
        p(f"  tail ranks: median {_median(all_ranks)} min {min(all_ranks)} "
          f"max {max(all_ranks)} over {len(all_ranks)} ranked pairs "
          f"(HEAD would be < len(forbidden); every ranked partner sits past "
          f"the ban's own head)")
    return t


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    only = [a[len("--songs="):] for a in argv if a.startswith("--songs=")]
    from quality.revise import Reviser
    rv = Reviser()
    if only:
        names = [n for n in only[0].split(",") if n]
        rows = [measure_song(rv, n) for n in names]
    else:
        rows = measure_bank(rv)
    t = report(rows)
    if "--check" in argv:
        if only:
            # A partial run cannot be checked against a bank-wide pin; say
            # so rather than compare a piece to the whole (doctrine 20).
            print("  --check: REFUSED on --songs= — the pins are bank-wide")
            return 2
        moved = {k: (PINNED[k], t[k]) for k in PINNED
                 if PINNED[k] is not None and PINNED[k] != t[k]}
        unpinned = [k for k in PINNED if PINNED[k] is None]
        if moved:
            print("  --check: MOVED " + ", ".join(
                f"{k} pinned {a} got {b}" for k, (a, b) in moved.items()))
            return 1
        print("  --check: every pinned total holds"
              + (f"; UNPINNED (measured, not checked): "
                 f"{', '.join(unpinned)}" if unpinned else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
