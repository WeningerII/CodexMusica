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


if __name__ == "__main__":
    for fn in (test_standard_is_a_declared_coordinate,
               test_doctrine_36_demonstration_stays_runnable,
               test_the_hand_table_was_wrong_in_three_places,
               test_a_refusal_names_its_cause,
               test_readability_is_three_counts,
               test_the_tradition_test_ci_against_the_cipu,
               test_the_rejected_variant_is_measured_not_argued,
               test_the_partition_shows_through_practice):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all Middle Chinese regressions pass")
