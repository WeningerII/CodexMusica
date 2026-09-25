#!/usr/bin/env python3
"""SOURCED TABLES for the schemas that otherwise answer only on a fixture.

`quality/schema_census.py` names five schemas that are askable and answer
ONLY on a fixture the census itself declares (doctrine 94): `dialect rhyme`,
`historical rhyme`, `proest`, `rhyming slang` and the `平仄 tonal template`.
What each one lacks is a sourced TABLE, not code (doctrine 44). This module is
where such a table lives once it has a citation, in the shape the existing
constructor already expects, with the witness and contrast it is graded on
(the grading itself is `quality/figure_exhibits.py`'s, 2026-09-25).

ONE TABLE SHIPS, AND OF ITS FOUR FORMS ONLY THE ONE WHOSE LICENCES WERE SEEN
(`REFUSED_FORMS`, review of #396). FOUR TABLES DO NOT, AND EACH SAYS WHY
(2026-09-25); `data/sources.tsv` carries a SEARCH: row for each. The sourcing
session could reach GitHub and a search engine's result snippets and nothing
else — every host serving the primary texts (Project Gutenberg, the Internet
Archive, Wikisource, Wikipedia, Green's Dictionary of Slang, the Victorian Web)
was refused by the network policy. A table built under that access is only as
good as what could be checked, so `UNSOURCED` records, per schema, the source
that would lift the refusal and the reason it was not written from memory.
`declared_inputs.PeriodPhonology` itself refuses "a period pronunciation
written from memory", and that refusal is the one this module keeps.

THE 平仄 TEMPLATE IS THE FORM'S, NEVER THE TEXT'S (`relations.
declare_tonal_template`). What ships is the regulated-verse base pattern as a
published prosody states it, so a caller asks "does this 五言絕句 fit the 仄起
pattern?" against Wang Li's table rather than against a pattern it typed.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ---------------------------------------------------------------------------
# 1. 平仄 — ONE 五言絕句 base pattern (R44), and three refused
# ---------------------------------------------------------------------------
#: THE ORIGIN, AS ATTRIBUTED. Wang Li 王力, 《詩詞格律》 (Beijing: 中華書局,
#: 1962; rev. 1977), ch. 2 「律詩」, §「律詩的平仄」; the same patterns stand in
#: his 《漢語詩律學》 (上海: 新知識出版社, 1958), ch. 1 「近體詩」. NEITHER BOOK
#: WAS READ. No page is given because none was seen.
#:
#: WHAT WAS ACTUALLY READ (2026-09-25), and it is all this table rests on:
#: search-engine result text for two pages that quote Wang Li — the tangshui
#: reading notes 「王力诗词格律浅读」 (m.tangshui.net/biji/show/
#: 6105173d105c5c666092ab96) and 蔡振念〈王力五言律詩兩種格式補證〉,
#: 《成大中文學報》 20 (2008), PDF at chinese.ncku.edu.tw/var/file/142/1142/img/
#: 1450/2004.pdf. Both hosts refuse at the egress proxy, so neither page body
#: was opened; `data/sources.tsv` row `NOTE:pingze-wujue-wang-li-as-read`
#: records the two URLs, the access, and this attribution. What the result
#: text showed:
#:   * the four line types 仄仄平平仄 / 平平仄仄平 / 平平平仄仄 / 仄仄仄平平,
#:     "五言只有四種平仄句型，可以構成兩聯";
#:   * ONE quatrain with Wang Li's parenthesised licences, the 仄起 首句不入韻
#:     one: "(仄)仄平平仄，平平仄仄平 / (平)平平仄仄，(仄)仄仄平平";
#:   * 對 (a couplet's two lines opposed) and 粘 (the next couplet's first line
#:     adhering at position 2 to the line before it).
#:
#: SO ONE FORM SHIPS (review of #396, 2026-09-25). A quatrain derived by 對/粘
#: carries the base pattern, but the 中 licences are the source's and are
#: stated per FORM as he prints each one; none was seen for the other three,
#: and moving the one seen quatrain's licences onto them by line type would be
#: writing his table from inference. `REFUSED_FORMS` records the three and
#: why; asking for one raises rather than answering on a derived pattern.
#:
#: THE ALPHABET is `relations.TONE_MARKS`: 平, 仄, and 中 (可平可仄) for a
#: position the source marks free. Wang Li's parentheses become 中, and
#: nothing else does. A strict reader who wants the unlicensed 正格 can ask
#: for it: `strict=True` below turns every 中 back into the mark it brackets.
REGULATED_VERSE_SOURCE = (
    "Wang Li 王力, 《詩詞格律》 (中華書局, 1962; rev. 1977), ch. 2 "
    "「律詩的平仄」; also 《漢語詩律學》 (1958), ch. 1 — attributed, not read. "
    "As read (2026-09-25): search-result text quoting Wang Li for "
    "m.tangshui.net 王力诗词格律浅读 and 蔡振念 2008, chinese.ncku.edu.tw "
    "(data/sources.tsv NOTE:pingze-wujue-wang-li-as-read). No page seen.")

#: {form key: (lines, strict lines)}. `lines` carries 中 exactly where the
#: source brackets a licence; `strict` is the bracketed mark itself.
WUJUE = {
    # 仄起, first line not rhyming — the form of 登鸛雀樓, and the one
    # quatrain whose licences were seen, as quoted above.
    "五絕 仄起 首句不入韻": (
        ("中仄平平仄", "平平仄仄平", "中平平仄仄", "中仄仄平平"),
        ("仄仄平平仄", "平平仄仄平", "平平平仄仄", "仄仄仄平平")),
}

_REFUSED_WHY = (
    "REFUSED, not derived: the base pattern follows from 對/粘, but Wang Li "
    "states the 中 licences per form and this form's were not in what was "
    "read (search-result text only; the tangshui and NCKU pages refuse at "
    "the egress proxy). Lifts when his table for it is read, at the page.")

#: The three 五絕 forms NOT shipped, each with the reason (doctrine 39).
REFUSED_FORMS = {
    "五絕 仄起 首句入韻": _REFUSED_WHY,
    "五絕 平起 首句不入韻": _REFUSED_WHY,
    "五絕 平起 首句入韻": _REFUSED_WHY,
}


def regulated_template(form, strict=False):
    """-> {0-based line: pattern} for one 五絕 form in `WUJUE`."""
    if form not in WUJUE:
        why = REFUSED_FORMS.get(form, "not a form this module records")
        raise KeyError(f"{form!r} is not a sourced form ({why}); sourced: "
                       f"{sorted(WUJUE)}")
    lines, strict_lines = WUJUE[form]
    return dict(enumerate(strict_lines if strict else lines))


def declare_regulated_template(stream, form, strict=False):
    """Declare a SOURCED 五絕 pattern on `stream`. -> the summary dict
    `relations.declare_tonal_template` returns, whose `source` names the
    form and Wang Li rather than the caller."""
    from quality import relations as R
    return R.declare_tonal_template(
        stream, regulated_template(form, strict),
        source=f"{form}{' (正格, strict)' if strict else ''} — "
               f"{REGULATED_VERSE_SOURCE}")


# ---------------------------------------------------------------------------
# 2. WHAT IS NOT SOURCED, AND EXACTLY WHAT WOULD SOURCE IT
# ---------------------------------------------------------------------------
#: One row per schema still answering only on the census fixture. Each names
#: the source it needs and why the table was not written in the session that
#: shipped section 1 (doctrine 39: record a failed source search as a row).
UNSOURCED = {
    "historical rhyme": (
        "a period phonology with a named reconstruction, e.g. E. J. Dobson, "
        "English Pronunciation 1500-1700 (2nd ed., Oxford: Clarendon, 1968), "
        "or D. Crystal, The Oxford Dictionary of Original Shakespearean "
        "Pronunciation (Oxford UP, 2016), read at the page for each row. "
        "Not written: neither text was reachable, and the only corroboration "
        "found for even one row (Pope's tea/obey, 1712-14) was tertiary. "
        "`PeriodPhonology` refuses a pronunciation written from memory."),
    "dialect rhyme": (
        "a dialect phonology with a named description, e.g. A. J. Aitken's "
        "account of Scots vowels, or P. Johnston, 'Regional variation', in "
        "C. Jones (ed.), The Edinburgh History of the Scots Language "
        "(Edinburgh UP, 1997). Not written: unreachable, and a dialect is "
        "the same constructor with the same refusal as a period."),
    "proest": (
        "a Welsh vowel-quantity description, e.g. J. Morris-Jones, A Welsh "
        "Grammar, Historical and Comparative (Oxford: Clarendon, 1913), or "
        "D. A. Thorne, A Comprehensive Welsh Grammar (Oxford: Blackwell, "
        "1993). Not written, and a SECOND reason beside access: the "
        "descriptions state stressed-vowel length as a function of the "
        "FOLLOWING consonant (in the usual summary, which is itself not a "
        "table and is not offered as one: long before a single voiced stop "
        "or fricative, short before a voiceless stop or a cluster, and "
        "varying before l, n, r, where Welsh spelling may mark it with a "
        "circumflex), while `quotient:vowel_class` "
        "is `nucleus -> class` and never sees the coda. A sourced table in "
        "the shape the constructor expects cannot hold the rule the sources "
        "state; the quotient would need the syllable, which is a code change "
        "and is not made here."),
    "rhyming slang": (
        "a dated slang register, e.g. J. C. Hotten, A Dictionary of Modern "
        "Slang, Cant, and Vulgar Words (London: Hotten, 1859), 'Glossary of "
        "the Rhyming Slang', or J. Franklyn, A Dictionary of Rhyming Slang "
        "(London: Routledge & Kegan Paul, 2nd ed. 1961). Not written. A full "
        "phrase's final word already rhymes its referent, so on those rows "
        "the slang surface agrees with the phonemic one and a witness "
        "through them would pass for the wrong reason (doctrine 41); only a "
        "CLIPPED form separates the surfaces. ~~No page could be read and no "
        "clipping was attested~~ — superseded 2026-09-25 (doctrine 49): the "
        "1860 and 1874 editions are on the GITenberg channel, and the 1874 "
        "footnote [56] attests 'lord' clipped from 'lord of the manor' "
        "(data/sources.tsv SEARCH:rhyming-slang-register). What is missing "
        "now is the WORK — the projected surface built from those rows and "
        "a real cited line using a clipped form as witness — not the "
        "source."),
}


# ---------------------------------------------------------------------------
# 3. THE WITNESS AND CONTRAST the sourced table is graded on
# ---------------------------------------------------------------------------
#: 登鸛雀樓 (王之渙), a 五絕 仄起 首句不入韻. Held to Wang Li's pattern every
#: line fits, and 更 — a 多音字 whose readings split 平/仄 — falls on a
#: position the source marks free. The CONTRAST is the same twenty characters
#: with each couplet's lines swapped (constructed, doctrine 94: a negative
#: control, not evidence of the tradition): the same tone readings, held to
#: the same pattern, and no line fits, because 對 puts each line's opposite in
#: its slot. GRADED IN `quality/figure_exhibits.py` (2026-09-25, review of
#: #396), the intra-line route that reads a one-line template, which declares
#: this table there; the separate grade this module used to run for
#: `schema_census.py` (`SOURCED_EXHIBITS`) is retired into that route.
TONAL_WITNESS = ("白日依山盡", "黃河入海流", "欲窮千里目", "更上一層樓")
TONAL_CONTRAST = ("黃河入海流", "白日依山盡", "更上一層樓", "欲窮千里目")
TONAL_FORM = "五絕 仄起 首句不入韻"


if __name__ == "__main__":
    print(f"SOURCED ({len(WUJUE)}):")
    for form in WUJUE:
        print(f"  {form}: {' / '.join(regulated_template(form).values())}")
    print(f"REFUSED FORMS ({len(REFUSED_FORMS)}): {', '.join(REFUSED_FORMS)}")
    print(f"NOT SOURCED ({len(UNSOURCED)}):")
    for name, why in UNSOURCED.items():
        print(f"  {name}\n    {why}")
