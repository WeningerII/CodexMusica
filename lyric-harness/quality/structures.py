#!/usr/bin/env python3
"""The structure catalog: what a mandated group can DEMAND, as declared rows.

THE OWNER'S QUESTION (2026-08-18): the grader's door admitted two relation
names out of a 601-entry world survey. The scalable answer is not a longer
admit list — most of the world's structures are not different VERDICTS at
the end-of-line anchor, they are different QUESTIONS: different anchors
(kalevala alliteration reads word onsets), different places (a dróttkvætt
hending pairs syllables inside one line), different channel demands (proest
wants the coda to agree and the vowel to differ). So a structure is a ROW
in this table, a mandate names a row per group, and the grader routes each
mandated pair through its row's judge. Adding a structure is transcribing a
row, never writing code — that is what makes the 601 a destination instead
of a wish (quality/RHYME_CANON.md carries them on eight declared
coordinates for exactly this reason).

THREE KINDS OF ROW, one judge contract (`judge(a, b) -> True/False/None`,
None = the phonology declined and the pair is REFUSED, not failed):

- "comparator" — the sentinel row, `english-end-rhyme`. Judged by the
  scalar comparator plus `Declaration.admit`, in `grade()`, NOT here: the
  scalar path owns thresholds, the conjunctive band and the admit set, and
  a second implementation of it in this module would drift (doctrine 48).
  Its `judge` REFUSES loudly so no caller can route around `grade()`.
- "preset" — a named anchor-pair + channel demand from
  `quality/rhyme_types.PRESETS` (dróttkvætt hendings, cynghanedd llusg,
  Kalevala alliteration...). Judged by `rhyme_types.verdict(a, b, phon,
  preset=name)` — the same call the `types` verb makes, no private
  re-implementation.
- "cell" — one of the named coordinates of the axis space
  (`rhyme_types.NAMED`): masculine rhyme (= qafiya = antya-prāsa),
  pararhyme, assonance... Judged by classifying the pair at the cell's own
  anchors and asking whether the DEMANDED channels agree — the compilation
  rule below.

THE CELL COMPILATION RULE, declared because it is a reading of the axis
system and not a fact inside it: a pair SATISFIES a cell when (1) the
phonology reads both members at the cell's anchors, (2) every channel the
cell's pattern DEMANDS (the 1s, per syllable position) agrees, and (3) the
cell's identity axis holds ('distinct' refuses rime riche and repeats,
'rich' demands full identity with distinct words). Channels the pattern
leaves at 0 are UNCONSTRAINED — a masculine rhyme does not care what the
onsets do; 'distinct' is what refuses the identical word. Axes the cell
inherits from the default frame (stress alignment, boundary, length) are
not re-checked: the classifier already applied them in reading the pair.

Every row carries the world's own ALIASES for its coordinate (masculine
rhyme IS qafiya IS antya-prāsa), so a mandate can be declared in any
tradition's vocabulary and resolve to one row.
"""

import os
import sys
from dataclasses import dataclass

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

__all__ = ["STRUCTURES", "Structure", "StructureRefused", "get",
           "resolve", "judge", "names", "DEFAULT"]

#: The sentinel row's name — the structure every undeclared group has.
DEFAULT = "english-end-rhyme"


class StructureRefused(Exception):
    """The catalog declines: unknown name, or a judge asked to answer a
    question that belongs to another layer."""


@dataclass(frozen=True)
class Structure:
    name: str
    kind: str                 # "comparator" | "preset" | "cell"
    aliases: tuple = ()
    cell: tuple = ()          # the axis key, kind == "cell" only
    doc: str = ""

    def judge(self, a, b, phon=None):
        """-> True / False / None (None = REFUSED: the phonology declined
        a member; a refusal is not a failure and not a pass)."""
        from quality import rhyme_types as RT
        from quality import phonology as PH
        phon = phon or PH.get("eng")
        if self.kind == "comparator":
            raise StructureRefused(
                f"{self.name} is judged by the scalar comparator and the "
                f"declared admit set inside grade(), not by the catalog — "
                f"routing it here would give the default two "
                f"implementations that drift (doctrine 48).")
        if self.kind == "preset":
            try:
                t = RT.classify_pair(a, b, phon, preset=self.name)
            except RT.Indeterminate:
                # e.g. a fixed-index anchor with no referent in a
                # one-syllable member: the QUESTION has no coordinates in
                # this pair, which is a refusal, never a failure.
                return None
            if t is None:
                return None
            # THE PRESET'S OWN DEMAND, not the generic rhyme predicate:
            # `channel_verdict` is always nucleus+coda by declaration, and
            # a skothending demands the CODA alone — asking the generic
            # question of it fails pairs the tradition accepts. `realises`
            # is the select-aware read the classifier already carries.
            select = RT.PRESETS[self.name][2]
            return t.realises(*select)
        # kind == "cell": classify at the cell's own anchors, then apply
        # the compilation rule.
        pattern, identity = self.cell[0], self.cell[1]
        anchor_a, anchor_b = self.cell[7], self.cell[8]
        try:
            t = RT.classify_pair(a, b, phon, anchor_a=anchor_a,
                                 anchor_b=anchor_b)
        except RT.Indeterminate:
            return None
        if t is None:
            return None
        if identity == "distinct" and t.identity in ("rich", "same_word"):
            return False
        if identity == "rich" and t.identity != "rich":
            return False
        got = t.agreement
        if len(got) < len(pattern):
            return False
        # demanded syllables count from the anchor forward; agreement rows
        # are index-aligned with the classified span.
        for want, have in zip(pattern, got):
            for w, h in zip(want, have):
                if w and h is None:
                    return None       # a demanded channel was unreadable
                if w and not h:
                    return False
        return True


