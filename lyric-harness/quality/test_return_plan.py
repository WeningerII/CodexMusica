"""Stage 5 (owner's ruling, 16 Nov 2026): under a plan, the return answers
about shapes the plan dealt are code, not notes.

Two parts, and five small sections beside them.

1. DATA GUARDS, no grading. Every plan the planner draws for seeds 1-1000 of
   each form is read, and the facts the grader now relies on are asserted on
   every one: a later verbatim line is joined to its first instance by a
   return class, the hook slot opens a class, a reprise after line 1 opens on
   a line joined to an earlier one, no single-use row repeats, every return is
   a whole-line verbatim class, and a returning function keeps one length,
   bar count, meter and slot profile.

2. GRADED MECHANISMS, dealt by `TEST_PLAN_SHARD`. A fixed walk of plans drawn
   with the capacity table's adopted relation, each given a draft built from
   the rhyme families songs use (`witnesses`, read off the song pair census)
   and the fixture word pool, with its return lines copied by the plan's own
   rows. Each mechanism in `MECHANISMS` changes
   the draft in one way and says which flags the change adds. The walk goes
   on, seed by seed, until every mechanism has `FLOOR` hits, and fails naming
   the mechanism that is short if a form reaches `SEED_CAP` first. Every
   shard builds the same walk; only the grading is dealt.

The sections in `DEALT` run on one shard each (`quality.shard`); the graded
mechanisms run on every shard and deal their own plans.

Run from lyric-harness: python3 quality/test_return_plan.py
(`--slow` walks the merge-note search to `MERGE_SEED_CAP` instead of grading
its recorded witness, `MERGE_WITNESS`.)
"""
import collections
import copy
import csv
import json
import os
import random
import re
import shlex
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from quality import capacity as C  # noqa: E402
from quality import grid as G  # noqa: E402
from quality import plan as P  # noqa: E402
from quality import schemes as SC  # noqa: E402
from quality.shard import dealt  # noqa: E402

FAILURES = []

FORMS = P.PLAN_FORMS
#: the data guards read every plan of these seeds, per form
GUARD_SEEDS = range(1, 1001)
#: the graded walk keeps plans of at most this many lines.
#: REPINNED 2026-11-23 (bug hunt finding 17): the reason given was ~~the
#: draft builder below makes no draft for a longer plan (no witness family is
#: that wide)~~. The families read off the song pair census do serve longer
#: plans (all 69 past this bound in each form's first 120 seeds). The bound
#: stays so that the walk, and the time it takes, are what they were.
WALL = 108
#: every mechanism needs this many hits before the walk stops
FLOOR = 5
#: and the walk fails, naming the short mechanism, past this seed per form
SEED_CAP = 1000
#: the merge-note search's own bound, walked only under `--slow`. Under the
#: 150-line writing cap the first plan that offers that case was open seed
#: 1586 (97 lines; measured 2026-11-20, about four minutes on one process);
#: before the cap it was verse-chorus seed 245.
#: REPINNED 2026-11-22 (bug hunt F23, R2's word for this file): ~~2000~~.
#: The joint check refuses seed 1586's first draw (TWO_GROUPS_ONE_WORD: a
#: copy's last word was bound by a second group) and the redraw offers no
#: such copy; the walk's next is verse-chorus seed 4171, about 450 seconds
#: on one process. The default run grades that seed directly
#: (`MERGE_WITNESS`); `--slow` walks again, to re-find it when the planner
#: moves.
#: REPINNED 2026-11-23 (bug hunt finding 17): the walk's first was
#: ~~verse-chorus seed 4171~~. Such a note needs two groups whose end words
#: can be heard as one, and that was a rare accident of the old word lists.
#: This section's drafts now ask for it (`build_draft(apart=False)`), and
#: with the families read off the song pair census the walk's first is open
#: seed 52, about 26 seconds on one process. The cap is left where it was.
MERGE_SEED_CAP = 4200
#: (seed, form) of the walk's first merge note that says more than the
#: copy, and what the walk found there: the copied line, the note's groups
#: and its lines. REPINNED 2026-11-23 (bug hunt finding 17), as above:
#: ~~(4171, "verse-chorus")~~ and ~~(44, ("I", "N"), (27, 28, 43, 44))~~.
MERGE_WITNESS = (52, "open")
MERGE_WITNESS_SHAPE = (65, ("K", "S"), (40, 41, 65, 67, 69))
#: `--slow` walks the merge-note search instead of grading its witness
SLOW = "--slow" in sys.argv

#: the answers the grader does not give about a shape the plan dealt
PLAN_DEALT = frozenset({
    "SINGLE_USE_RECURRED", "RETURN_LENGTH_DRIFT", "RETURN_METER_DRIFT",
    "RETURN_SLOT_DRIFT", "RETURN_SCHEME_DRIFT", "RETURNS_WITH_NEW_WORDS",
    "RETURN_LOCKED", "REPRISE_BRINGS_NOTHING_BACK", "HOOK_CONFINED",
    "HOOK_DOES_NOT_RECUR", "CROSS_FUNCTION_REPRISE"})


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# --------------------------------------------------------------------------
# the plan's own reading
# --------------------------------------------------------------------------

def mandate_of(p):
    gs = [g.split(",") for g in str(p.get("groups") or "").split(";") if g]
    rr = ([[int(x) for x in r.split(",")] for r in p["returns"].split(";")]
          if p.get("returns") else None)
    return SC.mandate(gs, n_lines=p["total_lines"], returns=rr,
                      relations=p.get("relations"),
                      default_relation=p.get("relation"))


def classes_of(m):
    """-> the whole-line return classes, each a sorted list of lines."""
    return [sorted(r) for r in m.returns]


def section_lines(p):
    out = collections.defaultdict(list)
    for s in p["line_slots"]:
        out[s["section"]].append(s["line"])
    return out


def by_function(p):
    out = collections.defaultdict(list)
    for s in p["sections"]:
        out[s["function"]].append(s)
    return out


def returning(fn):
    return G.SECTION_FUNCTIONS[fn].recurrence == "returns"


def slot_profile(p, name, start):
    return [(s["bar"] - start, s["beat"], s["duration"])
            for s in p["line_slots"] if s["section"] == name]


def guard_breaks(p, m):
    """-> [reason] for each data guard this plan breaks; [] when it keeps
    every one."""
    out = []
    cls = classes_of(m)
    cof = {ln: frozenset(c) for c in cls for ln in c}
    sl = section_lines(p)
    fns = by_function(p)
    for r in m.returns:
        if getattr(r, "placed", False) or r.verbatim is not True:
            out.append(f"return {sorted(r)} is placed or not verbatim")
    for fn, secs in fns.items():
        if fn in G.single_use_functions() and len(secs) > 1:
            out.append(f"single-use {fn} comes {len(secs)} times")
        if not returning(fn) or len(secs) < 2:
            continue
        first = secs[0]
        for s in secs[1:]:
            if len(sl[s["name"]]) != len(sl[first["name"]]):
                out.append(f"{fn} {s['name']} has another line count")
            if s["bars"] != first["bars"]:
                out.append(f"{fn} {s['name']} has another bar count")
            if s["meter"] != first["meter"]:
                out.append(f"{fn} {s['name']} has another meter")
            if (slot_profile(p, s["name"], s["start_bar"])
                    != slot_profile(p, first["name"], first["start_bar"])):
                out.append(f"{fn} {s['name']} has another slot profile")
            if G.SECTION_FUNCTIONS[fn].returns_as != "verbatim":
                continue
            for a, b in zip(sl[first["name"]], sl[s["name"]]):
                if cof.get(a) is None or cof.get(a) != cof.get(b):
                    out.append(f"{fn} line {b} is not joined to line {a}")
    hs = p.get("hook_slot")
    if hs and (hs not in cof or min(cof[hs]) != hs):
        out.append(f"hook slot {hs} does not open a class")
    for s in fns.get("reprise", []):
        lines = sl[s["name"]]
        if not lines or lines[0] == 1:
            continue
        c = cof.get(lines[0])
        if c is None or min(c) >= lines[0]:
            out.append(f"reprise {s['name']} opens on line {lines[0]}, "
                       f"joined to no earlier line")
    return out


def reprise_before_chorus(p):
    fns = by_function(p)
    if not fns.get("chorus") or not fns.get("reprise"):
        return False
    first = fns["chorus"][0]["start_bar"]
    return any(s["start_bar"] <= first for s in fns["reprise"])


