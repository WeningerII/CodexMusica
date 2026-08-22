#!/usr/bin/env python3
"""Stage the Old Norse verse of `sveinbjornt/sagadb.org` -- `MISSING.md` K-4.

    python3 quality/stage_sagadb.py --src DIR --write   # cut the corpus files
    python3 quality/stage_sagadb.py --check             # do they re-derive?

THE RULING THIS RUNS UNDER, and it is the whole reason this file exists.
`data/sources.tsv`'s `sveinbjornt/sagadb.org` row carried `contested=true`
with the reason written out: *"an express PD affirmation exists (route 1), but
it is the compiler's assertion about the medieval WORK and cannot reach the
20th-century normalisation the text was copied from. contested=true is
deliberate and this needs a human call before the cell runs."* The call was
made by the owner on 2026-08-22, ADMIT, after waiting since 2026-08-11.
`quality/CORPUS_LOADING_PROTOCOL.md` requires exactly that: *"licence and
provenance verdicts go to the owner before anything enters the tree."*

AND THE RULING DOES NOT COVER EVERY MEMBER, WHICH IS A FINDING OF THIS
STAGING AND NOT OF THE ENTRY (doctrine 40 -- a licence on a compilation is
not a licence on its contents). The README affirms *"All saga source texts
are in the public domain"* over a compilation whose members declare FOUR
different upstreams, one of which refutes the affirmation in its own bytes:
`hrafnkels_saga_freysgoda.on.xml` carries
`<orig_publication>From reading selections from An Introduction to Old Norse
by E.V. Gordon and A.R. Taylor, second edition (Oxford University Press,
1956).</orig_publication>`. A.R. Taylor died 1985, so that member runs to
2055. It is REFUSED by name below -- and the refusal is FREE, because it
carries **0 poetry blocks**, measured rather than hoped.

WHY THIS IS A MODULE AND NOT A SCRIPT. The entry cites 585 dróttkvætt lines
"already extracted (`scratchpad/non_sagadb_drottkvaett.txt`)". That file is
GONE -- a dead session's scratchpad -- so a figure this repository has quoted
in its register for eleven days rests on a rule nobody can reproduce. Standing
rule 3: an improvised script used twice is a defect report, not a convenience.
The recipe is here now, and `--check` re-runs it.

WHAT IS *NOT* CLAIMED HERE, and refusing to claim it is the point. The edition
declares a metre for exactly TWO poems, in its own chapter titles: Egils saga
ch. 60 *"Egill flutti Höfuðlausn"* (runhent) and ch. 78 *"Egill kveðr
Sonatorrek ok Arinbjarnarkviðu"* (kviðuháttr). It says NOTHING about the
metre of anything else, and the verse is visibly mixed -- `eiriks_saga_rauda`
block 3 is short-lined eddic, `graenlendinga_saga`'s single block is
eight-syllable hrynhent, and `hrana_saga_hrings` is textually damaged
(`flot mírn á byrgota`). So this module SEPARATES the two named poems into
their own files and declares no metre for the rest. Calling the remainder
"dróttkvætt" would be this staging inventing a coordinate the source does not
carry (doctrine 45), and the hending measurement must instead ask
`quality/phonology/non.py` and count what it REFUSES (doctrine 79).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_DIR = os.path.join(ROOT, "corpus", "song")

#: member -> (verdict, reason). Every one of the eight, so a reader can see
#: what was looked at and not only what was taken (doctrine 39).
MEMBERS = {
    "egils_saga": ("ADMIT", "upstream Heimskringla.no, declared in the file's "
                            "own <sourcename>"),
    "gunnlaugs_saga_ormstungu": (
        "ADMIT-UNPROVENANCED",
        "<sourcename> and <sourceurl> are BOTH EMPTY -- this member names no "
        "upstream at all, and it is the second-largest verse contribution "
        "(181 of 1,228 lines, 14.7%). Admitted under the owner's ruling on "
        "the source, with the hole DISCLOSED here and in the staged file's "
        "own header rather than smoothed over: silence is not a citation."),
    "eiriks_saga_rauda": ("ADMIT", "upstream Heimskringla.no"),
    "graenlendinga_saga": ("ADMIT", "upstream Heimskringla.no"),
    "hrana_saga_hrings": (
        "ADMIT-DAMAGED",
        "<sourcename> is 'Digitally scanned book' and names no edition; the "
        "verse is visibly OCR-damaged (`flot mírn á byrgota`, `mírn` is not "
        "a Norse word). 14 lines. Staged with the damage declared, because a "
        "silently repaired text is worse than a disclosed broken one."),
    "haensna-thoris_saga": ("ADMIT-NO-VERSE",
                            "upstream Heimskringla.no; 0 poetry blocks"),
    "thorsteins_saga_hvita": ("ADMIT-NO-VERSE",
                              "upstream norse.ulver.com; 0 poetry blocks"),
    "hrafnkels_saga_freysgoda": (
        "REFUSE",
        "its own <orig_publication> names 'An Introduction to Old Norse by "
        "E.V. Gordon and A.R. Taylor, second edition (Oxford University "
        "Press, 1956)'. A.R. Taylor died 1985: life+70 runs to 2055. The "
        "compiler's blanket PD affirmation is FALSE of this member "
        "(doctrine 40). It carries 0 poetry blocks, so the refusal costs "
        "nothing -- measured, not assumed."),
}

#: Egils saga chapters whose metre the EDITION ITSELF names, in its chapter
#: titles. These are the only metre facts this source carries, and they are
#: the only ones this module states.
NAMED_POEMS = {
    "60": ("hofudlausn", "Höfuðlausn",
           "runhent -- END-RHYMED, and it carries no hendings"),
    "78": ("sonatorrek_arinbjarnarkvida", "Sonatorrek ok Arinbjarnarkviða",
           "kviðuháttr -- and it carries no hendings"),
}

_POETRY = re.compile(r"<poetry>(.*?)</poetry>", re.S)
_LINE = re.compile(r"<line>(.*?)</line>", re.S)
_CHAPTER = re.compile(r'<chapter number="(\d+)" title="(.*?)">(.*?)</chapter>',
                      re.S)
_META = re.compile(r"<%s>(.*?)</%s>")


def _meta(text, field):
    m = re.search(r"<%s>(.*?)</%s>" % (field, field), text, re.S)
    return (m.group(1).strip() if m else "")


def _clean(line):
    """One `<line>` -> one staged line. Entity decode, collapse whitespace.

    NOTHING ELSE. No orthographic normalisation, no repair of the damaged
    witness: this repository's whole Old Norse problem is an edition layer
    silently rewriting the channel the cell measures (K-4 §3, an OCR engine
    committing doctrine 45), and a stager that tidied would be the same
    defect with better manners.
    """
    s = line.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    s = s.replace("&quot;", '"').replace("&apos;", "'")
    return re.sub(r"\s+", " ", s).strip()


def blocks_of(text, base):
    """-> [(chapter, chapter_title, [line, ...]), ...] in document order."""
    out = []
    for num, title, body in _CHAPTER.findall(text):
        for b in _POETRY.findall(body):
            lines = [_clean(x) for x in _LINE.findall(b)]
            lines = [x for x in lines if x]
            if lines:
                out.append((num, title, lines))
    return out


#: The staged files, and what each one's header says about itself. `metre` is
#: EMPTY unless the edition names it -- evidence-or-blank, never a guess, the
#: same rule `quality/corpus_taxonomy.py` holds for region and function.
def _header(basename, title, upstream, metre, note, src_md5, src_bytes,
            src_file):
    lines = [
        "# author: ANONYMOUS. The sagas are 13th-century prose compilations and",
        "#         the verse inside them is attributed IN THE TEXT to named",
        "#         10th-11th century skalds. Neither layer has a living",
        "#         claimant: the works are medieval and the binding gate here",
        "#         is the EDITION, not the author (doctrine 80).",
        "# source: sveinbjornt/sagadb.org  src/%s" % src_file,
        "#         md5 %s, %s bytes, UTF-8." % (src_md5, src_bytes),
        "#         Cut by `python3 quality/stage_sagadb.py --write`; that module",
        "#         is the recipe and `--check` re-derives this file (the previous",
        "#         extraction lived in a scratchpad and did not survive its",
        "#         session, which is why the recipe now ships).",
        "#         Upstream declared by the source's own <sourcename>: %s" % upstream,
        "# licence: express PUBLIC DOMAIN affirmation by the compiler, quoted",
        "#         verbatim from README.md: 'All saga source texts are in the",
        "#         public domain.' The repository's License.txt is BSD-3-Clause",
        "#         (c) 2007 Sveinbjorn Thordarson and covers the Perl build",
        "#         scripts ONLY -- two separable layers, stated separately by",
        "#         the compiler himself (doctrine 54).",
        "#         ADMITTED BY OWNER RULING 2026-08-22 on `MISSING.md` K-4. The",
        "#         row had stood `contested=true` since 2026-08-11 with the",
        "#         reason recorded: the affirmation is the compiler's assertion",
        "#         about the medieval WORK and does not reach the 20th-century",
        "#         normalisation this text descends from. That residual is not",
        "#         resolved by the ruling; it is ACCEPTED by it, and it stays",
        "#         written here so no later reader mistakes a decision for a",
        "#         proof (doctrine 17).",
    ]
    if note:
        for i, chunk in enumerate(note):
            lines.append("# %s %s" % ("note:" if i == 0 else "     ", chunk))
    if metre:
        lines.append("# metre: %s" % metre)
        lines.append("#         NAMED BY THE EDITION ITSELF, in its chapter")
        lines.append("#         title. Every other staged file here leaves this")
        lines.append("#         field ABSENT, because the source declares no")
        lines.append("#         metre for them and this staging will not invent")
        lines.append("#         one (doctrine 45).")
    else:
        lines.append("# metre: UNDECLARED. The edition names a metre for only two")
        lines.append("#         poems (Höfuðlausn, Sonatorrek/Arinbjarnarkviða) and")
        lines.append("#         says nothing about this verse. It is NOT assumed to")
        lines.append("#         be dróttkvætt: the corpus is visibly mixed, and the")
        lines.append("#         question is one for `quality/phonology/non.py` to")
        lines.append("#         answer and REFUSE (doctrine 79), not for a stager.")
    return "\n".join(lines) + "\n"


def stage(src_dir):
    """-> {relative_path: text}. The whole staging, as a pure function."""
    out = {}
    for base, (verdict, _why) in sorted(MEMBERS.items()):
        if verdict == "REFUSE":
            continue
        path = os.path.join(src_dir, base + ".on.xml")
        if not os.path.exists(path):
            continue
        raw = io.open(path, "rb").read()
        md5 = hashlib.md5(raw).hexdigest()
        text = raw.decode("utf-8")
        blocks = blocks_of(text, base)
        if not blocks:
            continue
        title = _meta(text, "title")
        upstream = _meta(text, "sourcename") or "(NONE DECLARED)"
        note = []
        if verdict == "ADMIT-UNPROVENANCED":
            note = ["THIS MEMBER NAMES NO UPSTREAM. Its <sourcename> and",
                    "<sourceurl> are both empty in the source XML. Staged",
                    "under the owner's ruling on the source as a whole, with",
                    "the hole disclosed rather than smoothed over."]
        elif verdict == "ADMIT-DAMAGED":
            note = ["TEXTUALLY DAMAGED, and staged that way ON PURPOSE. The",
                    "upstream is 'Digitally scanned book' with no edition",
                    "named, and the verse carries OCR wreckage (`flot mírn á",
                    "byrgota` -- `mírn` is not a Norse word). Nothing here",
                    "repairs it: a silently mended text is the defect K-4 §3",
                    "records an OCR engine committing."]
        # Split out only the poems the EDITION names.
        groups = {}
        for num, ch_title, lines in blocks:
            if base == "egils_saga" and num in NAMED_POEMS:
                slug, poem, metre = NAMED_POEMS[num]
                key = (slug, poem, metre)
            else:
                key = ("lausavisur" if base == "egils_saga" else "", title, "")
            groups.setdefault(key, []).append((num, ch_title, lines))
        for (slug, disp, metre), items in groups.items():
            name = "non_" + base.replace("-", "_")
            if slug:
                name += "_" + slug
            rel = "corpus/song/%s.txt" % name
            body = [_header(name, disp, upstream, metre, note, md5,
                            f"{len(raw):,}", base + ".on.xml")]
            # The vísa index is PER CHAPTER and in document order, so a title
            # is stable under a re-run and cites the edition's own numbering
            # rather than a running total nobody can look up.
            seen = {}
            for num, ch_title, lines in items:
                seen[num] = seen.get(num, 0) + 1
                body.append("")
                body.append("--- TITLE: %s ch %s vísa %d"
                            % (disp, num, seen[num]))
                body.append("--- SOURCE: chapter %s, '%s'" % (num, ch_title))
                body.append("[VERSE 1]")
                body.extend(lines)
            out[rel] = "\n".join(body) + "\n"
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Stage sagadb.org's Old Norse verse (MISSING.md K-4). "
                    "Refuses one member by name; declares a metre only where "
                    "the edition does.")
    ap.add_argument("--src", help="a checkout's `src/` directory")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--check", action="store_true",
                    help="re-derive and compare against the staged files")
    a = ap.parse_args(argv)

    if a.check and not a.src:
        # THE CHECK NEEDS THE SOURCE AND SAYS SO RATHER THAN PASSING. A
        # re-derivation with nothing to derive FROM is doctrine 20's own case,
        # and this module exists because such a figure was quoted for eleven
        # days (see the module docstring).
        print("REFUSED — `--check` re-derives the staged files from the "
              "upstream XML and needs `--src DIR` to read it. Fetch:")
        print("  git clone --filter=blob:none --no-checkout --depth 1 \\")
        print("      https://github.com/sveinbjornt/sagadb.org.git")
        print("  then sparse-checkout `src/*.on.xml`.")
        print("RESULT: REFUSED (not a pass, not a failure -- doctrine 20)")
        return 2

    print("MEMBERS OF THE COMPILATION, and the verdict on each:")
    for base, (verdict, why) in sorted(MEMBERS.items()):
        print("  %-26s %-20s %s" % (base, verdict, why[:60]))
    print()

    staged = stage(a.src)
    if a.write:
        for rel, text in sorted(staged.items()):
            p = os.path.join(ROOT, rel)
            io.open(p, "w", encoding="utf-8").write(text)
            print("  wrote %-56s %5d lines" % (rel, text.count("\n")))
        return 0

    drift = []
    for rel, text in sorted(staged.items()):
        p = os.path.join(ROOT, rel)
        have = io.open(p, encoding="utf-8").read() if os.path.exists(p) else ""
        same = have == text
        print("  %-56s %s" % (rel, "re-derives" if same else "DRIFTED"))
        if not same:
            drift.append(rel)
    print()
    if drift:
        print("RESULT: DRIFT — %d staged file(s) no longer re-derive from the "
              "upstream XML: %s" % (len(drift), ", ".join(drift)))
        return 1
    print("RESULT: PASS — every staged file re-derives from the upstream XML")
    return 0


if __name__ == "__main__":
    sys.exit(main())
