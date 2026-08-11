#!/usr/bin/env python3
"""Regressions for Middle Chinese, and the load-bearing ones are the tradition
tests (doctrine 37).

Two questions are asked here that `quality/test_phonology.py` cannot ask,
because it has no corpus and no spec:

  1. Does the module use the RIGHT rhyme standard for the form in front of it?
     `ltc` shipped the 平水韻 grouping, which is the standard for 詩, and it was
     being applied to 詞. Scored against the 欽定詞譜 of 1715 -- the tradition's
     own statement of which line ends rhyme (doctrine 62) -- on the admitted
     花間集, the 詩 standard misses more than a fifth of the rhymes the tune
     mandates and the 詞 standard recovers them.

  2. When the module refuses, WHOSE defect is it? 魂 -- the character that
     NAMES the 魂 rhyme group -- could not be looked up, and 怎 could not
     either. The first is an ingestion defect and the second is correct. A
     refusal rate that folds the two together is uninterpretable (doctrine 79,
     one layer down from the sonnet battery's).

  3. How much of every one of those numbers rests on an OR over the readings of
     a 多音字? `rhymes()` ended `bool(ka & kb)` and `ka` is the key set over ALL
     readings, so a two-reading character rhymed with anything either reading
     rhymed with and the answer never said which one had carried it. The fold
     is now a declared coordinate -- `any` / `all` / `settled` -- and sections 9
     to 13 price it against all three controls. `quality/ltc_overlap.py` carries
     the 5,573-poem 四庫 measurement and is re-run from here.

WHAT THIS FILE CANNOT MEASURE. MISSING M-1's figures come from 1,518 ci across
119 詞牌; those 4,347 ci were refused on an express non-commercial grant
(doctrine 85) and are not on disk. The 500 花間集 songs here are early 令詞 with
frequent 換韻 and short rhyme runs, so the ABSOLUTE rates below are not
comparable to M-1's 47.4% -- a different corpus, a different century of the
form, and a different pair construction. What replicates is the DIRECTION, the
size of the control gap, and the specific 韻 pairs the 詩 standard gets wrong.

Run: python3 quality/test_ltc.py
"""

import collections
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.phonology import ltc                            # noqa: E402
from quality.phonology.ltc import MiddleChinese              # noqa: E402

ROOT = os.path.join(HERE, "..")
CIPU = os.path.join(ROOT, "data", "qindingcipu_ge.tsv")
CORPUS = os.path.join(ROOT, "corpus", "song", "ltc_huajianji.txt")

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _raises(fn):
    try:
        fn()
    except Exception:
        return True
    return False


# --------------------------------------------------------------- the corpus

BREAKS = set("，。、？！；：,.?!;:")
HAN = re.compile(r"[㐀-䶿一-鿿豈-﫿]")


def load_songs():
    """-> [{air, chars, breaks}] from the admitted 花間集."""
    songs, cur = [], None
    for raw in open(CORPUS, encoding="utf-8"):
        line = raw.rstrip("\n")
        if line.startswith("#"):
            continue
        if line.startswith("--- TITLE:"):
            if cur:
                songs.append(cur)
            m = re.search(r"\[air:\s*([^\]]+)\]", line)
            cur = {"air": m.group(1).strip() if m else "", "text": []}
            continue
        if cur is None or line.startswith("---") or line.startswith("["):
            continue
        cur["text"].append(line)
    if cur:
        songs.append(cur)
    for s in songs:
        chars, breaks = [], []
        for line in s["text"]:
            for c in line:
                if HAN.match(c):
                    chars.append(c)
                elif c in BREAKS and chars and (
                        not breaks or breaks[-1] != len(chars) - 1):
                    breaks.append(len(chars) - 1)
            if chars and (not breaks or breaks[-1] != len(chars) - 1):
                breaks.append(len(chars) - 1)
        s["chars"], s["breaks"] = chars, breaks
        del s["text"]
    return songs


def load_cipu():
    """-> {tune: [格]} from data/qindingcipu_ge.tsv."""
    out = collections.defaultdict(list)
    for line in open(CIPU, encoding="utf-8"):
        if line.startswith("#") or line.startswith("tune\t"):
            continue
        p = line.rstrip("\n").split("\t")
        if len(p) < 7:
            continue
        groups = [[int(x) for x in g.split(".")]
                  for g in p[3].split("/") if g]
        ge = {"n": int(p[2]), "groups": groups,
              "ju": [int(x) for x in p[4].split(".") if x],
              "du": [int(x) for x in p[5].split(".") if x],
              "tune": p[0]}
        ge["rhyme"] = sorted(x for g in groups for x in g)
        for nm in [p[0]] + [a for a in p[1].split("|") if a]:
            out[nm].append(ge)
    return out


