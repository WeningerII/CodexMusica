#!/usr/bin/env python3
"""Middle Chinese — 詩 and 詞. Cheap because it is not G2P at all.

One character is one syllable, so there is nothing to syllabify, and the sound
classes are **lexicalised in a rime dictionary**. Rhyme is a lookup.

WHY MIDDLE CHINESE AND NOT MANDARIN

Tang and Song verse rhymes in the phonology of its own period. Modern Mandarin
lost the 入聲 entering tone entirely and merged rhyme classes wholesale, so a
Mandarin reading of a Tang rhyme is not a register mismatch in the way
`frequency.py` documents for word counts -- it is simply the wrong language for
the question, and it would silently report genuine rhymes as failures.

`data/qieyun_mc.tsv` is extracted from the nk2028 Qieyun dataset, **CC0 1.0**
(public-domain dedication), which clears the provenance gate on the express-
affirmation route. 19,499 characters, 25,322 readings, 0 unparsed. It is
committed as a file rather than taken as a runtime dependency, the same choice
`data/authority.tsv` made and for the same reason: auditability. **It is not
modified by this module**; the two tables below sit beside it so the CC0
original stays byte-identical and re-derivable.

CORRECTION 2026-08-11, and the docstring was wrong about its own data: the
shipped table holds 58 rhyme labels x 4 tones -- the 廣韻's 206 system counted
by 韻系 -- not the 193 rhymes of the Qieyun this file used to cite. 193 was
never the number in the file.

THE STANDARD IS A DECLARED COORDINATE
=====================================

Doctrine 36 says a rime dictionary is finer than any poet worked to, and this
module has always applied the 平水韻 同用 grouping for that reason. What it
never said is that 平水韻 is the standard for **詩**, and it was being used on
**詞**, where the standard is 詞林正韻 -- a coarser partition that merges 上
with 去 inside a 部 and holds the five 入聲 部 apart.

Scored against the 欽定詞譜 of 1715, the tradition's own spec (doctrine 62), at
the 1,844 positions it marks 韻/叶 across 413 of the admitted 花間集's 500
songs: the 詩 standard is True on **78.4%** and the 詞 standard on **94.0%**,
against a matched control of 1.3% and 3.4% at the 537 line ends the same spec
marks 句. MISSING M-1 reports 47.4% on 1,518 later ci; that corpus was refused
on an express non-commercial grant (doctrine 85) and the two numbers are NOT
comparable -- different century of the form, different pair construction. What
replicates is the direction, the control gap, and the 韻 pairs that fail.
`quality/test_ltc.py` runs the whole measurement. All four of those rates are
`overlap='any'` rates -- see THE OVERLAP OVER READINGS below; under `'settled'`
they read 67.6% and 91.2% against 0.4% and 0.6%, so the 詞-over-詩 gap WIDENS
from 15.6 to 23.6 pp when the unsettled overlaps are refused rather than
granted. The choice of standard is not an artefact of the fold.

So `standard` is now a coordinate, exactly the move `check_cynghanedd` made
for `language` (doctrine 45):

  'qieyun'    the raw rime class. Finer than any poet used, and kept reachable
              so doctrine 36's own demonstration stays runnable: 流/樓 is False
              here and True under either grouping.
  'pingshui'  平水韻 (1252), the standard for 詩. THE DEFAULT, because this
              module's two existing callers are Tang regulated-verse arms.
  'cilin'     詞林正韻 (戈載, 1821), the standard for 詞.

A key literally names the standard that produced it -- `('平水第4部', '平')`
against `('詞林第3部', '平')` -- so two standards' keys can never silently
compare equal, and a result carries the claim rather than leaving it implicit.

Doctrine 36 generalises one rung further in than it was written: the
granularity a REFERENCE WORK records is not the granularity a FORM works at,
and 詩 and 詞 are two forms with two answers over the same rime book.

WHAT THE FORMS MANDATE

  詩  even-numbered lines rhyme, line 1 optionally; a 平/仄 template across
      each line, where 平 is level and 仄 is 上去入.
  詞  the 詞牌 fixes which line ends rhyme and which do not, per tune. That is
      not derivable from the text, which is why `quality/test_ltc.py` reads it
      from the 欽定詞譜 rather than inferring it.

So `prominence` here carries the 平/仄 binary, because that is the contrast the
templates actually constrain. It is not stress; Chinese has none (doctrine 35).

WHY A REFUSAL NEEDS A CAUSE

`data/qieyun_mc.tsv` is keyed on the 廣韻's own orthographic norm. 魂 -- the
character that NAMES the 魂 rhyme group -- cannot be looked up, because the
rime book prints 䰟 as the 字頭 of that 小韻; 477 characters carry 魂 as their
label. That is an INGESTION defect. 怎 and 做 are also unreadable, and there
refusing is CORRECT: the rime book has no such graph. Reporting one refusal
rate over both is doctrine 79's error one layer down, so `refusal()` names the
cause and `readability()` returns three counts, never two.

THE OVERLAP OVER READINGS IS A COORDINATE TOO
=============================================

`rhymes()` ended `return bool(ka & kb)`, and `ka` is the set of keys over ALL
readings of a 多音字. That is an **OR over readings**: a character with two
rime-group readings rhymed with anything either reading rhymed with, and the
result never said which reading had answered. 4,716 of the 19,499 characters in
the table carry more than one reading and 825 of the 3,481 line-end characters
of the 四庫 ci corpus do, so this is not an edge case.

MEASURED, `quality/ltc_overlap.py`, 5,573 poems, `standard='cilin'`: of the
28,330 TRUEs at the 33,321 positions the 1715 詞譜 mandates rhyme, **9,154
(32.3%) rest on an overlap the readings do not settle** -- some reading pair
agrees and some does not. No FALSE moves under any setting, because a verdict
of False already means no reading pair agreed. On the 花間集 it is 585 of
1,723, and the separation from the 句 control is 90.6 pp under 'any' and 90.6
pp under 'settled' -- unchanged to the tenth.

So the fold is declared, exactly as `standard` is (doctrine 45), and an
undeclared value raises:

  'any'      True where SOME reading pair shares a key. The OR, and THE
             DEFAULT, because every committed number was produced under it and
             a default changed without a held-out price is a silent re-scoring
             of the record.
  'all'      True only where EVERY reading pair shares a key. A 多音字 that
             could be read another way is False.
  'settled'  the ternary of doctrine 84 and of `quality/relations.py`'s
             `Agree`/`Differ`: True where every pair agrees, False where none
             does, **None where some do and some do not**. A refusal, visible,
             instead of a verdict on a reading nobody declared.

WHAT THE SETTING DOES NOT CHANGE, and it is the point of doctrine 41: the three
controls -- the 句 line ends the same spec mandates NOT to rhyme, adjacent line
ends in no common rhyme group, and the cross-poem null -- go through the same
function and they do NOT shrink by the same fraction as the result. Going from
'any' to 'settled' on the 四庫 ci corpus the mandated arm loses 4% of its rate
and the three controls lose 35%, 67% and 40% of theirs. So the separation from
the matched 句 control is 83.5 pp under 'any', 82.3 pp under 'settled' and
56.8 pp under 'all', and the committed 90.9% is the 'any' rate rather than a
number the fold was hiding. The 84-point separation SURVIVES; what needed
correcting was the missing coordinate, not the figure.

'all' AND 'settled' HAVE THE SAME NUMERATOR -- 19,176 韻 Trues either way --
and differ only in whether the 9,154 undecidables sit in the denominator. So
'all' is doctrine 79's error made deliberately and reachably: a REFUSAL in the
numerator's complement, reading 61.5% where 'settled' reads 87.1%. It is kept
because a doctrine whose demonstration has been optimised away is a sentence
nobody can check (doctrine 84), and it is not the default for the same reason.

THE PRICE, STATED. Under 'settled', 深/心 (杜甫 春望) and 光/霜 (李白 靜夜思)
-- two of the three canonical Tang pins this module is tested on -- return
None, because 深 and 光 are each 多音字 whose readings straddle the partition.
流/樓 survives all three folds, so doctrine 36's own demonstration is not an
artefact of the OR.

THIRD SWALLOW, NAMED BUT NOT LOAD-BEARING. `rhyme_keys` DROPS a reading whose
(韻, 聲) cell the standard has no entry for, so a two-reading character could
present a one-key set and look settled. Under 'cilin' that is 2 characters in
19,499 (湩, 𪁪 -- both have a 冬上 reading, the cell with three characters and
no clean vote) and 1 more where no reading resolves; under 'pingshui' it is
zero, because `GROUP_OF` backstops every cell. NONE of the three occurs at any
line end of the measured corpus. `unresolved_readings()` counts them and
'all'/'settled' refuse to call such a pair settled.

PROPAGATING tone_class's REFUSAL. `tone_class()` returned None for 383 of the
3,481 line-end characters -- readings that disagree on 平 vs 仄 -- while
`syllabify()` handed out `readings[0]`'s 平/仄 for every one of them, so one
method refused and everything reading the other got a confident number. The
`prominence` channel is now `tone_class()`'s answer, None included; `Syllable`
already declares None on that channel to mean "no binary prominence the grid
can use", which is a refusal and not a zero. `nucleus` still carries
`readings[0]`'s 韻 and that residue is NOT fixed here -- it is what the overlap
coordinate exists to measure, and `rhyme_keys()` is the method that reads all
of them.
"""