def test_data_guards():
    print("\n1. DATA GUARDS: every plan the planner draws keeps the shapes the "
          "grader no longer judges under a plan (no grading)")
    counts = collections.Counter()
    breaks = []
    for form in FORMS:
        for seed in GUARD_SEEDS:
            p = P.make_plan(seed, form=form)
            m = mandate_of(p)
            counts["plans"] += 1
            counts[form, "reprise before the chorus"] += reprise_before_chorus(p)
            counts[form, "a class of 3+ lines"] += any(
                len(c) >= 3 for c in classes_of(m))
            for why in guard_breaks(p, m):
                breaks.append((form, seed, why))
    check(f"{counts['plans']} plans of seeds {GUARD_SEEDS.start}-"
          f"{GUARD_SEEDS.stop - 1} per form keep every guard",
          counts["plans"] == len(FORMS) * len(GUARD_SEEDS) and not breaks,
          f"broken: {breaks[:12] or 'none'}"
          + (f" (and {len(breaks) - 12} more)" if len(breaks) > 12 else ""))
    print("          " + "; ".join(
        f"{form}: reprise before the chorus "
        f"{counts[form, 'reprise before the chorus']}, a class of 3+ lines "
        f"{counts[form, 'a class of 3+ lines']}" for form in FORMS))
    # THE CONTROL: the guards can fail. In each form, the first drawn plan
    # with two return rows must break a guard once its first row is dropped.
    for form in FORMS:
        for seed in GUARD_SEEDS:
            p = P.make_plan(seed, form=form)
            if p.get("returns") and ";" in p["returns"]:
                q = dict(p, returns=";".join(p["returns"].split(";")[1:]))
                broken = guard_breaks(q, mandate_of(q))
                check(f"CONTROL ({form}): a plan with one return row dropped "
                      f"breaks a guard",
                      bool(broken), f"seed {seed}: {broken[:2]}")
                break


# --------------------------------------------------------------------------
# the draft, built by the harness's own means
# --------------------------------------------------------------------------

_W = None
_REV = None


def reviser():
    global _REV
    if _REV is None:
        from quality.revise import Reviser
        _REV = Reviser()
    return _REV


#: REPINNED 2026-11-23 (bug hunt finding 17; R2's word for this file):
#: ~~C.TABLE_PATH, the capacity table's certified witness rows~~. With the
#: spelling class corrected, six families hold the 20 classes a certified
#: witness needs (~~82~~), and six cannot supply a draft's groups and its
#: spare end words: the walk stopped on its first form. This file never
#: needed a certified chain. It needs many families of a few words that
#: rhyme, so it reads them off the words songs rhyme, under the key the
#: same-spelled-ending ban reads today. Nothing is chosen: every family of
#: the census is here, in one fixed order.
PAIRS_PATH = os.path.join(ROOT, "data", "song_rhymepair_en.tsv")


def witnesses():
    """-> the rhyme families the drafts are built from, widest first.

    The words songs rhyme (`PAIRS_PATH`), most often rhymed first, sorted
    into the capacity table's sound families for its adopted relation. A
    family keeps one word for each spelled ending (`Reviser._spelled_rime`,
    what the same-spelled-ending ban reads), so no two of its words are a
    pair that ban stops. Left out: a word with more than one reading, a word
    that sounds exactly like one already kept, and a family of one word."""
    global _W
    if _W is None:
        rv = reviser()
        key = C.relation_key(C.ADOPTED_RELATION)
        count = collections.Counter()
        with open(PAIRS_PATH, encoding="utf-8") as fh:
            for r in csv.DictReader(
                    (l for l in fh if not l.startswith("#")), delimiter="\t"):
                count[r["a"]] += int(r["count"])
                count[r["b"]] += int(r["count"])
        fams = collections.defaultdict(dict)
        sounds = collections.defaultdict(set)
        for w in sorted(count, key=lambda w: (-count[w], w)):
            if not (w.isalpha() and len(w) >= 2 and _single(w)):
                continue
            phones = tuple(rv.lex.entries[w][0])
            k = key(phones)
            if k is None or phones in sounds[k]:
                continue
            ending = rv._spelled_rime(w)
            if ending not in fams[k]:
                fams[k][ending] = w
                sounds[k].add(phones)
        _W = sorted((list(f.values()) for f in fams.values() if len(f) >= 2),
                    key=lambda w: (-len(w), w[0]))
    return _W


def draw_plan(seed, form):
    return P.make_plan(seed, form=form,
                       relation="class:" + C.ADOPTED_RELATION)


def returns_map(p):
    out = {}
    for r in str(p.get("returns") or "").split(";"):
        if r:
            a, b = map(int, r.split(","))
            out[b] = a
    return out


def _syl(w):
    return sum(1 for ph in reviser().lex.entries[w][0] if ph[-1].isdigit())


def _single(w):
    return len(reviser().lex.entries.get(w, ())) == 1


def build_draft(seed, form, p, body_words=3, apart=True):
    """-> the draft's lines, or None when no family left is wide enough.

    Each group's end words come from one rhyme family (`witnesses`), and
    each unrhymed line's end word from a family of its own; no two families
    of one draft collide (`_families_collide`) unless `apart` is False. The
    bodies are seeded draws from the fixture noun pool, every word used once;
    each returned line is a copy of the line its row names."""
    from quality.fixtures import seeded_lines as SL
    n = p["total_lines"]
    rets = returns_map(p)
    groups = [[int(x.split(".")[0]) for x in g.split(",")]
              for g in str(p.get("groups") or "").split(";") if g]
    budget = {x["line"]: int(x["duration"] * p["subdivision"])
              for x in p["line_slots"]}
    rng = random.Random(f"{form}:{seed}")

    def root(x):
        while x in rets:
            x = rets[x]
        return x
    par = list(range(len(groups)))

    def find(a):
        while par[a] != a:
            a = par[a]
        return a
    owner = {}
    for gi, g in enumerate(groups):
        for ln in g:
            r = root(ln)
            if r in owner:
                par[find(gi)] = find(owner[r])
            else:
                owner[r] = gi
    clusters = collections.defaultdict(set)
    for gi, g in enumerate(groups):
        clusters[find(gi)].update(root(x) for x in g)
    end = {}
    free = list(witnesses())
    taken = []

    def joins(w):
        return not (apart and any(_families_collide(w, t) for t in taken))
    for _ci, roots in sorted(clusters.items(), key=lambda kv: -len(kv[1])):
        cap = min(budget[l] for l in range(1, n + 1) if root(l) in roots)
        k = next((j for j, w in enumerate(free)
                  if len([x for x in w if _syl(x) <= cap]) >= len(roots)
                  and joins(w)), None)
        if k is None:
            return None
        taken.append(free.pop(k))
        fam = list(taken[-1])
        rng.shuffle(fam)
        fam.sort(key=_syl)
        for r in sorted(roots):
            end[r] = fam.pop(0)
    pool = [w for w in SL._pool("noun") if _single(w) and _syl(w) == 1]
    rng.shuffle(pool)
    body = iter(pool)
    out = []
    for i in range(1, n + 1):
        if i in rets:
            out.append(out[rets[i] - 1])
            continue
        if i in end:
            e = end[i]
        else:
            k = next((j for j in range(len(free) - 1, -1, -1)
                      if any(_syl(x) <= budget[i] for x in free[j])
                      and joins(free[j])), None)
            if k is None:
                return None
            taken.append(free.pop(k))
            e = min((x for x in taken[-1] if _syl(x) <= budget[i]), key=_syl)
        # a returned line is sung again in its copies' slots too, and a
        # reprise may bring a line back in a shorter slot than its first
        room = min(budget[x] for x in range(i, n + 1)
                   if root(x) == i) - _syl(e)
        out.append(" ".join([next(body) for _ in
                             range(max(0, min(body_words, room)))] + [e]))
    return out


def grade(p, lines, pasted=False, mandate=None):
    """-> (flags {(code, line)}, codes, function rows, pairs refused,
    findings) under the plan's own mandate and blueprint. `pasted` grades
    the same blueprint without the key only `fill_plan` writes, which is
    how a writer's own blueprint reaches the grader. `mandate` grades under
    another mandate than the plan's own."""
    from quality import fit as FT
    m = mandate_of(p) if mandate is None else mandate
    bp = P.fill_plan(p, lines)
    if pasted:
        bp.pop("hook_slot_refused")
    found = reviser().inspect(
        list(lines), m, blueprint=bp,
        subdivision=FT.Subdivision(p["subdivision"], source="test_return_plan"))
    flags, codes, every = collections.Counter(), set(), []
    for f in found["whole"]:
        codes.add(f.code)
        every.append((None, f))
        if f.severity == "flag":
            flags[(f.code, None)] += 1
    for ln, fs in found["per_line"].items():
        for f in fs:
            codes.add(f.code)
            every.append((ln, f))
            if f.severity == "flag":
                flags[(f.code, ln)] += 1
    rows = {r["id"]: r for r in found["coverage"]["obligations"]
            if r.get("layer") == "function"}
    return flags, codes, rows, found["grade"]["pairs_refused"], every


def verify(p, before, after, targeted):
    """-> `Reviser.verify`'s answer on one revision of a planned draft,
    under the plan's own mandate and blueprint."""
    from quality import fit as FT
    return reviser().verify(
        list(before), list(after), mandate=mandate_of(p),
        targeted=set(targeted), blueprint=P.fill_plan(p, before),
        subdivision=FT.Subdivision(p["subdivision"],
                                   source="test_return_plan"))