def _build():
    from quality import rhyme_types as RT
    rows = {}

    def add(s):
        if s.name in rows:
            raise StructureRefused(f"duplicate structure name {s.name!r}")
        rows[s.name] = s

    add(Structure(
        name=DEFAULT, kind="comparator",
        aliases=("end-rhyme", "perfect-end-rhyme"),
        doc="the default: last primary stress to line end, scalar + "
            "conjunctive band + Declaration.admit — grade()'s own path"))
    for name in RT.PRESETS:
        if name == DEFAULT:
            continue
        add(Structure(
            name=name, kind="preset",
            doc=f"rhyme_types.PRESETS[{name!r}]: a declared anchor pair "
                f"and channel demand, judged by RT.verdict"))
    # Phase B: every NAMED coordinate of the axis space, under every alias
    # the world gave it. The first alias is the row name; the rest resolve.
    for cell_key, alias_tuple in RT.NAMED.items():
        if not alias_tuple:
            # a coordinate registered without a name — the space is larger
            # than the vocabulary, and an unnamed point cannot be MANDATED
            # by name, so it is not a row (it stays reachable through the
            # axis system itself).
            continue
        primary = alias_tuple[0].replace(" ", "-")
        if primary in rows:
            # Two cells can share a headline name at different coordinates
            # (e.g. spans); the coordinate disambiguates the row name.
            primary = f"{primary}-{len(rows)}"
        add(Structure(
            name=primary, kind="cell",
            aliases=tuple(x.replace(" ", "-") for x in alias_tuple[1:]),
            cell=cell_key,
            doc=f"axis coordinate named {', '.join(alias_tuple)}"))
    return rows


STRUCTURES = _build()

_ALIAS = {}
for _s in STRUCTURES.values():
    for _a in _s.aliases:
        # first declaration wins; a collision is disclosed by resolve()
        _ALIAS.setdefault(_a, _s.name)


def names():
    return list(STRUCTURES)


def resolve(name):
    """A name or world alias -> the canonical row name, or a refusal
    naming the declared vocabulary's size."""
    key = str(name).strip().replace(" ", "-")
    if key in STRUCTURES:
        return key
    if key in _ALIAS:
        return _ALIAS[key]
    raise StructureRefused(
        f"{name!r} is not a declared structure or alias — the catalog "
        f"holds {len(STRUCTURES)} structures and {len(_ALIAS)} aliases; "
        f"`quality/structures.py names()` lists them. An unknown name is "
        f"refused, never defaulted (doctrine 20).")


def get(name):
    return STRUCTURES[resolve(name)]


def judge(name, a, b, phon=None):
    """Judge one pair under one declared structure, by name or alias."""
    return get(name).judge(a, b, phon=phon)


if __name__ == "__main__":
    import sys
    sys.path.insert(0, ".")
    print(f"the catalog: {len(STRUCTURES)} declared structures "
          f"({sum(1 for s in STRUCTURES.values() if s.kind == 'preset')} "
          f"presets, "
          f"{sum(1 for s in STRUCTURES.values() if s.kind == 'cell')} "
          f"axis cells, 1 comparator sentinel), "
          f"{len(_ALIAS)} world aliases")
    for s in list(STRUCTURES.values())[:14]:
        al = f"  (= {', '.join(s.aliases)})" if s.aliases else ""
        print(f"  {s.kind:>10}  {s.name}{al}")
