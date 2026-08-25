"""The narrative vocabulary and the story line-up counter — step 4's
standalone half.

STATUS: RULED 2026-08-25. The owner delegated the five §F rulings to
this session in their own words; the rulings and their reasons are
recorded in `quality/NARRATIVE_DESIGN.md` §F and `MISSING.md` M-121.
THIS MODULE is the one definition and the design document is the
argument for it (doctrine 1: two spellings of one table is how
registers start disagreeing) — a later ruling edits a row HERE and the
tests re-derive.

WHAT THIS ANSWERS, and only this: given an emitted plan's SHAPE — the
ordered section functions, nothing about words — which assignments of
one narrative atom per sung section and one junction per adjacent seam
form a legal story line-up, how many there are (exactly), and whether
there are any at all. A shape that admits nothing is a finding, not an
error.

ENCODED vs PROSE-ONLY. The design doc's violate-it clauses split: three
are encoded here as position/prefix rules (a TURN cannot open — nothing
precedes it to flip; a JUDGE cannot open — nothing has happened; a
RESOLVE requires a PRIOR COMPLICATE), one as a seam rule (a returning
instance back-to-back with its own prior instance may not take an
inbound BUT — no intervening material, nothing re-lit the card:
`NARRATIVE_DESIGN.md` §D, whose corpus rate `narrative_bands` measured
at 0.0048), and the rest stay prose because encoding them would mean
reading MEANING, which no gate here may do (doctrine 6). The doc's §C
"any" cells compose with the TURN rule: TURN appears in exactly the
BUT and JUXTAPOSE enter sets (softened from BUT-only by ruling — see
the ENTER table's own comment), so "any" reads "any except as the TURN
rule narrows".

WORDLESS AND ATOMLESS SECTIONS are transparent to the atom sequence and
OPAQUE to adjacency: an interlude carries no lyric atom (a lyric layer
refuses to assign one — doctrine 20) but it IS intervening material, so
two choruses flanking an instrumental are not back-to-back. The same
treatment covers `turnaround` (the design doc's own finding: a junction
wearing a section mark, not an atom-carrier).

COUNTING is exact over big integers with no enumeration blow-up: the
invariant-return card choices are enumerated (few), and each choice is
counted by a linear pass over the sung sequence whose state is (current
atom, complicate-seen), transition weight = the number of legal inbound
junctions for the atom pair at that seam. Deterministic by construction
(doctrine 66): no RNG, sorted iteration only.
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

ATOMS = ("ESTABLISH", "COMPLICATE", "TURN", "DWELL",
         "ANCHOR", "JUDGE", "RESOLVE", "DEPART")

#: NARRATIVE_DESIGN.md §B, one row per section function. Empty tuple =
#: atomless (transparent-but-intervening). RULED (M-121): `drop` is
#: ANCHOR alone — the "arrival" quality lives in its inbound edge, not
#: a second face; `breakdown` stays DWELL; `reprise` stays ANCHOR with
#: its "changed" half owned by grid's reprise machinery, not respelled
#: here.
FUNCTION_ATOMS = {
    "verse": ("ESTABLISH", "COMPLICATE", "TURN", "JUDGE", "RESOLVE"),
    "chorus": ("ANCHOR",),
    "prechorus": ("COMPLICATE", "DWELL"),
    "postchorus": ("DWELL", "JUDGE"),
    "bridge": ("TURN",),
    "intro": ("ESTABLISH",),
    "outro": ("DEPART",),
    "coda": ("RESOLVE", "DEPART", "JUDGE"),
    "build": ("COMPLICATE",),
    "drop": ("ANCHOR",),
    "vamp": ("DWELL",),
    "breakdown": ("DWELL",),
    "false_ending": ("RESOLVE",),
    "tag": ("JUDGE",),
    "hook": ("ANCHOR",),
    "refrain": ("ANCHOR",),
    "burden": ("ANCHOR",),
    "reprise": ("ANCHOR",),
    "turnaround": (),
    "interlude": (),
    "solo": (),
}

JUNCTIONS = ("THEREFORE", "BUT", "AND_THEN",
             "MEANWHILE", "ELABORATE", "JUXTAPOSE")

#: NARRATIVE_DESIGN.md §C — which atoms each junction may ENTER. TURN
#: appears in exactly TWO sets (BUT and JUXTAPOSE): the draft's hard
#: rule was TURN-only-by-BUT, and the ruling SOFTENED it (M-121) on the
#: kishotenketsu witness — the `ten` is a turn entered by juxtaposition,
#: not opposition, and a rule that deletes that family must relabel
#: instead (doctrine 24). THEREFORE and AND_THEN stay excluded: a turn
#: caused by the last section is consequence, and "and then everything
#: changed" is the unearned reversal. Held structurally, so the
#: mutation is one membership edit and the killing test one check.
ENTER = {
    "THEREFORE": ("ESTABLISH", "COMPLICATE", "DWELL", "ANCHOR",
                  "JUDGE", "RESOLVE", "DEPART"),
    "BUT": ("TURN", "ANCHOR", "RESOLVE", "DEPART"),
    "AND_THEN": ("ESTABLISH", "COMPLICATE", "DWELL", "ANCHOR",
                 "JUDGE", "RESOLVE", "DEPART"),
    "MEANWHILE": ("ESTABLISH", "DWELL"),
    "ELABORATE": ("DWELL", "JUDGE"),
    "JUXTAPOSE": ("ESTABLISH", "COMPLICATE", "TURN", "DWELL",
                  "ANCHOR", "JUDGE", "RESOLVE", "DEPART"),
}

#: The functions whose TEXT returns, so their instances share ONE card
#: (NARRATIVE_DESIGN.md §D). Declared, not derived from recurrence,
#: because `verse` also declares recurrence "returns" — with NEW WORDS,
#: its own gloss — and is exactly the function the card rule must NOT
#: bind. Red-pennable like every roster here.
INVARIANT_RETURNS = ("burden", "chorus", "drop", "hook",
                     "postchorus", "refrain", "tag")


class NarrativeRefused(Exception):
    """A shape this vocabulary cannot read — an unknown function. A
    refusal, never a silent skip (doctrine 20)."""


def sung_sequence(functions):
    """-> (positions, funcs) of the atom-carrying sections, in order.

    `functions` is the plan's ordered section-function list. Atomless
    rows are dropped from the SEQUENCE and remembered by the gap they
    leave: adjacency below is judged on original indices, so an
    atomless section keeps its neighbours apart (intervening material).
    """
    pos, fns = [], []
    for i, fn in enumerate(functions):
        if fn not in FUNCTION_ATOMS:
            raise NarrativeRefused(
                f"'{fn}' is not in the narrative vocabulary — "
                f"declared rows: {', '.join(sorted(FUNCTION_ATOMS))}")
        if FUNCTION_ATOMS[fn]:
            pos.append(i)
            fns.append(fn)
    return pos, fns


def _candidates(fn, first, card):
    """Atom candidates for one section instance under the position
    rules: TURN and JUDGE cannot open the song (their own violate-it
    clauses), and an invariant-return instance is pinned to its card."""
    if card is not None:
        base = (card,)
    else:
        base = FUNCTION_ATOMS[fn]
    if first:
        base = tuple(a for a in base if a not in ("TURN", "JUDGE"))
    return base


def _seam_weight(prev_atom, atom, back_to_back_return):
    """How many junctions may ENTER `atom` at this seam. The §D rule:
    a returning instance adjacent to its own prior instance (nothing
    intervening) may not be entered by BUT — nothing re-lit the card."""
    n = 0
    for j in JUNCTIONS:
        if atom not in ENTER[j]:
            continue
        if j == "BUT" and back_to_back_return:
            continue
        n += 1
    return n


def _card_combos(fns):
    inv_fns = sorted({f for f in fns if f in INVARIANT_RETURNS})

    def rec(i):
        if i == len(inv_fns):
            yield {}
            return
        for atom in FUNCTION_ATOMS[inv_fns[i]]:
            for rest in rec(i + 1):
                out = dict(rest)
                out[inv_fns[i]] = atom
                yield out
    return rec(0)


def _b2b(fns, pos, k):
    return (fns[k] in INVARIANT_RETURNS and fns[k - 1] == fns[k]
            and pos[k] - pos[k - 1] == 1)


def _dp_forward(fns, pos, cards):
    """-> per-position state dicts {(atom, complicate_seen): count}, or
    None if the sequence dies. The ONE dynamic pass count, draw and
    validation all read (doctrine 1)."""
    st = {}
    for a in _candidates(fns[0], True, cards.get(fns[0])):
        if a == "RESOLVE":
            continue
        key = (a, a == "COMPLICATE")
        st[key] = st.get(key, 0) + 1
    states = [st]
    for k in range(1, len(fns)):
        b2b = _b2b(fns, pos, k)
        nxt = {}
        for a in _candidates(fns[k], False, cards.get(fns[k])):
            for (prev, seen), cnt in states[-1].items():
                if a == "RESOLVE" and not seen:
                    continue
                w = _seam_weight(prev, a, b2b)
                if not w:
                    continue
                key = (a, seen or a == "COMPLICATE")
                nxt[key] = nxt.get(key, 0) + cnt * w
        if not nxt:
            return None
        states.append(nxt)
    return states


def count_lineups(functions):
    """-> exact number of legal story line-ups for this shape.

    Sum over invariant-return card choices of a linear dynamic count
    whose state is (atom at the current section, complicate-seen).
    RESOLVE is admitted only when a COMPLICATE stands somewhere before
    it (its violate-it clause, encoded as the prefix flag).
    """
    pos, fns = sung_sequence(functions)
    if not fns:
        return 0
    total = 0
    for cards in _card_combos(fns):
        states = _dp_forward(fns, pos, cards)
        if states:
            total += sum(states[-1].values())
    return total


def admits(functions):
    """-> bool: does this shape carry at least one story line-up?"""
    return count_lineups(functions) > 0


def draw_lineup(functions, rng):
    """-> {"atoms": [...], "junctions": [...]} drawn UNIFORM over the
    legal line-ups, or None when the shape admits none.

    Uniformity is exact, not approximate: the card combo is picked with
    probability proportional to its own line-up count, the atom path is
    backward-sampled through the same forward pass the counter uses,
    and each seam's junction is drawn uniform over the junctions legal
    for that atom pair. `atoms` is [[section_index, function, atom]]
    over the SUNG sections; `junctions` is [[from_index, to_index,
    junction]] over their seams. Deterministic given the rng state.
    """
    pos, fns = sung_sequence(functions)
    if not fns:
        return None
    weighted = []
    for cards in _card_combos(fns):
        states = _dp_forward(fns, pos, cards)
        if states:
            weighted.append((cards, states, sum(states[-1].values())))
    total = sum(w for _, _, w in weighted)
    if not total:
        return None
    pick = rng.randrange(total)
    for cards, states, w in weighted:
        if pick < w:
            break
        pick -= w
    # backward-sample the atom path
    atoms = [None] * len(fns)
    keys = sorted(states[-1])
    acc = rng.randrange(sum(states[-1].values()))
    for key in keys:
        if acc < states[-1][key]:
            break
        acc -= states[-1][key]
    atoms[-1], seen = key
    for k in range(len(fns) - 1, 0, -1):
        b2b = _b2b(fns, pos, k)
        a = atoms[k]
        opts = []
        for (prev, seen_prev), cnt in sorted(states[k - 1].items()):
            if (seen_prev or a == "COMPLICATE") != seen:
                continue
            if a == "RESOLVE" and not seen_prev:
                continue
            w2 = _seam_weight(prev, a, b2b)
            if w2:
                opts.append(((prev, seen_prev), cnt * w2))
        acc = rng.randrange(sum(w2 for _, w2 in opts))
        for (prev, seen_prev), w2 in opts:
            if acc < w2:
                break
            acc -= w2
        atoms[k - 1], seen = prev, seen_prev
    junctions = []
    for k in range(1, len(fns)):
        b2b = _b2b(fns, pos, k)
        legal = [j for j in JUNCTIONS if atoms[k] in ENTER[j]
                 and not (j == "BUT" and b2b)]
        junctions.append([pos[k - 1], pos[k],
                          legal[rng.randrange(len(legal))]])
    return {"atoms": [[pos[k], fns[k], atoms[k]]
                      for k in range(len(fns))],
            "junctions": junctions}


def validate_lineup(functions, atoms, junctions):
    """-> [] if the declared line-up is legal, else the problems, each
    a sentence. The ONE validator the declared route and the tests
    share — a declared narrative is carried, never resampled, and an
    illegal one is refused by name (doctrine 20)."""
    pos, fns = sung_sequence(functions)
    problems = []
    if len(atoms) != len(fns):
        return [f"{len(atoms)} atom(s) declared over {len(fns)} sung "
                f"section(s) — the line-up must cover each exactly once"]
    if len(junctions) != max(0, len(fns) - 1):
        return [f"{len(junctions)} junction(s) declared over "
                f"{len(fns) - 1} seam(s)"]
    cards = {}
    seen = False
    for k, entry in enumerate(atoms):
        atom = entry[2] if isinstance(entry, (list, tuple)) else entry
        fn = fns[k]
        if atom not in FUNCTION_ATOMS[fn]:
            problems.append(f"section {k + 1} ({fn}) cannot carry {atom} "
                            f"— its faces are "
                            f"{', '.join(FUNCTION_ATOMS[fn])}")
            continue
        if k == 0 and atom in ("TURN", "JUDGE"):
            problems.append(f"{atom} cannot open the song — its own "
                            f"violate-it clause")
        if atom == "RESOLVE" and not seen:
            problems.append(f"section {k + 1} RESOLVE has no prior "
                            f"COMPLICATE to cash")
        if fn in INVARIANT_RETURNS:
            if fn in cards and cards[fn] != atom:
                problems.append(f"'{fn}' instances split their card "
                                f"({cards[fn]} vs {atom}) — one card, "
                                f"many edges (§D)")
            cards.setdefault(fn, atom)
        seen = seen or atom == "COMPLICATE"
        if k:
            j = junctions[k - 1]
            j = j[2] if isinstance(j, (list, tuple)) else j
            if j not in JUNCTIONS:
                problems.append(f"'{j}' is not a junction — declared: "
                                f"{', '.join(JUNCTIONS)}")
            elif atom not in ENTER[j]:
                problems.append(f"{j} cannot enter {atom} at section "
                                f"{k + 1}")
            elif j == "BUT" and _b2b(fns, pos, k):
                problems.append(f"section {k + 1} ({fn}) is back-to-back "
                                f"with its own prior instance — no "
                                f"intervening material, so BUT is refused "
                                f"(§D; the corpus runs this shape at "
                                f"0.0048)")
    return problems


def main(argv):
    """Probe one seed's shape: `python3 quality/narrative.py --seed=N`.
    Imports the planner lazily — the module itself must stay importable
    BY the planner without a cycle when step 4's wired half lands."""
    seed = None
    for a in argv:
        if a.startswith("--seed="):
            seed = int(a.split("=", 1)[1])
    if seed is None:
        print("usage: narrative.py --seed=N")
        return 2
    from quality import plan as P
    pl = P.make_plan(seed)
    fns = [s["function"] for s in pl["sections"]]
    n = count_lineups(fns)
    print(f"seed {seed}: sections {fns}")
    print(f"  story line-ups: {n}   admits: {n > 0}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