def raw_groups(p):
    """-> the plan's rhyme groups, each a sorted list of lines."""
    return [sorted({int(x.split(".")[0]) for x in g.split(",")})
            for g in str(p.get("groups") or "").split(";") if g]


def no_returns_mandate(p):
    """-> the plan's groups as a mandate that declares no return."""
    return SC.mandate([g.split(",") for g in str(p["groups"]).split(";") if g],
                      n_lines=p["total_lines"], returns=None,
                      relations=p.get("relations"),
                      default_relation=p.get("relation"))


# --------------------------------------------------------------------------
# the mechanisms: each one a change, and the flags it adds
# --------------------------------------------------------------------------

def _inner(lines, ln, word):
    w = lines[ln - 1].split()
    if len(w) < 2:
        return None
    w[0] = word
    out = list(lines)
    out[ln - 1] = " ".join(w)
    return out


def _end(lines, ln, word):
    w = lines[ln - 1].split()
    w[-1] = word
    out = list(lines)
    out[ln - 1] = " ".join(w)
    return out


def _bodied(lines, cls):
    return [c for c in cls if len(lines[c[0] - 1].split()) >= 2]


def _later_instances(p, kind):
    """-> [(first section, later section)] of each returning function whose
    `returns_as` is `kind`."""
    sl = section_lines(p)
    out = []
    for fn, secs in by_function(p).items():
        if (returning(fn) and len(secs) >= 2 and sl[secs[0]["name"]]
                and G.SECTION_FUNCTIONS[fn].returns_as == kind):
            out += [(secs[0]["name"], s["name"]) for s in secs[1:]]
    return out


def m_class_later(p, L, cls, rng, spare):
    c = _bodied(L, cls)
    if not c:
        return None
    c = rng.choice(c)
    ln = rng.choice(c[1:])
    return _inner(L, ln, spare.word()), ln


def m_class_first_3(p, L, cls, rng, spare):
    c = [c for c in _bodied(L, cls) if len(c) >= 3]
    if not c:
        return None
    c = rng.choice(c)
    return _inner(L, c[0], spare.word()), c[0]


def m_class_first_2(p, L, cls, rng, spare):
    hs = p.get("hook_slot")
    c = [c for c in _bodied(L, cls) if len(c) == 2 and hs not in c]
    if not c:
        return None
    c = rng.choice(c)
    return _inner(L, c[0], spare.word()), c[1]


def m_hook_slot(p, L, cls, rng, spare):
    hs = p.get("hook_slot")
    c = next((c for c in _bodied(L, cls) if hs in c), None)
    if c is None:
        return None
    return _inner(L, hs, spare.word()), (c[1] if len(c) == 2 else hs)


def m_hook_later(p, L, cls, rng, spare):
    hs = p.get("hook_slot")
    c = next((c for c in _bodied(L, cls) if hs in c), None)
    if c is None:
        return None
    ln = rng.choice(c[1:])
    return _inner(L, ln, spare.word()), ln


def m_reprise_row(p, L, cls, rng, spare):
    sl = section_lines(p)
    rep = {ln for s in by_function(p).get("reprise", ()) for ln in sl[s["name"]]}
    c = next((c for c in _bodied(L, cls) if set(c) & rep), None)
    if c is None:
        return None
    ln = max(set(c) & rep)
    if ln == c[0]:
        return None
    return _inner(L, ln, spare.word()), ln


def m_class_4(p, L, cls, rng, spare):
    c = [c for c in _bodied(L, cls) if len(c) >= 4]
    if not c:
        return None
    c = rng.choice(c)
    ln = rng.choice(c[1:])
    return _inner(L, ln, spare.word()), ln


def m_end_later(p, L, cls, rng, spare):
    if not cls:
        return None
    c = rng.choice(cls)
    ln = rng.choice(c[1:])
    return _end(L, ln, spare.end()), ln


def m_group_break(p, L, cls, rng, spare):
    sl = section_lines(p)
    later = {ln for _a, b in _later_instances(p, "new words") for ln in sl[b]}
    classed = {ln for c in cls for ln in c}
    cand = [g for g in raw_groups(p) if len(g) >= 2 and set(g) <= later
            and not set(g) & classed]
    if not cand:
        return None
    g = rng.choice(cand)
    ln = rng.choice(g)
    return _end(L, ln, spare.end()), (ln, len(g))


def copies_the_first(kind):
    """-> the change: a later instance of a returning function whose
    `returns_as` is `kind` copies the first instance, line for line."""
    def change(p, L, cls, rng, spare):
        sl = section_lines(p)
        # An instance a later line returns (a reprise may bring back the
        # first line of any earlier section with new words, #902) cannot be
        # copied without changing that planned return as well: the stale
        # return is the reprise row's own question, not this one's.
        sources = set(returns_map(p).values())
        eq = [(a, b) for a, b in _later_instances(p, kind)
              if len(sl[a]) == len(sl[b]) and not set(sl[b]) & sources]
        if not eq:
            return None
        a, b = rng.choice(eq)
        out = list(L)
        for x, y in zip(sl[a], sl[b]):
            out[y - 1] = out[x - 1]
        return out, b
    return change


m_copy_new_words = copies_the_first("new words")


def m_outro_copies(p, L, cls, rng, spare):
    sl = section_lines(p)
    fns = by_function(p)
    outs = [s["name"] for s in fns.get("outro", ()) if sl[s["name"]]]
    srcs = [ss[0]["name"] for later, earlier in G.POPULAR_SONG.reprises
            if later == "outro" for ss in (fns.get(earlier) or (),) if ss
            and sl[ss[0]["name"]]]
    if not outs or not srcs:
        return None
    o, s = rng.choice(outs), rng.choice(srcs)
    if min(sl[s]) >= min(sl[o]):
        return None
    out = list(L)
    out[sl[o][0] - 1] = out[sl[s][0] - 1]
    return out, sl[o][0]


def m_reprise_first(p, L, cls, rng, spare):
    return (list(L), None) if reprise_before_chorus(p) else None


def _later_in_groups(p, cls):
    """-> [(class, its line)] for each later line of a class that sits in a
    rhyme group of two or more lines: the copy the plan put in a group of
    its own. A changed end word there breaks a pair, so the hold has a pair
    to hold. The flag lands on that line, tie or majority."""
    grouped = {ln for g in raw_groups(p) if len(g) >= 2 for ln in g}
    return [(c, ln) for c in cls for ln in c[1:] if ln in grouped]


def m_end_in_group(p, L, cls, rng, spare):
    cand = _later_in_groups(p, cls)
    if not cand:
        return None
    _c, ln = rng.choice(cand)
    return _end(L, ln, spare.end()), ln


def m_end_and_inner(p, L, cls, rng, spare):
    cand = _later_in_groups(p, cls)
    if not cand:
        return None
    c1, ln1 = rng.choice(cand)
    others = [c for c in _bodied(L, cls) if c != c1]
    if not others:
        return None
    c2 = rng.choice(others)
    ln2 = rng.choice(c2[1:])
    out = _inner(_end(L, ln1, spare.end()), ln2, spare.word())
    return out, (ln1, ln2)


def _held_partner(p, cls, rng):
    """-> (class, its line a, a line y of a's rhyme group outside the
    class), drawn by `rng`, or None: the pair (a, y) is held whenever the
    class's end words differ."""
    cand = [(c, a, y) for c in cls for g in raw_groups(p) for a in c
            if a in g for y in g if y not in c]
    return rng.choice(cand) if cand else None


def _end_class(lines, cls, ln, word):
    """-> `lines` with `ln`, and every line of its return class, ended on
    `word`, so the class still agrees."""
    for x in next((c for c in cls if ln in c), [ln]):
        lines = _end(lines, x, word)
    return lines


def m_repair_under_hold(p, L, cls, rng, spare):
    got = _held_partner(p, cls, rng)
    if got is None:
        return None
    c, a, y = got
    # The class agrees on a new end word, so (a, y) no longer rhymes; then
    # one member leaves the class. The repair puts that member back.
    agreed = _end_class(L, cls, a, spare.end())
    b = rng.choice(c)
    return _end(agreed, b, spare.end()), dict(
        after=agreed, targeted={b}, pair=(min(a, y), max(a, y)))


def m_break_under_hold(p, L, cls, rng, spare):
    got = _held_partner(p, cls, rng)
    if got is None:
        return None
    c, a, y = got
    # One member other than `a` leaves the class, so (a, y) still rhymes and
    # is held. The revision then breaks it, on y and y's own class alike.
    before = _end(L, rng.choice([x for x in c if x != a]), spare.end())
    after = _end_class(before, cls, y, spare.end())
    return before, dict(
        after=after, pair=(min(a, y), max(a, y)),
        targeted={x + 1 for x in range(len(L)) if before[x] != after[x]})