def align():
    """-> [(song, 格)] where the song matches a 格 EXACTLY on both length and
    句讀. A song that matches nothing is dropped rather than fitted to the
    nearest 格: an approximate alignment would put the ground truth at the
    wrong positions and every number after it would be about that."""
    cipu, songs, hits = load_cipu(), load_songs(), []
    for s in songs:
        for ge in cipu.get(s["air"], []):
            if ge["n"] != len(s["chars"]):
                continue
            if set(ge["rhyme"]) | set(ge["ju"]) | set(ge["du"]) \
                    == set(s["breaks"]):
                hits.append((s, ge))
                break
    return songs, hits


def pairs(ge):
    """-> (mandated 韻 pairs, control 句 pairs).

    A 句 line end is scored against the last 韻 position before it: the same
    corpus, the same comparator, at a position the tune says does NOT rhyme.
    """
    rp = [(a, b) for g in ge["groups"] for a, b in zip(g, g[1:])]
    jp = []
    for p in ge["ju"]:
        prior = [q for q in ge["rhyme"] if q < p]
        if prior:
            jp.append((prior[-1], p))
    return rp, jp


def tally(hits, phon, standard, fold=None):
    out = {"韻": collections.Counter(), "句": collections.Counter()}
    for song, ge in hits:
        ch = song["chars"]
        rp, jp = pairs(ge)
        for label, prs in (("韻", rp), ("句", jp)):
            for a, b in prs:
                if a >= len(ch) or b >= len(ch):
                    continue
                if fold is None:
                    v = phon.rhymes(ch[a], ch[b], standard=standard)
                else:
                    ka = phon.rhyme_keys(ch[a], standard=standard)
                    kb = phon.rhyme_keys(ch[b], standard=standard)
                    v = None if ka is None or kb is None \
                        else bool(fold(ka) & fold(kb))
                out[label]["R" if v is None else ("T" if v else "F")] += 1
    return out


def rate(c):
    j = c["T"] + c["F"]
    return 100.0 * c["T"] / j if j else float("nan")


def fmt(c):
    return f"{rate(c):.1f}% ({c['T']}/{c['T'] + c['F']} judged, {c['R']} refused)"


# ------------------------------------------------------------------- tests

def test_standard_is_a_declared_coordinate():
    print("\n1. The rhyme standard is a DECLARED coordinate (doctrine 45)")
    d = MiddleChinese().declaration()
    check("the declaration names the standard in force",
          d.get("standard") == "pingshui",
          f"standard={d.get('standard')!r}, options={d.get('standard_options')}"
          f" -- 平水韻 is the 詩 standard and the default because this module's "
          f"two existing callers are Tang regulated-verse arms; a 詞 caller "
          f"must say standard='cilin'")
    check("an undeclared standard is refused, not defaulted",
          _raises(lambda: MiddleChinese(standard="pinshui")))
    check("a per-call standard is refused the same way",
          _raises(lambda: MiddleChinese().rhymes("流", "樓", standard="ci")))
    l = MiddleChinese()
    ka = l.rhyme_keys("流", standard="pingshui")
    kb = l.rhyme_keys("流", standard="cilin")
    check("a key NAMES the standard that produced it, so two standards' keys "
          "cannot silently compare equal",
          not (ka & kb) and all(str(k[0]).startswith("平水") for k in ka)
          and all(str(k[0]).startswith("詞林") for k in kb),
          f"pingshui {sorted(ka)}  cilin {sorted(kb)}")


def test_doctrine_36_demonstration_stays_runnable():
    print("\n2. 流/樓 — doctrine 36's own demonstration, still reachable")
    l = MiddleChinese()
    check("raw 廣韻 class says NO (尤 vs 侯)",
          l.rhymes("流", "樓", standard="qieyun") is False)
    check("平水韻 同用 grouping says YES", l.rhymes("流", "樓") is True)
    check("詞林正韻 says YES too",
          l.rhymes("流", "樓", standard="cilin") is True)
    check("grouped=False is still the legacy spelling of standard='qieyun'",
          l.rhymes("流", "樓", grouped=False) is False)
    for name, ws in {"登鸛雀樓 (王之渙)": ["流", "樓"],
                     "春望 (杜甫)": ["深", "心"],
                     "靜夜思 (李白)": ["光", "霜", "鄉"]}.items():
        check(f"{name} {'/'.join(ws)} still rhymes under the 詩 standard",
              all(l.rhymes(ws[0], w) for w in ws[1:]))
    check("unrelated rhymes stay unrelated", l.rhymes("流", "山") is False)