import os

from quality.phonology import Phonology, Syllable, register

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "..", "data")
TABLE = os.path.join(DATA, "qieyun_mc.tsv")
STANDARDS_TABLE = os.path.join(DATA, "ltc_rhyme_standards.tsv")
VARIANTS_TABLE = os.path.join(DATA, "qieyun_variants.tsv")

#: 平 is level; 上去入 are collectively 仄 (oblique). This binary, not stress,
#: is what the regulated-verse template constrains.
LEVEL = "平"

STANDARDS = ("qieyun", "pingshui", "cilin")

#: How `rhymes()` folds the readings of a 多音字. See the module docstring.
#: 'any' is the OR every committed number was produced under; 'settled' is the
#: ternary doctrine 84 asks for and returns None on an unsettled overlap.
OVERLAPS = ("any", "all", "settled")

#: Refusal causes. `readings()` returns None for all of them; they differ in
#: WHOSE defect they are, which is the entire reason the column exists.
INGESTION = "異體"      #: a variant is in the table -- our defect, now fixed
SCRIPT = "簡化"         #: a 1956 simplified form -- refused, cause is the script
LATER_GRAPH = "後起"    #: not in the rime book at all -- refusing is CORRECT
UNRECORDED = "未載"     #: absent from the table and from every witness we have
HAZARD = "混同"         #: reads, but doubles as a simplification of another word

