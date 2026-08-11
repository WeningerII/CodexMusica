#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Reconstruct a ci (詞) corpus from sources that carry NO LIVING COPYRIGHT.

WHY THIS FILE EXISTS.  4,347 ci were located, extracted and validated by an
earlier cell and then REFUSED (doctrine 85): the digitiser's grant quoted in
the files is `資料自由使用，但不得為商業用途`, an express non-commercial
restriction, and the stated base of the ci half is 唐圭璋's 《全宋詞》 (1940,
d.1990).  That second ground is the sharper one -- the same cell measured that
his PUNCTUATION is the signal (45.2% rhyme agreement at 。-ends against 2.7% at
，-ends on a 2.8% null), so admitting the file would have built ON the
in-copyright contribution rather than around it.

THE UNBLOCK ROUTE, recorded beside the refusal and executed here:

    TEXT          kanripo/KR4j*  白文 (unpunctuated), `#+PROPERTY: BASEEDITION
                  WYG` = 文淵閣四庫全書, 1782.  No LICENSE file anywhere in the
                  Kanseki Repository, so admission rests on term expiry of the
                  WORK and of the EDITION -- the same footing 花間集 was
                  admitted on (doctrine 54: a licence name without a scope is
                  not evidence, and here there is no licence name at all).

    SEGMENTATION  data/qindingcipu_ge.tsv, the 欽定詞譜 of 1715, 2,286 of 2,294
                  格 across 817 詞牌, transcribed by hulbji/couyun (MIT) from an
                  imperial compilation three centuries out of any term.  It is
                  the tradition's own written specification of where a 句 ends
                  and which line ends are 韻 (doctrine 62).

The 1782 text has no punctuation.  The 1715 詞譜 supplies it FROM THE FORM
rather than from a 20th-century editor.  That is the whole of the argument.

THE MATCH MUST BE EXACT AND UNAMBIGUOUS.  A 白文 ci is admitted only when its
character count selects exactly one line-end vector among the 格 its 詞牌
declares.  Where more than one 格 fits, or none does, the poem is REFUSED and
counted -- a forced cut is a fabricated line boundary, and line boundaries are
what a rhyme detector reads.

WHAT IS *NOT* USED HERE, and why each was rejected rather than forgotten:

  * the 平仄 template as a tie-break.  Measured on the poems that ARE
    unambiguous: 4.8% of the positions the template mandates are violated and
    only 64.6% of poems violate none.  A strict falsifier would therefore
    eliminate the TRUE 格 in about a third of cases and hand the poem to a
    wrong one.  MEASURED AND REFUSED (--selftest prints it).
  * any minimum-violation or best-fit scoring.  That is the "loosen the matcher
    until something comes out" move the brief forbids, and it would put guessed
    line boundaries into a file whose only value is that its boundaries are not
    guessed.
  * the refused 網路展書讀 material, in any framing.  Not staged, not read,
    not used as a tie-break.

Run:
    python3 quality/build_ci_corpus.py --clones DIR --out corpus/song
    python3 quality/build_ci_corpus.py --clones DIR --selftest
    python3 quality/build_ci_corpus.py --clones DIR --measure

