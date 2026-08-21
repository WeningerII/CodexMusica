#!/usr/bin/env python3
"""Re-derive the mechanical claims `data/sources.tsv` makes about `data/`.

THE GAP THIS CLOSES, and it is the last of the four found on 2026-08-21.
`audit_corpus.py` check C already re-derives the recorded md5 of every file
under `corpus/`. Nothing did the same for `data/` -- so when `66eb44e` rebuilt
`data/song_endword_en.tsv` and `data/song_rhymepair_en.tsv` over the loaded
corpus, both rows went on describing the files they replaced (46,860 rows /
1,627,624 bytes against 131,373 / 4,764,993) for three commits, and no
instrument in the repo could have noticed. They were fixed by hand, which is
the fix that does not stay fixed.

WHAT IS CHECKED, and it is deliberately only what a machine can settle:
`md5 <hex32>`, `N bytes`, `N rows`. Everything else in these rows -- licences,
refusal arguments, provenance narratives -- is prose that a human has to
judge, and pretending otherwise would be worse than not checking.

THE ROW-COUNT RULE IS DECLARED, because "rows" has no meaning until someone
says so (doctrine 1): a `rows` claim counts lines that are neither blank, nor
`#`-comments, nor the header — and the header is LOCATED rather than assumed,
because this repo uses both conventions (a bare header line in
`song_endword_en.tsv`, a commented one in `g2p_letter_rules.tsv`). The first
draft assumed the bare convention and accused a CORRECT row of being off by
one on its first run. `data_rows()` carries the rule and the case that forced
it. It was run over all 15 `data/` rows before it was trusted and reproduces
every whole-file count.

FOUR THINGS IT REFUSES TO READ AS CLAIMS ABOUT THE ARTIFACT, each one a false
positive the first draft actually produced (doctrine 61 -- a rule that fires
more often is not a better rule, and a gate with false positives is one nobody
reads):

  * STRUCK text. `~~46,860 rows, 1,627,624 bytes~~` is a doctrine-17 record of
    a superseded value. Reading it as a live claim would make the repo's own
    convention for keeping history fail this check -- the exact inversion.
  * QUALIFIED md5s. `upstream md5 370a7a55…` on the OpenSubtitles row and
    `repo md5 39383497…` on the qindingcipu row are hashes of the SOURCE, not
    of the staged artifact. Both are correct as written.
  * COMPOUND MODIFIERS. `a 10,914-row S stress model` is one component of
    `g2p_letter_rules.tsv`, not its total.
  * ABSENT-BUT-IGNORED files. `data/nltk/corpora/cmudict` is fetched, not
    committed; absent from a clean checkout BY DESIGN.

FIVE COUNTS, NEVER SUMMED (doctrine 79). `skipped` is printed rather than
dropped, because a gate that silently declines to check something reads
exactly like one that checked it and was satisfied (doctrine 20).

Usage: python3 quality/check_data_rows.py [--verbose]
Exit 0 when every unqualified claim re-derives; 1 otherwise.
"""

import csv
import hashlib
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
SOURCES = os.path.join(ROOT, "data", "sources.tsv")

#: A doctrine-17 strike. Removed before anything is read as a claim.
STRUCK = re.compile(r"~~.*?~~", re.S)

#: Words that make a hash belong to something OTHER than the staged file.
QUALIFIER = r"(?:upstream|repo|source|remote|original|their|its\s+own)\s+"
MD5_RE = re.compile(r"(?<!-)\bmd5\s+([0-9a-f]{32})\b")
MD5_QUALIFIED = re.compile(QUALIFIER + r"md5\s+([0-9a-f]{32})\b", re.I)
#: `10,914-row` is a compound modifier on a COMPONENT, never a whole-file total.
BYTES_RE = re.compile(r"\b([\d,]{3,})\s+bytes\b")
#: A row count is a WHOLE-FILE claim only when nothing restricts it. A
#: restrictive continuation makes it a sub-count of the same file --
#: `data/authority.tsv` says "13,997 data rows" AND "13,797 rows carry a death
#: year", and both are true. Reading the second as a rival total would accuse
#: a correct row; reading only the first-by-position would be picking a number
#: by where it sits on the line, which is what the STRUCK mutation exposed.
ROWS_SUBCOUNT = (r"(?:carry|carries|of\s+which|have|has|are|contain|contains|"
                 r"name|names|fail|fails|reach|reaches|sit|sits)")
ROWS_RE = re.compile(r"\b([\d,]{3,})\s+(?:data\s+)?rows\b(?!\s+"
                     + ROWS_SUBCOUNT + r"\b)")


def data_rows(path):
    """The DECLARED row rule: lines that are neither blank, nor `#`-comments,
    nor the header — with the header located rather than assumed.

    THIS REPO USES BOTH HEADER CONVENTIONS, and the first draft of this rule
    assumed one. `data/song_endword_en.tsv` writes a bare header line;
    `data/g2p_letter_rules.tsv` writes `#kind\tlevel\tkey\tphones\tcount`,
    a header INSIDE the comment block. Skipping `#` lines and then dropping
    the first survivor drops a real data row on the second convention, which
    is exactly the off-by-one that made this gate accuse a correct row
    (23,196 claimed, 23,195 counted) on its first run.

    So the header is FOUND: if any comment line carries the same tab-field
    count as the first body line, the header is commented and every body line
    is data. Otherwise the first body line is the header. Mechanical, and it
    reproduces every whole-file `rows` claim in `data/sources.tsv`.
    """
    body, commented = [], []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if not line.strip():
                continue
            (commented if line.startswith("#") else body).append(
                line.rstrip("\n"))
    if not body:
        return 0
    width = len(body[0].split("\t"))
    header_is_commented = width > 1 and any(
        len(c.lstrip("#").split("\t")) == width for c in commented)
    return len(body) if header_is_commented else len(body) - 1