def _reprise_sections(p, later, earlier):
    """-> (the first `earlier` section, [each `later` section placed after
    it]) by name, or None when the plan holds no such pair."""
    sl, fns = section_lines(p), by_function(p)
    src = [s for s in (fns.get(earlier) or ())[:1] if sl[s["name"]]]
    if not src:
        return None
    dst = [s["name"] for s in fns.get(later, ())
           if sl[s["name"]] and s["start_bar"] > src[0]["start_bar"]]
    return (src[0]["name"], dst) if dst else None


def reprising_copy(later, earlier):
    """-> the change for one row of `POPULAR_SONG.reprises`: a line of the
    `later` section other than its first, and in no return class, copies a
    line of the `earlier` section it reprises."""
    def change(p, L, cls, rng, spare):
        got = _reprise_sections(p, later, earlier)
        if got is None:
            return None
        sl = section_lines(p)
        classed = {ln for c in cls for ln in c}
        cand = [b for d in got[1] for b in sl[d][1:] if b not in classed]
        if not cand:
            return None
        b, a = rng.choice(cand), rng.choice(sl[got[0]])
        out = list(L)
        out[b - 1] = out[a - 1]
        return out, b
    return change


def m_two_reprising_copies(p, L, cls, rng, spare):
    sl = section_lines(p)
    classed = {ln for c in cls for ln in c}
    grouped = {ln for g in raw_groups(p) if len(g) >= 2 for ln in g}
    cand = []
    for later, earlier in G.POPULAR_SONG.reprises:
        got = _reprise_sections(p, later, earlier)
        if got is None or len(sl[got[0]]) < 2:
            continue
        for d in got[1]:
            free = [b for b in sl[d] if b not in classed]
            inside = [b for b in free if b in grouped]
            outside = [b for b in free if b not in grouped]
            if inside and outside:
                cand.append((got[0], inside, outside))
    if not cand:
        return None
    src, inside, outside = rng.choice(cand)
    b1, b2 = rng.choice(inside), rng.choice(outside)
    a1, a2 = rng.sample(sl[src], 2)
    out = list(L)
    out[b1 - 1], out[b2 - 1] = L[a1 - 1], L[a2 - 1]
    return out, (b1, b2)


def _one_family(L, a, mates):
    """Line `a` is one of `mates`, or its end word is one of theirs or
    shares a rhyme family with one."""
    e = L[a - 1].split()[-1]
    ends = {L[x - 1].split()[-1] for x in mates}
    return (a in mates or e in ends
            or any(e in w and ends & set(w) for w in witnesses()))


def out_of_place_copy(grouped):
    """-> the change: a line of a reprising section copies a line of the
    section it reprises that sits at another place in its own section. The
    two sections hold the same count of lines, so `compare_returns` pairs
    them by place and does not pair this copy. The copying line is in no
    return class. `grouped`: it sits in a rhyme group of two or more lines
    that the copied end word is no witness for; else it sits outside every
    such group."""
    def change(p, L, cls, rng, spare):
        sl = section_lines(p)
        classed = {ln for c in cls for ln in c}
        groups = [g for g in raw_groups(p) if len(g) >= 2]
        cand = []
        for later, earlier in G.POPULAR_SONG.reprises:
            got = _reprise_sections(p, later, earlier)
            if got is None:
                continue
            src = sl[got[0]]
            for d in got[1]:
                if len(sl[d]) != len(src):
                    continue
                for kb, b in enumerate(sl[d]):
                    mates = {x for g in groups if b in g for x in g} - {b}
                    if b in classed or bool(mates) != grouped:
                        continue
                    cand += [(a, b) for ka, a in enumerate(src)
                             if ka != kb and L[a - 1] != L[b - 1]
                             and not _one_family(L, a, mates)]
        if not cand:
            return None
        a, b = rng.choice(cand)
        out = list(L)
        out[b - 1] = L[a - 1]
        return out, b
    return change


def m_hook_once(p, L, cls, rng, spare):
    hs = p.get("hook_slot")
    c = next((c for c in _bodied(L, cls) if c[0] == hs), None)
    if c is None:
        return None
    out = list(L)
    for ln in c[1:]:
        out = _inner(out, ln, spare.word())
    return out, tuple(c[1:])


def m_class_past_the_draft(p, L, cls, rng, spare):
    c = _bodied(L, cls)
    if not c:
        return None
    c = rng.choice(c)
    ln = rng.choice(c[1:])
    return _inner(L, ln, spare.word()), (ln, tuple(c))


#: the rhyme-layer notes an undealt copy would otherwise repeat
RHYME_NOTES = frozenset({"REPEAT_ACROSS_GROUPS", "SCHEME_COLLISION",
                         "NEAR_COLLISION", "MANDATE_GROUPS_INDISTINGUISHABLE"})


#: the two rhyme-pair codes a hold can keep back
RHYME_PAIRS = ("SCHEME_VIOLATION", "SCHEME_COLLISION")
#: how a RETURN_NOT_VERBATIM flag's evidence states the pairs held for its
#: class: a sentence of its own, with the count
_HELD_SAID = re.compile(r"(?:^|\. )While [^.]*?(\d+) rhyme pair\(s\)")


def _rnv(c, ln):
    """-> the RETURN_NOT_VERBATIM flags on line `ln`."""
    return [f for at, f in c["every"]
            if at == ln and f.code == "RETURN_NOT_VERBATIM"]


def _says_next_step(c, f, ln):
    """Does the flag on `ln` name the next step? Where other lines of the
    class share one reading, make this line the same as theirs; in a tie,
    change either one."""
    ref = next(x for x in f.locations if x != ln)
    cls = next(k for k in c["cls"] if ln in k)
    read = {x: G.normalise_line(c["lines"][x - 1]) for x in cls}
    same = sum(1 for x in cls if read[x] == read[ref])
    want = (f"make L{ln} the same as L{ref}" if same > 1
            else "change either one")
    if not f.message.endswith(want):
        c["said"].append(f"L{ln} names no next step: ...{f.message[-70:]!r}")
    return f.message.endswith(want)


def _held_count(c, f):
    """-> the pairs one flag's evidence says are held for its class, 0 when
    it says none, None when it says so outside a sentence of its own."""
    said = _HELD_SAID.search(f.evidence)
    if said is None:
        return None if "rhyme pair(s)" in f.evidence else 0
    return int(said.group(1))


def _kept_back(c, codes):
    """-> how many findings of `codes` the same draft carries when graded
    without the plan's key and lacks under the plan: what a hold keeps
    back."""
    def of(every):
        return collections.Counter((f.code, tuple(f.locations))
                                   for _ln, f in every if f.code in codes)
    return sum((of(c["pasted"]()[4]) - of(c["every"])).values())


def _pairs_kept_back(c):
    """-> how many rhyme pairs a hold keeps back."""
    return _kept_back(c, RHYME_PAIRS)


def _merge_pairs(f):
    """-> the (i, j) line pairs a MANDATE_GROUPS_INDISTINGUISHABLE note
    lists after "Edges:"."""
    return [(int(i), int(j)) for i, j in re.findall(
        r"L(\d+)~L(\d+)", f.evidence.rsplit("Edges:", 1)[-1])]


#: the notes the collision loop raises one by one
COLLISIONS =("SCHEME_COLLISION", "NEAR_COLLISION", "REPEAT_ACROSS_GROUPS",
              "COLLISION_UNDECLARED")


def _cut_note_counts_what_is_raised(c):
    """Does COLLISION_CUT_IS_SCALAR_ONLY, where the plan's grade carries it,
    count its NEAR_COLLISION notes out of the collisions that are not kept
    back by a hold?"""
    def said(every):
        note = next((f.message for _ln, f in every
                     if f.code == "COLLISION_CUT_IS_SCALAR_ONLY"), "")
        got = re.match(r"(\d+) of the (\d+) collision", note)
        return tuple(map(int, got.groups())) if got else None
    mine, whole = said(c["every"]), said(c["pasted"]()[4])
    if mine is None:
        return True
    near = sum(1 for _ln, f in c["every"] if f.code == "NEAR_COLLISION")
    want = (near, (whole[1] if whole else 0) - _kept_back(c, COLLISIONS))
    if mine != want:
        c["said"].append(f"the cut note says {mine}, raised {want}")
    return mine == want


def _rnv_only_at(c):
    """exactly one new flag, RETURN_NOT_VERBATIM on its line, naming the
    next step"""
    return (dict(c["new"]) == {("RETURN_NOT_VERBATIM", c["target"]): 1}
            and not c["codes"] & PLAN_DEALT
            and _says_next_step(c, _rnv(c, c["target"])[0], c["target"]))


def _rnv_no_rhyme_left(c):
    """exactly one new flag, RETURN_NOT_VERBATIM on its line, no rhyme pair
    of the class's groups beside it, and its evidence counting the pairs
    held"""
    if not (_rnv_only_at(c) and not c["names"]["SCHEME_COLLISION"]
            and not c["names"]["SCHEME_VIOLATION"]):
        return False
    said, kept = _held_count(c, _rnv(c, c["target"])[0]), _pairs_kept_back(c)
    c["said"].append(f"says {said} held, {kept} kept back")
    return said == kept and _cut_note_counts_what_is_raised(c)