`--clones DIR` is a directory of `git clone https://github.com/kanripo/KR4jNNNN`
checkouts plus `git clone https://github.com/hulbji/couyun` (data/CHANNELS.md:
codeload is blocked, plain clone works).  Nothing here touches the network.
"""

import argparse
import collections
import csv
import glob
import hashlib
import json
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

GE_TSV = os.path.join(ROOT, "data", "qindingcipu_ge.tsv")

FW = "　"          # ideographic space: 片 break in the 四庫 body, field
                       # separator in its heading lines
PILCROW = "¶"     # mandoku's end-of-woodblock-column mark
ENT = re.compile(r"&[A-Za-z0-9]+;")     # a glyph with no Unicode point: ONE character
NUM = "一二三四五六七八九十"

#: headings that mean "same tune as the last one named"
REPEAT = {"又", "前調", "前題", "又一體", "前腔"}

#: repos in kanripo's 集部/詞曲類 that are NOT a ci text and must not be parsed
#: as one.  0086/0087/0089 are 詞譜/曲譜 (the spec, not the corpus -- using
#: their worked examples as corpus would score the 1715 spec against itself,
#: doctrine 13), 0090 is a 韻書, the rest are 詞話 (criticism).
NOT_CORPUS = {"KR4j0086", "KR4j0087", "KR4j0089", "KR4j0090",
              "KR4j0078", "KR4j0083", "KR4j0084", "KR4j0085", "KR4j0088"}

#: 花間集.  ALREADY STAGED from the independent 四印齋 witness as
#: corpus/song/ltc_huajianji.txt.  Excluded so the same 500 songs are not
#: counted twice; doctrine 87 says the two witnesses differ in bytes and each
#: corrects the other, which makes it a good CHECK and a bad second helping.
ALREADY_STAGED = {"KR4j0062"}

#: the 詞譜 repo, read for its 目録 only (tune names in the 四庫's own
#: orthography, and the 又名 it states).  Never parsed as corpus.
CIPU_REPO = "KR4j0086"

#: single-poet 別集 plus the specialised anthologies.  The general 選本
#: (詞綜, 御選歷代詩餘, 草堂詩餘, 花草稡編, ...) reprint from these, so the
#: 別集 are taken FIRST and the 選本 only contribute what the 別集 lack.
BIEJI = {"KR4j%04d" % i for i in list(range(1, 62)) + [63, 64, 72]}


# --------------------------------------------------------------------------
# text handling
# --------------------------------------------------------------------------

def strip_notes(s):
    """Remove (...) interlinear notes, including unbalanced and nested ones.

    The 四庫 prints editorial notes in half-size double columns; mandoku
    linearises them as `(right/left)`.  They are the annotator's words and
    would otherwise be counted as the poet's characters.  Some notes run
    across a woodblock column break, so the depth counter is deliberately
    tolerant of an unmatched `)`.
    """
    out = []
    depth = 0
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            if depth > 0:
                depth -= 1
        elif depth == 0:
            out.append(ch)
    return "".join(out)


def is_han(ch):
    o = ord(ch)
    return (0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF
            or 0xF900 <= o <= 0xFAFF or 0x20000 <= o <= 0x2FA1F)


def tokenize(s):
    """-> (tokens, pian).  One token is one character POSITION.

    An `&KRnnnn;` entity is a glyph with no Unicode code point and occupies one
    position; so does a `□` lacuna.  Both are kept, because dropping them would
    silently shorten the poem and make it match the wrong 格.  A FW space in
    the body is the woodblock's own 片 (stanza) break and is recorded as a
    position, not as a character.
    """
    toks, pian = [], []
    i = 0
    while i < len(s):
        m = ENT.match(s, i)
        if m:
            toks.append(m.group(0))
            i = m.end()
            continue
        ch = s[i]
        i += 1
        if ch == FW:
            if toks:
                pian.append(len(toks))
            continue
        if is_han(ch) or ch in "□○":
            toks.append(ch)
    return toks, pian


def cn2int(s):
    if s == "十":
        return 10
    if len(s) == 1 and s in NUM:
        return NUM.index(s) + 1
    if len(s) == 2 and s[0] == "十":
        return 10 + NUM.index(s[1]) + 1
    if len(s) == 2 and s[1] == "十":
        return (NUM.index(s[0]) + 1) * 10
    if len(s) == 3 and s[1] == "十":
        return (NUM.index(s[0]) + 1) * 10 + NUM.index(s[2]) + 1
    return None


# --------------------------------------------------------------------------
# the 1715 spec
# --------------------------------------------------------------------------

def load_ge(path=GE_TSV):
    """-> [格], each with its line-end vector derived from the spec's own columns.

    `groups` names the rhyme positions (two positions rhyme iff they share a
    group); `ju` names the line ends the spec marks 句, where it mandates NO
    rhyme.  A LINE END is either.  `du` is a 讀 -- a phrase break INSIDE a
    line -- and is deliberately not a line end here, because the 詞譜's own
    line is the 句.
    """
    with open(path, encoding="utf-8") as fh:
        lines = [l for l in fh if not l.startswith("#")]
    rows = list(csv.DictReader(lines, delimiter="\t"))
    for x in rows:
        groups = []
        for g in x["groups"].split("/"):
            s = frozenset(int(p) for p in g.split(".") if p)
            if s:
                groups.append(s)
        x["groups_f"] = frozenset(groups)
        x["rhyme_pos"] = frozenset().union(*groups) if groups else frozenset()
        x["ju_pos"] = frozenset(int(p) for p in x["ju"].split(".") if p)
        x["du_pos"] = frozenset(int(p) for p in x["du"].split(".") if p)
        x["ends"] = tuple(sorted(x["rhyme_pos"] | x["ju_pos"]))
        x["nchars"] = int(x["chars"])
        x["sig"] = (x["ends"], x["groups_f"], x["ju_pos"])
        assert x["ends"] and x["ends"][-1] == x["nchars"] - 1, x["tune"]
    return rows


# --------------------------------------------------------------------------
# tune-name resolution: THREE witnesses, none of them memory
# --------------------------------------------------------------------------

def siku_catalogue(clones):
    """-> [(tune, n_格)] in 詞譜 order, read from KR4j0086's 卷N目録.

    This is the SAME 1715 work as data/qindingcipu_ge.tsv, in a different
    witness: the 四庫's own orthography (栁 for 柳, 黄 for 黃, 巻 for 卷, 㸃 for
    點, 鬘 for 蠻).  Files 041+ of that repo are 詞律 (萬樹, 1687) bound after
    it and are excluded by the file-index bound, not by content.
    """
    cat = []
    for i in range(0, 41):
        f = os.path.join(clones, CIPU_REPO, "%s_%03d.txt" % (CIPU_REPO, i))
        if not os.path.exists(f):
            continue
        inmulu = False
        for line in open(f, encoding="utf-8"):
            line = line.rstrip("\n")
            if line.startswith("#+PROPERTY: JUAN"):
                juan = line.split("JUAN", 1)[1].strip()
                inmulu = bool(re.match(r"^卷[一二三四五六七八九十]+目[録錄]$", juan))
                continue
            if line.startswith("#") or line.startswith("<pb:") or not inmulu:
                continue
            if not line.endswith(PILCROW):
                continue
            b = strip_notes(line[:-1].lstrip(FW)).strip(FW)
            m = re.match(r"^(.+)([一二三四五六七八九十]+)體$", b)
            if not m:
                continue
            n = cn2int(m.group(2))
            if n:
                cat.append((m.group(1), n))
    return cat


def catalogue_aliases(clones):
    """-> {四庫 tune name: {又名, ...}} from KR4j0086's 目録.

    ONLY the notes whose second column is EMPTY are read.  A 四庫 double-column
    note such as `(又名重疊金花子夜歌溪菩薩鬘雲/花間意  梅  句  花  碧  晚)`
    interleaves six aliases across two half-columns and decoding it is a guess;
    `(又名江神子/)` is not.  Taking only the unambiguous half is doctrine 66
    -- refuse the tie-break rather than resolve it.
    """
    out = collections.defaultdict(set)
    cur = None
    for i in range(0, 41):
        f = os.path.join(clones, CIPU_REPO, "%s_%03d.txt" % (CIPU_REPO, i))
        if not os.path.exists(f):
            continue
        inmulu = False
        for line in open(f, encoding="utf-8"):
            line = line.rstrip("\n")
            if line.startswith("#+PROPERTY: JUAN"):
                juan = line.split("JUAN", 1)[1].strip()
                inmulu = bool(re.match(r"^卷[一二三四五六七八九十]+目[録錄]$", juan))
                cur = None
                continue
            if (line.startswith("#") or line.startswith("<pb:")
                    or not inmulu or not line.endswith(PILCROW)):
                continue
            b = line[:-1].lstrip(FW)
            bare = strip_notes(b).strip(FW)
            m = re.match(r"^(.+)([一二三四五六七八九十]+)體$", bare)
            if m:
                cur = m.group(1)
            elif bare:
                cur = None
                continue
            if cur is None:
                continue
            for g in re.finditer(r"\(([^()/]*)/([^()/]*)\)", b):
                left, right = g.group(1), g.group(2)
                if right.strip(FW + " "):
                    continue                    # two real columns -- refuse
                nm = left[2:] if left.startswith("又名") else left
                nm = nm.strip(FW + " ")
                if 2 <= len(nm) <= 8 and all(is_han(c) for c in nm):
                    out[cur].add(nm)
    return out


def align(A, B):
    """Global alignment of two ordered tune lists (Needleman-Wunsch).

    The two lists are the SAME 1715 catalogue seen twice: A from the 四庫
    woodblock, B from couyun's transcription.  Aligning them by ORDER (both
    run 短調 to 長調 and both are complete) is what identifies 歸字謡 with
    歸字謠 without anyone typing that pair in.  Doctrine 87: the point of two
    witnesses is independence, not agreement -- and here the disagreement IS
    the orthography map.
    """
    n, m = len(A), len(B)
    GAP = -4

    def sc(a, b):
        s = 0
        if a[0] == b[0]:
            s += 10
        else:
            common = sum(1 for x, y in zip(a[0], b[0]) if x == y)
            if len(a[0]) == len(b[0]) and len(a[0]) >= 2 and common >= len(a[0]) - 2:
                s += 6
            elif len(a[0]) == len(b[0]) and common > 0:
                s += 1
            else:
                s -= 2
        s += 3 if a[1] == b[1] else -1
        return s

    D = [[0] * (m + 1) for _ in range(n + 1)]
    P = [[None] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        D[i][0] = D[i - 1][0] + GAP
        P[i][0] = "U"
    for j in range(1, m + 1):
        D[0][j] = D[0][j - 1] + GAP
        P[0][j] = "L"
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d = D[i - 1][j - 1] + sc(A[i - 1], B[j - 1])
            u = D[i - 1][j] + GAP
            l = D[i][j - 1] + GAP
            if d >= u and d >= l:
                D[i][j], P[i][j] = d, "D"
            elif u >= l:
                D[i][j], P[i][j] = u, "U"
            else:
                D[i][j], P[i][j] = l, "L"
    i, j, out = n, m, []
    while i > 0 or j > 0:
        p = P[i][j]
        if p == "D":
            out.append((A[i - 1], B[j - 1]))
            i -= 1
            j -= 1
        elif p == "U":
            out.append((A[i - 1], None))
            i -= 1
        else:
            out.append((None, B[j - 1]))
            j -= 1
    out.reverse()
    return out


class Resolver(object):
    """Maps a 詞牌 heading printed in a 1782 woodblock onto the 1715 spec."""

    def __init__(self, ge, clones):
        self.ge = ge
        self.by_name = collections.defaultdict(list)
        for x in ge:
            for n in {x["tune"]} | {a for a in x["aliases"].split("|") if a}:
                self.by_name[n].append(x)

        seq = []
        for x in ge:
            if not seq or seq[-1][0] != x["tune"]:
                seq.append([x["tune"], 0])
            seq[-1][1] += 1
        self.couyun_seq = [tuple(s) for s in seq]

        self.catalogue = siku_catalogue(clones)
        self.name_map = {}
        charmap = collections.Counter()
        self.aligned_exact = 0
        for a, b in align(self.catalogue, self.couyun_seq):
            if not a or not b:
                continue
            if a[0] == b[0]:
                self.aligned_exact += 1
                continue
            if len(a[0]) != len(b[0]):
                continue
            diffs = [(x, y) for x, y in zip(a[0], b[0]) if x != y]
            if len(diffs) > 2:
                continue
            self.name_map[a[0]] = b[0]
            for x, y in diffs:
                charmap[(x, y)] += 1
        self.charmap = {x: y for (x, y), _ in charmap.items()}

        # a character-level orthography map may never merge two spec names
        coll = collections.defaultdict(set)
        for n in self.by_name:
            coll[self.norm(n)].add(n)
        self.charmap_collisions = {k: v for k, v in coll.items() if len(v) > 1}

        self.aliases = catalogue_aliases(clones)
        self.n_alias = 0
        for siku, als in self.aliases.items():
            cou = self.name_map.get(siku, siku)
            if cou not in self.by_name:
                cou = self.norm(siku)
            if cou not in self.by_name:
                continue
            for a in als:
                for g in self.by_name[cou]:
                    if g not in self.by_name[a]:
                        self.by_name[a].append(g)
                        self.n_alias += 1

    def norm(self, s):
        return "".join(self.charmap.get(c, c) for c in s)

    def resolve(self, nm):
        for k in (nm, self.name_map.get(nm), self.norm(nm)):
            if k and k in self.by_name:
                return k
        return None


# --------------------------------------------------------------------------
# the 白文 parser
# --------------------------------------------------------------------------

def parse_repo(repo_dir):
    """-> [item].  An item is one ci: a 詞牌 heading plus the running text under it.

    THE STRUCTURE THE 四庫 PRINTS, and nothing more.  A line indented by one or
    more FW spaces whose non-FW content is at most ten characters is a HEADING;
    everything else is body.  Length is counted with FW removed because the
    anthologies set two fields on one line (`　　秋閨　　　　　　秦少㳺`), and
    counting the spaces made those look like body text and swallowed them into
    the previous poem.

    An item is opened ONLY by a heading that names a tune, or by 又/前調/前題,
    or by a two-field title+author line under a tune already named.  Text under
    a 宫調 or a 卷 heading with no tune of its own is dropped rather than
    guessed at.
    """
    items = []
    rid = os.path.basename(repo_dir)
    for f in sorted(glob.glob(os.path.join(repo_dir, "KR4j*_*.txt"))):
        juan = None
        depth = 0
        cur = None
        last_tune = None
        last_person = None
        collection_author = None

        def close():
            if cur is not None and cur["raw"]:
                items.append(cur)

        for line in open(f, encoding="utf-8"):
            line = line.rstrip("\n")
            if line.startswith("#+PROPERTY: JUAN"):
                juan = line.split("JUAN", 1)[1].strip()
                continue
            if line.startswith("#") or line.startswith("<pb:"):
                continue
            if not line.endswith(PILCROW):
                continue
            b = line[:-1]
            start_depth = depth
            depth += b.count("(") - b.count(")")
            if depth < 0:
                depth = 0
            ind = len(b) - len(b.lstrip(FW))
            if start_depth == 0 and ind >= 1:
                content = ENT.sub("", strip_notes(b.lstrip(FW)).strip(FW))
                if content == "":
                    continue                    # blank column, or a pure note
                bare = content.replace(FW, "")
                if len(bare) <= 10:
                    close()
                    cur = None
                    if content in REPEAT:
                        if last_tune:
                            cur = {"tune": last_tune, "raw": "", "juan": juan,
                                   "file": f, "person": last_person,
                                   "head": content, "author": collection_author}
                        continue
                    if re.search(FW + "{2,}", content.strip(FW)):
                        parts = [x for x in re.split(FW + "{2,}", content.strip(FW)) if x]
                        if parts:
                            last_person = parts[-1]
                        if last_tune:
                            cur = {"tune": last_tune, "raw": "", "juan": juan,
                                   "file": f, "person": last_person,
                                   "head": content, "author": collection_author}
                        continue
                    m = re.search(r"[宋唐元明金清]" + FW + r"?(.{2,4})" + FW + r"?撰", content)
                    if m:
                        collection_author = m.group(1)
                        last_person = m.group(1)
                        continue
                    yield_tune = bare
                    if 2 <= len(bare) <= 4 and not re.search(
                            r"[卷巻部集調宫宮令慢引近序目録錄提要跋]", bare):
                        last_person = bare
                    last_tune = yield_tune
                    cur = {"tune": yield_tune, "raw": "", "juan": juan,
                           "file": f, "person": last_person, "head": content,
                           "author": collection_author}
                    continue
            if cur is not None:
                cur["raw"] += b
        close()
    for it in items:
        toks, pian = tokenize(strip_notes(it["raw"]))
        it["toks"] = toks
        it["pian"] = pian
        it["n"] = len(toks)
        it["repo"] = rid
    return items


def wyg_repos(clones):
    """-> [dir] for every kanripo ci text whose BASEEDITION is WYG.

    SBCK (四部叢刊) repos are excluded, not because a 1919-36 photo-facsimile
    adds authorship but because the refusal recorded ONE route and this is it:
    every file staged here says 文淵閣四庫全書, 1782, and one edition claim per
    corpus is worth more than a second argument per file.
    """
    out = []
    for d in sorted(glob.glob(os.path.join(clones, "KR4j*"))):
        rid = os.path.basename(d)
        if rid in NOT_CORPUS or rid in ALREADY_STAGED:
            continue
        fs = sorted(glob.glob(os.path.join(d, "KR4j*_*.txt")))
        if not fs:
            continue
        m = re.search(r"BASEEDITION (\S+)", open(fs[0], encoding="utf-8").read(400))
        if not m or m.group(1) != "WYG":
            continue
        out.append(d)
    return out


def repo_title(d):
    r = os.path.join(d, "Readme.org")
    if os.path.exists(r):
        m = re.search(r"#\+TITLE: (.*)", open(r, encoding="utf-8").read(300))
        if m:
            return m.group(1).split("/")[0].strip()
    return os.path.basename(d)


def repo_md5(d):
    h = hashlib.md5()
    for f in sorted(glob.glob(os.path.join(d, "KR4j*_*.txt"))):
        h.update(open(f, "rb").read())
    return h.hexdigest()


# --------------------------------------------------------------------------
# the match
# --------------------------------------------------------------------------

REFUSALS = ("R_no_tune", "R_no_ge_at_length", "R_pian_contradicts",
            "R_ends_ambiguous")


def match(it, res):
    """-> (格, unique_partition, reason).  格 is None iff the poem is refused.

    Three conditions, all of them tightenings, none of them a score:
      1. the 詞牌 must be a name the 1715 spec itself states;
      2. some 格 of that 詞牌 must have EXACTLY this character count;
      3. every 片 break the 1782 woodblock prints must fall on a line end of
         that 格 -- an independent witness, since the block-cutter knew nothing
         of the 詞譜 and the 詞譜 does not record 片 at all.
    What survives must agree on ONE line-end vector.  If it does not, refuse.
    """
    key = res.resolve(it["tune"])
    if key is None:
        return None, False, "R_no_tune"
    cands = [x for x in res.by_name[key] if x["nchars"] == it["n"]]
    if not cands:
        return None, False, "R_no_ge_at_length"
    if it["pian"]:
        cands = [x for x in cands
                 if all(p in {q + 1 for q in x["ends"]} for p in it["pian"])]
        if not cands:
            return None, False, "R_pian_contradicts"
    if len({x["ends"] for x in cands}) > 1:
        return None, False, "R_ends_ambiguous"
    return cands[0], len({x["sig"] for x in cands}) == 1, "S_matched"


def segment(it, ge):
    """-> [(line, mark)] with mark in {'韻', '句'}."""
    out = []
    p = 0
    for e in ge["ends"]:
        out.append(("".join(it["toks"][p:e + 1]),
                    "韻" if e in ge["rhyme_pos"] else "句"))
        p = e + 1
    return out


def build(clones, ge, res):
    """-> (staged, refused_counter, per_repo)."""
    staged = []
    refused = collections.Counter()
    for d in wyg_repos(clones):
        for it in parse_repo(d):
            refused["items"] += 1
            g, uniq, why = match(it, res)
            if g is None:
                refused[why] += 1
                continue
            refused["S_matched"] += 1
            refused["S_partition_unique" if uniq else "S_partition_ambiguous"] += 1
            staged.append({"it": it, "ge": g, "unique": uniq,
                           "tune": res.resolve(it["tune"]), "dir": d})
    return staged, refused


def dedupe(staged):
    """-> (kept, exact, near).  Doctrine 51: count DISTINCT BYTES.

    The 選本 (詞綜, 御選歷代詩餘, 草堂詩餘, ...) reprint the 別集; four
    different anthologies carrying one poet's poem are four URLs and one text.
    別集 are taken first, so a 選本 contributes only what the 別集 lack.  The
    near key is (tune, first ten characters), which catches the edition
    variants an exact key misses.
    """
    staged = sorted(staged, key=lambda z: (0 if z["it"]["repo"] in BIEJI else 1,
                                           z["it"]["repo"], z["it"]["file"]))
    seen_x, seen_n, kept = set(), set(), []
    exact = near = 0
    for s in staged:
        t = "".join(s["it"]["toks"])
        if t in seen_x:
            exact += 1
            continue
        nk = (s["tune"], t[:10])
        if nk in seen_n:
            near += 1
            continue
        seen_x.add(t)
        seen_n.add(nk)
        kept.append(s)
    return kept, exact, near


# --------------------------------------------------------------------------
# writing
# --------------------------------------------------------------------------

HEADER = """\
# collection: {title} ({rid}), 集部/詞曲類 of the Kanseki Repository.
#          {nsong} ci, {ntune} 詞牌.{author}
# source: kanripo/{rid} md5 {md5} over its KR4j*_*.txt files
#          (git clone https://github.com/kanripo/{rid} -- data/CHANNELS.md:
#          codeload is blocked, plain clone works).
# edition: NAMED IN THE FILE ITSELF. Every juan carries
#          '#+PROPERTY: BASEEDITION WYG' = 文淵閣四庫全書, the imperial
#          manuscript collectanea of 1782, and the 欽定四庫全書 headers are
#          printed in the text.
# licence: the Kanseki Repository ships NO LICENSE FILE of any kind. Admission
#          rests on term expiry of the WORK and of the EDITION and on nothing
#          else -- the same footing corpus/song/ltc_huajianji.txt was admitted
#          on (doctrine 54: a licence name without a scope is not evidence, and
#          here there is no licence name at all). The work is Song-to-Qing; the
#          edition is 1782 and its compilers died in the 18th century. No
#          living editorial layer is named anywhere in the chain.
# WHY THIS FILE AND NOT THE LARGER ONE: 4,347 ci were located and refused
#          (doctrine 85) because the digitiser's grant was express
#          NON-COMMERCIAL and the stated base was 唐圭璋's 全宋詞 (1940,
#          d.1990) -- whose PUNCTUATION was measured to BE the rhyme signal.
#          This file is the route recorded beside that refusal.
# segmentation: THE LINE BREAKS ARE NOT IN THE 1782 TEXT. It is 白文 -- no
#          punctuation at all -- broken at woodblock COLUMNS, which are not
#          metrical lines. Every line break below is the 欽定詞譜 of 1715
#          (data/qindingcipu_ge.tsv, from hulbji/couyun, MIT; the 詞譜 itself
#          is three centuries out of term), matched to the poem BY EXACT
#          CHARACTER COUNT under its own 詞牌. A poem whose count fits more
#          than one 格, or none, is REFUSED, not cut: see quality/
#          build_ci_corpus.py and the counts in the cell report.
# punctuation: DERIVED, NOT TRANSCRIBED. 。 stands where the 1715 詞譜 marks
#          韻/叶 and ， where it marks 句. The machine-readable form is the
#          --- RHYME and --- JU headers on each poem, which give 1-based LINE
#          numbers ('.' within a rhyme group, '/' between groups). Do not read
#          the punctuation as evidence about the text; it is the spec's.
# [VERSE n]: a 片, and this one IS the 1782 text's own. The woodblock prints a
#          full-width space at the 換頭; the 詞譜 does not record 片 at all.
#          Where the two disagree -- where that space does not fall on a 詞譜
#          line end -- the poem is refused, so every VERSE break here is
#          corroborated by two independent sources.
# annotation: the 四庫's double-column interlinear notes, printed (right/left),
#          are STRIPPED. They are the annotator's words.
# script:  TRADITIONAL, in the 1782 manuscript's own orthography (栁 綉 緑 别
#          宫 巻 黄 逺 髙). data/qieyun_variants.tsv reads most of these; the
#          per-file readable rate is in the cell report.
# attribution: {attrib}
"""


def slug(rid):
    return "ltc_siku_%s.txt" % rid.lower()


def write_files(kept, outdir, clones, dry=False):
    by_repo = collections.defaultdict(list)
    for s in kept:
        by_repo[s["it"]["repo"]].append(s)
    written = []
    for rid, items in sorted(by_repo.items()):
        d = os.path.join(clones, rid)
        title = repo_title(d)
        tunes = sorted({s["tune"] for s in items})
        authors = [s["it"].get("author") for s in items if s["it"].get("author")]
        colauth = collections.Counter(authors).most_common(1)
        single = colauth[0][0] if colauth and colauth[0][1] == len(items) else None
        if single:
            attrib = ("single-author 別集: the collection's own title page names "
                      "%s as 撰. Every poem carries it." % single)
            auth = "\n#          Author, from the collection's own title page: %s." % single
        else:
            attrib = ("POSITIONAL, and it may be one poet out at a boundary. This "
                      "is a 選本: the poet is the nearest preceding name heading "
                      "the woodblock prints, exactly as the page presents it. "
                      "Treat per-poet counts here as approximate.")
            auth = ""
        body = [HEADER.format(title=title, rid=rid, nsong=len(items),
                              ntune=len(tunes), md5=repo_md5(d),
                              attrib=attrib, author=auth)]
        seen_tune = collections.Counter()
        for s in items:
            it, ge = s["it"], s["ge"]
            seen_tune[s["tune"]] += 1
            k = seen_tune[s["tune"]]
            lines = segment(it, ge)
            # 1-based line index of every line end
            idx = {e: i + 1 for i, e in enumerate(ge["ends"])}
            groups = []
            for grp in sorted(ge["groups_f"], key=lambda g: min(g)):
                groups.append(".".join(str(idx[p]) for p in sorted(grp) if p in idx))
            ju = ".".join(str(idx[p]) for p in sorted(ge["ju_pos"]) if p in idx)
            title_s = s["tune"] if k == 1 else "%s 其%d" % (s["tune"], k)
            body.append("\n--- TITLE: %s  [air: %s]" % (title_s, s["tune"]))
            body.append("--- AUTHOR: %s" % (it.get("person") or it.get("author") or "(unnamed)"))
            body.append("--- SOURCE: %s %s / JUAN %s" % (rid, title, it.get("juan") or "-"))
            body.append("--- GE: 欽定詞譜 %s %d字%s" % (
                s["tune"], ge["nchars"],
                "" if s["unique"] else "  (line ends unique; 韻/句 partition NOT unique -- "
                                       "not used in the rhyme measurement)"))
            body.append("--- RHYME: %s" % ("/".join(g for g in groups if g) or "-"))
            body.append("--- JU: %s" % (ju or "-"))
            body.append("--- HEADING-AS-PRINTED: %s" % it["head"])
            pian = set(it["pian"])
            v = 1
            body.append("[VERSE 1]")
            p = 0
            for (ln, mk), e in zip(lines, ge["ends"]):
                if p in pian and p != 0:
                    v += 1
                    body.append("[VERSE %d]" % v)
                body.append(ln + ("。" if mk == "韻" else "，"))
                p = e + 1
        text = "\n".join(body) + "\n"
        path = os.path.join(outdir, slug(rid))
        if not dry:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(text)
        written.append((path, rid, title, len(items), len(tunes)))
    return written


# --------------------------------------------------------------------------
# measurement
# --------------------------------------------------------------------------

def measure(kept, seed=20260811):
    """Doctrine 79: mandated, judged and refused are three counts, always.

    Doctrine 41: the 句 arm is the MATCHED CONTROL and it is what makes the 韻
    number mean anything -- same poems, same kind of position (a line end the
    1715 spec names), same adjacency, and the spec mandates NO rhyme there. The
    null arm pairs line-end characters drawn at random across poems.
    """
    from quality.phonology.ltc import MiddleChinese
    out = {}
    for std in ("cilin", "pingshui"):
        ltc = MiddleChinese(standard=std)

        def arm(pairs):
            T = F = R = 0
            for a, b in pairs:
                v = ltc.rhymes(a, b, standard=std)
                if v is None:
                    R += 1
                elif v:
                    T += 1
                else:
                    F += 1

            return {"mandated": len(pairs), "judged": T + F, "refused": R,
                    "true": T, "rate": (100.0 * T / (T + F)) if T + F else None}

        yun, ju, ends = [], [], []
        for s in kept:
            if not s["unique"]:
                continue
            t, g = s["it"]["toks"], s["ge"]
            for grp in g["groups_f"]:
                ps = sorted(grp)
                for x, y in zip(ps, ps[1:]):
                    yun.append((t[x], t[y]))
            ps = sorted(g["ju_pos"])
            for x, y in zip(ps, ps[1:]):
                ju.append((t[x], t[y]))
            for e in g["ends"]:
                ends.append(t[e])
        random.seed(seed)
        null = [(random.choice(ends), random.choice(ends)) for _ in range(20000)]
        out[std] = {"yun": arm(yun), "ju": arm(ju), "null": arm(null),
                    "poems_measured": sum(1 for s in kept if s["unique"])}

    ltc = MiddleChinese(standard="cilin")
    txt = "".join("".join(s["it"]["toks"]) for s in kept)
    out["readability"] = ltc.readability(txt)
    return out


def selftest(clones, ge, res):
    """The matcher's own positive control, and its matched negative.

    couyun ships, with every 格, the WORKED EXAMPLE the 詞譜 prints for it,
    punctuated (`origin_trad`). Strip that punctuation and you have a 白文 ci
    whose true segmentation is known. Running the matcher on it measures two
    things nothing else can:

      A  on the poems the matcher calls UNAMBIGUOUS, does it recover the true
         line breaks?  (It must be 100%; anything less is a bug.)
      B  on the poems it REFUSES as ambiguous, how often would a tie-break have
         been WRONG?  That is the price of the refusals, measured instead of
         assumed -- and it is the answer to 'why not just pick the first 格'.

    Also prints the 平仄 template diagnostic that rules the template out as a
    tie-break.
    """
    idx = os.path.join(clones, "couyun", "couyun", "ci_pu", "ci_index.json")
    lst = os.path.join(clones, "couyun", "couyun", "ci_pu", "ci_list")
    if not os.path.exists(idx):
        print("selftest needs `git clone https://github.com/hulbji/couyun` "
              "under --clones; skipping")
        return None
    index = json.load(open(idx, encoding="utf-8"))
    by_tune = collections.defaultdict(list)
    for x in ge:
        by_tune[x["tune"]].append(x)
    n = a_ok = a_bad = b_ok = b_bad = 0
    skipped = 0
    for entry in index:
        tune = entry["names_trad"][0]
        f = os.path.join(lst, "cipai_%d.json" % entry["idx"])
        if not os.path.exists(f) or tune not in by_tune:
            continue
        raw = json.load(open(f, encoding="utf-8"))
        rows = by_tune[tune]
        if len(raw) != len(rows):
            skipped += 1          # 格 refused by the TSV builder; not alignable
            continue
        for src, row in zip(raw, rows):
            poem = src.get("origin_trad") or ""
            toks = [c for c in poem if is_han(c)]
            if len(toks) != row["nchars"]:
                skipped += 1
                continue
            true_ends = []
            k = -1
            for c in poem:
                if is_han(c):
                    k += 1
                elif c in "。，、？！":
                    true_ends.append(k)
            it = {"tune": tune, "toks": toks, "n": len(toks), "pian": [],
                  "head": tune, "repo": "SELFTEST"}
            n += 1
            g, uniq, why = match(it, res)
            if g is not None:
                if tuple(g["ends"]) == tuple(row["ends"]):
                    a_ok += 1
                else:
                    a_bad += 1
            else:
                if why == "R_ends_ambiguous":
                    cands = [x for x in res.by_name[res.resolve(tune)]
                             if x["nchars"] == it["n"]]
                    if tuple(cands[0]["ends"]) == tuple(row["ends"]):
                        b_ok += 1
                    else:
                        b_bad += 1
    print("SELFTEST on the 詞譜's own worked examples (%d 格 read, %d unalignable)"
          % (n, skipped))
    print("  A  accepted as unambiguous : %d, line ends recovered correctly %d, "
          "WRONG %d" % (a_ok + a_bad, a_ok, a_bad))
    if b_ok + b_bad:
        print("  B  refused as ambiguous    : %d; a first-candidate tie-break "
              "would have been right %d (%.1f%%) and WRONG %d (%.1f%%)"
              % (b_ok + b_bad, b_ok, 100.0 * b_ok / (b_ok + b_bad),
                 b_bad, 100.0 * b_bad / (b_ok + b_bad)))
    return {"n": n, "accepted": a_ok + a_bad, "accepted_correct": a_ok,
            "accepted_wrong": a_bad, "refused": b_ok + b_bad,
            "tiebreak_would_be_right": b_ok, "tiebreak_would_be_wrong": b_bad}


def template_diagnostic(kept):
    """Why the 平仄 template is not used as a tie-break. Numbers, not an opinion."""
    from quality.phonology.ltc import MiddleChinese
    ltc = MiddleChinese(standard="cilin")
    tot = viol = unk = 0
    clean = 0
    npo = 0
    for s in kept:
        if not s["unique"]:
            continue
        npo += 1
        t, tm = s["it"]["toks"], s["ge"]["template"]
        v = c = 0
        for i, ch in enumerate(t):
            if i >= len(tm) or tm[i] == "中":
                continue
            tc = ltc.tone_class(ch)
            if tc is None:
                unk += 1
                continue
            c += 1
            if (tc == 1) != (tm[i] == "平"):
                v += 1
        tot += c
        viol += v
        if v == 0:
            clean += 1
    return {"positions_judged": tot, "violated": viol,
            "rate": 100.0 * viol / tot if tot else None,
            "tone_unknown": unk, "poems": npo,
            "poems_with_zero_violations": clean}


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clones", required=True)
    ap.add_argument("--out", default=os.path.join(ROOT, "corpus", "song"))
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--measure", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--report")
    args = ap.parse_args()

    ge = load_ge()
    res = Resolver(ge, args.clones)
    print("DECLARATION")
    print("  text          kanripo/KR4j* 白文, BASEEDITION WYG (文淵閣四庫全書, 1782)")
    print("  segmentation  data/qindingcipu_ge.tsv -- 欽定詞譜 1715, %d 格 / %d 詞牌"
          % (len(ge), len({x['tune'] for x in ge})))
    print("  match rule    exact character count under a 詞牌 the spec names, one "
          "line-end vector, every 片 on a line end; else REFUSE")
    print("  name witness  KR4j0086 目録 aligned to couyun order: %d exact, %d "
          "orthographic pairs, %d char substitutions, %d collisions; %d 又名 "
          "links from single-column notes"
          % (res.aligned_exact, len(res.name_map), len(res.charmap),
             len(res.charmap_collisions), res.n_alias))

    if args.selftest:
        selftest(args.clones, ge, res)

    staged, counts = build(args.clones, ge, res)
    kept, ex, nr = dedupe(staged)
    print("\nSEGMENTATION YIELD (doctrine 79: refused is its own count)")
    print("  items parsed              %6d" % counts["items"])
    for k in REFUSALS:
        print("  REFUSED %-24s %6d" % (k[2:], counts[k]))
    print("  matched                   %6d  (partition unique %d, ambiguous %d)"
          % (counts["S_matched"], counts["S_partition_unique"],
             counts["S_partition_ambiguous"]))
    print("  duplicates dropped        %6d exact + %d near" % (ex, nr))
    print("  STAGED                    %6d ci, %d 詞牌"
          % (len(kept), len({s["tune"] for s in kept})))

    if not args.selftest:
        written = write_files(kept, args.out, args.clones, dry=args.dry_run)
        print("  files                     %6d" % len(written))
    else:
        written = []

    rep = {"counts": dict(counts), "dupes": {"exact": ex, "near": nr},
           "staged": len(kept), "tunes": len({s["tune"] for s in kept}),
           "files": [{"path": p, "repo": r, "title": t, "songs": n, "tunes": u}
                     for p, r, t, n, u in written]}
    if args.measure or args.selftest:
        rep["measure"] = measure(kept)
        rep["template"] = template_diagnostic(kept)
        m = rep["measure"]
        for std in ("cilin", "pingshui"):
            d = m[std]
            print("\nRHYME, standard=%r  (%d poems with a unique 韻/句 partition)"
                  % (std, d["poems_measured"]))
            for arm in ("yun", "ju", "null"):
                x = d[arm]
                print("  %-5s mandated %6d  judged %6d  refused %5d  True %5.1f%%"
                      % ({"yun": "韻", "ju": "句", "null": "null"}[arm],
                         x["mandated"], x["judged"], x["refused"], x["rate"]))
        r = m["readability"]
        print("\nREADABILITY  total %d  read %d (%.2f%%)  refused %d  unread %d  %s"
              % (r["total"], r["read"], 100.0 * r["read"] / r["total"],
                 r["refused"], r["unread"], r["by_cause"]))
        t = rep["template"]
        print("TEMPLATE (why it is not a tie-break): %.1f%% of %d mandated 平仄 "
              "positions are violated on poems whose 格 is CERTAIN; only %d of "
              "%d poems violate none."
              % (t["rate"], t["positions_judged"],
                 t["poems_with_zero_violations"], t["poems"]))
    if args.report:
        json.dump(rep, open(args.report, "w"), ensure_ascii=False, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