def test_the_hand_table_was_wrong_in_three_places():
    print("\n3. The sourced 平水韻 table against the hand-encoded one")
    l = MiddleChinese()
    legacy = MiddleChinese()
    legacy._std = {}                 # force the _LEGACY_GROUPS fallback

    def same(p, a, b, tone):
        ka = p.rhyme_keys(a, standard="pingshui")
        kb = p.rhyme_keys(b, standard="pingshui")
        return None if not (ka and kb) else bool(
            {k for k in ka if k[1] == tone} & {k for k in kb if k[1] == tone})

    cases = [
        ("蒸/登 and 青 MERGE in 上聲 (迥拯等)", "肯", "頂", "上", True),
        ("...and in 去聲 (徑證嶝)", "贈", "定", "去", True),
        ("嚴's 入聲 (業) goes with 咸銜凡 (洽), not with 鹽添 (葉)",
         "劫", "洽", "入", True),
        ("夬 joins 佳/皆 in 去聲 (卦)", "夬", "卦", "去", True),
        ("廢 joins 灰/咍 in 去聲 (隊)", "廢", "退", "去", True),
        ("祭 joins 齊 in 去聲 (霽)", "祭", "計", "去", True),
    ]
    for name, a, b, tone, want in cases:
        got, was = same(l, a, b, tone), same(legacy, a, b, tone)
        check(f"{name}: {a}/{b}", got is want and was is not want,
              f"sourced table {got}, hand table {was} -- the 平水韻 partition "
              f"is NOT tone-invariant and _LEGACY_GROUPS has one list for all "
              f"four tones")
    check("泰 stays alone in 去聲, as 平水韻 has it",
          same(l, "泰", "退", "去") is False)
    check("five entries of the hand table index a name the data never uses",
          {"諄", "真", "殷", "桓", "戈"} <= set(ltc.GROUP_OF),
          "諄/真/殷/桓/戈 are in _LEGACY_GROUPS and the table writes "
          "眞/欣/寒/歌 -- the grouping was encoded against a different naming "
          "convention than the file it indexes")


def test_a_refusal_names_its_cause():
    print("\n4. A refusal names WHOSE defect it is (doctrine 79, one layer in)")
    on, off = MiddleChinese(), MiddleChinese(variants=False)
    check("as shipped, the character that NAMES the 魂 group cannot be read",
          off.readings("魂") is None and off.refusal("魂") == ltc.INGESTION,
          "the 廣韻 prints 䰟 as the 字頭 of that 小韻; 477 characters carry 魂 "
          "as their rhyme label and 魂 is never a headword in it")
    check("the defect stays REACHABLE, so it can be demonstrated "
          "(doctrine 84)", off.rhyme_keys("魂") is None)
    check("with the 異體 map on, 魂 reads through 䰟",
          on.variant_of("魂") == "䰟"
          and on.readings("魂")[0]["via"] == "䰟"
          and on.readings("魂")[0]["rhyme"] == "魂")
    check("窗 reads through 窓", on.variant_of("窗") == "窓")
    check("怎 and 做 are refused, and the refusal is CORRECT",
          on.refusal("怎") == ltc.LATER_GRAPH
          and on.refusal("做") == ltc.LATER_GRAPH,
          "no 廣韻 headword and no warranted 異體 -- the rime book does not "
          "contain the graph, so returning nothing is the right answer")
    check("a simplified character is refused with the SCRIPT named",
          on.refusal("风") == ltc.SCRIPT and on.readings("风") is None,
          "not mapped: M-2 measured that resolving these silently returns a "
          "different word's rhyme wherever the 1956 reform merged two Middle "
          "Chinese words")
    check("MISSING M-2 IS FALSIFIED ON 你: it is not outside the rime book",
          on.readings("你") is not None and on.variant_of("你") == "伱",
          "廣韻 小韻 1310 is 伱, 孃開三之上, 乃里切, glossed 秦人呼傍人之稱 -- "
          "the second-person pronoun, in the book under another graph. M-2 "
          "lists 你 with 怎/樣/褪/做 as a vernacular character 'where refusal "
          "is CORRECT'. Four of the five hold; this one is ingestion")
    check("云 reads AND carries a hazard flag",
          on.readings("云") is not None and on.hazard("云") == "云雲",
          "the reading returned is 云's own. In a simplified text the word may "
          "be 雲, and nothing in the reading says so -- this is why OpenCC is "
          "not the fix")


def test_readability_is_three_counts():
    print("\n5. readability() returns three counts, never two")
    on, off = MiddleChinese(), MiddleChinese(variants=False)
    songs = load_songs()
    text = "".join("".join(s["chars"]) for s in songs)
    a, b = off.readability(text), on.readability(text)
    for nm, r in (("map OFF", a), ("map ON ", b)):
        print(f"          {nm}  total {r['total']}  read {r['read']} "
              f"({100 * r['read'] / r['total']:.2f}%)  refused {r['refused']}  "
              f"unread {r['unread']}  via_variant {r['via_variant']}  "
              f"hazard_if_simplified {r['hazard_if_simplified']}  "
              f"causes {r['by_cause']}")
    check("the three counts partition the text",
          all(r["read"] + r["refused"] + r["unread"] == r["total"]
              for r in (a, b)))
    check("the 異體 map removes the ingestion residue entirely on this corpus",
          b["unread"] == 0 and a["unread"] > 300,
          f"{a['unread']} unread -> {b['unread']}; the {b['refused']} that "
          f"remain are refusals the module is RIGHT to make, and reporting "
          f"one rate over both would have hidden that")
    check("readable rate rises and the correct refusals do NOT move",
          b["read"] > a["read"] and a["refused"] == b["refused"],
          f"{100 * a['read'] / a['total']:.2f}% -> "
          f"{100 * b['read'] / b['total']:.2f}%")
    check("coverage() still returns the two-count legacy form",
          len(on.coverage("流樓")) == 2)