#: SUPERSEDED 2026-08-11 by data/ltc_rhyme_standards.tsv, and kept for two
#: reasons: it is the fallback when the data file is absent, and pinning it
#: makes the corrections visible instead of quietly applied.
#:
#: It was encoded from knowledge rather than parsed from a source. Checked
#: against hulbji/couyun's per-character 平水韻部 it agrees on 4,867 of 4,881
#: same-tone rhyme pairs (99.71%) and is wrong on 14, in three places, all of
#: them the same shape: **the 平水韻 partition is not tone-invariant and this
#: table has one list for all four tones.**
#:   - 蒸/登 and 青 are separate in 平聲 and MERGE in 上聲 (迥拯等) and 去聲
#:     (徑證嶝).
#:   - 嚴's 入聲 (業) belongs with 咸銜凡 (洽), not with 鹽添 (葉), though in
#:     平上去 嚴 does group with 鹽添.
#:   - 泰, 夬, 廢, 祭 are 去聲-only 韻 and were absent entirely, so 夬/廢/祭 were
#:     each their own group instead of joining 卦, 隊 and 霽.
#: quality/test_ltc.py pins all three, so a regression is a test failure rather
#: than a quiet shift in every result. The shift is SMALL and that is the
#: argument for pinning it, not against: on the admitted 花間集 the sourced
#: table moves the mandated-rhyme rate 67.2% -> 67.5% and leaves the control
#: at 2.7%, which is exactly the size of change nobody notices.
_LEGACY_GROUPS = [
    "東", "冬鍾", "江", "支脂之", "微", "魚", "虞模", "齊", "佳皆", "灰咍",
    "眞諄臻真", "文欣殷", "元魂痕", "寒桓", "刪山", "先仙", "蕭宵", "肴", "豪",
    "歌戈", "麻", "陽唐", "庚耕清", "青", "蒸登", "尤侯幽", "侵", "覃談",
    "鹽添嚴", "咸銜凡",
]
#: 韻 -> its 同用 group representative, from the legacy table. Any rhyme absent
#: is its own group, which is the conservative default: it can only make the
#: checker stricter, never looser. NOTE 諄, 真, 殷, 桓 and 戈 appear here and
#: NEVER in the data file, which writes 眞/欣/寒/歌 -- the list was written
#: against a different naming convention than the table it indexes, so five of
#: its entries have never once been reached.
GROUP_OF = {r: g[0] for g in _LEGACY_GROUPS for r in g}