def _rnv_holds_a_pair(c):
    """exactly one new flag, RETURN_NOT_VERBATIM on its line, with one or
    more rhyme pairs held behind it and counted in its evidence"""
    return _rnv_no_rhyme_left(c) and _pairs_kept_back(c) >= 1


def _held_said_on_its_class(c):
    """one RETURN_NOT_VERBATIM for each class; the pairs held are counted on
    the flag of the class whose end words differ and not on the other"""
    ends, inner = c["target"]
    if (dict(c["new"]) != {("RETURN_NOT_VERBATIM", ends): 1,
                           ("RETURN_NOT_VERBATIM", inner): 1}
            or c["names"]["SCHEME_COLLISION"]
            or c["names"]["SCHEME_VIOLATION"]):
        return False
    said = _held_count(c, _rnv(c, ends)[0])
    other = _held_count(c, _rnv(c, inner)[0])
    kept = _pairs_kept_back(c)
    c["said"].append(f"says {said} held on L{ends} and {other} on "
                     f"L{inner}, {kept} kept back")
    return (said == kept and kept >= 1 and other == 0
            and _cut_note_counts_what_is_raised(c))


def _repair_is_accepted(c):
    """`verify` accepts the repair that makes the class agree again: a pair
    that was held before it is no new flag after it"""
    t = c["target"]
    stands = c["grade"](lines=t["after"])[0]
    v = c["verify"](t["after"], t["targeted"])
    c["said"].append(f"verify: accepted {v['accepted']}, new_flags "
                     f"{v.get('new_flags')}, {v['reasons'][:1]}")
    return (set(code for code, _l in c["new"]) == {"RETURN_NOT_VERBATIM"}
            and stands[("SCHEME_VIOLATION", t["pair"][1])] >= 1
            and bool(v["accepted"]) and not v.get("new_flags"))


def _new_break_is_seen(c):
    """`verify` lists a rhyme pair that a revision breaks while it is held
    as a new flag, and does not accept the revision"""
    t = c["target"]
    v = c["verify"](t["after"], t["targeted"])
    c["said"].append(f"verify: accepted {v['accepted']}, new_flags "
                     f"{v.get('new_flags')}")
    return (set(code for code, _l in c["new"]) == {"RETURN_NOT_VERBATIM"}
            and not v["accepted"]
            and (t["pair"][1], "SCHEME_VIOLATION")
            in [tuple(x) for x in v.get("new_flags", ())])


def _sv_per_pair(c):
    """SCHEME_VIOLATION, one per pair of the broken group"""
    _ln, size = c["target"]
    return (set(code for code, _l in c["new"]) == {"SCHEME_VIOLATION"}
            and sum(c["new"].values()) == size - 1
            and not c["codes"] & PLAN_DEALT)


def _one_note_per_copy(c):
    """no flag, one RETURNS_WITH_SAME_WORDS, no rhyme note restating it"""
    return (not c["new"] and c["names"]["RETURNS_WITH_SAME_WORDS"] == 1
            and not set(c["names"]) & RHYME_NOTES
            and _cut_note_counts_what_is_raised(c))


def _flag_else_one_note(c, want=None):
    """each copied line has one name (the owner's call B). Where it carries
    a SCHEME_VIOLATION flag, that flag names the copy and no
    CROSS_FUNCTION_REPRISE does; else the one new CROSS_FUNCTION_REPRISE
    names it by draft line. Either way it keeps every rhyme flag it has
    without the plan's key, and no rhyme note that restates the copy"""
    copied = (c["target"] if isinstance(c["target"], tuple)
              else (c["target"],))
    # A flag of another layer (the copied words not fitting their new slot)
    # is the copy's own fact and is not this row's question.
    flags = set(code for code, _l in c["new"]) & (
        RHYME_NOTES | PLAN_DEALT | {"SCHEME_VIOLATION", "RETURN_NOT_VERBATIM"})
    if not flags <= {"SCHEME_VIOLATION"}:
        return False

    def notes(every, b):
        # The rhyme notes on one copied line restate that copy. A note it
        # shares with another copied line is read with neither, and one
        # between two other lines (a group partner the copy left, against a
        # third group) is that group's own fact. So is a note that two
        # groups would pass as one, unless every pair it lists has the
        # copied line: the pairs without it stand whatever the copy does.
        def only_the_copy(f):
            if f.code != "MANDATE_GROUPS_INDISTINGUISHABLE":
                return True
            return all(b in e for e in _merge_pairs(f))
        return sorted((f.code, tuple(f.locations)) for _ln, f in every
                      if f.code in RHYME_NOTES
                      and set(copied) & set(f.locations) == {b}
                      and only_the_copy(f))

    def flagged(every, b):
        return [f for _ln, f in every
                if f.code == "SCHEME_VIOLATION" and b in f.locations]
    fresh = {(f.code, tuple(f.locations)) for f in c["fresh"]}
    pasted = c["pasted"]()[4]
    reprise = [f for _ln, f in c["every"]
               if f.code == "CROSS_FUNCTION_REPRISE"]
    by_flag, by_note, held = [], [], 0
    for b in copied:
        mine = notes(c["every"], b)
        if any(key in fresh for key in mine):
            c["said"].append(f"L{b} keeps a rhyme note that restates its "
                             f"copy: {[k for k in mine if k in fresh]}")
            return False
        held += len([key for key in notes(pasted, b) if key not in mine])
        flag = flagged(c["every"], b)
        if (sorted(tuple(f.locations) for f in flag)
                != sorted(tuple(f.locations) for f in flagged(pasted, b))):
            c["said"].append(f"a rhyme flag on L{b} is held behind a note")
            return False
        named = [m for f in reprise
                 for m in re.findall(rf"\bL{b} copies L(\d+)", f.evidence)]
        if flag:
            if named or not all(f"L{b} copies" in f.evidence for f in flag):
                c["said"].append(f"L{b} has a flag, and it is named by "
                                 f"{len(named)} CROSS_FUNCTION_REPRISE")
                return False
            by_flag.append(b)
        else:
            if len(named) != 1 or int(named[0]) == b or (
                    c["lines"][int(named[0]) - 1] != c["lines"][b - 1]):
                c["said"].append(f"L{b} has no flag, and "
                                 f"CROSS_FUNCTION_REPRISE names it as the "
                                 f"copy of {named}")
                return False
            by_note.append(b)
    c["said"].append(
        f"named by a flag: {by_flag}; named by the note: {by_note}; "
        f"{held} rhyme note(s) held; "
        f"{c['names']['CROSS_FUNCTION_REPRISE']} new CROSS_FUNCTION_REPRISE")
    if want is not None and (bool(by_flag), bool(by_note), held > 0) != want:
        return False
    return (c["names"]["CROSS_FUNCTION_REPRISE"] == (1 if by_note else 0)
            and _cut_note_counts_what_is_raised(c))


def _copy_keeps_its_flag(c):
    """the copy carries its SCHEME_VIOLATION flag, which names the copy, and
    nothing more: no CROSS_FUNCTION_REPRISE, and the rhyme note or notes
    that restate the copy are held"""
    return _flag_else_one_note(c, want=(True, False, True))


def _copy_has_its_one_note(c):
    """the copy carries no rhyme flag and has exactly one
    CROSS_FUNCTION_REPRISE, which names it by draft line; the rhyme note or
    notes that restate the copy are held"""
    return _flag_else_one_note(c, want=(False, True, True))


def _reprise_not_requested(c):
    """no new flag; the reprise-order question is not_requested and the
    function layer is answered"""
    asked = [r for r in c["rows"].values()
             if r.get("code") == "REPRISE_IS_NOT_LATER"]
    return (not c["new"] and c["rows"]["function:draft"]["status"] == "answered"
            and bool(asked)
            and all(r["status"] == "not_requested" for r in asked))


def _hook_flag_needs_its_class(c):
    """under the plan's mandate each changed copy is RETURN_NOT_VERBATIM and
    the hook flag is not given; under a mandate with no return the hook that
    occurs once is HOOK_DOES_NOT_RECUR"""
    bare = c["grade"](mandate=no_returns_mandate(c["p"]))[0]
    c["said"].append(f"with no return declared: "
                     f"{sorted(k for k in bare if k[1] is None)}")
    return (dict(c["new"]) == {("RETURN_NOT_VERBATIM", ln): 1
                               for ln in c["target"]}
            and not c["codes"] & PLAN_DEALT
            and bare[("HOOK_DOES_NOT_RECUR", None)] == 1)