def test_the_tradition_test_ci_against_the_cipu():
    print("\n6. THE TRADITION TEST: 花間集 against the 欽定詞譜 of 1715")
    songs, hits = align()
    tunes = {ge["tune"] for _s, ge in hits}
    nr = nj = 0
    for _s, ge in hits:
        a, b = pairs(ge)
        nr += len(a)
        nj += len(b)
    check("the admitted corpus aligns to the spec on a usable population",
          len(hits) >= 380 and len(tunes) >= 55 and nj >= 400,
          f"{len(hits)}/{len(songs)} songs match a 格 exactly on length AND "
          f"句讀, across {len(tunes)} 詞牌: {nr} mandated 韻 pairs and {nj} "
          f"控制 句 pairs")

    on, off = MiddleChinese(), MiddleChinese(variants=False)
    ship = tally(hits, off, "pingshui")
    raw = tally(hits, off, "qieyun")
    now = tally(hits, on, "cilin")
    for nm, r in (("AS SHIPPED 平水韻, no 異體 map", ship),
                  ("           廣韻 raw class    ", raw),
                  ("NOW        詞林正韻 + 異體 map ", now)):
        print(f"          {nm}   韻 {fmt(r['韻'])}   句 {fmt(r['句'])}")

    check("the 詩 standard misses a fifth of the rhymes the tune mandates",
          rate(ship["韻"]) < 82.0,
          f"{rate(ship['韻']):.1f}% True at positions the 1715 spec marks "
          f"韻/叶 -- as shipped, this module reports a ci failing to rhyme")
    check("the 詞 standard recovers them",
          rate(now["韻"]) > 92.0,
          f"{rate(ship['韻']):.1f}% -> {rate(now['韻']):.1f}%, "
          f"+{rate(now['韻']) - rate(ship['韻']):.1f} pp")
    check("and the matched control barely moves",
          rate(now["句"]) < 6.0
          and (rate(now["句"]) - rate(ship["句"])) < 4.0,
          f"句 {rate(ship['句']):.1f}% -> {rate(now['句']):.1f}%; the gap to "
          f"the control goes {rate(ship['韻']) - rate(ship['句']):.1f} -> "
          f"{rate(now['韻']) - rate(now['句']):.1f} pp. A standard that lifted "
          f"both equally would have lifted nothing (doctrine 71)")
    check("the raw rime class is the worst of the three, which is doctrine 36",
          rate(raw["韻"]) < rate(ship["韻"]) < rate(now["韻"]),
          f"廣韻 {rate(raw['韻']):.1f}% < 平水韻 {rate(ship['韻']):.1f}% < "
          f"詞林正韻 {rate(now['韻']):.1f}% -- the reference work's own "
          f"granularity is the wrong one for BOTH forms")
    check("the 異體 map turns refusals into verdicts at rhyme positions",
          now["韻"]["R"] < ship["韻"]["R"] / 4,
          f"{ship['韻']['R']} refused -> {now['韻']['R']}")


def test_the_rejected_variant_is_measured_not_argued():
    print("\n7. Merging 平 with 仄 inside a 詞林部 — REJECTED, by lift "
          "(doctrine 61)")
    _songs, hits = align()
    on = MiddleChinese()
    strict = tally(hits, on, "cilin")
    merged = tally(hits, on, "cilin",
                   fold=lambda k: {(b, r if r == "入" else "*") for b, r in k})
    print(f"          strict  韻 {fmt(strict['韻'])}   句 {fmt(strict['句'])}")
    print(f"          merged  韻 {fmt(merged['韻'])}   句 {fmt(merged['句'])}")
    d_obs = rate(merged["韻"]) - rate(strict["韻"])
    d_ctl = rate(merged["句"]) - rate(strict["句"])
    check("merging fires MORE and is WORSE: the control rises further than "
          "the measurement", d_ctl > d_obs and d_obs < 1.0,
          f"韻 +{d_obs:.1f} pp against 句 +{d_ctl:.1f} pp. 詞林正韻 keeps the "
          f"平 and 上去 halves of a 部 apart and so does this module; where a "
          f"tune licenses 平仄通叶 that is the TUNE's licence to grant, not "
          f"the phonology's")


