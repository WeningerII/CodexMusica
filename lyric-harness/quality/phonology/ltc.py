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
`quality/test_ltc.py` runs the whole measurement.

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

    def __init__(self, standard="pingshui", variants=True):
        if standard not in STANDARDS:
            raise ValueError(
                f"standard must be one of {STANDARDS}, not {standard!r}. "
                f"'pingshui' is the 詩 standard and 'cilin' the 詞 standard; "
                f"a checker that silently picks one is making a claim it "
                f"never states (doctrine 45).")
        self.standard = standard
        self.variants = variants
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
        `readings()` exposes the rest."""
        out = []
        for ch in word:
            rs = self.readings(ch)
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

    def rhymes(self, a, b, grouped=True, standard=None):
        ka = self.rhyme_keys(a[-1] if a else "", grouped, standard)
        kb = self.rhyme_keys(b[-1] if b else "", grouped, standard)
        if ka is None or kb is None:
            return None
        return bool(ka & kb)

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
