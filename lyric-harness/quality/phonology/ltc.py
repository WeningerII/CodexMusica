#!/usr/bin/env python3
"""Middle Chinese — 律詩 regulated verse. Cheap because it is not G2P at all.

One character is one syllable, so there is nothing to syllabify, and the sound
classes are **lexicalised in a rime dictionary**. Rhyme is a lookup.

WHY MIDDLE CHINESE AND NOT MANDARIN

Tang and Song regulated verse rhymes in the phonology of its own period. Modern
Mandarin lost the 入聲 entering tone entirely and merged rhyme classes wholesale,
so a Mandarin reading of a Tang rhyme is not a register mismatch in the way
`frequency.py` documents for word counts -- it is simply the wrong language for
the question, and it would silently report genuine rhymes as failures.

`data/qieyun_mc.tsv` is extracted from the nk2028 Qieyun dataset, **CC0 1.0**
(public-domain dedication), which clears the provenance gate on the express-
affirmation route. 19,499 characters, 25,322 readings, 0 unparsed. It is
committed as a file rather than taken as a runtime dependency, the same choice
`data/authority.tsv` made and for the same reason: auditability.

WHAT THE FORM MANDATES

Regulated verse fixes two things positionally, and both are read from the same
table:

  rhyme  even-numbered lines rhyme; line 1 optionally. The rhyme category is
         (韻, 聲) -- a rhyme group within a tone.
  tone   a 平/仄 template across each line, where 平 is the level tone and 仄
         is everything else (上去入).

So `prominence` here carries the 平/仄 binary, because that is the contrast the
form's template actually constrains. It is not stress; Chinese has none.
"""

import os
import sys

from quality.phonology import Phonology, Syllable, register

HERE = os.path.dirname(os.path.abspath(__file__))
TABLE = os.path.join(HERE, "..", "..", "data", "qieyun_mc.tsv")

#: 平 is level; 上去入 are collectively 仄 (oblique). This binary, not stress,
#: is what the regulated-verse template constrains.
LEVEL = "平"

#: 同用 GROUPING — the load-bearing table, and the reason a raw rime-dictionary
#: lookup gets Tang verse WRONG.
#:
#: The Qieyun distinguishes 193 rhymes, which is finer than poets ever worked
#: to. Tang practice authorised 同用 ("use together") groupings and later
#: 平水韻 collapsed them to ~106. Without this, 流 (尤) and 樓 (侯) come out as
#: NOT rhyming -- and they are the rhyme of 登鸛雀樓, one of the best known
#: poems in the language. Rhyme identity at the 韻 level is simply the wrong
#: granularity for the form.
#:
#: PROVENANCE: encoded here from the standard 平水韻 groupings. This is a
#: historical fact table rather than a creative work, so nothing is licensed --
#: but it is written from knowledge rather than parsed from a sourced edition,
#: so it is VALIDATED against known regulated verse in quality/test_phonology.py
#: rather than trusted. A grouping that gets a canonical poem wrong is a bug in
#: this table, and the test is what says so.
RHYME_GROUP_SOURCE = ("standard 平水韻 groupings, encoded from knowledge and "
                      "validated against canonical regulated verse; not parsed "
                      "from a sourced edition")
_GROUPS = [
    "東", "冬鍾", "江", "支脂之", "微", "魚", "虞模", "齊", "佳皆", "灰咍",
    "眞諄臻真", "文欣殷", "元魂痕", "寒桓", "刪山", "先仙", "蕭宵", "肴", "豪",
    "歌戈", "麻", "陽唐", "庚耕清", "青", "蒸登", "尤侯幽", "侵", "覃談",
    "鹽添嚴", "咸銜凡",
]
#: 韻 -> its 同用 group representative. Any rhyme absent from the table is its
#: own group, which is the conservative default: it can only make the checker
#: stricter, never looser.
GROUP_OF = {r: g[0] for g in _GROUPS for r in g}


def _load():
    out = {}
    if not os.path.exists(TABLE):
        return out
    with open(TABLE, encoding="utf-8") as fh:
        next(fh, None)
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 6:
                continue
            ch, initial, openness, division, rhyme, tone = parts
            out.setdefault(ch, []).append(
                {"initial": initial, "openness": openness,
                 "division": division, "rhyme": rhyme, "tone": tone})
    return out


class MiddleChinese(Phonology):
    language = "ltc"
    name = "Middle Chinese (切韻 system)"
    notation = "rime-dictionary categories, not a phonetic transcription"
    grid_unit = "syllable"
    prominence_rule = "平 (level) = 1, 仄 (上去入, oblique) = 0. NOT stress."
    relation = "rhyme category = (韻 rhyme group, 聲 tone)"
    source = ("data/qieyun_mc.tsv, extracted from nk2028/qieyun-python, "
              "CC0 1.0 public-domain dedication; 同用 grouping encoded here "
              "and validated against canonical verse")

    def __init__(self):
        self._t = _load()

    def readings(self, ch):
        return self._t.get(ch)

    def syllabify(self, word):
        """One character, one syllable. A character with several readings is
        ambiguous and every reading is kept -- the first is returned here and
        `readings()` exposes the rest."""
        out = []
        for ch in word:
            rs = self._t.get(ch)
            if not rs:
                out.append(Syllable(ch, (), "", (), None, 1))
                continue
            r = rs[0]
            out.append(Syllable(ch, (r["initial"],), r["rhyme"], (),
                                1 if r["tone"] == LEVEL else 0, 1))
        return out

    def tone_class(self, ch):
        """-> 1 for 平, 0 for 仄, None if unknown. Never a guess: a character
        absent from the rime book must not fall back to Mandarin."""
        rs = self._t.get(ch)
        if not rs:
            return None
        vals = {1 if r["tone"] == LEVEL else 0 for r in rs}
        return vals.pop() if len(vals) == 1 else None   # ambiguous -> unknown

    def rhyme_keys(self, ch, grouped=True):
        """-> {(rhyme, tone)}. With `grouped`, the rhyme is its 同用 group,
        which is the granularity the FORM works at; without it, the raw
        rime-dictionary class, which is finer than any poet used."""
        rs = self._t.get(ch)
        if not rs:
            return None
        return {(GROUP_OF.get(r["rhyme"], r["rhyme"]) if grouped
                 else r["rhyme"], r["tone"]) for r in rs}

    def rhymes(self, a, b, grouped=True):
        ka = self.rhyme_keys(a[-1] if a else "", grouped)
        kb = self.rhyme_keys(b[-1] if b else "", grouped)
        if ka is None or kb is None:
            return None
        return bool(ka & kb)

    def coverage(self, text):
        """-> (known, total) characters. Reported so a caller can see how much
        of an item the table actually reads before trusting any number."""
        chars = [c for c in text if "一" <= c <= "鿿"]
        return sum(1 for c in chars if c in self._t), len(chars)


register(MiddleChinese())