def test_the_partition_shows_through_practice():
    print("\n8. Which 廣韻 pairs the 詩 standard calls False at mandated "
          "positions")
    _songs, hits = align()
    on = MiddleChinese()
    bad, fixed = collections.Counter(), collections.Counter()
    for song, ge in hits:
        ch = song["chars"]
        for a, b in pairs(ge)[0]:
            if a >= len(ch) or b >= len(ch):
                continue
            if on.rhymes(ch[a], ch[b], standard="pingshui") is not False:
                continue
            ka = {k[0][2:] for k in (on.rhyme_keys(ch[a], standard="qieyun")
                                     or ())}
            kb = {k[0][2:] for k in (on.rhyme_keys(ch[b], standard="qieyun")
                                     or ())}
            key = tuple(sorted(("/".join(sorted(ka)), "/".join(sorted(kb)))))
            bad[key] += 1
            if on.rhymes(ch[a], ch[b], standard="cilin") is True:
                fixed[key] += 1
    for k, n in bad.most_common(8):
        print(f"          {'/'.join(k):<24} {n:3d}  fixed by 詞林正韻 "
              f"{fixed[k]:3d}")
    top = {frozenset(k) for k, _n in bad.most_common(10)}
    want = [{"東", "鍾"}, {"支", "微"}, {"魚", "虞"}]
    check("the 詞林正韻 partition shows through the 詩 standard's failures",
          sum(1 for w in want if frozenset(w) in top) >= 2,
          "MISSING M-1 tabulated the same pairs on 1,518 ci we may not hold "
          "-- 魚/虞, 支/微/齊, 東/冬, 庚/青/蒸, 元/先/寒/刪. The 500 admitted "
          "songs recover them independently")
    total = sum(bad.values())
    check("a large share of the 詩 standard's misses are exactly this",
          sum(fixed.values()) / total > 0.55,
          f"{sum(fixed.values())}/{total} = "
          f"{100 * sum(fixed.values()) / total:.1f}% of the mandated positions "
          f"平水韻 calls False are True under 詞林正韻")


def test_the_overlap_is_a_declared_coordinate():
    print("\n9. The fold over a 多音字's readings is a DECLARED coordinate "
          "(doctrine 45)")
    d = MiddleChinese().declaration()
    check("the declaration names the fold in force",
          d.get("overlap") == "any"
          and list(d.get("overlap_options")) == list(ltc.OVERLAPS),
          f"overlap={d.get('overlap')!r}, options={d.get('overlap_options')}. "
          f"'any' is the OR this module has always applied and every committed "
          f"number rests on, so it stays the DEFAULT: changing it silently "
          f"would re-score the record without pricing the change")
    check("an undeclared fold is refused at construction",
          _raises(lambda: MiddleChinese(overlap="or")))
    check("and per call, the same way",
          _raises(lambda: MiddleChinese().rhymes("流", "樓", overlap="union")))
    check("the instance's fold is what a bare call uses",
          MiddleChinese(overlap="all").rhymes("深", "心") is False
          and MiddleChinese().rhymes("深", "心") is True,
          "深 has a 平 and a 去 reading; 心 has only 平. The OR says they "
          "rhyme, and it is right that they can -- it is silent that they "
          "need not")


def test_the_three_folds_disagree_on_a_real_polyphone():
    print("\n10. any / all / settled on real characters, and the doctrine 79 "
          "identity between the last two")
    l = MiddleChinese()
    c = MiddleChinese(standard="cilin")
    check("流/樓 survives the STRICTEST fold, so doctrine 36's own "
          "demonstration is not an artefact of the OR",
          all(l.rhymes("流", "樓", overlap=o) is True for o in ltc.OVERLAPS),
          "one reading each, one key each, and the keys are equal: nothing "
          "here was ever being decided by an unstated choice of reading")
    check("流/山 is False under every fold",
          all(l.rhymes("流", "山", overlap=o) is False for o in ltc.OVERLAPS),
          "a False already means NO reading pair agreed, so no fold can move "
          "it -- which is why the folds move Trues only")
    for a, b, why in (("深", "心", "杜甫 春望's own rhyme"),
                      ("光", "霜", "李白 靜夜思's own rhyme")):
        check(f"{a}/{b} — {why} — is True / False / None across the three",
              (l.rhymes(a, b, overlap="any") is True
               and l.rhymes(a, b, overlap="all") is False
               and l.rhymes(a, b, overlap="settled") is None),
              f"{a} {sorted(l.rhyme_keys(a))}, {b} {sorted(l.rhyme_keys(b))}. "
              f"THE PRICE, stated: the strict folds refuse two of the three "
              f"canonical Tang pins this file and test_phonology.py both "
              f"carry. That is a cost of the coordinate, not an argument "
              f"against it, and it is why 'any' remains the default")
    check("湩/冬 shows the THIRD swallow: a reading the standard cannot place "
          "is dropped by rhyme_keys, and 'settled' refuses to call the pair "
          "settled anyway",
          c.unresolved_readings("湩") == 1
          and c.rhymes("湩", "冬", overlap="any") is False
          and c.rhymes("湩", "冬", overlap="settled") is None,
          "湩 has a 冬上 reading and 詞林正韻 has no clean vote for that cell, "
          "so a one-key set looked certain. 2 characters in 19,499 under "
          "'cilin' and 0 under 'pingshui'; it moves no number in the corpus "
          "and is counted because a small swallowed refusal is still one")

    _songs, hits = align()
    a = tally(hits, c, "cilin")
    for ov in ("all", "settled"):
        c2 = MiddleChinese(standard="cilin", overlap=ov)
        r = tally(hits, c2, "cilin")
        print(f"          花間集 overlap={ov:<8} 韻 {fmt(r['韻'])}   "
              f"句 {fmt(r['句'])}")
        if ov == "all":
            strict = r
    settled = tally(hits, MiddleChinese(standard="cilin", overlap="settled"),
                    "cilin")
    check("'all' and 'settled' have the SAME numerator and differ ONLY in "
          "whether the undecidables sit in the denominator — which is "
          "doctrine 79 made into a coordinate",
          strict["韻"]["T"] == settled["韻"]["T"]
          and settled["韻"]["R"] > strict["韻"]["R"],
          f"韻 True {strict['韻']['T']} under both; judged "
          f"{strict['韻']['T'] + strict['韻']['F']} under 'all' vs "
          f"{settled['韻']['T'] + settled['韻']['F']} under 'settled', so the "
          f"rate reads {rate(strict['韻']):.1f}% vs {rate(settled['韻']):.1f}%. "
          f"'all' puts a REFUSAL in the numerator's complement; it is kept "
          f"reachable because a doctrine whose demonstration is optimised away "
          f"is a sentence nobody can check (doctrine 84)")
    check("on 花間集 the separation from the matched 句 control is UNCHANGED "
          "by the settled fold",
          abs((rate(settled["韻"]) - rate(settled["句"]))
              - (rate(a["韻"]) - rate(a["句"]))) < 0.5,
          f"any {rate(a['韻']) - rate(a['句']):.1f} pp -> settled "
          f"{rate(settled['韻']) - rate(settled['句']):.1f} pp")