def _in_range_flag_stands(c):
    """a class that also names a line past the draft keeps one
    RETURN_NOT_VERBATIM on its changed line, beside one
    RETURN_OUT_OF_RANGE note for each of its lines inside the draft"""
    ln, cl = c["target"]
    m = mandate_of(c["p"])
    past = copy.copy(m)
    object.__setattr__(past, "returns", tuple(
        SC.Return(lines=tuple(sorted(r)) + (len(c["lines"]) + 1,),
                  label=r.label, verbatim=True)
        if set(r) == set(cl) else r for r in m.returns))
    flags, _codes, _rows, _refused, every = c["grade"](mandate=past)
    rnv = {k: v for k, v in flags.items() if k[0] == "RETURN_NOT_VERBATIM"}
    notes = sum(1 for _l, f in every if f.code == "RETURN_OUT_OF_RANGE")
    c["said"].append(f"past the draft: {sorted(rnv.items())}, {notes} "
                     f"RETURN_OUT_OF_RANGE")
    return rnv == {("RETURN_NOT_VERBATIM", ln): 1} and notes == len(cl)


#: (name, change, the flags it adds). A change returns (lines, target) or None
#: when the plan offers it no subject. These are the design's rows: each is
#: graded on every plan of the population that offers it a subject.
TABLE = (
    ("inner word, later line of a class", m_class_later, _rnv_only_at),
    ("inner word, first line of a 3+ class", m_class_first_3, _rnv_only_at),
    ("inner word, first line of a 2-line class", m_class_first_2, _rnv_only_at),
    ("the hook slot line itself", m_hook_slot, _rnv_only_at),
    ("later line of the hook's class", m_hook_later, _rnv_only_at),
    ("the reprise's planned return line", m_reprise_row, _rnv_only_at),
    ("a 4-line class", m_class_4, _rnv_only_at),
    ("end word, later line of a class", m_end_later, _rnv_no_rhyme_left),
    ("end word of a new-words group", m_group_break, _sv_per_pair),
    ("a new-words instance copies the first", m_copy_new_words,
     _one_note_per_copy),
    ("an outro line copies a chorus or intro line", m_outro_copies,
     _flag_else_one_note),
    ("a reprise before the chorus", m_reprise_first, _reprise_not_requested),
)
#: The rows added on review (2026-11-18). Each is graded on the first `FLOOR`
#: plans of each form that offer it a subject, and like every row the walk
#: goes on until it has `FLOOR` hits.
REVIEW = (
    ("end word, a later class line inside a rhyme group", m_end_in_group,
     _rnv_holds_a_pair),
    ("end word in one class, inner word in another", m_end_and_inner,
     _held_said_on_its_class),
    ("a repair under a hold", m_repair_under_hold, _repair_is_accepted),
    ("a new break under a hold", m_break_under_hold, _new_break_is_seen),
    *((f"a later line of the {later} copies a line of the {earlier}",
       reprising_copy(later, earlier), _flag_else_one_note)
      for later, earlier in G.POPULAR_SONG.reprises),
    ("two lines of a reprising section copy it, one inside a rhyme group",
     m_two_reprising_copies, _flag_else_one_note),
    ("the hook's copies changed, with and without its return class",
     m_hook_once, _hook_flag_needs_its_class),
    ("a class that names a line past the draft", m_class_past_the_draft,
     _in_range_flag_stands),
    # The owner's call B, in full (2026-11-18): a copy the function layer
    # does not pair by place has the same one name as any other.
    ("a reprising line copies a line out of its place, inside a rhyme group",
     out_of_place_copy(True), _copy_keeps_its_flag),
    ("a reprising line copies a line out of its place, outside every rhyme "
     "group", out_of_place_copy(False), _copy_has_its_one_note),
    # Merged with stage 4's fix round (2026-11-18): a "varied" row
    # (prechorus, drop) gets the same-words note now, and the plan gives
    # each of its instances its own lines, so a copy of the first has the
    # owner's call A exactly as a "new words" row's copy has.
    ("a varied instance copies the first", copies_the_first("varied"),
     _one_note_per_copy),
)
MECHANISMS = TABLE + REVIEW


_ANCHORS = {}


def _scored(a, b):
    """-> the score `Reviser._matrix` gives two lines ending on `a` and `b`,
    read off the same lexicon, declaration and promotion."""
    from lyric_harness import best_score, line_anchors
    r = reviser()
    for w in (a, b):
        if w not in _ANCHORS:
            ancs, last, _ = line_anchors(r.lex, w, promote=r._promote())
            _ANCHORS[w] = (ancs, last)
    (aa, la), (ab, lb) = _ANCHORS[a], _ANCHORS[b]
    return best_score(aa, ab, r.decl, la, lb)


def _collides(a, b):
    """Does the grader's own pair scorer put end words `a` and `b` at or above
    its collision cut?"""
    from lyric_harness import THETA_COLLISION
    return _scored(a, b)["total"] >= THETA_COLLISION


_COLLIDING = {}


def _families_collide(a, b):
    """Does the grader's pair scorer put any word of family `a` with any word
    of family `b` at or above its collision cut?

    REPINNED 2026-11-23 (bug hunt finding 17): a draft's families were ~~any
    the supply had left~~. Two families can be heard as one: a word that ends
    on a weak syllable is promoted to rhyme with a one-syllable word on the
    same vowel, and the grader notes every such pair. A change that takes one
    line out of a return class then moves how many of those notes are raised,
    on lines the change never touched (measured on verse-chorus seed 62 with
    a wider supply: 15 new SCHEME_COLLISION notes beside the one flag the row
    names). So a draft takes no two families that collide."""
    k = (a[0], b[0]) if a[0] < b[0] else (b[0], a[0])
    if k not in _COLLIDING:
        _COLLIDING[k] = any(_collides(x, y) for x in a for y in b)
    return _COLLIDING[k]


class _Spare:
    """Seeded spare words: nouns the draft does not use, and end words from
    rhyme families the draft does not use that the grader pairs with no
    end word of the draft."""

    def __init__(self, lines, rng):
        from quality.fixtures import seeded_lines as SL
        used = {w for l in lines for w in l.split()}
        self.used = used
        self.ends = sorted({l.split()[-1] for l in lines if l.split()})
        pool = [w for w in SL._pool("noun") if w not in used and _single(w)
                and _syl(w) == 1]
        rng.shuffle(pool)
        self._words = iter(pool)
        fams = [w for w in witnesses() if not set(w) & used]
        rng.shuffle(fams)
        self._fams = iter(fams)

    def word(self):
        return next(self._words)

    def end(self):
        # REPINNED 2026-11-22 (bug hunt F23, R2's word for this file): a
        # family the draft does not use was ~~taken to rhyme with nothing in
        # it~~, and "family not used" never meant "rhymes with nothing". Once
        # the joint check redraws some seeds, verse-chorus seed 77 drew 'bein'
        # for a copy's end word, and the grader paired it with the draft's
        # 'jin' at the collision cut: one SCHEME_COLLISION beside the change's
        # RETURN_NOT_VERBATIM. A candidate the grader's own scorer pairs with
        # any end word of the draft at or above that cut is skipped; the
        # candidate order stays seeded.
        while True:
            c = [x for x in next(self._fams) if _single(x)
                 and x not in self.used and _syl(x) == 1
                 and not any(_collides(x, e) for e in self.ends)]
            if c:
                return c[0]


def subjects(seed, form, p, L, wanted):
    """-> [(mechanism index, lines, target)] for the mechanisms in `wanted`
    this plan offers a subject to."""
    m = mandate_of(p)
    cls = classes_of(m)
    out = []
    for k, (name, change, _expect) in enumerate(MECHANISMS):
        if k not in wanted:
            continue
        rng = random.Random(f"{form}:{seed}:{name}")
        got = change(p, L, cls, rng, _Spare(L, rng))
        if got is None or got[0] is None:
            continue
        out.append((k, got[0], got[1]))
    return out


_WALK = None


def walk():
    """-> [(seed, form, [mechanism index])] and the hit count per mechanism.

    Every shard builds this same walk: the population (per form, seeds until
    each returning row of the table has come twice in one plan), then more
    seeds until every mechanism has `FLOOR` hits, a mechanism graded on a
    later seed only while it is short. A `REVIEW` row is graded on the
    population's first `FLOOR` plans of each form that offer it a subject."""
    need = {f for f in G.SECTION_FUNCTIONS if returning(f)}
    hits = collections.Counter()
    jobs = []
    state = {form: dict(seed=0, seen=set(), hits=collections.Counter())
             for form in FORMS}

    def take(form, population):
        st = state[form]
        while True:
            st["seed"] += 1
            if st["seed"] > SEED_CAP:
                return False
            p = draw_plan(st["seed"], form)
            if p["total_lines"] > WALL:
                continue
            L = build_draft(st["seed"], form, p)
            if L is None:
                continue
            if population:
                c = collections.Counter(s["function"] for s in p["sections"])
                st["seen"] |= {f for f, k in c.items() if k >= 2}
            wanted = ({k for k in range(len(MECHANISMS))
                       if k < len(TABLE) or st["hits"][k] < FLOOR}
                      if population else
                      {k for k in range(len(MECHANISMS)) if hits[k] < FLOOR})
            got = [k for k, _L, _t in subjects(st["seed"], form, p, L, wanted)]
            if got or population:
                for k in got:
                    hits[k] += 1
                    st["hits"][k] += 1
                jobs.append((st["seed"], form, got))
            return True

    global _WALK
    if _WALK is not None:
        return _WALK
    for form in FORMS:
        while not need <= state[form]["seen"]:
            if not take(form, True):
                break
    short = [k for k in range(len(MECHANISMS)) if hits[k] < FLOOR]
    while short:
        moved = [take(form, False) for form in FORMS]
        if not any(moved):
            break
        short = [k for k in range(len(MECHANISMS)) if hits[k] < FLOOR]
    _WALK = jobs, hits, {form: state[form]["seed"] for form in FORMS}
    return _WALK