def is_ignored(rel):
    try:
        subprocess.run(["git", "check-ignore", "-q", "--", rel],
                       cwd=ROOT, check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        return False


def claims(blob):
    """-> ({kind: value}, [skipped], [ambiguous]) for ONE row's text."""
    text = STRUCK.sub("  ", blob)
    found, skipped, ambiguous = {}, [], []

    qualified = {m.group(1) for m in MD5_QUALIFIED.finditer(text)}
    for m in MD5_RE.finditer(text):
        if m.group(1) in qualified:
            skipped.append("md5 %s… is qualified (upstream/repo), not this "
                           "artifact's" % m.group(1)[:8])
            continue
        found.setdefault("md5", m.group(1))

    # ALL matches, not the first. Taking `.search` silently picks one of
    # several numbers by position, which made the STRUCK rule above pass its
    # own mutation test for the wrong reason: the live value happens to be
    # written before the struck one in every current row, so disabling the
    # stripper changed nothing and the guard looked load-bearing when it was
    # only lucky. Collecting all of them and REFUSING on disagreement makes
    # the strike do real work — without it these rows carry two different
    # `rows` values and the gate says so instead of choosing.
    for kind, rx in (("bytes", BYTES_RE), ("rows", ROWS_RE)):
        vals = {int(m.group(1).replace(",", "")) for m in rx.finditer(text)}
        if len(vals) == 1:
            found[kind] = vals.pop()
        elif len(vals) > 1:
            ambiguous.append(
                "%s: %s are all claimed unstruck — one of them is stale, or "
                "the row needs to say which is the artifact's. Refusing to "
                "pick by position." % (kind, sorted(vals)))
    return found, skipped, ambiguous


def main(argv):
    verbose = "--verbose" in argv
    with open(SOURCES, encoding="utf-8") as fh:
        rows = list(csv.reader(fh, delimiter="\t"))

    counts = {"verified": 0, "no_claim": 0, "fetched": 0,
              "skipped": 0, "mismatch": 0}
    bad, notes = [], []

    for r in rows[1:]:
        sid = r[0]
        if not sid.startswith("data/"):
            continue
        path = os.path.join(ROOT, sid)
        if not os.path.exists(path):
            if is_ignored(sid):
                counts["fetched"] += 1
                notes.append("%s — absent and git-ignored (fetched, not "
                             "committed)" % sid)
            else:
                counts["mismatch"] += 1
                bad.append("%s — named by a row and ABSENT from the "
                           "checkout, and it is not git-ignored" % sid)
            continue

        found, skipped, ambiguous = claims("\t".join(r))
        counts["skipped"] += len(skipped)
        for s in skipped:
            notes.append("%s — %s" % (sid, s))
        for a in ambiguous:
            counts["mismatch"] += 1
            bad.append("%s — %s" % (sid, a))
        if not found:
            counts["no_claim"] += 1
            notes.append("%s — no machine-checkable claim in this row" % sid)
            continue

        for kind, want in sorted(found.items()):
            if kind == "md5":
                with open(path, "rb") as fb:
                    got = hashlib.md5(fb.read()).hexdigest()
            elif kind == "bytes":
                got = os.path.getsize(path)
            else:
                got = data_rows(path)
            if got == want:
                counts["verified"] += 1
                if verbose:
                    print("  ok       %-38s %s" % (sid, kind))
            else:
                counts["mismatch"] += 1
                bad.append("%s — %s: row says %s, file is %s"
                           % (sid, kind, want, got))

    print("=== data/sources.tsv rows against the files they describe ===")
    print("  verified %d   no-claim %d   fetched %d   skipped-qualified %d   "
          "MISMATCH %d" % (counts["verified"], counts["no_claim"],
                           counts["fetched"], counts["skipped"],
                           counts["mismatch"]))
    print("  (five counts, never summed — doctrine 79)")

    if counts["verified"] == 0:
        print("\nFAIL — this gate verified NOTHING, which reads exactly like "
              "a pass. Either data/sources.tsv moved or the claim patterns "
              "stopped matching (doctrine 20).")
        return 1

    if verbose and notes:
        print("\n  not checked, and why:")
        for n in notes:
            print("    %s" % n)

    if bad:
        print("\n  MISMATCH — the row and the file disagree:")
        for b in bad:
            print("    %s" % b)
        print("\n  Re-derive the row from the file it describes; keep the old "
              "value struck (~~…~~) rather than deleting it, which this gate "
              "reads as history and not as a claim.")
        print("FAIL — %d claim(s) do not re-derive." % len(bad))
        return 1

    print("PASS — every unqualified claim re-derives from the file itself.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