def test_the_committed_ci_numbers_under_each_fold():
    print("\n11. THE 四庫 MEASUREMENT: data/sources.tsv's four arms, re-run "
          "under each fold")
    import quality.ltc_overlap as ov
    data = ov.collect()
    check("the reconstruction from the COMMITTED corpus files reproduces "
          "every number in data/sources.tsv row kanripo/KR4j exactly",
          not ov.check_committed(data) and data["unique"] == 5573,
          "reading the --- RHYME / --- JU / --- GE headers of "
          "corpus/song/ltc_siku_*.txt rebuilds the same four arms "
          "build_ci_corpus.py:measure() built from 66 git clones, so the "
          "measurement is re-runnable without the network (doctrine 58)")

    phon = MiddleChinese(standard="cilin")
    rows = {o: {k: ov.arm(phon, data[k], "cilin", o)
                for k, _l in ov.ARMS} for o in ltc.OVERLAPS}
    for o in ltc.OVERLAPS:
        r = rows[o]
        print(f"          overlap={o:<8} "
              + "  ".join(f"{k} {r[k]['rate']:.1f}%"
                          f"({r[k]['true']}/{r[k]['judged']},"
                          f"{r[k]['refused']}R)"
                          for k, _l in ov.ARMS))
    check("the committed 90.9% is the 'any' rate and nothing else moved it",
          abs(rows["any"]["yun"]["rate"] - 90.9) < 0.05,
          f"{rows['any']['yun']['rate']:.1f}% on "
          f"{rows['any']['yun']['judged']} judged of "
          f"{rows['any']['yun']['mandated']} mandated, "
          f"{rows['any']['yun']['refused']} refused")
    for o in ltc.OVERLAPS:
        r = rows[o]
        sep = r["yun"]["rate"] - r["ju"]["rate"]
        check(f"under {o!r} the separation from the MATCHED 句 control "
              f"survives", sep > 50.0,
              f"韻 {r['yun']['rate']:.1f}% - 句 {r['ju']['rate']:.1f}% = "
              f"{sep:.1f} pp; vs adj {r['yun']['rate'] - r['adj']['rate']:.1f} "
              f"pp, vs cross-poem null "
              f"{r['yun']['rate'] - r['null']['rate']:.1f} pp")
    check("ALL THREE CONTROLS move in the same direction as the mandated arm "
          "and further, in relative terms — the OR was buying the controls "
          "more than it was buying the result (doctrine 41)",
          all(rows["settled"][k]["rate"] < rows["any"][k]["rate"]
              for k, _l in ov.ARMS)
          and all((rows["any"][k]["rate"] - rows["settled"][k]["rate"])
                  / rows["any"][k]["rate"]
                  > (rows["any"]["yun"]["rate"]
                     - rows["settled"]["yun"]["rate"])
                  / rows["any"]["yun"]["rate"]
                  for k in ("ju", "adj", "null")),
          "; ".join(f"{k} -{100 * (rows['any'][k]['rate'] - rows['settled'][k]['rate']) / rows['any'][k]['rate']:.0f}%"
                    for k, _l in ov.ARMS)
          + ". A fold that had merely made the comparator stricter everywhere "
            "would have shrunk them all by the same fraction")
    t, u = ov.unsettled_trues(phon, data["yun"], "cilin")
    check("and the headline the coordinate exists for", u > 0 and t > u,
          f"{u} of {t} Trues at mandated positions ({100.0 * u / t:.1f}%) rest "
          f"on an overlap the readings do not settle")