def grade_job(job):
    """-> one plan's verdicts: (seed, form, lines, baseline problems,
    [(mechanism, ok, detail)])."""
    seed, form, wanted = job
    p = draw_plan(seed, form)
    L = build_draft(seed, form, p)
    flags, codes, rows, refused, every0 = grade(p, L)
    names0 = collections.Counter(f.code for _ln, f in every0)
    keys0 = {(f.code, tuple(f.locations)) for _ln, f in every0}
    cls = classes_of(mandate_of(p))
    base = []
    if flags:
        base.append(f"baseline flags {sorted(flags)}")
    if refused:
        base.append(f"baseline refuses {refused} pair(s)")
    if rows.get("function:draft", {}).get("status") == "refused":
        base.append("baseline function:draft refused")
    if codes & PLAN_DEALT:
        base.append(f"baseline carries {sorted(codes & PLAN_DEALT)}")
    out = []
    for k, L2, target in subjects(seed, form, p, L, set(wanted)):
        name, _change, expect = MECHANISMS[k]
        f2, c2, r2, ref2, every = grade(p, L2)
        new = f2 - flags
        names = collections.Counter(f.code for _ln, f in every) - names0
        fresh = [f for _ln, f in every
                 if (f.code, tuple(f.locations)) not in keys0]
        said, memo = [], {}

        def pasted(lines=L2, memo=memo):
            # the changed draft graded once without the plan's key
            if "pasted" not in memo:
                memo["pasted"] = grade(p, lines, pasted=True)
            return memo["pasted"]
        # `grade` and `verify` put the same plan to the grader another way:
        # under another mandate, another draft, or one revision of this one.
        ok = expect(dict(
            new=new, names=names, codes=c2, target=target, rows=r2,
            every=every, fresh=fresh, p=p, cls=cls, lines=L2, said=said,
            pasted=pasted,
            grade=lambda lines=L2, **kw: grade(p, lines, **kw),
            verify=lambda after, targeted, before=L2: verify(
                p, before, after, targeted)))
        shown = target if not isinstance(target, dict) else {
            key: target[key] for key in ("targeted", "pair")}
        out.append((k, ok, f"{form} seed {seed}: new flags {sorted(new)}, "
                    f"new names {dict(sorted(names.items()))}, target {shown}"
                    + "".join(f"; {x}" for x in said)))
    return seed, form, p["total_lines"], base, out


def test_graded_mechanisms():
    print("\n2. GRADED MECHANISMS: each change to a plan-following draft adds "
          "exactly the flags its row names (dealt by TEST_PLAN_SHARD)")
    fams = witnesses()
    apart = [(a, b) for w in fams for i, a in enumerate(w) for b in w[i + 1:]
             if C.ADOPTED_RELATION not in _scored(a, b)["relations"]]
    check(f"the rhyme supply: {len(fams)} families read off the song pair "
          f"census, and the grader's own pair scorer puts every two words of "
          f"a family in the adopted relation ({C.ADOPTED_RELATION})",
          len(fams) >= 2 and not apart, f"not in it: {apart[:6] or 'none'}")
    jobs, hits, last = walk()
    short = [MECHANISMS[k][0] for k in range(len(MECHANISMS))
             if hits[k] < FLOOR]
    check(f"the walk reaches {FLOOR} hits for every mechanism by seed "
          f"{SEED_CAP} per form",
          not short, f"walked to {last}; short: {short or 'none'}")
    print("          hits per mechanism: " + "; ".join(
        f"{MECHANISMS[k][0]} {hits[k]}" for k in range(len(MECHANISMS))))
    mine, kn = dealt(jobs, "TEST_PLAN_SHARD")
    print(f"          {len(jobs)} plans walked, {len(mine)} graded on this "
          f"shard {kn or '(all)'}")
    workers = int(os.environ.get("TEST_PLAN_WORKERS", "0") or 0) or min(
        4, os.cpu_count() or 1)
    if workers > 1 and len(mine) > 1:
        import concurrent.futures as cf
        with cf.ProcessPoolExecutor(max_workers=workers) as ex:
            results = list(ex.map(grade_job, mine))
    else:
        results = [grade_job(j) for j in mine]
    base_bad = [(s, f, b) for s, f, _n, b, _o in results if b]
    check("every graded baseline has no flag, no refused pair, no refused "
          "function row and no answer about a shape the plan dealt",
          not base_bad, f"{base_bad[:6] or 'none'}")
    per = collections.defaultdict(list)
    for _s, _f, _n, _b, out in results:
        for k, ok, detail in out:
            per[k].append((ok, detail))
    for k, (name, _c, expect) in enumerate(MECHANISMS):
        got = per.get(k, [])
        bad = [d for ok, d in got if not ok]
        check(f"{name}: {' '.join(expect.__doc__.split())} "
              f"({len(got)} hit(s) on this shard)",
              not bad, f"{bad[:3] or (got[0][1] if got else 'no hit here')}")


def test_pasted_lyrics():
    print("\n3. PASTED LYRICS: a blueprint without the plan's key is graded as "
          "it always was, but one changed line of a 3+ line class is one flag")
    jobs, _hits, _last = walk()
    k = next(i for i, m in enumerate(MECHANISMS) if m[1] is m_class_first_3)
    seed, form, _g = next(j for j in jobs if k in j[2])
    p = draw_plan(seed, form)
    L = build_draft(seed, form, p)
    planned = grade(p, L)[1] & PLAN_DEALT
    pasted = grade(p, L, pasted=True)[1] & PLAN_DEALT
    check("the same draft keeps the convention's return notes when pasted, "
          "and carries none under its plan",
          bool(pasted) and not planned,
          f"{form} seed {seed}: pasted {sorted(pasted)}, planned "
          f"{sorted(planned)}")
    rng = random.Random(f"{form}:{seed}:{MECHANISMS[k][0]}")
    L2, target = m_class_first_3(p, L, classes_of(mandate_of(p)), rng,
                                 _Spare(L, rng))
    base = grade(p, L, pasted=True)[0]
    new = grade(p, L2, pasted=True)[0] - base
    rnv = {key: v for key, v in new.items() if key[0] == "RETURN_NOT_VERBATIM"}
    check("one changed first line of a 3+ line class is one "
          "RETURN_NOT_VERBATIM on that line, pasted too",
          rnv == {("RETURN_NOT_VERBATIM", target): 1},
          f"{form} seed {seed}: {sorted(rnv.items())}, target {target}")