RHYME_GROUP_SOURCE = (
    "data/ltc_rhyme_standards.tsv, derived from hulbji/couyun (MIT) by "
    "majority vote of characters unambiguous in both tables; purity recorded "
    "per row. Falls back to the hand-encoded _LEGACY_GROUPS, which is wrong "
    "on 14 of 4,881 pairs.")


def _load_table():
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
                 "division": division, "rhyme": rhyme, "tone": tone,
                 "via": None})
    return out


def _load_standards():
    """-> {(rhyme, tone): {'pingshui': key|None, 'cilin': key|None}}."""
    out = {}
    if not os.path.exists(STANDARDS_TABLE):
        return out
    with open(STANDARDS_TABLE, encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("#") or line.startswith("rhyme\t"):
                continue
            p = line.rstrip("\n").split("\t")
            if len(p) < 5:
                continue
            rhyme, tone, ps, cl = p[0], p[1], p[2], p[3]
            row = {}
            row["pingshui"] = (f"平水第{abs(int(ps))}部", tone) if ps else None
            if cl:
                n = int(cl)
                reg = "入" if n > 14 else ("平" if n > 0 else "仄")
                row["cilin"] = (f"詞林第{abs(n)}部", reg)
            else:
                row["cilin"] = None
            out[(rhyme, tone)] = row
    return out


def _load_variants():
    """-> ({char: target}, {char: relation}, {char: target})."""
    subs, why, hazards = {}, {}, {}
    if not os.path.exists(VARIANTS_TABLE):
        return subs, why, hazards
    with open(VARIANTS_TABLE, encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("#") or line.startswith("char\t"):
                continue
            p = line.rstrip("\n").split("\t")
            if len(p) < 3:
                continue
            ch, rel, target = p[0], p[1], p[2]
            if rel == INGESTION and target:
                subs[ch] = target
            elif rel == HAZARD:
                hazards[ch] = target
                continue
            why[ch] = rel
    return subs, why, hazards


class MiddleChinese(Phonology):
    language = "ltc"
    name = "Middle Chinese (切韻/廣韻 system)"
    notation = "rime-dictionary categories, not a phonetic transcription"
    grid_unit = "syllable"
    prominence_rule = "平 (level) = 1, 仄 (上去入, oblique) = 0. NOT stress."
    relation = "rhyme category = (韻部 under a DECLARED standard, 聲)"

    def __init__(self, standard="pingshui", variants=True, overlap="any"):
        if standard not in STANDARDS:
            raise ValueError(
                f"standard must be one of {STANDARDS}, not {standard!r}. "
                f"'pingshui' is the 詩 standard and 'cilin' the 詞 standard; "
                f"a checker that silently picks one is making a claim it "
                f"never states (doctrine 45).")
        if overlap not in OVERLAPS:
            raise ValueError(
                f"overlap must be one of {OVERLAPS}, not {overlap!r}. It says "
                f"how the readings of a 多音字 are folded: 'any' ORs them "
                f"(the default, and what every committed number was measured "
                f"under), 'all' requires every reading pair to agree, "
                f"'settled' returns None where some agree and some do not.")
        self.standard = standard
        self.variants = variants
        self.overlap = overlap
        self._t = _load_table()
        self._std = _load_standards()
        self._sub, self._why, self._haz = _load_variants()
        self.source = (
            f"data/qieyun_mc.tsv (nk2028, CC0 1.0); rhyme standard "
            f"{standard!r} from data/ltc_rhyme_standards.tsv (derived from "
            f"hulbji/couyun, MIT); 異體 map "
            f"{'ON' if variants else 'OFF'} from data/qieyun_variants.tsv "
            f"(Unihan, Unicode License v3, filtered by couyun)")

    # ---------------------------------------------------------------- lookup

    def declaration(self):
        d = Phonology.declaration(self)
        d["standard"] = self.standard
        d["variant_map"] = self.variants
        d["standard_options"] = list(STANDARDS)
        d["overlap"] = self.overlap
        d["overlap_options"] = list(OVERLAPS)
        return d

    def variant_of(self, ch):
        """-> the character actually looked up for `ch`, or None.

        The substitution is warranted at 平水韻 and 詞林正韻 granularity and at
        neither more nor less: both members sit in the same cell of both
        standards, so the verdict cannot change. At RAW Qieyun granularity it
        warrants nothing, which is why every substituted reading carries `via`.
        """
        if not self.variants or ch in self._t:
            return None
        return self._sub.get(ch)

    def readings(self, ch):
        """-> [reading, ...] or None. A reading reached through the 異體 map
        carries `via` naming the character actually read."""
        rs = self._t.get(ch)
        if rs is not None:
            return rs
        alt = self.variant_of(ch)
        if alt is None:
            return None
        out = self._t.get(alt)
        if out is None:
            return None
        return [dict(r, via=alt) for r in out]

    def refusal(self, ch):
        """-> None if the character reads; otherwise WHY it does not.

        SCRIPT and LATER_GRAPH are refusals the module is right to make;
        UNRECORDED is the residue nothing accounts for. INGESTION never appears
        here with the map on -- it is what the map removed.
        """
        if self.readings(ch) is not None:
            return None
        rel = self._why.get(ch)
        if rel in (SCRIPT, LATER_GRAPH):
            return rel
        if rel == INGESTION:
            return INGESTION            # only reachable with variants=False
        return UNRECORDED

    def hazard(self, ch):
        """-> the traditional character(s) `ch` doubles as, or None.

        The character READS. In a simplified text the reading returned may be
        another word's, which is why OpenCC is not the fix (MISSING M-2): the
        corpus fails loudly on the merges it cannot resolve and silently on
        the ones it can.
        """
        return self._haz.get(ch)

    # ------------------------------------------------------------- phonology

    def syllabify(self, word):
        """One character, one syllable. A character with several readings is
        ambiguous and every reading is kept -- the first is returned here and
        `readings()` exposes the rest.

        `prominence` IS `tone_class()`, refusal included. It used to be
        `readings[0]`'s 平/仄, so on a 多音字 whose readings disagree on the
        tone class this module refused in one method and answered confidently
        in the other; on the 四庫 ci line ends that was 383 characters of
        3,481. `Syllable` already declares None on this channel to mean "no
        binary prominence the grid can use", so the refusal has somewhere to
        land and needs no new type.

        `nucleus` is still `readings[0]`'s 韻 and is NOT refused with it. That
        is deliberate and it is named rather than hidden: the rhyme question is
        answered by `rhyme_keys()`, which reads EVERY reading, and by
        `rhymes(overlap=...)`, which declares how they are folded. Refusing the
        nucleus here would delete the channel path doctrine 84 requires to stay
        reachable, which is doctrine 24's error -- a rule that removes a
        category instead of naming it.
        """
        out = []
        for ch in word:
            rs = self.readings(ch)
            if not rs:
                out.append(Syllable(ch, (), "", (), None, 1))
                continue
            r = rs[0]
            out.append(Syllable(ch, (r["initial"],), r["rhyme"], (),
                                self.tone_class(ch), 1))
        return out

    def tone_class(self, ch):
        """-> 1 for 平, 0 for 仄, None if unknown. Never a guess: a character
        absent from the rime book must not fall back to Mandarin."""
        rs = self.readings(ch)
        if not rs:
            return None
        vals = {1 if r["tone"] == LEVEL else 0 for r in rs}
        return vals.pop() if len(vals) == 1 else None   # ambiguous -> unknown

    def _resolve(self, grouped, standard):
        if standard is not None:
            if standard not in STANDARDS:
                raise ValueError(f"standard must be one of {STANDARDS}, "
                                 f"not {standard!r}")
            return standard
        return self.standard if grouped else "qieyun"

    def rhyme_keys(self, ch, grouped=True, standard=None):
        """-> {(部, 聲)} under the declared standard, or None.

        `grouped=False` is kept as the legacy spelling of `standard='qieyun'`,
        which is the raw rime class: finer than any poet used, and the reason
        doctrine 36 exists. A key names its own standard, so keys from two
        standards can never compare equal.

        Returns None when the character does not read, and ALSO when the
        standard has no entry for a cell -- 冬上 has three characters in the
        table and no clean vote, and a refusal there is better than a guess.
        """
        std = self._resolve(grouped, standard)
        rs = self.readings(ch)
        if rs is None:
            return None
        out = set()
        for r in rs:
            if std == "qieyun":
                out.add((f"廣韻{r['rhyme']}", r["tone"]))
                continue
            row = self._std.get((r["rhyme"], r["tone"]))
            key = row.get(std) if row else None
            if key is None and std == "pingshui":
                key = (GROUP_OF.get(r["rhyme"], r["rhyme"]), r["tone"])
            if key is not None:
                out.add(key)
        return out or None

    def unresolved_readings(self, ch, grouped=True, standard=None):
        """-> how many readings of `ch` the standard has NO key for.

        `rhyme_keys` drops them, so without this a two-reading character one of
        whose readings the standard cannot place presents a ONE-key set and
        looks settled. Under 'cilin' this is 湩 and 𪁪 (a 冬上 reading, the cell
        with three characters and no clean vote) plus 1 character where nothing
        resolves; under 'pingshui' it is zero, `GROUP_OF` backstopping every
        cell. None of the three is a line end anywhere in the measured corpus,
        so it moves no number -- it is counted because a swallowed refusal that
        happens to be small is still a swallowed refusal.
        """
        std = self._resolve(grouped, standard)
        rs = self.readings(ch)
        if rs is None:
            return None
        if std == "qieyun":
            return 0
        n = 0
        for r in rs:
            row = self._std.get((r["rhyme"], r["tone"]))
            key = row.get(std) if row else None
            if key is None and std == "pingshui":
                key = (GROUP_OF.get(r["rhyme"], r["rhyme"]), r["tone"])
            if key is None:
                n += 1
        return n

    def rhymes(self, a, b, grouped=True, standard=None, overlap=None):
        """-> True / False / None under a DECLARED fold over the readings.

        `overlap` defaults to the instance's, which defaults to 'any' -- the OR
        this method has always applied and every committed number rests on. See
        the module docstring for what the three settings mean and for what the
        fold costs; `quality/ltc_overlap.py` re-runs the measurement.

        The three counts doctrine 79 asks for come out of the three RETURN
        VALUES here and a caller must keep them apart: None is the instrument
        declining, not a failure to rhyme, and under 'settled' it is now
        reachable for a second reason -- the readings do not agree with each
        other.
        """
        ov = self.overlap if overlap is None else overlap
        if ov not in OVERLAPS:
            raise ValueError(
                f"overlap must be one of {OVERLAPS}, not {ov!r}; a fold over "
                f"the readings of a 多音字 that is not declared is a claim "
                f"the result never states (doctrine 45).")
        ca = a[-1] if a else ""
        cb = b[-1] if b else ""
        ka = self.rhyme_keys(ca, grouped, standard)
        kb = self.rhyme_keys(cb, grouped, standard)
        if ka is None or kb is None:
            return None
        hit = bool(ka & kb)
        if ov == "any":
            return hit
        # Every reading pair agrees iff both sides hold exactly one key and it
        # is the same key -- AND no reading was dropped for want of a standard
        # entry, which would be agreement asserted over knowledge we do not
        # have.
        gaps = (self.unresolved_readings(ca, grouped, standard)
                or 0) + (self.unresolved_readings(cb, grouped, standard) or 0)
        if not gaps and len(ka) == 1 and ka == kb:
            return True
        if not hit and not gaps:
            return False                # no reading pair agrees: settled False
        return False if ov == "all" else None

    # ------------------------------------------------------------ reporting

    def coverage(self, text):
        """-> (known, total) characters. The two-count form, kept because
        callers unpack it; `readability()` is the one that separates a defect
        from a correct refusal."""
        chars = [c for c in text if "一" <= c <= "鿿"]
        return sum(1 for c in chars if self.readings(c) is not None), len(chars)

    def readability(self, text):
        """-> dict of counts. Doctrine 79: refused, judged and total are three
        numbers, and a rate whose denominator silently includes the cases the
        instrument declined is not a rate.

          read      the table answered, directly or through the 異體 map
          refused   the module was RIGHT not to answer: 後起 (the rime book has
                    no such graph) or 簡化 (a script the table is not keyed on)
          unread    the residue: absent, and nothing accounts for it. THIS is
                    the ingestion defect, and it is the number to drive down.
          via_variant / hazard_if_simplified are diagnostics on the `read`
                    half. The hazard count is CONDITIONAL and says so in its
                    name: in a traditional text 冬 is simply 冬, and it is
                    flagged only because 鼕 simplifies onto it. The number is
                    an upper bound on how much a SIMPLIFIED text could be
                    reading as the wrong word.
        """
        chars = [c for c in text if "一" <= c <= "鿿"]
        out = {"total": len(chars), "read": 0, "refused": 0, "unread": 0,
               "via_variant": 0, "hazard_if_simplified": 0, "by_cause": {}}
        for c in chars:
            if self.hazard(c):
                out["hazard_if_simplified"] += 1
            if self.readings(c) is not None:
                out["read"] += 1
                if self.variant_of(c):
                    out["via_variant"] += 1
                continue
            cause = self.refusal(c)
            out["by_cause"][cause] = out["by_cause"].get(cause, 0) + 1
            if cause in (SCRIPT, LATER_GRAPH):
                out["refused"] += 1
            else:
                out["unread"] += 1
        return out


register(MiddleChinese())