def test_tone_class_refusal_now_propagates():
    print("\n12. syllabify() no longer hands out a 平/仄 tone_class() refuses")
    l = MiddleChinese()
    amb = [c for c in "行重長過中華相間王供歐經"
           if l.readings(c) is not None and l.tone_class(c) is None]
    check("there are characters tone_class() refuses and syllabify() used to "
          "answer for", len(amb) >= 8, f"{len(amb)}: {''.join(amb)}")
    check("prominence is now exactly tone_class(), refusal included",
          all(l.syllabify(c)[0].prominence is l.tone_class(c) for c in amb)
          and all(l.syllabify(c)[0].prominence is None for c in amb),
          "one method refused and the other answered; `Syllable` already "
          "declares None on this channel to mean 'no binary prominence the "
          "grid can use', so the refusal needed no new type")
    check("a character whose readings AGREE keeps its confident value",
          l.syllabify("流")[0].prominence == 1
          and l.syllabify("目")[0].prominence == 0
          and l.tone_class("好") == 0,
          "流 is 平, 目 is 入 (therefore 仄), and 好 has two readings that "
          "agree on the class -- a 多音字 is not automatically undecided FOR "
          "THE PREDICATE")
    check("an unreadable character is still a placeholder syllable, not an "
          "exception", l.syllabify("🙂")[0].prominence is None
          and l.readings("🙂") is None)
    check("nucleus is STILL readings[0]'s 韻 and that residue is named, not "
          "hidden", l.syllabify("行")[0].nucleus in
          {r["rhyme"] for r in l.readings("行")},
          "refusing the nucleus here would delete the channel path doctrine "
          "84 requires to stay reachable (test_taxonomy.py's consult=False "
          "arm reads it). The rhyme question is answered by rhyme_keys(), "
          "which reads every reading, under a declared fold")


def test_the_denominator_was_narrower_than_the_script():
    print("\n13. the coverage DENOMINATOR excluded Extension A, and the bias "
          "ran both ways")
    import quality.build_ci_corpus as bci
    from quality.phonology import ltc as L

    check("䰟 -- the variant 魂 maps TO, the graph doctrine 88 is named for -- "
          "is Extension A, so it was outside the denominator of the rate that "
          "doctrine quotes",
          not ("一" <= "䰟" <= "鿿") and L.is_ideograph("䰟"),
          f"U+{ord('䰟'):04X}, and the old filter was U+4E00..U+9FFF")

    songs = load_songs()
    hj = "".join("".join(s["chars"]) for s in songs)
    on = MiddleChinese()
    r = on.readability(hj)
    narrow = sum(1 for c in hj if "一" <= c <= "鿿")
    check("on 花間集 the widening ADDS characters and they all read, so the "
          "old figure was UNDERSTATED",
          r["total"] > narrow and r["unread"] == 0,
          f"total {narrow} -> {r['total']} (+{r['total'] - narrow}), "
          f"unread still {r['unread']}")

    poems = bci.read_staged()
    if not poems:
        check("the staged 四庫 corpus is present", False)
        return
    w = bci.staged_readability(poems)
    check("on the 四庫 ci corpus the widening adds characters that mostly do "
          "NOT read, so the SAME fix moves that figure the other way -- a rate "
          "polluted this way is not even conservative in a direction "
          "(doctrine 79)",
          w["total"] > w["narrow_total"]
          and w["read"] + w["refused"] + w["unread"] == w["total"],
          f"denominator {w['narrow_total']} -> {w['total']} "
          f"(+{w['total'] - w['narrow_total']}); read {w['read']} "
          f"({100.0 * w['read'] / w['total']:.2f}%), refused {w['refused']}, "
          f"unread {w['unread']} -- three counts that partition it")
    check("the positions that are NOT characters are counted rather than "
          "dropped: a gaiji entity and a lacuna each occupy one position the "
          "1715 詞譜 counts",
          w["lacuna"] > 0 and w["entity"] > 0,
          f"{w['entity']} &KRnnnn; entities, {w['lacuna']} □/○ lacunae, "
          f"neither of them an ideograph and both of them a character "
          f"position")