def song_says(p, lines, pasted=False):
    """-> {(i, j): answer} read off the `song` verb's own DECLARED RETURNS
    list, the command spelled as the plan's GRADE IT line spells it.
    `pasted` hands it the blueprint without the plan's key."""
    bp = P.fill_plan(p, lines)
    if pasted:
        bp.pop("hook_slot_refused")
    with tempfile.TemporaryDirectory() as d:
        bp_path = os.path.join(d, "bp.json")
        draft = os.path.join(d, "draft.txt")
        with open(bp_path, "w", encoding="utf-8") as fh:
            json.dump(bp, fh)
        with open(draft, "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines) + "\n")
        argv = shlex.split(P.grading_command(p, draft, bp_path))
        got = subprocess.run(
            [sys.executable, os.path.join(ROOT, "lyric_harness.py"),
             "--no-instance-evidence"] + argv[2:],
            cwd=ROOT, capture_output=True, text=True)
    return {(int(i), int(j)): word for i, j, word in re.findall(
        r"^\s+L(\d+)~L(\d+): ([A-Z]+)", got.stdout, re.M)}


def test_the_declared_returns_list():
    print("\n4. THE DECLARED-RETURNS LIST: the `song` verb answers each "
          "declared pair of a 3+ line class from the lines themselves")
    jobs, _hits, _last = walk()
    k = next(i for i, m in enumerate(MECHANISMS) if m[1] is m_class_first_3)
    seed, form, _g = random.Random("the declared-returns list").choice(
        [j for j in jobs if k in j[2]])
    p = draw_plan(seed, form)
    L = build_draft(seed, form, p)
    m = mandate_of(p)
    rng = random.Random(f"{form}:{seed}:{MECHANISMS[k][0]}")
    L2, target = m_class_first_3(p, L, classes_of(m), rng, _Spare(L, rng))
    want = {(i, j): ("SATISFIED" if G.normalise_line(L2[i - 1])
                     == G.normalise_line(L2[j - 1]) else "VIOLATED")
            for i, j, _r in m.return_pairs()}
    broken = sorted(pair for pair, word in want.items() if word == "VIOLATED")
    for pasted in (False, True):
        got = song_says(p, L2, pasted=pasted)
        wrong = sorted(pair for pair in want if got.get(pair) != want[pair])
        check("one changed line of a 3+ line class: every pair it is in "
              "reads VIOLATED and every other pair SATISFIED, "
              + ("without the plan's key" if pasted else "under the plan"),
              len(broken) >= 2 and not wrong,
              f"{form} seed {seed}, line {target} changed: {len(want)} "
              f"pair(s), {len(broken)} broken {broken}; wrong: "
              f"{[(pair, got.get(pair)) for pair in wrong] or 'none'}")


def test_recover_writes_no_plan_key():
    print("\n5. THE PASTED DOOR: `recover` never writes the key that says a "
          "song follows a plan")
    from quality import recover as RC
    jobs, _hits, _last = walk()
    picks = random.Random("the pasted door").sample(jobs, FLOOR)
    key, wrote, filled = "hook_slot_refused", [], []
    for seed, form, _g in picks:
        p = draw_plan(seed, form)
        L = build_draft(seed, form, p)
        rec = RC.recover(L, lex=reviser().lex)
        if key in repr(rec) + repr(vars(rec)) + RC.render(rec):
            wrote.append((form, seed))
        filled.append(key in P.fill_plan(p, L))
    check(f"no recovered record of {len(picks)} seeded drafts carries "
          f"`{key}`, and every blueprint `fill_plan` writes for them does",
          not wrote and all(filled),
          f"drafts {[(f, s) for s, f, _g in picks]}; wrote it: "
          f"{wrote or 'none'}")


def _merge_notes_saying_more(k, draws=None):
    """-> each (seed, form, plan, changed lines, copied line, note), seed by
    seed with the forms in turn up to `MERGE_SEED_CAP`, or over `draws`
    ((seed, form) pairs) when given: mechanism `k`'s change gives a
    MANDATE_GROUPS_INDISTINGUISHABLE note, graded without the plan's key,
    that lists a pair with the copied line and a pair without it."""
    if draws is None:
        draws = ((seed, form) for seed in range(1, MERGE_SEED_CAP + 1)
                 for form in FORMS)
    for seed, form in draws:
        p = draw_plan(seed, form)
        if p["total_lines"] > WALL:
            continue
        # a pair without the copied line is two groups heard as one, so
        # this draft's families are let collide
        L = build_draft(seed, form, p, apart=False)
        if L is None:
            continue
        for _k, L2, b in subjects(seed, form, p, L, {k}):
            for _ln, f in grade(p, L2, pasted=True)[4]:
                pairs = _merge_pairs(f)
                if (f.code == "MANDATE_GROUPS_INDISTINGUISHABLE"
                        and any(b in e for e in pairs)
                        and any(b not in e for e in pairs)):
                    yield seed, form, p, L2, b, f


def test_a_merge_note_that_says_more_stands():
    print("\n7. A MERGE NOTE THAT SAYS MORE THAN THE COPY: a note is held only "
          "when everything it says is the copy")
    k = next(i for i, m in enumerate(MECHANISMS)
             if m[2] is _copy_keeps_its_flag)
    if SLOW:
        case = next(_merge_notes_saying_more(k), None)
        check(f"the walk finds a copy ({MECHANISMS[k][0]}) whose merge note "
              f"also lists a pair without the copied line, by seed "
              f"{MERGE_SEED_CAP} per form",
              case is not None,
              f"first found: {case[1]} seed {case[0]}, L{case[4]} the copy, "
              f"groups {case[5].groups} on lines {tuple(case[5].locations)} "
              f"(the default run grades {MERGE_WITNESS} for "
              f"{MERGE_WITNESS_SHAPE})" if case else "")
    else:
        # REPINNED 2026-11-22 (bug hunt F23, R2's word for this file): ~~the
        # walk to `MERGE_SEED_CAP`, by default~~. The walk found this copy at
        # verse-chorus seed 4171 once the joint check refused seed 1586's
        # first draw (TWO_GROUPS_ONE_WORD), about seven more minutes on one
        # process. The witness is still drawn by seed, not picked: the
        # default run grades the walk's own find, and `--slow` walks again.
        # (2026-11-23: the walk's find is open seed 52 now; `MERGE_WITNESS`.)
        case = next(_merge_notes_saying_more(k, [MERGE_WITNESS]), None)
        b, groups, locs = MERGE_WITNESS_SHAPE
        check(f"{MERGE_WITNESS[1]} seed {MERGE_WITNESS[0]}, the walk's first "
              f"copy ({MECHANISMS[k][0]}) whose merge note also lists a pair "
              f"without the copied line, still offers it: L{b} the copy, "
              f"groups {', '.join(groups)} on lines {list(locs)}",
              case is not None and case[4] == b
              and tuple(case[5].groups) == groups
              and tuple(case[5].locations) == locs,
              f"L{case[4]} the copy, groups {case[5].groups} on lines "
              f"{tuple(case[5].locations)}; re-find with --slow" if case
              else "no such note on that seed; re-find it with --slow")
    if case is None:
        return
    seed, form, p, L2, b, f = case
    other = [e for e in _merge_pairs(f) if b not in e]
    g = next((g for _ln, g in grade(p, L2)[4]
              if (g.code, tuple(g.locations)) == (f.code, tuple(f.locations))),
             None)
    kept = _merge_pairs(g) if g is not None else []
    check("under the plan that merge note stands, and still lists each of "
          "its pairs that are not the copy's",
          g is not None and all(e in kept for e in other),
          f"{form} seed {seed}: L{b} is the copy; groups {f.groups} on lines "
          f"{tuple(f.locations)}, its pairs without L{b} {other}; under the "
          f"plan: " + (f"stands, listing {kept}" if g is not None
                       else "held"))


def _plan_job(src):
    """-> the text of ci.yml's `plan` job."""
    found = re.search(r"^  plan:\n(.*?)(?=^  [A-Za-z][\w-]*:\n)", src,
                      re.M | re.S)
    return found.group(1) if found else ""


def test_the_ci_wiring():
    print("\n6. CI: the plan job runs this file before test_plan, and the "
          "sections that are not dealt inside run on one shard each")
    with open(os.path.join(ROOT, "..", ".github", "workflows", "ci.yml"),
              encoding="utf-8") as fh:
        job = _plan_job(fh.read())
    runs = [ln.strip() for ln in job.splitlines()
            if ln.strip().startswith("run: python3 quality/test_")]
    mine = "run: python3 quality/test_return_plan.py"
    plan = "run: python3 quality/test_plan.py"
    check("the plan job runs test_return_plan once, and before test_plan: a "
          "shard whose test_plan share runs out of time has graded its "
          "plans here first",
          runs.count(mine) == 1 and runs.count(plan) == 1
          and runs.index(mine) < runs.index(plan), f"{runs}")
    shards = re.search(r"TEST_PLAN_SHARD: \$\{\{ matrix\.shard \}\}/(\d+)",
                       job)
    n = int(shards.group(1)) if shards else 0
    env = "TEST_RETURN_PLAN_DEAL"
    on = collections.defaultdict(list)
    for k in range(1, n + 1):
        os.environ[env] = f"{k}/{n}"
        for fn in dealt(DEALT, env)[0]:
            on[fn.__name__].append(k)
    os.environ.pop(env, None)
    check(f"over the plan job's {n} shards each dealt section runs on one "
          f"shard, the data guards on the last, and the graded mechanisms "
          f"deal their own plans on every shard",
          n >= 1 and all(len(on[fn.__name__]) == 1 for fn in DEALT)
          and on["test_data_guards"] == [n]
          and ALWAYS == (test_graded_mechanisms,),
          f"{dict(on)}")


#: Runs on every shard: it deals its own plans by `TEST_PLAN_SHARD`.
ALWAYS = (test_graded_mechanisms,)
#: Dealt whole, one shard each (`quality.shard`). The data guards are the
#: slowest of these (two minutes, no grading) and stand fifth, so over the
#: plan job's five shards they land on the fifth. The sixth lands on shard 1
#: beside the first, and shard 1's `test_plan` share is the longest, so the
#: two cheapest sections stand first and sixth.
DEALT = (test_the_ci_wiring, test_a_merge_note_that_says_more_stands,
         test_the_declared_returns_list, test_recover_writes_no_plan_key,
         test_data_guards, test_pasted_lyrics)


if __name__ == "__main__":
    from quality.shard import run_sections
    sys.exit(run_sections(DEALT, "TEST_PLAN_SHARD", FAILURES,
                          footer="all return-plan checks pass",
                          always=ALWAYS))