def test_the_edition_is_a_coordinate_and_the_control_did_not_move():
    print("\n14. EDITION is a coordinate, it is OFF by default, and its price "
          "is measured against the matched control")
    import quality.build_ci_corpus as bci

    check("an undeclared edition raises rather than being guessed",
          _raises(lambda: MiddleChinese(edition="ming")))
    base, siku = MiddleChinese(standard="cilin"), MiddleChinese(
        standard="cilin", edition="siku")
    check("the default is unchanged, so no committed number moves",
          base.declaration()["edition"] is None
          and base.readings("黄") is None,
          "every figure in data/sources.tsv row kanripo/KR4j was measured with "
          "no edition orthography, and a default changed without a held-out "
          "price is a silent re-scoring of the record")
    check("under edition='siku' the 四庫 hand reads, and its 異體 target is "
          "named rather than implied",
          all(siku.readings(c) is not None for c in "黄别逺緑㸃")
          and siku.variant_of("黄") == "黃",
          "黄->黃 别->別 逺->遠 緑->綠 㸃->點; the general table files the first "
          "three as 簡化 (a 1956 simplification) and 逺/緑 as 後起, and both "
          "verdicts are about a character rather than a character in an "
          "edition")
    check("a graph the rime book genuinely postdates stays refused under "
          "BOTH settings -- the map recovers an orthography, not a vocabulary",
          base.readings("怎") is None and siku.readings("怎") is None,
          "怎 is Song-Yuan vernacular; doctrine 88 says refusing it is CORRECT")

    poems = bci.read_staged()
    if not poems:
        check("the staged 四庫 corpus is present", False)
        return
    a = bci.yun_rhyme_arms(poems, "cilin", None)
    b = bci.yun_rhyme_arms(poems, "cilin", "siku")
    check("the reconstruction from the staged files reproduces the COMMITTED "
          "韻 and 句 arms exactly, before anything is changed",
          (a["yun"]["mandated"], a["yun"]["judged"], a["yun"]["refused"],
           a["yun"]["true"]) == (33321, 31162, 2159, 28330)
          and (a["ju"]["mandated"], a["ju"]["judged"], a["ju"]["refused"],
               a["ju"]["true"]) == (15061, 14062, 999, 1047),
          f"韻 {a['yun']['rate']:.1f}%, 句 {a['ju']['rate']:.1f}%")
    check("the edition map CUTS THE REFUSALS and does NOT lift the matched "
          "control -- a map manufacturing agreement would lift both "
          "(doctrine 41)",
          b["yun"]["refused"] < a["yun"]["refused"] * 0.6
          and abs(b["ju"]["rate"] - a["ju"]["rate"]) < 0.5
          and abs(b["yun"]["rate"] - a["yun"]["rate"]) < 0.5,
          f"韻 refused {a['yun']['refused']} -> {b['yun']['refused']} "
          f"({100.0 * (1 - b['yun']['refused'] / a['yun']['refused']):.1f}% "
          f"cut), 韻 rate {a['yun']['rate']:.1f}% -> {b['yun']['rate']:.1f}%, "
          f"句 control {a['ju']['rate']:.1f}% -> {b['ju']['rate']:.1f}%, "
          f"separation {a['yun']['rate'] - a['ju']['rate']:.1f} -> "
          f"{b['yun']['rate'] - b['ju']['rate']:.1f} pp")


def test_the_segmentation_is_re_derivable_offline():
    print("\n15. the staged corpus's LINE BREAKS re-derive from the committed "
          "1715 spec, with no clones and no network")
    import quality.build_ci_corpus as bci
    v = bci.verify_staged()
    st, bad = v["stats"], v["defects"]
    if not st["poems"]:
        check("the staged 四庫 corpus is present", False)
        return
    check("every staged poem's 詞牌 resolves in a COMMITTED table",
          st["unverifiable_no_such_tune"] == 0,
          f"{st['poems']} poems, {st['checked']} checked. 436 were "
          f"UNVERIFIABLE before data/qindingcipu_aliases.tsv existed: their "
          f"--- GE: header named a tune only a `git clone` of KR4j0086 could "
          f"resolve (doctrine 34, one level in)")
    check("every printed line break equals the 格's own line-end vector, and "
          "the 韻/句 marks and the --- RHYME / --- JU headers agree with it",
          st["segmentation_confirmed"] == st["poems"] and not bad,
          f"{st['segmentation_confirmed']} confirmed, "
          f"{st['partition_confirmed']} with a unique 韻/句 partition, "
          f"{st['partition_ambiguous']} declared ambiguous, "
          f"{sum(len(x) for x in bad.values())} defects")
    check("the census of positions that are NOT characters is reported rather "
          "than dropped, and it names the poem that is half lacuna",
          st["lacuna_tokens"] > 0 and st["entity_tokens"] > 0
          and max(n for n, _t in v["lacuna"].values()) >= 26,
          f"{st['entity_tokens']} &KRnnnn; in {len(v['entity'])} poems, "
          f"{st['lacuna_tokens']} □/○ in {len(v['lacuna'])}; 雙雁兒 其2's "
          f"entire second 片 is lacuna, and a lacuna run satisfies the "
          f"character-count match VACUOUSLY -- which is the only evidence the "
          f"segmentation is right, so it should have been refused")


if __name__ == "__main__":
    for fn in (test_standard_is_a_declared_coordinate,
               test_doctrine_36_demonstration_stays_runnable,
               test_the_hand_table_was_wrong_in_three_places,
               test_a_refusal_names_its_cause,
               test_readability_is_three_counts,
               test_the_tradition_test_ci_against_the_cipu,
               test_the_rejected_variant_is_measured_not_argued,
               test_the_partition_shows_through_practice,
               test_the_overlap_is_a_declared_coordinate,
               test_the_three_folds_disagree_on_a_real_polyphone,
               test_the_committed_ci_numbers_under_each_fold,
               test_tone_class_refusal_now_propagates,
               test_the_denominator_was_narrower_than_the_script,
               test_the_edition_is_a_coordinate_and_the_control_did_not_move,
               test_the_segmentation_is_re_derivable_offline):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all Middle Chinese regressions pass")
